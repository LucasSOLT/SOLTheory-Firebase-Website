import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Use fast model for inline assists, powerful model for campaign strategy
const FAST_MODEL = "llama-3.3-70b-versatile";

interface AIRequest {
  action: "subject_lines" | "draft_body" | "rewrite" | "smart_reply" | "campaign_suggest";
  context: {
    emailBody?: string;
    emailSubject?: string;
    emailFrom?: string;
    userPrompt?: string;
    tone?: "formal" | "friendly" | "concise" | "detailed";
    campaignName?: string;
    previousSteps?: string[];
    selectedText?: string;
  };
}

const SYSTEM_PROMPTS: Record<string, string> = {
  subject_lines: `You are an expert email copywriter.
Generate exactly 3 compelling, professional email subject lines based on the email content or prompt provided.
Guidelines:
1. Each must be concise (under 60 characters), specific, and highly optimized for open rates.
2. Use active, curiosity-inducing, or benefit-driven language to maximize open rates. Avoid spam trigger words.
3. Incorporate the user's business context/voice naturally where appropriate.
4. Output Format: Return ONLY the 3 subject lines, one per line, with absolutely no numbering, bullets, quotes, prefix labels, or extra text.`,

  draft_body: `You are a highly skilled professional email copywriter and executive assistant.
Your goal is to draft a complete, compelling, and natural-sounding email body based on the user's prompt.
Strictly adhere to the following guidelines:
1. Tone: Warm, professional, direct, and engaging. Never use clichés like "Hope this email finds you well" or "I am writing to...". Get straight to the point.
2. Structure: Include a personalized greeting, a clear hook/context, 1-2 concise body paragraphs (or a clean bulleted list if appropriate for readability), and a professional sign-off.
3. User Persona Integration: Carefully read the attached user context (Knowledge Base and P.A.C.T. facts). Always write from their perspective, incorporating details about their business, services, voice, and values where relevant. Make it look like the user wrote it themselves. Use emotional intelligence.
4. No Placeholders: Do not use placeholders like [Your Name] or [Company Name]. Infer these details from the context, or omit them organically.
5. Output: Do NOT include the subject line, subject tag, or any meta-commentary (e.g. "Here is your email:"). Return ONLY the raw email body text, ready to be sent.`,

  rewrite: `You are an elite editor and copywriter.
Your task is to rewrite the provided text according to the specified tone instruction, while incorporating the user's background context and vocabulary (from the Knowledge Base/P.A.C.T. facts below) to make it sound authentic and high-quality.
Tones:
- formal: Clear, authoritative, polished, and professional.
- friendly: Warm, inviting, conversational, and personal.
- concise: High-impact, direct, removing all filler words.
- detailed: Comprehensive, adding necessary context, details, and clear explanations.
Output: Return ONLY the rewritten text, with no introduction, quotes, or meta-explanation.`,

  smart_reply: `You are an expert email assistant. Based on the incoming email provided, generate exactly 3 highly relevant, contextual smart reply suggestions.
Guidelines:
1. Write from the perspective of the user, keeping their business info and tone in mind.
2. Generate exactly 3 choices covering different response strategies:
   - Option 1 (Positive/Accept): A friendly confirmation, acceptance, or next steps.
   - Option 2 (Inquiry/Clarify): A response asking for more details, clarification, or suggesting a time to meet.
   - Option 3 (Decline/Defer): A polite refusal, redirection, or request to handle it later.
3. Each option must be a complete but concise reply (1-3 sentences) and should not include placeholders.
4. Output Format: Return ONLY the 3 replies, separated by the delimiter "---" with no numbers, labels, quotes, or extra text.`,

  campaign_suggest: `You are a marketing strategist specializing in email campaigns. Based on the campaign context provided, suggest the next best step in the sequence. Consider timing, subject lines, and engagement optimization. Return your suggestion as a brief, actionable recommendation.`,
};

export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as AIRequest & { knowledgeBaseText?: string; pactText?: string };
    const { action, context } = body;
    const kbText = (body.knowledgeBaseText || "").slice(0, 20000);
    const pactTextVal = (body.pactText || "").slice(0, 5000);

    if (!action || !SYSTEM_PROMPTS[action]) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    let userPrompt = "";

    switch (action) {
      case "subject_lines":
        userPrompt = context.emailBody
          ? `Generate subject lines for this email:\n\n${context.emailBody.slice(0, 2000)}`
          : `Generate subject lines for an email about: ${context.userPrompt || "a professional follow-up"}`;
        break;

      case "draft_body":
        userPrompt = context.userPrompt || "Write a professional follow-up email";
        if (context.tone) userPrompt += `\n\nTone: ${context.tone}`;
        if (context.emailSubject) userPrompt += `\n\nSubject: ${context.emailSubject}`;
        break;

      case "rewrite": {
        const toneMap: Record<string, string> = {
          formal: "Make this more formal and professional",
          friendly: "Make this warmer and more conversational",
          concise: "Make this shorter and more direct",
          detailed: "Expand this with more detail and context",
        };
        userPrompt = `${toneMap[context.tone || "formal"]}:\n\n${context.selectedText || context.emailBody || ""}`;
        break;
      }

      case "smart_reply":
        userPrompt = `From: ${context.emailFrom || "Unknown"}\nSubject: ${context.emailSubject || "No Subject"}\n\nEmail content:\n${(context.emailBody || "").slice(0, 3000)}`;
        break;

      case "campaign_suggest":
        userPrompt = `Campaign: ${context.campaignName || "Untitled"}\nPrevious steps:\n${(context.previousSteps || []).join("\n")}\n\nSuggest the next email in this sequence.`;
        break;
    }

    // Inject user context into system prompt
    let systemPrompt = SYSTEM_PROMPTS[action];
    if (kbText) systemPrompt += `\n\nContext about the user and their business:\n${kbText}`;
    if (pactTextVal) systemPrompt += `\n\nKnown facts about the user:\n${pactTextVal}`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: FAST_MODEL,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const rawResponse = completion.choices[0]?.message?.content || "";

    // Parse response into suggestions array
    let suggestions: string[];

    if (action === "subject_lines") {
      suggestions = rawResponse
        .split("\n")
        .map((s) => s.replace(/^\d+[\.\)]\s*/, "").replace(/^["']|["']$/g, "").trim())
        .filter((s) => s.length > 0)
        .slice(0, 3);
    } else if (action === "smart_reply") {
      suggestions = rawResponse
        .split("---")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 3);
    } else {
      suggestions = [rawResponse.trim()];
    }

    return NextResponse.json({ status: "success", suggestions });
  } catch (error: any) {
    console.error("Campaigning AI Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
