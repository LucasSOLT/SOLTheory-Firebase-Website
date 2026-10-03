// ============================================================================
// lib/document-library-server.ts — Phase 6.3 server operations (Admin SDK only).
// Pure helpers live in `@/lib/document-library` (client-safe).
// ============================================================================

import { createHash } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { PdfFormContent } from '@/types/onboarding-templates';
import {
  LibraryError,
  MAX_ACTIVE_TEMPLATES,
  TEMPLATE_COLLECTION,
  cleanTemplateName,
  fromDoc,
  isSafeOrgId,
  templatePathFor,
  validatePdfUpload,
  type LibraryTemplate,
} from '@/lib/document-library';

export interface StorageBucketLike {
  file(path: string): {
    save(data: Buffer, opts?: any): Promise<unknown>;
  };
}

export interface DetectResult {
  fields: NonNullable<PdfFormContent['detectedFields']>;
  pageCount: number;
  title?: string;
}

/** Default detector: the real PDF engine. Overridable for tests. */
export async function detectWithEngine(bytes: Uint8Array): Promise<DetectResult> {
  const { detectPdfFields } = await import('@/lib/pdf-form-engine');
  const { PDFDocument } = await import('pdf-lib');
  const fields = (await detectPdfFields(bytes)) as DetectResult['fields'];
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return { fields, pageCount: doc.getPageCount(), title: doc.getTitle() || undefined };
}

export interface CreateTemplateInput {
  db: Firestore;
  bucket: StorageBucketLike;
  orgId: string;
  bytes: Uint8Array;
  fileName: string;
  name?: string;
  documentCategory?: string;
  validCategories: string[];
  by: { uid: string; email: string };
  detect?: (bytes: Uint8Array) => Promise<DetectResult>;
  nowIso?: string;
  newId?: () => string;
}

export async function createLibraryTemplate(
  input: CreateTemplateInput,
): Promise<{ template: LibraryTemplate; duplicate: boolean }> {
  const { db, bucket, orgId, bytes, by } = input;
  if (!isSafeOrgId(orgId)) throw new LibraryError('Invalid organization.');
  validatePdfUpload(bytes);

  const col = db.collection(`orgs/${orgId}/${TEMPLATE_COLLECTION}`);
  const contentHash = createHash('sha256').update(bytes).digest('hex');

  // Upload once: the same file already in the library is returned, not stored twice.
  const existing = await col.where('contentHash', '==', contentHash).get();
  const live = existing.docs.find((d) => !d.data().archived);
  if (live) return { template: fromDoc(live.id, live.data()), duplicate: true };

  const all = await col.get();
  if (all.docs.filter((d) => !d.data().archived).length >= MAX_ACTIVE_TEMPLATES) {
    throw new LibraryError('The library is full. Archive a template you no longer use first.', 409);
  }

  // Detect BEFORE storing so a corrupt PDF never leaves an orphan file behind.
  let detected: DetectResult;
  try {
    detected = await (input.detect || detectWithEngine)(bytes);
  } catch (e: any) {
    throw new LibraryError(`That PDF could not be read (${e?.message || 'corrupt or unsupported'}).`);
  }

  const id = (input.newId || (() => `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`))();
  const pdfStoragePath = templatePathFor(orgId, id);
  await bucket.file(pdfStoragePath).save(Buffer.from(bytes), {
    resumable: false,
    metadata: {
      contentType: 'application/pdf',
      metadata: { orgId, templateId: id, uploadedBy: by.uid, contentHash },
    },
  });

  const category =
    input.documentCategory && input.validCategories.includes(input.documentCategory)
      ? input.documentCategory
      : 'other';
  const doc = {
    name: cleanTemplateName(input.name, input.fileName),
    pdfStoragePath,
    pageCount: detected.pageCount || 1,
    pdfTitle: detected.title || '',
    documentCategory: category,
    detectedFields: detected.fields || [],
    fillableFieldCount: (detected.fields || []).filter((f: any) => !f.readOnly).length,
    fileSize: bytes.length,
    contentHash,
    originalFileName: (input.fileName || '').slice(0, 200),
    createdBy: by.uid,
    createdByEmail: by.email,
    createdAt: input.nowIso || new Date().toISOString(),
    archived: false,
    archivedAt: null,
  };
  await col.doc(id).set(doc);
  return { template: fromDoc(id, doc), duplicate: false };
}

export async function listLibraryTemplates(
  db: Firestore,
  orgId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<LibraryTemplate[]> {
  const snap = await db.collection(`orgs/${orgId}/${TEMPLATE_COLLECTION}`).get();
  return snap.docs
    .map((d) => fromDoc(d.id, d.data()))
    .filter((t) => opts.includeArchived || !t.archived)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/** Archive / restore / rename / recategorize. Never touches the PDF file or detected fields. */
export async function updateLibraryTemplate(
  db: Firestore,
  orgId: string,
  id: string,
  patch: { archived?: boolean; name?: string; documentCategory?: string },
  validCategories: string[],
  nowIso = new Date().toISOString(),
): Promise<LibraryTemplate> {
  const ref = db.doc(`orgs/${orgId}/${TEMPLATE_COLLECTION}/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new LibraryError('That template does not exist.', 404);
  const update: Record<string, any> = {};
  if (typeof patch.archived === 'boolean') {
    update.archived = patch.archived;
    update.archivedAt = patch.archived ? nowIso : null;
  }
  if (typeof patch.name === 'string') update.name = cleanTemplateName(patch.name);
  if (typeof patch.documentCategory === 'string' && validCategories.includes(patch.documentCategory)) {
    update.documentCategory = patch.documentCategory;
  }
  if (!Object.keys(update).length) throw new LibraryError('Nothing to change.');
  await ref.update(update);
  return fromDoc(id, { ...snap.data(), ...update });
}
