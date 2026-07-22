import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";
import { logAIUsage, calculateGroqCost, calculateElevenLabsCost } from "@/lib/log-ai-usage";
import { nxtChapterKnowledge } from "@/lib/jarvis-knowledge";
import { buildOrgContext } from "@/lib/jarvis-knowledge";
import { solTheoryKnowledge } from "@/lib/soltheory-knowledge";
import { retrieveRelevantSnippets } from "@/lib/kb-retriever";
import { retrieveSemanticChunks } from "@/lib/kb-semantic-retriever";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { verifyRequest } from "@/lib/api-auth";

/**
 * Combined Voice Chat + TTS endpoint.
 * Performs LLM inference AND ElevenLabs TTS server-side in one round-trip,
 * eliminating the extra client→server hop for TTS.
 * Returns: { response: string, audioBase64: string, usage: number, pactFacts: any[] }
 */
export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;
  try {
    const { messages, agentId, uid, systemInstructions, knowledgeBaseText, pactText, voiceId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const isNxt = (agentId || "").includes("nxtchapter");
    const isSol = (agentId || "").includes("soltheory");

    let systemPrompt = isNxt
      ? "You are Jarvis, the AI voice assistant for NXT Chapter — a youth mentorship and community empowerment organization. You are in a live voice conversation. Keep every response to 1-3 sentences. Be direct, helpful, warm, and natural. Never use markdown, bullet points, numbered lists, or code blocks. Speak as if talking out loud to a person.\n\nCRITICAL DIRECTIVE: When asked to create, draft, or generate a document, email, spreadsheet, or similar item, do NOT output the drafted content in your chat response. Just execute the corresponding tool, and reply strictly with: 'I have generated that [insert the specific thing] for you, go take a look.'"
      : "You are Jarvis, the AI voice assistant for SOL Theory. You are in a live voice conversation. Keep every response to 1-3 sentences. Be direct, helpful, and natural. Never use markdown, bullet points, numbered lists, or code blocks. Speak as if talking out loud to a person.\n\nCRITICAL DIRECTIVE: When asked to create, draft, or generate a document, email, spreadsheet, or similar item, do NOT output the drafted content in your chat response. Just execute the corresponding tool, and reply strictly with: 'I have generated that [insert the specific thing] for you, go take a look.'";

    if (isNxt) systemPrompt += "\n\n[ORGANIZATIONAL KNOWLEDGE BASE]\n" + nxtChapterKnowledge;
    if (isSol) systemPrompt += "\n\n[ORGANIZATIONAL KNOWLEDGE BASE]\n" + solTheoryKnowledge;

    // Inject dynamic org profile context
    try {
      await initAdmin();
      const adminDb = getAdminFirestore();
      const orgId = isNxt ? "nxtchapter" : "soltheory";
      const orgSnap = await adminDb.collection("org_profiles").doc(orgId).get();
      if (orgSnap.exists) {
        const orgContext = buildOrgContext(orgSnap.data() as any, orgId);
        if (orgContext) systemPrompt += "\n\n[DYNAMIC ORG PROFILE]\n" + orgContext;
      }
    } catch (e) {
      console.warn("[voice-chat-tts] Could not load org profile:", e);
    }

    if (systemInstructions) systemPrompt += "\n\n[SESSION INSTRUCTIONS]\n" + systemInstructions;

    if (knowledgeBaseText && typeof knowledgeBaseText === "string" && knowledgeBaseText.trim().length > 0) {
      systemPrompt += "\n\n[EDITABLE ORGANIZATIONAL KNOWLEDGE BASE]\n" + knowledgeBaseText.substring(0, 15000);
    }

    // --- SEMANTIC KB RETRIEVAL FOR VOICE ---
    // Pull the most relevant document chunks for the user's voice query
    const lastUserMsgForKB = messages.filter((m: any) => m.role === "user").pop();
    const voiceQuery = lastUserMsgForKB?.content || "";
    try {
      if (uid && agentId && voiceQuery.trim().length > 3) {
        const semanticChunks = await retrieveSemanticChunks(voiceQuery, {
          uid,
          agentId: (agentId || "").replace("soltheory_", "").replace("nxtchapter_", ""),
          orgId: isNxt ? "nxtchapter" : "soltheory",
          knowledgeBaseText: knowledgeBaseText || "",
          maxResults: 4, // Fewer chunks for voice (shorter context window)
        });
        const docChunks = semanticChunks.filter(c => c.type === "document" || c.type === "text_entry");
        if (docChunks.length > 0) {
          const kbContext = docChunks.map(c => `[${c.source}]: ${c.text}`).join("\n\n");
          systemPrompt += `\n\n[KNOWLEDGE BASE — Relevant to current question]\nUse this information to answer authoritatively. Present facts confidently.\n${kbContext.substring(0, 8000)}`;
        }
      }
    } catch (kbErr) {
      console.warn("[voice-chat-tts] KB retrieval failed (non-fatal):", (kbErr as any)?.message);
    }

    if (pactText && typeof pactText === "string" && pactText.trim().length > 0) {
      systemPrompt += "\n\n[ACTIVE MEMORY — User Context]\nYou remember these facts about the user. WEAVE THEM IN naturally when relevant — don't interrogate, but do personalize. Example: If they mention travel and you know their city, reference it naturally.\n\n" + pactText.substring(0, 6000);
    }

    // Dynamic response length based on question complexity
    const isComplexVoiceQ = voiceQuery.length > 50 && (voiceQuery.includes('?') || voiceQuery.toLowerCase().match(/^(why|how|what|explain|compare|should)/));
    const voiceMaxTokens = isComplexVoiceQ ? 250 : 150;

    // ── Step 1: LLM Call (Groq) ──
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
      max_tokens: voiceMaxTokens,
    });

    const responseText = completion.choices[0]?.message?.content || "I couldn't process that.";
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = completion.usage?.total_tokens || 0;

    // Log LLM usage (non-blocking)
    logAIUsage({
      userId: uid || "anonymous",
      orgId: isNxt ? "nxtchapter" : "soltheory",
      model: "llama-3.1-8b-instant",
      provider: "groq",
      endpoint: "/api/voice-chat-tts",
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd: calculateGroqCost("llama-3.1-8b-instant", inputTokens, outputTokens),
      timestamp: new Date(),
    });

    // ── Step 2: TTS Call (ElevenLabs) — immediately, no extra round-trip ──
    const ttsVoiceId = voiceId || "mZ8K1MPRiT5wDQaasg3i";
    const ttsApiKey = process.env.ELEVENLABS_API_KEY || "";

    const cleanText = responseText.replace(/<[^>]*>/g, ""); // Strip XML/HTML

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ttsVoiceId}/stream?optimize_streaming_latency=4&output_format=mp3_22050_32`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ttsApiKey,
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    // Retrieve citations from the knowledge base for the user's latest message
    const lastUserMsg = messages.filter((m: any) => m.role === "user").pop();
    const citations = lastUserMsg
      ? retrieveRelevantSnippets(lastUserMsg.content || "", {
          pactText: pactText || "",
          knowledgeBaseText: knowledgeBaseText || "",
        })
      : [];

    if (!ttsResponse.ok) {
      // TTS failed — return text-only response so the client can still display it
      console.error("[voice-chat-tts] TTS failed:", ttsResponse.status);
      return NextResponse.json({
        response: responseText,
        audioBase64: null,
        usage: totalTokens,
        pactFacts: [],
        citations: citations.length > 0 ? citations : undefined,
      });
    }

    // Buffer TTS audio and encode as base64 for single-payload delivery
    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    // Log TTS usage (non-blocking)
    logAIUsage({
      userId: uid || "anonymous",
      orgId: isNxt ? "nxtchapter" : "soltheory",
      model: "eleven_turbo_v2_5",
      provider: "elevenlabs",
      endpoint: "/api/voice-chat-tts",
      characters: cleanText.length,
      costUsd: calculateElevenLabsCost(cleanText.length),
      timestamp: new Date(),
    });

    return NextResponse.json({
      response: responseText,
      audioBase64,
      usage: totalTokens,
      pactFacts: [],
      citations: citations.length > 0 ? citations : undefined,
    });
  } catch (error: any) {
    console.error("[voice-chat-tts Error]", error?.message);
    return NextResponse.json(
      { response: "I had a brief connection issue. Could you try again?", audioBase64: null, error: error?.message },
      { status: 200 }
    );
  }
}
