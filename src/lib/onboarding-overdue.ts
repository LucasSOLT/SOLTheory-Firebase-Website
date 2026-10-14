// ============================================================================
// lib/onboarding-overdue.ts — Phase I, Step I7 (SERVER-ONLY)
//
// Scheduled overdue sweep + late-completion helpers for onboarding items.
//
// Policy & Guarantees:
//   • Marks onboarding tasks (`action_board_tasks` with category === 'onboarding')
//     Overdue (`isLate: true`, `metadata.overdue: true`, `metadata.overdueAt`)
//     once their due time (`dueDate`) passes.
//   • NEVER deletes or hides anything when overdue (`isArchived` is untouched,
//     tasks and phases remain viewable as history).
//   • Sends a bell notification and an email ONCE per item to both the employee
//     and their supervisor (`supervisorUid`/`supervisorEmail`, falling back to
//     legacy `mentorUid`/`mentorEmail`).
//   • Respects the org email kill switch (`onboardingEmailsEnabled === false`
//     stops emails while still delivering in-app bell notifications).
//   • Never attaches any PDF/document — emails carry only a portal link.
//   • Late work can still be submitted at any time; when completed after its
//     due date/time, it is labelled "Completed late" (`metadata.completedLate`).
// ============================================================================

import type { Firestore } from 'firebase-admin/firestore';
import { createNotification, dashboardPath } from '@/lib/notifications';
import {
  absoluteUrl,
  automaticEmailsEnabled,
  claimDispatch,
  isValidEmail,
  releaseDispatch,
  sendOnboardingEmail,
} from '@/lib/onboarding-mailer';

const LOG = '[onboarding-overdue]';
const EMAIL_TIMEOUT_MS = 8_000;
const MAX_INSTANCES_PER_RUN = 500;

// ── Pure helpers (safe for server & tests) ──────────────────────────────────

/** Firestore Timestamp | Date | ISO string | millis → millis (NaN-safe → 0). */
export function toMs(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v instanceof Date) return v.getTime() || 0;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  const o = v as {
    toMillis?: () => number;
    toDate?: () => Date;
    seconds?: number;
    _seconds?: number;
  };
  if (typeof o.toMillis === 'function') return o.toMillis() || 0;
  if (typeof o.toDate === 'function') return o.toDate().getTime() || 0;
  const sec = o.seconds ?? o._seconds;
  return typeof sec === 'number' ? sec * 1000 : 0;
}

/**
 * Whether a task has already been submitted by the employee and is awaiting
 * supervisor/admin review or compliance document verification.
 */
export function isTaskAwaitingReview(task: any): boolean {
  if (!task || typeof task !== 'object') return false;
  const meta = task.metadata || {};
  if (meta.reviewStatus === 'pending_review') return true;
  if (meta.documentVerificationStatus === 'pending_review') return true;
  if (
    meta.requiresDocumentUpload === true &&
    Array.isArray(task.attachments) &&
    task.attachments.length > 0 &&
    meta.documentVerificationStatus !== 'rejected'
  ) {
    return true;
  }
  return false;
}

/**
 * Whether an incomplete onboarding task is currently overdue.
 * Returns false for completed, archived, or pending-review tasks.
 */
export function isTaskOverdue(task: any, nowMs = Date.now()): boolean {
  if (!task || task.isArchived === true) return false;
  if (task.column === 'done') return false;
  if (isTaskAwaitingReview(task)) return false;
  if (task.isLate === true || task.metadata?.overdue === true) return true;
  const dueMs = toMs(task.dueDate);
  return dueMs > 0 && nowMs > dueMs;
}

/**
 * Whether a task being completed (or submitted) at `completedAtMs` should be
 * stamped as completed late (`isLate: true`, `metadata.completedLate: true`).
 *
 * If the employee already submitted the item earlier (`metadata.submittedAt`)
 * and a supervisor is approving it later, we compare the employee's submission
 * timestamp against `dueDate` so supervisor review delay doesn't penalize on-time work.
 * Pass `{ ignoreExistingSubmittedAt: true }` when recording a fresh submission/resubmission.
 */
export function shouldMarkCompletedLate(
  task: any,
  completedAtMs = Date.now(),
  opts?: { ignoreExistingSubmittedAt?: boolean },
): boolean {
  if (!task) return false;
  const ignoreSubmitted = Boolean(opts?.ignoreExistingSubmittedAt);
  if (!ignoreSubmitted && task.metadata?.completedLate === true) return true;
  if (!ignoreSubmitted && task.metadata?.completedLate === false && task.column === 'done') {
    return false;
  }
  const dueMs = toMs(task.dueDate);
  const submittedMs = ignoreSubmitted ? 0 : toMs(task.metadata?.submittedAt);
  const effectiveMs = submittedMs > 0 ? submittedMs : completedAtMs;
  if (dueMs > 0 && effectiveMs > 0) {
    return effectiveMs > dueMs;
  }
  if (task.isLate === true || task.metadata?.overdue === true) return true;
  return false;
}

/**
 * Whether a completed task (`column === 'done'`) was completed after its due time.
 */
export function isTaskCompletedLate(task: any): boolean {
  if (!task || task.column !== 'done') return false;
  if (task.metadata?.completedLate === true) return true;
  if (task.metadata?.completedLate === false) return false;
  const dueMs = toMs(task.dueDate);
  const effectiveCompletedMs = toMs(task.metadata?.submittedAt) || toMs(task.completedAt);
  if (dueMs > 0 && effectiveCompletedMs > 0) {
    return effectiveCompletedMs > dueMs;
  }
  if (task.isLate === true || task.metadata?.overdue === true) return true;
  return false;
}

export type OverduePlan =
  | {
      overdue: false;
      shouldMark: false;
      shouldNotify: false;
      reason:
        | 'invalid_task'
        | 'archived'
        | 'not_onboarding'
        | 'already_done'
        | 'pending_review'
        | 'no_due_date'
        | 'not_due_yet';
    }
  | {
      overdue: true;
      shouldMark: boolean;
      shouldNotify: boolean;
      reason: 'already_processed' | 'mark_and_notify' | 'mark_only' | 'notify_only';
      dueMs: number;
      overdueByMs: number;
    };

export function planOverdueTask(task: any, nowMs = Date.now()): OverduePlan {
  if (!task || typeof task !== 'object') {
    return { overdue: false, shouldMark: false, shouldNotify: false, reason: 'invalid_task' };
  }
  if (task.isArchived === true) {
    return { overdue: false, shouldMark: false, shouldNotify: false, reason: 'archived' };
  }
  if (task.category && task.category !== 'onboarding') {
    return { overdue: false, shouldMark: false, shouldNotify: false, reason: 'not_onboarding' };
  }
  if (task.column === 'done') {
    return { overdue: false, shouldMark: false, shouldNotify: false, reason: 'already_done' };
  }
  if (isTaskAwaitingReview(task)) {
    return { overdue: false, shouldMark: false, shouldNotify: false, reason: 'pending_review' };
  }

  const dueMs = toMs(task.dueDate);
  if (!dueMs) {
    return { overdue: false, shouldMark: false, shouldNotify: false, reason: 'no_due_date' };
  }
  if (nowMs <= dueMs) {
    return { overdue: false, shouldMark: false, shouldNotify: false, reason: 'not_due_yet' };
  }

  const shouldMark = !task.isLate || !task.metadata?.overdue || !toMs(task.metadata?.overdueAt);
  const shouldNotify = !toMs(task.metadata?.overdueNotifiedAt);
  const overdueByMs = nowMs - dueMs;

  if (!shouldMark && !shouldNotify) {
    return {
      overdue: true,
      shouldMark: false,
      shouldNotify: false,
      reason: 'already_processed',
      dueMs,
      overdueByMs,
    };
  }

  return {
    overdue: true,
    shouldMark,
    shouldNotify,
    reason: shouldMark && shouldNotify ? 'mark_and_notify' : shouldMark ? 'mark_only' : 'notify_only',
    dueMs,
    overdueByMs,
  };
}

// ── Recipient resolution & delivery ─────────────────────────────────────────

export interface OverdueRecipient {
  uid: string;
  email: string;
  name: string;
}

function cleanUid(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return s && !s.includes('@') ? s : '';
}

function cleanEmail(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return isValidEmail(s) ? s : '';
}

async function lookupUserContact(
  db: Firestore,
  uid: string,
): Promise<{ email: string; name: string }> {
  if (!uid) return { email: '', name: '' };
  try {
    const snap = await db.collection('users').doc(uid).get();
    const d = snap.data() || {};
    return {
      email: cleanEmail(d.email),
      name: String(d.displayName || d.name || '').trim(),
    };
  } catch {
    return { email: '', name: '' };
  }
}

/**
 * Resolves the employee and assigned supervisor (`supervisorUid`/`supervisorEmail`,
 * falling back to legacy `mentorUid`/`mentorEmail`) for an onboarding task.
 */
export async function resolveOverdueRecipients(
  db: Firestore,
  instance: any,
  task: any,
): Promise<{ employee: OverdueRecipient; supervisor: OverdueRecipient | null }> {
  // Employee
  const empUid = cleanUid(instance?.userId || task?.assignedTo);
  let empEmail = cleanEmail(instance?.userEmail || task?.assignedToEmail);
  let empName = String(instance?.userName || task?.assignedToName || '').trim();
  if (empUid && (!empEmail || !empName)) {
    const looked = await lookupUserContact(db, empUid);
    if (!empEmail && looked.email) empEmail = looked.email;
    if (!empName && looked.name) empName = looked.name;
  }
  if (!empName) {
    empName = empEmail ? empEmail.split('@')[0] : 'Team Member';
  }

  // Supervisor (prefer supervisorUid/supervisorEmail, fallback to mentorUid/mentorEmail)
  const supUid = cleanUid(
    instance?.supervisorUid ||
      instance?.mentorUid ||
      task?.metadata?.supervisorUid ||
      task?.metadata?.mentorUid,
  );
  let supEmail = cleanEmail(
    instance?.supervisorEmail ||
      instance?.mentorEmail ||
      task?.metadata?.supervisorEmail ||
      task?.metadata?.mentorEmail,
  );
  let supName = String(
    instance?.supervisorName ||
      instance?.mentorName ||
      task?.metadata?.supervisorName ||
      task?.metadata?.mentorName ||
      '',
  ).trim();

  if (!supUid && !supEmail) {
    return {
      employee: { uid: empUid, email: empEmail, name: empName },
      supervisor: null,
    };
  }

  if (supUid && (!supEmail || !supName)) {
    const looked = await lookupUserContact(db, supUid);
    if (!supEmail && looked.email) supEmail = looked.email;
    if (!supName && looked.name) supName = looked.name;
  }
  if (!supName) {
    supName = supEmail ? supEmail.split('@')[0] : 'Supervisor';
  }

  return {
    employee: { uid: empUid, email: empEmail, name: empName },
    supervisor: { uid: supUid, email: supEmail, name: supName },
  };
}

function withTimeout<T>(p: Promise<T>, fallback: T, ms = EMAIL_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
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

async function claimDispatchStillFree(db: Firestore, key: string): Promise<boolean> {
  try {
    const snap = await db
      .collection('email_dispatch_log')
      .doc(key.replace(/[\/\s]/g, '_').slice(0, 400))
      .get();
    return !snap.exists;
  } catch {
    return false;
  }
}

function formatDueDate(dueMs: number): string {
  if (!dueMs) return 'Past due';
  try {
    return new Date(dueMs).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Past due';
  }
}

async function deliverEmployeeOverdueNotice(
  db: Firestore,
  params: {
    orgId: string;
    taskId: string;
    taskTitle: string;
    roleName: string;
    dueMs: number;
    employee: OverdueRecipient;
    emailsEnabled: boolean;
  },
): Promise<boolean> {
  const { orgId, taskId, taskTitle, roleName, dueMs, employee, emailsEnabled } = params;
  if (!employee.uid && !employee.email) return true;

  const link = dashboardPath(orgId, 'onboarding');
  const dueLabel = formatDueDate(dueMs);

  await createNotification({
    recipientUids: employee.uid ? [employee.uid] : [],
    recipientEmails: !employee.uid && employee.email ? [employee.email] : [],
    orgId,
    type: 'onboarding_item_overdue',
    title: 'Onboarding item overdue',
    body: `"${taskTitle}" is past its due date (${dueLabel}). You can still complete it now.`,
    link,
    refId: taskId,
    dedupeKey: `onb-overdue-emp-${taskId}`,
    push: true,
  }).catch(() => 0);

  if (!emailsEnabled || !isValidEmail(employee.email)) return true;

  const dispatchKey = `overdue-emp-${taskId}-${employee.email}`;
  const sent = await withTimeout(
    sendOnce(db, dispatchKey, () =>
      sendOnboardingEmail({
        orgId,
        to: employee.email,
        subject: `Overdue onboarding item: ${taskTitle}`,
        content: {
          heading: 'An onboarding item is overdue',
          subheading: taskTitle,
          paragraphs: [
            `Hi ${employee.name || 'there'},`,
            `Your onboarding item "${taskTitle}"${roleName ? ` for ${roleName}` : ''} passed its due date (${dueLabel}) and is now marked Overdue.`,
            'Nothing has been removed — you can still open your onboarding roadmap and submit this item at any time.',
          ],
          details: [
            { label: 'Item', value: taskTitle },
            ...(roleName ? [{ label: 'Onboarding', value: roleName }] : []),
            { label: 'Due date', value: dueLabel },
            { label: 'Status', value: 'Overdue' },
          ],
          cta: { label: 'Open Onboarding Roadmap', url: absoluteUrl(link) },
          accent: '#dc2626',
          footer:
            'You are receiving this one-time notice because an onboarding item passed its due date.',
        },
      }),
    ),
    false,
  );

  if (sent) return true;
  return !(await claimDispatchStillFree(db, dispatchKey));
}

async function deliverSupervisorOverdueNotice(
  db: Firestore,
  params: {
    orgId: string;
    taskId: string;
    taskTitle: string;
    roleName: string;
    dueMs: number;
    employee: OverdueRecipient;
    supervisor: OverdueRecipient | null;
    emailsEnabled: boolean;
  },
): Promise<boolean> {
  const { orgId, taskId, taskTitle, roleName, dueMs, employee, supervisor, emailsEnabled } = params;
  if (!supervisor || (!supervisor.uid && !supervisor.email)) return true;

  const link = dashboardPath(orgId, 'onboarding');
  const dueLabel = formatDueDate(dueMs);

  await createNotification({
    recipientUids: supervisor.uid ? [supervisor.uid] : [],
    recipientEmails: !supervisor.uid && supervisor.email ? [supervisor.email] : [],
    orgId,
    type: 'onboarding_item_overdue',
    title: 'Team onboarding item overdue',
    body: `${employee.name}'s "${taskTitle}" is past its due date (${dueLabel}).`,
    link,
    refId: taskId,
    dedupeKey: `onb-overdue-sup-${taskId}`,
    push: true,
  }).catch(() => 0);

  if (!emailsEnabled || !isValidEmail(supervisor.email)) return true;

  const dispatchKey = `overdue-sup-${taskId}-${supervisor.email}`;
  const sent = await withTimeout(
    sendOnce(db, dispatchKey, () =>
      sendOnboardingEmail({
        orgId,
        to: supervisor.email,
        subject: `Overdue onboarding item: ${taskTitle} (${employee.name})`,
        content: {
          heading: 'Team member onboarding item is overdue',
          subheading: taskTitle,
          paragraphs: [
            `Hi ${supervisor.name || 'there'},`,
            `${employee.name}'s onboarding item "${taskTitle}"${roleName ? ` (${roleName})` : ''} passed its due date (${dueLabel}) and has been marked Overdue.`,
            'They can still submit the item at any time, and it will be marked "Completed late" once finished.',
          ],
          details: [
            { label: 'Employee', value: employee.name },
            { label: 'Item', value: taskTitle },
            ...(roleName ? [{ label: 'Onboarding', value: roleName }] : []),
            { label: 'Due date', value: dueLabel },
            { label: 'Status', value: 'Overdue' },
          ],
          cta: { label: 'View Team Progress', url: absoluteUrl(link) },
          accent: '#dc2626',
          footer:
            'You are receiving this one-time notice because you are the assigned supervisor for this onboarding.',
        },
      }),
    ),
    false,
  );

  if (sent) return true;
  return !(await claimDispatchStillFree(db, dispatchKey));
}

// ── Sweep Runner ────────────────────────────────────────────────────────────

export interface OverdueRunOptions {
  orgId?: string | null;
  instanceId?: string | null;
  /** Override "now" (tests). */
  nowMs?: number;
  /** Plan only — send nothing, write nothing. */
  dryRun?: boolean;
}

export interface OverdueRunItem {
  taskId: string;
  instanceId: string;
  orgId: string;
  title: string;
  employeeUid?: string;
  supervisorUid?: string;
  action:
    | 'marked_and_notified'
    | 'marked_only'
    | 'notified_only'
    | 'would_mark_and_notify'
    | 'would_mark'
    | 'would_notify'
    | 'skipped'
    | 'error';
  reason: string;
}

export interface OverdueRunResult {
  instancesScanned: number;
  tasksScanned: number;
  markedOverdue: number;
  notified: number;
  skipped: number;
  errors: number;
  items: OverdueRunItem[];
}

/**
 * Scans in-progress onboarding instances, marks any past-due items as Overdue
 * without deleting or hiding anything, and sends one-time bell + email notices
 * to both the employee and their supervisor.
 */
export async function runOnboardingOverdue(
  db: Firestore,
  opts: OverdueRunOptions = {},
): Promise<OverdueRunResult> {
  const now = opts.nowMs ?? Date.now();
  const out: OverdueRunResult = {
    instancesScanned: 0,
    tasksScanned: 0,
    markedOverdue: 0,
    notified: 0,
    skipped: 0,
    errors: 0,
    items: [],
  };

  let instanceDocs: Array<{ id: string; data: any }> = [];
  if (opts.instanceId) {
    const snap = await db.collection('onboarding_instances').doc(opts.instanceId).get();
    if (snap.exists) {
      const data = snap.data() || {};
      if (!opts.orgId || data.orgId === opts.orgId) {
        instanceDocs.push({ id: snap.id, data });
      }
    }
  } else {
    let q: FirebaseFirestore.Query = db
      .collection('onboarding_instances')
      .where('status', '==', 'in_progress');
    if (opts.orgId) {
      q = q.where('orgId', '==', opts.orgId);
    }
    const snap = await q.get();
    instanceDocs = snap.docs
      .slice(0, MAX_INSTANCES_PER_RUN)
      .map((d) => ({ id: d.id, data: d.data() || {} }));
  }

  const emailsEnabledCache = new Map<string, boolean>();
  const isOrgEmailsEnabled = async (orgId: string): Promise<boolean> => {
    if (!orgId) return false;
    if (emailsEnabledCache.has(orgId)) return emailsEnabledCache.get(orgId)!;
    const enabled = await automaticEmailsEnabled(db, orgId);
    emailsEnabledCache.set(orgId, enabled);
    return enabled;
  };

  for (const inst of instanceDocs) {
    out.instancesScanned++;
    const instanceId = inst.id;
    const instanceData = inst.data;
    const orgId = String(instanceData.orgId || opts.orgId || '').trim();
    if (!orgId) continue;

    let tasksSnap: FirebaseFirestore.QuerySnapshot;
    try {
      tasksSnap = await db
        .collection('action_board_tasks')
        .where('metadata.onboardingInstanceId', '==', instanceId)
        .get();
    } catch (e: any) {
      out.errors++;
      console.warn(`${LOG} failed to load tasks for instance ${instanceId}:`, e);
      continue;
    }

    for (const taskDoc of tasksSnap.docs) {
      out.tasksScanned++;
      const taskId = taskDoc.id;
      const task = taskDoc.data() || {};
      const title = String(task.title || 'Onboarding item');

      const plan = planOverdueTask(task, now);
      if (!plan.overdue || (!plan.shouldMark && !plan.shouldNotify)) {
        out.skipped++;
        out.items.push({
          taskId,
          instanceId,
          orgId,
          title,
          action: 'skipped',
          reason: plan.reason,
        });
        continue;
      }

      try {
        const recipients = await resolveOverdueRecipients(db, instanceData, task);
        const item: OverdueRunItem = {
          taskId,
          instanceId,
          orgId,
          title,
          employeeUid: recipients.employee.uid || undefined,
          supervisorUid: recipients.supervisor?.uid || undefined,
          action: 'skipped',
          reason: plan.reason,
        };

        if (opts.dryRun) {
          item.action =
            plan.shouldMark && plan.shouldNotify
              ? 'would_mark_and_notify'
              : plan.shouldMark
                ? 'would_mark'
                : 'would_notify';
          out.items.push(item);
          continue;
        }

        let marked = false;
        let notified = false;

        // 1. Mark overdue in Firestore (never deletes or archives the task)
        if (plan.shouldMark) {
          const updates: Record<string, any> = {
            isLate: true,
            'metadata.overdue': true,
            updatedAt: new Date(now),
          };
          if (!toMs(task.metadata?.overdueAt)) {
            updates['metadata.overdueAt'] = now;
          }
          await taskDoc.ref.update(updates);
          marked = true;
          out.markedOverdue++;
        }

        // 2. Deliver one-time bell notification + email to employee and supervisor
        if (plan.shouldNotify) {
          const emailsEnabled = await isOrgEmailsEnabled(orgId);
          const roleName = String(instanceData.roleName || task.metadata?.roleName || '');

          const [empOk, supOk] = await Promise.all([
            deliverEmployeeOverdueNotice(db, {
              orgId,
              taskId,
              taskTitle: title,
              roleName,
              dueMs: plan.dueMs,
              employee: recipients.employee,
              emailsEnabled,
            }),
            deliverSupervisorOverdueNotice(db, {
              orgId,
              taskId,
              taskTitle: title,
              roleName,
              dueMs: plan.dueMs,
              employee: recipients.employee,
              supervisor: recipients.supervisor,
              emailsEnabled,
            }),
          ]);

          if (empOk && supOk) {
            await taskDoc.ref.update({
              'metadata.overdueNotifiedAt': now,
              updatedAt: new Date(now),
            });
            notified = true;
            out.notified++;
          } else {
            item.reason = 'delivery_failed_will_retry';
          }
        }

        if (marked && notified) {
          item.action = 'marked_and_notified';
        } else if (marked) {
          item.action = 'marked_only';
        } else if (notified) {
          item.action = 'notified_only';
        } else {
          item.action = 'skipped';
          out.skipped++;
        }

        out.items.push(item);
      } catch (e: any) {
        out.errors++;
        out.items.push({
          taskId,
          instanceId,
          orgId,
          title,
          action: 'error',
          reason: String(e?.message || e).slice(0, 200),
        });
        console.warn(`${LOG} task ${taskId} failed:`, e);
      }
    }
  }

  return out;
}
