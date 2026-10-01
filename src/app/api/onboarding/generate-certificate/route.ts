// ============================================================================
// POST /api/onboarding/generate-certificate
//
// Generates a formal PDF certificate for a completed e-signature / policy
// acknowledgment task. The PDF includes the policy excerpt, drawn signature,
// typed legal name, timestamp, IP, and a SHA-256 policy hash — all the data
// needed for ESIGN Act compliance and audit.
//
// After generation the PDF is uploaded to Firebase Storage and catalogued in
// the Compliance Vault (orgs/${orgId}/compliance_documents).
//
// This endpoint is used for manual re-generation by admins. Automatic
// generation on signing is handled by submit-response/route.ts.
//
// Request body:
//   { orgId: string, taskId: string }
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { generateSignedPdf } from '@/lib/generate-signed-pdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const { orgId, taskId } = await req.json();

    if (!orgId || !taskId) {
      return NextResponse.json({ error: 'Missing orgId or taskId' }, { status: 400 });
    }

    await initAdmin();
    const db = getAdminFirestore();

    // ── 1. Fetch the task ──
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

    const userResponses = (metadata.userResponse || []) as any[];
    const signatureResponse = userResponses
      .filter((r: any) => r.type === 'policy_acknowledgment')
      .pop();

    if (!signatureResponse) {
      return NextResponse.json({ error: 'No signature response found' }, { status: 400 });
    }

    // ── 2. Fetch signer info ──
    let signerName = signatureResponse.typedName || 'Unknown';
    let signerEmail = task.assignedToEmail || auth.email;

    try {
      const userDoc = await db.collection('users').doc(task.assignedTo).get();
      if (userDoc.exists) {
        const udata = userDoc.data();
        if (udata?.displayName) signerName = udata.displayName;
        if (udata?.email) signerEmail = udata.email;
      }
    } catch { /* use defaults */ }

    // ── 3. Look up signer's role (may be stored in response or looked up fresh) ──
    let signerRole = signatureResponse.signerRole || 'unknown';
    if (signerRole === 'unknown') {
      try {
        const memberDoc = await db.collection('orgs').doc(orgId).collection('members').doc(task.assignedTo).get();
        if (memberDoc.exists) {
          signerRole = memberDoc.data()?.role || 'user';
        }
      } catch { /* default */ }
    }

    // ── 4. Use stored compliance fields if available, or compute fallbacks ──
    const policyHash = signatureResponse.policyHash || 'N/A';
    const compositeSealHash = signatureResponse.compositeSealHash || 'N/A (legacy)';
    const documentVersionId = signatureResponse.documentVersionId || `DOC-${taskId.substring(0, 8)}-legacy-${Date.now()}`;
    const esignConsentGranted = signatureResponse.esignConsentGranted ?? false;
    const esignConsentTimestamp = signatureResponse.esignConsentTimestamp || null;

    // ── 5. Generate PDF using shared utility ──
    const result = await generateSignedPdf({
      orgId,
      taskId,
      taskTitle: task.title || 'Policy Acknowledgment',
      assignedTo: task.assignedTo,
      signerName,
      signerEmail,
      signerRole,
      signerUid: signatureResponse.signerUid || task.assignedTo,
      policyText: interactiveContent.policyText || '',
      acknowledgmentText: interactiveContent.acknowledgmentText || 'I have read and agree to the above policy.',
      consentDisclosure: interactiveContent.consentDisclosure,
      signatureData: signatureResponse.signature || signatureResponse.signatureData,
      typedName: signatureResponse.typedName,
      submittedAt: signatureResponse.submittedAt || new Date().toISOString(),
      ipAddress: signatureResponse.ipAddress || 'N/A',
      userAgent: signatureResponse.userAgent || 'N/A',
      policyHash,
      compositeSealHash,
      documentVersionId,
      esignConsentGranted,
      esignConsentTimestamp,
      generatedByUid: auth.uid,
      generatedByEmail: auth.email,
    });

    return NextResponse.json({
      status: 'ok',
      downloadUrl: result.downloadUrl,
      documentId: result.documentId,
      fileName: result.fileName,
    });

  } catch (err: any) {
    console.error('[Generate Certificate] Error:', err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to generate certificate', details: err.message },
      { status: 500 },
    );
  }
}
