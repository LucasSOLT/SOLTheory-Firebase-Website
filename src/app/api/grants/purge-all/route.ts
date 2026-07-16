import { NextResponse } from "next/server";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { verifyRequest } from "@/lib/api-auth";
import { getAuth } from "firebase-admin/auth";

/**
 * DELETE /api/grants/purge-all
 *
 * Deletes EVERY document in the grant_suggestions collection.
 * REQUIRES authentication — only admin users can purge all grants.
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
      console.warn(`[PurgeAll] Unauthorized purge attempt by ${userRecord.email} (uid: ${auth.uid})`);
      return NextResponse.json(
        { error: "You are not authorized to perform this action" },
        { status: 403 }
      );
    }

    // 3. Use Admin SDK Firestore
    const db = getFirestore();
    const grantsRef = db.collection("grant_suggestions");
    const snapshot = await grantsRef.get();

    if (snapshot.empty) {
      return NextResponse.json({ deleted: 0, message: "No grants to delete" });
    }

    // Batch delete (Firestore batches max 500 ops)
    let deleted = 0;
    const BATCH_LIMIT = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const document of snapshot.docs) {
      batch.delete(document.ref);
      batchCount++;
      deleted++;

      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`[PurgeAll] Admin ${userRecord.email} purged ${deleted} grants`);
    return NextResponse.json({
      deleted,
      message: `Successfully deleted ${deleted} grants`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PurgeAll] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
