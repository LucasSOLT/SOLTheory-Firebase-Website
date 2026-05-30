import { NextResponse } from "next/server";

/**
 * POST /api/grants/search
 *
 * PRIMARY: Grants.gov REST API (free, no auth, structured federal grant data)
 * FALLBACK: Tavily web search (for state/local/foundation grants)
 *
 * Returns real, currently-open grant opportunities with direct application URLs.
 */

interface SearchRequest {
  grantTypes: string[];
  locationState: string;
  locationCity: string;
  budgetMin: number | null;
  budgetMax: number | null;
  companyDescription?: string;
  welfareKeywords?: string[];
}

interface GrantResult {
  title: string;
  url: string;
  description: string;
  source: string;
  agency?: string;
  closeDate?: string;
  awardCeiling?: number;
  opportunityNumber?: string;
}

/* ─── Map our 5 grant categories to Grants.gov search keywords ─── */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  housing_shelter: [
    "homeless", "shelter", "housing", "CoC", "continuum of care",
    "rapid rehousing", "emergency solutions", "HOME-ARP",
  ],
  health_human_services: [
    "behavioral health", "substance abuse", "mental health",
    "social services", "SAMHSA", "health services",
  ],
  community_development: [
    "community development", "CDBG", "neighborhood",
    "infrastructure", "revitalization",
  ],
  capacity_operations: [
    "capacity building", "technical assistance", "organizational",
    "training", "nonprofit",
  ],
  private_foundation: [
    "community", "foundation", "philanthropy", "charitable",
  ],
};

/* ═══════════════════════════════════════════════════════
   1. Grants.gov API (Primary Source)
   Free, no auth, real structured data.
   POST https://api.grants.gov/v1/api/search2
   ═══════════════════════════════════════════════════════ */

async function searchGrantsGov(
  keywords: string[],
  rows: number = 10
): Promise<GrantResult[]> {
  const allResults: GrantResult[] = [];
  const seenIds = new Set<string>();

  // Run searches for each keyword (max 3 to avoid rate limits)
  const searchKeywords = keywords.slice(0, 3);

  for (const keyword of searchKeywords) {
    try {
      const response = await fetch("https://api.grants.gov/v1/api/search2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          oppStatuses: "posted",  // Only currently-open opportunities
          rows: Math.min(rows, 10),
          sortBy: "openDate|desc",
        }),
      });

      if (!response.ok) {
        console.error(`[GrantSearch] Grants.gov error ${response.status} for "${keyword}"`);
        continue;
      }

      const data = await response.json();
      const opportunities = data?.data?.oppHits || [];

      for (const opp of opportunities) {
        const id = String(opp.id || "");
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        // Build the direct URL to the opportunity detail page
        const url = `https://www.grants.gov/search-results-detail/${id}`;

        allResults.push({
          title: opp.title || "Untitled Opportunity",
          url,
          description: opp.docType === "synopsis"
            ? `Federal grant opportunity (${opp.number || ""}). Open: ${opp.openDate || "N/A"} — Close: ${opp.closeDate || "N/A"}. CFDA: ${(opp.cfdaList || []).join(", ")}`
            : `Federal grant opportunity from ${opp.agency || "unknown agency"}.`,
          source: "grants.gov",
          agency: opp.agency || "",
          closeDate: opp.closeDate || "",
          awardCeiling: undefined, // Not in search results — would need fetchOpportunity
          opportunityNumber: opp.number || "",
        });
      }
    } catch (err) {
      console.error(`[GrantSearch] Grants.gov request failed for "${keyword}":`, err);
    }
  }

  console.log(`[GrantSearch] Grants.gov returned ${allResults.length} opportunities`);
  return allResults;
}

/* ═══════════════════════════════════════════════════════
   2. Tavily Search (Fallback for state/local/foundation)
   ═══════════════════════════════════════════════════════ */

async function searchTavily(query: string): Promise<GrantResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
        include_domains: [
          "cdola.colorado.gov",
          "cdhs.colorado.gov",
          "oedit.colorado.gov",
          "denvergov.org",
          "coloradohealth.org",
          "denverfoundation.org",
          "coloradotrust.org",
          "rwjf.org",
          "kresge.org",
          "instrumentl.com",
          "grantwatch.com",
        ],
        exclude_domains: [
          "youtube.com", "twitter.com", "facebook.com",
          "linkedin.com", "wikipedia.org", "reddit.com",
        ],
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();

    return (data.results || [])
      .filter((r: any) => {
        const url = (r.url || "").toLowerCase();
        // Reject PDFs, media files, blog posts
        if (/\.(pdf|docx?|xlsx?|pptx?)$/i.test(url)) return false;
        if (/\/(media|uploads|wp-content|blog|news)\//i.test(url)) return false;
        return true;
      })
      .map((r: any) => {
        let source = "unknown";
        try { source = new URL(r.url).hostname.replace("www.", ""); } catch { /* */ }
        return {
          title: (r.title || "").trim(),
          url: (r.url || "").trim(),
          description: (r.content || "").slice(0, 500).trim(),
          source,
        };
      });
  } catch (err) {
    console.error("[GrantSearch] Tavily fallback failed:", err);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════
   Combined Search Handler
   ═══════════════════════════════════════════════════════ */

// Relevance Scoring Engine
function computeRelevanceScore(grant: GrantResult, companyDesc: string, targetKeywords: string[]): number {
  let score = 0;
  const titleLower = grant.title.toLowerCase();
  const descLower = grant.description.toLowerCase();
  const combinedText = `${titleLower} ${descLower}`;

  // 1. Tag matches (high weight)
  if (targetKeywords && targetKeywords.length > 0) {
    targetKeywords.forEach((keyword) => {
      const kw = keyword.toLowerCase().trim();
      if (!kw) return;
      // Exact phrase match in title
      if (titleLower.includes(kw)) {
        score += 25;
      }
      // Match in description
      if (descLower.includes(kw)) {
        score += 10;
      }
    });
  }

  // 2. Company description semantic/term density matching
  if (companyDesc) {
    const descWords = companyDesc
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
      .split(/\s+/)
      .filter(word => word.length > 4); // only match meaningful long words

    const uniqueWords = Array.from(new Set(descWords));
    uniqueWords.forEach((word) => {
      // Exclude highly generic words
      if (["about", "their", "under", "which", "there", "where", "would", "could", "should", "working", "company", "status"].includes(word)) {
        return;
      }
      if (titleLower.includes(word)) {
        score += 8;
      }
      if (descLower.includes(word)) {
        score += 3;
      }
    });
  }

  // 3. Negative filters (slight penalty for raw landing pages or generic lists)
  if (combinedText.includes("list of grants") || combinedText.includes("directory")) {
    score -= 10;
  }

  return score;
}

export async function POST(request: Request) {
  try {
    const body: SearchRequest = await request.json();

    // Build keyword list: use welfareKeywords if provided, else fallback to grantTypes checkboxes
    const keywords: string[] = [];
    if (body.welfareKeywords && body.welfareKeywords.length > 0) {
      const pool = body.welfareKeywords.map(k => k.trim()).filter(Boolean);
      // Pick up to 3 diverse keywords (shuffled) to keep searches light and fast
      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      keywords.push(...shuffled.slice(0, 3));
    } else {
      const types = body.grantTypes && body.grantTypes.length > 0
        ? body.grantTypes
        : Object.keys(CATEGORY_KEYWORDS);

      for (const type of types) {
        const typeKeywords = CATEGORY_KEYWORDS[type] || [];
        if (typeKeywords.length > 0) {
          keywords.push(typeKeywords[Math.floor(Math.random() * typeKeywords.length)]);
        }
      }
    }

    // Ensure at least one keyword
    if (keywords.length === 0) {
      keywords.push("nonprofit grant");
    }

    console.log(`[GrantSearch] Keywords: ${keywords.join(", ")}`);

    // 1. Primary: Grants.gov API
    const grantsGovResults = await searchGrantsGov(keywords);

    // 2. Fallback: Tavily for state/local/foundation grants
    const location = body.locationCity && body.locationState
      ? `${body.locationCity} ${body.locationState}`
      : body.locationState || "Colorado";
    const tavilyQuery = `nonprofit 501(c)(3) grant application open ${location} ${keywords[0]} 2025 2026`;
    const tavilyResults = await searchTavily(tavilyQuery);

    // Merge, Deduplicate & Score Results
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const merged: GrantResult[] = [];

    for (const r of [...grantsGovResults, ...tavilyResults]) {
      const normalizedTitle = r.title.toLowerCase().trim();
      if (!seenUrls.has(r.url) && !seenTitles.has(normalizedTitle)) {
        seenUrls.add(r.url);
        seenTitles.add(normalizedTitle);

        // Apply relevance scoring
        const score = computeRelevanceScore(
          r,
          body.companyDescription || "",
          body.welfareKeywords || []
        );
        (r as any).score = score;

        merged.push(r);
      }
    }

    // Sort by relevance score in descending order
    merged.sort((a: any, b: any) => b.score - a.score);

    console.log(`[GrantSearch] Total: ${merged.length} results (${grantsGovResults.length} federal + ${tavilyResults.length} state/local)`);
    console.log(`[GrantSearch] Top 3 scored:`, merged.slice(0, 3).map(m => ({ title: m.title, score: (m as any).score })));

    return NextResponse.json({ grants: merged });
  } catch (err: any) {
    console.error("[GrantSearch] Route error:", err);
    return NextResponse.json({ error: err.message, grants: [] }, { status: 500 });
  }
}
