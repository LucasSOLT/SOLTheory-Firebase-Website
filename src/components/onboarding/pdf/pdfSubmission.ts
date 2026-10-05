// ============================================================================
// PDF form submission helpers (pure — no React, no DOM except loadImageSize)
//
// Phase 2, Step 2.4 (Onboarding Document System — APPROVED PLAN, Option A)
//
// Splits overlay values into (a) AcroForm values for pdf-lib to fill and
// (b) signature images to stamp at each signature widget's exact rectangle.
// Signatures must never be sent as field text.
// ============================================================================

import type { PdfFieldWidget, PdfFormContent, PdfFormField } from '@/types/onboarding-templates';
import type { PdfFieldValues } from './overlayLayout';
import { signatureSpotsOf, spotToWidget, splitSpotsByKind } from '@/lib/signature-spots';
import { stampKindOfFieldName, VIRTUAL_INITIALS_FIELD, type StampKind } from '@/lib/initials-fields';

/**
 * Key for the on-page signature box built from the admin's `signaturePosition`
 * setting, used when a PDF (e.g. the IRS W-4) has a printed signature line but
 * no AcroForm signature field.
 */
export const VIRTUAL_SIGNATURE_FIELD = '__soltheory_signature__';

export interface SignatureStampSpec {
  imageData: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const isSignatureImage = (v: unknown): v is string => typeof v === 'string' && v.startsWith('data:image');

const visibleWidgets = (f: PdfFormField) => (f.widgets || []).filter((w) => !w.hidden && w.pageIndex >= 0);

/** Fields for the overlay: detected fields + virtual signature / initials boxes from the admin's spots. */
export function buildOverlayFields(content: PdfFormContent, detected: PdfFormField[]): PdfFormField[] {
  // Phase F: an AcroForm field named like "Initials" is an initials spot, not the document's signature.
  const hasOnPageSignature = detected.some(
    (f) =>
      f.type === 'signature' &&
      stampKindOfFieldName(f.name) === 'signature' &&
      !f.readOnly &&
      visibleWidgets(f).length > 0,
  );
  // Signature Suite Phase B: every admin-set spot is a widget of ONE virtual field (one signature fills all).
  // Phase F: initials spots are widgets of a SECOND virtual field (one set of initials fills all).
  const spots = signatureSpotsOf(content);
  if (!content.requireSignature || spots.length === 0) return detected;
  const { signature, initials } = splitSpotsByKind(spots);

  const extra: PdfFormField[] = [];
  if (!hasOnPageSignature && signature.length > 0) {
    extra.push({
      name: VIRTUAL_SIGNATURE_FIELD,
      type: 'signature',
      readOnly: false,
      required: true,
      tooltip: 'Your signature',
      widgets: signature.map(spotToWidget),
    });
  }
  if (initials.length > 0) {
    extra.push({
      name: VIRTUAL_INITIALS_FIELD,
      type: 'signature',
      readOnly: false,
      required: true,
      tooltip: 'Your initials',
      widgets: initials.map(spotToWidget),
    });
  }
  return extra.length ? [...detected, ...extra] : detected;
}

/** Signature fields the signer can sign that are actually on a page. */
export const signableFields = (fields: PdfFormField[]) =>
  fields.filter((f) => f.type === 'signature' && !f.readOnly && visibleWidgets(f).length > 0);

/** Phase F — signable fields of one kind (signature or initials). */
export const signableFieldsOfKind = (fields: PdfFormField[], kind: StampKind) =>
  signableFields(fields).filter((f) => stampKindOfFieldName(f.name) === kind);

/**
 * Signature Suite Phase B — how many on-page signature spots these fields have, and how many are signed.
 * Phase F: pass `kind` to count only signatures or only initials (default: both, as before).
 */
export function signatureSpotCounts(
  fields: PdfFormField[],
  values: PdfFieldValues,
  kind?: StampKind,
): { total: number; signed: number } {
  let total = 0;
  let signed = 0;
  for (const f of kind ? signableFieldsOfKind(fields, kind) : signableFields(fields)) {
    const n = visibleWidgets(f).length;
    total += n;
    if (isSignatureImage(values[f.name])) signed += n;
  }
  return { total, signed };
}

/** AcroForm values to fill: everything except signatures, read-only and unsupported fields. */
export function buildFillFields(fields: PdfFormField[], values: PdfFieldValues): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const f of fields) {
    if (f.name === VIRTUAL_SIGNATURE_FIELD || f.type === 'signature' || f.type === 'unknown' || f.readOnly) continue;
    const v = values[f.name];
    if (v === undefined) continue;
    if (f.type === 'checkbox') out[f.name] = v === true;
    else if (typeof v === 'string') out[f.name] = v;
  }
  return out;
}

/** Fits an image inside a widget box, preserving aspect ratio: left-aligned, vertically centered, 1pt inset. */
export function fitSignatureInBox(
  box: Pick<PdfFieldWidget, 'x' | 'y' | 'width' | 'height'>,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number; width: number; height: number } {
  const inset = Math.min(1, box.width / 10, box.height / 10);
  const availW = box.width - inset * 2;
  const availH = box.height - inset * 2;
  if (!(imageWidth > 0 && imageHeight > 0) || availW <= 0 || availH <= 0) {
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }
  const scale = Math.min(availW / imageWidth, availH / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { x: box.x + inset, y: box.y + inset + (availH - height) / 2, width, height };
}

/** One stamp per visible widget of every signed signature field (Phase F: optionally one kind only). */
export function buildSignatureStamps(
  fields: PdfFormField[],
  values: PdfFieldValues,
  imageSizes: Record<string, { width: number; height: number }>,
  kind?: StampKind,
): SignatureStampSpec[] {
  const stamps: SignatureStampSpec[] = [];
  for (const f of kind ? signableFieldsOfKind(fields, kind) : signableFields(fields)) {
    const image = values[f.name];
    if (!isSignatureImage(image)) continue;
    const size = imageSizes[f.name] || { width: 0, height: 0 };
    for (const w of visibleWidgets(f)) {
      stamps.push({ imageData: image, pageIndex: w.pageIndex, ...fitSignatureInBox(w, size.width, size.height) });
    }
  }
  return stamps;
}

/** Natural pixel size of a data-URL image (browser only). */
export function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}
