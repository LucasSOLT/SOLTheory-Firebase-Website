// ============================================================================
// POST /api/onboarding/verify-seal
//
// Tamper verification endpoint. Re-computes the composite SHA-256 hash from
// stored data and compares it to the stored hash. Returns whether the document
// integrity is intact.
//
// Request body:
//   { orgId: string, taskId: string }
//
// Response:
//   { valid: boolean, details: { ... } }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin } from '@/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const { orgId, taskId } = await req.json();

    if (!orgId || !taskId) {
      return NextResponse.json({ error: 'Missing orgId or taskId' }, { status: 400 });
    }

    initAdmin();
    const db = getFirestore();

    // Fetch the task
    const taskRef = db.collection('action_board_tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = taskDoc.data()!;
    const metadata = task.metadata || {};
    const interactiveContent = metadata.interactiveContent;

    if (!interactiveContent || interactiveContent.type !== 'policy_acknowledgment') {
      return NextResponse.json({ error: 'Task is not a policy acknowledgment' }, { status: 400 });
    }

    // Find the latest policy_acknowledgment response
    const userResponses = (metadata.userResponse || []) as any[];
    const signatureResponse = userResponses
      .filter((r: any) => r.type === 'policy_acknowledgment')
      .pop();

    if (!signatureResponse) {
      return NextResponse.json({ error: 'No signature response found' }, { status: 400 });
    }

    const storedHash = signatureResponse.compositeSealHash;
    if (!storedHash) {
      // Legacy signature — no composite hash was stored (pre-compliance upgrade)
      return NextResponse.json({
        valid: false,
        reason: 'legacy_signature',
        message: 'This signature was created before the tamper-evident sealing system was implemented. A policy-only SHA-256 hash may be available.',
        policyHash: signatureResponse.policyHash || null,
      });
    }

    // Re-compute the composite hash from stored data
    const sealPayload = JSON.stringify({
      policyText: interactiveContent.policyText || '',
      signatureData: signatureResponse.signature || signatureResponse.signatureData || '',
      typedName: signatureResponse.typedName || '',
      signerUid: signatureResponse.signerUid || signatureResponse.submittedBy || '',
      signerEmail: signatureResponse.signerEmail || '',
      timestamp: signatureResponse.submittedAt || '',
      documentVersionId: signatureResponse.documentVersionId || '',
    });

    const recomputedHash = crypto.createHash('sha256').update(sealPayload).digest('hex');
    const isValid = recomputedHash === storedHash;

    return NextResponse.json({
      valid: isValid,
      details: {
        storedHash,
        recomputedHash,
        documentVersionId: signatureResponse.documentVersionId || null,
        policyHash: signatureResponse.policyHash || null,
        signedAt: signatureResponse.submittedAt || null,
        signerEmail: signatureResponse.signerEmail || null,
        signerRole: signatureResponse.signerRole || null,
        esignConsentGranted: signatureResponse.esignConsentGranted ?? null,
      },
      message: isValid
        ? 'Document integrity verified — no tampering detected.'
        : 'WARNING: Hash mismatch detected — document may have been altered after signing.',
    });

  } catch (err: any) {
    console.error('[Verify Seal] Error:', err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to verify seal', details: err.message },
      { status: 500 },
    );
  }
}
