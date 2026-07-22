/**
 * Migrate company data from customFields.custom_1782866511049_9wdp → company field.
 * 
 * Based on scan results:
 *   - "custom_1782866511049_9wdp" holds company/org names (326 contacts)
 *     e.g. "CrossPurpose", "Denver County Court", "LFM Defense"
 *   - Only 5 contacts already have "company" filled
 *   - 992 contacts have empty company fields
 *
 * This script copies customFields.custom_1782866511049_9wdp → company
 * for all contacts that don't already have a company value.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";

if (getApps().length === 0) {
  const serviceAccountPath = path.resolve(__dirname, "../firebase-service-account.json");
  initializeApp({ credential: cert(serviceAccountPath) });
}

const db = getFirestore();

const CUSTOM_COMPANY_FIELD = "custom_1782866511049_9wdp";

async function main() {
  const collectionPath = "orgs/soltheory/crm-instances/default/contacts";
  console.log(`\n📂 Reading contacts from: ${collectionPath}\n`);

  const snapshot = await db.collection(collectionPath).get();
  console.log(`📊 Total contacts: ${snapshot.size}\n`);

  const toMigrate: { id: string; name: string; value: string }[] = [];
  let alreadyHave = 0;
  let noCustomField = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Skip contacts that already have a company value
    if (data.company && String(data.company).trim()) {
      alreadyHave++;
      continue;
    }

    // Check if the custom field has a value
    const customValue = data.customFields?.[CUSTOM_COMPANY_FIELD];
    if (customValue && String(customValue).trim()) {
      toMigrate.push({
        id: doc.id,
        name: `${data.firstName || '?'} ${data.lastName || '?'}`,
        value: String(customValue).trim(),
      });
    } else {
      noCustomField++;
    }
  }

  console.log("═══════════════════════════════════════════");
  console.log("         MIGRATION PREVIEW");
  console.log("═══════════════════════════════════════════");
  console.log(`  ✅ Already have 'company': ${alreadyHave}`);
  console.log(`  🔄 Will migrate from customField: ${toMigrate.length}`);
  console.log(`  ❌ No company data anywhere: ${noCustomField}`);
  console.log("");

  // Show first 20 examples
  console.log("  First 20 contacts to migrate:");
  for (const item of toMigrate.slice(0, 20)) {
    console.log(`    ${item.name.padEnd(25)} → "${item.value}"`);
  }

  if (toMigrate.length === 0) {
    console.log("\n✅ Nothing to migrate.");
    return;
  }

  // Execute migration
  console.log(`\n🔄 Migrating ${toMigrate.length} contacts...`);

  let batch = db.batch();
  let batchCount = 0;
  let totalMigrated = 0;

  for (const item of toMigrate) {
    const docRef = db.collection(collectionPath).doc(item.id);
    batch.update(docRef, { company: item.value });
    batchCount++;
    totalMigrated++;

    if (batchCount >= 450) {
      await batch.commit();
      console.log(`  ✅ Committed batch (${totalMigrated} so far)`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`  ✅ Committed final batch`);
  }

  console.log(`\n🎉 Done! Migrated ${totalMigrated} contacts' company field.`);
  console.log(`   They'll show up in the CRM's Company column immediately on refresh.`);
}

main().catch(console.error);
