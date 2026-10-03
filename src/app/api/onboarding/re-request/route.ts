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
        isSupervisor = instanceData.mentorUid === auth.uid;
      }
    }

    // Allow admins, oracles, or the assigned supervisor
    const memberSnap = await db.doc(`orgs/${orgId}/members/${auth.uid}`).get();
    const memberRole = memberSnap.data()?.role || 'user';
    const isAdminOrOracle = memberRole === 'admin' || memberRole === 'oracle';

    if (!isAdminOrOracle && !isSupervisor) {
      return NextResponse.json(
        { error: 'Only admins or the assigned supervisor can re-request tasks' },
        { status: 403 },
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
