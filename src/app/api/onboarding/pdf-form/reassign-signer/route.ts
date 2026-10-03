// ============================================================================
// POST /api/onboarding/pdf-form/reassign-signer
//
// Phase 5, Step 5.1 — admin hands an unsigned slot of a multi-party document
// to another org member (typically because the original signer left).
//
// Body: { orgId, taskId, order: number, memberUid: string }
// Access: org admin/oracle or developer. The new signer must be a current org
// member (resolved server-side — name/email are never client-supplied).
// ============================================================================

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { firebaseConfig } from '@/firebase/config';
import {
  SIGNING_SESSIONS,
  SigningSetupError,
  loadOrCreateSession,
  mirrorFor,
  notifyNextSigner,
  type SigningSessionDoc,
} from '@/lib/onboarding-signing';
import { ReassignError, applyReassignment, canReassignSigners } from '@/lib/onboarding-reassign';
import { emailNextSigner } from '@/lib/onboarding-routing-emails';
import { logOnboardingAudit } from '@/lib/onboarding-audit';

export const runtime = 'nodejs';
export const maxDuration = 30;

const LOG_PREFIX = '[Onboarding:ReassignSigner]';

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const orgId = typeof body.orgId === 'string' ? body.orgId : '';
    const taskId = typeof body.taskId === 'string' ? body.taskId : '';
    const order = typeof body.order === 'number' ? body.order : NaN;
    const memberUid = typeof body.memberUid === 'string' ? body.memberUid : '';
    if (!orgId || !taskId || !Number.isInteger(order) || !memberUid) {
      return NextResponse.json({ error: 'Missing orgId, taskId, order or memberUid' }, { status: 400 });
    }

    await initAdmin();
    const db = getAdminFirestore();
    const bucket = getStorage().bucket(firebaseConfig.storageBucket);

    if (!(await canReassignSigners(db, orgId, auth.uid, auth.email))) {
      return NextResponse.json({ error: 'Only admins can change who signs a document.' }, { status: 403 });
    }

    const loaded = await loadOrCreateSession(db, bucket, taskId);
    if (!loaded || loaded.session.orgId !== orgId) {
      return NextResponse.json({ error: 'This document does not use multiple signers' }, { status: 404 });
    }

    // The new signer must be a CURRENT member of this org; identity comes from our records.
    const memberSnap = await db.doc(`orgs/${orgId}/members/${memberUid}`).get();
    if (!memberSnap.exists) {
      return NextResponse.json({ error: 'That person is not a member of this organization.' }, { status: 400 });
    }
    const userData = (await db.collection('users').doc(memberUid).get()).data() || {};
    const email = String(userData.email || memberSnap.data()?.email || '').trim();
    if (!email) {
      return NextResponse.json({ error: 'That member has no email address on file, so they cannot be asked to sign.' }, { status: 400 });
    }
    const name = String(userData.displayName || userData.name || memberSnap.data()?.name || email.split('@')[0]);

    const sessionRef = db.collection(SIGNING_SESSIONS).doc(taskId);
    const parentRef = db.collection('action_board_tasks').doc(taskId);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) throw new ReassignError('This document has no signing session yet.', 404);
      const fresh = snap.data() as SigningSessionDoc;
      const out = applyReassignment(fresh, order, { uid: memberUid, email, name }, { uid: auth.uid, email: auth.email });

      tx.update(sessionRef, {
        signers: out.next.signers,
        reassignments: out.next.reassignments,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(parentRef, { 'metadata.signing': mirrorFor(out.next), updatedAt: FieldValue.serverTimestamp() });
      // The open countersign to-do belongs to whoever's turn it is.
      if (out.isCurrent && fresh.openCountersignTaskId) {
        tx.update(db.collection('action_board_tasks').doc(fresh.openCountersignTaskId), {
          assignedTo: out.updated.uid,
          assignedToEmail: out.updated.email,
          assignedToName: out.updated.name,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return out;
    });

    // After commit (best effort): tell the new signer when it's already their turn.
    if (result.isCurrent) {
      await notifyNextSigner(result.next, result.updated, auth.uid);
      await emailNextSigner(db, result.next, result.updated);
    }

    const lastCompletion = result.next.completions[result.next.completions.length - 1];
    await logOnboardingAudit(db, {
      type: 'pdf_form_signer_reassigned',
      actor: { uid: auth.uid, email: auth.email },
      orgDomain: orgId,
      taskId,
      description: `${auth.email.split('@')[0]} reassigned step ${order} of "${result.next.title}" from ${result.previous.name} to ${result.updated.name}`,
      documentSha256: lastCompletion?.partialPdfSha256 || null,
      metadata: {
        round: result.next.round,
        signerOrder: order,
        fromUid: result.previous.uid,
        fromEmail: result.previous.email,
        toUid: result.updated.uid,
        toEmail: result.updated.email,
      },
    });

    return NextResponse.json({
      status: 'ok',
      signer: { order, name: result.updated.name, label: result.updated.label },
      isCurrent: result.isCurrent,
    });
  } catch (err: any) {
    if (err instanceof ReassignError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof SigningSetupError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error(LOG_PREFIX, 'Error:', err?.message, err?.stack);
    return NextResponse.json({ error: 'Could not reassign the signer.' }, { status: 500 });
  }
}
