import { NextResponse } from "next/server";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";

/**
 * POST /api/sms/webhook-test
 * Diagnostic endpoint to test if the webhook can write to Firestore.
 * Returns detailed JSON instead of TwiML so we can see errors.
 */
export async function POST(req: Request) {
  const steps: string[] = [];
  try {
    const { from, to } = await req.json();
    steps.push(`Parsed body: from=${from}, to=${to}`);

    initAdmin();
    steps.push("Admin SDK initialized");

    const db = getAdminFirestore();
    steps.push("Got Firestore instance");

    // Find the user who owns this Twilio number
    const usersSnapshot = await db.collection("users").where("twilioPhoneNumber", "==", to).limit(1).get();
    steps.push(`User query complete: found ${usersSnapshot.size} users`);

    if (usersSnapshot.empty) {
      return NextResponse.json({ success: false, steps, error: `No user found for number ${to}` });
    }

    const uid = usersSnapshot.docs[0].id;
    steps.push(`Found user: ${uid}`);

    // Try writing a test message
    const docRef = await db.collection("users").doc(uid).collection("sms_messages").add({
      sid: "diagnostic_test_" + Date.now(),
      from: from || "+17204606822",
      to: to || "+17203560494",
      body: "🔧 Webhook diagnostic test",
      direction: "inbound",
      mediaUrls: [],
      createdAt: new Date().toISOString(),
      read: false,
    });
    steps.push(`Message written successfully: ${docRef.id}`);

    return NextResponse.json({ success: true, steps, docId: docRef.id, uid });
  } catch (err: any) {
    steps.push(`ERROR: ${err.message}`);
    return NextResponse.json({ success: false, steps, error: err.message }, { status: 500 });
  }
}
