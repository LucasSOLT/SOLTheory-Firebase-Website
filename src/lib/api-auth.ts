/**
 * API Authentication Helper
 * 
 * Verifies Firebase ID tokens sent in the Authorization header.
 * Usage in any API route:
 * 
 *   import { verifyRequest } from "@/lib/api-auth";
 *   
 *   export async function POST(req: NextRequest) {
 *     const auth = await verifyRequest(req);
 *     if (!auth.ok) return auth.response;
 *     // auth.uid is the verified user ID
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/firebase/admin";
import { getAuth } from "firebase-admin/auth";

type AuthSuccess = { ok: true; uid: string };
type AuthFailure = { ok: false; response: NextResponse };
type AuthResult = AuthSuccess | AuthFailure;

/**
 * Verify that the request contains a valid Firebase ID token.
 * Expects header: Authorization: Bearer <idToken>
 */
export async function verifyRequest(req: Request | NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing or invalid Authorization header. Expected: Bearer <token>" },
        { status: 401 }
      ),
    };
  }

  const idToken = match[1];

  try {
    initAdmin();
    const decoded = await getAuth().verifyIdToken(idToken);
    return { ok: true, uid: decoded.uid };
  } catch (err: any) {
    console.error("[API Auth] Token verification failed:", err.message);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or expired authentication token" },
        { status: 401 }
      ),
    };
  }
}

/**
 * Helper to get a Firebase ID token on the client side.
 * Use this in components to add auth to fetch calls:
 * 
 *   import { getAuthHeaders } from "@/lib/api-auth-client";
 *   const headers = await getAuthHeaders();
 *   fetch("/api/some-route", { headers, ... });
 */

/** Admin email whitelist */
const ADMIN_EMAILS = [
  "lucas@soltheory.com",
  "steve@soltheory.com",
  "gerard@soltheory.com",
];

/**
 * Verify that the request contains a valid Firebase ID token
 * AND that the user is an admin (email in whitelist).
 * Use for privileged endpoints like user provisioning, seeding, etc.
 */
export async function verifyAdmin(req: Request | NextRequest): Promise<AuthResult> {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth;

  try {
    initAdmin();
    const userRecord = await getAuth().getUser(auth.uid);
    const email = userRecord.email || "";

    if (!ADMIN_EMAILS.includes(email)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Forbidden — admin access required" },
          { status: 403 }
        ),
      };
    }

    return { ok: true, uid: auth.uid };
  } catch (err: any) {
    console.error("[API Auth] Admin verification failed:", err.message);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin verification failed" },
        { status: 403 }
      ),
    };
  }
}
