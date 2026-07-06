import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";

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

export async function DELETE(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const db = await getAdminFirestore();
    if (!db) {
      return NextResponse.json({ deleted: 0, message: "No admin DB available (need FIREBASE_PRIVATE_KEY in env)" });
    }

    const snapshot = await db.collection("grant_suggestions").get();
    const batch = db.batch();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });

    if (count > 0) {
      await batch.commit();
    }

    return NextResponse.json({ deleted: count, message: `Deleted ${count} grant suggestions` });
  } catch (err: any) {
    console.error("Cleanup error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
