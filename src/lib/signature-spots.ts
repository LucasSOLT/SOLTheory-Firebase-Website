// ============================================================================
// lib/signature-spots.ts — Signature Suite, Phase B
//
// Pure helpers (no Firebase, no DOM) for "one signer, many signature spots".
// Used by the Blueprint Editor, the signing UI and the server (via
// signing-workflow.ts), so every reader agrees on where a signature goes.
//
// Backward compatibility: older items only have `signaturePosition` (one box).
// `signatureSpotsOf()` reads either shape; `withSignatureSpots()` always writes
// BOTH (`signaturePositions` + `signaturePosition` = first spot).
// ============================================================================

import type { PdfFieldWidget, SignatureSpot } from '@/types/onboarding-templates';

/** Hard cap per signer — keeps payloads small and stays under sign-step's MAX_STAMPS (20). */
export const MAX_SIGNATURE_SPOTS = 10;

export const DEFAULT_SIGNATURE_SPOT: SignatureSpot = { pageIndex: 0, x: 50, y: 50, width: 200, height: 60 };

export function isUsableSpot(p: unknown): p is SignatureSpot {
  if (!p || typeof p !== 'object') return false;
  const s = p as SignatureSpot;
  return (
    Number.isInteger(s.pageIndex) &&
    s.pageIndex >= 0 &&
    [s.x, s.y, s.width, s.height].every(Number.isFinite) &&
    s.width > 0 &&
    s.height > 0
  );
}

const clean = (s: SignatureSpot): SignatureSpot => ({
  pageIndex: s.pageIndex,
  x: s.x,
  y: s.y,
  width: s.width,
  height: s.height,
});

/** Every usable signature spot on a PdfFormContent or SignerDefinition. */
export function signatureSpotsOf(
  holder: { signaturePosition?: SignatureSpot; signaturePositions?: SignatureSpot[] } | null | undefined,
): SignatureSpot[] {
  if (!holder) return [];
  const many = Array.isArray(holder.signaturePositions) ? holder.signaturePositions.filter(isUsableSpot) : [];
  if (many.length) return many.slice(0, MAX_SIGNATURE_SPOTS).map(clean);
  return isUsableSpot(holder.signaturePosition) ? [clean(holder.signaturePosition)] : [];
}

/** Returns a copy of `holder` with its spots replaced (writes both the new and legacy keys). */
export function withSignatureSpots<T extends { signaturePosition?: SignatureSpot; signaturePositions?: SignatureSpot[] }>(
  holder: T,
  spots: SignatureSpot[],
): T {
  const next = { ...holder };
  const kept = spots.slice(0, MAX_SIGNATURE_SPOTS).map(clean);
  if (kept.length) {
    next.signaturePositions = kept;
    next.signaturePosition = kept[0];
  } else {
    delete next.signaturePositions;
    delete next.signaturePosition;
  }
  return next;
}

/** Overlay widget for a spot. */
export function spotToWidget(s: SignatureSpot): PdfFieldWidget {
  return {
    pageIndex: s.pageIndex,
    rect: [s.x, s.y, s.x + s.width, s.y + s.height],
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
  };
}
