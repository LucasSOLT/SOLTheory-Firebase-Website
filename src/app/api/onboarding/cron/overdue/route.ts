// ============================================================================
// /api/onboarding/cron/overdue — Phase I, Step I7
//
//   GET   Scheduled cron sweep. Requires `Authorization: Bearer $CRON_SECRET`.
//         FAILS CLOSED: if CRON_SECRET is unset or mismatched, nothing runs.
//   POST  Org admin manual run / preview. Body: { orgId: string, instanceId?: string, dryRun?: boolean }
//         (or the CRON_SECRET bearer for ops, in which case orgId is optional).
//
// Marks past-due onboarding items Overdue (without ever deleting or hiding them)
// and sends a one-time bell notification + email to both the employee and their
// assigned supervisor.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { verifyRequest } from '@/lib/api-auth';
import { canReassignSigners } from '@/lib/onboarding-reassign';
import { runOnboardingOverdue } from '@/lib/onboarding-overdue';

export const maxDuration = 300;

export function hasValidCronSecret(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || '').trim();
  const authHeader = req.headers.get('authorization') || '';
  if (!secret || !/^Bearer\s+/i.test(authHeader)) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!hasValidCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await initAdmin();
    const { searchParams } = new URL(req.url);
    const result = await runOnboardingOverdue(getAdminFirestore(), {
      orgId: searchParams.get('orgId'),
      instanceId: searchParams.get('instanceId'),
      dryRun: searchParams.get('dryRun') === 'true',
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[onboarding-overdue] cron failed:', err);
    return NextResponse.json({ error: 'Overdue sweep failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { orgId?: string; instanceId?: string; dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok for cron-secret callers */
  }
  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  const instanceId = typeof body.instanceId === 'string' ? body.instanceId.trim() : '';

  try {
    if (!hasValidCronSecret(req)) {
      const auth = await verifyRequest(req);
      if (!auth.ok) return auth.response;
      if (!orgId) {
        return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
      }
      await initAdmin();
      const db = getAdminFirestore();
      if (!(await canReassignSigners(db, orgId, auth.uid, auth.email))) {
        return NextResponse.json(
          { error: 'Only organization admins can run overdue checks.' },
          { status: 403 },
        );
      }
      const result = await runOnboardingOverdue(db, {
        orgId: orgId || null,
        instanceId: instanceId || null,
        dryRun: Boolean(body.dryRun),
      });
      return NextResponse.json({ success: true, ...result });
    }

    await initAdmin();
    const db = getAdminFirestore();
    const result = await runOnboardingOverdue(db, {
      orgId: orgId || null,
      instanceId: instanceId || null,
      dryRun: Boolean(body.dryRun),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[onboarding-overdue] manual run failed:', err);
    return NextResponse.json({ error: 'Overdue sweep failed' }, { status: 500 });
  }
}
