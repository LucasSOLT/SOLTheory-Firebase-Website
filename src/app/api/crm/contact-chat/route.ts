import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";

/**
 * CRM Contact Chat API — AI-powered conversational assistant for contact intelligence
 * 
 * Provider cascade: Gemini → Groq (same pattern as the enrich route)
 * Chat messages are ephemeral (client-side only) — this route is stateless.
 */

/* ─── Build system prompt with contact context ─── */
function buildSystemPrompt(contactData: any, insights: string[], activitySummary: string): string {
  return `You are Jarvis, a CRM assistant embedded in the SOL Theory platform.
You can see all data about the current contact (injected below).
You can help with: drafting emails, summarizing insights, finding information, answering questions about the contact.

When the user says 'make a note' or 'log a note' or asks you to add/create a note, respond ONLY with this exact JSON format (no other text): {"action": "add_note", "content": "...the note text..."}
When the user says 'generate insights' or 'enrich' or asks you to research this contact, respond ONLY with this exact JSON format (no other text): {"action": "generate_insights"}

For all other requests, respond naturally in plain text. Keep responses concise and professional.

--- CONTACT DATA ---
${JSON.stringify(contactData || {}, null, 2)}

--- PAST INSIGHTS ---
${Array.isArray(insights) && insights.length > 0 ? insights.join("\n---\n") : "None yet"}

--- ACTIVITY SUMMARY ---
${activitySummary || "No activity recorded yet"}
`;
}

/* ─── Gemini provider ─── */
async function chatWithGemini(contents: any[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const models = ["gemini-3.6-flash", "gemini-2.5-flash-preview-05-20"];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.warn(`[CRM Chat] Gemini ${model} error ${res.status}:`, errBody.slice(0, 200));
        continue; // Try next model
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err: any) {
      console.warn(`[CRM Chat] Gemini ${model} exception:`, err.message);
      continue;
    }
  }

  throw new Error("All Gemini models failed");
}

/* ─── Groq fallback provider ─── */
async function chatWithGroq(messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}


export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { messages, contactData, insights, activitySummary } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(contactData, insights, activitySummary);

    // ─── Try Gemini first ───
    try {
      const geminiContents = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I am Jarvis, your CRM assistant. How can I help you today?" }] },
      ];

      for (const msg of messages) {
        geminiContents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }

      const text = await chatWithGemini(geminiContents);
      return NextResponse.json({ response: text });
    } catch (geminiErr: any) {
      console.warn("[CRM Chat] Gemini cascade failed, falling back to Groq:", geminiErr.message);
    }

    // ─── Groq fallback ───
    try {
      const groqMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ];

      const text = await chatWithGroq(groqMessages);
      return NextResponse.json({ response: text });
    } catch (groqErr: any) {
      console.error("[CRM Chat] Groq fallback also failed:", groqErr.message);
      return NextResponse.json({ error: "All AI providers are currently unavailable. Please try again in a moment." }, { status: 502 });
    }

  } catch (error: any) {
    console.error("[CRM Contact Chat] Error:", error?.message || error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
