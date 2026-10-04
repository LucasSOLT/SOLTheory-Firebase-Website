// ============================================================================
// /api/onboarding/saved-signature — Signature Suite, Phase A
//
//   GET     → { signature: { imageData, method, updatedAt } | null }
//   PUT     json { imageData, method } → save/replace the caller's signature
//   DELETE  → remove the caller's saved signature
//
// Stored at users/{uid}/private/signature via the Admin SDK only. No Firestore
// rule matches that path, so clients can never read or write it directly (the
// users/{uid} doc itself is list-readable, so the image must NOT live there).
// A user can only ever touch their own signature — the uid comes from the
// verified ID token, never from the request.
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin, getFirestore as getAdminFirestore } from '@/firebase/admin';
import { isValidSignaturePng, type SignatureMethod } from '@/lib/signature-image';

export const runtime = 'nodejs';

const METHODS: SignatureMethod[] = ['draw', 'type', 'upload'];
const docPath = (uid: string) => `users/${uid}/private/signature`;

function fail(err: any, where: string) {
  console.error(`[SavedSignature:${where}]`, err?.message, err?.stack);
  return NextResponse.json({ error: 'Saved signature request failed' }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;
    initAdmin();
    const snap = await getAdminFirestore().doc(docPath(auth.uid)).get();
    const d = snap.data();
    if (!snap.exists || !d || !isValidSignaturePng(d.imageData)) {
      return NextResponse.json({ signature: null });
    }
    return NextResponse.json({
      signature: { imageData: d.imageData, method: d.method || 'draw', updatedAt: d.updatedAt || null },
    });
  } catch (err) {
    return fail(err, 'GET');
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;
    const body = await req.json().catch(() => ({}));
    const imageData = body?.imageData;
    const method: SignatureMethod = METHODS.includes(body?.method) ? body.method : 'draw';
    if (!isValidSignaturePng(imageData)) {
      return NextResponse.json({ error: 'Signature must be a PNG image under 370 KB.' }, { status: 400 });
    }
    initAdmin();
    const updatedAt = new Date().toISOString();
    await getAdminFirestore().doc(docPath(auth.uid)).set({ imageData, method, updatedAt, email: auth.email || '' });
    return NextResponse.json({ signature: { imageData, method, updatedAt } });
  } catch (err) {
    return fail(err, 'PUT');
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;
    initAdmin();
    await getAdminFirestore().doc(docPath(auth.uid)).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, 'DELETE');
  }
}
