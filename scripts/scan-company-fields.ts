/**
 * Deep-scan customFields to find any company/org data hiding there.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";

if (getApps().length === 0) {
  const serviceAccountPath = path.resolve(__dirname, "../firebase-service-account.json");
  initializeApp({ credential: cert(serviceAccountPath) });
}

const db = getFirestore();

async function main() {
  const collectionPath = "orgs/soltheory/crm-instances/default/contacts";
  const snapshot = await db.collection(collectionPath).get();

  // Collect ALL unique customField keys
  const customFieldKeys = new Map<string, { count: number; samples: string[] }>();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.customFields || typeof data.customFields !== "object") continue;
    
    for (const [key, val] of Object.entries(data.customFields as Record<string, any>)) {
      const entry = customFieldKeys.get(key) || { count: 0, samples: [] };
      entry.count++;
      if (entry.samples.length < 3 && val && String(val).trim()) {
        entry.samples.push(String(val).trim().slice(0, 60));
      }
      customFieldKeys.set(key, entry);
    }
  }

  console.log(`\n📂 Contacts: ${snapshot.size}`);
  console.log(`\n📋 All customField keys found:\n`);
  
  const sorted = [...customFieldKeys.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [key, info] of sorted) {
    console.log(`  "${key}" — ${info.count} contacts`);
    if (info.samples.length > 0) {
      console.log(`    Samples: ${info.samples.join(" | ")}`);
    }
  }

  // Also check the first 5 contacts that DO have company to see what they look like
  console.log("\n\n═══ Contacts WITH company data ═══\n");
  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.company && String(data.company).trim()) {
      count++;
      console.log(`  ${data.firstName} ${data.lastName}: company="${data.company}"`);
      if (count >= 10) break;
    }
  }

  // Check a sample of contacts WITHOUT company to see all their data
  console.log("\n\n═══ Sample contacts WITHOUT company (first 5) ═══\n");
  let count2 = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.company || !String(data.company).trim()) {
      count2++;
      console.log(`  --- ${data.firstName || '?'} ${data.lastName || '?'} ---`);
      console.log(`    email: ${data.email || '(none)'}`);
      console.log(`    phone: ${data.phone || '(none)'}`);
      console.log(`    customFields: ${JSON.stringify(data.customFields || {})}`);
      if (count2 >= 5) break;
    }
  }
}

main().catch(console.error);
