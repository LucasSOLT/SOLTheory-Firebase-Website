// Probe: does Firestore findNearest work on the vector collections (i.e. do vector indexes exist)?
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { embedText } from '../src/lib/gemini-embed';

const root = process.cwd();
const sa = JSON.parse(fs.readFileSync(path.join(root, 'firebase-service-account.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();
const key = (/^GEMINI_API_KEY=(.*)$/m.exec(fs.readFileSync(path.join(root, '.env.local'), 'utf8'))?.[1] || '').trim().replace(/^"|"$/g, '');

(async () => {
  const q = process.argv[2] || 'shift log';
  const vec = await embedText(q, 'RETRIEVAL_QUERY', key);
  for (const col of ['orgs/soltheory/kb_vectors', 'orgs/nxtchapter/kb_vectors', 'users/5zeg0k65FvUZ5dso1Uvp5N5Hqjm2/ai_brain_vectors', 'users/nU9rrpeg52Xd72vRqKXLH6XZRNk1/ai_brain_vectors']) {
    try {
      const snap: any = await (db.collection(col) as any).findNearest({ vectorField: 'embedding', queryVector: vec, limit: 2, distanceMeasure: 'COSINE' }).get();
      console.log(`OK   ${col}: ${snap.size} hits`, snap.docs.map((d: any) => `[${d.data().docTitle}] ${String(d.data().text).slice(0, 60).replace(/\s+/g, ' ')}`));
    } catch (e: any) {
      console.log(`FAIL ${col}: ${String(e?.message).slice(0, 400)}`);
    }
  }
  process.exit(0);
})();
