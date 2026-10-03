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
// ============================================================================

import React, { useMemo, useState } from 'react';
import { Check, PenTool } from 'lucide-react';
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

const prettyName = (name: string) =>
  name
    .replace(/\[\d+\]/g, '')
    .split('.')
    .pop()!
    .replace(/[_-]+/g, ' ')
    .trim();

const fieldLabel = (field: PdfFormField) => field.tooltip || prettyName(field.name) || 'Form field';

/** Box styles: editable fields get the familiar light-blue fill so users can spot them. */
function boxClasses(editable: boolean, missing: boolean, filled: boolean): string {
  if (!editable) return 'bg-transparent border border-transparent';
  if (missing) return 'bg-red-500/10 border border-red-500/70 focus:bg-white focus:border-red-600';
  return `${filled ? 'bg-blue-500/[0.06]' : 'bg-blue-500/10'} border border-blue-500/35 hover:border-blue-500/70 focus:bg-white focus:border-blue-600`;
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

  const items = useMemo(
    () => layoutPageFields(fields, metrics.pageIndex, metrics.viewport),
    [fields, metrics.pageIndex, metrics.viewport],
  );

  const canEdit = (field: PdfFormField) =>
    !disabled && !field.readOnly && (isFieldEditable ? isFieldEditable(field) : true);

  const valueOf = (field: PdfFormField) => values[field.name] ?? field.currentValue;

  const renderControl = (item: OverlayItem) => {
    const { field, innerWidth: w, innerHeight: h, fontSize } = item;
    const editable = canEdit(field);
    const value = valueOf(field);
    const missing = highlightMissing && editable && !!field.required && isFieldValueEmpty(field, value);
    const label = fieldLabel(field);
    const padX = Math.max(1, Math.min(4, 2 * metrics.scale));

    const textStyle: React.CSSProperties = {
      width: w,
      height: h,
      fontSize,
      lineHeight: field.multiline ? 1.2 : 1,
      fontFamily: FONT_STACK,
      color: INK,
      padding: field.multiline ? `${padX}px` : `0 ${padX}px`,
    };

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
        const common = {
          value: text,
          maxLength: field.maxLength,
          'aria-label': label,
          'aria-required': field.required || undefined,
          'aria-invalid': missing || undefined,
          title: label,
          style: textStyle,
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
        return (
          <select
            value={selected}
            onChange={(e) => onChange(field.name, e.target.value)}
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
        const signature = typeof value === 'string' && value.startsWith('data:image') ? value : null;
        const image = signature && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signature} alt="Signature" className="max-w-full max-h-full object-contain" draggable={false} />
        );
        if (!editable) {
          return (
            <div style={{ width: w, height: h }} className="flex items-center justify-start overflow-hidden" aria-label={label}>
              {image}
            </div>
          );
        }
        return (
          <button
            type="button"
            onClick={() => setSigningField(field)}
            aria-label={signature ? `${label} (signed — click to re-sign)` : `${label} (click to sign)`}
            title={signature ? 'Click to re-sign' : 'Click to sign'}
            style={{ width: w, height: h, fontSize: Math.max(8, Math.min(fontSize, 13)), fontFamily: FONT_STACK }}
            className={`flex items-center justify-start gap-1 overflow-hidden rounded-[2px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 ${
              signature ? 'bg-transparent border border-transparent hover:border-blue-500/50' : boxClasses(true, missing, false)
            }`}
          >
            {image || (
              <span className="flex items-center gap-1 px-1 font-semibold text-blue-700 whitespace-nowrap">
                <PenTool style={{ width: '1em', height: '1em' }} /> Sign here
              </span>
            )}
          </button>
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      {items.map((item) => (
        <div
          key={item.key}
          data-pdf-field={item.field.name}
          className="absolute flex items-center justify-center"
          style={{ left: item.left, top: item.top, width: item.width, height: item.height }}
        >
          {/* On 90°/270° pages the inner control is laid out unrotated, then rotated to match the page. */}
          <div
            className="shrink-0"
            style={item.rotation ? { transform: `rotate(${item.rotation}deg)` } : undefined}
          >
            {renderControl(item)}
          </div>
        </div>
      ))}

      <SignaturePadModal
        open={!!signingField}
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
