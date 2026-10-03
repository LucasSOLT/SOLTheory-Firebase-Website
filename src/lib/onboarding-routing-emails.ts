// ============================================================================
// lib/onboarding-routing-emails.ts — Phase 4, Steps 4.2 & 4.3 (SERVER-ONLY)
//
// Automatic (non-"Send & Archive") onboarding-document emails:
//   • emailNextSigner      — "your signature is needed" (+ deep link)
//   • notifyReadyToArchive — in-app + email to reviewers when the LAST signer
//                            finishes ("fully executed — ready for Send & Archive")
//   • emailReRequest       — "changes requested" with the supervisor's notes
//
// Every function:
//   • NEVER throws and is time-boxed, so mail can't block or fail a request.
//   • Is exactly-once (`email_dispatch_log` claim; released when sending fails
//     so a retry can go through).
//   • Respects the org kill switch (`orgs/{org}.onboardingEmailsEnabled`).
//   • Never auto-sends a document — these emails only carry links, never the PDF.
// ============================================================================

import type { Firestore } from 'firebase-admin/firestore';
import { createNotification, dashboardPath } from '@/lib/notifications';
import { resolveReviewers } from '@/lib/onboarding-notifications';
import {
  absoluteUrl,
  automaticEmailsEnabled,
  claimDispatch,
  isValidEmail,
  releaseDispatch,
  sendOnboardingEmail,
} from '@/lib/onboarding-mailer';
import type { ResolvedSigner, SigningSessionDoc } from '@/lib/onboarding-signing';

const LOG_PREFIX = '[onboarding-routing-emails]';
/** Upper bound on how long a request waits for mail work. */
const EMAIL_TIMEOUT_MS = 8_000;
/** Ignore a second re-request email for the same task inside this window (double-clicks). */
const REREQUEST_EMAIL_COOLDOWN_MS = 15_000;

function withTimeout<T>(p: Promise<T>, fallback: T, ms = EMAIL_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

/** Deep link (path only) to the onboarding page opened on one document. */
export const signLinkPath = (orgId: string, taskId: string) => `${dashboardPath(orgId, 'onboarding')}?sign=${encodeURIComponent(taskId)}`;

async function emailForUid(db: Firestore, uid: string): Promise<{ email: string; name: string }> {
  try {
    const d = (await db.collection('users').doc(uid).get()).data() || {};
    return { email: String(d.email || '').trim(), name: String(d.displayName || d.name || '') };
  } catch {
    return { email: '', name: '' };
  }
}

/** Claim → send → release-on-failure. Returns true when an email actually went out. */
async function sendOnce(
  db: Firestore,
  key: string,
  send: () => Promise<{ ok: boolean }>,
): Promise<boolean> {
  if (!(await claimDispatch(db, key))) return false;
  const res = await send();
  if (!res.ok) await releaseDispatch(db, key);
  return res.ok;
}

// ── 4.2 — "Your signature is needed" ────────────────────────────────────────

export async function emailNextSigner(db: Firestore, s: SigningSessionDoc, signer: ResolvedSigner): Promise<boolean> {
  return withTimeout(
    (async () => {
      try {
        if (!(await automaticEmailsEnabled(db, s.orgId))) return false;
        const to = isValidEmail(signer.email) ? signer.email : (await emailForUid(db, signer.uid)).email;
        if (!isValidEmail(to)) return false;
        return await sendOnce(db, `sign-${s.parentTaskId}-r${s.round}-s${signer.order}-${signer.uid}`, () =>
          sendOnboardingEmail({
            orgId: s.orgId,
            to,
            subject: `Signature needed: ${s.title}`,
            content: {
              heading: 'Your signature is needed',
              subheading: s.title,
              paragraphs: [
                `Hi ${signer.name || 'there'},`,
                `${s.employeeName}'s "${s.title}" is ready for your part as ${signer.label || 'a signer'}. ` +
                  `Previous signers' sections are already filled in; yours is the next step.`,
              ],
              details: [
                { label: 'Document', value: s.title },
                { label: 'Employee', value: s.employeeName },
                { label: 'Your role', value: signer.label || 'Signer' },
                { label: 'Step', value: `${signer.order} of ${s.signers.length}` },
              ],
              cta: { label: 'Review & sign', url: absoluteUrl(signLinkPath(s.orgId, s.parentTaskId)) },
              footer: 'You are receiving this because you were assigned as a signer. You will be asked to log in first.',
            },
          }),
        );
      } catch (e) {
        console.warn(`${LOG_PREFIX} emailNextSigner failed:`, e);
        return false;
      }
    })(),
    false,
  );
}

// ── 4.2 — "Fully executed — ready for Send & Archive" ───────────────────────

/** In-app notification + email to the reviewers (supervisor + initiating admin, else org admins). */
export async function notifyReadyToArchive(
  db: Firestore,
  s: SigningSessionDoc,
  actor: { uid: string; email: string },
): Promise<void> {
  await withTimeout(
    (async () => {
      try {
        let instance: any = {};
        if (s.instanceId) {
          const snap = await db.collection('onboarding_instances').doc(s.instanceId).get();
          instance = snap.exists ? snap.data() || {} : {};
        }
        const task: any = (await db.collection('action_board_tasks').doc(s.parentTaskId).get()).data() || {};
        const reviewers = await resolveReviewers(s.orgId, instance, task);
        const key = `ready-archive-${s.parentTaskId}-r${s.round}`;
        const link = dashboardPath(s.orgId, 'onboarding');

        await createNotification({
          recipientUids: reviewers.uids,
          recipientEmails: reviewers.emails,
          actorUid: actor.uid,
          actorEmail: actor.email,
          orgId: s.orgId,
          type: 'onboarding_document_completed',
          title: 'Fully executed — ready to Send & Archive',
          body: `${s.employeeName}'s "${s.title}" has been signed by all ${s.signers.length} signers. Review it and click Send & Archive.`,
          link,
          refId: s.parentTaskId,
          dedupeKey: key,
          push: true,
        });

        if (!(await automaticEmailsEnabled(db, s.orgId))) return;
        const targets = new Set<string>();
        for (const e of reviewers.emails) if (isValidEmail(e)) targets.add(e.toLowerCase());
        for (const uid of reviewers.uids) {
          const e = (await emailForUid(db, uid)).email;
          if (isValidEmail(e)) targets.add(e.toLowerCase());
        }
        targets.delete((actor.email || '').toLowerCase()); // the actor is already looking at the button
        for (const to of targets) {
          await sendOnce(db, `${key}-${to}`, () =>
            sendOnboardingEmail({
              orgId: s.orgId,
              to,
              subject: `Ready to send & archive: ${s.title}`,
              content: {
                heading: 'Fully executed — ready to archive',
                subheading: s.title,
                paragraphs: [
                  `All ${s.signers.length} signers have completed "${s.title}" for ${s.employeeName}.`,
                  'Nothing is sent automatically. Open the document and click "Send & Archive" to deliver the final copy to everyone and lock it in the vault.',
                ],
                details: [
                  { label: 'Document', value: s.title },
                  { label: 'Employee', value: s.employeeName },
                  { label: 'Signers', value: s.signers.map((x) => x.name || x.label).join(', ') },
                ],
                cta: { label: 'Open onboarding', url: absoluteUrl(signLinkPath(s.orgId, s.parentTaskId)) },
              },
            }),
          );
        }
      } catch (e) {
        console.warn(`${LOG_PREFIX} notifyReadyToArchive failed:`, e);
      }
    })(),
    undefined,
  );
}

// ── 4.3 — Re-Request ────────────────────────────────────────────────────────

export interface ReRequestEmailParams {
  orgId: string;
  taskId: string;
  title: string;
  notes: string;
  requestedByEmail: string;
  requestedByName?: string;
  /** Person who has to redo the work (the task's assignee / the employee). */
  employeeUid?: string;
  employeeEmail?: string;
  employeeName?: string;
  /** Session round AFTER the reset (multi-party), if any. */
  round?: number;
  /** Millis of the previous `metadata.reRequestedAt` (0 if none) — dedupe for non-session tasks. */
  previousReRequestedMs?: number;
}

/** In-app + email to the person who must redo the item. Never emails the requester. */
export async function emailReRequest(db: Firestore, p: ReRequestEmailParams): Promise<boolean> {
  return withTimeout(
    (async () => {
      try {
        if (p.previousReRequestedMs && Date.now() - p.previousReRequestedMs < REREQUEST_EMAIL_COOLDOWN_MS) return false;

        let to = (p.employeeEmail || '').trim();
        if (!isValidEmail(to) && p.employeeUid) to = (await emailForUid(db, p.employeeUid)).email;
        if (!isValidEmail(to)) return false;
        if (to.toLowerCase() === (p.requestedByEmail || '').toLowerCase()) return false;

        const key = typeof p.round === 'number'
          ? `rereq-${p.taskId}-r${p.round}`
          : `rereq-${p.taskId}-${p.previousReRequestedMs || 0}`;
        const link = signLinkPath(p.orgId, p.taskId);

        // In-app (deduped by the same key; the notifications layer ignores repeats).
        await createNotification({
          recipientUids: p.employeeUid ? [p.employeeUid] : [],
          recipientEmails: p.employeeUid ? [] : [to],
          actorEmail: p.requestedByEmail,
          orgId: p.orgId,
          type: 'action_board_assigned',
          title: 'Changes requested on a document',
          body: `"${p.title}" was sent back: ${p.notes.slice(0, 160)}`,
          link,
          refId: p.taskId,
          dedupeKey: key,
          push: true,
        }).catch(() => 0);

        if (!(await automaticEmailsEnabled(db, p.orgId))) return false;
        return await sendOnce(db, key, () =>
          sendOnboardingEmail({
            orgId: p.orgId,
            to,
            subject: `Changes requested: ${p.title}`,
            content: {
              heading: 'Changes requested',
              subheading: p.title,
              paragraphs: [
                `Hi ${p.employeeName || 'there'},`,
                `${p.requestedByName || p.requestedByEmail || 'Your supervisor'} sent "${p.title}" back so it can be corrected and resubmitted.`,
              ],
              note: { title: 'What needs to change', text: p.notes },
              cta: { label: 'Open and resubmit', url: absoluteUrl(link) },
              accent: '#d97706',
              footer: 'Your previous answers were not lost. Open the item, make the changes above, and submit again.',
            },
          }),
        );
      } catch (e) {
        console.warn(`${LOG_PREFIX} emailReRequest failed:`, e);
        return false;
      }
    })(),
    false,
  );
}
