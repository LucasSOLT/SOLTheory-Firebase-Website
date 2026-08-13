import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { FieldValue, VectorQuery, VectorQuerySnapshot } from "firebase-admin/firestore";
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

export async function retrieveVectorChunks(
  query: string,
  options: { orgId: string; maxResults?: number }
): Promise<VectorRetrievedChunk[]> {
  const { orgId, maxResults = 8 } = options;

  await initAdmin();
  const db = getAdminFirestore();

  const queryEmbedding = await embedQuery(query);

  const vectorQuery: VectorQuery = db
    .collection(`orgs/${orgId}/kb_vectors`)
    .findNearest({
      vectorField: "embedding",
      queryVector: queryEmbedding,
      limit: maxResults,
      distanceMeasure: "COSINE",
    });

  const snapshot: VectorQuerySnapshot = await vectorQuery.get();
  const chunks: VectorRetrievedChunk[] = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    chunks.push({
      text: data.text,
      source: data.docTitle || "Vector Knowledge Base",
      type: "vector",
      score: 1, // Default score, findNearest doesn't return distances in all API versions natively easily here or you can get it but for now we just return them in order
      docTitle: data.docTitle,
      chunkIndex: data.chunkIndex,
    });
  });

  return chunks;
}
