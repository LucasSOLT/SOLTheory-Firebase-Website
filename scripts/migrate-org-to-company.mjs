/**
 * One-time migration: Move "Organization Name" (custom_1782866511049_9wdp) → "company"
 * for all CRM contacts.
 * 
 * Run with: node --env-file=.env.local scripts/migrate-org-to-company.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const ORG_NAME_FIELD_ID = "custom_1782866511049_9wdp";  // "Organization Name"

const app = initializeApp({credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))});
const db = getFirestore(app);

async function migrate() {
  const stats = { updated: 0, skipped: 0, alreadyHadCompany: 0 };
  
  const contactsPath = 'orgs/soltheory/crm-instances/default/contacts';
  const snap = await db.collection(contactsPath).get();
  console.log(`📁 ${snap.size} contacts found\n`);
  
  for (const contactDoc of snap.docs) {
    const data = contactDoc.data();
    const name = `${data.firstName || ""} ${data.lastName || ""}`.trim() || contactDoc.id;
    
    const orgNameValue = data.customFields?.[ORG_NAME_FIELD_ID] || "";
    const currentCompany = data.company || "";
    
    if (!orgNameValue) {
      stats.skipped++;
      continue;
    }
    
    // Build update
    const updates = {};
    
    if (!currentCompany) {
      // No company yet — set it from Organization Name
      updates.company = orgNameValue;
    } else if (currentCompany === orgNameValue) {
      // Already the same — just need to clean up the custom field
      stats.alreadyHadCompany++;
    } else {
      // Company has a different value — keep company, don't overwrite
      // (This shouldn't happen based on the data, but just in case)
      console.log(`  ⚠️  ${name}: company="${currentCompany}" vs orgName="${orgNameValue}" — keeping company`);
      stats.alreadyHadCompany++;
    }
    
    // Remove Organization Name from customFields
    const cleanedCustomFields = { ...data.customFields };
    delete cleanedCustomFields[ORG_NAME_FIELD_ID];
    updates.customFields = cleanedCustomFields;
    
    try {
      await contactDoc.ref.update(updates);
      if (updates.company) {
        console.log(`  ✅ ${name}: → company="${updates.company}"`);
      } else {
        console.log(`  🧹 ${name}: cleaned up custom field (company already="${currentCompany}")`);
      }
      stats.updated++;
    } catch (err) {
      console.log(`  ❌ ${name}: ${err.message}`);
    }
  }
  
  console.log(`\n${"═".repeat(50)}`);
  console.log(`✅ Migrated/cleaned: ${stats.updated}`);
  console.log(`📋 Already had company: ${stats.alreadyHadCompany}`);
  console.log(`⏭️  Skipped (no org name): ${stats.skipped}`);
  console.log(`${"═".repeat(50)}\n`);
}

migrate().then(() => process.exit(0)).catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
