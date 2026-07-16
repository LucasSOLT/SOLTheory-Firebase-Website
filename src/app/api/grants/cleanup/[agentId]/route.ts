import { NextResponse } from "next/server";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { verifyRequest } from "@/lib/api-auth";
import { getAuth } from "firebase-admin/auth";

/**
 * DELETE /api/grants/cleanup/[agentId]
 *
 * Deletes all grant_suggestions documents created by a specific agent.
 * Requires authentication with an authorized admin user.
 */

const AUTHORIZED_EMAIL = "lucas@soltheory.com";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  // 1. Verify Firebase Auth token
  const auth = await verifyRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const { agentId } = await params;

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    // 2. Verify the user is an authorized admin
    initAdmin();
    const userRecord = await getAuth().getUser(auth.uid);
    if (userRecord.email !== AUTHORIZED_EMAIL) {
      console.warn(
        `[Cleanup:${agentId}] Unauthorized cleanup attempt by ${userRecord.email} (uid: ${auth.uid})`
      );
      return NextResponse.json(
        { error: "You are not authorized to perform this action" },
        { status: 403 }
      );
    }

    // 3. Use Admin SDK Firestore
    const db = getFirestore();
    const snapshot = await db
      .collection("grant_suggestions")
      .where("agentId", "==", agentId)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        deleted: 0,
        message: `No grants found for agent ${agentId}`,
      });
    }

    // Batch delete (Firestore batches max 500 ops)
    const batch = db.batch();
    let count = 0;

    for (const document of snapshot.docs) {
      batch.delete(document.ref);
      count++;
    }

    await batch.commit();

    console.log(
      `[Cleanup:${agentId}] Admin ${userRecord.email} deleted ${count} grant suggestions`
    );
    return NextResponse.json({
      deleted: count,
      message: `Deleted ${count} grant suggestions from ${agentId}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Cleanup:agentId] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
