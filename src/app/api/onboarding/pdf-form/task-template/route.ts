// ============================================================================
// GET /api/onboarding/pdf-form/task-template?taskId=XYZ[&fields=1]
//
// Phase 2, Step 2.4 (Onboarding Document System — APPROVED PLAN, Option A)
//
// Serves the PDF template attached to an onboarding task so the in-browser
// PDF.js viewer can render it. Going through the server (instead of a Storage
// URL) avoids CORS configuration and expiring signed URLs.
//
//   default     → the PDF bytes (application/pdf)
//   &fields=1   → { fields: PdfFormField[] } freshly detected with widget
//                 geometry, for tasks assigned before Step 2.2 existed.
//
// Security: the Storage path is read from the task document on the server —
// never from the client. Access is limited to the task's assignee, the
// onboarding instance's supervisor, the task creator, and org admins/oracles.
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { isDeveloper } from '@/lib/org-config';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { getStorage } from 'firebase-admin/storage';
import { firebaseConfig } from '@/firebase/config';
import { detectPdfFields } from '@/lib/pdf-form-engine';
import { isMultiSignerWorkflow } from '@/lib/signing-workflow';
import { canViewSession, loadOrCreateSession } from '@/lib/onboarding-signing';

export const runtime = 'nodejs';
export const maxDuration = 30;

const LOG_PREFIX = '[PDF Task Template]';

type AdminDb = ReturnType<typeof getAdminFirestore>;

async function canAccessTask(db: AdminDb, task: FirebaseFirestore.DocumentData, uid: string, email: string): Promise<boolean> {
  if (isDeveloper(email)) return true;
  if (task.assignedTo === uid || task.createdBy === uid) return true;

  const instanceId = task.metadata?.onboardingInstanceId;
  if (instanceId) {
    const instance = (await db.collection('onboarding_instances').doc(instanceId).get()).data();
    if (instance && (instance.supervisorUid === uid || instance.mentorUid === uid)) return true;
  }

  if (task.orgId) {
    const role = (await db.doc(`orgs/${task.orgId}/members/${uid}`).get()).data()?.role;
    if (role === 'admin' || role === 'oracle') return true;
  }
  return false;
}

export async function GET(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const taskId = url.searchParams.get('taskId');
    const wantFields = url.searchParams.get('fields') === '1';
    if (!taskId) {
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
    }

    await initAdmin();
    const db = getAdminFirestore();

    const taskSnap = await db.collection('action_board_tasks').doc(taskId).get();
    const task = taskSnap.data();
    const content = task?.metadata?.interactiveContent;
    if (!task || task.category !== 'onboarding' || content?.type !== 'pdf_form' || !content.pdfStoragePath) {
      return NextResponse.json({ error: 'No PDF form found on this task' }, { status: 404 });
    }

    // Phase 3: multi-signer documents serve the current WORKING copy (earlier
    // signers' values filled + locked) and every signer may load it.
    const bucket = getStorage().bucket(firebaseConfig.storageBucket);
    let pdfPath: string = content.pdfStoragePath;
    let allowed = false;
    let cacheControl = 'private, max-age=300';
    if (isMultiSignerWorkflow(content)) {
      const loaded = await loadOrCreateSession(db, bucket, taskId);
      if (loaded) {
        pdfPath = loaded.session.workingPdfPath || loaded.session.templatePath;
        allowed = await canViewSession(db, loaded.session, auth.uid, auth.email);
        cacheControl = 'no-store';
      }
    }

    if (!allowed && !(await canAccessTask(db, task, auth.uid, auth.email))) {
      return NextResponse.json({ error: 'You do not have access to this document' }, { status: 403 });
    }

    const [buffer] = await bucket.file(pdfPath).download();
    const bytes = new Uint8Array(buffer);

    if (wantFields) {
      const fields = await detectPdfFields(bytes);
      return NextResponse.json({ fields }, { headers: { 'Cache-Control': cacheControl } });
    }

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': cacheControl,
      },
    });
  } catch (err: any) {
    console.error(LOG_PREFIX, 'Error:', err?.message, err?.stack);
    return NextResponse.json({ error: 'Failed to load PDF template' }, { status: 500 });
  }
}
