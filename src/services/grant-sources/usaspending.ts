// ============================================================================
// USAspending.gov Source Adapter
// Endpoint: POST https://api.usaspending.gov/api/v2/search/spending_by_award/
// No API key required.
// ============================================================================

import type {
  GrantSourceAdapter,
  GrantSearchParams,
  NormalizedGrant,
} from '@/types/grants';

const LOG_PREFIX = '[GrantSearch:USAspending]';
const API_URL =
  'https://api.usaspending.gov/api/v2/search/spending_by_award/';

// Grant & cooperative-agreement award type codes
const GRANT_AWARD_TYPES = ['02', '03', '04', '05'];
const MAX_RESULTS = 50;

// ── Raw API response shapes ─────────────────────────────────────────────────

interface USAspendingAward {
  internal_id?: number;
  'Award ID'?: string;
  'Award Amount'?: number;
  'Total Outlays'?: number;
  'Description'?: string;
  'Start Date'?: string;
  'End Date'?: string;
  'Awarding Agency'?: string;
  'Awarding Sub Agency'?: string;
  'Awarding Agency Code'?: string;
  'Recipient Name'?: string;
  'recipient_id'?: string;
  'Place of Performance State Code'?: string;
  'Place of Performance City Name'?: string;
  'Place of Performance Country Name'?: string;
  'Award Type'?: string;
  'generated_internal_id'?: string;
  'CFDA Number'?: string;
}

interface USAspendingResponse {
  results?: USAspendingAward[];
  limit?: number;
  page_metadata?: {
    page?: number;
    hasNext?: boolean;
    total?: number;
  };
}

// ── US State FIPS-to-abbreviation mapping for location filters ──────────────

const STATE_NAME_TO_FIPS: Record<string, string> = {
  AL: 'AL', AK: 'AK', AZ: 'AZ', AR: 'AR', CA: 'CA',
  CO: 'CO', CT: 'CT', DE: 'DE', FL: 'FL', GA: 'GA',
  HI: 'HI', ID: 'ID', IL: 'IL', IN: 'IN', IA: 'IA',
  KS: 'KS', KY: 'KY', LA: 'LA', ME: 'ME', MD: 'MD',
  MA: 'MA', MI: 'MI', MN: 'MN', MS: 'MS', MO: 'MO',
  MT: 'MT', NE: 'NE', NV: 'NV', NH: 'NH', NJ: 'NJ',
  NM: 'NM', NY: 'NY', NC: 'NC', ND: 'ND', OH: 'OH',
  OK: 'OK', OR: 'OR', PA: 'PA', RI: 'RI', SC: 'SC',
  SD: 'SD', TN: 'TN', TX: 'TX', UT: 'UT', VT: 'VT',
  VA: 'VA', WA: 'WA', WV: 'WV', WI: 'WI', WY: 'WY',
  DC: 'DC',
};

// ── Adapter ─────────────────────────────────────────────────────────────────

export const usaspendingAdapter: GrantSourceAdapter = {
  name: 'usaspending',

  isAvailable(): boolean {
    // No API key required
    return true;
  },

  async search(params: GrantSearchParams): Promise<NormalizedGrant[]> {
    console.log(`${LOG_PREFIX} Starting search with params:`, {
      keywords: params.keywords,
      state: params.locationState,
      budgetMin: params.budgetMin,
      budgetMax: params.budgetMax,
    });

    try {
      // Build filters array
      const filters: Record<string, unknown> = {
        award_type_codes: GRANT_AWARD_TYPES,
      };

      // Keyword filter
      if (params.keywords.length > 0) {
        filters.keywords = params.keywords;
      }

      // Recipient location (state)
      if (params.locationState) {
        const stateCode =
          STATE_NAME_TO_FIPS[params.locationState.toUpperCase()] ??
          params.locationState.toUpperCase();
        filters.recipient_locations = [
          {
            country: 'USA',
            state: stateCode,
          },
        ];
      }

      // Time period — use the last 2 years if no dates provided
      const now = new Date();
      const twoYearsAgo = new Date(now);
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      filters.time_period = [
        {
          start_date: params.openDate ?? twoYearsAgo.toISOString().slice(0, 10),
          end_date: params.closeDate ?? now.toISOString().slice(0, 10),
        },
      ];

      // Award amount range
      if (params.budgetMin != null || params.budgetMax != null) {
        const amountFilter: Record<string, number> = {};
        if (params.budgetMin != null) amountFilter.lower_bound = params.budgetMin;
        if (params.budgetMax != null) amountFilter.upper_bound = params.budgetMax;
        filters.award_amounts = [amountFilter];
      }

      const body = {
        filters,
        fields: [
          'Award ID',
          'Award Amount',
          'Total Outlays',
          'Description',
          'Start Date',
          'End Date',
          'Awarding Agency',
          'Awarding Sub Agency',
          'Awarding Agency Code',
          'Recipient Name',
          'Place of Performance State Code',
          'Place of Performance City Name',
          'Place of Performance Country Name',
          'Award Type',
          'CFDA Number',
          'generated_internal_id',
        ],
        limit: MAX_RESULTS,
        page: 1,
        sort: 'Award Amount',
        order: 'desc',
        subawards: false,
      };

      console.log(`${LOG_PREFIX} Sending request to USAspending API`);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.error(`${LOG_PREFIX} API returned ${response.status}`);
        return [];
      }

      const data: USAspendingResponse = await response.json();
      const results = data.results ?? [];

      console.log(
        `${LOG_PREFIX} Received ${results.length} awards (total: ${data.page_metadata?.total ?? '?'})`,
      );

      const grants: NormalizedGrant[] = [];

      for (const award of results) {
        const awardId = award['Award ID'] ?? award.generated_internal_id ?? '';
        const grantId = `usaspending_${awardId}`;

        // Determine scope from place-of-performance data
        const popCountry = award['Place of Performance Country Name'] ?? '';
        const popState = award['Place of Performance State Code'] ?? '';
        const popCity = award['Place of Performance City Name'] ?? '';

        let grantScope: NormalizedGrant['grantScope'] = 'national';
        if (
          popCountry &&
          popCountry.toUpperCase() !== 'UNITED STATES' &&
          popCountry.toUpperCase() !== 'USA' &&
          popCountry.toUpperCase() !== 'US'
        ) {
          grantScope = 'international';
        } else if (popCity) {
          grantScope = 'local';
        } else if (popState) {
          grantScope = 'state';
        }

        const awardAmount = award['Award Amount'] ?? null;

        const normalized: NormalizedGrant = {
          id: grantId,
          sources: ['usaspending'],
          title: award['Description'] ?? 'USAspending Award',
          description: award['Description'] ?? '',
          agency: award['Awarding Agency'] ?? award['Awarding Sub Agency'] ?? 'Unknown Agency',
          agencyCode: award['Awarding Agency Code'],
          opportunityNumber: awardId,

          // Financials — use actual award data, never fabricate
          awardAmountMin: awardAmount,
          awardAmountMax: awardAmount,
          estimatedTotalFunding: awardAmount,

          // Dates
          postedDate: award['Start Date'] ?? undefined,
          closeDate: award['End Date'] ?? undefined,

          // Classification
          categories: award['Award Type'] ? [award['Award Type']] : [],
          categoryCodes: award['CFDA Number'] ? [award['CFDA Number']] : [],
          eligibleApplicants: [],
          fundingInstrument: award['Award Type'],

          // Geography
          grantScope,
          targetState: popState || undefined,
          targetCity: popCity || undefined,
          placeOfPerformance: [popCity, popState, popCountry]
            .filter(Boolean)
            .join(', ') || undefined,

          // Links
          sourceUrl: `https://www.usaspending.gov/award/${award.generated_internal_id ?? awardId}`,

          // These are past awards, so treat as 'posted' for reference
          status: 'posted',
        };

        grants.push(normalized);
      }

      console.log(`${LOG_PREFIX} Normalised ${grants.length} grants`);
      return grants;
    } catch (error) {
      console.error(`${LOG_PREFIX} Error during search:`, error);
      return [];
    }
  },
};
