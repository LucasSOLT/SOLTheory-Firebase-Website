import { Groq } from "groq-sdk";

/**
 * P.A.C.T. — Personalized AI Conversation Training
 * 
 * Extracts personal facts from user↔AI exchanges as Q&A pairs.
 * Uses a cheap, fast model (llama-3.1-8b-instant) to avoid latency.
 */

const EXTRACTION_PROMPT = `You are a fact extractor. Given a conversation exchange between a user and an AI assistant, extract any personal facts, preferences, relationships, or biographical details the user revealed about themselves.

Return a JSON array of objects with "question" and "answer" fields. The question should be phrased as if asking about the user. The answer should be a concise factual statement.

Rules:
- Only extract DECLARATIVE, FACTUAL information the user explicitly stated (names, ages, relationships, preferences, locations, job details, etc.)
- CRITICAL: Do NOT extract information if the user is asking a question (e.g. "How old am I?", "Where do I live?"). These are not facts.
- Do NOT extract opinions, greetings, small talk, or task requests (like "send an email" or "schedule a meeting")
- Do NOT extract information about the AI or system — only about the HUMAN user
- If no personal facts were shared, return an empty array []
- Keep questions and answers concise (1 sentence max each)
- Use the user's name if known

Example input:
User: "yeah for sure literally just like a random email draft and his name is Steve Huff by the way that's my dad"
AI: "I have generated that email for you, go take a look."

Example output:
[{"question":"What is the user's father's name?","answer":"Steve Huff"},{"question":"Does the user have a father named Steve Huff?","answer":"Yes, Steve Huff is the user's dad."}]

Return ONLY the JSON array. No explanation, no markdown.`;

export interface PACTFact {
  question: string;
  answer: string;
}

export async function extractPACTFacts(
  userMessage: string,
  aiResponse: string,
  userName?: string
): Promise<PACTFact[]> {
  // Skip very short or empty messages
  if (!userMessage || userMessage.trim().length < 10) return [];

  // Skip pure task commands that are unlikely to contain personal facts
  const taskOnlyPatterns = [
    /^(send|draft|delete|schedule|create|list|search|check|show|open|close)/i,
  ];
  const isTaskOnly = taskOnlyPatterns.some(p => p.test(userMessage.trim())) && userMessage.trim().length < 40;
  if (isTaskOnly) return [];

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const userLabel = userName ? `User (${userName})` : "User";

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: `${userLabel}: "${userMessage}"\nAI: "${aiResponse}"`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      max_tokens: 500,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "[]";

    // Parse — handle potential markdown wrapping
    let cleaned = raw;
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    // Validate structure
    return parsed.filter(
      (item: any) =>
        typeof item.question === "string" &&
        typeof item.answer === "string" &&
        item.question.trim().length > 0 &&
        item.answer.trim().length > 0
    );
  } catch (err) {
    console.error("[PACT] Extraction failed:", err);
    return [];
  }
}
