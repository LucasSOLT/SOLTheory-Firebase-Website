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

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

let activePortalCount = 0;
let savedBodyOverflow = '';
let savedDocOverflow = '';
let savedBackgroundScrollElements: Array<{ el: HTMLElement; overflowY: string }> = [];

interface PortalStackEntry {
  root: HTMLDivElement;
  pausedScrollers: Array<{ el: HTMLElement; overflowY: string }>;
}

const portalStack: PortalStackEntry[] = [];

function activatePortalScroller(root: HTMLElement) {
  if (typeof document === 'undefined') return;
  const scrollers = root.querySelectorAll<HTMLElement>('.overflow-y-auto');
  scrollers.forEach((el) => {
    (el.style as any).WebkitOverflowScrolling = 'touch';
  });

  const active = document.activeElement as HTMLElement | null;
  if (!active || active === document.body || !root.contains(active)) {
    if (active && active !== document.body && typeof active.blur === 'function') {
      active.blur();
    }
    const primaryScroller = scrollers[0] || (root.firstElementChild as HTMLElement | null);
    if (primaryScroller) {
      if (!primaryScroller.hasAttribute('tabindex')) {
        primaryScroller.setAttribute('tabindex', '-1');
      }
      primaryScroller.style.outline = 'none';
      primaryScroller.focus({ preventScroll: true });
    }
  }
}

/**
 * Ref-counted scroll lock for modals and fullscreen overlays.
 * Locks `document.body`, `document.documentElement`, and any active background
 * `.overflow-y-auto` scroll containers outside portals (such as dashboard `<main>`
 * or onboarding page wrappers) so iOS Safari immediately cancels momentum scrolling
 * and releases background scroll-gesture latching when a modal opens.
 */
export function acquireBodyScrollLock(): () => void {
  if (typeof document === 'undefined') return () => {};

  if (activePortalCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    savedDocOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    savedBackgroundScrollElements = [];
    const bgScrollers = document.querySelectorAll<HTMLElement>('main.overflow-y-auto, .overflow-y-auto');
    bgScrollers.forEach((el) => {
      if (el.closest('[data-body-portal], [data-pdf-modal]')) return;
      savedBackgroundScrollElements.push({ el, overflowY: el.style.overflowY });
      el.style.overflowY = 'hidden';
    });
  }
  activePortalCount += 1;

  let released = false;
  return () => {
    if (released || typeof document === 'undefined') return;
    released = true;
    activePortalCount = Math.max(0, activePortalCount - 1);
    if (activePortalCount === 0) {
      document.body.style.overflow = savedBodyOverflow;
      document.documentElement.style.overflow = savedDocOverflow;
      for (const item of savedBackgroundScrollElements) {
        item.el.style.overflowY = item.overflowY;
      }
      savedBackgroundScrollElements = [];
    }
  };
}

export default function BodyPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return acquireBodyScrollLock();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = rootRef.current;
    if (!root || typeof document === 'undefined') return;

    // Pause scroll containers in any parent portal underneath this stacked portal.
    const prevTop = portalStack[portalStack.length - 1];
    if (prevTop && prevTop.root !== root) {
      prevTop.pausedScrollers = [];
      prevTop.root.querySelectorAll<HTMLElement>('.overflow-y-auto').forEach((el) => {
        if (root.contains(el)) return;
        prevTop.pausedScrollers.push({ el, overflowY: el.style.overflowY });
        el.style.overflowY = 'hidden';
      });
    }

    const entry: PortalStackEntry = { root, pausedScrollers: [] };
    portalStack.push(entry);

    activatePortalScroller(root);

    // If a button inside this modal unmounts itself on click (e.g. "Use" in
    // DocumentLibraryPicker, selecting a member in SigningOrderConfigurator,
    // or deleting an item/tag), iOS Safari drops activeElement to <body>.
    // Re-anchor responder focus onto the modal's scroll container immediately.
    const observer = new MutationObserver(() => {
      if (portalStack[portalStack.length - 1]?.root !== root) return;
      const scrollers = root.querySelectorAll<HTMLElement>('.overflow-y-auto');
      scrollers.forEach((el) => {
        (el.style as any).WebkitOverflowScrolling = 'touch';
      });
      if (!document.activeElement || document.activeElement === document.body) {
        activatePortalScroller(root);
      }
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      for (const item of entry.pausedScrollers) {
        item.el.style.overflowY = item.overflowY;
      }
      entry.pausedScrollers = [];
      const idx = portalStack.indexOf(entry);
      if (idx !== -1) portalStack.splice(idx, 1);

      const nextTop = portalStack[portalStack.length - 1];
      if (nextTop) {
        for (const item of nextTop.pausedScrollers) {
          item.el.style.overflowY = item.overflowY;
        }
        nextTop.pausedScrollers = [];
        activatePortalScroller(nextTop.root);
      }
    };
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <div ref={rootRef} data-body-portal style={{ display: 'contents' }}>
      {children}
    </div>,
    document.body,
  );
}

/**
 * Fixed-card overlay classes shared by onboarding modals.
 * Uses `overflow-hidden` on the outer backdrop so iOS Safari never latches
 * initial touch-scroll gestures onto the backdrop instead of the modal's
 * internal scroll container, and avoids 3D transform entry keyframes that
 * tear down WebKit GraphicsLayers around child `overflow-y-auto` scrollers.
 */
export const MODAL_OVERLAY_CLASS =
  'fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-2 sm:p-4 bg-black/60 backdrop-blur-sm';

/** Alias for explicit fixed-card overlay usage. */
export const MODAL_FIXED_OVERLAY_CLASS = MODAL_OVERLAY_CLASS;

/** Safe-area-aware max-height for modal cards inside MODAL_OVERLAY_CLASS. */
export const MODAL_CARD_MAX_HEIGHT_CLASS =
  'max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem)]';

/** Shared classes for the internal scrollable body of an onboarding modal. */
export const MODAL_SCROLL_BODY_CLASS =
  'min-h-0 overflow-y-auto overscroll-contain touch-pan-y';

/** Inline style for internal scroll containers on iOS WebKit. */
export const MODAL_SCROLL_BODY_STYLE = {
  WebkitOverflowScrolling: 'touch',
} as const;

/** Inline style for the overlay: keep clear of the iPhone notch / home indicator. */
export const MODAL_OVERLAY_STYLE = {
  paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
  paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
} as const;


