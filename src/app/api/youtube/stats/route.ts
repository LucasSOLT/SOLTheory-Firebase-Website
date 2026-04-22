import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(req: Request) {
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return NextResponse.json({ 
        error: "No refresh token provided. Make sure you've connected your Google account in the dashboard." 
      }, { status: 400 });
    }

    // Set up OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const youtubeApi = google.youtube({ version: 'v3', auth: oauth2Client });
    
    // Fetch channel statistics
    const channelRes = await youtubeApi.channels.list({
      part: ['statistics', 'snippet', 'brandingSettings'],
      mine: true
    });

    const channelData = channelRes.data.items?.[0];

    if (!channelData || !channelData.statistics || !channelData.snippet) {
      return NextResponse.json({ error: "No channel data found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      stats: {
        viewCount: channelData.statistics.viewCount || "0",
        subscriberCount: channelData.statistics.subscriberCount || "0",
        videoCount: channelData.statistics.videoCount || "0"
      },
      branding: {
        title: channelData.snippet.title || "YouTube Channel",
        profileUrl: channelData.snippet.thumbnails?.high?.url || channelData.snippet.thumbnails?.default?.url || "",
        bannerUrl: channelData.brandingSettings?.image?.bannerExternalUrl || ""
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
