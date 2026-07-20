/**
 * @file send-otp/route.ts
 * @description Generates a 6-digit OTP, stores it in Firestore, and emails it to the user.
 * Used for email-based 2FA setup and verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { initAdmin } from "@/firebase/admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  // Authenticate the request
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    await initAdmin();
    const db = getFirestore();
    const userRecord = await getAuth().getUser(auth.uid);
    const email = userRecord.email;

    if (!email) {
      return NextResponse.json({ error: "No email address found for this account." }, { status: 400 });
    }

    // Generate a 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store the hashed OTP in Firestore
    await db.collection("otp_tokens").doc(auth.uid).set({
      hashedOtp,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
    });

    // Send the OTP via SendGrid (or fall back to console for dev)
    const sendgridKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@soltheory.com";

    if (sendgridKey) {
      const sgMail = await import("@sendgrid/mail");
      sgMail.default.setApiKey(sendgridKey);

      await sgMail.default.send({
        to: email,
        from: { email: fromEmail, name: "SOL Theory Insight" },
        subject: "Your verification code — SOL Theory",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 12px 16px; border-radius: 12px; color: white; font-weight: 700; font-size: 18px; letter-spacing: 1px;">
                INSIGHT
              </div>
            </div>
            <h2 style="text-align: center; color: #1e293b; font-size: 22px; margin-bottom: 8px;">Verification Code</h2>
            <p style="text-align: center; color: #64748b; font-size: 14px; margin-bottom: 24px;">
              Enter this code to enable two-factor authentication on your account.
            </p>
            <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1e293b; font-family: 'SF Mono', 'Fira Code', monospace;">
                ${otp}
              </div>
              <div style="color: #94a3b8; font-size: 12px; margin-top: 8px;">
                This code expires in 5 minutes
              </div>
            </div>
            <p style="text-align: center; color: #94a3b8; font-size: 12px;">
              If you didn't request this code, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;" />
            <p style="text-align: center; color: #cbd5e1; font-size: 11px;">
              SOL Theory, Inc. &bull; Powered by Insight
            </p>
          </div>
        `,
      });
    } else {
      // Development fallback — log OTP to console
      console.log(`[2FA] OTP for ${email}: ${otp}`);
    }

    return NextResponse.json({ success: true, message: "OTP sent to your email address." });
  } catch (error: any) {
    console.error("[send-otp] Error:", error);
    return NextResponse.json({ error: "Failed to send OTP." }, { status: 500 });
  }
}
