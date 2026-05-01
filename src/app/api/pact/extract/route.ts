import { NextResponse } from "next/server";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { extractPACTFacts } from "@/lib/pact-extractor";

export async function POST(req: Request) {
  try {
    const { userMessage, aiResponse, userName, uid, orgId } = await req.json();

    if (!userMessage || !uid || !orgId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (userMessage.trim().length <= 15) {
      return NextResponse.json({ success: true, message: "Message too short for PACT" });
    }

    // 1. Extract facts using Groq
    const pactFacts = await extractPACTFacts(userMessage, aiResponse || "", userName);

    if (pactFacts.length === 0) {
      return NextResponse.json({ success: true, message: "No facts extracted" });
    }

    // 2. Save facts securely to Firestore using Admin SDK
    console.log(`[PACT Background] Extracted ${pactFacts.length} facts for user ${uid}`);
    
    initAdmin();
    const adminDb = getAdminFirestore();
    const pactCol = adminDb.collection("users").doc(uid).collection("pact_entries");
    
    const existingSnap = await pactCol.where("orgId", "==", orgId).get();
    const existingQs = new Set<string>();
    existingSnap.forEach(doc => existingQs.add(doc.data().question?.toLowerCase()?.trim()));
    
    let savedCount = 0;
    for (const fact of pactFacts) {
      const nq = fact.question.toLowerCase().trim();
      if (!existingQs.has(nq) && existingSnap.size < 200) {
        await pactCol.add({
          question: fact.question,
          answer: fact.answer,
          source: "server_background",
          orgId: orgId,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        existingQs.add(nq);
        savedCount++;
      }
    }

    return NextResponse.json({ success: true, savedCount, facts: pactFacts });

  } catch (error: any) {
    if (error.message?.includes("credentials")) {
      console.warn("[PACT Background] Missing admin credentials (expected on localhost). Skipping server save.");
      return NextResponse.json({ success: true, message: "Skipped server write on localhost due to missing credentials." });
    }
    console.error("[PACT Background] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
