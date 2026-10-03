// ============================================================================
// lib/onboarding-signing.ts — Phase 3 multi-party signing (SERVER-ONLY)
//
// Authoritative signing state lives in `onboarding_signing_sessions/{taskId}`
// (taskId = the employee's parent onboarding task). Only the Admin SDK writes
// it; Firestore rules deny all client access. The parent task carries a
// display-only mirror at `metadata.signing` (see TaskSigningMirror).
//
// Locked rules honored here:
//   • Configurable signing order; each signer fills only their own fields.
//   • Partial fill per step — NEVER flatten until every signer is done.
//   • Previous signers' fields are locked (read-only) for later signers.
//   • Nothing is ever auto-emailed; "Send & Archive" (Phase 4) is manual.
// ============================================================================

import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  ArchiveRecord,
  DocumentSigningStatus,
  PdfFormContent,
  PdfFormField,
  SignerCompletion,
  SignerKind,
  TaskSigningMirror,
} from '@/types/onboarding-templates';
import { detectPdfFields } from '@/lib/pdf-form-engine';
import {
  isMultiSignerWorkflow,
  orderedSigners,
  resolveFieldOwnership,
  signatureBoxesForSigner,
  validateSigningWorkflow,
  type SignatureBox,
} from '@/lib/signing-workflow';
import { createNotification, dashboardPath } from '@/lib/notifications';
import { isDeveloper } from '@/lib/org-config';

export const SIGNING_SESSIONS = 'onboarding_signing_sessions';
export const COUNTERSIGN_CATEGORY = 'onboarding_signature';

/** A signer slot resolved to a real person when the track is assigned. */
export interface ResolvedSigner {
  order: number;
  definitionId: string;
  kind: SignerKind;
  label: string;
  uid: string;
  email: string;
  name: string;
  /** Final field ownership (computed once from the TEMPLATE, never from a working copy). */
  fieldNames: string[];
  requireSignature: boolean;
  /** Where this signer may stamp a signature (signature fields they own + their signaturePosition). */
  signatureBoxes: SignatureBox[];
}

/** One signer's signature image, kept aside until the final flatten. */
export interface SignatureRecord {
  order: number;
  imagePath: string;
  stamps: { pageIndex: number; x: number; y: number; width: number; height: number }[];
}

/** One admin handover of a signer slot to someone else. */
export interface SignerReassignment {
  round: number;
  order: number;
  fromUid: string;
  fromEmail: string;
  fromName: string;
  toUid: string;
  toEmail: string;
  toName: string;
  byUid: string;
  byEmail: string;
  at: string;
}

export interface SigningSessionDoc {
  orgId: string;
  parentTaskId: string;
  instanceId: string | null;
  employeeUid: string;
  employeeEmail: string;
  employeeName: string;
  title: string;
  templatePath: string;
  documentCategory: string;
  status: DocumentSigningStatus;
  /** Increments on every Re-Request. */
  round: number;
  signers: ResolvedSigner[];
  currentSignerOrder: number;
  completions: SignerCompletion[];
  signatures: SignatureRecord[];
  workingPdfPath: string | null;
  openCountersignTaskId: string | null;
  finalDocument: {
    storagePath: string;
    downloadUrl: string;
    sha256Hash: string;
    compositeSealHash: string;
    vaultDocId: string;
    executedAt: string;
  } | null;
  history: { round: number; completions: SignerCompletion[]; workingPdfPath: string | null; resetAt: string; resetBy: string; notes: string }[];
  /** Phase 4 — Send & Archive state/delivery log (absent until first attempt). */
  archive?: ArchiveRecord | null;
  /** Phase 5 — admin handovers of a not-yet-signed slot (e.g. the signer left the org). */
  reassignments?: SignerReassignment[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Thrown when a workflow can't be set up (shown to the admin as a 400). */
export class SigningSetupError extends Error {}

type Bucket = { file: (path: string) => { download: () => Promise<[Buffer]> } };

async function userDisplay(db: Firestore, uid: string): Promise<{ name: string; email: string }> {
  try {
    const data = (await db.collection('users').doc(uid).get()).data() || {};
    return { name: data.displayName || data.name || '', email: data.email || '' };
  } catch {
    return { name: '', email: '' };
  }
}

/** Template fields with geometry: saved detection if it has widgets, else re-detect from Storage. */
export async function loadTemplateFields(bucket: Bucket, content: PdfFormContent): Promise<PdfFormField[]> {
  const saved = content.detectedFields || [];
  const savedHasGeometry = saved.some((f) => f.widgets && f.widgets.length > 0);
  if (saved.length > 0 && savedHasGeometry) return saved;
  const [buffer] = await bucket.file(content.pdfStoragePath).download();
  return detectPdfFields(new Uint8Array(buffer));
}

/**
 * Resolve every signer slot to a person and compute final field ownership.
 * Throws SigningSetupError with an admin-readable message on bad config.
 */
export async function resolveSigners(
  db: Firestore,
  params: {
    orgId: string;
    itemTitle: string;
    content: PdfFormContent;
    templateFields: PdfFormField[];
    employee: { uid: string; email: string; name: string };
    supervisor: { uid?: string | null; email?: string | null };
  },
): Promise<ResolvedSigner[]> {
  const { orgId, itemTitle, content, templateFields, employee, supervisor } = params;
  const workflow = content.signingWorkflow!;
  const problems = validateSigningWorkflow(workflow);
  if (problems.length) throw new SigningSetupError(`"${itemTitle}": ${problems[0]}`);

  const ownership = resolveFieldOwnership(workflow, templateFields);
  const resolved: ResolvedSigner[] = [];

  for (const def of orderedSigners(workflow)) {
    let uid = '';
    let email = '';
    let name = '';

    if (def.kind === 'employee') {
      ({ uid, email, name } = employee);
    } else if (def.kind === 'supervisor') {
      if (!supervisor.uid) {
        throw new SigningSetupError(
          `"${itemTitle}" needs the employee's supervisor to sign, but no supervisor was chosen. Pick a supervisor, or edit the blueprint's signing order.`,
        );
      }
      uid = supervisor.uid;
      const info = await userDisplay(db, uid);
      email = supervisor.email || info.email;
      name = info.name || email.split('@')[0] || 'Supervisor';
    } else {
      uid = def.memberUid || '';
      const member = uid ? await db.doc(`orgs/${orgId}/members/${uid}`).get() : null;
      if (!member?.exists) {
        throw new SigningSetupError(
          `"${itemTitle}": ${def.memberName || def.memberEmail || 'a chosen signer'} is no longer a member of this organization. Update the blueprint's signing order.`,
        );
      }
      const info = await userDisplay(db, uid);
      email = def.memberEmail || info.email || member.data()?.email || '';
      name = def.memberName || info.name || email.split('@')[0] || 'Signer';
    }

    const fieldNames = ownership.get(def.order) || [];
    resolved.push({
      order: def.order,
      definitionId: def.id,
      kind: def.kind,
      label: def.label?.trim() || (def.kind === 'employee' ? 'Employee' : def.kind === 'supervisor' ? 'Supervisor' : name),
      uid,
      email,
      name: name || email,
      fieldNames,
      requireSignature: !!def.requireSignature,
      signatureBoxes: signatureBoxesForSigner(def, fieldNames, templateFields),
    });
  }
  return resolved;
}

/** Build a brand-new session for a parent task (status 'draft', signer #1 up). */
export async function buildSigningSession(
  db: Firestore,
  bucket: Bucket,
  params: {
    orgId: string;
    parentTaskId: string;
    instanceId: string | null;
    title: string;
    content: PdfFormContent;
    employee: { uid: string; email: string; name: string };
    supervisor: { uid?: string | null; email?: string | null };
  },
): Promise<SigningSessionDoc> {
  if (!isMultiSignerWorkflow(params.content)) throw new SigningSetupError('This item does not use multiple signers.');
  const templateFields = await loadTemplateFields(bucket, params.content);
  const signers = await resolveSigners(db, {
    orgId: params.orgId,
    itemTitle: params.title,
    content: params.content,
    templateFields,
    employee: params.employee,
    supervisor: params.supervisor,
  });

  return {
    orgId: params.orgId,
    parentTaskId: params.parentTaskId,
    instanceId: params.instanceId,
    employeeUid: params.employee.uid,
    employeeEmail: params.employee.email,
    employeeName: params.employee.name,
    title: params.title,
    templatePath: params.content.pdfStoragePath,
    documentCategory: params.content.documentCategory || 'fillable_pdf',
    status: 'draft',
    round: 1,
    signers,
    currentSignerOrder: 1,
    completions: [],
    signatures: [],
    workingPdfPath: null,
    openCountersignTaskId: null,
    finalDocument: null,
    history: [],
  };
}

export const currentSigner = (s: Pick<SigningSessionDoc, 'signers' | 'currentSignerOrder'>) =>
  s.signers.find((x) => x.order === s.currentSignerOrder) || null;

/** Display-only mirror written to the parent task's `metadata.signing`. */
export function mirrorFor(s: SigningSessionDoc): TaskSigningMirror {
  const done = s.status === 'fully_executed' || s.status === 'archived';
  const cur = done ? null : currentSigner(s);
  return {
    status: s.status,
    round: s.round,
    currentSignerOrder: s.currentSignerOrder,
    totalSigners: s.signers.length,
    currentSignerUid: cur?.uid ?? null,
    currentSignerName: cur?.name ?? null,
    completedOrders: s.completions.map((c) => c.order),
    readyToSendAndArchive: s.status === 'fully_executed',
    archivedAt: s.status === 'archived' ? s.archive?.archivedAt ?? null : null,
    deliveriesFailed: (s.archive?.deliveries || []).filter((d) => d.status === 'failed').length,
  };
}

/** Everyone allowed to SEE the session (employee, every signer). Admins/supervisor are checked separately. */
export function isSessionParticipant(s: SigningSessionDoc, uid: string): boolean {
  return s.employeeUid === uid || s.signers.some((x) => x.uid === uid);
}

/**
 * Countersign task for a non-employee signer. Deliberately NOT category
 * 'onboarding' and NO `onboardingInstanceId`, so it never counts toward the
 * employee's progress, phase gating, or completion notifications.
 */
export function countersignTaskData(
  s: SigningSessionDoc,
  signer: ResolvedSigner,
  parentTask: FirebaseFirestore.DocumentData,
  taskId: string,
) {
  return {
    id: taskId,
    orgId: s.orgId,
    title: `Sign: ${s.title}`,
    description: `${s.employeeName}'s "${s.title}" is waiting for your signature (signer ${signer.order} of ${s.signers.length}). Open it from the Onboarding page.`,
    priority: 'High',
    column: 'todo',
    assignedTo: signer.uid,
    assignedToEmail: signer.email,
    assignedToName: signer.name,
    assignmentStatus: 'direct',
    createdBy: parentTask.createdBy || s.employeeUid,
    createdByEmail: parentTask.createdByEmail || '',
    createdByName: '',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    dueDate: new Date(Date.now() + 3 * 86_400_000),
    category: COUNTERSIGN_CATEGORY,
    metadata: {
      itemType: 'pdf_form_countersign',
      parentTaskId: s.parentTaskId,
      parentInstanceId: s.instanceId,
      signerOrder: signer.order,
      round: s.round,
      employeeName: s.employeeName,
      signLink: `${dashboardPath(s.orgId, 'onboarding')}?sign=${s.parentTaskId}`,
    },
    comments: [],
    attachments: [],
    isArchived: false,
    isLate: false,
  };
}

/** In-app notice to the next signer (NOT email — routing emails are Phase 4). Never throws. */
export async function notifyNextSigner(s: SigningSessionDoc, signer: ResolvedSigner, actorUid?: string): Promise<void> {
  try {
    await createNotification({
      recipientUids: [signer.uid],
      actorUid,
      orgId: s.orgId,
      type: 'action_board_assigned',
      title: 'Document awaiting your signature',
      body: `${s.employeeName}'s "${s.title}" is ready for your signature.`,
      link: `${dashboardPath(s.orgId, 'onboarding')}?sign=${s.parentTaskId}`,
      refId: s.parentTaskId,
      dedupeKey: `onb-sign-${s.parentTaskId}-r${s.round}-s${signer.order}-${signer.uid}`,
    });
  } catch (e) {
    console.warn('[onboarding-signing] notifyNextSigner failed:', e);
  }
}

/** Storage folder for a session's working files. */
export const sessionStorageDir = (s: Pick<SigningSessionDoc, 'orgId' | 'parentTaskId'>) =>
  `onboarding_signing/${s.orgId}/${s.parentTaskId}`;

/**
 * Who may VIEW a session: participants (employee + every signer), the
 * instance's supervisor, org admins/oracles, and developers. Being able to
 * view never implies being able to sign — sign-step checks the current turn.
 */
export async function canViewSession(
  db: Firestore,
  s: SigningSessionDoc,
  uid: string,
  email: string,
): Promise<boolean> {
  if (isDeveloper(email)) return true;
  if (isSessionParticipant(s, uid)) return true;
  if (s.instanceId) {
    const inst = (await db.collection('onboarding_instances').doc(s.instanceId).get()).data();
    if (inst && (inst.supervisorUid === uid || inst.mentorUid === uid)) return true;
  }
  const role = (await db.doc(`orgs/${s.orgId}/members/${uid}`).get()).data()?.role;
  return role === 'admin' || role === 'oracle';
}

/**
 * Load the session for a parent task, creating it lazily if the task uses a
 * multi-signer workflow but has no session yet (e.g. created by an older
 * code path). Returns null when the task isn't a multi-signer PDF.
 * Throws SigningSetupError when the workflow can't be resolved.
 */
export async function loadOrCreateSession(
  db: Firestore,
  bucket: Bucket,
  taskId: string,
): Promise<{ session: SigningSessionDoc; task: FirebaseFirestore.DocumentData } | null> {
  const taskRef = db.collection('action_board_tasks').doc(taskId);
  const taskSnap = await taskRef.get();
  const task = taskSnap.data();
  const content = task?.metadata?.interactiveContent as PdfFormContent | undefined;
  if (!task || task.category !== 'onboarding' || content?.type !== 'pdf_form' || !isMultiSignerWorkflow(content)) {
    return null;
  }

  const sessionRef = db.collection(SIGNING_SESSIONS).doc(taskId);
  const existing = await sessionRef.get();
  if (existing.exists) return { session: existing.data() as SigningSessionDoc, task };

  const instanceId: string | null = task.metadata?.onboardingInstanceId || null;
  const inst = instanceId ? (await db.collection('onboarding_instances').doc(instanceId).get()).data() : undefined;
  const session = await buildSigningSession(db, bucket, {
    orgId: task.orgId,
    parentTaskId: taskId,
    instanceId,
    title: task.title || content.pdfTitle || 'Document',
    content,
    employee: {
      uid: task.assignedTo,
      email: task.assignedToEmail || '',
      name: task.assignedToName || task.assignedToEmail || 'Employee',
    },
    supervisor: {
      uid: inst?.supervisorUid || inst?.mentorUid || null,
      email: inst?.supervisorEmail || inst?.mentorEmail || null,
    },
  });

  try {
    // create() fails if another request created it first — then just read theirs.
    await sessionRef.create({ ...session, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await taskRef.update({ 'metadata.signing': mirrorFor(session), updatedAt: FieldValue.serverTimestamp() });
    return { session, task };
  } catch {
    const again = await sessionRef.get();
    if (again.exists) return { session: again.data() as SigningSessionDoc, task };
    throw new Error('Could not create the signing session');
  }
}

/** Download a session file as a data URL (small signature PNGs). */
export async function readSignatureDataUrl(bucket: Bucket, path: string): Promise<string> {
  const [buf] = await bucket.file(path).download();
  return `data:image/png;base64,${buf.toString('base64')}`;
}
