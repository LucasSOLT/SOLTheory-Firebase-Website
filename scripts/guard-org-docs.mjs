#!/usr/bin/env node
/**
 * 🔒 ORG-DOCUMENT PIPELINE GUARD
 *
 * Fails the build (wired as `prebuild`) if anyone edits the Org / Personal AI-Brain document
 * pipeline in a way that would silently break upload → chunk → embed → store → retrieve → answer,
 * or break org/personal separation. Pure Node (no deps) so it can never fail for tooling reasons.
 *
 * If a check fails you changed something that is deliberately locked. Read the message, then either
 * revert, or — if the change is intentional — update the pipeline, re-embed (scripts/reembed-vectors.ts
 * --apply), run scripts/verify-org-docs-e2e.ts, and update the matching check here IN THE SAME COMMIT.
 *
 * Run manually:  node scripts/guard-org-docs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');

const failures = [];
function check(name, rel, test, why) {
  let src;
  try { src = read(rel); } catch { failures.push(`✗ ${name}\n    ${rel} is missing — the pipeline file was moved/deleted.`); return; }
  let ok = false;
  try { ok = !!test(src); } catch { ok = false; }
  if (!ok) failures.push(`✗ ${name}\n    in ${rel}\n    ${why}`);
}

// ── 1. Embedding model/dimension are locked ───────────────────────────────────────────────────
const EMBED = 'src/lib/gemini-embed.ts';
check('Embedding model is gemini-embedding-001', EMBED,
  (s) => /export const EMBED_MODEL = "gemini-embedding-001" as const;/.test(s),
  'Changing the model makes every stored vector incomparable (search silently returns junk). Re-embed everything first.');
check('Embedding dimension is 768', EMBED,
  (s) => /export const EMBED_DIM = 768 as const;/.test(s),
  'Firestore vector indexes are 768-dim. A different size breaks every query/insert.');
check('Embedding helper validates returned dimension', EMBED,
  (s) => /values\.length !== EMBED_DIM/.test(s),
  'The dimension check stops wrong-sized vectors from being stored.');
check('Embedding helper sends outputDimensionality', EMBED,
  (s) => /outputDimensionality:\s*EMBED_DIM/.test(s),
  'gemini-embedding-001 returns 3072 dims by default; it must be truncated to EMBED_DIM.');

// ── 2. No direct/legacy embedding calls anywhere in src/ (everything goes through embedText) ──
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
for (const file of walk(path.join(root, 'src'))) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  if (/model:\s*["']text-embedding-004["']/.test(code)) failures.push(`✗ Retired model referenced\n    in ${rel}\n    "text-embedding-004" was retired by Google (HTTP 404). Use embedText() from src/lib/gemini-embed.ts.`);
  if (/\.embedContent\s*\(/.test(code) && rel !== EMBED) failures.push(`✗ Direct embedContent() call\n    in ${rel}\n    All embeddings must go through embedText() so model + dimension stay identical for ingest and query.`);
}

// ── 3. Query side: scope isolation + same helper ──────────────────────────────────────────────
const RET = 'src/lib/kb-vector-retriever.ts';
check('embedQuery uses embedText with RETRIEVAL_QUERY', RET,
  (s) => /embedText\(\s*text\s*,\s*"RETRIEVAL_QUERY"\s*\)/.test(s),
  'Queries must be embedded with the same model/dim as documents.');
check('Org vectors live at orgs/{orgId}/kb_vectors and only load when scope !== "personal"', RET,
  (s) => s.includes('scope !== "personal" && orgId') && s.includes('`orgs/${orgId}/kb_vectors`'),
  'Org/personal separation: personal chats must never read org vectors by accident (and vice-versa).');
check('Personal vectors live at users/{uid}/ai_brain_vectors and only load when scope !== "org"', RET,
  (s) => s.includes('scope !== "org" && uid') && s.includes('`users/${uid}/ai_brain_vectors`'),
  'Org chats must never leak a user\'s private documents.');

check('Org brain tool only searches org vectors (never personal)', 'src/lib/jarvis-org-brain-tools.ts',
  (s) => /uid:\s*undefined,[^\n]*\n\s*maxResults:\s*\d+,\s*\n\s*scope:\s*"org"/.test(s),
  'search_org_brain must pass uid: undefined and scope: "org".');
check('Personal brain tool only searches personal vectors (never org)', 'src/lib/jarvis-org-brain-tools.ts',
  (s) => /orgId:\s*"",[^\n]*\n\s*uid,\s*\n\s*maxResults:\s*\d+,\s*\n\s*scope:\s*"personal"/.test(s),
  'search_personal_brain must pass orgId: "" and scope: "personal".');
check('Chat route passes scope from chatScope to semantic retrieval', 'src/app/api/chat/route.ts',
  (s) => /scope:\s*chatScope === 'org' \? 'org' : 'personal'/.test(s),
  'Without this, org chats could read personal docs or the reverse.');

// ── 4. Ingest side: same helper, tagged chunks, bounded chunking, correct collections ─────────
const UP = 'src/app/api/ai-brain-upload/route.ts';
check('Upload embeds with embedText(RETRIEVAL_DOCUMENT)', UP,
  (s) => /embedText\(\s*chunkText\s*,\s*"RETRIEVAL_DOCUMENT"/.test(s),
  'Ingest must use the shared embedding helper.');
check('Upload tags chunks with embeddingModel: EMBED_MODEL', UP,
  (s) => /embeddingModel:\s*EMBED_MODEL/.test(s),
  'The tag lets the migration script tell old vectors from new ones.');
check('Upload stores org vectors in orgs/{orgId}/kb_vectors and personal in users/{uid}/ai_brain_vectors', UP,
  (s) => s.includes('`users/${auth.uid}/ai_brain_vectors`') && s.includes('`orgs/${orgId}/kb_vectors`'),
  'Storage paths must match the retrieval paths exactly.');
check('Upload chunker bounds oversize chunks (MAX_CHUNK)', UP,
  (s) => /const MAX_CHUNK = chunkSize \* 3;/.test(s),
  'Without this, a PDF with no blank lines becomes ONE giant chunk (poor retrieval, can exceed embedding limits).');
check('Upload records vectorStatus + vectorError (failures are never silent)', UP,
  (s) => /vectorStatus,/.test(s) && /vectorError:\s*embedError/.test(s),
  'Embedding failures used to be swallowed, leaving "ready" docs with zero vectors.');

const KB = 'src/app/api/knowledge-base/process/route.ts';
check('KB process embeds with embedText(RETRIEVAL_DOCUMENT)', KB,
  (s) => /embedText\(\s*chunkText\s*,\s*"RETRIEVAL_DOCUMENT"\s*\)/.test(s) && /embeddingModel:\s*EMBED_MODEL/.test(s),
  'Ingest must use the shared embedding helper and tag chunks.');

// ── 5. Firestore vector indexes (768-dim) are declared ────────────────────────────────────────
for (const cg of ['kb_vectors', 'ai_brain_vectors']) {
  check(`firestore.indexes.json declares the 768-dim vector index for ${cg}`, 'firestore.indexes.json',
    (s) => {
      const j = JSON.parse(s);
      return (j.indexes || []).some((i) => i.collectionGroup === cg && (i.fields || []).some((f) => f.fieldPath === 'embedding' && f.vectorConfig?.dimension === 768));
    },
    'Without the index every findNearest() query fails and search silently falls back to keyword matching.');
}

// ── 6. Firestore rules: org docs/vectors are org-member-only ──────────────────────────────────
check('Rules protect orgs/{orgId}/kb_vectors and org_brain_docs with isOrgMember', 'firestore.rules',
  (s) => /match \/orgs\/\{orgId\}\/kb_vectors\/\{vectorId\} \{\s*allow read: if isSignedIn\(\) && isOrgMember\(orgId\);/.test(s)
      && /match \/orgs\/\{orgId\}\/org_brain_docs\/\{docId\} \{\s*allow read: if isSignedIn\(\) && isOrgMember\(orgId\);/.test(s),
  'Org documents must never be readable by non-members.');

if (failures.length) {
  console.error('\n🔒 ORG-DOCUMENT PIPELINE GUARD FAILED\n');
  failures.forEach((f) => console.error(f + '\n'));
  console.error(`${failures.length} invariant(s) broken. See the header of scripts/guard-org-docs.mjs for how to proceed.\n`);
  process.exit(1);
}
console.log('🔒 Org-document pipeline guard: all invariants hold.');
