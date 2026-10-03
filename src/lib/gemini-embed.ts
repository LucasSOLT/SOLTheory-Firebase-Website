/**
 * Shared Gemini embedding helper for the Firestore vector stores
 * (orgs/{orgId}/kb_vectors and users/{uid}/ai_brain_vectors).
 *
 * `text-embedding-004` was retired by Google (the API now returns 404), so all
 * ingest + query paths go through this helper to guarantee the SAME model and
 * dimension everywhere. `gemini-embedding-001` natively outputs 3072 dims, but it
 * supports truncation (Matryoshka), so we request 768 to stay compatible with the
 * existing 768-dim Firestore vector indexes.
 *
 * ⚠ Vectors from different models are NOT comparable. Never change EMBED_MODEL /
 * EMBED_DIM without re-embedding every stored chunk (see scripts/reembed-vectors.ts).
 */
export const EMBED_MODEL = "gemini-embedding-001" as const;
export const EMBED_DIM = 768 as const;

export type EmbedTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export async function embedText(
  text: string,
  taskType: EmbedTaskType = "RETRIEVAL_DOCUMENT",
  apiKey: string | undefined = process.env.GEMINI_API_KEY,
): Promise<number[]> {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
  const body = JSON.stringify({
    model: `models/${EMBED_MODEL}`,
    content: { parts: [{ text }] },
    taskType,
    outputDimensionality: EMBED_DIM,
  });

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body,
    });
    if (res.ok) {
      const json: any = await res.json();
      const values: number[] | undefined = json?.embedding?.values;
      if (!Array.isArray(values) || values.length !== EMBED_DIM) {
        throw new Error(`Unexpected embedding shape (got ${values?.length ?? "none"}, expected ${EMBED_DIM})`);
      }
      return values;
    }
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    lastErr = new Error(`Embedding request failed: HTTP ${res.status} ${detail}`);
    // Retry only transient errors
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  throw lastErr || new Error("Embedding request failed");
}
