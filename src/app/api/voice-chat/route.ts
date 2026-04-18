import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { messages, agentId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const isNxt = (agentId || "").includes("nxtchapter");

    const systemPrompt = isNxt
      ? "You are Jarvis, the AI voice assistant for NXT Chapter — a youth mentorship and community empowerment organization. You are in a live voice conversation. Keep every response to 1-3 sentences. Be direct, helpful, warm, and natural. Never use markdown, bullet points, numbered lists, or code blocks. Speak as if talking out loud to a person.\n\nCRITICAL DIRECTIVE: When asked to create, draft, or generate a document, email, spreadsheet, or similar item, do NOT output the drafted content in your chat response. Just execute the corresponding tool, and reply strictly with: 'I have generated that [insert the specific thing] for you, go take a look.'"
      : "You are Jarvis, the AI voice assistant for SOL Theory. You are in a live voice conversation. Keep every response to 1-3 sentences. Be direct, helpful, and natural. Never use markdown, bullet points, numbered lists, or code blocks. Speak as if talking out loud to a person.\n\nCRITICAL DIRECTIVE: When asked to create, draft, or generate a document, email, spreadsheet, or similar item, do NOT output the drafted content in your chat response. Just execute the corresponding tool, and reply strictly with: 'I have generated that [insert the specific thing] for you, go take a look.'";

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.6,
      max_tokens: 200,
    });

    return NextResponse.json({
      response: completion.choices[0]?.message?.content || "I couldn't process that.",
      usage: completion.usage?.total_tokens || 0
    });
  } catch (error: any) {
    console.error("[Voice API Error]", error?.message);
    return NextResponse.json(
      { response: "I had a brief connection issue. Could you try again?" },
      { status: 200 }
    );
  }
}
