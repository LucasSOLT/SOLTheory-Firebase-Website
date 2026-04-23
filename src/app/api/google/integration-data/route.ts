import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(req: Request) {
  try {
    const { refreshToken, service } = await req.json();

    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    switch (service) {
      case "gmail": {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        const res = await gmail.users.messages.list({
          userId: "me",
          q: "is:unread",
          maxResults: 1, // we only need the count
        });
        return NextResponse.json({
          success: true,
          value: String(res.data.resultSizeEstimate || 0),
          label: "unread emails",
        });
      }

      case "gcal": {
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
        const res = await calendar.events.list({
          calendarId: "primary",
          timeMin: startOfDay,
          timeMax: endOfDay,
          singleEvents: true,
          orderBy: "startTime",
        });
        const events = res.data.items || [];
        return NextResponse.json({
          success: true,
          value: String(events.length),
          label: "events today",
        });
      }

      case "gmeet": {
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        const now = new Date();
        const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const res = await calendar.events.list({
          calendarId: "primary",
          timeMin: now.toISOString(),
          timeMax: endOfWeek.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
        });
        const events = (res.data.items || []).filter(
          (e) => e.conferenceData?.conferenceSolution?.name === "Google Meet" || e.hangoutLink
        );
        return NextResponse.json({
          success: true,
          value: String(events.length),
          label: "meetings this week",
        });
      }

      case "gdrive": {
        const drive = google.drive({ version: "v3", auth: oauth2Client });
        const res = await drive.files.list({
          pageSize: 1,
          q: "trashed = false",
          fields: "files(id)",
          includeItemsFromAllDrives: false,
        });
        // Get total via about
        const about = await drive.about.get({ fields: "storageQuota" });
        const usedBytes = parseInt(about.data.storageQuota?.usage || "0");
        const usedGB = (usedBytes / (1024 * 1024 * 1024)).toFixed(1);
        return NextResponse.json({
          success: true,
          value: `${usedGB} GB`,
          label: "storage used",
        });
      }

      case "youtube": {
        const yt = google.youtube({ version: "v3", auth: oauth2Client });
        const res = await yt.channels.list({ part: ["statistics"], mine: true });
        const stats = res.data.items?.[0]?.statistics;
        return NextResponse.json({
          success: true,
          value: parseInt(stats?.subscriberCount || "0").toLocaleString(),
          label: "subscribers",
        });
      }

      default:
        return NextResponse.json({ error: "Unknown service" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Google integration data error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
