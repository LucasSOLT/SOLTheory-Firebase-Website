import { describe, it, expect, beforeEach, vi } from "vitest";

// ── In-memory Firestore fake ────────────────────────────────────────────────
const h = vi.hoisted(() => {
  type Row = { id: string; data: Record<string, any> };
  const collections: Record<string, Row[]> = {};
  const docs: Record<string, Record<string, any>> = {};
  const gets: Array<{ path: string; selected?: string[]; limit?: number }> = [];
  const vectorCalls: Array<{ query: string; opts: any }> = [];

  function makeQuery(path: string, selected?: string[], lim?: number): any {
    return {
      select: (...fields: string[]) => makeQuery(path, fields, lim),
      limit: (n: number) => makeQuery(path, selected, n),
      doc: (id: string) => ({ __path: path, __id: id }),
      count: () => ({ get: async () => ({ data: () => ({ count: (collections[path] || []).length }) }) }),
      get: async () => {
        gets.push({ path, selected, limit: lim });
        const all = collections[path] || [];
        const sliced = typeof lim === "number" ? all.slice(0, lim) : all;
        const out = sliced.map((r) => ({
          id: r.id,
          data: () => {
            if (!selected) return r.data;
            const picked: Record<string, any> = {};
            for (const f of selected) if (f in r.data) picked[f] = r.data[f];
            return picked;
          },
        }));
        return { empty: out.length === 0, size: out.length, docs: out };
      },
    };
  }

  const db = {
    collection: (p: string) => makeQuery(p),
    doc: (p: string) => ({ get: async () => ({ exists: !!docs[p], data: () => docs[p] }) }),
    getAll: async (...refs: Array<{ __path: string; __id: string }>) => {
      return refs.map((ref) => {
        gets.push({ path: ref.__path });
        const row = (collections[ref.__path] || []).find((r) => r.id === ref.__id);
        return { id: ref.__id, exists: !!row, data: () => row?.data };
      });
    },
  };
  return { collections, docs, gets, vectorCalls, db };
});

vi.mock("@/firebase/admin", () => ({
  initAdmin: async () => {},
  getFirestore: () => h.db,
}));

vi.mock("../kb-vector-retriever", () => ({
  retrieveVectorChunks: async (query: string, opts: any) => {
    h.vectorCalls.push({ query, opts });
    return [];
  },
}));

import {
  executeSearchOrgBrain,
  executeSearchPersonalBrain,
  isDocumentListRequest,
  ORG_BRAIN_TOOL_DEFINITIONS,
  PERSONAL_BRAIN_TOOL_DEFINITIONS,
} from "../jarvis-org-brain-tools";

/** True when the executor answered in list mode (complete name list, no contents). */
function isListResult(json: string): boolean {
  return String(JSON.parse(json).source || "").includes("(complete list)");
}

const ORG = "org123";
const UID = "user456";
const ORG_DOCS = `orgs/${ORG}/org_brain_docs`;
const USER_DOCS = `users/${UID}/ai_brain_docs`;

function seed(path: string, count: number, prefix = "Doc") {
  h.collections[path] = Array.from({ length: count }, (_, i) => ({
    id: `id${i}`,
    data: {
      name: `${prefix} ${i + 1}.pdf`,
      size: "120 KB",
      vectorChunkCount: 3,
      status: "ready",
      plaintext: `content of ${prefix} ${i + 1} ` + "x".repeat(6000),
    },
  }));
}

function result(json: string): string {
  return JSON.parse(json).result as string;
}

function namesIn(text: string, prefix: string, count: number): number {
  let n = 0;
  for (let i = 1; i <= count; i++) if (text.includes(`${prefix} ${i}.pdf`)) n++;
  return n;
}

beforeEach(() => {
  for (const k of Object.keys(h.collections)) delete h.collections[k];
  for (const k of Object.keys(h.docs)) delete h.docs[k];
  h.gets.length = 0;
  h.vectorCalls.length = 0;
  h.docs[`organizations/${ORG}`] = { orgBrainProfile: { answers: { core_values: ["Integrity"], compliance_frameworks: "HIPAA" } } };
});

describe("tool definitions", () => {
  it("expose list_only on both tools", () => {
    expect(ORG_BRAIN_TOOL_DEFINITIONS[0].function.parameters.properties).toHaveProperty("list_only");
    expect(PERSONAL_BRAIN_TOOL_DEFINITIONS[0].function.parameters.properties).toHaveProperty("list_only");
    expect(ORG_BRAIN_TOOL_DEFINITIONS[0].function.description).toMatch(/list_only=true/);
  });
});

describe("search_org_brain list mode", () => {
  it("lists and counts ALL documents (more than the old 30 limit and 24k plaintext cap)", async () => {
    seed(ORG_DOCS, 47);
    const text = result(await executeSearchOrgBrain(ORG, { section: "documents", list_only: true }));
    expect(text).toContain("TOTAL DOCUMENTS: 47");
    expect(namesIn(text, "Doc", 47)).toBe(47);
    // No plaintext leaked into the listing
    expect(text).not.toContain("xxxxxxxxxx");
    // Metadata-only read: plaintext is not selected
    const listGet = h.gets.find((g) => g.path === ORG_DOCS);
    expect(listGet?.selected).toBeDefined();
    expect(listGet?.selected).not.toContain("plaintext");
    // No vector search in list mode
    expect(h.vectorCalls.length).toBe(0);
  });

  it("list_only overrides a misrouted section (e.g. operations) and ignores a conversational query", async () => {
    seed(ORG_DOCS, 31);
    const text = result(await executeSearchOrgBrain(ORG, { section: "operations", query: "how many items", list_only: true }));
    expect(text).toContain("TOTAL DOCUMENTS: 31");
    expect(namesIn(text, "Doc", 31)).toBe(31);
    expect(text).not.toContain("HIPAA");
  });

  it('accepts list_only as the string "true"', async () => {
    seed(ORG_DOCS, 5);
    const text = result(await executeSearchOrgBrain(ORG, { list_only: "true" }));
    expect(text).toContain("TOTAL DOCUMENTS: 5");
  });

  it("auto-detects list/count questions when the model forgets list_only", async () => {
    seed(ORG_DOCS, 33);
    for (const q of [
      "how many items are in the org ai brain rn",
      "How many documents are there now",
      "what are the names of the documents",
      "list all the documents",
      "which files are in the org brain",
    ]) {
      const text = result(await executeSearchOrgBrain(ORG, { section: "operations", query: q }));
      expect(text, q).toContain("TOTAL DOCUMENTS: 33");
    }
  });

  it("does NOT switch to list mode for a normal content question", async () => {
    seed(ORG_DOCS, 3);
    const json = await executeSearchOrgBrain(ORG, { section: "documents", query: "Doc 2" });
    expect(isListResult(json)).toBe(false);
    expect(result(json)).toContain("content of Doc 2");
  });

  it("list-intent heuristic ignores content questions that merely mention documents", async () => {
    seed(ORG_DOCS, 3);
    for (const q of [
      "what does the onboarding document say about pto",
      "list the core values",
      "summarize the w4 document",
      "how many vacation days does the employee handbook allow",
      "what is in the direct deposit document",
      "Doc 2",
      "w4 form",
    ]) {
      const json = await executeSearchOrgBrain(ORG, { section: "documents", query: q });
      expect(isListResult(json), q).toBe(false);
    }
  });

  it("reports zero documents explicitly", async () => {
    const text = result(await executeSearchOrgBrain(ORG, { section: "documents", list_only: true }));
    expect(text).toContain("TOTAL DOCUMENTS: 0");
  });

  it("sorts names naturally", async () => {
    seed(ORG_DOCS, 12);
    const text = result(await executeSearchOrgBrain(ORG, { list_only: true }));
    expect(text.indexOf("1. Doc 1.pdf")).toBeGreaterThan(-1);
    expect(text.indexOf("Doc 2.pdf")).toBeLessThan(text.indexOf("Doc 10.pdf"));
    expect(text).toContain("12. Doc 12.pdf");
  });

  it("empty-query documents read leads with the complete list and flags truncated contents", async () => {
    seed(ORG_DOCS, 35);
    const text = result(await executeSearchOrgBrain(ORG, { section: "documents" }));
    expect(text).toContain("TOTAL DOCUMENTS: 35");
    expect(namesIn(text, "Doc", 35)).toBe(35);
    expect(text).toMatch(/NOT the full document count/);
  });

  it("only ever reads the org collection (never personal docs)", async () => {
    seed(ORG_DOCS, 2);
    seed(USER_DOCS, 4, "Private");
    const text = result(await executeSearchOrgBrain(ORG, { list_only: true }));
    expect(text).not.toContain("Private");
    expect(h.gets.every((g) => g.path === ORG_DOCS)).toBe(true);
  });
});

describe("search_personal_brain list mode", () => {
  it("lists and counts all personal documents only", async () => {
    seed(USER_DOCS, 40, "Private");
    seed(ORG_DOCS, 3);
    const text = result(await executeSearchPersonalBrain(UID, { list_only: true }));
    expect(text).toContain("TOTAL DOCUMENTS: 40");
    expect(namesIn(text, "Private", 40)).toBe(40);
    expect(text).not.toContain("Doc 1.pdf");
    expect(h.gets.every((g) => g.path === USER_DOCS)).toBe(true);
    expect(h.vectorCalls.length).toBe(0);
  });

  it("auto-detects a count question in query", async () => {
    seed(USER_DOCS, 8, "Private");
    const text = result(await executeSearchPersonalBrain(UID, { query: "how many documents do I have" }));
    expect(text).toContain("TOTAL DOCUMENTS: 8");
  });

  it("document_name lookups still return content (no list mode)", async () => {
    seed(USER_DOCS, 3, "Private");
    const json = await executeSearchPersonalBrain(UID, { document_name: "Private 3" });
    expect(isListResult(json)).toBe(false);
    expect(result(json)).toContain("content of Private 3");
  });

  it("finds a personal document by name even when it is beyond the first 30", async () => {
    seed(USER_DOCS, 40, "Private");
    const text = result(await executeSearchPersonalBrain(UID, { document_name: "Private 38" }));
    expect(text).toContain("content of Private 38");
  });
});

// ── Regressions found in review ─────────────────────────────────────────────

/** Mirrors the real nxtchapter org: 31 docs (6 duplicate names), timestamp-ordered IDs. */
function seedRealistic(path: string) {
  const names = [
    "1.0_Nxt_Chapter_ICA.pdf", "0.0 NXT Compliance Master List.docx", "1.2 Background Check Form.pdf", "4.0 Form i-9.pdf",
    "4.1 Form i-9_Supervisor_Verification_Protocol.png", "4.2 Form i-9-spanish.pdf", "5.0 Form W4 - Employees.pdf",
    "Stage 2, 7_ Direct Deposit Authorization Form.pdf", "Stage 2, 8_ HIPAA 42 CFR Part 2 Confidentiality Agreement.pdf",
    "Stage 2, 9_ Business Associate Agreement (BAA).pdf", "Stage 2, 10_ NXT Chapter Soft Approach NDA & Collaboration Guide.pdf",
    "Stage 2, 11_ Code of Conduct & Workplace Ethics Acknowledgment.pdf", "Stage 2, 12_ Equal Employment Opportunity (EEO) & Anti-Harassment Receipt.pdf",
    "Stage 3, 13_ Driver_s License & Motor Vehicle Insurance Verification.pdf", "Stage 3, 17_ Acceptable Technology & Security Policy Sign-off.pdf",
    "Stage 3, 18_ Staff Release of Information (ROI) Protocol Verification.pdf", "Stage 3, 19_ Transportation & Driver Safety Policy (2-Staff Rule).pdf",
    "Stage 3, 20_ Coach Accountability Point System Agreement.pdf", "Stage 3, 21_ Grievance & Dispute Resolution Policy Acknowledgment.pdf",
    "Stage 3, 22_ Dress Code & Professional Appearance Policy Receipt.pdf", "Stage 3, 23_ Professional Email Guidelines Acknowledgment.pdf",
    "Stage 3, 24_ Media Release and Consent Form.pdf", "0.0 NXT Compliance Master List.docx", "1.2 Background Check Form.pdf", "4.0 Form i-9.pdf",
    "4.1 Form i-9_Supervisor_Verification_Protocol.png", "4.2 Form i-9-spanish.pdf", "5.0 Form W4 - Employees.pdf",
    "Stage 4, 25_ Orientation Packet & Quiz Completion Sign-Off.pdf", "Stage 4, 30_ CaseManager & Reliatrax EHR Database Training Log.pdf",
    "Stage 4, 31_ Equal Diversity & Person-Centered Care Training Log.pdf",
  ];
  h.collections[path] = names.map((name, i) => ({
    id: `17913976${String(i).padStart(5, "0")}`,
    data: { name, size: "50 KB", vectorChunkCount: 0, status: "ready", plaintext: `Body text of ${name}. documents list policy ` + "y".repeat(7000) },
  }));
  return names;
}

describe("review regressions", () => {
  it("generic document-only queries (what models actually send) return the complete list", async () => {
    const names = seedRealistic(ORG_DOCS);
    for (const q of ["documents", "all documents", "org brain documents", "list", "uploaded files", "names of documents", "all uploaded docs", "everything in the org ai brain"]) {
      const json = await executeSearchOrgBrain(ORG, { section: "documents", query: q });
      const text = result(json);
      expect(isListResult(json), q).toBe(true);
      expect(text, q).toContain("TOTAL DOCUMENTS: 31");
      for (const n of names) expect(text, `${q} → ${n}`).toContain(n);
    }
  });

  it("flags duplicate uploads so the model neither drops them nor miscounts", async () => {
    seedRealistic(ORG_DOCS);
    const text = result(await executeSearchOrgBrain(ORG, { list_only: true }));
    expect(text).toContain("TOTAL DOCUMENTS: 31");
    expect(text).toMatch(/6 file name\(s\) appear more than once/);
    expect(text).toMatch(/25 unique names/);
    expect(text).toContain("31. Stage 4, 31_ Equal Diversity");
  });

  it("finds the 31st document by name (outside the first-30 read), punctuation-insensitive", async () => {
    seedRealistic(ORG_DOCS);
    for (const q of ["Equal Diversity", "stage 4 31 equal diversity", "Person-Centered Care Training Log"]) {
      const text = result(await executeSearchOrgBrain(ORG, { section: "documents", query: q }));
      expect(text, q).toContain("### 📄 Stage 4, 31_ Equal Diversity & Person-Centered Care Training Log.pdf");
    }
  });

  it("content searches end with the authoritative count + every name", async () => {
    const names = seedRealistic(ORG_DOCS);
    const json = await executeSearchOrgBrain(ORG, { section: "documents", query: "policy" });
    const text = result(json);
    expect(isListResult(json)).toBe(false);
    expect(text).toContain("### 📄");
    expect(text).toContain("TOTAL DOCUMENTS: 31");
    for (const n of names) expect(text, n).toContain(n);
  });

  it("isDocumentListRequest matches the user's real phrasings and not unrelated questions", () => {
    for (const q of [
      "I uploaded like 20 more documents, how many are there now and what are the names of the documents?",
      "how many items are in the org Ai brain rn?",
      "what are the names of the documents in the org brain",
      "how many documents are in the org ai brain",
      "list all the files in my ai brain",
    ]) expect(isDocumentListRequest(q), q).toBe(true);
    for (const q of [
      "how many contacts do we have",
      "list the core values",
      "what does the W4 document say about allowances",
      "how many vacation days do employees get",
      "schedule a meeting with Kyle",
    ]) expect(isDocumentListRequest(q), q).toBe(false);
  });
});
