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

/** Fields for the overlay: detected fields + a virtual signature box when the PDF has none. */
export function buildOverlayFields(content: PdfFormContent, detected: PdfFormField[]): PdfFormField[] {
  const hasOnPageSignature = detected.some((f) => f.type === 'signature' && !f.readOnly && visibleWidgets(f).length > 0);
  const pos = content.signaturePosition;
  if (!content.requireSignature || hasOnPageSignature || !pos || !(pos.width > 0 && pos.height > 0)) return detected;

  const widget: PdfFieldWidget = {
    pageIndex: pos.pageIndex,
    rect: [pos.x, pos.y, pos.x + pos.width, pos.y + pos.height],
    x: pos.x,
    y: pos.y,
    width: pos.width,
    height: pos.height,
  };
  return [
    ...detected,
    { name: VIRTUAL_SIGNATURE_FIELD, type: 'signature', readOnly: false, required: true, tooltip: 'Your signature', widgets: [widget] },
  ];
}

/** Signature fields the signer can sign that are actually on a page. */
export const signableFields = (fields: PdfFormField[]) =>
  fields.filter((f) => f.type === 'signature' && !f.readOnly && visibleWidgets(f).length > 0);

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

/** One stamp per visible widget of every signed signature field. */
export function buildSignatureStamps(
  fields: PdfFormField[],
  values: PdfFieldValues,
  imageSizes: Record<string, { width: number; height: number }>,
): SignatureStampSpec[] {
  const stamps: SignatureStampSpec[] = [];
  for (const f of signableFields(fields)) {
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
