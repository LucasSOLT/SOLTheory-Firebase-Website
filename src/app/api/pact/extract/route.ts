import { NextResponse } from "next/server";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { extractPACTFacts } from "@/lib/pact-extractor";
import { verifyRequest } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { userMessage, aiResponse, userName, uid, orgId, recentHistory } = await req.json();

    if (!userMessage || !uid || !orgId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (userMessage.trim().length <= 5) {
      return NextResponse.json({ success: true, message: "Message too short for PACT" });
    }

    // 1. Extract facts using Groq
    const pactFacts = await extractPACTFacts(userMessage, aiResponse || "", userName, recentHistory);

    if (pactFacts.length === 0) {
      return NextResponse.json({ success: true, message: "No facts extracted" });
    }

    return NextResponse.json({ success: true, facts: pactFacts });

  } catch (error: any) {
    console.error("[PACT Background] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
