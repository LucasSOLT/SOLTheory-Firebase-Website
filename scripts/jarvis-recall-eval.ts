/**
 * Jarvis recall evaluation (insight-testing-guide.md §3b).
 *
 * Seeds known facts into the /api/chat request payload, asks Jarvis recall
 * questions (each in a FRESH single-message conversation, so he can't scroll up),
 * and auto-scores each answer:  ✅ correct   🟡 partial   ❌ wrong / made up.
 *
 * SAFETY
 *  - Facts are injected through the request payload (pactText / orgBrainText /
 *    personalBrainText). Nothing is written to Firestore or Supabase.
 *  - A fake, nonexistent `uid` is sent and `userName` is omitted, so the server's
 *    fire-and-forget PACT extraction never runs/pollutes real memory.
 *  - No secrets in this file: the service account is read from
 *    FIREBASE_SERVICE_ACCOUNT_PATH (default ./firebase-service-account.json, gitignored)
 *    and the public web apiKey comes from src/firebase/config.
 *
 * USAGE (dev server must be running, default http://localhost:3000)
 *   $env:NODE_PATH="<repo>\node_modules"; npx tsx scripts/jarvis-recall-eval.ts
 *   Options:  --base=http://localhost:3000   --out=report.md   --model=gemini-2.5-flash
 *
 * Costs real LLM calls (~9 short requests per run).
 */
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { EMBED_MODEL, EMBED_DIM } from '../src/lib/gemini-embed';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || 'true'];
  }),
);
const BASE = (args.base as string) || 'http://localhost:3000';
const MODEL = (args.model as string) || 'gemini-2.5-flash';
const OUT = args.out as string | undefined;
const DEV_EMAIL = 'lucas@soltheory.com';
const FAKE_UID = 'eval-nonexistent-uid';
const AGENT_ID = 'soltheory_jarvis';

const root = process.cwd();
const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(root, 'firebase-service-account.json');

// ── Seeded facts (all fictional test data) ───────────────────────────────────
const now = new Date();
const year = now.getMonth() > 10 || (now.getMonth() === 10 && now.getDate() > 15) ? now.getFullYear() + 1 : now.getFullYear();
const deadline = new Date(year, 10, 15); // Nov 15
const weeksAway = Math.round((deadline.getTime() - now.getTime()) / (7 * 86400000));

const PACT_TEXT = [
  `- Family: My daughter's name is Mia. She is 7 years old.`,
  `- Scheduling preference: I hate morning meetings. Never schedule me before noon; afternoons are best.`,
  `- Identity: My name is Lucas Meyer and I run partnerships for the organization.`,
  `- Grant: Our big grant application deadline is November 15.`,
].join('\n');

// NOTE: /api/chat does NOT inject `orgBrainText` into the prompt (it only feeds semantic
// retrieval + citations), so org knowledge can't be seeded via payload. The org tests below
// use the REAL org profile in Firestore (organizations/{orgId}) and the real embedding pipeline.
const ORG_BRAIN_TEXT = '';

const PERSONAL_BRAIN_TEXT = `Lucas Meyer — partnerships lead. Prefers concise emails. Dislikes morning meetings (afternoons only).`;

// ── Questions & scoring ──────────────────────────────────────────────────────
type Check = { label: string; re: RegExp };
interface Q {
  id: string;
  question: string;
  scope: 'org' | 'personal';
  why: string;
  /** all must pass → ✅; some → 🟡; none → ❌ */
  checks: Check[];
  /** any match → ❌ (stated a wrong/made-up fact) */
  forbid?: RegExp[];
  /** honest-"I don't know" probe: ✅ if admits ignorance, ❌ if it invents an answer */
  mustAdmitIgnorance?: boolean;
}

const IDK = /(don'?t|do not|doesn'?t|haven'?t|have not|hasn'?t|no)\s+(currently\s+)?(have|know|see|find|record|information|mention|told|shared|stored|any)|not (sure|certain|aware|in (my|the))|unable to (find|locate)|can'?t (find|see|recall)|no (record|information|mention)|haven'?t (shared|told|mentioned)|i('| a)m not (able|sure)|isn'?t (anything|something)|would you like to (tell|share)|let me know/i;

const QUESTIONS: Q[] = [
  {
    id: 'daughter',
    question: "What's my daughter's name?",
    scope: 'personal',
    why: 'Plain fact recall',
    checks: [{ label: 'says Mia', re: /\bMia\b/ }],
  },
  {
    id: 'meetings',
    question: 'When should you avoid scheduling meetings for me?',
    scope: 'personal',
    why: 'Applying a fact, not just repeating it',
    checks: [
      { label: 'mentions mornings / before noon', re: /morning|before (noon|12|11|10)|a\.?m\b/i },
    ],
    forbid: [/avoid(ing)?\s+(the\s+)?afternoons?/i],
  },
  {
    id: 'grant',
    question: "What's our grant deadline, and how many weeks away is it?",
    scope: 'personal',
    why: 'Memory + date reasoning',
    checks: [
      { label: 'Nov 15', re: /nov(ember)?\.?\s*15|15(th)?\s+(of\s+)?nov/i },
      {
        label: `~${weeksAway} weeks (±1)`,
        re: new RegExp(`\\b(${weeksAway - 1}|${weeksAway}|${weeksAway + 1})\\s*(weeks?|wks?)|\\b(${['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven'][weeksAway] || weeksAway}|${['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven'][weeksAway - 1] || weeksAway}|${['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven'][weeksAway + 1] || weeksAway})\\s*weeks?`, 'i'),
      },
    ],
  },
  {
    id: 'mission',
    question: "Summarize our org's mission.",
    scope: 'org',
    why: 'Real org profile (Firestore organizations/soltheory.orgDescription)',
    checks: [], // populated at runtime from the real org profile (see buildMissionChecks)
  },
  {
    id: 'org-document',
    question: 'Search our org brain for the Shift Log & Case Notes document. What date is it for?',
    scope: 'org',
    why: 'Real uploaded org document via vector search (Shift Log.pdf)',
    checks: [{ label: 'says October 14', re: /oct(ober|\.)?\s*14|14(th)?\s+(of\s+)?oct/i }],
  },
  {
    id: 'intro-email',
    question: 'Based on my profile, write a short intro email draft to Dana Reyes at Green Valley Foundation, a new partner. Do not look anyone up and do not ask me questions; just write the full draft now, proposing a time to meet.',
    scope: 'personal',
    why: 'Combines name, role, and scheduling preference',
    checks: [
      { label: 'signs as Lucas', re: /Lucas/ },
      { label: 'proposes afternoons / avoids mornings', re: /afternoon|after noon|post-?lunch|1[\s:]?\d{0,2}\s?pm|[2-5][\s:]?\d{0,2}\s?pm/i },
      { label: 'concise (<220 words)', re: /^(?:\S+\s+){0,220}\S*$/ },
    ],
    forbid: [/\b(9|10|11)(:\d\d)?\s?a\.?m\b/i],
  },
  {
    id: 'never-told-dog',
    question: "What's my dog's name?",
    scope: 'personal',
    why: 'Never told → must say "I don\'t know" (hallucination probe)',
    checks: [],
    mustAdmitIgnorance: true,
  },
  {
    id: 'never-told-restaurant',
    question: "What's my favorite restaurant?",
    scope: 'personal',
    why: 'Never told → must say "I don\'t know" (hallucination probe)',
    checks: [],
    mustAdmitIgnorance: true,
  },
];

// ── Auth: mint an ID token for the developer via the service account ─────────
async function getIdToken(): Promise<string> {
  if (!fs.existsSync(saPath)) throw new Error(`Service account not found at ${saPath}`);
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  const user = await admin.auth().getUserByEmail(DEV_EMAIL);
  const custom = await admin.auth().createCustomToken(user.uid);
  const cfg = fs.readFileSync(path.join(root, 'src', 'firebase', 'config.ts'), 'utf8');
  const apiKey = /"apiKey":\s*"([^"]+)"/.exec(cfg)?.[1];
  if (!apiKey) throw new Error('Could not read public apiKey from src/firebase/config.ts');
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  const j: any = await res.json();
  if (!j.idToken) throw new Error(`Token exchange failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j.idToken;
}

async function ask(idToken: string, q: Q): Promise<{ text: string; ms: number; tools: string[] }> {
  const t0 = Date.now();
  const body: any = {
    messages: [{ role: 'user', content: q.question }],
    agentId: AGENT_ID,
    uid: FAKE_UID, // nonexistent → no real memory writes
    stream: false,
    model: MODEL,
    chatScope: q.scope,
    userTimezone: 'America/Denver',
    pactText: PACT_TEXT,
    orgBrainText: ORG_BRAIN_TEXT,
    personalBrainText: q.scope === 'personal' ? PERSONAL_BRAIN_TEXT : undefined,
  };
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return {
    text: String(j.response || ''),
    ms: Date.now() - t0,
    tools: (j.executedTools || []).map((t: any) => t.name || String(t)),
  };
}

type Verdict = '✅' | '🟡' | '❌';
function score(q: Q, answer: string): { verdict: Verdict; notes: string[] } {
  const notes: string[] = [];
  if (q.mustAdmitIgnorance) {
    const admits = IDK.test(answer);
    notes.push(admits ? 'admitted not knowing' : 'did NOT admit ignorance — likely made up an answer');
    return { verdict: admits ? '✅' : '❌', notes };
  }
  for (const f of q.forbid || []) {
    if (f.test(answer)) {
      notes.push(`forbidden pattern matched: ${f}`);
      return { verdict: '❌', notes };
    }
  }
  let passed = 0;
  for (const c of q.checks) {
    const ok = c.re.test(answer);
    if (ok) passed++;
    notes.push(`${ok ? 'pass' : 'FAIL'}: ${c.label}`);
  }
  if (q.checks.length && passed === q.checks.length) return { verdict: '✅', notes };
  if (passed > 0) return { verdict: '🟡', notes };
  if (q.checks.length && IDK.test(answer)) notes.push('said it did not know the seeded fact');
  return { verdict: '❌', notes };
}

const STOP = new Set(['about', 'their', 'which', 'through', 'support', 'provide', 'between', 'within', 'organization', 'program', 'programs', 'services', 'community', 'other', 'these', 'those', 'while', 'where', 'would', 'should', 'could', 'across', 'helping', 'people']);

/** Pull distinctive keywords from the REAL org profile; ✅ needs >=2 of the top keywords in the answer. */
async function buildMissionChecks(q: Q): Promise<string> {
  const doc = await admin.firestore().collection('organizations').doc('soltheory').get();
  const desc: string = (doc.data()?.orgDescription as string) || '';
  if (!desc) {
    q.checks = [{ label: 'org profile has a description (none found in Firestore)', re: /^\b$/ }];
    return '(no orgDescription in Firestore)';
  }
  const words = Array.from(new Set((desc.toLowerCase().match(/[a-z]{6,}/g) || []).filter((w) => !STOP.has(w)))).slice(0, 6);
  // two buckets so one keyword gives 🟡 and several give ✅
  const half = Math.max(1, Math.ceil(words.length / 2));
  q.checks = [
    { label: `mentions org keywords (${words.slice(0, half).join(', ')})`, re: new RegExp(words.slice(0, half).join('|'), 'i') },
    { label: `mentions more org keywords (${words.slice(half).join(', ') || 'n/a'})`, re: new RegExp(words.slice(half).join('|') || '$^', 'i') },
  ];
  return desc.replace(/\s+/g, ' ').slice(0, 200);
}

/** Preflight: the models the document-recall (vector) pipeline depends on must actually exist. */
async function embeddingPreflight(): Promise<{ ok: boolean; line: string }> {
  let key = process.env.GEMINI_API_KEY || '';
  if (!key) {
    const envFile = path.join(root, '.env.local');
    if (fs.existsSync(envFile)) key = (/^GEMINI_API_KEY=(.*)$/m.exec(fs.readFileSync(envFile, 'utf8'))?.[1] || '').trim().replace(/^"|"$/g, '');
  }
  if (!key) return { ok: false, line: 'GEMINI_API_KEY not found — preflight skipped' };
  const probe = async (model: string) => {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text: 'hello' }] }, outputDimensionality: EMBED_DIM }),
    });
    return r.status;
  };
  const current = await probe(EMBED_MODEL); // what the app uses now (src/lib/gemini-embed.ts)
  const legacy = await probe('text-embedding-004'); // informational: the retired model
  const ok = current === 200;
  return {
    ok,
    line: `${EMBED_MODEL} (${EMBED_DIM}d) → HTTP ${current}${ok ? '' : ' (BROKEN — document/AI-Brain vector recall falls back to keyword search)'}; retired text-embedding-004 → HTTP ${legacy}`,
  };
}

(async () => {
  console.log(`Jarvis recall eval → ${BASE}  model=${MODEL}`);
  console.log(`Today ${now.toDateString()}; grant deadline ${deadline.toDateString()} (~${weeksAway} weeks)\n`);
  const idToken = await getIdToken();

  const rows: string[] = [];
  const tally = { '✅': 0, '🟡': 0, '❌': 0 } as Record<Verdict, number>;
  const detail: string[] = [];

  // Preflight: embedding pipeline health (counts as a test row)
  const pre = await embeddingPreflight();
  tally[pre.ok ? '✅' : '❌']++;
  console.log(`${pre.ok ? '✅' : '❌'}  embedding-pipeline\n     ${pre.line}\n`);
  rows.push(`| ${pre.ok ? '✅' : '❌'} | embedding-pipeline | Vector model behind document / AI-Brain recall | ${pre.line} |`);

  const missionQ = QUESTIONS.find((x) => x.id === 'mission');
  if (missionQ) console.log(`Org profile (real): ${await buildMissionChecks(missionQ)}\n`);

  for (const q of QUESTIONS) {
    try {
      const { text, ms, tools } = await ask(idToken, q);
      const { verdict, notes } = score(q, text);
      tally[verdict]++;
      const line = `${verdict}  ${q.id.padEnd(22)} ${ms}ms${tools.length ? '  tools=' + tools.join(',') : ''}`;
      console.log(line);
      console.log(`     Q: ${q.question}`);
      console.log(`     A: ${text.replace(/\s+/g, ' ').slice(0, 280)}`);
      console.log(`     ${notes.join(' | ')}\n`);
      rows.push(`| ${verdict} | ${q.id} | ${q.why} | ${notes.join('; ')} |`);
      detail.push(`### ${verdict} ${q.id}\n**Q:** ${q.question}\n\n**A:** ${text}\n\n_${notes.join('; ')}${tools.length ? ' — tools: ' + tools.join(', ') : ''}_\n`);
    } catch (e: any) {
      tally['❌']++;
      console.log(`❌  ${q.id.padEnd(22)} ERROR ${e?.message}\n`);
      rows.push(`| ❌ | ${q.id} | ${q.why} | ERROR: ${e?.message} |`);
    }
  }

  const total = QUESTIONS.length + 1;
  const summary = `✅ ${tally['✅']}  🟡 ${tally['🟡']}  ❌ ${tally['❌']}  (of ${total})`;
  console.log('─'.repeat(60));
  console.log(summary);

  if (OUT) {
    const md = `# Jarvis Recall Eval — ${now.toISOString()}\n\nModel: \`${MODEL}\` · ${summary}\n\n| | Test | What it checks | Notes |\n|---|---|---|---|\n${rows.join('\n')}\n\n---\n\n${detail.join('\n')}`;
    fs.writeFileSync(OUT, md, 'utf8');
    console.log(`Report written to ${OUT}`);
  }
  process.exit(tally['❌'] > 0 ? 1 : 0);
})().catch((e) => {
  console.error('EVAL FAILED:', e?.message || e);
  process.exit(2);
});
