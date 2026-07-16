// ============================================================================
// Service Areas — NTEE-Based Taxonomy
// Maps human-friendly service area groups to Grants.gov CFDA category codes,
// SAM.gov NAICS codes, and search keywords for each adapter.
// ============================================================================

export interface ServiceSubcategory {
  id: string;
  label: string;
  /** Additional keywords injected into search queries when this subcategory is selected */
  keywords: string[];
}

export interface ServiceAreaGroup {
  id: string;
  label: string;
  icon: string; // lucide-react icon name
  /** Grants.gov CFDA category codes (used in fundingCategories filter) */
  cfdaCodes: string[];
  subcategories: ServiceSubcategory[];
}

export const SERVICE_AREA_GROUPS: ServiceAreaGroup[] = [
  {
    id: "housing_shelter",
    label: "Housing & Shelter",
    icon: "Home",
    cfdaCodes: ["HU"],
    subcategories: [
      { id: "homeless_shelters", label: "Homeless Shelters & Services", keywords: ["homeless shelter", "emergency shelter", "CoC", "continuum of care", "HUD homeless", "McKinney-Vento", "HEARTH Act", "homeless assistance"] },
      { id: "transitional_housing", label: "Transitional Housing", keywords: ["transitional housing", "rapid rehousing", "supportive housing", "housing stabilization", "bridge housing"] },
      { id: "permanent_supportive", label: "Permanent Supportive Housing", keywords: ["permanent supportive housing", "PSH", "housing first", "chronically homeless", "supportive services"] },
      { id: "affordable_housing", label: "Affordable Housing Development", keywords: ["affordable housing", "HOME-ARP", "LIHTC", "housing trust fund", "HOME Investment", "housing development", "low-income housing"] },
      { id: "fair_housing", label: "Fair Housing", keywords: ["fair housing", "housing discrimination", "housing counseling", "FHEO", "fair housing act", "housing rights"] },
      { id: "housing_search", label: "Housing Search Assistance", keywords: ["housing navigation", "housing search", "housing voucher", "Section 8", "HCV", "housing choice voucher", "tenant-based rental"] },
    ],
  },
  {
    id: "health_human_services",
    label: "Health & Human Services",
    icon: "Heart",
    cfdaCodes: ["HL"],
    subcategories: [
      { id: "substance_abuse", label: "Substance Abuse Treatment & Prevention", keywords: ["substance abuse", "SAMHSA", "opioid", "SUD treatment", "addiction", "medication-assisted treatment", "MAT", "substance use disorder", "recovery services", "drug prevention"] },
      { id: "mental_health", label: "Mental Health Services", keywords: ["mental health", "behavioral health", "counseling", "psychiatric services", "crisis intervention", "suicide prevention", "CCBHC", "mental illness"] },
      { id: "community_health", label: "Community Health Centers", keywords: ["community health center", "FQHC", "primary care", "health services", "HRSA", "health center program", "underserved populations"] },
      { id: "maternal_child", label: "Maternal & Child Health", keywords: ["maternal health", "child health", "prenatal", "WIC", "healthy start", "maternal mortality", "MCHB", "infant mortality"] },
      { id: "disability_services", label: "Disability Services", keywords: ["disability services", "ADA", "vocational rehabilitation", "independent living", "assistive technology", "developmental disabilities"] },
      { id: "public_health", label: "Public Health & Disease Prevention", keywords: ["public health", "disease prevention", "epidemiology", "health disparities", "CDC", "health equity", "preventive health"] },
    ],
  },
  {
    id: "community_social",
    label: "Community & Social Services",
    icon: "Users",
    cfdaCodes: ["HL", "IS"],
    subcategories: [
      { id: "food_nutrition", label: "Food Banks & Nutrition", keywords: ["food bank", "food pantry", "SNAP", "nutrition", "food insecurity", "meals on wheels", "TEFAP", "food distribution", "hunger"] },
      { id: "workforce_dev", label: "Workforce Development & Job Training", keywords: ["workforce development", "job training", "WIOA", "employment services", "career pathways", "apprenticeship", "vocational training", "DOL"] },
      { id: "youth_development", label: "Youth Development & After-School", keywords: ["youth development", "after-school", "mentoring", "youth services", "juvenile", "21st century community", "OJJDP", "at-risk youth"] },
      { id: "senior_services", label: "Senior Services & Aging", keywords: ["senior services", "aging", "elder care", "Area Agency on Aging", "older adults", "Older Americans Act", "senior center", "caregiver support"] },
      { id: "immigrant_refugee", label: "Immigrant & Refugee Services", keywords: ["immigrant services", "refugee resettlement", "ESL", "new Americans", "immigration", "ORR", "refugee assistance", "naturalization"] },
      { id: "domestic_violence", label: "Domestic Violence Prevention", keywords: ["domestic violence", "VAWA", "victim services", "sexual assault", "violence prevention", "OVW", "crisis shelter", "survivor services"] },
      { id: "legal_aid", label: "Legal Aid & Advocacy", keywords: ["legal aid", "legal services", "pro bono", "civil rights", "advocacy", "LSC", "access to justice"] },
      { id: "reentry", label: "Re-Entry & Criminal Justice", keywords: ["reentry", "re-entry", "criminal justice", "formerly incarcerated", "second chance", "Second Chance Act", "BJA", "recidivism"] },
    ],
  },
  {
    id: "education",
    label: "Education",
    icon: "GraduationCap",
    cfdaCodes: ["ED"],
    subcategories: [
      { id: "early_childhood", label: "Early Childhood Education", keywords: ["early childhood", "Head Start", "preschool", "child care", "Pre-K"] },
      { id: "k12", label: "K-12 Programs", keywords: ["K-12", "school", "education", "Title I", "21st century"] },
      { id: "higher_education", label: "Higher Education", keywords: ["higher education", "college", "university", "Pell grant", "scholarship"] },
      { id: "adult_education", label: "Adult Education & Literacy", keywords: ["adult education", "literacy", "GED", "adult basic education"] },
      { id: "stem", label: "STEM / STEAM Programs", keywords: ["STEM", "STEAM", "science education", "technology education", "coding"] },
    ],
  },
  {
    id: "environment",
    label: "Environment & Agriculture",
    icon: "Leaf",
    cfdaCodes: ["EN", "AG"],
    subcategories: [
      { id: "conservation", label: "Conservation & Natural Resources", keywords: ["conservation", "natural resources", "wildlife", "biodiversity"] },
      { id: "clean_energy", label: "Clean Energy & Climate", keywords: ["clean energy", "renewable energy", "climate", "sustainability", "solar"] },
      { id: "water", label: "Water & Sanitation", keywords: ["water quality", "clean water", "sanitation", "wastewater"] },
      { id: "agriculture", label: "Agriculture & Food Systems", keywords: ["agriculture", "farming", "USDA", "food systems", "urban farming"] },
      { id: "environmental_justice", label: "Environmental Justice", keywords: ["environmental justice", "pollution", "environmental health", "EJ communities"] },
    ],
  },
  {
    id: "arts_culture",
    label: "Arts, Culture & Humanities",
    icon: "Palette",
    cfdaCodes: ["AR"],
    subcategories: [
      { id: "performing_arts", label: "Performing Arts", keywords: ["performing arts", "theater", "music", "dance"] },
      { id: "visual_arts", label: "Visual Arts & Museums", keywords: ["visual arts", "museum", "gallery", "arts education"] },
      { id: "cultural_heritage", label: "Cultural Heritage & Preservation", keywords: ["cultural heritage", "historic preservation", "cultural arts"] },
      { id: "media_film", label: "Media, Film & Broadcasting", keywords: ["media", "film", "broadcasting", "journalism", "digital media"] },
    ],
  },
  {
    id: "science_tech",
    label: "Science & Technology",
    icon: "Microscope",
    cfdaCodes: ["ST"],
    subcategories: [
      { id: "research", label: "Research & Development", keywords: ["research", "R&D", "NSF", "NIH", "scientific research"] },
      { id: "digital_inclusion", label: "Digital Inclusion & Broadband", keywords: ["digital inclusion", "broadband", "digital equity", "internet access"] },
      { id: "innovation", label: "Innovation & Entrepreneurship", keywords: ["innovation", "entrepreneurship", "SBIR", "STTR", "startup"] },
    ],
  },
  {
    id: "economic_dev",
    label: "Economic Development",
    icon: "TrendingUp",
    cfdaCodes: ["CD", "O"],
    subcategories: [
      { id: "community_dev", label: "Community Development", keywords: ["community development", "CDBG", "neighborhood revitalization"] },
      { id: "small_business", label: "Small Business & Microenterprise", keywords: ["small business", "microenterprise", "SBA", "economic opportunity"] },
      { id: "financial_empowerment", label: "Financial Empowerment", keywords: ["financial literacy", "financial empowerment", "banking", "asset building"] },
    ],
  },
  {
    id: "transportation",
    label: "Transportation & Infrastructure",
    icon: "Bus",
    cfdaCodes: ["T"],
    subcategories: [
      { id: "public_transit", label: "Public Transit", keywords: ["public transit", "transportation", "FTA", "bus", "rail"] },
      { id: "roads_bridges", label: "Roads & Bridges", keywords: ["roads", "bridges", "highway", "infrastructure"] },
      { id: "pedestrian_bike", label: "Pedestrian & Bike Infrastructure", keywords: ["pedestrian", "bike", "trail", "walkability", "safe routes"] },
    ],
  },
];

/**
 * Get all CFDA codes for a set of selected service area IDs.
 * Used by the Grants.gov adapter to filter by funding category.
 */
export function getCfdaCodesForServiceAreas(selectedIds: string[]): string[] {
  const codes = new Set<string>();
  for (const group of SERVICE_AREA_GROUPS) {
    const hasSelectedSub = group.subcategories.some((sub) => selectedIds.includes(sub.id));
    const groupSelected = selectedIds.includes(group.id);
    if (hasSelectedSub || groupSelected) {
      group.cfdaCodes.forEach((c) => codes.add(c));
    }
  }
  return Array.from(codes);
}

/**
 * Get all keywords for a set of selected service subcategory IDs.
 * Used by the search route to build search queries.
 */
export function getKeywordsForServiceAreas(selectedIds: string[]): string[] {
  const keywords: string[] = [];
  for (const group of SERVICE_AREA_GROUPS) {
    for (const sub of group.subcategories) {
      if (selectedIds.includes(sub.id)) {
        keywords.push(...sub.keywords);
      }
    }
  }
  // Deduplicate
  return [...new Set(keywords)];
}

/**
 * Get group IDs that have at least one subcategory selected.
 */
export function getActiveGroupIds(selectedIds: string[]): string[] {
  return SERVICE_AREA_GROUPS
    .filter((g) => g.subcategories.some((s) => selectedIds.includes(s.id)))
    .map((g) => g.id);
}
