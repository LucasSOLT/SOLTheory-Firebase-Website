/**
 * @file migrate-org-to-company.ts
 * @description Migrates contact documents: moves data from "organizationName"
 * and "Organization Name" fields into "company", then deletes the old field.
 *
 * Run with: npx tsx scripts/migrate-org-to-company.ts
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

function initAdmin() {
  if (getApps().length > 0) return;
  const saPath = path.resolve(__dirname, "../firebase-service-account.json");
  if (fs.existsSync(saPath)) {
    const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
    initializeApp({ credential: cert(sa) });
    console.log("[Init] Using firebase-service-account.json");
  } else {
    throw new Error("firebase-service-account.json not found.");
  }
}

async function migrate() {
  console.log("🚀 Migrating organizationName → company in contacts...\n");
  initAdmin();
  const db = getFirestore();

  // Check all CRM instances for contacts with organizationName
  const orgPaths = [
    "orgs/soltheory/crm-instances/default/contacts",
    "orgs/nxtchapter/crm-instances/default/contacts",
    // Also check legacy paths
    "shared/crm/contacts",
  ];

  let totalMigrated = 0;

  for (const colPath of orgPaths) {
    try {
      const snapshot = await db.collection(colPath).get();
      if (snapshot.empty) {
        console.log(`  📁 ${colPath}: empty or doesn't exist`);
        continue;
      }

      let migrated = 0;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const orgName = data.organizationName || data["Organization Name"];

        if (orgName && !data.company) {
          // Move organizationName to company
          const updates: Record<string, any> = {
            company: orgName,
          };
          // Delete old field names
          if (data.organizationName !== undefined) {
            updates.organizationName = FieldValue.delete();
          }
          if (data["Organization Name"] !== undefined) {
            updates["Organization Name"] = FieldValue.delete();
          }

          await doc.ref.update(updates);
          migrated++;
          console.log(`  ✅ ${data.firstName || ''} ${data.lastName || ''}: "${orgName}" → company`);
        } else if (orgName && data.company) {
          // Company already set, just clean up old field
          const updates: Record<string, any> = {};
          if (data.organizationName !== undefined) {
            updates.organizationName = FieldValue.delete();
          }
          if (data["Organization Name"] !== undefined) {
            updates["Organization Name"] = FieldValue.delete();
          }
          if (Object.keys(updates).length > 0) {
            await doc.ref.update(updates);
            migrated++;
            console.log(`  🧹 ${data.firstName || ''} ${data.lastName || ''}: removed old field (company already set to "${data.company}")`);
          }
        }
      }

      console.log(`  📁 ${colPath}: ${migrated} contacts updated out of ${snapshot.size}\n`);
      totalMigrated += migrated;
    } catch (err: any) {
      console.warn(`  ⚠️  ${colPath}: ${err.message}`);
    }
  }

  console.log(`\n✨ Done! ${totalMigrated} contacts migrated.`);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
