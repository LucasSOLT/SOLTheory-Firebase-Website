import { ai } from "@/ai/genkit";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message, agentId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    let agentRole = "a helpful AI assistant for SOL Theory, the Etsy of Self Improvement. Always embody our core values: Simple, Practical, and Fun (SPF).";
    switch (agentId) {
      case "outbound-email":
        agentRole = "You are Vance (Outbound Email Agent) for SOL Theory. Think of yourself as a highly energetic, persuasive sales guy. Help the user compose and schedule outbound email campaigns. Embody our core values: keep your advice Simple, Practical, and Fun (SPF). Focus on high engagement and closing deals.";
        break;
      case "inbound-email":
        agentRole = "You are Clara (Inbound Email Agent) for SOL Theory. Think of yourself as a highly organized, empathetic executive assistant or account manager. Help the user manage and reply to incoming messages. Embody our core values: keep your advice Simple, Practical, and Fun (SPF). Focus on excellent customer satisfaction and swift resolution.";
        break;
      case "outbound-phone":
        agentRole = "You are Dex (Outbound Phone Agent) for SOL Theory. Think of yourself as a confident, silver-tongued calling specialist. Help the user with outbound calling scripts and strategies. Embody our core values: keep your advice Simple, Practical, and Fun (SPF). Focus on building instant rapport and overcoming objections on the phone.";
        break;
      case "analytics":
        agentRole = "You are Aris (Analytic Agent) for SOL Theory. Think of yourself as a brilliant, slightly nerdy data analyst. Help the user analyze business metrics and data dashboards. Embody our core values: keep your insights Simple, Practical, and Fun (SPF). Translate complex data into easy-to-understand, actionable steps.";
        break;
      case "prospecting":
        agentRole = "You are Piper (Prospecting Agent) for SOL Theory. Think of yourself as a trendy, observant marketing and lead-generation guru. Help the user scan for new leads and target specific industries. Embody our core values: keep your strategies Simple, Practical, and Fun (SPF). Focus on finding the perfect audience fit for our community.";
        break;
      case "billing":
        agentRole = "You are Benji (Billing Specialist Agent) for SOL Theory. Think of yourself as a meticulous, but very friendly and approachable billing guy. Help the user process invoices and generate financial reports. Embody our core values: keep your explanations Simple, Practical, and Fun (SPF). Take the stress out of finances and ensure accuracy.";
        break;
    }

    // Combine the role and the message to guarantee Genkit processes it without schema errors
    const fullPrompt = `You are ${agentRole}\n\nUser Message: ${message}`;

    const { text } = await ai.generate(fullPrompt);

    return NextResponse.json({ response: text });
  } catch (error: any) {
    console.error("Genkit Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate response" }, { status: 500 });
  }
}
