'use client';

// ============================================================================
// PdfFieldOverlay — interactive HTML controls positioned over a PDF page
//
// Phase 2, Step 2.3 (Onboarding Document System — APPROVED PLAN, Option A)
//
// Usage (inside PdfCanvasViewer):
//   <PdfCanvasViewer
//     hideFormWidgets            // canvas skips the PDF's own widgets; we draw them
//     renderPageOverlay={(m) => (
//       <PdfFieldOverlay metrics={m} fields={fields} values={values} onChange={...} />
//     )}
//   />
//
// Because hideFormWidgets removes the PDF's widget appearances from the canvas,
// read-only fields are rendered here too (as static text) so nothing disappears.
// `isFieldEditable` lets Phase 3 lock other signers' fields without changes here.
//
// Step 2.5 (mobile): on touch devices, small editable fields get an invisible
// enlarged tap area (painted UNDER all real controls, so tapping a control
// directly always hits that control), and focusing a text/dropdown field whose
// text would be unreadably small asks the viewer to zoom in and center it.
//
// Signature Suite D1/D2:
//   • Editable boxes are clearly visible (tinted fill + solid border), ink is
//     always dark, and required-but-empty boxes carry a red dot. The global
//     phone "inputs are 16px" rule skips these controls (globals.css), which
//     previously pushed the text out of small boxes so it looked invisible.
//   • On touch devices text/dropdown boxes are tappable previews that open the
//     large bottom input sheet (PdfFieldInputSheet) with Prev / Next / Done.
//   • Unsigned signature spots render as a solid blue "Sign" button.
//
// Signature Suite F3: signature-type fields are either a SIGNATURE or the
// signer's INITIALS (kind comes from the field name — see initials-fields.ts).
// Each unsigned spot is a blue "Sign" / "Initial" button. With a saved
// signature/initials one tap fills the spot; otherwise the pad opens on top of
// the form (nothing is lost) and the new item is saved + applied.
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, PenTool } from 'lucide-react';
import type { PdfFormField } from '@/types/onboarding-templates';
import type { PageViewportMetrics } from './types';
import {
  isFieldValueEmpty,
  layoutPageFields,
  radioValueFor,
  type OverlayItem,
  type PdfFieldValues,
} from './overlayLayout';
import SignaturePadModal from './SignaturePadModal';
import { useSavedSignature } from './useSavedSignature';
import { stampKindOfFieldName, STAMP_LABELS } from '@/lib/initials-fields';
import PdfFieldInputSheet from './PdfFieldInputSheet';
import { usePdfViewer } from './viewerContext';

export interface PdfFieldOverlayProps {
  metrics: PageViewportMetrics;
  fields: PdfFormField[];
  values: PdfFieldValues;
  onChange: (fieldName: string, value: string | boolean) => void;
  /** Lock every field (e.g. after submission). */
  disabled?: boolean;
  /** Per-field lock on top of the PDF's own read-only flag (Phase 3: other signers' fields). */
  isFieldEditable?: (field: PdfFormField) => boolean;
  /** Outline required fields that are still empty. */
  highlightMissing?: boolean;
  isDarkMode?: boolean;
}

const INK = '#111111';
const FONT_STACK = 'Helvetica, Arial, sans-serif';

// Step 2.5 — touch sizing
const READABLE_FONT_PX = 14; // focusing a field with smaller text zooms the viewer in (touch only)
const FOCUS_ZOOM_MAX = 2.5; // never auto-zoom past this scale
const TOUCH_TARGET_PX = 32; // desired minimum tap area for small controls
const MAX_TOUCH_SLOP_PX = 10; // max expansion per side (keeps dense forms usable)
const SHEET_REVEAL_DELAY_MS = 320; // let the phone keyboard finish opening before scrolling the field into view

const prettyName = (name: string) =>
  name
    .replace(/\[\d+\]/g, '')
    .split('.')
    .pop()!
    .replace(/[_-]+/g, ' ')
    .trim();

const fieldLabel = (field: PdfFormField) => field.tooltip || prettyName(field.name) || 'Form field';

/** Box styles: editable fields get a clearly visible tinted fill + border so users can spot them (D1). */
function boxClasses(editable: boolean, missing: boolean, filled: boolean): string {
  if (!editable) return 'bg-transparent border border-transparent';
  if (missing) return 'bg-red-500/20 border-2 border-red-600 focus:bg-white focus:border-red-700';
  return filled
    ? 'bg-sky-100/40 border border-sky-600/50 hover:border-sky-700 focus:bg-white focus:border-blue-600'
    : 'bg-sky-200/50 border border-sky-600/80 hover:border-sky-700 focus:bg-white focus:border-blue-600';
}

/** First visible widget of a field, used for page + reading order of the phone sheet. */
function firstWidget(field: PdfFormField) {
  return field.widgets?.find((w) => !w.hidden && w.rect?.length === 4);
}

export default function PdfFieldOverlay({
  metrics,
  fields,
  values,
  onChange,
  disabled = false,
  isFieldEditable,
  highlightMissing = false,
  isDarkMode = false,
}: PdfFieldOverlayProps) {
  const [signingField, setSigningField] = useState<PdfFormField | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const items = useMemo(
    () => layoutPageFields(fields, metrics.pageIndex, metrics.viewport),
    [fields, metrics.pageIndex, metrics.viewport],
  );

  const canEdit = (field: PdfFormField) =>
    !disabled && !field.readOnly && (isFieldEditable ? isFieldEditable(field) : true);

  const valueOf = (field: PdfFormField) => values[field.name] ?? field.currentValue;

  // ── F3: saved signature / initials (only fetched when this form has editable stamp spots) ──
  const hasSigSpots = fields.some((f) => f.type === 'signature' && stampKindOfFieldName(f.name) === 'signature' && canEdit(f));
  const hasIniSpots = fields.some((f) => f.type === 'signature' && stampKindOfFieldName(f.name) === 'initials' && canEdit(f));
  const savedSig = useSavedSignature(hasSigSpots, 'signature').saved;
  const savedIni = useSavedSignature(hasIniSpots, 'initials').saved;

  /** Tap on a stamp spot: empty + saved item → fill instantly; otherwise open the pad. */
  const tapStamp = (field: PdfFormField, hasValue: boolean) => {
    const saved = stampKindOfFieldName(field.name) === 'initials' ? savedIni : savedSig;
    if (!hasValue && saved) {
      onChange(field.name, saved.imageData);
      return;
    }
    setSigningField(field);
  };

  // ── Step 2.5: touch helpers ──
  const viewer = usePdfViewer();
  const isTouch = !!viewer?.isCoarsePointer;

  /** On phones, tiny text is unreadable while typing — zoom so it's ~14px, then center the field. */
  const revealOnFocus = (item: OverlayItem) => (e: React.FocusEvent<HTMLElement>) => {
    if (!viewer || !isTouch) return;
    const minScale =
      item.fontSize < READABLE_FONT_PX
        ? Math.min(FOCUS_ZOOM_MAX, metrics.scale * (READABLE_FONT_PX / item.fontSize))
        : undefined;
    viewer.revealElement(e.currentTarget, { minScale });
  };

  /** A tap on an enlarged hit area activates the real control it surrounds. */
  const activateControl = (container: HTMLElement | null, key: string) => {
    const el = container?.querySelector<HTMLElement>(`[data-pdf-control="${CSS.escape(key)}"]`);
    if (!el) return;
    if (el instanceof HTMLButtonElement) {
      el.click();
      return;
    }
    el.focus();
    if (el instanceof HTMLSelectElement) {
      try {
        (el as HTMLSelectElement & { showPicker?: () => void }).showPicker?.();
      } catch {
        /* showPicker unsupported or blocked — focus alone is fine */
      }
    }
  };

  /** Enlarged tap area for an editable control (touch only), or null if it's already big enough. */
  const touchSlopFor = (item: OverlayItem) => {
    if (!isTouch || !canEdit(item.field)) return null;
    const sx = Math.min(MAX_TOUCH_SLOP_PX, Math.max(0, (TOUCH_TARGET_PX - item.width) / 2));
    const sy = Math.min(MAX_TOUCH_SLOP_PX, Math.max(0, (TOUCH_TARGET_PX - item.height) / 2));
    if (sx < 1 && sy < 1) return null;
    return { left: item.left - sx, top: item.top - sy, width: item.width + sx * 2, height: item.height + sy * 2 };
  };

  // ── D1: phone input sheet ──
  /** Every editable text/dropdown field in reading order (all pages), for Prev / Next. */
  const sheetOrder = useMemo(() => {
    if (!isTouch) return [] as { name: string; pageIndex: number }[];
    const list: { name: string; pageIndex: number; top: number; left: number }[] = [];
    for (const f of fields) {
      if (f.type !== 'text' && f.type !== 'dropdown') continue;
      if (disabled || f.readOnly || (isFieldEditable && !isFieldEditable(f))) continue;
      const w = firstWidget(f);
      if (!w) continue;
      list.push({ name: f.name, pageIndex: w.pageIndex, top: Math.max(w.rect[1], w.rect[3]), left: Math.min(w.rect[0], w.rect[2]) });
    }
    // PDF y grows upward: higher `top` = nearer the top of the page. Same line (±3pt) → left to right.
    return list.sort(
      (a, b) => a.pageIndex - b.pageIndex || (Math.abs(a.top - b.top) > 3 ? b.top - a.top : a.left - b.left),
    );
  }, [isTouch, fields, disabled, isFieldEditable]);

  const active = viewer?.activeSheetField ?? null;
  const sheetField =
    isTouch && active && active.pageIndex === metrics.pageIndex
      ? fields.find((f) => f.name === active.fieldName && canEdit(f)) ?? null
      : null;
  const sheetIndex = sheetField ? sheetOrder.findIndex((s) => s.name === sheetField.name) : -1;

  const openSheet = (field: PdfFormField) => viewer?.openFieldSheet({ fieldName: field.name, pageIndex: metrics.pageIndex });
  const moveSheet = (delta: number) => {
    const target = sheetOrder[sheetIndex + delta];
    if (target) viewer?.openFieldSheet({ fieldName: target.name, pageIndex: target.pageIndex });
  };

  // Scroll the field being edited into view above the keyboard + sheet.
  useEffect(() => {
    if (!sheetField) return;
    const key = items.find((i) => i.field.name === sheetField.name)?.key;
    const el = key ? itemRefs.current[key] : null;
    if (!el) return;
    const t = window.setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), SHEET_REVEAL_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [sheetField, items]);

  const renderControl = (item: OverlayItem) => {
    const { field, innerWidth: w, innerHeight: h, fontSize } = item;
    const editable = canEdit(field);
    const value = valueOf(field);
    const missing = highlightMissing && editable && !!field.required && isFieldValueEmpty(field, value);
    const label = fieldLabel(field);
    const padX = Math.max(1, Math.min(4, 2 * metrics.scale));
    const isSheetTarget = sheetField?.name === field.name;

    const textStyle: React.CSSProperties = {
      width: w,
      height: h,
      fontSize,
      lineHeight: field.multiline ? 1.2 : 1,
      fontFamily: FONT_STACK,
      color: INK,
      // iOS can paint input text with its own fill colour; force dark ink everywhere (D1).
      WebkitTextFillColor: INK,
      opacity: 1,
      padding: field.multiline ? `${padX}px` : `0 ${padX}px`,
    };
    const activeRing = isSheetTarget ? ' ring-2 ring-blue-600 !bg-yellow-100/80' : '';

    switch (field.type) {
      case 'text': {
        const text = typeof value === 'string' ? value : '';
        if (!editable) {
          return (
            <div
              style={{ ...textStyle, whiteSpace: field.multiline ? 'pre-wrap' : 'nowrap' }}
              className={`overflow-hidden ${field.multiline ? '' : 'flex items-center'}`}
              aria-label={label}
            >
              {text}
            </div>
          );
        }
        // D1: phones tap a preview box → large input sheet.
        if (isTouch) {
          return (
            <button
              type="button"
              data-pdf-control={item.key}
              onClick={() => openSheet(field)}
              aria-label={`${label}${text ? `: ${text}` : ''} (tap to type)`}
              style={{ ...textStyle, whiteSpace: field.multiline ? 'pre-wrap' : 'nowrap', textAlign: 'left' }}
              className={`block overflow-hidden rounded-[2px] outline-none ${field.multiline ? '' : 'flex items-center'} ${boxClasses(true, missing, !!text)}${activeRing}`}
            >
              {text}
            </button>
          );
        }
        const common = {
          value: text,
          maxLength: field.maxLength,
          'aria-label': label,
          'aria-required': field.required || undefined,
          'aria-invalid': missing || undefined,
          title: label,
          style: { ...textStyle, WebkitAppearance: 'none' as const, appearance: 'none' as const },
          'data-pdf-control': item.key,
          onFocus: revealOnFocus(item),
          className: `block rounded-[2px] outline-none transition-colors ${boxClasses(true, missing, !!text)}`,
        };
        return field.multiline ? (
          <textarea {...common} className={`${common.className} resize-none`} onChange={(e) => onChange(field.name, e.target.value)} />
        ) : (
          <input type="text" {...common} onChange={(e) => onChange(field.name, e.target.value)} />
        );
      }

      case 'dropdown': {
        const selected = typeof value === 'string' ? value : '';
        if (!editable) {
          return (
            <div style={textStyle} className="flex items-center overflow-hidden whitespace-nowrap" aria-label={label}>
              {selected}
            </div>
          );
        }
        if (isTouch) {
          return (
            <button
              type="button"
              data-pdf-control={item.key}
              onClick={() => openSheet(field)}
              aria-label={`${label}${selected ? `: ${selected}` : ''} (tap to choose)`}
              style={{ ...textStyle, whiteSpace: 'nowrap', textAlign: 'left' }}
              className={`flex items-center justify-between overflow-hidden rounded-[2px] outline-none ${boxClasses(true, missing, !!selected)}${activeRing}`}
            >
              <span className="truncate">{selected}</span>
              <ChevronDown style={{ width: Math.max(6, fontSize), height: Math.max(6, fontSize), flexShrink: 0 }} />
            </button>
          );
        }
        return (
          <select
            value={selected}
            onChange={(e) => onChange(field.name, e.target.value)}
            onFocus={revealOnFocus(item)}
            data-pdf-control={item.key}
            aria-label={label}
            aria-required={field.required || undefined}
            aria-invalid={missing || undefined}
            title={label}
            style={{ ...textStyle, paddingTop: 0, paddingBottom: 0 }}
            className={`block rounded-[2px] outline-none cursor-pointer ${boxClasses(true, missing, !!selected)}`}
          >
            <option value="">{'\u00A0'}</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }

      case 'checkbox':
      case 'radio': {
        const isRadio = field.type === 'radio';
        const checked = isRadio ? value === radioValueFor(item) : value === true;
        const glyph = Math.max(4, Math.min(w, h) * 0.8);
        const mark = isRadio ? (
          <span className="block rounded-full" style={{ width: glyph * 0.6, height: glyph * 0.6, background: INK }} />
        ) : (
          <Check style={{ width: glyph, height: glyph, color: INK }} strokeWidth={3} />
        );
        if (!editable) {
          return (
            <div style={{ width: w, height: h }} className="flex items-center justify-center" aria-label={label}>
              {checked && mark}
            </div>
          );
        }
        return (
          <button
            type="button"
            role={isRadio ? 'radio' : 'checkbox'}
            data-pdf-control={item.key}
            aria-checked={checked}
            aria-label={isRadio ? `${label}: ${radioValueFor(item)}` : label}
            title={label}
            onClick={() => onChange(field.name, isRadio ? radioValueFor(item) : !checked)}
            style={{ width: w, height: h }}
            className={`flex items-center justify-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 ${
              isRadio ? 'rounded-full' : 'rounded-[2px]'
            } ${boxClasses(true, missing, checked)}`}
          >
            {checked && mark}
          </button>
        );
      }

      case 'signature': {
        const stampKind = stampKindOfFieldName(field.name);
        const words = STAMP_LABELS[stampKind];
        const signature = typeof value === 'string' && value.startsWith('data:image') ? value : null;
        const image = signature && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signature} alt={words.noun} className="max-w-full max-h-full object-contain" draggable={false} />
        );
        if (!editable) {
          return (
            <div style={{ width: w, height: h }} className="flex items-center justify-start overflow-hidden" aria-label={label}>
              {image}
            </div>
          );
        }
        if (signature) {
          return (
            <button
              type="button"
              onClick={() => tapStamp(field, true)}
              data-pdf-control={item.key}
              aria-label={`${label} (done — tap to redo)`}
              title="Tap to redo"
              style={{ width: w, height: h }}
              className="flex items-center justify-start overflow-hidden rounded-[2px] outline-none bg-transparent border border-dashed border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {image}
            </button>
          );
        }
        // D2: an unmistakable solid blue "Sign" button fills every unsigned spot.
        const signFont = Math.max(8, Math.min(15, h * 0.45));
        return (
          <button
            type="button"
            onClick={() => tapStamp(field, false)}
            data-pdf-control={item.key}
            aria-label={`${label} (tap to ${words.button.toLowerCase()})`}
            title={`Tap to ${words.button.toLowerCase()}`}
            style={{ width: w, height: h, fontSize: signFont, fontFamily: FONT_STACK }}
            className={`flex items-center justify-center gap-1 overflow-hidden rounded-[3px] outline-none font-bold text-white shadow-md active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-300 ${
              missing ? 'bg-red-600 ring-2 ring-red-300 animate-pulse' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            <PenTool style={{ width: '1em', height: '1em', flexShrink: 0 }} />
            {w >= signFont * 3.2 && <span className="whitespace-nowrap">{words.button}</span>}
          </button>
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      {/* Step 2.5: enlarged tap areas (touch only). Rendered FIRST so every real control paints above them. */}
      {isTouch &&
        items.map((item) => {
          const slop = touchSlopFor(item);
          if (!slop) return null;
          return (
            <div
              key={`slop-${item.key}`}
              aria-hidden
              className="absolute"
              style={slop}
              onClick={(e) => activateControl(e.currentTarget.parentElement, item.key)}
            />
          );
        })}

      {items.map((item) => {
        const editable = canEdit(item.field);
        const needsValue = editable && !!item.field.required && item.field.type !== 'signature'
          && isFieldValueEmpty(item.field, valueOf(item.field));
        return (
          <div
            key={item.key}
            ref={(el) => {
              itemRefs.current[item.key] = el;
            }}
            data-pdf-field={item.field.name}
            className="absolute flex items-center justify-center"
            style={{ left: item.left, top: item.top, width: item.width, height: item.height, scrollMarginTop: 72 }}
          >
            {/* On 90°/270° pages the inner control is laid out unrotated, then rotated to match the page. */}
            <div
              className="shrink-0"
              style={item.rotation ? { transform: `rotate(${item.rotation}deg)` } : undefined}
            >
              {renderControl(item)}
            </div>
            {/* D1: required-but-empty marker */}
            {needsValue && (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-600 ring-1 ring-white pointer-events-none"
              />
            )}
          </div>
        );
      })}

      {sheetField && (
        <PdfFieldInputSheet
          field={sheetField}
          label={fieldLabel(sheetField)}
          value={typeof valueOf(sheetField) === 'string' ? (valueOf(sheetField) as string) : ''}
          onChange={(v) => onChange(sheetField.name, v)}
          onClose={() => viewer?.openFieldSheet(null)}
          onPrev={sheetIndex > 0 ? () => moveSheet(-1) : undefined}
          onNext={sheetIndex >= 0 && sheetIndex < sheetOrder.length - 1 ? () => moveSheet(1) : undefined}
          positionLabel={sheetIndex >= 0 ? `${sheetIndex + 1} of ${sheetOrder.length}` : undefined}
          isDarkMode={isDarkMode}
        />
      )}

      <SignaturePadModal
        open={!!signingField}
        kind={signingField ? stampKindOfFieldName(signingField.name) : 'signature'}
        title={signingField ? fieldLabel(signingField) : undefined}
        isDarkMode={isDarkMode}
        onCancel={() => setSigningField(null)}
        onApply={(dataUrl) => {
          if (signingField) onChange(signingField.name, dataUrl);
          setSigningField(null);
        }}
      />
    </>
  );
}
