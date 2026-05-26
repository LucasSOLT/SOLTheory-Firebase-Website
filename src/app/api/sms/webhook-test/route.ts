import { NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where, limit } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const WEBHOOK_APP_NAME = "sms-webhook-test";

function getTestApp() {
  try { return getApp(WEBHOOK_APP_NAME); }
  catch { return initializeApp(firebaseConfig, WEBHOOK_APP_NAME); }
}

export async function POST(req: Request) {
  const steps: string[] = [];
  try {
    const { from, to } = await req.json();
    steps.push(`Parsed: from=${from}, to=${to}`);
    steps.push(`Config: projectId=${firebaseConfig.projectId}, apiKey=${firebaseConfig.apiKey ? 'SET' : 'MISSING'}`);

    const app = getTestApp();
    steps.push("Firebase Client app initialized");

    const db = getFirestore(app);
    steps.push("Got Firestore");

    const q = query(collection(db, "users"), where("twilioPhoneNumber", "==", to), limit(1));
    const snap = await getDocs(q);
    steps.push(`User query: found ${snap.size} users`);

    if (snap.empty) {
      return NextResponse.json({ success: false, steps, error: `No user for ${to}` });
    }

    const uid = snap.docs[0].id;
    steps.push(`User UID: ${uid}`);

    const docRef = await addDoc(collection(db, "users", uid, "sms_messages"), {
      sid: "diag_client_sdk_" + Date.now(),
      from: from || "+17204606822",
      to: to || "+17203560494",
      body: "🔧 Client SDK diagnostic test",
      direction: "inbound",
      mediaUrls: [],
      createdAt: new Date().toISOString(),
      read: false,
    });
    steps.push(`Message written: ${docRef.id}`);

    return NextResponse.json({ success: true, steps, docId: docRef.id, uid });
  } catch (err: any) {
    steps.push(`ERROR: ${err.message}`);
    return NextResponse.json({ success: false, steps, error: err.message }, { status: 500 });
  }
}
