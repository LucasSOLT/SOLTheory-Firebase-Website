import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text");

    if (!text) {
      return NextResponse.json({ error: "Text required" }, { status: 400 });
    }

    const voiceId = "mZ8K1MPRiT5wDQaasg3i";
    const apiKey = "sk_c75325e8b9cfb1e4f2b73ad59419653c2ca59013f889267c";

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
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
