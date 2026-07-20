import { NextResponse } from "next/server";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { verifyRequest } from "@/lib/api-auth";

const HEAD_ADMIN_EMAIL = "lucas@soltheory.com";

export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { uid, email, orgId, filter } = await req.json();
    // filter: "user" | "org" | "all"

    await initAdmin();
    const db = getAdminFirestore();

    // All usage data is PERMANENT — never deleted, reset, or altered.
    // We fetch ALL records for the given scope.
    let query: FirebaseFirestore.Query = db.collection("ai_usage");

    if (filter === "all" && email === HEAD_ADMIN_EMAIL) {
      // Head admin sees everything — no filter applied
    } else if (filter === "org" && orgId) {
      query = query.where("orgId", "==", orgId);
    } else {
      // Default: user's own usage
      query = query.where("userId", "==", uid);
    }

    // Simple query with single field filter — no composite index needed
    const snapshot = await query.limit(10000).get();

    // Aggregate by model
    const byModel: Record<string, { tokens: number; cost: number; calls: number; characters?: number }> = {};
    let totalCost = 0;
    let totalTokens = 0;
    let totalCalls = 0;

    snapshot.forEach(doc => {
      const e = doc.data();
      const key = `${e.provider}/${e.model}`;
      if (!byModel[key]) byModel[key] = { tokens: 0, cost: 0, calls: 0, characters: 0 };
      byModel[key].tokens += e.totalTokens || 0;
      byModel[key].cost += e.costUsd || 0;
      byModel[key].calls += 1;
      if (e.characters) byModel[key].characters = (byModel[key].characters || 0) + e.characters;
      totalCost += e.costUsd || 0;
      totalTokens += e.totalTokens || 0;
      totalCalls++;
    });

    return NextResponse.json({
      totalCost,
      totalTokens,
      totalCalls,
      byModel,
    });
  } catch (error: any) {
    console.error("[AI Usage API Error]", error?.message, error?.stack);
    // Return zero-state instead of error so the tile renders properly
    return NextResponse.json({
      totalCost: 0,
      totalTokens: 0,
      totalCalls: 0,
      byModel: {},
    });
  }
}
