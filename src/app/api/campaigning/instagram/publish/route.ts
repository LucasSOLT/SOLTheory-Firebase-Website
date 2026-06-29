import { NextResponse } from "next/server";
import { initAdmin } from "@/firebase/admin";
import {
  getScheduledPost,
  getInstagramConnection,
  updateScheduledPostStatus,
} from "@/firebase/firestore/instagram";

// Vercel serverless: allow up to 5 minutes for container polling
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// Meta Graph API
// ---------------------------------------------------------------------------

const GRAPH_API_VERSION = "v20.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/** Maximum time (ms) to wait for a container to finish processing. */
const MAX_POLL_DURATION_MS = 5 * 60 * 1000; // 5 minutes
/** Interval (ms) between status polls. */
const POLL_INTERVAL_MS = 5_000; // 5 seconds

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublishRequest {
  postId: string;
}

interface MetaMediaResponse {
  id: string;
}

interface ContainerStatusResponse {
  id: string;
  status_code: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
  status?: string;
}

interface MetaPublishResponse {
  id: string;
}

interface MetaErrorResponse {
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect whether a media URL points to a video by file extension.
 * Firebase Storage download URLs often include the original filename in the
 * `token` path, so we check common video extensions.
 */
function isVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(mp4|mov|avi|wmv|flv|mkv|webm|m4v)$/i.test(pathname);
  } catch {
    return false;
  }
}

/**
 * POST to the Meta Graph API and return the parsed JSON.
 * Throws with a descriptive message on failure.
 */
async function metaPost<T>(
  url: string,
  params: Record<string, string>
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });

  const data = (await res.json()) as T & MetaErrorResponse;

  if (!res.ok || data.error) {
    const msg = data.error?.message || `Meta API error (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

/**
 * GET from the Meta Graph API and return the parsed JSON.
 */
async function metaGet<T>(
  url: string,
  params: Record<string, string>
): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${url}?${qs}`);

  const data = (await res.json()) as T & MetaErrorResponse;

  if (!res.ok || data.error) {
    const msg = data.error?.message || `Meta API error (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

/**
 * Poll the container status until FINISHED, ERROR, or timeout.
 * Returns the final status_code.
 */
async function pollContainerStatus(
  containerId: string,
  accessToken: string
): Promise<"FINISHED" | "ERROR"> {
  const deadline = Date.now() + MAX_POLL_DURATION_MS;

  while (Date.now() < deadline) {
    const status = await metaGet<ContainerStatusResponse>(
      `${GRAPH_BASE}/${containerId}`,
      { fields: "status_code", access_token: accessToken }
    );

    if (status.status_code === "FINISHED") return "FINISHED";
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      return "ERROR";
    }

    // IN_PROGRESS — wait and retry
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Timed out
  throw new Error(
    `Container ${containerId} did not finish processing within ${MAX_POLL_DURATION_MS / 1000}s.`
  );
}

// ---------------------------------------------------------------------------
// Single Image / Video Container
// ---------------------------------------------------------------------------

async function createSingleContainer(
  igAccountId: string,
  mediaUrl: string,
  caption: string,
  accessToken: string
): Promise<string> {
  const isVideo = isVideoUrl(mediaUrl);

  const params: Record<string, string> = {
    caption,
    access_token: accessToken,
  };

  if (isVideo) {
    params.media_type = "VIDEO";
    params.video_url = mediaUrl;
  } else {
    params.image_url = mediaUrl;
  }

  const result = await metaPost<MetaMediaResponse>(
    `${GRAPH_BASE}/${igAccountId}/media`,
    params
  );

  return result.id;
}

// ---------------------------------------------------------------------------
// Carousel Container
// ---------------------------------------------------------------------------

async function createCarouselContainer(
  igAccountId: string,
  mediaUrls: string[],
  caption: string,
  accessToken: string
): Promise<string> {
  // Step 1: Create item containers (children)
  const childIds: string[] = [];

  for (const url of mediaUrls) {
    const isVideo = isVideoUrl(url);

    const params: Record<string, string> = {
      is_carousel_item: "true",
      access_token: accessToken,
    };

    if (isVideo) {
      params.media_type = "VIDEO";
      params.video_url = url;
    } else {
      params.image_url = url;
    }

    const child = await metaPost<MetaMediaResponse>(
      `${GRAPH_BASE}/${igAccountId}/media`,
      params
    );

    childIds.push(child.id);
  }

  // Step 1b: Poll each child container until FINISHED
  for (const childId of childIds) {
    const status = await pollContainerStatus(childId, accessToken);
    if (status === "ERROR") {
      throw new Error(`Carousel child container ${childId} failed processing.`);
    }
  }

  // Step 2: Create parent carousel container
  const parentParams: Record<string, string> = {
    media_type: "CAROUSEL",
    caption,
    children: childIds.join(","),
    access_token: accessToken,
  };

  const parent = await metaPost<MetaMediaResponse>(
    `${GRAPH_BASE}/${igAccountId}/media`,
    parentParams
  );

  // Step 2b: Poll parent container until FINISHED
  const parentStatus = await pollContainerStatus(parent.id, accessToken);
  if (parentStatus === 'ERROR') {
    throw new Error('Carousel parent container failed processing.');
  }

  return parent.id;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // ── Authentication ────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { getAuth } = await import('firebase-admin/auth');
    initAdmin();
    await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch (authErr: any) {
    const msg = authErr?.message || "";
    if (msg.includes("default credentials") || msg.includes("FIREBASE_SERVICE_ACCOUNT")) {
      return NextResponse.json({ error: 'Server configuration error: Firebase Admin credentials not set. Please add the FIREBASE_SERVICE_ACCOUNT environment variable on Vercel.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let postId = "";

  try {
    // ── Parse request ─────────────────────────────────────────────────────
    const body = (await req.json()) as Partial<PublishRequest>;

    if (!body.postId || typeof body.postId !== "string") {
      return NextResponse.json(
        { error: "postId is required." },
        { status: 400 }
      );
    }

    postId = body.postId;

    // ── Step 1: Fetch post + connection ────────────────────────────────
    const post = await getScheduledPost(postId);

    if (!post) {
      return NextResponse.json(
        { error: `Post ${postId} not found.` },
        { status: 404 }
      );
    }

    if (post.status === "published") {
      return NextResponse.json(
        { error: "Post has already been published." },
        { status: 409 }
      );
    }

    const connection = await getInstagramConnection(post.clientId);

    if (!connection) {
      return NextResponse.json(
        {
          error: `No Instagram connection found for client "${post.clientId}". Please re-authorize.`,
        },
        { status: 404 }
      );
    }

    const igAccountId = connection.instagramBusinessAccountId;
    const accessToken = connection.facebookPageAccessToken;
    const mediaUrls = post.mediaItemUrls;
    const caption = post.caption || "";

    if (!mediaUrls || mediaUrls.length === 0) {
      await updateScheduledPostStatus(postId, "failed", {
        errorMessage: "No media URLs found on this post.",
      });
      return NextResponse.json(
        { error: "No media URLs found on this post." },
        { status: 400 }
      );
    }

    // ── Mark as processing ────────────────────────────────────────────
    await updateScheduledPostStatus(postId, "processing");

    // ── Step 2: Create container(s) ───────────────────────────────────
    if (mediaUrls.length > 10) {
      throw new Error('Instagram carousels support a maximum of 10 media items.');
    }

    let containerId: string;

    if (mediaUrls.length === 1) {
      // Single image or video
      containerId = await createSingleContainer(
        igAccountId,
        mediaUrls[0],
        caption,
        accessToken
      );
    } else {
      // Carousel (2–10 items)
      containerId = await createCarouselContainer(
        igAccountId,
        mediaUrls,
        caption,
        accessToken
      );
    }

    // Save the container ID immediately
    await updateScheduledPostStatus(postId, "processing", {
      metaContainerId: containerId,
    });

    // ── Step 3: Poll container status ─────────────────────────────────
    // For single posts, we still need to poll (especially for videos)
    if (mediaUrls.length === 1) {
      const containerStatus = await pollContainerStatus(containerId, accessToken);
      if (containerStatus === "ERROR") {
        await updateScheduledPostStatus(postId, "failed", {
          metaContainerId: containerId,
          errorMessage: "Container processing failed at Meta.",
        });
        return NextResponse.json(
          { error: "Container processing failed at Meta." },
          { status: 502 }
        );
      }
    }

    // ── Step 4: Publish ───────────────────────────────────────────────
    const publishResult = await metaPost<MetaPublishResponse>(
      `${GRAPH_BASE}/${igAccountId}/media_publish`,
      {
        creation_id: containerId,
        access_token: accessToken,
      }
    );

    // ── Step 5: Update Firestore with success ─────────────────────────
    await updateScheduledPostStatus(postId, "published", {
      metaContainerId: containerId,
      metaMediaId: publishResult.id,
    });

    return NextResponse.json({
      status: "published",
      postId,
      igMediaId: publishResult.id,
      containerId,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    console.error(`[Instagram Publish] Error for post ${postId}:`, error);

    // Attempt to update the post status to failed
    if (postId) {
      try {
        await updateScheduledPostStatus(postId, "failed", {
          errorMessage: message,
        });
      } catch (updateErr) {
        console.error("[Instagram Publish] Failed to update post status:", updateErr);
      }
    }

    return NextResponse.json(
      { error: message, postId },
      { status: error instanceof SyntaxError ? 400 : 500 }
    );
  }
}
