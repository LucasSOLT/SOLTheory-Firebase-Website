// Standalone migration script using Firebase client SDK with auth
// Run: npx tsx src/scripts/fix-contact-names.ts [--execute]
// Will prompt for email/password to authenticate with Firebase

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import * as readline from "readline";

const firebaseConfig = {
  projectId: "studio-5711990008-7ac2c",
  appId: "1:873103118314:web:a3329a68328d07aee56c93",
  apiKey: "AIzaSyCAJWBLJ1GTXtELpKFubBlENBq0eroUyCM",
  authDomain: "studio-5711990008-7ac2c.firebaseapp.com",
  storageBucket: "studio-5711990008-7ac2c.firebasestorage.app"
};

const BUSINESS_SUFFIXES = [
  "inc", "llc", "corp", "ltd", "foundation", "association",
  "organization", "organisation", "group", "partners", "co.",
  "institute", "university", "church", "ministry", "center",
  "centre", "society", "council", "network", "alliance",
  "academy", "consulting", "solutions", "services", "technologies",
  "enterprises", "holdings", "international", "global", "media",
  "studio", "labs", "ventures", "capital", "properties", "realty",
  "agency", "clinic", "hospital", "pharmacy", "restaurant",
  "bistro", "cafe", "hotel", "resort", "school", "college",
  "homes", "marketing", "direct", "families", "cooperative",
  "credit union", "chamber", "board", "commission", "authority",
  "department", "district", "county", "city of", "state of",
  "township", "borough", "parish"
];

function looksLikeOrgName(firstName: string, lastName: string, company: string): { isOrg: boolean; reason: string } {
  if (company && company.trim()) return { isOrg: false, reason: "company already populated" };
  if (!firstName || firstName.trim().length < 3) return { isOrg: false, reason: "too short" };
  if (firstName.trim() && lastName && lastName.trim()) return { isOrg: false, reason: "has both first and last name" };

  const fn = firstName.trim();
  const words = fn.split(/\s+/);

  if (fn.startsWith("The ") && words.length >= 2) return { isOrg: true, reason: "Starts with 'The'" };

  for (const suffix of BUSINESS_SUFFIXES) {
    const regex = new RegExp(`\\b${suffix.replace('.', '\\.')}\\b`, 'i');
    if (regex.test(fn)) return { isOrg: true, reason: `Contains business suffix '${suffix}'` };
  }

  if (words.length >= 3 && (fn.includes(" & ") || / \band\b /i.test(fn))) {
    return { isOrg: true, reason: "Contains '&' or 'and' with 3+ words" };
  }

  if (words.length >= 2 && fn === fn.toUpperCase() && /[A-Z]/.test(fn)) {
    return { isOrg: true, reason: "All uppercase with 2+ words" };
  }

  return { isOrg: false, reason: "does not match org patterns" };
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

async function main() {
  const executeMode = process.argv.includes("--execute");
  console.log(`\n🔍 Contact Migration — Mode: ${executeMode ? "EXECUTE" : "DRY-RUN"}\n`);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // Sign in
  const email = await prompt("📧 Firebase email: ");
  const password = await prompt("🔑 Password: ");
  
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log(`\n✅ Signed in as ${cred.user.email}\n`);
  } catch (err: any) {
    console.error(`❌ Auth failed: ${err.message}`);
    process.exit(1);
  }

  const contactsRef = collection(db, "shared", "crm", "contacts");
  const snapshot = await getDocs(contactsRef);

  console.log(`📊 Scanned ${snapshot.size} contacts\n`);

  const changes: { id: string; currentFirstName: string; reason: string }[] = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const firstName = (data.firstName as string) || "";
    const lastName = (data.lastName as string) || "";
    const company = (data.company as string) || "";

    const result = looksLikeOrgName(firstName, lastName, company);
    if (result.isOrg) {
      changes.push({ id: docSnap.id, currentFirstName: firstName, reason: result.reason });

      if (executeMode) {
        const contactRef = doc(db, "shared", "crm", "contacts", docSnap.id);
        await updateDoc(contactRef, { company: firstName, firstName: "" });
        console.log(`  ✅ Migrated: "${firstName}" → company  (${result.reason})`);
      } else {
        console.log(`  📋 Would migrate: "${firstName}" → company  (${result.reason})`);
      }
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`📊 Summary:`);
  console.log(`   Scanned:    ${snapshot.size}`);
  console.log(`   Identified: ${changes.length}`);
  console.log(`   Mode:       ${executeMode ? "EXECUTED ✅" : "DRY-RUN (use --execute to apply)"}`);
  console.log(`${"─".repeat(60)}\n`);

  process.exit(0);
}

main().catch(err => { console.error("Migration failed:", err); process.exit(1); });
