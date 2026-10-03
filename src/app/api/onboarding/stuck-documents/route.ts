// ============================================================================
// /api/onboarding/stuck-documents — Phase 6.5 (admin only)
//
//   GET   ?orgId=            → documents waiting on a signer, worst first
//   POST  { orgId, taskId }  → "Nudge now": remind the current signer immediately
//
// Changing who signs reuses /api/onboarding/pdf-form/reassign-signer.
// Nudges are link-only (never attach the document) and rate-limited per signer.
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { canReassignSigners } from '@/lib/onboarding-reassign';
import { listStuckDocuments } from '@/lib/onboarding-stuck';
import { NudgeError, REMINDER_POLICY, nudgeNow } from '@/lib/onboarding-reminders';
import { logOnboardingAudit } from '@/lib/onboarding-audit';
import { isSafeOrgId } from '@/lib/document-library';

export const runtime = 'nodejs';
export const maxDuration = 30;

function fail(err: any, where: string) {
  if (err instanceof NudgeError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[StuckDocuments:${where}]`, err?.message, err?.stack);
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;
    const orgId = new URL(req.url).searchParams.get('orgId') || '';
    if (!isSafeOrgId(orgId)) return NextResponse.json({ error: 'Missing or invalid orgId' }, { status: 400 });

    await initAdmin();
    const db = getAdminFirestore();
    if (!(await canReassignSigners(db, orgId, auth.uid, auth.email))) {
      return NextResponse.json({ error: 'Only admins can view stuck documents.' }, { status: 403 });
    }
    const items = await listStuckDocuments(db, orgId);
    return NextResponse.json({
      items,
      policy: {
        firstReminderDays: REMINDER_POLICY.firstAfterMs / 86_400_000,
        repeatDays: REMINDER_POLICY.repeatMs / 86_400_000,
        maxReminders: REMINDER_POLICY.maxReminders,
        escalateDays: REMINDER_POLICY.escalateAfterMs / 86_400_000,
      },
    });
  } catch (err) {
    return fail(err, 'GET');
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;
    const body = await req.json().catch(() => ({}));
    const orgId = typeof body.orgId === 'string' ? body.orgId : '';
    const taskId = typeof body.taskId === 'string' ? body.taskId : '';
    if (!isSafeOrgId(orgId) || !taskId) {
      return NextResponse.json({ error: 'Missing orgId or taskId' }, { status: 400 });
    }

    await initAdmin();
    const db = getAdminFirestore();
    if (!(await canReassignSigners(db, orgId, auth.uid, auth.email))) {
      return NextResponse.json({ error: 'Only admins can nudge a signer.' }, { status: 403 });
    }
    // The document must belong to THIS org — an admin of one org can't poke another's.
    const sessionOrg = (await db.collection('onboarding_signing_sessions').doc(taskId).get()).data()?.orgId;
    if (sessionOrg !== orgId) {
      return NextResponse.json({ error: 'That document is not waiting on a signature.' }, { status: 404 });
    }

    const result = await nudgeNow(db, taskId);
    if (result.delivered) {
      await logOnboardingAudit(db, {
        type: 'onboarding_signer_nudged',
        actor: { uid: auth.uid, email: auth.email },
        orgDomain: auth.email.split('@')[1] || orgId,
        description: `${auth.email} nudged ${result.signerName || 'the current signer'} to sign`,
        taskId,
        metadata: { orgId, signerUid: result.signerUid },
      });
    }
    return NextResponse.json({ ok: result.delivered, signerName: result.signerName });
  } catch (err) {
    return fail(err, 'POST');
  }
}
