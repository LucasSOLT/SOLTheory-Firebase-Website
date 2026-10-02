// ============================================================================
// POST /api/onboarding/pdf-form/process
//
// Processes a fillable PDF form submission:
//   1. Receives the original PDF (from Storage URL or uploaded bytes)
//   2. Fills AcroForm fields with user-supplied values
//   3. Stamps drawn signature image(s) onto designated coordinates
//   4. Flattens the PDF (locks all fields, prevents tampering)
//   5. Computes SHA-256 integrity seal
//   6. Uploads the sealed PDF to Firebase Storage
//   7. Creates a compliance_documents record in the org's vault
//   8. Optionally marks the associated onboarding task as complete
//
// Request body (JSON):
//   {
//     orgId: string,
//     taskId: string,                     // the action_board_tasks doc ID
//     pdfSourceUrl?: string,              // Firebase Storage URL of the template PDF
//     pdfSourceStoragePath?: string,      // OR: direct Storage path (preferred)
//     fields: Record<string, string|boolean>,  // field name → value
//     signatures?: PdfSignatureStamp[],   // optional signature overlays
//     signerName: string,                 // typed legal name
//     documentCategory: string,           // e.g. "w4", "i9", "fillable_pdf"
//   }
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import {
  fillAndFlattenPdf,
  computeSha256,
  type PdfSignatureStamp,
} from '@/lib/pdf-form-engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const {
      orgId,
      taskId,
      pdfSourceUrl,
      pdfSourceStoragePath,
      fields,
      signatures,
      signerName,
      documentCategory,
    } = body as {
      orgId: string;
      taskId: string;
      pdfSourceUrl?: string;
      pdfSourceStoragePath?: string;
      fields: Record<string, string | boolean>;
      signatures?: PdfSignatureStamp[];
      signerName: string;
      documentCategory?: string;
    };

    if (!orgId || !taskId) {
      return NextResponse.json({ error: 'Missing orgId or taskId' }, { status: 400 });
    }
    if (!fields || typeof fields !== 'object') {
      return NextResponse.json({ error: 'Missing or invalid fields object' }, { status: 400 });
    }
    if (!pdfSourceUrl && !pdfSourceStoragePath) {
      return NextResponse.json({ error: 'Missing PDF source (provide pdfSourceUrl or pdfSourceStoragePath)' }, { status: 400 });
    }

    await initAdmin();
    const db = getAdminFirestore();
    const bucket = getStorage().bucket(firebaseConfig.storageBucket);

    // ── 1. Fetch the original PDF template bytes ──
    let pdfBytes: Uint8Array;

    if (pdfSourceStoragePath) {
      // Direct Storage path (most reliable)
      const [buffer] = await bucket.file(pdfSourceStoragePath).download();
      pdfBytes = new Uint8Array(buffer);
    } else if (pdfSourceUrl) {
      // Fetch from URL (works for signed URLs)
      const response = await fetch(pdfSourceUrl);
      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch PDF from source URL' }, { status: 400 });
      }
      const arrayBuffer = await response.arrayBuffer();
      pdfBytes = new Uint8Array(arrayBuffer);
    } else {
      return NextResponse.json({ error: 'No PDF source provided' }, { status: 400 });
    }

    // ── 2. Fetch the task to get metadata ──
    const taskRef = db.collection('action_board_tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = taskDoc.data()!;
    const taskTitle = task.title || 'PDF Form Submission';

    // ── 3. Fetch signer info ──
    let signerEmail = auth.email;
    let signerDisplayName = signerName || auth.email.split('@')[0];

    try {
      const userDoc = await db.collection('users').doc(auth.uid).get();
      if (userDoc.exists) {
        const udata = userDoc.data();
        if (udata?.email) signerEmail = udata.email;
        if (udata?.displayName) signerDisplayName = udata.displayName;
      }
    } catch { /* use defaults */ }

    // ── 4. Fill, stamp, flatten, and seal ──
    const result = await fillAndFlattenPdf(pdfBytes, {
      fields,
      signatures,
    });

    const now = new Date();
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'N/A';
    const userAgent = req.headers.get('user-agent') || 'N/A';

    // Compute composite seal: hash of (flattened PDF hash + signer UID + timestamp)
    const compositeSealInput = `${result.sha256Hash}|${auth.uid}|${now.toISOString()}|${taskId}`;
    const compositeSealHash = computeSha256(compositeSealInput);

    // ── 5. Upload sealed PDF to Firebase Storage ──
    const safeTitle = (taskTitle)
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

    const effectiveCategory = documentCategory || 'fillable_pdf';
    const storagePath = `compliance_vault/${orgId}/${auth.uid}/${effectiveCategory}/${Date.now()}_${safeTitle}_filled.pdf`;
    const fileRef = bucket.file(storagePath);

    await fileRef.save(Buffer.from(result.pdfBytes), {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          uploadedBy: auth.uid,
          orgId,
          userId: auth.uid,
          documentCategory: effectiveCategory,
          taskId,
          sha256Hash: result.sha256Hash,
          compositeSealHash,
          fieldsFilled: String(result.fieldsFilled),
          signaturesApplied: String(result.signaturesApplied),
          generatedAt: now.toISOString(),
          flattened: 'true',
        },
      },
    });

    const [downloadUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-01-2035',
    });

    // ── 6. Catalogue in Compliance Vault ──
    const docId = `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await db.collection('orgs').doc(orgId).collection('compliance_documents').doc(docId).set({
      id: docId,
      orgId,
      userId: auth.uid,
      userEmail: signerEmail,
      userName: signerDisplayName,
      documentCategory: effectiveCategory,
      fileName: `${safeTitle}_filled.pdf`,
      fileSize: result.pdfBytes.length,
      mimeType: 'application/pdf',
      downloadUrl,
      storagePath,
      status: 'verified',
      uploadedAt: FieldValue.serverTimestamp(),
      verifiedBy: 'system',
      verifiedByEmail: 'system@soltheory.com',
      verifiedAt: FieldValue.serverTimestamp(),
      notes: `Auto-generated filled PDF form (${result.fieldsFilled} fields filled, ${result.signaturesApplied} signatures)`,
      taskId,
      sha256Hash: result.sha256Hash,
      compositeSealHash,
      documentVersionId: `PDFF-${taskId.substring(0, 8)}-${Date.now()}`,
      signedBy: signerDisplayName,
      signedByEmail: signerEmail,
      ipAddress,
      userAgent: userAgent.substring(0, 200),
    });

    // ── 7. Mark task as complete & store fill metadata ──
    await taskRef.update({
      column: 'done',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      'metadata.userResponse': FieldValue.arrayUnion({
        type: 'pdf_form_fill',
        submittedAt: now.toISOString(),
        fieldsFilled: result.fieldsFilled,
        signaturesApplied: result.signaturesApplied,
        sha256Hash: result.sha256Hash,
        compositeSealHash,
        downloadUrl,
        storagePath,
        signerName: signerDisplayName,
        signerEmail,
        signerUid: auth.uid,
        ipAddress,
        userAgent: userAgent.substring(0, 200),
      }),
    });

    // ── 8. Audit log ──
    try {
      await db.collection('activity_log').add({
        type: 'pdf_form_submitted',
        userEmail: signerEmail,
        userName: signerDisplayName,
        orgDomain: orgId,
        description: `PDF form filled and signed: ${taskTitle} (${result.fieldsFilled} fields, ${result.signaturesApplied} signatures)`,
        category: 'onboarding',
        timestamp: FieldValue.serverTimestamp(),
        metadata: {
          taskId,
          docId,
          storagePath,
          sha256Hash: result.sha256Hash,
          compositeSealHash,
        },
      });
    } catch { /* audit log is best-effort */ }

    return NextResponse.json({
      status: 'ok',
      downloadUrl,
      documentId: docId,
      fileName: `${safeTitle}_filled.pdf`,
      sha256Hash: result.sha256Hash,
      compositeSealHash,
      fieldsFilled: result.fieldsFilled,
      signaturesApplied: result.signaturesApplied,
    });

  } catch (err: any) {
    console.error('[PDF Form Process] Error:', err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to process PDF form', details: err.message },
      { status: 500 },
    );
  }
}
