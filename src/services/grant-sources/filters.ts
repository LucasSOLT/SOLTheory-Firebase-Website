// ============================================================================
// Grant Filters — Geographic exclusion, budget & date range utilities
// Used by the orchestrator for Stage 2 post-fetch filtering
// ============================================================================

import type { NormalizedGrant } from '@/types/grants';

// ── International / Foreign keywords ────────────────────────────────────────
// If a grant title or description contains any of these tokens (case-insensitive)
// it is likely an international / foreign-focused opportunity.
export const INTERNATIONAL_KEYWORDS: string[] = [
  'overseas',
  'foreign',
  'embassy',
  'international development',
  'us mission to',
  'usaid',
  'peace corps',
  'global health',
  'foreign assistance',
  'foreign affairs',
  'international affairs',
  'abroad',
  'bilateral',
  'multilateral',
  'humanitarian assistance overseas',
  'developing countries',
  'third world',
  'sub-saharan',
  'southeast asia',
  'middle east',
  'latin america',
  'caribbean',
  'pacific islands',
  'central asia',
  'south asia',
  'east africa',
  'west africa',
  'north africa',
];

// ── Comprehensive foreign-country name list ─────────────────────────────────
export const FOREIGN_COUNTRY_NAMES: string[] = [
  'afghanistan', 'albania', 'algeria', 'andorra', 'angola',
  'antigua and barbuda', 'argentina', 'armenia', 'australia', 'austria',
  'azerbaijan', 'bahamas', 'bahrain', 'bangladesh', 'barbados',
  'belarus', 'belgium', 'belize', 'benin', 'bhutan',
  'bolivia', 'bosnia and herzegovina', 'botswana', 'brazil', 'brunei',
  'bulgaria', 'burkina faso', 'burundi', 'cabo verde', 'cambodia',
  'cameroon', 'canada', 'central african republic', 'chad', 'chile',
  'china', 'colombia', 'comoros', 'congo', 'costa rica',
  'croatia', 'cuba', 'cyprus', 'czech republic', 'czechia',
  'democratic republic of the congo', 'denmark', 'djibouti', 'dominica',
  'dominican republic', 'east timor', 'ecuador', 'egypt', 'el salvador',
  'equatorial guinea', 'eritrea', 'estonia', 'eswatini', 'ethiopia',
  'fiji', 'finland', 'france', 'gabon', 'gambia',
  'georgia', 'germany', 'ghana', 'greece', 'grenada',
  'guatemala', 'guinea', 'guinea-bissau', 'guyana', 'haiti',
  'honduras', 'hungary', 'iceland', 'india', 'indonesia',
  'iran', 'iraq', 'ireland', 'israel', 'italy',
  'ivory coast', 'jamaica', 'japan', 'jordan', 'kazakhstan',
  'kenya', 'kiribati', 'kosovo', 'kuwait', 'kyrgyzstan',
  'laos', 'latvia', 'lebanon', 'lesotho', 'liberia',
  'libya', 'liechtenstein', 'lithuania', 'luxembourg', 'madagascar',
  'malawi', 'malaysia', 'maldives', 'mali', 'malta',
  'marshall islands', 'mauritania', 'mauritius', 'mexico', 'micronesia',
  'moldova', 'monaco', 'mongolia', 'montenegro', 'morocco',
  'mozambique', 'myanmar', 'namibia', 'nauru', 'nepal',
  'netherlands', 'new zealand', 'nicaragua', 'niger', 'nigeria',
  'north korea', 'north macedonia', 'norway', 'oman', 'pakistan',
  'palau', 'palestine', 'panama', 'papua new guinea', 'paraguay',
  'peru', 'philippines', 'poland', 'portugal', 'qatar',
  'romania', 'russia', 'rwanda', 'saint kitts and nevis', 'saint lucia',
  'saint vincent and the grenadines', 'samoa', 'san marino',
  'sao tome and principe', 'saudi arabia', 'senegal', 'serbia',
  'seychelles', 'sierra leone', 'singapore', 'slovakia', 'slovenia',
  'solomon islands', 'somalia', 'south africa', 'south korea', 'south sudan',
  'spain', 'sri lanka', 'sudan', 'suriname', 'sweden',
  'switzerland', 'syria', 'taiwan', 'tajikistan', 'tanzania',
  'thailand', 'timor-leste', 'togo', 'tonga', 'trinidad and tobago',
  'tunisia', 'turkey', 'turkmenistan', 'tuvalu', 'uganda',
  'ukraine', 'united arab emirates', 'united kingdom', 'uruguay', 'uzbekistan',
  'vanuatu', 'vatican city', 'venezuela', 'vietnam', 'yemen',
  'zambia', 'zimbabwe',
];

// ── Helper: normalise text for keyword matching ─────────────────────────────
function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Determine whether a grant appears to be internationally focused
 * based on its title and description text.
 */
export function isInternationalGrant(title: string, description: string): boolean {
  const combined = normalizeText(`${title} ${description}`);

  // Check international keywords
  for (const keyword of INTERNATIONAL_KEYWORDS) {
    if (combined.includes(keyword)) {
      return true;
    }
  }

  // Check foreign country names — use word-boundary-aware matching to avoid
  // false positives (e.g. "Jordan" in a person's name). We match on the
  // full country name which is typically multi-word or long enough to be safe.
  for (const country of FOREIGN_COUNTRY_NAMES) {
    // Only match countries with 5+ characters to reduce false positives
    // Short names like "chad", "cuba", "fiji" etc. are too ambiguous
    if (country.length >= 5 && combined.includes(country)) {
      return true;
    }
  }

  return false;
}

/**
 * Check whether a grant's award amounts fall within the user's specified
 * budget range.  If the grant has no amount data we INCLUDE it (benefit
 * of the doubt — we can't filter what we don't know).
 */
export function isWithinBudgetRange(
  grant: NormalizedGrant,
  min?: number | null,
  max?: number | null,
): boolean {
  // No budget filter specified → always passes
  if ((min === undefined || min === null) && (max === undefined || max === null)) {
    return true;
  }

  // Determine the grant's effective amount range
  const grantMin = grant.awardAmountMin ?? grant.estimatedTotalFunding ?? null;
  const grantMax = grant.awardAmountMax ?? grant.estimatedTotalFunding ?? null;

  // If the grant has NO amount data at all, include it (we can't exclude blindly)
  if (grantMin === null && grantMax === null) {
    return true;
  }

  // If user set a minimum and the grant's max is below it → exclude
  if (min != null && grantMax !== null && grantMax < min) {
    return false;
  }

  // If user set a maximum and the grant's min is above it → exclude
  if (max != null && grantMin !== null && grantMin > max) {
    return false;
  }

  return true;
}

/**
 * Check whether a grant's close date is within the user's desired window.
 * - If the grant's closeDate is before the user's openDate → exclude
 *   (the grant closes before the user wants to start looking).
 * - If the grant's postedDate is after the user's closeDate → exclude
 *   (posted too late for the user's window).
 * - Grants with no date data are INCLUDED.
 */
export function isWithinDateRange(
  grant: NormalizedGrant,
  openDate?: string,
  closeDate?: string,
): boolean {
  if (!openDate && !closeDate) {
    return true;
  }

  // If the grant has a close date and user specified an open date,
  // exclude grants that close before the user's open date
  if (openDate && grant.closeDate) {
    try {
      const grantClose = new Date(grant.closeDate);
      const userOpen = new Date(openDate);
      if (grantClose < userOpen) {
        return false;
      }
    } catch {
      // Malformed date — keep the grant
    }
  }

  // If the grant has a posted date and user specified a close date,
  // exclude grants posted after the user's close date
  if (closeDate && grant.postedDate) {
    try {
      const grantPosted = new Date(grant.postedDate);
      const userClose = new Date(closeDate);
      if (grantPosted > userClose) {
        return false;
      }
    } catch {
      // Malformed date — keep the grant
    }
  }

  return true;
}
