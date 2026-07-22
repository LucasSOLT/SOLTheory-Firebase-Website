/**
 * @file End-User Management API
 * Developer-only endpoint for managing all platform users.
 *
 * GET  — List all users
 * PUT  — Update user (role, allowedOrgs, freeze/unfreeze)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyDeveloper } from "@/lib/api-auth";
import { initAdmin } from "@/firebase/admin";
import { getFirestore } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await verifyDeveloper(req);
  if (!auth.ok) return auth.response;

  try {
    initAdmin();
    const db = getFirestore();
    const snapshot = await db.collection("users").get();

    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        email: data.email || "",
        displayName: data.displayName || "",
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        organization: data.organization || "",
        allowedOrgs: data.allowedOrgs || [],
        orgRoles: data.orgRoles || {},
        role: data.role || "",
        accessLevel: data.accessLevel || "",
        frozenAt: data.frozenAt ? data.frozenAt.toDate?.()?.toISOString() || data.frozenAt : null,
        frozenBy: data.frozenBy || null,
        frozenReason: data.frozenReason || null,
        lastLogin: data.lastLogin ? data.lastLogin.toDate?.()?.toISOString() || data.lastLogin : null,
        createdAt: data.createdAt ? data.createdAt.toDate?.()?.toISOString() || data.createdAt : null,
      };
    });

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error("[Admin Users] GET error:", err.message);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await verifyDeveloper(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { uid, updates } = body;

    if (!uid || !updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Missing uid or updates" }, { status: 400 });
    }

    // Only allow specific fields to be updated
    const allowedFields = ["allowedOrgs", "orgRoles", "role", "accessLevel", "frozenAt", "frozenBy", "frozenReason"];
    const sanitized: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        sanitized[key] = updates[key];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    initAdmin();
    const db = getFirestore();
    await db.collection("users").doc(uid).update(sanitized);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Admin Users] PUT error:", err.message);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
