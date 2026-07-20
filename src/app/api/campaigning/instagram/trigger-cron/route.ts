import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { timingSafeEqual } from "crypto";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * POST /api/campaigning/instagram/trigger-cron
 * 
 * Server-side proxy for triggering the Instagram cron job.
 * Verifies the caller is authenticated, then internally calls
 * the cron endpoint with the server-only CRON_SECRET.
 * 
 * This prevents the cron secret from ever being exposed to the client.
 */
export async function POST(req: Request) {
  // Verify the caller is an authenticated user
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 500 }
    );
  }

  try {
    // Build the absolute URL for the cron endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cronUrl = `${baseUrl}/api/campaigning/instagram/cron`;

    const cronResponse = await fetch(cronUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
      },
    });

    const data = await cronResponse.json().catch(() => ({}));

    return NextResponse.json(
      { success: cronResponse.ok, status: cronResponse.status, data },
      { status: cronResponse.status }
    );
  } catch (err: any) {
    console.error("[Trigger Cron] Error:", err.message);
    return NextResponse.json(
      { error: "Failed to trigger cron job" },
      { status: 500 }
    );
  }
}
