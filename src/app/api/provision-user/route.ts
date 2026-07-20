import { NextResponse } from "next/server";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { getAuth } from "firebase-admin/auth";
import { verifyAdmin } from "@/lib/api-auth";

/**
 * POST /api/provision-user
 * 
 * Provisions external (e.g. Gmail) users by:
 * 1. Looking up their UID from Firebase Auth by email
 * 2. Creating/updating their Firestore user doc with org mapping and access level
 * 
 * Body: { email: string, organization: string, accessLevel: string, displayName?: string }
 */
export async function POST(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const { email, organization, accessLevel, displayName } = await req.json();

    if (!email || !organization || !accessLevel) {
      return NextResponse.json(
        { error: "Missing required fields: email, organization, accessLevel" },
        { status: 400 }
      );
    }

    initAdmin();
    const adminAuth = getAuth();
    const adminDb = getFirestore();

    // Look up the user by email in Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch (err: any) {
      return NextResponse.json(
        { error: `User not found in Firebase Auth: ${email}` },
        { status: 404 }
      );
    }

    const uid = userRecord.uid;

    // Create or update the Firestore user document
    await adminDb.collection("users").doc(uid).set({
      email: email.toLowerCase(),
      organization,
      accessLevel,
      displayName: displayName || userRecord.displayName || "",
      firstName: displayName?.split(" ")[0] || userRecord.displayName?.split(" ")[0] || "",
      lastName: displayName?.split(" ").slice(1).join(" ") || userRecord.displayName?.split(" ").slice(1).join(" ") || "",
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      uid,
      email,
      organization,
      accessLevel,
    });
  } catch (err: any) {
    console.error("Error provisioning user:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
