/**
 * Diagnostic endpoint to test OpenRouter connectivity.
 * Deploy and hit GET /api/test-openrouter to see the exact response.
 * DELETE THIS FILE after debugging is complete.
 */
import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.OPENROUTER_API_KEY;
  const keyInfo = key
    ? `SET (${key.length} chars, starts: ${key.substring(0, 12)}..., ends: ...${key.substring(key.length - 4)})`
    : "MISSING";
  const trimmedSame = key ? key === key.trim() : "N/A";

  // Test with a known-cheap, always-available model first
  const testModels = [
    "google/gemini-2.5-flash",       // Cheap, always available
    "google/gemini-3.5-flash",       // The one we use in registry
    "anthropic/claude-opus-5",       // Premium — may or may not exist
  ];

  const results: Record<string, unknown> = { keyInfo, trimmedSame, timestamp: new Date().toISOString() };

  for (const model of testModels) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://soltheory.com",
          "X-Title": "SOL Theory OpenRouter Test",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Say hi" }],
          max_tokens: 10,
        }),
      });

      const status = response.status;
      const body = await response.text();
      results[model] = { status, body: body.substring(0, 500) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results[model] = { error: message };
    }
  }

  // Also test auth endpoint to verify API key validity
  try {
    const authCheck = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { "Authorization": `Bearer ${key}` },
    });
    const authBody = await authCheck.text();
    results["auth_check"] = { status: authCheck.status, body: authBody.substring(0, 500) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    results["auth_check"] = { error: message };
  }

  return NextResponse.json(results);
}
