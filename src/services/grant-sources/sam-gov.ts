// ============================================================================
// SAM.gov Source Adapter
// Endpoint: GET https://api.sam.gov/opportunities/v2/search
// Requires: SAM_GOV_API_KEY environment variable
// ============================================================================

import type {
  GrantSourceAdapter,
  GrantSearchParams,
  NormalizedGrant,
} from '@/types/grants';
import { isInternationalGrant } from './filters';

const LOG_PREFIX = '[GrantSearch:SAMgov]';
const API_BASE = 'https://api.sam.gov/opportunities/v2/search';
const MAX_RESULTS = 50;

// ── SAM.gov eligibility type codes ──────────────────────────────────────────
const SAM_ELIGIBILITY_MAP: Record<string, string> = {
  nonprofit_501c3: '12',
  nonprofit_other: '13',
  state_government: '00',
  county_government: '01',
  city_government: '02',
  tribal: '06',
  small_business: '20',
  individual: '21',
  education: '05',
};

// ── Raw API response shapes ─────────────────────────────────────────────────

interface SamGovOpportunity {
  noticeId?: string;
  solicitationNumber?: string;
  title?: string;
  description?: string;
  fullParentPathName?: string;
  department?: string;
  subTier?: string;
  organizationType?: string;
  officeAddress?: {
    city?: string;
    state?: string;
    zipcode?: string;
  };
  pointOfContact?: Array<{
    fullName?: string;
    email?: string;
  }>;
  postedDate?: string;
  responseDeadLine?: string;
  archiveDate?: string;
  type?: string; // "o" = opportunity, "p" = presolicitation, etc.
  award?: {
    amount?: number;
    awardee?: {
      name?: string;
    };
  };
  placeOfPerformance?: {
    city?: { name?: string };
    state?: { code?: string; name?: string };
    country?: { code?: string; name?: string };
  };
  additionalInfoLink?: string;
  uiLink?: string;
  naicsCode?: string;
  classificationCode?: string;
  active?: string; // "Yes" / "No"
}

interface SamGovResponse {
  totalRecords?: number;
  opportunitiesData?: SamGovOpportunity[];
}

// ── Adapter ─────────────────────────────────────────────────────────────────

export const samGovAdapter: GrantSourceAdapter = {
  name: 'sam.gov',

  isAvailable(): boolean {
    const hasKey = !!process.env.SAM_GOV_API_KEY;
    if (!hasKey) {
      console.warn(
        `${LOG_PREFIX} SAM_GOV_API_KEY not set — SAM.gov adapter will be skipped`,
      );
    }
    return hasKey;
  },

  async search(params: GrantSearchParams): Promise<NormalizedGrant[]> {
    const apiKey = process.env.SAM_GOV_API_KEY;
    if (!apiKey) {
      console.warn(
        `${LOG_PREFIX} SAM_GOV_API_KEY not configured — returning empty results`,
      );
      return [];
    }

    console.log(`${LOG_PREFIX} Starting search with params:`, {
      keywords: params.keywords,
      state: params.locationState,
      eligibilityTypes: params.eligibilityTypes,
      fundingInstruments: params.fundingInstruments,
      geoScope: params.geoScope,
      openDate: params.openDate,
      closeDate: params.closeDate,
    });

    try {
      // Build query string
      const url = new URL(API_BASE);
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('limit', String(MAX_RESULTS));
      url.searchParams.set('offset', '0');

      // Keywords — join into a single search string
      if (params.keywords.length > 0) {
        url.searchParams.set('keyword', params.keywords.join(' '));
      }

      // Status — only active/posted, look back 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const postedFrom = `${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}/${String(sixMonthsAgo.getDate()).padStart(2, '0')}/${sixMonthsAgo.getFullYear()}`;
      url.searchParams.set('postedFrom', postedFrom);
      url.searchParams.set('ptype', 'o'); // opportunities only

      // Date filtering
      if (params.openDate) {
        // SAM expects MM/DD/YYYY
        const d = new Date(params.openDate);
        url.searchParams.set(
          'postedFrom',
          `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`,
        );
      }
      if (params.closeDate) {
        const d = new Date(params.closeDate);
        url.searchParams.set(
          'postedTo',
          `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`,
        );
      }

      // State filter
      if (params.locationState) {
        url.searchParams.set(
          'state',
          params.locationState.toUpperCase(),
        );
      }

      // Applicant type / eligibility — prefer multi-select array
      const eligibilitySlug = params.eligibilityTypes?.[0] ?? params.eligibilityType;
      if (eligibilitySlug) {
        const code = SAM_ELIGIBILITY_MAP[eligibilitySlug];
        if (code) {
          url.searchParams.set('typeOfSetAside', code);
        }
      }

      // Organization type — pass through if available from eligibility context
      if (params.eligibilityTypes && params.eligibilityTypes.length > 0) {
        // SAM.gov supports organizationType as a filter for certain org types
        const orgTypeMap: Record<string, string> = {
          nonprofit_501c3: '501(c)3',
          nonprofit_other: 'nonprofit',
          small_business: 'small business',
          tribal: 'tribal',
          state_government: 'state government',
          county_government: 'county government',
          city_government: 'city government',
        };
        const orgType = orgTypeMap[params.eligibilityTypes[0]];
        if (orgType) {
          url.searchParams.set('organizationType', orgType);
        }
      }

      // NAICS code — pass through from service areas if available
      if (params.serviceAreas && params.serviceAreas.length > 0) {
        console.log(`${LOG_PREFIX} Service areas available: ${params.serviceAreas.join(', ')}`);
      }

      console.log(`${LOG_PREFIX} Fetching: ${url.toString().replace(apiKey, '***')}`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        console.error(`${LOG_PREFIX} API returned ${response.status}`);
        return [];
      }

      const data: SamGovResponse = await response.json();
      const opportunities = data.opportunitiesData ?? [];

      console.log(
        `${LOG_PREFIX} Received ${opportunities.length} opportunities (total: ${data.totalRecords ?? '?'})`,
      );

      const grants: NormalizedGrant[] = [];

      for (const opp of opportunities) {
        const title = opp.title ?? 'Untitled SAM.gov Opportunity';
        const description = opp.description ?? '';
        const noticeId = opp.noticeId ?? opp.solicitationNumber ?? '';
        const grantId = `sam_${noticeId}`;

        // Determine scope
        const popCountry =
          opp.placeOfPerformance?.country?.name ??
          opp.placeOfPerformance?.country?.code ??
          '';
        const popState =
          opp.placeOfPerformance?.state?.code ??
          opp.placeOfPerformance?.state?.name ??
          '';
        const popCity = opp.placeOfPerformance?.city?.name ?? '';

        let grantScope: NormalizedGrant['grantScope'] = 'national';
        if (isInternationalGrant(title, description)) {
          grantScope = 'international';
        } else if (
          popCountry &&
          !['US', 'USA', 'UNITED STATES'].includes(popCountry.toUpperCase())
        ) {
          grantScope = 'international';
        } else if (popCity) {
          grantScope = 'local';
        } else if (popState) {
          grantScope = 'state';
        }

        const normalized: NormalizedGrant = {
          id: grantId,
          sources: ['sam.gov'],
          title,
          description,
          agency:
            opp.department ??
            opp.subTier ??
            opp.fullParentPathName ??
            'Unknown Agency',
          agencyCode: opp.classificationCode,
          opportunityNumber: opp.solicitationNumber,

          // Financials — only include if present
          awardAmountMin: opp.award?.amount ?? null,
          awardAmountMax: opp.award?.amount ?? null,
          estimatedTotalFunding: null,

          // Dates
          postedDate: opp.postedDate,
          closeDate: opp.responseDeadLine,
          archiveDate: opp.archiveDate,

          // Classification
          categories: [],
          categoryCodes: opp.naicsCode ? [opp.naicsCode] : [],
          eligibleApplicants: [],
          fundingInstrument: opp.type,

          // Geography
          grantScope,
          targetState: popState || params.locationState,
          targetCity: popCity || params.locationCity,
          placeOfPerformance: [popCity, popState, popCountry]
            .filter(Boolean)
            .join(', ') || undefined,

          // Links
          applicationUrl: opp.additionalInfoLink,
          sourceUrl:
            opp.uiLink ??
            `https://sam.gov/opp/${noticeId}/view`,

          // Status
          status: opp.active === 'Yes' ? 'posted' : 'closed',
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
