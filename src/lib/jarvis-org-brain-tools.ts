/**
 * @file jarvis-org-brain-tools.ts
 * @description Dynamic lookup tools for Organization AI Brain & Personal AI Brain.
 *
 * Tools:
 *   - `search_org_brain`: Searches org guided profile + uploaded org brain documents
 *   - `search_personal_brain`: Searches the user's personal AI brain documents
 *
 * Scope isolation:
 *   - Personal brain docs are ONLY accessible via search_personal_brain (personal scope)
 *   - Org brain docs are ONLY accessible via search_org_brain (org scope)
 *   - The chat route conditionally registers these tools based on chatScope
 *
 * Data sources:
 *   - `organizations/{orgId}` → orgBrainProfile.answers, orgBrain (compiled briefing)
 *   - `orgs/{orgId}` → mirror of the above (dual-write)
 *   - `org_profiles/{orgId}` → org profile (mission, EIN, staff size, etc.)
 *   - `orgs/{orgId}/org_brain_docs` → uploaded org AI brain documents (with plaintext)
 *   - `orgs/{orgId}/kb_vectors` → org brain vector embeddings
 *   - `users/{uid}/ai_brain_docs` → uploaded personal AI brain documents (with plaintext)
 *   - `users/{uid}/ai_brain_vectors` → personal brain vector embeddings
 */

import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { retrieveVectorChunks } from "./kb-vector-retriever";

// ── Tool Definitions ─────────────────────────────────────────────────────────

export const ORG_BRAIN_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_org_brain",
      description:
        "Search the Organization AI Brain for company-specific information and uploaded documents. " +
        "Use this to look up: core organizational values, escalation protocols, " +
        "elevator pitch, mission statement, compliance frameworks, leadership team, off-limits topics, " +
        "AND to READ the contents of documents uploaded to the Org AI Brain. " +
        "When the user asks about an org brain document by name, use this tool with section='documents' and include the document name in query. " +
        "To list or count all uploaded documents (e.g. 'how many documents/items/files are in the org brain', 'what are the names of the documents'), use section='documents', set list_only=true, and leave the query EMPTY. " +
        "The list_only result contains the authoritative total count and every document name — report that count and those names exactly. " +
        "This is NOT the CRM — this contains internal company policies, values, operational guidelines, and uploaded reference documents.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              'Free-text search query, e.g. "core values", "escalation protocol", "peer review document", "Kyle Jenkins". Used for keyword matching and vector search of uploaded documents. Leave EMPTY when list_only=true.',
          },
          section: {
            type: "string",
            enum: ["all", "values", "escalation", "identity", "operations", "rules", "documents"],
            description:
              'Optional filter. "values" = core org values, "escalation" = urgent contacts, "identity" = elevator pitch / mission / leadership, "operations" = compliance / off-limits / tone, "rules" = AI behavior rules, "documents" = search and READ uploaded org brain documents. "all" = everything including documents.',
          },
          list_only: {
            type: "boolean",
            description:
              "Set to true to list and count ALL documents uploaded to the Org AI Brain (names, sizes, total count) without their contents. Use for any 'how many' / 'list' / 'what documents' question. Use with section='documents' and an empty query.",
          },
        },
        required: [],
      },
    },
  },
];

export const PERSONAL_BRAIN_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_personal_brain",
      description:
        "Search and READ the user's Personal AI Brain documents. " +
        "Use this when the user asks about documents they uploaded to their personal AI Brain, " +
        "or when they ask you to read, summarize, analyze, or quote from a document. " +
        "You can search by document name or by content query. " +
        "To list or count all of the user's uploaded documents, set list_only=true and leave query and document_name EMPTY; the result contains the authoritative total count and every document name — report them exactly. " +
        "This searches ONLY the user's private documents — not the organization's shared documents.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              'Free-text search query to find relevant document content. e.g. "peer review", "thesis", "budget report". Also used for vector similarity search.',
          },
          document_name: {
            type: "string",
            description:
              'Optional exact or partial document filename to look up, e.g. "Kyle Jenkins" or "peer review". If provided, the tool will find the matching document and return its full text content.',
          },
          list_only: {
            type: "boolean",
            description:
              "Set to true to list and count ALL documents in the user's Personal AI Brain (names, sizes, total count) without their contents. Use for any 'how many' / 'list' / 'what documents' question.",
          },
        },
        required: [],
      },
    },
  },
];

// ── Section → Question Key Mapping ───────────────────────────────────────────

const SECTION_KEYS: Record<string, string[]> = {
  values: ["core_values"],
  escalation: ["urgent_escalation_protocol"],
  identity: [
    "elevator_pitch",
    "org_mission_north_star",
    "key_differentiators",
    "leadership_team",
    "org_history",
  ],
  operations: [
    "compliance_frameworks",
    "confidential_topics",
    "industry_jargon",
    "preferred_tone",
    "approved_tools",
  ],
  rules: [
    "preferred_tone",
    "confidential_topics",
    "approved_tools",
  ],
};

// ── Keyword → Section Hints ──────────────────────────────────────────────────

const KEYWORD_HINTS: Array<{ keywords: RegExp; sections: string[] }> = [
  { keywords: /\b(core\s*values?|organizational\s*values?|company\s*values?|innovation|transparency|diversity)\b/i, sections: ["values"] },
  { keywords: /\b(escalat|outage|security\s*flag|who\s*to\s*(call|reach|contact)|emergency|urgent|incident)\b/i, sections: ["escalation"] },
  { keywords: /\b(elevator\s*pitch|mission|north\s*star|differentiator|leadership|history|founded|about\s*(us|the\s*company))\b/i, sections: ["identity"] },
  { keywords: /\b(compliance|hipaa|pci|soc|fedramp|gdpr|framework|regulation)\b/i, sections: ["operations"] },
  { keywords: /\b(confidential|off[\s-]?limits?|tone|jargon|approved\s*tools?|never\s*(reveal|share|quote))\b/i, sections: ["rules", "operations"] },
  { keywords: /\b(document|file|upload|pdf|docx|report|paper|thesis|review|memo|manual|guide)\b/i, sections: ["documents"] },
  // "items" / "list" and plural forms (the pattern above uses \b…\b so it never matches "documents"/"files")
  { keywords: /\b(item|items|list|documents|docs|files|uploads)\b/i, sections: ["documents"] },
];

/** Cap for plaintext returned per document */
const MAX_DOC_PLAINTEXT = 6000;
/** Cap for total plaintext returned across all documents */
const MAX_TOTAL_PLAINTEXT = 24000;
/** Max documents returned in list mode (metadata only — plaintext is never read or returned) */
const MAX_LIST_DOCS = 500;
/** Max names included in the document index appended to normal (content) searches */
const MAX_INDEX_NAMES_IN_SEARCH = 100;
/** Max extra name-matched documents fetched beyond the first 30 in a normal search */
const MAX_EXTRA_NAME_MATCHES = 10;

/**
 * Detects "how many documents" / "list the files" / "names of the documents" style
 * requests so list mode still kicks in if the model forgets to set list_only.
 */
const LIST_INTENT_PATTERNS: RegExp[] = [
  /\bhow\s+many\s+(?:\S+\s+){0,3}?(?:documents?|docs?|files?|items?|uploads?|things|pdfs?)\b/i,
  /\b(?:list|enumerate|name|count)\s+(?:me\s+)?(?:all\s+)?(?:of\s+)?(?:the\s+|your\s+|my\s+|our\s+)?(?:\S+\s+){0,3}?(?:documents|docs|files|items|uploads|pdfs)\b/i,
  /\b(?:names?|titles?|list|count|number)\s+of\s+(?:all\s+)?(?:the\s+)?(?:\S+\s+){0,3}?(?:documents|docs|files|items|uploads|pdfs)\b/i,
  /\b(?:what|which)\s+(?:documents|docs|files|items|uploads|pdfs)\s+(?:are|do|does|have|has|is|did)\b/i,
  // "I uploaded 20 more documents, how many are there now?"
  /\b(?:documents?|docs?|files?|items?|uploads?|pdfs?)\b[^.?!]{0,80}?\bhow\s+many\s+(?:are|is|do|does|have|has|did)\b/i,
];

function detectListIntent(text: string): boolean {
  if (!text) return false;
  return LIST_INTENT_PATTERNS.some((re) => re.test(text));
}

/**
 * Words that carry no content meaning in a document query. A query made ONLY of these
 * (e.g. "documents", "all documents", "org brain documents", "list", "uploaded files")
 * is a request to see the documents, not a content search — so it is served by list mode
 * instead of a relevance search that returns only the first few documents.
 */
const GENERIC_QUERY_WORDS = new Set([
  "a", "an", "the", "all", "every", "each", "any", "my", "our", "your", "their", "them", "of", "in", "on",
  "inside", "within", "from", "for", "to", "and", "is", "are", "what", "which", "show", "me", "give", "get",
  "see", "view", "find", "search", "please", "now", "rn", "currently", "current", "there", "here", "available",
  "stored", "saved", "uploaded", "upload", "uploads", "document", "documents", "doc", "docs", "file", "files",
  "item", "items", "pdf", "pdfs", "list", "listing", "names", "name", "titles", "title", "count", "total",
  "number", "everything", "org", "organization", "organizational", "company", "team", "shared", "ai", "brain",
  "personal", "private", "knowledge", "base", "library", "how", "many",
]);
const GENERIC_QUERY_ANCHORS = new Set([
  "document", "documents", "doc", "docs", "file", "files", "item", "items", "pdf", "pdfs", "uploads",
  "uploaded", "list", "listing", "names", "titles", "everything", "count", "total",
]);

function isGenericDocumentQuery(text: string): boolean {
  if (!text) return false;
  const words = text.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.every((w) => GENERIC_QUERY_WORDS.has(w)) && words.some((w) => GENERIC_QUERY_ANCHORS.has(w));
}

/**
 * True when a USER message is asking to list / count the AI Brain documents.
 * Used by the chat route to steer the model to list_only (and away from partial excerpts).
 */
export function isDocumentListRequest(text: string): boolean {
  if (!text) return false;
  return detectListIntent(text) && /\b(brains?|documents?|docs?|files?|uploads?|uploaded|pdfs?|knowledge\s*base)\b/i.test(text);
}

/** Tool args may arrive as a real boolean or as the string "true" depending on the model. */
function parseListOnly(value: unknown): boolean {
  return value === true || (typeof value === "string" && value.trim().toLowerCase() === "true");
}

// ── Helper: List ALL documents in a collection (names + metadata only) ──────

type DocIndexEntry = { id: string; name: string; size: string; vectorChunks: number; processing: boolean };
type DocIndex = { entries: DocIndexEntry[]; total: number };

/** Reads name/size metadata for every document (plaintext is never read). Throws on Firestore errors. */
async function fetchDocumentIndex(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
): Promise<DocIndex> {
  // .select() fetches only the listed fields, so large plaintext bodies are never read.
  const docsSnap = await db
    .collection(collectionPath)
    .select("name", "size", "vectorChunkCount", "status")
    .limit(MAX_LIST_DOCS)
    .get();

  let total = docsSnap.size;
  if (docsSnap.size >= MAX_LIST_DOCS) {
    try {
      const countSnap = await db.collection(collectionPath).count().get();
      total = countSnap.data().count;
    } catch { /* best effort — fall back to the fetched size */ }
  }

  const entries = docsSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name || d.id),
        size: String(data.size || "?"),
        vectorChunks: Number(data.vectorChunkCount || 0),
        processing: data.status === "processing",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  return { entries, total };
}

function formatDocumentIndex(index: DocIndex, maxNames: number = MAX_LIST_DOCS): string[] {
  const lines: string[] = [];
  const { entries, total } = index;
  if (total === 0) {
    lines.push("TOTAL DOCUMENTS: 0 — no documents have been uploaded yet.");
    return lines;
  }
  if (entries.length > maxNames) {
    lines.push(`TOTAL DOCUMENTS: ${total} (too many to name here — call this tool with list_only=true to list every document)`);
    return lines;
  }
  lines.push(
    total > entries.length
      ? `TOTAL DOCUMENTS: ${total} (showing the first ${entries.length} names below)`
      : `TOTAL DOCUMENTS: ${total} (this is the complete list — every document is listed below)`,
  );
  // Same file uploaded more than once: each upload is its own document (matches the AI Brain page).
  const seen = new Map<string, number>();
  for (const e of entries) seen.set(e.name.toLowerCase(), (seen.get(e.name.toLowerCase()) || 0) + 1);
  const dupNames = [...seen.values()].filter((n) => n > 1).length;
  if (dupNames > 0) {
    lines.push(
      `Note: ${dupNames} file name(s) appear more than once because the same file was uploaded more than once ` +
      `(${seen.size} unique names). Each upload is counted separately, matching the AI Brain page.`,
    );
  }
  entries.forEach((e, i) => {
    lines.push(`${i + 1}. ${e.name} (${e.size}, ${e.vectorChunks} vector chunks${e.processing ? ", still processing" : ""})`);
  });
  return lines;
}

async function listAllDocuments(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
): Promise<string[]> {
  try {
    return formatDocumentIndex(await fetchDocumentIndex(db, collectionPath));
  } catch (err: any) {
    console.warn(`[Brain Tool] Document listing failed for ${collectionPath}:`, err?.message);
    return ["Error listing documents. Please try again."];
  }
}

/** Normalizes a name/query for loose matching ("Stage 4, 31_ Equal…" ≈ "stage 4 31 equal"). */
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// ── Helper: Search documents by name or query in a collection ────────────────

async function searchDocuments(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
  query: string,
  documentName?: string,
  listOnly?: boolean,
): Promise<string[]> {
  // List mode: return EVERY document name + authoritative count (no scoring, no plaintext cap)
  if (listOnly) return [(await listAllDocuments(db, collectionPath)).join("\n")];

  const lines: string[] = [];
  let totalChars = 0;

  try {
    const docsSnap = await db.collection(collectionPath).limit(30).get();
    if (docsSnap.empty) return lines;

    // Metadata index of EVERY document (names only, no plaintext). Used for the authoritative
    // count and to find name matches beyond the first 30 documents. Best effort.
    let index: DocIndex | null = null;
    try {
      index = await fetchDocumentIndex(db, collectionPath);
    } catch (idxErr: any) {
      console.warn(`[Brain Tool] Document index failed for ${collectionPath}:`, idxErr?.message);
    }
    const indexBlock = index
      ? [`#### Complete document list`, ...formatDocumentIndex(index, MAX_INDEX_NAMES_IN_SEARCH)].join("\n")
      : "";

    // No query/name = "show me the documents": lead with the complete name list + count,
    // because the plaintext section below is capped and only covers a few documents.
    if (!query && !documentName && indexBlock) {
      lines.push(indexBlock);
    }

    const queryLower = query.toLowerCase();
    const nameLower = (documentName || "").toLowerCase();

    // The first-30 read above misses later uploads; fetch documents whose NAME matches
    // the requested name/query even if they are outside those 30.
    let candidateDocs: Array<{ id: string; data: () => any }> = docsSnap.docs;
    if (index && (nameLower || queryLower)) {
      const have = new Set(docsSnap.docs.map((d) => d.id));
      const nName = normalizeForMatch(nameLower);
      const nQuery = normalizeForMatch(queryLower);
      const qWords = nQuery.split(" ").filter((w) => w.length > 2);
      const extraIds = index.entries
        .filter((e) => {
          if (have.has(e.id)) return false;
          const n = normalizeForMatch(e.name);
          return (nName && n.includes(nName)) ||
            (nQuery && n.includes(nQuery)) ||
            (qWords.length > 0 && qWords.every((w) => n.includes(w)));
        })
        .slice(0, MAX_EXTRA_NAME_MATCHES)
        .map((e) => e.id);
      if (extraIds.length > 0) {
        const extraSnaps = await db.getAll(...extraIds.map((id) => db.collection(collectionPath).doc(id)));
        candidateDocs = [...candidateDocs, ...extraSnaps.filter((s) => s.exists).map((s) => ({ id: s.id, data: () => s.data() || {} }))];
      }
    }

    // Score each document by relevance
    const scored = candidateDocs.map((d) => {
      const data = d.data();
      const docName = (data.name || d.id || "").toLowerCase();
      const plaintext = data.plaintext || "";
      let score = 0;

      // Exact or partial name match (highest priority)
      if (nameLower && docName.includes(nameLower)) score += 100;
      if (queryLower && docName.includes(queryLower)) score += 50;

      // Content keyword match
      if (queryLower && plaintext.toLowerCase().includes(queryLower)) score += 25;

      // Individual word matches in name
      if (queryLower) {
        const words = queryLower.split(/\s+/).filter(w => w.length > 2);
        for (const word of words) {
          if (docName.includes(word)) score += 10;
          if (plaintext.toLowerCase().includes(word)) score += 5;
        }
      }

      // Punctuation-insensitive name match ("Stage 4, 31_ Equal…" vs "stage 4 31 equal")
      if (nameLower && normalizeForMatch(docName).includes(normalizeForMatch(nameLower))) score += 100;

      // If no specific search, include everything with a base score
      if (!queryLower && !nameLower) score = 1;

      return { data, score, id: d.id };
    });

    // Sort by score descending, filter to relevant docs
    const relevant = scored
      .filter(d => d.score > 0)
      .sort((a, b) => b.score - a.score);

    if (relevant.length === 0) {
      lines.push("No matching documents found. (To see the name of every uploaded document, call this tool again with list_only=true.)");
      if (indexBlock) lines.push(indexBlock);
      return lines;
    }

    let emitted = 0;
    for (const doc of relevant) {
      if (totalChars >= MAX_TOTAL_PLAINTEXT) break;
      emitted++;

      const { data } = doc;
      const name = data.name || doc.id;
      const plaintext = data.plaintext || "";
      const vectorChunks = data.vectorChunkCount || 0;
      const size = data.size || "?";

      if (plaintext.length > 0) {
        const cappedText = plaintext.substring(0, MAX_DOC_PLAINTEXT);
        const truncated = plaintext.length > MAX_DOC_PLAINTEXT ? `\n[... truncated, ${plaintext.length} total chars]` : "";
        lines.push(`### 📄 ${name} (${size}, ${vectorChunks} vector chunks)\n\n${cappedText}${truncated}`);
        totalChars += cappedText.length;
      } else {
        lines.push(`### 📄 ${name} (${size}) — ⚠️ No text content extracted. The document may need to be re-uploaded.`);
      }
    }
    if (emitted < relevant.length) {
      lines.push(`[Note: contents shown for only ${emitted} of ${relevant.length} matching documents due to size limits. This is NOT the full document count — call this tool with list_only=true to list every document.]`);
    }
    // Content searches only show a few documents — always end with the authoritative count + names
    // so a partial content result is never mistaken for the full set of documents.
    if ((query || documentName) && indexBlock) {
      lines.push(`[The documents above are only the search matches. The full set of uploaded documents is:]\n${indexBlock}`);
    }
  } catch (err: any) {
    console.warn(`[Brain Tool] Document search failed for ${collectionPath}:`, err?.message);
    lines.push("Error searching documents. Please try again.");
  }

  return lines;
}

// ── Execution: search_org_brain ──────────────────────────────────────────────

export async function executeSearchOrgBrain(
  orgId: string,
  args: { query?: string; section?: string; list_only?: boolean | string }
): Promise<string> {
  await initAdmin();
  const db = getAdminFirestore();

  const query = (args.query || "").trim().toLowerCase();
  const explicitSection = args.section || "";

  // ── List mode: count + name every uploaded org document ────────────────
  // Overrides `section` (the model sometimes guesses e.g. "operations" for "items").
  const listOnly = parseListOnly(args.list_only) || detectListIntent(query) || isGenericDocumentQuery(query);
  if (listOnly) {
    const docLines = await searchDocuments(db, `orgs/${orgId}/org_brain_docs`, "", undefined, true);
    return JSON.stringify({
      result: `## Uploaded Org Brain Documents\n\n${docLines.join("\n\n")}`,
      source: "Organization AI Brain — Uploaded Documents (complete list)",
      orgId,
    });
  }

  // ── Determine which sections to include ────────────────────────────────
  let targetSections: Set<string> = new Set();

  if (explicitSection && explicitSection !== "all") {
    targetSections.add(explicitSection);
  } else if (query) {
    // Auto-detect sections from query keywords
    for (const hint of KEYWORD_HINTS) {
      if (hint.keywords.test(query)) {
        hint.sections.forEach((s) => targetSections.add(s));
      }
    }
  }

  // If still empty, return everything
  const returnAll = targetSections.size === 0;

  // ── Fetch data from Firestore ──────────────────────────────────────────
  let orgBrainProfile: any = null;
  let orgBrainCompiled = "";
  let orgProfileData: any = null;

  // 1. `organizations/{orgId}` — primary source for Guided Profile
  try {
    const orgDoc = await db.doc(`organizations/${orgId}`).get();
    if (orgDoc.exists) {
      const data = orgDoc.data();
      orgBrainProfile = data?.orgBrainProfile || null;
      orgBrainCompiled = data?.orgBrain || "";
    }
  } catch (err) {
    console.warn("[Org Brain Tool] Failed to read organizations/:", err);
  }

  // 2. Fallback: `orgs/${orgId}` (mirror)
  if (!orgBrainProfile) {
    try {
      const orgDoc = await db.doc(`orgs/${orgId}`).get();
      if (orgDoc.exists) {
        const data = orgDoc.data();
        orgBrainProfile = data?.orgBrainProfile || null;
        orgBrainCompiled = data?.orgBrain || orgBrainCompiled;
      }
    } catch { /* best effort */ }
  }

  // 3. `org_profiles/{orgId}` — org profile (mission, EIN, etc.)
  try {
    const profileDoc = await db.doc(`org_profiles/${orgId}`).get();
    if (profileDoc.exists) {
      orgProfileData = profileDoc.data();
    }
  } catch { /* best effort */ }

  // ── Build response ─────────────────────────────────────────────────────
  const lines: string[] = [];

  if (!orgBrainProfile && !orgBrainCompiled && !orgProfileData) {
    // Still check for uploaded documents even if no profile configured
    const docLines = await searchDocuments(db, `orgs/${orgId}/org_brain_docs`, query);
    if (docLines.length > 0) {
      return JSON.stringify({
        result: docLines.join("\n\n"),
        source: "Organization AI Brain — Uploaded Documents",
        orgId,
      });
    }
    return JSON.stringify({
      result: "No Organization AI Brain or Guided Profile has been configured for this organization yet. " +
        "An admin can set it up in the Media Library → Org AI Brain → Guided Profile tab.",
    });
  }

  const answers: Record<string, any> = orgBrainProfile?.answers || {};

  // ── Extract structured answers by section ──────────────────────────────
  if (returnAll || targetSections.has("values")) {
    const vals = answers.core_values;
    if (vals) {
      const display = Array.isArray(vals) ? vals.join(", ") : vals;
      lines.push(`## Core Organizational Values\n${display}`);
    }
  }

  if (returnAll || targetSections.has("escalation")) {
    const esc = answers.urgent_escalation_protocol;
    if (esc) {
      lines.push(`## Standard Escalation Protocol for Urgent Issues\n${typeof esc === "string" ? esc : JSON.stringify(esc)}`);
    }
  }

  if (returnAll || targetSections.has("identity")) {
    const identityKeys = SECTION_KEYS.identity;
    for (const key of identityKeys) {
      const val = answers[key];
      if (val) {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const display = Array.isArray(val) ? val.join(", ") : val;
        lines.push(`## ${label}\n${display}`);
      }
    }
    // Also include org_profiles data
    if (orgProfileData) {
      if (orgProfileData.missionStatement) {
        lines.push(`## Mission Statement (Org Profile)\n${orgProfileData.missionStatement}`);
      }
      if (orgProfileData.companyDescription) {
        lines.push(`## Company Description\n${orgProfileData.companyDescription}`);
      }
    }
  }

  if (returnAll || targetSections.has("operations") || targetSections.has("rules")) {
    const opKeys = [...new Set([...(SECTION_KEYS.operations || []), ...(SECTION_KEYS.rules || [])])];
    for (const key of opKeys) {
      const val = answers[key];
      if (val) {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const display = Array.isArray(val) ? val.join(", ") : val;
        lines.push(`## ${label}\n${display}`);
      }
    }
  }

  // ── Uploaded documents — NOW returns actual plaintext content ───────────
  if (returnAll || targetSections.has("documents")) {
    // If a query is provided, try vector search first for most relevant chunks
    if (query && query.length > 3) {
      try {
        const vectorChunks = await retrieveVectorChunks(query, {
          orgId,
          uid: undefined, // Only org vectors — never personal
          maxResults: 6,
          scope: "org",
        });
        if (vectorChunks.length > 0) {
          const vectorText = vectorChunks.map(vc =>
            `[Source: ${vc.source || vc.docTitle}]\n${vc.text}`
          ).join("\n\n---\n\n");
          lines.push(`## Relevant Content from Org Brain Documents (Vector Search)\n\n${vectorText}`);
        }
      } catch (vecErr: any) {
        console.warn("[Org Brain Tool] Vector search failed:", vecErr?.message);
      }
    }

    // Also do keyword/name search to find and return full documents
    const docLines = await searchDocuments(db, `orgs/${orgId}/org_brain_docs`, query);
    if (docLines.length > 0) {
      lines.push(`## Uploaded Org Brain Documents\n\n${docLines.join("\n\n")}`);
    }
  }

  // ── Fallback: use compiled briefing if no structured answers matched ───
  if (lines.length === 0 && orgBrainCompiled) {
    lines.push(orgBrainCompiled);
  }

  // ── If we still have nothing, say so ───────────────────────────────────
  if (lines.length === 0) {
    return JSON.stringify({
      result: "The Organization AI Brain is configured but no answers have been filled in yet for the requested section.",
    });
  }

  return JSON.stringify({
    result: lines.join("\n\n"),
    source: "Organization AI Brain — Guided Profile & Documents",
    orgId,
  });
}

// ── Execution: search_personal_brain ─────────────────────────────────────────

export async function executeSearchPersonalBrain(
  uid: string,
  args: { query?: string; document_name?: string; list_only?: boolean | string }
): Promise<string> {
  await initAdmin();
  const db = getAdminFirestore();

  const query = (args.query || "").trim();
  const documentName = (args.document_name || "").trim();
  const lines: string[] = [];

  // ── List mode: count + name every personal document (personal collection only) ──
  const listOnly = parseListOnly(args.list_only) || detectListIntent(query) || (!documentName && isGenericDocumentQuery(query));
  if (listOnly) {
    const docLines = await searchDocuments(db, `users/${uid}/ai_brain_docs`, "", undefined, true);
    return JSON.stringify({
      result: `## Personal AI Brain Documents\n\n${docLines.join("\n\n")}`,
      source: "Personal AI Brain — Uploaded Documents (complete list)",
    });
  }

  // If a query is provided, try vector search first
  if (query && query.length > 3) {
    try {
      const vectorChunks = await retrieveVectorChunks(query, {
        orgId: "", // No org — personal only
        uid,
        maxResults: 6,
        scope: "personal",
      });
      if (vectorChunks.length > 0) {
        const vectorText = vectorChunks.map(vc =>
          `[Source: ${vc.source || vc.docTitle}]\n${vc.text}`
        ).join("\n\n---\n\n");
        lines.push(`## Relevant Content from Personal AI Brain (Vector Search)\n\n${vectorText}`);
      }
    } catch (vecErr: any) {
      console.warn("[Personal Brain Tool] Vector search failed:", vecErr?.message);
    }
  }

  // Also do keyword/name search on the document collection
  const docLines = await searchDocuments(
    db,
    `users/${uid}/ai_brain_docs`,
    query || documentName,
    documentName,
  );

  if (docLines.length > 0) {
    lines.push(`## Personal AI Brain Documents\n\n${docLines.join("\n\n")}`);
  }

  if (lines.length === 0) {
    return JSON.stringify({
      result: "No documents found in your Personal AI Brain. Upload documents in the AI Brain page for Jarvis to read and reference.",
    });
  }

  return JSON.stringify({
    result: lines.join("\n\n"),
    source: "Personal AI Brain — Uploaded Documents",
  });
}
