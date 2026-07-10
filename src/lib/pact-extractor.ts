import { Groq } from "groq-sdk";

/**
 * P.A.C.T. — Personalized AI Conversation Training
 * 
 * Extracts personal facts from user↔AI exchanges as Q&A pairs.
 * Uses a cheap, fast model (llama-3.1-8b-instant) to avoid latency.
 *
 * Enhanced: supports multi-turn context, richer extraction prompt,
 * relaxed thresholds to capture more details.
 */

const EXTRACTION_PROMPT = `You are an expert fact extractor. Given a conversation exchange between a user and an AI assistant, extract any personal facts, preferences, relationships, context, or details the user revealed about themselves.

Return a JSON array of objects with "question" and "answer" fields. The question should be phrased as if asking about the user. The answer should be a concise factual statement.

Rules:
- Extract any fact, preference, detail, habit, or context about the user that could be useful later
- Be THOROUGH — capture anything that feels like a real detail about this person
- The system will automatically clean up low-quality entries, so err on the side of capturing more
- Pay attention to MULTI-TURN context: if an earlier message mentions something relevant, connect it to later messages

Categories to capture (non-exhaustive):
- Identity: name, age, gender, pronouns, aliases, nicknames
- Location: city, state, country, neighborhood, timezone, "I'm near downtown"
- Work: job title, company, industry, work schedule, colleagues
- Family & relationships: spouse, children, parents, siblings, friends, pets (with names)
- Preferences: favorite color, food, music, hobbies, communication style ("email me, don't call")
- Goals & projects: what they're working on, deadlines, aspirations
- Opinions & feelings: likes, dislikes, frustrations, excitement about topics
- Routines & habits: "I usually wake up at 6am", "I exercise on Mondays"
- History & events: "I moved here last year", "I graduated from UCLA"
- Contact info: email, phone, social media handles
- Temporal context: "I'm traveling next week", "my birthday is in March"

CRITICAL rules:
- Do NOT extract information if the user is ONLY asking a question (e.g. "How old am I?"). These are not facts.
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
      max_tokens: 800, // Increased from 500 to capture more facts
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
