'use client';

// ============================================================================
// SignaturePadModal — full-size drawing pad for PDF signature fields
//
// Phase 2, Step 2.3 (Onboarding Document System — APPROVED PLAN, Option A)
//
// Signature boxes on real forms are tiny (often ~180×20pt), so drawing inside
// them is impractical on phones. Tapping a signature field opens this pad; the
// result (a PNG cropped to the ink) is shown inside the field's box.
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eraser, PenTool, X } from 'lucide-react';

interface SignaturePadModalProps {
  open: boolean;
  /** Shown in the header, e.g. the field's tooltip. */
  title?: string;
  isDarkMode?: boolean;
  onCancel: () => void;
  /** Receives a transparent PNG data URL cropped to the signature strokes. */
  onApply: (dataUrl: string) => void;
}

const PAD_HEIGHT = 200;

/** Crops a canvas to the bounding box of its non-transparent pixels (+ padding). */
function cropToInk(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // nothing drawn
  const pad = Math.round(4 * (window.devicePixelRatio || 1));
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')?.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

export default function SignaturePadModal({ open, title, isDarkMode = false, onCancel, onApply }: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Size the canvas backing store for the device pixel ratio each time the pad opens.
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(PAD_HEIGHT * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111111'; // signatures are always dark ink, regardless of theme
    }
    setHasInk(false);
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
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }, []);

  const apply = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    const dataUrl = cropToInk(canvas);
    if (dataUrl) onApply(dataUrl);
  };

  if (!open || !mounted) return null;

  const card = isDarkMode ? 'bg-[#212121] border-[#383838] text-[#ECECEC]' : 'bg-[#FAF9F5] border-[#E5E4DE] text-[#1F1E1D]';
  const muted = isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]';
  const ghostBtn = isDarkMode
    ? 'text-[#B4B4B4] hover:bg-[#2F2F2F] hover:text-[#ECECEC]'
    : 'text-[#6B6860] hover:bg-[#EAE7DF] hover:text-[#1F1E1D]';

  // Portal to <body> so the fixed overlay escapes the PDF scroll container.
  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Draw your signature"
        className={`w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border shadow-2xl overflow-hidden ${card}`}
      >
        <div className={`flex items-center justify-between px-4 py-3 border-b ${isDarkMode ? 'border-[#383838]' : 'border-[#E5E4DE]'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <PenTool className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold truncate">{title || 'Draw your signature'}</span>
          </div>
          <button type="button" onClick={onCancel} className={`p-1.5 rounded-lg ${ghostBtn}`} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
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
                Sign here with your finger or mouse
              </span>
            )}
          </div>
          <p className={`mt-2 text-[11px] ${muted}`}>
            By applying, you agree this is your electronic signature.
          </p>
        </div>

        <div className={`flex items-center justify-between gap-2 px-4 py-3 border-t ${isDarkMode ? 'border-[#383838]' : 'border-[#E5E4DE]'}`}>
          <button
            type="button"
            onClick={clear}
            disabled={!hasInk}
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
              onClick={apply}
              disabled={!hasInk}
              className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 ${
                isDarkMode ? 'bg-[#ECECEC] text-[#171717] hover:bg-white' : 'bg-[#1F1E1D] text-white hover:bg-[#383734]'
              }`}
            >
              Apply signature
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
