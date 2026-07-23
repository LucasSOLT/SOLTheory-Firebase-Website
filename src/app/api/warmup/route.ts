import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import Groq from "groq-sdk";

/**
 * Warmup endpoint — called silently on dashboard load to pre-initialize:
 * 1. Firebase Admin SDK
 * 2. Firestore connection pool
 * 3. Groq API connection
 * 
 * This eliminates the "cold start" delay on the user's first real message.
 */
export async function GET(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  const t0 = Date.now();
  try {
    // 1. Initialize Firebase Admin (creates persistent connection)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      await initAdmin();
      // 2. Warm Firestore connection by reading a lightweight doc
      const adminDb = getAdminFirestore();
      await adminDb.collection('_warmup').doc('ping').get().catch(() => {});
    }

    // 3. Warm Groq connection (lightweight models list call)
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    await groq.models.list().catch(() => {});

    console.log(`[WARMUP] Pre-initialization complete in ${Date.now() - t0}ms`);
    return NextResponse.json({ ok: true, ms: Date.now() - t0 });
  } catch (err) {
    console.warn(`[WARMUP] Non-fatal warmup error:`, (err as any)?.message);
    return NextResponse.json({ ok: true, ms: Date.now() - t0 });
  }
}
