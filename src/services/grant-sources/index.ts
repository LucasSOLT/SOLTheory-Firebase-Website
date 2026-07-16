// ============================================================================
// Grant Sources — Barrel Export
// ============================================================================

// ── Types (re-exported for convenience) ─────────────────────────────────────
export type {
  NormalizedGrant,
  GrantSource,
  GrantSearchParams,
  GrantSourceAdapter,
} from '@/types/grants';

export {
  GRANTS_GOV_CATEGORY_MAP,
  GRANTS_GOV_ELIGIBILITY_MAP,
} from '@/types/grants';

// ── Individual adapters ─────────────────────────────────────────────────────
export { grantsGovAdapter } from './grants-gov';
export { usaspendingAdapter } from './usaspending';
export { samGovAdapter } from './sam-gov';
export { candidAdapter } from './candid';

// ── Orchestrator ────────────────────────────────────────────────────────────
export { searchAllSources } from './orchestrator';

// ── Filter utilities ────────────────────────────────────────────────────────
export {
  isInternationalGrant,
  isWithinBudgetRange,
  isWithinDateRange,
  INTERNATIONAL_KEYWORDS,
  FOREIGN_COUNTRY_NAMES,
} from './filters';
