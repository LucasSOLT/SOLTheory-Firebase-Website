/**
 * Remove the "Organization Name" custom field definition from user field configs
 * so it no longer appears as a column in the CRM UI.
 * 
 * Run with: node --env-file=.env.local scripts/remove-org-name-field.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ORG_NAME_FIELD_ID = "custom_1782866511049_9wdp";

const app = initializeApp({credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))});
const db = getFirestore(app);

const usersSnap = await db.collection('users').get();
let updated = 0;

for (const userDoc of usersSnap.docs) {
  const configDoc = await db.doc(`users/${userDoc.id}/settings/contactFields`).get();
  if (!configDoc.exists) continue;
  
  const data = configDoc.data();
  const allFields = data.allFields || [];
  const visibleFields = data.visibleFields || [];
  
  const hasField = allFields.some(f => f.id === ORG_NAME_FIELD_ID);
  if (!hasField) continue;
  
  const userData = userDoc.data();
  const newAllFields = allFields.filter(f => f.id !== ORG_NAME_FIELD_ID);
  const newVisibleFields = visibleFields.filter(id => id !== ORG_NAME_FIELD_ID);
  
  await configDoc.ref.update({ allFields: newAllFields, visibleFields: newVisibleFields });
  console.log(`✅ Removed "Organization Name" column from ${userData.displayName || userData.email || userDoc.id}'s config`);
  updated++;
}

console.log(`\nDone! Updated ${updated} user config(s).`);
process.exit(0);
