'use client';

// ============================================================================
// PdfCanvasViewer — reusable PDF.js visual document viewer
//
// Phase 2, Step 2.1 (Onboarding Document System — APPROVED PLAN, Option A)
// Do NOT replace with iframe/embed or HTML-only rendering (locked decision).
//
// Features: client-only pdf.js loading, HiDPI canvas pages, fit-to-width
// (tracks container resizes), zoom 50–300%, single/continuous modes, page
// navigation, download, and a per-page overlay slot for Step 2.3.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import PdfPageView from './PdfPageView';
import { usePdfDocument } from './usePdfDocument';
import type { PdfCanvasViewerProps } from './types';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.25;
const PAGE_GUTTER_PX = 32; // horizontal padding inside the scroll area (16px each side)

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export default function PdfCanvasViewer({
  fileUrl,
  pdfBytes,
  className = '',
  isDarkMode = false,
  initialScale = 'fit-width',
  mode = 'single',
  hideFormWidgets = false,
  maxHeight = '70vh',
  showDownload = true,
  renderPageOverlay,
  onPageMetricsChange,
  onDocumentLoad,
  onError,
}: PdfCanvasViewerProps) {
  const { status, doc, numPages, error } = usePdfDocument({ fileUrl, pdfBytes });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0); // 0-based
  const [fitWidth, setFitWidth] = useState(initialScale === 'fit-width');
  const [manualScale, setManualScale] = useState(typeof initialScale === 'number' ? clampScale(initialScale) : 1);
  const [fitScale, setFitScale] = useState<number | null>(null);
  const [basePageWidth, setBasePageWidth] = useState<number | null>(null); // page 1 width at scale 1

  // Stable refs so parent callbacks don't retrigger effects
  const onDocumentLoadRef = useRef(onDocumentLoad);
  onDocumentLoadRef.current = onDocumentLoad;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // ── Document lifecycle ──
  useEffect(() => {
    setCurrentPage(0);
    setBasePageWidth(null);
    if (status === 'ready' && doc) {
      onDocumentLoadRef.current?.({ numPages });
      doc
        .getPage(1)
        .then((p) => setBasePageWidth(p.getViewport({ scale: 1 }).width))
        .catch(() => setBasePageWidth(612)); // US Letter fallback
    }
    if (status === 'error' && error) onErrorRef.current?.(error);
  }, [status, doc, numPages, error]);

  // ── Fit-to-width: recompute whenever the container resizes ──
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !basePageWidth) return;

    let frame = 0;
    const compute = () => {
      const available = el.clientWidth - PAGE_GUTTER_PX;
      if (available <= 0) return;
      const next = clampScale(Math.round((available / basePageWidth) * 100) / 100);
      // Ignore sub-1% changes to avoid re-rasterizing on every pixel of a resize
      setFitScale((prev) => (prev !== null && Math.abs(prev - next) < 0.01 ? prev : next));
    };
    compute();

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(compute);
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [basePageWidth, status]);

  const scale = fitWidth ? fitScale ?? 1 : manualScale;
  const scaleReady = !fitWidth || fitScale !== null;

  // ── Zoom ──
  const zoomBy = useCallback(
    (delta: number) => {
      const next = clampScale(Math.round((scale + delta) * 100) / 100);
      setManualScale(next);
      setFitWidth(false);
    },
    [scale],
  );

  // ── Page navigation ──
  const goToPage = useCallback(
    (index: number) => {
      const target = Math.min(Math.max(index, 0), Math.max(numPages - 1, 0));
      setCurrentPage(target);
      if (mode === 'continuous') {
        scrollRef.current
          ?.querySelector(`[data-pdf-page="${target}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        scrollRef.current?.scrollTo({ top: 0 });
      }
    },
    [mode, numPages],
  );

  const pagesToRender = useMemo(() => {
    if (!numPages) return [];
    return mode === 'continuous' ? Array.from({ length: numPages }, (_, i) => i) : [currentPage];
  }, [mode, numPages, currentPage]);

  // ── Styles (project editorial palette) ──
  const surface = isDarkMode ? 'bg-[#212121] border-[#383838]' : 'bg-[#FAF9F5] border-[#E5E4DE]';
  const toolbar = isDarkMode ? 'bg-[#171717] border-[#383838]' : 'bg-[#F3F2EC] border-[#E5E4DE]';
  const iconBtn = `p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
    isDarkMode ? 'text-[#B4B4B4] hover:bg-[#2F2F2F] hover:text-[#ECECEC]' : 'text-[#6B6860] hover:bg-[#EAE7DF] hover:text-[#1F1E1D]'
  }`;
  const label = isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]';
  const pageArea = isDarkMode ? 'bg-[#171717]' : 'bg-[#EAE7DF]/60';

  return (
    <div className={`w-full rounded-xl border overflow-hidden flex flex-col ${surface} ${className}`}>
      {/* ── Toolbar ── */}
      <div className={`flex items-center justify-between gap-2 px-2 sm:px-3 py-1.5 border-b ${toolbar}`}>
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          {mode === 'single' && (
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={status !== 'ready' || currentPage === 0}
              className={iconBtn}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <span className={`text-xs font-medium tabular-nums px-1 ${label}`}>
            {status === 'ready'
              ? mode === 'single'
                ? `Page ${currentPage + 1} of ${numPages}`
                : `${numPages} page${numPages === 1 ? '' : 's'}`
              : '—'}
          </span>
          {mode === 'single' && (
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={status !== 'ready' || currentPage >= numPages - 1}
              className={iconBtn}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Zoom + download */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={() => zoomBy(-ZOOM_STEP)}
            disabled={status !== 'ready' || scale <= MIN_SCALE}
            className={iconBtn}
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className={`text-xs font-medium tabular-nums w-11 text-center ${label}`}>
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={status !== 'ready' || scale >= MAX_SCALE}
            className={iconBtn}
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setFitWidth(true)}
            disabled={status !== 'ready' || fitWidth}
            className={iconBtn}
            aria-label="Fit to width"
            title="Fit to width"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          {showDownload && fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className={iconBtn}
              aria-label="Download PDF"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* ── Page area ── */}
      <div ref={scrollRef} className={`relative overflow-auto ${pageArea}`} style={{ maxHeight }}>
        {(status === 'loading' || (status === 'ready' && !scaleReady)) && (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className={`w-7 h-7 animate-spin ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`} />
            <span className={`text-xs ${label}`}>Loading document…</span>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 px-6 text-center">
            <AlertCircle className="w-7 h-7 text-red-500" />
            <span className={`text-sm font-medium ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'}`}>
              Couldn&apos;t load this document
            </span>
            <span className={`text-xs ${label}`}>
              {fileUrl ? 'Try refreshing, or download it with the button above.' : 'The file may be corrupted.'}
            </span>
          </div>
        )}

        {status === 'idle' && (
          <div className={`py-16 text-center text-xs ${label}`}>No document selected.</div>
        )}

        {status === 'ready' && doc && scaleReady && (
          <div className="flex flex-col items-center gap-4 py-4 px-4 w-max min-w-full">
            {pagesToRender.map((pageIndex) => (
              <PdfPageView
                key={pageIndex}
                doc={doc}
                pageIndex={pageIndex}
                scale={scale}
                hideFormWidgets={hideFormWidgets}
                isDarkMode={isDarkMode}
                renderOverlay={renderPageOverlay}
                onMetrics={onPageMetricsChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
