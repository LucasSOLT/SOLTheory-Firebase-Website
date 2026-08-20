/**
 * jarvis-router.ts — Intent Classification Router
 * 
 * Classifies user messages into domains for selective tool loading.
 * Uses fast regex first, falls back to lightweight LLM for ambiguous cases.
 * 
 * Domains:
 * - EMAIL: inbox, drafts, emails, send email, block sender
 * - CALENDAR: schedule, meeting, calendar, event, availability
 * - CRM: contacts, leads, tags, CRM, add person, analytics
 * - COMMS: text, SMS, iMessage, message someone  
 * - WORKSPACE: document, slides, spreadsheet, YouTube, survey
 * - GRANTS: grants, funding, scout, grant agent
 * - GENERAL: research, questions, chat, weather, advice, memory
 * - MULTI: requests spanning 2+ domains (future orchestrator)
 */

import { Groq } from "groq-sdk";

export type JarvisDomain = 
  | "EMAIL"
  | "CALENDAR" 
  | "CRM"
  | "WORKSPACE"
  | "GENERAL"
  | "MULTI";

// ── Regex Patterns (Free, instant, handles ~80% of requests) ──

const DOMAIN_PATTERNS: Array<{ domain: JarvisDomain; pattern: RegExp }> = [
  // EMAIL — inbox management, drafting, blocking
  {
    domain: "EMAIL",
    pattern: /\b(draft\s*(an?\s*)?email|send\s*(an?\s*)?email|inbox|check\s*my\s*email|email\s*(from|to|about)|delete\s*(the\s*)?email|block\s*sender|create\s*(a\s*)?folder|unsubscribe|spam|junk|move\s*to\s*trash|forward\s*(the\s*)?email)\b/i,
  },
  // CALENDAR — scheduling, events, availability  
  {
    domain: "CALENDAR",
    pattern: /\b(schedule|calendar|meeting|event|appointment|book\s*(a\s*)?(time|meeting|call)|reschedule|cancel\s*(the\s*)?(meeting|event|appointment)|what('s| is)\s*(on\s*)?(my\s*)?calendar|availability|free\s*time|busy|block\s*off\s*time|google\s*meet)\b/i,
  },
  // CRM — contact management, leads, tags, analytics
  {
    domain: "CRM",
    pattern: /\b(add\s*(a\s*)?(new\s*)?(contact|person|lead)|delete\s*(the\s*)?(contact|person)|contacts?\s*(book|list|database)|crm|lead\s*(status|score|source)|tag\s*(them|this|contacts?)|update\s*(the\s*)?(contact|person|lead)|search\s*(for\s*)?(contacts?|people|leads?)|find\s*(me\s*)?(contacts?|people|leads?)|contact\s*analytics|how\s*many\s*(contacts?|leads?|people)|stale\s*leads?|health\s*score|batch\s*update|evaluate\s*(contacts?|leads?)|merge\s*(the\s*)?(contacts?|duplicates?|records?)|move\s*(the\s*)?(contact|person)|follow[\s-]?up|log\s*(a\s*)?(note|call|activity|meeting)|schedule\s*(a\s*)?(follow|call|check)|create\s*(a\s*)?(new\s*)?contact\s*book|rename\s*(the\s*)?(contact\s*)?book|delete\s*(the\s*)?(contact\s*)?book|complete\s*(the\s*)?(task|follow))\b/i,
  },
  // WORKSPACE — Google Docs, Slides, Sheets, YouTube, Survey, Drive
  {
    domain: "WORKSPACE",
    pattern: /\b(create\s*(a\s*)?(google\s*)?(doc|document|slide|presentation|sheet|spreadsheet)|make\s*(a\s*)?(doc|document|slide|presentation|sheet|spreadsheet)|(draft|write|generate)\s*(a\s*)?(google\s*)?(doc|document|slide|presentation|sheet|spreadsheet)|word\s*(doc|document)|youtube\s*(video|draft|script)|draft\s*(a\s*)?video|create\s*(a\s*)?(survey|questionnaire|feedback\s*form)|search\s*(google\s*)?drive|read\s*(the\s*)?doc|google\s*drive)\b/i,
  },
  // GENERAL — catch-all with specific triggers for web search + memory
  {
    domain: "GENERAL",
    pattern: /\b(remember\s*when|what\s*did\s*we\s*(discuss|talk)|last\s*time\s*we|search\s*(the\s*)?(web|internet|online)|look\s*up|what\s*(is|are|was|were)\s+(?!on\s*my\s*calendar))/i,
  },
];

// Multi-domain detection patterns
const MULTI_DOMAIN_INDICATORS = /\b(and\s*(then\s*)?(also|send|schedule|text|email|create|add|draft|book)|after\s*that|then\s*(also|send|schedule|text|email|create)|,\s*(and\s*)?(send|schedule|text|email|create|add|draft))\b/i;

/**
 * Fast regex-based intent classification.
 * Returns the matched domain, or null if ambiguous.
 */
function regexClassify(message: string): JarvisDomain | null {
  const matches: JarvisDomain[] = [];

  for (const { domain, pattern } of DOMAIN_PATTERNS) {
    if (pattern.test(message)) {
      matches.push(domain);
    }
  }

  // No domain matched → general conversation
  if (matches.length === 0) return "GENERAL";

  // Single domain match → clear routing
  if (matches.length === 1) return matches[0];

  // Multiple domains detected → check for multi-step phrasing
  if (MULTI_DOMAIN_INDICATORS.test(message)) return "MULTI";

  // Multiple matches but not multi-step → return the most specific one
  // Priority: CRM > EMAIL > CALENDAR > COMMS > WORKSPACE > GRANTS > GENERAL
  const priority: JarvisDomain[] = ["CRM", "EMAIL", "CALENDAR", "WORKSPACE", "GENERAL"];
  for (const domain of priority) {
    if (matches.includes(domain)) return domain;
  }

  return matches[0];
}

// ── LLM Fallback Classifier (for ambiguous cases) ──

const ROUTER_SYSTEM_PROMPT = `You are a routing classifier. Given the user's message, respond with ONLY the domain name.

Domains:
- EMAIL: managing inbox, drafting emails, deleting/blocking emails, creating folders
- CALENDAR: scheduling meetings, checking calendar, booking events, rescheduling
- CRM: managing contacts, adding/editing/deleting people, lead management, tags, analytics
- WORKSPACE: creating Google Docs/Slides/Sheets, YouTube videos, surveys, Google Drive
- GENERAL: general questions, web search, casual conversation, advice, remembering past chats
- MULTI: complex requests that clearly need 2+ of the above domains together

Respond with exactly one word: EMAIL, CALENDAR, CRM, WORKSPACE, GENERAL, or MULTI.`;

/**
 * LLM-based intent classification fallback.
 * Uses the fast 8B model for near-instant classification.
 */
async function llmClassify(message: string): Promise<JarvisDomain> {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const result = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: ROUTER_SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      max_tokens: 10,
      temperature: 0,
    });

    const response = result.choices[0]?.message?.content?.trim().toUpperCase() || "GENERAL";
    const validDomains: JarvisDomain[] = ["EMAIL", "CALENDAR", "CRM", "WORKSPACE", "GENERAL", "MULTI"];
    
    if (validDomains.includes(response as JarvisDomain)) {
      return response as JarvisDomain;
    }
    return "GENERAL";
  } catch (error) {
    console.warn("[Jarvis Router] LLM classification failed, defaulting to GENERAL:", error);
    return "GENERAL";
  }
}

/**
 * Main routing function.
 * Step 1: Try fast regex classification (free, instant)
 * Step 2: If regex returns GENERAL but message seems complex, try LLM
 * 
 * @returns The classified domain
 */
export async function routeIntent(userMessage: string): Promise<JarvisDomain> {
  const regexResult = regexClassify(userMessage);

  // If regex got a clear non-GENERAL domain, trust it
  if (regexResult && regexResult !== "GENERAL") {
    console.log(`[Jarvis Router] Regex classified: ${regexResult}`);
    return regexResult;
  }

  // If message is short or clearly casual, skip LLM
  if (userMessage.length < 30) {
    console.log(`[Jarvis Router] Short message, defaulting to: GENERAL`);
    return "GENERAL";
  }

  // For longer ambiguous messages, use LLM classification
  const llmResult = await llmClassify(userMessage);
  console.log(`[Jarvis Router] LLM classified: ${llmResult}`);
  return llmResult;
}

/**
 * Synchronous regex-only classification (for voice route where latency matters)
 */
export function routeIntentSync(userMessage: string): JarvisDomain {
  return regexClassify(userMessage) || "GENERAL";
}
