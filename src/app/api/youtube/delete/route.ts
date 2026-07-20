import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { verifyRequest } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { youtubeId, type, refreshToken } = await req.json();

    if (!youtubeId || !type || !refreshToken) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const youtubeApi = google.youtube({ version: 'v3', auth: oauth2Client });

    if (type === 'video') {
      await youtubeApi.videos.delete({ id: youtubeId });
    } else if (type === 'playlist') {
      await youtubeApi.playlists.delete({ id: youtubeId });
    } else {
      return NextResponse.json({ error: "Invalid type. Must be 'video' or 'playlist'" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[YOUTUBE DELETE ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to delete from YouTube" }, { status: 500 });
  }
}
