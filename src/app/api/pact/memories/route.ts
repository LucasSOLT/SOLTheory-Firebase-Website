import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { initAdmin } from '@/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function getAdminDb() {
  initAdmin();
  return getFirestore();
}

function getFirestoreCollection(scope: string, uid: string, cleanSlug: string) {
  const db = getAdminDb();
  if (scope === 'org') {
    return db.collection(`orgs/${cleanSlug}/working_memories`);
  }
  return db.collection(`users/${uid}/working_memories`);
}

async function resolveUserAndOrg(supabase: any, uid: string, orgId: string, email?: string) {
  if (!supabase) return { userUuid: null, orgUuid: null };

  let userUuid: string | null = null;
  let orgUuid: string | null = null;

  try {
    // 1. Resolve User
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', uid)
      .maybeSingle();

    if (userData?.id) {
      userUuid = userData.id;
    } else {
      // Auto-provision user in Supabase
      const { data: newUser, error: insertUserErr } = await supabase
        .from('users')
        .upsert(
          {
            firebase_uid: uid,
            email: email || undefined,
            display_name: email ? email.split('@')[0] : 'User',
            access_level: 'User-Level',
          },
          { onConflict: 'firebase_uid' }
        )
        .select('id')
        .maybeSingle();

      if (!insertUserErr && newUser?.id) {
        userUuid = newUser.id;
      }
    }
  } catch (err: any) {
    console.warn('[PACT API] Supabase user resolution warning:', err.message);
  }

  try {
    // 2. Resolve Org
    const cleanSlug = orgId.replace(/\.(com|org|net)$/i, '');
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (orgData?.id) {
      orgUuid = orgData.id;
    } else {
      // Auto-provision organization in Supabase
      const companyName = cleanSlug.charAt(0).toUpperCase() + cleanSlug.slice(1);
      const { data: newOrg, error: insertOrgErr } = await supabase
        .from('organizations')
        .upsert(
          {
            slug: cleanSlug,
            company_name: companyName,
          },
          { onConflict: 'slug' }
        )
        .select('id')
        .maybeSingle();

      if (!insertOrgErr && newOrg?.id) {
        orgUuid = newOrg.id;
      }
    }

    if (userUuid && orgUuid) {
      try {
        await supabase
          .from('org_members')
          .upsert(
            {
              user_id: userUuid,
              org_id: orgUuid,
              role: 'member',
            },
            { onConflict: 'user_id,org_id' }
          );
      } catch {
        // Non-blocking membership upsert
      }
    }
  } catch (err: any) {
    console.warn('[PACT API] Supabase org resolution warning:', err.message);
  }

  return { userUuid, orgUuid };
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

    const cleanSlug = orgId.replace(/\.(com|org|net)$/i, '');

    // Try Supabase first
    let supabaseResults: any[] | null = null;
    try {
      const supabase = createServiceClient();
      const { userUuid, orgUuid } = await resolveUserAndOrg(supabase, auth.uid, orgId, auth.email);

      if (orgUuid && (scope === 'org' || userUuid)) {
        let query = supabase.from('working_memories').select('*');
        if (scope === 'user') {
          query = query.eq('scope', 'user').eq('user_id', userUuid).eq('org_id', orgUuid);
        } else if (scope === 'org') {
          query = query.eq('scope', 'org').eq('org_id', orgUuid);
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) {
          supabaseResults = data;
        }
      }
    } catch (err: any) {
      console.warn('[PACT API] Supabase query bypassed/failed, falling back to Firestore:', err.message);
    }

    if (supabaseResults !== null && supabaseResults.length > 0) {
      return NextResponse.json(supabaseResults);
    }

    // Fallback or read from Firestore
    try {
      const firestoreCol = getFirestoreCollection(scope, auth.uid, cleanSlug);
      const snapshot = await firestoreCol.orderBy('created_at', 'desc').get();
      const firestoreResults = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      return NextResponse.json(firestoreResults);
    } catch (fsErr: any) {
      console.warn('[PACT API] Firestore fallback query error:', fsErr.message);
      // Return Supabase results even if empty or empty array
      return NextResponse.json(supabaseResults || []);
    }
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

    const cleanSlug = orgId.replace(/\.(com|org|net)$/i, '');
    const trimmedQuestion = question.trim();
    const trimmedAnswer = answer.trim();

    const memoryPayload = {
      scope,
      question: trimmedQuestion,
      answer: trimmedAnswer,
      category: category || 'preference',
      confidence: confidence || 'high',
      source: source || 'manual',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let savedResult: any = null;

    // 1. Try writing to Supabase
    try {
      const supabase = createServiceClient();
      const { userUuid, orgUuid } = await resolveUserAndOrg(supabase, auth.uid, orgId, auth.email);

      if (orgUuid && (scope === 'org' || userUuid)) {
        let checkQuery = supabase
          .from('working_memories')
          .select('id, question, answer, category, confidence')
          .eq('scope', scope)
          .eq('org_id', orgUuid)
          .ilike('question', trimmedQuestion);

        if (scope === 'user') {
          checkQuery = checkQuery.eq('user_id', userUuid);
        }

        const { data: existingMem } = await checkQuery.maybeSingle();

        if (existingMem) {
          if (existingMem.answer.trim().toLowerCase() === trimmedAnswer.toLowerCase()) {
            savedResult = { ...existingMem, deduplicated: true };
          } else {
            const { data: updatedMem } = await supabase
              .from('working_memories')
              .update({
                answer: trimmedAnswer,
                category: category || existingMem.category,
                confidence: confidence || existingMem.confidence,
                source: source || 'updated',
                marked_for_deletion: null,
                deletion_reason: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingMem.id)
              .select()
              .maybeSingle();

            savedResult = updatedMem || existingMem;
          }
        } else {
          const { data: insertedMem } = await supabase
            .from('working_memories')
            .insert({
              ...memoryPayload,
              user_id: userUuid,
              org_id: orgUuid,
            })
            .select()
            .maybeSingle();

          if (insertedMem) {
            savedResult = insertedMem;
          }
        }
      }
    } catch (sbErr: any) {
      console.warn('[PACT API] Supabase write skipped/failed:', sbErr.message);
    }

    // 2. Dual-write or fallback write to Firestore
    try {
      const firestoreCol = getFirestoreCollection(scope, auth.uid, cleanSlug);

      // Check if same question exists
      const existingDocs = await firestoreCol.where('question', '==', trimmedQuestion).get();
      if (!existingDocs.empty) {
        const existingDoc = existingDocs.docs[0];
        await existingDoc.ref.update({
          answer: trimmedAnswer,
          category: category || 'preference',
          confidence: confidence || 'high',
          updated_at: new Date().toISOString(),
          marked_for_deletion: null,
        });
        if (!savedResult) {
          savedResult = { id: existingDoc.id, ...existingDoc.data(), answer: trimmedAnswer };
        }
      } else {
        const docRef = savedResult?.id ? firestoreCol.doc(savedResult.id) : firestoreCol.doc();
        await docRef.set({
          ...memoryPayload,
          id: docRef.id,
          org_id: cleanSlug,
          user_id: auth.uid,
        }, { merge: true });

        if (!savedResult) {
          savedResult = { id: docRef.id, ...memoryPayload };
        }
      }
    } catch (fsErr: any) {
      console.warn('[PACT API] Firestore write warning:', fsErr.message);
    }

    if (savedResult) {
      return NextResponse.json(savedResult);
    }

    // If both somehow failed, return a valid object so UI does not crash
    return NextResponse.json({
      id: `local-${Date.now()}`,
      ...memoryPayload,
    });
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
    const { id, ids, scope, orgId, purgeFlagged } = body;

    if (!scope || !orgId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const cleanSlug = orgId.replace(/\.(com|org|net)$/i, '');
    const targetIds = Array.isArray(ids) ? ids : (id ? [id] : []);

    // 1. Try Supabase delete
    try {
      const supabase = createServiceClient();
      const { userUuid, orgUuid } = await resolveUserAndOrg(supabase, auth.uid, orgId, auth.email);

      if (orgUuid) {
        let query = supabase.from('working_memories').delete().eq('org_id', orgUuid);
        if (purgeFlagged) {
          query = query.not('marked_for_deletion', 'is', null);
        } else if (targetIds.length > 0) {
          query = query.in('id', targetIds);
        }
        if (scope === 'user' && userUuid) {
          query = query.eq('user_id', userUuid);
        }
        await query;
      }
    } catch (sbErr: any) {
      console.warn('[PACT API] Supabase delete warning:', sbErr.message);
    }

    // 2. Firestore delete
    try {
      const firestoreCol = getFirestoreCollection(scope, auth.uid, cleanSlug);
      if (purgeFlagged) {
        const flaggedDocs = await firestoreCol.where('marked_for_deletion', '!=', null).get();
        const batch = getAdminDb().batch();
        flaggedDocs.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      } else {
        const batch = getAdminDb().batch();
        for (const tid of targetIds) {
          batch.delete(firestoreCol.doc(tid));
        }
        await batch.commit();
      }
    } catch (fsErr: any) {
      console.warn('[PACT API] Firestore delete warning:', fsErr.message);
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

    const cleanSlug = orgId.replace(/\.(com|org|net)$/i, '');

    // 1. Try Supabase
    try {
      const supabase = createServiceClient();
      const { userUuid, orgUuid } = await resolveUserAndOrg(supabase, auth.uid, orgId, auth.email);

      if (orgUuid) {
        if (action === 'promote') {
          const { data: sourceMemory } = await supabase
            .from('working_memories')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (sourceMemory) {
            await supabase.from('working_memories').upsert({
              scope: 'org',
              user_id: userUuid,
              org_id: orgUuid,
              question: sourceMemory.question,
              answer: sourceMemory.answer,
              category: sourceMemory.category || 'preference',
              confidence: sourceMemory.confidence || 'high',
              source: 'promoted',
            });
          }
        } else if (action === 'restore') {
          await supabase
            .from('working_memories')
            .update({
              marked_for_deletion: null,
              deletion_reason: null,
              user_restored: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);
        } else if (action === 'flag') {
          await supabase
            .from('working_memories')
            .update({
              marked_for_deletion: new Date().toISOString(),
              deletion_reason: updates.reason || 'Flagged for deletion',
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);
        } else {
          const updatePayload: Record<string, any> = {
            updated_at: new Date().toISOString(),
            ...updates,
          };
          await supabase.from('working_memories').update(updatePayload).eq('id', id);
        }
      }
    } catch (sbErr: any) {
      console.warn('[PACT API] Supabase PATCH warning:', sbErr.message);
    }

    // 2. Firestore PATCH / promote
    try {
      const db = getAdminDb();
      if (action === 'promote') {
        const userMemDoc = await db.collection(`users/${auth.uid}/working_memories`).doc(id).get();
        if (userMemDoc.exists) {
          const data = userMemDoc.data() || {};
          await db.collection(`orgs/${cleanSlug}/working_memories`).add({
            ...data,
            scope: 'org',
            source: 'promoted',
            updated_at: new Date().toISOString(),
          });
        }
      } else if (action === 'restore') {
        const userRef = db.collection(`users/${auth.uid}/working_memories`).doc(id);
        const orgRef = db.collection(`orgs/${cleanSlug}/working_memories`).doc(id);
        const [uDoc, oDoc] = await Promise.all([userRef.get(), orgRef.get()]);
        if (uDoc.exists) await userRef.update({ marked_for_deletion: null, user_restored: true });
        if (oDoc.exists) await orgRef.update({ marked_for_deletion: null, user_restored: true });
      } else if (action === 'flag') {
        const userRef = db.collection(`users/${auth.uid}/working_memories`).doc(id);
        const orgRef = db.collection(`orgs/${cleanSlug}/working_memories`).doc(id);
        const [uDoc, oDoc] = await Promise.all([userRef.get(), orgRef.get()]);
        const flagData = { marked_for_deletion: new Date().toISOString(), deletion_reason: updates.reason || 'Flagged' };
        if (uDoc.exists) await userRef.update(flagData);
        if (oDoc.exists) await orgRef.update(flagData);
      } else {
        const userRef = db.collection(`users/${auth.uid}/working_memories`).doc(id);
        const orgRef = db.collection(`orgs/${cleanSlug}/working_memories`).doc(id);
        const [uDoc, oDoc] = await Promise.all([userRef.get(), orgRef.get()]);
        if (uDoc.exists) await userRef.update({ ...updates, updated_at: new Date().toISOString() });
        if (oDoc.exists) await orgRef.update({ ...updates, updated_at: new Date().toISOString() });
      }
    } catch (fsErr: any) {
      console.warn('[PACT API] Firestore PATCH warning:', fsErr.message);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PACT API] PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
