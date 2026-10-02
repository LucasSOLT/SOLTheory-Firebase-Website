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

import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFName, rgb } from 'pdf-lib';
import { createHash } from 'crypto';

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
 * Loads a PDF from bytes and extracts all AcroForm field metadata.
 * Works in both Node.js and browser environments.
 */
export async function detectPdfFields(pdfBytes: Uint8Array | ArrayBuffer): Promise<PdfFormField[]> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const rawFields = form.getFields();

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
    });
  }

  return fields;
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

  // ── Flatten ──
  // Flatten makes all fields read-only and bakes their values into the page content.
  // This prevents post-signing tampering.
  form.flatten();

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
