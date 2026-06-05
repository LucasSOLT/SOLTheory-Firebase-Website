import { NextResponse } from "next/server";

/**
 * POST /api/grants/search
 *
 * Uses the Grants.gov REST API exclusively — the single largest and most
 * reliable source of federal grant opportunities for 501(c)(3) nonprofits.
 *
 * Grants.gov has thousands of active opportunities at any time covering
 * CoC, HOME-ARP, ESG, SAMHSA, SSBG, CDBG and more. All structured data
 * with direct application links, real close dates, and opportunity numbers.
 *
 * Tavily web search was removed because it returned generic org homepages
 * and blog posts rather than actual grant applications.
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

/* ─── Map our grant categories to Grants.gov search keywords ─── */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  housing_shelter: [
    "homeless", "shelter", "housing", "CoC", "continuum of care",
    "rapid rehousing", "emergency solutions", "HOME-ARP",
    "transitional housing", "permanent supportive housing",
  ],
  health_human_services: [
    "behavioral health", "substance abuse", "mental health",
    "social services", "SAMHSA", "health services",
    "opioid", "community health", "prevention",
  ],
  community_development: [
    "community development", "CDBG", "neighborhood",
    "infrastructure", "revitalization", "economic development",
  ],
  capacity_operations: [
    "capacity building", "technical assistance", "organizational",
    "training", "nonprofit", "workforce development",
  ],
  private_foundation: [
    "community", "foundation", "philanthropy", "charitable",
    "community grant", "social impact",
  ],
};

/* ═══════════════════════════════════════════════════════
   Smart Keyword Rewriting
   
   Transforms raw user keywords into more targeted search
   queries that bias results toward grants FOR the user's
   org type, not just grants that MENTION the keyword.
   ═══════════════════════════════════════════════════════ */

function rewriteKeyword(keyword: string): string {
  const kw = keyword.toLowerCase().trim();
  
  // Organization-type keywords should be rewritten to search for
  // grants targeting that org type, not just mentioning it
  const orgTypeRewrites: Record<string, string> = {
    "501(c)(3) grants": "grants eligible nonprofit 501c3 organizations",
    "coc grants": "continuum of care homeless assistance grants",
    "home-arp": "HOME American Rescue Plan housing assistance",
    "esg (emergency solutions)": "emergency solutions grant homeless prevention",
    "ssbg (social services)": "social services block grant state funding",
  };
  
  // Check for exact match rewrites
  if (orgTypeRewrites[kw]) return orgTypeRewrites[kw];
  
  // For generic keywords, keep as-is (they're already descriptive)
  return keyword;
}

/* ═══════════════════════════════════════════════════════
   Grants.gov API — free, no auth, structured federal data
   POST https://api.grants.gov/v1/api/search2
   ═══════════════════════════════════════════════════════ */

async function searchGrantsGov(
  keywords: string[],
  rows: number = 10
): Promise<GrantResult[]> {
  const allResults: GrantResult[] = [];
  const seenIds = new Set<string>();

  // Search with up to 5 keywords for broader coverage
  const searchKeywords = keywords.slice(0, 5);

  for (const keyword of searchKeywords) {
    try {
      const response = await fetch("https://api.grants.gov/v1/api/search2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          oppStatuses: "posted",  // Only currently-open opportunities
          rows: Math.min(rows, 15),
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
   Relevance Scoring Engine
   ═══════════════════════════════════════════════════════ */

function computeRelevanceScore(grant: GrantResult, companyDesc: string, targetKeywords: string[]): number {
  let score = 0;
  const titleLower = grant.title.toLowerCase();
  const descLower = grant.description.toLowerCase();
  const combinedText = `${titleLower} ${descLower}`;

  // 1. Tag / keyword matches (high weight)
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

  // 2. Company description term matching
  if (companyDesc) {
    const descWords = companyDesc
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
      .split(/\s+/)
      .filter(word => word.length > 4); // only meaningful words

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

  // 3. Bonus for grants with close dates (more actionable)
  if (grant.closeDate) {
    score += 5;
  }

  // 4. Bonus for grants with opportunity numbers (verified listings)
  if (grant.opportunityNumber) {
    score += 5;
  }

  // 5. EXCLUSION LANGUAGE PENALTY — detect grants that exclude the user's org type
  const exclusionPatterns = [
    /(?:does not|do not|not eligible|ineligible|exclud(?:es?|ing)|not accept(?:ed|ing)?|cannot apply).*(?:501\(?c\)?\(?3\)?|nonprofit|non-profit)/i,
    /(?:501\(?c\)?\(?3\)?|nonprofit|non-profit).*(?:not eligible|ineligible|exclud(?:es?|ing)|cannot|may not)/i,
    /(?:for[- ]?profit only|for[- ]?profit companies only|limited to for[- ]?profit)/i,
    /(?:only|exclusively|restricted to).*(?:for[- ]?profit|commercial|private sector)/i,
  ];

  // Check if the user is looking for nonprofit/501c3 grants
  const isNonprofitSearch = targetKeywords.some(kw => {
    const k = kw.toLowerCase();
    return k.includes("501") || k.includes("nonprofit") || k.includes("non-profit");
  }) || (companyDesc && /(?:nonprofit|non-profit|501\(?c\)?\(?3\)?)/.test(companyDesc.toLowerCase()));

  if (isNonprofitSearch) {
    for (const pattern of exclusionPatterns) {
      if (pattern.test(combinedText)) {
        score -= 50; // Heavy penalty for grants that exclude nonprofits
        break;
      }
    }
    
    // Also penalize grants that are clearly for-profit only
    if (combinedText.includes("for profit") && !combinedText.includes("nonprofit") && !combinedText.includes("non-profit") && !combinedText.includes("501")) {
      score -= 30;
    }
  }

  return score;
}

/* ═══════════════════════════════════════════════════════
   Combined Search Handler
   ═══════════════════════════════════════════════════════ */

export async function POST(request: Request) {
  try {
    const body: SearchRequest = await request.json();

    // Build keyword list from welfare keywords + grant type categories
    const keywords: string[] = [];

    // Primary: use user-defined welfare keywords
    if (body.welfareKeywords && body.welfareKeywords.length > 0) {
      const pool = body.welfareKeywords.map(k => rewriteKeyword(k.trim())).filter(Boolean);
      // Pick up to 5 diverse keywords (shuffled) for broader coverage
      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      keywords.push(...shuffled.slice(0, 5));
    }

    // Secondary: supplement from grant type categories if we have < 3 keywords
    if (keywords.length < 3) {
      const types = body.grantTypes && body.grantTypes.length > 0
        ? body.grantTypes
        : Object.keys(CATEGORY_KEYWORDS);

      for (const type of types) {
        const typeKeywords = CATEGORY_KEYWORDS[type] || [];
        if (typeKeywords.length > 0) {
          // Pick a random keyword from this category to vary results across scans
          const kw = typeKeywords[Math.floor(Math.random() * typeKeywords.length)];
          if (!keywords.includes(kw)) {
            keywords.push(kw);
          }
        }
        if (keywords.length >= 5) break;
      }
    }

    // Ensure at least one keyword
    if (keywords.length === 0) {
      keywords.push("nonprofit grant");
    }

    console.log(`[GrantSearch] Keywords: ${keywords.join(", ")}`);

    // Search Grants.gov
    const results = await searchGrantsGov(keywords);

    // Deduplicate & score
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const scored: GrantResult[] = [];

    for (const r of results) {
      const normalizedTitle = r.title.toLowerCase().trim();
      if (!seenUrls.has(r.url) && !seenTitles.has(normalizedTitle)) {
        seenUrls.add(r.url);
        seenTitles.add(normalizedTitle);

        const score = computeRelevanceScore(
          r,
          body.companyDescription || "",
          body.welfareKeywords || []
        );
        (r as any).score = score;

        scored.push(r);
      }
    }

    // Sort by relevance score (best matches first)
    scored.sort((a: any, b: any) => b.score - a.score);

    console.log(`[GrantSearch] Total: ${scored.length} federal results`);
    console.log(`[GrantSearch] Top 3 scored:`, scored.slice(0, 3).map(m => ({ title: m.title, score: (m as any).score })));

    return NextResponse.json({ grants: scored });
  } catch (err: any) {
    console.error("[GrantSearch] Route error:", err);
    return NextResponse.json({ error: err.message, grants: [] }, { status: 500 });
  }
}
