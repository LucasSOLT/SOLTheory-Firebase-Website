// ============================================================================
// lib/onboarding-audit.ts — one audit writer for every onboarding document action
//
// Phase 5, Step 5.2 (Onboarding Document System — APPROVED PLAN)
//
// Every signing action, re-request, reassignment and archive action writes an
// `activity_log` entry through this helper so each one carries, uniformly:
//   • who did it      → metadata.actorUid + metadata.actorEmail (+ userEmail/userName)
//   • when            → timestamp (server time)
//   • which document  → metadata.taskId (+ docId when relevant)
//   • document hash   → metadata.documentSha256 (the PDF as it stood at that moment)
//
// Best effort: an audit-log failure must never block the action it describes.
// ============================================================================

import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export interface OnboardingAuditEntry {
  type: string;
  actor: { uid: string; email: string; name?: string };
  /** Value stored in the legacy `orgDomain` column (callers keep their existing convention). */
  orgDomain: string;
  description: string;
  taskId: string;
  /** SHA-256 of the document state this action produced or acted on, when one exists. */
  documentSha256?: string | null;
  category?: string;
  /** Extra, action-specific fields. Reserved keys below always win. */
  metadata?: Record<string, unknown>;
}

/** Writes the entry; returns false (never throws) if the write failed. */
export async function logOnboardingAudit(db: Firestore, e: OnboardingAuditEntry): Promise<boolean> {
  try {
    await db.collection('activity_log').add({
      type: e.type,
      userEmail: e.actor.email,
      userName: e.actor.name || (e.actor.email || '').split('@')[0],
      orgDomain: e.orgDomain,
      description: e.description,
      category: e.category || 'onboarding',
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        ...(e.metadata || {}),
        taskId: e.taskId,
        actorUid: e.actor.uid,
        actorEmail: e.actor.email,
        ...(e.documentSha256 ? { documentSha256: e.documentSha256 } : {}),
      },
    });
    return true;
  } catch (err) {
    console.warn('[onboarding-audit] write failed:', (err as any)?.message || err);
    return false;
  }
}
