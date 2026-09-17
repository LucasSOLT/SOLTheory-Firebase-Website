/**
 * @file Organization Admin — User Management API
 * Accessible to org admins (not just developers). Lists and manages
 * users within a specific organization.
 *
 * GET  — List members of the org
 * PUT  — Update user role within the org
 * PATCH — Freeze/unfreeze a user
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/api-auth";
import { initAdmin } from "@/firebase/admin";
import { getFirestore } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.response;

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  try {
    initAdmin();
    const db = getFirestore();

    // Get org members from the org's members subcollection
    const membersSnap = await db.collection(`orgs/${orgId}/members`).get();
    const memberUids = membersSnap.docs.map(doc => doc.id);

    if (memberUids.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // Fetch user details for each member
    const users = await Promise.all(
      memberUids.map(async (uid) => {
        const memberData = membersSnap.docs.find(d => d.id === uid)?.data() || {};
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() || {} : {};

        return {
          uid,
          email: userData.email || memberData.email || "",
          displayName: userData.displayName || memberData.displayName || "",
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
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { uid, orgId, role } = body;

    if (!uid || !orgId || !role) {
      return NextResponse.json({ error: "Missing uid, orgId, or role" }, { status: 400 });
    }

    const validRoles = ["read-only", "user", "admin", "oracle"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    initAdmin();
    const db = getFirestore();

    // Update role in org members subcollection
    await db.collection(`orgs/${orgId}/members`).doc(uid).update({ role });

    // Also update orgRoles on the user document
    await db.collection("users").doc(uid).update({
      [`orgRoles.${orgId}`]: role,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Org Admin] PUT error:", err.message);
    return NextResponse.json({ error: "Failed to update user role" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { uid, action, reason } = body;

    if (!uid || !action) {
      return NextResponse.json({ error: "Missing uid or action" }, { status: 400 });
    }

    initAdmin();
    const db = getFirestore();
    const { FieldValue } = require("firebase-admin/firestore");

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
