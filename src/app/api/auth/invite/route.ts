// ============================================================================
// /api/auth/invite
//
// Admin-only endpoint for generating and managing single-use invite links.
//
// POST — Generate a new invite link (admin only)
// GET  — Validate an invite token (public, used by signup page)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin } from '@/firebase/admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

/**
 * POST /api/auth/invite
 * Generate a new single-use invite link.
 *
 * Body: { orgId: string, role?: string, email?: string, expiresInDays?: number }
 * Returns: { token, inviteUrl, expiresAt }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { orgId, role, email, expiresInDays } = body;

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    await initAdmin();
    const db = getFirestore();

    // Verify the requester is an admin of the org
    const memberDoc = await db.collection('orgs').doc(orgId).collection('members').doc(auth.uid).get();
    const memberRole = memberDoc.exists ? memberDoc.data()?.role : null;
    const isLucas = auth.email === 'lucas@soltheory.com';

    if (!isLucas && memberRole !== 'admin' && memberRole !== 'oracle') {
      return NextResponse.json(
        { error: 'Only admins can generate invite links.' },
        { status: 403 },
      );
    }

    // Generate a secure, unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Calculate expiration (default: 7 days)
    const days = expiresInDays || 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // Store the invite
    await db.collection('org_invites').doc(token).set({
      token,
      orgId,
      role: role || 'user',
      email: email?.toLowerCase() || null, // Optional pre-fill hint
      createdBy: auth.uid,
      createdByEmail: auth.email,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      used: false,
      usedBy: null,
      usedByEmail: null,
      usedAt: null,
    });

    // Build the invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.soltheory.com';
    const inviteUrl = `${baseUrl}/portal/signup?invite=${token}`;

    // Audit log
    try {
      await db.collection('activity_log').add({
        type: 'invite_created',
        userEmail: auth.email,
        userName: auth.email.split('@')[0],
        orgDomain: orgId,
        description: `${auth.email} generated an invite link for ${orgId}${email ? ` (pre-filled: ${email})` : ''}`,
        category: 'auth',
        timestamp: FieldValue.serverTimestamp(),
        metadata: { token: token.substring(0, 8) + '...', orgId, role: role || 'user', expiresAt: expiresAt.toISOString() },
      });
    } catch { /* best-effort */ }

    return NextResponse.json({
      success: true,
      token,
      inviteUrl,
      orgId,
      role: role || 'user',
      expiresAt: expiresAt.toISOString(),
      expiresInDays: days,
    });

  } catch (err: any) {
    console.error('[Invite POST] Error:', err.message);
    return NextResponse.json({ error: 'Failed to generate invite link.' }, { status: 500 });
  }
}

/**
 * GET /api/auth/invite?token=xxx
 * Public endpoint to validate an invite token.
 * Used by the signup page to show org info and pre-fill fields.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    await initAdmin();
    const db = getFirestore();

    const inviteRef = db.collection('org_invites').doc(token);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      return NextResponse.json({ valid: false, error: 'Invalid invite link.' }, { status: 404 });
    }

    const data = inviteDoc.data()!;

    if (data.used) {
      return NextResponse.json({ valid: false, error: 'This invite link has already been used.' }, { status: 410 });
    }

    if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
      return NextResponse.json({ valid: false, error: 'This invite link has expired.' }, { status: 410 });
    }

    // Return safe, public-facing invite info (no secrets)
    return NextResponse.json({
      valid: true,
      orgId: data.orgId,
      role: data.role || 'user',
      email: data.email || null, // Pre-fill hint
      expiresAt: data.expiresAt?.toDate?.()?.toISOString() || null,
    });

  } catch (err: any) {
    console.error('[Invite GET] Error:', err.message);
    return NextResponse.json({ error: 'Failed to validate invite.' }, { status: 500 });
  }
}
