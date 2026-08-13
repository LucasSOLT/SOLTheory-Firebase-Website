import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

const CHUNK_SIZE = 500;
const OVERLAP = 100;
const BATCH_SIZE = 5;

function chunkDocument(content: string, chunkSize: number = CHUNK_SIZE, overlap: number = OVERLAP): string[] {
  if (content.length < 20) return [];
  const chunks: string[] = [];
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if ((currentChunk + "\n\n" + trimmed).length > chunkSize && currentChunk.length > 50) {
      chunks.push(currentChunk.trim());
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.min(20, Math.floor(words.length * 0.3)));
      currentChunk = overlapWords.join(" ") + "\n\n" + trimmed;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + trimmed : trimmed;
    }
  }

  if (currentChunk.trim().length > 20) {
    chunks.push(currentChunk.trim());
  }

  if (chunks.length === 0 && content.length > chunkSize) {
    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const slice = content.substring(i, i + chunkSize).trim();
      if (slice.length > 20) {
        chunks.push(slice);
      }
    }
  } else if (chunks.length === 0 && content.length >= 20) {
    chunks.push(content.trim());
  }

  return chunks;
}

export async function POST(req: Request) {
  try {
    const authResult = await verifyRequest(req);
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, docId, title, content } = await req.json();
    
    if (!orgId || !docId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const chunks = chunkDocument(content);
    if (chunks.length === 0) {
      return NextResponse.json({ success: true, chunksCreated: 0 });
    }

    await initAdmin();
    const db = getAdminFirestore();
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

    let chunksCreated = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const promises = batchChunks.map(async (chunkText, batchIndex) => {
        const chunkIndex = i + batchIndex;
        const result = await model.embedContent(chunkText);
        const embeddingArray = result.embedding.values;

        await db.collection(`orgs/${orgId}/kb_vectors`).add({
          docId,
          docTitle: title || "Untitled Document",
          chunkIndex,
          text: chunkText,
          embedding: FieldValue.vector(embeddingArray),
          tokenCount: chunkText.length, // Approximate
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      await Promise.all(promises);
      chunksCreated += batchChunks.length;
      
      if (i + BATCH_SIZE < chunks.length) {
        // Sleep for 100ms between batches to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return NextResponse.json({ success: true, chunksCreated });
  } catch (error: any) {
    console.error("[KB Process API] Error:", error);
    return NextResponse.json(
      { error: "Failed to process document", details: error.message },
      { status: 500 }
    );
  }
}
