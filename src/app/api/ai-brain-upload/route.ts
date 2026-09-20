import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { firebaseConfig } from "@/firebase/config";

export const runtime = "nodejs";
export const maxDuration = 120; // Text extraction + embedding can take a while

// ─── Constants ───────────────────────────────────────────────────────────
const CHUNK_SIZE = 500;
const OVERLAP = 100;
const BATCH_SIZE = 5;
const MAX_PLAINTEXT_LENGTH = 100_000; // Cap stored plaintext at 100K chars

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp"]);
const TEXT_EXTENSIONS = new Set([
  "txt", "md", "csv", "json", "xml", "html", "css",
  "js", "ts", "tsx", "jsx", "py", "rb", "go", "rs",
  "java", "c", "cpp", "h", "yaml", "yml", "toml", "ini",
  "log", "env", "sh", "bat", "ps1", "sql",
]);

// ─── Text Extraction Helpers ─────────────────────────────────────────────

/**
 * Extract text from a PDF buffer using pdf2json.
 * Returns the raw text content and page count.
 */
async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; pageCount?: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFParser = require("pdf2json");
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1); // 1 = raw text mode
    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      const text: string = pdfParser.getRawTextContent();
      const pageCount = pdfData?.Pages?.length;
      resolve({ text, pageCount });
    });
    pdfParser.on("pdfParser_dataError", (err: any) => {
      reject(new Error(`PDF parse error: ${err.parserError || err}`));
    });
    pdfParser.parseBuffer(buffer);
  });
}

/**
 * Extract raw text from a DOCX buffer using mammoth.
 */
async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const mammothModule = await import("mammoth");
  // mammoth is CommonJS — in ESM/Next.js bundler runtime, exports are under .default
  const mammoth = (mammothModule as any).default || mammothModule;
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Use Gemini Vision to describe/OCR an image for searchability.
 */
async function extractTextFromImage(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[AI Brain Upload] GEMINI_API_KEY not found in environment for image OCR");
      return "Uploaded image file (no text extracted - missing Gemini API key)";
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const base64 = buffer.toString("base64");
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType,
        },
      },
      "Describe this image in detail. If it contains text, extract all visible text content verbatim. " +
      "If it's a diagram or chart, describe its structure, labels, and data. " +
      "If it's a photo, describe what is shown including any notable details. " +
      "Be thorough, factual, and organized.",
    ]);

    return result.response.text();
  } catch (err: any) {
    console.error("[AI Brain Upload] extractTextFromImage failed:", err);
    return `Uploaded image file. Visual extraction notice: ${err.message || "Could not extract visual details"}`;
  }
}

// ─── Chunking (same algorithm as knowledge-base/process) ─────────────────

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

  // Fallback: sliding window if no paragraph breaks
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

// ─── Format file size for display ────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Main Upload Handler ─────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    // ── Parse form data ──────────────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const scope = (formData.get("scope") as string) || "personal"; // "personal" | "org"
    const orgId = formData.get("orgId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!["personal", "org"].includes(scope)) {
      return NextResponse.json({ error: "Invalid scope. Must be 'personal' or 'org'" }, { status: 400 });
    }
    if (scope === "org" && !orgId) {
      return NextResponse.json({ error: "orgId is required for org scope" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    const mimeType = file.type || "application/octet-stream";
    const sizeBytes = buffer.length;
    const size = formatFileSize(sizeBytes);

    // Generate unique document ID
    const docId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    console.log(`[AI Brain Upload] Processing ${fileName} (${size}, ext=${extension}, scope=${scope})`);

    // ── Extract text based on file type ──────────────────────────────────
    let plaintext = "";
    let pageCount: number | undefined;
    let docType: string;

    if (extension === "pdf") {
      docType = "pdf";
      try {
        const result = await extractTextFromPDF(buffer);
        plaintext = result.text;
        pageCount = result.pageCount;
        console.log(`[AI Brain Upload] PDF: ${pageCount} pages, ${plaintext.length} chars extracted`);
      } catch (err: any) {
        console.error(`[AI Brain Upload] PDF extraction failed:`, err.message);
        plaintext = `[PDF file: ${fileName}. Text extraction encountered an error.]`;
      }
    } else if (extension === "docx") {
      docType = "docx";
      try {
        plaintext = await extractTextFromDOCX(buffer);
        console.log(`[AI Brain Upload] DOCX: ${plaintext.length} chars extracted`);
      } catch (err: any) {
        console.error(`[AI Brain Upload] DOCX extraction failed:`, err.message);
        plaintext = `[DOCX file: ${fileName}. Text extraction encountered an error.]`;
      }
    } else if (extension === "doc") {
      docType = "doc";
      plaintext = `[Legacy .doc file: ${fileName}. Please convert to .docx or .pdf for full text extraction.]`;
    } else if (TEXT_EXTENSIONS.has(extension)) {
      docType = "txt";
      plaintext = buffer.toString("utf-8");
      console.log(`[AI Brain Upload] Text file: ${plaintext.length} chars`);
    } else if (IMAGE_EXTENSIONS.has(extension)) {
      docType = "image";
      try {
        plaintext = await extractTextFromImage(buffer, mimeType);
        console.log(`[AI Brain Upload] Image described: ${plaintext.length} chars`);
      } catch (err: any) {
        console.error(`[AI Brain Upload] Image description failed:`, err.message);
        plaintext = `[Image file: ${fileName}. Visual description could not be generated.]`;
      }
    } else {
      docType = extension || "unknown";
      plaintext = `[File: ${fileName}. Text extraction not supported for .${extension} files.]`;
    }

    // ── Upload file to Firebase Storage ──────────────────────────────────
    await initAdmin();
    const bucket = getStorage().bucket(firebaseConfig.storageBucket);
    const storagePath = scope === "personal"
      ? `ai_brain/${auth.uid}/${docId}/${fileName}`
      : `ai_brain/org/${orgId}/${docId}/${fileName}`;

    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          uploadedBy: auth.uid,
          scope,
          docId,
        },
      },
    });

    // Generate a download URL — try signed URL first, fall back to public URL
    // getSignedUrl requires a service account private key; local dev often uses
    // Firebase CLI access tokens which lack the private key, causing a SigningError.
    let downloadUrl: string;
    try {
      [downloadUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-01-2030",
      });
    } catch (signErr: any) {
      console.warn("[AI Brain Upload] getSignedUrl failed, using public URL fallback:", signErr.message);
      try {
        await fileRef.makePublic();
      } catch { /* best effort — bucket may already allow public reads */ }
      downloadUrl = `https://storage.googleapis.com/${firebaseConfig.storageBucket}/${encodeURIComponent(storagePath)}`;
    }

    console.log(`[AI Brain Upload] File uploaded to Storage: ${storagePath}`);

    // ── Store document metadata in Firestore ─────────────────────────────
    const db = getAdminFirestore();
    const firestoreCollectionPath = scope === "personal"
      ? `users/${auth.uid}/ai_brain_docs`
      : `orgs/${orgId}/org_brain_docs`;

    const docData: Record<string, any> = {
      id: docId,
      name: fileName,
      type: docType,
      extension,
      sizeBytes,
      size,
      mimeType,
      downloadUrl,
      storagePath,
      plaintext: plaintext.substring(0, MAX_PLAINTEXT_LENGTH),
      pageCount: pageCount || null,
      uploadedBy: auth.uid,
      uploadedByEmail: auth.email,
      createdAt: FieldValue.serverTimestamp(),
      status: "processing", // Will be updated to "ready" after embedding
      vectorChunkCount: 0,
    };

    await db.collection(firestoreCollectionPath).doc(docId).set(docData);
    console.log(`[AI Brain Upload] Metadata stored at ${firestoreCollectionPath}/${docId}`);

    // ── Generate vector embeddings ───────────────────────────────────────
    const vectorCollectionPath = scope === "personal"
      ? `users/${auth.uid}/ai_brain_vectors`
      : `orgs/${orgId}/kb_vectors`;

    let chunksCreated = 0;

    if (plaintext.length >= 20) {
      const chunks = chunkDocument(plaintext);

      if (chunks.length > 0) {
        try {
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            console.warn("[AI Brain Upload] GEMINI_API_KEY missing; skipping vector embedding generation");
          } else {
            console.log(`[AI Brain Upload] Generating embeddings for ${chunks.length} chunks...`);
            const genAI = new GoogleGenerativeAI(apiKey);
            const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

            for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
              const batchChunks = chunks.slice(i, i + BATCH_SIZE);
              const promises = batchChunks.map(async (chunkText, batchIndex) => {
                const chunkIndex = i + batchIndex;
                const result = await embeddingModel.embedContent(chunkText);
                const embeddingArray = result.embedding.values;

                await db.collection(vectorCollectionPath).add({
                  docId,
                  docTitle: fileName,
                  chunkIndex,
                  text: chunkText,
                  embedding: FieldValue.vector(embeddingArray),
                  tokenCount: chunkText.length,
                  createdAt: FieldValue.serverTimestamp(),
                  // Scope-specific metadata for cleanup/filtering
                  ...(scope === "personal" ? { userId: auth.uid } : { orgId }),
                });
              });

              await Promise.all(promises);
              chunksCreated += batchChunks.length;

              // Rate limiting: 100ms pause between batches
              if (i + BATCH_SIZE < chunks.length) {
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
            }
            console.log(`[AI Brain Upload] ${chunksCreated} vector chunks created in ${vectorCollectionPath}`);
          }
        } catch (embedErr: any) {
          console.warn("[AI Brain Upload] Vector embedding failed (non-fatal):", embedErr.message);
        }
      }
    }

    // ── Update document status to "ready" ────────────────────────────────
    await db.collection(firestoreCollectionPath).doc(docId).update({
      status: "ready",
      vectorChunkCount: chunksCreated,
    });

    return NextResponse.json({
      success: true,
      docId,
      downloadUrl,
      chunksCreated,
      status: "ready",
      textLength: plaintext.length,
      docType,
    });
  } catch (error: any) {
    console.error("[AI Brain Upload] Error:", error);
    return NextResponse.json(
      { error: "Upload failed", details: error.message },
      { status: 500 }
    );
  }
}
