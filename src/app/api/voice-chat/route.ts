import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";
import { logAIUsage, calculateGroqCost } from "@/lib/log-ai-usage";
import { nxtChapterKnowledge } from "@/lib/jarvis-knowledge";
import { solTheoryKnowledge } from "@/lib/soltheory-knowledge";

export async function POST(req: Request) {
  try {
    const { messages, agentId, uid, systemInstructions, knowledgeBaseText, pactText } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const isNxt = (agentId || "").includes("nxtchapter");
    const isSol = (agentId || "").includes("soltheory");

    let systemPrompt = isNxt
      ? "You are Jarvis, the AI voice assistant for NXT Chapter — a youth mentorship and community empowerment organization. You are in a live voice conversation. Keep every response to 1-3 sentences. Be direct, helpful, warm, and natural. Never use markdown, bullet points, numbered lists, or code blocks. Speak as if talking out loud to a person.\n\nCRITICAL DIRECTIVE: When asked to create, draft, or generate a document, email, spreadsheet, or similar item, do NOT output the drafted content in your chat response. Just execute the corresponding tool, and reply strictly with: 'I have generated that [insert the specific thing] for you, go take a look.'"
      : "You are Jarvis, the AI voice assistant for SOL Theory. You are in a live voice conversation. Keep every response to 1-3 sentences. Be direct, helpful, and natural. Never use markdown, bullet points, numbered lists, or code blocks. Speak as if talking out loud to a person.\n\nCRITICAL DIRECTIVE: When asked to create, draft, or generate a document, email, spreadsheet, or similar item, do NOT output the drafted content in your chat response. Just execute the corresponding tool, and reply strictly with: 'I have generated that [insert the specific thing] for you, go take a look.'";

    if (isNxt) {
      systemPrompt += "\n\n[ORGANIZATIONAL KNOWLEDGE BASE]\n" + nxtChapterKnowledge;
    }
    if (isSol) {
      systemPrompt += "\n\n[ORGANIZATIONAL KNOWLEDGE BASE]\n" + solTheoryKnowledge;
    }

    if (systemInstructions) {
      systemPrompt += "\n\n[SESSION INSTRUCTIONS]\n" + systemInstructions;
    }

    if (knowledgeBaseText && typeof knowledgeBaseText === "string" && knowledgeBaseText.trim().length > 0) {
      systemPrompt += "\n\n[EDITABLE ORGANIZATIONAL KNOWLEDGE BASE]\n" + knowledgeBaseText.substring(0, 50000);
    }

    if (pactText && typeof pactText === "string" && pactText.trim().length > 0) {
      systemPrompt += "\n\n[P.A.C.T. — PERSONALIZED USER CONTEXT]\nYou have learned the following facts about this specific user from previous conversations. RULES FOR USING THIS CONTEXT:\n1. NEVER proactively bring up, reference, or ask about any of these facts. Do NOT say things like \"How did X go?\" or \"Last time you mentioned Y.\"\n2. ONLY use this information if the user EXPLICITLY brings up the topic first in the CURRENT conversation.\n3. If the user mentions a topic that relates to a fact below, you may use it to give a more informed response.\n4. Treat this as passive background knowledge, NOT as a conversation starter or follow-up list.\n5. These facts may be outdated. Do not assume they are still current.\n\n" + pactText.substring(0, 5000);
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
      max_tokens: 150,
    });

    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = completion.usage?.total_tokens || 0;
    const voiceModel = "llama-3.1-8b-instant";
    logAIUsage({
      userId: uid || "anonymous",
      orgId: isNxt ? "nxtchapter" : "soltheory",
      model: voiceModel,
      provider: "groq",
      endpoint: "/api/voice-chat",
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd: calculateGroqCost(voiceModel, inputTokens, outputTokens),
      timestamp: new Date(),
    });

    return NextResponse.json({
      response: completion.choices[0]?.message?.content || "I couldn't process that.",
      usage: totalTokens
    });
  } catch (error: any) {
    console.error("[Voice API Error]", error?.message, error?.status, JSON.stringify(error?.error || {}));
    
    const isAuthError = error?.status === 401 || error?.message?.includes("auth") || error?.message?.includes("API key");
    const errorMsg = isAuthError
      ? "API key issue. Please check the server configuration."
      : "I had a brief connection issue. Could you try again?";
    
    return NextResponse.json(
      { response: errorMsg, error: error?.message },
      { status: 200 }
    );
  }
}
