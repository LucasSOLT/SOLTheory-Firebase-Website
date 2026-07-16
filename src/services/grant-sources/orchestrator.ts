// ============================================================================
// Grant Search Orchestrator
// Coordinates all source adapters, deduplicates, and applies Stage 2 filters.
// ============================================================================

import type {
  GrantSourceAdapter,
  GrantSearchParams,
  NormalizedGrant,
} from '@/types/grants';
import { grantsGovAdapter } from './grants-gov';
import { usaspendingAdapter } from './usaspending';
import { samGovAdapter } from './sam-gov';
import { candidAdapter } from './candid';
import {
  isInternationalGrant,
  isWithinBudgetRange,
  isWithinDateRange,
} from './filters';

const LOG_PREFIX = '[GrantSearch:Orchestrator]';

// All registered adapters
const ALL_ADAPTERS: GrantSourceAdapter[] = [
  grantsGovAdapter,
  usaspendingAdapter,
  samGovAdapter,
  candidAdapter,
];

// ── Title normalisation for dedup ───────────────────────────────────────────

/**
 * Strip a title down to a normalised key for fuzzy duplicate detection.
 * Removes punctuation, extra whitespace, and lowercases everything.
 */
function normaliseTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')   // remove special chars
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim();
}

/**
 * Simple similarity check: two titles are considered duplicates if their
 * normalised forms are identical OR if one is a substring of the other
 * (and the shorter one is at least 60% of the longer one's length).
 */
function areTitlesSimilar(a: string, b: string): boolean {
  const na = normaliseTitleKey(a);
  const nb = normaliseTitleKey(b);

  if (na === nb) return true;

  // Substring containment with length ratio check
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length > nb.length ? na : nb;

  if (shorter.length === 0) return false;

  const ratio = shorter.length / longer.length;
  if (ratio >= 0.6 && longer.includes(shorter)) {
    return true;
  }

  return false;
}

// ── International exclusion keywords (for Stage 2 geo filter) ───────────────

const GEO_EXCLUSION_KEYWORDS = [
  'us mission to',
  'usaid',
  'overseas',
  'foreign',
  'embassy',
  'international development',
];

// ── US state abbreviations → names (for detecting other-state grants) ───────
const US_STATE_ABBREVIATIONS: Record<string, string> = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california',
  CO: 'colorado', CT: 'connecticut', DE: 'delaware', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa',
  KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland',
  MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi',
  MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new hampshire',
  NJ: 'new jersey', NM: 'new mexico', NY: 'new york', NC: 'north carolina',
  ND: 'north dakota', OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania',
  RI: 'rhode island', SC: 'south carolina', SD: 'south dakota', TN: 'tennessee',
  TX: 'texas', UT: 'utah', VT: 'vermont', VA: 'virginia', WA: 'washington',
  WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming', DC: 'district of columbia',
};

function shouldExcludeGeographically(
  grant: NormalizedGrant,
  locationState?: string,
  locationCity?: string,
  geoScope?: string,
): boolean {
  // Nationwide scope: no geographic filtering at all
  if (geoScope === 'nationwide') return false;

  // Only apply geographic exclusion if user specified a US location
  if (!locationState && !locationCity) return false;

  // Exclude grants explicitly scoped as international
  if (grant.grantScope === 'international') return true;

  // Check title + description for geo-exclusion keywords
  const combined = `${grant.title} ${grant.description}`.toLowerCase();
  for (const keyword of GEO_EXCLUSION_KEYWORDS) {
    if (combined.includes(keyword)) {
      return true;
    }
  }

  // Also run the broader international detection
  if (isInternationalGrant(grant.title, grant.description)) {
    return true;
  }

  return false;
}

// ── Core orchestrator function ──────────────────────────────────────────────

/**
 * Search all available grant sources in parallel, merge, deduplicate,
 * and apply Stage 2 post-fetch filters.
 */
export async function searchAllSources(
  params: GrantSearchParams,
): Promise<NormalizedGrant[]> {
  console.log(`${LOG_PREFIX} ── Starting multi-source grant search ──`);
  console.log(`${LOG_PREFIX} Params:`, JSON.stringify(params, null, 2));

  // Map UI source IDs to adapter names
  const SOURCE_TO_ADAPTER: Record<string, string[]> = {
    federal: ['grants.gov', 'sam.gov'],
    federal_subawards: ['usaspending'],
    foundation: ['candid'],
    // state, corporate — no adapters yet
  };

  // ── Step 1: Determine available adapters ──────────────────────────────
  const selectedSources = params.fundingSources?.length
    ? params.fundingSources
    : ['federal', 'federal_subawards']; // default: all federal

  const allowedAdapterNames = new Set<string>();
  for (const src of selectedSources) {
    const names = SOURCE_TO_ADAPTER[src];
    if (names) names.forEach((n) => allowedAdapterNames.add(n));
  }

  const availableAdapters = ALL_ADAPTERS.filter((adapter) => {
    // Check API key availability
    const available = adapter.isAvailable();
    // Check user's source selection
    const selected = allowedAdapterNames.has(adapter.name);
    if (!available) {
      console.log(`${LOG_PREFIX} Adapter "${adapter.name}": ✗ unavailable (no API key)`);
    } else if (!selected) {
      console.log(`${LOG_PREFIX} Adapter "${adapter.name}": ✗ excluded by fundingSources filter`);
    } else {
      console.log(`${LOG_PREFIX} Adapter "${adapter.name}": ✓ available & selected`);
    }
    return available && selected;
  });

  if (availableAdapters.length === 0) {
    console.warn(`${LOG_PREFIX} No adapters available — returning empty results`);
    return [];
  }

  console.log(
    `${LOG_PREFIX} Running ${availableAdapters.length} adapter(s) in parallel: ${availableAdapters.map((a) => a.name).join(', ')}`,
  );

  // ── Step 2: Fetch from all sources in parallel ────────────────────────
  const settledResults = await Promise.allSettled(
    availableAdapters.map((adapter) =>
      adapter.search(params).then((results) => ({
        source: adapter.name,
        results,
      })),
    ),
  );

  // Collect all successful results
  const allGrants: NormalizedGrant[] = [];
  for (const result of settledResults) {
    if (result.status === 'fulfilled') {
      console.log(
        `${LOG_PREFIX} "${result.value.source}" returned ${result.value.results.length} grants`,
      );
      allGrants.push(...result.value.results);
    } else {
      console.error(
        `${LOG_PREFIX} An adapter failed:`,
        result.reason,
      );
    }
  }

  console.log(
    `${LOG_PREFIX} Total raw results across all sources: ${allGrants.length}`,
  );

  // ── Step 3: Deduplicate ───────────────────────────────────────────────
  const deduped = deduplicateGrants(allGrants);
  console.log(
    `${LOG_PREFIX} After deduplication: ${deduped.length} grants (removed ${allGrants.length - deduped.length} duplicates)`,
  );

  // ── Step 4: Stage 2 filtering ─────────────────────────────────────────
  const filtered = applyStage2Filters(deduped, params);
  console.log(
    `${LOG_PREFIX} After Stage 2 filters: ${filtered.length} grants (excluded ${deduped.length - filtered.length})`,
  );

  console.log(`${LOG_PREFIX} ── Search complete ──`);
  return filtered;
}

// ── Deduplication ───────────────────────────────────────────────────────────

/**
 * Deduplicate grants by comparing normalised titles.
 * When duplicates are found across different sources, merge their `sources`
 * arrays and keep the record with richer data.
 */
function deduplicateGrants(grants: NormalizedGrant[]): NormalizedGrant[] {
  const uniqueMap = new Map<string, NormalizedGrant>();

  for (const grant of grants) {
    const key = normaliseTitleKey(grant.title);
    let merged = false;

    // Check existing entries for similarity
    for (const [existingKey, existingGrant] of Array.from(uniqueMap.entries())) {
      if (areTitlesSimilar(grant.title, existingGrant.title)) {
        // Merge sources
        const mergedSources = new Set([
          ...existingGrant.sources,
          ...grant.sources,
        ]);
        existingGrant.sources = Array.from(mergedSources);

        // Keep richer data — prefer the record with more populated fields
        if (richness(grant) > richness(existingGrant)) {
          // Keep the new grant's core data but preserve merged sources
          const sources = existingGrant.sources;
          uniqueMap.set(existingKey, { ...grant, sources });
        }

        merged = true;
        break;
      }
    }

    if (!merged) {
      uniqueMap.set(key, grant);
    }
  }

  return Array.from(uniqueMap.values());
}

/** Score how "rich" a grant record is (more filled fields = higher score) */
function richness(grant: NormalizedGrant): number {
  let score = 0;
  if (grant.description && grant.description.length > 50) score += 2;
  if (grant.awardAmountMax != null) score += 1;
  if (grant.awardAmountMin != null) score += 1;
  if (grant.estimatedTotalFunding != null) score += 1;
  if (grant.closeDate) score += 1;
  if (grant.postedDate) score += 1;
  if (grant.applicationUrl) score += 1;
  if (grant.categories.length > 0) score += 1;
  if (grant.eligibleApplicants.length > 0) score += 1;
  if (grant.placeOfPerformance) score += 1;
  return score;
}

// ── Stage 2 Filters ─────────────────────────────────────────────────────────

function applyStage2Filters(
  grants: NormalizedGrant[],
  params: GrantSearchParams,
): NormalizedGrant[] {
  const geoScope = params.geoScope;
  const userState = params.locationState?.toUpperCase();
  const userStateName = userState ? (US_STATE_ABBREVIATIONS[userState] ?? userState.toLowerCase()) : undefined;
  const userCity = params.locationCity?.toLowerCase();

  // Build a set of "other state" names to detect competing-state grants
  const otherStateNames = new Set<string>();
  if (userState && (geoScope === 'local' || geoScope === 'metro' || geoScope === 'state')) {
    for (const [abbr, name] of Object.entries(US_STATE_ABBREVIATIONS)) {
      if (abbr !== userState) {
        otherStateNames.add(name);
      }
    }
  }

  /** Calculate a relevance boost score for geographic affinity */
  function geoRelevanceScore(grant: NormalizedGrant): number {
    let score = 0;
    const titleLower = grant.title.toLowerCase();
    const descLower = (grant.description ?? '').toLowerCase();

    // Boost for matching user's state
    if (userStateName) {
      if (titleLower.includes(userStateName)) score += 3;
      else if (descLower.includes(userStateName)) score += 1;
    }
    if (userState && userState.length === 2) {
      // Check for state abbreviation in title (e.g. "TX", "CA")
      const abbrPattern = new RegExp(`\\b${userState}\\b`, 'i');
      if (abbrPattern.test(grant.title)) score += 2;
    }

    // Boost for matching user's city
    if (userCity) {
      if (titleLower.includes(userCity)) score += 4;
      else if (descLower.includes(userCity)) score += 2;
    }

    // Penalty for mentioning OTHER states in the title (local/metro only)
    if (otherStateNames.size > 0) {
      for (const otherState of otherStateNames) {
        // Only check longer names to avoid false positives
        if (otherState.length >= 5 && titleLower.includes(otherState)) {
          score -= 2;
          break; // one penalty is enough
        }
      }
    }

    return score;
  }

  // First pass: hard filters (international exclusion, budget, dates)
  const passedHardFilters = grants.filter((grant) => {
    // ── Geographic exclusion (international/foreign only) ──────────────
    if (
      shouldExcludeGeographically(
        grant,
        params.locationState,
        params.locationCity,
        geoScope,
      )
    ) {
      console.log(
        `${LOG_PREFIX} [Filter:Geo] Excluding "${grant.title.slice(0, 60)}…" (international/foreign)`,
      );
      return false;
    }

    // ── Budget range ────────────────────────────────────────────────────
    if (!isWithinBudgetRange(grant, params.budgetMin, params.budgetMax)) {
      console.log(
        `${LOG_PREFIX} [Filter:Budget] Excluding "${grant.title.slice(0, 60)}…" (out of range)`,
      );
      return false;
    }

    // ── Date range ──────────────────────────────────────────────────────
    if (!isWithinDateRange(grant, params.openDate, params.closeDate)) {
      console.log(
        `${LOG_PREFIX} [Filter:Date] Excluding "${grant.title.slice(0, 60)}…" (outside date window)`,
      );
      return false;
    }

    return true;
  });

  // Second pass: score and sort by geographic relevance
  // (deprioritises other-state grants without excluding them)
  if (geoScope !== 'nationwide' && (userState || userCity)) {
    const scored = passedHardFilters.map((grant) => ({
      grant,
      geoScore: geoRelevanceScore(grant),
    }));

    // Stable sort: higher geoScore first
    scored.sort((a, b) => b.geoScore - a.geoScore);

    console.log(
      `${LOG_PREFIX} [GeoRelevance] Sorted ${scored.length} grants by geographic affinity` +
        ` (top score: ${scored[0]?.geoScore ?? 0}, bottom: ${scored[scored.length - 1]?.geoScore ?? 0})`,
    );

    return scored.map((s) => s.grant);
  }

  return passedHardFilters;
}
