// ============================================================================
// GET /api/onboarding/vault/list
//
// Fetches compliance vault documents for an organization using Admin Firestore.
// Ensures 100% reliable retrieval regardless of client security rules.
//
// Query parameters:
//   orgId: string  — Organization ID
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';

export async function GET(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
    }

    await initAdmin();
    const db = getAdminFirestore();

    const snapshot = await db
      .collection('orgs')
      .doc(orgId)
      .collection('compliance_documents')
      .get();

    const documents = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ status: 'ok', documents });
  } catch (err: any) {
    console.error('[Compliance Vault List API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch compliance documents', details: err.message },
      { status: 500 },
    );
  }
}
