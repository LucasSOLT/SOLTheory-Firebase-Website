import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { verifyRequest, verifyOrgMember } from "@/lib/api-auth";

import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { nxtChapterKnowledge, buildOrgContext } from "@/lib/jarvis-knowledge";
import { solTheoryKnowledge } from "@/lib/soltheory-knowledge";
import { logAIUsage, calculateGroqCost } from "@/lib/log-ai-usage";
import { extractPACTFacts } from "@/lib/pact-extractor";
import { retrieveRelevantSnippets } from "@/lib/kb-retriever";
import { retrieveSemanticChunks } from "@/lib/kb-semantic-retriever";
import { createStreamingCompletion, createCompletion, autoSelectModel, MODEL_REGISTRY, getModelConfig, calculateCost } from "@/lib/llm-router";
import { CRM_TOOL_DEFINITIONS, buildCrmSystemPrompt, executeCrmCreateContact, executeCrmUpdateContact, executeCrmDeleteContact, executeCrmSearchContacts, executeCrmListContactBooks, executeCrmGetAnalytics, executeCrmResolveContact, executeCrmEvaluateContacts, executeCrmBatchUpdate, CrmInstance } from "@/lib/jarvis-crm-tools";
import { routeIntent, type JarvisDomain } from "@/lib/jarvis-router";
import { filterToolsForDomain, getDomainPrompt } from "@/lib/jarvis-agents";
import { orchestrateMultiStep } from "@/lib/jarvis-orchestrator";
import type { AgentEvent } from "@/lib/agent-events";
const tools: any = [
  {
    type: "function",
    function: {
      name: "search_emails",
      description: "Search Gmail. Returns messageId, from, subject, snippet. Use before deleting to find the messageId.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_email",
      description: "Permanently trash an email by its messageId.",
      parameters: {
        type: "object",
        properties: { messageId: { type: "string" } },
        required: ["messageId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_folder",
      description: "Create a new folder (Label) in the user's Gmail.",
      parameters: {
        type: "object",
        properties: { folderName: { type: "string" } },
        required: ["folderName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "block_sender",
      description: "Block a sender by creating a strict Gmail filter that routes their emails directly to the trash.",
      parameters: {
        type: "object",
        properties: { senderEmail: { type: "string" } },
        required: ["senderEmail"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "draft_outbound_email",
      description: "Draft an email into Gmail Drafts. Set includeGoogleMeetLink=true to auto-attach a Google Meet link.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Email body. Format: 'Hello [Name],\\n\\n[Body]\\n\\nThanks,\\n[Sender]'. Use \\n for line breaks." },
          includeGoogleMeetLink: { type: "boolean", description: "True to auto-generate a Google Meet link." },
          meetingSummary: { type: "string", description: "Calendar event title. Required with Meet link." },
          meetingDateTime: { type: "string", description: "ISO 8601 datetime. Required with Meet link." }
        },
        required: ["to", "subject", "body"]
      }
    }
  },

  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description: "List Google Calendar events in a date range. Defaults to next 7 days.",
      parameters: {
        type: "object",
        properties: {
          timeMin: { type: "string", description: "Start of search window, ISO string, e.g., 2026-04-10T00:00:00-06:00" },
          timeMax: { type: "string", description: "End of search window, ISO string, e.g., 2026-04-17T23:59:59-06:00" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a new event on the user's Google Calendar. If the user says 'schedule a meeting at 4pm today', compute the correct ISO times for the user.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Title of the event, e.g., 'Meeting with John Smith'" },
          description: { type: "string", description: "Optional longer description or notes for the event" },
          startDateTime: { type: "string", description: "ISO 8601 with timezone, e.g., 2026-04-10T16:00:00-06:00" },
          endDateTime: { type: "string", description: "ISO 8601 with timezone, e.g., 2026-04-10T17:00:00-06:00" },
          addGoogleMeetLink: { type: "boolean", description: "Set to true if the event requires a Google Meet virtual video conference link." }
        },
        required: ["summary", "startDateTime", "endDateTime"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_calendar_event",
      description: "Delete/cancel a specific calendar event by its eventId. Use list_calendar_events first to find the event ID.",
      parameters: {
        type: "object",
        properties: {
          eventId: { type: "string", description: "The Google Calendar event ID" }
        },
        required: ["eventId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_calendar_event",
      description: "Update/reschedule an existing calendar event. Use list_calendar_events first to find the event ID. Only provide fields you want to change.",
      parameters: {
        type: "object",
        properties: {
          eventId: { type: "string", description: "The Google Calendar event ID" },
          summary: { type: "string", description: "New title for the event" },
          description: { type: "string", description: "New description" },
          startDateTime: { type: "string", description: "New start time, ISO 8601" },
          endDateTime: { type: "string", description: "New end time, ISO 8601" }
        },
        required: ["eventId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_google_document",
      description: "Create a Google Doc. Write full content — never truncate.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The title/name of the Google Doc" },
          body: { type: "string", description: "Full text. Use \\n for paragraphs, '## ' for headings." },
          font: { type: "string", description: "The font family to apply (e.g. 'Arial', 'Times New Roman', 'Georgia'). If not specified, defaults to 'Arial'." },
          lineSpacing: { type: "string", enum: ["single", "double"], description: "Line spacing: 'single' (1.0) or 'double' (2.0). Defaults to 'double'." }
        },
        required: ["title", "body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_google_document",
      description: "Replace content in an existing Google Doc by documentId. Write full content.",
      parameters: {
        type: "object",
        properties: {
          documentId: { type: "string", description: "The Google Docs document ID (from the URL or from a prior create_google_document result)" },
          body: { type: "string", description: "Full replacement text. Use \\n for paragraphs, '## ' for headings." },
          font: { type: "string", description: "The font family to apply (e.g. 'Arial', 'Times New Roman', 'Georgia'). Defaults to 'Arial'." },
          lineSpacing: { type: "string", enum: ["single", "double"], description: "Line spacing: 'single' (1.0) or 'double' (2.0). Defaults to 'double'." }
        },
        required: ["documentId", "body"]
      }
    }
  },
  // ── Google Slides (REMOVED — pruned to reduce token overhead) ──
  {
    type: "function",
    function: {
      name: "create_google_sheet",
      description: "Create a Google Sheets spreadsheet with optional headers and rows.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Spreadsheet title" },
          headers: { type: "array", description: "Column headers", items: { type: "string" } },
          rows: { type: "array", description: "Rows of cell values", items: { type: "array", items: { type: "string" } } }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_google_drive",
      description: "Search Google Drive for files by keyword.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search keyword" } },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_drive_document",
      description: "Read a Google Doc's text content. Use search_google_drive first to get the fileId.",
      parameters: {
        type: "object",
        properties: { fileId: { type: "string" } },
        required: ["fileId"]
      }
    }
  },
  // ── YouTube (REMOVED — pruned to reduce token overhead) ──
  // ── Surveys (REMOVED — pruned to reduce token overhead) ──
  {
    type: "function",
    function: {
      name: "search_past_conversations",
      description: "Search past chat sessions for context. Use when user references a prior conversation.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for real-time info, current events, or facts you're unsure about.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query to look up on the web" }
        },
        required: ["query"]
      }
    }
  },
  // ── Grant Agent Management Tools (REMOVED — pruned to reduce token overhead) ──
  // ── CRM / Contacts Tools ──
  ...CRM_TOOL_DEFINITIONS,
];

// Increase serverless function timeout for multi-step orchestration with premium models
export const maxDuration = 60; // seconds (Pro plan supports up to 300s)

export async function POST(req: Request) {
  // Clone request for body reading before auth (verifyOrgMember also reads headers)
  const body = await req.json();
  const { messages, agentId: rawAgentId, soul, brain, uid, refreshToken, contacts, knowledgeBaseText, videoUrl, pactText, userName, model: requestedModel, orgBrainText, stream: wantStream, crmData, crmInstanceId, crmInstances } = body;

  // Determine org from agentId prefix and enforce org membership
  const requestOrg = (rawAgentId || "").includes("nxtchapter") ? "nxtchapter"
    : (rawAgentId || "").includes("soltheory") ? "soltheory"
    : null;

  if (requestOrg) {
    const auth = await verifyOrgMember(req, requestOrg);
    if (!auth.ok) return auth.response;
  } else {
    // Fallback: at minimum verify the user is authenticated
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;
  }

  try {
    // Validate model against registry, default to llama-3.3-70b
    const ALLOWED_MODELS = [...Object.keys(MODEL_REGISTRY), 'auto'];
    let selectedModel = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : 'llama-3.3-70b-versatile';
    console.log(`[MODEL] Requested: "${requestedModel}" → Using: "${selectedModel}" | Stream: ${wantStream}`);

    // Parse out scope prefixes for logic, but keep raw for database
    const agentId = (rawAgentId || "").replace("soltheory_", "").replace("nxtchapter_", "");

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const isNxtChapter = (rawAgentId || "").includes("nxtchapter");
    const isSolTheory = (rawAgentId || "").includes("soltheory");
    const orgId = isNxtChapter ? "nxtchapter" : "soltheory";

    // Read org profile from Firestore for dynamic context
    let orgProfileData: any = null;
    // Kick off org profile fetch early — but SKIP if no admin credentials (Vercel)
    const orgProfilePromise = process.env.FIREBASE_SERVICE_ACCOUNT ? (async () => {
      try {
        await initAdmin();
        const adminDb = getAdminFirestore();
        const orgProfileDoc = await adminDb.collection('org_profiles').doc(orgId).get();
        if (orgProfileDoc.exists) return orgProfileDoc.data();
      } catch (e) {
        console.warn('[chat] Could not load org profile:', e);
      }
      return null;
    })() : Promise.resolve(null);

    let agentRole = "";
    const orgName = isNxtChapter ? "NXT Chapter (Next Chapter Foundation Inc.)" : "SOL Theory";
    const orgDesc = isNxtChapter
      ? "A 501(c)(3) nonprofit in Denver, CO dedicated to reducing recidivism and helping formerly incarcerated individuals reintegrate into society."
      : "The Etsy of Self Improvement — a social innovation firm building AI-powered tools for organizations.";

    switch (agentId) {
      case "jarvis":
        agentRole = `You are JARVIS — modeled after J.A.R.V.I.S. from Iron Man. First person always. You ARE the AI the user is speaking with — never refer to yourself in third person, never say "Jarvis can..." when you mean "I can...", never describe yourself as "the AI" or "a tool."

Personality: Chief of staff poise. Dry British wit — earned, never forced. Confident, never arrogant. Direct and honest. You deliver results, you don't describe capabilities. Match the user's energy — concise for quick questions, deep for brainstorming.

ABSOLUTE RULES:
- NEVER give meta-commentary ("Based on the conversation history...", "It appears that you are trying to..."). Just ANSWER directly.
- NEVER start responses with summaries of what was discussed. Lead with the actual answer.
- When using tools, be confident: "Done — drafted that email" not "I have attempted to draft an email for you."
- When creating docs/emails/sheets, ALWAYS use the tool — never dump content as chat text.
- Respond in natural markdown text. NEVER output raw JSON, HTML tags, or code blocks in conversational responses.
- Use **bold** for emphasis, bullet points for lists, short paragraphs for readability.

You work for ${orgName}. ${orgDesc}
The current date/time is: ${new Date().toISOString()}.`;
        break;
      case "youtube_director":
        agentRole = "You are the YouTube Creative Director AI agent. Use the draft_youtube_video tool to push drafts to YouTube Studio. Ask clarifying questions before drafting. Confirm when the draft has been pushed.";
        break;
      default:
        agentRole = `You are a helpful AI assistant for ${orgName}. ${orgDesc}`;
        break;
    }

    if (isNxtChapter) {
      agentRole += `\n\nTERM MAPPING: "next chapter"/"nxt chapter" = this nonprofit org. "S.E.E.D." = NXT Chapter's 8-week mental health curriculum. "Josephine"/"Josie" = Josephine Burton, President & Executive Director. "Marquell" = Marquell Burton, Co-Founder & CFO.`;
    }

    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      agentRole += `\n\n[CONTACTS]\nLook up email/phone here when emailing or texting someone by name.\n`;
      contacts.forEach(c => {
        if (!c.ignore) {
          let line = `- ${c.aliases} => ${c.email}`;
          if (c.phone) line += ` | ${c.phone}`;
          agentRole += line + '\n';
        }
      });
    }

    // Gmail Auth Hook Configuration
    const isEmailAgent = agentId === "jarvis" || agentId === "drive_assistant" || agentId === "calendar_assistant" || agentId.includes("youtube_director");

    if (isEmailAgent) {
      agentRole += `\n\nYou have active tools for: Gmail, Google Calendar, Google Docs, Google Sheets, Google Drive, Web Search, CRM, and Past Conversation Memory. Use them when relevant — the domain router will load the right tools automatically. Use search_past_conversations when the user references prior chats.`;
    }


    let gmail: any = null;
    let calendar: any = null;
    let docsApi: any = null;
    let slidesApi: any = null;
    let sheetsApi: any = null;
    let driveApi: any = null;
    let youtubeApi: any = null;

    if (isEmailAgent && refreshToken) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      docsApi = google.docs({ version: 'v1', auth: oauth2Client });
      slidesApi = google.slides({ version: 'v1', auth: oauth2Client });
      sheetsApi = google.sheets({ version: 'v4', auth: oauth2Client });
      driveApi = google.drive({ version: 'v3', auth: oauth2Client });
      youtubeApi = google.youtube({ version: 'v3', auth: oauth2Client });
    }


    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Unified completion function that routes to correct provider (Groq or OpenRouter)
    // The selected model handles EVERYTHING — including tool calls.
    const createCompletionWithRetry = async (messagesArray: any[], useTools: boolean, maxRetries = 2) => {
      let attempts = 0;
      const modelConfig = getModelConfig(selectedModel);
      console.log(`[COMPLETION] Using model: ${selectedModel} | Provider: ${modelConfig?.provider || 'groq'} | Tools: ${useTools}`);

      while (attempts < maxRetries) {
        try {
          // Dynamic max_tokens based on query complexity
          const lastMsg = messagesArray.filter((m: any) => m.role === 'user').pop();
          const queryLen = (lastMsg?.content || '').length;
          const isToolQuery = useTools && (lastMsg?.content || '').toLowerCase().match(/^(draft|send|delete|create|schedule|book|search|list)/);
          const dynamicMaxTokens = isToolQuery ? 4096 : queryLen > 200 ? 4096 : queryLen > 80 ? 3072 : 2048;

          // Use the unified llm-router for correct provider dispatch
          const result = await createCompletion({
            messages: messagesArray,
            model: selectedModel,
            temperature: 0.7,
            topP: 0.9,
            maxTokens: dynamicMaxTokens,
            ...(useTools ? { tools: domainTools, toolChoice: "auto" } : {}),
          });

          // Convert CompletionResult back to the format route.ts expects (Groq-like shape)
          return {
            choices: [{
              message: {
                content: result.content,
                tool_calls: result.toolCalls,
                role: 'assistant' as const,
              }
            }],
            usage: {
              prompt_tokens: result.usage.promptTokens,
              completion_tokens: result.usage.completionTokens,
              total_tokens: result.usage.totalTokens,
            },
          };
        } catch (err: any) {
          attempts++;
          console.warn(`[DEBUG] Completion Attempt ${attempts} failed (model=${selectedModel}): ${err?.message || err}`);
          if (err.response) {
            console.warn(`[DEBUG] Error data:`, JSON.stringify(err.response?.data));
          }
          if (attempts >= maxRetries) {
            const errMsg = err?.message || "";
            if (useTools && (errMsg.includes("tool_use_failed") || errMsg.includes("Failed to call a function") || errMsg.includes("tool_calls"))) {
              console.warn(`[DEBUG] Max retries reached for tools. Falling back to non-tool completion...`);
              const cleanMessages = messagesArray.filter((m: any) => m.role !== "tool" && !m.tool_calls);
              const fallbackResult = await createCompletion({
                messages: cleanMessages.length > 0 ? cleanMessages : messagesArray,
                model: selectedModel,
                temperature: 0.7,
                topP: 0.9,
                maxTokens: 4096,
              });
              return {
                choices: [{
                  message: {
                    content: fallbackResult.content,
                    tool_calls: fallbackResult.toolCalls,
                    role: 'assistant' as const,
                  }
                }],
                usage: {
                  prompt_tokens: fallbackResult.usage.promptTokens,
                  completion_tokens: fallbackResult.usage.completionTokens,
                  total_tokens: fallbackResult.usage.totalTokens,
                },
              };
            }
            throw err;
          }
        }
      }
    };

    // Payload Array Compilation
    let groqMessages: any[] = [
      { role: "system", content: agentRole }
    ];

    // --- KNOWLEDGE BASE: TIERED INJECTION ---
    // TIER 2 (Query-matched): Semantic retrieval from uploaded documents
    // OPTIMIZATION: Run org profile fetch AND semantic retrieval IN PARALLEL
    const userMsgsForKB = messages.filter((m: any) => m.role === "user");
    const recentUserMsgs = userMsgsForKB.slice(-3);
    const userQueryForKB = recentUserMsgs.map((m: any) => m.content).join(" ").substring(0, 500);

    // Fire semantic retrieval promise immediately (don't wait for org profile)
    const semanticPromise = (uid && agentId && userQueryForKB.trim().length > 3)
      ? Promise.race([
          retrieveSemanticChunks(userQueryForKB, {
            uid,
            agentId,
            orgId,
            pactText: pactText || "",
            orgBrainText: orgBrainText || "",
            knowledgeBaseText: knowledgeBaseText || "",
            maxResults: 12,
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Semantic retrieval timeout')), 4000))
        ]).catch((kbErr) => {
          console.warn("[KB] Semantic retrieval failed, will use fallback:", (kbErr as any)?.message);
          return null;
        })
      : Promise.resolve(null);

    // Await BOTH in parallel — saves up to 4s vs sequential
    const tParallel = Date.now();
    const [orgProfileResult, semanticResult] = await Promise.all([
      Promise.race([orgProfilePromise, new Promise<null>(resolve => setTimeout(() => resolve(null), 2000))]),
      semanticPromise,
    ]);
    console.log(`[PERF] Parallel fetch (org + KB) took ${Date.now() - tParallel}ms`);

    orgProfileData = orgProfileResult;
    // tier1Knowledge (org context, hardcoded knowledge, orgBrain) REMOVED to reduce token overhead.
    // Only semantic doc retrieval (tier2) is kept — query-matched and relevant.

    let combinedKnowledge = "";
    if (semanticResult && Array.isArray(semanticResult) && semanticResult.length > 0) {
      const docChunks = semanticResult.filter((c: any) => c.type === "document" || c.type === "text_entry");
      if (docChunks.length > 0) {
        combinedKnowledge = docChunks.map((c: any) =>
          `[Source: ${c.source}]\n${c.text}`
        ).join("\n\n---\n\n");
      }
    } else if (!semanticResult) {
      // Fallback: use client-provided knowledge base text (capped)
      if (knowledgeBaseText && typeof knowledgeBaseText === "string" && knowledgeBaseText.trim().length > 0) {
        combinedKnowledge = knowledgeBaseText.substring(0, 8000);
      }
    }
    // --- P.A.C.T.: Personalized AI Conversation Training (Tiered Proactive Memory) ---
    // Injected BEFORE knowledge base so KB (query-matched content) is closest to conversation
    if (pactText && typeof pactText === "string" && pactText.trim().length > 0) {
      groqMessages.push({
        role: "system",
        content: `[USER MEMORY]\nFacts about this user from past conversations. Weave in naturally when relevant. Never interrogate about these facts.\n\n${pactText.substring(0, 5000)}`
      });
    }

    // --- CRM DATABASE: Inject user's CRM contacts so Jarvis can answer questions about them ---
    if (crmData && typeof crmData === "string" && crmData.trim().length > 0) {
      const cappedCrm = crmData.substring(0, 16000);
      groqMessages.push({
        role: "system",
        content: `[CRM DATABASE]\nBelow is the user's CRM contact database. Each line is a contact with fields separated by " | " in order: Name, Email, Phone, Mobile, Company, Title, Lead Status, [Tags].\n\nRules for using this data:\n1. SEARCH THOROUGHLY: When asked about a person, search ALL contacts by name, email, company, or any matching field — not just the first few lines.\n2. ANSWER CONFIDENTLY: If you find the contact, provide all their available details (email, phone, company, etc.) without hedging.\n3. ASK TO CLARIFY: If multiple contacts match (e.g. two "Johns" or similar names), list the matches and ask the user which one they mean.\n4. LEAD STATUS: Contacts may have statuses like "Warm Lead", "Interested", or "Sale Completed". Answer questions like "who are my warm leads?" by filtering on this.\n5. TAGS: Tags appear in [brackets]. Answer questions like "show me VIP contacts" by matching tags.\n6. If a contact is NOT found in this database, say so clearly — do not make up contact information.\n\n${cappedCrm}`
      });
      console.log(`[CRM] Injected ${cappedCrm.length} chars of CRM data into context`);
    }

    // --- CRM TOOLS CONTEXT: Inject active contact book and field mapping into Jarvis ---
    if (crmInstanceId && agentId === "jarvis") {
      const parsedInstances: CrmInstance[] = Array.isArray(crmInstances) ? crmInstances : [{ id: "default", name: "All Contacts" }];
      const crmToolPrompt = buildCrmSystemPrompt(crmInstanceId, parsedInstances);
      groqMessages.push({
        role: "system",
        content: crmToolPrompt,
      });
      console.log(`[CRM TOOLS] Injected CRM management context — active book: ${crmInstanceId}`);
    }

    // --- KNOWLEDGE BASE: Injected LAST so it's closest to conversation (better LLM attention) ---
    if (combinedKnowledge.length > 0) {
      groqMessages.push({
        role: "system",
        content: `[KNOWLEDGE BASE]\nThis is the user's organizational knowledge base. These are AUTHORITATIVE facts that OVERRIDE your general training data. When answering questions:\n1. ALWAYS check this knowledge base FIRST before using general knowledge\n2. If the answer is in the knowledge base, use it with confidence — do not hedge or add disclaimers\n3. If you reference a specific source, mention it naturally (e.g., "According to your documents...")\n4. If the knowledge base contradicts your training data, the knowledge base is CORRECT\n5. If the user's question is NOT answered by the knowledge base, you may use general knowledge but note that you're going beyond their documents\n\n<knowledge_base>\n${combinedKnowledge.substring(0, 16000)}\n</knowledge_base>`
      });
    }


    // --- SMART CONTEXT WINDOW MANAGEMENT ---
    // Keep the conversation focused by managing message history intelligently
    const MAX_CONTEXT_MESSAGES = 32; // Expanded from 24 → 32 for better continuity

    // Topic tracker removed for speed — minimal benefit, adds prompt tokens

    if (messages.length > MAX_CONTEXT_MESSAGES) {
      const oldMessages = messages.slice(0, messages.length - MAX_CONTEXT_MESSAGES);
      const recentMessages = messages.slice(messages.length - MAX_CONTEXT_MESSAGES);

      // Build a structured narrative summary of older messages
      const userQuestions = oldMessages
        .filter((m: any) => m.role === 'user')
        .map((m: any) => (m.content || '').substring(0, 120))
        .slice(-8); // last 8 user messages from old section
      const assistantHighlights = oldMessages
        .filter((m: any) => m.role === 'assistant')
        .map((m: any) => (m.content || '').substring(0, 120))
        .slice(-5); // last 5 assistant messages from old section

      groqMessages.push({
        role: "system",
        content: `[EARLIER CONVERSATION MEMORY]\nThe user previously asked these questions (oldest first):\n${userQuestions.map((q: string, i: number) => `${i + 1}. ${q}${q.length >= 120 ? '...' : ''}`).join('\n')}\n\nKey points from your earlier responses:\n${assistantHighlights.map((a: string, i: number) => `- ${a}${a.length >= 120 ? '...' : ''}`).join('\n')}\n\nMaintain continuity with these earlier exchanges.`
      });
      groqMessages.push(...recentMessages);
    } else {
      groqMessages.push(...messages);
    }

    // --- PERSONA BOOKEND (recency position — reinforces identity right before generation) ---
    groqMessages.push({
      role: "system",
      content: `[REMINDER] You are JARVIS. First person only. No meta-commentary. Answer directly. Never say "Jarvis can..." — say "I can..."`
    });

    // --- STRUCTURED REASONING ENGINE ---
    // For substantive questions, inject multi-step reasoning framework
    const lastUserMsg = messages[messages.length - 1];
    const lastUserText = (lastUserMsg?.content || '').toLowerCase().trim();
    const taskPrefixes = ['draft', 'send', 'delete', 'create', 'schedule', 'book'];
    const isTaskCommand = taskPrefixes.some(p => lastUserText.startsWith(p)) && lastUserText.length < 80;
    const questionIndicators = [
      lastUserText.includes('?'),
      lastUserText.startsWith('why'), lastUserText.startsWith('how'),
      lastUserText.startsWith('what'), lastUserText.startsWith('explain'),
      lastUserText.startsWith('tell me'), lastUserText.startsWith('describe'),
      lastUserText.startsWith('compare'), lastUserText.startsWith('analyze'),
      lastUserText.startsWith('should i'), lastUserText.startsWith('could you'),
      lastUserText.includes('difference between'), lastUserText.includes('pros and cons'),
      lastUserText.includes('what if'), lastUserText.includes('help me understand'),
      lastUserText.includes('think about'), lastUserText.includes('opinion on'),
      lastUserText.includes('advice'), lastUserText.includes('recommend'),
      lastUserText.includes('strategy'), lastUserText.includes('approach'),
    ];
    const isSubstantiveQuestion = lastUserText.length > 25 && !isTaskCommand && questionIndicators.some(Boolean);

    // Reasoning framework removed for speed — the soul prompt already defines behavior.
    // Tavily enrichment removed — always times out and the model has web_search as a tool fallback.

    // Tavily enrichment removed for speed — always timed out and added 400ms+ latency.
    // The model has web_search as a tool fallback if it needs real-time info.
    let enrichmentUrls: { url: string; title: string }[] = [];

    // ── Domain Router: Classify intent and load only relevant tools ──
    // Replaces the old toolHintPatterns regex with an intelligent router
    // that selects the right domain (EMAIL, CALENDAR, CRM, etc.) and
    // loads only that domain's tools — reducing token overhead by ~75%.
    const hasToolApis = !!(gmail || calendar || docsApi || youtubeApi);
    const lastUserText2 = messages.filter((m: any) => m.role === 'user').pop()?.content || '';
    let routedDomain: JarvisDomain = await routeIntent(lastUserText2);
    const toolKeywords = /doc|dco|docs|document|slide|sheet|spreadsheet|presentation|youtube|calendar|event|meeting|meet|appointment|email|emai|emial|draft|mail|text|message|imessage|contact|crm|search web|look up|find|google|gogle|googl|goolge|calender|calandar|survey|questionnaire|feedback form|grant|block sender|unsubscribe|trash|spam|knowledge base|web search|remember when|past conversation|what did we/i;
    let forceTools = toolKeywords.test(lastUserText2);

    // ── CONVERSATION-AWARE ROUTING FIX ──
    // When the user is replying to a clarification question (e.g. picking a contact
    // from a list), the reply won't contain domain keywords and routes to GENERAL.
    // This causes tools to be unloaded mid-task ("tool isn't available in this session").
    // Fix: If the last message routes to GENERAL, check the prior 2-3 user messages
    // and the last assistant message for domain context. If a specific domain was
    // active in the recent conversation, inherit it.
    if (routedDomain === 'GENERAL' && !forceTools && messages.length >= 3) {
      // Check prior user messages for domain hints
      const userMsgs = messages.filter((m: any) => m.role === 'user');
      const priorUserMsgs = userMsgs.slice(-3, -1); // 2nd-to-last and 3rd-to-last user messages
      const lastAssistantMsg = [...messages].reverse().find((m: any) => m.role === 'assistant')?.content || '';

      // Combine recent context for domain detection
      const recentContext = [
        ...priorUserMsgs.map((m: any) => m.content || ''),
        lastAssistantMsg
      ].join(' ');

      // If the assistant just asked a clarification question (e.g. "which contact?"),
      // the user's short reply should inherit the prior domain
      const isShortReply = lastUserText2.length < 100;
      const isClarificationResponse = isShortReply && (
        lastAssistantMsg.includes('which one did you mean') ||
        lastAssistantMsg.includes('which one do you mean') ||
        lastAssistantMsg.includes('Could you clarify') ||
        lastAssistantMsg.includes('multiple contacts') ||
        lastAssistantMsg.includes('multiple matches') ||
        lastAssistantMsg.includes('which one') ||
        lastAssistantMsg.includes('which contact') ||
        /\d+\.\s/.test(lastAssistantMsg) // numbered list in assistant message
      );

      if (isClarificationResponse || isShortReply) {
        // Route the prior user message instead to recover the original domain
        const priorRoute = priorUserMsgs.length > 0
          ? await routeIntent(priorUserMsgs[priorUserMsgs.length - 1].content || '')
          : 'GENERAL';

        if (priorRoute !== 'GENERAL') {
          console.log(`[ROUTER] Context recovery: \"${lastUserText2.substring(0, 50)}\" routed GENERAL → inheriting ${priorRoute} from prior message`);
          routedDomain = priorRoute;
        } else if (toolKeywords.test(recentContext)) {
          // Fallback: if recent context contains tool keywords, force tools on
          console.log(`[ROUTER] Context recovery: recent conversation has tool keywords, forcing tools`);
          forceTools = true;
        }
      }
    }

    const messageNeedsTools = routedDomain !== 'GENERAL' || forceTools;
    const useTools = !!(hasToolApis || uid) && messageNeedsTools;
    // Filter master tools array to only include domain-relevant tools
    const domainTools = filterToolsForDomain(tools, routedDomain);
    console.log(`[ROUTER] Domain: ${routedDomain} | Tools loaded: ${domainTools.length}/${tools.length} | useTools: ${useTools}`);

    // Inject domain-specific system prompt supplement
    if (useTools) {
      groqMessages.push({
        role: "system",
        content: getDomainPrompt(routedDomain),
      });
      console.log(`[ROUTER] Injected domain prompt for: ${routedDomain}`);
    }

    // ── Agentic Planning Step: Generate intent understanding + deliverables ──
    let planningText = '';
    if (useTools && wantStream && routedDomain !== 'MULTI') {
      try {
        const planningCompletion = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: `You are a concise task planner. Given the user's request, respond with EXACTLY this format (no extra text):\n\nINTENT: [One sentence describing what the user is requesting]\n\nDELIVERABLES:\n1. [First step/action to take]\n2. [Second step/action if applicable]\n3. [Third step if applicable]\n\nKeep it brief. Max 3-4 deliverables. If the request is simple (single action), just list 1 deliverable.` },
            { role: 'user', content: lastUserText2 }
          ],
          max_tokens: 150,
          temperature: 0,
        });
        planningText = planningCompletion.choices[0]?.message?.content?.trim() || '';
      } catch (planErr) {
        console.log('[PLANNING] Planning step failed, continuing without plan:', planErr);
      }
    }

    console.log(`[DEBUG] agentId="${agentId}" rawAgentId="${rawAgentId}" isEmailAgent=${isEmailAgent} refreshToken=${refreshToken ? "YES" : "NO"}`);
    console.log(`[DEBUG] APIs: gmail=${!!gmail} calendar=${!!calendar} docs=${!!docsApi} youtube=${!!youtubeApi} useTools=${useTools} messageNeedsTools=${messageNeedsTools}`);

    // ── NATIVE STREAMING FAST PATH ──
    // When client wants streaming AND no tools are needed, use the LLM router's
    // native streaming for real-time token delivery across ANY provider.
    if (wantStream && !useTools) {
      // Resolve 'auto' mode to an actual model
      if (selectedModel === 'auto') {
        const lastUserText = messages.filter((m: any) => m.role === 'user').pop()?.content || '';
        selectedModel = autoSelectModel(lastUserText, useTools);
        console.log(`[AUTO] Auto-selected model: ${selectedModel}`);
      }
      const modelConfig = getModelConfig(selectedModel);
      const providerName = modelConfig?.provider || 'groq';
      console.log(`[STREAM] Native streaming path — provider=${providerName} model=${selectedModel}`);
      const t0 = Date.now();

      // Dynamic max_tokens based on query complexity
      const lastMsg = groqMessages.filter((m: any) => m.role === 'user').pop();
      const queryLen = (lastMsg?.content || '').length;
      const dynamicMaxTokens = queryLen > 200 ? 8192 : queryLen > 80 ? 4096 : 3072;

      const streamGenerator = createStreamingCompletion({
        messages: groqMessages,
        model: selectedModel,
        temperature: 0.7,
        topP: 0.9,
        maxTokens: dynamicMaxTokens,
      });

      const encoder = new TextEncoder();
      let fullResponse = '';

      // HTML-to-markdown sanitizer for individual chunks
      const sanitizeChunk = (text: string): string => {
        if (!text) return text;
        let clean = text.replace(/<b>(.*?)<\/b>/gi, '**$1**');
        clean = clean.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
        clean = clean.replace(/<i>(.*?)<\/i>/gi, '*$1*');
        clean = clean.replace(/<em>(.*?)<\/em>/gi, '*$1*');
        clean = clean.replace(/<br\s*\/?>/gi, '\n');
        clean = clean.replace(/<\/?p>/gi, '\n');
        clean = clean.replace(/<[^>]+>/g, '');
        return clean;
      };

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Send server-side metadata so client can verify actual provider in F12
            const serverMeta = {
              type: 'server_meta',
              model: selectedModel,
              provider: providerName,
              openrouterKeySet: !!process.env.OPENROUTER_API_KEY,
              timestamp: Date.now(),
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(serverMeta)}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'routing', domain: routedDomain, timestamp: Date.now() })}\n\n`));
            if (planningText) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', content: planningText, timestamp: Date.now() })}\n\n`));
            }
            for await (const chunk of streamGenerator) {
              if (chunk.done) break;
              if ((chunk as any).modelFallback) {
                // OpenRouter failed — notify client that a fallback model is being used
                const fb = (chunk as any).modelFallback;
                console.warn(`[STREAM] ⚠️ Model fallback: ${fb.requested} → ${fb.actual}`);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'model_fallback', requested: fb.requested, actual: fb.actual, timestamp: Date.now() })}\n\n`));
              }
              if (chunk.token) {
                const sanitized = sanitizeChunk(chunk.token);
                fullResponse += sanitized;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: sanitized })}\n\n`));
              }
            }

            // Retrieve citations after stream completes
            const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
            const citations = lastUserMessage
              ? retrieveRelevantSnippets(lastUserMessage.content || '', {
                  pactText: pactText || '',
                  knowledgeBaseText: knowledgeBaseText || '',
                  orgBrainText: orgBrainText || '',
                })
              : [];

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              done: true,
              usage: 0,
              citations: citations.length > 0 ? citations : undefined,
            })}\n\n`));
            controller.close();
            console.log(`[PERF] Native stream completed in ${Date.now() - t0}ms | ${fullResponse.length} chars`);
            
            // Detect failed tool invocation in streaming response
            if (fullResponse.match(/<invoke|<tool_call|<function_call|```json\s*\{[\s\S]*?"name":/)) {
              console.warn('[STREAM] Detected tool invocation in streaming response — should have used tool path');
              // The response already went out, but log this for debugging
            }
          } catch (streamErr: any) {
            console.error('[STREAM] Native stream error:', streamErr?.message || streamErr);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
            controller.close();
          }
        }
      });

      // Fire-and-forget PACT extraction
      if (uid && userName && fullResponse.length > 20) {
        const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
        if (lastUserMsg.length > 5) {
          extractPACTFacts(lastUserMsg, fullResponse, userName, messages.slice(-6))
            .catch(() => {});
        }
      }

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Model-Used': selectedModel,
        },
      });
    }


    // ── PASS 1: Generate Response or Tool Target (synchronous for tool calls) ──
    // Resolve 'auto' mode for synchronous path (tool calls always use Groq for speed)
    if (selectedModel === 'auto') {
      const lastUserText = messages.filter((m: any) => m.role === 'user').pop()?.content || '';
      selectedModel = autoSelectModel(lastUserText, useTools);
      console.log(`[AUTO] Auto-selected model for sync path: ${selectedModel}`);
    }
    // Tool calls: OpenRouter models get rerouted to Groq for fast tool calling
    // (this is handled inside createCompletionWithRetry now)
    const t0 = Date.now();
    // Skip Pass 1 LLM call for MULTI routes — the orchestrator handles everything
    let completion: any = null;
    if (routedDomain !== 'MULTI') {
      completion = await createCompletionWithRetry(groqMessages, useTools);
      console.log(`[PERF] Completion took ${Date.now() - t0}ms | model=${selectedModel} useTools=${useTools}`);
    }

    let responseMessage = completion?.choices?.[0]?.message;
    if (completion) {
      console.log(`[DEBUG] LLM response: tool_calls=${responseMessage?.tool_calls?.length || 0} content_length=${responseMessage?.content?.length || 0}`);
      if (responseMessage?.tool_calls) {
        responseMessage.tool_calls.forEach((tc: any) => console.log(`[DEBUG] Tool requested: ${tc.function.name}`));
      }
    }

    // ── TRUE STREAMING FAST PATH ──
    // If client wants streaming AND the LLM did NOT request any tools,
    // stream the already-completed response immediately. No second Groq call needed.
    if (wantStream && !responseMessage?.tool_calls && responseMessage?.content) {
      console.log(`[STREAM] Fast path — no tool calls, streaming completed response (${responseMessage.content.length} chars) with model: ${selectedModel}`);

      // Sanitize the response before streaming
      const sanitizeResponse = (text: string): string => {
        if (!text) return text;
        // Convert HTML to markdown
        let clean = text.replace(/<b>(.*?)<\/b>/gi, '**$1**');
        clean = clean.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
        clean = clean.replace(/<i>(.*?)<\/i>/gi, '*$1*');
        clean = clean.replace(/<em>(.*?)<\/em>/gi, '*$1*');
        clean = clean.replace(/<br\s*\/?>/gi, '\n');
        clean = clean.replace(/<\/?p>/gi, '\n');
        clean = clean.replace(/<[^>]+>/g, ''); // Strip remaining HTML tags

        clean = clean.replace(/<\/?(?:function|search_past_conversations|search_emails|create_folder|send_email|draft_email|delete_email|create_calendar_event|get_calendar_events|create_google_document|create_youtube_video|create_spreadsheet|create_presentation|search_google_drive|read_google_drive_file|web_search)[^>]*>/gi, '');
        clean = clean.replace(/\{\s*"(?:query|folderName|to|subject|body|title|date|time|description|videoTitle|content|searchQuery|fileId|type|name|function|arguments|tool_call)"\s*:(?:[^{}]|\{[^{}]*\})*\}/g, '');
        clean = clean.replace(/\[\s*\{\s*"(?:query|type|name|function)"[^\]]*\]\s*/g, '');
        clean = clean.replace(/```(?:json)?\s*\{[^`]*\}\s*```/gi, '');
        clean = clean.replace(/^\s*[\[{]\s*"[^"]+"\s*:.*[}\]]\s*$/gm, '');
        clean = clean.replace(/\n{3,}/g, '\n\n').trim();
        if (clean.length < 5) clean = "I'm sorry, I wasn't able to process that properly. Could you try rephrasing your question?";
        return clean;
      };

      const responseText = sanitizeResponse(responseMessage.content);
      const encoder = new TextEncoder();
      const inputTokens = completion?.usage?.prompt_tokens || 0;
      const outputTokens = completion?.usage?.completion_tokens || 0;
      const totalTokens = completion?.usage?.total_tokens || 0;

      // Retrieve knowledge base citations
      const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
      const citations = lastUserMessage
        ? retrieveRelevantSnippets(lastUserMessage.content || '', {
            pactText: pactText || '',
            knowledgeBaseText: knowledgeBaseText || '',
            orgBrainText: orgBrainText || '',
          })
        : [];

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'routing', domain: routedDomain, timestamp: Date.now() })}\n\n`));
            if (planningText) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', content: planningText, timestamp: Date.now() })}\n\n`));
            }
            // Stream the response in small word chunks for natural typing feel
            const words = responseText.split(/(?<=\s)/);
            let wordBuffer = '';
            for (let i = 0; i < words.length; i++) {
              wordBuffer += words[i];
              if (wordBuffer.length >= 6 || i === words.length - 1) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: wordBuffer })}\n\n`));
                wordBuffer = '';
              }
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              done: true,
              usage: totalTokens,
              citations: citations.length > 0 ? citations : undefined,
            })}\n\n`));
            controller.close();
          } catch (streamErr: any) {
            console.error('[STREAM] Error:', streamErr?.message || streamErr);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
            controller.close();
          }
        }
      });

      // Log AI usage (non-blocking)
      try {
        logAIUsage({
          userId: uid || 'anonymous',
          orgId: isNxtChapter ? 'nxtchapter' : 'soltheory',
          model: selectedModel,
          provider: 'groq',
          endpoint: '/api/chat',
          inputTokens,
          outputTokens,
          totalTokens,
          costUsd: calculateGroqCost(selectedModel, inputTokens, outputTokens),
          timestamp: new Date(),
        });
      } catch (logErr) {
        console.warn('[AI Usage] Logging failed (non-fatal):', (logErr as any)?.message);
      }

      // Fire-and-forget server-side PACT extraction — runs in background, doesn't slow response
      if (uid && userName && responseText.length > 20) {
        const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
        if (lastUserMsg.length > 5) {
          extractPACTFacts(lastUserMsg, responseText, userName, messages.slice(-6))
            .then(async (facts) => {
              if (facts.length === 0) return;
              try {
                await initAdmin();
                const db = getAdminFirestore();
                const userRef = db.collection("users").doc(uid);
                const userDoc = await userRef.get();
                const existingEntries: any[] = userDoc.data()?.pact_entries_soltheory || [];
                const existingQuestions = new Set(existingEntries.map((e: any) => e.question?.toLowerCase().trim()));
                
                // Deduplicate and format new entries
                const newEntries = facts
                  .filter(f => !existingQuestions.has(f.question?.toLowerCase().trim()))
                  .map(f => ({
                    question: f.question,
                    answer: f.answer,
                    confidence: f.confidence || "medium",
                    category: f.category || "preference",
                    source: "server_background",
                    orgId,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  }));
                
                if (newEntries.length > 0) {
                  // Cap total entries at 200 — if adding would exceed, trim oldest low-confidence first
                  const totalAfter = existingEntries.length + newEntries.length;
                  if (totalAfter > 200) {
                    const sorted = [...existingEntries].sort((a, b) => {
                      const confScore: Record<string, number> = { high: 3, medium: 2, low: 1 };
                      return (confScore[a.confidence] || 2) - (confScore[b.confidence] || 2) || (a.createdAt || 0) - (b.createdAt || 0);
                    });
                    const toRemove = totalAfter - 200;
                    const entriesToRemove = sorted.slice(0, toRemove);
                    // Remove old entries and add new ones
                    const remaining = existingEntries.filter((e: any) => !entriesToRemove.includes(e));
                    await userRef.update({ pact_entries_soltheory: [...remaining, ...newEntries] });
                  } else {
                    await userRef.update({ pact_entries_soltheory: FieldValue.arrayUnion(...newEntries) });
                  }
                  console.log(`[PACT Server] Extracted ${newEntries.length} new facts for user ${uid}`);
                }
              } catch (dbErr) {
                console.warn("[PACT Server] Firestore write failed:", (dbErr as any)?.message);
              }
            })
            .catch(err => console.warn("[PACT Server] Background extraction failed:", (err as any)?.message));
        }
      }

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    let lastMeetLink: string | null = null;

    // ── Tool Executor (extracted for reuse by orchestrator) ──
    // This function wraps the entire tool dispatch switch statement.
    // It captures closure variables (gmail, calendar, docsApi, youtubeApi, orgId, uid, etc.)
    // and is used both by the normal tool loop and by the multi-step orchestrator.
    const executeToolByName = async (functionName: string, args: any): Promise<string> => {
      let functionResult = "";

          if (functionName === "search_emails") {
            const res = await gmail.users.messages.list({ userId: 'me', q: args.query, maxResults: 10 });
            if (!res.data.messages || res.data.messages.length === 0) {
              functionResult = JSON.stringify({ result: "No emails found matching query. Try broadening your 'query' (e.g. using just the domain, or name)." });
            } else {
              const detailPromises = res.data.messages.slice(0, 5).map((msg: any) =>
                gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] })
              );
              const details = await Promise.all(detailPromises);
              const formatted = details.map((d: any) => {
                const h = d.data.payload?.headers || [];
                return {
                  messageId: d.data.id,
                  subject: h.find((x: any) => x.name === 'Subject')?.value,
                  from: h.find((x: any) => x.name === 'From')?.value,
                  snippet: d.data.snippet
                };
              });
              functionResult = JSON.stringify({ result: formatted });
            }
          } else if (functionName === "delete_email") {
            await gmail.users.messages.trash({ userId: 'me', id: args.messageId });
            functionResult = JSON.stringify({ result: `Message successfully moved to trash.` });
          } else if (functionName === "create_folder") {
            await gmail.users.labels.create({
              userId: 'me',
              requestBody: { name: args.folderName, labelListVisibility: 'labelShow', messageListVisibility: 'show' }
            });
            functionResult = JSON.stringify({ result: `Folder '${args.folderName}' successfully created.` });
          } else if (functionName === "block_sender") {
            await gmail.users.settings.filters.create({
              userId: 'me',
              requestBody: {
                criteria: { from: args.senderEmail },
                action: { addLabelIds: ['TRASH'] }
              }
            });
            functionResult = JSON.stringify({ result: `Sender '${args.senderEmail}' blocked.` });
          } else if (functionName === "list_calendar_events") {
            const timeMin = args.timeMin || new Date().toISOString();
            const timeMax = args.timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const res = await calendar.events.list({
              calendarId: 'primary',
              timeMin: timeMin,
              timeMax: timeMax,
              singleEvents: true,
              orderBy: 'startTime'
            });
            const formatted = (res.data.items || []).map((e: any) => ({
              eventId: e.id,
              summary: e.summary,
              startTime: e.start.dateTime || e.start.date,
              endTime: e.end.dateTime || e.end.date,
              location: e.location || '',
              link: e.htmlLink
            }));
            functionResult = JSON.stringify({ result: formatted.length > 0 ? formatted : "No events found in the specified time range." });
          } else if (functionName === "create_calendar_event") {
            const requestBody: any = {
              summary: args.summary,
              description: args.description || '',
              start: { dateTime: args.startDateTime },
              end: { dateTime: args.endDateTime }
            };

            if (args.addGoogleMeetLink) {
              requestBody.conferenceData = {
                createRequest: {
                  requestId: `meet_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                  conferenceSolutionKey: { type: "hangoutsMeet" }
                }
              };
            }

            const res = await calendar.events.insert({
              calendarId: 'primary',
              conferenceDataVersion: 1,
              requestBody
            });
            if (res.data.hangoutLink) {
              lastMeetLink = res.data.hangoutLink;
            }
            const meetLink = res.data.hangoutLink ? ` Meet Link: ${res.data.hangoutLink}` : '';
            functionResult = JSON.stringify({ result: `Event '${args.summary}' created successfully. Link: ${res.data.htmlLink}${meetLink}` });
          } else if (functionName === "delete_calendar_event") {
            await calendar.events.delete({
              calendarId: 'primary',
              eventId: args.eventId
            });
            functionResult = JSON.stringify({ result: `Event successfully deleted/cancelled.` });
          } else if (functionName === "update_calendar_event") {
            // First fetch the existing event
            const existing = await calendar.events.get({
              calendarId: 'primary',
              eventId: args.eventId
            });
            const updateBody: any = { ...existing.data };
            if (args.summary) updateBody.summary = args.summary;
            if (args.description) updateBody.description = args.description;
            if (args.startDateTime) updateBody.start = { dateTime: args.startDateTime };
            if (args.endDateTime) updateBody.end = { dateTime: args.endDateTime };
            const res = await calendar.events.update({
              calendarId: 'primary',
              eventId: args.eventId,
              requestBody: updateBody
            });
            functionResult = JSON.stringify({ result: `Event updated successfully. Link: ${res.data.htmlLink}` });
          } else if (functionName === "draft_outbound_email") {
            let finalBody = args.body;
            if (finalBody.includes('[INSERT_DOCUMENT_CONTEXT]')) {
              const lastContextMsg = messages.slice().reverse().find((m: any) => m.role === 'user' && m.content.includes("Here are the extracted contents:"));
              if (lastContextMsg) {
                const match = lastContextMsg.content.match(/Here are the extracted contents:\n\n([\s\S]+?)(?=\n\n\[USER COMMENT\]:|$)/);
                finalBody = finalBody.replace('[INSERT_DOCUMENT_CONTEXT]', (match && match[1]) ? match[1].trim() : lastContextMsg.content);
              }
            }

            // ── AUTO-CREATE Google Meet link if requested ──
            let generatedMeetLink: string | null = lastMeetLink; // Use one from earlier in this batch if available
            if (args.includeGoogleMeetLink && calendar && !generatedMeetLink) {
              try {
                const meetStart = args.meetingDateTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                const meetEnd = new Date(new Date(meetStart).getTime() + 60 * 60 * 1000).toISOString();
                const calRes = await calendar.events.insert({
                  calendarId: 'primary',
                  conferenceDataVersion: 1,
                  requestBody: {
                    summary: args.meetingSummary || `Meeting with ${args.to}`,
                    start: { dateTime: meetStart },
                    end: { dateTime: meetEnd },
                    conferenceData: {
                      createRequest: {
                        requestId: `meet_auto_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                        conferenceSolutionKey: { type: "hangoutsMeet" }
                      }
                    }
                  }
                });
                generatedMeetLink = calRes.data.hangoutLink || null;
                console.log('[MEET LINK AUTO-GENERATED]', generatedMeetLink);
              } catch (meetErr: any) {
                console.error('[MEET LINK AUTO-CREATE FAILED]', meetErr.message);
              }
            }

            // Replace any placeholder the LLM might have written (catch-all patterns)
            if (generatedMeetLink) {
              // Specific known patterns
              finalBody = finalBody.replace(/\[MEET_LINK\]/gi, generatedMeetLink);
              finalBody = finalBody.replace(/\[INSERT_MEET_LINK\]/gi, generatedMeetLink);
              finalBody = finalBody.replace(/\[INSERT_MEETING_LINK\]/gi, generatedMeetLink);
              finalBody = finalBody.replace(/\[INSERT_GOOGLE_MEET_LINK\]/gi, generatedMeetLink);
              finalBody = finalBody.replace(/\[INSERT_LINK\]/gi, generatedMeetLink);
              finalBody = finalBody.replace(/\[GOOGLE_MEET_LINK\]/gi, generatedMeetLink);
              // Catch-all: any [...] or {...} containing 'meet' or 'link' (case insensitive)
              finalBody = finalBody.replace(/[\[{][^\]}]*(?:meet|link)[^\]}]*[\]}]/gi, generatedMeetLink);
            }

            // If includeGoogleMeetLink was requested and we got a link, append it to the body if no placeholder was replaced
            if (args.includeGoogleMeetLink && generatedMeetLink && !finalBody.includes(generatedMeetLink)) {
              finalBody += `\n\nGoogle Meet Link: ${generatedMeetLink}`;
            }

            // ── SERVER-SIDE EMAIL FORMATTING ──
            // First: normalize literal escaped newlines that LLM sometimes outputs as two chars
            finalBody = finalBody.replace(/\\n/g, '\n');

            // Split body into lines (by real newlines)
            let lines = finalBody.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);

            // If still just one big block (LLM didn't use newlines), try to smart-split
            if (lines.length === 1) {
              const text = lines[0];
              // Detect greeting pattern at start: "Hello Steve," or "Hi Steve," or "Dear Steve,"
              const greetingMatch = text.match(/^((?:Hello|Hi|Hey|Dear|Good\s+(?:morning|afternoon|evening))[^.!?\n]*?[,.])\s*/i);
              // Detect sign-off pattern at end: "Best, Lucas" or "Cheers, Lucas" or "Thanks, Lucas"
              const signoffMatch = text.match(/\s*((?:Best|Cheers|Thanks|Thank\s+you|Regards|Sincerely|Warm\s+regards|Best\s+regards|Kind\s+regards|All\s+the\s+best)[,.]?\s*.{1,30})$/i);

              if (greetingMatch || signoffMatch) {
                let bodyMiddle = text;
                let greeting = '';
                let signoff = '';

                if (greetingMatch) {
                  greeting = greetingMatch[1];
                  bodyMiddle = bodyMiddle.slice(greetingMatch[0].length).trim();
                }
                if (signoffMatch) {
                  signoff = signoffMatch[1];
                  bodyMiddle = bodyMiddle.slice(0, bodyMiddle.length - signoffMatch[0].length).trim();
                }

                lines = [];
                if (greeting) lines.push(greeting);
                if (bodyMiddle) lines.push(bodyMiddle);
                if (signoff) {
                  // Split sign-off into "Cheers," and "Lucas" on separate lines
                  const signoffParts = signoff.split(/,\s*/);
                  if (signoffParts.length === 2) {
                    lines.push(signoffParts[0] + ',');
                    lines.push(signoffParts[1]);
                  } else {
                    lines.push(signoff);
                  }
                }
              }
            } else {
              // LLM used newlines — still enforce sign-off splitting
              const lastLine = lines[lines.length - 1];
              const signoffSplitMatch = lastLine.match(/^((?:Best|Cheers|Thanks|Thank\s+you|Regards|Sincerely|Warm\s+regards|Best\s+regards|Kind\s+regards|All\s+the\s+best)[,.])\s+(.+)$/i);
              if (signoffSplitMatch) {
                lines[lines.length - 1] = signoffSplitMatch[1];
                lines.push(signoffSplitMatch[2]);
              }
            }

            // Build HTML with proper paragraph spacing
            const htmlBody = lines.map((line: string, idx: number) => {
              // First line (greeting) and last two lines (sign-off) get single breaks
              // Body paragraphs get double breaks (paragraph spacing)
              return `<p style="margin:0 0 12px 0;">${line}</p>`;
            }).join('');

            const emailLines = [
              `To: ${args.to}`,
              `Subject: ${args.subject}`,
              `Content-Type: text/html; charset=utf-8`,
              ``,
              htmlBody
            ];
            const raw = Buffer.from(emailLines.join('\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            const draftRes = await gmail.users.drafts.create({
              userId: 'me',
              requestBody: { message: { raw } }
            });
            const draftId = draftRes.data.id;
            const draftLink = draftId ? ` Open draft: https://mail.google.com/mail/u/0/#drafts?compose=${draftId}` : '';
            const meetNote = generatedMeetLink ? ` A Google Meet link (${generatedMeetLink}) was embedded.` : '';
            functionResult = JSON.stringify({ result: `Draft to ${args.to} successfully created.${meetNote}${draftLink}` });
          } else if (functionName === "create_google_document" && docsApi && driveApi) {
            // Create a blank Google Doc
            const createRes = await docsApi.documents.create({
              requestBody: { title: args.title }
            });
            const docId = createRes.data.documentId;

            // Insert the body text
            if (args.body) {
              let finalBody = args.body;
              if (finalBody.includes('[INSERT_DOCUMENT_CONTEXT]')) {
                const lastContextMsg = messages.slice().reverse().find((m: any) => m.role === 'user' && m.content.includes("Here are the extracted contents:"));
                if (lastContextMsg) {
                  const match = lastContextMsg.content.match(/Here are the extracted contents:\n\n([\s\S]+?)(?=\n\n\[USER COMMENT\]:|$)/);
                  finalBody = finalBody.replace('[INSERT_DOCUMENT_CONTEXT]', (match && match[1]) ? match[1].trim() : lastContextMsg.content);
                }
              }

              // Insert all text first
              await docsApi.documents.batchUpdate({
                documentId: docId,
                requestBody: {
                  requests: [{
                    insertText: {
                      location: { index: 1 },
                      text: finalBody
                    }
                  }]
                }
              });

              // Now apply formatting (font + line spacing)
              const fontFamily = args.font || "Arial";
              const spacingMode = args.lineSpacing || "double";
              const lineSpacingValue = spacingMode === "single" ? 100 : 200; // 100 = 1.0, 200 = 2.0 (in hundredths of a point-ratio)

              const textLength = finalBody.length;
              const formatRequests: any[] = [];

              // Apply font family + size 12pt to the entire body
              formatRequests.push({
                updateTextStyle: {
                  range: { startIndex: 1, endIndex: 1 + textLength },
                  textStyle: {
                    fontFamily: fontFamily,
                    fontSize: { magnitude: 12, unit: "PT" }
                  },
                  fields: "fontFamily,fontSize"
                }
              });

              // Apply line spacing to entire body
              formatRequests.push({
                updateParagraphStyle: {
                  range: { startIndex: 1, endIndex: 1 + textLength },
                  paragraphStyle: {
                    lineSpacing: lineSpacingValue,
                    spaceAbove: { magnitude: 0, unit: "PT" },
                    spaceBelow: { magnitude: 0, unit: "PT" }
                  },
                  fields: "lineSpacing,spaceAbove,spaceBelow"
                }
              });

              // Detect headings marked with "## " and apply HEADING_2 style
              const lines = finalBody.split('\n');
              let charIdx = 1; // Document starts at index 1
              for (const line of lines) {
                if (line.startsWith('## ')) {
                  // Apply heading style to this line
                  const headingStart = charIdx;
                  const headingEnd = charIdx + line.length;
                  formatRequests.push({
                    updateParagraphStyle: {
                      range: { startIndex: headingStart, endIndex: headingEnd },
                      paragraphStyle: { namedStyleType: "HEADING_2" },
                      fields: "namedStyleType"
                    }
                  });
                  // Remove the "## " prefix from the text
                  formatRequests.push({
                    deleteContentRange: {
                      range: { startIndex: headingStart, endIndex: headingStart + 3 }
                    }
                  });
                }
                charIdx += line.length + 1; // +1 for the newline
              }

              // Apply formatting requests (process in reverse order for heading deletions to maintain correct indices)
              // Wrapped in try/catch — formatting is best-effort; the doc is already created and populated
              try {
              if (formatRequests.length > 0) {
                // Separate delete requests (must be applied separately, in reverse order)
                const deleteReqs = formatRequests.filter((r: any) => r.deleteContentRange);
                const styleReqs = formatRequests.filter((r: any) => !r.deleteContentRange);

                // Apply style requests first
                if (styleReqs.length > 0) {
                  await docsApi.documents.batchUpdate({
                    documentId: docId,
                    requestBody: { requests: styleReqs }
                  });
                }

                // Apply delete requests in reverse order so indices stay correct
                if (deleteReqs.length > 0) {
                  deleteReqs.reverse();
                  await docsApi.documents.batchUpdate({
                    documentId: docId,
                    requestBody: { requests: deleteReqs }
                  });
                }
              }
              } catch (fmtErr: any) {
                console.warn(`[create_google_document] Formatting failed (doc still created): ${fmtErr?.message}`);
              }
            }

            // Tag the file as AI-created so the dashboard can find it
            await driveApi.files.update({
              fileId: docId,
              requestBody: { properties: { createdByAI: 'true' } }
            });

            functionResult = JSON.stringify({ result: `Google Doc '${args.title}' created successfully. Link: https://docs.google.com/document/d/${docId}/edit` });

          } else if (functionName === "update_google_document" && docsApi) {
            // Update an existing Google Doc with new content
            const docId = args.documentId as string;
            const body = args.body as string;
            
            if (!docId || !body) {
              functionResult = JSON.stringify({ error: "documentId and body are required" });
            } else {
              // First, get the current document to find its content length
              const docData = await docsApi.documents.get({ documentId: docId });
              const endIndex = docData.data.body?.content?.reduce((max: number, el: any) => {
                return Math.max(max, el.endIndex || 0);
              }, 0) || 1;

              // Clear existing content (if any beyond the initial newline)
              if (endIndex > 2) {
                await docsApi.documents.batchUpdate({
                  documentId: docId,
                  requestBody: {
                    requests: [{
                      deleteContentRange: {
                        range: { startIndex: 1, endIndex: endIndex - 1 }
                      }
                    }]
                  }
                });
              }

              // Insert the new body text
              await docsApi.documents.batchUpdate({
                documentId: docId,
                requestBody: {
                  requests: [{
                    insertText: {
                      location: { index: 1 },
                      text: body
                    }
                  }]
                }
              });

              // Apply formatting (font + line spacing)
              const fontFamily = (args.font as string) || "Arial";
              const spacingMode = (args.lineSpacing as string) || "double";
              const lineSpacingValue = spacingMode === "single" ? 100 : 200;
              const textLength = body.length;
              const formatRequests: any[] = [];

              formatRequests.push({
                updateTextStyle: {
                  range: { startIndex: 1, endIndex: 1 + textLength },
                  textStyle: {
                    fontFamily: fontFamily,
                    fontSize: { magnitude: 12, unit: "PT" }
                  },
                  fields: "fontFamily,fontSize"
                }
              });

              formatRequests.push({
                updateParagraphStyle: {
                  range: { startIndex: 1, endIndex: 1 + textLength },
                  paragraphStyle: {
                    lineSpacing: lineSpacingValue,
                    spaceAbove: { magnitude: 0, unit: "PT" },
                    spaceBelow: { magnitude: 0, unit: "PT" }
                  },
                  fields: "lineSpacing,spaceAbove,spaceBelow"
                }
              });

              // Detect headings marked with "## " and apply HEADING_2 style
              const lines = body.split('\n');
              let charIdx = 1;
              for (const line of lines) {
                if (line.startsWith('## ')) {
                  const headingStart = charIdx;
                  const headingEnd = charIdx + line.length;
                  formatRequests.push({
                    updateParagraphStyle: {
                      range: { startIndex: headingStart, endIndex: headingEnd },
                      paragraphStyle: { namedStyleType: "HEADING_2" },
                      fields: "namedStyleType"
                    }
                  });
                  formatRequests.push({
                    deleteContentRange: {
                      range: { startIndex: headingStart, endIndex: headingStart + 3 }
                    }
                  });
                }
                charIdx += line.length + 1;
              }

              // Wrapped in try/catch — formatting is best-effort; content is already written
              try {
              if (formatRequests.length > 0) {
                const deleteReqs = formatRequests.filter((r: any) => r.deleteContentRange);
                const styleReqs = formatRequests.filter((r: any) => !r.deleteContentRange);
                if (styleReqs.length > 0) {
                  await docsApi.documents.batchUpdate({
                    documentId: docId,
                    requestBody: { requests: styleReqs }
                  });
                }
                if (deleteReqs.length > 0) {
                  deleteReqs.reverse();
                  await docsApi.documents.batchUpdate({
                    documentId: docId,
                    requestBody: { requests: deleteReqs }
                  });
                }
              }
              } catch (fmtErr: any) {
                console.warn(`[update_google_document] Formatting failed (content still written): ${fmtErr?.message}`);
              }

              functionResult = JSON.stringify({ result: `Google Doc updated successfully. Link: https://docs.google.com/document/d/${docId}/edit` });
            }

          } else if (functionName === "create_google_slide_deck" && slidesApi && driveApi) {
            // Create a blank presentation
            const createRes = await slidesApi.presentations.create({
              requestBody: { title: args.title }
            });
            const presentationId = createRes.data.presentationId;
            const existingSlides = createRes.data.slides || [];

            // Build requests: delete the default blank slide, then create user slides
            const requests: any[] = [];

            // Delete the default first slide
            if (existingSlides.length > 0) {
              requests.push({ deleteObject: { objectId: existingSlides[0].objectId } });
            }

            // Create each slide from the LLM's array
            if (args.slides && Array.isArray(args.slides)) {
              args.slides.forEach((slide: any, idx: number) => {
                const slideId = `slide_${idx}`;
                const titleId = `title_${idx}`;
                const bodyId = `body_${idx}`;
                requests.push({
                  createSlide: {
                    objectId: slideId,
                    insertionIndex: idx,
                    slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
                    placeholderIdMappings: [
                      { layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: titleId },
                      { layoutPlaceholder: { type: 'BODY', index: 0 }, objectId: bodyId }
                    ]
                  }
                });
                requests.push({
                  insertText: { objectId: titleId, text: slide.slideTitle || `Slide ${idx + 1}` }
                });
                requests.push({
                  insertText: { objectId: bodyId, text: slide.slideBody || '' }
                });
              });
            }

            if (requests.length > 0) {
              await slidesApi.presentations.batchUpdate({
                presentationId,
                requestBody: { requests }
              });
            }

            // Tag as AI-created
            await driveApi.files.update({
              fileId: presentationId,
              requestBody: { properties: { createdByAI: 'true' } }
            });

            functionResult = JSON.stringify({ result: `Google Slides '${args.title}' created with ${(args.slides || []).length} slides. Link: https://docs.google.com/presentation/d/${presentationId}/edit` });

          } else if (functionName === "create_google_sheet" && sheetsApi && driveApi) {
            // Create a blank spreadsheet
            const createRes = await sheetsApi.spreadsheets.create({
              requestBody: {
                properties: { title: args.title }
              }
            });
            const spreadsheetId = createRes.data.spreadsheetId;

            // Build data rows: headers first, then data
            const values: string[][] = [];
            if (args.headers && Array.isArray(args.headers)) {
              values.push(args.headers);
            }
            if (args.rows && Array.isArray(args.rows)) {
              values.push(...args.rows);
            }

            if (values.length > 0) {
              await sheetsApi.spreadsheets.values.update({
                spreadsheetId,
                range: 'Sheet1!A1',
                valueInputOption: 'RAW',
                requestBody: { values }
              });
            }

            // Tag as AI-created
            await driveApi.files.update({
              fileId: spreadsheetId,
              requestBody: { properties: { createdByAI: 'true' } }
            });

            functionResult = JSON.stringify({ result: `Google Sheet '${args.title}' created successfully. Link: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` });

          } else if (functionName === "search_google_drive" && driveApi) {
            const res = await driveApi.files.list({
              q: `name contains '${args.query}' and trashed = false`,
              fields: "files(id, name, mimeType, webViewLink)",
              pageSize: 10
            });
            const files = res.data.files || [];
            functionResult = JSON.stringify({ result: files.length > 0 ? files : "No files found." });

          } else if (functionName === "read_drive_document" && docsApi) {
            try {
              const res = await docsApi.documents.get({ documentId: args.fileId });
              const content = res.data.body?.content || [];
              let text = "";
              content.forEach((el: any) => {
                if (el.paragraph && el.paragraph.elements) {
                  el.paragraph.elements.forEach((elem: any) => {
                    if (elem.textRun && elem.textRun.content) text += elem.textRun.content;
                  });
                }
              });
              functionResult = JSON.stringify({ result: text || "Document is empty or cannot be read as text." });
            } catch (err: any) {
              functionResult = JSON.stringify({ error: "Failed to read document. Make sure it is a Google Doc. " + err.message });
            }
          } else if (functionName === "draft_youtube_video" && docsApi && driveApi) {
            console.log("[YOUTUBE TOOL] draft_youtube_video triggered! Args:", JSON.stringify(args));
            console.log("[YOUTUBE TOOL] videoUrl available:", !!videoUrl);
            try {
              // 1. Create the Script Doc in Google Drive
              console.log("[YOUTUBE TOOL] Creating Google Doc script...");
              const docRes = await docsApi.documents.create({
                requestBody: { title: `Script: ${args.title}` }
              });
              const docId = docRes.data.documentId;

              const scriptContent = args.script || "Script content will be added here.";
              await docsApi.documents.batchUpdate({
                documentId: docId,
                requestBody: { requests: [{ insertText: { location: { index: 1 }, text: scriptContent } }] }
              });

              await driveApi.files.update({
                fileId: docId,
                requestBody: { properties: { createdByAI: 'true' } }
              });

              const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
              const tagsString = Array.isArray(args.tags) ? args.tags.join(', ') : (args.tags || '');
              const fullDescription = `${args.description}\n\nTags: ${tagsString}\n\n🎥 Full Script: ${docUrl}`;
              console.log("[YOUTUBE TOOL] Script doc created:", docUrl);

              // 2. If user uploaded a video file, upload it to YouTube as a REAL video draft
              if (videoUrl && youtubeApi) {
                try {
                  console.log("[YOUTUBE TOOL] Downloading video from Firebase Storage...");
                  const videoFetchRes = await fetch(videoUrl);
                  if (!videoFetchRes.ok) throw new Error(`Failed to download video: ${videoFetchRes.status}`);
                  const videoBuffer = Buffer.from(await videoFetchRes.arrayBuffer());
                  console.log(`[YOUTUBE TOOL] Video downloaded: ${videoBuffer.length} bytes`);

                  const { Readable } = require('stream');
                  const videoStream = new Readable();
                  videoStream.push(videoBuffer);
                  videoStream.push(null);

                  console.log("[YOUTUBE TOOL] Uploading video to YouTube...");
                  const ytRes = await youtubeApi.videos.insert({
                    part: ['snippet', 'status'],
                    requestBody: {
                      snippet: {
                        title: args.title,
                        description: fullDescription,
                        tags: args.tags || [],
                        categoryId: '27'
                      },
                      status: {
                        privacyStatus: 'private',
                        selfDeclaredMadeForKids: false
                      }
                    },
                    media: { body: videoStream }
                  });

                  const videoId = ytRes.data.id;
                  console.log("[YOUTUBE TOOL] Video uploaded! ID:", videoId);
                  functionResult = JSON.stringify({
                    result: `Video draft uploaded to YouTube!\n- YouTube Video: https://studio.youtube.com/video/${videoId}/edit (Private)\n- Script Doc: ${docUrl}\n\nYour video "${args.title}" is now in YouTube Studio as a private draft. Review and publish when ready!\n\n[YOUTUBE_METADATA: ID=${videoId}, TYPE=video]`
                  });
                } catch (uploadErr: any) {
                  console.error("[YOUTUBE TOOL] Video upload failed:", uploadErr.message);
                  // Fall back to playlist if upload fails
                  functionResult = JSON.stringify({
                    result: `Video upload failed (${uploadErr.message}), but your Script Doc was created: ${docUrl}. Try re-uploading the video file.`
                  });
                }
              } else {
                // No video file — create a YouTube Playlist as the draft container
                let playlistUrl = "";
                let playlistIdStr = "";
                if (youtubeApi) {
                  try {
                    console.log("[YOUTUBE TOOL] No video file — creating YouTube playlist...");
                    const playlistRes = await youtubeApi.playlists.insert({
                      part: ['snippet', 'status'],
                      requestBody: {
                        snippet: {
                          title: `[DRAFT] ${args.title}`,
                          description: fullDescription,
                          tags: args.tags || []
                        },
                        status: { privacyStatus: 'private' }
                      }
                    });
                    const playlistId = playlistRes.data.id;
                    playlistIdStr = playlistId;
                    playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
                    console.log("[YOUTUBE TOOL] Playlist created:", playlistId);
                  } catch (playlistErr: any) {
                    console.error("[YOUTUBE TOOL] Playlist creation failed:", playlistErr.message);
                  }
                }
                functionResult = JSON.stringify({
                  result: `Video concept created (no video file attached)!\n- YouTube Draft Playlist: ${playlistUrl || "unavailable"}\n- Script Doc: ${docUrl}\n\nUpload a video file on the dashboard to create a full YouTube video draft next time.\n\n[YOUTUBE_METADATA: ID=${playlistIdStr}, TYPE=playlist]`
                });
              }
            } catch (err: any) {
              console.error("[YOUTUBE TOOL] Error:", err.message);
              functionResult = JSON.stringify({ error: "Failed to create video concept: " + err.message });
            }
          } else if (functionName === "create_and_send_survey") {
            try {
              console.log("[SURVEY TOOL] Creating survey:", args.topic);

              // Step 1: Generate survey questions using Groq
              const surveyGroq = new Groq({ apiKey: process.env.GROQ_API_KEY });
              const surveyCompletion = await surveyGroq.chat.completions.create({
                messages: [
                  {
                    role: "system",
                    content: `You are an expert survey designer. The user will give you a description of what they want to survey. 
You must return a valid JSON object representing the survey. DO NOT wrap it in markdown blockquotes like \`\`\`json. Just return raw JSON.
The JSON must have this exact structure:
{
  "title": "Survey Title",
  "description": "A brief description of the survey's purpose",
  "questions": [
    { "id": "q1", "type": "text", "prompt": "Question text" },
    { "id": "q2", "type": "choice", "prompt": "Question text", "options": ["Option 1", "Option 2", "Option 3"] },
    { "id": "q3", "type": "rating", "prompt": "Rate something from 1 to 5" }
  ]
}
Allowed types for questions are: "text", "choice", "rating".
Generate exactly ${args.questionCount || 10} questions. Make the survey professional and perfectly tailored to their request. Use a good mix of text, choice, and rating question types.`
                  },
                  { role: "user", content: args.topic }
                ],
                model: selectedModel,
                temperature: 0.7,
                response_format: { type: "json_object" }
              });

              let surveyJson = surveyCompletion.choices[0]?.message?.content || "";
              surveyJson = surveyJson.trim().replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
              const surveyData = JSON.parse(surveyJson);
              console.log("[SURVEY TOOL] Generated survey:", surveyData.title, "with", surveyData.questions?.length, "questions");

              // Step 2: Save to Firestore using Admin SDK
              initAdmin();
              const adminDb = getAdminFirestore();

              // Extract user email from soul context
              const userEmailMatch = soul?.match(/email address is: ([^\s.]+@[^\s.]+\.[^\s]+)/);
              const userEmail = userEmailMatch?.[1] || "unknown@soltheory.com";
              const userDomain = userEmail.split("@")[1] || "soltheory.com";

              const surveyDoc = await adminDb.collection("custom_surveys").add({
                ...surveyData,
                userId: uid || "unknown",
                creatorEmail: userEmail,
                authorName: args.authorName || "",
                visibility: "specific",
                domain: userDomain,
                invitedEmails: args.recipientEmails || [],
                createdAt: new Date()
              });

              const surveyUrl = `https://soltheory.com/survey/${surveyDoc.id}`;
              console.log("[SURVEY TOOL] Survey saved:", surveyDoc.id, "URL:", surveyUrl);

              // Step 3: Send email invitations via Gmail API
              let emailResults: string[] = [];
              if (gmail && args.recipientEmails && args.recipientEmails.length > 0) {
                for (let i = 0; i < args.recipientEmails.length; i++) {
                  const recipientEmail = args.recipientEmails[i];
                  const recipientName = args.recipientNames?.[i] || recipientEmail.split("@")[0];

                  const emailBody = `Hello ${recipientName},\n\nYou've been invited to take a survey: "${surveyData.title}"\n\n${surveyData.description || ""}\n\nPlease click the link below to participate:\n${surveyUrl}\n\nThank you for your time and feedback!\n\nBest regards`;

                  const emailSubject = `Survey Invitation: ${surveyData.title}`;

                  const rawEmail = [
                    `To: ${recipientEmail}`,
                    `Subject: ${emailSubject}`,
                    `Content-Type: text/plain; charset="UTF-8"`,
                    "",
                    emailBody
                  ].join("\n");

                  const encodedEmail = Buffer.from(rawEmail).toString("base64url");

                  try {
                    await gmail.users.messages.send({
                      userId: "me",
                      requestBody: { raw: encodedEmail }
                    });
                    emailResults.push(`✅ Sent to ${recipientName} (${recipientEmail})`);
                    console.log("[SURVEY TOOL] Email sent to:", recipientEmail);
                  } catch (emailErr: any) {
                    emailResults.push(`❌ Failed to send to ${recipientEmail}: ${emailErr.message}`);
                    console.error("[SURVEY TOOL] Email send error:", emailErr.message);
                  }
                }
              }

              functionResult = JSON.stringify({
                result: `Survey "${surveyData.title}" created successfully with ${surveyData.questions?.length || 0} questions!\n\nSurvey Link: ${surveyUrl}\n\nEmail Status:\n${emailResults.length > 0 ? emailResults.join("\n") : "No emails sent (no recipients specified)"}`
              });
            } catch (surveyErr: any) {
              console.error("[SURVEY TOOL] Error:", surveyErr.message);
              functionResult = JSON.stringify({ error: "Failed to create survey: " + surveyErr.message });
            }
          } else if (functionName === "search_past_conversations") {
            try {
              if (!uid) throw new Error("User not authenticated");
              initAdmin();
              const adminDb = getAdminFirestore();
              const sessionsSnap = await adminDb
                .collection("users")
                .doc(uid)
                .collection("jarvis_sessions")
                .orderBy("updatedAt", "desc")
                .limit(100)
                .get();

              if (sessionsSnap.empty) {
                functionResult = JSON.stringify({ result: "No past conversations found." });
              } else {
                const searchQuery = (args.query || "").toLowerCase();
                const searchTerms = searchQuery.split(/\s+/).filter((t: string) => t.length > 2);

                const results: any[] = [];
                sessionsSnap.forEach((docSnap: any) => {
                  const data = docSnap.data();
                  const msgs: any[] = data.messages || [];
                  let score = 0;
                  const matchingMsgs: any[] = [];

                  // Title match
                  if ((data.title || "").toLowerCase().includes(searchQuery)) score += 10;

                  // Message matches
                  msgs.forEach((m: any) => {
                    const text = (m.text || "").toLowerCase();
                    if (text.includes(searchQuery)) { score += 5; matchingMsgs.push(m.text.substring(0, 200)); }
                    else { searchTerms.forEach((term: string) => { if (text.includes(term)) { score += 1; matchingMsgs.push(m.text.substring(0, 150)); } }); }
                  });

                  if (score > 0) {
                    const dateStr = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : "unknown date";
                    results.push({
                      title: data.title,
                      date: dateStr,
                      score,
                      snippets: matchingMsgs.slice(0, 4),
                    });
                  }
                });

                results.sort((a, b) => b.score - a.score);
                const topResults = results.slice(0, 5);
                functionResult = JSON.stringify({
                  result: topResults.length > 0
                    ? `Found ${topResults.length} relevant past conversations:\n\n` + topResults.map((r, i) => `${i + 1}. "${r.title}" (${r.date})\n   Matching messages: ${r.snippets.join(" | ")}`).join("\n\n")
                    : "No past conversations matched that query."
                });
              }
            } catch (searchErr: any) {
              functionResult = JSON.stringify({ error: "Failed to search past conversations: " + searchErr.message });
            }
          } else if (functionName === "list_imessage_chats") {
            try {
              initAdmin();
              const adminDb = getAdminFirestore();
              const userDoc = await adminDb.collection("users").doc(uid).get();
              const userData = userDoc.data();
              if (!userData?.twilioPhoneNumber) {
                functionResult = JSON.stringify({ result: "Messaging is not set up yet. Tell the user to go to the Messages page in the sidebar to activate their messaging number." });
              } else {
                const snapshot = await adminDb.collection("users").doc(uid).collection("sms_messages").orderBy("createdAt", "desc").limit(500).get();
                const convMap = new Map<string, any>();
                snapshot.docs.forEach((d: any) => {
                  const data = d.data();
                  const contact = data.direction === "inbound" ? data.from : data.to;
                  if (!convMap.has(contact)) {
                    convMap.set(contact, { contact, lastMessage: data.body || "", lastTime: data.createdAt, unreadCount: 0, messageCount: 0 });
                  }
                  const conv = convMap.get(contact)!;
                  conv.messageCount++;
                  if (data.direction === "inbound" && !data.read) conv.unreadCount++;
                });
                const convos = Array.from(convMap.values()).sort((a: any, b: any) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
                functionResult = JSON.stringify({ result: convos.length > 0 ? convos : "No text conversations found." });
              }
            } catch (imErr: any) {
              functionResult = JSON.stringify({ error: "Failed to list conversations: " + imErr.message });
            }
          } else if (functionName === "get_imessage_thread") {
            try {
              initAdmin();
              const adminDb = getAdminFirestore();
              const snapshot = await adminDb.collection("users").doc(uid).collection("sms_messages").orderBy("createdAt", "desc").limit(100).get();
              const normalizedContact = (args.contact || "").replace(/[^+\d]/g, "");
              const msgs = snapshot.docs.map((d: any) => d.data()).filter((m: any) => (m.from || "").includes(normalizedContact) || (m.to || "").includes(normalizedContact)).map((m: any) => ({
                from: m.direction === 'outbound' ? 'You' : m.from,
                text: m.body || '[Media]',
                time: m.createdAt,
              }));
              functionResult = JSON.stringify({ result: msgs.length > 0 ? msgs : "No messages found in this conversation." });
            } catch (imErr: any) {
              functionResult = JSON.stringify({ error: "Failed to get message thread: " + imErr.message });
            }
          } else if (functionName === "search_imessages") {
            try {
              initAdmin();
              const adminDb = getAdminFirestore();
              const snapshot = await adminDb.collection("users").doc(uid).collection("sms_messages").orderBy("createdAt", "desc").limit(200).get();
              const searchQuery = (args.query || "").toLowerCase();
              const results = snapshot.docs.map((d: any) => d.data()).filter((m: any) => (m.body || "").toLowerCase().includes(searchQuery)).slice(0, 20).map((m: any) => ({
                from: m.direction === 'outbound' ? 'You' : m.from,
                to: m.to,
                text: (m.body || "").substring(0, 200),
                time: m.createdAt,
              }));
              functionResult = JSON.stringify({ result: results.length > 0 ? results : `No messages found matching "${args.query}".` });
            } catch (imErr: any) {
              functionResult = JSON.stringify({ error: "Failed to search messages: " + imErr.message });
            }
          } else if (functionName === "send_imessage") {
            try {
              initAdmin();
              const adminDb = getAdminFirestore();
              const userDoc = await adminDb.collection("users").doc(uid).get();
              const myNumber = userDoc.data()?.twilioPhoneNumber;
              if (!myNumber) throw new Error("Messaging not set up. Tell user to go to Messages page first.");
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL !== 'http://localhost:3000'
                ? process.env.NEXT_PUBLIC_APP_URL
                : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
              const res = await fetch(`${baseUrl}/api/sms/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ from: myNumber, to: args.to, message: args.message }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              // Cache sent message
              await adminDb.collection("users").doc(uid).collection("sms_messages").add({
                sid: data.sid, from: myNumber, to: data.to || args.to, body: args.message,
                direction: "outbound", status: "sent", createdAt: new Date().toISOString(),
              });
              functionResult = JSON.stringify({ result: `Text message sent successfully to ${args.to}.` });
            } catch (imErr: any) {
              functionResult = JSON.stringify({ error: "Failed to send text: " + imErr.message });
            }
          } else if (functionName === "summarize_imessages") {
            try {
              initAdmin();
              const adminDb = getAdminFirestore();
              const userDoc = await adminDb.collection("users").doc(uid).get();
              const myNumber = userDoc.data()?.twilioPhoneNumber;
              if (!myNumber) {
                functionResult = JSON.stringify({ result: "Messaging is not set up. Tell the user to go to the Messages page to get their messaging number." });
              } else {
                const snapshot = await adminDb.collection("users").doc(uid).collection("sms_messages").orderBy("createdAt", "desc").limit(500).get();
                const convMap = new Map<string, any>();
                snapshot.docs.forEach((d: any) => {
                  const data = d.data();
                  const contact = data.direction === "inbound" ? data.from : data.to;
                  if (!convMap.has(contact)) convMap.set(contact, { contact, lastMessage: data.body || "", lastTime: data.createdAt, unreadCount: 0 });
                  if (data.direction === "inbound" && !data.read) convMap.get(contact)!.unreadCount++;
                });
                const convos = Array.from(convMap.values());
                const unread = convos.filter((c: any) => c.unreadCount > 0);
                functionResult = JSON.stringify({ result: {
                  myNumber, totalConversations: convos.length, unreadConversations: unread.length,
                  totalUnreadMessages: unread.reduce((acc: number, c: any) => acc + c.unreadCount, 0),
                  recentConversations: convos.slice(0, 10),
                }});
              }
            } catch (imErr: any) {
              functionResult = JSON.stringify({ error: "Failed to summarize messages: " + imErr.message });
            }
          } else if (functionName === "web_search") {
            try {
              const tavilyKey = process.env.TAVILY_API_KEY;
              if (!tavilyKey) throw new Error("Web search not configured");
              const searchRes = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  api_key: tavilyKey,
                  query: args.query,
                  search_depth: "basic",
                  include_answer: true,
                  max_results: 5,
                }),
              });
              const searchData = await searchRes.json();
              if (!searchRes.ok) throw new Error(searchData.detail || "Search failed");
              const results = (searchData.results || []).map((r: any) => ({
                title: r.title,
                url: r.url,
                snippet: (r.content || "").substring(0, 300),
              }));
              // Append URL list to executedTools args for client-side Jarvis Eye animation
              // Guard: executedTools may be empty when called from the orchestrator
              if (executedTools.length > 0 && executedTools[executedTools.length - 1]?.args) {
                executedTools[executedTools.length - 1].args.searchResults = results;
              }
              functionResult = JSON.stringify({
                result: searchData.answer
                  ? `Web Search Answer: ${searchData.answer}\n\nSources:\n${results.map((r: any) => `- ${r.title}: ${r.url}\n  ${r.snippet}`).join("\n")}`
                  : `Search Results:\n${results.map((r: any) => `- ${r.title}: ${r.url}\n  ${r.snippet}`).join("\n")}`,
              });
            } catch (searchErr: any) {
              functionResult = JSON.stringify({ error: "Web search failed: " + searchErr.message });
            }
          } else if (functionName === "spawn_grant_agent") {
            try {
              await initAdmin();
              const adminDb = getAdminFirestore();

              // Query grant_sessions for this org to find an existing session or available slot
              const sessionsSnap = await adminDb.collection("grant_sessions")
                .where("orgId", "==", orgId)
                .get();

              // Collect all agents across all sessions to find an available slot
              const slotIds = ["agent_1", "agent_2", "agent_3", "agent_4"];
              const slotNames = ["Grant Scout Alpha", "Grant Scout Beta", "Grant Scout Gamma", "Grant Scout Delta"];

              // Use the first session if one exists, otherwise we'll create a new one
              let targetSessionRef: FirebaseFirestore.DocumentReference | null = null;
              let existingAgents: Record<string, any> = {};
              let targetSlot: string | null = null;
              let targetIdx = -1;

              if (!sessionsSnap.empty) {
                // Use first existing session
                const sessionDoc = sessionsSnap.docs[0];
                targetSessionRef = sessionDoc.ref;
                existingAgents = sessionDoc.data()?.agents || {};

                // Find first available slot in this session
                for (let i = 0; i < slotIds.length; i++) {
                  const slot = existingAgents[slotIds[i]];
                  if (!slot || !slot.active || !slot.config) {
                    targetSlot = slotIds[i];
                    targetIdx = i;
                    break;
                  }
                }
              } else {
                // No sessions exist — we'll create one; slot 1 is open
                targetSlot = "agent_1";
                targetIdx = 0;
              }

              if (!targetSlot) {
                functionResult = JSON.stringify({
                  error: "All 4 subagent slots are currently full and active. The user must delete an existing agent before spawning a new one. Tell the user which agents are running and ask which one to replace.",
                  activeAgents: slotIds.map((id, i) => ({
                    slot: i + 1,
                    name: existingAgents[id]?.name || slotNames[i],
                    active: existingAgents[id]?.active ?? false,
                    keywords: existingAgents[id]?.config?.welfareKeywords || [],
                  }))
                });
              } else {
                const newConfig = {
                  grantTypes: args.grantTypes || ["housing_shelter", "health_human_services"],
                  locationState: args.locationState || orgProfileData?.locationState || "Colorado",
                  locationCity: args.locationCity || orgProfileData?.locationCity || "Denver",
                  budgetMin: null,
                  budgetMax: null,
                  openDate: "",
                  closeDate: "",
                  intervalValue: args.intervalValue || 5,
                  intervalUnit: args.intervalUnit || "minutes",
                  companyDescription: args.companyDescription || orgProfileData?.companyDescription || "Nonprofit organization providing social services, housing support, workforce development, and community engagement programs.",
                  welfareKeywords: args.welfareKeywords || ["501(c)(3) grants"],
                  eligibilityType: "nonprofit_501c3",
                  serviceAreas: args.serviceAreas || [],
                  populationsServed: args.populationsServed || [],
                  eligibilityTypes: args.eligibilityTypes || ["nonprofit_501c3"],
                  fundingInstruments: args.fundingInstruments || [],
                  fundingSources: args.fundingSources || ["federal"],
                  geoScope: args.geoScope || "state",
                  deadlineWindow: args.deadlineWindow || "any",
                  orgBudget: null,
                  orgStaffSize: null,
                  orgEin: "",
                  orgSamUei: "",
                  orgYearFounded: null,
                };

                const agentName = args.agentName || slotNames[targetIdx];

                const updatedAgents = { ...existingAgents };
                updatedAgents[targetSlot] = {
                  name: agentName,
                  config: newConfig,
                  active: true,
                };

                if (targetSessionRef) {
                  // Update existing session — merge agents + reset timing gate
                  await targetSessionRef.set({
                    agents: updatedAgents,
                    config: newConfig,
                    updatedAt: FieldValue.serverTimestamp(),
                    updatedBy: uid || "jarvis-chat",
                    lastScanTimes: { [targetSlot]: null },
                  }, { merge: true });
                } else {
                  // Create a brand-new session document
                  const sessionId = `session_${Date.now()}`;
                  targetSessionRef = adminDb.collection("grant_sessions").doc(sessionId);
                  await targetSessionRef.set({
                    orgId,
                    name: `Chat Agent — ${agentName}`,
                    color: "indigo",
                    config: newConfig,
                    agents: updatedAgents,
                    lastScanTimes: {},
                    searchMode: "federal",
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    updatedBy: uid || "jarvis-chat",
                    active: true,
                  });
                }

                functionResult = JSON.stringify({
                  result: `Successfully spawned grant prospecting subagent in slot ${targetIdx + 1}.`,
                  agentName,
                  slotNumber: targetIdx + 1,
                  slotId: targetSlot,
                  config: {
                    keywords: newConfig.welfareKeywords,
                    grantTypes: newConfig.grantTypes,
                    location: `${newConfig.locationCity}, ${newConfig.locationState}`,
                    scanInterval: `${newConfig.intervalValue} ${newConfig.intervalUnit}`,
                  }
                });
              }
            } catch (spawnErr: any) {
              functionResult = JSON.stringify({ error: "Failed to spawn grant agent: " + spawnErr.message });
            }
          } else if (functionName === "list_grant_agents") {
            try {
              await initAdmin();
              const adminDb = getAdminFirestore();
              const sessionsSnap = await adminDb.collection("grant_sessions")
                .where("orgId", "==", orgId)
                .get();

              const slotIds = ["agent_1", "agent_2", "agent_3", "agent_4"];
              const slotNames = ["Grant Scout Alpha", "Grant Scout Beta", "Grant Scout Gamma", "Grant Scout Delta"];

              // Aggregate agents from the first session (matches UI behavior)
              const agents: Record<string, any> = !sessionsSnap.empty
                ? (sessionsSnap.docs[0].data()?.agents || {})
                : {};

              const slots = slotIds.map((id, i) => {
                const slot = agents[id];
                return {
                  slotNumber: i + 1,
                  slotId: id,
                  name: slot?.name || slotNames[i],
                  active: slot?.active ?? false,
                  hasConfig: !!slot?.config,
                  keywords: slot?.config?.welfareKeywords || [],
                  grantTypes: slot?.config?.grantTypes || [],
                  location: slot?.config ? `${slot.config.locationCity || "Any"}, ${slot.config.locationState || "Any"}` : "Not configured",
                  scanInterval: slot?.config ? `${slot.config.intervalValue || "?"} ${slot.config.intervalUnit || "?"}` : "Not configured",
                };
              });

              const activeCount = slots.filter(s => s.active).length;
              functionResult = JSON.stringify({
                result: `${activeCount} of 4 agent slots are active.`,
                slots,
                availableSlots: 4 - activeCount,
                sessionCount: sessionsSnap.size,
              });
            } catch (listErr: any) {
              functionResult = JSON.stringify({ error: "Failed to list grant agents: " + listErr.message });
            }
          } else if (functionName === "delete_grant_agent") {
            try {
              const slotNum = args.slotNumber;
              if (!slotNum || slotNum < 1 || slotNum > 4) {
                functionResult = JSON.stringify({ error: "Invalid slot number. Must be 1, 2, 3, or 4." });
              } else {
                await initAdmin();
                const adminDb = getAdminFirestore();
                const sessionsSnap = await adminDb.collection("grant_sessions")
                  .where("orgId", "==", orgId)
                  .get();

                if (sessionsSnap.empty) {
                  functionResult = JSON.stringify({ error: "No active grant sessions found for this organization." });
                } else {
                  const sessionDoc = sessionsSnap.docs[0];
                  const agents = sessionDoc.data()?.agents || {};
                  const slotId = `agent_${slotNum}`;
                  const slotName = agents[slotId]?.name || `Agent ${slotNum}`;

                  // Deactivate the slot
                  const updatedAgents = { ...agents };
                  updatedAgents[slotId] = {
                    ...updatedAgents[slotId],
                    active: false,
                    config: null,
                  };

                  await sessionDoc.ref.set({
                    agents: updatedAgents,
                    updatedAt: FieldValue.serverTimestamp(),
                    updatedBy: uid || "jarvis-chat",
                  }, { merge: true });

                  functionResult = JSON.stringify({
                    result: `Successfully deactivated and cleared agent in slot ${slotNum} ("${slotName}"). The slot is now available for a new agent.`,
                  });
                }
              }
            } catch (delErr: any) {
              functionResult = JSON.stringify({ error: "Failed to delete grant agent: " + delErr.message });
            }
          } else if (functionName === "crm_create_contact") {
            try {
              const parsedInstances: CrmInstance[] = Array.isArray(crmInstances) ? crmInstances : [{ id: "default", name: "All Contacts" }];
              functionResult = await executeCrmCreateContact(orgId, crmInstanceId || "default", args, parsedInstances);
              console.log(`[CRM TOOL] Created contact: ${args.firstName} ${args.lastName || ""}`);
            } catch (crmErr: any) {
              functionResult = JSON.stringify({ error: "Failed to create contact: " + crmErr.message });
            }
          } else if (functionName === "crm_update_contact") {
            try {
              const parsedInstances: CrmInstance[] = Array.isArray(crmInstances) ? crmInstances : [{ id: "default", name: "All Contacts" }];
              functionResult = await executeCrmUpdateContact(orgId, crmInstanceId || "default", args, parsedInstances);
              console.log(`[CRM TOOL] Updated contact: ${args.searchQuery}`);
            } catch (crmErr: any) {
              functionResult = JSON.stringify({ error: "Failed to update contact: " + crmErr.message });
            }
          } else if (functionName === "crm_delete_contact") {
            try {
              const parsedInstances: CrmInstance[] = Array.isArray(crmInstances) ? crmInstances : [{ id: "default", name: "All Contacts" }];
              functionResult = await executeCrmDeleteContact(orgId, crmInstanceId || "default", args, parsedInstances);
              console.log(`[CRM TOOL] Delete contact request: ${args.searchQuery} (confirmed: ${args.confirmed})`);
            } catch (crmErr: any) {
              functionResult = JSON.stringify({ error: "Failed to delete contact: " + crmErr.message });
            }
          } else if (functionName === "crm_search_contacts") {
            try {
              const parsedInstances: CrmInstance[] = Array.isArray(crmInstances) ? crmInstances : [{ id: "default", name: "All Contacts" }];
              functionResult = await executeCrmSearchContacts(orgId, crmInstanceId || "default", args, parsedInstances);
              console.log(`[CRM TOOL] Searched contacts: ${args.query}`);
            } catch (crmErr: any) {
              functionResult = JSON.stringify({ error: "Failed to search contacts: " + crmErr.message });
            }
          } else if (functionName === "crm_list_contact_books") {
            try {
              const parsedInstances: CrmInstance[] = Array.isArray(crmInstances) ? crmInstances : [{ id: "default", name: "All Contacts" }];
              functionResult = await executeCrmListContactBooks(orgId, crmInstanceId || "default", parsedInstances);
              console.log(`[CRM TOOL] Listed contact books`);
            } catch (crmErr: any) {
              functionResult = JSON.stringify({ error: "Failed to list contact books: " + crmErr.message });
            }
          } else if (functionName === "crm_get_analytics") {
            try {
              const parsedInstances: CrmInstance[] = Array.isArray(crmInstances) ? crmInstances : [{ id: "default", name: "All Contacts" }];
              functionResult = await executeCrmGetAnalytics(orgId, crmInstanceId || "default", args, parsedInstances);
              console.log(`[CRM TOOL] Analytics requested: ${JSON.stringify(args.metrics)}`);
            } catch (crmErr: any) {
              functionResult = JSON.stringify({ error: "Failed to compute CRM analytics: " + crmErr.message });
            }
          } else if (functionName === "crm_resolve_contact") {
            try {
              const parsedInstances: CrmInstance[] = Array.isArray(crmInstances) ? crmInstances : [{ id: "default", name: "All Contacts" }];
              functionResult = await executeCrmResolveContact(orgId, args, parsedInstances);
              console.log(`[CRM TOOL] Resolved contact: ${args.name}`);
            } catch (crmErr: any) {
              functionResult = JSON.stringify({ error: "Failed to resolve contact: " + crmErr.message });
            }
          } else if (functionName === "crm_evaluate_contacts") {
            try {
              const parsedInstances: CrmInstance[] = Array.isArray(crmInstances) ? crmInstances : [{ id: "default", name: "All Contacts" }];
              functionResult = await executeCrmEvaluateContacts(orgId, crmInstanceId || "default", args, parsedInstances);
              console.log(`[CRM TOOL] Evaluate contacts: ${args.evaluationType}`);
            } catch (crmErr: any) {
              functionResult = JSON.stringify({ error: "Failed to evaluate contacts: " + crmErr.message });
            }
          } else if (functionName === "crm_batch_update") {
            try {
              const parsedInstances: CrmInstance[] = Array.isArray(crmInstances) ? crmInstances : [{ id: "default", name: "All Contacts" }];
              functionResult = await executeCrmBatchUpdate(orgId, crmInstanceId || "default", args, parsedInstances);
              console.log(`[CRM TOOL] Batch update: ${args.action?.type} (confirmed: ${args.confirmed})`);
            } catch (crmErr: any) {
              functionResult = JSON.stringify({ error: "Failed to batch update contacts: " + crmErr.message });
            }
          } else {
            functionResult = JSON.stringify({ error: "Unknown function or missing API access. Ensure Google account is connected with full workspace permissions." });
          }
      
      return functionResult;
    };

    let loopCount = 0;
    const MAX_LOOPS = 5;
    const executedTools: { name: string; args: any }[] = [];

    // ── MULTI-STEP ORCHESTRATOR ──
    // When the router detects a multi-domain request, go straight to the orchestrator.
    // Placed here because executeToolByName (defined above) must be in scope.
    if (routedDomain === 'MULTI' && wantStream && (gmail || calendar || docsApi || youtubeApi || uid)) {
      console.log(`[ORCHESTRATOR] Multi-step request detected, invoking orchestrator...`);
      const recentContext = messages.slice(-4)
        .filter((m: any) => m.role === 'user' || m.role === 'assistant')
        .map((m: any) => `${m.role}: ${(m.content || '').substring(0, 200)}`)
        .join('\n');

      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Emit routing event
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'routing', domain: 'MULTI', timestamp: Date.now() })}\n\n`));
            await new Promise(r => setTimeout(r, 100));
            
            // Run orchestrator with live event streaming
            const orchResult = await orchestrateMultiStep(
              lastUserText2,
              groqMessages[0].content, // system prompt
              tools,                    // master tools array
              executeToolByName,        // tool executor callback
              selectedModel === 'auto' ? autoSelectModel(lastUserText2, true) : selectedModel,
              recentContext,
              async (event) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                await new Promise(r => setTimeout(r, 100));
              }
            );
            
            // Stream final response as tokens
            const responseText = orchResult.finalResponse || 
              orchResult.stepResults.map((r: any) => `${r.success ? '✅' : '❌'} ${r.task}: ${r.result}`).join('\n\n') ||
              'I completed the orchestration but wasn\'t able to generate a summary. Please try again.';
            const words = responseText.split(/(?<=\s)/);
            let wordBuffer = '';
            for (let i = 0; i < words.length; i++) {
              wordBuffer += words[i];
              if (wordBuffer.length >= 8 || i === words.length - 1) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: wordBuffer })}\n\n`));
                wordBuffer = '';
              }
            }
            
            // Collect executed tools for done event
            const allExecutedTools: { name: string; args: object }[] = [];
            for (const sr of orchResult.stepResults) {
              for (const toolName of sr.toolsExecuted) {
                allExecutedTools.push({ name: toolName, args: {} });
              }
            }
            
            // Retrieve citations
            const lastUserMessageLocal = messages.filter((m: any) => m.role === 'user').pop();
            const citationsLocal = lastUserMessageLocal
              ? retrieveRelevantSnippets(lastUserMessageLocal.content || '', {
                  pactText: pactText || '',
                  knowledgeBaseText: knowledgeBaseText || '',
                  orgBrainText: orgBrainText || '',
                })
              : [];

            // Done event
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              done: true,
              usage: 0,
              executedTools: allExecutedTools.length > 0 ? allExecutedTools : undefined,
              citations: citationsLocal.length > 0 ? citationsLocal : undefined,
            })}\n\n`));
            
            controller.close();
          } catch (err: any) {
            console.error(`[ORCHESTRATOR] Orchestration failed:`, err?.message);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Orchestrator error: ' + (err?.message || 'unknown') })}\n\n`));
            controller.close();
          }
        }
      });
      
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // If LLM generated tool_calls but no APIs are available, re-call without tools
    if (responseMessage?.tool_calls && !gmail && !calendar && !docsApi && !youtubeApi && !uid) {
      console.log(`[DEBUG] LLM called tools but no APIs available — re-calling without tools`);
      completion = await createCompletionWithRetry(groqMessages, false);
      responseMessage = completion.choices[0]?.message;
    }

    // When we have stream + tools, restructure to stream events during execution
    if (wantStream && responseMessage?.tool_calls && (gmail || calendar || docsApi || youtubeApi || uid)) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // 1. Emit routing event immediately
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'routing', domain: routedDomain, timestamp: Date.now() })}\n\n`));
            await new Promise(r => setTimeout(r, 100));
            
            // 2. Emit planning/thinking event
            if (planningText) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', content: planningText, timestamp: Date.now() })}\n\n`));
              await new Promise(r => setTimeout(r, 300));
            }
            
            // 3. Execute tool loop with real-time events
            let localResponseMessage = responseMessage;
            let localLoopCount = loopCount;
            
            while (localResponseMessage?.tool_calls && (gmail || calendar || docsApi || youtubeApi || uid) && localLoopCount < MAX_LOOPS) {
              groqMessages.push(localResponseMessage);
              
              const sortedToolCalls = [...localResponseMessage.tool_calls].sort((a: any, b: any) => {
                const order = (name: string) => name === 'create_calendar_event' ? 0 : name === 'draft_outbound_email' ? 2 : 1;
                return order(a.function.name) - order(b.function.name);
              });
              
              for (const toolCall of sortedToolCalls) {
                const functionName = toolCall.function.name;
                
                // Emit tool_call event BEFORE execution — with delay so user sees it
                await new Promise(r => setTimeout(r, 150));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', tool: functionName, timestamp: Date.now() })}\n\n`));
                
                let functionResult = "";
                try {
                  const args = JSON.parse(toolCall.function.arguments);
                  executedTools.push({ name: functionName, args });
                  functionResult = await executeToolByName(functionName, args);
                } catch (err: any) {
                  functionResult = JSON.stringify({ error: err.message });
                }
                
                groqMessages.push({
                  tool_call_id: toolCall.id,
                  role: "tool",
                  name: functionName,
                  content: functionResult,
                });
              }
              
              completion = await createCompletionWithRetry(groqMessages, useTools);
              localResponseMessage = completion.choices[0]?.message;
              localLoopCount++;
            }
            
            // 4. Get final response text
            const finalText = localResponseMessage?.content
              || responseMessage?.content
              || "I've completed the task. Is there anything else you'd like me to do?";
            
            // 5. Stream final text as tokens
            const words = finalText.split(/(?<=\s)/);
            let wordBuffer = '';
            for (let i = 0; i < words.length; i++) {
              wordBuffer += words[i];
              if (wordBuffer.length >= 8 || i === words.length - 1) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: wordBuffer })}\n\n`));
                wordBuffer = '';
              }
            }
            
            // 6. Log usage
            const inputTokens2 = completion?.usage?.prompt_tokens || 0;
            const outputTokens2 = completion?.usage?.completion_tokens || 0;
            const totalTokens2 = completion?.usage?.total_tokens || 0;
            try {
              logAIUsage({
                userId: uid || "anonymous",
                orgId: isNxtChapter ? "nxtchapter" : "soltheory",
                model: selectedModel,
                provider: "groq",
                inputTokens: inputTokens2,
                outputTokens: outputTokens2,
                totalTokens: totalTokens2,
                endpoint: "/api/chat",
                costUsd: calculateGroqCost(selectedModel, inputTokens2, outputTokens2),
                timestamp: new Date(),
              });
            } catch (e) { /* non-blocking */ }
            
            // Calculate citations for done event
            const lastUserMessageLocal = messages.filter((m: any) => m.role === 'user').pop();
            const citationsLocal = lastUserMessageLocal
              ? retrieveRelevantSnippets(lastUserMessageLocal.content || '', {
                  pactText: pactText || '',
                  knowledgeBaseText: knowledgeBaseText || '',
                  orgBrainText: orgBrainText || '',
                })
              : [];

            // 7. Done event
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              done: true,
              usage: totalTokens2,
              executedTools: executedTools.length > 0 ? executedTools : undefined,
              enrichmentUrls: enrichmentUrls.length > 0 ? enrichmentUrls : undefined,
              citations: citationsLocal.length > 0 ? citationsLocal : undefined,
            })}\n\n`));
            
            controller.close();
          } catch (streamErr: any) {
            console.error('[STREAM] Error during live tool streaming:', streamErr);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
            controller.close();
          }
        }
      });
      
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Execute Tool Loop if Triggered
    while (responseMessage?.tool_calls && (gmail || calendar || docsApi || youtubeApi || uid) && loopCount < MAX_LOOPS) {
      groqMessages.push(responseMessage);

      // Sort tool calls: process calendar events BEFORE email drafts so Meet links are available
      const sortedToolCalls = [...responseMessage.tool_calls].sort((a: any, b: any) => {
        const order = (name: string) => name === 'create_calendar_event' ? 0 : name === 'draft_outbound_email' ? 2 : 1;
        return order(a.function.name) - order(b.function.name);
      });
      for (const toolCall of sortedToolCalls) {
        const functionName = toolCall.function.name;
        console.log(`[TOOL CALL] LLM requested tool: ${functionName} | args: ${toolCall.function.arguments?.substring(0, 200)}`);

        let functionResult = "";
        try {
          const args = JSON.parse(toolCall.function.arguments);
          executedTools.push({ name: functionName, args });
          functionResult = await executeToolByName(functionName, args);
        } catch (err: any) {
          functionResult = JSON.stringify({ error: err.message });
        }

        // Push Result Object back onto context array
        groqMessages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: functionResult,
        });
      }

      // PASS: Agent processes tool outputs and decides next step
      completion = await createCompletionWithRetry(groqMessages, useTools);

      responseMessage = completion.choices[0]?.message;
      loopCount++;
    }

    // Log AI usage (non-blocking, don't let it crash the request)
    const inputTokens = completion?.usage?.prompt_tokens || 0;
    const outputTokens = completion?.usage?.completion_tokens || 0;
    const totalTokens = completion?.usage?.total_tokens || 0;
    const model = selectedModel;
    try {
      logAIUsage({
        userId: uid || "anonymous",
        orgId: isNxtChapter ? "nxtchapter" : "soltheory",
        model,
        provider: "groq",
        endpoint: "/api/chat",
        inputTokens,
        outputTokens,
        totalTokens,
        costUsd: calculateGroqCost(model, inputTokens, outputTokens),
        timestamp: new Date(),
      });
    } catch (logErr) {
      console.warn("[AI Usage] Logging failed (non-fatal):", (logErr as any)?.message);
    }

    // --- P.A.C.T. Extraction (extract facts, return to client for saving) ---
    // --- Sanitize response: strip hallucinated XML tool calls ---
    const sanitizeResponse = (text: string): string => {
      if (!text) return text;
      // Convert HTML to markdown
      let clean = text.replace(/<b>(.*?)<\/b>/gi, '**$1**');
      clean = clean.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
      clean = clean.replace(/<i>(.*?)<\/i>/gi, '*$1*');
      clean = clean.replace(/<em>(.*?)<\/em>/gi, '*$1*');
      clean = clean.replace(/<br\s*\/?>/gi, '\n');
      clean = clean.replace(/<\/?p>/gi, '\n');
      clean = clean.replace(/<[^>]+>/g, ''); // Strip remaining HTML tags

      // Remove <function=...>...</function>, <search_past_conversations>...</search_past_conversations>, etc.
      clean = clean.replace(/<\/?(?:function|search_past_conversations|search_emails|create_folder|send_email|draft_email|delete_email|create_calendar_event|get_calendar_events|create_google_document|create_youtube_video|create_spreadsheet|create_presentation|search_google_drive|read_google_drive_file|web_search)[^>]*>/gi, '');
      // Remove JSON-like tool args (single or multi-key objects) that were hallucinated inline
      clean = clean.replace(/\{\s*"(?:query|folderName|to|subject|body|title|date|time|description|videoTitle|content|searchQuery|fileId|type|name|function|arguments|tool_call)"\s*:(?:[^{}]|\{[^{}]*\})*\}/g, '');
      // Remove leftover JSON arrays from hallucinated tool calls
      clean = clean.replace(/\[\s*\{\s*"(?:query|type|name|function)"[^\]]*\]\s*/g, '');
      // Remove code fence blocks wrapping JSON tool calls
      clean = clean.replace(/```(?:json)?\s*\{[^`]*\}\s*```/gi, '');
      // Remove lines that are purely JSON-like
      clean = clean.replace(/^\s*[\[{]\s*"[^"]+"\s*:.*[}\]]\s*$/gm, '');
      // Collapse multiple whitespace/newlines
      clean = clean.replace(/\n{3,}/g, '\n\n').trim();
      // If the cleaned response is empty or too short, provide a contextual fallback
      if (clean.length < 5) {
        clean = "I'm sorry, I wasn't able to process that properly. Could you try rephrasing your question?";
      }
      return clean;
    };

    let finalResponseText = responseMessage?.content || "";

    // --- EMPTY RESPONSE SAFEGUARD ---
    // If the model returned absolutely nothing, do a clean re-generation
    // IMPORTANT: Use the full groqMessages (which has soul, brain, PACT, KB, CRM context)
    // instead of a stripped-down prompt, so JARVIS retains its full identity and knowledge.
    if (!finalResponseText.trim() && executedTools.length === 0) {
      console.warn("[SAFEGUARD] Model returned empty response. Re-generating with full context...");
      try {
        // Use createCompletion with full context — strip only tool-related messages
        const cleanMessages = groqMessages.filter((m: any) => m.role !== "tool" && !m.tool_calls);
        // Append a nudge instruction so the model knows to actually respond
        cleanMessages.push({
          role: "system",
          content: "IMPORTANT: Your previous response was empty. You MUST respond to the user's message with a helpful, natural language answer. Do not output JSON, code, or tool calls. Respond conversationally."
        });
        const safeguardResult = await createCompletion({
          messages: cleanMessages,
          model: selectedModel,
          temperature: 0.7,
          maxTokens: 4096,
        });
        finalResponseText = safeguardResult.content || "I'm here and ready to help! Could you try asking me that again?";
      } catch (safeguardErr) {
        console.error("[SAFEGUARD] Re-generation also failed:", (safeguardErr as any)?.message);
        finalResponseText = "I'm here! I had a momentary hiccup processing that. Could you try asking me again?";
      }
    }

    // --- HALLUCINATED TOOL CALL RECOVERY ---
    // If the model hallucinated a web_search call in its text (instead of using tool_calls),
    // detect it and actually execute the search so the user gets a real answer.
    // Detect hallucinated tool calls — match JSON with "query" key (single or multi-key)
    const hallucinatedSearchMatch = finalResponseText.match(/\{[^{}]*"query"\s*:\s*"([^"]+)"[^{}]*\}/);
    // Also detect if the ENTIRE response is basically just JSON garbage
    const isEntirelyJSON = /^\s*[\[{]/.test(finalResponseText.trim()) && /[}\]]\s*$/.test(finalResponseText.trim());

    if ((hallucinatedSearchMatch || isEntirelyJSON) && executedTools.length === 0) {
      // Extract the query from JSON, or fall back to using the user's original message
      const hallucinatedQuery = hallucinatedSearchMatch?.[1] || messages[messages.length - 1]?.content || "general search";
      console.log(`[RECOVERY] Detected hallucinated output for: "${hallucinatedQuery}". Executing real search + re-generation...`);
      try {
        const tavilyKey = process.env.TAVILY_API_KEY;
        if (tavilyKey) {
          const searchRes = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: tavilyKey,
              query: hallucinatedQuery,
              search_depth: "basic",
              include_answer: true,
              max_results: 5,
            }),
          });
          const searchData = await searchRes.json();
          if (searchRes.ok) {
            const results = (searchData.results || []).map((r: any) => ({
              title: r.title,
              url: r.url,
              snippet: (r.content || "").substring(0, 300),
            }));
            executedTools.push({ name: 'web_search', args: { query: hallucinatedQuery, searchResults: results } });

            // Build search context for re-generation
            const searchContext = searchData.answer
              ? `Web Search Answer: ${searchData.answer}\n\nSources:\n${results.map((r: any) => `- ${r.title}: ${r.url}\n  ${r.snippet}`).join("\n")}`
              : `Search Results:\n${results.map((r: any) => `- ${r.title}: ${r.url}\n  ${r.snippet}`).join("\n")}`;

            // Use a stable ID for tool_call matching
            const recoveryId = `recovery_${Date.now()}`;
            groqMessages.push({
              role: "assistant",
              content: null,
              tool_calls: [{
                id: recoveryId,
                type: "function",
                function: { name: "web_search", arguments: JSON.stringify({ query: hallucinatedQuery }) }
              }]
            });
            groqMessages.push({
              tool_call_id: recoveryId,
              role: "tool",
              name: "web_search",
              content: JSON.stringify({ result: searchContext }),
            });

            // Use the unified LLM router (not raw Groq) so the user's selected model is always used
            const recoveryResult = await createCompletion({
              messages: groqMessages,
              model: selectedModel,
              temperature: 0.7,
              maxTokens: 4096,
            });
            finalResponseText = recoveryResult.content || finalResponseText;
          }
        }
      } catch (recoveryErr) {
        console.error("[RECOVERY] Web search recovery failed:", recoveryErr);
        // If recovery fails entirely, re-generate using full context (not a stripped generic prompt)
        try {
          const cleanMessages = groqMessages.filter((m: any) => m.role !== "tool" && !m.tool_calls);
          cleanMessages.push({
            role: "system",
            content: "IMPORTANT: Your previous response contained raw JSON instead of natural language. You MUST respond with a helpful, conversational answer. Never output JSON or code."
          });
          const fallbackResult = await createCompletion({
            messages: cleanMessages,
            model: selectedModel,
            temperature: 0.7,
            maxTokens: 4096,
          });
          finalResponseText = fallbackResult.content || "I wasn't able to process that. Could you try rephrasing?";
        } catch { /* use sanitized original */ }
      }
    }

    let finalResponse = sanitizeResponse(finalResponseText);

    // Quality guardrail removed for speed — llama-3.1-8b-instant is fast enough
    // that a single LLM call is preferable to the latency of a retry.

    // Self-refinement pass removed for speed — the primary LLM call with
    // enriched context already produces high-quality output.

    // Retrieve knowledge base citations for the user's latest message
    const lastUserMessage = messages.filter((m: any) => m.role === "user").pop();
    const citations = lastUserMessage
      ? retrieveRelevantSnippets(lastUserMessage.content || "", {
          pactText: pactText || "",
          knowledgeBaseText: knowledgeBaseText || "",
          orgBrainText: orgBrainText || "",
        })
      : [];

    // --- RESPONSE: SSE Streaming or JSON ---
    if (wantStream) {
      // SSE streaming path for tool-call responses — re-stream the final response
      // using true Groq streaming so tokens appear immediately
      console.log(`[STREAM] Post-tool streaming path — re-streaming final response with model: ${selectedModel}`);
      const encoder = new TextEncoder();

      // Re-request the final synthesis as a true stream from Groq
      // This avoids the fake word-splitting approach
      const postToolMessages = [
        ...groqMessages,
        { role: "assistant", content: finalResponse }
      ];
      // For post-tool, we already have the final text, so stream it efficiently
      // using real Groq streaming for the synthesis pass
      const responseText = finalResponse || "I'm here and ready to help! Could you try asking me that again?";
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Emit agent events before streaming text
            const agentEvents: AgentEvent[] = [];
            agentEvents.push({ type: 'routing', domain: routedDomain, timestamp: Date.now() });
            for (const tool of executedTools) {
              agentEvents.push({ type: 'tool_call', tool: tool.name, timestamp: Date.now() });
            }
            for (const evt of agentEvents) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
            }

            // Stream the already-generated response in small word chunks
            // (tool paths require the full response for sanitization/recovery first)
            const words = responseText.split(/(?<=\s)/);
            let wordBuffer = '';
            for (let i = 0; i < words.length; i++) {
              wordBuffer += words[i];
              if (wordBuffer.length >= 8 || i === words.length - 1) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: wordBuffer })}\n\n`));
                wordBuffer = '';
              }
            }
            // Send final metadata event
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              done: true,
              usage: totalTokens,
              executedTools: executedTools.length > 0 ? executedTools : undefined,
              enrichmentUrls: enrichmentUrls.length > 0 ? enrichmentUrls : undefined,
              citations: citations.length > 0 ? citations : undefined,
            })}\n\n`));
            controller.close();
          } catch (streamErr) {
            console.error('[STREAM] Error during post-tool streaming:', streamErr);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
            controller.close();
          }
        }
      });
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Fire-and-forget server-side PACT extraction for non-streaming path (voice, fallback)
    const nonStreamResponseText = finalResponse || "";
    if (uid && userName && nonStreamResponseText.length > 20) {
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
      if (lastUserMsg.length > 5) {
        extractPACTFacts(lastUserMsg, nonStreamResponseText, userName, messages.slice(-6))
          .then(async (facts) => {
            if (facts.length === 0) return;
            try {
              await initAdmin();
              const db = getAdminFirestore();
              const userRef = db.collection("users").doc(uid);
              const userDoc = await userRef.get();
              const existingEntries: any[] = userDoc.data()?.pact_entries_soltheory || [];
              const existingQuestions = new Set(existingEntries.map((e: any) => e.question?.toLowerCase().trim()));
              const newEntries = facts
                .filter(f => !existingQuestions.has(f.question?.toLowerCase().trim()))
                .map(f => ({
                  question: f.question,
                  answer: f.answer,
                  confidence: f.confidence || "medium",
                  category: f.category || "preference",
                  source: "server_background",
                  orgId,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                }));
              if (newEntries.length > 0) {
                const totalAfter = existingEntries.length + newEntries.length;
                if (totalAfter > 200) {
                  const sorted = [...existingEntries].sort((a, b) => {
                    const confScore: Record<string, number> = { high: 3, medium: 2, low: 1 };
                    return (confScore[a.confidence] || 2) - (confScore[b.confidence] || 2) || (a.createdAt || 0) - (b.createdAt || 0);
                  });
                  const toRemove = totalAfter - 200;
                  const remaining = existingEntries.filter((e: any) => !sorted.slice(0, toRemove).includes(e));
                  await userRef.update({ pact_entries_soltheory: [...remaining, ...newEntries] });
                } else {
                  await userRef.update({ pact_entries_soltheory: FieldValue.arrayUnion(...newEntries) });
                }
                console.log(`[PACT Server] Extracted ${newEntries.length} new facts for user ${uid} (non-stream)`);
              }
            } catch (dbErr) {
              console.warn("[PACT Server] Firestore write failed:", (dbErr as any)?.message);
            }
          })
          .catch(err => console.warn("[PACT Server] Background extraction failed:", (err as any)?.message));
      }
    }

    // Default JSON Response (non-streaming fallback for voice, title gen, retries)
    return NextResponse.json({
      response: finalResponse || "I'm here and ready to help! Could you try asking me that again?",
      usage: totalTokens,
      executedTools: executedTools.length > 0 ? executedTools : undefined,
      enrichmentUrls: enrichmentUrls.length > 0 ? enrichmentUrls : undefined,
      citations: citations.length > 0 ? citations : undefined,
    });
  } catch (error: any) {
    console.error("[DEBUG SERVER] Groq Error Catch Block:", error?.message || error, JSON.stringify(error?.error || {}));

    const errMsg = error?.message || "";
    const isRateLimit = errMsg.includes("rate_limit") || errMsg.includes("429");
    const isBilling = errMsg.includes("spend alert") || errMsg.includes("blocked API access") || errMsg.includes("billing");
    const isContextLength = errMsg.includes("context_length") || errMsg.includes("too many tokens") || errMsg.includes("maximum context");
    const isToolError = errMsg.includes("tool_use_failed") || errMsg.includes("Failed to call a function") || errMsg.includes("tool_calls");
    const isAuth = errMsg.includes("auth") || errMsg.includes("API key") || errMsg.includes("401");

    const friendlyMsg = isRateLimit
      ? "I'm receiving a lot of requests right now. Please wait a moment and try again."
      : isBilling
      ? "⚠️ The AI service (Groq) has been paused due to a billing/spend limit. Please check your Groq dashboard at console.groq.com to resolve this, then try again."
      : isContextLength
      ? "Your conversation is getting quite long! Try starting a new chat session, or I can summarize what we've discussed so far."
      : isToolError
      ? "I ran into a small issue with one of my tools. Could you try asking me that one more time?"
      : "I had a momentary hiccup. Could you try asking me that again? I'm ready to help!";

    const statusCode = isAuth ? 401 : isRateLimit ? 429 : isBilling ? 402 : 500;
    return NextResponse.json({ response: friendlyMsg, error: errMsg }, { status: statusCode });
  }
}
