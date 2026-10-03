'use client';

// ============================================================================
// AutoFillConfigurator — Phase 6.2 (Onboarding Document System, APPROVED PLAN)
//
// Lets the blueprint admin tag a TEXT field of a PDF form as "filled
// automatically" — today's date, the signer's full name, or the signer's
// email. The SERVER fills these at submit time (the signer sees them locked),
// so nobody can back-date a document or sign as someone else.
// ============================================================================

import React from 'react';
import { Wand2 } from 'lucide-react';
import type { PdfFormContent } from '@/types/onboarding-templates';
import { AUTO_FILL_KINDS, AUTO_FILL_LABELS, isAutoFillKind, type AutoFillKind } from '@/lib/pdf-autofill';

interface Props {
  content: PdfFormContent;
  onChange: (c: PdfFormContent) => void;
  isDarkMode: boolean;
}

export default function AutoFillConfigurator({ content, onChange, isDarkMode }: Props) {
  const textFields = (content.detectedFields || []).filter((f) => f.type === 'text' && !f.readOnly);
  if (textFields.length === 0) return null;

  const autoFill = content.autoFill || {};
  const count = Object.keys(autoFill).length;

  const setKind = (fieldName: string, value: string) => {
    const next: Record<string, AutoFillKind> = { ...autoFill };
    if (isAutoFillKind(value)) next[fieldName] = value;
    else delete next[fieldName];
    const { autoFill: _drop, ...rest } = content;
    onChange(Object.keys(next).length ? { ...rest, autoFill: next } : (rest as PdfFormContent));
  };

  const box = isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200';
  const select = `text-[11px] rounded-md border px-1.5 py-1 outline-none focus:ring-2 focus:ring-indigo-500 ${
    isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
  }`;

  return (
    <details className={`p-3 rounded-lg border text-xs ${box}`} open={count > 0}>
      <summary className="cursor-pointer font-bold flex items-center gap-1.5 select-none">
        <Wand2 className="w-3.5 h-3.5 text-indigo-500" />
        Auto-filled fields {count > 0 && <span className="font-normal opacity-70">({count} set)</span>}
      </summary>
      <p className={`mt-2 mb-2 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        Pick a text field (e.g. the &ldquo;Date&rdquo; next to a signature) and the system fills it in for the
        signer when they submit. They see it locked, and it can&apos;t be changed. In a multi-signer document, the
        field must also be assigned to the signer who should get it.
      </p>
      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {textFields.map((f) => (
          <div key={f.name} className="flex items-center justify-between gap-2">
            <span className={`font-mono text-[11px] truncate ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`} title={f.name}>
              {f.tooltip ? `${f.tooltip} · ` : ''}{f.name}
            </span>
            <select
              value={autoFill[f.name] || ''}
              onChange={(e) => setKind(f.name, e.target.value)}
              className={select}
              aria-label={`Auto-fill for ${f.name}`}
            >
              <option value="">Filled by the signer</option>
              {AUTO_FILL_KINDS.map((k) => (
                <option key={k} value={k}>{AUTO_FILL_LABELS[k]}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </details>
  );
}
