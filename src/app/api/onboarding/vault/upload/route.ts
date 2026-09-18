// ============================================================================
// POST /api/onboarding/vault/upload
//
// Securely uploads a compliance document (e.g. W-4, I-9, HIPAA agreement)
// to Firebase Storage under compliance_vault/${orgId}/${userId}/${category}/...
// and saves audit-ready metadata to Firestore (orgs/${orgId}/compliance_documents).
//
// Request formData:
//   file:              File    — The file binary (PDF, image, doc)
//   orgId:             string  — Organization ID (e.g. "nxtchapter")
//   documentCategory:  string  — Category key (e.g. "w4", "i9", "hipaa_42cfr")
//   taskId?:           string  — Optional Action Board task ID to attach to
//   targetUserId?:     string  — Optional UID (if admin is uploading for a user)
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { COMPLIANCE_CATEGORY_LABELS, type ComplianceDocumentCategory } from '@/types/onboarding-templates';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const orgId = formData.get('orgId') as string | null;
    const documentCategory = formData.get('documentCategory') as ComplianceDocumentCategory | null;
    const taskId = formData.get('taskId') as string | null;
    const targetUserId = formData.get('targetUserId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
    }
    if (!documentCategory) {
      return NextResponse.json({ error: 'Missing documentCategory' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds the 50MB limit (${(buffer.length / (1024 * 1024)).toFixed(1)}MB)` },
        { status: 400 },
      );
    }

    await initAdmin();
    const db = getAdminFirestore();

    // Determine target user
    const effectiveUserId = targetUserId && targetUserId !== auth.uid ? targetUserId : auth.uid;

    // Fetch user details for the record
    let targetEmail = auth.email;
    let targetName = auth.email.split('@')[0];

    try {
      const userDoc = await db.collection('users').doc(effectiveUserId).get();
      if (userDoc.exists) {
        const udata = userDoc.data();
        if (udata?.email) targetEmail = udata.email;
        if (udata?.displayName) targetName = udata.displayName;
      }
    } catch (uErr) {
      console.warn('[Vault Upload] User fetch warning:', uErr);
    }

    const fileName = file.name || 'document.pdf';
    const mimeType = file.type || 'application/octet-stream';
    const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const storagePath = `compliance_vault/${orgId}/${effectiveUserId}/${documentCategory}/${Date.now()}_${fileName}`;

    // ── 1. Upload to Firebase Storage ──
    const bucket = getStorage().bucket(firebaseConfig.storageBucket);
    const fileRef = bucket.file(storagePath);

    await fileRef.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          uploadedBy: auth.uid,
          uploadedByEmail: auth.email,
          orgId,
          userId: effectiveUserId,
          documentCategory,
          docId,
        },
      },
    });

    // Generate signed download URL
    const [downloadUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-01-2035', // 9-year signed URL
    });

    // ── 2. Store metadata in Firestore ──
    const docData = {
      id: docId,
      orgId,
      userId: effectiveUserId,
      userEmail: targetEmail,
      userName: targetName,
      documentCategory,
      fileName,
      fileSize: buffer.length,
      mimeType,
      downloadUrl,
      storagePath,
      status: 'pending_review',
      uploadedAt: FieldValue.serverTimestamp(),
      verifiedBy: null,
      verifiedByEmail: null,
      verifiedAt: null,
      notes: '',
      ...(taskId ? { taskId } : {}),
    };

    await db.collection('orgs').doc(orgId).collection('compliance_documents').doc(docId).set(docData);

    // ── 3. Update Action Board task if taskId provided ──
    if (taskId) {
      try {
        const taskRef = db.collection('action_board_tasks').doc(taskId);
        const taskDoc = await taskRef.get();
        if (taskDoc.exists) {
          const currentAttachments = taskDoc.data()?.attachments || [];
          const newAttachment = {
            name: fileName,
            url: downloadUrl,
            type: mimeType,
            uploadedAt: new Date().toISOString(),
          };

          await taskRef.update({
            attachments: [...currentAttachments, newAttachment],
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      } catch (tErr: any) {
        console.warn('[Vault Upload] Task attachment update warning:', tErr.message);
      }
    }

    // ── 4. Log to Audit Trail ──
    try {
      const categoryLabel = COMPLIANCE_CATEGORY_LABELS[documentCategory] || documentCategory;
      await db.collection('activity_log').add({
        type: 'file_uploaded',
        userEmail: auth.email,
        userName: auth.email.split('@')[0],
        orgDomain: auth.email.split('@')[1] || orgId,
        description: `${targetName} uploaded compliance document: ${categoryLabel} (${fileName})`,
        category: 'files',
        timestamp: FieldValue.serverTimestamp(),
        metadata: {
          action: 'compliance_document_uploaded',
          docId,
          fileName,
          documentCategory,
          orgId,
          userId: effectiveUserId,
          taskId: taskId || null,
        },
      });
    } catch (aErr) {
      console.warn('[Vault Upload] Audit log warning:', aErr);
    }

    return NextResponse.json({
      status: 'ok',
      documentId: docId,
      fileName,
      downloadUrl,
      documentCategory,
      verificationStatus: 'pending_review',
    });
  } catch (err: any) {
    console.error('[Vault Upload] Fatal error:', err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to upload compliance document', details: err.message },
      { status: 500 },
    );
  }
}
