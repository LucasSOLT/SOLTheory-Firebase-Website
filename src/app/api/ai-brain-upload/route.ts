// 🔒 FROZEN — Org/Personal AI-Brain document pipeline (see .agents/AGENTS.md). Upload → extract → chunk → embed → store.
// Embeddings MUST go through embedText() (src/lib/gemini-embed.ts). `npm run build` runs scripts/guard-org-docs.mjs.
import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { embedText, EMBED_MODEL } from "@/lib/gemini-embed";
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
async function fallbackDocxExtraction(buffer: Buffer): Promise<string> {
  try {
    const JSZip = (await import("jszip")).default || (await import("jszip"));
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("text");
    if (!docXml) return "";
    // Extract text from <w:t> XML tags (Word's text runs)
    const textRuns = docXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    const extracted = textRuns.map(t => t.replace(/<[^>]+>/g, '')).join(' ');
    // Also try generic XML strip as a broader fallback
    if (extracted.length < 20) {
      return docXml
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/\s+/g, " ").trim();
    }
    return extracted;
  } catch (err: any) {
    console.error("[AI Brain Upload] Fallback DOCX extraction failed:", err.message);
    return "";
  }
}

/**
 * Extract raw text from a DOCX buffer using mammoth, with ZIP fallback.
 */
async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  // Layer 1: Try mammoth (handles well-formed DOCX)
  try {
    const mammothModule = await import("mammoth");
    const mammoth = (mammothModule as any).default || mammothModule;
    const result = await mammoth.extractRawText({ buffer });
    if (result.value && result.value.trim().length >= 20) {
      console.log(`[AI Brain Upload] mammoth extracted ${result.value.length} chars`);
      return result.value;
    }
    console.warn(`[AI Brain Upload] mammoth returned only ${result.value?.length || 0} chars, trying ZIP fallback`);
  } catch (err: any) {
    console.error("[AI Brain Upload] mammoth failed:", err.message);
  }
  // Layer 2: ZIP XML fallback
  const fallbackText = await fallbackDocxExtraction(buffer);
  if (fallbackText.length >= 20) {
    console.log(`[AI Brain Upload] ZIP fallback extracted ${fallbackText.length} chars`);
    return fallbackText;
  }
  return "";
}

/**
 * Use Gemini Vision to describe/OCR an image for searchability (with OpenRouter fallback).
 */
async function extractTextFromImage(buffer: Buffer, mimeType: string, extension: string = ""): Promise<string> {
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
  };
  let effectiveMime = mimeType;
  if (!effectiveMime || effectiveMime === "application/octet-stream" || !effectiveMime.startsWith("image/")) {
    effectiveMime = mimeMap[extension.toLowerCase()] || "image/png";
  }

  const prompt =
    "Describe this image in detail. If it contains text, extract all visible text content verbatim. " +
    "If it's a diagram or chart, describe its structure, labels, and data. " +
    "If it's a photo, describe what is shown including any notable details. " +
    "Be thorough, factual, and organized.";

  const base64 = buffer.toString("base64");
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // Primary: Google Gemini Direct with active model gemini-2.5-flash
  if (geminiApiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64,
            mimeType: effectiveMime,
          },
        },
        prompt,
      ]);

      const text = result.response.text();
      if (text && text.trim()) return text;
    } catch (err: any) {
      console.warn("[AI Brain Upload] Direct Gemini vision extraction failed, trying OpenRouter fallback:", err?.message || err);
    }
  }

  // Fallback: OpenRouter Vision (google/gemini-2.5-flash, secondary: openai/gpt-4o-mini)
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (openRouterApiKey) {
    const candidateModels = ["google/gemini-2.5-flash", "openai/gpt-4o-mini"];
    for (const modelId of candidateModels) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://soltheory.com",
            "X-Title": "SOL Theory AI Brain",
          },
          body: JSON.stringify({
            model: modelId,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${effectiveMime};base64,${base64}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 2000,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content && typeof content === "string" && content.trim()) {
            console.log(`[AI Brain Upload] OpenRouter vision fallback (${modelId}) succeeded`);
            return content;
          }
        } else {
          const errText = await res.text().catch(() => "");
          console.warn(`[AI Brain Upload] OpenRouter vision fallback (${modelId}) returned status ${res.status}:`, errText.substring(0, 200));
        }
      } catch (openRouterErr: any) {
        console.error(`[AI Brain Upload] OpenRouter vision fallback (${modelId}) failed:`, openRouterErr?.message || openRouterErr);
      }
    }
  }

  if (!geminiApiKey && !openRouterApiKey) {
    console.warn("[AI Brain Upload] Neither GEMINI_API_KEY nor OPENROUTER_API_KEY found in environment for image OCR");
    return "Uploaded image file (no text extracted - missing Gemini API key)";
  }

  return "Uploaded image file. Visual extraction notice: could not extract visual details";
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

  // Split any oversize chunk (e.g. raw PDF text with no blank-line breaks would otherwise be ONE
  // giant chunk, which dilutes retrieval and can exceed embedding input limits).
  const MAX_CHUNK = chunkSize * 3;
  const bounded: string[] = [];
  for (const c of chunks) {
    if (c.length <= MAX_CHUNK) { bounded.push(c); continue; }
    for (let i = 0; i < c.length; i += chunkSize - overlap) {
      const slice = c.substring(i, i + chunkSize).trim();
      if (slice.length > 20) bounded.push(slice);
    }
  }
  return bounded;
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
        plaintext = "";
      }

      // Fallback: If pdf2json returned empty/near-empty text (scanned or image-based PDF),
      // use Gemini Vision to OCR the PDF content.
      const cleanedLength = plaintext.replace(/\s+/g, " ").trim().length;
      if (cleanedLength < 50) {
        console.log(`[AI Brain Upload] PDF text too short (${cleanedLength} chars), falling back to Gemini Vision OCR...`);
        const pdfPrompt =
          "Extract ALL text content from this PDF document verbatim. " +
          "Preserve the original structure, headings, bullet points, and formatting as closely as possible. " +
          "If there are tables, reproduce them in a readable format. " +
          "If there are handwritten notes, transcribe them. " +
          "Be thorough — capture every piece of text visible in the document.";
        const base64 = buffer.toString("base64");

        // Primary: Direct Gemini
        try {
          const apiKey = process.env.GEMINI_API_KEY;
          if (apiKey) {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent([
              {
                inlineData: {
                  data: base64,
                  mimeType: "application/pdf",
                },
              },
              pdfPrompt,
            ]);
            const ocrText = result.response.text();
            if (ocrText && ocrText.trim().length > cleanedLength) {
              plaintext = ocrText;
              console.log(`[AI Brain Upload] Gemini Vision OCR extracted ${plaintext.length} chars from PDF`);
            }
          } else {
            console.warn("[AI Brain Upload] GEMINI_API_KEY not found; cannot OCR scanned PDF");
          }
        } catch (ocrErr: any) {
          console.warn("[AI Brain Upload] Gemini Vision OCR direct failed, trying OpenRouter:", ocrErr.message);
        }

        // Fallback: OpenRouter Vision for PDF (if direct Gemini failed or quota exceeded)
        if (plaintext.replace(/\s+/g, " ").trim().length < 50 && process.env.OPENROUTER_API_KEY) {
          try {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://soltheory.com",
                "X-Title": "SOL Theory AI Brain",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: pdfPrompt },
                      {
                        type: "image_url",
                        image_url: {
                          url: `data:application/pdf;base64,${base64}`,
                        },
                      },
                    ],
                  },
                ],
                max_tokens: 4000,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              const content = data.choices?.[0]?.message?.content;
              if (content && typeof content === "string" && content.trim().length > cleanedLength) {
                plaintext = content;
                console.log(`[AI Brain Upload] OpenRouter OCR extracted ${plaintext.length} chars from PDF`);
              }
            }
          } catch (openRouterPdfErr: any) {
            console.warn("[AI Brain Upload] OpenRouter OCR failed for PDF:", openRouterPdfErr.message);
          }
        }

        // If still empty after OCR attempt, set a descriptive placeholder
        if (plaintext.replace(/\s+/g, " ").trim().length < 50) {
          plaintext = `[PDF file: ${fileName}. Text extraction and OCR both failed to extract readable content. The PDF may be corrupted or contain only non-text elements.]`;
        }
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
        plaintext = await extractTextFromImage(buffer, mimeType, extension);
        console.log(`[AI Brain Upload] Image described: ${plaintext.length} chars`);
      } catch (err: any) {
        console.error(`[AI Brain Upload] Image description failed:`, err.message);
        plaintext = `[Image file: ${fileName}. Visual description could not be generated.]`;
      }
    } else {
      docType = extension || "unknown";
      plaintext = `[File: ${fileName}. Text extraction not supported for .${extension} files.]`;
    }

    console.log(`[AI Brain Upload] Final extraction: ${plaintext.length} chars, type=${docType}, first200="${plaintext.substring(0, 200)}"`);

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
      createdAtMs: Date.now(),
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
    let totalChunks = 0;
    let embedError: string | null = null;

    if (plaintext.length >= 20) {
      const chunks = chunkDocument(plaintext);
      totalChunks = chunks.length;

      if (chunks.length > 0) {
        try {
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            console.warn("[AI Brain Upload] GEMINI_API_KEY missing; skipping vector embedding generation");
          } else {
            console.log(`[AI Brain Upload] Generating embeddings for ${chunks.length} chunks...`);

            for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
              const batchChunks = chunks.slice(i, i + BATCH_SIZE);
              const promises = batchChunks.map(async (chunkText, batchIndex) => {
                const chunkIndex = i + batchIndex;
                const embeddingArray = await embedText(chunkText, "RETRIEVAL_DOCUMENT", apiKey);

                await db.collection(vectorCollectionPath).add({
                  docId,
                  docTitle: fileName,
                  chunkIndex,
                  text: chunkText,
                  embedding: FieldValue.vector(embeddingArray),
                  embeddingModel: EMBED_MODEL,
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
          // Non-fatal for the upload itself, but NEVER silent: recorded on the doc below as
          // vectorStatus="incomplete" + vectorError (repair with scripts/reembed-vectors.ts --apply).
          embedError = String(embedErr?.message || embedErr).slice(0, 300);
          console.error("[AI Brain Upload] Vector embedding failed (non-fatal):", embedError);
        }
      }
    }

    // ── Update document status to "ready" ────────────────────────────────
    const vectorStatus: "none" | "complete" | "incomplete" =
      totalChunks === 0 ? "none" : (chunksCreated === totalChunks && !embedError ? "complete" : "incomplete");
    await db.collection(firestoreCollectionPath).doc(docId).update({
      status: "ready",
      vectorChunkCount: chunksCreated,
      vectorStatus,
      vectorError: embedError,
    });

    return NextResponse.json({
      success: true,
      docId,
      downloadUrl,
      chunksCreated,
      vectorStatus,
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
