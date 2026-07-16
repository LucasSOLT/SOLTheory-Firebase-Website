// ============================================================================
// Candid (formerly Foundation Center / GuideStar) — STUB Adapter
// Requires: CANDID_API_KEY environment variable
//
// This is a placeholder. The real implementation will call Candid's
// foundation-grants API once credentials are provisioned.
// ============================================================================

import type {
  GrantSourceAdapter,
  GrantSearchParams,
  NormalizedGrant,
} from '@/types/grants';

const LOG_PREFIX = '[GrantSearch:Candid]';

export const candidAdapter: GrantSourceAdapter = {
  name: 'candid',

  isAvailable(): boolean {
    const hasKey = !!process.env.CANDID_API_KEY;
    if (!hasKey) {
      console.warn(
        `${LOG_PREFIX} CANDID_API_KEY not set — Candid adapter will be skipped`,
      );
    }
    return hasKey;
  },

  async search(params: GrantSearchParams): Promise<NormalizedGrant[]> {
    const apiKey = process.env.CANDID_API_KEY;
    if (!apiKey) {
      console.warn(
        `${LOG_PREFIX} Candid API key not configured — skipping`,
      );
      return [];
    }

    console.log(`${LOG_PREFIX} Starting search (stub) with params:`, {
      keywords: params.keywords,
      grantTypes: params.grantTypes,
    });

    // ──────────────────────────────────────────────────────────────────────
    // TODO: Real implementation steps
    //
    // 1. Call Candid's foundation-grants search endpoint:
    //    GET https://api.candid.org/grants/v1/...
    //    Headers: { 'Subscription-Key': apiKey }
    //
    // 2. Map params.keywords → Candid's `search_terms` or `keyword` param
    //
    // 3. Map params.grantTypes → Candid's subject/category codes
    //
    // 4. Map params.locationState → Candid's geographic filters
    //
    // 5. Map params.eligibilityType → Candid's recipient_type filter
    //
    // 6. Normalise each result into NormalizedGrant:
    //    - id: `candid_${result.grant_key}`
    //    - sources: ['candid']
    //    - title, description from result
    //    - agency from funder name
    //    - awardAmountMin/Max from result.amount (NEVER fabricate)
    //    - postedDate from result.grant_date
    //    - sourceUrl from result.grant_url or construct one
    //    - status: 'posted'
    //
    // 7. Return normalised array
    // ──────────────────────────────────────────────────────────────────────

    console.log(`${LOG_PREFIX} Stub returning empty results`);
    return [];
  },
};
