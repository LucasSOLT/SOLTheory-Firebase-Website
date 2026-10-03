// ============================================================================
// lib/pdf-autofill.ts — Phase 6.2 (pure; safe for server AND client)
//
// "Smart" auto-fill for PDF form text fields. The blueprint admin tags a text
// field as one of:
//   • today_date   — the date the signer submits (MM/DD/YYYY)
//   • signer_name  — the signer's full name on their account
//   • signer_email — the signer's email on their account
//
// The SERVER is authoritative: at submit time it overwrites whatever the
// browser sent for these fields (so a signer can't back-date a legal document
// or sign as someone else). The browser uses the same function only to PREVIEW
// the values read-only before the signer submits.
// ============================================================================

export type AutoFillKind = 'today_date' | 'signer_name' | 'signer_email';

export const AUTO_FILL_KINDS: readonly AutoFillKind[] = ['today_date', 'signer_name', 'signer_email'];

export const AUTO_FILL_LABELS: Record<AutoFillKind, string> = {
  today_date: "Today's date",
  signer_name: "Signer's full name",
  signer_email: "Signer's email",
};

/** Timezone used to decide what "today" is. */
export const AUTO_FILL_TIME_ZONE = 'America/Denver';

export const isAutoFillKind = (v: unknown): v is AutoFillKind =>
  typeof v === 'string' && (AUTO_FILL_KINDS as readonly string[]).includes(v);

/** MM/DD/YYYY for `now` in `timeZone` (the format on US forms such as the W-4). */
export function formatAutoFillDate(now: Date, timeZone: string = AUTO_FILL_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.month}/${parts.day}/${parts.year}`;
}

export interface AutoFillContext {
  name: string;
  email: string;
  now?: Date;
}

export interface AutoFillFieldInfo {
  name: string;
  type: string;
  maxLength?: number;
}

/**
 * Compute the auto-filled values for ONE signer.
 *
 * @param autoFill   the blueprint's `{ fieldName: kind }` map (untrusted shape is tolerated)
 * @param owned      fields this signer is allowed to fill; `null` = all (single-signer documents)
 * @param fields     detected template fields — used to restrict auto-fill to plain TEXT fields
 *                   (never checkboxes, signatures, dropdowns…). Fields missing from this list are ignored.
 * @param ctx        who is signing + the clock
 */
export function resolveAutoFill(
  autoFill: unknown,
  owned: Iterable<string> | null,
  fields: readonly AutoFillFieldInfo[],
  ctx: AutoFillContext,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!autoFill || typeof autoFill !== 'object' || Array.isArray(autoFill)) return out;

  const ownedSet = owned ? new Set(owned) : null;
  const textFields = new Map<string, AutoFillFieldInfo>();
  for (const f of fields) if (f && f.type === 'text') textFields.set(f.name, f);

  const now = ctx.now ?? new Date();
  const name = (ctx.name || '').trim();
  const email = (ctx.email || '').trim();

  for (const [fieldName, kind] of Object.entries(autoFill as Record<string, unknown>)) {
    if (!isAutoFillKind(kind)) continue;
    const info = textFields.get(fieldName);
    if (!info) continue;
    if (ownedSet && !ownedSet.has(fieldName)) continue;

    const value = kind === 'today_date' ? formatAutoFillDate(now) : kind === 'signer_name' ? name : email;
    if (!value) continue; // never blank out a field because we don't know the value
    out[fieldName] = typeof info.maxLength === 'number' && info.maxLength > 0 ? value.slice(0, info.maxLength) : value;
  }
  return out;
}

/** Drop unknown kinds / unknown or non-text fields before saving a blueprint. */
export function sanitizeAutoFill(
  raw: unknown,
  fields: readonly AutoFillFieldInfo[],
): Record<string, AutoFillKind> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const textNames = new Set(fields.filter((f) => f.type === 'text').map((f) => f.name));
  const out: Record<string, AutoFillKind> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (textNames.has(k) && isAutoFillKind(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
