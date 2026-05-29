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
    title: "Emergency Solutions Grant (ESG) – Rapid Re-Housing – NOFO FR-6800-N-25",
    agency: "U.S. Department of Housing and Urban Development (HUD)",
    description: "Federal funding for rapid re-housing activities including short/medium-term rental assistance, housing search, and stabilization services for individuals experiencing homelessness in the Denver metro area. Apply through e-snaps via the HUD Exchange portal.",
    url: "https://www.hudexchange.info/programs/e-snaps/",
    instrument: "Grant",
    structure: "Project Grants",
    level: "Federal",
    categories: ["Housing", "Community Development"],
    amountRange: [75000, 500000],
  },
  {
    title: "Continuum of Care (CoC) Program – FY2025 NOFO Renewal Projects",
    agency: "U.S. Department of Housing and Urban Development (HUD)",
    description: "HUD Continuum of Care competitive funding for permanent supportive housing, transitional housing, and coordinated entry in coordination with the Metro Denver Homeless Initiative (MDHI). Applications submitted through the e-snaps system.",
    url: "https://www.hudexchange.info/programs/e-snaps/",
    instrument: "Cooperative Agreement",
    structure: "Project Grants",
    level: "Federal",
    categories: ["Housing", "Health"],
    amountRange: [150000, 1200000],
  },
  {
    title: "Denver HOST – Shelter Operations & Services RFP FY2026",
    agency: "Denver Department of Housing Stability (HOST)",
    description: "City and County of Denver Request for Proposals for emergency shelter operations, day services, and housing navigation. Submit applications through Denver HOST's Submittable procurement portal.",
    url: "https://denvergov.submittable.com/submit",
    instrument: "Grant",
    structure: "Project Grants",
    level: "Local/Municipal",
    categories: ["Housing", "Community Development"],
    amountRange: [50000, 500000],
  },
  {
    title: "Colorado Homelessness Resolution Program (HRP) – NOFA FY2026",
    agency: "Colorado Division of Housing (DOH/DOLA)",
    description: "State Notice of Funding Availability for emergency shelter, street outreach, rapid re-housing, and homelessness prevention. Managed through the Colorado Division of Housing's Neighborly grants portal. Eligible: nonprofits, local governments, CoC agencies.",
    url: "https://cdola.colorado.gov/housing-funding-opportunities",
    instrument: "Grant",
    structure: "Categorical Grants",
    level: "State",
    categories: ["Housing", "Health"],
    amountRange: [100000, 750000],
  },
  {
    title: "SAMHSA GBHI – Grants for the Benefit of Homeless Individuals FY2026",
    agency: "Substance Abuse & Mental Health Services Administration (SAMHSA)",
    description: "Federal competitive grant for behavioral health treatment and recovery support services for people experiencing homelessness with substance use disorders or mental illness. Apply directly through the SAMHSA grants application portal.",
    url: "https://www.samhsa.gov/grants/how-to-apply",
    instrument: "Cooperative Agreement",
    structure: "Project Grants",
    level: "Federal",
    categories: ["Health", "Community Development"],
    amountRange: [200000, 600000],
  },
  {
    title: "HOME-ARP – American Rescue Plan Supportive Services Allocation",
    agency: "U.S. Department of Housing and Urban Development (HUD)",
    description: "HOME Investment Partnerships – American Rescue Plan funding for supportive services, rental housing, and non-congregate shelter for qualifying populations including homeless individuals and domestic violence survivors.",
    url: "https://www.hudexchange.info/programs/home-arp/",
    instrument: "Grant",
    structure: "Formula Grants",
    level: "Federal",
    categories: ["Housing", "Health", "Community Development"],
    amountRange: [300000, 2000000],
  },
  {
    title: "VA Homeless Providers Grant & Per Diem (GPD) – Transitional Housing",
    agency: "U.S. Department of Veterans Affairs",
    description: "Federal funding for community-based organizations providing transitional housing and supportive services to Veterans experiencing homelessness. Eligible nonprofits must apply through Grants.gov using the current NOFO.",
    url: "https://www.va.gov/homeless/gpd.asp",
    instrument: "Grant",
    structure: "Project Grants",
    level: "Federal",
    categories: ["Housing", "Health"],
    amountRange: [100000, 800000],
  },
  {
    title: "FEMA Emergency Food & Shelter Program (EFSP) – Phase 41",
    agency: "Federal Emergency Management Agency (FEMA)",
    description: "Federal funding distributed through local United Way boards for mass shelter, mass feeding, and emergency rent/mortgage/utility assistance for individuals facing economic emergencies. Apply through your local EFSP board.",
    url: "https://www.efsp.unitedway.org/efsp/website/websiteContents/index.cfm?template=apply.cfm",
    instrument: "Grant",
    structure: "Formula Grants",
    level: "Federal",
    categories: ["Housing", "Community Development"],
    amountRange: [25000, 250000],
  },
  {
    title: "Colorado Health Foundation – Health Equity Grant Cycle (Oct 2026)",
    agency: "Colorado Health Foundation",
    description: "Private foundation competitive grant supporting health equity initiatives in Colorado communities. Funding cycles in February, June, and October. Apply through the Colorado Health Foundation grantee portal after consulting with a Program Officer.",
    url: "https://coloradohealth.org/for-grantees",
    instrument: "Grant",
    structure: "Project Grants",
    level: "Private Foundation",
    categories: ["Health"],
    amountRange: [10000, 100000],
  },
  {
    title: "The Denver Foundation – Community Grants Program 2026",
    agency: "The Denver Foundation",
    description: "Community grants for Metro Denver nonprofits focused on strengthening neighborhoods and addressing homelessness, housing instability, and basic needs. Applications accepted through The Denver Foundation's online portal.",
    url: "https://www.denverfoundation.org/Nonprofits/Apply-for-Funding",
    instrument: "Grant",
    structure: "Project Grants",
    level: "Private Foundation",
    categories: ["Community Development", "Housing"],
    amountRange: [5000, 50000],
  },
  {
    title: "HUD Youth Homelessness Demonstration Program (YHDP) – Round 5",
    agency: "U.S. Department of Housing and Urban Development (HUD)",
    description: "Demonstration funding for communities developing coordinated systems addressing youth homelessness including host homes, rapid re-housing, and transitional living. Apply through e-snaps.",
    url: "https://www.hudexchange.info/programs/yhdp/",
    instrument: "Cooperative Agreement",
    structure: "Project Grants",
    level: "Federal",
    categories: ["Housing", "Education", "Health"],
    amountRange: [250000, 1500000],
  },
  {
    title: "ACF Runaway & Homeless Youth – Basic Center Program (BCP)",
    agency: "Administration for Children and Families (ACF/HHS)",
    description: "Federal formula grant for locally-based emergency shelter, outreach, and counseling services for runaway and homeless youth under 18. Applications through Grants.gov under CFDA 93.623.",
    url: "https://www.grants.gov/search-grants?keywords=basic+center+program+runaway+homeless+youth",
    instrument: "Grant",
    structure: "Formula Grants",
    level: "Federal",
    categories: ["Housing", "Education", "Health"],
    amountRange: [50000, 400000],
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
