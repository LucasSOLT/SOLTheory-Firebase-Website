'use client';

// ============================================================================
// PdfFieldDesigner — Signature Suite, Phase G (G1 review + G2 manual + G5 touch)
//
// A full-screen visual editor for a blueprint's PDF. The admin sees the real
// document and can:
//   • review every auto-detected field drawn on the page, change its role
//     (Text / Signature / Initials / Auto date / Auto name / Auto email) or delete it
//   • place new boxes — drop one in view, or switch to Draw and drag a rectangle
//     (or just tap to drop a default-size box) — of type Text, Tap-to-fill (5 preset
//     colors), Signature, Initials or Date (auto)
//   • move / resize boxes with finger-sized corner handles (pinch to zoom for
//     precision) — coordinates are computed for the admin, never typed
// Saving sends small "design operations" to the server, which writes a NEW PDF
// copy with real AcroForm fields as a NEW Document Library template. The
// original PDF is never modified.
// ============================================================================

import React from 'react';
import {
  AlertCircle,
  ListChecks,
  Loader2,
  MousePointer2,
  PenLine,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import BodyPortal from '@/components/onboarding/BodyPortal';
import { PdfCanvasViewer, useCoarsePointer } from '@/components/onboarding/pdf';
import type { PageViewportMetrics } from '@/components/onboarding/pdf';
import { Z_FULLSCREEN_VIEWER } from '@/components/onboarding/pdf/viewerContext';
import { getAuthHeaders } from '@/lib/api-auth-client';
import type { PdfFormContent, PdfFormField } from '@/types/onboarding-templates';
import {
  DEFAULT_BOX_SIZE,
  DESIGN_BOX_LABELS,
  DESIGN_BOX_TYPES,
  FILL_COLORS,
  fillColorSpec,
  looksLikeSignerNameField,
  looksLikeTodayDateField,
  type DesignBoxType,
  type DesignOp,
  type FillColorKey,
} from '@/lib/field-design';
import { stampKindOfFieldName } from '@/lib/initials-fields';
import { sanitizeAutoFill, type AutoFillKind } from '@/lib/pdf-autofill';
import { templateToPdfContent, type LibraryTemplate } from '@/lib/document-library';

// ── Types ───────────────────────────────────────────────────────────────────

type FieldRole = 'text' | 'signature' | 'initials' | 'date' | 'name' | 'email';

const ROLE_LABELS: Record<FieldRole, string> = {
  text: 'Text',
  signature: 'Signature',
  initials: 'Initials',
  date: "Auto date",
  name: 'Auto name',
  email: 'Auto email',
};
const ROLE_AUTOFILL: Partial<Record<FieldRole, AutoFillKind>> = {
  date: 'today_date',
  name: 'signer_name',
  email: 'signer_email',
};
const AUTOFILL_ROLE: Record<AutoFillKind, FieldRole> = {
  today_date: 'date',
  signer_name: 'name',
  signer_email: 'email',
};
/** Role → what the PDF field itself must be (auto roles are plain text fields). */
const pdfRoleOf = (r: FieldRole): 'text' | 'signature' | 'initials' => (r === 'signature' || r === 'initials' ? r : 'text');

interface DraftBox {
  id: string;
  type: DesignBoxType;
  pageIndex: number;
  /** PDF user space (points, bottom-left origin). */
  x: number;
  y: number;
  width: number;
  height: number;
  color?: FillColorKey;
  label?: string;
  required?: boolean;
}

type Selection = { kind: 'box'; id: string } | { kind: 'field'; name: string } | null;

interface CssRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const TYPE_COLOR: Record<DesignBoxType, string> = {
  text: '#2563eb',
  fill: '#111111',
  signature: '#d97706',
  initials: '#ea580c',
  date: '#0d9488',
};
const ROLE_COLOR: Record<FieldRole, string> = {
  text: '#2563eb',
  signature: '#d97706',
  initials: '#ea580c',
  date: '#0d9488',
  name: '#0d9488',
  email: '#0d9488',
};
const MIN_CSS = 14;

// ── Geometry helpers ────────────────────────────────────────────────────────

function pdfRectToCss(m: PageViewportMetrics, x: number, y: number, w: number, h: number): CssRect {
  const [x1, y1, x2, y2] = m.viewport.convertToViewportRectangle([x, y, x + w, y + h]);
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

function cssRectToPdf(m: PageViewportMetrics, r: CssRect) {
  const [ax, ay] = m.viewport.convertToPdfPoint(r.left, r.top);
  const [bx, by] = m.viewport.convertToPdfPoint(r.left + r.width, r.top + r.height);
  return { x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay) };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

type HandleMode = 'move' | 'tl' | 'tr' | 'bl' | 'br';

function applyDrag(orig: CssRect, mode: HandleMode, dx: number, dy: number, W: number, H: number): CssRect {
  let { left, top, width, height } = orig;
  if (mode === 'move') {
    left = clamp(left + dx, 0, Math.max(0, W - width));
    top = clamp(top + dy, 0, Math.max(0, H - height));
    return { left, top, width, height };
  }
  const right = orig.left + orig.width;
  const bottom = orig.top + orig.height;
  if (mode === 'tl' || mode === 'bl') {
    left = clamp(orig.left + dx, 0, right - MIN_CSS);
    width = right - left;
  } else {
    width = clamp(orig.width + dx, MIN_CSS, W - orig.left);
  }
  if (mode === 'tl' || mode === 'tr') {
    top = clamp(orig.top + dy, 0, bottom - MIN_CSS);
    height = bottom - top;
  } else {
    height = clamp(orig.height + dy, MIN_CSS, H - orig.top);
  }
  return { left, top, width, height };
}

// ── Per-page overlay layer ──────────────────────────────────────────────────

interface LayerProps {
  metrics: PageViewportMetrics;
  boxes: DraftBox[];
  fields: PdfFormField[];
  roles: Record<string, FieldRole>;
  deleted: ReadonlySet<string>;
  selected: Selection;
  mode: 'select' | 'draw';
  isTouch: boolean;
  onSelect: (s: Selection) => void;
  onCommitBox: (id: string, rect: { x: number; y: number; width: number; height: number }) => void;
  onCreate: (pageIndex: number, rect: { x: number; y: number; width: number; height: number } | { tap: { left: number; top: number } }, m: PageViewportMetrics) => void;
  onMetrics: (m: PageViewportMetrics) => void;
}

interface DragState {
  id: string;
  mode: HandleMode;
  sx: number;
  sy: number;
  orig: CssRect;
  cur: CssRect;
}

function DesignerPageLayer(props: LayerProps) {
  const { metrics: m, boxes, fields, roles, deleted, selected, mode, isTouch, onSelect, onCommitBox, onCreate, onMetrics } = props;
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const [rubber, setRubber] = React.useState<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const layerRef = React.useRef<HTMLDivElement>(null);
  const HANDLE = isTouch ? 30 : 14;

  onMetrics(m);

  const localPoint = (e: React.PointerEvent) => {
    const r = layerRef.current?.getBoundingClientRect();
    // The viewer may CSS-scale the page during a pinch; normalise back to unscaled px.
    const k = r && r.width > 0 ? m.width / r.width : 1;
    return { x: r ? (e.clientX - r.left) * k : 0, y: r ? (e.clientY - r.top) * k : 0, k };
  };

  const beginDrag = (e: React.PointerEvent, id: string, handle: HandleMode, orig: CssRect) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = localPoint(e);
    setDrag({ id, mode: handle, sx: p.x, sy: p.y, orig, cur: orig });
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = localPoint(e);
    setDrag({ ...drag, cur: applyDrag(drag.orig, drag.mode, p.x - drag.sx, p.y - drag.sy, m.width, m.height) });
  };
  const endDrag = () => {
    if (!drag) return;
    const moved = Math.abs(drag.cur.left - drag.orig.left) + Math.abs(drag.cur.top - drag.orig.top) +
      Math.abs(drag.cur.width - drag.orig.width) + Math.abs(drag.cur.height - drag.orig.height);
    if (moved > 0.5) onCommitBox(drag.id, cssRectToPdf(m, drag.cur));
    setDrag(null);
  };

  return (
    <div ref={layerRef} className="absolute inset-0" data-designer-layer={m.pageIndex}>
      {/* Existing (detected) fields */}
      {fields.flatMap((f) => {
        const role = roles[f.name];
        const isDeleted = deleted.has(f.name);
        const color = isDeleted ? '#dc2626' : role ? ROLE_COLOR[role] : '#6b7280';
        const isSel = selected?.kind === 'field' && selected.name === f.name;
        return (f.widgets || [])
          .filter((w) => w.pageIndex === m.pageIndex && !w.hidden)
          .map((w, i) => {
            const r = pdfRectToCss(m, w.x, w.y, w.width, w.height);
            return (
              <button
                key={`${f.name}:${i}`}
                type="button"
                onClick={() => onSelect({ kind: 'field', name: f.name })}
                aria-label={`${f.name}${role ? ` (${ROLE_LABELS[role]})` : ''}`}
                title={f.name}
                style={{
                  position: 'absolute',
                  left: r.left,
                  top: r.top,
                  width: r.width,
                  height: r.height,
                  borderColor: color,
                  background: isSel ? `${color}40` : `${color}1f`,
                  opacity: isDeleted ? 0.55 : 1,
                  pointerEvents: mode === 'draw' ? 'none' : 'auto',
                  touchAction: 'pan-x pan-y',
                }}
                className={`border-2 ${isSel ? 'border-solid ring-2 ring-offset-1' : 'border-dashed'} rounded-[3px] overflow-hidden`}
              >
                {(isSel || r.height >= 18) && (
                  <span
                    className="absolute left-0 top-0 px-1 text-[10px] leading-[14px] font-bold text-white whitespace-nowrap max-w-full overflow-hidden text-ellipsis"
                    style={{ background: color }}
                  >
                    {isDeleted ? 'Deleted' : role ? ROLE_LABELS[role] : f.type}
                  </span>
                )}
              </button>
            );
          });
      })}

      {/* New boxes */}
      {boxes.map((b) => {
        const base = pdfRectToCss(m, b.x, b.y, b.width, b.height);
        const dragging = drag?.id === b.id;
        const r = dragging ? drag!.cur : base;
        const isSel = selected?.kind === 'box' && selected.id === b.id;
        const color = b.type === 'fill' ? fillColorSpec(b.color ?? 'black').hex : TYPE_COLOR[b.type];
        return (
          <div
            key={b.id}
            data-designer-box={b.id}
            onPointerDown={(e) => {
              if (mode === 'draw') return;
              e.stopPropagation();
              const touch = e.pointerType === 'touch';
              const wasSelected = isSel;
              onSelect({ kind: 'box', id: b.id });
              // Phones: first tap only selects (so the page can still be scrolled); a selected box drags.
              if (touch && !wasSelected) return;
              beginDrag(e, b.id, 'move', base);
            }}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={() => setDrag(null)}
            style={{
              position: 'absolute',
              left: r.left,
              top: r.top,
              width: r.width,
              height: r.height,
              borderColor: color,
              background: b.type === 'fill' ? `${color}${isSel ? '99' : '55'}` : `${color}${isSel ? '33' : '1f'}`,
              touchAction: isSel ? 'none' : 'pan-x pan-y',
              pointerEvents: mode === 'draw' ? 'none' : 'auto',
              zIndex: isSel ? 5 : 2,
              cursor: isSel ? 'move' : 'pointer',
            }}
            className={`border-2 rounded-[3px] ${isSel ? 'border-solid shadow-md' : 'border-dashed'}`}
          >
            {(isSel || r.height >= 18) && (
              <span
                className="absolute left-0 top-0 px-1 text-[10px] leading-[14px] font-bold text-white whitespace-nowrap max-w-full overflow-hidden text-ellipsis pointer-events-none"
                style={{ background: color }}
              >
                {b.type === 'fill' ? `Fill · ${fillColorSpec(b.color ?? 'black').label}` : DESIGN_BOX_LABELS[b.type]}
              </span>
            )}
            {isSel &&
              (['tl', 'tr', 'bl', 'br'] as const).map((h) => (
                <div
                  key={h}
                  onPointerDown={(e) => beginDrag(e, b.id, h, base)}
                  style={{
                    position: 'absolute',
                    width: HANDLE,
                    height: HANDLE,
                    left: h === 'tl' || h === 'bl' ? -HANDLE / 2 : undefined,
                    right: h === 'tr' || h === 'br' ? -HANDLE / 2 : undefined,
                    top: h === 'tl' || h === 'tr' ? -HANDLE / 2 : undefined,
                    bottom: h === 'bl' || h === 'br' ? -HANDLE / 2 : undefined,
                    touchAction: 'none',
                    cursor: h === 'tl' || h === 'br' ? 'nwse-resize' : 'nesw-resize',
                  }}
                  className="flex items-center justify-center"
                >
                  <span className="block rounded-full bg-white border-2" style={{ width: HANDLE * 0.55, height: HANDLE * 0.55, borderColor: color }} />
                </div>
              ))}
          </div>
        );
      })}

      {/* Draw mode: drag a rectangle (or tap to drop a default-size box) */}
      {mode === 'draw' && (
        <div
          className="absolute inset-0 z-20"
          style={{ touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            const p = localPoint(e);
            setRubber({ sx: p.x, sy: p.y, cx: p.x, cy: p.y });
          }}
          onPointerMove={(e) => {
            if (!rubber) return;
            const p = localPoint(e);
            setRubber({ ...rubber, cx: clamp(p.x, 0, m.width), cy: clamp(p.y, 0, m.height) });
          }}
          onPointerUp={() => {
            if (!rubber) return;
            const rect: CssRect = {
              left: Math.min(rubber.sx, rubber.cx),
              top: Math.min(rubber.sy, rubber.cy),
              width: Math.abs(rubber.cx - rubber.sx),
              height: Math.abs(rubber.cy - rubber.sy),
            };
            setRubber(null);
            if (rect.width >= 10 && rect.height >= 8) onCreate(m.pageIndex, cssRectToPdf(m, rect), m);
            else onCreate(m.pageIndex, { tap: { left: rubber.sx, top: rubber.sy } }, m);
          }}
          onPointerCancel={() => setRubber(null)}
        >
          {rubber && (
            <div
              className="absolute border-2 border-dashed border-indigo-600 bg-indigo-500/20"
              style={{
                left: Math.min(rubber.sx, rubber.cx),
                top: Math.min(rubber.sy, rubber.cy),
                width: Math.abs(rubber.cx - rubber.sx),
                height: Math.abs(rubber.cy - rubber.sy),
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export interface PdfFieldDesignerProps {
  orgId: string;
  content: PdfFormContent;
  onChange: (c: PdfFormContent) => void;
  onClose: () => void;
  isDarkMode?: boolean;
}

const newId = () => `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

function baseRoleOf(f: PdfFormField, autoFill: PdfFormContent['autoFill']): FieldRole | null {
  if (f.type === 'signature') return stampKindOfFieldName(f.name) === 'initials' ? 'initials' : 'signature';
  if (f.type === 'text') {
    const kind = autoFill?.[f.name];
    return kind ? AUTOFILL_ROLE[kind] : 'text';
  }
  return null; // checkbox / dropdown / radio: delete-only
}

export default function PdfFieldDesigner({ orgId, content, onChange, onClose, isDarkMode = false }: PdfFieldDesignerProps) {
  const isTouch = useCoarsePointer();
  const [bytes, setBytes] = React.useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<PdfFormField[]>([]);
  const [roles, setRoles] = React.useState<Record<string, FieldRole>>({});
  const [deleted, setDeleted] = React.useState<Set<string>>(new Set());
  const [boxes, setBoxes] = React.useState<DraftBox[]>([]);
  const [selected, setSelected] = React.useState<Selection>(null);
  const [newType, setNewType] = React.useState<DesignBoxType>('text');
  const [fillColor, setFillColor] = React.useState<FillColorKey>('black');
  const [mode, setMode] = React.useState<'select' | 'draw'>('select');
  const [showList, setShowList] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const metricsRef = React.useRef<Record<number, PageViewportMetrics>>({});
  const areaRef = React.useRef<HTMLDivElement>(null);
  const [areaHeight, setAreaHeight] = React.useState(420);
  const closedRef = React.useRef(false);
  const pushedRef = React.useRef(false);

  const path = content.pdfStoragePath || '';

  // ── Load the PDF bytes + fresh field detection ──
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const [pdfRes, detRes] = await Promise.all([
          fetch(`/api/onboarding/pdf-form/design?orgId=${encodeURIComponent(orgId)}&path=${encodeURIComponent(path)}`, { headers }),
          fetch('/api/onboarding/pdf-form/detect-fields', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ storagePath: path, orgId }),
          }),
        ]);
        if (!pdfRes.ok) throw new Error((await pdfRes.json().catch(() => ({}))).error || 'Could not load the document');
        const det = await detRes.json().catch(() => ({}));
        if (!detRes.ok) throw new Error(det.error || 'Could not read the fields');
        const buf = new Uint8Array(await pdfRes.arrayBuffer());
        if (cancelled) return;
        const list: PdfFormField[] = (det.fields || []).filter(
          (f: PdfFormField) => !f.readOnly && f.type !== 'unknown' && (f.widgets || []).some((w) => !w.hidden && w.pageIndex >= 0),
        );
        const initial: Record<string, FieldRole> = {};
        for (const f of list) {
          const r = baseRoleOf(f, content.autoFill);
          if (r) initial[f.name] = r;
        }
        setFields(list);
        setRoles(initial);
        setBytes(buf);
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || 'Could not load the document');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, path]);

  // The document area fills whatever space is left between the toolbar and the selection bar.
  React.useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAreaHeight(Math.max(200, el.clientHeight)));
    ro.observe(el);
    setAreaHeight(Math.max(200, el.clientHeight));
    return () => ro.disconnect();
  }, []);

  // ── Dirty tracking ──
  const baseRoles = React.useMemo(() => {
    const out: Record<string, FieldRole> = {};
    for (const f of fields) {
      const r = baseRoleOf(f, content.autoFill);
      if (r) out[f.name] = r;
    }
    return out;
  }, [fields, content.autoFill]);
  const changedRoles = Object.keys(roles).filter((n) => roles[n] !== baseRoles[n] && !deleted.has(n));
  const dirty = boxes.length > 0 || deleted.size > 0 || changedRoles.length > 0;

  // ── Closing (confirm if dirty; phone back gesture closes too) ──
  const dirtyRef = React.useRef(dirty);
  dirtyRef.current = dirty;
  const finishClose = React.useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }, [onClose]);
  const requestClose = React.useCallback(() => {
    if (dirtyRef.current && !window.confirm('Discard your unsaved field changes?')) return;
    if (pushedRef.current) {
      pushedRef.current = false;
      try {
        window.history.back(); // popstate → finishClose
        return;
      } catch {
        /* fall through */
      }
    }
    finishClose();
  }, [finishClose]);

  React.useEffect(() => {
    try {
      window.history.pushState({ pdfDesigner: true }, '');
      pushedRef.current = true;
    } catch {
      pushedRef.current = false;
    }
    const onPop = () => {
      pushedRef.current = false;
      if (dirtyRef.current && !window.confirm('Discard your unsaved field changes?')) {
        try {
          window.history.pushState({ pdfDesigner: true }, '');
          pushedRef.current = true;
        } catch {
          /* ignore */
        }
        return;
      }
      finishClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[data-pdf-modal]')) return;
      e.stopPropagation();
      requestClose();
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
  }, [finishClose, requestClose]);

  // ── Box actions ──
  const addBox = (pageIndex: number, rect: { x: number; y: number; width: number; height: number }, type = newType) => {
    const box: DraftBox = { id: newId(), type, pageIndex, ...rect, ...(type === 'fill' ? { color: fillColor } : {}) };
    setBoxes((prev) => [...prev, box]);
    setSelected({ kind: 'box', id: box.id });
    setMode('select');
  };

  /** Default-size box centred on a CSS point of a page (clamped inside the page). */
  const addBoxAt = (m: PageViewportMetrics, cx: number, cy: number) => {
    const size = DEFAULT_BOX_SIZE[newType];
    const w = size.width * m.scale;
    const h = size.height * m.scale;
    const left = clamp(cx - w / 2, 0, Math.max(0, m.width - w));
    const top = clamp(cy - h / 2, 0, Math.max(0, m.height - h));
    addBox(m.pageIndex, cssRectToPdf(m, { left, top, width: w, height: h }));
  };

  /** "Add box": drop one in the middle of whatever part of the document is on screen. */
  const placeBoxInView = () => {
    const root = document.querySelector('[data-designer-root]');
    const pages = Array.from(root?.querySelectorAll<HTMLElement>('[data-pdf-page]') ?? []);
    let best: { el: HTMLElement; visTop: number; visBottom: number; area: number } | null = null;
    for (const el of pages) {
      const r = el.getBoundingClientRect();
      const visTop = Math.max(r.top, 0);
      const visBottom = Math.min(r.bottom, window.innerHeight - 160);
      const area = Math.max(0, visBottom - visTop);
      if (area > 0 && (!best || area > best.area)) best = { el, visTop, visBottom, area };
    }
    const target = best ?? (pages[0] ? { el: pages[0], visTop: 0, visBottom: 0, area: 0 } : null);
    if (!target) return;
    const pageIndex = Number(target.el.getAttribute('data-pdf-page') || 0);
    const m = metricsRef.current[pageIndex];
    if (!m) return;
    const r = target.el.getBoundingClientRect();
    const k = r.width > 0 ? m.width / r.width : 1;
    const cy = best ? ((best.visTop + best.visBottom) / 2 - r.top) * k : m.height / 2;
    addBoxAt(m, m.width / 2, cy);
  };

  const updateBox = (id: string, patch: Partial<DraftBox>) =>
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const removeBox = (id: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    setSelected(null);
  };

  // ── Suggestions (G1) ──
  const suggestions = React.useMemo(() => {
    const out: { name: string; role: FieldRole }[] = [];
    for (const f of fields) {
      if (f.type !== 'text' || deleted.has(f.name) || roles[f.name] !== 'text') continue;
      if (looksLikeTodayDateField(f.name, f.tooltip)) out.push({ name: f.name, role: 'date' });
      else if (looksLikeSignerNameField(f.name, f.tooltip)) out.push({ name: f.name, role: 'name' });
    }
    return out;
  }, [fields, roles, deleted]);

  const applySuggestions = () =>
    setRoles((prev) => {
      const next = { ...prev };
      for (const s of suggestions) next[s.name] = s.role;
      return next;
    });

  // ── Save ──
  const save = async () => {
    setError(null);
    // Build ops + the field-name-keyed auto-fill from the roles.
    const ops: DesignOp[] = [];
    const roleAutoFill: Record<string, AutoFillKind> = {};
    for (const f of fields) {
      if (deleted.has(f.name)) {
        ops.push({ op: 'delete', name: f.name });
        continue;
      }
      const role = roles[f.name];
      if (!role) continue;
      const base = baseRoleOf(f, content.autoFill);
      const baseDoc = base ? pdfRoleOf(base) : null;
      if (baseDoc && pdfRoleOf(role) !== baseDoc) ops.push({ op: 'retype', name: f.name, to: pdfRoleOf(role) });
      const kind = ROLE_AUTOFILL[role];
      if (kind) roleAutoFill[f.name] = kind;
    }
    for (const b of boxes) {
      ops.push({
        op: 'add',
        type: b.type,
        pageIndex: b.pageIndex,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        ...(b.label ? { label: b.label } : {}),
        ...(b.required ? { required: true } : {}),
        ...(b.type === 'fill' ? { color: b.color ?? 'black' } : {}),
      });
    }
    // Auto-fill entries for fields the designer never listed (e.g. read-only ones) are kept as-is.
    const listed = new Set(fields.map((f) => f.name));
    const carried: Record<string, AutoFillKind> = {};
    for (const [k, v] of Object.entries(content.autoFill || {})) if (!listed.has(k)) carried[k] = v;

    const hasPdfChanges = ops.length > 0;

    setSaving(true);
    try {
      if (!hasPdfChanges) {
        const merged = { ...carried, ...roleAutoFill };
        const next: PdfFormContent = { ...content };
        if (Object.keys(merged).length) next.autoFill = merged;
        else delete next.autoFill;
        onChange(next);
        closedRef.current = true;
        onClose();
        return;
      }

      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/pdf-form/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          orgId,
          storagePath: path,
          ops,
          name: content.pdfTitle || undefined,
          documentCategory: content.documentCategory,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save the design');

      const t: LibraryTemplate = data.template;
      const nameMap: Record<string, string> = data.nameMap || {};
      const mapName = (n: string) => nameMap[n] ?? n;
      const exists = new Set((t.detectedFields || []).map((f) => f.name));

      const next: PdfFormContent = { ...content, ...templateToPdfContent(t) } as PdfFormContent;
      delete next.pdfDownloadUrl;
      if (content.pdfTitle) next.pdfTitle = content.pdfTitle;
      if (content.documentCategory) next.documentCategory = content.documentCategory;

      const mergedRaw: Record<string, AutoFillKind> = {};
      for (const [k, v] of Object.entries({ ...carried, ...roleAutoFill })) mergedRaw[mapName(k)] = v;
      Object.assign(mergedRaw, data.autoFill || {});
      const cleaned = sanitizeAutoFill(mergedRaw, t.detectedFields || []);
      if (cleaned) next.autoFill = cleaned;
      else delete next.autoFill;

      if (content.signingWorkflow) {
        next.signingWorkflow = {
          ...content.signingWorkflow,
          signers: content.signingWorkflow.signers.map((s) => ({
            ...s,
            fieldNames: (s.fieldNames || []).filter((n) => !deleted.has(n)).map(mapName).filter((n) => exists.has(n)),
          })),
        };
      }

      onChange(next);
      closedRef.current = true;
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not save the design');
    } finally {
      setSaving(false);
    }
  };

  // ── Selection helpers ──
  const selBox = selected?.kind === 'box' ? boxes.find((b) => b.id === selected.id) ?? null : null;
  const selField = selected?.kind === 'field' ? fields.find((f) => f.name === selected.name) ?? null : null;

  const jumpToPage = (pageIndex: number) => {
    document
      .querySelector(`[data-designer-root] [data-pdf-page="${pageIndex}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const listRows = React.useMemo(() => {
    type Row = { key: string; label: string; sub: string; pageIndex: number; y: number; sel: Selection; deleted?: boolean };
    const rows: Row[] = [];
    for (const f of fields) {
      const w = (f.widgets || []).find((x) => !x.hidden && x.pageIndex >= 0)!;
      const role = roles[f.name];
      rows.push({
        key: `f:${f.name}`,
        label: f.tooltip || f.name,
        sub: deleted.has(f.name) ? 'Deleted' : role ? ROLE_LABELS[role] : f.type,
        pageIndex: w.pageIndex,
        y: -w.y,
        sel: { kind: 'field', name: f.name },
        deleted: deleted.has(f.name),
      });
    }
    for (const b of boxes) {
      rows.push({
        key: `b:${b.id}`,
        label: b.label || `New ${DESIGN_BOX_LABELS[b.type]} box`,
        sub: 'New',
        pageIndex: b.pageIndex,
        y: -b.y,
        sel: { kind: 'box', id: b.id },
      });
    }
    return rows.sort((a, b) => a.pageIndex - b.pageIndex || a.y - b.y);
  }, [fields, boxes, roles, deleted]);

  const chip = (active: boolean) =>
    `shrink-0 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
      active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 active:bg-slate-100'
    }`;

  return (
    <BodyPortal>
      <div
        data-designer-root
        data-pdf-designer
        className="fixed inset-0 flex flex-col bg-slate-100 text-slate-900"
        style={{
          zIndex: Z_FULLSCREEN_VIEWER,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-2 py-2 bg-white border-b border-slate-200 shrink-0">
          <button type="button" onClick={requestClose} aria-label="Close designer" className="p-2 rounded-lg active:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold truncate">Design fields</div>
            <div className="text-[11px] text-slate-500 truncate">
              {boxes.length} new · {deleted.size} deleted · {changedRoles.length} changed
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowList((v) => !v)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold border ${showList ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-300'}`}
          >
            <ListChecks className="w-4 h-4" /> Fields ({fields.length + boxes.length})
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !bytes}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>

        {/* Toolbar: what to add */}
        <div className="bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 px-2 py-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'draw' ? 'select' : 'draw'))}
              className={`${chip(mode === 'draw')} flex items-center gap-1`}
              aria-pressed={mode === 'draw'}
            >
              {mode === 'draw' ? <MousePointer2 className="w-3.5 h-3.5" /> : <PenLine className="w-3.5 h-3.5" />}
              {mode === 'draw' ? 'Drawing… (tap to stop)' : 'Draw a box'}
            </button>
            <button type="button" onClick={placeBoxInView} className={`${chip(false)} flex items-center gap-1`}>
              <Plus className="w-3.5 h-3.5" /> Add box
            </button>
            <span className="w-px h-6 bg-slate-300 shrink-0" />
            {DESIGN_BOX_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setNewType(t)} className={chip(newType === t)} aria-pressed={newType === t}>
                {DESIGN_BOX_LABELS[t]}
              </button>
            ))}
          </div>
          {newType === 'fill' && (
            <div className="flex items-center gap-2 px-2 pb-2 overflow-x-auto">
              <span className="text-[11px] font-semibold text-slate-500 shrink-0">Fill color:</span>
              {FILL_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFillColor(c.key)}
                  aria-label={c.label}
                  aria-pressed={fillColor === c.key}
                  className={`shrink-0 w-9 h-9 rounded-full border-2 ${fillColor === c.key ? 'ring-2 ring-indigo-600 ring-offset-1' : ''}`}
                  style={{ background: c.hex, opacity: c.opacity < 1 ? 0.7 : 1, borderColor: '#fff' }}
                />
              ))}
              <span className="text-[11px] text-slate-500 shrink-0">{fillColorSpec(fillColor).label}</span>
            </div>
          )}
          <p className="px-3 pb-2 text-[11px] text-slate-500">
            {mode === 'draw'
              ? 'Drag on the document to draw a box — or just tap to drop one. Pinch to zoom for precision.'
              : 'Tap a box to select it. Selected boxes can be dragged; use the corner dots to resize. Pinch to zoom.'}
          </p>
        </div>

        {/* Suggestions banner */}
        {suggestions.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 shrink-0">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="flex-1">
              {suggestions.length} field{suggestions.length === 1 ? '' : 's'} look like a date or the signer&apos;s name.
            </span>
            <button type="button" onClick={applySuggestions} className="px-2.5 py-1.5 rounded-md bg-amber-600 text-white font-bold">
              Apply suggestions
            </button>
          </div>
        )}

        {/* Document */}
        <div ref={areaRef} className="flex-1 min-h-0 relative overflow-hidden">
          {loadError && (
            <div className="m-4 p-3 rounded-lg bg-rose-50 text-rose-800 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {loadError}
            </div>
          )}
          {!bytes && !loadError && (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading document…
            </div>
          )}
          {bytes && (
            <PdfCanvasViewer
              pdfBytes={bytes}
              mode="continuous"
              hideFormWidgets
              showDownload={false}
              isDarkMode={isDarkMode}
              maxHeight={`${Math.max(160, areaHeight - 48)}px`}
              renderPageOverlay={(m) => (
                <DesignerPageLayer
                  metrics={m}
                  boxes={boxes.filter((b) => b.pageIndex === m.pageIndex)}
                  fields={fields}
                  roles={roles}
                  deleted={deleted}
                  selected={selected}
                  mode={mode}
                  isTouch={isTouch}
                  onSelect={setSelected}
                  onMetrics={(mm) => {
                    metricsRef.current[mm.pageIndex] = mm;
                  }}
                  onCommitBox={(id, rect) => updateBox(id, rect)}
                  onCreate={(pageIndex, r, mm) => {
                    if ('tap' in r) addBoxAt(mm, r.tap.left, r.tap.top);
                    else addBox(pageIndex, r);
                  }}
                />
              )}
            />
          )}

          {/* Field list sheet */}
          {showList && (
            <div className="absolute inset-x-0 bottom-0 max-h-[60%] overflow-y-auto bg-white border-t-2 border-indigo-600 shadow-2xl z-30">
              <div className="sticky top-0 flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
                <span className="text-xs font-extrabold">All fields</span>
                <button type="button" onClick={() => setShowList(false)} className="p-1.5 rounded-lg active:bg-slate-100" aria-label="Close list">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {listRows.length === 0 && (
                <p className="p-4 text-xs text-slate-500">
                  No fields yet. This looks like a flat or scanned PDF — use “Add box” or “Draw a box” to place fields.
                </p>
              )}
              {listRows.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => {
                    setSelected(row.sel);
                    setShowList(false);
                    jumpToPage(row.pageIndex);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-3 text-left border-b border-slate-100 active:bg-slate-50"
                >
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 shrink-0">p{row.pageIndex + 1}</span>
                  <span className={`flex-1 min-w-0 truncate text-xs font-semibold ${row.deleted ? 'line-through text-slate-400' : ''}`}>{row.label}</span>
                  <span className="text-[11px] text-slate-500 shrink-0">{row.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selection bar */}
        <div className="bg-white border-t border-slate-200 shrink-0 px-2 py-2 min-h-[56px]">
          {error && (
            <div className="mb-2 p-2 rounded-lg bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {!selBox && !selField && (
            <p className="text-xs text-slate-500 px-1 py-2">
              Nothing selected. Tap any box on the document to edit it, or add a new one above.
            </p>
          )}

          {selBox && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-bold text-slate-500 shrink-0">Box type</span>
                {DESIGN_BOX_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={chip(selBox.type === t)}
                    onClick={() => updateBox(selBox.id, { type: t, ...(t === 'fill' ? { color: selBox.color ?? fillColor } : { color: undefined }) })}
                  >
                    {DESIGN_BOX_LABELS[t]}
                  </button>
                ))}
              </div>
              {selBox.type === 'fill' && (
                <div className="flex items-center gap-2 overflow-x-auto">
                  <span className="text-[11px] font-bold text-slate-500 shrink-0">Color</span>
                  {FILL_COLORS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      aria-label={c.label}
                      onClick={() => updateBox(selBox.id, { color: c.key })}
                      className={`shrink-0 w-9 h-9 rounded-full border-2 ${selBox.color === c.key ? 'ring-2 ring-indigo-600 ring-offset-1' : ''}`}
                      style={{ background: c.hex, opacity: c.opacity < 1 ? 0.7 : 1, borderColor: '#fff' }}
                    />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={selBox.label || ''}
                  maxLength={80}
                  onChange={(e) => updateBox(selBox.id, { label: e.target.value })}
                  placeholder="Label (optional) e.g. Patient name"
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-base"
                />
                <label className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
                  <input type="checkbox" checked={!!selBox.required} onChange={(e) => updateBox(selBox.id, { required: e.target.checked })} className="w-4 h-4" />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() => removeBox(selBox.id)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 shrink-0"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          )}

          {selField && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 text-xs">
                  <div className="font-bold truncate">{selField.tooltip || selField.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    Detected {selField.type} field on page {(selField.pageIndex ?? 0) + 1}
                  </div>
                </div>
                {deleted.has(selField.name) ? (
                  <button
                    type="button"
                    onClick={() =>
                      setDeleted((prev) => {
                        const n = new Set(prev);
                        n.delete(selField.name);
                        return n;
                      })
                    }
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold border border-slate-300 shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" /> Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleted((prev) => new Set(prev).add(selField.name))}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
              </div>
              {roles[selField.name] && !deleted.has(selField.name) && (
                <div className="flex items-center gap-2 overflow-x-auto">
                  <span className="text-[11px] font-bold text-slate-500 shrink-0">This is a</span>
                  {(Object.keys(ROLE_LABELS) as FieldRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={chip(roles[selField.name] === r)}
                      onClick={() => setRoles((prev) => ({ ...prev, [selField.name]: r }))}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              )}
              {!roles[selField.name] && (
                <p className="text-[11px] text-slate-500">
                  {selField.type[0]!.toUpperCase() + selField.type.slice(1)} fields can be deleted but not retyped. To move one, delete it and add a new box.
                </p>
              )}
              <p className="text-[11px] text-slate-500">
                Detected fields keep their position. To move one, delete it and draw a new box.
              </p>
            </div>
          )}
        </div>
      </div>
    </BodyPortal>
  );
}
