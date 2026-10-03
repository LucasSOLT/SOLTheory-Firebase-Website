// ============================================================================
// /api/onboarding/send-archive — Phase 4, Step 4.1 (APPROVED PLAN)
//
//   GET  ?orgId=&taskId=           → preview: who will receive it, current state
//   POST { orgId, taskId, mode }   → mode 'send' | 'resend_failed'
//
// Manual "Send & Archive" only — nothing here is ever auto-triggered.
// Access: developer, org admin/oracle, or the track's supervisor.
// Recipients are derived server-side; the client can never choose addresses.
// ============================================================================

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { firebaseConfig } from '@/firebase/config';
import {
  ArchiveError,
  canSendArchive,
  claimArchive,
  deliverArchive,
  finalizeArchive,
  loadArchiveTarget,
  notifyArchived,
  releaseClaim,
  saveResendResult,
  type ArchiveRecipient,
} from '@/lib/onboarding-archive';
import type { ArchiveDelivery } from '@/types/onboarding-templates';
import { logOnboardingAudit } from '@/lib/onboarding-audit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LOG_PREFIX = '[Onboarding:SendArchive]';
const lc = (s: unknown) => String(s ?? '').trim().toLowerCase();

const publicDelivery = (d: ArchiveDelivery) => ({
  email: d.email,
  name: d.name,
  role: d.role,
  status: d.status,
  ...(d.error ? { error: d.error } : {}),
  attempts: d.attempts,
});

function errorResponse(err: unknown) {
  if (err instanceof ArchiveError) {
    return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status });
  }
  console.error(LOG_PREFIX, 'Error:', (err as any)?.message, (err as any)?.stack);
  return NextResponse.json({ error: 'Something went wrong while sending the document.' }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const sp = new URL(req.url).searchParams;
    const orgId = sp.get('orgId');
    const taskId = sp.get('taskId');
    if (!orgId || !taskId) return NextResponse.json({ error: 'Missing orgId or taskId' }, { status: 400 });

    await initAdmin();
    const db = getAdminFirestore();
    const target = await loadArchiveTarget(db, orgId, taskId);
    if (!(await canSendArchive(db, target, auth.uid, auth.email))) {
      return NextResponse.json({ error: 'Only admins or the assigned supervisor can send and archive documents.' }, { status: 403 });
    }

    const deliveries = target.archive?.deliveries || [];
    return NextResponse.json(
      {
        status: 'ok',
        kind: target.kind,
        title: target.title,
        employeeName: target.employee.name,
        ready: target.ready,
        archived: target.archived,
        notReadyReason: target.notReadyReason || null,
        executedAt: target.executedAt || null,
        archivedAt: target.archive?.archivedAt || null,
        recipients: target.recipients,
        deliveries: deliveries.map(publicDelivery),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const orgId = typeof body.orgId === 'string' ? body.orgId : '';
    const taskId = typeof body.taskId === 'string' ? body.taskId : '';
    const mode = body.mode === 'resend_failed' ? 'resend_failed' : body.mode === 'send' ? 'send' : null;
    if (!orgId || !taskId || !mode) {
      return NextResponse.json({ error: 'Missing orgId, taskId or a valid mode' }, { status: 400 });
    }

    await initAdmin();
    const db = getAdminFirestore();
    const bucket = getStorage().bucket(firebaseConfig.storageBucket);

    const target = await loadArchiveTarget(db, orgId, taskId);
    if (!(await canSendArchive(db, target, auth.uid, auth.email))) {
      return NextResponse.json({ error: 'Only admins or the assigned supervisor can send and archive documents.' }, { status: 403 });
    }

    // Friendly sender name for the email body
    let actorName = auth.email.split('@')[0];
    try {
      const u = (await db.collection('users').doc(auth.uid).get()).data();
      if (u?.displayName) actorName = u.displayName;
    } catch { /* fall back to email prefix */ }
    const actor = { uid: auth.uid, email: auth.email };

    // ── Resend to failed recipients (document is already archived) ──
    if (mode === 'resend_failed') {
      const claim = await claimArchive(db, target, auth.uid, 'resend_failed');
      const failed: ArchiveRecipient[] = claim.deliveries
        .filter((d) => d.status === 'failed')
        .map((d) => ({ email: d.email, name: d.name, role: d.role }));
      const deliveries = await deliverArchive({ target, bucket, recipients: failed, previous: claim.deliveries, actorName });
      await saveResendResult(db, target, deliveries);
      await logAudit(db, target, actor, 'pdf_form_archive_resent', deliveries);
      return NextResponse.json({
        status: 'ok',
        state: 'archived',
        deliveries: deliveries.map(publicDelivery),
        failed: deliveries.filter((d) => d.status === 'failed').length,
      });
    }

    // ── First send ──
    if (target.archived) {
      return NextResponse.json({ error: 'This document was already sent and archived.', alreadyArchived: true }, { status: 409 });
    }
    if (!target.ready) {
      return NextResponse.json({ error: target.notReadyReason || 'This document is not ready to send.' }, { status: 409 });
    }
    if (target.recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients with a valid email address were found for this document.' }, { status: 422 });
    }
    // The vault record must exist BEFORE we email anyone, so archiving can't fail afterwards.
    const vaultSnap = await db.collection('orgs').doc(orgId).collection('compliance_documents').doc(target.vaultDocId).get();
    if (!vaultSnap.exists) {
      return NextResponse.json({ error: 'The vault record for this document is missing, so it was not sent.' }, { status: 500 });
    }

    const claim = await claimArchive(db, target, auth.uid, 'send');
    const previous = claim.deliveries;
    // A retry after a half-finished attempt never re-emails someone who already got it.
    const alreadySent = new Set(previous.filter((d) => d.status === 'sent').map((d) => lc(d.email)));
    const toSend = target.recipients.filter((r) => !alreadySent.has(lc(r.email)));

    let deliveries = previous;
    try {
      if (toSend.length > 0) {
        deliveries = await deliverArchive({ target, bucket, recipients: toSend, previous, actorName });
        // Persist immediately: if finalize fails below, a retry knows who already received it.
        await target.stateRef.update({ 'archive.deliveries': deliveries });
      }
    } catch (err) {
      await releaseClaim(target, {
        by: auth.uid,
        errors: [err instanceof ArchiveError ? err.message : String((err as any)?.message || err)],
        keepDeliveries: previous.some((d) => d.status === 'sent'),
      });
      throw err;
    }

    if (!deliveries.some((d) => d.status === 'sent')) {
      await releaseClaim(target, {
        by: auth.uid,
        errors: deliveries.map((d) => `${d.email}: ${d.error || 'failed'}`),
        keepDeliveries: false,
      });
      return NextResponse.json(
        {
          error: 'The email could not be delivered to anyone, so the document was NOT archived. You can try again.',
          deliveries: deliveries.map(publicDelivery),
        },
        { status: 502 },
      );
    }

    let record;
    try {
      record = await finalizeArchive(db, target, actor, deliveries);
    } catch (err) {
      if (err instanceof ArchiveError) throw err;
      console.error(LOG_PREFIX, 'finalize failed after sending:', (err as any)?.message);
      await releaseClaim(target, { by: auth.uid, errors: ['finalize failed'], keepDeliveries: true });
      return NextResponse.json(
        {
          error: 'The emails were sent but archiving did not finish. Click Send & Archive again — people who already received it will not be emailed twice.',
          deliveries: deliveries.map(publicDelivery),
        },
        { status: 500 },
      );
    }

    await notifyArchived(target, actor, record.archivedAt || new Date().toISOString());
    await logAudit(db, target, actor, 'pdf_form_archived', deliveries);

    return NextResponse.json({
      status: 'ok',
      state: 'archived',
      archivedAt: record.archivedAt,
      deliveries: deliveries.map(publicDelivery),
      failed: deliveries.filter((d) => d.status === 'failed').length,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

async function logAudit(
  db: FirebaseFirestore.Firestore,
  t: Awaited<ReturnType<typeof loadArchiveTarget>>,
  actor: { uid: string; email: string },
  type: 'pdf_form_archived' | 'pdf_form_archive_resent',
  deliveries: ArchiveDelivery[],
) {
  const sent = deliveries.filter((d) => d.status === 'sent').length;
  const failed = deliveries.length - sent;
  await logOnboardingAudit(db, {
    type,
    actor,
    orgDomain: t.orgId,
    taskId: t.taskId,
    description:
      type === 'pdf_form_archived'
        ? `"${t.title}" for ${t.employee.name} was sent and archived (${sent} emailed, ${failed} failed)`
        : `"${t.title}" re-sent to failed recipients (${sent} delivered in total, ${failed} still failing)`,
    documentSha256: t.sha256Hash,
    metadata: {
      docId: t.vaultDocId,
      kind: t.kind,
      sha256Hash: t.sha256Hash,
      compositeSealHash: t.compositeSealHash,
      recipients: deliveries.map((d) => ({ email: d.email, status: d.status })),
    },
  });
}
