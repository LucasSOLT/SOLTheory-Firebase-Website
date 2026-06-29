import { NextResponse } from "next/server";
import { ai } from "@/ai/genkit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InstagramAIRequest {
  action?: "describe" | "enhance";
  mediaUrls: string[];
  campaignGoal: string;
  tone: string;
  additionalContext?: string;
}

interface InstagramAIResponse {
  captions: {
    optionA: string;
    optionB: string;
  };
  hashtags: string[];
  insights: string;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert Instagram content strategist and creative copywriter working for a professional social media agency.

Your job is to analyze visual media (images/videos) and generate highly engaging, platform-optimised Instagram post content.

RULES:
- Captions MUST be under 2,200 characters (Instagram's limit).
- Hashtags MUST be no more than 15 total. Mix popular high-reach tags with niche, targeted ones.
- Analyse the visual content: colours, subjects, mood, setting, branding elements.
- Tailor the tone, vocabulary, and emoji usage to the requested tone.
- Insights should be specific, actionable, and reference what you SEE in the media.

You MUST respond with ONLY valid JSON in exactly this structure (no markdown, no backticks, no commentary outside the JSON):
{
  "captions": {
    "optionA": "Creative and engaging caption here (longer, storytelling-style)",
    "optionB": "Short and direct caption here (punchy, under 60 words)"
  },
  "hashtags": ["#hashtag1", "#hashtag2", "...up to 15"],
  "insights": "Your optimization insights here (posting time, visual notes, audience tips)"
}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the user prompt parts array for Genkit multimodal input.
 * Each media URL becomes a `{ media: { url } }` part, followed by a
 * text prompt summarising the campaign context.
 */
function buildPromptParts(req: InstagramAIRequest) {
  const parts: Array<{ media: { url: string } } | { text: string }> = [];

  // Attach each media URL as a multimodal media part
  for (const url of req.mediaUrls) {
    parts.push({ media: { url } });
  }

  // Build the text instruction
  const lines: string[] = [
    `Analyse the ${req.mediaUrls.length} media asset(s) provided above.`,
    "",
    `Campaign Goal: ${req.campaignGoal}`,
    `Desired Tone: ${req.tone}`,
  ];

  if (req.additionalContext?.trim()) {
    lines.push(`Additional Context from User: ${req.additionalContext.trim()}`);
  }

  lines.push(
    "",
    "Generate the JSON response with two caption options, up to 15 hashtags, and visual optimization insights."
  );

  parts.push({ text: lines.join("\n") });

  return parts;
}

/**
 * Attempt to extract valid JSON from the model's response text.
 * Handles cases where the model wraps JSON in markdown code fences.
 */
function parseAIResponse(raw: string): InstagramAIResponse {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?\s*```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Validate required fields
  if (!parsed.captions?.optionA || !parsed.captions?.optionB) {
    throw new Error("Response missing required caption fields");
  }
  if (!Array.isArray(parsed.hashtags)) {
    throw new Error("Response missing hashtags array");
  }

  return {
    captions: {
      optionA: String(parsed.captions.optionA),
      optionB: String(parsed.captions.optionB),
    },
    hashtags: parsed.hashtags.map(String).slice(0, 15),
    insights: String(parsed.insights || ""),
  };
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    // ── Authenticate ────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      const { initAdmin } = await import('@/firebase/admin');
      const { getAuth } = await import('firebase-admin/auth');
      initAdmin();
      await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // ── Parse & validate request ────────────────────────────────────────
    const body = (await req.json()) as Partial<InstagramAIRequest>;

    if (!body.mediaUrls || !Array.isArray(body.mediaUrls) || body.mediaUrls.length === 0) {
      return NextResponse.json(
        { error: "mediaUrls is required and must be a non-empty array." },
        { status: 400 }
      );
    }

    if (body.mediaUrls.length > 10) {
      return NextResponse.json(
        { error: "Instagram supports a maximum of 10 media items per post." },
        { status: 400 }
      );
    }

    if (!body.campaignGoal || typeof body.campaignGoal !== "string") {
      return NextResponse.json(
        { error: "campaignGoal is required." },
        { status: 400 }
      );
    }

    if (!body.tone || typeof body.tone !== "string") {
      return NextResponse.json(
        { error: "tone is required." },
        { status: 400 }
      );
    }

    const request: InstagramAIRequest = {
      mediaUrls: body.mediaUrls,
      campaignGoal: body.campaignGoal,
      tone: body.tone,
      additionalContext: body.additionalContext || "",
    };

    // ── Check for streaming request ─────────────────────────────────────
    const acceptsStream = req.headers.get("accept")?.includes("text/event-stream");

    if (acceptsStream) {
      // ── Streaming response ──────────────────────────────────────────
      const { stream, response } = ai.generateStream({
        system: SYSTEM_PROMPT,
        prompt: buildPromptParts(request),
        config: { temperature: 0.8, maxOutputTokens: 2048 },
      });

      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Stream partial text chunks
            for await (const chunk of stream) {
              const text = chunk.text;
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`)
                );
              }
            }

            // Send the final parsed result
            const final = await response;
            const parsed = parseAIResponse(final.text);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "result", ...parsed })}\n\n`)
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (err) {
            const message = err instanceof Error ? err.message : "Stream error";
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // ── Standard (non-streaming) response ─────────────────────────────
    const result = await ai.generate({
      system: SYSTEM_PROMPT,
      prompt: buildPromptParts(request),
      config: { temperature: 0.8, maxOutputTokens: 2048 },
    });

    const parsed = parseAIResponse(result.text);

    return NextResponse.json({
      status: "success",
      ...parsed,
    });
  } catch (error: unknown) {
    console.error("[Instagram AI] Error:", error);

    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    const statusCode =
      error instanceof SyntaxError ? 422 : 500;

    return NextResponse.json(
      { error: message },
      { status: statusCode }
    );
  }
}
