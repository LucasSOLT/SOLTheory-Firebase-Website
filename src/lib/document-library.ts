// ============================================================================
// lib/document-library.ts — Phase 6, Step 6.3 (Org Document Library)
//
// Upload a PDF template ONCE, detect its fields ONCE, then reuse it in any
// number of blueprints.
//
// Design rules (enforced here / in document-library-server.ts):
//   • Templates are IMMUTABLE. "Updating" a template means uploading a new file,
//     which gets a new id + new Storage path. An existing Storage object is never
//     overwritten and never deleted (archiving only hides it), because in-flight
//     signing sessions reference `templatePath`.
//   • COPY-ON-USE: picking a template copies its path + detected fields into the
//     blueprint item (`templateToPdfContent`). Tasks/sessions that already exist
//     are never touched by later library changes.
//   • Server-only writes (Admin SDK). Clients read the list via the API route.
//   • Storage layout: `compliance_templates/{orgId}/{templateId}.pdf`.
//
// This file is PURE (no server imports) so client components can use it.
// ============================================================================

import type { PdfFormContent } from '@/types/onboarding-templates';
import { isAutoFillKind, type AutoFillKind } from '@/lib/pdf-autofill';

export const TEMPLATE_STORAGE_ROOT = 'compliance_templates';
export const TEMPLATE_COLLECTION = 'document_templates';
export const MAX_TEMPLATE_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_ACTIVE_TEMPLATES = 200;
export const MAX_TEMPLATE_NAME = 120;

export class LibraryError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** A library entry as stored in `orgs/{orgId}/document_templates/{id}` and returned by the API. */
export interface LibraryTemplate {
  id: string;
  name: string;
  pdfStoragePath: string;
  pageCount: number;
  pdfTitle: string;
  documentCategory: string;
  detectedFields: NonNullable<PdfFormContent['detectedFields']>;
  fillableFieldCount: number;
  fileSize: number;
  contentHash: string;
  originalFileName: string;
  createdBy: string;
  createdByEmail: string;
  createdAt: string; // ISO
  archived: boolean;
  archivedAt?: string | null;
  /** Phase G: auto-fill hints saved with a designed layout (e.g. new Date boxes). */
  autoFill?: Record<string, AutoFillKind>;
  /** Phase G: id of the template this one was designed from (the original is never modified). */
  designedFrom?: string;
}

/** Org ids are used as a path segment — never allow anything that could escape it. */
export function isSafeOrgId(orgId: unknown): orgId is string {
  return typeof orgId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(orgId);
}

export function templatePathFor(orgId: string, templateId: string): string {
  return `${TEMPLATE_STORAGE_ROOT}/${orgId}/${templateId}.pdf`;
}

/**
 * Which Storage paths may an admin of `orgId` read when detecting fields?
 *   • `compliance_templates/{orgId}/...`  — this org's own library
 *   • `compliance_templates/<file>`       — legacy shared base templates (one level, no org folder)
 * Everything else (other orgs' folders, vaults, traversal, absolute paths) is refused.
 */
export function isAllowedTemplatePath(orgId: string, path: unknown): path is string {
  if (typeof path !== 'string' || !isSafeOrgId(orgId)) return false;
  if (path.length > 500 || path.includes('..') || path.includes('\\') || path.startsWith('/') || path.includes('//')) {
    return false;
  }
  const parts = path.split('/');
  if (parts[0] !== TEMPLATE_STORAGE_ROOT || parts.some((p) => !p)) return false;
  if (parts.length === 2) return true; // legacy shared base template
  return parts[1] === orgId && parts.length >= 3;
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  // The spec allows "%PDF-" anywhere in the first 1024 bytes.
  let head = '';
  const n = Math.min(bytes.length, 1024);
  for (let i = 0; i < n; i++) head += String.fromCharCode(bytes[i]);
  return head.includes('%PDF-');
}

export function validatePdfUpload(bytes: Uint8Array): void {
  if (!bytes.length) throw new LibraryError('That file is empty.');
  if (bytes.length > MAX_TEMPLATE_BYTES) {
    throw new LibraryError(`That PDF is too large (max ${Math.round(MAX_TEMPLATE_BYTES / 1024 / 1024)}MB).`);
  }
  if (!isPdfBytes(bytes)) throw new LibraryError('Only PDF files can be added to the library.');
}

export function cleanTemplateName(raw: unknown, fallbackFileName = ''): string {
  const fromFile = fallbackFileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
  const name = (typeof raw === 'string' && raw.trim() ? raw : fromFile || 'Untitled document')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEMPLATE_NAME);
  return name || 'Untitled document';
}

/** The fields a blueprint item copies from a library template. Never shares array references. */
export function templateToPdfContent(
  t: Pick<LibraryTemplate, 'pdfStoragePath' | 'detectedFields' | 'pageCount' | 'pdfTitle' | 'documentCategory'> &
    Partial<Pick<LibraryTemplate, 'autoFill'>>,
): Partial<PdfFormContent> {
  return {
    pdfStoragePath: t.pdfStoragePath,
    detectedFields: (t.detectedFields || []).map((f) => ({ ...f })),
    pageCount: t.pageCount || 1,
    pdfTitle: t.pdfTitle || '',
    documentCategory: t.documentCategory || 'other',
    ...(t.autoFill && Object.keys(t.autoFill).length ? { autoFill: { ...t.autoFill } } : {}),
  };
}

export function toIso(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  return '';
}

export function fromDoc(id: string, d: Record<string, any>): LibraryTemplate {
  return {
    id,
    name: d.name || 'Untitled document',
    pdfStoragePath: d.pdfStoragePath || '',
    pageCount: d.pageCount || 1,
    pdfTitle: d.pdfTitle || '',
    documentCategory: d.documentCategory || 'other',
    detectedFields: Array.isArray(d.detectedFields) ? d.detectedFields : [],
    fillableFieldCount: d.fillableFieldCount || 0,
    fileSize: d.fileSize || 0,
    contentHash: d.contentHash || '',
    originalFileName: d.originalFileName || '',
    createdBy: d.createdBy || '',
    createdByEmail: d.createdByEmail || '',
    createdAt: toIso(d.createdAt),
    archived: !!d.archived,
    archivedAt: d.archivedAt ? toIso(d.archivedAt) : null,
    ...(cleanAutoFill(d.autoFill) ? { autoFill: cleanAutoFill(d.autoFill) } : {}),
    ...(typeof d.designedFrom === 'string' && d.designedFrom ? { designedFrom: d.designedFrom } : {}),
  };
}

function cleanAutoFill(raw: unknown): Record<string, AutoFillKind> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, AutoFillKind> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isAutoFillKind(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
