// ============================================================================
// POST /api/onboarding/pdf-form/sign-step
//
// Phase 3, Step 3.3 (Onboarding Document System — APPROVED PLAN)
//
// One signer completes THEIR portion of a multi-signer PDF:
//   1. Verify it is the caller's turn (and the round hasn't changed).
//   2. Accept values ONLY for fields this signer owns; validate signature
//      stamps sit inside this signer's signature boxes.
//   3. Partially fill the working PDF and lock this signer's fields
//      (read-only) — NO flatten (locked rule).
//   4. Record the completion atomically (transaction re-checks the turn).
//   5. Route to the next signer (countersign task + in-app notice), or — if
//      this was the LAST signer — flatten, stamp every signature, seal, and
//      file the executed PDF in the Compliance Vault.
//
// Nothing is ever emailed here. "Send & Archive" (Phase 4) stays manual.
//
// Request body (JSON):
//   {
//     taskId: string,                         // parent onboarding task
//     round: number,                          // session round the UI loaded
//     fields: Record<string, string|boolean>, // only this signer's fields
//     signature?: { imageData: string, stamps: {pageIndex,x,y,width,height}[] },
//     typedName?: string,
//     esignConsent?: boolean,
//   }
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { firebaseConfig } from '@/firebase/config';
import {
  computeSha256,
  fillPdfPartial,
  flattenAndStampPdf,
  type PdfSignatureStamp,
} from '@/lib/pdf-form-engine';
import { isStampInsideBoxes } from '@/lib/signing-workflow';
import {
  SIGNING_SESSIONS,
  SigningSetupError,
  countersignTaskData,
  loadOrCreateSession,
  loadTemplateFields,
  mirrorFor,
  notifyNextSigner,
  readSignatureDataUrl,
  sessionStorageDir,
  type SignatureRecord,
  type SigningSessionDoc,
} from '@/lib/onboarding-signing';
import { notifyOnboardingTaskCompleted } from '@/lib/onboarding-notifications';
import type { PdfFormContent, SignerCompletion } from '@/types/onboarding-templates';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LOG_PREFIX = '[PDF Sign Step]';
const MAX_SIGNATURE_DATA_URL = 1_500_000; // ~1.1 MB PNG
const MAX_STAMPS = 20;

class StepConflict extends Error {}

type StampBox = { pageIndex: number; x: number; y: number; width: number; height: number };

export async function POST(req: Request) {
  const uploadedPaths: string[] = [];
  let cleanupBucket: ReturnType<ReturnType<typeof getStorage>['bucket']> | null = null;
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { taskId, round, fields, signature, typedName, esignConsent } = body as {
      taskId: string;
      round: number;
      fields: Record<string, string | boolean>;
      signature?: { imageData?: string; stamps?: StampBox[] };
      typedName?: string;
      esignConsent?: boolean;
    };

    if (!taskId || typeof round !== 'number') {
      return NextResponse.json({ error: 'Missing taskId or round' }, { status: 400 });
    }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return NextResponse.json({ error: 'Missing or invalid fields object' }, { status: 400 });
    }

    await initAdmin();
    const db = getAdminFirestore();
    const bucket = getStorage().bucket(firebaseConfig.storageBucket);
    cleanupBucket = bucket;

    const loaded = await loadOrCreateSession(db, bucket, taskId);
    if (!loaded) return NextResponse.json({ error: 'This document does not use multiple signers' }, { status: 404 });
    const { session, task } = loaded;
    const content = task.metadata?.interactiveContent as PdfFormContent;

    // ── 1. Turn checks ──
    if (session.status === 'fully_executed' || session.status === 'archived') {
      return NextResponse.json({ error: 'This document has already been fully signed.' }, { status: 409 });
    }
    if (session.round !== round) {
      return NextResponse.json({ error: 'This document was sent back for changes. Please reload and try again.' }, { status: 409 });
    }
    const signer = session.signers.find((s) => s.order === session.currentSignerOrder);
    if (!signer) return NextResponse.json({ error: 'Signing order is invalid' }, { status: 500 });
    if (signer.uid !== auth.uid) {
      return NextResponse.json({ error: `It's not your turn to sign. Waiting on ${signer.name}.` }, { status: 403 });
    }

    // ── 2. Field ownership ──
    const owned = new Set(signer.fieldNames);
    const cleanFields: Record<string, string | boolean> = {};
    for (const [name, value] of Object.entries(fields)) {
      if (!owned.has(name)) {
        return NextResponse.json({ error: `You can't fill "${name}" — it belongs to another signer.` }, { status: 400 });
      }
      if (typeof value !== 'string' && typeof value !== 'boolean') {
        return NextResponse.json({ error: `Invalid value for "${name}"` }, { status: 400 });
      }
      cleanFields[name] = typeof value === 'string' ? value.slice(0, 5000) : value;
    }

    const templateFields = await loadTemplateFields(bucket, content);
    const missing = templateFields
      .filter((f) => f.required && owned.has(f.name) && f.type !== 'signature')
      .filter((f) => {
        const v = cleanFields[f.name];
        return f.type === 'checkbox' ? v !== true : typeof v !== 'string' || !v.trim();
      })
      .map((f) => f.tooltip || f.name);
    if (missing.length) {
      return NextResponse.json({ error: `Please complete: ${missing.slice(0, 5).join(', ')}` }, { status: 400 });
    }

    // ── 3. Consent, typed name, signature ──
    if (content.requireEsignConsent && !esignConsent) {
      return NextResponse.json({ error: 'Please agree to sign electronically.' }, { status: 400 });
    }
    const name = (typedName || '').trim().slice(0, 200);
    const imageData = signature?.imageData || '';
    const stamps = Array.isArray(signature?.stamps) ? signature!.stamps!.slice(0, MAX_STAMPS + 1) : [];

    if (signer.requireSignature) {
      if (!name) return NextResponse.json({ error: 'Please type your full legal name.' }, { status: 400 });
      if (!imageData) return NextResponse.json({ error: 'Please draw your signature.' }, { status: 400 });
      if (signer.signatureBoxes.length > 0 && stamps.length === 0) {
        return NextResponse.json({ error: 'Please place your signature in your signature box.' }, { status: 400 });
      }
    }
    if (imageData) {
      if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(imageData) || imageData.length > MAX_SIGNATURE_DATA_URL) {
        return NextResponse.json({ error: 'Invalid signature image' }, { status: 400 });
      }
    }
    if (stamps.length > MAX_STAMPS) {
      return NextResponse.json({ error: 'Too many signature placements' }, { status: 400 });
    }
    for (const st of stamps) {
      if (!isStampInsideBoxes(st, signer.signatureBoxes)) {
        return NextResponse.json({ error: 'Your signature must be inside your own signature box.' }, { status: 400 });
      }
    }
    if (stamps.length > 0 && !imageData) {
      return NextResponse.json({ error: 'Missing signature image' }, { status: 400 });
    }

    // ── 4. Partial fill (NO flatten) ──
    const sourcePath = session.workingPdfPath || session.templatePath;
    const [sourceBuf] = await bucket.file(sourcePath).download();
    const partial = await fillPdfPartial(new Uint8Array(sourceBuf), cleanFields, signer.fieldNames);

    const now = new Date();
    const ts = now.getTime();
    const dir = sessionStorageDir(session);
    const workingPath = `${dir}/r${session.round}_s${signer.order}_${ts}.pdf`;
    await bucket.file(workingPath).save(Buffer.from(partial.pdfBytes), {
      metadata: {
        contentType: 'application/pdf',
        metadata: { taskId, round: String(session.round), signerOrder: String(signer.order), sha256Hash: partial.sha256Hash, flattened: 'false' },
      },
    });
    uploadedPaths.push(workingPath);

    let newSignature: SignatureRecord | null = null;
    if (imageData) {
      const sigPath = `${dir}/r${session.round}_s${signer.order}_sig_${ts}.png`;
      await bucket.file(sigPath).save(Buffer.from(imageData.replace(/^data:image\/png;base64,/, ''), 'base64'), {
        metadata: { contentType: 'image/png' },
      });
      uploadedPaths.push(sigPath);
      newSignature = {
        order: signer.order,
        imagePath: sigPath,
        stamps: stamps.map(({ pageIndex, x, y, width, height }) => ({ pageIndex, x, y, width, height })),
      };
    }

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'N/A';
    const userAgent = (req.headers.get('user-agent') || 'N/A').substring(0, 200);
    const completion: SignerCompletion = {
      order: signer.order,
      signerUid: auth.uid,
      signerEmail: signer.email || auth.email,
      signerName: signer.name,
      typedName: name,
      signedAt: now.toISOString(),
      ipAddress,
      userAgent,
      fieldsFilled: partial.fieldsFilled,
      signaturesApplied: newSignature?.stamps.length ?? 0,
      partialPdfSha256: partial.sha256Hash,
      esignConsent: !!esignConsent,
    };

    const isLast = signer.order === session.signers.length;
    const nextSigner = isLast ? null : session.signers.find((s) => s.order === signer.order + 1) || null;
    const isEmployeeStep = signer.uid === session.employeeUid;
    // Decision 1 (A): the employee's task is done once THEY sign. If the
    // employee isn't a signer at all, it completes when the document does.
    const employeeSigns = session.signers.some((s) => s.uid === session.employeeUid);
    const completesParent = isEmployeeStep || (isLast && !employeeSigns);
    const allCompletions = [...session.completions, completion];
    const allSignatures = newSignature ? [...session.signatures, newSignature] : [...session.signatures];

    // ── 5. LAST signer → flatten + stamp + seal (still before the transaction) ──
    let finalDocument: SigningSessionDoc['finalDocument'] = null;
    let vaultDoc: Record<string, unknown> | null = null;
    if (isLast) {
      const stampList: PdfSignatureStamp[] = [];
      for (const sig of allSignatures) {
        const dataUrl = sig === newSignature ? imageData : await readSignatureDataUrl(bucket, sig.imagePath);
        for (const st of sig.stamps) stampList.push({ imageData: dataUrl, ...st });
      }
      const executed = await flattenAndStampPdf(partial.pdfBytes, stampList);
      const signerChain = allCompletions.map((c) => `${c.signerUid}@${c.signedAt}`).join(',');
      const compositeSealHash = computeSha256(`${executed.sha256Hash}|${signerChain}|${taskId}`);

      const safeTitle = (session.title || 'Document').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
      const category = session.documentCategory || 'fillable_pdf';
      const finalPath = `compliance_vault/${session.orgId}/${session.employeeUid}/${category}/${ts}_${safeTitle}_executed.pdf`;
      const finalRef = bucket.file(finalPath);
      await finalRef.save(Buffer.from(executed.pdfBytes), {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            uploadedBy: auth.uid,
            orgId: session.orgId,
            userId: session.employeeUid,
            documentCategory: category,
            taskId,
            sha256Hash: executed.sha256Hash,
            compositeSealHash,
            signers: String(allCompletions.length),
            signaturesApplied: String(executed.signaturesApplied),
            generatedAt: now.toISOString(),
            flattened: 'true',
          },
        },
      });
      uploadedPaths.push(finalPath);
      const [downloadUrl] = await finalRef.getSignedUrl({ action: 'read', expires: '03-01-2035' });

      const vaultDocId = `pdfms_${ts}_${Math.random().toString(36).slice(2, 7)}`;
      finalDocument = {
        storagePath: finalPath,
        downloadUrl,
        sha256Hash: executed.sha256Hash,
        compositeSealHash,
        vaultDocId,
        executedAt: now.toISOString(),
      };
      vaultDoc = {
        id: vaultDocId,
        orgId: session.orgId,
        userId: session.employeeUid,
        userEmail: session.employeeEmail,
        userName: session.employeeName,
        documentCategory: category,
        fileName: `${safeTitle}_executed.pdf`,
        fileSize: executed.pdfBytes.length,
        mimeType: 'application/pdf',
        downloadUrl,
        storagePath: finalPath,
        status: 'verified',
        uploadedAt: FieldValue.serverTimestamp(),
        verifiedBy: 'system',
        verifiedByEmail: 'system@soltheory.com',
        verifiedAt: FieldValue.serverTimestamp(),
        notes: `Fully executed multi-party PDF (${allCompletions.length} signers, ${executed.signaturesApplied} signatures)`,
        taskId,
        sha256Hash: executed.sha256Hash,
        compositeSealHash,
        documentVersionId: `PDFMS-${taskId.substring(0, 8)}-${ts}`,
        signedBy: allCompletions.map((c) => c.signerName).join(', '),
        signedByEmail: session.employeeEmail,
        signers: allCompletions.map((c) => ({
          order: c.order,
          uid: c.signerUid,
          name: c.signerName,
          email: c.signerEmail,
          typedName: c.typedName,
          signedAt: c.signedAt,
          ipAddress: c.ipAddress,
        })),
        signingStatus: 'fully_executed',
        ipAddress,
        userAgent,
      };
    }

    // ── 6. Commit atomically (re-check the turn inside the transaction) ──
    const sessionRef = db.collection(SIGNING_SESSIONS).doc(taskId);
    const parentRef = db.collection('action_board_tasks').doc(taskId);
    const countersignRef = nextSigner && nextSigner.uid !== session.employeeUid
      ? db.collection('action_board_tasks').doc()
      : null;

    const updated: SigningSessionDoc = await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(sessionRef)).data() as SigningSessionDoc | undefined;
      if (
        !fresh ||
        fresh.round !== session.round ||
        fresh.currentSignerOrder !== signer.order ||
        fresh.status === 'fully_executed' ||
        fresh.status === 'archived'
      ) {
        throw new StepConflict();
      }

      const next: SigningSessionDoc = {
        ...fresh,
        completions: allCompletions,
        signatures: allSignatures,
        workingPdfPath: workingPath,
        currentSignerOrder: isLast ? signer.order : signer.order + 1,
        status: isLast ? 'fully_executed' : 'partially_signed',
        openCountersignTaskId: countersignRef?.id ?? null,
        finalDocument,
      };

      tx.update(sessionRef, {
        completions: next.completions,
        signatures: next.signatures,
        workingPdfPath: next.workingPdfPath,
        currentSignerOrder: next.currentSignerOrder,
        status: next.status,
        openCountersignTaskId: next.openCountersignTaskId,
        finalDocument: next.finalDocument,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Parent task: mirror always; employee step → done (Decision 1 = A).
      const responses: Record<string, unknown>[] = [];
      if (isEmployeeStep) {
        responses.push({
          type: 'pdf_form_sign_step',
          submittedAt: completion.signedAt,
          signerOrder: signer.order,
          totalSigners: session.signers.length,
          fieldsFilled: completion.fieldsFilled,
          signaturesApplied: completion.signaturesApplied,
          partialPdfSha256: completion.partialPdfSha256,
          signerName: signer.name,
          signerEmail: completion.signerEmail,
          signerUid: auth.uid,
          typedName: name,
          ipAddress,
          userAgent,
        });
      }
      if (finalDocument) {
        responses.push({
          type: 'pdf_form_fill',
          multiParty: true,
          submittedAt: finalDocument.executedAt,
          fieldsFilled: allCompletions.reduce((n, c) => n + c.fieldsFilled, 0),
          signaturesApplied: allCompletions.reduce((n, c) => n + c.signaturesApplied, 0),
          sha256Hash: finalDocument.sha256Hash,
          compositeSealHash: finalDocument.compositeSealHash,
          downloadUrl: finalDocument.downloadUrl,
          storagePath: finalDocument.storagePath,
          signers: allCompletions.map((c) => ({ order: c.order, name: c.signerName, uid: c.signerUid, signedAt: c.signedAt })),
        });
      }
      tx.update(parentRef, {
        'metadata.signing': mirrorFor(next),
        updatedAt: FieldValue.serverTimestamp(),
        ...(completesParent ? { column: 'done', completedAt: FieldValue.serverTimestamp() } : {}),
        ...(responses.length ? { 'metadata.userResponse': FieldValue.arrayUnion(...responses) } : {}),
      });

      if (fresh.openCountersignTaskId) {
        tx.update(db.collection('action_board_tasks').doc(fresh.openCountersignTaskId), {
          column: 'done',
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      if (countersignRef && nextSigner) {
        tx.set(countersignRef, countersignTaskData(next, nextSigner, task, countersignRef.id));
      }
      if (vaultDoc) {
        tx.set(db.collection('orgs').doc(session.orgId).collection('compliance_documents').doc(String(vaultDoc.id)), vaultDoc);
      }
      return next;
    });

    // ── 7. After commit: notifications + audit (never block success) ──
    if (completesParent) {
      await notifyOnboardingTaskCompleted({ orgId: session.orgId, taskId, actorUid: auth.uid, actorEmail: auth.email });
    }
    if (nextSigner) {
      await notifyNextSigner(updated, nextSigner, auth.uid);
    }
    try {
      await db.collection('activity_log').add({
        type: isLast ? 'pdf_form_fully_executed' : 'pdf_form_sign_step',
        userEmail: completion.signerEmail,
        userName: signer.name,
        orgDomain: session.orgId,
        description: isLast
          ? `"${session.title}" fully executed (${allCompletions.length} signers) for ${session.employeeName}`
          : `${signer.name} signed "${session.title}" (signer ${signer.order} of ${session.signers.length}) for ${session.employeeName}`,
        category: 'onboarding',
        timestamp: FieldValue.serverTimestamp(),
        metadata: {
          taskId,
          round: session.round,
          signerOrder: signer.order,
          partialPdfSha256: partial.sha256Hash,
          ...(finalDocument ? { sha256Hash: finalDocument.sha256Hash, compositeSealHash: finalDocument.compositeSealHash, docId: finalDocument.vaultDocId } : {}),
        },
      });
    } catch { /* audit log is best-effort */ }

    return NextResponse.json({
      status: 'ok',
      signingStatus: updated.status,
      nextSigner: nextSigner ? { order: nextSigner.order, name: nextSigner.name, label: nextSigner.label } : null,
      finalDocument: finalDocument ? { downloadUrl: finalDocument.downloadUrl, sha256Hash: finalDocument.sha256Hash } : null,
    });
  } catch (err: any) {
    // Clean up anything uploaded for a step that didn't commit.
    const b = cleanupBucket;
    if (b) await Promise.all(uploadedPaths.map((p) => b.file(p).delete().catch(() => undefined)));
    if (err instanceof StepConflict) {
      return NextResponse.json({ error: 'Someone else updated this document. Please reload and try again.' }, { status: 409 });
    }
    if (err instanceof SigningSetupError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(LOG_PREFIX, 'Error:', err?.message, err?.stack);
    return NextResponse.json({ error: 'Failed to save your signature' }, { status: 500 });
  }
}
