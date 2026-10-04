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
//
// Step 2.5 (mobile):
//   • Pinch-to-zoom (touch), ctrl/⌘+wheel and trackpad pinch (desktop), with a
//     GPU transform preview during the gesture and a single re-raster on release.
//     The site viewport disables page zoom (user-scalable=no), so this is the
//     only way phone users can zoom the document.
//   • Every zoom (gesture, buttons, fit-width) keeps the focal point in place.
//   • Narrow containers use a smaller gutter so phones get a larger page.
//   • Exposes `revealElement` via PdfViewerContext so field overlays can zoom
//     tiny fields to a readable size when tapped on a phone.
//
// Signature Suite D1/D3:
//   • Hosts the phone field-input sheet state (`activeSheetField`) in context.
//   • Real in-app fullscreen: the viewer is portaled to <body> as a fixed,
//     full-screen layer with a floating ✕ (top-left). The phone back gesture,
//     Escape, or ✕ closes it. (iOS Safari can't element-fullscreen natively.)
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize,
  Minimize2,
  MoveHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import PdfPageView from './PdfPageView';
import { usePdfDocument } from './usePdfDocument';
import {
  PdfViewerContext,
  Z_FULLSCREEN_VIEWER,
  useCoarsePointer,
  type ActiveSheetField,
  type PdfViewerControls,
} from './viewerContext';
import type { PdfCanvasViewerProps } from './types';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.25;
const PAGE_GUTTER_PX = 32; // horizontal padding inside the scroll area (16px each side)
const PAGE_GUTTER_COMPACT_PX = 16; // phones: 8px each side
const COMPACT_WIDTH_PX = 520; // container width below which the compact gutter is used
const WHEEL_COMMIT_DELAY_MS = 140; // re-raster once the wheel/trackpad gesture pauses
const PENDING_SCROLL_TTL_MS = 450; // how long a post-zoom scroll target stays active
const PINCH_HINT_MS = 2800;

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
const roundScale = (s: number) => Math.round(s * 100) / 100;

/** An in-progress zoom gesture, previewed with a CSS transform until it is committed. */
interface ZoomGesture {
  kind: 'pinch' | 'wheel' | 'safari';
  startScale: number;
  ratio: number;
  /** Focal point relative to the scroll viewport (px). */
  focalX: number;
  focalY: number;
  /** Focal point in content coordinates (transform-origin). */
  originX: number;
  originY: number;
  /** Two-finger pan since the gesture started (px). */
  panX: number;
  panY: number;
  startDist: number;
  startMidX: number;
  startMidY: number;
}

interface PendingScroll {
  left: number;
  top: number;
  expires: number;
  applied: boolean;
}

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
  const isCoarsePointer = useCoarsePointer();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0); // 0-based
  const [fitWidth, setFitWidth] = useState(initialScale === 'fit-width');
  const [manualScale, setManualScale] = useState(typeof initialScale === 'number' ? clampScale(initialScale) : 1);
  const [fitScale, setFitScale] = useState<number | null>(null);
  const [basePageWidth, setBasePageWidth] = useState<number | null>(null); // page 1 width at scale 1
  const [gutter, setGutter] = useState(PAGE_GUTTER_PX);
  const [showPinchHint, setShowPinchHint] = useState(false);

  // Signature Suite D1/D3. Entering/leaving fullscreen portals the viewer, which remounts
  // the scroll area — so the scroll element is tracked in state and observers re-bind to it.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const setScrollNode = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    setScrollEl(node);
  }, []);
  const [activeSheetField, setActiveSheetField] = useState<ActiveSheetField | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canPortal, setCanPortal] = useState(false);
  const pushedHistoryRef = useRef(false);
  useEffect(() => setCanPortal(true), []);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    // Drop the history entry we added so "back" isn't needed twice later.
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      try {
        window.history.back();
      } catch {
        /* ignore */
      }
    }
  }, []);

  // While fullscreen: phone back gesture / browser back closes it, Escape closes it, page behind can't scroll.
  useEffect(() => {
    if (!isFullscreen) return;
    try {
      // Next.js 15 supports native pushState (it copies its router state onto the entry).
      window.history.pushState({ pdfFullscreen: true }, '');
      pushedHistoryRef.current = true;
    } catch {
      pushedHistoryRef.current = false;
    }
    const onPop = () => {
      pushedHistoryRef.current = false;
      setIsFullscreen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[data-pdf-modal]')) return; // a signature pad / field sheet is on top: let it close first
      e.stopPropagation(); // don't also close the popup behind the fullscreen viewer
      exitFullscreen();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen, exitFullscreen]);

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
      const width = el.clientWidth;
      const nextGutter = width < COMPACT_WIDTH_PX ? PAGE_GUTTER_COMPACT_PX : PAGE_GUTTER_PX;
      setGutter(nextGutter);
      const available = width - nextGutter;
      if (available <= 0) return;
      const next = clampScale(roundScale(available / basePageWidth));
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
  }, [basePageWidth, status, scrollEl]);

  const scale = fitWidth ? fitScale ?? 1 : manualScale;
  const scaleReady = !fitWidth || fitScale !== null;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // ── Zoom engine (Step 2.5) ──────────────────────────────────────────────
  const gestureRef = useRef<ZoomGesture | null>(null);
  const pendingScrollRef = useRef<PendingScroll | null>(null);

  const applyPreview = useCallback((g: ZoomGesture) => {
    const content = contentRef.current;
    if (!content) return;
    content.style.transformOrigin = `${g.originX}px ${g.originY}px`;
    content.style.transform = `translate3d(${g.panX}px, ${g.panY}px, 0) scale(${g.ratio})`;
  }, []);

  const clearPreview = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    content.style.transform = '';
    content.style.transformOrigin = '';
    content.style.willChange = '';
  }, []);

  const applyPendingScroll = useCallback(() => {
    const pending = pendingScrollRef.current;
    const el = scrollRef.current;
    if (!pending || !el) return;
    if (performance.now() > pending.expires) {
      pendingScrollRef.current = null;
      return;
    }
    clearPreview();
    el.scrollLeft = Math.max(0, pending.left);
    el.scrollTop = Math.max(0, pending.top);
    pending.applied = true;
  }, [clearPreview]);

  /**
   * Commit a new scale, keeping the content point under (focalX, focalY) —
   * viewport-relative px — fixed on screen (minus any two-finger pan).
   * `fromScale` is the scale the focal math was measured at.
   */
  const commitZoom = useCallback(
    (target: number, fromScale: number, focalX: number, focalY: number, panX = 0, panY = 0, toFitWidth = false) => {
      const el = scrollRef.current;
      const next = toFitWidth ? target : clampScale(roundScale(target));
      if (!el) return;

      if (Math.abs(next - fromScale) < 0.005) {
        // No real zoom change: just apply the pan (if any) and drop the preview.
        clearPreview();
        if (panX || panY) {
          el.scrollLeft -= panX;
          el.scrollTop -= panY;
        }
        if (toFitWidth) setFitWidth(true);
        return;
      }

      const r = next / fromScale;
      const pending: PendingScroll = {
        left: (el.scrollLeft + focalX) * r - focalX - panX,
        top: (el.scrollTop + focalY) * r - focalY - panY,
        expires: performance.now() + PENDING_SCROLL_TTL_MS,
        applied: false,
      };
      pendingScrollRef.current = pending;

      if (toFitWidth) {
        setFitWidth(true);
      } else {
        setManualScale(next);
        setFitWidth(false);
      }

      // Fallback: if the layout never changes (e.g. page sizes were clamped), still finish cleanly.
      window.setTimeout(() => {
        if (pendingScrollRef.current === pending) {
          if (!pending.applied) {
            clearPreview();
            el.scrollLeft = Math.max(0, pending.left);
            el.scrollTop = Math.max(0, pending.top);
          }
          pendingScrollRef.current = null;
        }
      }, PENDING_SCROLL_TTL_MS);
    },
    [clearPreview],
  );

  // When zoomed pages take their new size, apply the scroll target in the same frame.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => applyPendingScroll());
    observer.observe(content);
    return () => observer.disconnect();
  }, [status, scaleReady, doc, applyPendingScroll, scrollEl]);

  // Gesture listeners (native, non-passive so we can stop the browser's own zoom).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const focalFrom = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      const focalX = clientX - rect.left - el.clientLeft;
      const focalY = clientY - rect.top - el.clientTop;
      return { focalX, focalY, originX: el.scrollLeft + focalX, originY: el.scrollTop + focalY };
    };
    const startGesture = (kind: ZoomGesture['kind'], clientX: number, clientY: number, extra?: Partial<ZoomGesture>) => {
      const g: ZoomGesture = {
        kind,
        startScale: scaleRef.current,
        ratio: 1,
        panX: 0,
        panY: 0,
        startDist: 1,
        startMidX: clientX,
        startMidY: clientY,
        ...focalFrom(clientX, clientY),
        ...extra,
      };
      gestureRef.current = g;
      if (contentRef.current) contentRef.current.style.willChange = 'transform';
      return g;
    };
    const finishGesture = (g: ZoomGesture) => {
      gestureRef.current = null;
      commitZoom(g.startScale * g.ratio, g.startScale, g.focalX, g.focalY, g.panX, g.panY);
    };

    // ── Touch pinch ──
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !contentRef.current) return;
      const m = mid(e.touches);
      startGesture('pinch', m.x, m.y, { startDist: dist(e.touches) || 1 });
      setShowPinchHint(false);
      e.preventDefault();
    };
    const onTouchMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (!g || g.kind !== 'pinch' || e.touches.length !== 2) return;
      e.preventDefault();
      g.ratio = clampScale(g.startScale * (dist(e.touches) / g.startDist)) / g.startScale;
      const m = mid(e.touches);
      g.panX = m.x - g.startMidX;
      g.panY = m.y - g.startMidY;
      applyPreview(g);
    };
    const onTouchEnd = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (!g || g.kind !== 'pinch' || e.touches.length >= 2) return;
      finishGesture(g);
    };

    // ── Ctrl/⌘ + wheel (mouse) and trackpad pinch (Chrome/Edge/Firefox send ctrl+wheel) ──
    let wheelTimer = 0;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !contentRef.current) return;
      e.preventDefault();
      let g = gestureRef.current;
      if (!g || g.kind !== 'wheel') g = startGesture('wheel', e.clientX, e.clientY);
      const delta = Math.max(-60, Math.min(60, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY));
      g.ratio = clampScale(g.startScale * g.ratio * Math.exp(-delta * 0.005)) / g.startScale;
      applyPreview(g);
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        const current = gestureRef.current;
        if (current?.kind === 'wheel') finishGesture(current);
      }, WHEEL_COMMIT_DELAY_MS);
    };

    // ── Safari gesture events: desktop trackpad pinch; on iOS just block native zoom ──
    type GestureLike = Event & { scale?: number; clientX?: number; clientY?: number };
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      if (gestureRef.current || !contentRef.current) return; // iOS: touch pinch already owns it
      const ge = e as GestureLike;
      const rect = el.getBoundingClientRect();
      startGesture('safari', ge.clientX ?? rect.left + el.clientWidth / 2, ge.clientY ?? rect.top + el.clientHeight / 2);
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = gestureRef.current;
      if (!g || g.kind !== 'safari') return;
      const s = (e as GestureLike).scale ?? 1;
      g.ratio = clampScale(g.startScale * s) / g.startScale;
      applyPreview(g);
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      const g = gestureRef.current;
      if (g?.kind === 'safari') finishGesture(g);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false } as AddEventListenerOptions);
    el.addEventListener('gesturechange', onGestureChange, { passive: false } as AddEventListenerOptions);
    el.addEventListener('gestureend', onGestureEnd, { passive: false } as AddEventListenerOptions);
    return () => {
      window.clearTimeout(wheelTimer);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
    };
  }, [applyPreview, commitZoom, scrollEl]);

  // One-time "Pinch to zoom" hint on touch devices.
  useEffect(() => {
    if (!isCoarsePointer || status !== 'ready') return;
    setShowPinchHint(true);
    const t = window.setTimeout(() => setShowPinchHint(false), PINCH_HINT_MS);
    return () => window.clearTimeout(t);
  }, [isCoarsePointer, status]);

  // ── Toolbar zoom (anchored at the center of the visible area) ──
  const viewportCenter = () => {
    const el = scrollRef.current;
    return { x: (el?.clientWidth ?? 0) / 2, y: (el?.clientHeight ?? 0) / 2 };
  };

  const zoomBy = useCallback(
    (delta: number) => {
      const c = viewportCenter();
      commitZoom(scale + delta, scale, c.x, c.y);
    },
    [scale, commitZoom],
  );

  const resetToFitWidth = useCallback(() => {
    if (fitScale === null) {
      setFitWidth(true);
      return;
    }
    const c = viewportCenter();
    commitZoom(fitScale, scale, c.x, c.y, 0, 0, true);
  }, [fitScale, scale, commitZoom]);

  // ── Overlay API: reveal (and zoom up to) an element, e.g. a tapped tiny field ──
  const revealElement = useCallback<PdfViewerControls['revealElement']>(
    (element, options) => {
      const el = scrollRef.current;
      if (!el) return;
      const cur = scaleRef.current;
      const next = options?.minScale ? Math.max(cur, clampScale(roundScale(options.minScale))) : cur;

      const sr = el.getBoundingClientRect();
      const tr = element.getBoundingClientRect();
      const fx = tr.left + tr.width / 2 - sr.left - el.clientLeft;
      const fy = tr.top + tr.height / 2 - sr.top - el.clientTop;

      if (next - cur < 0.005) {
        const fullyVisible = tr.left >= sr.left && tr.right <= sr.right && tr.top >= sr.top && tr.bottom <= sr.bottom;
        if (!fullyVisible) {
          el.scrollTo({
            left: el.scrollLeft + fx - el.clientWidth / 2,
            top: el.scrollTop + fy - el.clientHeight * 0.4,
            behavior: 'smooth',
          });
        }
        return;
      }
      // Zoom in around the element, then land it at the center (slightly high, above the keyboard).
      const r = next / cur;
      pendingScrollRef.current = {
        left: (el.scrollLeft + fx) * r - el.clientWidth / 2,
        top: (el.scrollTop + fy) * r - el.clientHeight * 0.4,
        expires: performance.now() + PENDING_SCROLL_TTL_MS,
        applied: false,
      };
      setManualScale(next);
      setFitWidth(false);
    },
    [],
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

  // D1 — phone input sheet. In single-page mode the target page must be the rendered one.
  const openFieldSheet = useCallback<PdfViewerControls['openFieldSheet']>(
    (target) => {
      if (target && mode === 'single' && target.pageIndex !== currentPage) {
        setCurrentPage(Math.min(Math.max(target.pageIndex, 0), Math.max(numPages - 1, 0)));
      }
      setActiveSheetField(target);
    },
    [mode, currentPage, numPages],
  );

  const viewerControls = useMemo<PdfViewerControls>(
    () => ({ scale, isCoarsePointer, revealElement, activeSheetField, openFieldSheet, isFullscreen }),
    [scale, isCoarsePointer, revealElement, activeSheetField, openFieldSheet, isFullscreen],
  );

  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    setFitWidth(true); // start the fullscreen view fitted to the whole screen width
  }, []);

  const pagesToRender = useMemo(() => {
    if (!numPages) return [];
    return mode === 'continuous' ? Array.from({ length: numPages }, (_, i) => i) : [currentPage];
  }, [mode, numPages, currentPage]);

  // ── Styles (project editorial palette) ──
  const surface = isDarkMode ? 'bg-[#212121] border-[#383838]' : 'bg-[#FAF9F5] border-[#E5E4DE]';
  const toolbar = isDarkMode ? 'bg-[#171717] border-[#383838]' : 'bg-[#F3F2EC] border-[#E5E4DE]';
  // Larger tap targets on touch devices.
  const iconBtn = `${isCoarsePointer ? 'p-2' : 'p-1.5'} rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
    isDarkMode ? 'text-[#B4B4B4] hover:bg-[#2F2F2F] hover:text-[#ECECEC]' : 'text-[#6B6860] hover:bg-[#EAE7DF] hover:text-[#1F1E1D]'
  }`;
  const label = isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]';
  const pageArea = isDarkMode ? 'bg-[#171717]' : 'bg-[#EAE7DF]/60';
  const pad = gutter / 2;

  const fullscreenActive = isFullscreen && canPortal;

  const viewerBody = (
      <div
        className={`flex flex-col overflow-hidden ${surface} ${
          fullscreenActive ? 'fixed inset-0 w-full' : `relative w-full rounded-xl border ${className}`
        }`}
        style={
          fullscreenActive
            ? { zIndex: Z_FULLSCREEN_VIEWER, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }
            : undefined
        }
        role={fullscreenActive ? 'dialog' : undefined}
        aria-modal={fullscreenActive || undefined}
        aria-label={fullscreenActive ? 'Document (fullscreen)' : undefined}
      >
        {/* ── Toolbar ── */}
        <div className={`flex items-center justify-between gap-1 sm:gap-2 px-1.5 sm:px-3 py-1 sm:py-1.5 border-b ${toolbar}`}>
          {/* Page navigation */}
          <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
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
            <span className={`text-xs font-medium tabular-nums px-1 whitespace-nowrap ${label}`}>
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
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={() => zoomBy(-ZOOM_STEP)}
              disabled={status !== 'ready' || scale <= MIN_SCALE}
              className={iconBtn}
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className={`text-xs font-medium tabular-nums w-10 sm:w-11 text-center ${label}`}>
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
              onClick={resetToFitWidth}
              disabled={status !== 'ready' || fitWidth}
              className={iconBtn}
              aria-label="Fit to width"
              title="Fit to width"
            >
              <MoveHorizontal className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={fullscreenActive ? exitFullscreen : enterFullscreen}
              disabled={status === 'error'}
              className={iconBtn}
              aria-label={fullscreenActive ? 'Exit fullscreen' : 'Fullscreen'}
              title={fullscreenActive ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreenActive ? <Minimize2 className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
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
        {/* touch-action: native one-finger scrolling stays; two-finger pinch is handled above. */}
        <div className={`relative flex flex-col ${fullscreenActive ? 'flex-1 min-h-0' : ''}`}>
        <div
          ref={setScrollNode}
          className={`relative overflow-auto ${pageArea} ${fullscreenActive ? 'flex-1 min-h-0' : ''}`}
          style={{ maxHeight: fullscreenActive ? 'none' : maxHeight, touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch' }}
        >
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
            <div
              ref={contentRef}
              className={`flex flex-col items-center w-max min-w-full ${gutter < PAGE_GUTTER_PX ? 'gap-2 py-2' : 'gap-4 py-4'}`}
              style={{ paddingLeft: pad, paddingRight: pad, paddingTop: fullscreenActive ? 56 : undefined }}
            >
              {pagesToRender.map((pageIndex) => (
                <PdfPageView
                  key={pageIndex}
                  doc={doc}
                  pageIndex={pageIndex}
                  scale={scale}
                  hideFormWidgets={hideFormWidgets}
                  isDarkMode={isDarkMode}
                  scrollRoot={scrollEl}
                  renderOverlay={renderPageOverlay}
                  onMetrics={onPageMetricsChange}
                />
              ))}
            </div>
          )}
        </div>

        {/* D3 — floating close button (top-left of the document) */}
        {fullscreenActive && (
          <button
            type="button"
            onClick={exitFullscreen}
            aria-label="Close fullscreen"
            title="Close fullscreen"
            className="absolute top-2 left-2 z-30 w-11 h-11 rounded-full flex items-center justify-center shadow-lg bg-[#1F1E1D]/85 text-white active:scale-95 backdrop-blur-sm"
          >
            <X className="w-6 h-6" />
          </button>
        )}
        </div>

        {/* Touch hint (non-interactive) */}
        <div
          aria-hidden
          className={`pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-[11px] font-medium shadow-lg transition-opacity duration-500 ${
            isDarkMode ? 'bg-[#ECECEC] text-[#171717]' : 'bg-[#1F1E1D] text-white'
          } ${showPinchHint ? 'opacity-90' : 'opacity-0'}`}
        >
          Pinch to zoom
        </div>
      </div>
  );

  return (
    <PdfViewerContext.Provider value={viewerControls}>
      {fullscreenActive ? (
        <>
          {/* Keeps the page layout in place while the document is open fullscreen */}
          <button
            type="button"
            onClick={exitFullscreen}
            className={`w-full rounded-xl border flex items-center justify-center gap-2 py-10 text-xs font-medium ${surface} ${label} ${className}`}
          >
            <Minimize2 className="w-4 h-4" /> Document is open in fullscreen. Tap to return.
          </button>
          {createPortal(viewerBody, document.body)}
        </>
      ) : (
        viewerBody
      )}
    </PdfViewerContext.Provider>
  );
}
