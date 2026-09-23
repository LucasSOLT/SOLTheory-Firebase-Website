import { NextResponse } from "next/server";
import { verifyRole, verifyOracle } from "@/lib/api-auth";
import { initAdmin } from "@/firebase/admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { isOracle, getAllOrgIds, getOrgLabel, getOrgByEmailDomain, ORG_REGISTRY } from "@/lib/org-config";

/**
 * POST /api/org/members
 * 
 * 1. Action "cleanup-duplicates" (Oracle only):
 *    Scans all organizations, ensures lucas@soltheory.com is ONLY in soltheory,
 *    and removes any user from secondary orgs so each account is in at most ONE org.
 * 
 * 2. Default: Assign a user to an organization with single-org enforcement.
 *    Rejects if user is already a member of another organization.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, orgId, targetUid, email, displayName, role } = body;

    // ── 1. Action: Cleanup Duplicates Across All Orgs (Oracle only) ──
    if (action === "cleanup-duplicates") {
      const oracleAuth = await verifyOracle(req);
      if (!oracleAuth.ok) return oracleAuth.response;

      await initAdmin();
      const db = getFirestore();
      const allOrgIds = getAllOrgIds();
      const cleanupReport: { removed: { email: string; orgId: string; reason: string }[]; retained: { email: string; orgId: string }[] } = {
        removed: [],
        retained: [],
      };

      for (const currentOrg of allOrgIds) {
        const snap = await db.collection(`orgs/${currentOrg}/members`).get();
        for (const memberDoc of snap.docs) {
          const mData = memberDoc.data();
          const mUid = memberDoc.id;
          const mEmail = (mData.email || "").toLowerCase().trim();

          // Rule A: lucas@soltheory.com belongs ONLY to soltheory
          if (mEmail === "lucas@soltheory.com") {
            if (currentOrg !== "soltheory") {
              await memberDoc.ref.delete();
              cleanupReport.removed.push({ email: mEmail, orgId: currentOrg, reason: "Oracle account belongs exclusively to soltheory" });
            } else {
              cleanupReport.retained.push({ email: mEmail, orgId: currentOrg });
            }
            continue;
          }

          // Rule B: Domain-based primary org
          const domainOrg = getOrgByEmailDomain(mEmail);
          if (domainOrg) {
            if (domainOrg.id !== currentOrg) {
              await memberDoc.ref.delete();
              cleanupReport.removed.push({ email: mEmail, orgId: currentOrg, reason: `Email domain belongs to ${domainOrg.id}, not ${currentOrg}` });
            } else {
              cleanupReport.retained.push({ email: mEmail, orgId: currentOrg });
              // Ensure /users/{uid} is in sync
              try {
                await db.doc(`users/${mUid}`).set({
                  organization: domainOrg.id,
                  allowedOrgs: [domainOrg.id],
                }, { merge: true });
              } catch {}
            }
            continue;
          }

          // Rule C: External/Gmail users — check /users/{uid}.organization
          const userDoc = await db.doc(`users/${mUid}`).get();
          const uData = userDoc.data();
          const assignedOrg = uData?.organization;

          if (assignedOrg && assignedOrg !== currentOrg) {
            await memberDoc.ref.delete();
            cleanupReport.removed.push({ email: mEmail, orgId: currentOrg, reason: `User assigned to ${assignedOrg}, not ${currentOrg}` });
          } else {
            cleanupReport.retained.push({ email: mEmail, orgId: currentOrg });
            if (!assignedOrg) {
              try {
                await db.doc(`users/${mUid}`).set({
                  organization: currentOrg,
                  allowedOrgs: [currentOrg],
                }, { merge: true });
              } catch {}
            }
          }
        }
      }

      console.log("[API/org/members] Duplicate cleanup complete:", cleanupReport);
      return NextResponse.json({ success: true, report: cleanupReport });
    }

    // ── 2. Standard Assign User to Org with Single-Org Enforcement ──
    if (!orgId || !targetUid || !role) {
      return NextResponse.json({ error: "Missing required fields: orgId, targetUid, role" }, { status: 400 });
    }

    const auth = await verifyRole(req, orgId, 'admin');

    await initAdmin();
    const db = getFirestore();
    const allOrgIds = getAllOrgIds();

    // ── SINGLE-ORGANIZATION ENFORCEMENT ──
    // Lucas is Oracle and belongs ONLY to soltheory
    const targetEmail = (email || "").toLowerCase().trim();
    if (targetEmail === "lucas@soltheory.com" && orgId !== "soltheory") {
      return NextResponse.json(
        { error: "The Oracle account (lucas@soltheory.com) belongs exclusively to SOL Theory and cannot be assigned as a member of other organizations." },
        { status: 400 }
      );
    }

    // Check user document in /users/{targetUid}
    const userDocRef = db.doc(`users/${targetUid}`);
    const userSnap = await userDocRef.get();
    const userData = userSnap.data();

    if (userData?.organization && userData.organization !== orgId) {
      const existingOrgName = getOrgLabel(userData.organization);
      return NextResponse.json(
        { error: `Cannot assign: this account is already registered with ${existingOrgName} (${userData.organization}). Accounts can only belong to ONE organization at a time.` },
        { status: 400 }
      );
    }

    // Check across all orgs: user cannot already exist in another org's members collection
    for (const otherOrgId of allOrgIds) {
      if (otherOrgId === orgId) continue;
      const otherDoc = await db.doc(`orgs/${otherOrgId}/members/${targetUid}`).get();
      if (otherDoc.exists) {
        const otherOrgName = getOrgLabel(otherOrgId);
        return NextResponse.json(
          { error: `Cannot assign: this user is already an active member of ${otherOrgName} (${otherOrgId}). Please remove them from ${otherOrgName} first.` },
          { status: 400 }
        );
      }
    }

    // Assign to orgs/{orgId}/members/{targetUid}
    const targetDisplayName = displayName || userData?.displayName || userData?.name || "";
    const memberDocRef = db.doc(`orgs/${orgId}/members/${targetUid}`);
    await memberDocRef.set({
      uid: targetUid,
      email: targetEmail || userData?.email || "",
      displayName: targetDisplayName,
      role,
      joinedAt: new Date().toISOString(),
      promotedBy: auth.uid,
      promotedAt: new Date().toISOString(),
    });

    // Lock user document to this single organization
    if (userSnap.exists) {
      await userDocRef.set({
        organization: orgId,
        allowedOrgs: [orgId],
        orgRoles: { [orgId]: role },
      }, { merge: true });
    }

    return NextResponse.json({ success: true, orgId, uid: targetUid, role });
  } catch (err: any) {
    if (err.message?.includes('Insufficient permissions') || err.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[API/org/members] POST error:", err);
    return NextResponse.json({ error: err.message || "Failed to assign member" }, { status: 500 });
  }
}

/**
 * DELETE /api/org/members
 * 
 * Removes a member from an organization.
 * Admins can remove members below admin.
 * Oracle can remove anyone from any organization.
 * Oracle from non-soltheory orgs can always be removed (cleans up accidental memberships).
 */
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { orgId, targetUid } = body;
    
    if (!orgId || !targetUid) {
      return NextResponse.json({ error: "orgId and targetUid are required" }, { status: 400 });
    }

    // Verify requesting user is admin or oracle
    const auth = await verifyRole(req, orgId, 'admin');

    await initAdmin();
    const db = getFirestore();
    const targetDoc = await db.doc(`orgs/${orgId}/members/${targetUid}`).get();

    if (!targetDoc.exists) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const targetData = targetDoc.data();
    const targetRole = targetData?.role;
    const targetEmail = (targetData?.email || "").toLowerCase().trim();

    // Prevent removing Oracle from SOL Theory (their home org)
    if (orgId === 'soltheory' && (isOracle(targetEmail) || targetRole === 'oracle')) {
      return NextResponse.json({ error: "Cannot remove the Oracle account from SOL Theory" }, { status: 403 });
    }

    // Prevent non-Oracle users from removing themselves from an org
    if (auth.uid === targetUid && !isOracle(auth.email)) {
      return NextResponse.json({ error: "Cannot remove yourself from the organization" }, { status: 400 });
    }

    // Non-Oracle admins cannot remove other admins or oracles
    if (!isOracle(auth.email)) {
      if (targetRole === 'admin' || targetRole === 'oracle' || isOracle(targetEmail)) {
        return NextResponse.json({ error: "Insufficient permissions to remove an admin" }, { status: 403 });
      }
    }

    await db.doc(`orgs/${orgId}/members/${targetUid}`).delete();

    // If user's /users/{targetUid}.organization was set to this org, clear it so they are unassigned
    try {
      const userDocRef = db.doc(`users/${targetUid}`);
      const userSnap = await userDocRef.get();
      if (userSnap.exists) {
        const uData = userSnap.data();
        if (uData?.organization === orgId) {
          await userDocRef.update({
            organization: FieldValue.delete(),
            allowedOrgs: FieldValue.delete(),
            [`orgRoles.${orgId}`]: FieldValue.delete(),
          });
        }
      }
    } catch (uErr) {
      console.warn("[API/org/members] Failed to clear user doc organization:", uErr);
    }

    return NextResponse.json({ success: true, removedUid: targetUid, orgId });
  } catch (err: any) {
    if (err.message.includes('Insufficient permissions') || err.message.includes('Unauthorized')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[API/org/members] DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
