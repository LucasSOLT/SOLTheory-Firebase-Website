// ============================================================================
// Overlay layout — pure geometry for PDF field overlays (no React)
//
// Phase 2, Step 2.3 (Onboarding Document System — APPROVED PLAN, Option A)
//
// Converts each widget's PDF-space /Rect (from Step 2.2) into a CSS box on a
// rendered page (from Step 2.1). pdf.js does the coordinate transform, so
// scale, page rotation, and CropBox offsets are all handled for us.
// ============================================================================

import type { PdfFieldWidget, PdfFormField } from '@/types/onboarding-templates';

/** Field values keyed by field name: text/dropdown/radio → string, checkbox → boolean, signature → PNG data URL. */
export type PdfFieldValues = Record<string, string | boolean>;

/** The slice of a pdf.js PageViewport we need (keeps this file testable in Node). */
export interface ViewportLike {
  scale: number;
  rotation: number;
  convertToViewportRectangle(rect: number[]): number[];
}

/** Field types the overlay can render. 'unknown' (push buttons, list boxes) is skipped. */
const RENDERABLE_TYPES = new Set<PdfFormField['type']>(['text', 'checkbox', 'dropdown', 'radio', 'signature']);

export interface OverlayItem {
  /** Stable React key: `${field.name}#${widgetIndex}`. */
  key: string;
  field: PdfFormField;
  widget: PdfFieldWidget;
  widgetIndex: number;
  /** Footprint on the rendered page in CSS px (top-left origin). */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Control size before rotation — swapped vs. the footprint on 90°/270° pages. */
  innerWidth: number;
  innerHeight: number;
  /** Page rotation (0, 90, 180, 270); controls are CSS-rotated to match the page content. */
  rotation: number;
  /** Text size in CSS px. */
  fontSize: number;
}

const normalizeRotation = (deg: number) => ((Math.round(deg / 90) * 90) % 360 + 360) % 360;

/** Font size in CSS px. Uses the PDF's /DA size when present, otherwise fits the box. */
export function computeFontSize(field: PdfFormField, boxHeightPx: number, scale: number): number {
  if (field.type === 'checkbox' || field.type === 'radio') {
    return Math.max(4, boxHeightPx * 0.8);
  }
  if (field.fontSize && !field.multiline) {
    // Respect the PDF's size, but never overflow a single-line box.
    return Math.max(4, Math.min(field.fontSize * scale, boxHeightPx * 0.85));
  }
  if (field.fontSize) return Math.max(4, field.fontSize * scale);
  if (field.multiline) return Math.max(4, 10 * scale);
  // Auto-size like PDF viewers do: proportional to the box, capped at 12pt.
  return Math.max(4, Math.min(boxHeightPx * 0.62, 12 * scale));
}

/**
 * Every visible, renderable widget on one page, positioned in CSS px and
 * sorted top-to-bottom, left-to-right so Tab moves through the form naturally.
 */
export function layoutPageFields(
  fields: PdfFormField[],
  pageIndex: number,
  viewport: ViewportLike,
): OverlayItem[] {
  const rotation = normalizeRotation(viewport.rotation);
  const sideways = rotation === 90 || rotation === 270;
  const items: OverlayItem[] = [];

  for (const field of fields) {
    if (!field.widgets || !RENDERABLE_TYPES.has(field.type)) continue;

    field.widgets.forEach((widget, widgetIndex) => {
      if (widget.hidden || widget.pageIndex !== pageIndex || widget.rect?.length !== 4) return;

      const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(widget.rect);
      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      if (!(width > 0 && height > 0)) return;

      const innerWidth = sideways ? height : width;
      const innerHeight = sideways ? width : height;

      items.push({
        key: `${field.name}#${widgetIndex}`,
        field,
        widget,
        widgetIndex,
        left,
        top,
        width,
        height,
        innerWidth,
        innerHeight,
        rotation,
        fontSize: computeFontSize(field, innerHeight, viewport.scale),
      });
    });
  }

  // Reading order: group into ~row bands so slightly misaligned boxes on the same line sort left-to-right.
  const band = Math.max(4, 6 * viewport.scale);
  return items.sort((a, b) => Math.round(a.top / band) - Math.round(b.top / band) || a.left - b.left);
}

/** The value a radio widget stands for (falls back to the widget index if the PDF didn't say). */
export function radioValueFor(item: Pick<OverlayItem, 'widget' | 'widgetIndex' | 'field'>): string {
  return item.widget.exportValue ?? item.field.options?.[item.widgetIndex] ?? String(item.widgetIndex);
}

export function isFieldValueEmpty(field: PdfFormField, value: string | boolean | undefined): boolean {
  if (field.type === 'checkbox') return value !== true;
  return typeof value !== 'string' || value.trim() === '';
}

/** Required fields that the current signer can edit but hasn't filled. */
export function getMissingRequiredFields(
  fields: PdfFormField[],
  values: PdfFieldValues,
  isEditable: (field: PdfFormField) => boolean = (f) => !f.readOnly,
): PdfFormField[] {
  return fields.filter(
    (f) => f.required && RENDERABLE_TYPES.has(f.type) && isEditable(f) && isFieldValueEmpty(f, values[f.name]),
  );
}
