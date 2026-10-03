// ============================================================================
// lib/pdf-form-engine.ts
//
// Core server-side engine for native PDF AcroForm processing. Provides:
//   1. Field Detection — Extract all fillable fields from a PDF (text, checkbox,
//      dropdown, radio, signature) with their metadata (name, type, rect, page).
//   2. Field Filling — Populate detected fields with user-supplied values.
//   3. Signature Stamping — Overlay a drawn signature image (base64 PNG) onto
//      any field designated as a signature field, or at arbitrary coordinates.
//   4. Flattening — Lock all form fields to produce a non-editable final PDF.
//   5. SHA-256 Sealing — Compute a tamper-evident hash of the flattened PDF
//      for ESIGN Act compliance and audit trails.
//   6. Storage & Vault — Upload the sealed PDF to Firebase Storage and create
//      a compliance_documents record in the org's vault.
//
// Uses pdf-lib (pure JS, no native deps, works in Node.js and browsers).
// ============================================================================

import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFName,
  PDFString,
  PDFHexString,
  AnnotationFlags,
  rgb,
} from 'pdf-lib';
import type { PDFField, PDFWidgetAnnotation, PDFObject } from 'pdf-lib';
import { createHash } from 'crypto';
import type { PdfFieldWidget } from '@/types/onboarding-templates';

export type { PdfFieldWidget };

// ── Types ───────────────────────────────────────────────────────────────────

export interface PdfFormField {
  /** Unique field name from the PDF AcroForm (e.g. "topmostSubform[0].Page1[0].f1_01[0]"). */
  name: string;
  /** Detected field type. */
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'signature' | 'unknown';
  /** Whether the field is currently read-only in the source PDF. */
  readOnly: boolean;
  /** For dropdowns: the available option values. */
  options?: string[];
  /** Current value (if any) in the source PDF. */
  currentValue?: string | boolean;
  /** The page index (0-based) this field appears on. */
  pageIndex?: number;
  /** Field description / tooltip from the PDF. */
  tooltip?: string;
  /** Whether this field is required (if marked in PDF). */
  required?: boolean;
  /** Phase 2 Step 2.2 — every on-page placement of this field (PDF user space). */
  widgets?: PdfFieldWidget[];
  /** Text fields: allows line breaks. */
  multiline?: boolean;
  /** Text fields: maximum character count. */
  maxLength?: number;
  /** Font size (pt) from the /DA string. Absent = auto-size. */
  fontSize?: number;
}

export interface PdfFillData {
  /** Map of field name → value to fill.
   *  - For text fields: string value
   *  - For checkboxes: boolean (true = checked)
   *  - For dropdowns: the selected option string
   *  - For radio groups: the selected option string
   */
  fields: Record<string, string | boolean>;
  /** Optional signature stamps to overlay on the PDF. */
  signatures?: PdfSignatureStamp[];
}

export interface PdfSignatureStamp {
  /** Base64 data URL of the signature image (PNG). */
  imageData: string;
  /** Page index (0-based) to stamp on. */
  pageIndex: number;
  /** X coordinate (from left edge, in PDF points). */
  x: number;
  /** Y coordinate (from bottom edge, in PDF points). */
  y: number;
  /** Width of the signature image in PDF points. */
  width: number;
  /** Height of the signature image in PDF points. */
  height: number;
}

export interface PdfProcessingResult {
  /** The flattened PDF as a Uint8Array. */
  pdfBytes: Uint8Array;
  /** SHA-256 hash of the flattened PDF (hex). */
  sha256Hash: string;
  /** Number of fields that were filled. */
  fieldsFilled: number;
  /** Number of signature stamps applied. */
  signaturesApplied: number;
  /** Total number of form fields detected in the source PDF. */
  totalFieldsDetected: number;
}

// ── Field Detection ─────────────────────────────────────────────────────────

/**
 * Loads a PDF from bytes and extracts all AcroForm field metadata, including
 * each field's on-page widget geometry (Phase 2, Step 2.2).
 * Works in both Node.js and browser environments.
 */
export async function detectPdfFields(pdfBytes: Uint8Array | ArrayBuffer): Promise<PdfFormField[]> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const rawFields = form.getFields();
  const pageMaps = buildPageMaps(pdfDoc);

  const fields: PdfFormField[] = [];

  for (const field of rawFields) {
    const name = field.getName();
    let type: PdfFormField['type'] = 'unknown';
    let currentValue: string | boolean | undefined;
    let options: string[] | undefined;
    let readOnly = false;

    if (field instanceof PDFTextField) {
      type = 'text';
      currentValue = field.getText() || '';
      readOnly = field.isReadOnly();
    } else if (field instanceof PDFCheckBox) {
      type = 'checkbox';
      currentValue = field.isChecked();
      readOnly = field.isReadOnly();
    } else if (field instanceof PDFDropdown) {
      type = 'dropdown';
      options = field.getOptions();
      const selected = field.getSelected();
      currentValue = selected.length > 0 ? selected[0] : '';
      readOnly = field.isReadOnly();
    } else if (field instanceof PDFRadioGroup) {
      type = 'radio';
      options = field.getOptions();
      currentValue = field.getSelected() || '';
      readOnly = field.isReadOnly();
    } else {
      // Check if this might be a signature field by examining the field dictionary
      const dict = field.acroField.dict;
      const ftValue = dict.get(PDFName.of('FT'));
      if (ftValue && ftValue.toString() === '/Sig') {
        type = 'signature';
      }
    }

    // Attempt to detect signature fields by naming convention
    if (type === 'unknown' || type === 'text') {
      const lowerName = name.toLowerCase();
      if (
        lowerName.includes('signature') ||
        lowerName.includes('sign_here') ||
        lowerName.includes('signhere') ||
        lowerName.includes('sig_field')
      ) {
        type = 'signature';
      }
    }

    fields.push({
      name,
      type,
      readOnly,
      ...(options ? { options } : {}),
      currentValue,
      ...extractFieldLayout(field, options, pageMaps),
    });
  }

  return fields;
}

// ── Widget Geometry (Phase 2, Step 2.2) ─────────────────────────────────────
//
// Each AcroForm field owns one or more widget annotations — the boxes actually
// drawn on a page. We record every widget's page and /Rect in raw PDF user
// space (points, bottom-left origin). The client converts these to CSS pixels
// with pdf.js `viewport.convertToViewportRectangle(rect)`, which handles
// scale, page rotation, and CropBox offset, so no conversion happens here.

interface PageMaps {
  /** Annotation dict (object identity) → index of the page whose /Annots lists it. */
  byAnnotation: Map<PDFObject, number>;
  /** Page ref string ("12 0 R") → page index, for resolving a widget's /P entry. */
  byPageRef: Map<string, number>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function buildPageMaps(pdfDoc: PDFDocument): PageMaps {
  const byAnnotation = new Map<PDFObject, number>();
  const byPageRef = new Map<string, number>();

  pdfDoc.getPages().forEach((page, pageIndex) => {
    byPageRef.set(page.ref.toString(), pageIndex);
    const annots = page.node.Annots();
    if (!annots) return;
    for (let i = 0; i < annots.size(); i++) {
      // lookup() resolves indirect refs; pdf-lib caches objects, so this is the
      // same instance as the widget's dict and identity comparison works.
      const annot = annots.lookup(i);
      if (annot && !byAnnotation.has(annot)) byAnnotation.set(annot, pageIndex);
    }
  });

  return { byAnnotation, byPageRef };
}

function resolveWidgetPage(widget: PDFWidgetAnnotation, maps: PageMaps): number {
  // /Annots membership decides where a widget is actually displayed.
  const fromAnnots = maps.byAnnotation.get(widget.dict);
  if (fromAnnots !== undefined) return fromAnnots;
  // Fallback: the widget's optional /P back-reference to its page.
  const pageRef = widget.P();
  const fromP = pageRef ? maps.byPageRef.get(pageRef.toString()) : undefined;
  return fromP ?? -1;
}

function readWidget(
  widget: PDFWidgetAnnotation,
  maps: PageMaps,
  exportValue: string | undefined,
): PdfFieldWidget | null {
  let box: { x: number; y: number; width: number; height: number };
  try {
    box = widget.getRectangle();
  } catch {
    return null; // missing or malformed /Rect — nothing to position
  }
  if (![box.x, box.y, box.width, box.height].every(Number.isFinite)) return null;

  // Some PDFs store /Rect corners in reverse order; normalize to x1<x2, y1<y2.
  const x1 = round2(Math.min(box.x, box.x + box.width));
  const y1 = round2(Math.min(box.y, box.y + box.height));
  const x2 = round2(Math.max(box.x, box.x + box.width));
  const y2 = round2(Math.max(box.y, box.y + box.height));
  const width = round2(x2 - x1);
  const height = round2(y2 - y1);

  const hidden =
    widget.hasFlag(AnnotationFlags.Hidden) ||
    widget.hasFlag(AnnotationFlags.NoView) ||
    width < 1 ||
    height < 1;

  return {
    pageIndex: resolveWidgetPage(widget, maps),
    rect: [x1, y1, x2, y2],
    x: x1,
    y: y1,
    width,
    height,
    ...(exportValue ? { exportValue } : {}),
    ...(hidden ? { hidden: true } : {}),
  };
}

function readTooltip(field: PDFField): string | undefined {
  const tu = field.acroField.dict.lookup(PDFName.of('TU'));
  if (tu instanceof PDFString || tu instanceof PDFHexString) {
    const text = tu.decodeText().trim();
    return text || undefined;
  }
  return undefined;
}

/** Pulls the font size out of a /DA string like "/Helv 10 Tf 0 g". 0 means auto. */
function parseFontSize(da: string | undefined): number | undefined {
  if (!da) return undefined;
  const match = da.match(/(\d*\.?\d+)\s+Tf\b/);
  const size = match ? parseFloat(match[1]) : NaN;
  return size > 0 ? round2(size) : undefined;
}

/**
 * Geometry + overlay hints for one field. Never throws: a malformed field just
 * comes back without layout data instead of breaking detection for the PDF.
 */
function extractFieldLayout(
  field: PDFField,
  options: string[] | undefined,
  maps: PageMaps,
): Pick<PdfFormField, 'widgets' | 'pageIndex' | 'tooltip' | 'required' | 'multiline' | 'maxLength' | 'fontSize'> {
  const layout: ReturnType<typeof extractFieldLayout> = {};

  try {
    const rawWidgets = field.acroField.getWidgets();
    const isToggle = field instanceof PDFCheckBox || field instanceof PDFRadioGroup;
    // pdf-lib lists radio options in widget order, so index i ↔ widget i when counts match.
    const optionsMatchWidgets = !!options && options.length === rawWidgets.length;

    const widgets: PdfFieldWidget[] = [];
    rawWidgets.forEach((widget, i) => {
      let exportValue: string | undefined;
      if (isToggle) {
        exportValue = optionsMatchWidgets ? options![i] : widget.getOnValue()?.decodeText();
      }
      const parsed = readWidget(widget, maps, exportValue);
      if (parsed) widgets.push(parsed);
    });

    if (widgets.length > 0) {
      layout.widgets = widgets;
      const primary = widgets.find((w) => !w.hidden && w.pageIndex >= 0) ?? widgets.find((w) => w.pageIndex >= 0);
      if (primary) layout.pageIndex = primary.pageIndex;
    }

    if (field instanceof PDFTextField || field instanceof PDFDropdown) {
      const da = rawWidgets[0]?.getDefaultAppearance() ?? field.acroField.getDefaultAppearance();
      const fontSize = parseFontSize(da);
      if (fontSize) layout.fontSize = fontSize;
    }
    if (field instanceof PDFTextField) {
      if (field.isMultiline()) layout.multiline = true;
      const maxLength = field.getMaxLength();
      if (maxLength !== undefined && maxLength > 0) layout.maxLength = maxLength;
    }
  } catch (err) {
    console.warn(`[PDF Form Engine] Could not read layout for field "${field.getName()}":`, err);
  }

  try {
    const tooltip = readTooltip(field);
    if (tooltip) layout.tooltip = tooltip;
    if (field.isRequired()) layout.required = true;
  } catch {
    // Optional metadata — ignore
  }

  return layout;
}

// ── Field Filling & Signature Stamping ──────────────────────────────────────

/**
 * Fills form fields, stamps signatures, and flattens a PDF.
 * Returns the processed PDF bytes and a SHA-256 hash for integrity verification.
 */
export async function fillAndFlattenPdf(
  pdfBytes: Uint8Array | ArrayBuffer,
  fillData: PdfFillData,
): Promise<PdfProcessingResult> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  let fieldsFilled = 0;
  let signaturesApplied = 0;
  const totalFieldsDetected = form.getFields().length;

  // ── Fill Fields ──
  for (const [fieldName, value] of Object.entries(fillData.fields)) {
    try {
      if (typeof value === 'boolean') {
        // Checkbox
        const checkbox = form.getCheckBox(fieldName);
        if (value) {
          checkbox.check();
        } else {
          checkbox.uncheck();
        }
        fieldsFilled++;
      } else if (typeof value === 'string') {
        // Try text field first, then dropdown, then radio
        try {
          const textField = form.getTextField(fieldName);
          textField.setText(value);
          fieldsFilled++;
        } catch {
          try {
            const dropdown = form.getDropdown(fieldName);
            dropdown.select(value);
            fieldsFilled++;
          } catch {
            try {
              const radio = form.getRadioGroup(fieldName);
              radio.select(value);
              fieldsFilled++;
            } catch {
              console.warn(`[PDF Form Engine] Could not fill field "${fieldName}" — not found or unsupported type`);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[PDF Form Engine] Error filling field "${fieldName}":`, err);
    }
  }

  // ── Flatten ──
  // Flatten makes all fields read-only and bakes their values into the page content.
  // This prevents post-signing tampering.
  // Phase 2 Step 2.4: flatten BEFORE stamping. Flattening appends each field's
  // appearance to the page content, so a field with a background drawn after
  // the stamp could paint over the signature. Stamping last keeps it on top.
  form.flatten();

  // ── Stamp Signatures ──
  if (fillData.signatures && fillData.signatures.length > 0) {
    for (const stamp of fillData.signatures) {
      try {
        // Extract raw PNG bytes from the data URL
        const base64Data = stamp.imageData.replace(/^data:image\/\w+;base64,/, '');
        const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const pngImage = await pdfDoc.embedPng(imageBytes);

        const pages = pdfDoc.getPages();
        const page = pages[stamp.pageIndex];
        if (!page) {
          console.warn(`[PDF Form Engine] Signature stamp page ${stamp.pageIndex} does not exist`);
          continue;
        }

        page.drawImage(pngImage, {
          x: stamp.x,
          y: stamp.y,
          width: stamp.width,
          height: stamp.height,
        });
        signaturesApplied++;
      } catch (err) {
        console.warn('[PDF Form Engine] Error stamping signature:', err);
      }
    }
  }

  // ── Serialize ──
  const resultBytes = await pdfDoc.save();

  // ── SHA-256 Seal ──
  const sha256Hash = createHash('sha256').update(resultBytes).digest('hex');

  return {
    pdfBytes: resultBytes,
    sha256Hash,
    fieldsFilled,
    signaturesApplied,
    totalFieldsDetected,
  };
}

// ── Client-Friendly Field Extraction ────────────────────────────────────────

/**
 * Lighter version of detectPdfFields that returns only the data needed for
 * the client-side form UI. Strips internal pdf-lib references.
 * Can be used in browser or server.
 */
export async function extractFieldsForUI(pdfBytes: Uint8Array | ArrayBuffer): Promise<{
  fields: PdfFormField[];
  pageCount: number;
  title?: string;
}> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const fields = await detectPdfFields(pdfBytes);

  return {
    fields: fields.filter((f) => !f.readOnly),
    pageCount: pdfDoc.getPageCount(),
    title: pdfDoc.getTitle() || undefined,
  };
}

// ── SHA-256 Utility ─────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hash of arbitrary bytes (used for policy text hashing,
 * document integrity seals, etc.).
 */
export function computeSha256(data: Uint8Array | Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}
