import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { getInstagramConnection } from "@/firebase/firestore/instagram";

/**
 * POST /api/campaigning/instagram/media
 * Fetches published media from the connected Instagram Business account
 * using the stored access token via Meta Graph API.
 *
 * Body: { orgId: string, limit?: number }
 * Returns: { success: true, media: [...] } or { error: string }
 */
export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { orgId, limit = 16 } = await req.json();

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    // Retrieve the Instagram connection (tokens are auto-decrypted)
    const connection = await getInstagramConnection(orgId);
    if (!connection) {
      return NextResponse.json({ error: "Instagram not connected" }, { status: 404 });
    }

    const { instagramBusinessAccountId, facebookPageAccessToken } = connection;
    if (!instagramBusinessAccountId || !facebookPageAccessToken) {
      return NextResponse.json({ error: "Missing Instagram credentials" }, { status: 400 });
    }

    // Fetch published media from Meta Graph API
    const fields = "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp";
    const url = `https://graph.facebook.com/v20.0/${instagramBusinessAccountId}/media?fields=${fields}&limit=${limit}&access_token=${facebookPageAccessToken}`;

    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("[Instagram Media] Graph API error:", errData);
      return NextResponse.json(
        { error: errData?.error?.message || "Failed to fetch Instagram media" },
        { status: res.status }
      );
    }

    const data = await res.json();
    const media = (data.data || []).map((item: any) => ({
      id: item.id,
      mediaUrl: item.media_url || "",
      thumbnailUrl: item.thumbnail_url || "",
      mediaType: item.media_type || "IMAGE", // IMAGE, VIDEO, CAROUSEL_ALBUM
      caption: item.caption || "",
      permalink: item.permalink || "",
      timestamp: item.timestamp || "",
    }));

    return NextResponse.json({ success: true, media });
  } catch (error: any) {
    console.error("[Instagram Media] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
