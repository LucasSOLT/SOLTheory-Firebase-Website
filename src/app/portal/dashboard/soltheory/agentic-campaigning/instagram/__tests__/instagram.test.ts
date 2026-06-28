/**
 * Instagram Creative Assistant — Integration & Unit Tests
 *
 * Covers:
 *   1. Zustand store (toggleMediaSelection, clearSelectedMedia)
 *   2. Firestore encryption schema (AES-256-GCM roundtrip)
 *   3. Meta Graph API carousel payload construction
 *
 * Run:  npx vitest run src/app/portal/dashboard/soltheory/agentic-campaigning/instagram/__tests__/instagram.test.ts
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import * as crypto from "crypto";

// ═══════════════════════════════════════════════════════════════════════════
// 1. ZUSTAND STORE UNIT TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("useInstagramStore — media selection", () => {
  // We re-import the store per test to get a clean Zustand state.
  // Vitest module caching means we need `vi.resetModules()` to reset.

  beforeEach(() => {
    vi.resetModules();
  });

  async function getStore() {
    const mod = await import("@/stores/instagramStore");
    return mod.useInstagramStore;
  }

  it("starts with an empty selectedMedia array", async () => {
    const useStore = await getStore();
    expect(useStore.getState().selectedMedia).toEqual([]);
  });

  it("adds a media item via toggleMediaSelection", async () => {
    const useStore = await getStore();

    const item = { id: "img-1", url: "https://cdn.test/photo1.jpg", type: "image" as const };
    useStore.getState().toggleMediaSelection(item);

    const { selectedMedia } = useStore.getState();
    expect(selectedMedia).toHaveLength(1);
    expect(selectedMedia[0]).toEqual(item);
  });

  it("removes a media item when toggled twice (toggle off)", async () => {
    const useStore = await getStore();

    const item = { id: "img-1", url: "https://cdn.test/photo1.jpg", type: "image" as const };
    useStore.getState().toggleMediaSelection(item); // add
    useStore.getState().toggleMediaSelection(item); // remove

    expect(useStore.getState().selectedMedia).toHaveLength(0);
  });

  it("supports multi-select of up to 10 items (Instagram carousel limit)", async () => {
    const useStore = await getStore();

    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `img-${i}`,
      url: `https://cdn.test/photo${i}.jpg`,
      type: "image" as const,
    }));

    for (const item of items) {
      useStore.getState().toggleMediaSelection(item);
    }

    expect(useStore.getState().selectedMedia).toHaveLength(10);
    expect(useStore.getState().selectedMedia.map((m) => m.id)).toEqual(
      items.map((m) => m.id)
    );
  });

  it("does not mutate the previous state array (immutability check)", async () => {
    const useStore = await getStore();

    const item1 = { id: "img-1", url: "https://cdn.test/1.jpg", type: "image" as const };
    useStore.getState().toggleMediaSelection(item1);

    const refBefore = useStore.getState().selectedMedia;

    const item2 = { id: "img-2", url: "https://cdn.test/2.jpg", type: "image" as const };
    useStore.getState().toggleMediaSelection(item2);

    const refAfter = useStore.getState().selectedMedia;

    // The array reference must be different (new array, not mutated in place)
    expect(refBefore).not.toBe(refAfter);
    // Original reference should still have length 1
    expect(refBefore).toHaveLength(1);
    expect(refAfter).toHaveLength(2);
  });

  it("toggles by id, not by reference equality", async () => {
    const useStore = await getStore();

    const original = { id: "vid-1", url: "https://cdn.test/video.mp4", type: "video" as const };
    useStore.getState().toggleMediaSelection(original);

    // Create a *different object* with the same id
    const duplicate = { id: "vid-1", url: "https://cdn.test/video.mp4", type: "video" as const };
    useStore.getState().toggleMediaSelection(duplicate);

    // Should be removed because the id matches
    expect(useStore.getState().selectedMedia).toHaveLength(0);
  });

  it("clearSelectedMedia empties the array", async () => {
    const useStore = await getStore();

    useStore.getState().toggleMediaSelection({
      id: "img-1",
      url: "https://cdn.test/1.jpg",
      type: "image",
    });
    useStore.getState().toggleMediaSelection({
      id: "img-2",
      url: "https://cdn.test/2.jpg",
      type: "image",
    });

    expect(useStore.getState().selectedMedia).toHaveLength(2);

    useStore.getState().clearSelectedMedia();
    expect(useStore.getState().selectedMedia).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. FIRESTORE ENCRYPTION SCHEMA — AES-256-GCM ROUNDTRIP
// ═══════════════════════════════════════════════════════════════════════════

describe("AES-256-GCM encryption roundtrip", () => {
  // We replicate the encrypt/decrypt logic here to test the cryptographic
  // contract without needing Firestore or firebase-admin.
  // This ensures the schema stored in Firestore can be decrypted correctly.

  const ALGORITHM = "aes-256-gcm";
  const IV_LENGTH = 16;
  const TEST_KEY = crypto.randomBytes(32); // 256-bit key

  function encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, TEST_KEY, iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();
    return [iv.toString("hex"), authTag.toString("hex"), encrypted].join(":");
  }

  function decrypt(payload: string): string {
    const [ivHex, authTagHex, ciphertext] = payload.split(":");
    if (!ivHex || !authTagHex || !ciphertext) {
      throw new Error("Malformed encrypted payload");
    }
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, TEST_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  it("encrypts and decrypts a Meta access token correctly", () => {
    const token = "EAABsbCS1iZBgBO0m5ZAK...fake-long-token-string";
    const encrypted = encrypt(token);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(token);
  });

  it("produces a payload in the format iv:authTag:ciphertext", () => {
    const encrypted = encrypt("test-token-123");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);

    // IV should be 32 hex chars (16 bytes)
    expect(parts[0]).toHaveLength(32);
    // Auth tag should be 32 hex chars (16 bytes)
    expect(parts[1]).toHaveLength(32);
    // Ciphertext should be non-empty hex
    expect(parts[2].length).toBeGreaterThan(0);
    expect(/^[0-9a-f]+$/i.test(parts[2])).toBe(true);
  });

  it("produces different ciphertext for the same input (random IV)", () => {
    const token = "same-token-value";
    const a = encrypt(token);
    const b = encrypt(token);
    // Different IVs → different ciphertexts
    expect(a).not.toBe(b);
    // But both decrypt to the same value
    expect(decrypt(a)).toBe(token);
    expect(decrypt(b)).toBe(token);
  });

  it("throws on tampered ciphertext (authentication check)", () => {
    const encrypted = encrypt("sensitive-token");
    const parts = encrypted.split(":");
    // Flip a character in the ciphertext
    const tampered =
      parts[0] +
      ":" +
      parts[1] +
      ":" +
      (parts[2].startsWith("a") ? "b" : "a") +
      parts[2].slice(1);

    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on malformed payload", () => {
    expect(() => decrypt("not-a-valid-payload")).toThrow("Malformed");
    expect(() => decrypt("")).toThrow("Malformed");
    expect(() => decrypt("only:two")).toThrow("Malformed");
  });

  it("simulates full getInstagramConnection decryption flow", () => {
    // Simulate what Firestore stores after saveInstagramConnection
    const rawConnection = {
      metaUserAccessToken: encrypt("EAAG...user-token"),
      facebookPageAccessToken: encrypt("EAAG...page-token"),
      facebookPageId: "123456789",
      instagramBusinessAccountId: "17841400000",
      instagramUsername: "soltheory",
      instagramProfilePictureUrl: "https://cdn.fbsbx.com/...",
    };

    // Simulate getInstagramConnection decryption step
    const decryptedConnection = {
      ...rawConnection,
      metaUserAccessToken: decrypt(rawConnection.metaUserAccessToken),
      facebookPageAccessToken: decrypt(rawConnection.facebookPageAccessToken),
    };

    expect(decryptedConnection.metaUserAccessToken).toBe("EAAG...user-token");
    expect(decryptedConnection.facebookPageAccessToken).toBe("EAAG...page-token");
    // Non-encrypted fields pass through unchanged
    expect(decryptedConnection.facebookPageId).toBe("123456789");
    expect(decryptedConnection.instagramBusinessAccountId).toBe("17841400000");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. META GRAPH API — CAROUSEL PAYLOAD CONSTRUCTOR TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Carousel payload construction", () => {
  // Replicate the carousel payload construction logic to verify it matches
  // Meta's Graph API contract without making real API calls.

  const GRAPH_API_VERSION = "v20.0";
  const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

  function isVideoUrl(url: string): boolean {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(mp4|mov|avi|wmv|flv|mkv|webm|m4v)$/i.test(pathname);
  }

  interface MediaContainerRequest {
    url: string;
    params: Record<string, string>;
    step: "child" | "parent" | "publish";
  }

  /**
   * Given media URLs, builds the sequence of Meta API requests that our
   * publish handler would make. Does NOT call fetch — returns the payloads.
   */
  function buildCarouselPayloads(
    igAccountId: string,
    mediaUrls: string[],
    caption: string,
    accessToken: string
  ): MediaContainerRequest[] {
    const requests: MediaContainerRequest[] = [];
    const childIds: string[] = [];

    // Step 1: Child containers
    for (let i = 0; i < mediaUrls.length; i++) {
      const url = mediaUrls[i];
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

      requests.push({
        url: `${GRAPH_BASE}/${igAccountId}/media`,
        params,
        step: "child",
      });

      childIds.push(`child-container-${i}`);
    }

    // Step 2: Parent container
    requests.push({
      url: `${GRAPH_BASE}/${igAccountId}/media`,
      params: {
        media_type: "CAROUSEL",
        caption,
        children: childIds.join(","),
        access_token: accessToken,
      },
      step: "parent",
    });

    // Step 3: Publish
    requests.push({
      url: `${GRAPH_BASE}/${igAccountId}/media_publish`,
      params: {
        creation_id: "parent-container-id",
        access_token: accessToken,
      },
      step: "publish",
    });

    return requests;
  }

  const IG_ACCOUNT = "17841400000";
  const TOKEN = "EAAG-test-token";

  it("produces N child + 1 parent + 1 publish requests for N media items", () => {
    const urls = [
      "https://cdn.test/photo1.jpg",
      "https://cdn.test/photo2.jpg",
      "https://cdn.test/photo3.jpg",
    ];

    const payloads = buildCarouselPayloads(IG_ACCOUNT, urls, "Test caption", TOKEN);

    // 3 children + 1 parent + 1 publish = 5
    expect(payloads).toHaveLength(5);
    expect(payloads.filter((p) => p.step === "child")).toHaveLength(3);
    expect(payloads.filter((p) => p.step === "parent")).toHaveLength(1);
    expect(payloads.filter((p) => p.step === "publish")).toHaveLength(1);
  });

  it("child containers include is_carousel_item=true", () => {
    const urls = [
      "https://cdn.test/a.jpg",
      "https://cdn.test/b.jpg",
    ];
    const payloads = buildCarouselPayloads(IG_ACCOUNT, urls, "Caption", TOKEN);

    const children = payloads.filter((p) => p.step === "child");
    for (const child of children) {
      expect(child.params.is_carousel_item).toBe("true");
      expect(child.params.access_token).toBe(TOKEN);
    }
  });

  it("sets image_url for image files, not video_url", () => {
    const urls = ["https://cdn.test/photo.jpg"];
    const payloads = buildCarouselPayloads(IG_ACCOUNT, urls, "Caption", TOKEN);

    const child = payloads[0];
    expect(child.params.image_url).toBe("https://cdn.test/photo.jpg");
    expect(child.params.video_url).toBeUndefined();
    expect(child.params.media_type).toBeUndefined();
  });

  it("sets video_url and media_type=VIDEO for video files", () => {
    const urls = ["https://cdn.test/clip.mp4"];
    const payloads = buildCarouselPayloads(IG_ACCOUNT, urls, "Caption", TOKEN);

    const child = payloads[0];
    expect(child.params.video_url).toBe("https://cdn.test/clip.mp4");
    expect(child.params.media_type).toBe("VIDEO");
    expect(child.params.image_url).toBeUndefined();
  });

  it("handles mixed image + video carousel correctly", () => {
    const urls = [
      "https://cdn.test/photo1.jpg",
      "https://cdn.test/video1.mp4",
      "https://cdn.test/photo2.png",
      "https://cdn.test/video2.mov",
    ];

    const payloads = buildCarouselPayloads(IG_ACCOUNT, urls, "Mixed!", TOKEN);
    const children = payloads.filter((p) => p.step === "child");

    // photo1.jpg → image
    expect(children[0].params.image_url).toBe("https://cdn.test/photo1.jpg");
    expect(children[0].params.media_type).toBeUndefined();

    // video1.mp4 → video
    expect(children[1].params.video_url).toBe("https://cdn.test/video1.mp4");
    expect(children[1].params.media_type).toBe("VIDEO");

    // photo2.png → image
    expect(children[2].params.image_url).toBe("https://cdn.test/photo2.png");

    // video2.mov → video
    expect(children[3].params.video_url).toBe("https://cdn.test/video2.mov");
    expect(children[3].params.media_type).toBe("VIDEO");
  });

  it("parent container has media_type=CAROUSEL and comma-separated children", () => {
    const urls = [
      "https://cdn.test/a.jpg",
      "https://cdn.test/b.jpg",
      "https://cdn.test/c.jpg",
    ];

    const payloads = buildCarouselPayloads(IG_ACCOUNT, urls, "My carousel", TOKEN);
    const parent = payloads.find((p) => p.step === "parent")!;

    expect(parent.params.media_type).toBe("CAROUSEL");
    expect(parent.params.caption).toBe("My carousel");
    expect(parent.params.children).toBe(
      "child-container-0,child-container-1,child-container-2"
    );
    expect(parent.params.access_token).toBe(TOKEN);
  });

  it("publish request targets the media_publish endpoint", () => {
    const urls = ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"];
    const payloads = buildCarouselPayloads(IG_ACCOUNT, urls, "Caption", TOKEN);
    const publish = payloads.find((p) => p.step === "publish")!;

    expect(publish.url).toBe(`${GRAPH_BASE}/${IG_ACCOUNT}/media_publish`);
    expect(publish.params.creation_id).toBeDefined();
    expect(publish.params.access_token).toBe(TOKEN);
  });

  it("all requests target the correct Graph API version (v20.0)", () => {
    const urls = ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"];
    const payloads = buildCarouselPayloads(IG_ACCOUNT, urls, "Caption", TOKEN);

    for (const p of payloads) {
      expect(p.url).toContain("/v20.0/");
    }
  });

  it("isVideoUrl correctly classifies common extensions", () => {
    const videos = [
      "https://cdn.test/clip.mp4",
      "https://cdn.test/clip.mov",
      "https://cdn.test/clip.webm",
      "https://cdn.test/clip.mkv",
      "https://cdn.test/clip.m4v",
    ];
    const images = [
      "https://cdn.test/photo.jpg",
      "https://cdn.test/photo.png",
      "https://cdn.test/photo.webp",
      "https://cdn.test/photo.gif",
    ];

    for (const v of videos) {
      expect(isVideoUrl(v)).toBe(true);
    }
    for (const img of images) {
      expect(isVideoUrl(img)).toBe(false);
    }
  });
});
