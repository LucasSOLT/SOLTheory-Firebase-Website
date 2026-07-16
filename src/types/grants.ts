// ============================================================================
// Shared Grant Types & Interfaces
// Used across all grant source adapters and the orchestrator
// ============================================================================

/**
 * Normalized grant record — the common shape every source adapter must produce.
 * Fields that cannot be determined from a source MUST be set to null/undefined,
 * NEVER fabricated with placeholder values or random numbers.
 */
export interface NormalizedGrant {
  /** Prefixed by source, e.g. "grantsgov_12345", "sam_67890" */
  id: string;
  /** Which source(s) surfaced this grant (merged during dedup) */
  sources: GrantSource[];
  title: string;
  description: string;
  agency: string;
  agencyCode?: string;
  opportunityNumber?: string;

  // ── Financials — NEVER fabricate ──────────────────────────────────────
  awardAmountMin?: number | null;
  awardAmountMax?: number | null;
  estimatedTotalFunding?: number | null;

  // ── Dates ─────────────────────────────────────────────────────────────
  postedDate?: string;
  closeDate?: string;
  archiveDate?: string;

  // ── Classification ────────────────────────────────────────────────────
  categories: string[];
  categoryCodes: string[];
  eligibleApplicants: string[];
  fundingInstrument?: string;

  // ── Geography ─────────────────────────────────────────────────────────
  grantScope: 'local' | 'state' | 'regional' | 'national' | 'international';
  targetState?: string;
  targetCity?: string;
  placeOfPerformance?: string;

  // ── Links ─────────────────────────────────────────────────────────────
  applicationUrl?: string;
  sourceUrl: string;

  // ── AI Scoring (populated after fetch by a separate scoring step) ─────
  relevanceScore?: number;
  relevanceExplanation?: string;
  eligibilityVerified?: boolean;
  eligibilityConfidence?: number;
  eligibilityReason?: string;

  // ── Status ────────────────────────────────────────────────────────────
  status: 'posted' | 'forecasted' | 'closed' | 'archived';
}

/** Supported grant data sources */
export type GrantSource =
  | 'grants.gov'
  | 'sam.gov'
  | 'usaspending'
  | 'candid'
  | 'propublica';

/**
 * Search parameters passed from the client / API route into the adapter layer.
 */
export interface GrantSearchParams {
  keywords: string[];
  grantTypes: string[];
  locationState?: string;
  locationCity?: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  openDate?: string;
  closeDate?: string;
  companyDescription?: string;
  /** e.g. "nonprofit_501c3", "tribal", "government", "small_business" */
  eligibilityType?: string;

  // ── New fields from Config Overhaul ─────────────────────────────────
  /** NTEE-based service subcategory IDs (e.g. ["homeless_shelters", "substance_abuse"]) */
  serviceAreas?: string[];
  /** Population IDs served (e.g. ["homeless", "veterans"]) */
  populationsServed?: string[];
  /** Funding instrument preferences (e.g. ["grant", "cooperative_agreement"]) */
  fundingInstruments?: string[];
  /** Which sources to search (e.g. ["federal", "state", "foundation"]) */
  fundingSources?: string[];
  /** Geographic scope: "nationwide" | "regional" | "state" | "metro" | "local" */
  geoScope?: string;
  /** Deadline window: "30" | "60" | "90" | "180" | "any" | "custom" */
  deadlineWindow?: string;
  /** Multi-select eligibility types */
  eligibilityTypes?: string[];
  /** Organization annual budget */
  orgBudget?: number | null;
  /** Organization staff size */
  orgStaffSize?: number | null;
  /** SAM.gov Unique Entity ID (required for federal grants) */
  orgSamUei?: string;
}

/**
 * Contract every source adapter must satisfy.
 */
export interface GrantSourceAdapter {
  name: GrantSource;
  /** Check whether the adapter can run (API key present, etc.) */
  isAvailable(): boolean;
  /** Execute a search and return normalised results */
  search(params: GrantSearchParams): Promise<NormalizedGrant[]>;
}

// ============================================================================
// Grants.gov category code mapping
// Keys are the internal grant-type slugs used by our UI.
// Values are the Grants.gov CFDA category codes.
// ============================================================================
export const GRANTS_GOV_CATEGORY_MAP: Record<string, string> = {
  housing_shelter: 'HU',
  health_human_services: 'HL',
  community_development: 'CD',
  capacity_operations: 'O',
  private_foundation: 'O',
  education: 'ED',
  environment: 'EN',
  arts_culture: 'AR',
  science_technology: 'ST',
  transportation: 'T',
  agriculture: 'AG',
};

// ============================================================================
// Grants.gov eligibility type mapping
// Keys are our internal eligibility slugs; values are Grants.gov codes.
// ============================================================================
export const GRANTS_GOV_ELIGIBILITY_MAP: Record<string, string> = {
  nonprofit_501c3: '12',   // Nonprofits having a 501(c)(3) Status
  nonprofit_other: '13',   // Nonprofits not having a 501(c)(3) status
  state_government: '00',
  county_government: '01',
  city_government: '02',
  tribal: '06',
  small_business: '20',
  individual: '21',
  education: '05',
};
