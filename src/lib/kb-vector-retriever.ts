import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface VectorRetrievedChunk {
  text: string;
  source: string;
  type: "document" | "vector";
  score: number;
  docTitle: string;
  chunkIndex: number;
}

export async function embedQuery(text: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Queries a single Firestore vector collection using findNearest.
 * Returns an array of chunks ordered by cosine similarity.
 */
async function queryVectorCollection(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
  queryEmbedding: number[],
  maxResults: number,
  sourceLabel: string,
): Promise<VectorRetrievedChunk[]> {
  try {
    const vectorQuery: any = (db.collection(collectionPath) as any).findNearest({
      vectorField: "embedding",
      queryVector: queryEmbedding,
      limit: maxResults,
      distanceMeasure: "COSINE",
    });

    const snapshot: any = await vectorQuery.get();
    const chunks: VectorRetrievedChunk[] = [];

    snapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      chunks.push({
        text: data.text,
        source: data.docTitle || sourceLabel,
        type: "vector",
        score: 1,
        docTitle: data.docTitle,
        chunkIndex: data.chunkIndex,
      });
    });

    return chunks;
  } catch (err: any) {
    // Collection might not exist yet or missing vector index — non-fatal
    console.warn(`[KB Vector] Query failed for ${collectionPath}:`, err?.message || err);
    return [];
  }
}

/**
 * Retrieves vector chunks with scope isolation.
 *
 * Scope behavior:
 *   - "personal": Only queries users/{uid}/ai_brain_vectors
 *   - "org": Only queries orgs/{orgId}/kb_vectors
 *   - undefined (legacy): Queries both (for backward compatibility)
 *
 * Results are merged and sorted by score.
 */
export async function retrieveVectorChunks(
  query: string,
  options: { orgId: string; uid?: string; maxResults?: number; scope?: "personal" | "org" }
): Promise<VectorRetrievedChunk[]> {
  const { orgId, uid, maxResults = 8, scope } = options;

  await initAdmin();
  const db = getAdminFirestore();

  const queryEmbedding = await embedQuery(query);

  // Run queries in parallel based on scope
  const queries: Promise<VectorRetrievedChunk[]>[] = [];

  // Query org vectors (when scope is 'org' or unspecified)
  if (scope !== "personal" && orgId) {
    queries.push(
      queryVectorCollection(db, `orgs/${orgId}/kb_vectors`, queryEmbedding, maxResults, "Org Knowledge Base")
    );
  }

  // Query personal AI Brain vectors (when scope is 'personal' or unspecified, and uid provided)
  if (scope !== "org" && uid) {
    queries.push(
      queryVectorCollection(db, `users/${uid}/ai_brain_vectors`, queryEmbedding, maxResults, "Personal AI Brain")
    );
  }

  if (queries.length === 0) return [];

  const results = await Promise.all(queries);
  const merged = results.flat();

  // Sort by score (descending) and cap at maxResults
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, maxResults);
}
