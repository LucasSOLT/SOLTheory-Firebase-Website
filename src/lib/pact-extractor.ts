import { Groq } from "groq-sdk";

/**
 * P.A.C.T. — Personalized AI Conversation Training
 * 
 * Extracts personal facts from user↔AI exchanges as Q&A pairs.
 * Uses a cheap, fast model (llama-3.1-8b-instant) to avoid latency.
 *
 * Enhanced v2: Richer extraction with confidence scores, categories,
 * implicit fact detection, and multi-turn context analysis.
 */

const EXTRACTION_PROMPT = `You are an expert fact extractor with a talent for reading between the lines. Given a conversation exchange between a user and an AI assistant, extract personal facts, preferences, relationships, context, and details the user revealed — both EXPLICIT and IMPLICIT.

Return a JSON array of objects with these fields:
- "question": Phrased as if asking about the user
- "answer": A concise factual statement
- "confidence": "high" | "medium" | "low" — how certain you are this is a real personal fact
- "category": One of: "identity", "work", "relationship", "goal", "preference", "temporal", "habit", "opinion", "location", "contact"

Rules:
- Extract EXPLICIT facts (stated directly: "I live in Denver")
- Extract IMPLICIT facts (inferred from context: if user says "meeting ran late again", extract "User has recurring meetings" AND "User's meetings tend to run long")
- If user discusses a project, extract the project name, status, and key details
- If user mentions people, capture the relationship and context
- If user expresses frustration/excitement, capture the underlying preference or opinion
- Pay attention to MULTI-TURN context: connect earlier messages to later ones
- Be THOROUGH — the system will filter low-quality entries automatically

Categories guide:
- "identity": name, age, gender, pronouns, aliases, nicknames
- "location": city, state, country, neighborhood, timezone
- "work": job title, company, industry, work schedule, colleagues, projects
- "relationship": spouse, children, parents, siblings, friends, pets (with names)
- "preference": favorite things, communication style, dislikes, tools they use
- "goal": what they're working on, deadlines, aspirations, targets
- "habit": routines, patterns, typical behaviors
- "opinion": likes, dislikes, frustrations, excitement about topics
- "temporal": upcoming events, recent changes, seasonal patterns
- "contact": email, phone, social media handles

CRITICAL rules:
- Do NOT extract information if the user is ONLY asking a question (e.g. "How old am I?")
- Do NOT extract information about the AI or system — only about the HUMAN user
- If no personal facts were shared, return an empty array []
- Keep questions and answers concise (1-2 sentences max each)
- Use the user's name if known
- For implicit facts, set confidence to "medium" or "low"

Example input:
User: "yeah for sure, the Denver office has been crazy lately. Steve keeps scheduling these 8am standups and honestly I'm over it"
AI: "That does sound frustrating. Early meetings can really throw off your day."

Example output:
[
  {"question":"Where does the user work?","answer":"The user works at an office in Denver.","confidence":"high","category":"location"},
  {"question":"Who is Steve in relation to the user?","answer":"Steve is a colleague who schedules meetings for the user.","confidence":"high","category":"relationship"},
  {"question":"What time are the user's standup meetings?","answer":"The user has standup meetings at 8am.","confidence":"high","category":"work"},
  {"question":"How does the user feel about early morning meetings?","answer":"The user dislikes early morning meetings and finds them frustrating.","confidence":"high","category":"opinion"},
  {"question":"Does the user have recurring team standups?","answer":"Yes, the user has regular standup meetings (implied to be frequent).","confidence":"medium","category":"habit"}
]

Return ONLY the JSON array. No explanation, no markdown.`;

export interface PACTFact {
  question: string;
  answer: string;
  confidence?: "high" | "medium" | "low";
  category?: "identity" | "work" | "relationship" | "goal" | "preference" | "temporal" | "habit" | "opinion" | "location" | "contact";
}

export async function extractPACTFacts(
  userMessage: string,
  aiResponse: string,
  userName?: string,
  recentHistory?: { role: string; content: string }[]
): Promise<PACTFact[]> {
  // Skip very short or empty messages (lowered from 10 to 5)
  if (!userMessage || userMessage.trim().length < 5) return [];

  // Relaxed task-only filtering: only skip pure short task commands (< 20 chars)
  // Longer task commands may contain personal info (e.g., "send an email to my brother Mike")
  const taskOnlyPatterns = [
    /^(send|draft|delete|schedule|create|list|search|check|show|open|close)/i,
  ];
  const isTaskOnly = taskOnlyPatterns.some(p => p.test(userMessage.trim())) && userMessage.trim().length < 20;
  if (isTaskOnly) return [];

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const userLabel = userName ? `User (${userName})` : "User";

    // Build conversation context — include recent history for multi-turn extraction
    let conversationContext = "";
    if (recentHistory && recentHistory.length > 0) {
      conversationContext += "[RECENT CONVERSATION CONTEXT — extract facts from ALL messages, not just the latest]\n";
      for (const msg of recentHistory) {
        const label = msg.role === "user" ? userLabel : "AI";
        conversationContext += `${label}: "${msg.content}"\n`;
      }
      conversationContext += "\n[LATEST EXCHANGE]\n";
    }
    conversationContext += `${userLabel}: "${userMessage}"\nAI: "${aiResponse}"`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: conversationContext,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      max_tokens: 1200, // Increased from 800 to capture more facts with richer schema
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "[]";

    // Parse — handle potential markdown wrapping
    let cleaned = raw;
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    // Validate structure — accept both old (no confidence/category) and new format
    return parsed.filter(
      (item: any) =>
        typeof item.question === "string" &&
        typeof item.answer === "string" &&
        item.question.trim().length > 0 &&
        item.answer.trim().length > 0
    ).map((item: any) => ({
      question: item.question,
      answer: item.answer,
      confidence: item.confidence || "medium",
      category: item.category || "preference",
    }));
  } catch (err) {
    console.error("[PACT] Extraction failed:", err);
    return [];
  }
}
