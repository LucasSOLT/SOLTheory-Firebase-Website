import { NextResponse } from "next/server";
import { google } from "googleapis";
import { verifyRequest } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { refreshToken, mimeTypePrefix, fetchAll } = await req.json();

    if (!refreshToken) {
      return NextResponse.json({ error: "Refresh token is required" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Use appProperties or properties. We will use standard 'properties' since it's easier to view if needed.
    // Query conditionally by mimeType if passed
    let q = "trashed = false";
    
    if (!fetchAll) {
      q += " and properties has { key='createdByAI' and value='true' }";
    }

    if (mimeTypePrefix) {
      q += ` and mimeType = '${mimeTypePrefix}'`;
    }

    const res = await drive.files.list({
      q: q,
      fields: "files(id, name, webViewLink, iconLink, thumbnailLink, createdTime, modifiedTime)",
      orderBy: "createdTime desc"
    });

    return NextResponse.json({ files: res.data.files || [] });
  } catch (error: any) {
    console.error("Drive Fetch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
