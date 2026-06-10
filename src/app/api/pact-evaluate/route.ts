import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { entries, userName } = await req.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ decisions: [] });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const entriesList = entries
      .map((e: any, i: number) => `${i}. Q: ${e.question}\n   A: ${e.answer}`)
      .join("\n\n");

    const systemPrompt = `You are a memory quality evaluator for an AI assistant. The user's name is "${userName || "the user"}".

Given a numbered list of facts the AI has learned about this user, decide which ones are worth keeping as long-term memory and which should be discarded.

DISCARD facts that are:
- Redundant (e.g. "What is the user's name?" when name appears in other facts)
- Too vague or contextless (e.g. "Is the user concerned about something?" → "Yes")
- Conversational noise, not real facts (e.g. "Does the user want to start a story?" → "Yes")
- Temporary states that have likely expired (e.g. "Is the user tired?" → "Yes")
- Meta-questions about the AI itself (e.g. "Does the user want the AI to do X?")
- Duplicate information already covered by another entry in the list
- Trivially obvious (e.g. "Has the user had a conversation with Jarvis?" → "Yes")

KEEP facts that are:
- Biographical (name, location, family, job, age)
- Preferences (language, communication style, interests, hobbies)
- Important relationships (coworker names, family members)
- Actionable context (phone number, email, goals, deadlines)
- Persistent traits, habits, or interests
- Specific events or achievements worth remembering
- Contact information or organizational details

You MUST respond with ONLY a valid JSON array. Each element must have:
- "index": the entry number (integer)
- "keep": true or false
- "reason": a brief 3-8 word explanation

Example response:
[{"index": 0, "keep": false, "reason": "Redundant — name already known"}, {"index": 1, "keep": true, "reason": "Useful biographical detail"}]

Do NOT include any text outside the JSON array. No markdown, no explanation.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Evaluate these ${entries.length} memory entries:\n\n${entriesList}` },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      max_tokens: 2000,
    });

    const raw = completion.choices[0]?.message?.content || "[]";

    // Parse JSON — handle potential markdown wrapping
    let decisions: any[] = [];
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      decisions = JSON.parse(cleaned);
    } catch {
      console.error("[PACT Evaluate] Failed to parse LLM response:", raw.substring(0, 500));
      // Fallback: keep everything
      decisions = entries.map((_: any, i: number) => ({ index: i, keep: true, reason: "Parse error — keeping by default" }));
    }

    return NextResponse.json({ decisions });
  } catch (error: any) {
    console.error("[PACT Evaluate Error]", error?.message);
    return NextResponse.json(
      { decisions: [], error: error?.message },
      { status: 200 }
    );
  }
}
