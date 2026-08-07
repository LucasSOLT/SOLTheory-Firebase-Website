import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.OPENROUTER_API_KEY;
  const keyInfo = key ? `SET (${key.length} chars, starts: ${key.substring(0, 15)}...)` : "MISSING";
  
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://soltheory.com",
        "X-Title": "SOL Theory Test",
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [{ role: "user", content: "Say hello in exactly 3 words." }],
        max_tokens: 20,
      }),
    });
    
    const status = response.status;
    const body = await response.text();
    
    return NextResponse.json({ 
      keyInfo, 
      httpStatus: status, 
      openRouterResponse: body.substring(0, 1000),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ keyInfo, networkError: err.message, timestamp: new Date().toISOString() });
  }
}
