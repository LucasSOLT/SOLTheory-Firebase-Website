import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";

/**
 * GET /api/sms/env-check
 * Debug: check which Firebase admin env vars are available on production.
 */
export async function GET(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    hasFirebaseServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    hasGoogleAppCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    hasGoogleProjectId: !!process.env.GOOGLE_CLOUD_PROJECT || !!process.env.GCLOUD_PROJECT,
    hasFirebaseProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "unknown",
    nodeEnv: process.env.NODE_ENV,
    // List all env keys that contain "FIREBASE" or "GOOGLE" (values hidden for security)
    firebaseEnvKeys: Object.keys(process.env).filter(k => k.includes("FIREBASE") || k.includes("GOOGLE") || k.includes("GCLOUD")),
  });
}
