import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { initAdmin } from "@/firebase/admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { google } from "googleapis";

interface CalendarEventConfig {
  type: 'orientation' | 'week1_review' | 'day30_review' | 'shadowing' | 'custom';
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendeeEmails?: string[];
  addGoogleMeet?: boolean;
}

export async function POST(req: NextRequest) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { orgId, instanceId, events: customEvents, startDate } = body;

    if (!orgId || !instanceId) {
      return NextResponse.json({ error: "Missing orgId or instanceId" }, { status: 400 });
    }

    initAdmin();
    const db = getFirestore();

    // 1. Fetch onboarding instance
    const instanceDoc = await db.collection("onboarding_instances").doc(instanceId).get();
    if (!instanceDoc.exists) {
      return NextResponse.json({ error: "Onboarding instance not found" }, { status: 404 });
    }
    const instance = instanceDoc.data()!;

    // 2. Fetch sender Google OAuth refresh token
    // First try the authenticated caller, then the initiator of the instance, then org owner
    let refreshToken: string | null = null;
    let senderEmail: string | null = null;

    const callerDoc = await db.collection("users").doc(auth.uid).get();
    if (callerDoc.exists) {
      const uData = callerDoc.data();
      refreshToken =
        uData?.gmailOAuth_jarvis?.refreshToken ||
        uData?.gmailOAuth_campaigning?.refreshToken ||
        uData?.gmailOAuth?.refreshToken ||
        uData?.gmailOAuth_morpheus?.refreshToken ||
        uData?.gmailOAuth_email?.refreshToken ||
        uData?.["gmailOAuth_inbound-email"]?.refreshToken ||
        null;
      senderEmail = uData?.email || null;
    }

    if (!refreshToken && instance.initiatedBy) {
      const initiatorDoc = await db.collection("users").doc(instance.initiatedBy).get();
      if (initiatorDoc.exists) {
        const iData = initiatorDoc.data();
        refreshToken =
          iData?.gmailOAuth_jarvis?.refreshToken ||
          iData?.gmailOAuth_campaigning?.refreshToken ||
          iData?.gmailOAuth?.refreshToken ||
          null;
        if (!senderEmail) senderEmail = iData?.email || null;
      }
    }

    if (!refreshToken) {
      return NextResponse.json(
        {
          error: "No Google account connected. Please connect Google in Settings or JARVIS to schedule Google Calendar meetings.",
          code: "GOOGLE_NOT_CONNECTED",
        },
        { status: 400 }
      );
    }

    // 3. Initialize Google Calendar Client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // 4. Determine events to create
    let eventsToSchedule: CalendarEventConfig[] = [];

    if (customEvents && Array.isArray(customEvents) && customEvents.length > 0) {
      eventsToSchedule = customEvents;
    } else {
      // Default: Create Day 1 Orientation, Week 1 Review, and 30-Day Milestone
      const baseDate = startDate
        ? new Date(startDate)
        : instance.startedAt?.toDate
        ? instance.startedAt.toDate()
        : new Date();

      // Day 1 Orientation: base date 9:00 AM - 10:30 AM
      const d1Start = new Date(baseDate);
      d1Start.setHours(9, 0, 0, 0);
      const d1End = new Date(baseDate);
      d1End.setHours(10, 30, 0, 0);

      // Week 1 Milestone: base date + 7 days, 10:00 AM - 10:45 AM
      const w1Start = new Date(baseDate.getTime() + 7 * 86_400_000);
      w1Start.setHours(10, 0, 0, 0);
      const w1End = new Date(baseDate.getTime() + 7 * 86_400_000);
      w1End.setHours(10, 45, 0, 0);

      // 30-Day Milestone: base date + 30 days, 2:00 PM - 3:00 PM
      const d30Start = new Date(baseDate.getTime() + 30 * 86_400_000);
      d30Start.setHours(14, 0, 0, 0);
      const d30End = new Date(baseDate.getTime() + 30 * 86_400_000);
      d30End.setHours(15, 0, 0, 0);

      const defaultAttendees = [
        instance.userEmail,
        instance.mentorEmail,
        auth.email || senderEmail,
      ].filter(Boolean) as string[];

      eventsToSchedule = [
        {
          type: 'orientation',
          title: `Day 1 Orientation: ${instance.userName} (${instance.roleName})`,
          description: `Welcome to the team! Orientation meeting for ${instance.userName}.\n\nAgenda:\n- Team introductions\n- Systems & tools overview\n- INSiGHT Onboarding Roadmap walkthrough\n- Q&A with mentor & manager`,
          startDateTime: d1Start.toISOString(),
          endDateTime: d1End.toISOString(),
          attendeeEmails: defaultAttendees,
          addGoogleMeet: true,
        },
        {
          type: 'week1_review',
          title: `Week 1 Milestone Review: ${instance.userName}`,
          description: `Week 1 Check-in with ${instance.userName}.\n\nAgenda:\n- Review Phase 1 completion\n- Address any roadblocks or questions\n- Set goals for Phase 2`,
          startDateTime: w1Start.toISOString(),
          endDateTime: w1End.toISOString(),
          attendeeEmails: defaultAttendees,
          addGoogleMeet: true,
        },
        {
          type: 'day30_review',
          title: `30-Day Milestone Check-in: ${instance.userName}`,
          description: `30-day onboarding review for ${instance.userName} (${instance.roleName}).\n\nAgenda:\n- Full onboarding roadmap completion review\n- Feedback from mentor and team\n- Next phase development plan`,
          startDateTime: d30Start.toISOString(),
          endDateTime: d30End.toISOString(),
          attendeeEmails: defaultAttendees,
          addGoogleMeet: true,
        },
      ];
    }

    // 5. Insert events concurrently
    const createdEvents = [];
    for (const ev of eventsToSchedule) {
      const attendees = (ev.attendeeEmails || [instance.userEmail])
        .filter(Boolean)
        .map(email => ({ email: email.trim() }));

      const requestBody: any = {
        summary: ev.title,
        description: ev.description,
        start: { dateTime: ev.startDateTime },
        end: { dateTime: ev.endDateTime },
        attendees,
      };

      if (ev.addGoogleMeet !== false) {
        requestBody.conferenceData = {
          createRequest: {
            requestId: `bobby_meet_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        };
      }

      const calRes = await calendar.events.insert({
        calendarId: "primary",
        conferenceDataVersion: 1,
        requestBody,
      });

      createdEvents.push({
        id: calRes.data.id,
        type: ev.type,
        title: ev.title,
        htmlLink: calRes.data.htmlLink,
        hangoutLink: calRes.data.hangoutLink || null,
        start: ev.startDateTime,
        end: ev.endDateTime,
        createdAt: new Date().toISOString(),
      });
    }

    // 6. Update instance with calendarEvents references
    await instanceDoc.ref.update({
      calendarEvents: FieldValue.arrayUnion(...createdEvents),
      hasCalendarScheduled: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully scheduled ${createdEvents.length} calendar events`,
      createdEvents,
    });
  } catch (err: any) {
    console.error("[Schedule Orientation Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to schedule calendar events" },
      { status: 500 }
    );
  }
}
