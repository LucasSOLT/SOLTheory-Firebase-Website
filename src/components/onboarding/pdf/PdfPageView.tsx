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
//
// Step 2.5 (mobile):
//   • Geometry and raster are separate. Page size + overlay metrics are always
//     published (so layout and fields are stable); the expensive raster only
//     runs while the page is near the viewport, and is released when far away.
//   • Re-renders (zoom) draw into an offscreen canvas and swap in when done, so
//     the old bitmap stays visible (stretched) instead of flashing white.
//   • Backing-store size is capped — iOS Safari silently renders blank canvases
//     above ~16.7M pixels and kills tabs that hold too much canvas memory.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { loadPdfJs } from './usePdfDocument';
import type { PageViewportMetrics } from './types';
import { isCoarsePointerDevice } from './viewerContext';

interface PdfPageViewProps {
  doc: PDFDocumentProxy;
  /** 0-based page index. */
  pageIndex: number;
  scale: number;
  hideFormWidgets?: boolean;
  isDarkMode?: boolean;
  /** Scroll container used to decide when to rasterize (lazy rendering). Null = always render. */
  scrollRoot?: HTMLElement | null;
  renderOverlay?: (metrics: PageViewportMetrics) => React.ReactNode;
  onMetrics?: (metrics: PageViewportMetrics) => void;
}

const MAX_DPR = 3; // cap memory use on very dense screens
const MAX_CANVAS_PIXELS_DESKTOP = 16_000_000; // just under the iOS/Safari hard limit (16,777,216)
const MAX_CANVAS_PIXELS_TOUCH = 8_000_000; // phones/tablets: leave room for several pages
const NEAR_VIEWPORT_MARGIN = '150% 0px'; // rasterize pages within 1.5 screens of the visible area

/** Device pixel ratio for the backing store, reduced if the bitmap would be too large. */
function effectiveDpr(cssWidth: number, cssHeight: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const budget = isCoarsePointerDevice() ? MAX_CANVAS_PIXELS_TOUCH : MAX_CANVAS_PIXELS_DESKTOP;
  const area = cssWidth * cssHeight;
  if (area <= 0) return dpr;
  return Math.max(0.5, Math.min(dpr, Math.sqrt(budget / area)));
}

function releaseCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

export default function PdfPageView({
  doc,
  pageIndex,
  scale,
  hideFormWidgets = false,
  isDarkMode = false,
  scrollRoot,
  renderOverlay,
  onMetrics,
}: PdfPageViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  /** Identifies what the visible bitmap currently shows (`scale|hideWidgets`), or null if empty. */
  const renderedKeyRef = useRef<string | null>(null);

  const [metrics, setMetrics] = useState<PageViewportMetrics | null>(null);
  const [isNear, setIsNear] = useState(scrollRoot === null);
  const [isRendering, setIsRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callback without re-triggering renders when the parent re-creates it.
  const onMetricsRef = useRef(onMetrics);
  onMetricsRef.current = onMetrics;

  // ── 1. Geometry: page size + overlay metrics (cheap; always runs) ──
  useEffect(() => {
    let cancelled = false;
    setError(null);

    doc
      .getPage(pageIndex + 1)
      .then((page) => {
        if (cancelled) return;
        pageRef.current = page;
        const viewport = page.getViewport({ scale });
        const unscaled = page.getViewport({ scale: 1, rotation: 0 });
        // Reserve the layout box and publish geometry immediately, so the page
        // doesn't jump and field overlays move with it while the canvas rasterizes.
        setMetrics({
          pageIndex,
          width: viewport.width,
          height: viewport.height,
          scale,
          dpr: effectiveDpr(viewport.width, viewport.height),
          rotation: viewport.rotation,
          pdfWidth: unscaled.width,
          pdfHeight: unscaled.height,
          viewport,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(`[PdfViewer] Failed to load page ${pageIndex + 1}:`, err);
        setError('This page could not be displayed.');
        setIsRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [doc, pageIndex, scale]);

  // ── 2. Visibility: only rasterize pages near the scroll viewport ──
  useEffect(() => {
    const el = containerRef.current;
    if (scrollRoot === null || !el || typeof IntersectionObserver === 'undefined') {
      setIsNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => setIsNear(entries.some((e) => e.isIntersecting)),
      { root: scrollRoot ?? null, rootMargin: NEAR_VIEWPORT_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  // ── 3. Raster: draw offscreen, then swap into the visible canvas ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const page = pageRef.current;
    if (!metrics || !canvas || !page) return;

    if (!isNear) {
      // Far off-screen: free the bitmap (mobile memory). Re-rendered on approach.
      if (renderedKeyRef.current) {
        releaseCanvas(canvas);
        renderedKeyRef.current = null;
      }
      return;
    }

    const key = `${metrics.scale}|${hideFormWidgets ? 1 : 0}`;
    if (renderedKeyRef.current === key) {
      setIsRendering(false);
      return;
    }

    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let offscreen: HTMLCanvasElement | null = null;
    setIsRendering(true);

    (async () => {
      try {
        const lib = await loadPdfJs();
        if (cancelled) return;

        const { viewport, dpr } = metrics;
        offscreen = document.createElement('canvas');
        offscreen.width = Math.max(1, Math.floor(viewport.width * dpr));
        offscreen.height = Math.max(1, Math.floor(viewport.height * dpr));

        renderTask = page.render({
          canvas: offscreen,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
          annotationMode: hideFormWidgets
            ? lib.AnnotationMode.ENABLE_FORMS
            : lib.AnnotationMode.ENABLE,
        });
        await renderTask.promise;
        if (cancelled) return;

        canvas.width = offscreen.width;
        canvas.height = offscreen.height;
        canvas.getContext('2d')?.drawImage(offscreen, 0, 0);
        renderedKeyRef.current = key;

        setIsRendering(false);
        onMetricsRef.current?.(metrics);
      } catch (err: unknown) {
        // Zooming/paging cancels in-flight renders — that's expected, not an error.
        if (cancelled || (err instanceof Error && err.name === 'RenderingCancelledException')) return;
        console.error(`[PdfViewer] Failed to render page ${pageIndex + 1}:`, err);
        setError('This page could not be displayed.');
        setIsRendering(false);
      } finally {
        releaseCanvas(offscreen);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [metrics, isNear, hideFormWidgets, pageIndex]);

  // Free the bitmap on unmount (iOS Safari holds canvas memory aggressively).
  useEffect(() => {
    const canvas = canvasRef.current;
    return () => releaseCanvas(canvas);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto shadow-md ${isDarkMode ? 'bg-[#2F2F2F]' : 'bg-white'}`}
      style={metrics ? { width: metrics.width, height: metrics.height } : { width: '100%', minHeight: 320 }}
      data-pdf-page={pageIndex}
    >
      {/* Sized by CSS to the page box, so a stale bitmap stretches (not blank) while re-rendering. */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 block w-full h-full" aria-label={`PDF page ${pageIndex + 1}`} />

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
