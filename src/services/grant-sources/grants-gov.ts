// ============================================================================
// Grants.gov Source Adapter
// Endpoint: POST https://api.grants.gov/v1/api/search2
// No API key required.
// ============================================================================

import type {
  GrantSourceAdapter,
  GrantSearchParams,
  NormalizedGrant,
} from '@/types/grants';
import {
  GRANTS_GOV_CATEGORY_MAP,
  GRANTS_GOV_ELIGIBILITY_MAP,
} from '@/types/grants';
import { isInternationalGrant } from './filters';

// ── Grants.gov funding instrument type codes ────────────────────────────────
const FUNDING_INSTRUMENT_MAP: Record<string, string> = {
  grant: 'G',
  cooperative_agreement: 'CA',
  procurement_contract: 'PC',
  other: 'O',
};

const LOG_PREFIX = '[GrantSearch:GrantsGov]';
const API_URL = 'https://api.grants.gov/v1/api/search2';
const MAX_RESULTS_PER_KEYWORD = 50; // keep payloads manageable
const MAX_KEYWORDS = 5;

// ── Raw Grants.gov API response shapes ──────────────────────────────────────

interface GrantsGovHit {
  id?: number;
  number?: string;            // opportunity number
  title?: string;
  synopsis?: string;
  agencyName?: string;
  agencyCode?: string;
  openDate?: string;          // MM/DD/YYYY
  closeDate?: string;         // MM/DD/YYYY
  archiveDate?: string;       // MM/DD/YYYY
  awardCeiling?: number;
  awardFloor?: number;
  estimatedTotalProgramFunding?: number;
  categoryOfFundingActivity?: string;
  cfdaList?: Array<{ cfda?: string }>;
  eligibleApplicants?: string[];
  fundingInstrumentType?: string;
  additionalInformationUrl?: string;
  oppStatus?: string;
}

interface GrantsGovResponse {
  oppHits?: GrantsGovHit[];
  totalCount?: number;
}

// ── Date helpers ────────────────────────────────────────────────────────────

/** Convert Grants.gov MM/DD/YYYY → ISO YYYY-MM-DD */
function toIsoDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const parts = raw.split('/');
  if (parts.length === 3) {
    const [mm, dd, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return raw; // already ISO or unknown format — pass through
}

// ── Adapter ─────────────────────────────────────────────────────────────────

export const grantsGovAdapter: GrantSourceAdapter = {
  name: 'grants.gov',

  isAvailable(): boolean {
    // No API key required
    return true;
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

    // Build category codes from grantTypes + service areas
    const fundingCategories: string[] = [];
    // Legacy: from grantTypes
    for (const gt of params.grantTypes) {
      const code = GRANTS_GOV_CATEGORY_MAP[gt];
      if (code && !fundingCategories.includes(code)) fundingCategories.push(code);
    }
    // New: from NTEE service areas (if available)
    if (params.serviceAreas && params.serviceAreas.length > 0) {
      try {
        const { getCfdaCodesForServiceAreas } = require('@/data/service-areas');
        const areaCodes: string[] = getCfdaCodesForServiceAreas(params.serviceAreas);
        for (const code of areaCodes) {
          if (!fundingCategories.includes(code)) fundingCategories.push(code);
        }
        console.log(`${LOG_PREFIX} CFDA codes from service areas: ${areaCodes.join(', ')}`);
      } catch (e) {
        console.warn(`${LOG_PREFIX} Could not load service areas:`, e);
      }
    }

    // Build eligibility filter (supports multi-select)
    const eligibilities: string[] = [];
    if (params.eligibilityTypes && params.eligibilityTypes.length > 0) {
      for (const et of params.eligibilityTypes) {
        const code = GRANTS_GOV_ELIGIBILITY_MAP[et];
        if (code && !eligibilities.includes(code)) eligibilities.push(code);
      }
    } else if (params.eligibilityType) {
      const code = GRANTS_GOV_ELIGIBILITY_MAP[params.eligibilityType];
      if (code) eligibilities.push(code);
    }

    // Build funding instrument filter
    const fundingInstrumentCodes: string[] = [];
    if (params.fundingInstruments && params.fundingInstruments.length > 0) {
      for (const fi of params.fundingInstruments) {
        const code = FUNDING_INSTRUMENT_MAP[fi];
        if (code && !fundingInstrumentCodes.includes(code)) fundingInstrumentCodes.push(code);
      }
      console.log(`${LOG_PREFIX} Funding instrument codes: ${fundingInstrumentCodes.join(', ')}`);
    }

    // We search once per keyword (up to MAX_KEYWORDS) and merge results
    const keywords = params.keywords.slice(0, MAX_KEYWORDS);
    if (keywords.length === 0) {
      keywords.push(''); // empty keyword = broad search
    }

    const allResults: NormalizedGrant[] = [];
    const seenIds = new Set<string>();

    for (const keyword of keywords) {
      try {
        const body: Record<string, unknown> = {
          keyword: keyword,
          oppStatuses: 'posted',
          rows: MAX_RESULTS_PER_KEYWORD,
          sortBy: 'relevance',
        };

        if (fundingCategories.length > 0) {
          body.fundingCategories = fundingCategories.join('|');
        }
        if (eligibilities.length > 0) {
          body.eligibilities = eligibilities.join('|');
        }
        if (fundingInstrumentCodes.length > 0) {
          body.fundingInstruments = fundingInstrumentCodes.join('|');
        }

        console.log(`${LOG_PREFIX} Searching keyword="${keyword}"`, body);

        let response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          console.error(
            `${LOG_PREFIX} API returned ${response.status} for keyword="${keyword}"`,
          );
          continue;
        }

        let data: GrantsGovResponse = await response.json();
        let hits = data.oppHits ?? [];

        // If 0 results with strict filters, retry without category codes (broader search)
        if (hits.length === 0 && fundingCategories.length > 0) {
          console.log(`${LOG_PREFIX} 0 results with category filter — retrying broader search for "${keyword}"`);
          const broaderBody = { ...body };
          delete broaderBody.fundingCategories;
          const retryResp = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(broaderBody),
          });
          if (retryResp.ok) {
            data = await retryResp.json();
            hits = data.oppHits ?? [];
            console.log(`${LOG_PREFIX} Broader search found ${hits.length} hits for "${keyword}"`);
          }
        }
        console.log(
          `${LOG_PREFIX} Received ${hits.length} hits for keyword="${keyword}" (total: ${data.totalCount ?? '?'})`,
        );

        for (const hit of hits) {
          const grantId = `grantsgov_${hit.id ?? hit.number ?? ''}`;
          if (seenIds.has(grantId)) continue;
          seenIds.add(grantId);

          const title = hit.title ?? 'Untitled Opportunity';
          const description = hit.synopsis ?? '';

          // Detect international scope from content
          const international = isInternationalGrant(title, description);

          const normalized: NormalizedGrant = {
            id: grantId,
            sources: ['grants.gov'],
            title,
            description,
            agency: hit.agencyName ?? 'Unknown Agency',
            agencyCode: hit.agencyCode,
            opportunityNumber: hit.number,

            // Financials — NEVER fabricate
            awardAmountMin: hit.awardFloor ?? null,
            awardAmountMax: hit.awardCeiling ?? null,
            estimatedTotalFunding: hit.estimatedTotalProgramFunding ?? null,

            // Dates
            postedDate: toIsoDate(hit.openDate),
            closeDate: toIsoDate(hit.closeDate),
            archiveDate: toIsoDate(hit.archiveDate),

            // Classification
            categories: hit.categoryOfFundingActivity
              ? [hit.categoryOfFundingActivity]
              : [],
            categoryCodes: (hit.cfdaList ?? [])
              .map((c) => c.cfda ?? '')
              .filter(Boolean),
            eligibleApplicants: hit.eligibleApplicants ?? [],
            fundingInstrument: hit.fundingInstrumentType,

            // Geography
            grantScope: international ? 'international' : 'national',
            targetState: params.locationState,
            targetCity: params.locationCity,

            // Links
            applicationUrl: hit.additionalInformationUrl,
            sourceUrl: `https://www.grants.gov/search-results-detail/${hit.id ?? ''}`,

            // Status
            status: mapStatus(hit.oppStatus),
          };

          allResults.push(normalized);
        }
      } catch (error) {
        console.error(
          `${LOG_PREFIX} Error searching keyword="${keyword}":`,
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapStatus(
  raw?: string,
): 'posted' | 'forecasted' | 'closed' | 'archived' {
  if (!raw) return 'posted';
  const lower = raw.toLowerCase();
  if (lower.includes('forecast')) return 'forecasted';
  if (lower.includes('closed')) return 'closed';
  if (lower.includes('archive')) return 'archived';
  return 'posted';
}
