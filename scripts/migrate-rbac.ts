/**
 * @file migrate-rbac.ts
 * @description One-time migration script to populate `allowedOrgs` and `orgRoles`
 * for existing user documents in Firestore.
 *
 * Run with: npx tsx scripts/migrate-rbac.ts
 *
 * Safe to run multiple times — only updates docs that need it.
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

// Initialize with service account
function initAdmin() {
  if (getApps().length > 0) return;

  const saPath = path.resolve(__dirname, "../firebase-service-account.json");
  if (fs.existsSync(saPath)) {
    const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
    initializeApp({ credential: cert(sa) });
    console.log("[Init] Using firebase-service-account.json");
  } else {
    throw new Error("firebase-service-account.json not found. Cannot initialize Firebase Admin.");
  }
}

const DEVELOPER_EMAIL = "lucas@soltheory.com";
const ALL_ORGS = ["soltheory", "nxtchapter"];

function legacyToOrgRole(accessLevel: string, role?: string): string {
  if (role && ["read-only", "user", "super-user", "admin", "owner"].includes(role)) {
    return role;
  }
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

  initAdmin();
  const db = getFirestore();
  const snapshot = await db.collection("users").get();
  let updated = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const email = (data.email || "").toLowerCase();
    const updates: Record<string, any> = {};

    // Skip if already fully migrated
    if (data.allowedOrgs?.length > 0 && data.orgRoles && Object.keys(data.orgRoles).length > 0) {
      skipped++;
      continue;
    }

    // Populate allowedOrgs
    if (!data.allowedOrgs || data.allowedOrgs.length === 0) {
      if (email === DEVELOPER_EMAIL) {
        updates.allowedOrgs = ALL_ORGS;
      } else if (data.organization) {
        const orgVal = data.organization.toLowerCase().replace(/\s+/g, '');
        updates.allowedOrgs = orgVal.includes('nxt') ? ["nxtchapter"] : ["soltheory"];
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

  console.log(`\n✨ Migration complete: ${updated} updated, ${skipped} skipped, ${snapshot.size} total`);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
