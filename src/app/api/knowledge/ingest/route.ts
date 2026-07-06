import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";

export const maxDuration = 60; // 60 seconds

// Helper: extract text from PDF buffer using pdf2json
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFParser = require("pdf2json");
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1); // 1 = raw text mode
    pdfParser.on("pdfParser_dataError", (err: any) => reject(err));
    pdfParser.on("pdfParser_dataReady", () => {
      const raw: string = pdfParser.getRawTextContent();
      resolve(raw);
    });
    pdfParser.parseBuffer(buffer);
  });
}

export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const textContent = formData.get("textContent") as string;
    const file = formData.get("file") as File;

    let rawText = textContent || "";
    const fileType = file ? "pdf" : "text";

    // If PDF, extract text
    if (file && file.name.endsWith(".pdf")) {
      const buffer = Buffer.from(await file.arrayBuffer());
      rawText = await extractTextFromPDF(buffer);
    }

    if (!rawText.trim()) return NextResponse.json({ error: "No text could be extracted." }, { status: 400 });

    // Chunk the text into ~500 word segments
    const words = rawText.split(/\s+/);
    const CHUNK_SIZE = 500;
    const chunks: { text: string }[] = [];
    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
      const chunkText = words.slice(i, i + CHUNK_SIZE).join(" ");
      if (chunkText.trim()) {
        chunks.push({ text: chunkText });
      }
    }

    return NextResponse.json({ 
      status: "success", 
      message: `Parsed ${chunks.length} chunk(s) from document.`, 
      chunks, 
      size: rawText.length, 
      type: fileType 
    });
  } catch (error: any) {
    console.error("Ingest Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}