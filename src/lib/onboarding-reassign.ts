// ============================================================================
// lib/onboarding-reassign.ts — Phase 5, Step 5.1 (SERVER-ONLY, pure + small)
//
// Hand a NOT-YET-SIGNED slot of a multi-party document to another org member
// (e.g. the HR signer left the company mid-signing).
//
// Hard rules (all enforced here so the route stays thin):
//   • Only an unsigned slot can move — a recorded signature is evidence and is
//     never rewritten.
//   • The employee's own slot can't be reassigned (it IS the assignment).
//   • Not after the document is fully executed / archived.
//   • The new signer must be a current member of the org and not the employee.
//   • Field ownership is by slot, not by person, so nothing else changes.
// ============================================================================

import type { Firestore } from 'firebase-admin/firestore';
import { isDeveloper } from '@/lib/org-config';
import type { ResolvedSigner, SignerReassignment, SigningSessionDoc } from '@/lib/onboarding-signing';

export class ReassignError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Only org admins/oracles and developers may re-route a document. */
export async function canReassignSigners(db: Firestore, orgId: string, uid: string, email: string): Promise<boolean> {
  if (isDeveloper(email)) return true;
  const role = (await db.doc(`orgs/${orgId}/members/${uid}`).get()).data()?.role;
  return role === 'admin' || role === 'oracle';
}

export interface ReassignTarget {
  uid: string;
  email: string;
  name: string;
}

/** Validate + apply. Returns the next session value and the slot it replaced. Never mutates the input. */
export function applyReassignment(
  session: SigningSessionDoc,
  order: number,
  to: ReassignTarget,
  by: { uid: string; email: string },
  nowIso = new Date().toISOString(),
): { next: SigningSessionDoc; previous: ResolvedSigner; updated: ResolvedSigner; isCurrent: boolean } {
  if (session.status === 'fully_executed' || session.status === 'archived') {
    throw new ReassignError('This document is already fully signed, so its signers can no longer change.', 409);
  }
  const slot = session.signers.find((s) => s.order === order);
  if (!slot) throw new ReassignError('That signing step does not exist.', 404);
  if (session.completions.some((c) => c.order === order)) {
    throw new ReassignError(`${slot.name} has already signed, so their step cannot be reassigned.`, 409);
  }
  if (slot.kind === 'employee' || slot.uid === session.employeeUid) {
    throw new ReassignError("The employee's own step can't be reassigned.", 400);
  }
  if (!to.uid) throw new ReassignError('Choose who should sign instead.', 400);
  if (to.uid === session.employeeUid) throw new ReassignError('The employee cannot be assigned as another signer.', 400);
  if (to.uid === slot.uid) throw new ReassignError(`${slot.name} is already assigned to this step.`, 400);

  const updated: ResolvedSigner = { ...slot, uid: to.uid, email: to.email, name: to.name || to.email };
  const record: SignerReassignment = {
    round: session.round,
    order,
    fromUid: slot.uid,
    fromEmail: slot.email,
    fromName: slot.name,
    toUid: updated.uid,
    toEmail: updated.email,
    toName: updated.name,
    byUid: by.uid,
    byEmail: by.email,
    at: nowIso,
  };
  const next: SigningSessionDoc = {
    ...session,
    signers: session.signers.map((s) => (s.order === order ? updated : s)),
    reassignments: [...(session.reassignments || []), record],
  };
  return { next, previous: slot, updated, isCurrent: session.currentSignerOrder === order };
}
