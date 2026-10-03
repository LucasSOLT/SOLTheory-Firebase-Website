// ============================================================================
// lib/onboarding-archive.ts — Phase 4 "Send & Archive" core (SERVER-ONLY)
//
// Locked rules honored here:
//   • NEVER auto-send. This runs only when an admin/supervisor clicks
//     "Send & Archive" (POST /api/onboarding/send-archive).
//   • Recipients are derived from stored server data — never from the client.
//   • The sealed PDF is re-hashed and compared with its stored SHA-256 BEFORE
//     it is attached; a mismatch aborts the send.
//   • `archived` is final (no re-request / no more signatures). Individual
//     failed emails are retried via "resend_failed" without un-archiving.
//
// State lives on the signing session (multi-party) or on the vault document
// (single-signer PDF form); see ArchiveTarget.stateRef.
// ============================================================================

import { FieldValue } from 'firebase-admin/firestore';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import type { ArchiveDelivery, ArchiveRecord } from '@/types/onboarding-templates';
import { computeSha256 } from '@/lib/pdf-form-engine';
import { isDeveloper } from '@/lib/org-config';
import { createNotification, dashboardPath } from '@/lib/notifications';
import {
  MAX_ATTACHMENT_BYTES,
  absoluteUrl,
  isValidEmail,
  sendOnboardingEmail,
  type EmailContent,
  type MailResult,
} from '@/lib/onboarding-mailer';
import {
  SIGNING_SESSIONS,
  mirrorFor,
  type SigningSessionDoc,
} from '@/lib/onboarding-signing';

/** A claim younger than this blocks a second "Send" (double click / two admins). */
export const ARCHIVE_LEASE_MS = 2 * 60_000;
/** Minimum gap between "Resend to failed recipients" runs. */
export const RESEND_COOLDOWN_MS = 60_000;
const MAX_RECIPIENTS = 15;

export class ArchiveError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export interface ArchiveRecipient {
  email: string;
  name: string;
  role: ArchiveDelivery['role'];
}

export interface ArchiveTarget {
  kind: 'multi' | 'single';
  orgId: string;
  taskId: string;
  title: string;
  instanceId: string | null;
  employee: { uid: string; email: string; name: string };
  storagePath: string;
  sha256Hash: string;
  compositeSealHash: string;
  vaultDocId: string;
  executedAt: string;
  signers: { order: number; name: string; email: string; signedAt: string }[];
  recipients: ArchiveRecipient[];
  /** Doc that holds `archive` (session for multi, vault doc for single). */
  stateRef: DocumentReference;
  archive: ArchiveRecord | null;
  archived: boolean;
  /** Ready for the FIRST send (fully signed, not archived). */
  ready: boolean;
  /** Why it isn't ready (shown to the admin). */
  notReadyReason?: string;
  /** uid of everyone who should get an in-app notice. */
  participantUids: string[];
}

type Bucket = { file: (path: string) => { download: () => Promise<[Buffer]> } };

const lc = (s: unknown) => String(s ?? '').trim().toLowerCase();

async function emailForUid(db: Firestore, uid: string | null | undefined, fallback = ''): Promise<{ email: string; name: string }> {
  if (!uid) return { email: fallback, name: '' };
  try {
    const d = (await db.collection('users').doc(uid).get()).data() || {};
    return { email: d.email || fallback, name: d.displayName || d.name || '' };
  } catch {
    return { email: fallback, name: '' };
  }
}

/** De-duplicated (case-insensitive), validated, capped recipient list. */
function dedupeRecipients(list: ArchiveRecipient[]): ArchiveRecipient[] {
  const seen = new Set<string>();
  const out: ArchiveRecipient[] = [];
  for (const r of list) {
    const key = lc(r.email);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...r, email: r.email.trim() });
    if (out.length >= MAX_RECIPIENTS) break;
  }
  return out;
}

/**
 * Resolve everything Send & Archive needs from SERVER data only.
 * Throws ArchiveError(404) when the task isn't an archivable document.
 */
export async function loadArchiveTarget(db: Firestore, orgId: string, taskId: string): Promise<ArchiveTarget> {
  const taskSnap = await db.collection('action_board_tasks').doc(taskId).get();
  const task = taskSnap.data();
  if (!task || task.orgId !== orgId || task.category !== 'onboarding') {
    throw new ArchiveError(404, 'Document not found in this organization.');
  }
  const content = task.metadata?.interactiveContent;
  if (content?.type !== 'pdf_form') {
    throw new ArchiveError(404, 'This item is not a PDF document that can be archived.');
  }
  const instanceId: string | null = task.metadata?.onboardingInstanceId || null;

  // ── Multi-party session ────────────────────────────────────────────────
  const sessionRef = db.collection(SIGNING_SESSIONS).doc(taskId);
  const sessionSnap = await sessionRef.get();
  if (sessionSnap.exists) {
    const s = sessionSnap.data() as SigningSessionDoc;
    const archived = s.status === 'archived';
    const ready = s.status === 'fully_executed' && !!s.finalDocument;
    const recipients: ArchiveRecipient[] = [];
    for (const signer of [...s.signers].sort((a, b) => a.order - b.order)) {
      const email = signer.email || (await emailForUid(db, signer.uid)).email;
      recipients.push({
        email,
        name: signer.name || email,
        role: signer.uid === s.employeeUid ? 'employee' : 'signer',
      });
    }
    // The employee always gets a copy, even if they are not a signer.
    recipients.push({ email: s.employeeEmail, name: s.employeeName || s.employeeEmail, role: 'employee' });

    return {
      kind: 'multi',
      orgId,
      taskId,
      title: s.title || task.title || 'Document',
      instanceId: s.instanceId || instanceId,
      employee: { uid: s.employeeUid, email: s.employeeEmail, name: s.employeeName },
      storagePath: s.finalDocument?.storagePath || '',
      sha256Hash: s.finalDocument?.sha256Hash || '',
      compositeSealHash: s.finalDocument?.compositeSealHash || '',
      vaultDocId: s.finalDocument?.vaultDocId || '',
      executedAt: s.finalDocument?.executedAt || '',
      signers: s.completions.map((c) => ({ order: c.order, name: c.signerName, email: c.signerEmail, signedAt: c.signedAt })),
      recipients: dedupeRecipients(recipients),
      stateRef: sessionRef,
      archive: s.archive || null,
      archived,
      ready,
      notReadyReason: ready || archived ? undefined : 'This document has not been signed by everyone yet.',
      participantUids: Array.from(new Set([s.employeeUid, ...s.signers.map((x) => x.uid)].filter(Boolean))),
    };
  }

  // ── Single-signer PDF form ─────────────────────────────────────────────
  const responses: any[] = Array.isArray(task.metadata?.userResponse) ? task.metadata.userResponse : [];
  const latest = [...responses].reverse().find((r) => r?.type === 'pdf_form_fill' && r.storagePath);
  const notReady = (reason: string): ArchiveTarget => ({
    kind: 'single',
    orgId,
    taskId,
    title: task.title || 'Document',
    instanceId,
    employee: { uid: task.assignedTo || '', email: task.assignedToEmail || '', name: task.assignedToName || '' },
    storagePath: '',
    sha256Hash: '',
    compositeSealHash: '',
    vaultDocId: '',
    executedAt: '',
    signers: [],
    recipients: [],
    stateRef: db.collection('orgs').doc(orgId).collection('compliance_documents').doc('_none_'),
    archive: null,
    archived: false,
    ready: false,
    notReadyReason: reason,
    participantUids: [],
  });
  if (!latest || task.column !== 'done') return notReady('This document has not been completed and signed yet.');

  const vaultQuery = await db
    .collection('orgs')
    .doc(orgId)
    .collection('compliance_documents')
    .where('taskId', '==', taskId)
    .where('storagePath', '==', latest.storagePath)
    .limit(1)
    .get();
  if (vaultQuery.empty) return notReady('The sealed copy of this document was not found in the vault.');

  const vaultDoc = vaultQuery.docs[0];
  const v = vaultDoc.data();
  const archive = (v.archive as ArchiveRecord | undefined) || null;
  const archived = archive?.state === 'archived';

  const sup = instanceId ? (await db.collection('onboarding_instances').doc(instanceId).get()).data() : undefined;
  const supUid: string | null = sup?.supervisorUid || sup?.mentorUid || null;
  const supInfo = await emailForUid(db, supUid, sup?.supervisorEmail || sup?.mentorEmail || '');
  const employeeEmail = v.userEmail || task.assignedToEmail || '';
  const employeeName = v.userName || task.assignedToName || employeeEmail;
  const recipients: ArchiveRecipient[] = [{ email: employeeEmail, name: employeeName, role: 'employee' }];
  if (supInfo.email) recipients.push({ email: supInfo.email, name: supInfo.name || supInfo.email, role: 'supervisor' });

  const ready = !archived && v.status === 'verified';
  return {
    kind: 'single',
    orgId,
    taskId,
    title: task.title || 'Document',
    instanceId,
    employee: { uid: task.assignedTo || v.userId || '', email: employeeEmail, name: employeeName },
    storagePath: v.storagePath,
    sha256Hash: v.sha256Hash || latest.sha256Hash || '',
    compositeSealHash: v.compositeSealHash || latest.compositeSealHash || '',
    vaultDocId: vaultDoc.id,
    executedAt: latest.submittedAt || '',
    signers: [{ order: 1, name: v.signedBy || employeeName, email: v.signedByEmail || employeeEmail, signedAt: latest.submittedAt || '' }],
    recipients: dedupeRecipients(recipients),
    stateRef: vaultDoc.ref,
    archive,
    archived,
    ready,
    notReadyReason: ready || archived ? undefined : 'The sealed copy of this document is not available to send.',
    participantUids: Array.from(new Set([task.assignedTo, supUid].filter(Boolean) as string[])),
  };
}

/** Admin/oracle of the org, the track's supervisor, or a developer. Never the employee unless admin. */
export async function canSendArchive(db: Firestore, t: Pick<ArchiveTarget, 'orgId' | 'instanceId'>, uid: string, email: string): Promise<boolean> {
  if (isDeveloper(email)) return true;
  const role = (await db.doc(`orgs/${t.orgId}/members/${uid}`).get()).data()?.role;
  if (role === 'admin' || role === 'oracle') return true;
  if (t.instanceId) {
    const inst = (await db.collection('onboarding_instances').doc(t.instanceId).get()).data();
    if (inst && inst.orgId && inst.orgId !== t.orgId) return false;
    if (inst && (inst.supervisorUid === uid || inst.mentorUid === uid)) return true;
  }
  return false;
}

/**
 * Atomically claim the right to send. Re-reads state INSIDE the transaction
 * so two clicks can never both proceed.
 *  • send   → requires "ready", not archived, no fresh lease.
 *  • resend → requires archived and the resend cooldown to have passed.
 */
export async function claimArchive(db: Firestore, target: ArchiveTarget, uid: string, mode: 'send' | 'resend_failed'): Promise<ArchiveRecord> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(target.stateRef);
    const data = snap.data();
    if (!snap.exists || !data) throw new ArchiveError(404, 'Document record not found.');
    const a = (data.archive as ArchiveRecord | undefined) || null;
    const now = Date.now();

    if (mode === 'send') {
      if (a?.state === 'archived' || data.status === 'archived') {
        throw new ArchiveError(409, 'This document was already sent and archived.', { alreadyArchived: true });
      }
      if (a?.state === 'sending' && now - a.claimedAtMs < ARCHIVE_LEASE_MS) {
        throw new ArchiveError(409, 'A send is already in progress for this document. Please wait a moment.');
      }
      const readyNow = target.kind === 'multi' ? data.status === 'fully_executed' : data.status === 'verified';
      if (!readyNow) throw new ArchiveError(409, target.notReadyReason || 'This document is not ready to send.');
      const claim: ArchiveRecord = { state: 'sending', claimedBy: uid, claimedAtMs: now, deliveries: a?.deliveries || [] };
      tx.update(target.stateRef, { archive: claim });
      return claim;
    }

    // resend_failed
    if (a?.state !== 'archived') throw new ArchiveError(409, 'Only archived documents can be re-sent.');
    if (!a.deliveries.some((d) => d.status === 'failed')) throw new ArchiveError(409, 'Every recipient already received this document.');
    if (a.lastResendAtMs && now - a.lastResendAtMs < RESEND_COOLDOWN_MS) {
      throw new ArchiveError(429, 'Please wait a minute before resending again.');
    }
    const next: ArchiveRecord = { ...a, lastResendAtMs: now };
    tx.update(target.stateRef, { 'archive.lastResendAtMs': now });
    return next;
  });
}

/**
 * Release a failed first-send claim.
 *  • Nothing delivered before → drop the record entirely (nothing is locked).
 *  • Some recipients already got it (earlier partial attempt) → keep the
 *    delivery list and just expire the lease, so a retry skips them.
 */
export async function releaseClaim(
  target: ArchiveTarget,
  attempt: { by: string; errors: string[]; keepDeliveries?: boolean },
): Promise<void> {
  try {
    const log = { at: new Date().toISOString(), by: attempt.by, errors: attempt.errors.slice(0, 5) };
    if (attempt.keepDeliveries) {
      await target.stateRef.update({ 'archive.claimedAtMs': 0, archiveLastAttempt: log });
    } else {
      await target.stateRef.update({ archive: FieldValue.delete(), archiveLastAttempt: log });
    }
  } catch (e) {
    console.warn('[onboarding-archive] releaseClaim failed:', e);
  }
}

function archiveEmailContent(t: ArchiveTarget, r: ArchiveRecipient, attached: boolean, actorName: string): EmailContent {
  const when = t.executedAt
    ? new Date(t.executedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Denver' })
    : 'N/A';
  return {
    accent: '#0f766e',
    heading: 'Document fully executed',
    subheading: 'Your sealed copy',
    paragraphs: [
      `Hi ${r.name.split(' ')[0] || 'there'},`,
      attached
        ? `"${t.title}" for ${t.employee.name} has been signed by everyone and archived. The final, sealed PDF is attached to this email for your records.`
        : `"${t.title}" for ${t.employee.name} has been signed by everyone and archived. The file is too large to attach, so open it from your onboarding page using the button below.`,
      `Sent by ${actorName}.`,
    ],
    details: [
      { label: 'Document', value: t.title },
      { label: 'Employee', value: t.employee.name },
      { label: 'Fully executed', value: `${when} (Mountain Time)` },
      ...t.signers.map((s) => ({
        label: `Signer ${s.order}`,
        value: `${s.name}${s.signedAt ? ` — ${new Date(s.signedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Denver' })}` : ''}`,
      })),
      { label: 'SHA-256', value: t.sha256Hash || 'N/A', mono: true },
      ...(t.compositeSealHash ? [{ label: 'Seal', value: t.compositeSealHash, mono: true }] : []),
    ],
    cta: { label: 'Open onboarding page', url: absoluteUrl(dashboardPath(t.orgId, 'onboarding')) },
    footer:
      'This document was signed electronically under the ESIGN Act (15 U.S.C. § 7001 et seq.). The SHA-256 fingerprint above lets you verify the attached file has not been altered.',
  };
}

/**
 * Verify the PDF against its stored hash, then email each recipient on their
 * own. Returns the updated delivery list (merged with prior attempts).
 */
export async function deliverArchive(params: {
  target: ArchiveTarget;
  bucket: Bucket;
  recipients: ArchiveRecipient[];
  previous: ArchiveDelivery[];
  actorName: string;
}): Promise<ArchiveDelivery[]> {
  const { target, bucket, recipients, previous, actorName } = params;

  if (!target.storagePath || !target.sha256Hash) {
    throw new ArchiveError(500, 'The sealed document record is incomplete, so it was not sent.');
  }
  const [buf] = await bucket.file(target.storagePath).download();
  if (computeSha256(buf) !== target.sha256Hash) {
    throw new ArchiveError(500, 'Integrity check failed: the stored PDF no longer matches its seal. Nothing was sent.', { integrity: true });
  }
  const attach = buf.length <= MAX_ATTACHMENT_BYTES;
  const fileName = `${target.title.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').slice(0, 50) || 'Document'}_executed.pdf`;

  const byEmail = new Map(previous.map((d) => [lc(d.email), d]));
  for (const r of recipients) {
    let result: MailResult;
    if (!isValidEmail(r.email)) {
      result = { ok: false, error: 'Invalid or missing email address.' };
    } else {
      result = await sendOnboardingEmail({
        orgId: target.orgId,
        to: r.email,
        subject: `Fully executed: ${target.title} — ${target.employee.name}`,
        content: archiveEmailContent(target, r, attach, actorName),
        attachments: attach ? [{ filename: fileName, content: buf }] : undefined,
      });
    }
    const prev = byEmail.get(lc(r.email));
    byEmail.set(lc(r.email), {
      email: r.email,
      name: r.name,
      role: r.role,
      status: result.ok ? 'sent' : 'failed',
      ...(result.messageId ? { messageId: result.messageId } : {}),
      ...(!result.ok ? { error: result.error || 'Send failed' } : {}),
      at: new Date().toISOString(),
      attempts: (prev?.attempts || 0) + 1,
    });
  }
  return Array.from(byEmail.values());
}

/** Lock the document as archived (only after at least one email was delivered). */
export async function finalizeArchive(
  db: Firestore,
  target: ArchiveTarget,
  actor: { uid: string; email: string },
  deliveries: ArchiveDelivery[],
): Promise<ArchiveRecord> {
  const archivedAt = new Date().toISOString();
  const record: ArchiveRecord = {
    state: 'archived',
    claimedBy: actor.uid,
    claimedAtMs: Date.now(),
    archivedAt,
    archivedBy: actor.uid,
    archivedByEmail: actor.email,
    deliveries,
  };
  const taskRef = db.collection('action_board_tasks').doc(target.taskId);
  const vaultRef = db.collection('orgs').doc(target.orgId).collection('compliance_documents').doc(target.vaultDocId);
  const failed = deliveries.filter((d) => d.status === 'failed').length;

  await db.runTransaction(async (tx) => {
    const stateSnap = await tx.get(target.stateRef);
    const state = stateSnap.data();
    if (!state) throw new ArchiveError(404, 'Document record not found.');
    if (state.status === 'archived' || (state.archive as ArchiveRecord | undefined)?.state === 'archived') {
      throw new ArchiveError(409, 'This document was already sent and archived.', { alreadyArchived: true });
    }
    const vaultUpdate = {
      archived: true,
      archivedAt: FieldValue.serverTimestamp(),
      archivedBy: actor.uid,
      archivedByEmail: actor.email,
      signingStatus: 'archived',
    };
    if (target.kind === 'multi') {
      const next = { ...(state as SigningSessionDoc), status: 'archived' as const, archive: record };
      tx.update(target.stateRef, { status: 'archived', archive: record, updatedAt: FieldValue.serverTimestamp() });
      tx.update(taskRef, { 'metadata.signing': mirrorFor(next), updatedAt: FieldValue.serverTimestamp() });
      tx.update(vaultRef, vaultUpdate);
    } else {
      // single: the vault doc IS the state doc
      tx.update(target.stateRef, { archive: record, ...vaultUpdate });
      tx.update(taskRef, {
        'metadata.archivedAt': archivedAt,
        'metadata.archivedVaultDocId': target.vaultDocId,
        'metadata.archiveDeliveriesFailed': failed,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
  return record;
}

/** After a resend: persist the merged delivery list + refresh the display counter. */
export async function saveResendResult(db: Firestore, target: ArchiveTarget, deliveries: ArchiveDelivery[]): Promise<void> {
  const failed = deliveries.filter((d) => d.status === 'failed').length;
  const taskRef = db.collection('action_board_tasks').doc(target.taskId);
  await target.stateRef.update({ 'archive.deliveries': deliveries });
  await taskRef.update(
    target.kind === 'multi'
      ? { 'metadata.signing.deliveriesFailed': failed, updatedAt: FieldValue.serverTimestamp() }
      : { 'metadata.archiveDeliveriesFailed': failed, updatedAt: FieldValue.serverTimestamp() },
  );
}

/** In-app notice to the employee + signers (the actor is excluded automatically). Never throws. */
export async function notifyArchived(t: ArchiveTarget, actor: { uid: string; email: string }, archivedAt: string): Promise<void> {
  try {
    await createNotification({
      recipientUids: t.participantUids,
      actorUid: actor.uid,
      actorEmail: actor.email,
      orgId: t.orgId,
      type: 'onboarding_document_completed',
      title: 'Document archived',
      body: `"${t.title}" was fully executed and a sealed copy was emailed to you.`,
      link: dashboardPath(t.orgId, 'onboarding'),
      refId: t.taskId,
      dedupeKey: `onb-archived-${t.taskId}-${archivedAt}`,
    });
  } catch (e) {
    console.warn('[onboarding-archive] notifyArchived failed:', e);
  }
}
