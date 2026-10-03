// Phase 2, Step 2.1 — PDF.js visual document embedding (Option A)
export { default as PdfCanvasViewer } from './PdfCanvasViewer';
export { default as PdfPageView } from './PdfPageView';
export { usePdfDocument, loadPdfJs } from './usePdfDocument';
// Phase 2, Step 2.5 — mobile: viewer controls for overlays (zoom/reveal), touch detection
export { PdfViewerContext, usePdfViewer, useCoarsePointer, isCoarsePointerDevice } from './viewerContext';
export type { PdfViewerControls } from './viewerContext';
export type {
  PageViewportMetrics,
  PdfCanvasViewerProps,
  PdfDocumentState,
  PdfLoadStatus,
  PdfViewerMode,
} from './types';

// Phase 2, Step 2.3 — interactive field overlays
export { default as PdfFieldOverlay } from './PdfFieldOverlay';
export type { PdfFieldOverlayProps } from './PdfFieldOverlay';
export { default as SignaturePadModal } from './SignaturePadModal';
export {
  layoutPageFields,
  computeFontSize,
  radioValueFor,
  isFieldValueEmpty,
  getMissingRequiredFields,
} from './overlayLayout';
export type { OverlayItem, PdfFieldValues, ViewportLike } from './overlayLayout';
