import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";
import { logAIUsage, calculateGroqCost } from "@/lib/log-ai-usage";
import { verifyRequest } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { description, uid, orgId } = body;
    const kbText = ((body.knowledgeBaseText as string) || "").slice(0, 20000);
    const pactTextVal = ((body.pactText as string) || "").slice(0, 5000);

    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
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
    {
      "id": "q1",
      "type": "text", 
      "prompt": "What is your name?"
    },
    {
      "id": "q2",
      "type": "choice",
      "prompt": "What is your favorite color?",
      "options": ["Red", "Blue", "Green"]
    },
    {
      "id": "q3",
      "type": "rating",
      "prompt": "Rate your experience from 1 to 5"
    }
  ]
}
Allowed types for questions are: "text", "choice", "rating".
Make the survey professional and perfectly tailored to their request.`
+ (kbText ? `\n\nContext about the user's business — use this to make the survey domain-relevant:\n${kbText}` : "")
+ (pactTextVal ? `\n\nKnown facts about the user:\n${pactTextVal}` : "")
        },
        {
          role: "user",
          content: description
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    let jsonString = completion.choices[0]?.message?.content;
    if (!jsonString) throw new Error("No response from Groq");

    // Remove markdown code blocks if the model mistakenly wraps it
    jsonString = jsonString.trim();
    if (jsonString.startsWith("```json")) {
      jsonString = jsonString.replace(/^```json/, "");
    }
    if (jsonString.startsWith("```")) {
      jsonString = jsonString.replace(/^```/, "");
    }
    if (jsonString.endsWith("```")) {
      jsonString = jsonString.replace(/```$/, "");
    }
    jsonString = jsonString.trim();

    const surveyData = JSON.parse(jsonString);

    const surveyModel = "llama-3.3-70b-versatile";
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    logAIUsage({
      userId: uid || "anonymous",
      orgId: orgId || "soltheory",
      model: surveyModel,
      provider: "groq",
      endpoint: "/api/generate-survey",
      inputTokens,
      outputTokens,
      totalTokens: completion.usage?.total_tokens || 0,
      costUsd: calculateGroqCost(surveyModel, inputTokens, outputTokens),
      timestamp: new Date(),
    });

    return NextResponse.json({ survey: surveyData });
  } catch (error: any) {
    console.error("Survey generation error:", error);
    return NextResponse.json({ error: error?.message || "Failed to generate survey." }, { status: 500 });
  }
}
