import { NextResponse } from "next/server";
import { logAIUsage, calculateElevenLabsCost } from "@/lib/log-ai-usage";
import { verifyRequest } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text");
    const uid = searchParams.get("uid") || "anonymous";
    const org = searchParams.get("org") || "soltheory";

    if (!text) {
      return NextResponse.json({ error: "Text required" }, { status: 400 });
    }

    const voice = searchParams.get("voice");
    const voiceId = voice || "mZ8K1MPRiT5wDQaasg3i"; // Default: Jarvis (British male)
    const apiKey = "sk_c75325e8b9cfb1e4f2b73ad59419653c2ca59013f889267c";

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=4&output_format=mp3_22050_32`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5", // Extreme ultra-low latency model
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[ElevenLabs Error]", err);
      return NextResponse.json({ error: "Voice generation failed" }, { status: response.status });
    }

    // Stream the raw response directly from ElevenLabs without buffering it into memory
    const charCount = text.length;
    logAIUsage({
      userId: uid,
      orgId: org,
      model: "eleven_turbo_v2_5",
      provider: "elevenlabs",
      endpoint: "/api/tts",
      characters: charCount,
      costUsd: calculateElevenLabsCost(charCount),
      timestamp: new Date(),
    });

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      }
    });

  } catch (error: any) {
    console.error("[TTS API Error]", error?.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
