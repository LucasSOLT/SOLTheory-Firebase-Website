/**
 * 🔒 Live end-to-end verification of the Org-document pipeline (store → vector search → separation).
 *
 * Uses throwaway Firestore paths (orgs/e2e-guard-org-a, e2e-guard-org-b, users/e2e-guard-user) that are
 * ALWAYS cleaned up. Never touches real org/user data. Run after ANY change to the embedding / upload /
 * retrieval code, and before deploying:
 *
 *   $env:NODE_PATH="<repo>\node_modules"; npx tsx scripts/verify-org-docs-e2e.ts
 *
 * Checks: (1) embedding model works at the right dimension, (2) an "org document" chunk is findable by a
 * natural-language question, (3) org B can NOT see org A's chunk, (4) a personal-collection chunk is not
 * returned from the org collection and vice-versa, (5) cleanup. Exit 0 = pipeline healthy.
 */
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { embedText, EMBED_DIM, EMBED_MODEL } from '../src/lib/gemini-embed';

const root = process.cwd();
const sa = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(root, 'firebase-service-account.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();
let key = process.env.GEMINI_API_KEY || '';
if (!key && fs.existsSync(path.join(root, '.env.local'))) key = (/^GEMINI_API_KEY=(.*)$/m.exec(fs.readFileSync(path.join(root, '.env.local'), 'utf8'))?.[1] || '').trim().replace(/^"|"$/g, '');
if (!key) { console.error('GEMINI_API_KEY not found'); process.exit(2); }

const A = 'orgs/e2e-guard-org-a/kb_vectors';
const B = 'orgs/e2e-guard-org-b/kb_vectors';
const U = 'users/e2e-guard-user/ai_brain_vectors';
const FACT_A = 'The e2e guard org carryover policy: unused vacation days roll over up to a maximum of nine days per calendar year.';
const FACT_U = 'My personal e2e note: my favorite color for the guard test is chartreuse.';

let failed = 0;
const ok = (c: boolean, msg: string) => { console.log(`${c ? '✅' : '❌'} ${msg}`); if (!c) failed++; };

async function add(col: string, text: string) {
  const v = await embedText(text, 'RETRIEVAL_DOCUMENT', key);
  ok(v.length === EMBED_DIM, `${EMBED_MODEL} returned ${v.length} dims (expected ${EMBED_DIM})`);
  await db.collection(col).add({ docId: 'e2e', docTitle: 'e2e', chunkIndex: 0, text, embedding: admin.firestore.FieldValue.vector(v), embeddingModel: EMBED_MODEL });
}
async function search(col: string, q: string): Promise<string[]> {
  const qv = await embedText(q, 'RETRIEVAL_QUERY', key);
  const snap: any = await (db.collection(col) as any).findNearest({ vectorField: 'embedding', queryVector: qv, limit: 3, distanceMeasure: 'COSINE' }).get();
  return snap.docs.map((d: any) => String(d.data().text));
}
async function wipe() {
  for (const col of [A, B, U]) { const s = await db.collection(col).get(); await Promise.all(s.docs.map((d) => d.ref.delete())); }
}

(async () => {
  await wipe();
  try {
    await add(A, FACT_A);
    await add(U, FACT_U);

    // Firestore vector index entries are eventually consistent for brand-new docs; brief retry.
    let hitsA: string[] = [];
    for (let i = 0; i < 5 && hitsA.length === 0; i++) { hitsA = await search(A, 'How many vacation days can I carry over?'); if (!hitsA.length) await new Promise((r) => setTimeout(r, 1500)); }
    ok(hitsA[0] === FACT_A, 'Org document is retrievable by a natural-language question');

    const hitsB = await search(B, 'How many vacation days can I carry over?');
    ok(hitsB.length === 0, "Org B cannot see Org A's document (separation)");

    const hitsOrgForPersonal = await search(A, 'What is my favorite color?');
    ok(!hitsOrgForPersonal.includes(FACT_U), "Personal chunk never appears in the org collection");

    let hitsU: string[] = [];
    for (let i = 0; i < 5 && hitsU.length === 0; i++) { hitsU = await search(U, 'What is my favorite color?'); if (!hitsU.length) await new Promise((r) => setTimeout(r, 1500)); }
    ok(hitsU[0] === FACT_U, 'Personal document is retrievable from the personal collection (needs the ai_brain_vectors index)');
    const hitsUOrg = await search(U, 'How many vacation days can I carry over?');
    ok(!hitsUOrg.includes(FACT_A), 'Org chunk never appears in the personal collection');
  } catch (e: any) {
    ok(false, `Unexpected error: ${String(e?.message).slice(0, 300)}`);
  } finally {
    await wipe();
    console.log('🧹 Test data cleaned up.');
  }
  console.log(failed ? `\n❌ ${failed} check(s) FAILED — do NOT deploy.` : '\n✅ Org-document pipeline healthy.');
  process.exit(failed ? 1 : 0);
})();
