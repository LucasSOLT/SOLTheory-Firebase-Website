/**
 * @file jarvis-org-brain-tools.ts
 * @description Dynamic lookup tool for the Organization AI Brain & Guided Profile.
 *
 * Instead of injecting the full orgBrain text into every chat prompt (heavy token cost),
 * Jarvis receives a lightweight hint and calls `search_org_brain` on demand to retrieve
 * specific sections of the Guided Profile (values, escalation protocols, mission, etc.).
 *
 * Data sources:
 *   - `organizations/{orgId}` → orgBrainProfile.answers, orgBrain (compiled briefing)
 *   - `orgs/{orgId}` → mirror of the above (dual-write)
 *   - `org_profiles/{orgId}` → org profile (mission, EIN, staff size, etc.)
 *   - `orgs/{orgId}/org_brain_docs` → uploaded AI brain documents
 */

import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";

// ── Tool Definition ──────────────────────────────────────────────────────────

export const ORG_BRAIN_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_org_brain",
      description:
        "Search the Organization AI Brain and Guided Profile for company-specific information. " +
        "Use this to look up: core organizational values, escalation protocols (who to call for outages/security flags/client escalations), " +
        "elevator pitch, mission statement, compliance frameworks, leadership team, off-limits topics, " +
        "and any other organization-specific knowledge configured by admins. " +
        "This is NOT the CRM — this contains internal company policies, values, and operational guidelines.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              'Free-text search query, e.g. "core values", "escalation protocol", "who to call for outages", "mission statement", "compliance". Defaults to returning the full profile.',
          },
          section: {
            type: "string",
            enum: ["all", "values", "escalation", "identity", "operations", "rules", "documents"],
            description:
              'Optional filter. "values" = core org values, "escalation" = urgent contacts, "identity" = elevator pitch / mission / leadership, "operations" = compliance / off-limits / tone, "rules" = AI behavior rules, "documents" = uploaded org brain docs. "all" = everything.',
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
];

// ── Execution Function ───────────────────────────────────────────────────────

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
  // Try both collection paths — brain-profile writes to `organizations/{orgId}`
  // while some features use `orgs/{orgId}`
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

  // ── Uploaded documents (summary list) ──────────────────────────────────
  if (returnAll || targetSections.has("documents")) {
    try {
      const docsSnap = await db.collection(`orgs/${orgId}/org_brain_docs`).limit(20).get();
      if (!docsSnap.empty) {
        const docList = docsSnap.docs.map((d) => {
          const data = d.data();
          return `- ${data.name || d.id} (${data.type || "unknown"}, ${data.size || "?"})`;
        });
        lines.push(`## Uploaded Org Brain Documents\n${docList.join("\n")}`);
      }
    } catch { /* best effort */ }
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
    source: "Organization AI Brain — Guided Profile",
    orgId,
  });
}
