import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(req: Request) {
  try {
    const { youtubeId, type, title, description, tags, categoryId, refreshToken } = await req.json();

    if (!youtubeId || !type || !refreshToken || !title) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const youtubeApi = google.youtube({ version: 'v3', auth: oauth2Client });

    if (type === 'video') {
      await youtubeApi.videos.update({
        part: ['snippet'],
        requestBody: {
          id: youtubeId,
          snippet: {
            title: title,
            description: description || '',
            tags: tags || [],
            categoryId: categoryId || '27'
          }
        }
      });
    } else if (type === 'playlist') {
      await youtubeApi.playlists.update({
        part: ['snippet'],
        requestBody: {
          id: youtubeId,
          snippet: {
            title: title,
            description: description || '',
            tags: tags || []
          }
        }
      });
    } else {
      return NextResponse.json({ error: "Invalid type. Must be 'video' or 'playlist'" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[YOUTUBE UPDATE ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to update YouTube entity" }, { status: 500 });
  }
}
