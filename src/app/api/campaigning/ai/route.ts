import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";

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
  subject_lines: `You are an expert email copywriter. Generate exactly 3 compelling, professional email subject lines based on the email content provided. Each should be concise (under 60 characters), specific, and optimized for open rates. Return ONLY the 3 subject lines, one per line, with no numbering, bullets, or extra text.`,

  draft_body: `You are a professional email writer. Draft a complete email body based on the user's prompt. Write in a warm but professional tone unless instructed otherwise. Include a greeting, body paragraphs, and a sign-off. Do NOT include the subject line. Return ONLY the email text, no meta-commentary.`,

  rewrite: `You are an expert editor. Rewrite the provided text according to the tone instruction. Maintain the core meaning but adjust the style. Return ONLY the rewritten text, nothing else.`,

  smart_reply: `You are an email assistant. Based on the email shown, generate exactly 3 short reply suggestions. Each should be a complete but brief reply (1-2 sentences) that the user might want to send. Cover different intents: one positive/agreeing, one asking for more info, one politely declining or deferring. Return ONLY the 3 replies, separated by the delimiter "---". No numbering or labels.`,

  campaign_suggest: `You are a marketing strategist specializing in email campaigns. Based on the campaign context provided, suggest the next best step in the sequence. Consider timing, subject lines, and engagement optimization. Return your suggestion as a brief, actionable recommendation.`,
};

export async function POST(req: Request) {
  try {
    const { action, context } = (await req.json()) as AIRequest;

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

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[action] },
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
