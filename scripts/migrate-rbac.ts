/**
 * @file migrate-rbac.ts
 * @description One-time migration script to populate `allowedOrgs` and `orgRoles`
 * for existing user documents in Firestore.
 *
 * Run with: npx tsx scripts/migrate-rbac.ts
 *
 * What it does:
 * 1. Reads all docs from the `users` collection
 * 2. For each user missing `allowedOrgs`:
 *    - Maps legacy `organization` field to `allowedOrgs` array
 *    - Developer (lucas@soltheory.com) gets access to ALL orgs
 * 3. For each user missing `orgRoles`:
 *    - Maps legacy `role` or `accessLevel` to `orgRoles[org]`
 *
 * Safe to run multiple times — only updates docs that need it.
 */

import * as admin from "firebase-admin";
import { resolve } from "path";

// Initialize Firebase Admin with service account
const serviceAccountPath = resolve(__dirname, "../.gcloud-adc.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
}

const db = admin.firestore();

const DEVELOPER_EMAIL = "lucas@soltheory.com";
const ALL_ORGS = ["soltheory", "nxtchapter"];

// Map legacy accessLevel to OrgRole
function legacyToOrgRole(accessLevel: string, role?: string): string {
  // Prefer new-style `role` field if it's already set
  if (role && ["read-only", "user", "super-user", "admin", "owner"].includes(role)) {
    return role;
  }
  // Map legacy access levels
  switch (accessLevel) {
    case "Read Only": return "read-only";
    case "User-Level": return "user";
    case "Client-Level": return "super-user";
    case "Admin-Level": return "admin";
    case "Oracle": return "owner";
    default: return "user";
  }
}

async function migrate() {
  console.log("🚀 Starting RBAC migration...\n");

  const snapshot = await db.collection("users").get();
  let updated = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const email = (data.email || "").toLowerCase();
    const updates: Record<string, any> = {};

    // Skip if already migrated
    if (data.allowedOrgs?.length > 0 && data.orgRoles && Object.keys(data.orgRoles).length > 0) {
      skipped++;
      continue;
    }

    // Populate allowedOrgs
    if (!data.allowedOrgs || data.allowedOrgs.length === 0) {
      if (email === DEVELOPER_EMAIL) {
        updates.allowedOrgs = ALL_ORGS;
      } else if (data.organization) {
        updates.allowedOrgs = [data.organization];
      } else if (email.endsWith("@soltheory.com")) {
        updates.allowedOrgs = ["soltheory"];
      } else if (email.endsWith("@nxtchapter.org")) {
        updates.allowedOrgs = ["nxtchapter"];
      } else {
        updates.allowedOrgs = [];
        console.warn(`  ⚠️  No org mapping for ${email} (uid: ${doc.id})`);
      }
    }

    // Populate orgRoles
    if (!data.orgRoles || Object.keys(data.orgRoles).length === 0) {
      const orgRole = legacyToOrgRole(data.accessLevel || "", data.role);
      const orgs = updates.allowedOrgs || data.allowedOrgs || [];
      const orgRoles: Record<string, string> = {};
      for (const org of orgs) {
        orgRoles[org] = email === DEVELOPER_EMAIL ? "owner" : orgRole;
      }
      if (Object.keys(orgRoles).length > 0) {
        updates.orgRoles = orgRoles;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.collection("users").doc(doc.id).update(updates);
      updated++;
      console.log(`  ✅ ${email || doc.id}: allowedOrgs=${JSON.stringify(updates.allowedOrgs || data.allowedOrgs)}, orgRoles=${JSON.stringify(updates.orgRoles || data.orgRoles)}`);
    } else {
      skipped++;
    }
  }

  console.log(`\n✨ Migration complete: ${updated} updated, ${skipped} skipped (already migrated), ${snapshot.size} total`);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
