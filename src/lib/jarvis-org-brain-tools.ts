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
        "This is NOT the CRM — this contains internal company policies, values, operational guidelines, and uploaded reference documents.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              'Free-text search query, e.g. "core values", "escalation protocol", "peer review document", "Kyle Jenkins". Used for keyword matching and vector search of uploaded documents.',
          },
          section: {
            type: "string",
            enum: ["all", "values", "escalation", "identity", "operations", "rules", "documents"],
            description:
              'Optional filter. "values" = core org values, "escalation" = urgent contacts, "identity" = elevator pitch / mission / leadership, "operations" = compliance / off-limits / tone, "rules" = AI behavior rules, "documents" = search and READ uploaded org brain documents. "all" = everything including documents.',
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
];

/** Cap for plaintext returned per document */
const MAX_DOC_PLAINTEXT = 6000;
/** Cap for total plaintext returned across all documents */
const MAX_TOTAL_PLAINTEXT = 24000;

// ── Helper: Search documents by name or query in a collection ────────────────

async function searchDocuments(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
  query: string,
  documentName?: string,
): Promise<string[]> {
  const lines: string[] = [];
  let totalChars = 0;

  try {
    const docsSnap = await db.collection(collectionPath).limit(30).get();
    if (docsSnap.empty) return lines;

    const queryLower = query.toLowerCase();
    const nameLower = (documentName || "").toLowerCase();

    // Score each document by relevance
    const scored = docsSnap.docs.map((d) => {
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

      // If no specific search, include everything with a base score
      if (!queryLower && !nameLower) score = 1;

      return { data, score, id: d.id };
    });

    // Sort by score descending, filter to relevant docs
    const relevant = scored
      .filter(d => d.score > 0)
      .sort((a, b) => b.score - a.score);

    if (relevant.length === 0) {
      lines.push("No matching documents found.");
      return lines;
    }

    for (const doc of relevant) {
      if (totalChars >= MAX_TOTAL_PLAINTEXT) break;

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
  } catch (err: any) {
    console.warn(`[Brain Tool] Document search failed for ${collectionPath}:`, err?.message);
    lines.push("Error searching documents. Please try again.");
  }

  return lines;
}

// ── Execution: search_org_brain ──────────────────────────────────────────────

export async function executeSearchOrgBrain(
  orgId: string,
  args: { query?: string; section?: string }
): Promise<string> {
  await initAdmin();
  const db = getAdminFirestore();

  const query = (args.query || "").trim().toLowerCase();
  const explicitSection = args.section || "";

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
  args: { query?: string; document_name?: string }
): Promise<string> {
  await initAdmin();
  const db = getAdminFirestore();

  const query = (args.query || "").trim();
  const documentName = (args.document_name || "").trim();
  const lines: string[] = [];

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
