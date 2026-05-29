import { NextResponse } from "next/server";

/* ─── Schema Reference ───
  Collection: grant_suggestions
  Document fields:
    id              : auto-generated Firestore document ID
    title           : string
    description     : string
    agency          : string
    amount          : number (decimal)
    status          : 'unapplied' | 'applied' | 'approved' | 'denied'
    dateSuggested   : Timestamp
    orgId           : string  (organization ID for multi-tenancy)
    location_state  : string
    location_city   : string
    url             : string
    eligibility     : string
    fundingInstrument : string
    activityCategories : string[]
    grantStructures    : string[]
    agencyLevels       : string[]
    appliedAt       : Timestamp | null
    completedAt     : Timestamp | null
    deniedAt        : Timestamp | null
    createdAt       : Timestamp
─── */

/**
 * Safely initialize Firebase Admin.
 * Returns null if credentials are not available (e.g. local dev without service account).
 */
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
        // Try application default credentials
        initializeApp({ projectId });
      } else {
        return null;
      }
    }
    return getFirestore();
  } catch (err) {
    console.warn("Firebase Admin init skipped:", (err as Error)?.message);
    return null;
  }
}

/**
 * GET /api/grants
 *
 * Fetches all grant_suggestions for the soltheory org.
 * Always returns a valid JSON array — even if empty.
 *
 * Query params:
 *   ?orgId=soltheory (optional, defaults to "soltheory")
 *   ?status=unapplied|applied|approved|denied (optional filter)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId") || "soltheory";
    const statusFilter = searchParams.get("status");

    const db = await getAdminFirestore();

    // If Firebase Admin isn't available, return empty array gracefully
    if (!db) {
      return NextResponse.json([], { status: 200 });
    }

    let q: FirebaseFirestore.Query = db
      .collection("grant_suggestions")
      .where("orgId", "==", orgId);

    if (statusFilter && ["unapplied", "applied", "approved", "denied"].includes(statusFilter)) {
      q = q.where("status", "==", statusFilter);
    }

    const snapshot = await q.orderBy("dateSuggested", "desc").get();

    const grants = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title || "",
        description: d.description || "",
        agency: d.agency || "",
        amount: d.amount ?? null,
        status: d.status || "unapplied",
        dateSuggested: d.dateSuggested?.toDate?.()?.toISOString() || null,
        location_state: d.location_state || "",
        location_city: d.location_city || "",
        url: d.url || "",
        eligibility: d.eligibility || "",
        fundingInstrument: d.fundingInstrument || "",
        activityCategories: d.activityCategories || [],
        grantStructures: d.grantStructures || [],
        agencyLevels: d.agencyLevels || [],
        appliedAt: d.appliedAt?.toDate?.()?.toISOString() || null,
        completedAt: d.completedAt?.toDate?.()?.toISOString() || null,
        deniedAt: d.deniedAt?.toDate?.()?.toISOString() || null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    // Always return 200 with a valid array — even if empty
    return NextResponse.json(grants, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/grants error:", err?.message || err);

    // Always return 200 with empty array on error — frontend widgets
    // degrade gracefully to zeroed-out charts rather than breaking
    return NextResponse.json([], { status: 200 });
  }
}
