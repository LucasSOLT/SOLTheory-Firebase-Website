import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pact/cleanup
 *
 * Serverless P.A.C.T. memory cleanup endpoint.
 * Scans the caller's working_memories, sends them through Gemini Flash
 * evaluation (via /api/pact-evaluate), soft-deletes stale entries, and
 * updates review metadata on kept entries.
 *
 * Body: { orgId: string, scope?: 'user' | 'org' | 'all', userName?: string }
 * Returns: { success, scannedCount, prunedCount, retainedCount, model }
 */

async function resolveUserAndOrg(supabase: any, uid: string, orgId: string) {
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('firebase_uid', uid)
    .single();

  if (userError || !userData) {
    throw new Error('User not found in Supabase');
  }

  const cleanSlug = orgId.replace(/\.(com|org|net)$/i, '');
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', cleanSlug)
    .single();

  if (orgError || !orgData) {
    throw new Error('Organization not found in Supabase');
  }

  return { userUuid: userData.id, orgUuid: orgData.id };
}

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { orgId, scope = 'user', userName } = body;

    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
    }
    if (!['user', 'org', 'all'].includes(scope)) {
      return NextResponse.json({ error: 'Invalid scope — must be user, org, or all' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { userUuid, orgUuid } = await resolveUserAndOrg(supabase, auth.uid, orgId);

    // ── 1. Fetch active (non-deleted) memories ──
    const scopesToClean: string[] = scope === 'all' ? ['user', 'org'] : [scope];
    let allMemories: any[] = [];

    for (const s of scopesToClean) {
      let query = supabase
        .from('working_memories')
        .select('*')
        .eq('org_id', orgUuid)
        .eq('scope', s)
        .is('marked_for_deletion', null)
        .order('created_at', { ascending: false });

      if (s === 'user') {
        query = query.eq('user_id', userUuid);
      }

      const { data, error } = await query;
      if (error) {
        console.error(`[PACT Cleanup] Error fetching ${s} memories:`, error);
        continue;
      }
      if (data) allMemories = allMemories.concat(data);
    }

    if (allMemories.length === 0) {
      return NextResponse.json({
        success: true,
        scannedCount: 0,
        prunedCount: 0,
        retainedCount: 0,
        model: 'none',
        message: 'No active memories to clean up',
      });
    }

    // ── 2. Build evaluation payload matching pact-evaluate's expected format ──
    const evalEntries = allMemories.map((m) => ({
      question: m.question,
      answer: m.answer,
      userRestored: !!m.user_restored,
      reviewCount: m.review_count || 0,
      lastReviewResult: m.last_review_result || null,
      lastReviewReason: m.last_review_reason || null,
    }));

    // ── 3. Call pact-evaluate internally ──
    // Build the internal URL for the evaluate endpoint
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host') || 'www.soltheory.com';
    const evaluateUrl = `${protocol}://${host}/api/pact-evaluate`;

    // Forward the auth header from the original request
    const authHeader = req.headers.get('authorization') || '';
    const xFirebaseUid = req.headers.get('x-firebase-uid') || '';

    const evalRes = await fetch(evaluateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'x-firebase-uid': xFirebaseUid,
      },
      body: JSON.stringify({
        entries: evalEntries,
        userName: userName || 'the user',
      }),
    });

    if (!evalRes.ok) {
      const errText = await evalRes.text();
      console.error('[PACT Cleanup] Evaluate call failed:', evalRes.status, errText.slice(0, 300));
      return NextResponse.json(
        { error: 'Memory evaluation failed', detail: errText.slice(0, 200) },
        { status: 502 }
      );
    }

    const evalData = await evalRes.json();
    const decisions: { index: number; keep: boolean; reason: string }[] = evalData.decisions || [];

    // ── 4. Apply decisions: soft-delete discards, update review metadata on keeps ──
    let prunedCount = 0;
    let retainedCount = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < decisions.length; i++) {
      const decision = decisions[i];
      const memory = allMemories[decision.index];
      if (!memory) continue;

      if (!decision.keep) {
        // Soft-delete: set marked_for_deletion (24-hour grace period on client)
        const { error: flagErr } = await supabase
          .from('working_memories')
          .update({
            marked_for_deletion: now,
            deletion_reason: decision.reason || 'Automated cleanup — low value',
            updated_at: now,
          })
          .eq('id', memory.id);

        if (flagErr) {
          console.error(`[PACT Cleanup] Error flagging memory ${memory.id}:`, flagErr);
        } else {
          prunedCount++;
        }
      } else {
        // Update review metadata on kept entries
        const currentReviewCount = memory.review_count || 0;
        const { error: keepErr } = await supabase
          .from('working_memories')
          .update({
            review_count: currentReviewCount + 1,
            last_reviewed_at: now,
            last_review_result: 'kept',
            last_review_reason: decision.reason || 'Deemed valuable',
            updated_at: now,
          })
          .eq('id', memory.id);

        if (keepErr) {
          console.error(`[PACT Cleanup] Error updating review on memory ${memory.id}:`, keepErr);
        }
        retainedCount++;
      }
    }

    console.log(`[PACT Cleanup] Complete — scanned: ${allMemories.length}, pruned: ${prunedCount}, retained: ${retainedCount}, model: ${evalData.model}`);

    return NextResponse.json({
      success: true,
      scannedCount: allMemories.length,
      prunedCount,
      retainedCount,
      model: evalData.model || 'unknown',
    });
  } catch (error: any) {
    console.error('[PACT Cleanup] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
