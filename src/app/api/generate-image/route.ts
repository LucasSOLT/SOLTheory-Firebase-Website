/**
 * POST /api/generate-image
 * 
 * Generates images using Google's Nano Banana 2 (Gemini 3.1 Flash Image)
 * via OpenRouter's dedicated Images API.
 * 
 * Body: { prompt: string, orgId: string }
 * Returns: { success: true, imageBase64: string, mimeType: string } or { error: string }
 */

import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";

const MODEL_ID = "google/gemini-3.1-flash-image";

export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { prompt, orgId } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("[GenerateImage] OPENROUTER_API_KEY is not set");
      return NextResponse.json(
        { error: "Image generation is not configured. Please contact an administrator." },
        { status: 500 }
      );
    }

    console.log(`[GenerateImage] Generating image for org=${orgId} | prompt="${prompt.slice(0, 80)}..."`);

    // Use OpenRouter's dedicated Images API — NOT chat/completions
    const response = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://soltheory.com",
        "X-Title": "SOL Theory Iris",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        prompt: prompt.trim(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GenerateImage] OpenRouter error ${response.status}:`, errorText.substring(0, 500));
      return NextResponse.json(
        { error: `Image generation failed (${response.status}). Please try again.` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // OpenRouter Images API response format:
    // { data: [{ b64_json: "...", media_type: "image/png" }], usage: {...} }
    const imageData = data.data?.[0];

    if (imageData?.b64_json) {
      const mimeType = imageData.media_type || "image/png";
      console.log(`[GenerateImage] ✓ Image generated (${mimeType}, ${Math.round(imageData.b64_json.length / 1024)}KB base64)`);
      return NextResponse.json({
        success: true,
        imageBase64: imageData.b64_json,
        mimeType,
        textContent: null,
      });
    }

    // No image in response
    console.warn("[GenerateImage] No image in response:", JSON.stringify(data).substring(0, 300));
    return NextResponse.json({
      success: true,
      imageBase64: null,
      mimeType: null,
      textContent: "I wasn't able to generate that image. Please try a different description.",
    });

  } catch (error: any) {
    console.error("[GenerateImage] Error:", error.message);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
