import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import { searchPhilanthropicSources } from "@/services/grant-sources/philanthropic-orchestrator";
import type { GrantSearchParams, NormalizedGrant } from "@/types/grants";
import { getKeywordsForServiceAreas } from "@/data/service-areas";
import { getPopulationKeywords } from "@/data/populations";

/**
 * POST /api/grants/search-philanthropic
 *
 * Multi-source philanthropic/foundation grant search with AI relevance scoring.
 *
 * 1. Accepts full search params from the client
 * 2. Calls the philanthropic orchestrator which fans out to ProPublica,
 *    Candid, and other foundation databases
 * 3. Applies batch AI relevance scoring via Groq LLM (foundation-focused prompt)
 * 4. Falls back to keyword-based scoring if LLM is unavailable
 * 5. Returns sorted results with source statistics
 */

/* ─── Map our grant categories to search keywords ─── */
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

  const orgTypeRewrites: Record<string, string> = {
    "501(c)(3) grants": "grants eligible nonprofit 501c3 organizations",
    "coc grants": "continuum of care homeless assistance grants",
    "home-arp": "HOME American Rescue Plan housing assistance",
    "esg (emergency solutions)": "emergency solutions grant homeless prevention",
    "ssbg (social services)": "social services block grant state funding",
  };

  if (orgTypeRewrites[kw]) return orgTypeRewrites[kw];
  return keyword;
}

/* ═══════════════════════════════════════════════════════
   Build Keywords from Request
   ═══════════════════════════════════════════════════════ */

function buildKeywords(body: {
  welfareKeywords?: string[];
  grantTypes?: string[];
  serviceAreas?: string[];
  populationsServed?: string[];
}): string[] {
  const keywords: string[] = [];

  // PRIMARY: Use NTEE service area keywords (new config system)
  if (body.serviceAreas && body.serviceAreas.length > 0) {
    const areaKeywords = getKeywordsForServiceAreas(body.serviceAreas);
    // Take up to 8 keywords from service areas (they're very targeted)
    keywords.push(...areaKeywords.slice(0, 8));
    console.log(`[PhilanthropicSearch] ${areaKeywords.length} keywords from ${body.serviceAreas.length} service areas`);
  }

  // SECONDARY: Add population-specific keywords for better matching
  if (body.populationsServed && body.populationsServed.length > 0) {
    const popKeywords = getPopulationKeywords(body.populationsServed);
    // Add 2-3 population keywords that aren't already included
    for (const pk of popKeywords) {
      if (!keywords.some((k) => k.toLowerCase() === pk.toLowerCase())) {
        keywords.push(pk);
      }
      if (keywords.length >= 10) break;
    }
  }

  // FALLBACK: Use welfare keywords if no service areas selected (backward compat)
  if (keywords.length === 0 && body.welfareKeywords && body.welfareKeywords.length > 0) {
    const pool = body.welfareKeywords.map((k) => rewriteKeyword(k.trim())).filter(Boolean);
    keywords.push(...pool.slice(0, 5));
  }

  // LAST RESORT: supplement from grant type categories if we have < 3 keywords
  if (keywords.length < 3) {
    const types =
      body.grantTypes && body.grantTypes.length > 0
        ? body.grantTypes
        : Object.keys(CATEGORY_KEYWORDS);

    for (const type of types) {
      const typeKeywords = CATEGORY_KEYWORDS[type] || [];
      if (typeKeywords.length > 0) {
        const kw = typeKeywords[0];
        if (!keywords.includes(kw)) {
          keywords.push(kw);
        }
      }
      if (keywords.length >= 5) break;
    }
  }

  if (keywords.length === 0) {
    keywords.push("nonprofit grant");
  }

  // Deduplicate and cap at 10
  return [...new Set(keywords)].slice(0, 10);
}

/* ═══════════════════════════════════════════════════════
   Fallback: Keyword-based Relevance Scoring
   Used when Groq AI scoring is unavailable.
   ═══════════════════════════════════════════════════════ */

function computeRelevanceScore(
  grant: NormalizedGrant,
  companyDesc: string,
  targetKeywords: string[]
): number {
  let score = 0;
  const titleLower = grant.title.toLowerCase();
  const descLower = (grant.description || "").toLowerCase();
  const combinedText = `${titleLower} ${descLower}`;

  // 1. Tag / keyword matches (high weight)
  if (targetKeywords && targetKeywords.length > 0) {
    targetKeywords.forEach((keyword) => {
      const kw = keyword.toLowerCase().trim();
      if (!kw) return;
      if (titleLower.includes(kw)) score += 25;
      if (descLower.includes(kw)) score += 10;
    });
  }

  // 2. Company description term matching
  if (companyDesc) {
    const descWords = companyDesc
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 4);

    const uniqueWords = Array.from(new Set(descWords));
    const stopWords = new Set([
      "about", "their", "under", "which", "there", "where",
      "would", "could", "should", "working", "company", "status",
    ]);
    uniqueWords.forEach((word) => {
      if (stopWords.has(word)) return;
      if (titleLower.includes(word)) score += 8;
      if (descLower.includes(word)) score += 3;
    });
  }

  // 3. Bonus for foundations with larger estimated funding (more capacity)
  if (grant.estimatedTotalFunding && grant.estimatedTotalFunding > 0) score += 5;

  // 4. Bonus for foundations with source URLs (verified listings)
  if (grant.sourceUrl) score += 5;

  // 5. EXCLUSION LANGUAGE PENALTY
  const exclusionPatterns = [
    /(?:does not|do not|not eligible|ineligible|exclud(?:es?|ing)|not accept(?:ed|ing)?|cannot apply).*(?:501\(?c\)?\(?3\)?|nonprofit|non-profit)/i,
    /(?:501\(?c\)?\(?3\)?|nonprofit|non-profit).*(?:not eligible|ineligible|exclud(?:es?|ing)|cannot|may not)/i,
    /(?:for[- ]?profit only|for[- ]?profit companies only|limited to for[- ]?profit)/i,
    /(?:only|exclusively|restricted to).*(?:for[- ]?profit|commercial|private sector)/i,
  ];

  const isNonprofitSearch =
    targetKeywords.some((kw) => {
      const k = kw.toLowerCase();
      return k.includes("501") || k.includes("nonprofit") || k.includes("non-profit");
    }) ||
    (companyDesc && /(?:nonprofit|non-profit|501\(?c\)?\(?3\)?)/.test(companyDesc.toLowerCase()));

  if (isNonprofitSearch) {
    for (const pattern of exclusionPatterns) {
      if (pattern.test(combinedText)) {
        score -= 50;
        break;
      }
    }
    if (
      combinedText.includes("for profit") &&
      !combinedText.includes("nonprofit") &&
      !combinedText.includes("non-profit") &&
      !combinedText.includes("501")
    ) {
      score -= 30;
    }
  }

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, score));
}

/* ═══════════════════════════════════════════════════════
   AI Relevance Scoring (Groq Batch) — Foundation-Focused

   Sends up to 20 foundations/philanthropic entities in a
   single LLM call for relevance scoring. Returns scores
   0-100 with 1-sentence explanations.
   ═══════════════════════════════════════════════════════ */

interface AIScoreResult {
  id: string;
  score: number;
  explanation: string;
}

async function batchAIRelevanceScore(
  grants: NormalizedGrant[],
  searchContext: {
    companyDescription?: string;
    locationCity?: string;
    locationState?: string;
    welfareKeywords?: string[];
    grantTypes?: string[];
    eligibilityType?: string;
    eligibilityTypes?: string[];
    serviceAreas?: string[];
    populationsServed?: string[];
    orgBudget?: number | null;
    orgStaffSize?: number | null;
    geoScope?: string;
  }
): Promise<Map<string, { score: number; explanation: string }>> {
  const resultMap = new Map<string, { score: number; explanation: string }>();

  if (grants.length === 0) return resultMap;

  try {
    if (!process.env.GROQ_API_KEY) {
      console.warn("[PhilanthropicSearch] No GROQ_API_KEY set — skipping AI scoring");
      return resultMap;
    }
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Process in batches of 20
    const BATCH_SIZE = 20;
    for (let batchStart = 0; batchStart < grants.length; batchStart += BATCH_SIZE) {
      const batch = grants.slice(batchStart, batchStart + BATCH_SIZE);

      const grantsForPrompt = batch.map((g, idx) => ({
        id: g.id || `grant-${batchStart + idx}`,
        title: g.title,
        description: (g.description || "").substring(0, 200),
        agency: g.agency || "Unknown",
        grantScope: g.grantScope || "unknown",
        sources: (g.sources || []).join(", "),
        estimatedTotalFunding: g.estimatedTotalFunding || null,
        awardAmountMax: g.awardAmountMax || null,
      }));

      const locationStr = [searchContext.locationCity, searchContext.locationState]
        .filter(Boolean)
        .join(", ") || "not specified";

      // Build enhanced focus areas from service areas + keywords
      const focusAreas = [
        ...(searchContext.serviceAreas || []).map((s) => s.replace(/_/g, " ")),
        ...(searchContext.welfareKeywords || []),
      ].filter(Boolean).join(", ") || "general";

      // Organization type from eligibility types
      const orgTypes = (searchContext.eligibilityTypes || []).length > 0
        ? searchContext.eligibilityTypes!.map((t) => t.replace(/_/g, " ")).join(", ")
        : searchContext.eligibilityType || "nonprofit 501(c)(3)";

      // Budget and staff context
      const budgetStr = searchContext.orgBudget
        ? `$${searchContext.orgBudget.toLocaleString()}`
        : "not specified";
      const staffStr = searchContext.orgStaffSize
        ? `${searchContext.orgStaffSize} employees`
        : "not specified";

      // Population context
      const populationStr = (searchContext.populationsServed || []).length > 0
        ? searchContext.populationsServed!.map((p) => p.replace(/_/g, " ")).join(", ")
        : "general population";

      // Geographic scope
      const geoScopeStr = searchContext.geoScope
        ? searchContext.geoScope.replace(/_/g, " ")
        : "state";

      const prompt = `You are a philanthropic funding relevance scorer. Rate how likely each foundation/philanthropic organization would fund work like the applicant's. Score each entry 0-100.

IMPORTANT CONTEXT: These entries are foundations and philanthropic entities, NOT active grant opportunities with specific deadlines. You are evaluating whether the foundation's mission, geographic focus, and giving patterns are a good match for the applicant.

APPLICANT ORGANIZATION PROFILE:
- Description: ${searchContext.companyDescription || "Nonprofit organization"}
- Organization type: ${orgTypes}
- Annual budget: ${budgetStr}
- Staff size: ${staffStr}
- Service areas: ${focusAreas}
- Populations served: ${populationStr}

SEARCH PARAMETERS:
- Location: ${locationStr}
- Geographic scope: ${geoScopeStr}
- Grant categories sought: ${(searchContext.grantTypes || []).join(", ") || "all"}

SCORING RULES (CRITICAL — follow these strictly):
1. GEOGRAPHIC OVERLAP is the #1 factor (up to +30 points):
   - Foundation gives in the applicant's city → +30 points
   - Foundation gives in the applicant's state → +20 points
   - Foundation gives nationally and applicant's state qualifies → +10 points
   - Foundation gives only in a different state/region than the applicant → score 0-10 at most
   - Foundation only funds internationally when applicant is domestic → score 0
2. PROGRAM AREA ALIGNMENT (up to +25 points):
   - Foundation's stated purpose or NTEE codes match the applicant's service areas → up to +25 points
   - Partial overlap (e.g., foundation funds "health" broadly, applicant does "substance abuse") → +10-15
   - No overlap in program areas → score 0-10
3. FOUNDATION SIZE vs. REQUEST SIZE (up to +20 points):
   - Foundation's total assets or annual giving can reasonably support the applicant's budget range → +20
   - Very small family foundations with < $100K assets for an org with $1M+ budget → penalize
   - Very large foundations (>$100M assets) for a small community org → slight bonus (they fund small orgs too)
4. POPULATION ALIGNMENT (up to +15 points):
   - Foundation explicitly serves same populations as applicant → +15 points
   - Foundation serves broader populations that include applicant's target → +5-10
   - Foundation serves entirely different populations → score 0
5. PENALIZE vague/generic foundation descriptions that lack specific program focus → -10 points
6. AUTOMATIC ZERO: Score exactly 0 for foundations that are clearly irrelevant:
   - Foundation only funds internationally when applicant is domestic
   - Foundation's purpose is in a completely unrelated field (e.g., arts foundation for a homeless shelter)
   - Foundation is defunct or has zero recent giving activity

IMPORTANT: For the "explanation" field, be SPECIFIC about WHY you gave that score.
- BAD example: "This foundation is somewhat relevant."
- GOOD example: "Colorado-based community foundation with housing focus; gives $2M/yr in applicant's state; serves homeless populations matching applicant's mission."
- GOOD example: "Score 0: International wildlife conservation foundation; no domestic social services giving."
Always mention which factors raised or lowered the score.

FOUNDATIONS TO SCORE:
${JSON.stringify(grantsForPrompt, null, 1)}

Respond with ONLY a valid JSON array, no markdown, no explanation:
[{"id": "...", "score": 85, "explanation": "..."}, ...]`;

      try {
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content:
                "You are a precise JSON-only responder. Output ONLY a valid JSON array with no markdown, no explanation, no code blocks.",
            },
            { role: "user", content: prompt },
          ],
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          max_tokens: 2048,
        });

        const rawResponse = completion.choices[0]?.message?.content || "";
        console.log(
          `[PhilanthropicSearch] AI scoring batch response (${batch.length} grants): ${rawResponse.substring(0, 200)}`
        );

        // Parse the JSON array
        const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed: AIScoreResult[] = JSON.parse(jsonMatch[0]);
          for (const item of parsed) {
            if (item.id && typeof item.score === "number") {
              resultMap.set(item.id, {
                score: Math.max(0, Math.min(100, item.score)),
                explanation: String(item.explanation || ""),
              });
            }
          }
          console.log(
            `[PhilanthropicSearch] AI scored ${resultMap.size} grants in batch ${Math.floor(batchStart / BATCH_SIZE) + 1}`
          );
        } else {
          console.warn("[PhilanthropicSearch] Could not parse AI scoring response as JSON array");
        }
      } catch (batchErr) {
        console.error("[PhilanthropicSearch] AI scoring batch failed:", batchErr);
        // Continue — will fall back to keyword scoring for unscored grants
      }
    }
  } catch (err) {
    console.error("[PhilanthropicSearch] AI scoring setup failed:", err);
  }

  return resultMap;
}

/* ═══════════════════════════════════════════════════════
   POST Handler
   ═══════════════════════════════════════════════════════ */

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Build search params for the orchestrator
    const keywords = buildKeywords(body);
    console.log(`[PhilanthropicSearch] Keywords (${keywords.length}): ${keywords.join(", ")}`);

    const searchParams: GrantSearchParams = {
      keywords,
      grantTypes: body.grantTypes || [],
      locationState: body.locationState || "",
      locationCity: body.locationCity || "",
      budgetMin: body.budgetMin ?? null,
      budgetMax: body.budgetMax ?? null,
      companyDescription: body.companyDescription || "",
      eligibilityType: body.eligibilityType || body.eligibilityTypes?.[0] || "nonprofit_501c3",
      // Pass new fields through to adapters
      serviceAreas: body.serviceAreas || [],
      populationsServed: body.populationsServed || [],
      fundingInstruments: body.fundingInstruments || [],
      fundingSources: body.fundingSources || [],
      geoScope: body.geoScope || "state",
      deadlineWindow: body.deadlineWindow || "any",
      eligibilityTypes: body.eligibilityTypes || [],
      orgBudget: body.orgBudget ?? null,
      orgStaffSize: body.orgStaffSize ?? null,
      orgSamUei: body.orgSamUei || "",
    };

    // 1. Call philanthropic orchestrator
    console.log("[PhilanthropicSearch] Calling philanthropic orchestrator...");
    let results: NormalizedGrant[];
    try {
      results = await searchPhilanthropicSources(searchParams);
      console.log(`[PhilanthropicSearch] Orchestrator returned ${results.length} results`);
    } catch (orchestratorErr) {
      console.error("[PhilanthropicSearch] Orchestrator failed:", orchestratorErr);
      results = [];
    }

    if (results.length === 0) {
      console.log("[PhilanthropicSearch] No results from any source");
      return NextResponse.json({
        results: [],
        sourceStats: {},
        totalFound: 0,
        scoringMethod: "none",
      });
    }

    // 2. Deduplicate by URL and title
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const deduped: NormalizedGrant[] = [];

    for (const r of results) {
      const normTitle = r.title.toLowerCase().trim();
      const url = r.sourceUrl || r.id || "";
      if (url && seenUrls.has(url)) continue;
      if (seenTitles.has(normTitle)) continue;
      if (url) seenUrls.add(url);
      seenTitles.add(normTitle);
      deduped.push(r);
    }

    console.log(`[PhilanthropicSearch] ${deduped.length} unique grants after dedup`);

    // 3. AI Relevance Scoring (batch)
    const aiScores = await batchAIRelevanceScore(deduped, {
      companyDescription: body.companyDescription,
      locationCity: body.locationCity,
      locationState: body.locationState,
      welfareKeywords: body.welfareKeywords,
      grantTypes: body.grantTypes,
      eligibilityType: body.eligibilityType,
      eligibilityTypes: body.eligibilityTypes,
      serviceAreas: body.serviceAreas,
      populationsServed: body.populationsServed,
      orgBudget: body.orgBudget ?? null,
      orgStaffSize: body.orgStaffSize ?? null,
      geoScope: body.geoScope || "state",
    });

    // Determine scoring method used
    const scoringMethod = aiScores.size > 0 ? "ai" : "keyword";

    // 4. Apply scores to grants — AI score takes priority, keyword fallback otherwise
    const scored = deduped.map((grant) => {
      const grantId = grant.id || "";
      const aiResult = aiScores.get(grantId);

      if (aiResult) {
        return {
          ...grant,
          relevanceScore: aiResult.score,
          relevanceExplanation: aiResult.explanation,
        };
      }

      // Fallback to keyword-based scoring
      const allKeywords = [
        ...(body.welfareKeywords || []),
        ...(body.serviceAreas ? getKeywordsForServiceAreas(body.serviceAreas).slice(0, 5) : []),
        ...(body.populationsServed ? getPopulationKeywords(body.populationsServed).slice(0, 3) : []),
      ];
      const fallbackScore = computeRelevanceScore(
        grant,
        body.companyDescription || "",
        allKeywords
      );
      return {
        ...grant,
        relevanceScore: fallbackScore,
        relevanceExplanation: "Scored by keyword matching (AI unavailable)",
      };
    });

    // 5. Filter out grants below minimum relevance threshold
    const MINIMUM_RELEVANCE_SCORE = 30;
    const preFilterCount = scored.length;
    const filtered = scored.filter((g) => (g.relevanceScore || 0) >= MINIMUM_RELEVANCE_SCORE);
    const filteredOutCount = preFilterCount - filtered.length;
    if (filteredOutCount > 0) {
      console.log(
        `[PhilanthropicSearch] Filtered out ${filteredOutCount} grants below relevance threshold (${MINIMUM_RELEVANCE_SCORE})`
      );
    }

    // 6. Sort by relevance score descending
    filtered.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    // 7. Compute source statistics
    const sourceStats: Record<string, number> = {};
    for (const grant of filtered) {
      const sources = grant.sources || ["unknown"];
      for (const src of sources) {
        sourceStats[src] = (sourceStats[src] || 0) + 1;
      }
    }

    const totalFound = filtered.length;

    console.log(`[PhilanthropicSearch] Final: ${totalFound} grants scored and sorted (${filteredOutCount} filtered out)`);
    console.log(`[PhilanthropicSearch] Source stats:`, sourceStats);
    console.log(
      `[PhilanthropicSearch] Top 3:`,
      filtered.slice(0, 3).map((m) => ({
        title: m.title,
        score: m.relevanceScore,
        sources: m.sources,
      }))
    );

    return NextResponse.json({
      results: filtered,
      grants: filtered,
      sourceStats,
      totalFound,
      scoringMethod,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PhilanthropicSearch] Route error:", err);
    return NextResponse.json(
      { error: message, results: [], grants: [], sourceStats: {}, totalFound: 0, scoringMethod: "none" },
      { status: 500 }
    );
  }
}
