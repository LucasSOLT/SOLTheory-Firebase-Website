'use client';

// ============================================================================
// PdfFieldInputSheet — large bottom input sheet for filling PDF fields on phones
//
// Signature Suite D1 (approved decision: "tap a field → large bottom input
// sheet; the text shows on the document").
//
// PDF form boxes are often only 8–12 CSS px tall on a phone, which makes typing
// into them directly unreadable (and iOS auto-zooms on any input under 16px).
// On touch devices the overlay shows each text/dropdown box as a tappable
// preview; tapping opens this sheet with a big 16px input. Every keystroke
// updates the value, so the text appears on the document behind the sheet.
//
// The sheet follows the on-screen keyboard (visualViewport) so it is never
// hidden behind it, and is portaled to <body> above every onboarding modal.
// ============================================================================

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { PdfFormField } from '@/types/onboarding-templates';
import { Z_FIELD_SHEET } from './viewerContext';

export interface PdfFieldInputSheetProps {
  field: PdfFormField;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** e.g. "3 of 12" */
  positionLabel?: string;
  isDarkMode?: boolean;
}

/** Space (px) the on-screen keyboard currently covers at the bottom of the layout viewport. */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

export default function PdfFieldInputSheet({
  field,
  label,
  value,
  onChange,
  onClose,
  onPrev,
  onNext,
  positionLabel,
  isDarkMode = false,
}: PdfFieldInputSheetProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const keyboardInset = useKeyboardInset();
  const isDropdown = field.type === 'dropdown';

  // Focus the input whenever the sheet moves to a new field (keeps the keyboard up on "Next").
  // Layout effect (not a timeout): iOS only raises the keyboard if focus happens within the tap.
  useLayoutEffect(() => {
    if (isDropdown) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [field.name, isDropdown]);

  const panel = isDarkMode ? 'bg-[#212121] border-[#383838] text-[#ECECEC]' : 'bg-white border-slate-200 text-slate-900';
  const inputCls = `w-full rounded-xl border-2 px-3 py-3 outline-none focus:border-blue-600 ${
    isDarkMode ? 'bg-[#171717] border-[#383838] text-white' : 'bg-white border-slate-300 text-slate-900'
  }`;
  const navBtn = `flex items-center justify-center gap-1 px-3 h-11 rounded-xl text-sm font-semibold disabled:opacity-30 ${
    isDarkMode ? 'bg-[#2F2F2F] text-[#ECECEC]' : 'bg-slate-100 text-slate-700'
  }`;

  const sheet = (
    <div data-pdf-modal className="fixed inset-0" style={{ zIndex: Z_FIELD_SHEET }} role="dialog" aria-modal="true" aria-label={label}>
      {/* Tap outside to close. Transparent enough to watch the text appear on the document. */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        className={`absolute left-0 right-0 border-t rounded-t-2xl shadow-2xl px-4 pt-3 ${panel}`}
        style={{ bottom: keyboardInset, paddingBottom: keyboardInset ? 12 : 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">
              {label}
              {field.required && <span className="text-rose-500"> *</span>}
            </div>
            {positionLabel && <div className="text-[11px] opacity-60">Field {positionLabel}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2 rounded-lg opacity-70">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isDropdown ? (
          <div className="max-h-[40vh] overflow-y-auto space-y-1.5 pb-1">
            {['', ...(field.options || [])].map((opt) => {
              const selected = value === opt;
              return (
                <button
                  key={opt || '__none'}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    if (onNext) onNext();
                    else onClose();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-3 rounded-xl border text-left text-base ${
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : isDarkMode
                        ? 'border-[#383838]'
                        : 'border-slate-200'
                  }`}
                >
                  <span className={opt ? '' : 'italic opacity-60'}>{opt || 'No selection'}</span>
                  {selected && <Check className="w-5 h-5 text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        ) : field.multiline ? (
          <textarea
            ref={(el) => {
              inputRef.current = el;
            }}
            value={value}
            maxLength={field.maxLength}
            rows={4}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputCls} resize-none`}
            style={{ fontSize: 16 }}
          />
        ) : (
          <input
            ref={(el) => {
              inputRef.current = el;
            }}
            type="text"
            value={value}
            maxLength={field.maxLength}
            enterKeyHint={onNext ? 'next' : 'done'}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (onNext) onNext();
              else onClose();
            }}
            className={inputCls}
            style={{ fontSize: 16 }}
          />
        )}
        {field.maxLength ? (
          <div className="text-[11px] opacity-60 text-right mt-1">
            {value.length}/{field.maxLength}
          </div>
        ) : null}

        <div className="flex items-center gap-2 mt-3">
          <button type="button" onClick={onPrev} disabled={!onPrev} className={navBtn} aria-label="Previous field">
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <button type="button" onClick={onNext} disabled={!onNext} className={navBtn} aria-label="Next field">
            Next <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex items-center justify-center gap-1 px-5 h-11 rounded-xl text-sm font-bold bg-blue-600 text-white active:scale-95"
          >
            <Check className="w-4 h-4" /> Done
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? null : createPortal(sheet, document.body);
}
