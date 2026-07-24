/**
 * KB Semantic Retriever — Server-Side Document Intelligence
 *
 * Performs semantic-aware document retrieval from Firestore, using:
 * 1. Overlapping paragraph chunking (500 chars with 100-char overlap)
 * 2. Synonym/related-term expansion for better recall
 * 3. TF-IDF scoring with entity boosting and bigram/trigram matching
 * 4. Source attribution for citation bubbles
 *
 * Designed to replace the client-side "dump all docs into prompt" approach.
 * Only the top N most relevant chunks are returned, keeping token usage focused.
 */

import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";

/* ═══════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════ */

export interface RetrievedChunk {
  /** The relevant text snippet */
  text: string;
  /** Source document title */
  source: string;
  /** Relevance score (higher = more relevant) */
  score: number;
  /** Source type for citation styling */
  type: "document" | "pact" | "org_brain" | "text_entry";
}

interface DocumentRecord {
  title: string;
  content: string;
  type: string;
}

/* ═══════════════════════════════════════════════════════════════
 * SYNONYM / RELATED-TERM MAP
 * Expands query terms to catch semantically similar content
 * that pure keyword matching would miss.
 * ═══════════════════════════════════════════════════════════════ */

const SYNONYM_MAP: Record<string, string[]> = {
  // Business & Finance
  revenue: ["income", "earnings", "sales", "profit", "financial", "money", "funding"],
  profit: ["earnings", "revenue", "income", "margin", "return", "gains"],
  budget: ["cost", "expense", "spending", "allocation", "financial", "funding"],
  strategy: ["plan", "approach", "roadmap", "blueprint", "framework", "methodology"],
  marketing: ["promotion", "advertising", "outreach", "branding", "campaign"],
  customer: ["client", "buyer", "consumer", "patron", "user", "prospect"],
  employee: ["staff", "worker", "team", "personnel", "hire", "talent"],
  growth: ["expansion", "scaling", "increase", "development", "progress"],

  // Technology
  software: ["application", "program", "platform", "tool", "system", "app"],
  database: ["storage", "data", "records", "firestore", "collection"],
  api: ["endpoint", "integration", "interface", "service", "webhook"],
  deploy: ["launch", "release", "ship", "publish", "go-live"],

  // Nonprofit / Social Services
  grant: ["funding", "award", "subsidy", "sponsorship", "fellowship"],
  nonprofit: ["charity", "foundation", "501c3", "organization", "ngo"],
  recidivism: ["reoffending", "reentry", "reintegration", "incarceration"],
  community: ["neighborhood", "local", "residents", "outreach", "engagement"],

  // Communication
  email: ["message", "mail", "correspondence", "inbox", "outreach"],
  meeting: ["appointment", "call", "conference", "session", "standup"],
  presentation: ["deck", "slides", "pitch", "demo", "showcase"],

  // Self-Improvement (SOL Theory domain)
  improvement: ["growth", "development", "progress", "enhancement", "betterment"],
  mindset: ["attitude", "perspective", "thinking", "mentality", "outlook"],
  goal: ["objective", "target", "aspiration", "milestone", "aim"],
  habit: ["routine", "practice", "ritual", "discipline", "pattern"],
  wellness: ["health", "wellbeing", "fitness", "selfcare", "balance"],

  // Operations & Logistics
  address: ["location", "directions", "where", "office", "street", "building", "map"],
  contact: ["phone", "email", "address", "reach", "connect", "touch", "inquiry"],
  contract: ["agreement", "terms", "document", "deal", "clause", "binding"],
  deadline: ["due", "schedule", "cutoff", "timeline", "target", "date"],
  invoice: ["bill", "payment", "statement", "receipt", "charge", "fee"],
  phone: ["call", "telephone", "contact", "mobile", "number", "dial"],
  proposal: ["pitch", "bid", "offer", "plan", "submission", "tender"],

  // Finance & Fundraising
  donation: ["contribution", "gift", "giving", "charity", "support", "fundraiser"],
  expense: ["cost", "spending", "outlay", "disbursement", "expenditure", "bill"],
  fundraising: ["campaign", "donations", "grants", "capital", "crowdfunding", "drive"],
  payment: ["remittance", "transaction", "settlement", "disbursement", "checkout"],
  sponsorship: ["underwriting", "backing", "support", "patronage", "benefactor"],

  // Reentry & Social Services
  coaching: ["mentorship", "guidance", "counseling", "advising", "support", "training"],
  impact: ["results", "outcomes", "difference", "effect", "benefit", "metrics"],
  mentor: ["advisor", "guide", "coach", "counselor", "role-model", "supporter"],
  reentry: ["reintegration", "transition", "rehousing", "rehabilitation", "release"],
  volunteer: ["supporter", "contributor", "helper", "advocate", "service", "participant"],

  // Legal & Justice System
  court: ["justice", "legal", "judge", "hearing", "tribunal", "proceedings"],
  incarceration: ["prison", "jail", "detention", "correctional", "confinement", "custody"],
  parole: ["supervision", "release", "probation", "conditional", "clearance"],
  probation: ["supervision", "conditional", "monitoring", "parole", "diversion"],
  sentencing: ["judgment", "penalty", "verdict", "conviction", "ruling", "term"],

  // Education & Training
  certification: ["credential", "license", "qualification", "accreditation", "certificate"],
  curriculum: ["syllabus", "courses", "modules", "training", "program", "lessons"],
  training: ["workshop", "education", "instruction", "coaching", "learning", "prep"],
  workshop: ["seminar", "session", "class", "training", "lab", "webinar"],

  // Communication & Outreach
  announcement: ["notice", "update", "bulletin", "broadcast", "news", "release"],
  newsletter: ["bulletin", "update", "publication", "digest", "dispatch", "circular"],
  outreach: ["engagement", "awareness", "advocacy", "networking", "connection", "campaign"],

  // General & User Queries
  help: ["support", "assistance", "guide", "faq", "service", "info"],
  resources: ["materials", "tools", "guides", "assets", "information", "library"],
  schedule: ["calendar", "hours", "timeline", "availability", "appointments", "dates"],
};

/** Expand a set of query tokens with related terms */
function expandWithSynonyms(tokens: string[]): Set<string> {
  const expanded = new Set<string>(tokens);
  for (const token of tokens) {
    const related = SYNONYM_MAP[token];
    if (related) {
      for (const r of related) {
        expanded.add(r);
      }
    }
    // Also check if this token appears as a synonym value
    for (const [key, values] of Object.entries(SYNONYM_MAP)) {
      if (values.includes(token)) {
        expanded.add(key);
      }
    }
  }
  return expanded;
}

/* ═══════════════════════════════════════════════════════════════
 * TOKENIZATION
 * ═══════════════════════════════════════════════════════════════ */

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "to", "of", "in",
  "for", "on", "with", "at", "by", "from", "as", "into", "through",
  "during", "before", "after", "above", "below", "between", "out",
  "off", "over", "under", "again", "further", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "each", "every",
  "both", "few", "more", "most", "other", "some", "such", "no", "nor",
  "not", "only", "own", "same", "so", "than", "too", "very", "just",
  "don", "now", "and", "but", "or", "if", "this", "that", "these",
  "those", "i", "me", "my", "we", "our", "you", "your", "he", "him",
  "his", "she", "her", "it", "its", "they", "them", "their", "what",
  "which", "who", "whom", "about", "also", "up",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }
  return tf;
}

/* ═══════════════════════════════════════════════════════════════
 * DOCUMENT CHUNKING
 * Splits documents into overlapping paragraphs for focused retrieval.
 * ═══════════════════════════════════════════════════════════════ */

interface Chunk {
  text: string;
  source: string;
  type: RetrievedChunk["type"];
}

function chunkDocument(doc: DocumentRecord, chunkSize = 500, overlap = 100): Chunk[] {
  const content = doc.content || "";
  if (content.length < 20) return [];

  const chunks: Chunk[] = [];

  // First try splitting by double newlines (natural paragraphs)
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if ((currentChunk + "\n\n" + trimmed).length > chunkSize && currentChunk.length > 50) {
      chunks.push({
        text: currentChunk.trim(),
        source: doc.title || "Uploaded Document",
        type: doc.type === "text" ? "text_entry" : "document",
      });
      // Overlap: keep the last portion of the previous chunk
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.min(20, Math.floor(words.length * 0.3)));
      currentChunk = overlapWords.join(" ") + "\n\n" + trimmed;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + trimmed : trimmed;
    }
  }

  // Push remaining content
  if (currentChunk.trim().length > 20) {
    chunks.push({
      text: currentChunk.trim(),
      source: doc.title || "Uploaded Document",
      type: doc.type === "text" ? "text_entry" : "document",
    });
  }

  // If document had no paragraph breaks, do sliding-window chunking
  if (chunks.length === 0 && content.length > chunkSize) {
    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const slice = content.substring(i, i + chunkSize).trim();
      if (slice.length > 20) {
        chunks.push({
          text: slice,
          source: doc.title || "Uploaded Document",
          type: doc.type === "text" ? "text_entry" : "document",
        });
      }
    }
  } else if (chunks.length === 0 && content.length >= 20) {
    chunks.push({
      text: content.trim(),
      source: doc.title || "Uploaded Document",
      type: doc.type === "text" ? "text_entry" : "document",
    });
  }

  return chunks;
}

/** Parse PACT Q&A text into chunks */
function chunkPACTText(pactText: string): Chunk[] {
  if (!pactText || !pactText.trim()) return [];
  const chunks: Chunk[] = [];
  const blocks = pactText.split(/\n\n+/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length < 5) continue;
    chunks.push({ text: trimmed, source: "P.A.C.T. Memory", type: "pact" });
  }
  return chunks;
}

/** Parse org brain text into chunks */
function chunkOrgBrain(orgBrainText: string): Chunk[] {
  if (!orgBrainText || !orgBrainText.trim()) return [];
  const chunks: Chunk[] = [];
  const paragraphs = orgBrainText.split(/\n\n+/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 10) continue;
    chunks.push({ text: trimmed.substring(0, 600), source: "Organization Brain", type: "org_brain" });
  }
  return chunks;
}

/* ═══════════════════════════════════════════════════════════════
 * SCORING ENGINE
 * Enhanced TF-IDF with synonym expansion, entity boosting,
 * and n-gram phrase matching.
 * ═══════════════════════════════════════════════════════════════ */

function scoreChunks(query: string, allChunks: Chunk[], maxResults: number = 8): RetrievedChunk[] {
  if (allChunks.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const queryTF = termFrequency(queryTokens);
  const expandedQueryTerms = expandWithSynonyms(queryTokens);

  // Pre-process all chunks
  const chunkData = allChunks.map((chunk) => {
    const tokens = tokenize(chunk.text);
    const tf = termFrequency(tokens);
    const tokenSet = new Set(tokens);
    return { tokens, tf, tokenSet };
  });

  // Compute document frequency for IDF
  const docFrequency = new Map<string, number>();
  for (const { tokenSet } of chunkData) {
    for (const t of tokenSet) {
      docFrequency.set(t, (docFrequency.get(t) || 0) + 1);
    }
  }
  const totalDocs = allChunks.length;

  // Score each chunk
  const scored: { index: number; score: number }[] = [];

  for (let i = 0; i < allChunks.length; i++) {
    const { tokenSet, tf } = chunkData[i];
    let score = 0;
    let directMatchCount = 0;
    let synonymMatchCount = 0;

    // Direct query term matches (highest weight)
    for (const [term, queryCount] of queryTF.entries()) {
      if (tokenSet.has(term)) {
        directMatchCount++;
        const idf = Math.log((totalDocs + 1) / (docFrequency.get(term) || 1) + 1);
        const chunkTF = tf.get(term) || 0;
        score += queryCount * chunkTF * idf * 2.0; // 2x weight for direct matches
      }
    }

    // Synonym/expanded term matches (lower weight)
    for (const expandedTerm of expandedQueryTerms) {
      if (!queryTF.has(expandedTerm) && tokenSet.has(expandedTerm)) {
        synonymMatchCount++;
        const idf = Math.log((totalDocs + 1) / (docFrequency.get(expandedTerm) || 1) + 1);
        const chunkTF = tf.get(expandedTerm) || 0;
        score += chunkTF * idf * 0.7; // 0.7x weight for synonym matches
      }
    }

    // Multi-term overlap boost
    const totalMatches = directMatchCount + synonymMatchCount;
    if (totalMatches > 1) {
      score *= 1 + totalMatches * 0.2;
    }

    // Bigram phrase matching (exact 2-word sequences from query found in chunk)
    const lowerChunk = allChunks[i].text.toLowerCase();
    for (let j = 0; j < queryTokens.length - 1; j++) {
      const bigram = queryTokens[j] + " " + queryTokens[j + 1];
      if (lowerChunk.includes(bigram)) {
        score *= 1.4;
      }
    }

    // Trigram phrase matching
    for (let j = 0; j < queryTokens.length - 2; j++) {
      const trigram = queryTokens[j] + " " + queryTokens[j + 1] + " " + queryTokens[j + 2];
      if (lowerChunk.includes(trigram)) {
        score *= 1.5;
      }
    }

    // Entity/proper noun boost: if query contains capitalized words that appear in chunk
    const queryEntities = query.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)*/g) || [];
    for (const entity of queryEntities) {
      if (allChunks[i].text.includes(entity)) {
        score *= 1.6;
      }
    }

    // Normalize by chunk length (so focused chunks aren't penalized)
    const chunkLength = tokenSet.size || 1;
    const normalizedScore = score / Math.sqrt(chunkLength);

    if (normalizedScore > 0) {
      scored.push({ index: i, score: normalizedScore });
    }
  }

  // Sort by score descending, deduplicate sources, take top N
  scored.sort((a, b) => b.score - a.score);

  const results: RetrievedChunk[] = [];
  const MIN_SCORE = 0.1;

  for (const { index, score } of scored) {
    if (results.length >= maxResults) break;
    if (score < MIN_SCORE && results.length > 0) break;

    const chunk = allChunks[index];
    results.push({
      text: chunk.text.substring(0, 600), // Cap individual chunks at 600 chars
      source: chunk.source,
      score,
      type: chunk.type,
    });
  }

  return results;
}

/* ═══════════════════════════════════════════════════════════════
 * MAIN RETRIEVAL FUNCTION
 * Fetches user's knowledge docs from Firestore, chunks them,
 * scores against query, returns top results.
 * ═══════════════════════════════════════════════════════════════ */

export async function retrieveSemanticChunks(
  userQuery: string,
  options: {
    uid: string;
    agentId: string;
    orgId: string;
    pactText?: string;
    orgBrainText?: string;
    /** If provided, skip Firestore fetch and use this text directly (fallback) */
    knowledgeBaseText?: string;
    maxResults?: number;
  }
): Promise<RetrievedChunk[]> {
  const maxResults = options.maxResults || 8;
  const allChunks: Chunk[] = [];

  try {
    // 1. Fetch knowledge docs from Firestore (server-side)
    if (options.uid && options.agentId) {
      await initAdmin();
      const db = getAdminFirestore();
      const agentVariants = [
        options.agentId,
        `${options.orgId}_${options.agentId}`,
      ];

      for (const variant of agentVariants) {
        try {
          const snapshot = await db
            .collection("users")
            .doc(options.uid)
            .collection("agents")
            .doc(variant)
            .collection("knowledge_docs")
            .limit(50) // Safety limit
            .get();

          snapshot.forEach((doc) => {
            const data = doc.data() as DocumentRecord;
            if (data.content && data.content.trim().length > 10) {
              const docChunks = chunkDocument(data);
              allChunks.push(...docChunks);
            }
          });
        } catch {
          // Variant not found, skip
        }
      }

      // Also check legacy knowledge_chunks collection
      for (const variant of agentVariants) {
        try {
          const legacySnap = await db
            .collection("users")
            .doc(options.uid)
            .collection("agents")
            .doc(variant)
            .collection("knowledge_chunks")
            .limit(50)
            .get();

          legacySnap.forEach((doc) => {
            const data = doc.data();
            if (data.text && data.text.trim().length > 10) {
              allChunks.push({
                text: data.text.substring(0, 600),
                source: "Knowledge Base",
                type: "document",
              });
            }
          });
        } catch {
          // Legacy collection not found, skip
        }
      }
    }

    // 2. If no Firestore docs found but client sent knowledgeBaseText, chunk that
    if (allChunks.length === 0 && options.knowledgeBaseText) {
      const fallbackChunks = chunkDocument({
        title: "Uploaded Documents",
        content: options.knowledgeBaseText,
        type: "text",
      });
      allChunks.push(...fallbackChunks);
    }

    // 3. Add PACT and org brain chunks
    if (options.pactText) {
      allChunks.push(...chunkPACTText(options.pactText));
    }
    if (options.orgBrainText) {
      allChunks.push(...chunkOrgBrain(options.orgBrainText));
    }

    // 4. Score and return top results
    return scoreChunks(userQuery, allChunks, maxResults);
  } catch (err) {
    console.error("[KBSemanticRetriever] Error:", (err as any)?.message || err);

    // Fallback: if Firestore fetch fails, try with client-provided text
    if (options.knowledgeBaseText) {
      const fallbackChunks = chunkDocument({
        title: "Uploaded Documents",
        content: options.knowledgeBaseText,
        type: "text",
      });
      if (options.pactText) fallbackChunks.push(...chunkPACTText(options.pactText));
      if (options.orgBrainText) fallbackChunks.push(...chunkOrgBrain(options.orgBrainText));
      return scoreChunks(userQuery, fallbackChunks, maxResults);
    }

    return [];
  }
}
