'use client';

// ============================================================================
// PdfPageView — renders ONE PDF page to a HiDPI <canvas> + overlay slot
//
// Phase 2, Step 2.1 (Onboarding Document System — APPROVED PLAN, Option A)
//
// Layout:
//   <div relative, exact page size>
//     <canvas z-0 />                 ← pdf.js raster
//     <div absolute inset-0 z-10 />  ← Step 2.3 interactive field overlays
//   </div>
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { loadPdfJs } from './usePdfDocument';
import type { PageViewportMetrics } from './types';

interface PdfPageViewProps {
  doc: PDFDocumentProxy;
  /** 0-based page index. */
  pageIndex: number;
  scale: number;
  hideFormWidgets?: boolean;
  isDarkMode?: boolean;
  renderOverlay?: (metrics: PageViewportMetrics) => React.ReactNode;
  onMetrics?: (metrics: PageViewportMetrics) => void;
}

const MAX_DPR = 3; // cap memory use on very dense screens

export default function PdfPageView({
  doc,
  pageIndex,
  scale,
  hideFormWidgets = false,
  isDarkMode = false,
  renderOverlay,
  onMetrics,
}: PdfPageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [metrics, setMetrics] = useState<PageViewportMetrics | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callback without re-triggering renders when the parent re-creates it.
  const onMetricsRef = useRef(onMetrics);
  onMetricsRef.current = onMetrics;

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    setIsRendering(true);
    setError(null);

    (async () => {
      try {
        const [lib, page] = await Promise.all([loadPdfJs(), doc.getPage(pageIndex + 1)]);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const unscaled = page.getViewport({ scale: 1, rotation: 0 });
        const next: PageViewportMetrics = {
          pageIndex,
          width: viewport.width,
          height: viewport.height,
          scale,
          dpr,
          rotation: viewport.rotation,
          pdfWidth: unscaled.width,
          pdfHeight: unscaled.height,
          viewport,
        };

        // Reserve the layout box and publish geometry immediately, so the page
        // doesn't jump and field overlays move with it while the canvas rasterizes.
        setSize({ width: viewport.width, height: viewport.height });
        setMetrics(next);

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        renderTask = page.render({
          canvas,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
          annotationMode: hideFormWidgets
            ? lib.AnnotationMode.ENABLE_FORMS
            : lib.AnnotationMode.ENABLE,
        });
        await renderTask.promise;
        if (cancelled) return;

        setIsRendering(false);
        onMetricsRef.current?.(next);
      } catch (err: unknown) {
        // Zooming/paging cancels in-flight renders — that's expected, not an error.
        if (cancelled || (err instanceof Error && err.name === 'RenderingCancelledException')) return;
        console.error(`[PdfViewer] Failed to render page ${pageIndex + 1}:`, err);
        setError('This page could not be displayed.');
        setIsRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageIndex, scale, hideFormWidgets]);

  return (
    <div
      className={`relative mx-auto shadow-md ${isDarkMode ? 'bg-[#2F2F2F]' : 'bg-white'}`}
      style={size ? { width: size.width, height: size.height } : { width: '100%', minHeight: 320 }}
      data-pdf-page={pageIndex}
    >
      <canvas ref={canvasRef} className="absolute inset-0 z-0 block" aria-label={`PDF page ${pageIndex + 1}`} />

      {/* Step 2.3 overlay layer — only mounted once geometry is known */}
      {metrics && renderOverlay && !error && (
        <div className="absolute inset-0 z-10">{renderOverlay(metrics)}</div>
      )}

      {isRendering && !error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <Loader2 className={`w-6 h-6 animate-spin ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`} />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <span className={`text-sm ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`}>{error}</span>
        </div>
      )}
    </div>
  );
}
