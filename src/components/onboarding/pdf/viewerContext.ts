'use client';

// ============================================================================
// Viewer context + touch helpers
//
// Phase 2, Step 2.5 (Onboarding Document System — APPROVED PLAN, Option A)
//
// PdfCanvasViewer provides this context so page overlays (PdfFieldOverlay) can
// ask the viewer to zoom/scroll — e.g. "this field is too small to read on a
// phone, zoom in and center it" — without prop-drilling through PdfPageView.
// ============================================================================

import { createContext, useContext, useEffect, useState } from 'react';

export interface PdfViewerControls {
  /** Current committed render scale. */
  scale: number;
  /** True on touch-first devices (phones/tablets) — `(pointer: coarse)`. */
  isCoarsePointer: boolean;
  /**
   * Bring `element` into view, centered. If `minScale` is above the current
   * scale the viewer zooms IN first (it never zooms out).
   */
  revealElement: (element: HTMLElement, options?: { minScale?: number }) => void;
  /**
   * Signature Suite D1 — the field currently being edited in the phone input
   * sheet (null = closed). Lives in the viewer (always mounted) so "Next field"
   * can jump to another page; the overlay of `pageIndex` renders the sheet.
   */
  activeSheetField: ActiveSheetField | null;
  /** Open (or close with null) the phone input sheet; switches page in single-page mode. */
  openFieldSheet: (target: ActiveSheetField | null) => void;
  /** Signature Suite D3 — true while the viewer covers the whole screen. */
  isFullscreen: boolean;
}

export interface ActiveSheetField {
  fieldName: string;
  pageIndex: number;
}

/** Layering (all onboarding modals use z-[9999]): fullscreen viewer → field sheet → signature pad. */
export const Z_FULLSCREEN_VIEWER = 10000;
export const Z_FIELD_SHEET = 10050;
export const Z_SIGNATURE_PAD = 10100;

export const PdfViewerContext = createContext<PdfViewerControls | null>(null);

/** Returns the enclosing viewer's controls, or null when used outside a viewer. */
export function usePdfViewer(): PdfViewerControls | null {
  return useContext(PdfViewerContext);
}

const COARSE_QUERY = '(pointer: coarse)';

/** Synchronous check (safe during SSR — returns false on the server). */
export function isCoarsePointerDevice(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(COARSE_QUERY).matches;
}

/** Reactive `(pointer: coarse)` media query. */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia?.(COARSE_QUERY);
    if (!mql) return;
    setCoarse(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return coarse;
}
