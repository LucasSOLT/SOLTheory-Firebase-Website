'use client';

// ============================================================================
// SignaturePadModal — full-size drawing pad for PDF signature fields
//
// Phase 2, Step 2.3 (Onboarding Document System — APPROVED PLAN, Option A)
//
// Signature boxes on real forms are tiny (often ~180×20pt), so drawing inside
// them is impractical on phones. Tapping a signature field opens this pad; the
// result (a PNG cropped to the ink) is shown inside the field's box.
//
// Signature Suite, Phase A: the pad now offers three ways to sign —
//   • Draw   — finger / mouse / stylus (original behaviour)
//   • Type   — the signer's name rendered in a choice of script fonts
//   • Upload — a photo or scan of a signature; the paper is made transparent
// …plus a reusable saved signature ("Use my saved signature" = one tap).
// Every mode produces the same transparent, ink-cropped PNG data URL, so all
// callers (onApply) and the signing APIs are unchanged.
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dancing_Script, Great_Vibes, Caveat, Allura } from 'next/font/google';
import { getAuth } from 'firebase/auth';
import { Eraser, Image as ImageIcon, Keyboard, Loader2, PenTool, Upload, X } from 'lucide-react';
import {
  cropCanvasToInk,
  processUploadedSignature,
  renderTypedSignature,
  type SignatureMethod,
} from '@/lib/signature-image';
import { initialsFromName, type StampKind } from '@/lib/initials-fields';
import { useSavedSignature } from './useSavedSignature';
import { Z_SIGNATURE_PAD } from './viewerContext';

// Script fonts for typed signatures. preload:false — only fetched when the Type tab shows them.
const dancing = Dancing_Script({ subsets: ['latin'], weight: '600', display: 'swap', preload: false });
const greatVibes = Great_Vibes({ subsets: ['latin'], weight: '400', display: 'swap', preload: false });
const caveat = Caveat({ subsets: ['latin'], weight: '600', display: 'swap', preload: false });
const allura = Allura({ subsets: ['latin'], weight: '400', display: 'swap', preload: false });
const SCRIPT_FONTS = [
  { id: 'dancing', label: 'Classic', family: dancing.style.fontFamily },
  { id: 'vibes', label: 'Elegant', family: greatVibes.style.fontFamily },
  { id: 'allura', label: 'Formal', family: allura.style.fontFamily },
  { id: 'caveat', label: 'Casual', family: caveat.style.fontFamily },
];

interface SignaturePadModalProps {
  open: boolean;
  /** Shown in the header, e.g. the field's tooltip. */
  title?: string;
  isDarkMode?: boolean;
  /** Pre-fills the "Type" tab (e.g. the typed legal name). Falls back to the account's display name. */
  defaultName?: string;
  onCancel: () => void;
  /** Receives a transparent PNG data URL cropped to the signature strokes (+ how it was made). */
  onApply: (dataUrl: string, method: SignatureMethod) => void;
  /** Phase F — 'initials' changes the wording, the typed default (JQP) and the saved slot. */
  kind?: StampKind;
  /**
   * Phase F — manage mode (home-screen card): no saved-item block / "save for later" box;
   * the button says "Save" and the caller persists the result itself.
   */
  saveOnly?: boolean;
}

// 200px normally; shrinks on short (landscape phone) screens so header + pad + buttons all fit.
const PAD_HEIGHT = 'min(200px, 42vh)';

const TABS: { id: SignatureMethod; label: string; Icon: typeof PenTool }[] = [
  { id: 'draw', label: 'Draw', Icon: PenTool },
  { id: 'type', label: 'Type', Icon: Keyboard },
  { id: 'upload', label: 'Upload', Icon: Upload },
];

export default function SignaturePadModal({
  open,
  title,
  isDarkMode = false,
  defaultName,
  onCancel,
  onApply,
  kind = 'signature',
  saveOnly = false,
}: SignaturePadModalProps) {
  const isInitials = kind === 'initials';
  const noun = isInitials ? 'initials' : 'signature';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [tab, setTab] = useState<SignatureMethod>('draw');
  const [typedName, setTypedName] = useState('');
  const [fontIdx, setFontIdx] = useState(0);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  /** null = use the default (save when there's no saved signature yet). */
  const [saveChoice, setSaveChoice] = useState<boolean | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const { saved, loading: savedLoading, save, remove } = useSavedSignature(open && !saveOnly, kind);
  const saveForLater = !saveOnly && (saveChoice ?? !saved);

  useEffect(() => setMounted(true), []);

  /**
   * Size the canvas backing store to its CSS box × devicePixelRatio. When
   * `preserve` is set (rotation/resize mid-signature) the existing ink is
   * redrawn at the same CSS position instead of being lost.
   */
  const setupCanvas = useCallback((preserve: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(canvas.clientWidth * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);
    if (!width || !height || (preserve && width === canvas.width && height === canvas.height)) return;

    let snapshot: HTMLCanvasElement | null = null;
    if (preserve && canvas.width && canvas.height) {
      snapshot = document.createElement('canvas');
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext('2d')?.drawImage(canvas, 0, 0);
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (snapshot) ctx.drawImage(snapshot, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111111'; // signatures are always dark ink, regardless of theme
    }
  }, []);

  // Fresh pad each time it opens; keep the backing store in sync on resize/rotation.
  useEffect(() => {
    if (!open || !mounted) return;
    setupCanvas(false);
    setHasInk(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => setupCanvas(true));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [open, mounted, setupCanvas]);

  // Reset the other modes each time the pad opens.
  useEffect(() => {
    if (!open) return;
    setTab('draw');
    const fullName = (defaultName || getAuth().currentUser?.displayName || '').trim();
    setTypedName(isInitials ? initialsFromName(fullName) : fullName);
    setUploaded(null);
    setUploadError(null);
    setApplyError(null);
    setBusy(false);
    setSaveChoice(null);
  }, [open, defaultName, isInitials]);

  // Lock background scrolling while signing (prevents iOS rubber-banding behind the pad).
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // Escape closes the pad.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = pointFrom(e);
    lastPointRef.current = p;
    // A single tap still leaves a dot.
    const ctx = e.currentTarget.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#111111';
      ctx.fill();
    }
    setHasInk(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = e.currentTarget.getContext('2d');
    const last = lastPointRef.current;
    if (!ctx || !last) return;
    const p = pointFrom(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
  };

  const endStroke = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const clear = useCallback(() => {
    if (tab === 'draw') {
      const canvas = canvasRef.current;
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      setHasInk(false);
    } else if (tab === 'type') {
      setTypedName('');
    } else {
      setUploaded(null);
      setUploadError(null);
    }
  }, [tab]);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setUploadError(null);
    setBusy(true);
    try {
      setUploaded(await processUploadedSignature(file));
    } catch (err: any) {
      setUploaded(null);
      setUploadError(err?.message || 'That image could not be used.');
    } finally {
      setBusy(false);
    }
  };

  const canApply = !busy && (tab === 'draw' ? hasInk : tab === 'type' ? typedName.trim().length > 0 : !!uploaded);
  const canClear = tab === 'draw' ? hasInk : tab === 'type' ? typedName.length > 0 : !!uploaded || !!uploadError;

  const apply = async () => {
    if (!canApply) return;
    setApplyError(null);
    setBusy(true);
    try {
      let dataUrl: string | null = null;
      if (tab === 'draw') {
        const canvas = canvasRef.current;
        if (canvas) dataUrl = cropCanvasToInk(canvas, Math.round(4 * (window.devicePixelRatio || 1)));
      } else if (tab === 'type') {
        dataUrl = await renderTypedSignature(typedName, SCRIPT_FONTS[fontIdx].family);
      } else {
        dataUrl = uploaded;
      }
      if (!dataUrl) {
        setApplyError('Nothing to apply yet.');
        return;
      }
      // Saving is best-effort and never blocks signing.
      if (saveForLater) void save(dataUrl, tab);
      onApply(dataUrl, tab);
    } catch (err: any) {
      setApplyError(err?.message || `Could not create the ${noun}.`);
    } finally {
      setBusy(false);
    }
  };

  if (!open || !mounted) return null;

  const card = isDarkMode ? 'bg-[#212121] border-[#383838] text-[#ECECEC]' : 'bg-[#FAF9F5] border-[#E5E4DE] text-[#1F1E1D]';
  const muted = isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]';
  const divider = isDarkMode ? 'border-[#383838]' : 'border-[#E5E4DE]';
  const ghostBtn = isDarkMode
    ? 'text-[#B4B4B4] hover:bg-[#2F2F2F] hover:text-[#ECECEC]'
    : 'text-[#6B6860] hover:bg-[#EAE7DF] hover:text-[#1F1E1D]';
  const primaryBtn = isDarkMode ? 'bg-[#ECECEC] text-[#171717] hover:bg-white' : 'bg-[#1F1E1D] text-white hover:bg-[#383734]';
  const inputCls = isDarkMode
    ? 'bg-[#2F2F2F] border-[#383838] text-[#ECECEC] placeholder-[#737373]'
    : 'bg-white border-[#E5E4DE] text-[#1F1E1D] placeholder-[#9C978D]';

  // Portal to <body> so the fixed overlay escapes the PDF scroll container.
  // Signature Suite D2: layered above the onboarding popups (z-[9999]) and the fullscreen viewer —
  // at the old z-[300] the pad opened *behind* the item popup, so "Sign" seemed to do nothing.
  return createPortal(
    <div
      data-pdf-modal
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      style={{ zIndex: Z_SIGNATURE_PAD }}
      onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Add your ${noun}`}
        className={`w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[92vh] ${card}`}
      >
        <div className={`flex items-center justify-between px-4 py-3 border-b ${divider}`}>
          <div className="flex items-center gap-2 min-w-0">
            <PenTool className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold truncate">{title || `Add your ${noun}`}</span>
          </div>
          <button type="button" onClick={onCancel} className={`p-1.5 rounded-lg ${ghostBtn}`} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {/* Saved signature — one tap */}
          {!saveOnly && savedLoading && !saved && (
            <div className={`mb-3 flex items-center gap-2 text-xs ${muted}`}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking for saved {noun}…
            </div>
          )}
          {!saveOnly && saved && (
            <div className={`mb-3 flex items-center gap-3 rounded-xl border p-2 ${divider}`}>
              <div className="h-12 w-28 shrink-0 rounded-lg bg-white flex items-center justify-center overflow-hidden">
                <img src={saved.imageData} alt={`Your saved ${noun}`} className="max-h-10 max-w-[6.5rem] object-contain" draggable={false} />
              </div>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onApply(saved.imageData, saved.method)}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-semibold ${primaryBtn}`}
                >
                  Use my saved {noun}
                </button>
                <button
                  type="button"
                  onClick={() => void remove()}
                  className={`mt-1 text-[11px] underline-offset-2 hover:underline ${muted}`}
                >
                  Forget saved {noun}
                </button>
              </div>
            </div>
          )}

          {/* Mode tabs */}
          <div className={`mb-3 grid grid-cols-3 gap-1 rounded-xl p-1 ${isDarkMode ? 'bg-[#2F2F2F]' : 'bg-[#EAE7DF]'}`} role="tablist">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => {
                  setTab(id);
                  setApplyError(null);
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition-colors ${
                  tab === id
                    ? isDarkMode ? 'bg-[#212121] text-[#ECECEC] shadow-sm' : 'bg-white text-[#1F1E1D] shadow-sm'
                    : muted
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Draw — kept mounted (hidden) so ink survives switching tabs */}
          <div className={tab === 'draw' ? '' : 'hidden'}>
            <div className="relative rounded-xl border border-dashed border-[#9C978D]/60 bg-white overflow-hidden">
              <canvas
                ref={canvasRef}
                className="block w-full cursor-crosshair"
                style={{ height: PAD_HEIGHT, touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endStroke}
                onPointerCancel={endStroke}
                onPointerLeave={endStroke}
              />
              {/* Signing baseline */}
              <div className="pointer-events-none absolute left-6 right-6 bottom-10 border-b border-[#9C978D]/50" />
              {!hasInk && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[#9C978D]">
                  {isInitials ? 'Write your initials here' : 'Sign here with your finger or mouse'}
                </span>
              )}
            </div>
          </div>

          {/* Type */}
          {tab === 'type' && (
            <div className="space-y-3">
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value.slice(0, 80))}
                placeholder={isInitials ? 'Type your initials' : 'Type your full name'}
                autoFocus
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${inputCls}`}
              />
              <div className="grid grid-cols-2 gap-2">
                {SCRIPT_FONTS.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFontIdx(i)}
                    aria-pressed={fontIdx === i}
                    className={`relative h-16 rounded-xl border bg-white px-2 text-[#111111] overflow-hidden transition-shadow ${
                      fontIdx === i ? 'border-indigo-500 ring-2 ring-indigo-500/40' : 'border-[#E5E4DE] hover:border-[#9C978D]'
                    }`}
                  >
                    <span className="block truncate text-2xl leading-[4rem]" style={{ fontFamily: f.family }}>
                      {typedName.trim() || (isInitials ? 'AB' : 'Your Name')}
                    </span>
                    <span className="absolute bottom-1 right-2 text-[9px] uppercase tracking-wider text-[#9C978D]">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upload */}
          {tab === 'upload' && (
            <div className="space-y-2">
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void handleFile(e.dataTransfer.files?.[0]);
                }}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-white cursor-pointer overflow-hidden ${
                  dragOver ? 'border-indigo-500' : 'border-[#9C978D]/60'
                }`}
                style={{ height: PAD_HEIGHT }}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    void handleFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                {busy ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#9C978D]" />
                ) : uploaded ? (
                  <img src={uploaded} alt={`Uploaded ${noun} preview`} className="max-h-[80%] max-w-[90%] object-contain" draggable={false} />
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-[#9C978D]" />
                    <span className="text-sm text-[#6B6860]">Tap to choose a photo of your {noun}</span>
                    <span className="text-[11px] text-[#9C978D]">Dark pen on white paper works best · PNG, JPG, WEBP</span>
                  </>
                )}
              </label>
              {uploaded && !busy && <p className={`text-[11px] ${muted}`}>Background removed automatically. Tap the box to choose a different image.</p>}
              {uploadError && <p className="text-xs text-rose-500">{uploadError}</p>}
            </div>
          )}

          {!saveOnly && (
            <label className={`mt-3 flex items-center gap-2 text-xs cursor-pointer select-none ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`}>
              <input
                type="checkbox"
                checked={saveForLater}
                onChange={(e) => setSaveChoice(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              {saved ? `Replace my saved ${noun} with this one` : isInitials ? 'Save these initials for future documents' : 'Save this signature for future documents'}
            </label>
          )}

          {applyError && <p className="mt-2 text-xs text-rose-500">{applyError}</p>}
          <p className={`mt-2 text-[11px] ${muted}`}>
            {saveOnly
              ? `Stored privately — only you can use it. It is applied only when you tap a field.`
              : `By applying, you agree this is your electronic ${noun}.`}
          </p>
        </div>

        <div className={`flex items-center justify-between gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3 border-t ${divider}`}>
          <button
            type="button"
            onClick={clear}
            disabled={!canClear}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm disabled:opacity-40 ${ghostBtn}`}
          >
            <Eraser className="w-4 h-4" /> Clear
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel} className={`px-3 py-2 rounded-lg text-sm ${ghostBtn}`}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void apply()}
              disabled={!canApply}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 ${primaryBtn}`}
            >
              {busy && tab !== 'upload' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saveOnly ? `Save ${noun}` : `Apply ${noun}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
