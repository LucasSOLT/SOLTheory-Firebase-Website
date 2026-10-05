'use client';

// ============================================================================
// SignatureSpotsEditor — Signature Suite, Phase B
//
// Lets an admin list EVERY place a signer's signature goes (e.g. page 1 and
// page 4 of a handbook acknowledgment). The signer signs once and the same
// signature is stamped in all of them. Coordinates are PDF points from the
// bottom-left corner; Phase C replaces typing them with click-to-place.
//
// Phase F: each spot is either a SIGNATURE or the signer's INITIALS (a smaller
// box). The signer's saved signature / initials fill them with one tap.
// ============================================================================

import React from 'react';
import { Copy, Layers, Plus, Trash2 } from 'lucide-react';
import type { SignatureSpot } from '@/types/onboarding-templates';
import { DEFAULT_SIGNATURE_SPOT, MAX_SIGNATURE_SPOTS } from '@/lib/signature-spots';

interface SignatureSpotsEditorProps {
  spots: SignatureSpot[];
  onChange: (spots: SignatureSpot[]) => void;
  isDarkMode: boolean;
  /** Pages in the PDF, if known — enables "Repeat on every page" and caps the page input. */
  pageCount?: number;
  /** Shown when the list is empty. */
  emptyHint?: string;
}

type NumericKey = 'pageIndex' | 'x' | 'y' | 'width' | 'height';

/** Sensible starting box for initials (much smaller than a signature). */
const DEFAULT_INITIALS_SPOT: SignatureSpot = { pageIndex: 0, x: 50, y: 50, width: 60, height: 30, kind: 'initials' };

const FIELDS: { key: NumericKey; label: string }[] = [
  { key: 'pageIndex', label: 'Page' },
  { key: 'x', label: 'X (pt)' },
  { key: 'y', label: 'Y (pt)' },
  { key: 'width', label: 'Width' },
  { key: 'height', label: 'Height' },
];

export default function SignatureSpotsEditor({ spots, onChange, isDarkMode, pageCount, emptyHint }: SignatureSpotsEditorProps) {
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const input = `w-full p-1.5 text-xs rounded border outline-none focus:ring-2 focus:ring-indigo-500 ${
    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
  }`;
  const linkBtn = 'flex items-center gap-1 text-[11px] font-semibold text-indigo-500 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed';
  const full = spots.length >= MAX_SIGNATURE_SPOTS;
  const maxPage = pageCount && pageCount > 0 ? pageCount : undefined;

  const setKind = (i: number, kind: 'signature' | 'initials') =>
    onChange(
      spots.map((s, idx) => {
        if (idx !== i) return s;
        const { kind: _old, ...rest } = s;
        return kind === 'initials' ? { ...rest, kind } : rest;
      }),
    );

  const addInitials = () => {
    if (full) return;
    const last = [...spots].reverse().find((s) => s.kind === 'initials');
    onChange([...spots, last ? { ...last, pageIndex: maxPage ? Math.min(maxPage - 1, last.pageIndex + 1) : last.pageIndex + 1 } : { ...DEFAULT_INITIALS_SPOT }]);
  };

  const update = (i: number, key: NumericKey, raw: string) => {
    const n = parseInt(raw, 10);
    const next = spots.map((s, idx) => {
      if (idx !== i) return s;
      if (key === 'pageIndex') {
        // Shown 1-based to admins, stored 0-based.
        const page = Number.isFinite(n) ? Math.max(1, maxPage ? Math.min(maxPage, n) : n) : 1;
        return { ...s, pageIndex: page - 1 };
      }
      const fallback = key === 'width' ? DEFAULT_SIGNATURE_SPOT.width : key === 'height' ? DEFAULT_SIGNATURE_SPOT.height : 0;
      const v = Number.isFinite(n) ? n : fallback;
      return { ...s, [key]: key === 'width' || key === 'height' ? Math.max(1, v) : v };
    });
    onChange(next);
  };

  const add = () => {
    if (full) return;
    const last = [...spots].reverse().find((s) => s.kind !== 'initials');
    // New spot defaults to the next page at the same place (the common "sign every page" case).
    const nextPage = last ? (maxPage ? Math.min(maxPage - 1, last.pageIndex + 1) : last.pageIndex + 1) : 0;
    onChange([...spots, last ? { ...last, pageIndex: nextPage } : { ...DEFAULT_SIGNATURE_SPOT }]);
  };

  const duplicate = (i: number) => {
    if (full) return;
    const next = [...spots];
    next.splice(i + 1, 0, { ...spots[i] });
    onChange(next);
  };

  const remove = (i: number) => onChange(spots.filter((_, idx) => idx !== i));

  const repeatOnEveryPage = () => {
    if (!maxPage || !spots[0]) return;
    const base = spots[0];
    const pages = Math.min(maxPage, MAX_SIGNATURE_SPOTS);
    // Phase F: only replace spots of the same kind as spot 1 — leave the other kind alone.
    const others = spots.filter((s) => (s.kind === 'initials') !== (base.kind === 'initials'));
    const repeated = Array.from({ length: pages }, (_, p) => ({ ...base, pageIndex: p }));
    onChange([...repeated, ...others].slice(0, MAX_SIGNATURE_SPOTS));
  };

  return (
    <div className="space-y-2">
      {spots.length === 0 && emptyHint && <p className={`text-[11px] ${muted}`}>{emptyHint}</p>}

      {spots.map((s, i) => {
        const isIni = s.kind === 'initials';
        const ordinal = spots.slice(0, i + 1).filter((x) => (x.kind === 'initials') === isIni).length;
        return (
        <div key={i} className={`p-2 rounded-lg border space-y-1.5 ${isDarkMode ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-1 gap-2">
            <span className="text-xs font-bold">{isIni ? 'Initials' : 'Signature'} spot {ordinal}</span>
            <div role="group" aria-label="Spot type" className={`flex rounded-md overflow-hidden border text-[11px] font-semibold ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}>
              {(['signature', 'initials'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={(k === 'initials') === isIni}
                  onClick={() => setKind(i, k)}
                  className={`px-2.5 min-h-[30px] ${(k === 'initials') === isIni ? 'bg-indigo-600 text-white' : muted}`}
                >
                  {k === 'initials' ? 'Initials' : 'Signature'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Duplicate"
                onClick={() => duplicate(i)}
                disabled={full}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-500/10 disabled:opacity-30"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Remove"
                onClick={() => remove(i)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-rose-500 hover:bg-rose-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {FIELDS.map(({ key, label }) => (
              <div key={key} className={key === 'pageIndex' ? 'col-span-2 sm:col-span-1' : ''}>
                <label className="block text-[10px] font-medium opacity-80 mb-0.5">{label}</label>
                <input
                  type="number"
                  min={key === 'pageIndex' ? 1 : key === 'width' || key === 'height' ? 1 : undefined}
                  max={key === 'pageIndex' ? maxPage : undefined}
                  value={key === 'pageIndex' ? s.pageIndex + 1 : s[key]}
                  onChange={(e) => update(i, key, e.target.value)}
                  className={`${input} min-h-[34px]`}
                />
              </div>
            ))}
          </div>
        </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button type="button" onClick={add} disabled={full} className={linkBtn}>
          <Plus className="w-3.5 h-3.5" /> Add signature spot
        </button>
        <button type="button" onClick={addInitials} disabled={full} className={linkBtn}>
          <Plus className="w-3.5 h-3.5" /> Add initials spot
        </button>
        {maxPage && maxPage > 1 && spots.length > 0 && (
          <button type="button" onClick={repeatOnEveryPage} className={linkBtn} title="Copy spot 1 onto every page">
            <Layers className="w-3.5 h-3.5" /> Repeat spot 1 on every page
          </button>
        )}
        {full && <span className={`text-[10px] ${muted}`}>Max {MAX_SIGNATURE_SPOTS} spots</span>}
      </div>
      {spots.length > 1 && (
        <p className={`text-[10px] ${muted}`}>
          The signer signs once — the same signature is placed in every signature spot, and the same initials in every initials spot.
        </p>
      )}
    </div>
  );
}
