// ============================================================================
// ProPublica Nonprofit Explorer — Adapter
// Uses the free ProPublica API to find foundations that fund similar orgs.
// No API key required.
// 
// API Docs: https://projects.propublica.org/nonprofits/api
// ============================================================================

import type {
  GrantSourceAdapter,
  GrantSearchParams,
  NormalizedGrant,
} from '@/types/grants';

const LOG_PREFIX = '[GrantSearch:ProPublica]';
const BASE_URL = 'https://projects.propublica.org/nonprofits/api/v2';

// NTEE codes for private foundations and giving organizations
const FOUNDATION_NTEE_CODES = ['T20', 'T21', 'T22', 'T23', 'T30', 'T31', 'T40', 'T50', 'T70'];

// Map our service area IDs to ProPublica search terms
const SERVICE_AREA_SEARCH_TERMS: Record<string, string[]> = {
  housing_shelter: ['housing', 'shelter', 'homeless'],
  health_human_services: ['health', 'human services', 'medical'],
  community_social: ['community', 'social services', 'welfare'],
  education: ['education', 'school', 'scholarship'],
  environment: ['environment', 'conservation', 'climate'],
  arts_culture: ['arts', 'culture', 'humanities'],
  science_tech: ['science', 'technology', 'research'],
  economic_dev: ['economic', 'development', 'business'],
  transportation: ['transportation', 'infrastructure'],
};

// US state name → abbreviation for API queries
const STATE_ABBREVS: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

interface ProPublicaOrg {
  ein: number;
  name: string;
  city: string;
  state: string;
  ntee_code: string;
  classification_codes?: string;
  score?: number;
  total_revenue?: number;
  total_assets?: number;
}

interface ProPublicaSearchResponse {
  total_results: number;
  organizations: ProPublicaOrg[];
}

/**
 * Fetch organization details to get giving data from their 990-PF filings.
 */
async function fetchOrgDetails(ein: number): Promise<{
  totalGrants: number | null;
  totalAssets: number | null;
  description: string;
  website: string;
  filingYear: number | null;
} | null> {
  try {
    const res = await fetch(`${BASE_URL}/organizations/${ein}.json`, {
      headers: { 'User-Agent': 'SOLTheory-GrantScout/1.0' },
    });
    if (!res.ok) return null;
    // Guard against non-JSON responses (HTML error pages)
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      console.warn(`${LOG_PREFIX} Non-JSON response for EIN ${ein}: ${contentType}`);
      return null;
    }
    let data: any;
    try { data = await res.json(); } catch { return null; }
    const org = data.organization;
    const filings = data.filings_with_data || [];
    
    // Get the most recent filing
    const latestFiling = filings[0];
    
    return {
      totalGrants: latestFiling?.totfuncexpns || latestFiling?.grntstoindiv || null,
      totalAssets: org?.total_assets || latestFiling?.totassetsend || null,
      description: org?.subsection_description || '',
      website: '',
      filingYear: latestFiling?.tax_prd_yr || null,
    };
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to fetch details for EIN ${ein}:`, err);
    return null;
  }
}

export const propublicaAdapter: GrantSourceAdapter = {
  name: 'propublica',

  isAvailable(): boolean {
    // ProPublica API is free and requires no API key
    return true;
  },

  async search(params: GrantSearchParams): Promise<NormalizedGrant[]> {
    console.log(`${LOG_PREFIX} Starting foundation search with params:`, {
      keywords: params.keywords?.slice(0, 5),
      state: params.locationState,
      geoScope: params.geoScope,
      serviceAreas: params.serviceAreas,
    });

    const results: NormalizedGrant[] = [];
    const seenEins = new Set<number>();

    // Build search queries from keywords and service areas
    const searchQueries: string[] = [];

    // Use keywords from service areas
    if (params.keywords?.length) {
      // Take top keywords and search for foundations matching them
      searchQueries.push(...params.keywords.slice(0, 5).map(k => `${k} foundation`));
    }

    // Add service-area-specific search terms
    if (params.serviceAreas?.length) {
      for (const area of params.serviceAreas) {
        // Check parent group IDs
        const terms = SERVICE_AREA_SEARCH_TERMS[area];
        if (terms) {
          searchQueries.push(...terms.map(t => `${t} foundation`));
        }
      }
    }

    // Fallback
    if (searchQueries.length === 0) {
      searchQueries.push('community foundation', 'charitable foundation');
    }

    // Deduplicate and limit queries
    const uniqueQueries = [...new Set(searchQueries)].slice(0, 8);
    console.log(`${LOG_PREFIX} Running ${uniqueQueries.length} search queries`);

    // Determine state filter
    const stateAbbrev = params.locationState
      ? STATE_ABBREVS[params.locationState] || params.locationState
      : '';

    for (const searchQuery of uniqueQueries) {
      try {
        // Throttle: 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500));

        const queryParams = new URLSearchParams({ q: searchQuery });
        if (stateAbbrev && params.geoScope !== 'nationwide') {
          queryParams.set('state[id]', stateAbbrev);
        }

        const url = `${BASE_URL}/search.json?${queryParams.toString()}`;
        console.log(`${LOG_PREFIX} Fetching: ${url}`);

        const res = await fetch(url, {
          headers: { 'User-Agent': 'SOLTheory-GrantScout/1.0' },
        });

        if (!res.ok) {
          console.warn(`${LOG_PREFIX} API returned ${res.status} for "${searchQuery}"`);
          continue;
        }

        // Guard against non-JSON responses (HTML error pages)
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('json')) {
          console.warn(`${LOG_PREFIX} Non-JSON response for "${searchQuery}": ${contentType}`);
          continue;
        }
        let data: ProPublicaSearchResponse;
        try { data = await res.json(); } catch { continue; }
        console.log(`${LOG_PREFIX} "${searchQuery}" returned ${data.total_results} results`);

        // Process top results (limit per query to avoid flooding)
        const orgs = (data.organizations || []).slice(0, 10);

        for (const org of orgs) {
          if (seenEins.has(org.ein)) continue;
          seenEins.add(org.ein);

          // Skip non-foundation orgs (must be a grant-making entity)
          // Look for foundations, trusts, or organizations with significant assets
          const isLikelyFoundation =
            org.name.toLowerCase().includes('foundation') ||
            org.name.toLowerCase().includes('trust') ||
            org.name.toLowerCase().includes('fund') ||
            org.name.toLowerCase().includes('endowment') ||
            org.name.toLowerCase().includes('philanthropi') ||
            (org.ntee_code && FOUNDATION_NTEE_CODES.some(c => org.ntee_code.startsWith(c))) ||
            (org.total_assets && org.total_assets > 1_000_000);

          if (!isLikelyFoundation) continue;

          // Fetch detailed filing data (with throttling)
          await new Promise(resolve => setTimeout(resolve, 300));
          const details = await fetchOrgDetails(org.ein);

          const totalGrants = details?.totalGrants ?? null;
          const totalAssets = details?.totalAssets ?? org.total_assets ?? null;

          // Build description
          const descParts: string[] = [];
          if (org.name) descParts.push(`${org.name} is a philanthropic organization`);
          if (org.city && org.state) descParts.push(`based in ${org.city}, ${org.state}`);
          if (details?.description) descParts.push(`classified as: ${details.description}`);
          if (totalAssets) {
            descParts.push(`with total assets of $${(totalAssets / 1_000_000).toFixed(1)}M`);
          }
          if (totalGrants) {
            descParts.push(`Total functional expenses: $${(totalGrants / 1_000_000).toFixed(1)}M`);
          }
          if (details?.filingYear) {
            descParts.push(`(most recent filing: ${details.filingYear})`);
          }

          const normalized: NormalizedGrant = {
            id: `propublica_${org.ein}`,
            sources: ['propublica'],
            title: org.name,
            description: descParts.join('. ') + '.',
            agency: org.name,
            opportunityNumber: `EIN: ${String(org.ein).replace(/(\d{2})(\d{7})/, '$1-$2')}`,

            // Financials
            awardAmountMin: null,
            awardAmountMax: totalGrants || null,
            estimatedTotalFunding: totalAssets || null,

            // Dates
            postedDate: details?.filingYear ? `${details.filingYear}-01-01` : undefined,

            // Classification
            categories: org.ntee_code ? [org.ntee_code] : [],
            categoryCodes: org.ntee_code ? [org.ntee_code] : [],
            eligibleApplicants: ['Nonprofits'],
            fundingInstrument: 'Foundation Grant',

            // Geography
            grantScope: stateAbbrev ? 'state' : 'national',
            targetState: org.state || undefined,
            targetCity: org.city || undefined,

            // Links
            sourceUrl: `https://projects.propublica.org/nonprofits/organizations/${org.ein}`,

            // Status — foundations are always "posted" (accepting inquiries)
            status: 'posted',
          };

          results.push(normalized);
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} Error searching "${searchQuery}":`, err);
      }
    }

    console.log(`${LOG_PREFIX} Search complete — ${results.length} foundation results`);
    return results;
  },
};
