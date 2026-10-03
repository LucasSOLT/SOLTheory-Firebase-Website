// ============================================================================
// /api/onboarding/document-library — Phase 6, Step 6.3
//
//   GET   ?orgId=&includeArchived=1   → list templates (any org member; archived: admins only)
//   POST  multipart {orgId, file, name?, documentCategory?}  → upload + detect fields once (admin)
//   PATCH json {orgId, id, archived?, name?, documentCategory?} → archive / restore / rename (admin)
//
// Templates are immutable: the PDF file is never overwritten or deleted, so
// documents already out for signature are unaffected by anything done here.
// ============================================================================

import { NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { firebaseConfig } from '@/firebase/config';
import { isDeveloper } from '@/lib/org-config';
import { canReassignSigners } from '@/lib/onboarding-reassign';
import { COMPLIANCE_CATEGORY_LABELS } from '@/types/onboarding-templates';
import { LibraryError, MAX_TEMPLATE_BYTES, isSafeOrgId } from '@/lib/document-library';
import {
  createLibraryTemplate,
  listLibraryTemplates,
  updateLibraryTemplate,
} from '@/lib/document-library-server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VALID_CATEGORIES = Object.keys(COMPLIANCE_CATEGORY_LABELS);

function fail(err: any, where: string) {
  if (err instanceof LibraryError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[DocumentLibrary:${where}]`, err?.message, err?.stack);
  return NextResponse.json({ error: 'Document library request failed', details: err?.message }, { status: 500 });
}

async function isMember(db: FirebaseFirestore.Firestore, orgId: string, uid: string, email: string) {
  if (isDeveloper(email)) return true;
  return (await db.doc(`orgs/${orgId}/members/${uid}`).get()).exists;
}

export async function GET(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId') || '';
    if (!isSafeOrgId(orgId)) return NextResponse.json({ error: 'Missing or invalid orgId' }, { status: 400 });

    await initAdmin();
    const db = getAdminFirestore();
    if (!(await isMember(db, orgId, auth.uid, auth.email))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const wantArchived = url.searchParams.get('includeArchived') === '1';
    const isAdmin = wantArchived ? await canReassignSigners(db, orgId, auth.uid, auth.email) : false;
    const templates = await listLibraryTemplates(db, orgId, { includeArchived: wantArchived && isAdmin });
    return NextResponse.json({ templates, canManage: await canReassignSigners(db, orgId, auth.uid, auth.email) });
  } catch (err) {
    return fail(err, 'GET');
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const form = await req.formData();
    const orgId = String(form.get('orgId') || '');
    const file = form.get('file');
    if (!isSafeOrgId(orgId)) return NextResponse.json({ error: 'Missing or invalid orgId' }, { status: 400 });
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    await initAdmin();
    const db = getAdminFirestore();
    if (!(await canReassignSigners(db, orgId, auth.uid, auth.email))) {
      return NextResponse.json({ error: 'Only admins can add documents to the library.' }, { status: 403 });
    }
    const f = file as File;
    if (f.size > MAX_TEMPLATE_BYTES) {
      return NextResponse.json({ error: 'That PDF is too large.' }, { status: 400 });
    }
    const bytes = new Uint8Array(await f.arrayBuffer());
    const bucket = getStorage().bucket(firebaseConfig.storageBucket);

    const { template, duplicate } = await createLibraryTemplate({
      db,
      bucket,
      orgId,
      bytes,
      fileName: f.name || 'document.pdf',
      name: String(form.get('name') || '') || undefined,
      documentCategory: String(form.get('documentCategory') || '') || undefined,
      validCategories: VALID_CATEGORIES,
      by: { uid: auth.uid, email: auth.email },
    });
    return NextResponse.json({ template, duplicate });
  } catch (err) {
    return fail(err, 'POST');
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;
    const body = await req.json().catch(() => ({}));
    const orgId = typeof body.orgId === 'string' ? body.orgId : '';
    const id = typeof body.id === 'string' ? body.id : '';
    if (!isSafeOrgId(orgId) || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
      return NextResponse.json({ error: 'Missing orgId or id' }, { status: 400 });
    }

    await initAdmin();
    const db = getAdminFirestore();
    if (!(await canReassignSigners(db, orgId, auth.uid, auth.email))) {
      return NextResponse.json({ error: 'Only admins can change the library.' }, { status: 403 });
    }
    const template = await updateLibraryTemplate(
      db,
      orgId,
      id,
      {
        archived: typeof body.archived === 'boolean' ? body.archived : undefined,
        name: typeof body.name === 'string' ? body.name : undefined,
        documentCategory: typeof body.documentCategory === 'string' ? body.documentCategory : undefined,
      },
      VALID_CATEGORIES,
    );
    return NextResponse.json({ template });
  } catch (err) {
    return fail(err, 'PATCH');
  }
}
