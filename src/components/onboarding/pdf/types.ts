// ============================================================================
// PDF.js Visual Document Embedding — Shared Types
//
// Phase 2, Step 2.1 (Onboarding Document System — APPROVED PLAN, Option A)
// Renders PDF pages as <canvas> via pdfjs-dist. Interactive HTML field
// overlays (Step 2.3) are positioned using the metrics emitted here.
// ============================================================================

import type { PDFDocumentProxy, PageViewport } from 'pdfjs-dist';

/** Geometry for one rendered page — everything Step 2.3 needs to place overlays. */
export interface PageViewportMetrics {
  /** 0-based page index. */
  pageIndex: number;
  /** Rendered CSS width in px (already multiplied by `scale`). */
  width: number;
  /** Rendered CSS height in px (already multiplied by `scale`). */
  height: number;
  /** Rendering scale (1 = 72 DPI native PDF size). */
  scale: number;
  /** Device pixel ratio used for the canvas backing store. */
  dpr: number;
  /** Page rotation in degrees (0, 90, 180, 270). */
  rotation: number;
  /** Unscaled PDF page width in PDF points. */
  pdfWidth: number;
  /** Unscaled PDF page height in PDF points. */
  pdfHeight: number;
  /**
   * The live pdf.js viewport. Use `viewport.convertToViewportRectangle(rect)`
   * to convert an AcroForm `/Rect` [x1, y1, x2, y2] (PDF space, bottom-left
   * origin) into CSS px (top-left origin), rotation-aware.
   */
  viewport: PageViewport;
}

export type PdfLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PdfDocumentState {
  status: PdfLoadStatus;
  doc: PDFDocumentProxy | null;
  numPages: number;
  error: Error | null;
}

export type PdfViewerMode = 'single' | 'continuous';

export interface PdfCanvasViewerProps {
  /** Signed or public URL to the PDF. NOTE: cross-origin hosts must allow CORS. */
  fileUrl?: string;
  /** Raw PDF bytes, used instead of `fileUrl` when already in memory. */
  pdfBytes?: Uint8Array | ArrayBuffer;
  /** Extra classes for the outer container. */
  className?: string;
  /** Toolbar/surface theming. */
  isDarkMode?: boolean;
  /** Initial zoom. Default: 'fit-width'. */
  initialScale?: number | 'fit-width';
  /** One page at a time, or all pages stacked vertically. Default: 'single'. */
  mode?: PdfViewerMode;
  /**
   * Hide the PDF's built-in interactive form widgets on the canvas so HTML
   * overlays (Step 2.3) don't double-render. Default: false (show everything).
   */
  hideFormWidgets?: boolean;
  /** Max height of the scrollable page area (CSS value). Default: '70vh'. */
  maxHeight?: string;
  /** Show the download button (only when `fileUrl` is provided). Default: true. */
  showDownload?: boolean;
  /** Render custom HTML on top of a page (Step 2.3 field overlays). */
  renderPageOverlay?: (metrics: PageViewportMetrics) => React.ReactNode;
  /** Fired after each page finishes rendering at a given scale. */
  onPageMetricsChange?: (metrics: PageViewportMetrics) => void;
  /** Fired once the document has loaded. */
  onDocumentLoad?: (info: { numPages: number }) => void;
  /** Fired if loading fails. */
  onError?: (error: Error) => void;
}
