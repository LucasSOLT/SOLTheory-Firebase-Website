import { NextResponse } from "next/server";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";

const HEAD_ADMIN_EMAIL = "lucas@soltheory.com";

export async function POST(req: Request) {
  try {
    const { uid, email, orgId, filter } = await req.json();
    // filter: "user" | "org" | "all"

    await initAdmin();
    const db = getAdminFirestore();

    let query: FirebaseFirestore.Query = db.collection("ai_usage");

    if (filter === "all" && email === HEAD_ADMIN_EMAIL) {
      // Head admin sees everything — no filter
    } else if (filter === "org" && orgId) {
      query = query.where("orgId", "==", orgId);
    } else {
      // Default: user's own usage
      query = query.where("userId", "==", uid);
    }

    // Get last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.where("timestamp", ">=", thirtyDaysAgo);

    const snapshot = await query.orderBy("timestamp", "desc").limit(5000).get();

    const entries: any[] = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      entries.push({
        ...d,
        timestamp: d.timestamp?.toDate?.()?.toISOString() || d.timestamp,
      });
    });

    // Aggregate by model
    const byModel: Record<string, { tokens: number; cost: number; calls: number; characters?: number }> = {};
    let totalCost = 0;
    let totalTokens = 0;

    entries.forEach(e => {
      const key = `${e.provider}/${e.model}`;
      if (!byModel[key]) byModel[key] = { tokens: 0, cost: 0, calls: 0, characters: 0 };
      byModel[key].tokens += e.totalTokens || 0;
      byModel[key].cost += e.costUsd || 0;
      byModel[key].calls += 1;
      if (e.characters) byModel[key].characters = (byModel[key].characters || 0) + e.characters;
      totalCost += e.costUsd || 0;
      totalTokens += e.totalTokens || 0;
    });

    return NextResponse.json({
      totalCost,
      totalTokens,
      totalCalls: entries.length,
      byModel,
    });
  } catch (error: any) {
    console.error("[AI Usage API Error]", error?.message);
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
  }
}
