// ============================================================================
// lib/initials-fields.ts — Signature Suite, Phase F
//
// Pure helpers (no Firebase, no DOM) that decide whether a stamp spot is a
// full SIGNATURE or the signer's INITIALS. Shared by the browser and the
// server (sign-step), so both always agree.
//
// Kind is derived at read time from the field NAME — no data migration, and
// sessions created before Phase F keep working (their boxes are "signature"
// unless an AcroForm signature field is literally named like "Initials").
// ============================================================================

export type StampKind = 'signature' | 'initials';

/** One virtual field holding every admin-placed INITIALS spot (single-signer flow). */
export const VIRTUAL_INITIALS_FIELD = '__soltheory_initials__';

/** Prefix for per-signer virtual initials boxes (multi-signer flow). */
export const SIGNER_INITIALS_FIELD_PREFIX = '__soltheory_initials__:';

export const signerInitialsFieldName = (order: number) => `${SIGNER_INITIALS_FIELD_PREFIX}${order}`;

export const isSignerInitialsField = (name: string) => name.startsWith(SIGNER_INITIALS_FIELD_PREFIX);

/** Kind of a field/box from its name alone (virtual prefix, or an AcroForm name like "Patient_Initials"). */
export function stampKindOfFieldName(name: string | undefined | null): StampKind {
  if (!name) return 'signature';
  if (name === VIRTUAL_INITIALS_FIELD || name.startsWith(SIGNER_INITIALS_FIELD_PREFIX)) return 'initials';
  return /initial/i.test(name) ? 'initials' : 'signature';
}

export const isInitialsFieldName = (name: string | undefined | null) => stampKindOfFieldName(name) === 'initials';

/** "Jane Q. Public" → "JQP". Falls back to "" when there is nothing usable. */
export function initialsFromName(name: string | undefined | null): string {
  const parts = (name || '')
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  const letters = parts.map((p) => p[0]!.toUpperCase());
  return letters.slice(0, 3).join('');
}

export const STAMP_LABELS: Record<StampKind, { noun: string; button: string; mine: string }> = {
  signature: { noun: 'signature', button: 'Sign', mine: 'Your signature' },
  initials: { noun: 'initials', button: 'Initial', mine: 'Your initials' },
};
