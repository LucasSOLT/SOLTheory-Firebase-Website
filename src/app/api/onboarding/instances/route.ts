// ============================================================================
// GET /api/onboarding/instances
//
// Fetches onboarding instances for the organization using Admin Firestore.
// Ensures 100% reliable data retrieval regardless of client security rules.
//
// Query parameters:
//   orgId: string  — Organization ID
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRequest, verifyRole } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
    }

    await initAdmin();
    const db = getAdminFirestore();

    const snapshot = await db
      .collection('onboarding_instances')
      .where('orgId', '==', orgId)
      .get();

    const instances = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ status: 'ok', instances });
  } catch (err: any) {
    console.error('[Onboarding Instances API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding instances', details: err.message },
      { status: 500 },
    );
  }
}

// ============================================================================
// DELETE /api/onboarding/instances
//
// Removes onboarding instance(s) and all associated tasks.
// Admin-only endpoint.
//
// Request body:
//   orgId:       string  — Organization ID (required)
//   instanceId?: string  — Specific instance to remove
//   userId?:     string  — User ID whose instances to remove (used with removeAll)
//   removeAll?:  boolean — If true, removes ALL instances for the given userId
// ============================================================================

export async function DELETE(req: Request) {
  const LOG = '[Onboarding:Instances:DELETE]';

  try {
    const body = await req.json();
    const { orgId, instanceId, userId, removeAll } = body;

    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
    }

    if (!instanceId && !userId) {
      return NextResponse.json(
        { error: 'Must provide either instanceId or userId' },
        { status: 400 },
      );
    }

    const auth = await verifyRole(req, orgId, 'admin');

    await initAdmin();
    const db = getAdminFirestore();

    // Collect the instance IDs to delete
    let instanceIds: string[] = [];

    if (removeAll && userId) {
      // Remove ALL instances for this user in this org
      const snap = await db
        .collection('onboarding_instances')
        .where('orgId', '==', orgId)
        .where('userId', '==', userId)
        .get();
      instanceIds = snap.docs.map(d => d.id);
    } else if (instanceId) {
      instanceIds = [instanceId];
    }

    if (instanceIds.length === 0) {
      return NextResponse.json({ status: 'ok', deletedInstances: 0, deletedTasks: 0 });
    }

    // Batch-delete all tasks and instances
    // Firestore batches are limited to 500 writes, so we chunk if needed
    let totalDeletedTasks = 0;

    for (const instId of instanceIds) {
      // Find all tasks belonging to this instance
      const tasksSnap = await db
        .collection('action_board_tasks')
        .where('metadata.onboardingInstanceId', '==', instId)
        .get();

      // Delete in chunks of 400 (leaving room for the instance doc + audit doc)
      const taskDocs = tasksSnap.docs;
      for (let i = 0; i < taskDocs.length; i += 400) {
        const chunk = taskDocs.slice(i, i + 400);
        const batch = db.batch();
        for (const taskDoc of chunk) {
          batch.delete(taskDoc.ref);
        }
        await batch.commit();
      }
      totalDeletedTasks += taskDocs.length;

      // Delete the instance document itself
      await db.collection('onboarding_instances').doc(instId).delete();
    }

    // Log audit trail
    const auditRef = db.collection('activity_log').doc();
    await auditRef.set({
      type: 'item_deleted',
      userEmail: auth.email,
      userName: auth.email.split('@')[0],
      orgDomain: auth.email.split('@')[1] || orgId,
      description: removeAll
        ? `${auth.email.split('@')[0]} removed all onboarding blueprints (${instanceIds.length} instances, ${totalDeletedTasks} tasks) for user ${userId}`
        : `${auth.email.split('@')[0]} removed onboarding instance ${instanceId} (${totalDeletedTasks} tasks)`,
      category: 'general',
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        action: 'onboarding_instance_deleted',
        instanceIds,
        totalDeletedTasks,
        removeAll: !!removeAll,
      },
    });

    console.log(
      `${LOG} ✅ Deleted ${instanceIds.length} instance(s) and ${totalDeletedTasks} task(s)`,
    );

    return NextResponse.json({
      status: 'ok',
      deletedInstances: instanceIds.length,
      deletedTasks: totalDeletedTasks,
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err.message?.includes('Insufficient permissions')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error(`${LOG} Fatal error:`, err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to delete onboarding instance(s)', details: err.message },
      { status: 500 },
    );
  }
}
