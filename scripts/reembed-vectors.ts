/**
 * One-off migration: re-embed every stored vector chunk with the current model
 * (src/lib/gemini-embed.ts). Needed because text-embedding-004 was retired and
 * vectors from different models are not comparable.
 *
 * Idempotent: chunks already tagged `embeddingModel === EMBED_MODEL` are skipped, so
 * it's safe to re-run (or resume after an interruption). The chunk text lives on each
 * vector doc, so no source files are needed.
 *
 *   $env:NODE_PATH="<repo>\node_modules"; npx tsx scripts/reembed-vectors.ts           # dry run (counts only)
 *   $env:NODE_PATH="<repo>\node_modules"; npx tsx scripts/reembed-vectors.ts --apply   # actually re-embed
 *
 * Reads the service account from FIREBASE_SERVICE_ACCOUNT_PATH (default ./firebase-service-account.json)
 * and GEMINI_API_KEY from the environment or .env.local. No secrets in this file.
 */
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { embedText, EMBED_MODEL } from '../src/lib/gemini-embed';

const APPLY = process.argv.includes('--apply');

/** The Gemini embedding quota is per-minute; on 429 wait it out (script only). */
async function embedWithBackoff(text: string): Promise<number[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await embedText(text, 'RETRIEVAL_DOCUMENT', apiKey);
    } catch (e: any) {
      if (!/HTTP 429/.test(String(e?.message)) || attempt >= 6) throw e;
      await new Promise((r) => setTimeout(r, 20000));
    }
  }
}
const GROUPS = ['kb_vectors', 'ai_brain_vectors'];
const CONCURRENCY = 3;
const CHUNK_SIZE = 500;
const OVERLAP = 100;

/** Same algorithm as chunkDocument() in src/app/api/ai-brain-upload/route.ts. */
function chunkDocument(content: string, chunkSize = CHUNK_SIZE, overlap = OVERLAP): string[] {
  if (content.length < 20) return [];
  const chunks: string[] = [];
  let currentChunk = '';
  for (const para of content.split(/\n\n+/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if ((currentChunk + '\n\n' + trimmed).length > chunkSize && currentChunk.length > 50) {
      chunks.push(currentChunk.trim());
      const words = currentChunk.split(/\s+/);
      currentChunk = words.slice(-Math.min(20, Math.floor(words.length * 0.3))).join(' ') + '\n\n' + trimmed;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + trimmed : trimmed;
    }
  }
  if (currentChunk.trim().length > 20) chunks.push(currentChunk.trim());
  if (chunks.length === 0 && content.length > chunkSize) {
    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const slice = content.substring(i, i + chunkSize).trim();
      if (slice.length > 20) chunks.push(slice);
    }
  } else if (chunks.length === 0 && content.length >= 20) {
    chunks.push(content.trim());
  }
  const MAX_CHUNK = chunkSize * 3;
  const bounded: string[] = [];
  for (const c of chunks) {
    if (c.length <= MAX_CHUNK) { bounded.push(c); continue; }
    for (let i = 0; i < c.length; i += chunkSize - overlap) {
      const slice = c.substring(i, i + chunkSize).trim();
      if (slice.length > 20) bounded.push(slice);
    }
  }
  return bounded;
}

const root = process.cwd();
const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(root, 'firebase-service-account.json');
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();

let apiKey = process.env.GEMINI_API_KEY || '';
if (!apiKey) {
  const envFile = path.join(root, '.env.local');
  if (fs.existsSync(envFile)) apiKey = (/^GEMINI_API_KEY=(.*)$/m.exec(fs.readFileSync(envFile, 'utf8'))?.[1] || '').trim().replace(/^"|"$/g, '');
}
if (!apiKey) { console.error('GEMINI_API_KEY not found'); process.exit(2); }

(async () => {
  console.log(`Re-embed vectors → model=${EMBED_MODEL}  mode=${APPLY ? 'APPLY' : 'DRY RUN'}\n`);
  let total = 0, todo = 0, done = 0, failed = 0;

  for (const group of GROUPS) {
    const snap = await db.collectionGroup(group).get();
    const pending = snap.docs.filter((d) => d.data().embeddingModel !== EMBED_MODEL);
    total += snap.size;
    todo += pending.length;
    const byParent = new Map<string, number>();
    pending.forEach((d) => byParent.set(d.ref.parent.path, (byParent.get(d.ref.parent.path) || 0) + 1));
    console.log(`${group}: ${snap.size} chunks, ${pending.length} need re-embedding`);
    byParent.forEach((n, p) => console.log(`   ${p}: ${n}`));

    if (!APPLY) continue;
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      await Promise.all(
        pending.slice(i, i + CONCURRENCY).map(async (d) => {
          const text: string = d.data().text || '';
          if (!text.trim()) { failed++; console.warn(`   skip (empty text): ${d.ref.path}`); return; }
          try {
            const vec = await embedText(text, 'RETRIEVAL_DOCUMENT', apiKey);
            await d.ref.update({ embedding: admin.firestore.FieldValue.vector(vec), embeddingModel: EMBED_MODEL });
            done++;
          } catch (e: any) {
            failed++;
            console.warn(`   FAILED ${d.ref.path}: ${e?.message}`);
          }
        }),
      );
      if ((i / CONCURRENCY) % 10 === 0) console.log(`   …${Math.min(i + CONCURRENCY, pending.length)}/${pending.length}`);
    }
  }

  // ── Phase 2: backfill docs that have text but ZERO vectors (uploads made after the old
  // embedding model was retired silently failed to embed — "non-fatal" in the upload route).
  const DOC_GROUPS: Array<{ group: string; vectors: string }> = [
    { group: 'ai_brain_docs', vectors: 'ai_brain_vectors' },
    { group: 'org_brain_docs', vectors: 'kb_vectors' },
  ];
  let docsTodo = 0, docsDone = 0;
  for (const { group, vectors } of DOC_GROUPS) {
    const snap = await db.collectionGroup(group).get();
    for (const d of snap.docs) {
      const data = d.data();
      const text: string = data.plaintext || '';
      if (text.length < 20 || /^\[(PDF|DOCX|Legacy|Image|File)[^\]]*\]$/.test(text.trim())) continue; // nothing real to embed
      const vecCol = d.ref.parent.parent!.collection(vectors);
      const chunks = chunkDocument(text);
      // Resume support: only embed chunk indexes that don't exist yet (a previous run may have been rate-limited).
      const existing = await vecCol.where('docId', '==', d.id).get();
      const have = new Set(existing.docs.map((x) => x.data().chunkIndex as number));
      const missing = chunks.map((c, idx) => ({ c, idx })).filter((x) => !have.has(x.idx));
      if (missing.length === 0) continue;
      docsTodo++;
      console.log(`   backfill ${d.ref.path}: "${data.name}" → ${missing.length}/${chunks.length} chunks to embed`);
      if (!APPLY) continue;
      let created = have.size;
      for (let i = 0; i < missing.length; i += CONCURRENCY) {
        await Promise.all(missing.slice(i, i + CONCURRENCY).map(async ({ c: chunkText, idx }) => {
          try {
            const vec = await embedWithBackoff(chunkText);
            await vecCol.add({
              docId: d.id,
              docTitle: data.name || 'Untitled Document',
              chunkIndex: idx,
              text: chunkText,
              embedding: admin.firestore.FieldValue.vector(vec),
              embeddingModel: EMBED_MODEL,
              tokenCount: chunkText.length,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              ...(group === 'ai_brain_docs' ? { userId: d.ref.parent.parent!.id } : { orgId: d.ref.parent.parent!.id }),
            });
            created++;
          } catch (e: any) { failed++; console.warn(`   FAILED chunk ${idx} of ${d.ref.path}: ${String(e?.message).slice(0, 120)}`); }
        }));
      }
      const complete = created >= chunks.length;
      await d.ref.update({ vectorChunkCount: created, ...(complete ? { status: 'ready' } : {}) });
      if (complete) docsDone++;
      console.log(`   ${complete ? 'complete' : 'INCOMPLETE'}: ${created}/${chunks.length}`);
    }
  }
  console.log(`\nDocs needing vector backfill: ${docsTodo}${APPLY ? `  backfilled: ${docsDone}` : ''}`);

  console.log(`\nTotal chunks: ${total}  needing migration: ${todo}${APPLY ? `  migrated: ${done}  failed: ${failed}` : '  (dry run — re-run with --apply)'}`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => { console.error('FAILED:', e?.message || e); process.exit(2); });
