import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/transcribe
 * Accepts audio (webm/ogg/mp4/wav) via FormData and returns transcribed text
 * using Groq's Whisper model. This is the fallback for environments where
 * the Web Speech API doesn't work (PWAs, some mobile browsers).
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Groq's Whisper accepts: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3",
      language: "en",
      response_format: "json",
    });

    return NextResponse.json({
      text: transcription.text || "",
    });
  } catch (err: any) {
    console.error("Transcription error:", err?.message || err);
    return NextResponse.json(
      { error: "Transcription failed", details: err?.message },
      { status: 500 }
    );
  }
}
