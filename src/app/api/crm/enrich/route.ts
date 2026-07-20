import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";

/**
 * CRM Contact Enrichment API — Production-Grade
 * 
 * Architecture:
 *   1. ALWAYS run Tavily web search first to gather real data
 *   2. Feed Tavily results + contact data into LLM for structured analysis
 *   3. Cascade through LLM providers: Gemini → Groq
 *   4. If all LLMs fail, format raw Tavily results directly
 *   5. Validate response quality before returning
 * 
 * Content Safety:
 *   - Filters out sensitive/inappropriate web results (criminal cases, legal proceedings, etc.)
 *   - Warns when search results may reference multiple people with the same name
 *   - Never fabricates social profiles or guesses URLs
 *   - Handles personal email domains (gmail, yahoo, etc.) properly
 */

/* ─── Constants ─── */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "aol.com", "protonmail.com", "mail.com", "zoho.com", "yandex.com",
  "live.com", "msn.com", "me.com", "mac.com", "googlemail.com",
]);

/** Keywords that indicate content we should NOT surface in a business CRM */
const SENSITIVE_KEYWORDS = [
  "sexual assault", "rape", "murder", "homicide", "arrested", "criminal charges",
  "felony", "manslaughter", "abuse", "domestic violence", "restraining order",
  "indictment", "sex offender", "trafficking", "child abuse", "obituary",
  "died", "death", "funeral", "memorial service", "passed away",
];

/* ─── Enrichment System Prompt ─── */
const ENRICHMENT_SYSTEM_PROMPT = `You are Jarvis, a CRM intelligence assistant. You enrich contact profiles by combining web research data with CRM records to produce actionable **business** intelligence for sales, partnerships, or client management.

CRITICAL RULES:
1. Only include information that is RELEVANT TO BUSINESS — professional background, company info, industry, job role, business activity.
2. NEVER include sensitive personal information: legal cases, criminal records, health issues, political affiliations, religious beliefs, family drama, or personal controversies.
3. If web results reference multiple different people with the same name, clearly state this and only include information you can confidently attribute to the correct person. Use email, company, phone, location, job title, industry, or website to disambiguate and filter out wrong matches.
4. NEVER fabricate or guess social media URLs. Only include URLs that were explicitly found in the web research results. If no LinkedIn/social was found, say "Not found in web search" — do NOT construct a URL.
5. If the contact uses a free email domain (gmail.com, yahoo.com, etc.), do NOT list that domain as a company website. State "Personal email — no company domain" instead.
6. Be honest about confidence levels. If you're unsure whether a web result is about the right person, say so.
7. KEEP IT CONCISE: Each section must be extremely short. Limit the entire response to less than 150 words total. Use brief, punchy sentences and bullet points. Avoid filler text.

FORMAT your response with these exact bold section headers:

**Professional Summary**
A very concise 1-2 sentence overview of who this person is professionally (what they do, what industry, what company). Base this ONLY on information you're confident is about the correct person. If there's not enough info, say "Limited professional information available — consider asking the contact directly or adding their company name/job title for better results."

**Verified Web Presence**
List ONLY URLs/profiles that were explicitly found in the web research and are confirmed to be the right person. Format:
- [Platform]: [URL]
If nothing was confidently found, state: "No verified profiles found."

**Business Context**
Any business-relevant context (their company's industry, size, recent news, or products). Only include if a company was identified. Skip this section entirely if no company info is available. Keep it extremely brief.

**Engagement Recommendations**
1-2 short, specific, actionable outreach recommendations based on what was actually found. Do NOT use generic advice.

**Data Quality Notes**
Flag 1-2 key issues with the contact record (e.g., missing fields like company, location, job title that would improve future matches, confidence level of web research match, or if multiple people with this name were found).`;

/* ─── Build the user prompt ─── */
function buildUserPrompt(contact: Record<string, any>, webResearch: string | null, previousInsight: string | null): string {
  const emailDomain = contact.email?.includes("@") ? contact.email.split("@")[1] : null;
  const isPersonalEmail = emailDomain && FREE_EMAIL_DOMAINS.has(emailDomain);

  const contactInfo = [
    `Name: ${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
    contact.email ? `Email: ${contact.email}${isPersonalEmail ? " (personal/free email)" : " (business domain)"}` : null,
    contact.company ? `Company/Organization: ${contact.company}` : "Company: Not provided",
    contact.phone ? `Phone: ${contact.phone}` : null,
    contact.location ? `Location: ${contact.location}` : null,
    contact.tags?.length ? `Tags: ${contact.tags.join(", ")}` : null,
    contact.leadStatus ? `Current Lead Status: ${contact.leadStatus}` : null,
    contact.totalRevenue ? `Total Revenue: $${contact.totalRevenue}` : null,
    contact.outstandingBalance ? `Outstanding Balance: $${contact.outstandingBalance}` : null,
    // Add additional CRM fields to help the LLM filter results and disambiguate
    contact.jobTitle ? `Job Title/Position: ${contact.jobTitle}` : null,
    contact.role ? `Role: ${contact.role}` : null,
    contact.department ? `Department: ${contact.department}` : null,
    contact.industry ? `Industry: ${contact.industry}` : null,
    contact.website ? `Website: ${contact.website}` : null,
    contact.linkedinUrl ? `LinkedIn URL: ${contact.linkedinUrl}` : null,
  ].filter(Boolean).join("\n");

  let prompt = `Please enrich the following CRM contact profile:\n\n${contactInfo}`;

  if (webResearch) {
    prompt += `\n\n--- WEB RESEARCH RESULTS (from live web search) ---\n${webResearch}\n--- END WEB RESEARCH ---\n\nIMPORTANT: These web results may contain information about MULTIPLE different people with the same name. Only use results you can confidently match to this specific contact based on their email, company, phone, or location. Discard results that appear to be about different people.`;
  } else {
    prompt += `\n\nNo web research results were available. Base your response only on the contact data provided.`;
  }

  if (contact.userContext) {
    prompt += `\n\n--- USER GUIDANCE ---\nThe user has specifically asked you to focus on: "${contact.userContext}". Prioritize this in your analysis.`;
  }

  if (previousInsight) {
    prompt += `\n\n--- PREVIOUS INSIGHT REPORT ---\n${previousInsight.slice(0, 800)}\n--- END PREVIOUS REPORT ---\n\nThe user already has the above report. Focus on finding NEW information not covered in the previous report. Highlight what's new or updated.`;
  }

  return prompt;
}

/* ─── Helpers ─── */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function parseRetryDelay(body: string): number | null {
  const match = body.match(/retry(?:Delay["\s:]+"|.*?in\s+)([\d.]+)s/i);
  return match ? Math.ceil(parseFloat(match[1]) * 1000) : null;
}

/** Check if a web result likely contains sensitive/inappropriate content */
function isSensitiveContent(title: string, content: string): boolean {
  const combined = `${title} ${content}`.toLowerCase();
  return SENSITIVE_KEYWORDS.some(kw => combined.includes(kw));
}

/* ─── Step 1: Tavily Web Search ─── */
async function searchWithTavily(contact: Record<string, any>): Promise<{ answer: string; sources: string } | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  const emailDomain = contact.email?.includes("@") ? contact.email.split("@")[1] : null;
  const isPersonalDomain = emailDomain && FREE_EMAIL_DOMAINS.has(emailDomain);

  // Build a highly targeted search query using available fields for filtering
  const queryParts: string[] = [];

  // 1. Precise Name (in quotes)
  if (contact.firstName && contact.lastName) {
    queryParts.push(`"${contact.firstName} ${contact.lastName}"`);
  }

  // 2. Company name
  if (contact.company) {
    queryParts.push(`"${contact.company}"`);
  } else if (!isPersonalDomain && emailDomain) {
    queryParts.push(`"${emailDomain}"`);
  }

  // 3. Job Title or Role
  if (contact.jobTitle) {
    queryParts.push(`"${contact.jobTitle}"`);
  } else if (contact.role) {
    queryParts.push(`"${contact.role}"`);
  }

  // 4. Location for filtering regional results
  if (contact.location) {
    queryParts.push(contact.location);
  }

  // 5. Industry
  if (contact.industry) {
    queryParts.push(contact.industry);
  }

  // 6. Custom search context supplied by user
  if (contact.userContext) {
    queryParts.push(contact.userContext);
  }

  // If the query is too sparse (only name), add keywords to direct search toward professional match
  const hasOnlyName = queryParts.length === 1 && contact.firstName && contact.lastName;
  if (hasOnlyName) {
    queryParts.push("professional profile LinkedIn");
  }

  const searchQuery = queryParts.join(" ");

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: searchQuery,
        search_depth: "advanced",
        max_results: 8,
        include_answer: true,
      }),
    });

    if (!res.ok) {
      console.warn("[CRM Enrich] Tavily search failed:", res.status);
      return null;
    }

    const data = await res.json();
    const answer = data.answer || "";

    // Filter out sensitive results and sports/high school pages that are likely wrong person
    const filteredResults = (data.results || [])
      .filter((r: any) => {
        const title = r.title || "";
        const content = r.content || "";
        
        // Filter out sensitive content
        if (isSensitiveContent(title, content)) {
          console.log(`[CRM Enrich] Filtered sensitive result: "${title}"`);
          return false;
        }

        // Filter out high school sports recruiting profiles (likely not a business contact)
        if (/recruiting profile|maxpreps|milesplit|ncsasports|hudl\.com|247sports/i.test(r.url || "")) {
          console.log(`[CRM Enrich] Filtered sports recruiting result: "${title}"`);
          return false;
        }

        return true;
      })
      .slice(0, 5);

    // Also filter the AI summary for sensitive content
    let cleanAnswer = answer;
    if (SENSITIVE_KEYWORDS.some(kw => answer.toLowerCase().includes(kw))) {
      cleanAnswer = "Web search returned limited business-relevant information for this contact.";
    }

    const sources = filteredResults
      .map((r: any, i: number) => `Source ${i + 1}: "${r.title}"\n  URL: ${r.url}\n  Content: ${r.content?.slice(0, 300) || "No content"}`)
      .join("\n\n");

    if (filteredResults.length === 0) {
      return { answer: cleanAnswer, sources: "No business-relevant web sources found." };
    }

    return { answer: cleanAnswer, sources: `AI Summary:\n${cleanAnswer}\n\nDetailed Sources:\n${sources}` };
  } catch (e: any) {
    console.warn("[CRM Enrich] Tavily error:", e.message);
    return null;
  }
}

/* ─── Step 2a: Gemini LLM ─── */
async function enrichWithGemini(prompt: string, model: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: `${ENRICHMENT_SYSTEM_PROMPT}\n\n---\n\n${prompt}` }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
  });

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`${model}: empty response`);
      return text;
    }

    const errBody = await res.text();
    lastError = errBody;

    if (res.status === 429 && attempt === 0) {
      const delay = parseRetryDelay(errBody);
      if (delay && delay <= 20000) {
        console.log(`[CRM Enrich] ${model} rate-limited, retrying in ${delay}ms...`);
        await sleep(delay + 500);
        continue;
      }
    }
    break;
  }
  throw new Error(`${model}: ${lastError.slice(0, 200)}`);
}

/* ─── Step 2b: Groq LLM ─── */
async function enrichWithGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: ENRICHMENT_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

/* ─── Step 3: Format raw Tavily results (no-LLM fallback) ─── */
function formatTavilyFallback(contact: Record<string, any>, tavilyData: { answer: string; sources: string }): string {
  const emailDomain = contact.email?.includes("@") ? contact.email.split("@")[1] : null;
  const isPersonalEmail = emailDomain && FREE_EMAIL_DOMAINS.has(emailDomain);
  const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();

  const sections: string[] = [];

  // Professional Summary
  sections.push(`**Professional Summary**`);
  if (tavilyData.answer && tavilyData.answer !== "Web search returned limited business-relevant information for this contact.") {
    sections.push(tavilyData.answer);
  } else {
    sections.push(`Limited professional information available for ${fullName}. Consider adding their company name or asking them directly for their LinkedIn profile to improve enrichment results.`);
  }
  sections.push("");

  // Verified Web Presence
  sections.push(`**Verified Web Presence**`);
  if (isPersonalEmail) {
    sections.push(`- Email: ${contact.email} (personal email — no company domain)`);
  } else if (emailDomain) {
    sections.push(`- Company domain: https://${emailDomain}`);
  }
  sections.push(`- No verified social profiles found in web search. Consider asking the contact directly.`);
  sections.push("");

  // Business Context (only if company exists)
  if (contact.company) {
    sections.push(`**Business Context**`);
    sections.push(`Company: ${contact.company}`);
    sections.push("");
  }

  // Web Sources (filtered)
  if (tavilyData.sources && tavilyData.sources !== "No business-relevant web sources found.") {
    sections.push(`**Web Sources Found**`);
    sections.push(tavilyData.sources);
    sections.push("");
  }

  // Engagement Recommendations
  sections.push(`**Engagement Recommendations**`);
  const recs: string[] = [];
  if (!contact.company) {
    recs.push("Ask for their company name or role during your next interaction — this will dramatically improve future enrichment.");
  }
  if (isPersonalEmail) {
    recs.push("Request a business email for professional communications.");
  }
  if (!contact.location) {
    recs.push("Confirm their location to help with meeting scheduling and regional targeting.");
  }
  if (recs.length === 0) {
    recs.push("Review the web sources above for conversation starters.", "Reference their professional background in your outreach.");
  }
  recs.forEach((r, i) => sections.push(`${i + 1}. ${r}`));
  sections.push("");

  // Data Quality Notes
  sections.push(`**Data Quality Notes**`);
  const notes: string[] = [];
  if (isPersonalEmail) notes.push("- Email is a free/personal domain — consider requesting a business email");
  if (!contact.company) notes.push("- Missing company name — enrichment quality is limited without this");
  if (!contact.location) notes.push("- Missing location");
  notes.push("- Confidence: Low (limited disambiguating information available)");
  notes.push("");
  notes.push(`*Note: AI analysis providers were temporarily unavailable. Click "Generate Insights" again for a deeper analysis.*`);
  sections.push(notes.join("\n"));

  return sections.join("\n");
}

/* ─── Response Validation ─── */
function validateEnrichment(text: string): boolean {
  if (!text || text.length < 100) return false;
  const sectionHeaders = ["**Professional Summary**", "**Verified Web Presence**", "**Engagement Recommend", "**Data Quality**", "**Business Context**"];
  const matchCount = sectionHeaders.filter(h => text.includes(h)).length;
  return matchCount >= 2;
}

/* ─── In-Memory Rate Limiter (per-user, per-minute) ─── */
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 enrichments per user per minute

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(uid) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) return false;
  timestamps.push(now);
  rateLimitMap.set(uid, timestamps);
  return true;
}

/* ─── Main Handler ─── */
export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  // Rate limiting
  if (!checkRateLimit(auth.uid)) {
    return NextResponse.json(
      { error: "Rate limit exceeded — max 10 enrichments per minute. Please wait." },
      { status: 429 }
    );
  }

  try {
    const contact = await req.json();

    if (!contact.firstName && !contact.lastName && !contact.email && !contact.company) {
      return NextResponse.json({ error: "At least a name, email, or company is required." }, { status: 400 });
    }

    const errors: string[] = [];

    // ── Step 1: Web search (always runs first) ──
    const tavilyData = await searchWithTavily(contact);
    const webResearch = tavilyData?.sources || null;

    // ── Step 2: Build the LLM prompt with web data ──
    const userPrompt = buildUserPrompt(contact, webResearch, contact.previousInsight || null);

    // ── Step 3: Cascade through LLM providers ──
    const geminiModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.0-flash-lite"];

    for (const model of geminiModels) {
      try {
        const result = await enrichWithGemini(userPrompt, model);
        if (validateEnrichment(result)) {
          return NextResponse.json({ enrichment: result, provider: `gemini/${model}`, hasWebData: !!tavilyData });
        }
        console.warn(`[CRM Enrich] ${model}: response failed validation, trying next...`);
      } catch (e: any) {
        console.warn(`[CRM Enrich] ${model} failed:`, e.message?.slice(0, 100));
        errors.push(e.message?.slice(0, 80));
      }
    }

    try {
      const result = await enrichWithGroq(userPrompt);
      if (validateEnrichment(result)) {
        return NextResponse.json({ enrichment: result, provider: "groq", hasWebData: !!tavilyData });
      }
    } catch (e: any) {
      console.warn("[CRM Enrich] Groq failed:", e.message?.slice(0, 100));
      errors.push(e.message?.slice(0, 80));
    }

    // ── Step 4: Tavily-only fallback (no LLM) ──
    if (tavilyData) {
      const fallback = formatTavilyFallback(contact, tavilyData);
      return NextResponse.json({ enrichment: fallback, provider: "tavily-search", hasWebData: true });
    }

    return NextResponse.json(
      { error: `All providers temporarily unavailable. Please try again in ~30 seconds.\n\n${errors.join(" | ")}` },
      { status: 503 }
    );

  } catch (error: any) {
    console.error("[CRM Enrich] Unexpected error:", error);
    return NextResponse.json({ error: error.message || "Enrichment failed" }, { status: 500 });
  }
}
