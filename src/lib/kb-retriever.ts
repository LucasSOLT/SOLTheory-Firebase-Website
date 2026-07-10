/**
 * Knowledge Base Retriever — Citation Engine
 *
 * Performs fast keyword-based relevance matching to identify which knowledge
 * base snippets are relevant to a user's query. Returns citations that the
 * UI can display as "source bubbles" next to Jarvis' response.
 *
 * Designed to run in parallel with the main LLM call — adds zero latency.
 */

export interface KBCitation {
  /** The relevant text snippet (already truncated to a reasonable length) */
  text: string;
  /** Human-readable source label, e.g. "P.A.C.T.", "Company FAQ", "Org Brain" */
  source: string;
  /** Category for styling */
  type: "pact" | "document" | "org_brain";
}

interface KBSnippet {
  text: string;
  source: string;
  type: "pact" | "document" | "org_brain";
}

// ── Tokenizer helpers ──

/** Normalize and split text into lowercase tokens, removing stop-words. */
function tokenize(text: string): string[] {
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

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/** Build a term frequency map. */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }
  return tf;
}

// ── Snippet builders ──

/**
 * Parse PACT Q&A text into individual snippets.
 * PACT text is formatted as "Q: ...\nA: ...\n\nQ: ...\nA: ..."
 */
function parsePACTSnippets(pactText: string): KBSnippet[] {
  if (!pactText || !pactText.trim()) return [];
  const snippets: KBSnippet[] = [];
  const blocks = pactText.split(/\n\n+/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length < 5) continue;
    snippets.push({ text: trimmed, source: "P.A.C.T.", type: "pact" });
  }
  return snippets;
}

/**
 * Split uploaded document text into paragraph-level snippets.
 * knowledgeBaseText is the concatenation of all uploaded docs.
 */
function parseDocSnippets(kbText: string): KBSnippet[] {
  if (!kbText || !kbText.trim()) return [];
  const snippets: KBSnippet[] = [];

  // Try to split by document boundaries first (the hook joins with double newlines)
  const paragraphs = kbText.split(/\n\n+/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 10) continue;
    // Try to extract a document title from common patterns
    const titleMatch = trimmed.match(/^(?:Title|Document|Source):\s*(.+)/im);
    const source = titleMatch ? titleMatch[1].substring(0, 40) : "Uploaded Doc";
    snippets.push({
      text: trimmed.substring(0, 300), // Cap individual snippets
      source,
      type: "document",
    });
  }
  return snippets;
}

/** Split org brain text into paragraph-level snippets. */
function parseOrgBrainSnippets(orgBrainText: string): KBSnippet[] {
  if (!orgBrainText || !orgBrainText.trim()) return [];
  const snippets: KBSnippet[] = [];
  const paragraphs = orgBrainText.split(/\n\n+/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 10) continue;
    snippets.push({
      text: trimmed.substring(0, 300),
      source: "Org Brain",
      type: "org_brain",
    });
  }
  return snippets;
}

// ── Main retrieval function ──

/**
 * Find the most relevant knowledge base snippets for a user query.
 *
 * Uses TF-IDF–like scoring: for each snippet, compute the overlap between
 * query tokens and snippet tokens, weighted by inverse document frequency
 * (rarer terms across all snippets score higher).
 *
 * @returns Top 3-5 citations sorted by relevance score (highest first).
 *          Returns empty array if no snippets score above the threshold.
 */
export function retrieveRelevantSnippets(
  userQuery: string,
  options: {
    pactText?: string;
    knowledgeBaseText?: string;
    orgBrainText?: string;
  }
): KBCitation[] {
  const MAX_CITATIONS = 5;
  const MIN_SCORE = 0.15; // Minimum relevance threshold

  // 1. Build all snippets
  const allSnippets: KBSnippet[] = [
    ...parsePACTSnippets(options.pactText || ""),
    ...parseDocSnippets(options.knowledgeBaseText || ""),
    ...parseOrgBrainSnippets(options.orgBrainText || ""),
  ];

  if (allSnippets.length === 0) return [];

  // 2. Tokenize query
  const queryTokens = tokenize(userQuery);
  if (queryTokens.length === 0) return [];
  const queryTF = termFrequency(queryTokens);

  // 3. Tokenize all snippets and compute document frequency (for IDF)
  const snippetTokenSets: Set<string>[] = [];
  const snippetTFs: Map<string, number>[] = [];
  const docFrequency = new Map<string, number>();

  for (const snippet of allSnippets) {
    const tokens = tokenize(snippet.text);
    const tf = termFrequency(tokens);
    const uniqueTokens = new Set(tokens);

    snippetTokenSets.push(uniqueTokens);
    snippetTFs.push(tf);

    for (const t of uniqueTokens) {
      docFrequency.set(t, (docFrequency.get(t) || 0) + 1);
    }
  }

  const totalDocs = allSnippets.length;

  // 4. Score each snippet against the query
  const scored: { index: number; score: number }[] = [];

  for (let i = 0; i < allSnippets.length; i++) {
    const snippetTokenSet = snippetTokenSets[i];
    let score = 0;
    let matchedTerms = 0;

    for (const [term, queryCount] of queryTF.entries()) {
      if (snippetTokenSet.has(term)) {
        matchedTerms++;
        // IDF: log(totalDocs / docFrequency) — rarer terms score higher
        const idf = Math.log((totalDocs + 1) / (docFrequency.get(term) || 1) + 1);
        const snippetTF = snippetTFs[i].get(term) || 0;
        score += queryCount * snippetTF * idf;
      }
    }

    // Bonus: if multiple query terms match, boost score (phrase-like matching)
    if (matchedTerms > 1) {
      score *= 1 + matchedTerms * 0.15;
    }

    // Bonus: exact substring match of multi-word query phrases
    const lowerSnippet = allSnippets[i].text.toLowerCase();
    const lowerQuery = userQuery.toLowerCase();
    // Check for bigrams from the query appearing in the snippet
    for (let j = 0; j < queryTokens.length - 1; j++) {
      const bigram = queryTokens[j] + " " + queryTokens[j + 1];
      if (lowerSnippet.includes(bigram)) {
        score *= 1.3;
      }
    }

    // Normalize by snippet length (so short, focused snippets aren't penalized)
    const snippetLength = snippetTokenSet.size || 1;
    const normalizedScore = score / Math.sqrt(snippetLength);

    if (normalizedScore > 0) {
      scored.push({ index: i, score: normalizedScore });
    }
  }

  // 5. Sort by score descending, take top N above threshold
  scored.sort((a, b) => b.score - a.score);

  const results: KBCitation[] = [];
  for (const { index, score } of scored) {
    if (results.length >= MAX_CITATIONS) break;
    if (score < MIN_SCORE && results.length > 0) break; // Allow at least 1 even if below threshold

    const snippet = allSnippets[index];
    // Truncate display text to ~120 chars for the UI bubble
    const displayText =
      snippet.text.length > 120
        ? snippet.text.substring(0, 117) + "..."
        : snippet.text;

    results.push({
      text: displayText,
      source: snippet.source,
      type: snippet.type,
    });
  }

  return results;
}
