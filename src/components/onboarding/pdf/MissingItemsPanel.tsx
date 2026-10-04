'use client';

// ============================================================================
// MissingItemsPanel — "what's left?" list with Go-to links
//
// Signature Suite D2 ("never 'sign where?'"). Replaces the one-line
// "Please complete your signature." error: every missing item is listed, and
// "Go to" scrolls to it (inside the PDF viewer AND the surrounding popup) and
// pulses it red so the signer can't miss it.
// ============================================================================

import React from 'react';
import { AlertCircle, ArrowDownRight } from 'lucide-react';
import type { PdfFormField } from '@/types/onboarding-templates';
import { isSignatureImage } from './pdfSubmission';
import { isFieldValueEmpty, type PdfFieldValues } from './overlayLayout';

export interface MissingItem {
  key: string;
  label: string;
  /** PDF field name → targets `[data-pdf-field="…"]`. */
  fieldName?: string;
  /** Non-PDF target → `[data-goto="…"]` (typed name, consent, separate signature pad). */
  gotoId?: string;
}

const FLASH_CLASS = 'pdf-field-flash';
const FLASH_MS = 1900;

const prettyName = (name: string) =>
  name
    .replace(/\[\d+\]/g, '')
    .split('.')
    .pop()!
    .replace(/[_-]+/g, ' ')
    .trim();

export const missingFieldLabel = (f: PdfFormField) => f.tooltip || prettyName(f.name) || 'Form field';

/** Scroll to a missing item inside `root` and pulse it. Returns false if it isn't on screen anywhere. */
export function goToMissingItem(root: HTMLElement | null, item: MissingItem): boolean {
  if (!root || typeof document === 'undefined') return false;
  const selector = item.fieldName
    ? `[data-pdf-field="${CSS.escape(item.fieldName)}"]`
    : item.gotoId
      ? `[data-goto="${CSS.escape(item.gotoId)}"]`
      : null;
  if (!selector) return false;
  // A fullscreen viewer is portaled to <body>, so fall back to a document-wide lookup.
  const el = root.querySelector<HTMLElement>(selector) ?? document.querySelector<HTMLElement>(selector);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  el.classList.remove(FLASH_CLASS);
  void el.offsetWidth; // restart the animation if it's already running
  el.classList.add(FLASH_CLASS);
  window.setTimeout(() => el.classList.remove(FLASH_CLASS), FLASH_MS);
  return true;
}

/**
 * Build the list from the renderer's state. `signatureFields` are the signer's
 * on-page signature spots; `separateSignature` is used when there are none.
 */
export function buildMissingItems(opts: {
  missingFields: PdfFormField[];
  signatureFields: PdfFormField[];
  values: PdfFieldValues;
  requireSignature: boolean;
  separateSignatureValue?: string | boolean;
  useSeparateSignature: boolean;
  typedNameMissing: boolean;
  consentMissing: boolean;
}): MissingItem[] {
  const items: MissingItem[] = [];
  for (const f of opts.missingFields) {
    if (f.type === 'signature') continue;
    if (!isFieldValueEmpty(f, opts.values[f.name])) continue;
    items.push({ key: `f:${f.name}`, label: missingFieldLabel(f), fieldName: f.name });
  }
  if (opts.requireSignature) {
    if (opts.useSeparateSignature) {
      if (!isSignatureImage(opts.separateSignatureValue)) {
        items.push({ key: 'sig:separate', label: 'Your signature', gotoId: 'separate-signature' });
      }
    } else {
      const unsigned = opts.signatureFields.filter((f) => !isSignatureImage(opts.values[f.name]));
      unsigned.forEach((f, i) =>
        items.push({
          key: `sig:${f.name}`,
          label: unsigned.length > 1 ? `Signature (${i + 1} of ${unsigned.length})` : 'Your signature',
          fieldName: f.name,
        }),
      );
    }
  }
  if (opts.typedNameMissing) items.push({ key: 'typed-name', label: 'Your typed legal name', gotoId: 'typed-name' });
  if (opts.consentMissing) items.push({ key: 'consent', label: 'Electronic signature consent', gotoId: 'esign-consent' });
  return items;
}

export default function MissingItemsPanel({
  items,
  rootRef,
  isDarkMode = false,
}: {
  items: MissingItem[];
  rootRef: React.RefObject<HTMLElement | null>;
  isDarkMode?: boolean;
}) {
  if (!items.length) return null;
  return (
    <div
      role="alert"
      className={`p-3 rounded-xl border text-xs ${
        isDarkMode ? 'bg-rose-950/30 border-rose-800/50 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-800'
      }`}
    >
      <div className="flex items-center gap-2 font-bold mb-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {items.length === 1 ? '1 thing left before you can submit:' : `${items.length} things left before you can submit:`}
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-medium">• {item.label}</span>
            <button
              type="button"
              onClick={() => goToMissingItem(rootRef.current, item)}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold bg-rose-600 text-white active:scale-95"
            >
              Go to <ArrowDownRight className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
