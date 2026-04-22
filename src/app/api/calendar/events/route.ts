import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(req: Request) {
  try {
    const { refreshToken, timeMin, timeMax } = await req.json();
    
    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token provided" }, { status: 401 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Default to the current month view spanning ~6 weeks if no dates provided
    const defaultMin = new Date();
    defaultMin.setDate(1);
    defaultMin.setHours(0,0,0,0);
    const defaultMax = new Date();
    defaultMax.setMonth(defaultMax.getMonth() + 2);
    defaultMax.setDate(0);
    
    // 1. Fetch all calendars the user has access to
    const calendarListRes = await calendar.calendarList.list();
    const calendars = calendarListRes.data.items || [];

    // 2. Fetch events concurrently from all calendars
    const fetchPromises = calendars.map(async (cal) => {
      try {
        const eventsRes = await calendar.events.list({
          calendarId: cal.id as string,
          timeMin: timeMin || defaultMin.toISOString(),
          timeMax: timeMax || defaultMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250 // per calendar
        });
        return eventsRes.data.items || [];
      } catch (err) {
        console.warn(`Could not fetch events for calendar ${cal.summary}:`, err);
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    const allEvents = results.flat();

    // Deduplicate just in case
    const uniqueEventsMap = new Map();
    allEvents.forEach((e: any) => {
      uniqueEventsMap.set(e.id, e);
    });

    const parsedEvents = Array.from(uniqueEventsMap.values()).map((e: any) => {
      // Apply color coding rules based on user request
      let eventColor = "bg-blue-500";
      const titleLower = (e.summary || "").toLowerCase();
      
      if (titleLower.includes("lucas - out of office")) {
        eventColor = "bg-green-600";
      } else if (titleLower.includes("sol meeting room")) {
         eventColor = "bg-purple-600";
      } else {
        // Hash the title to get a consistent unique color
        const colors = [
          "bg-blue-500", "bg-indigo-500", "bg-rose-500", "bg-orange-500", 
          "bg-cyan-600", "bg-teal-500", "bg-pink-500", "bg-amber-600", 
          "bg-fuchsia-600", "bg-sky-500", "bg-violet-500"
        ];
        let hash = 0;
        for (let i = 0; i < titleLower.length; i++) {
          hash = titleLower.charCodeAt(i) + ((hash << 5) - hash);
        }
        eventColor = colors[Math.abs(hash) % colors.length];
      }

      return {
        id: e.id,
        title: e.summary || "Untitled Event",
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        link: e.htmlLink || e.hangoutLink,
        description: e.description || "",
        location: e.location || "",
        color: eventColor,
        allDay: !(e.start && e.start.dateTime)
      };
    });

    // Sort globally by start time
    parsedEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return NextResponse.json({ status: "success", events: parsedEvents });

  } catch (error: any) {
    if (error.code === 403 || error.message?.includes('insufficient')) {
      return NextResponse.json({ error: "Calendar API requires re-authentication or is not enabled." }, { status: 403 });
    }
    console.error("Calendar fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
