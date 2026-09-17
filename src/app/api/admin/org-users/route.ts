/**
 * @file Organization Admin — User Management API
 * Accessible to organization admins (both global admins and org-specific admins).
 * Lists and manages users within a specific organization.
 *
 * GET   — List members of the org
 * PUT   — Update user role within the org
 * PATCH — Freeze/unfreeze a user
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { isGlobalAdmin, isOracle } from "@/lib/org-config";
import { initAdmin } from "@/firebase/admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/**
 * Verify that the user is an admin for the requested organization.
 * Allows platform Oracles, global admins, or users with the 'admin'/'oracle' role in the org.
 */
async function verifyOrgAdminAccess(req: NextRequest, orgId: string) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth;

  // Platform Oracles & global admins have universal admin access
  if (isOracle(auth.email) || isGlobalAdmin(auth.email)) {
    return { ok: true as const, uid: auth.uid, email: auth.email };
  }

  // Check Firestore member role within this specific organization
  try {
    initAdmin();
    const db = getFirestore();
    const memberDoc = await db.doc(`orgs/${orgId}/members/${auth.uid}`).get();
    const role = memberDoc.exists ? memberDoc.data()?.role : null;

    if (role === "admin" || role === "oracle") {
      return { ok: true as const, uid: auth.uid, email: auth.email };
    }
  } catch (err: any) {
    console.error("[Org Admin Auth] Error verifying org role:", err);
  }

  return {
    ok: false as const,
    response: NextResponse.json(
      { error: "Forbidden — organization admin access required" },
      { status: 403 }
    ),
  };
}

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  const auth = await verifyOrgAdminAccess(req, orgId);
  if (!auth.ok) return auth.response;

  try {
    initAdmin();
    const db = getFirestore();

    // 1. Get member docs from orgs/{orgId}/members
    const membersSnap = await db.collection(`orgs/${orgId}/members`).get();
    const memberMap = new Map<string, any>();
    membersSnap.docs.forEach((doc) => {
      memberMap.set(doc.id, doc.data());
    });

    // 2. Also check global users collection for users whose allowedOrgs contains this orgId
    try {
      const allowedUsersSnap = await db
        .collection("users")
        .where("allowedOrgs", "array-contains", orgId)
        .get();

      allowedUsersSnap.docs.forEach((doc) => {
        if (!memberMap.has(doc.id)) {
          memberMap.set(doc.id, { role: "user" });
        }
      });
    } catch {
      // If array index is not yet built, proceed with members subcollection
    }

    const memberUids = Array.from(memberMap.keys());
    if (memberUids.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // 3. Fetch full profile details for each member
    const users = await Promise.all(
      memberUids.map(async (uid) => {
        const memberData = memberMap.get(uid) || {};
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() || {} : {};

        return {
          uid,
          email: userData.email || memberData.email || "",
          displayName: userData.displayName || memberData.displayName || "",
          firstName: userData.firstName || "",
          lastName: userData.lastName || "",
          role: memberData.role || userData.orgRoles?.[orgId] || "user",
          frozenAt: userData.frozenAt ? userData.frozenAt.toDate?.()?.toISOString() || userData.frozenAt : null,
          frozenReason: userData.frozenReason || null,
          lastLogin: userData.lastLogin ? userData.lastLogin.toDate?.()?.toISOString() || userData.lastLogin : null,
          createdAt: userData.createdAt ? userData.createdAt.toDate?.()?.toISOString() || userData.createdAt : null,
          photoURL: userData.photoURL || "",
        };
      })
    );

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error("[Org Admin] GET error:", err.message);
    return NextResponse.json({ error: "Failed to fetch org members" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, orgId, role } = body;

    if (!uid || !orgId || !role) {
      return NextResponse.json({ error: "Missing uid, orgId, or role" }, { status: 400 });
    }

    const auth = await verifyOrgAdminAccess(req, orgId);
    if (!auth.ok) return auth.response;

    const validRoles = ["read-only", "user", "admin", "oracle"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    initAdmin();
    const db = getFirestore();

    // Use set with merge so it works even if member doc was not yet created
    await db.collection(`orgs/${orgId}/members`).doc(uid).set(
      {
        role,
        promotedBy: auth.uid,
        promotedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Also update orgRoles map on the user doc if it exists
    const userDocRef = db.collection("users").doc(uid);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      await userDocRef.update({
        [`orgRoles.${orgId}`]: role,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Org Admin] PUT error:", err.message);
    return NextResponse.json({ error: "Failed to update user role" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, orgId, action, reason } = body;

    if (!uid || !action || !orgId) {
      return NextResponse.json({ error: "Missing uid, orgId, or action" }, { status: 400 });
    }

    const auth = await verifyOrgAdminAccess(req, orgId);
    if (!auth.ok) return auth.response;

    initAdmin();
    const db = getFirestore();

    if (action === "freeze") {
      await db.collection("users").doc(uid).update({
        frozenAt: FieldValue.serverTimestamp(),
        frozenBy: auth.uid,
        frozenReason: reason || "Frozen by org admin",
      });
    } else if (action === "unfreeze") {
      await db.collection("users").doc(uid).update({
        frozenAt: FieldValue.delete(),
        frozenBy: FieldValue.delete(),
        frozenReason: FieldValue.delete(),
      });
    } else {
      return NextResponse.json({ error: "Invalid action. Use 'freeze' or 'unfreeze'" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Org Admin] PATCH error:", err.message);
    return NextResponse.json({ error: "Failed to update user status" }, { status: 500 });
  }
}
