import { NextResponse } from "next/server";
import { google } from "googleapis";
import { initAdmin, getFirestore } from "@/firebase/admin";

export async function POST(req: Request) {
  try {
    const { uid, timeMin, timeMax } = await req.json();
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    initAdmin();
    const db = getFirestore();
    const docSnap = await db.collection("users").doc(uid).get();
    
    if (!docSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const docData = docSnap.data();
    let rToken = docData?.gmailOAuth_morpheus?.refreshToken
      || docData?.gmailOAuth_email?.refreshToken
      || docData?.["gmailOAuth_inbound-email"]?.refreshToken
      || docData?.gmailOAuth?.refreshToken;

    if (!rToken) {
      return NextResponse.json({ error: "No Google OAuth token found" }, { status: 401 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: rToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Default to the current month view spanning ~6 weeks if no dates provided
    const defaultMin = new Date();
    defaultMin.setDate(1);
    defaultMin.setHours(0,0,0,0);
    const defaultMax = new Date();
    defaultMax.setMonth(defaultMax.getMonth() + 2);
    defaultMax.setDate(0);
    
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || defaultMin.toISOString(),
      timeMax: timeMax || defaultMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250 // reasonable cap for frontend month view
    });

    const parsedEvents = (res.data.items || []).map((e: any) => ({
      id: e.id,
      title: e.summary,
      start: e.start.dateTime || e.start.date,
      end: e.end.dateTime || e.end.date,
      link: e.htmlLink,
      color: "bg-blue-500", // Default color for UI mock mapping
      allDay: !e.start.dateTime
    }));

    return NextResponse.json({ status: "success", events: parsedEvents });

  } catch (error: any) {
    if (error.code === 403 || error.message?.includes('insufficient')) {
      return NextResponse.json({ error: "Calendar API requires re-authentication or is not enabled." }, { status: 403 });
    }
    console.error("Calendar fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
