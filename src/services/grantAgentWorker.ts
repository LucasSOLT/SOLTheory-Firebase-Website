"use client";

import { collection, addDoc, Timestamp } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import type { GrantAgentConfig } from "@/components/portal/GrantAgentConfigModal";

/* ═══════════════════════════════════════════════════════
   Realistic Mock Grant Data Generator
   Based on grants.gov structural guidelines & real Denver
   homeless shelter / nonprofit funding programs.
   ═══════════════════════════════════════════════════════ */

interface GeneratedGrant {
  title: string;
  description: string;
  agency: string;
  amount: number;
  status: "unapplied";
  orgId: string;
  agentId: string;
  dateSuggested: Timestamp;
  createdAt: Timestamp;
  location_state: string;
  location_city: string;
  url: string;
  eligibility: string;
  fundingInstrument: string;
  activityCategories: string[];
  grantStructures: string[];
  agencyLevels: string[];
  classification: string;
  openDate: Timestamp;
  closeDate: Timestamp;
}

/* ─── Grant Title Templates ─── */
const GRANT_TEMPLATES = [
  {
    title: "Emergency Solutions Grant (ESG) – Rapid Re-Housing Component",
    agency: "U.S. Department of Housing and Urban Development (HUD)",
    description: "Provides funding for rapid re-housing activities including rental assistance, housing relocation, and stabilization services for individuals and families experiencing homelessness in the Denver metropolitan area.",
    url: "https://www.hudexchange.info/programs/esg/",
    instrument: "Grant",
    structure: "Project Grants",
    level: "Federal",
    categories: ["Housing", "Community Development"],
    amountRange: [75000, 500000],
  },
  {
    title: "Continuum of Care (CoC) Program – Permanent Supportive Housing",
    agency: "U.S. Department of Housing and Urban Development (HUD)",
    description: "Supports community-wide commitment to the goal of ending homelessness through permanent supportive housing, transitional housing, and supportive services in coordination with the Metro Denver Homeless Initiative.",
    url: "https://www.hudexchange.info/programs/coc/",
    instrument: "Cooperative Agreement",
    structure: "Project Grants",
    level: "Federal",
    categories: ["Housing", "Health"],
    amountRange: [150000, 1200000],
  },
  {
    title: "Community Development Block Grant (CDBG) – Shelter Rehabilitation",
    agency: "City and County of Denver – Dept. of Housing Stability",
    description: "Funds the rehabilitation of emergency shelter facilities and transitional housing units serving homeless populations in Denver. Eligible activities include structural repairs, ADA compliance, and energy efficiency upgrades.",
    url: "https://www.denvergov.org/Government/Agencies-Departments-Offices/Department-of-Housing-Stability/Funding-Opportunities-Procurement-Resources",
    instrument: "Grant",
    structure: "Block Grants",
    level: "Local/Municipal",
    categories: ["Housing", "Community Development"],
    amountRange: [50000, 350000],
  },
  {
    title: "Transformational Homelessness Response (THR) – Navigation Services",
    agency: "Colorado Department of Local Affairs (DOLA)",
    description: "State-funded initiative to support homeless navigation services, day shelters, and outreach programs in Colorado communities with high rates of unsheltered homelessness. Prioritizes programs in Denver, Colorado Springs, and Boulder.",
    url: "https://cdola.colorado.gov/funding-opportunities",
    instrument: "Grant",
    structure: "Categorical Grants",
    level: "State Pass-Through",
    categories: ["Housing", "Health"],
    amountRange: [100000, 750000],
  },
  {
    title: "SAMHSA Grants for the Benefit of Homeless Individuals (GBHI)",
    agency: "Substance Abuse and Mental Health Services Administration",
    description: "Supports the development and expansion of community infrastructure to provide behavioral health treatment and recovery support services for individuals experiencing homelessness who have substance use disorders and/or mental illness.",
    url: "https://www.samhsa.gov/grants",
    instrument: "Cooperative Agreement",
    structure: "Project Grants",
    level: "Federal",
    categories: ["Health", "Community Development"],
    amountRange: [200000, 600000],
  },
  {
    title: "HOME-ARP Allocation Plan – Qualifying Supportive Services",
    agency: "U.S. Department of Housing and Urban Development (HUD)",
    description: "Funds supportive services for qualifying populations under the HOME Investment Partnerships – American Rescue Plan, including homeless individuals, those at risk of homelessness, domestic violence survivors, and other vulnerable populations.",
    url: "https://www.hudexchange.info/programs/home-arp/",
    instrument: "Grant",
    structure: "Formula Grants",
    level: "Federal",
    categories: ["Housing", "Health", "Community Development"],
    amountRange: [300000, 2000000],
  },
  {
    title: "Denver HOST Rapid Resolution & Diversion Program",
    agency: "Denver Department of Housing Stability (HOST)",
    description: "Provides rapid resolution and diversion services aimed at preventing individuals and families from entering the homeless shelter system. Includes flexible financial assistance, mediation, and system navigation.",
    url: "https://www.denvergov.org/Government/Agencies-Departments-Offices/Department-of-Housing-Stability/Funding-Opportunities-Procurement-Resources",
    instrument: "Grant",
    structure: "Project Grants",
    level: "Local/Municipal",
    categories: ["Housing"],
    amountRange: [25000, 200000],
  },
  {
    title: "Social Services Block Grant (SSBG) – Homeless Support Services",
    agency: "U.S. Department of Health and Human Services (HHS)",
    description: "Block grant supporting a broad range of social services directed toward achieving self-sufficiency, including emergency shelter, case management, employment assistance, and child care for homeless families.",
    url: "https://www.acf.hhs.gov/ocs/programs/ssbg",
    instrument: "Grant",
    structure: "Block Grants",
    level: "Federal",
    categories: ["Health", "Education"],
    amountRange: [50000, 400000],
  },
  {
    title: "HHS Discretionary Grant – Youth Homelessness Demonstration",
    agency: "Administration for Children and Families (ACF)",
    description: "Demonstration project funding for communities to develop and implement coordinated systems for youth experiencing homelessness. Focus areas include host homes, rapid re-housing, and transitional living programs.",
    url: "https://www.grants.gov/search-grants?keywords=youth+homelessness+demonstration",
    instrument: "Cooperative Agreement",
    structure: "Project Grants",
    level: "Federal",
    categories: ["Housing", "Education", "Health"],
    amountRange: [250000, 1500000],
  },
  {
    title: "Colorado Health Foundation – Shelter Health Equity Grant",
    agency: "Colorado Health Foundation",
    description: "Private foundation grant supporting health equity initiatives within homeless shelters and transitional housing in the Denver metro area. Eligible activities include on-site health screenings, mental health counseling, and nutrition programs.",
    url: "https://coloradohealth.org/for-grantees/apply-for-funding",
    instrument: "Grant",
    structure: "Project Grants",
    level: "Private Foundation",
    categories: ["Health"],
    amountRange: [10000, 100000],
  },
  {
    title: "Capacity Building Grant – Nonprofit Shelter Operations",
    agency: "Mile High United Way",
    description: "Strengthens the operational capacity of Denver-area nonprofits providing emergency and transitional shelter services. Funds organizational development, technology upgrades, staff training, and strategic planning.",
    url: "https://unitedwaydenver.org/our-work/",
    instrument: "Grant",
    structure: "Project Grants",
    level: "Private Foundation",
    categories: ["Community Development"],
    amountRange: [15000, 75000],
  },
  {
    title: "Capital Improvement Grant – Shelter Expansion Project",
    agency: "Denver Office of Economic Development & Opportunity",
    description: "Funds brick-and-mortar improvements for homeless shelter facilities in Denver, including new construction, expansion of bed capacity, kitchen renovations, and installation of accessibility features.",
    url: "https://www.denvergov.org/Government/Agencies-Departments-Offices/Economic-Development-Opportunity/Business-Incentives",
    instrument: "Grant",
    structure: "Categorical Grants",
    level: "Local/Municipal",
    categories: ["Housing", "Community Development"],
    amountRange: [100000, 1000000],
  },
];

/* ─── Generator ─── */
function generateMockGrant(agentId: string, config: GrantAgentConfig): GeneratedGrant {
  // Pick a random template
  const template = GRANT_TEMPLATES[Math.floor(Math.random() * GRANT_TEMPLATES.length)];

  // Calculate amount within budget constraints
  let [minAmt, maxAmt] = template.amountRange;
  if (config.budgetMin != null) minAmt = Math.max(minAmt, config.budgetMin);
  if (config.budgetMax != null) maxAmt = Math.min(maxAmt, config.budgetMax);
  if (minAmt > maxAmt) maxAmt = minAmt + 50000;
  const amount = Math.round((minAmt + Math.random() * (maxAmt - minAmt)) / 1000) * 1000;

  // Generate realistic open/close dates
  const now = new Date();
  const openDate = new Date(now);
  openDate.setDate(openDate.getDate() - Math.floor(Math.random() * 14)); // opened within last 2 weeks
  const closeDate = new Date(openDate);
  closeDate.setDate(closeDate.getDate() + 30 + Math.floor(Math.random() * 60)); // 30-90 day window

  // Add slight variation to title to avoid exact duplicates
  const fiscalYear = now.getFullYear();
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  const variantTitle = `${template.title} — FY${fiscalYear} ${quarter}`;

  return {
    title: variantTitle,
    description: template.description,
    agency: template.agency,
    amount,
    status: "unapplied",
    orgId: "soltheory",
    agentId,
    dateSuggested: Timestamp.now(),
    createdAt: Timestamp.now(),
    location_state: config.locationState || "Colorado",
    location_city: config.locationCity || "Denver",
    url: template.url,
    eligibility: "Nonprofits with 501(c)(3) IRS Status (Other than Institutions of Higher Education)",
    fundingInstrument: template.instrument,
    activityCategories: template.categories,
    grantStructures: [template.structure],
    agencyLevels: [template.level],
    classification: "Nonprofits 501(c)(3)",
    openDate: Timestamp.fromDate(openDate),
    closeDate: Timestamp.fromDate(closeDate),
  };
}

/* ═══════════════════════════════════════════════════════
   Agent Worker Manager
   ═══════════════════════════════════════════════════════ */

interface WorkerHandle {
  agentId: string;
  intervalId: ReturnType<typeof setInterval>;
  config: GrantAgentConfig;
}

const activeWorkers = new Map<string, WorkerHandle>();

/**
 * Convert config interval to milliseconds.
 * Minimum floor of 30 seconds to prevent abuse.
 */
function intervalToMs(value: number, unit: string): number {
  const multipliers: Record<string, number> = {
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
    weeks: 604_800_000,
  };
  const ms = value * (multipliers[unit] || 60_000);
  return Math.max(ms, 30_000); // minimum 30s
}

/**
 * Execute a single agent scan: generate a mock grant and write it to Firestore.
 */
async function executeAgentScan(
  firestore: Firestore,
  agentId: string,
  config: GrantAgentConfig
): Promise<string | null> {
  try {
    const grant = generateMockGrant(agentId, config);
    const grantsRef = collection(firestore, "grant_suggestions");
    const docRef = await addDoc(grantsRef, grant);
    console.log(`[GrantAgent:${agentId}] Discovered grant: "${grant.title}" → ${docRef.id}`);
    return docRef.id;
  } catch (err) {
    console.error(`[GrantAgent:${agentId}] Scan failed:`, err);
    return null;
  }
}

/**
 * Start a background worker for a specific agent.
 * Runs the first scan immediately, then at the configured interval.
 */
export function startAgentWorker(
  firestore: Firestore,
  agentId: string,
  config: GrantAgentConfig,
  onGrantFound?: (grantId: string) => void
) {
  // Stop existing worker if any
  stopAgentWorker(agentId);

  const ms = intervalToMs(config.intervalValue, config.intervalUnit);

  console.log(
    `[GrantAgent:${agentId}] Starting worker — scanning every ${config.intervalValue} ${config.intervalUnit} (${ms}ms)`
  );

  // Run immediately on start
  executeAgentScan(firestore, agentId, config).then((id) => {
    if (id && onGrantFound) onGrantFound(id);
  });

  // Set up recurring interval
  const intervalId = setInterval(async () => {
    const id = await executeAgentScan(firestore, agentId, config);
    if (id && onGrantFound) onGrantFound(id);
  }, ms);

  activeWorkers.set(agentId, { agentId, intervalId, config });
}

/**
 * Stop a specific agent's background worker.
 */
export function stopAgentWorker(agentId: string) {
  const handle = activeWorkers.get(agentId);
  if (handle) {
    clearInterval(handle.intervalId);
    activeWorkers.delete(agentId);
    console.log(`[GrantAgent:${agentId}] Worker stopped`);
  }
}

/**
 * Stop all running agent workers.
 */
export function stopAllAgentWorkers() {
  activeWorkers.forEach((handle) => {
    clearInterval(handle.intervalId);
  });
  activeWorkers.clear();
  console.log("[GrantAgent] All workers stopped");
}

/**
 * Get the count of currently running workers.
 */
export function getActiveWorkerCount(): number {
  return activeWorkers.size;
}
