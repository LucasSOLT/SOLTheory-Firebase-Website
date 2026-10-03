// ============================================================================
// lib/onboarding-reminders.ts — Phase 6.1 (SERVER-ONLY)
//
// Stalled-signature reminders + escalation for multi-signer documents.
//
// Why a separate sweep: the older nudge cron walks the EMPLOYEE's tasks of
// in-progress instances. Countersign tasks (supervisor / HR) deliberately carry
// no `onboardingInstanceId`, so nobody was ever chased when a document sat
// waiting on a non-employee signer.
//
// Policy (all constants below):
//   • first reminder once the signer has been waited on for 2 days
//   • then every 3 days, at most 4 reminders per (round, step, signer)
//   • at 5 days the supervisor + initiating admin are told it is stuck
//   • signer no longer in the org → no pointless reminders; escalate right away
//
// Guarantees:
//   • Never emails the document — only links.
//   • Exactly-once per reminder (`email_dispatch_log` + notification dedupeKey);
//     a failed send releases its claim and is retried on the next run.
//   • Respects the org kill switch (`onboardingEmailsEnabled === false` stops
//     EMAILS; the in-app notice still goes out).
//   • Only touches sessions still `partially_signed` — signing, re-request,
//     reassignment and archiving all naturally stop the chasing.
//   • Never throws out of a single session; one bad document can't block others.
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
import {
  SIGNING_SESSIONS,
  currentSigner,
  type ReminderState,
  type ResolvedSigner,
  type SigningSessionDoc,
} from '@/lib/onboarding-signing';

const DAY = 86_400_000;
const HOUR = 3_600_000;

export const REMINDER_POLICY = {
  /** Wait this long on a signer before the first reminder. */
  firstAfterMs: 2 * DAY,
  /** Gap between reminders. */
  repeatMs: 3 * DAY,
  /** Max reminders per signer per step. */
  maxReminders: 4,
  /** Tell the supervisor/admin after this long. */
  escalateAfterMs: 5 * DAY,
  /**
   * The cron fires once a day at a fixed time; a few hours of slack stops a
   * run from missing a threshold by minutes and pushing the reminder a day out.
   */
  toleranceMs: 3 * HOUR,
  /** Safety valve on how many sessions one run will process. */
  maxSessionsPerRun: 500,
} as const;

// ── Pure planning ───────────────────────────────────────────────────────────

/** Firestore Timestamp | Date | ISO string | millis → millis (NaN-safe → 0). */
export function toMs(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v instanceof Date) return v.getTime() || 0;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; }
  const o = v as { toMillis?: () => number; toDate?: () => Date; seconds?: number; _seconds?: number };
  if (typeof o.toMillis === 'function') return o.toMillis() || 0;
  if (typeof o.toDate === 'function') return o.toDate().getTime() || 0;
  const sec = o.seconds ?? o._seconds;
  return typeof sec === 'number' ? sec * 1000 : 0;
}

/**
 * When the session started waiting on its CURRENT signer: the latest of
 * "the previous signer signed" and "this slot was handed to a new person".
 * Derived from existing audit data, so no other route has to maintain it.
 */
export function waitingSinceMs(s: SigningSessionDoc): number {
  let since = 0;
  for (const c of s.completions || []) since = Math.max(since, toMs(c.signedAt));
  for (const r of s.reassignments || []) {
    if (r.round === s.round && r.order === s.currentSignerOrder) since = Math.max(since, toMs(r.at));
  }
  return since || toMs(s.updatedAt) || toMs(s.createdAt);
}

/** Counters for the current (round, step, signer); fresh when anything changed. */
export function stateFor(s: SigningSessionDoc, signer: ResolvedSigner): ReminderState {
  const r = s.reminders;
  if (r && r.round === s.round && r.order === signer.order && r.uid === signer.uid) return { ...r };
  return { round: s.round, order: signer.order, uid: signer.uid, count: 0, lastAt: 0 };
}

export type ReminderPlan =
  | { remind: false; escalate: false; reason: string }
  | {
      remind: boolean;
      escalate: boolean;
      reason: string;
      /** Reminder number this run would send (1-based). Only meaningful when `remind`. */
      reminderNumber: number;
      waitedMs: number;
      signerLeft: boolean;
    };

const NONE = (reason: string): ReminderPlan => ({ remind: false, escalate: false, reason });

export function planReminder(s: SigningSessionDoc, nowMs: number, signerInOrg: boolean): ReminderPlan {
  if (s.status !== 'partially_signed') return NONE('not_waiting_on_a_signer');
  const signer = currentSigner(s);
  if (!signer) return NONE('no_current_signer');
  // The employee's own turn is covered by the existing onboarding nudges.
  if (signer.kind === 'employee' || signer.uid === s.employeeUid) return NONE('employee_turn');

  const P = REMINDER_POLICY;
  const st = stateFor(s, signer);
  const since = waitingSinceMs(s);
  if (!since) return NONE('unknown_wait_start');
  const waited = Math.max(0, nowMs - since);

  const signerLeft = !signerInOrg;
  const alreadyEscalated = Boolean(st.escalatedAt);

  // A departed signer can never act — reminding them is noise. Tell the people
  // who can fix it (reassign) as soon as the grace period has passed.
  if (signerLeft) {
    const escalate = !alreadyEscalated && waited >= P.firstAfterMs - P.toleranceMs;
    return escalate
      ? { remind: false, escalate: true, reason: 'signer_left_org', reminderNumber: st.count, waitedMs: waited, signerLeft: true }
      : NONE(alreadyEscalated ? 'signer_left_already_escalated' : 'signer_left_within_grace');
  }

  const due =
    st.count < P.maxReminders &&
    (st.count === 0 ? waited >= P.firstAfterMs - P.toleranceMs : nowMs - st.lastAt >= P.repeatMs - P.toleranceMs);
  const escalate = !alreadyEscalated && waited >= P.escalateAfterMs - P.toleranceMs;

  if (!due && !escalate) return NONE(st.count >= P.maxReminders ? 'max_reminders_reached' : 'not_due_yet');
  return {
    remind: due,
    escalate,
    reason: due && escalate ? 'remind_and_escalate' : due ? 'remind' : 'escalate',
    reminderNumber: st.count + 1,
    waitedMs: waited,
    signerLeft: false,
  };
}

// ── Runner ──────────────────────────────────────────────────────────────────

export interface ReminderRunOptions {
  orgId?: string | null;
  /** Override "now" (tests). */
  nowMs?: number;
  /** Plan only — send nothing, write nothing. */
  dryRun?: boolean;
}

export interface ReminderRunItem {
  taskId: string;
  orgId: string;
  signerUid?: string;
  action: 'reminded' | 'escalated' | 'reminded_and_escalated' | 'skipped' | 'would_remind' | 'would_escalate' | 'would_remind_and_escalate' | 'error';
  reason: string;
  reminderNumber?: number;
  waitedDays?: number;
}

export interface ReminderRunResult {
  scanned: number;
  reminded: number;
  escalated: number;
  skipped: number;
  errors: number;
  items: ReminderRunItem[];
}

const LOG = '[onboarding-reminders]';
const EMAIL_TIMEOUT_MS = 8_000;

function withTimeout<T>(p: Promise<T>, fallback: T, ms = EMAIL_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

const days = (ms: number) => Math.max(0, Math.floor(ms / DAY));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const linkPath = (s: SigningSessionDoc) => `${dashboardPath(s.orgId, 'onboarding')}?sign=${encodeURIComponent(s.parentTaskId)}`;
const slotKey = (s: SigningSessionDoc, signer: ResolvedSigner) => `${s.parentTaskId}-r${s.round}-s${signer.order}-${signer.uid}`;

async function emailForUid(db: Firestore, uid: string): Promise<string> {
  try {
    const d = (await db.collection('users').doc(uid).get()).data() || {};
    return String(d.email || '').trim();
  } catch {
    return '';
  }
}

/** Claim → send → release-on-failure. Returns true when an email actually went out. */
async function sendOnce(db: Firestore, key: string, send: () => Promise<{ ok: boolean }>): Promise<boolean> {
  if (!(await claimDispatch(db, key))) return false;
  const res = await send();
  if (!res.ok) await releaseDispatch(db, key);
  return res.ok;
}

/**
 * Reminder to the signer. Returns whether it counts as DELIVERED:
 *   • in-app notice always goes (deduped);
 *   • if emails are on and an address exists, the email must succeed — else we
 *     report not-delivered so the next run retries (the in-app dedupe key
 *     prevents a duplicate bell notification).
 */
async function deliverReminder(db: Firestore, s: SigningSessionDoc, signer: ResolvedSigner, key: string, waitedMs: number): Promise<boolean> {
  const waited = plural(days(waitedMs), 'day');

  await createNotification({
    recipientUids: [signer.uid],
    orgId: s.orgId,
    type: 'action_board_assigned',
    title: 'Reminder: signature still needed',
    body: `${s.employeeName}'s "${s.title}" has been waiting ${waited} for your signature.`,
    link: linkPath(s),
    refId: s.parentTaskId,
    dedupeKey: `onb-${key}`,
    push: true,
  }).catch(() => 0);

  if (!(await automaticEmailsEnabled(db, s.orgId))) return true;
  const to = isValidEmail(signer.email) ? signer.email : await emailForUid(db, signer.uid);
  if (!isValidEmail(to)) return true; // nothing more we can do for this person; the bell notice went out

  const sent = await sendOnce(db, key, () =>
    sendOnboardingEmail({
      orgId: s.orgId,
      to,
      subject: `Reminder: signature needed — ${s.title}`,
      content: {
        heading: 'Reminder: your signature is still needed',
        subheading: s.title,
        paragraphs: [
          `Hi ${signer.name || 'there'},`,
          `${s.employeeName}'s "${s.title}" has been waiting ${waited} for your part as ${signer.label || 'a signer'}. ` +
            'Other people are blocked until you sign.',
        ],
        details: [
          { label: 'Document', value: s.title },
          { label: 'Employee', value: s.employeeName },
          { label: 'Your role', value: signer.label || 'Signer' },
          { label: 'Waiting', value: waited },
        ],
        cta: { label: 'Review & sign', url: absoluteUrl(linkPath(s)) },
        accent: '#d97706',
        footer: 'You are receiving this reminder because a document is waiting on your signature. You will be asked to log in first.',
      },
    }),
  );
  // `sendOnce` is false both on "already sent" (fine) and on failure (retry). Distinguish via the log:
  if (sent) return true;
  return !(await claimDispatchStillFree(db, key));
}

/**
 * After `sendOnce` returns false: was it because the claim already existed
 * (a previous run delivered it → treat as delivered) or because sending failed
 * (claim released → free → NOT delivered, retry next run)?
 */
async function claimDispatchStillFree(db: Firestore, key: string): Promise<boolean> {
  try {
    const snap = await db.collection('email_dispatch_log').doc(key.replace(/[\/\s]/g, '_').slice(0, 400)).get();
    return !snap.exists;
  } catch {
    return false;
  }
}

/** Tell the supervisor/initiating admin (never the stuck signer) that the document is stuck. */
async function deliverEscalation(db: Firestore, s: SigningSessionDoc, signer: ResolvedSigner, waitedMs: number, signerLeft: boolean): Promise<boolean> {
  let instance: any = {};
  if (s.instanceId) {
    const snap = await db.collection('onboarding_instances').doc(s.instanceId).get();
    instance = snap.exists ? snap.data() || {} : {};
  }
  const task: any = (await db.collection('action_board_tasks').doc(s.parentTaskId).get()).data() || {};
  const reviewers = await resolveReviewers(s.orgId, instance, task);

  const stuckEmail = (signer.email || '').toLowerCase();
  const uids = reviewers.uids.filter((u) => u && u !== signer.uid);
  const emails = new Set<string>();
  for (const e of reviewers.emails) if (isValidEmail(e) && e.toLowerCase() !== stuckEmail) emails.add(e.toLowerCase());
  for (const uid of uids) {
    const e = (await emailForUid(db, uid)).toLowerCase();
    if (isValidEmail(e) && e !== stuckEmail) emails.add(e);
  }
  if (uids.length === 0 && emails.size === 0) return true; // nobody to tell

  const key = `escalate-${slotKey(s, signer)}`;
  const waited = plural(days(waitedMs), 'day');
  const who = signer.name || signer.label || 'the next signer';
  const headline = signerLeft
    ? `${who} is no longer in the organization, so "${s.title}" cannot move forward.`
    : `"${s.title}" has been waiting ${waited} on ${who}.`;
  const advice = signerLeft
    ? 'Open the document and use "Change who signs" to hand their step to someone else.'
    : 'Follow up with them, or use "Change who signs" if they are unavailable.';

  await createNotification({
    recipientUids: uids,
    recipientEmails: uids.length ? [] : [...emails],
    orgId: s.orgId,
    type: 'onboarding_document_completed',
    title: signerLeft ? 'Document stuck: signer left the organization' : 'Document stuck: waiting on a signature',
    body: `${s.employeeName}: ${headline}`,
    link: linkPath(s),
    refId: s.parentTaskId,
    dedupeKey: `onb-${key}`,
    push: true,
  }).catch(() => 0);

  if (!(await automaticEmailsEnabled(db, s.orgId))) return true;
  let allDelivered = true;
  for (const to of emails) {
    const k = `${key}-${to}`;
    const ok = await sendOnce(db, k, () =>
      sendOnboardingEmail({
        orgId: s.orgId,
        to,
        subject: `Document stuck: ${s.title}`,
        content: {
          heading: 'A document is stuck',
          subheading: s.title,
          paragraphs: [headline, advice],
          details: [
            { label: 'Document', value: s.title },
            { label: 'Employee', value: s.employeeName },
            { label: 'Waiting on', value: `${signer.name || signer.label}${signerLeft ? ' (left the organization)' : ''}` },
            { label: 'Waiting', value: waited },
          ],
          cta: { label: 'Open document', url: absoluteUrl(linkPath(s)) },
          accent: '#b91c1c',
        },
      }),
    );
    // false = already sent earlier (fine) OR the send failed (claim released → retry next run)
    if (!ok && (await claimDispatchStillFree(db, k))) allDelivered = false;
  }
  return allDelivered;
}

async function isOrgMember(db: Firestore, orgId: string, uid: string): Promise<boolean> {
  try {
    return (await db.doc(`orgs/${orgId}/members/${uid}`).get()).exists;
  } catch {
    return true; // fail open: if we can't tell, don't claim they left
  }
}

/** One sweep. Safe to run repeatedly; idempotent per reminder. */
export async function runSignatureReminders(db: Firestore, opts: ReminderRunOptions = {}): Promise<ReminderRunResult> {
  const now = opts.nowMs ?? Date.now();
  const out: ReminderRunResult = { scanned: 0, reminded: 0, escalated: 0, skipped: 0, errors: 0, items: [] };

  let q: FirebaseFirestore.Query = db.collection(SIGNING_SESSIONS).where('status', '==', 'partially_signed');
  if (opts.orgId) q = q.where('orgId', '==', opts.orgId);
  const snap = await q.get();

  for (const doc of snap.docs.slice(0, REMINDER_POLICY.maxSessionsPerRun)) {
    out.scanned++;
    const s = doc.data() as SigningSessionDoc;
    const taskId = doc.id;
    const item: ReminderRunItem = { taskId, orgId: s.orgId, action: 'skipped', reason: '' };
    try {
      const signer = currentSigner(s);
      const inOrg = signer ? await isOrgMember(db, s.orgId, signer.uid) : true;
      const plan = planReminder(s, now, inOrg);
      item.signerUid = signer?.uid;
      item.reason = plan.reason;
      if (!plan.remind && !plan.escalate) { out.skipped++; out.items.push(item); continue; }
      if (!signer) { out.skipped++; out.items.push(item); continue; }
      const p = plan as Extract<ReminderPlan, { reminderNumber: number }>;
      item.reminderNumber = p.reminderNumber;
      item.waitedDays = days(p.waitedMs);

      if (opts.dryRun) {
        item.action = p.remind && p.escalate ? 'would_remind_and_escalate' : p.remind ? 'would_remind' : 'would_escalate';
        out.items.push(item);
        continue;
      }

      const next = stateFor(s, signer);
      let reminded = false;
      let escalated = false;

      if (p.remind) {
        reminded = await withTimeout(deliverReminder(db, s, signer, `remind-${slotKey(s, signer)}-n${p.reminderNumber}`, p.waitedMs), false);
        if (reminded) { next.count = p.reminderNumber; next.lastAt = now; }
      }
      if (p.escalate) {
        escalated = await withTimeout(deliverEscalation(db, s, signer, p.waitedMs, p.signerLeft), false);
        if (escalated) next.escalatedAt = now;
      }

      // Persist only if nothing changed while we were sending (someone signed, etc.).
      if (reminded || escalated) {
        const ref = doc.ref;
        await db.runTransaction(async (tx) => {
          const fresh = (await tx.get(ref)).data() as SigningSessionDoc | undefined;
          if (!fresh || fresh.status !== 'partially_signed') return;
          const cur = currentSigner(fresh);
          if (!cur || cur.uid !== signer.uid || cur.order !== signer.order || fresh.round !== s.round) return;
          tx.update(ref, { reminders: next });
        });
      }

      item.action = reminded && escalated ? 'reminded_and_escalated' : reminded ? 'reminded' : escalated ? 'escalated' : 'skipped';
      if (item.action === 'skipped') item.reason = 'delivery_failed_will_retry';
      if (reminded) out.reminded++;
      if (escalated) out.escalated++;
      if (!reminded && !escalated) out.skipped++;
    } catch (e: any) {
      out.errors++;
      item.action = 'error';
      item.reason = String(e?.message || e).slice(0, 200);
      console.warn(`${LOG} session ${taskId} failed:`, e);
    }
    out.items.push(item);
  }
  return out;
}

// ── Phase 6.5: admin "Nudge now" ────────────────────────────────────────────

/** An admin may nudge the same person at most this often. */
export const MANUAL_NUDGE_COOLDOWN_MS = 6 * HOUR;

export class NudgeError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface NudgeResult {
  signerUid: string;
  signerName: string;
  delivered: boolean;
}

/**
 * Send the current signer a reminder right now. Does NOT use up the automatic
 * schedule (count / lastAt are untouched) — it only records `manualAt` for the
 * cooldown. Link-only, never attaches the document.
 */
export async function nudgeNow(db: Firestore, taskId: string, nowMs = Date.now()): Promise<NudgeResult> {
  const ref = db.collection(SIGNING_SESSIONS).doc(taskId);
  const snap = await ref.get();
  if (!snap.exists) throw new NudgeError('That document is not waiting on a signature.', 404);
  const s = snap.data() as SigningSessionDoc;
  if (s.status !== 'partially_signed') throw new NudgeError('That document is not waiting on a signature.', 409);
  const signer = currentSigner(s);
  if (!signer) throw new NudgeError('That document has no current signer.', 409);
  if (!(await isOrgMember(db, s.orgId, signer.uid))) {
    throw new NudgeError(`${signer.name || 'The signer'} is no longer in this organization. Use "Change who signs" instead.`, 409);
  }

  const st = stateFor(s, signer);
  const since = st.manualAt || 0;
  if (since && nowMs - since < MANUAL_NUDGE_COOLDOWN_MS) {
    const mins = Math.ceil((MANUAL_NUDGE_COOLDOWN_MS - (nowMs - since)) / 60_000);
    throw new NudgeError(`${signer.name || 'They'} was already nudged recently. You can nudge again in about ${mins >= 90 ? `${Math.ceil(mins / 60)} hours` : `${mins} minutes`}.`, 429);
  }

  const delivered = await withTimeout(
    deliverReminder(db, s, signer, `nudge-${slotKey(s, signer)}-${nowMs}`, Math.max(0, nowMs - waitingSinceMs(s))),
    false,
  );
  if (delivered) {
    await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(ref)).data() as SigningSessionDoc | undefined;
      if (!fresh || fresh.status !== 'partially_signed') return;
      const cur = currentSigner(fresh);
      if (!cur || cur.uid !== signer.uid || cur.order !== signer.order || fresh.round !== s.round) return;
      tx.update(ref, { reminders: { ...stateFor(fresh, cur), manualAt: nowMs } });
    });
  }
  return { signerUid: signer.uid, signerName: signer.name || signer.label || '', delivered };
}
