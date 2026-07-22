/**
 * @file Per-User Admin Actions
 * Developer-only endpoint for freeze/unfreeze and delete operations.
 *
 * POST   — Freeze or unfreeze a user account
 * DELETE — Delete a user's Firestore document
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyDeveloper } from "@/lib/api-auth";
import { initAdmin } from "@/firebase/admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const auth = await verifyDeveloper(req);
  if (!auth.ok) return auth.response;

  const { uid } = await params;

  try {
    const body = await req.json();
    const { action, reason } = body;

    if (!["freeze", "unfreeze"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Use 'freeze' or 'unfreeze'." }, { status: 400 });
    }

    initAdmin();
    const db = getFirestore();
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (action === "freeze") {
      await userRef.update({
        frozenAt: FieldValue.serverTimestamp(),
        frozenBy: auth.uid,
        frozenReason: reason || "Frozen by developer",
      });
      return NextResponse.json({ success: true, action: "frozen" });
    } else {
      await userRef.update({
        frozenAt: FieldValue.delete(),
        frozenBy: FieldValue.delete(),
        frozenReason: FieldValue.delete(),
      });
      return NextResponse.json({ success: true, action: "unfrozen" });
    }
  } catch (err: any) {
    console.error("[Admin Users] POST error:", err.message);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const auth = await verifyDeveloper(req);
  if (!auth.ok) return auth.response;

  const { uid } = await params;

  try {
    initAdmin();
    const db = getFirestore();
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Safety: prevent deleting the developer's own account
    const userData = userDoc.data();
    if (userData?.email?.toLowerCase() === "lucas@soltheory.com") {
      return NextResponse.json({ error: "Cannot delete the developer account" }, { status: 403 });
    }

    await userRef.delete();
    return NextResponse.json({ success: true, action: "deleted" });
  } catch (err: any) {
    console.error("[Admin Users] DELETE error:", err.message);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
