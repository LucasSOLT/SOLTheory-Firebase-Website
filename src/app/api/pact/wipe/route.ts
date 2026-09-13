import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

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

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { target, orgId } = body;

    if (!target || !orgId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { userUuid, orgUuid } = await resolveUserAndOrg(supabase, auth.uid, orgId);

    let query = supabase.from('working_memories').delete().eq('org_id', orgUuid);

    if (target === 'personal') {
      query = query.eq('scope', 'user').eq('user_id', userUuid);
    } else if (target === 'org') {
      query = query.eq('scope', 'org');
    } else if (target === 'all') {
      query = query.or(`and(scope.eq.user,user_id.eq.${userUuid}),scope.eq.org`);
    } else {
      return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
    }
    
    // Execute Supabase deletion
    const { error: deleteError } = await query;
    if (deleteError) {
      console.error('[PACT API] Error deleting memories:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Wipe legacy Firestore
    initAdmin();
    const db = getAdminFirestore();
    const userDocRef = db.collection('users').doc(auth.uid);
    
    const updateData: any = {
      pact_entries_soltheory: FieldValue.delete()
    };
    
    // We can also wipe any specific org entries if present
    const cleanSlug = orgId.replace(/\.(com|org|net)$/i, '');
    updateData[`pact_entries_${cleanSlug}`] = FieldValue.delete();
    
    await userDocRef.update(updateData).catch((e: any) => {
      // Ignore if document or fields don't exist
      console.log('[PACT API] Firestore update error (ignoring):', e.message);
    });

    console.log(`[PACT API] Successfully wiped memories for target ${target}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PACT API] Wipe error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
