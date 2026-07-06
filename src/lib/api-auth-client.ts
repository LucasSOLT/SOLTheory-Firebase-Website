/**
 * Client-side auth helper for API calls.
 * 
 * Usage:
 *   import { getAuthHeaders } from "@/lib/api-auth-client";
 *   const headers = await getAuthHeaders();
 *   fetch("/api/some-route", { method: "POST", headers, body: ... });
 */

import { getAuth } from "firebase/auth";

/**
 * Get headers with Firebase ID token for authenticated API calls.
 * Returns headers object with Authorization: Bearer <token> and Content-Type.
 * Throws if no user is signed in.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error("No authenticated user — cannot create auth headers");
  }

  const idToken = await user.getIdToken();
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${idToken}`,
  };
}
