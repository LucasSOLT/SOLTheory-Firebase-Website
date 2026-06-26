import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";

/** Retrieve BlueBubbles credentials from Firestore for a given user. */
export async function getBlueBubblesConfig(uid: string): Promise<{ serverUrl: string; password: string }> {
  initAdmin();
  const db = getAdminFirestore();
  const userDoc = await db.collection("users").doc(uid).get();
  const data = userDoc.data();

  const serverUrl = data?.imessageServerUrl;
  const password = data?.imessagePassword;

  if (!serverUrl || !password) {
    throw new Error("BlueBubbles not configured. Go to Settings → Integrations to connect iMessage.");
  }

  return { serverUrl: serverUrl.replace(/\/+$/, ""), password };
}
