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
import { isGlobalAdmin, DEVELOPER_EMAIL, getOrgByEmailDomain } from "@/lib/org-config";
import { getFirestore } from "firebase-admin/firestore";

type AuthSuccess = { ok: true; uid: string; email: string };
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
    return { ok: true, uid: decoded.uid, email: decoded.email || "" };
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



/**
 * Verify that the request contains a valid Firebase ID token
 * AND that the user is an admin (email in whitelist).
 * Use for privileged endpoints like user provisioning, seeding, etc.
 */
export async function verifyAdmin(req: Request | NextRequest): Promise<AuthResult> {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth;

  // Use the email already extracted from the ID token by verifyRequest
  if (!isGlobalAdmin(auth.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden — admin access required" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, uid: auth.uid, email: auth.email };
}

/**
 * Verify that the request is from the platform developer.
 * Use for God-mode endpoints like End-User Management, cross-org operations.
 */
export async function verifyDeveloper(req: Request | NextRequest): Promise<AuthResult> {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth;

  if (auth.email.toLowerCase() !== DEVELOPER_EMAIL) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden — developer access required" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, uid: auth.uid, email: auth.email };
}

/**
 * Verify that the authenticated user is a member of the specified organization.
 * Checks the user's Firestore document for `allowedOrgs` array.
 * Developer always passes.
 */
export async function verifyOrgMember(req: Request | NextRequest, orgId: string): Promise<AuthResult> {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth;

  // Developer bypasses org checks
  if (auth.email.toLowerCase() === DEVELOPER_EMAIL) {
    return { ok: true, uid: auth.uid, email: auth.email };
  }

  // Check email domain first — no Firestore needed, covers the common case fast
  const domainOrg = getOrgByEmailDomain(auth.email);
  if (domainOrg && domainOrg.id === orgId) {
    return { ok: true, uid: auth.uid, email: auth.email };
  }

  // Check Firestore user document for allowedOrgs / organization field
  try {
    initAdmin();
    const db = getFirestore();
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.data();

    if (!userData) {
      console.warn(`[API Auth] No user document found for uid=${auth.uid}, email=${auth.email}`);
      return {
        ok: false,
        response: NextResponse.json(
          { error: "User profile not found. Please contact your administrator." },
          { status: 403 }
        ),
      };
    }

    // Check frozen status
    if (userData.frozenAt) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Account frozen. Contact your administrator." },
          { status: 403 }
        ),
      };
    }

    // Check org membership — handle both array and string allowedOrgs
    const rawAllowed = userData.allowedOrgs;
    const allowedOrgs: string[] = Array.isArray(rawAllowed) ? rawAllowed : (typeof rawAllowed === "string" ? [rawAllowed] : []);

    if (allowedOrgs.includes(orgId)) {
      return { ok: true, uid: auth.uid, email: auth.email };
    }

    // Fallback: check legacy `organization` field with fuzzy matching
    // Legacy field stores display names like "SOL Theory" — normalize and check
    if (userData.organization) {
      const orgVal = userData.organization.toLowerCase().replace(/\s+/g, "");
      if (orgVal.includes(orgId) || orgId === orgVal) {
        return { ok: true, uid: auth.uid, email: auth.email };
      }
    }

    console.warn(`[API Auth] Org access denied: uid=${auth.uid}, email=${auth.email}, orgId=${orgId}, allowedOrgs=${JSON.stringify(allowedOrgs)}, organization=${userData.organization || "none"}`);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden — you do not have access to this organization" },
        { status: 403 }
      ),
    };
  } catch (err: any) {
    console.error("[API Auth] Org membership check failed:", err.message, err.stack);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to verify organization membership" },
        { status: 500 }
      ),
    };
  }
}
