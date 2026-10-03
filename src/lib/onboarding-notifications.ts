/**
 * onboarding-notifications.ts — Onboarding notification triggers (SERVER-ONLY)
 * ────────────────────────────────────────────────────────────────
 * Thin layer on top of `createNotification` that knows how onboarding data is
 * shaped (action_board_tasks + onboarding_instances) and decides WHO should be
 * told WHAT:
 *
 *  - Employee is assigned an onboarding blueprint      → employee (+ supervisor)
 *  - Employee completes a DOCUMENT item                → reviewers
 *  - Employee completes every item in a PHASE          → reviewers
 *  - Employee completes the entire blueprint           → reviewers
 *  - Employee uploads a compliance doc for review      → reviewers
 *
 * "Reviewers" = the assigned supervisor (supervisorUid/Email, falling back to the
 * legacy mentorUid/Email) + the admin who initiated the onboarding. If none of
 * those resolve, all org admins are used instead.
 *
 * Every helper here NEVER throws and returns the number of notifications created.
 * All completion notifications carry a dedupeKey, so repeated calls (client
 * report + server route, retries, multiple tabs) never create duplicates.
 */

import { initAdmin, getFirestore } from "@/firebase/admin";
import { createNotification, getOrgAdminUids, dashboardPath } from "@/lib/notifications";
import { getSystemTemplateById } from "@/lib/onboarding-templates-registry";
import { ONBOARDING_PHASE_LABELS } from "@/types/onboarding-templates";

const LOG_PREFIX = "[onboarding-notifications]";

/** Item types that produce a document (signed form, uploaded file, filled PDF). */
const DOCUMENT_ITEM_TYPES = new Set(["document_upload", "form_sign", "pdf_form", "policy_acknowledgment"]);

function db() {
  initAdmin();
  return getFirestore();
}

/** Firestore Timestamp | Date | number | string → epoch millis (0 if unknown) */
function toMillis(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof v._seconds === "number") return v._seconds * 1000;
  return 0;
}

/** Whether an onboarding task represents a document (upload / signature / PDF form). */
function isDocumentTask(task: any): boolean {
  const meta = task?.metadata || {};
  if (meta.itemType && DOCUMENT_ITEM_TYPES.has(meta.itemType)) return true;
  if (meta.requiresDocumentUpload === true) return true;
  const icType = meta.interactiveContent?.type;
  return icType === "pdf_form" || icType === "policy_acknowledgment";
}

/**
 * Suffix that changes when a task was re-requested, so a resubmission after a
 * supervisor "Re-Request" notifies again instead of being swallowed by dedupe.
 */
function reRequestSuffix(tasks: any[]): string {
  const latest = Math.max(0, ...tasks.map((t) => toMillis(t?.metadata?.reRequestedAt)));
  return latest > 0 ? `-r${latest}` : "";
}

interface Reviewers {
  uids: string[];
  emails: string[];
}

/** Supervisor + initiating admin for an instance; org admins if none resolve. */
export async function resolveReviewers(orgId: string, instance: any, task?: any): Promise<Reviewers> {
  const uids = new Set<string>();
  const emails = new Set<string>();
  const addUid = (v: any) => { if (typeof v === "string" && v && !v.includes("@")) uids.add(v); };
  const addEmail = (v: any) => { if (typeof v === "string" && v.includes("@")) emails.add(v.toLowerCase().trim()); };

  // Supervisor — prefer new fields, fall back to legacy mentor fields
  const supUid = instance?.supervisorUid || instance?.mentorUid;
  const supEmail = instance?.supervisorEmail || instance?.mentorEmail;
  addUid(supUid);
  if (!supUid) addEmail(supEmail);

  // Initiating admin (instantiate route writes initiatedBy / initiatedByEmail)
  const initUid = instance?.initiatedBy || instance?.createdBy || task?.createdBy;
  const initEmail = instance?.initiatedByEmail || instance?.createdByEmail || task?.createdByEmail;
  addUid(initUid);
  if (!initUid) addEmail(initEmail);

  if (uids.size === 0 && emails.size === 0) {
    (await getOrgAdminUids(orgId)).forEach((u) => uids.add(u));
  }
  return { uids: Array.from(uids), emails: Array.from(emails) };
}

/** Human-readable name for a phase number, using the template's custom phase definitions if present. */
async function resolvePhaseName(orgId: string, templateId: string | undefined, phase: any): Promise<string> {
  const phaseNum = Number(phase);
  try {
    if (templateId) {
      let template: any = getSystemTemplateById(templateId);
      if (!template) {
        const snap = await db().collection("orgs").doc(orgId).collection("onboarding_templates").doc(templateId).get();
        if (snap.exists) template = snap.data();
      }
      const def = Array.isArray(template?.phaseDefinitions)
        ? template.phaseDefinitions.find((p: any) => Number(p?.phaseNumber) === phaseNum)
        : null;
      if (def?.name) return def.name;
    }
  } catch (e) {
    console.warn(`${LOG_PREFIX} phase name lookup failed:`, e);
  }
  return ONBOARDING_PHASE_LABELS[phaseNum] || `Phase ${phase}`;
}

// ── Task completed (document / phase / blueprint) ───────────────────────────

export interface NotifyOnboardingTaskCompletedParams {
  orgId: string;
  taskId: string;
  /** Whoever caused the completion (employee, or the admin approving it) — never notified */
  actorUid?: string;
  actorEmail?: string;
}

/**
 * Call after an onboarding task is marked done (or a document lands in pending review).
 * Re-reads the task + instance with the Admin SDK and notifies reviewers when:
 *   a) the task is a document item,
 *   b) it completed its phase,
 *   c) it completed the whole blueprint.
 * Ordinary items that don't finish a phase produce no notification.
 */
export async function notifyOnboardingTaskCompleted(params: NotifyOnboardingTaskCompletedParams): Promise<number> {
  const { orgId, taskId, actorUid, actorEmail } = params;
  try {
    if (!orgId || !taskId) return 0;
    const firestore = db();

    const taskSnap = await firestore.collection("action_board_tasks").doc(taskId).get();
    if (!taskSnap.exists) return 0;
    const task: any = taskSnap.data() || {};
    if (task.orgId && task.orgId !== orgId) return 0;

    const meta = task.metadata || {};
    const instanceId: string | undefined = meta.onboardingInstanceId;
    if (!instanceId) return 0;

    const isDone = task.column === "done";
    const isPendingReview = meta.reviewStatus === "pending_review";
    const isDocument = isDocumentTask(task);
    if (!isDone && !(isPendingReview && isDocument)) return 0;

    const instanceSnap = await firestore.collection("onboarding_instances").doc(instanceId).get();
    const instance: any = instanceSnap.exists ? instanceSnap.data() || {} : {};
    if (instance.orgId && instance.orgId !== orgId) return 0;

    const reviewers = await resolveReviewers(orgId, instance, task);
    const employee: string =
      instance.userName || task.assignedToName || instance.userEmail || task.assignedToEmail || "An employee";
    const link = dashboardPath(orgId, "onboarding");
    const base = {
      recipientUids: reviewers.uids,
      recipientEmails: reviewers.emails,
      actorUid,
      actorEmail,
      orgId,
      link,
    };

    let created = 0;

    // Document submitted but awaiting review — not "completed" yet
    if (!isDone) {
      created += await createNotification({
        ...base,
        type: "onboarding_document_completed",
        title: "Document submitted for review",
        body: `${employee} submitted "${task.title || "a document"}" for review`,
        refId: taskId,
        dedupeKey: `onb-doc-review-${taskId}${reRequestSuffix([task])}`,
      });
      return created;
    }

    // a) Document item completed
    if (isDocument) {
      created += await createNotification({
        ...base,
        type: "onboarding_document_completed",
        title: "Document completed",
        body: `${employee} completed "${task.title || "a document"}"`,
        refId: taskId,
        dedupeKey: `onb-doc-${taskId}${reRequestSuffix([task])}`,
      });
    }

    // Load all tasks of this instance (single-field query, no composite index needed)
    const allSnap = await firestore
      .collection("action_board_tasks")
      .where("metadata.onboardingInstanceId", "==", instanceId)
      .get();
    const allTasks = allSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((t) => !t.isArchived);
    if (allTasks.length === 0) return created;

    // b) Phase completed
    const phase = meta.phase;
    if (phase !== undefined && phase !== null) {
      const phaseTasks = allTasks.filter((t) => String(t.metadata?.phase) === String(phase));
      if (phaseTasks.length > 0 && phaseTasks.every((t) => t.column === "done")) {
        const phaseName = await resolvePhaseName(orgId, instance.templateId, phase);
        created += await createNotification({
          ...base,
          type: "onboarding_phase_completed",
          title: "Onboarding phase completed",
          body: `${employee} completed the "${phaseName}" phase`,
          refId: instanceId,
          dedupeKey: `onb-phase-${instanceId}-${phase}${reRequestSuffix(phaseTasks)}`,
        });
      }
    }

    // c) Whole blueprint completed
    if (allTasks.every((t) => t.column === "done")) {
      const roleName: string = instance.roleName || "";
      created += await createNotification({
        ...base,
        type: "onboarding_blueprint_completed",
        title: "Onboarding completed",
        body: `${employee} finished onboarding${roleName ? ` for ${roleName}` : ""}`,
        refId: instanceId,
        dedupeKey: `onb-done-${instanceId}${reRequestSuffix(allTasks)}`,
        push: true,
      });
    }

    return created;
  } catch (e) {
    console.warn(`${LOG_PREFIX} notifyOnboardingTaskCompleted(${taskId}) failed:`, e);
    return 0;
  }
}

// ── Onboarding assigned ─────────────────────────────────────────────────────

export interface NotifyOnboardingAssignedParams {
  orgId: string;
  instanceId: string;
  employeeUid?: string;
  employeeEmail?: string;
  employeeName?: string;
  roleName?: string;
  supervisorUid?: string;
  supervisorEmail?: string;
  actorUid?: string;
  actorEmail?: string;
  actorName?: string;
}

/** Notify the employee (and their supervisor, if any) that an onboarding blueprint was assigned. */
export async function notifyOnboardingAssigned(params: NotifyOnboardingAssignedParams): Promise<number> {
  const {
    orgId, instanceId, employeeUid, employeeEmail, employeeName, roleName,
    supervisorUid, supervisorEmail, actorUid, actorEmail,
  } = params;
  try {
    if (!orgId || !instanceId) return 0;

    // Resolve a friendly actor name if the caller didn't provide one
    let actorName = params.actorName || "";
    if (!actorName && actorUid) {
      try {
        const snap = await db().collection("users").doc(actorUid).get();
        actorName = snap.data()?.displayName || "";
      } catch { /* best-effort */ }
    }
    if (!actorName) actorName = actorEmail ? actorEmail.split("@")[0] : "An admin";

    const role = roleName || "new";
    const employee = employeeName || employeeEmail || "a new hire";
    const link = dashboardPath(orgId, "onboarding");
    let created = 0;

    // Employee
    created += await createNotification({
      recipientUids: employeeUid && !employeeUid.includes("@") ? [employeeUid] : [],
      recipientEmails: employeeEmail ? [employeeEmail] : [],
      actorUid,
      actorEmail,
      actorName,
      type: "onboarding_assigned",
      title: "New onboarding assigned",
      body: `${actorName} assigned you the "${role}" onboarding`,
      link,
      orgId,
      refId: instanceId,
      dedupeKey: `onb-assigned-${instanceId}`,
      push: true,
    });

    // Supervisor (skip if they are the actor or the employee themselves)
    const supIsActor =
      (supervisorUid && supervisorUid === actorUid) ||
      (!!supervisorEmail && !!actorEmail && supervisorEmail.toLowerCase() === actorEmail.toLowerCase());
    const supIsEmployee =
      (supervisorUid && supervisorUid === employeeUid) ||
      (!!supervisorEmail && !!employeeEmail && supervisorEmail.toLowerCase() === employeeEmail.toLowerCase());
    if ((supervisorUid || supervisorEmail) && !supIsActor && !supIsEmployee) {
      created += await createNotification({
        recipientUids: supervisorUid ? [supervisorUid] : [],
        recipientEmails: !supervisorUid && supervisorEmail ? [supervisorEmail] : [],
        actorUid,
        actorEmail,
        actorName,
        type: "onboarding_assigned",
        title: "You were assigned as a supervisor",
        body: `You're supervising ${employee}'s "${role}" onboarding`,
        link,
        orgId,
        refId: instanceId,
        dedupeKey: `onb-supervisor-${instanceId}`,
        push: true,
      });
    }

    return created;
  } catch (e) {
    console.warn(`${LOG_PREFIX} notifyOnboardingAssigned(${instanceId}) failed:`, e);
    return 0;
  }
}

// ── Compliance document uploaded (pending review) ───────────────────────────

export interface NotifyOnboardingDocumentSubmittedParams {
  orgId: string;
  docId: string;
  taskId?: string | null;
  employeeName?: string;
  documentLabel?: string;
  actorUid?: string;
  actorEmail?: string;
}

/**
 * Notify reviewers that a compliance document was uploaded and awaits review.
 * If the upload is attached to an onboarding task, reviewers come from that
 * task's onboarding instance; otherwise all org admins are notified.
 */
export async function notifyOnboardingDocumentSubmitted(params: NotifyOnboardingDocumentSubmittedParams): Promise<number> {
  const { orgId, docId, taskId, actorUid, actorEmail } = params;
  try {
    if (!orgId || !docId) return 0;
    const firestore = db();

    let task: any = null;
    let instance: any = null;
    if (taskId) {
      const taskSnap = await firestore.collection("action_board_tasks").doc(taskId).get();
      if (taskSnap.exists) {
        task = taskSnap.data() || {};
        if (task.orgId && task.orgId !== orgId) return 0;
        const instanceId = task.metadata?.onboardingInstanceId;
        if (instanceId) {
          const instSnap = await firestore.collection("onboarding_instances").doc(instanceId).get();
          if (instSnap.exists) instance = instSnap.data() || {};
        }
      }
    }

    const reviewers = instance
      ? await resolveReviewers(orgId, instance, task)
      : { uids: await getOrgAdminUids(orgId), emails: [] as string[] };

    const employee = params.employeeName || instance?.userName || task?.assignedToName || "An employee";
    const label = task?.title || params.documentLabel || "a document";

    return await createNotification({
      recipientUids: reviewers.uids,
      recipientEmails: reviewers.emails,
      actorUid,
      actorEmail,
      type: "onboarding_document_completed",
      title: "Document submitted for review",
      body: `${employee} submitted "${label}" for review`,
      link: dashboardPath(orgId, "onboarding"),
      orgId,
      refId: taskId || docId,
      // Per-upload key: a re-upload after rejection is a new docId and notifies again
      dedupeKey: `onb-doc-review-${docId}`,
    });
  } catch (e) {
    console.warn(`${LOG_PREFIX} notifyOnboardingDocumentSubmitted(${docId}) failed:`, e);
    return 0;
  }
}
