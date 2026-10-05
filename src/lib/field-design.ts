// ============================================================================
// lib/field-design.ts — Signature Suite, Phase G (pure; safe for client AND server)
//
// The Visual Field Designer lets an admin draw / drag / resize boxes on top of
// a PDF. The browser sends a list of small "design operations"; the SERVER
// validates them (this file) and bakes them into a NEW PDF copy with real
// AcroForm fields (pdf-field-designer-engine.ts). The original is never touched.
//
// Box roles are encoded in the FIELD NAME so the whole existing pipeline (field
// detection, Sign/Initial buttons, multi-signer routing, flatten) keeps working
// with no downstream changes:
//   Text_n       → plain text entry
//   Date_n       → text entry (auto-filled with today's date via autoFill)
//   Signature_n  → stamp spot (existing "signature" name rule)
//   Initials_n   → stamp spot, initials kind (Phase F name rule)
//   Fill_<color>_n → tap-to-fill box (checkbox painted as a solid color)
// ============================================================================

export type DesignBoxType = 'text' | 'fill' | 'signature' | 'initials' | 'date';

export const DESIGN_BOX_TYPES: readonly DesignBoxType[] = ['text', 'fill', 'signature', 'initials', 'date'];

export const DESIGN_BOX_LABELS: Record<DesignBoxType, string> = {
  text: 'Text entry',
  fill: 'Tap-to-fill',
  signature: 'Signature',
  initials: 'Initials',
  date: 'Date (auto)',
};

export type FillColorKey = 'black' | 'blue' | 'green' | 'yellow' | 'red';

export interface FillColorSpec {
  key: FillColorKey;
  label: string;
  hex: string;
  /** 0–1 paint opacity (the yellow "highlighter" stays see-through). */
  opacity: number;
}

/** The five approved tap-to-fill presets (locked decision). */
export const FILL_COLORS: readonly FillColorSpec[] = [
  { key: 'black', label: 'Black', hex: '#111111', opacity: 1 },
  { key: 'blue', label: 'Blue', hex: '#2563eb', opacity: 1 },
  { key: 'green', label: 'Green', hex: '#16a34a', opacity: 1 },
  { key: 'yellow', label: 'Yellow highlight', hex: '#facc15', opacity: 0.55 },
  { key: 'red', label: 'Red', hex: '#dc2626', opacity: 1 },
];

export const isFillColorKey = (v: unknown): v is FillColorKey =>
  typeof v === 'string' && FILL_COLORS.some((c) => c.key === v);

export const fillColorSpec = (key: FillColorKey): FillColorSpec =>
  FILL_COLORS.find((c) => c.key === key) ?? FILL_COLORS[0]!;

const FILL_NAME_RE = /(?:^|[^a-z])Fill_(black|blue|green|yellow|red)_\d+$/;

/** Color of a tap-to-fill checkbox from its field name, or null when it is not one. */
export function fillColorOfFieldName(name: string | undefined | null): FillColorSpec | null {
  if (!name) return null;
  const m = name.match(FILL_NAME_RE);
  return m ? fillColorSpec(m[1] as FillColorKey) : null;
}

export const DEFAULT_BOX_SIZE: Record<DesignBoxType, { width: number; height: number }> = {
  text: { width: 150, height: 22 },
  fill: { width: 36, height: 14 },
  signature: { width: 170, height: 40 },
  initials: { width: 60, height: 30 },
  date: { width: 90, height: 20 },
};

// ── Operations ──────────────────────────────────────────────────────────────

export type RetypeTarget = 'text' | 'signature' | 'initials';

export type DesignOp =
  | {
      op: 'add';
      type: DesignBoxType;
      pageIndex: number;
      /** PDF user space (points, bottom-left origin) — computed by the designer, never typed. */
      x: number;
      y: number;
      width: number;
      height: number;
      label?: string;
      required?: boolean;
      color?: FillColorKey;
    }
  | { op: 'delete'; name: string }
  | { op: 'retype'; name: string; to: RetypeTarget };

export const MAX_DESIGN_OPS = 300;
export const MAX_ADDED_BOXES = 150;
export const MIN_BOX_PT = 6;
export const MAX_LABEL_LENGTH = 80;

export class DesignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignError';
  }
}

export interface PageSize {
  /** MediaBox lower-left + size, in PDF points. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExistingFieldInfo {
  name: string;
  type: string;
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export const cleanLabel = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  const t = raw.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH);
  return t || undefined;
};

const isFiniteNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Validates untrusted ops against the PDF (page sizes + existing fields).
 * Returns a sanitized copy; throws DesignError on the first problem.
 */
export function validateDesignOps(
  raw: unknown,
  pages: readonly PageSize[],
  existing: readonly ExistingFieldInfo[],
): DesignOp[] {
  if (!Array.isArray(raw)) throw new DesignError('ops must be an array');
  if (raw.length > MAX_DESIGN_OPS) throw new DesignError(`Too many changes (max ${MAX_DESIGN_OPS})`);

  const byName = new Map(existing.map((f) => [f.name, f]));
  const out: DesignOp[] = [];
  let added = 0;
  const touched = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') throw new DesignError('Invalid change');
    const o = item as Record<string, unknown>;

    if (o.op === 'add') {
      if (++added > MAX_ADDED_BOXES) throw new DesignError(`Too many new boxes (max ${MAX_ADDED_BOXES})`);
      if (typeof o.type !== 'string' || !(DESIGN_BOX_TYPES as readonly string[]).includes(o.type)) {
        throw new DesignError('Unknown box type');
      }
      const type = o.type as DesignBoxType;
      const { pageIndex, x, y, width, height } = o;
      if (!Number.isInteger(pageIndex) || (pageIndex as number) < 0 || (pageIndex as number) >= pages.length) {
        throw new DesignError('Box is on a page that does not exist');
      }
      if (![x, y, width, height].every(isFiniteNum)) throw new DesignError('Box position is invalid');
      const page = pages[pageIndex as number]!;
      const [bx, by, bw, bh] = [x as number, y as number, width as number, height as number];
      if (bw < MIN_BOX_PT || bh < MIN_BOX_PT) throw new DesignError('A box is too small');
      const slack = 1;
      if (
        bx < page.x - slack ||
        by < page.y - slack ||
        bx + bw > page.x + page.width + slack ||
        by + bh > page.y + page.height + slack
      ) {
        throw new DesignError('A box is outside the page');
      }
      let color: FillColorKey | undefined;
      if (type === 'fill') {
        color = isFillColorKey(o.color) ? o.color : 'black';
      } else if (o.color !== undefined && o.color !== null) {
        throw new DesignError('Only tap-to-fill boxes have a color');
      }
      const r = (n: number) => Math.round(n * 100) / 100;
      out.push({
        op: 'add',
        type,
        pageIndex: pageIndex as number,
        x: r(bx),
        y: r(by),
        width: r(bw),
        height: r(bh),
        ...(cleanLabel(o.label) ? { label: cleanLabel(o.label) } : {}),
        ...(o.required === true ? { required: true } : {}),
        ...(color ? { color } : {}),
      });
      continue;
    }

    if (o.op === 'delete' || o.op === 'retype') {
      if (typeof o.name !== 'string' || !byName.has(o.name)) throw new DesignError('That field no longer exists');
      if (touched.has(o.name)) throw new DesignError('A field was changed twice');
      touched.add(o.name);
      if (o.op === 'delete') {
        out.push({ op: 'delete', name: o.name });
      } else {
        const to = o.to;
        if (to !== 'text' && to !== 'signature' && to !== 'initials') throw new DesignError('Unknown field role');
        const t = byName.get(o.name)!.type;
        if (t !== 'text' && t !== 'signature' && t !== 'unknown') {
          throw new DesignError('Only text and signature fields can change role');
        }
        out.push({ op: 'retype', name: o.name, to });
      }
      continue;
    }

    throw new DesignError('Unknown change');
  }
  return out;
}

// ── Suggestions ─────────────────────────────────────────────────────────────

const DATE_HINT = /\bdate\b|\bdated\b|^dt[_\s-]|[_\s-]dt$/i;
const NOT_TODAY = /birth|dob|hire|start|end|effective|expir|issue|admit|discharge|due|service/i;

/** Heuristic: a text field that reads like "Date" / "Today's date" → suggest auto date. */
export function looksLikeTodayDateField(name: string, tooltip?: string): boolean {
  const hay = `${name} ${tooltip ?? ''}`.replace(/([a-z])([A-Z])/g, '$1 $2');
  return DATE_HINT.test(hay) && !NOT_TODAY.test(hay);
}

export const looksLikeSignerNameField = (name: string, tooltip?: string): boolean => {
  const hay = `${name} ${tooltip ?? ''}`.replace(/([a-z])([A-Z])/g, '$1 $2');
  return /(print(ed)?\s*name|patient\s*name|employee\s*name|full\s*name|^name$)/i.test(hay.trim());
};
