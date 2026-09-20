// ============================================================================
// POST /api/onboarding/review-submission
//
// Admin endpoint to approve or reject an employee's interactive submission.
// Used for items with reviewMode: 'admin_review' (short_answer, recorded_response)
// or verificationMethod: 'admin_verify' (external_verification).
//
// Request body:
//   orgId:    string              — Organization ID
//   taskId:   string              — Action board task ID
//   action:   'approve' | 'reject' — Review decision
//   notes?:   string              — Optional review feedback
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRole } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orgId, taskId, action, notes } = body;

    if (!orgId || !taskId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId, taskId, action' },
        { status: 400 },
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 },
      );
    }

    // Require admin or oracle access
    const auth = await verifyRole(req, orgId, 'admin');

    await initAdmin();
    const db = getAdminFirestore();

    // ── 1. Load the task ──
    const taskRef = db.collection('action_board_tasks').doc(taskId);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const taskData = taskSnap.data()!;

    // Verify the task belongs to this org
    if (taskData.orgId !== orgId) {
      return NextResponse.json({ error: 'Task does not belong to this organization' }, { status: 403 });
    }

    // Verify the task is actually pending review
    if (taskData.metadata?.reviewStatus !== 'pending_review') {
      return NextResponse.json(
        { error: `Task is not pending review (current status: ${taskData.metadata?.reviewStatus || 'none'})` },
        { status: 400 },
      );
    }

    // ── 2. Build update payload ──
    const reviewMeta: Record<string, any> = {
      'metadata.reviewStatus': action === 'approve' ? 'approved' : 'rejected',
      'metadata.reviewedBy': auth.uid,
      'metadata.reviewedByEmail': auth.email,
      'metadata.reviewedAt': FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (notes !== undefined && notes !== null) {
      reviewMeta['metadata.reviewNotes'] = notes;
    }

    // If approved, advance task to done
    if (action === 'approve') {
      reviewMeta.column = 'done';
      reviewMeta.completedAt = FieldValue.serverTimestamp();
    }
    // If rejected, task stays in current column — employee can resubmit

    await taskRef.update(reviewMeta);

    // ── 3. Audit Trail Logging ──
    try {
      const employeeName = taskData.assignedToEmail?.split('@')[0] || 'employee';
      const itemType = taskData.metadata?.itemType || 'submission';

      await db.collection('activity_log').add({
        type: 'item_updated',
        userEmail: auth.email,
        userName: auth.email.split('@')[0],
        orgDomain: auth.email.split('@')[1] || orgId,
        description: `${auth.email.split('@')[0]} ${action === 'approve' ? 'approved' : 'rejected'} ${itemType} submission from ${employeeName} — "${taskData.title}"`,
        category: 'general',
        timestamp: FieldValue.serverTimestamp(),
        metadata: {
          action: 'onboarding_submission_reviewed',
          taskId,
          taskTitle: taskData.title,
          reviewAction: action,
          itemType,
          targetUserId: taskData.assignedTo,
          targetUserEmail: taskData.assignedToEmail,
          notes: notes || null,
        },
      });
    } catch (aErr) {
      console.warn('[Review Submission] Audit log warning:', aErr);
    }

    return NextResponse.json({
      status: 'ok',
      taskId,
      action,
      reviewedBy: auth.email,
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err.message?.includes('Insufficient permissions')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    console.error('[Review Submission] Fatal error:', err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to review submission', details: err.message },
      { status: 500 },
    );
  }
}
