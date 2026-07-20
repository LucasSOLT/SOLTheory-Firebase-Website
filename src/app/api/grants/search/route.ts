import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { Groq } from "groq-sdk";
import { searchAllSources } from "@/services/grant-sources/orchestrator";
import type { GrantSearchParams, NormalizedGrant } from "@/types/grants";
import { getKeywordsForServiceAreas, getCfdaCodesForServiceAreas } from "@/data/service-areas";
import { getPopulationKeywords } from "@/data/populations";

/**
 * POST /api/grants/search
 *
 * Multi-source grant search with AI relevance scoring.
 *
 * 1. Accepts full search params from the client
 * 2. Calls the orchestrator which fans out to Grants.gov, SAM.gov,
 *    state portals, and foundation databases
 * 3. Applies batch AI relevance scoring via Groq LLM
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
    console.log(`[GrantSearch] ${areaKeywords.length} keywords from ${body.serviceAreas.length} service areas`);
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

  // 3. Bonus for grants with close dates (more actionable)
  if (grant.closeDate) score += 5;

  // 4. Bonus for grants with opportunity numbers (verified listings)
  if (grant.opportunityNumber) score += 5;

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
   AI Relevance Scoring (Groq Batch)

   Sends up to 20 grants in a single LLM call for
   relevance scoring. Returns scores 0-100 with
   1-sentence explanations.
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
      console.warn("[GrantSearch] No GROQ_API_KEY set — skipping AI scoring");
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

      const prompt = `You are a grant relevance scorer for a nonprofit organization. Score each grant 0-100 for RELEVANCE to this search.

ORGANIZATION PROFILE:
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
1. GEOGRAPHIC MATCH is the #1 factor:
   - Grant specifically targets the user's city → +30 points
   - Grant targets the user's state → +20 points
   - National/federal grants available in user's state → +10 points
   - International-only, foreign-country, or wrong-country grants when user wants domestic → score 0
   - Grants limited to a different state or region than the user's → score 0-10 at most
2. CATEGORY/SERVICE AREA match: grant's purpose aligns with org's service areas → up to +25 points
   - Construction-only grants when org provides services (not construction) → score 0-10
   - Research-only grants when org does direct service delivery → score 0-10
3. POPULATION match: grant targets the same populations the org serves → +15 points
4. ELIGIBILITY match: grant accepts org's type → +15 points
   - Grant explicitly excludes org type (e.g., "for-profit only") → score 0
5. BUDGET/CAPACITY fit: grant's award range is reasonable for org's annual budget and staff size → +5 points
   - Grants requiring massive infrastructure for a small org → penalize
6. PENALIZE vague/generic descriptions that lack specific program details → -10 points
7. AUTOMATIC ZERO: Score exactly 0 for grants that are clearly irrelevant:
   - Foreign/international-only programs when user wants domestic funding
   - Construction/capital-only grants when user provides human services
   - Grants explicitly excluding the org's eligibility type
   - Grants for a completely unrelated field (e.g., agricultural research for a homeless shelter)

IMPORTANT: For the "explanation" field, be SPECIFIC about WHY you gave that score.
- BAD example: "This grant is somewhat relevant."
- GOOD example: "Federal homeless assistance grant matching org's housing focus; targets 501(c)(3) in user's state; serves veterans which aligns with populations served."
- GOOD example: "Score 0: This is an international development grant for African nations; user is a domestic nonprofit in Colorado."
Always mention which factors raised or lowered the score.

GRANTS TO SCORE:
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
          `[GrantSearch] AI scoring batch response (${batch.length} grants): ${rawResponse.substring(0, 200)}`
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
            `[GrantSearch] AI scored ${resultMap.size} grants in batch ${Math.floor(batchStart / BATCH_SIZE) + 1}`
          );
        } else {
          console.warn("[GrantSearch] Could not parse AI scoring response as JSON array");
        }
      } catch (batchErr) {
        console.error("[GrantSearch] AI scoring batch failed:", batchErr);
        // Continue — will fall back to keyword scoring for unscored grants
      }
    }
  } catch (err) {
    console.error("[GrantSearch] AI scoring setup failed:", err);
  }

  return resultMap;
}

/* ═══════════════════════════════════════════════════════
   POST Handler
   ═══════════════════════════════════════════════════════ */

export async function POST(request: Request) {
  const auth = await verifyRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    // Build search params for the orchestrator
    const keywords = buildKeywords(body);
    console.log(`[GrantSearch] Keywords (${keywords.length}): ${keywords.join(", ")}`);

    // Calculate closeDate from deadline window if set
    let effectiveCloseDate = body.closeDate || null;
    if (body.deadlineWindow && body.deadlineWindow !== "any" && body.deadlineWindow !== "custom") {
      const daysAhead = parseInt(body.deadlineWindow, 10);
      if (!isNaN(daysAhead)) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);
        effectiveCloseDate = futureDate.toISOString().split("T")[0];
        console.log(`[GrantSearch] Deadline window: ${daysAhead} days → closeDate=${effectiveCloseDate}`);
      }
    }

    const searchParams: GrantSearchParams = {
      keywords,
      grantTypes: body.grantTypes || [],
      locationState: body.locationState || "",
      locationCity: body.locationCity || "",
      budgetMin: body.budgetMin ?? null,
      budgetMax: body.budgetMax ?? null,
      openDate: body.openDate || null,
      closeDate: effectiveCloseDate,
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

    // 1. Call multi-source orchestrator
    console.log("[GrantSearch] Calling orchestrator for multi-source search...");
    let results: NormalizedGrant[];
    try {
      results = await searchAllSources(searchParams);
      console.log(`[GrantSearch] Orchestrator returned ${results.length} results`);
    } catch (orchestratorErr) {
      console.error("[GrantSearch] Orchestrator failed:", orchestratorErr);
      results = [];
    }

    if (results.length === 0) {
      console.log("[GrantSearch] No results from any source");
      return NextResponse.json({ grants: [], sourceStats: {} });
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

    console.log(`[GrantSearch] ${deduped.length} unique grants after dedup`);

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
        `[GrantSearch] Filtered out ${filteredOutCount} grants below relevance threshold (${MINIMUM_RELEVANCE_SCORE})`
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

    console.log(`[GrantSearch] Final: ${filtered.length} grants scored and sorted (${filteredOutCount} filtered out)`);
    console.log(`[GrantSearch] Source stats:`, sourceStats);
    console.log(
      `[GrantSearch] Top 3:`,
      filtered.slice(0, 3).map((m) => ({
        title: m.title,
        score: m.relevanceScore,
        sources: m.sources,
      }))
    );

    return NextResponse.json({ grants: filtered, sourceStats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GrantSearch] Route error:", err);
    return NextResponse.json({ error: message, grants: [], sourceStats: {} }, { status: 500 });
  }
}
