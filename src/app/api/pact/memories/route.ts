import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function resolveUserAndOrg(supabase: any, uid: string, orgId: string) {
  // Resolve User
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('firebase_uid', uid)
    .single();

  if (userError || !userData) {
    throw new Error('User not found in Supabase');
  }

  // Resolve Org
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

export async function GET(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope');
    const orgId = searchParams.get('orgId');

    if (!scope || !orgId) {
      return NextResponse.json({ error: 'Missing scope or orgId' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { userUuid, orgUuid } = await resolveUserAndOrg(supabase, auth.uid, orgId);

    let query = supabase.from('working_memories').select('*');

    if (scope === 'user') {
      query = query.eq('scope', 'user').eq('user_id', userUuid).eq('org_id', orgUuid);
    } else if (scope === 'org') {
      query = query.eq('scope', 'org').eq('org_id', orgUuid);
    } else {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[PACT API] Error querying memories:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[PACT API] GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { scope, orgId, question, answer, category, confidence, source } = body;

    if (!scope || !orgId || !question || !answer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { userUuid, orgUuid } = await resolveUserAndOrg(supabase, auth.uid, orgId);

    const memoryData = {
      scope,
      user_id: userUuid,
      org_id: orgUuid,
      question,
      answer,
      category,
      confidence,
      source
    };

    const { data, error } = await supabase
      .from('working_memories')
      .insert(memoryData)
      .select()
      .single();

    if (error) {
      console.error('[PACT API] Error inserting memory:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[PACT API] POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { id, scope, orgId } = body;

    if (!id || !scope || !orgId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { userUuid, orgUuid } = await resolveUserAndOrg(supabase, auth.uid, orgId);

    let query = supabase.from('working_memories').delete().eq('id', id).eq('org_id', orgUuid);

    if (scope === 'user') {
      query = query.eq('user_id', userUuid);
    } else if (scope === 'org') {
      // All org members can delete org memories.
    } else {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }

    const { error } = await query;

    if (error) {
      console.error('[PACT API] Error deleting memory:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PACT API] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { id, orgId, action, ...updates } = body;

    if (!id || !orgId) {
      return NextResponse.json({ error: 'Missing id or orgId' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { userUuid, orgUuid } = await resolveUserAndOrg(supabase, auth.uid, orgId);

    // Promote action: clone user memory to org scope
    if (action === 'promote') {
      const { data: sourceMemory, error: fetchErr } = await supabase
        .from('working_memories')
        .select('*')
        .eq('id', id)
        .eq('org_id', orgUuid)
        .single();

      if (fetchErr || !sourceMemory) {
        return NextResponse.json({ error: 'Source memory not found' }, { status: 404 });
      }

      // Check if duplicate already exists in org scope
      const { data: existingOrgMem } = await supabase
        .from('working_memories')
        .select('id')
        .eq('scope', 'org')
        .eq('org_id', orgUuid)
        .eq('question', sourceMemory.question)
        .maybeSingle();

      if (existingOrgMem) {
        return NextResponse.json({ success: true, message: 'Already exists in organization memory', id: existingOrgMem.id });
      }

      const { data: newOrgMem, error: insertErr } = await supabase
        .from('working_memories')
        .insert({
          scope: 'org',
          user_id: userUuid,
          org_id: orgUuid,
          question: sourceMemory.question,
          answer: sourceMemory.answer,
          category: sourceMemory.category || 'preference',
          confidence: sourceMemory.confidence || 'high',
          source: 'promoted',
        })
        .select()
        .single();

      if (insertErr) {
        console.error('[PACT API] Promote error:', insertErr);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, promoted: newOrgMem });
    }

    // Restore action
    if (action === 'restore') {
      const { error: restoreErr } = await supabase
        .from('working_memories')
        .update({
          marked_for_deletion: null,
          deletion_reason: null,
          user_restored: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('org_id', orgUuid);

      if (restoreErr) {
        console.error('[PACT API] Restore error:', restoreErr);
        return NextResponse.json({ error: restoreErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Flag action (soft delete)
    if (action === 'flag') {
      const { error: flagErr } = await supabase
        .from('working_memories')
        .update({
          marked_for_deletion: new Date().toISOString(),
          deletion_reason: updates.reason || 'Flagged for deletion',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('org_id', orgUuid);

      if (flagErr) {
        console.error('[PACT API] Flag error:', flagErr);
        return NextResponse.json({ error: flagErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // General field update (e.g. review metadata or question/answer)
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.question !== undefined) updatePayload.question = updates.question;
    if (updates.answer !== undefined) updatePayload.answer = updates.answer;
    if (updates.category !== undefined) updatePayload.category = updates.category;
    if (updates.confidence !== undefined) updatePayload.confidence = updates.confidence;
    if (updates.review_count !== undefined) updatePayload.review_count = updates.review_count;
    if (updates.last_reviewed_at !== undefined) updatePayload.last_reviewed_at = updates.last_reviewed_at;
    if (updates.last_review_result !== undefined) updatePayload.last_review_result = updates.last_review_result;
    if (updates.last_review_reason !== undefined) updatePayload.last_review_reason = updates.last_review_reason;

    const { error: updateErr } = await supabase
      .from('working_memories')
      .update(updatePayload)
      .eq('id', id)
      .eq('org_id', orgUuid);

    if (updateErr) {
      console.error('[PACT API] Update error:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PACT API] PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
