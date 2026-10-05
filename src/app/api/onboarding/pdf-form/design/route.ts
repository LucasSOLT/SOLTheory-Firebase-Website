// ============================================================================
// /api/onboarding/pdf-form/design — Signature Suite, Phase G (G2/G3/G4)
//
//   GET  ?orgId=&path=   → the template PDF's bytes, so the Visual Field Designer
//                          can render it in the browser (admin only).
//   POST {orgId, storagePath, ops, name?, documentCategory?}
//                        → validates the design operations, writes a NEW PDF copy
//                          with real AcroForm fields, saves it as a NEW library
//                          template (templates are immutable — the original is
//                          never touched) and returns the template + a rename map.
// ============================================================================

import { NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { firebaseConfig } from '@/firebase/config';
import { canReassignSigners } from '@/lib/onboarding-reassign';
import { COMPLIANCE_CATEGORY_LABELS } from '@/types/onboarding-templates';
import {
  LibraryError,
  MAX_TEMPLATE_BYTES,
  TEMPLATE_COLLECTION,
  cleanTemplateName,
  isAllowedTemplatePath,
  isSafeOrgId,
} from '@/lib/document-library';
import { createLibraryTemplate } from '@/lib/document-library-server';
import { applyFieldDesign } from '@/lib/pdf-field-designer-engine';
import { DesignError } from '@/lib/field-design';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VALID_CATEGORIES = Object.keys(COMPLIANCE_CATEGORY_LABELS);

async function loadAdminAndBytes(orgId: unknown, path: unknown, uid: string, email: string) {
  if (!isSafeOrgId(orgId)) return { error: NextResponse.json({ error: 'Missing or invalid orgId' }, { status: 400 }) };
  if (typeof path !== 'string' || !path) return { error: NextResponse.json({ error: 'Missing path' }, { status: 400 }) };
  await initAdmin();
  const db = getAdminFirestore();
  if (!(await canReassignSigners(db, orgId, uid, email))) {
    return { error: NextResponse.json({ error: 'Only admins can design documents.' }, { status: 403 }) };
  }
  if (!isAllowedTemplatePath(orgId, path)) {
    return { error: NextResponse.json({ error: 'That path is not a template location.' }, { status: 400 }) };
  }
  const bucket = getStorage().bucket(firebaseConfig.storageBucket);
  const [buffer] = await bucket.file(path).download();
  if (buffer.length > MAX_TEMPLATE_BYTES) {
    return { error: NextResponse.json({ error: 'That PDF is too large.' }, { status: 400 }) };
  }
  return { db, bucket, orgId, buffer };
}

export async function GET(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;
    const url = new URL(req.url);
    const r = await loadAdminAndBytes(url.searchParams.get('orgId'), url.searchParams.get('path'), auth.uid, auth.email);
    if ('error' in r) return r.error;
    return new NextResponse(new Uint8Array(r.buffer), {
      headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store' },
    });
  } catch (err: any) {
    console.error('[FieldDesigner:GET]', err?.message);
    return NextResponse.json({ error: 'Could not load the document', details: err?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;
    const body = await req.json().catch(() => ({}));
    const r = await loadAdminAndBytes(body.orgId, body.storagePath, auth.uid, auth.email);
    if ('error' in r) return r.error;

    const design = await applyFieldDesign(new Uint8Array(r.buffer), body.ops);

    // Best-effort: the library template this was designed from (name + lineage).
    let sourceId: string | undefined;
    let sourceName: string | undefined;
    try {
      const snap = await r.db
        .collection(`orgs/${r.orgId}/${TEMPLATE_COLLECTION}`)
        .where('pdfStoragePath', '==', body.storagePath)
        .limit(1)
        .get();
      if (!snap.empty) {
        sourceId = snap.docs[0]!.id;
        sourceName = String(snap.docs[0]!.data().name || '');
      }
    } catch {
      /* lineage is optional */
    }

    const baseName = cleanTemplateName(typeof body.name === 'string' && body.name ? body.name : sourceName, 'Document');
    const { template } = await createLibraryTemplate({
      db: r.db,
      bucket: r.bucket,
      orgId: r.orgId,
      bytes: design.pdfBytes,
      fileName: `${baseName}.pdf`,
      name: /\(designed\)$/i.test(baseName) ? baseName : `${baseName} (designed)`,
      documentCategory: typeof body.documentCategory === 'string' ? body.documentCategory : undefined,
      validCategories: VALID_CATEGORIES,
      by: { uid: auth.uid, email: auth.email },
      autoFill: design.autoFill,
      designedFrom: sourceId,
    });

    return NextResponse.json({
      template,
      nameMap: design.nameMap,
      autoFill: design.autoFill,
      added: design.added,
      deleted: design.deleted,
    });
  } catch (err: any) {
    if (err instanceof DesignError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof LibraryError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[FieldDesigner:POST]', err?.message, err?.stack);
    return NextResponse.json({ error: 'Could not save the design', details: err?.message }, { status: 500 });
  }
}
