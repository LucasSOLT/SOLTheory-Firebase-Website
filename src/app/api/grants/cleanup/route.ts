import { NextResponse } from "next/server";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { verifyRequest } from "@/lib/api-auth";
import { getAuth } from "firebase-admin/auth";

/**
 * DELETE /api/grants/cleanup
 *
 * Deletes all documents in the grant_suggestions collection.
 * Requires authentication with an authorized admin user.
 */

const AUTHORIZED_EMAIL = "lucas@soltheory.com";

export async function DELETE(req: Request) {
  // 1. Verify Firebase Auth token
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    // 2. Verify the user is an authorized admin
    initAdmin();
    const userRecord = await getAuth().getUser(auth.uid);
    if (userRecord.email !== AUTHORIZED_EMAIL) {
      console.warn(`[Cleanup] Unauthorized cleanup attempt by ${userRecord.email} (uid: ${auth.uid})`);
      return NextResponse.json(
        { error: "You are not authorized to perform this action" },
        { status: 403 }
      );
    }

    // 3. Use Admin SDK Firestore
    const db = getFirestore();
    const snapshot = await db.collection("grant_suggestions").get();

    if (snapshot.empty) {
      return NextResponse.json({ deleted: 0, message: "No grants to delete" });
    }

    // Batch delete (Firestore batches max 500 ops)
    let count = 0;
    const BATCH_LIMIT = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const document of snapshot.docs) {
      batch.delete(document.ref);
      batchCount++;
      count++;

      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`[Cleanup] Admin ${userRecord.email} deleted ${count} grant suggestions`);
    return NextResponse.json({ deleted: count, message: `Deleted ${count} grant suggestions` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Cleanup] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
