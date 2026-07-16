// ============================================================================
// Philanthropic Grant Search Orchestrator
// Coordinates private/foundation source adapters for non-government grants.
// Mirrors the federal orchestrator but uses different adapters.
// ============================================================================

import type {
  GrantSourceAdapter,
  GrantSearchParams,
  NormalizedGrant,
} from '@/types/grants';
import { propublicaAdapter } from './propublica';
import { candidAdapter } from './candid';

const LOG_PREFIX = '[GrantSearch:PhilanthropicOrchestrator]';

// All registered philanthropic adapters
const PHILANTHROPIC_ADAPTERS: GrantSourceAdapter[] = [
  propublicaAdapter,
  candidAdapter,
];

// ── Title normalisation for dedup ───────────────────────────────────────────

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesAreSimilar(a: string, b: string): boolean {
  const na = normaliseTitle(a);
  const nb = normaliseTitle(b);
  if (na === nb) return true;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length >= nb.length ? na : nb;
  if (shorter.length / longer.length < 0.6) return false;
  return longer.includes(shorter) || shorter.includes(longer);
}

// ── Core orchestrator function ──────────────────────────────────────────────

/**
 * Search all available philanthropic sources in parallel, merge, and deduplicate.
 */
export async function searchPhilanthropicSources(
  params: GrantSearchParams,
): Promise<NormalizedGrant[]> {
  console.log(`${LOG_PREFIX} ── Starting philanthropic grant search ──`);
  console.log(`${LOG_PREFIX} Params:`, JSON.stringify({
    keywords: params.keywords?.slice(0, 5),
    state: params.locationState,
    geoScope: params.geoScope,
    serviceAreas: params.serviceAreas?.slice(0, 5),
  }, null, 2));

  // ── Step 1: Determine available adapters ──────────────────────────────
  const selectedSources = params.fundingSources?.length
    ? params.fundingSources
    : ['foundation']; // default: foundations

  const SOURCE_TO_ADAPTER: Record<string, string[]> = {
    foundation: ['propublica', 'candid'],
    corporate: [], // future
  };

  const allowedAdapterNames = new Set<string>();
  for (const src of selectedSources) {
    const names = SOURCE_TO_ADAPTER[src];
    if (names) names.forEach((n) => allowedAdapterNames.add(n));
  }
  // Always include propublica for philanthropic searches
  allowedAdapterNames.add('propublica');

  const availableAdapters = PHILANTHROPIC_ADAPTERS.filter((adapter) => {
    const available = adapter.isAvailable();
    const selected = allowedAdapterNames.has(adapter.name);
    if (!available) {
      console.log(`${LOG_PREFIX} Adapter "${adapter.name}": ✗ unavailable`);
    } else if (!selected) {
      console.log(`${LOG_PREFIX} Adapter "${adapter.name}": ✗ excluded`);
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
    `${LOG_PREFIX} Running ${availableAdapters.length} adapter(s): ${availableAdapters.map((a) => a.name).join(', ')}`,
  );

  // ── Step 2: Fetch from all sources in parallel ────────────────────────
  const settledResults = await Promise.allSettled(
    availableAdapters.map((adapter) =>
      adapter.search(params).then((results) => ({
        name: adapter.name,
        results,
      })),
    ),
  );

  const allResults: NormalizedGrant[] = [];
  for (const settled of settledResults) {
    if (settled.status === 'fulfilled') {
      const { name, results } = settled.value;
      console.log(`${LOG_PREFIX} "${name}" returned ${results.length} results`);
      allResults.push(...results);
    } else {
      console.error(`${LOG_PREFIX} Adapter failed:`, settled.reason);
    }
  }

  console.log(`${LOG_PREFIX} Total raw results: ${allResults.length}`);

  // ── Step 2b: Validate results — reject empty/dead foundations ──────────
  const validated = allResults.filter((grant) => {
    if (!grant.title || grant.title.trim().length === 0) {
      console.log(`${LOG_PREFIX} Rejected: empty title`);
      return false;
    }
    if (!grant.sourceUrl || grant.sourceUrl.trim().length === 0) {
      console.log(`${LOG_PREFIX} Rejected "${grant.title}": no source URL`);
      return false;
    }
    // Reject foundations with zero assets AND zero giving — likely defunct
    const hasAssets = grant.estimatedTotalFunding && grant.estimatedTotalFunding > 0;
    const hasGiving = grant.awardAmountMax && grant.awardAmountMax > 0;
    if (!hasAssets && !hasGiving) {
      console.log(`${LOG_PREFIX} Rejected "${grant.title}": zero assets and zero giving`);
      return false;
    }
    return true;
  });

  const rejected = allResults.length - validated.length;
  if (rejected > 0) {
    console.log(`${LOG_PREFIX} Rejected ${rejected} invalid/dead foundations`);
  }

  // ── Step 3: Deduplicate by title similarity ───────────────────────────
  const deduped: NormalizedGrant[] = [];
  for (const grant of validated) {
    const existing = deduped.find((d) => titlesAreSimilar(d.title, grant.title));
    if (existing) {
      // Merge sources
      const newSources = grant.sources.filter((s) => !existing.sources.includes(s));
      existing.sources.push(...newSources);
    } else {
      deduped.push(grant);
    }
  }

  const removedDupes = validated.length - deduped.length;
  if (removedDupes > 0) {
    console.log(`${LOG_PREFIX} Removed ${removedDupes} duplicates`);
  }

  // ── Step 4: Sort by estimated giving capacity ─────────────────────────
  deduped.sort((a, b) => {
    const aAssets = a.estimatedTotalFunding || 0;
    const bAssets = b.estimatedTotalFunding || 0;
    return bAssets - aAssets; // Largest foundations first
  });

  console.log(`${LOG_PREFIX} ── Search complete — ${deduped.length} results ──`);
  return deduped;
}
