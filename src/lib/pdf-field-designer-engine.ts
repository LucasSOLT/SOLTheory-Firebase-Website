// ============================================================================
// lib/pdf-field-designer-engine.ts — Signature Suite, Phase G4 (SERVER ONLY)
//
// Bakes a validated list of design operations into a NEW PDF copy with real
// AcroForm fields. The input bytes are never mutated (pdf-lib loads a copy).
// Signature / initials boxes become TEXT fields with role names so the
// existing detection rules treat them as stamp spots (see field-design.ts).
// ============================================================================

import { PDFDocument, PDFTextField, PDFCheckBox, PDFName, PDFHexString, rgb } from 'pdf-lib';
import type { PDFForm } from 'pdf-lib';
import {
  DesignError,
  validateDesignOps,
  type DesignOp,
  type DesignBoxType,
  type PageSize,
  type ExistingFieldInfo,
} from '@/lib/field-design';
import type { AutoFillKind } from '@/lib/pdf-autofill';

export interface AddedBox {
  name: string;
  type: DesignBoxType;
  pageIndex: number;
}

export interface DesignResult {
  pdfBytes: Uint8Array;
  /** old full field name → new full field name (retyped fields only). */
  nameMap: Record<string, string>;
  /** Fields that must be auto-filled (new Date boxes). */
  autoFill: Record<string, AutoFillKind>;
  added: AddedBox[];
  deleted: string[];
}

const ROLE_PREFIX: Record<DesignBoxType, string> = {
  text: 'Text',
  date: 'Date',
  signature: 'Signature',
  initials: 'Initials',
  fill: 'Fill',
};

function describeExisting(form: PDFForm): ExistingFieldInfo[] {
  return form.getFields().map((f) => ({
    name: f.getName(),
    type: f instanceof PDFTextField ? 'text' : f instanceof PDFCheckBox ? 'checkbox' : 'other',
  }));
}

function pageSizes(pdfDoc: PDFDocument): PageSize[] {
  return pdfDoc.getPages().map((p) => {
    const box = p.getMediaBox();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
}

/**
 * Validate + apply. `rawOps` is untrusted. Throws DesignError for anything the
 * validator rejects (the route turns that into a 400).
 */
export async function applyFieldDesign(
  pdfBytes: Uint8Array | ArrayBuffer,
  rawOps: unknown,
): Promise<DesignResult> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const ops: DesignOp[] = validateDesignOps(rawOps, pageSizes(pdfDoc), describeExisting(form));

  // Every name (full or partial) in use, so new names never collide.
  const used = new Set<string>();
  for (const f of form.getFields()) {
    used.add(f.getName());
    used.add(f.acroField.getPartialName() ?? '');
  }
  const counters: Record<string, number> = {};
  const uniqueName = (prefix: string, suffixColor?: string): string => {
    for (;;) {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      const n = suffixColor ? `${prefix}_${suffixColor}_${counters[prefix]}` : `${prefix}_${counters[prefix]}`;
      if (!used.has(n)) {
        used.add(n);
        return n;
      }
    }
  };

  const nameMap: Record<string, string> = {};
  const autoFill: Record<string, AutoFillKind> = {};
  const added: AddedBox[] = [];
  const deleted: string[] = [];

  // 1) deletes
  for (const op of ops) {
    if (op.op !== 'delete') continue;
    const field = form.getFields().find((f) => f.getName() === op.name);
    if (!field) continue;
    form.removeField(field);
    deleted.push(op.name);
  }

  // 2) retypes (a rename — the role lives in the name)
  for (const op of ops) {
    if (op.op !== 'retype') continue;
    const field = form.getFields().find((f) => f.getName() === op.name);
    if (!field) continue;
    if (op.to === 'text' && !(field instanceof PDFTextField)) {
      throw new DesignError('That field is a true signature field and cannot become text');
    }
    const prefix = ROLE_PREFIX[op.to];
    const partial = uniqueName(prefix);
    field.acroField.setPartialName(partial);
    nameMap[op.name] = field.getName();
  }

  // 3) adds
  const pages = pdfDoc.getPages();
  for (const op of ops) {
    if (op.op !== 'add') continue;
    const page = pages[op.pageIndex]!;
    const rect = { x: op.x, y: op.y, width: op.width, height: op.height };

    if (op.type === 'fill') {
      const name = uniqueName('Fill', op.color ?? 'black');
      const cb = form.createCheckBox(name);
      cb.addToPage(page, { ...rect, borderWidth: 0 });
      if (op.label) cb.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(op.label));
      if (op.required) cb.enableRequired();
      added.push({ name, type: 'fill', pageIndex: op.pageIndex });
      continue;
    }

    const name = uniqueName(ROLE_PREFIX[op.type]);
    const tf = form.createTextField(name);
    tf.addToPage(page, { ...rect, borderWidth: 0, textColor: rgb(0, 0, 0) });
    if (op.type === 'text' || op.type === 'date') {
      tf.setFontSize(0);
      if (op.type === 'text' && op.height > 40) tf.enableMultiline();
    }
    if (op.label) tf.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(op.label));
    if (op.required) tf.enableRequired();
    if (op.type === 'date') autoFill[name] = 'today_date';
    added.push({ name, type: op.type, pageIndex: op.pageIndex });
  }

  return { pdfBytes: await pdfDoc.save(), nameMap, autoFill, added, deleted };
}
