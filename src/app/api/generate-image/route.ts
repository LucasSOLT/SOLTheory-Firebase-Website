/**
 * POST /api/generate-image
 * 
 * Generates images using Google's Nano Banana 2 (Gemini 3.1 Flash Image)
 * via OpenRouter. Returns base64-encoded image data.
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

    // Call OpenRouter with the Gemini image model
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://soltheory.com",
        "X-Title": "SOL Theory Iris",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        // Request image output
        modalities: ["text", "image"],
        temperature: 1.0,
        max_tokens: 4096,
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
    const message = data.choices?.[0]?.message;

    if (!message) {
      console.error("[GenerateImage] No message in response:", JSON.stringify(data).substring(0, 500));
      return NextResponse.json({ error: "No response from image model" }, { status: 500 });
    }

    // Extract image from multimodal content parts
    // Gemini image models return content as an array of parts: [{type: "text", ...}, {type: "image_url", image_url: {url: "data:..."}}]
    // Or as inline_data in the content array
    let imageBase64 = "";
    let mimeType = "image/png";
    let textContent = "";

    if (Array.isArray(message.content)) {
      // Multimodal response — array of content parts
      for (const part of message.content) {
        if (part.type === "image_url" && part.image_url?.url) {
          // Format: data:image/png;base64,<data>
          const dataUrl = part.image_url.url;
          if (dataUrl.startsWith("data:")) {
            const [header, base64Data] = dataUrl.split(",");
            const mimeMatch = header.match(/data:(.*?);/);
            if (mimeMatch) mimeType = mimeMatch[1];
            imageBase64 = base64Data;
          } else {
            imageBase64 = dataUrl;
          }
        } else if (part.type === "text" && part.text) {
          textContent += part.text;
        }
      }
    } else if (typeof message.content === "string") {
      // Plain text response — model may have declined to generate an image
      textContent = message.content;
    }

    if (imageBase64) {
      console.log(`[GenerateImage] ✓ Image generated (${mimeType}, ${Math.round(imageBase64.length / 1024)}KB base64)`);
      return NextResponse.json({
        success: true,
        imageBase64,
        mimeType,
        textContent: textContent || null,
      });
    }

    // No image in response — return text content as fallback
    console.warn("[GenerateImage] No image in response, returning text only");
    return NextResponse.json({
      success: true,
      imageBase64: null,
      mimeType: null,
      textContent: textContent || "I wasn't able to generate that image. Please try a different description.",
    });

  } catch (error: any) {
    console.error("[GenerateImage] Error:", error.message);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
