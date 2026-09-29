/**
 * Activity Retriever — TF-IDF Search Engine
 *
 * Retrieves relevant context snippets from multiple CRM data sources to feed
 * into an LLM prompt. Uses TF-IDF-like scoring to rank snippets based on
 * relevance to a user query.
 *
 * Designed to run on the server side in API routes.
 */

export interface ActivitySnippet {
  text: string;
  source: string;
  type: 'email' | 'timeline' | 'brain' | 'pact' | 'crm' | 'guided_profile';
  score: number;
}

export interface ActivityRetrievalOptions {
  emailContent?: string;       // The specific email being discussed
  emailSubject?: string;       // Email subject for context
  activities?: Array<{         // CRM activity timeline items
    type: string;
    content: string;
    createdBy: string;
    timestamp?: any;
  }>;
  orgBrainText?: string;       // Organization AI brain rules/knowledge
  personalBrainText?: string;  // User's personal brain/notes
  pactText?: string;           // PACT Q&A text
  guidedProfileText?: string;  // Guided profile questionnaire answers
  crmContactData?: {           // CRM contact info
    firstName?: string;
    lastName?: string;
    email?: string;
    company?: string;
    location?: string;
    tags?: string[];
    aiNotes?: string;
    totalRevenue?: number;
    leadStatus?: string;
    jobTitle?: string;
    customFields?: Record<string, any>;
  };
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

function parseEmailSnippets(content?: string, subject?: string): ActivitySnippet[] {
  if (!content || !content.trim()) return [];
  const snippets: ActivitySnippet[] = [];
  
  if (subject && subject.trim()) {
    snippets.push({
      text: `Subject: ${subject.trim()}`,
      source: 'Current Email',
      type: 'email',
      score: 0
    });
  }

  const paragraphs = content.split(/\n\n+/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 10) continue;
    snippets.push({
      text: trimmed.substring(0, 300),
      source: 'Current Email',
      type: 'email',
      score: 0
    });
  }
  return snippets;
}

function parseTimelineSnippets(activities?: ActivityRetrievalOptions['activities']): ActivitySnippet[] {
  if (!activities || activities.length === 0) return [];
  const snippets: ActivitySnippet[] = [];
  for (const activity of activities) {
    if (!activity.content || !activity.content.trim()) continue;
    const text = `[${activity.type.toUpperCase()}] ${activity.content}`.substring(0, 300);
    snippets.push({
      text,
      source: 'Activity Timeline',
      type: 'timeline',
      score: 0
    });
  }
  return snippets;
}

function parseBrainSnippets(orgBrain?: string, personalBrain?: string): ActivitySnippet[] {
  const snippets: ActivitySnippet[] = [];
  const process = (text: string | undefined, source: string) => {
    if (!text || !text.trim()) return;
    const paragraphs = text.split(/\n\n+/);
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (trimmed.length < 10) continue;
      snippets.push({
        text: trimmed.substring(0, 300),
        source,
        type: 'brain',
        score: 0
      });
    }
  };
  process(orgBrain, 'Org Brain');
  process(personalBrain, 'Personal Brain');
  return snippets;
}

function parsePactSnippets(pactText?: string): ActivitySnippet[] {
  if (!pactText || !pactText.trim()) return [];
  const snippets: ActivitySnippet[] = [];
  const blocks = pactText.split(/\n\n+/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length < 5) continue;
    snippets.push({
      text: trimmed.substring(0, 300),
      source: 'P.A.C.T.',
      type: 'pact',
      score: 0
    });
  }
  return snippets;
}

function parseGuidedProfileSnippets(text?: string): ActivitySnippet[] {
  if (!text || !text.trim()) return [];
  const snippets: ActivitySnippet[] = [];
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length < 5) continue;
    snippets.push({
      text: trimmed.substring(0, 300),
      source: 'Guided Profile',
      type: 'guided_profile',
      score: 0
    });
  }
  return snippets;
}

function parseCrmSnippets(contactData?: ActivityRetrievalOptions['crmContactData']): ActivitySnippet[] {
  if (!contactData) return [];
  const snippets: ActivitySnippet[] = [];
  
  const fields = [];
  if (contactData.firstName || contactData.lastName) fields.push(`Name: ${contactData.firstName || ''} ${contactData.lastName || ''}`.trim());
  if (contactData.email) fields.push(`Email: ${contactData.email}`);
  if (contactData.company) fields.push(`Company: ${contactData.company}`);
  if (contactData.jobTitle) fields.push(`Title: ${contactData.jobTitle}`);
  if (contactData.location) fields.push(`Location: ${contactData.location}`);
  if (contactData.leadStatus) fields.push(`Status: ${contactData.leadStatus}`);
  if (contactData.totalRevenue) fields.push(`Revenue: $${contactData.totalRevenue}`);
  if (contactData.tags && contactData.tags.length > 0) fields.push(`Tags: ${contactData.tags.join(', ')}`);
  
  if (fields.length > 0) {
    snippets.push({
      text: fields.join('\n').substring(0, 300),
      source: 'CRM Contact',
      type: 'crm',
      score: 0
    });
  }

  if (contactData.aiNotes && contactData.aiNotes.trim()) {
    const notes = contactData.aiNotes.split(/\n\n+/);
    for (const note of notes) {
      if (note.trim().length > 5) {
        snippets.push({
          text: `AI Notes: ${note.trim()}`.substring(0, 300),
          source: 'CRM Contact',
          type: 'crm',
          score: 0
        });
      }
    }
  }
  
  return snippets;
}

// ── Main retrieval function ──

export function retrieveActivityContext(
  query: string,
  options: ActivityRetrievalOptions
): ActivitySnippet[] {
  const MAX_CITATIONS = 8;
  const MIN_SCORE = 0.1;

  // 1. Build all snippets
  const allSnippets: ActivitySnippet[] = [
    ...parseEmailSnippets(options.emailContent, options.emailSubject),
    ...parseTimelineSnippets(options.activities),
    ...parseBrainSnippets(options.orgBrainText, options.personalBrainText),
    ...parsePactSnippets(options.pactText),
    ...parseGuidedProfileSnippets(options.guidedProfileText),
    ...parseCrmSnippets(options.crmContactData)
  ];

  if (allSnippets.length === 0) return [];

  // 2. Tokenize query
  const queryTokens = tokenize(query);
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
  const scored: ActivitySnippet[] = [];

  for (let i = 0; i < allSnippets.length; i++) {
    const snippetTokenSet = snippetTokenSets[i];
    let score = 0;
    let matchedTerms = 0;

    for (const [term, queryCount] of queryTF.entries()) {
      if (snippetTokenSet.has(term)) {
        matchedTerms++;
        // IDF: log(totalDocs / docFrequency)
        const idf = Math.log((totalDocs + 1) / (docFrequency.get(term) || 1) + 1);
        const snippetTF = snippetTFs[i].get(term) || 0;
        score += queryCount * snippetTF * idf;
      }
    }

    // Bonus for multi-term match
    if (matchedTerms > 1) {
      score *= 1 + matchedTerms * 0.15;
    }

    // Bonus for bigram match
    const lowerSnippet = allSnippets[i].text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    for (let j = 0; j < queryTokens.length - 1; j++) {
      const bigram = queryTokens[j] + " " + queryTokens[j + 1];
      if (lowerSnippet.includes(bigram)) {
        score *= 1.3;
      }
    }

    // Normalize by snippet length
    const snippetLength = snippetTokenSet.size || 1;
    let normalizedScore = score / Math.sqrt(snippetLength);

    // Email content snippets get a 1.5x boost
    if (allSnippets[i].type === 'email') {
      normalizedScore *= 1.5;
    }

    if (normalizedScore > MIN_SCORE) {
      const snippet = { ...allSnippets[i], score: normalizedScore };
      scored.push(snippet);
    }
  }

  // 5. Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_CITATIONS);
}
