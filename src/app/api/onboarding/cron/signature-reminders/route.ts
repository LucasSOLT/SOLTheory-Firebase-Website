// ============================================================================
// /api/onboarding/cron/signature-reminders — Phase 6.1
//
//   GET   Vercel cron (daily). Requires `Authorization: Bearer $CRON_SECRET`.
//         FAILS CLOSED: if CRON_SECRET is unset, nothing can call it.
//   POST  Org admin manual run / preview. Body: { orgId: string, dryRun?: boolean }
//         (or the CRON_SECRET bearer for ops, in which case orgId is optional).
//
// Chases documents that are stuck waiting on a non-employee signer — see
// lib/onboarding-reminders.ts for the policy. Never sends the document itself.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { verifyRequest } from '@/lib/api-auth';
import { canReassignSigners } from '@/lib/onboarding-reassign';
import { runSignatureReminders } from '@/lib/onboarding-reminders';

export const maxDuration = 300;

function hasValidCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET || '';
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!secret || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await initAdmin();
    const { searchParams } = new URL(req.url);
    const result = await runSignatureReminders(getAdminFirestore(), {
      orgId: searchParams.get('orgId'),
      dryRun: searchParams.get('dryRun') === 'true',
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[signature-reminders] cron failed:', err);
    return NextResponse.json({ error: 'Reminder run failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { orgId?: string; dryRun?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body ok for cron-secret callers */ }
  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';

  try {
    await initAdmin();
    const db = getAdminFirestore();

    if (!hasValidCronSecret(req)) {
      const auth = await verifyRequest(req);
      if (!auth.ok) return auth.response;
      if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
      if (!(await canReassignSigners(db, orgId, auth.uid, auth.email))) {
        return NextResponse.json({ error: 'Only organization admins can run reminders.' }, { status: 403 });
      }
    }

    const result = await runSignatureReminders(db, { orgId: orgId || null, dryRun: Boolean(body.dryRun) });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[signature-reminders] manual run failed:', err);
    return NextResponse.json({ error: 'Reminder run failed' }, { status: 500 });
  }
}
