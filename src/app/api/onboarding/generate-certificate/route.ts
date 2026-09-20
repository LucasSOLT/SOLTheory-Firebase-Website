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
// Request body:
//   { orgId: string, taskId: string }
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import { jsPDF } from 'jspdf';

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

    // ── 3. Generate PDF ──
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // Helper to add text with word wrap and page break handling
    const addWrappedText = (text: string, x: number, startY: number, maxWidth: number, lineHeight: number, fontSize: number, fontStyle: string = 'normal'): number => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        if (startY > 270) {
          doc.addPage();
          startY = margin;
        }
        doc.text(line, x, startY);
        startY += lineHeight;
      }
      return startY;
    };

    // ── Header ──
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(0, 0, pageWidth, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Certificate of Acknowledgment', pageWidth / 2, 16, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Electronic Signature Record — ESIGN Act Compliant', pageWidth / 2, 24, { align: 'center' });

    doc.setFontSize(8);
    const orgLabel = orgId.charAt(0).toUpperCase() + orgId.slice(1);
    doc.text(`${orgLabel} • Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, 31, { align: 'center' });

    y = 46;
    doc.setTextColor(30, 41, 59);

    // ── Policy Title ──
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(task.title || 'Policy Acknowledgment', margin, y);
    y += 8;

    // ── Policy Text Excerpt ──
    const policyText = interactiveContent.policyText || '';
    // Strip markdown formatting for PDF
    const cleanPolicy = policyText
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^-\s+/gm, '• ')
      .replace(/^\d+\.\s+/gm, (match: string) => match);

    // Show first ~1500 chars with ellipsis
    const excerpt = cleanPolicy.length > 1500
      ? cleanPolicy.substring(0, 1500) + '\n\n[... Full policy text on file ...]'
      : cleanPolicy;

    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 250, 252); // slate-50
    const excerptBoxY = y;
    // Calculate box height based on text
    doc.setFontSize(8);
    const excerptLines = doc.splitTextToSize(excerpt, contentWidth - 10);
    const excerptHeight = Math.min(excerptLines.length * 3.5 + 8, 120);

    doc.roundedRect(margin, y, contentWidth, excerptHeight, 2, 2, 'FD');
    y += 5;
    y = addWrappedText(excerpt, margin + 5, y, contentWidth - 10, 3.5, 8);
    y = Math.max(y, excerptBoxY + excerptHeight) + 6;

    // ── Acknowledgment Statement ──
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.setDrawColor(167, 243, 208); // emerald-300
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 95, 70); // emerald-800
    const ackText = interactiveContent.acknowledgmentText || 'I have read and agree to the above policy.';
    doc.text(`✓  ${ackText}`, margin + 5, y + 9);
    y += 20;

    doc.setTextColor(30, 41, 59);

    // ── Signer Information ──
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Signer Information', margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const signingDate = signatureResponse.submittedAt
      ? new Date(signatureResponse.submittedAt).toLocaleString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
        })
      : 'Unknown';

    const signerFields = [
      ['Full Legal Name:', signatureResponse.typedName || signerName],
      ['Email Address:', signerEmail],
      ['Date & Time:', signingDate],
    ];

    for (const [label, value] of signerFields) {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, margin + 38, y);
      y += 5;
    }
    y += 4;

    // ── Signature Image ──
    if (y > 220) { doc.addPage(); y = margin; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Electronic Signature', margin, y);
    y += 6;

    const signatureData = signatureResponse.signature || signatureResponse.signatureData;
    if (signatureData && typeof signatureData === 'string' && signatureData.startsWith('data:image')) {
      // Draw a signature box
      doc.setDrawColor(148, 163, 184); // slate-400
      doc.setLineWidth(0.5);
      doc.rect(margin, y, 80, 30);

      try {
        doc.addImage(signatureData, 'PNG', margin + 2, y + 2, 76, 26);
      } catch {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('[Signature image could not be embedded]', margin + 5, y + 16);
      }

      // "X" line under signature
      doc.setDrawColor(100, 116, 139);
      doc.line(margin, y + 30, margin + 80, y + 30);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Authorized Signature', margin + 20, y + 34);
      y += 40;
    } else {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(148, 163, 184);
      doc.text('[No drawn signature — typed name acknowledgment only]', margin, y);
      y += 8;
    }

    doc.setTextColor(30, 41, 59);

    // ── Audit / Verification Block ──
    if (y > 230) { doc.addPage(); y = margin; }
    y += 4;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Audit & Verification Record', margin, y);
    y += 6;

    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(203, 213, 225); // slate-300
    const auditBoxY = y;
    doc.roundedRect(margin, y, contentWidth, 34, 2, 2, 'FD');
    y += 5;

    doc.setFontSize(7);
    doc.setFont('courier', 'normal');

    const auditFields = [
      `Policy Hash (SHA-256):  ${signatureResponse.policyHash || 'N/A'}`,
      `IP Address:             ${signatureResponse.ipAddress || 'N/A'}`,
      `User-Agent:             ${(signatureResponse.userAgent || 'N/A').substring(0, 80)}`,
      `Task ID:                ${taskId}`,
      `Submission ID:          ${signatureResponse.submittedAt || 'N/A'}`,
      `Organization:           ${orgId}`,
    ];

    for (const field of auditFields) {
      doc.text(field, margin + 3, y);
      y += 4;
    }
    y = auditBoxY + 38;

    // ── ESIGN Act Footer ──
    if (y > 260) { doc.addPage(); y = margin; }
    y += 4;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    const disclosure = interactiveContent.consentDisclosure
      || 'This electronic signature was provided in accordance with the ESIGN Act (15 U.S.C. § 7001 et seq.) and carries the same legal weight as a handwritten signature.';
    y = addWrappedText(disclosure, margin, y, contentWidth, 3.5, 7, 'italic');

    y += 4;
    doc.setFontSize(6);
    doc.text(`Certificate generated on ${new Date().toISOString()} by SOLTheory Onboarding Platform`, margin, y);

    // ── 4. Convert to buffer ──
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // ── 5. Upload to Firebase Storage ──
    const policyTitle = (task.title || 'policy_acknowledgment')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

    const storagePath = `compliance_vault/${orgId}/${task.assignedTo}/e_signatures/${Date.now()}_${policyTitle}.pdf`;
    const bucket = getStorage().bucket(firebaseConfig.storageBucket);
    const fileRef = bucket.file(storagePath);

    await fileRef.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          uploadedBy: auth.uid,
          orgId,
          userId: task.assignedTo,
          documentCategory: 'e_signature',
          taskId,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    const [downloadUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-01-2035',
    });

    // ── 6. Catalogue in Compliance Vault ──
    const docId = `cert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await db.collection('orgs').doc(orgId).collection('compliance_documents').doc(docId).set({
      id: docId,
      orgId,
      userId: task.assignedTo,
      userEmail: signerEmail,
      userName: signerName,
      documentCategory: 'e_signature',
      fileName: `${policyTitle}.pdf`,
      fileSize: pdfBuffer.length,
      mimeType: 'application/pdf',
      downloadUrl,
      storagePath,
      status: 'verified',
      uploadedAt: FieldValue.serverTimestamp(),
      verifiedBy: 'system',
      verifiedByEmail: 'system@soltheory.com',
      verifiedAt: FieldValue.serverTimestamp(),
      notes: 'Auto-generated e-signature certificate',
      taskId,
    });

    // ── 7. Audit log ──
    try {
      await db.collection('activity_log').add({
        type: 'certificate_generated',
        userEmail: auth.email,
        userName: auth.email.split('@')[0],
        orgDomain: orgId,
        description: `E-signature certificate generated for ${signerName}: ${task.title}`,
        category: 'onboarding',
        timestamp: FieldValue.serverTimestamp(),
        metadata: { taskId, docId, storagePath },
      });
    } catch { /* audit log is best-effort */ }

    return NextResponse.json({
      status: 'ok',
      downloadUrl,
      documentId: docId,
      fileName: `${policyTitle}.pdf`,
    });

  } catch (err: any) {
    console.error('[Generate Certificate] Error:', err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to generate certificate', details: err.message },
      { status: 500 },
    );
  }
}
