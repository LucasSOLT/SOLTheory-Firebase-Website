import { NextResponse } from "next/server";

async function getAdminFirestore() {
  try {
    const { getApps, initializeApp, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");

    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

      if (projectId && clientEmail && privateKey) {
        initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
      } else if (projectId) {
        initializeApp({ projectId });
      } else {
        return null;
      }
    }
    return getFirestore();
  } catch {
    return null;
  }
}

/**
 * DELETE /api/grants/cleanup/[agentId]
 * Deletes all grant_suggestions documents created by a specific agent.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const db = await getAdminFirestore();
    if (!db) {
      return NextResponse.json({ deleted: 0, message: "No admin DB available (need FIREBASE_PRIVATE_KEY in env)" });
    }

    // Query only grants from this specific agent
    const snapshot = await db
      .collection("grant_suggestions")
      .where("agentId", "==", agentId)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ deleted: 0, message: `No grants found for agent ${agentId}` });
    }

    // Batch delete (Firestore batches max 500 — safe for our use case)
    const batch = db.batch();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });

    await batch.commit();

    return NextResponse.json({ deleted: count, message: `Deleted ${count} grant suggestions from ${agentId}` });
  } catch (err: any) {
    console.error("Agent cleanup error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
