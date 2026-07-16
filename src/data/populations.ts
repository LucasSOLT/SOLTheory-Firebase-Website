// ============================================================================
// Populations Served — Taxonomy
// Maps population categories to search keywords for relevance scoring
// ============================================================================

export interface PopulationCategory {
  id: string;
  label: string;
  /** Keywords injected into AI relevance prompts for scoring */
  keywords: string[];
}

export const POPULATION_CATEGORIES: PopulationCategory[] = [
  { id: "children_youth", label: "Children & Youth (0-17)", keywords: ["children", "youth", "juvenile", "young people", "minors"] },
  { id: "young_adults", label: "Young Adults (18-24)", keywords: ["young adults", "transition age youth", "TAY", "emerging adults"] },
  { id: "adults", label: "Adults (25-64)", keywords: ["adults", "working age", "adult population"] },
  { id: "seniors", label: "Seniors (65+)", keywords: ["seniors", "elderly", "older adults", "aging", "geriatric"] },
  { id: "veterans", label: "Veterans & Military Families", keywords: ["veterans", "military", "service members", "VA", "military families"] },
  { id: "homeless", label: "Homeless / Unhoused", keywords: ["homeless", "unhoused", "housing insecure", "unsheltered", "people experiencing homelessness"] },
  { id: "immigrants_refugees", label: "Immigrants & Refugees", keywords: ["immigrants", "refugees", "asylum seekers", "undocumented", "new Americans"] },
  { id: "disabled", label: "People with Disabilities", keywords: ["disabilities", "disabled", "ADA", "special needs", "accessibility"] },
  { id: "lgbtq", label: "LGBTQ+", keywords: ["LGBTQ", "LGBTQIA", "transgender", "gender nonconforming", "sexual orientation"] },
  { id: "indigenous", label: "Indigenous / Native American", keywords: ["indigenous", "Native American", "tribal", "American Indian", "Alaska Native"] },
  { id: "low_income", label: "Low-Income Families", keywords: ["low-income", "poverty", "disadvantaged", "underserved", "economically disadvantaged"] },
  { id: "formerly_incarcerated", label: "Formerly Incarcerated", keywords: ["formerly incarcerated", "reentry", "ex-offender", "criminal justice involved", "returning citizens"] },
  { id: "dv_survivors", label: "Survivors of Domestic Violence", keywords: ["domestic violence survivors", "intimate partner violence", "family violence", "abuse survivors"] },
  { id: "rural", label: "Rural Communities", keywords: ["rural", "rural communities", "small towns", "underserved areas", "frontier communities"] },
  { id: "minorities", label: "People of Color / Minority Communities", keywords: ["minority", "people of color", "racial equity", "underrepresented", "communities of color"] },
  { id: "sud", label: "People with Substance Use Disorders", keywords: ["substance use disorder", "addiction", "recovery", "SUD", "substance abuse treatment"] },
];

/**
 * Get all keywords for selected population IDs.
 * Used by the AI scoring prompt to weight relevance.
 */
export function getPopulationKeywords(selectedIds: string[]): string[] {
  const keywords: string[] = [];
  for (const pop of POPULATION_CATEGORIES) {
    if (selectedIds.includes(pop.id)) {
      keywords.push(...pop.keywords);
    }
  }
  return [...new Set(keywords)];
}

/**
 * Get human-readable labels for selected population IDs.
 */
export function getPopulationLabels(selectedIds: string[]): string[] {
  return POPULATION_CATEGORIES
    .filter((p) => selectedIds.includes(p.id))
    .map((p) => p.label);
}
