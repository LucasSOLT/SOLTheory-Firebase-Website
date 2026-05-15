/**
 * Check if contacts exist for a specific user
 */
const projectId = "studio-5711990008-7ac2c";
const apiKey = "AIzaSyCAJWBLJ1GTXtELpKFubBlENBq0eroUyCM";
const uid = "5zeg0k65FvUZ5dso1Uvp5N5HqJm2";

const paths = ["contacts", "crm_contacts", "meetings", "crm_meetings"];
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

for (const sub of paths) {
  const url = `${baseUrl}/users/${uid}/${sub}?key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  const docs = data.documents || [];
  console.log(`users/${uid}/${sub}: ${docs.length} docs${docs.length > 0 ? '' : ' (empty)'}`);
  docs.forEach(d => {
    const f = d.fields || {};
    const name = `${f.firstName?.stringValue || '?'} ${f.lastName?.stringValue || '?'}`;
    console.log(`  - ${name} (${d.name.split('/').pop()})`);
  });
}
