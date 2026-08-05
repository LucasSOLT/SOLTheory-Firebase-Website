// ============================================================================
// Grants.gov Source Adapter (Simpler Grants API)
// Endpoint: POST https://api.simpler.grants.gov/v1/opportunities/search
// Requires: SIMPLER_GRANTS_API_KEY environment variable
// ============================================================================

import type {
  GrantSourceAdapter,
  GrantSearchParams,
  NormalizedGrant,
} from '@/types/grants';
import { isInternationalGrant } from './filters';

const LOG_PREFIX = '[GrantSearch:GrantsGov]';
const API_URL = 'https://api.simpler.grants.gov/v1/opportunities/search';
const MAX_RESULTS_PER_KEYWORD = 50;
const MAX_KEYWORDS = 5;

// ── Simpler Grants API response shapes ──────────────────────────────────────

interface SimplerGrantsSummary {
  summary_description?: string | null;
  award_floor?: number | null;
  award_ceiling?: number | null;
  estimated_total_program_funding?: number | null;
  expected_number_of_awards?: number | null;
  post_date?: string | null;
  close_date?: string | null;
  archive_date?: string | null;
  is_forecast?: boolean;
  is_cost_sharing?: boolean | null;
  applicant_types?: string[];
  applicant_eligibility_description?: string | null;
  funding_categories?: string[];
  funding_category_description?: string | null;
  funding_instruments?: string[];
  additional_info_url?: string | null;
  additional_info_url_description?: string | null;
}

interface SimplerGrantsHit {
  opportunity_id?: string;
  opportunity_number?: string | null;
  opportunity_title?: string | null;
  opportunity_status?: string;
  agency_code?: string | null;
  agency_name?: string | null;
  top_level_agency_name?: string | null;
  legacy_opportunity_id?: number | null;
  opportunity_assistance_listings?: Array<{
    assistance_listing_number?: string | null;
    program_title?: string | null;
  }>;
  summary?: SimplerGrantsSummary;
}

interface SimplerGrantsResponse {
  data?: SimplerGrantsHit[];
  pagination_info?: {
    total_records?: number;
    total_pages?: number;
  };
  message?: string;
  status_code?: number;
}

// ── Map our internal eligibility types to Simpler Grants applicant_type enums ─
const ELIGIBILITY_TO_APPLICANT_TYPE: Record<string, string> = {
  nonprofit_501c3: 'nonprofits_non_higher_education_with_501c3',
  nonprofit_non501c3: 'nonprofits_non_higher_education_without_501c3',
  for_profit: 'for_profit_organizations_other_than_small_businesses',
  small_business: 'small_businesses',
  state_government: 'state_governments',
  county_government: 'county_governments',
  city_government: 'city_or_township_governments',
  tribal_government: 'federally_recognized_native_american_tribal_governments',
  higher_education_public: 'public_and_state_institutions_of_higher_education',
  higher_education_private: 'private_institutions_of_higher_education',
  individual: 'individuals',
  housing_authority: 'public_and_indian_housing_authorities',
  special_district: 'special_district_governments',
  school_district: 'independent_school_districts',
  unrestricted: 'unrestricted',
};

// ── Map our internal grant types to Simpler Grants funding_category enums ───
const CATEGORY_TO_FUNDING_CATEGORY: Record<string, string> = {
  housing_shelter: 'housing',
  health_services: 'health',
  education: 'education',
  community_development: 'community_development',
  income_security: 'income_security_and_social_services',
  food_nutrition: 'food_and_nutrition',
  disaster_relief: 'disaster_prevention_and_relief',
  employment: 'employment_labor_and_training',
  environment: 'environment',
  energy: 'energy',
  transportation: 'transportation',
  arts_culture: 'arts',
  agriculture: 'agriculture',
  science_research: 'science_technology_and_other_research_and_development',
  law_justice: 'law_justice_and_legal_services',
  regional_development: 'regional_development',
  business_commerce: 'business_and_commerce',
  consumer_protection: 'consumer_protection',
  humanities: 'humanities',
  natural_resources: 'natural_resources',
  information_statistics: 'information_and_statistics',
};

// ── Map our internal funding instrument types to Simpler Grants enums ────────
const INSTRUMENT_TO_FUNDING_INSTRUMENT: Record<string, string> = {
  grant: 'grant',
  cooperative_agreement: 'cooperative_agreement',
  procurement_contract: 'procurement_contract',
  other: 'other',
};

// ── Adapter ─────────────────────────────────────────────────────────────────

export const grantsGovAdapter: GrantSourceAdapter = {
  name: 'grants.gov',

  isAvailable(): boolean {
    const hasKey = !!process.env.SIMPLER_GRANTS_API_KEY;
    if (!hasKey) {
      console.warn(
        `${LOG_PREFIX} SIMPLER_GRANTS_API_KEY not set — grants.gov adapter will be skipped`,
      );
    }
    return hasKey;
  },

  async search(params: GrantSearchParams): Promise<NormalizedGrant[]> {
    console.log(`${LOG_PREFIX} Starting search with params:`, {
      keywords: params.keywords,
      grantTypes: params.grantTypes,
      eligibilityTypes: params.eligibilityTypes,
      fundingInstruments: params.fundingInstruments,
      geoScope: params.geoScope,
      state: params.locationState,
    });

    const apiKey = process.env.SIMPLER_GRANTS_API_KEY!;

    // Build applicant_type filter from eligibility types
    const applicantTypes: string[] = [];
    if (params.eligibilityTypes && params.eligibilityTypes.length > 0) {
      for (const et of params.eligibilityTypes) {
        const mapped = ELIGIBILITY_TO_APPLICANT_TYPE[et];
        if (mapped && !applicantTypes.includes(mapped)) applicantTypes.push(mapped);
      }
    } else if (params.eligibilityType) {
      const mapped = ELIGIBILITY_TO_APPLICANT_TYPE[params.eligibilityType];
      if (mapped) applicantTypes.push(mapped);
    }

    // Build funding_category filter from grant types
    const fundingCategories: string[] = [];
    for (const gt of params.grantTypes) {
      const mapped = CATEGORY_TO_FUNDING_CATEGORY[gt];
      if (mapped && !fundingCategories.includes(mapped)) fundingCategories.push(mapped);
    }

    // Build funding_instrument filter
    const fundingInstruments: string[] = [];
    if (params.fundingInstruments && params.fundingInstruments.length > 0) {
      for (const fi of params.fundingInstruments) {
        const mapped = INSTRUMENT_TO_FUNDING_INSTRUMENT[fi];
        if (mapped && !fundingInstruments.includes(mapped)) fundingInstruments.push(mapped);
      }
    }

    // Build filter object
    const filters: Record<string, unknown> = {
      opportunity_status: { one_of: ['posted'] },
    };
    if (applicantTypes.length > 0) {
      filters.applicant_type = { one_of: applicantTypes };
    }
    if (fundingCategories.length > 0) {
      filters.funding_category = { one_of: fundingCategories };
    }
    if (fundingInstruments.length > 0) {
      filters.funding_instrument = { one_of: fundingInstruments };
    }
    // Budget filters
    if (params.budgetMin != null || params.budgetMax != null) {
      if (params.budgetMax != null) {
        filters.award_ceiling = { min: params.budgetMin ?? 0, max: params.budgetMax };
      }
      if (params.budgetMin != null) {
        filters.award_floor = { min: params.budgetMin };
      }
    }

    // Search once per keyword (up to MAX_KEYWORDS) and merge results
    const keywords = params.keywords.slice(0, MAX_KEYWORDS);
    if (keywords.length === 0) {
      keywords.push('grant'); // default broad query
    }

    const allResults: NormalizedGrant[] = [];
    const seenIds = new Set<string>();

    for (const keyword of keywords) {
      try {
        const body: Record<string, unknown> = {
          query: keyword,
          query_operator: 'OR',
          filters,
          pagination: {
            page_offset: 1,
            page_size: MAX_RESULTS_PER_KEYWORD,
            sort_order: [
              { order_by: 'relevancy', sort_direction: 'descending' },
            ],
          },
        };

        console.log(`${LOG_PREFIX} Searching query="${keyword}"`, JSON.stringify(body).slice(0, 500));

        let response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          console.error(
            `${LOG_PREFIX} API returned ${response.status} for query="${keyword}":`, errText.slice(0, 300),
          );
          continue;
        }

        let data: SimplerGrantsResponse = await response.json();
        let hits = data.data ?? [];

        // If 0 results with strict filters, retry without category filter (broader search)
        if (hits.length === 0 && fundingCategories.length > 0) {
          console.log(`${LOG_PREFIX} 0 results with category filter — retrying broader for "${keyword}"`);
          const broaderFilters = { ...filters };
          delete broaderFilters.funding_category;
          const broaderBody = { ...body, filters: broaderFilters };
          const retryResp = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
            },
            body: JSON.stringify(broaderBody),
          });
          if (retryResp.ok) {
            data = await retryResp.json();
            hits = data.data ?? [];
            console.log(`${LOG_PREFIX} Broader search found ${hits.length} hits for "${keyword}"`);
          }
        }

        console.log(
          `${LOG_PREFIX} Received ${hits.length} hits for query="${keyword}" (total: ${data.pagination_info?.total_records ?? '?'})`,
        );

        for (const hit of hits) {
          const grantId = `grantsgov_${hit.opportunity_id ?? hit.legacy_opportunity_id ?? ''}`;
          if (seenIds.has(grantId)) continue;
          seenIds.add(grantId);

          const title = hit.opportunity_title ?? 'Untitled Opportunity';
          const description = hit.summary?.summary_description ?? '';

          // Detect international scope from content
          const international = isInternationalGrant(title, description);

          // Extract assistance listing (CFDA) numbers
          const categoryCodes = (hit.opportunity_assistance_listings ?? [])
            .map((al) => al.assistance_listing_number ?? '')
            .filter(Boolean);

          const normalized: NormalizedGrant = {
            id: grantId,
            sources: ['grants.gov'],
            title,
            description,
            agency: hit.agency_name ?? hit.top_level_agency_name ?? 'Unknown Agency',
            agencyCode: hit.agency_code ?? undefined,
            opportunityNumber: hit.opportunity_number ?? undefined,

            // Financials — NEVER fabricate
            awardAmountMin: hit.summary?.award_floor ?? null,
            awardAmountMax: hit.summary?.award_ceiling ?? null,
            estimatedTotalFunding: hit.summary?.estimated_total_program_funding ?? null,

            // Dates (already ISO format from Simpler Grants)
            postedDate: hit.summary?.post_date ?? undefined,
            closeDate: hit.summary?.close_date ?? undefined,
            archiveDate: hit.summary?.archive_date ?? undefined,

            // Classification
            categories: hit.summary?.funding_categories ?? [],
            categoryCodes,
            eligibleApplicants: hit.summary?.applicant_types ?? [],
            fundingInstrument: hit.summary?.funding_instruments?.[0] ?? undefined,

            // Geography
            grantScope: international ? 'international' : 'national',
            targetState: params.locationState,
            targetCity: params.locationCity,

            // Links
            applicationUrl: hit.summary?.additional_info_url ?? undefined,
            sourceUrl: `https://www.grants.gov/search-results-detail/${hit.legacy_opportunity_id ?? hit.opportunity_id ?? ''}`,

            // Status
            status: (hit.opportunity_status as 'posted' | 'forecasted' | 'closed' | 'archived') ?? 'posted',
          };

          allResults.push(normalized);
        }
      } catch (error) {
        console.error(
          `${LOG_PREFIX} Error searching query="${keyword}":`,
          error,
        );
        // Graceful fallback — continue with remaining keywords
      }
    }

    console.log(
      `${LOG_PREFIX} Search complete — ${allResults.length} total results`,
    );
    return allResults;
  },
};
