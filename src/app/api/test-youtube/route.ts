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

    // Check what scopes the token has
    let tokenInfo: any = {};
    try {
      const tokenRes = await oauth2Client.getAccessToken();
      const accessToken = tokenRes?.token;
      if (accessToken) {
        const infoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
        tokenInfo = await infoRes.json();
      }
    } catch (e: any) {
      tokenInfo = { error: e.message };
    }

    const scopes = tokenInfo.scope || "";
    const hasYouTubeScope = scopes.includes("youtube");

    // Try to access YouTube API
    const youtubeApi = google.youtube({ version: 'v3', auth: oauth2Client });
    
    let channelInfo: any = {};
    try {
      const channelRes = await youtubeApi.channels.list({
        part: ['snippet'],
        mine: true
      });
      channelInfo = {
        success: true,
        channelCount: channelRes.data.items?.length || 0,
        channelTitle: channelRes.data.items?.[0]?.snippet?.title || "N/A"
      };
    } catch (e: any) {
      channelInfo = { 
        success: false, 
        error: e.message,
        code: e.code
      };
    }

    return NextResponse.json({
      status: "YouTube API Test Results",
      scopes: scopes,
      hasYouTubeScope,
      channelInfo,
      fix: !hasYouTubeScope 
        ? "Your token does NOT have YouTube permissions. Go to your Dashboard Settings, click DISCONNECT on Google, then CONNECT again to re-grant permissions including YouTube."
        : channelInfo.success 
          ? "Everything looks good! YouTube API is accessible."
          : "YouTube scope present but API call failed. See channelInfo.error for details."
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
