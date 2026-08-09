import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";
import { logAIUsage, calculateGroqCost } from "@/lib/log-ai-usage";

import { verifyRequest } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { messages, agentId, uid, systemInstructions, knowledgeBaseText, pactText } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const isNxt = (agentId || "").includes("nxtchapter");
    const isSol = (agentId || "").includes("soltheory");

    let systemPrompt = isNxt
      ? "You are JARVIS — modeled after J.A.R.V.I.S. from Iron Man. First person always. You ARE the AI the user is speaking with. Never refer to yourself in third person. You work for NXT Chapter, a 501(c)(3) nonprofit in Denver reducing recidivism. You are in a live voice conversation. Keep responses to 1-3 sentences. Be direct, warm, and natural — speak as if talking to a person. Never use markdown, bullet points, or code blocks. When asked to create documents/emails, use the tool and say 'Done, go take a look.'"
      : "You are JARVIS — modeled after J.A.R.V.I.S. from Iron Man. First person always. You ARE the AI the user is speaking with. Never refer to yourself in third person. You work for SOL Theory. You are in a live voice conversation. Keep responses to 1-3 sentences. Be direct, warm, and natural — speak as if talking to a person. Never use markdown, bullet points, or code blocks. When asked to create documents/emails, use the tool and say 'Done, go take a look.'";

    if (systemInstructions) {
      systemPrompt += "\n\n[SESSION INSTRUCTIONS]\n" + systemInstructions;
    }



    if (knowledgeBaseText && typeof knowledgeBaseText === "string" && knowledgeBaseText.trim().length > 0) {
      systemPrompt += "\n\n[EDITABLE ORGANIZATIONAL KNOWLEDGE BASE]\n" + knowledgeBaseText.substring(0, 50000);
    }

    if (pactText && typeof pactText === "string" && pactText.trim().length > 0) {
      systemPrompt += "\n\n[USER MEMORY]\nFacts about this user from past conversations. Weave in naturally when relevant. Never interrogate about these facts.\n\n" + pactText.substring(0, 5000);
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
      { status: isAuthError ? 401 : 500 }
    );
  }
}
