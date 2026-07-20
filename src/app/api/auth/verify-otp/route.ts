/**
 * @file verify-otp/route.ts
 * @description Verifies a user-submitted OTP against the stored hash in Firestore.
 * If valid, marks 2FA as enabled on the user's /users/{uid} document.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { initAdmin } from "@/firebase/admin";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  // Authenticate the request
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { otp } = await req.json();

    if (!otp || typeof otp !== "string" || otp.length !== 6) {
      return NextResponse.json({ error: "Invalid OTP format. Must be 6 digits." }, { status: 400 });
    }

    await initAdmin();
    const db = getFirestore();
    const otpRef = db.collection("otp_tokens").doc(auth.uid);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return NextResponse.json({ error: "No OTP found. Please request a new code." }, { status: 400 });
    }

    const data = otpDoc.data()!;

    // Check expiration
    if (Date.now() > data.expiresAt) {
      await otpRef.delete();
      return NextResponse.json({ error: "OTP expired. Please request a new code." }, { status: 400 });
    }

    // Check max attempts (5)
    if (data.attempts >= 5) {
      await otpRef.delete();
      return NextResponse.json({ error: "Too many attempts. Please request a new code." }, { status: 429 });
    }

    // Verify the OTP
    const hashedInput = crypto.createHash("sha256").update(otp).digest("hex");
    if (hashedInput !== data.hashedOtp) {
      // Increment attempts
      await otpRef.update({ attempts: data.attempts + 1 });
      return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 });
    }

    // OTP verified! Enable 2FA on the user document
    await db.collection("users").doc(auth.uid).set(
      {
        twoFactorEnabled: true,
        twoFactorEnabledAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Clean up the OTP token
    await otpRef.delete();

    // Log the activity
    try {
      await db.collection("activity_log").add({
        type: "settings_changed",
        userEmail: auth.uid,
        userName: auth.uid,
        description: "Two-factor authentication enabled",
        category: "security",
        timestamp: new Date(),
      });
    } catch (logErr) {
      console.error("[verify-otp] Activity log error:", logErr);
    }

    return NextResponse.json({ success: true, message: "Two-factor authentication enabled successfully." });
  } catch (error: any) {
    console.error("[verify-otp] Error:", error);
    return NextResponse.json({ error: "Failed to verify OTP." }, { status: 500 });
  }
}
