// ============================================================================
// GET /api/onboarding/pdf-form/signing-session?taskId=XYZ
//
// Phase 3, Step 3.3 (Onboarding Document System — APPROVED PLAN)
//
// Returns the multi-party signing state of a parent onboarding task for the
// signing UI: who signs in what order, whose turn it is, which fields each
// signer owns, previous signers' signatures (shown read-only), and the final
// sealed document once fully executed.
//
// Access: participants (employee + every signer), the track's supervisor,
// org admins/oracles, developers. The session is created lazily if missing.
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { getStorage } from 'firebase-admin/storage';
import { firebaseConfig } from '@/firebase/config';
import {
  SigningSetupError,
  canViewSession,
  loadOrCreateSession,
  loadTemplateFields,
  readSignatureDataUrl,
} from '@/lib/onboarding-signing';
import { resolveAutoFill } from '@/lib/pdf-autofill';
import { canSendArchive } from '@/lib/onboarding-archive';
import { canReassignSigners } from '@/lib/onboarding-reassign';
import type { PdfFormContent } from '@/types/onboarding-templates';

export const runtime = 'nodejs';
export const maxDuration = 30;

const LOG_PREFIX = '[PDF Signing Session]';

export async function GET(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const taskId = new URL(req.url).searchParams.get('taskId');
    if (!taskId) return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });

    await initAdmin();
    const db = getAdminFirestore();
    const bucket = getStorage().bucket(firebaseConfig.storageBucket);

    const loaded = await loadOrCreateSession(db, bucket, taskId);
    if (!loaded) return NextResponse.json({ error: 'This document does not use multiple signers' }, { status: 404 });
    const { session, task } = loaded;

    if (!(await canViewSession(db, session, auth.uid, auth.email))) {
      return NextResponse.json({ error: 'You do not have access to this document' }, { status: 403 });
    }

    const content = task.metadata?.interactiveContent as PdfFormContent;
    const finished = session.status === 'fully_executed' || session.status === 'archived';
    const mySigner = session.signers.find((s) => s.uid === auth.uid && !session.completions.some((c) => c.order === s.order))
      ?? session.signers.find((s) => s.uid === auth.uid)
      ?? null;
    const isMyTurn = !finished && !!session.signers.find((s) => s.order === session.currentSignerOrder && s.uid === auth.uid);

    // Earlier signers' signatures, shown read-only on the preview. (They are
    // stamped into the PDF itself only at the final flatten.)
    const priorSignatures = await Promise.all(
      session.signatures.map(async (sig) => {
        try {
          return { order: sig.order, kind: sig.kind, imageDataUrl: await readSignatureDataUrl(bucket, sig.imagePath), stamps: sig.stamps };
        } catch {
          return { order: sig.order, kind: sig.kind, imageDataUrl: null, stamps: sig.stamps };
        }
      }),
    );

    // Phase 5: flag unsigned signers who are no longer org members (so an admin can reassign them).
    const stillMember = new Map<number, boolean>();
    await Promise.all(
      session.signers
        .filter((s) => !session.completions.some((c) => c.order === s.order))
        .map(async (s) => {
          try {
            stillMember.set(s.order, (await db.doc(`orgs/${session.orgId}/members/${s.uid}`).get()).exists);
          } catch {
            stillMember.set(s.order, true); // unknown → don't raise a false alarm
          }
        }),
    );
    const canReassign = !finished && (await canReassignSigners(db, session.orgId, auth.uid, auth.email));

    // Phase 6.2: read-only preview of the values the server will auto-fill for the signer
    // whose turn it is (the server recomputes them authoritatively on submit).
    let myAutoFill: Record<string, string> = {};
    const turnSigner = session.signers.find((s) => s.order === session.currentSignerOrder);
    if (isMyTurn && turnSigner && content?.autoFill) {
      try {
        const templateFields = await loadTemplateFields(bucket, content);
        myAutoFill = resolveAutoFill(content.autoFill, turnSigner.fieldNames, templateFields, { name: turnSigner.name, email: turnSigner.email });
      } catch {
        myAutoFill = {};
      }
    }

    return NextResponse.json(
      {
        taskId,
        title: session.title,
        employee: { uid: session.employeeUid, name: session.employeeName, email: session.employeeEmail },
        content: {
          pdfTitle: content?.pdfTitle,
          pageCount: content?.pageCount,
          requireEsignConsent: !!content?.requireEsignConsent,
        },
        status: session.status,
        round: session.round,
        currentSignerOrder: session.currentSignerOrder,
        signers: session.signers.map((s) => {
          const done = session.completions.find((c) => c.order === s.order);
          return {
            order: s.order,
            label: s.label,
            kind: s.kind,
            uid: s.uid,
            name: s.name,
            fieldNames: s.fieldNames,
            requireSignature: s.requireSignature,
            signatureBoxes: s.signatureBoxes,
            completed: !!done,
            signedAt: done?.signedAt ?? null,
            // false only when we positively know an unsigned signer left the org
            inOrg: done ? true : stillMember.get(s.order) !== false,
          };
        }),
        me: { order: isMyTurn ? session.currentSignerOrder : mySigner?.order ?? null, isMyTurn, autoFill: myAutoFill },
        priorSignatures,
        lastReRequest: session.history.length ? session.history[session.history.length - 1] : null,
        finalDocument: session.finalDocument
          ? { downloadUrl: session.finalDocument.downloadUrl, sha256Hash: session.finalDocument.sha256Hash, executedAt: session.finalDocument.executedAt }
          : null,
        // Phase 4: whether THIS viewer may Send & Archive (admin/oracle, track supervisor, developer)
        orgId: session.orgId,
        canReassign,
        canSendArchive: await canSendArchive(db, { orgId: session.orgId, instanceId: session.instanceId }, auth.uid, auth.email),
        archivedAt: session.status === 'archived' ? session.archive?.archivedAt ?? null : null,
        deliveriesFailed: (session.archive?.deliveries || []).filter((d) => d.status === 'failed').length,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    if (err instanceof SigningSetupError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(LOG_PREFIX, 'Error:', err?.message, err?.stack);
    return NextResponse.json({ error: 'Failed to load signing status' }, { status: 500 });
  }
}
