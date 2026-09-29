import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";

/**
 * CRM Contact Chat API — AI-powered conversational assistant for contact intelligence
 * 
 * Provider cascade: Gemini → Groq
 * Extracts relationship facts, personal preferences, and conversation notes,
 * returning structured memory items alongside natural conversational answers.
 * Supports real-time Tavily web research to discover up-to-date background, sports,
 * news, and personal interests about contacts on demand.
 */

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
}

interface TavilySearchData {
  answer: string;
  results: TavilySearchResult[];
}

/* ─── Web Search Intent Detector ─── */
function detectWebSearchIntent(
  userMessage: string,
  contactData: any,
  existingContext: string
): { shouldSearch: boolean; searchQuery: string } {
  const msg = (userMessage || "").trim();
  const lowerMsg = msg.toLowerCase();

  // 1. Explicit search phrases
  const explicitSearchRegex = /\b(search(\s+the\s+web|\s+online)?|look\s*up|google|find(\s+out)?|research(\s+online)?|browse|check\s+online|dig\s+up|web\s+search|internet)\b/i;
  const isExplicitSearch = explicitSearchRegex.test(msg);

  // 2. External info inquiry topics
  const externalTopicRegex = /\b(sports?|hobb(y|ies)|favorite\s+team|football|basketball|baseball|soccer|golf|tennis|nfl|nba|college|alma\s+mater|university|school|degrees?|career|background|news|press\s+release|funding|company|product|achievements?|awards?|linkedin|twitter|social\s+media)\b/i;
  const isExternalTopic = externalTopicRegex.test(msg);

  // 3. Determine if search is needed
  let shouldSearch = false;
  if (isExplicitSearch) {
    shouldSearch = true;
  } else if (isExternalTopic) {
    const contextLower = (existingContext || "").toLowerCase();
    const topicKeywords = lowerMsg.match(/\b(sports?|football|basketball|soccer|golf|tennis|nfl|nba|hobbies|college|university|school|degree|news|funding)\b/g) || [];
    const isAlreadyInMemory = topicKeywords.length > 0 && topicKeywords.some(w => contextLower.includes(w));
    const isQuestion = /\b(what|who|where|does\s+he|does\s+she|any\s+news|is\s+there)\b/i.test(msg);

    if (isQuestion && !isAlreadyInMemory) {
      shouldSearch = true;
    }
  }

  if (!shouldSearch) {
    return { shouldSearch: false, searchQuery: "" };
  }

  // Construct search query tailored to contact and user question
  const fullName = [contactData?.firstName, contactData?.lastName].filter(Boolean).join(" ");
  const company = (contactData?.company || "").trim();

  const cleanTopic = msg
    .replace(/\b(can\s+you|could\s+you|please|search\s+the\s+web\s+(for|to\s+see)?|search\s+online\s+(for)?|look\s*up|find\s+out|tell\s+me|google|who\s+is|what\s+is|what\s+kind\s+of|do\s+you\s+know\s+if|i\s+want\s+to\s+know|about|for|he|she|his|her|they|their)\b/gi, " ")
    .replace(/[?!.,'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isCompanyQuery = /\b(company|business|startup|firm|enterprise|funding|valuation)\b/i.test(msg) && !/\b(sports?|hobb|personal|family)\b/i.test(msg);

  let searchQuery = "";
  if (isCompanyQuery && company) {
    searchQuery = `"${company}" ${cleanTopic.replace(/\bcompany\b/gi, "").trim() || "recent news updates"}`.trim();
  } else if (fullName) {
    const companyPart = company ? `"${company}"` : "";
    searchQuery = `"${fullName}" ${companyPart} ${cleanTopic}`.trim();
  } else if (company) {
    searchQuery = `"${company}" ${cleanTopic}`.trim();
  } else {
    searchQuery = cleanTopic || msg;
  }

  return { shouldSearch: true, searchQuery };
}

/* ─── Execute Tavily Live Web Search ─── */
async function executeTavilySearch(query: string): Promise<TavilySearchData | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[CRM Contact Chat] TAVILY_API_KEY not configured");
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500);

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        include_answer: true,
        max_results: 5,
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn("[CRM Contact Chat] Tavily search HTTP error:", res.status);
      return null;
    }

    const data = await res.json();
    const answer = data.answer || "";
    const rawResults = data.results || [];

    const filteredResults: TavilySearchResult[] = rawResults
      .filter((r: any) => {
        const title = (r.title || "").toLowerCase();
        const content = (r.content || "").toLowerCase();
        const url = (r.url || "").toLowerCase();

        // Safety filter
        if (/mugshot|arrest|criminal|inmate|convict|jail|offender|court\s*record/i.test(title + " " + content)) {
          return false;
        }
        if (/recruiting profile|maxpreps|milesplit|ncsasports|hudl\.com|247sports/i.test(url)) {
          return false;
        }
        return true;
      })
      .slice(0, 4)
      .map((r: any) => ({
        title: r.title || "Web Source",
        url: r.url || "",
        content: (r.content || "").slice(0, 350),
      }));

    return {
      answer,
      results: filteredResults,
    };
  } catch (err: any) {
    console.warn("[CRM Contact Chat] Tavily fetch error:", err?.message || err);
    return null;
  }
}

/* ─── Format Web Search Results for System Prompt ─── */
function formatWebSearchResults(query: string, searchData: TavilySearchData): string {
  const parts: string[] = [];
  parts.push(`Search Query: "${query}"`);
  if (searchData.answer) {
    parts.push(`Tavily AI Summary: ${searchData.answer}`);
  }
  if (searchData.results.length > 0) {
    parts.push("Sources Found:");
    searchData.results.forEach((r, idx) => {
      parts.push(`${idx + 1}. [${r.title}](${r.url})\n   Excerpt: ${r.content}`);
    });
  }
  return parts.join("\n\n");
}

/* ─── Build system prompt with contact context & fact extraction instructions ─── */
function buildSystemPrompt(
  contactData: any,
  insights: string[],
  activitySummary: string,
  webSearchResults?: string
): string {
  const contactName = [contactData?.firstName, contactData?.lastName].filter(Boolean).join(" ") || "this contact";

  return `You are Jarvis, a relationship intelligence assistant embedded in the CRM for ${contactName}.
You have access to all known data, AI enrichment research, and interaction history for this contact (injected below).

YOUR CAPABILITIES:
1. Conversational CRM Assistance: Answer questions about ${contactName}, draft contextual emails, synthesize background, or brainstorm meeting talking points.
2. Fact Extraction & Relationship Memory:
   You actively listen for and identify NEW or NOTEWORTHY facts about ${contactName} revealed during the conversation (either shared by the user, discussed in dialogue, or uncovered through live web research).
   Categories of facts to watch for:
   - "interest": Sports teams, hobbies, leisure activities, favorite athletes, music, books, food preferences (e.g. "Huge Denver Broncos fan", "Loves playing tennis", "Enjoys golf").
   - "preference": Communication methods, meeting time preferences, working styles, dietary restrictions (e.g. "Prefers text/WhatsApp over email", "Best reached mornings before 10 AM", "Vegan").
   - "background": Alma mater, hometown, past employers, degrees, military service, prior ventures (e.g. "Stanford alum", "Former Navy pilot").
   - "family": Spouse name, kids, pets (e.g. "Daughter plays soccer", "Has a Golden Retriever named Max").
   - "work": Key business priorities, upcoming product launches, budget cycles, tech stack, pain points.

RESPONSE FORMAT:
You must ALWAYS respond with a JSON object in this exact format:
{
  "reply": "Your natural, helpful markdown response to the user. When citing web sources, use markdown links like [Source Title](URL).",
  "extractedFacts": [
    { "fact": "Concise, stand-alone factual statement about ${contactName}", "category": "interest|preference|background|family|work" }
  ]
}

SPECIAL ACTIONS (when explicitly requested):
- When the user says 'make a note' or 'log a note' or asks you to add/create a note:
  {"action": "add_note", "content": "...the note text...", "reply": "I've added that note to the timeline."}
- When the user says 'generate insights' or 'enrich' or asks to research this contact:
  {"action": "generate_insights", "reply": "Starting web research and insight generation now..."}

CRITICAL RULES:
1. "extractedFacts" must ONLY contain genuine new facts about ${contactName}. Do NOT extract facts about the user. If no new facts about ${contactName} were mentioned in the latest message or search results, set "extractedFacts": [].
2. When the user asks about facts that were ALREADY discovered or recorded in the past (e.g. "what sports does he like?"), answer naturally using the Past Research, Activity Timeline, or Notes below. You do NOT need to re-extract an existing fact into "extractedFacts" when simply answering a question about it.
3. Keep your "reply" friendly, concise, and helpful.
${webSearchResults ? `
4. LIVE REAL-TIME WEB RESEARCH:
   Live web research was executed for this query!
   - Synthesize the web search findings directly into your answer for the user.
   - Always cite sources using markdown links: [Source Title](URL).
   - If the search results revealed ANY new facts about ${contactName} (such as favorite sports teams, hobbies, background, education, company milestones, or personal preferences), extract them into the "extractedFacts" array so they are permanently saved to the contact's dossier and activity timeline!
` : ""}

--- CURRENT CONTACT DATA ---
${JSON.stringify(contactData || {}, null, 2)}

--- PAST RESEARCH & INSIGHTS ---
${Array.isArray(insights) && insights.length > 0 ? insights.join("\n---\n") : "None yet"}

--- RECENT ACTIVITY & INTERACTION TIMELINE ---
${activitySummary || "No activity recorded yet"}
${webSearchResults ? `
--- LIVE REAL-TIME WEB SEARCH RESULTS ---
${webSearchResults}
` : ""}
`;
}

interface ContactChatParsedOutput {
  reply: string;
  action?: string;
  content?: string;
  extractedFacts: Array<{ fact: string; category: string }>;
}

/* ─── Robust Output Parser ─── */
function parseModelOutput(rawText: string): ContactChatParsedOutput {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  try {
    const parsed = JSON.parse(cleaned);

    // Schema 2: Legacy action (add_note, generate_insights)
    if (parsed.action) {
      return {
        reply: parsed.reply || parsed.content || "",
        action: parsed.action,
        content: parsed.content,
        extractedFacts: Array.isArray(parsed.extractedFacts) ? parsed.extractedFacts : [],
      };
    }

    // Schema 1: Standard response with reply + extractedFacts
    const replyText = parsed.reply || parsed.response || parsed.message || (typeof parsed === "string" ? parsed : JSON.stringify(parsed));
    return {
      reply: replyText,
      extractedFacts: Array.isArray(parsed.extractedFacts) ? parsed.extractedFacts : [],
    };
  } catch {
    // If JSON parsing fails, search for embedded JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          reply: parsed.reply || parsed.response || parsed.message || cleaned,
          action: parsed.action,
          content: parsed.content,
          extractedFacts: Array.isArray(parsed.extractedFacts) ? parsed.extractedFacts : [],
        };
      } catch {
        // Fall back to raw text
      }
    }
    return { reply: rawText, extractedFacts: [] };
  }
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
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.warn(`[CRM Chat] Gemini ${model} error ${res.status}:`, errBody.slice(0, 200));
        continue;
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
      response_format: { type: "json_object" },
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

    // ─── Detect live web search intent and execute Tavily search if needed ───
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
    const existingContext = [
      ...(Array.isArray(insights) ? insights : []),
      activitySummary || "",
      contactData?.aiNotes || "",
      contactData?.notes || "",
    ].join("\n");

    const searchIntent = detectWebSearchIntent(lastUserMsg, contactData, existingContext);
    let webSearchResultsFormatted = "";
    let searchSourcesMeta: Array<{ title: string; url: string }> = [];

    if (searchIntent.shouldSearch) {
      try {
        console.log(`[CRM Contact Chat] Executing live web search for: "${searchIntent.searchQuery}"`);
        const searchData = await executeTavilySearch(searchIntent.searchQuery);
        if (searchData && (searchData.answer || searchData.results.length > 0)) {
          searchSourcesMeta = searchData.results.map(r => ({ title: r.title, url: r.url }));
          webSearchResultsFormatted = formatWebSearchResults(searchIntent.searchQuery, searchData);
        }
      } catch (searchErr: any) {
        console.warn("[CRM Contact Chat] Web search error:", searchErr?.message || searchErr);
      }
    }

    const systemPrompt = buildSystemPrompt(contactData, insights, activitySummary, webSearchResultsFormatted);

    // ─── Try Gemini first ───
    try {
      const geminiContents = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: JSON.stringify({ reply: "Understood. I am Jarvis, your relationship intelligence assistant for this contact.", extractedFacts: [] }) }] },
      ];

      for (const msg of messages) {
        geminiContents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) }],
        });
      }

      const text = await chatWithGemini(geminiContents);
      const parsed = parseModelOutput(text);
      return NextResponse.json({
        response: parsed.reply,
        action: parsed.action,
        content: parsed.content,
        extractedFacts: parsed.extractedFacts,
        webSearchExecuted: !!webSearchResultsFormatted,
        searchQuery: searchIntent.searchQuery || undefined,
        searchSources: searchSourcesMeta.length > 0 ? searchSourcesMeta : undefined,
      });
    } catch (geminiErr: any) {
      console.warn("[CRM Chat] Gemini cascade failed, falling back to Groq:", geminiErr.message);
    }

    // ─── Groq fallback ───
    try {
      const groqMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map((m: any) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        })),
      ];

      const text = await chatWithGroq(groqMessages);
      const parsed = parseModelOutput(text);
      return NextResponse.json({
        response: parsed.reply,
        action: parsed.action,
        content: parsed.content,
        extractedFacts: parsed.extractedFacts,
        webSearchExecuted: !!webSearchResultsFormatted,
        searchQuery: searchIntent.searchQuery || undefined,
        searchSources: searchSourcesMeta.length > 0 ? searchSourcesMeta : undefined,
      });
    } catch (groqErr: any) {
      console.error("[CRM Chat] Groq fallback also failed:", groqErr.message);
      return NextResponse.json({ error: "All AI providers are currently unavailable. Please try again in a moment." }, { status: 502 });
    }

  } catch (error: any) {
    console.error("[CRM Contact Chat] Error:", error?.message || error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

