// ============================================================================
// POST /api/onboarding/re-request
//
// Phase 1, Step 1.4 — Re-Request / Redo
//
// Allows a supervisor or admin to reset a completed onboarding task back to
// 'todo' state with notes explaining what needs to be corrected. The employee
// sees the notes and resubmits.
//
// Per the approved build plan: Supervisors can click "Re-Request" on any
// completed item to reset it to 'todo' state with notes. Employee sees the
// notes and resubmits.
//
// Request body:
//   orgId:   string — Organization ID
//   taskId:  string — The task ID to re-request
//   notes:   string — Explanation of what needs correction
// ============================================================================

import { NextResponse } from 'next/server';
import { initAdmin } from '@/firebase/admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyRole } from '@/lib/api-auth';
import {
  SIGNING_SESSIONS,
  currentSigner,
  mirrorFor,
  notifyNextSigner,
  type SigningSessionDoc,
} from '@/lib/onboarding-signing';

const LOG_PREFIX = '[Onboarding:ReRequest]';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orgId, taskId, notes } = body;

    if (!orgId || !taskId || !notes?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId, taskId, notes' },
        { status: 400 },
      );
    }

    // Auth: require at least 'user' role (supervisors are 'user' or 'admin')
    const auth = await verifyRole(req, orgId, 'user');
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    initAdmin();
    const db = getFirestore();

    // Fetch the task
    const taskRef = db.collection('action_board_tasks').doc(taskId);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const taskData = taskSnap.data()!;

    // Verify this is an onboarding task in the correct org
    if (taskData.orgId !== orgId || taskData.category !== 'onboarding') {
      return NextResponse.json({ error: 'Task not found in this organization' }, { status: 404 });
    }

    // Verify the requester is either an admin or the assigned supervisor
    const instanceId = taskData.metadata?.onboardingInstanceId;
    let isSupervisor = false;

    if (instanceId) {
      const instanceSnap = await db.collection('onboarding_instances').doc(instanceId).get();
      if (instanceSnap.exists) {
        const instanceData = instanceSnap.data()!;
        isSupervisor = instanceData.mentorUid === auth.uid || instanceData.supervisorUid === auth.uid;
      }
    }

    // Allow admins, oracles, or the assigned supervisor
    const memberSnap = await db.doc(`orgs/${orgId}/members/${auth.uid}`).get();
    const memberRole = memberSnap.data()?.role || 'user';
    const isAdminOrOracle = memberRole === 'admin' || memberRole === 'oracle';

    // Phase 3: multi-signer documents keep server-only signing state.
    const sessionRef = db.collection(SIGNING_SESSIONS).doc(taskId);
    const sessionSnap = await sessionRef.get();
    const session = sessionSnap.exists ? (sessionSnap.data() as SigningSessionDoc) : null;
    // The signer whose turn it is (e.g. HR reviewing the employee's part) may
    // also send the document back — but not the employee to themself.
    const cur = session ? currentSigner(session) : null;
    const isCurrentCountersigner =
      !!session &&
      session.status !== 'fully_executed' &&
      session.status !== 'archived' &&
      !!cur &&
      cur.uid === auth.uid &&
      cur.uid !== session.employeeUid;

    if (!isAdminOrOracle && !isSupervisor && !isCurrentCountersigner) {
      return NextResponse.json(
        { error: 'Only admins or the assigned supervisor can re-request tasks' },
        { status: 403 },
      );
    }

    if (session?.status === 'archived') {
      return NextResponse.json(
        { error: 'This document was already sent and archived, so it can no longer be re-requested.' },
        { status: 409 },
      );
    }

    // Reset the task back to 'todo' with re-request notes
    await taskRef.update({
      column: 'todo',
      completedAt: null,
      'metadata.reviewStatus': 'rejected',
      'metadata.reviewNotes': notes.trim(),
      'metadata.reviewedBy': auth.uid,
      'metadata.reviewedByEmail': auth.email,
      'metadata.reviewedAt': FieldValue.serverTimestamp(),
      'metadata.reRequestedAt': FieldValue.serverTimestamp(),
      'metadata.reRequestedBy': auth.uid,
      'metadata.reRequestedByEmail': auth.email,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // ── Phase 3: reset the signing session (new round, back to signer #1) ──
    if (session) {
      const reset: SigningSessionDoc = {
        ...session,
        status: 'draft',
        round: session.round + 1,
        currentSignerOrder: 1,
        completions: [],
        signatures: [],
        workingPdfPath: null,
        openCountersignTaskId: null,
        finalDocument: null,
        history: [
          ...session.history,
          {
            round: session.round,
            completions: session.completions,
            workingPdfPath: session.workingPdfPath,
            resetAt: new Date().toISOString(),
            resetBy: auth.uid,
            notes: notes.trim(),
          },
        ],
      };
      await sessionRef.update({
        status: reset.status,
        round: reset.round,
        currentSignerOrder: reset.currentSignerOrder,
        completions: [],
        signatures: [],
        workingPdfPath: null,
        openCountersignTaskId: null,
        finalDocument: null,
        history: reset.history,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await taskRef.update({ 'metadata.signing': mirrorFor(reset) });

      if (session.openCountersignTaskId) {
        await db.collection('action_board_tasks').doc(session.openCountersignTaskId).update({
          column: 'done',
          isArchived: true,
          'metadata.cancelled': true,
          'metadata.cancelledReason': 'Document was sent back for changes',
          updatedAt: FieldValue.serverTimestamp(),
        }).catch(() => undefined);
      }

      // A fully executed copy that hasn't been sent yet is superseded.
      if (session.finalDocument?.vaultDocId) {
        await db.collection('orgs').doc(orgId).collection('compliance_documents').doc(session.finalDocument.vaultDocId).update({
          status: 'rejected',
          notes: `Superseded — re-requested: ${notes.trim()}`.substring(0, 500),
          supersededAt: FieldValue.serverTimestamp(),
        }).catch(() => undefined);
      }

      // Signer #1 gets an in-app notice when it isn't the employee (the
      // employee already sees the re-request notes on their task).
      const first = currentSigner(reset);
      if (first && first.uid !== session.employeeUid) {
        await notifyNextSigner(reset, first, auth.uid);
      }
    }

    // Update progress on the onboarding instance
    if (instanceId) {
      const instanceRef = db.collection('onboarding_instances').doc(instanceId);
      const allTasksSnap = await db
        .collection('action_board_tasks')
        .where('metadata.onboardingInstanceId', '==', instanceId)
        .get();

      const totalSteps = allTasksSnap.size;
      // Re-read the freshly updated task to count correctly
      const completedSteps = allTasksSnap.docs.filter(d => {
        if (d.id === taskId) return false; // This task is now 'todo'
        return d.data().column === 'done';
      }).length;

      await instanceRef.update({
        completedSteps,
        overallProgress: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
        status: 'in_progress', // If it was completed, it's now back in progress
      });
    }

    // Log to audit trail
    const auditRef = db.collection('activity_log').doc();
    await auditRef.set({
      type: 'item_updated',
      userEmail: auth.email,
      userName: auth.email.split('@')[0],
      orgDomain: auth.email.split('@')[1] || orgId,
      description: `${auth.email.split('@')[0]} re-requested "${taskData.title}" for ${taskData.assignedToEmail}: ${notes.trim()}`,
      category: 'general',
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        action: 'onboarding_re_request',
        taskId,
        onboardingInstanceId: instanceId,
        assignedToEmail: taskData.assignedToEmail,
        notes: notes.trim(),
      },
    });

    console.log(
      LOG_PREFIX,
      `Task "${taskData.title}" (${taskId}) re-requested by ${auth.email} for ${taskData.assignedToEmail}`,
    );

    return NextResponse.json({ status: 'ok', message: 'Task re-requested successfully' });
  } catch (err: any) {
    console.error(LOG_PREFIX, 'Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
