import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseConfig } from "@/firebase/config";

let adminApp: App | undefined;

export function initAdmin() {
  if (getApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      // Local dev fallback: use project ID from client config
      // This works for Firestore reads/writes when running locally with
      // Firebase emulator or when the Firestore security rules allow access.
      adminApp = initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
  }
}

export { getFirestore };
