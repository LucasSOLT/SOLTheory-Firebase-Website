'use client';

// ============================================================================
// BodyPortal — render onboarding modals at the document root
//
// Signature Suite D4. The dashboard renders page content inside a
// `relative z-10` wrapper while the mobile site header is `fixed z-[60]`
// OUTSIDE it, so any `fixed z-[9999]` modal inside a page was still painted
// UNDER the header (top of the modal cut off, unreachable). Portaling to
// <body> lifts modals out of that stacking context.
//
// Pair with "safe centering" on the overlay: `flex items-start overflow-y-auto`
// + `my-auto` on the panel → centred when it fits, scrolls from the top when
// it doesn't (plain `items-center` cuts off the top of tall panels).
// ============================================================================

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function BodyPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/** Overlay classes shared by onboarding modals (safe centering + own scroll + notch padding). */
export const MODAL_OVERLAY_CLASS =
  'fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto overscroll-contain p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200';

/** Inline style for the overlay: keep clear of the iPhone notch / home indicator. */
export const MODAL_OVERLAY_STYLE = {
  paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
  paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
} as const;
