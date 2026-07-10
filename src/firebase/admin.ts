import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseConfig } from "@/firebase/config";
import * as fs from "fs";
import * as path from "path";

let adminApp: App | undefined;

export function initAdmin() {
  if (getApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Production: use inline service account JSON from env var
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        adminApp = initializeApp({
          credential: cert(serviceAccount),
        });
        console.log("[Admin] Initialized with FIREBASE_SERVICE_ACCOUNT env var");
        return;
      } catch (e) {
        console.error("[Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT:", e);
      }
    }
    
    // Local dev: read Firebase CLI's access token directly
    // This avoids RAPT (Re-Authentication Policy) issues with Google Workspace
    if (typeof process !== "undefined" && (process.env.APPDATA !== undefined || process.env.HOME)) {
      // Check multiple possible locations for firebase-tools.json
      const candidates = [
        path.join(process.env.HOME || "", ".config", "configstore", "firebase-tools.json"),
        path.join(process.env.APPDATA || "", "configstore", "firebase-tools.json"),
      ];
      const configPath = candidates.find(p => fs.existsSync(p)) || candidates[0];

      try {
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
          const accessToken = config?.tokens?.access_token;

          if (accessToken) {
            adminApp = initializeApp({
              credential: {
                getAccessToken: () => {
                  // Re-read the file each time to pick up refreshed tokens
                  const freshConfig = JSON.parse(
                    fs.readFileSync(configPath, "utf8")
                  );
                  return Promise.resolve({
                    access_token: freshConfig.tokens.access_token,
                    expires_in: Math.max(
                      0,
                      Math.floor(
                        (freshConfig.tokens.expires_at - Date.now()) / 1000
                      )
                    ),
                  });
                },
              },
              projectId: firebaseConfig.projectId,
            });
            console.log(
              "[Admin] Initialized with Firebase CLI access token (local dev)"
            );
            return;
          }
        }
      } catch (e) {
        console.warn("[Admin] Could not load Firebase CLI credentials:", e);
      }
    }

    // Final fallback — try applicationDefault (works on GCP, may fail elsewhere)
    console.warn("[Admin] No FIREBASE_SERVICE_ACCOUNT env var set. Using projectId-only fallback. Some features requiring admin auth may fail.");
    adminApp = initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
}

export { getFirestore };
