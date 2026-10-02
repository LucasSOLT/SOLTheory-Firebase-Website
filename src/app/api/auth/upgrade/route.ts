// ============================================================================
// POST /api/auth/upgrade
//
// Authenticated endpoint for upgrading a demo user to an org member.
//
// When an existing demo user receives an invite link and clicks it,
// this route upgrades their existing account rather than requiring
// them to create a new one.
//
// Body: { inviteToken: string }
// Returns: { success, orgId, role, message }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin } from '@/firebase/admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createCrmContactForNewMember } from '@/lib/crm-auto-integration';

export async function POST(req: NextRequest) {
  try {
    // User must be logged in
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { inviteToken } = body;

    if (!inviteToken) {
      return NextResponse.json({ error: 'inviteToken is required.' }, { status: 400 });
    }

    await initAdmin();
    const db = getFirestore();

    // ── Validate invite token ──
    const inviteRef = db.collection('org_invites').doc(inviteToken);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      return NextResponse.json({ error: 'Invalid invite link.' }, { status: 404 });
    }

    const inviteData = inviteDoc.data()!;

    if (inviteData.used) {
      return NextResponse.json({ error: 'This invite link has already been used.' }, { status: 410 });
    }

    if (inviteData.expiresAt && inviteData.expiresAt.toDate() < new Date()) {
      return NextResponse.json({ error: 'This invite link has expired.' }, { status: 410 });
    }

    const orgId = inviteData.orgId;
    const role = inviteData.role || 'user';

    // ── Verify user is currently a demo user ──
    const userRef = db.collection('users').doc(auth.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
    }

    const userData = userDoc.data()!;

    if (userData.accountType !== 'demo') {
      return NextResponse.json(
        { error: 'This account is already linked to an organization.' },
        { status: 400 },
      );
    }

    // ── Upgrade in a batch (atomic) ──
    const batch = db.batch();

    // 1. Update user document
    batch.update(userRef, {
      accountType: 'org_member',
      organization: orgId,
      allowedOrgs: [orgId],
      orgRoles: { [orgId]: role },
      upgradedAt: FieldValue.serverTimestamp(),
      upgradedFrom: 'demo',
      inviteToken,
    });

    // 2. Create org membership document
    const memberRef = db.collection('orgs').doc(orgId).collection('members').doc(auth.uid);
    batch.set(memberRef, {
      uid: auth.uid,
      email: auth.email,
      displayName: userData.displayName || '',
      role,
      joinedAt: FieldValue.serverTimestamp(),
      promotedBy: inviteData.createdBy || 'invite',
      promotedAt: FieldValue.serverTimestamp(),
      upgradedFromDemo: true,
    });

    // 3. Consume the invite token
    batch.update(inviteRef, {
      used: true,
      usedBy: auth.uid,
      usedByEmail: auth.email,
      usedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // ── Audit log (best-effort) ──
    try {
      await db.collection('activity_log').add({
        type: 'demo_upgraded',
        userEmail: auth.email,
        userName: userData.displayName || auth.email,
        orgDomain: orgId,
        description: `${userData.displayName || auth.email} upgraded from demo to org_member for ${orgId} via invite link`,
        category: 'auth',
        timestamp: FieldValue.serverTimestamp(),
        metadata: {
          uid: auth.uid,
          orgId,
          role,
          previousAccountType: 'demo',
          inviteTokenPrefix: inviteToken.substring(0, 8) + '...',
        },
      });
    } catch { /* audit log is best-effort */ }

    // ── Auto-create CRM contact for the upgraded member (best-effort) ──
    try {
      await createCrmContactForNewMember({
        uid: auth.uid,
        firstName: userData.firstName || userData.displayName?.split(' ')[0] || '',
        lastName: userData.lastName || userData.displayName?.split(' ').slice(1).join(' ') || '',
        email: auth.email || userData.email || '',
        phone: userData.phoneNumber || userData.phone || '',
        jobTitle: userData.jobTitle || '',
        certifications: userData.certifications || [],
        orgId,
        registrationSource: 'demo_upgrade',
      });
    } catch { /* CRM integration is best-effort — never block upgrade */ }

    return NextResponse.json({
      success: true,
      orgId,
      role,
      message: `Account upgraded! You are now a member of ${orgId}. Please log out and log back in to see your new organization.`,
    });

  } catch (err: any) {
    console.error('[Upgrade] Error:', err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to upgrade account. Please try again.' },
      { status: 500 },
    );
  }
}
