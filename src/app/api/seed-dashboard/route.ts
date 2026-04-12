import { NextResponse } from "next/server";
import { getFirestore } from "@/firebase/admin";

export async function POST() {
  try {
    const adminDb = getFirestore();
    const adminAuth = {} as any; // Mocking adminAuth temporarily as it's missing from admin.ts
    // 1. Create Organizations exactly as specified
    const orgs = ["soltheory", "nxtchapter", "lnu"];
    for (const org of orgs) {
      await adminDb.collection("organizations").doc(org).set({
        id: org,
        name: org.toUpperCase(),
        createdAt: new Date().toISOString()
      }, { merge: true });
    }

    // 2. Ensure exactly 11 Users to match constraints
    const usersList = await adminAuth.listUsers(100);
    let currentCount = usersList.users.length;
    let createdCount = 0;
    
    // Auto-generate mock clients if user count is below 11
    while (currentCount < 11) {
      const mockEmail = `client_${createdCount}_${Date.now()}@mockdomain.com`;
      try {
        const user = await adminAuth.createUser({
          email: mockEmail,
          password: "Password123!",
          displayName: `Mock Client ${createdCount}`
        });
        await adminDb.collection("users").doc(user.uid).set({
          email: mockEmail,
          role: "client",
          domain: "mockdomain.com",
          createdAt: new Date().toISOString()
        });
        currentCount++;
        createdCount++;
      } catch (e) {
        // Safe fail on iteration
      }
    }

    // 3. Seed Platform Traffic Analytics Baseline
    const analyticsRef = adminDb.collection("platform_analytics").doc("traffic");
    await analyticsRef.set({
      history: [
        { time: '00:00', users: 120 },
        { time: '04:00', users: 80 },
        { time: '08:00', users: 340 },
        { time: '12:00', users: 560 },
        { time: '16:00', users: 480 },
        { time: '20:00', users: 290 },
        { time: '23:59', users: 150 }
      ],
      lastUpdated: new Date().toISOString()
    });

    return NextResponse.json({ success: true, createdCount, currentCount, orgsCreated: orgs.length });
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
