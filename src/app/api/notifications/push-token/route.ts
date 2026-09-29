import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Register or update a device FCM push token for the authenticated user.
 */
export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { token, platform, userAgent } = body;

    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return NextResponse.json({ error: "Missing or invalid push token" }, { status: 400 });
    }

    initAdmin();
    const db = getFirestore();

    const tokenRef = db
      .collection("users")
      .doc(auth.uid)
      .collection("push_tokens")
      .doc(token.trim());

    await tokenRef.set(
      {
        token: token.trim(),
        platform: platform || "web",
        userAgent: userAgent || "",
        lastActiveAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Push Token API] Failed to register token:", error?.message || error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Revoke/delete a device FCM push token (e.g. on sign out or disable).
 */
export async function DELETE(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    initAdmin();
    const db = getFirestore();

    await db
      .collection("users")
      .doc(auth.uid)
      .collection("push_tokens")
      .doc(token.trim())
      .delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Push Token API] Failed to revoke token:", error?.message || error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
