/**
 * Quick diagnostic: print field names from the first 5 contacts
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

function initAdmin() {
  if (getApps().length > 0) return;
  const saPath = path.resolve(__dirname, "../firebase-service-account.json");
  const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
  initializeApp({ credential: cert(sa) });
}

async function check() {
  initAdmin();
  const db = getFirestore();
  const snap = await db.collection("orgs/soltheory/crm-instances/default/contacts").limit(5).get();
  snap.docs.forEach((doc, i) => {
    const data = doc.data();
    console.log(`\n--- Contact ${i+1} (${data.firstName} ${data.lastName}) ---`);
    console.log("Fields:", Object.keys(data).sort().join(", "));
    // Check for any org-related field
    const orgFields = Object.keys(data).filter(k => k.toLowerCase().includes("org") || k.toLowerCase().includes("company") || k.toLowerCase().includes("business"));
    if (orgFields.length > 0) {
      orgFields.forEach(k => console.log(`  ${k}: "${data[k]}"`));
    }
  });
  console.log("\nTotal contacts:", (await db.collection("orgs/soltheory/crm-instances/default/contacts").count().get()).data().count);
}

check().catch(console.error);
