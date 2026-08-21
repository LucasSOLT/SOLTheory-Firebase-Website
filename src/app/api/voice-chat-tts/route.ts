import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";
import { logAIUsage, calculateGroqCost, calculateElevenLabsCost } from "@/lib/log-ai-usage";
import { retrieveRelevantSnippets } from "@/lib/kb-retriever";
import { retrieveSemanticChunks } from "@/lib/kb-semantic-retriever";
import { verifyRequest } from "@/lib/api-auth";
import { CRM_TOOL_DEFINITIONS, buildCrmVoicePrompt, executeCrmCreateContact, executeCrmUpdateContact, executeCrmDeleteContact, executeCrmSearchContacts, executeCrmListContactBooks, executeCrmGetAnalytics, executeCrmResolveContact, executeCrmEvaluateContacts, executeCrmBatchUpdate, CrmInstance } from "@/lib/jarvis-crm-tools";

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
    const { messages, agentId, uid, systemInstructions, knowledgeBaseText, pactText, voiceId, crmInstanceId, crmInstances } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const isNxt = (agentId || "").includes("nxtchapter");
    const isSol = (agentId || "").includes("soltheory");

    let systemPrompt = isNxt
      ? "You are JARVIS — modeled after J.A.R.V.I.S. from Iron Man. First person always. You ARE the AI the user is speaking with. Never refer to yourself in third person. You work for NXT Chapter, a 501(c)(3) nonprofit in Denver reducing recidivism. You are in a live voice conversation. Keep responses to 1-3 sentences. Be direct, warm, and natural — speak as if talking to a person. Never use markdown, bullet points, or code blocks. When asked to create documents/emails, use the tool and say 'Done, go take a look.'"
      : "You are JARVIS — modeled after J.A.R.V.I.S. from Iron Man. First person always. You ARE the AI the user is speaking with. Never refer to yourself in third person. You work for SOL Theory. You are in a live voice conversation. Keep responses to 1-3 sentences. Be direct, warm, and natural — speak as if talking to a person. Never use markdown, bullet points, or code blocks. When asked to create documents/emails, use the tool and say 'Done, go take a look.'";



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
      systemPrompt += "\n\n[USER MEMORY]\nFacts about this user from past conversations. Weave in naturally when relevant. Never interrogate about these facts.\n\n" + pactText.substring(0, 5000);
    }

    // --- CRM TOOLS CONTEXT ---
    const parsedCrmInstances: CrmInstance[] = Array.isArray(crmInstances) ? crmInstances : [{ id: "default", name: "All Contacts" }];
    const activeCrmId = crmInstanceId || "default";
    if (activeCrmId) {
      systemPrompt += buildCrmVoicePrompt(activeCrmId, parsedCrmInstances);
    }

    // Dynamic response length based on question complexity
    const isComplexVoiceQ = voiceQuery.length > 50 && (voiceQuery.includes('?') || voiceQuery.toLowerCase().match(/^(why|how|what|explain|compare|should)/));
    const voiceMaxTokens = isComplexVoiceQ ? 250 : 150;

    // ── Step 1: LLM Call (Groq) ──
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completionParams: any = {
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      model: "openai/gpt-oss-120b",
      temperature: 0.5,
      max_tokens: voiceMaxTokens,
      tools: CRM_TOOL_DEFINITIONS,
      tool_choice: "auto",
    };

    let completion = await groq.chat.completions.create(completionParams);
    let responseMessage = completion.choices[0]?.message;
    let responseText = responseMessage?.content || "";

    // Mini tool execution loop for CRM operations (max 1 iteration for voice latency)
    if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      console.log(`[VOICE CRM] Tool requested: ${functionName}`);

      let toolResult = "";
      try {
        const toolArgs = JSON.parse(toolCall.function.arguments);
        const orgId = isNxt ? "nxtchapter" : "soltheory";

        if (functionName === "crm_create_contact") {
          toolResult = await executeCrmCreateContact(orgId, activeCrmId, toolArgs, parsedCrmInstances);
        } else if (functionName === "crm_update_contact") {
          toolResult = await executeCrmUpdateContact(orgId, activeCrmId, toolArgs, parsedCrmInstances);
        } else if (functionName === "crm_delete_contact") {
          toolResult = await executeCrmDeleteContact(orgId, activeCrmId, toolArgs, parsedCrmInstances);
        } else if (functionName === "crm_search_contacts") {
          toolResult = await executeCrmSearchContacts(orgId, activeCrmId, toolArgs, parsedCrmInstances);
        } else if (functionName === "crm_list_contact_books") {
          toolResult = await executeCrmListContactBooks(orgId, activeCrmId, parsedCrmInstances);
        } else if (functionName === "crm_get_analytics") {
          toolResult = await executeCrmGetAnalytics(orgId, activeCrmId, toolArgs, parsedCrmInstances);
        } else if (functionName === "crm_resolve_contact") {
          toolResult = await executeCrmResolveContact(orgId, toolArgs, parsedCrmInstances);
        } else if (functionName === "crm_evaluate_contacts") {
          toolResult = await executeCrmEvaluateContacts(orgId, activeCrmId, toolArgs, parsedCrmInstances);
        } else if (functionName === "crm_batch_update") {
          toolResult = await executeCrmBatchUpdate(orgId, activeCrmId, toolArgs, parsedCrmInstances);
        } else {
          toolResult = JSON.stringify({ error: `Unknown CRM tool: ${functionName}` });
        }
      } catch (toolErr: any) {
        console.error(`[VOICE CRM] Tool error:`, toolErr?.message);
        toolResult = JSON.stringify({ error: `Tool failed: ${toolErr?.message}` });
      }

      // Re-call LLM with tool result for natural spoken confirmation
      const followUpMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
        responseMessage,
        { role: "tool", content: toolResult, tool_call_id: toolCall.id },
      ];

      // Track initial call usage before overwriting
      const initialInputTokens = completion.usage?.prompt_tokens || 0;
      const initialOutputTokens = completion.usage?.completion_tokens || 0;

      const followUp = await groq.chat.completions.create({
        messages: followUpMessages,
        model: "openai/gpt-oss-120b",
        temperature: 0.5,
        max_tokens: 150,
        tools: CRM_TOOL_DEFINITIONS,
      });

      responseText = followUp.choices[0]?.message?.content || "Done.";
      // Sum token usage from both calls for accurate cost tracking
      completion = followUp as any;
      if (completion.usage) {
        completion.usage.prompt_tokens = (completion.usage.prompt_tokens || 0) + initialInputTokens;
        completion.usage.completion_tokens = (completion.usage.completion_tokens || 0) + initialOutputTokens;
        completion.usage.total_tokens = (completion.usage.prompt_tokens || 0) + (completion.usage.completion_tokens || 0);
      }
    }

    if (!responseText) responseText = "I couldn't process that.";
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = completion.usage?.total_tokens || 0;

    // Log LLM usage (non-blocking)
    logAIUsage({
      userId: uid || "anonymous",
      orgId: isNxt ? "nxtchapter" : "soltheory",
      model: "openai/gpt-oss-120b",
      provider: "groq",
      endpoint: "/api/voice-chat-tts",
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd: calculateGroqCost("openai/gpt-oss-120b", inputTokens, outputTokens),
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
      { status: 500 }
    );
  }
}
