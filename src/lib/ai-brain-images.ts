/**
 * ai-brain-images.ts — Read the stored visual descriptions of images in an AI Brain
 *
 * SERVER ONLY. Images uploaded to an AI Brain are never kept as pixels for the model —
 * at upload time (src/app/api/ai-brain-upload/route.ts) Gemini Vision writes a detailed
 * text description into the document's `plaintext` and the doc gets `type: "image"`.
 *
 * Jarvis used to answer "the image didn't come through, please re-upload" when asked to
 * describe AI Brain photos. The chat route now uses this helper to fetch those stored
 * descriptions deterministically when the user asks about their AI Brain images.
 *
 * Scope isolation: personal reads ONLY users/{uid}/ai_brain_docs, org reads ONLY
 * orgs/{orgId}/org_brain_docs. No embeddings are produced here.
 */

import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";

const IMAGE_NAME_RE = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;
const MAX_IMAGES = 40;
const MAX_CHARS_PER_IMAGE = 1800;
const MAX_TOTAL_CHARS = 14000;

export interface BrainImageLookup {
  /** Total image documents found in this brain */
  total: number;
  /** Prompt-ready block (names + stored descriptions) */
  text: string;
}

/**
 * True when the user is asking about images/photos stored in an AI Brain
 * (not about an image attached to the current chat message).
 */
export function isBrainImageRequest(text: string): boolean {
  if (!text) return false;
  const mentionsImages = /\b(photos?|images?|pictures?|pics?|screenshots?|selfies?|imgs?)\b/i.test(text);
  const mentionsBrain = /\b(ai\s*brains?|brains?|media\s*library|knowledge\s*base)\b/i.test(text);
  return mentionsImages && mentionsBrain;
}

/**
 * Fetch every image document (name + stored AI description) from ONE brain.
 * Throws on Firestore errors so the caller can tell the model *why* it failed.
 */
export async function fetchBrainImageDescriptions(
  target: { scope: "personal"; uid: string } | { scope: "org"; orgId: string }
): Promise<BrainImageLookup> {
  await initAdmin();
  const db = getAdminFirestore();
  const collectionPath = target.scope === "personal"
    ? `users/${target.uid}/ai_brain_docs`
    : `orgs/${target.orgId}/org_brain_docs`;

  // Primary: docs tagged type == "image" by the upload route
  const tagged = await db.collection(collectionPath).where("type", "==", "image").limit(MAX_IMAGES).get();
  const byId = new Map<string, FirebaseFirestore.DocumentData>();
  tagged.docs.forEach((d) => byId.set(d.id, d.data()));

  // Fallback: older uploads without a `type` — detect by file extension from names only
  if (byId.size < MAX_IMAGES) {
    const names = await db.collection(collectionPath).select("name", "type").limit(500).get();
    const missing = names.docs
      .filter((d) => !byId.has(d.id) && !d.data().type && IMAGE_NAME_RE.test(String(d.data().name || "")))
      .slice(0, MAX_IMAGES - byId.size)
      .map((d) => db.collection(collectionPath).doc(d.id));
    if (missing.length > 0) {
      const snaps = await db.getAll(...missing);
      snaps.forEach((s) => { if (s.exists) byId.set(s.id, s.data() || {}); });
    }
  }

  const images = [...byId.entries()]
    .map(([id, data]) => ({
      name: String(data.name || id),
      description: String(data.plaintext || "").trim(),
      createdAtMs: Number(data.createdAtMs || 0),
      processing: data.status === "processing",
    }))
    .sort((a, b) => a.createdAtMs - b.createdAtMs);

  if (images.length === 0) {
    return { total: 0, text: "IMAGE FILES: 0 — there are no images in this AI Brain." };
  }

  const lines: string[] = [`IMAGE FILES: ${images.length}`];
  let used = 0;
  let shown = 0;
  for (const img of images) {
    if (used >= MAX_TOTAL_CHARS) break;
    shown++;
    const desc = img.description
      ? img.description.substring(0, MAX_CHARS_PER_IMAGE) + (img.description.length > MAX_CHARS_PER_IMAGE ? " […]" : "")
      : (img.processing ? "(still processing — no description yet)" : "(no description was generated for this image)");
    lines.push(`${shown}. ${img.name}\nStored description: ${desc}`);
    used += desc.length;
  }
  if (shown < images.length) {
    lines.push(`[${images.length - shown} more image(s) not shown due to size limits. Their names can be listed with the AI Brain tool (list_only=true).]`);
  }
  return { total: images.length, text: lines.join("\n\n") };
}
