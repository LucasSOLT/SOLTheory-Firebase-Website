import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { compileBrainProfileToText, PERSONAL_BRAIN_QUESTIONS, ORG_BRAIN_QUESTIONS, countAnswered } from '@/lib/brain-questions';
import { ADMIN_EMAILS } from '@/lib/admin';

export async function GET(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope');
    const orgId = searchParams.get('orgId');

    console.log(`[Brain Profile API] GET scope=${scope} orgId=${orgId} uid=${auth.uid}`);

    if (scope !== 'personal' && scope !== 'org') {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }

    await initAdmin();
    const db = getAdminFirestore();
    const emptyProfile = { answers: {}, compiledBriefing: '', updatedAt: '' };

    if (scope === 'personal') {
      const userDoc = await db.doc(`users/${auth.uid}`).get();
      if (!userDoc.exists) {
        return NextResponse.json(emptyProfile);
      }
      const data = userDoc.data();
      return NextResponse.json(data?.aiBrainProfile || emptyProfile);
    } else if (scope === 'org') {
      if (!orgId) {
        return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
      }
      const orgDoc = await db.doc(`organizations/${orgId}`).get();
      if (!orgDoc.exists) {
        return NextResponse.json(emptyProfile);
      }
      const data = orgDoc.data();
      return NextResponse.json(data?.orgBrainProfile || emptyProfile);
    }

    return NextResponse.json(emptyProfile);
  } catch (error) {
    console.error('[Brain Profile API GET]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { scope, orgId, answers, entityName } = body;

    console.log(`[Brain Profile API] POST scope=${scope} orgId=${orgId} uid=${auth.uid}`);

    if (scope !== 'personal' && scope !== 'org') {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }
    if (scope === 'org' && !orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
    }

    await initAdmin();
    const db = getAdminFirestore();

    const questions = scope === 'personal' ? PERSONAL_BRAIN_QUESTIONS : ORG_BRAIN_QUESTIONS;
    const compiledBriefing = compileBrainProfileToText(scope, questions, answers, entityName || (scope === 'personal' ? 'User' : 'Organization'));
    const completedCount = countAnswered(questions, answers);

    if (scope === 'personal') {
      await db.doc(`users/${auth.uid}`).set(
        {
          aiBrainProfile: {
            answers,
            completedCount,
            totalCount: questions.length,
            compiledBriefing,
            updatedAt: new Date().toISOString(),
          },
        },
        { merge: true }
      );
    } else if (scope === 'org') {
      // RBAC CHECK
      const memberDoc = await db.doc(`orgs/${orgId}/members/${auth.uid}`).get();
      const memberRole = memberDoc.exists ? memberDoc.data()?.role : 'user';
      
      const email = auth.email ? auth.email.toLowerCase() : '';
      const isAdmin = memberRole === 'admin' || memberRole === 'oracle' || ADMIN_EMAILS.includes(email);

      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden — admin access required to edit organization brain' }, { status: 403 });
      }

      await db.doc(`organizations/${orgId}`).set(
        {
          orgBrainProfile: {
            answers,
            completedCount,
            totalCount: questions.length,
            compiledBriefing,
            updatedAt: new Date().toISOString(),
            updatedBy: auth.uid,
            updatedByEmail: auth.email,
          },
          orgBrain: compiledBriefing,
        },
        { merge: true }
      );

      // Dual-write mirror to `orgs/{orgId}` — ensures search_org_brain can find
      // data regardless of which collection path is queried. Best-effort; failure
      // here is non-fatal since `organizations/{orgId}` is the primary source.
      try {
        await db.doc(`orgs/${orgId}`).set(
          {
            orgBrainProfile: {
              answers,
              completedCount,
              totalCount: questions.length,
              compiledBriefing,
              updatedAt: new Date().toISOString(),
              updatedBy: auth.uid,
              updatedByEmail: auth.email,
            },
            orgBrain: compiledBriefing,
          },
          { merge: true }
        );
      } catch (mirrorErr) {
        console.warn('[Brain Profile API] Mirror write to orgs/ failed (non-fatal):', mirrorErr);
      }
    }

    return NextResponse.json({ success: true, compiledBriefing, completedCount });
  } catch (error) {
    console.error('[Brain Profile API POST]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
