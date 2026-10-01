// ============================================================================
// POST /api/auth/register
//
// Public endpoint for account creation. Handles two flows:
//   1. Invite-based registration: Creates account + assigns to org
//   2. Individual registration: Creates demo account (personal pseudo-org)
//
// Uses Firebase Admin SDK to create the Auth account server-side,
// then initializes the Firestore user document.
//
// Rate-limited to prevent abuse.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// In-memory rate limit: 10 registrations per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10;

export async function POST(req: NextRequest) {
  try {
    // ── Rate limiting ──
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (entry && entry.resetAt > now) {
      if (entry.count >= RATE_LIMIT_MAX) {
        return NextResponse.json(
          { error: 'Too many registration attempts. Please try again later.' },
          { status: 429 },
        );
      }
      entry.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    }
    // Cleanup stale entries periodically
    if (rateLimitMap.size > 1000) {
      for (const [key, val] of rateLimitMap) {
        if (val.resetAt < now) rateLimitMap.delete(key);
      }
    }

    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      jobTitle,
      certifications,
      inviteToken,
    } = body;

    // ── Validate required fields ──
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim() || !password || !jobTitle?.trim()) {
      return NextResponse.json(
        { error: 'All fields are required: firstName, lastName, email, phone, password, jobTitle.' },
        { status: 400 },
      );
    }

    if (!certifications || !Array.isArray(certifications) || certifications.length === 0) {
      return NextResponse.json(
        { error: 'At least one certification is required.' },
        { status: 400 },
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = phone.trim();
    const trimmedJobTitle = jobTitle.trim();
    const displayName = `${trimmedFirstName} ${trimmedLastName}`;

    // Password strength check
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 },
      );
    }

    await initAdmin();
    const adminAuth = getAuth();
    const db = getFirestore();

    // ── Check if email already exists ──
    try {
      await adminAuth.getUserByEmail(trimmedEmail);
      return NextResponse.json(
        { error: 'An account with this email already exists. Please log in instead.' },
        { status: 409 },
      );
    } catch (err: any) {
      // auth/user-not-found is expected — means email is available
      if (err.code !== 'auth/user-not-found') {
        throw err;
      }
    }

    // ── Resolve organization from invite token ──
    let orgId = 'personal';
    let accountType: 'demo' | 'org_member' = 'demo';
    let role = 'user';
    let inviteData: any = null;

    if (inviteToken) {
      // Validate invite token
      const inviteRef = db.collection('org_invites').doc(inviteToken);
      const inviteDoc = await inviteRef.get();

      if (!inviteDoc.exists) {
        return NextResponse.json(
          { error: 'Invalid invite link. Please request a new one from your admin.' },
          { status: 400 },
        );
      }

      inviteData = inviteDoc.data()!;

      if (inviteData.used) {
        return NextResponse.json(
          { error: 'This invite link has already been used. Please request a new one.' },
          { status: 400 },
        );
      }

      if (inviteData.expiresAt && inviteData.expiresAt.toDate() < new Date()) {
        return NextResponse.json(
          { error: 'This invite link has expired. Please request a new one from your admin.' },
          { status: 400 },
        );
      }

      orgId = inviteData.orgId;
      accountType = 'org_member';
      role = inviteData.role || 'user';
    }

    // ── Create Firebase Auth account ──
    const userRecord = await adminAuth.createUser({
      email: trimmedEmail,
      password,
      displayName,
      phoneNumber: trimmedPhone.startsWith('+') ? trimmedPhone : undefined,
    });

    const uid = userRecord.uid;

    // ── Create Firestore user document ──
    const userDoc: any = {
      id: uid,
      email: trimmedEmail,
      displayName,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      phoneNumber: trimmedPhone,
      jobTitle: trimmedJobTitle,
      certifications: certifications.map((c: string) => c.trim()).filter(Boolean),
      accountType,
      organization: orgId,
      allowedOrgs: [orgId],
      orgRoles: { [orgId]: accountType === 'demo' ? 'user' : role },
      accessLevel: accountType === 'demo' ? 'User-Level' : 'User-Level',
      createdAt: FieldValue.serverTimestamp(),
      lastLogin: FieldValue.serverTimestamp(),
      registrationSource: inviteToken ? 'invite' : 'self_signup',
    };

    if (inviteToken) {
      userDoc.inviteToken = inviteToken;
    }

    await db.collection('users').doc(uid).set(userDoc);

    // ── If org-based, create membership doc ──
    if (accountType === 'org_member' && orgId !== 'personal') {
      await db.collection('orgs').doc(orgId).collection('members').doc(uid).set({
        uid,
        email: trimmedEmail,
        displayName,
        role,
        joinedAt: FieldValue.serverTimestamp(),
        promotedBy: inviteData?.createdBy || 'invite',
        promotedAt: FieldValue.serverTimestamp(),
      });

      // Consume the invite token
      await db.collection('org_invites').doc(inviteToken).update({
        used: true,
        usedBy: uid,
        usedByEmail: trimmedEmail,
        usedAt: FieldValue.serverTimestamp(),
      });
    }

    // ── Audit log ──
    try {
      await db.collection('activity_log').add({
        type: 'user_registered',
        userEmail: trimmedEmail,
        userName: displayName,
        orgDomain: orgId,
        description: `${displayName} created a new ${accountType} account${inviteToken ? ` via invite link for ${orgId}` : ' (demo)'}`,
        category: 'auth',
        timestamp: FieldValue.serverTimestamp(),
        metadata: {
          uid,
          accountType,
          orgId,
          jobTitle: trimmedJobTitle,
          certifications: userDoc.certifications,
          registrationSource: userDoc.registrationSource,
        },
      });
    } catch { /* audit log is best-effort */ }

    return NextResponse.json({
      success: true,
      uid,
      email: trimmedEmail,
      accountType,
      orgId,
      message: accountType === 'demo'
        ? 'Demo account created successfully! You can now log in.'
        : `Account created and linked to ${orgId}. You can now log in.`,
    });

  } catch (err: any) {
    console.error('[Register] Error:', err.message, err.stack);

    // Handle specific Firebase errors
    if (err.code === 'auth/email-already-exists') {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please log in instead.' },
        { status: 409 },
      );
    }
    if (err.code === 'auth/invalid-email') {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 },
      );
    }
    if (err.code === 'auth/weak-password') {
      return NextResponse.json(
        { error: 'Password is too weak. Use at least 8 characters with a mix of letters and numbers.' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 },
    );
  }
}
