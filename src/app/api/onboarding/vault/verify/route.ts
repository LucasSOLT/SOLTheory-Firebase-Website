// ============================================================================
// POST /api/onboarding/vault/verify
//
// Admin / Manager endpoint to verify or reject an uploaded compliance document.
// Records manager UID, timestamp, and optional notes. If approved, optionally
// advances the associated Action Board task to "done".
//
// Request body:
//   orgId:       string  — Organization ID
//   documentId:  string  — ID of the compliance document
//   status:      "verified" | "rejected"
//   notes?:      string  — Optional review feedback or notes
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRole } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { COMPLIANCE_CATEGORY_LABELS } from '@/types/onboarding-templates';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orgId, documentId, status, notes } = body;

    if (!orgId || !documentId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId, documentId, status' },
        { status: 400 },
      );
    }

    if (!['verified', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "verified" or "rejected"' },
        { status: 400 },
      );
    }

    // Require admin or oracle access
    const auth = await verifyRole(req, orgId, 'admin');

    await initAdmin();
    const db = getAdminFirestore();

    const docRef = db.collection('orgs').doc(orgId).collection('compliance_documents').doc(documentId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Compliance document not found' }, { status: 404 });
    }

    const docData = docSnap.data()!;

    // ── 1. Update Document Status ──
    const updates: Record<string, any> = {
      status,
      verifiedBy: auth.uid,
      verifiedByEmail: auth.email,
      verifiedAt: FieldValue.serverTimestamp(),
      ...(notes !== undefined ? { notes } : {}),
    };

    await docRef.update(updates);

    // ── 2. Update Associated Action Board Task ──
    if (docData.taskId) {
      try {
        const taskRef = db.collection('action_board_tasks').doc(docData.taskId);
        const taskSnap = await taskRef.get();

        if (taskSnap.exists) {
          const taskUpdates: Record<string, any> = {
            updatedAt: FieldValue.serverTimestamp(),
            'metadata.isDocumentVerified': status === 'verified',
            'metadata.documentVerificationStatus': status,
            'metadata.verifiedByEmail': auth.email,
          };

          // If verified and task was in todo/doing, auto-advance to done!
          if (status === 'verified' && taskSnap.data()?.column !== 'done') {
            taskUpdates.column = 'done';
            taskUpdates.completedAt = FieldValue.serverTimestamp();
          }

          await taskRef.update(taskUpdates);
        }
      } catch (tErr: any) {
        console.warn('[Vault Verify] Task update warning:', tErr.message);
      }
    }

    // ── 3. Audit Trail Logging ──
    try {
      const categoryLabel = COMPLIANCE_CATEGORY_LABELS[docData.documentCategory as keyof typeof COMPLIANCE_CATEGORY_LABELS] || docData.documentCategory;
      await db.collection('activity_log').add({
        type: 'item_updated',
        userEmail: auth.email,
        userName: auth.email.split('@')[0],
        orgDomain: auth.email.split('@')[1] || orgId,
        description: `${auth.email.split('@')[0]} ${status === 'verified' ? 'verified' : 'rejected'} ${categoryLabel} for ${docData.userName} (${docData.userEmail})`,
        category: 'general',
        timestamp: FieldValue.serverTimestamp(),
        metadata: {
          action: 'compliance_document_verified',
          documentId,
          fileName: docData.fileName,
          status,
          targetUserId: docData.userId,
          targetUserEmail: docData.userEmail,
          notes: notes || null,
        },
      });
    } catch (aErr) {
      console.warn('[Vault Verify] Audit log warning:', aErr);
    }

    return NextResponse.json({
      status: 'ok',
      documentId,
      newStatus: status,
      verifiedBy: auth.email,
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err.message?.includes('Insufficient permissions')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    console.error('[Vault Verify] Fatal error:', err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to verify compliance document', details: err.message },
      { status: 500 },
    );
  }
}
