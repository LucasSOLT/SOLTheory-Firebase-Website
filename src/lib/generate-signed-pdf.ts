// ============================================================================
// lib/generate-signed-pdf.ts
//
// Shared server-side utility that generates a legally compliant PDF certificate
// for an e-signature / policy acknowledgment. Used by both:
//   - POST /api/onboarding/submit-response (automatic generation on sign)
//   - POST /api/onboarding/generate-certificate (manual admin re-generation)
//
// The PDF embeds all ESIGN Act compliance elements:
//   1. Explicit electronic consent record
//   2. Authenticated signer identity (UID, email, role)
//   3. Full audit trail (timestamp, IP, User-Agent, Document Version ID)
//   4. Tamper-evident composite SHA-256 seal
//   5. Drawn signature image + typed legal name
// ============================================================================

import { jsPDF } from 'jspdf';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';

export interface SignedPdfInput {
  orgId: string;
  taskId: string;
  taskTitle: string;
  assignedTo: string; // uid of the signer

  // Signer identity
  signerName: string;
  signerEmail: string;
  signerRole?: string;
  signerUid: string;

  // Policy content
  policyText: string;
  acknowledgmentText: string;
  consentDisclosure?: string;

  // Signature data
  signatureData?: string; // base64 PNG
  typedName?: string;

  // Audit metadata
  submittedAt: string; // ISO string
  ipAddress: string;
  userAgent: string;
  policyHash: string;
  compositeSealHash: string;
  documentVersionId: string;
  esignConsentGranted: boolean;
  esignConsentTimestamp?: string;

  // Generator identity
  generatedByUid: string;
  generatedByEmail: string;
}

export interface SignedPdfResult {
  downloadUrl: string;
  documentId: string;
  fileName: string;
  storagePath: string;
  pdfBuffer: Buffer;
}

/**
 * Generates a legally compliant PDF certificate for a signed policy document,
 * uploads it to Firebase Storage, and catalogues it in the Compliance Vault.
 */
export async function generateSignedPdf(input: SignedPdfInput): Promise<SignedPdfResult> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper to add text with word wrap and page break handling
  const addWrappedText = (
    text: string, x: number, startY: number,
    maxWidth: number, lineHeight: number, fontSize: number,
    fontStyle: string = 'normal'
  ): number => {
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
  const orgLabel = input.orgId.charAt(0).toUpperCase() + input.orgId.slice(1);
  doc.text(
    `${orgLabel} • Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    pageWidth / 2, 31, { align: 'center' }
  );

  y = 46;
  doc.setTextColor(30, 41, 59);

  // ── Policy Title ──
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(input.taskTitle || 'Policy Acknowledgment', margin, y);
  y += 8;

  // ── Policy Text Excerpt ──
  const cleanPolicy = input.policyText
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^-\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, (match: string) => match);

  const excerpt = cleanPolicy.length > 1500
    ? cleanPolicy.substring(0, 1500) + '\n\n[... Full policy text on file ...]'
    : cleanPolicy;

  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 252); // slate-50
  const excerptBoxY = y;
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
  doc.text(`✓  ${input.acknowledgmentText}`, margin + 5, y + 9);
  y += 20;

  // ── Electronic Consent Record ──
  if (y > 250) { doc.addPage(); y = margin; }
  doc.setFillColor(219, 234, 254); // blue-100
  doc.setDrawColor(147, 197, 253); // blue-300
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175); // blue-800
  const consentText = input.esignConsentGranted
    ? '✓  Signer explicitly consented to electronic signature (ESIGN Act, 15 U.S.C. § 7001)'
    : '✗  Electronic consent was not explicitly recorded';
  doc.text(consentText, margin + 5, y + 9);
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
  const signingDate = new Date(input.submittedAt).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  });

  const signerFields: [string, string][] = [
    ['Full Legal Name:', input.typedName || input.signerName],
    ['Email Address:', input.signerEmail],
    ['User ID:', input.signerUid],
    ['Role:', input.signerRole || 'N/A'],
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

  if (input.signatureData && typeof input.signatureData === 'string' && input.signatureData.startsWith('data:image')) {
    doc.setDrawColor(148, 163, 184); // slate-400
    doc.setLineWidth(0.5);
    doc.rect(margin, y, 80, 30);

    try {
      doc.addImage(input.signatureData, 'PNG', margin + 2, y + 2, 76, 26);
    } catch {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text('[Signature image could not be embedded]', margin + 5, y + 16);
    }

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

  // ── Audit & Verification Block ──
  if (y > 220) { doc.addPage(); y = margin; }
  y += 4;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Audit & Verification Record', margin, y);
  y += 6;

  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  const auditBoxY = y;
  const auditBoxHeight = 42; // slightly taller for new fields
  doc.roundedRect(margin, y, contentWidth, auditBoxHeight, 2, 2, 'FD');
  y += 5;

  doc.setFontSize(7);
  doc.setFont('courier', 'normal');

  const auditFields = [
    `Document Version ID:    ${input.documentVersionId}`,
    `Policy Hash (SHA-256):  ${input.policyHash}`,
    `Composite Seal (SHA-256): ${input.compositeSealHash}`,
    `IP Address:             ${input.ipAddress}`,
    `User-Agent:             ${(input.userAgent).substring(0, 80)}`,
    `Task ID:                ${input.taskId}`,
    `ESIGN Consent:          ${input.esignConsentGranted ? 'YES' : 'NO'}${input.esignConsentTimestamp ? ` at ${input.esignConsentTimestamp}` : ''}`,
    `Organization:           ${input.orgId}`,
  ];

  for (const field of auditFields) {
    doc.text(field, margin + 3, y);
    y += 4;
  }
  y = auditBoxY + auditBoxHeight + 4;

  // ── ESIGN Act Footer ──
  if (y > 260) { doc.addPage(); y = margin; }
  y += 4;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  const disclosure = input.consentDisclosure
    || 'This electronic signature was provided in accordance with the ESIGN Act (15 U.S.C. § 7001 et seq.) and carries the same legal weight as a handwritten signature.';
  y = addWrappedText(disclosure, margin, y, contentWidth, 3.5, 7, 'italic');

  y += 4;
  doc.setFontSize(6);
  doc.text(`Certificate generated on ${new Date().toISOString()} by SOLTheory Onboarding Platform`, margin, y);

  // ── Convert to buffer ──
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

  // ── Upload to Firebase Storage ──
  const policyTitle = (input.taskTitle || 'policy_acknowledgment')
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);

  const storagePath = `compliance_vault/${input.orgId}/${input.assignedTo}/e_signatures/${Date.now()}_${policyTitle}.pdf`;
  const bucket = getStorage().bucket(firebaseConfig.storageBucket);
  const fileRef = bucket.file(storagePath);

  await fileRef.save(pdfBuffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        uploadedBy: input.generatedByUid,
        orgId: input.orgId,
        userId: input.assignedTo,
        documentCategory: 'e_signature',
        taskId: input.taskId,
        documentVersionId: input.documentVersionId,
        compositeSealHash: input.compositeSealHash,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  const [downloadUrl] = await fileRef.getSignedUrl({
    action: 'read',
    expires: '03-01-2035',
  });

  // ── Catalogue in Compliance Vault ──
  const db = getFirestore();
  const docId = `cert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await db.collection('orgs').doc(input.orgId).collection('compliance_documents').doc(docId).set({
    id: docId,
    orgId: input.orgId,
    userId: input.assignedTo,
    userEmail: input.signerEmail,
    userName: input.signerName,
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
    taskId: input.taskId,
    documentVersionId: input.documentVersionId,
    compositeSealHash: input.compositeSealHash,
    policyHash: input.policyHash,
    signerRole: input.signerRole || 'N/A',
    esignConsentGranted: input.esignConsentGranted,
  });

  // ── Audit log ──
  try {
    await db.collection('activity_log').add({
      type: 'certificate_generated',
      userEmail: input.generatedByEmail,
      userName: input.generatedByEmail.split('@')[0],
      orgDomain: input.orgId,
      description: `E-signature certificate generated for ${input.signerName}: ${input.taskTitle}`,
      category: 'onboarding',
      timestamp: FieldValue.serverTimestamp(),
      metadata: { taskId: input.taskId, docId, storagePath, documentVersionId: input.documentVersionId },
    });
  } catch { /* audit log is best-effort */ }

  return {
    downloadUrl,
    documentId: docId,
    fileName: `${policyTitle}.pdf`,
    storagePath,
    pdfBuffer,
  };
}
