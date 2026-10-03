// ============================================================================
// lib/onboarding-stuck.ts — Phase 6.5 (SERVER-ONLY)
//
// "Stuck documents": every multi-signer document in an org that is waiting on
// someone, how long it has waited, and what the reminder system has done so
// far. Read-only; the admin acts through the existing reassign route and the
// nudge route.
// ============================================================================

import type { Firestore } from 'firebase-admin/firestore';
import { SIGNING_SESSIONS, currentSigner, type SigningSessionDoc } from '@/lib/onboarding-signing';
import { REMINDER_POLICY, stateFor, waitingSinceMs } from '@/lib/onboarding-reminders';

export type StuckLevel = 'on_track' | 'waiting' | 'stuck' | 'signer_left';

export interface StuckDocument {
  taskId: string;
  title: string;
  employeeName: string;
  waitingOn: {
    order: number;
    uid: string;
    name: string;
    label: string;
    kind: 'employee' | 'supervisor' | 'member';
    inOrg: boolean;
  };
  signedCount: number;
  totalSigners: number;
  waitingSinceMs: number;
  waitedDays: number;
  remindersSent: number;
  lastReminderAt: number;
  lastNudgeAt: number;
  escalatedAt: number;
  level: StuckLevel;
  /** Whether "Nudge now" makes sense (someone is there to nudge). */
  canNudge: boolean;
  employeeUid: string;
  /** Full chain, shaped for `ReassignSignerPanel`. */
  signers: {
    order: number;
    label: string;
    name: string;
    uid: string;
    kind: 'employee' | 'supervisor' | 'member';
    completed: boolean;
    inOrg: boolean;
  }[];
}

const DAY = 86_400_000;

export function levelFor(waitedMs: number, signerInOrg: boolean): StuckLevel {
  if (!signerInOrg) return 'signer_left';
  if (waitedMs >= REMINDER_POLICY.escalateAfterMs) return 'stuck';
  if (waitedMs >= REMINDER_POLICY.firstAfterMs) return 'waiting';
  return 'on_track';
}

const RANK: Record<StuckLevel, number> = { signer_left: 0, stuck: 1, waiting: 2, on_track: 3 };

export async function listStuckDocuments(db: Firestore, orgId: string, nowMs = Date.now()): Promise<StuckDocument[]> {
  const snap = await db
    .collection(SIGNING_SESSIONS)
    .where('orgId', '==', orgId)
    .where('status', '==', 'partially_signed')
    .get();

  const memberCache = new Map<string, boolean>();
  const isMember = async (uid: string) => {
    if (!memberCache.has(uid)) {
      let ok = true;
      try {
        ok = (await db.doc(`orgs/${orgId}/members/${uid}`).get()).exists;
      } catch {
        ok = true; // fail open — never claim someone left if we can't tell
      }
      memberCache.set(uid, ok);
    }
    return memberCache.get(uid)!;
  };

  const out: StuckDocument[] = [];
  for (const d of snap.docs.slice(0, REMINDER_POLICY.maxSessionsPerRun)) {
    const s = d.data() as SigningSessionDoc;
    const signer = currentSigner(s);
    if (!signer) continue;
    const isEmployeeTurn = signer.kind === 'employee' || signer.uid === s.employeeUid;
    const inOrg = isEmployeeTurn ? true : await isMember(signer.uid);
    const since = waitingSinceMs(s);
    const waited = since ? Math.max(0, nowMs - since) : 0;
    const st = stateFor(s, signer);
    out.push({
      taskId: d.id,
      title: s.title,
      employeeName: s.employeeName,
      waitingOn: {
        order: signer.order,
        uid: signer.uid,
        name: signer.name,
        label: signer.label || '',
        kind: signer.kind,
        inOrg,
      },
      signedCount: (s.completions || []).length,
      totalSigners: s.signers.length,
      waitingSinceMs: since,
      waitedDays: Math.floor(waited / DAY),
      remindersSent: st.count,
      lastReminderAt: st.lastAt || 0,
      lastNudgeAt: st.manualAt || 0,
      escalatedAt: st.escalatedAt || 0,
      level: levelFor(waited, inOrg),
      canNudge: inOrg,
      employeeUid: s.employeeUid,
      signers: await Promise.all(
        s.signers.map(async (sg) => ({
          order: sg.order,
          label: sg.label || '',
          name: sg.name,
          uid: sg.uid,
          kind: sg.kind,
          completed: (s.completions || []).some((c) => c.order === sg.order),
          inOrg: sg.kind === 'employee' || sg.uid === s.employeeUid ? true : await isMember(sg.uid),
        })),
      ),
    });
  }
  // Worst first (signer left, then stuck, waiting, on track); within a level, the longest wait first.
  return out.sort((a, b) => RANK[a.level] - RANK[b.level] || a.waitingSinceMs - b.waitingSinceMs);
}
