/**
 * Clean CRM data - check BOTH old (crm_contacts) and new (contacts) paths
 */
const projectId = "studio-5711990008-7ac2c";
const apiKey = "AIzaSyCAJWBLJ1GTXtELpKFubBlENBq0eroUyCM";
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

async function listDocs(path) {
  const url = `${baseUrl}/${path}?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

async function deleteDocs(fullPath) {
  const url = `https://firestore.googleapis.com/v1/${fullPath}?key=${apiKey}`;
  return fetch(url, { method: "DELETE" });
}

const users = await listDocs("users");
console.log(`Found ${users.length} user docs`);

const paths = ["contacts", "crm_contacts", "meetings", "crm_meetings"];

for (const userDoc of users) {
  const uid = userDoc.name.split("/").pop();
  
  for (const sub of paths) {
    const docs = await listDocs(`users/${uid}/${sub}`);
    if (docs.length > 0) {
      console.log(`\nUser ${uid} -> ${sub}: ${docs.length} docs`);
      for (const d of docs) {
        const f = d.fields || {};
        const label = f.firstName ? `${f.firstName.stringValue} ${f.lastName?.stringValue}` : d.name.split("/").pop();
        console.log(`  Deleting: ${label}`);
        await deleteDocs(d.name);
      }
      console.log(`  ✅ Deleted`);
    }
  }
}

console.log("\n🧹 Clean slate!");
process.exit(0);
