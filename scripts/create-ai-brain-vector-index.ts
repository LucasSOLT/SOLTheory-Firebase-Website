// Create the missing Firestore vector index for users/{uid}/ai_brain_vectors (collection group ai_brain_vectors, 768-dim, flat).
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const sa = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-service-account.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });

(async () => {
  const token = (await admin.app().options.credential!.getAccessToken()).access_token;
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/collectionGroups/ai_brain_vectors/indexes`;
  const list: any = await (await fetch(base, { headers: { Authorization: `Bearer ${token}` } })).json();
  const existing = (list.indexes || []).find((i: any) => String(i.name).includes('/collectionGroups/ai_brain_vectors/') && i.fields?.some((f: any) => f.fieldPath === 'embedding' && f.vectorConfig));
  if (existing) { console.log('Index already exists:', existing.name, existing.state); return; }
  const res = await fetch(base, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ queryScope: 'COLLECTION', fields: [{ fieldPath: 'embedding', vectorConfig: { dimension: 768, flat: {} } }] }),
  });
  console.log(res.status, JSON.stringify(await res.json()).slice(0, 500));
})().then(() => process.exit(0)).catch((e) => { console.error('FAILED', e?.message || e); process.exit(1); });
