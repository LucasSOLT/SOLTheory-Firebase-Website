import crypto from "crypto";
import { NextResponse } from "next/server";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import {
  getInstagramConnection,
  updateScheduledPostStatus,
} from "@/firebase/firestore/instagram";
import type { ScheduledInstagramPost } from "@/firebase/firestore/instagram";

// Vercel serverless: allow up to 5 minutes for container polling
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// Meta Graph API (duplicated constants — kept minimal for self-contained cron)
// ---------------------------------------------------------------------------

const GRAPH_API_VERSION = "v20.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const MAX_POLL_DURATION_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 5_000;
const POSTS_COLLECTION = "scheduled_instagram_posts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CronResult {
  processedCount: number;
  successes: string[];
  failures: { id: string; error: string }[];
}

interface MetaMediaResponse {
  id: string;
}

interface ContainerStatusResponse {
  id: string;
  status_code: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
}

interface MetaPublishResponse {
  id: string;
}

interface MetaErrorResponse {
  error?: { message: string; type: string; code: number; fbtrace_id: string };
}

// ---------------------------------------------------------------------------
// Meta API helpers
// ---------------------------------------------------------------------------

function isVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(mp4|mov|avi|wmv|flv|mkv|webm|m4v)$/i.test(pathname);
  } catch {
    return false;
  }
}

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
    throw new Error(data.error?.message || `Meta API error (${res.status})`);
  }
  return data;
}

async function metaGet<T>(
  url: string,
  params: Record<string, string>
): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${url}?${qs}`);
  const data = (await res.json()) as T & MetaErrorResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Meta API error (${res.status})`);
  }
  return data;
}

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
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Container ${containerId} did not finish within ${MAX_POLL_DURATION_MS / 1000}s.`
  );
}

// ---------------------------------------------------------------------------
// Core publish logic (self-contained — no HTTP self-call)
// ---------------------------------------------------------------------------

async function publishPost(post: ScheduledInstagramPost): Promise<string> {
  const connection = await getInstagramConnection(post.clientId);

  if (!connection) {
    throw new Error(
      `No Instagram connection for client "${post.clientId}".`
    );
  }

  const igAccountId = connection.instagramBusinessAccountId;
  const accessToken = connection.facebookPageAccessToken;
  const mediaUrls = post.mediaItemUrls;
  const caption = post.caption || "";

  if (!mediaUrls || mediaUrls.length === 0) {
    throw new Error("No media URLs on this post.");
  }

  let containerId: string;

  if (mediaUrls.length === 1) {
    // ── Single image / video ──────────────────────────────────────────
    const isVideo = isVideoUrl(mediaUrls[0]);
    const params: Record<string, string> = {
      caption,
      access_token: accessToken,
    };
    if (isVideo) {
      params.media_type = "VIDEO";
      params.video_url = mediaUrls[0];
    } else {
      params.image_url = mediaUrls[0];
    }

    const result = await metaPost<MetaMediaResponse>(
      `${GRAPH_BASE}/${igAccountId}/media`,
      params
    );
    containerId = result.id;

    // Save container ID early
    await updateScheduledPostStatus(post.id, "processing", {
      metaContainerId: containerId,
    });

    // Poll
    const status = await pollContainerStatus(containerId, accessToken);
    if (status === "ERROR") {
      throw new Error("Container processing failed at Meta.");
    }
  } else {
    // ── Carousel ──────────────────────────────────────────────────────
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

    // Poll children
    for (const childId of childIds) {
      const childStatus = await pollContainerStatus(childId, accessToken);
      if (childStatus === "ERROR") {
        throw new Error(`Carousel child ${childId} failed processing.`);
      }
    }

    // Create parent
    const parent = await metaPost<MetaMediaResponse>(
      `${GRAPH_BASE}/${igAccountId}/media`,
      {
        media_type: "CAROUSEL",
        caption,
        children: childIds.join(","),
        access_token: accessToken,
      }
    );
    containerId = parent.id;

    // Poll parent carousel container
    const parentStatus = await pollContainerStatus(parent.id, accessToken);
    if (parentStatus === 'ERROR') {
      throw new Error('Carousel parent container failed processing.');
    }

    await updateScheduledPostStatus(post.id, "processing", {
      metaContainerId: containerId,
    });
  }

  // ── Publish ──────────────────────────────────────────────────────────
  const publishResult = await metaPost<MetaPublishResponse>(
    `${GRAPH_BASE}/${igAccountId}/media_publish`,
    { creation_id: containerId, access_token: accessToken }
  );

  // ── Mark published ───────────────────────────────────────────────────
  await updateScheduledPostStatus(post.id, "published", {
    metaContainerId: containerId,
    metaMediaId: publishResult.id,
  });

  return publishResult.id;
}

// ---------------------------------------------------------------------------
// GET handler — cron endpoint
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  // ── Security: verify Bearer token ──────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[IG Cron] CRON_SECRET is not configured.");
    return NextResponse.json(
      { error: "Server misconfiguration: CRON_SECRET not set." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const secretBuffer = Buffer.from(cronSecret);
  const tokenBuffer = Buffer.from(token);
  if (secretBuffer.length !== tokenBuffer.length || !crypto.timingSafeEqual(secretBuffer, tokenBuffer)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  // ── Query due posts ────────────────────────────────────────────────
  const startTime = Date.now();
  console.log("[IG Cron] Starting scheduled post scan...");

  initAdmin();
  const firestore = getFirestore();
  const now = Timestamp.now();

  // ── Recovery: reset posts stuck in "processing" for >10 min ────────
  const STUCK_THRESHOLD_MS = 10 * 60 * 1000;
  const stuckCutoff = Timestamp.fromMillis(Date.now() - STUCK_THRESHOLD_MS);
  try {
    const stuckSnap = await firestore
      .collection(POSTS_COLLECTION)
      .where("status", "==", "processing")
      .where("updatedAt", "<", stuckCutoff)
      .get();

    if (!stuckSnap.empty) {
      const stuckBatch = firestore.batch();
      for (const doc of stuckSnap.docs) {
        stuckBatch.update(doc.ref, {
          status: "failed",
          errorMessage: "Publishing timed out — the server lost connection during processing. This post can be retried.",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await stuckBatch.commit();
      console.log(`[IG Cron] Recovered ${stuckSnap.size} stuck "processing" post(s).`);
    }
  } catch (recoverErr) {
    console.error("[IG Cron] Stuck post recovery failed:", recoverErr);
  }

  // ── Atomic claim: use a transaction to prevent two cron runs from
  //    processing the same post simultaneously ────────────────────────
  const duePosts = await firestore.runTransaction(async (txn) => {
    const snapshot = await txn.get(
      firestore
        .collection(POSTS_COLLECTION)
        .where("status", "==", "scheduled")
        .where("scheduledTime", "<=", now)
    );

    if (snapshot.empty) return [];

    const posts = snapshot.docs.map(
      (doc) => ({ ...doc.data(), id: doc.id } as ScheduledInstagramPost)
    );

    // Mark all as "processing" within the same transaction
    for (const post of posts) {
      txn.update(firestore.collection(POSTS_COLLECTION).doc(post.id), {
        status: "processing",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return posts;
  });

  if (duePosts.length === 0) {
    console.log("[IG Cron] No due posts found.");
    return NextResponse.json({
      processedCount: 0,
      successes: [],
      failures: [],
      durationMs: Date.now() - startTime,
    } satisfies CronResult & { durationMs: number });
  }

  console.log(`[IG Cron] Found ${duePosts.length} due post(s): [${duePosts.map((p) => p.id).join(", ")}]`);
  console.log(`[IG Cron] Marked ${duePosts.length} post(s) as "processing".`);

  // ── Execute publishing concurrently ────────────────────────────────
  const results = await Promise.allSettled(
    duePosts.map(async (post) => {
      console.log(`[IG Cron] Publishing post ${post.id}...`);
      const igMediaId = await publishPost(post);
      console.log(`[IG Cron] ✓ Post ${post.id} published → ig_media_id: ${igMediaId}`);
      return { id: post.id, igMediaId };
    })
  );

  // ── Build summary ──────────────────────────────────────────────────
  const successes: string[] = [];
  const failures: { id: string; error: string }[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const postId = duePosts[i].id;

    if (result.status === "fulfilled") {
      successes.push(postId);
    } else {
      const errorMsg =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);

      failures.push({ id: postId, error: errorMsg });
      console.error(`[IG Cron] ✗ Post ${postId} failed: ${errorMsg}`);

      // Ensure the post is marked as failed
      try {
        await updateScheduledPostStatus(postId, "failed", {
          errorMessage: errorMsg,
        });
      } catch (updateErr) {
        console.error(`[IG Cron] Failed to mark post ${postId} as failed:`, updateErr);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[IG Cron] Complete. ${successes.length} succeeded, ${failures.length} failed. (${durationMs}ms)`
  );

  return NextResponse.json({
    processedCount: duePosts.length,
    successes,
    failures,
    durationMs,
  } satisfies CronResult & { durationMs: number });
}
