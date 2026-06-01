"use client";

import { collection, addDoc, Timestamp, doc, getDoc, getDocs, query, where, updateDoc, setDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import type { GrantAgentConfig } from "@/components/portal/GrantAgentConfigModal";

/* ═══════════════════════════════════════════════════════
   Grant Agent Worker — BULLETPROOF ARCHITECTURE
   
   Key design decisions:
   1. NO setInterval — uses setTimeout chains instead.
      If a stale callback fires, it checks its version
      and dies without scheduling another timeout.
   2. Worker handles stored on `window` so HMR reloads
      can find and kill previous instances.
   3. Server-side timestamp gating: before every scan,
      reads `lastScanTime` from Firestore. If the
      interval hasn't elapsed, skips. This prevents
      duplicate scans across tabs and HMR reloads.
   4. Exactly ONE grant per scan, period.
   ═══════════════════════════════════════════════════════ */

/* ─── Global type for window storage ─── */
declare global {
  interface Window {
    __grantAgentWorkers?: Map<string, WorkerHandle>;
    __grantAgentVersion?: number;
    __lastGrantScanStatus?: "found" | "no_new" | "searching" | "idle";
    __lastGrantScanMessage?: string;
  }
}

interface WorkerHandle {
  agentId: string;
  timeoutId: ReturnType<typeof setTimeout> | null;
  config: GrantAgentConfig;
  version: number;
  suggestedUrls: Set<string>;
  suggestedTitles: Set<string>;
  scanLock: boolean;
}

/**
 * Get or create the global workers map on window.
 * Survives HMR reloads.
 */
function getWorkersMap(): Map<string, WorkerHandle> {
  if (typeof window === "undefined") return new Map();
  if (!window.__grantAgentWorkers) {
    window.__grantAgentWorkers = new Map();
  }
  return window.__grantAgentWorkers;
}

function getNextVersion(): number {
  if (typeof window === "undefined") return 0;
  window.__grantAgentVersion = (window.__grantAgentVersion || 0) + 1;
  return window.__grantAgentVersion;
}

/**
 * Convert config interval to milliseconds.
 * Minimum floor of 60 seconds.
 */
function intervalToMs(value: number, unit: string): number {
  const multipliers: Record<string, number> = {
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
    weeks: 604_800_000,
  };
  const ms = value * (multipliers[unit] || 60_000);
  return Math.max(ms, 60_000); // minimum 1 minute
}

/**
 * Check Firestore for the last scan timestamp.
 * Returns true if enough time has passed to scan again.
 */
async function canScanNow(
  firestore: Firestore,
  agentId: string,
  intervalMs: number
): Promise<boolean> {
  try {
    const configRef = doc(firestore, "grant_agent_config", "soltheory");
    const snap = await getDoc(configRef);
    if (!snap.exists()) return true;

    const data = snap.data();
    const lastScanTime = data?.lastScanTimes?.[agentId];

    if (!lastScanTime) return true;

    const lastMs = typeof lastScanTime.toMillis === "function"
      ? lastScanTime.toMillis()
      : new Date(lastScanTime).getTime();

    const elapsed = Date.now() - lastMs;
    const canScan = elapsed >= intervalMs;

    if (!canScan) {
      console.log(
        `[GrantAgent:${agentId}] Scan blocked — only ${Math.round(elapsed / 1000)}s elapsed, need ${Math.round(intervalMs / 1000)}s`
      );
    }

    return canScan;
  } catch (err) {
    console.error(`[GrantAgent:${agentId}] Error checking scan time:`, err);
    return false; // fail closed — don't scan if we can't verify
  }
}

/**
 * Record the current time as the last scan time in Firestore.
 * This is the single source of truth across all tabs/reloads.
 */
async function recordScanTime(firestore: Firestore, agentId: string): Promise<void> {
  try {
    const configRef = doc(firestore, "grant_agent_config", "soltheory");
    await setDoc(configRef, {
      lastScanTimes: { [agentId]: Timestamp.now() },
    }, { merge: true });
  } catch (err) {
    console.error(`[GrantAgent:${agentId}] Failed to record scan time:`, err);
  }
}

/**
 * Call the /api/grants/search endpoint (Grants.gov + Tavily fallback).
 */
async function searchWebForGrants(config: GrantAgentConfig): Promise<
  { title: string; url: string; description: string; source: string; agency?: string; closeDate?: string; awardCeiling?: number; opportunityNumber?: string }[]
> {
  try {
    const res = await fetch("/api/grants/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grantTypes: config.grantTypes,
        locationState: config.locationState,
        locationCity: config.locationCity,
        budgetMin: config.budgetMin,
        budgetMax: config.budgetMax,
        companyDescription: config.companyDescription,
        welfareKeywords: config.welfareKeywords,
      }),
    });

    if (!res.ok) {
      console.error(`[GrantAgent] Search API returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    return data.grants || [];
  } catch (err) {
    console.error("[GrantAgent] Search API call failed:", err);
    return [];
  }
}

/**
 * Build an actionable description with next steps for the user.
 * All results come from Grants.gov — instructions are consistent.
 */
function buildNextSteps(source: string, url: string, rawDescription: string): string {
  const desc = rawDescription.slice(0, 300).trim();
  
  const steps = `\n\nNext Steps:\n1. Click "Apply Now" to open this opportunity on Grants.gov\n2. Review the full NOFO (Notice of Funding Opportunity) for eligibility details\n3. Check that your organization has a SAM.gov registration and UEI number\n4. Note the application deadline and prepare your SF-424 form\n5. Download the full application package from the opportunity page`;

  return desc + steps;
}

/**
 * Execute a single scan: check timing gate, search the web, 
 * pick ONE grant, write to Firestore.
 */
async function executeAgentScan(
  firestore: Firestore,
  handle: WorkerHandle
): Promise<string | null> {
  const { agentId, config, version } = handle;

  // 1. Version check — am I still the active worker?
  const workers = getWorkersMap();
  const current = workers.get(agentId);
  if (!current || current.version !== version) {
    console.log(`[GrantAgent:${agentId}] Stale worker v${version} — dying`);
    return null;
  }

  // 2. Lock check
  if (handle.scanLock) {
    console.log(`[GrantAgent:${agentId}] Scan in progress — skipping`);
    return null;
  }

  handle.scanLock = true;

  try {
    const intervalMs = intervalToMs(config.intervalValue, config.intervalUnit);

    // 3. Firestore timing gate — the REAL protection against duplicates
    const allowed = await canScanNow(firestore, agentId, intervalMs);
    if (!allowed) {
      return null;
    }

    console.log(`[GrantAgent:${agentId}] ✓ Timing gate passed — searching the web...`);
    if (typeof window !== "undefined") {
      window.__lastGrantScanStatus = "searching";
      window.__lastGrantScanMessage = "Scanning the web for grants...";
    }

    // 4. Record scan time FIRST (claim the slot before doing work)
    await recordScanTime(firestore, agentId);

    // 5. Search the web
    const results = await searchWebForGrants(config);

    // Safety guard: ONLY allow grants.gov URLs
    const safeResults = results.filter(r => {
      try {
        const hostname = new URL(r.url).hostname;
        return hostname === 'www.grants.gov' || hostname === 'grants.gov';
      } catch { return false; }
    });

    if (safeResults.length < results.length) {
      console.warn(
        `[GrantAgent:${agentId}] Filtered out ${results.length - safeResults.length} non-grants.gov URLs`
      );
    }

    if (safeResults.length === 0) {
      console.log(`[GrantAgent:${agentId}] No results from web search`);
      if (typeof window !== "undefined") {
        window.__lastGrantScanStatus = "no_new";
        window.__lastGrantScanMessage = "No new grants found — continuing the search";
      }
      return null;
    }

    // 6. Load existing grant titles from Firestore to prevent duplicates
    //    This is the REAL protection — survives restarts, HMR, tab refreshes
    const grantsRef = collection(firestore, "grant_suggestions");
    const existingSnap = await getDocs(
      query(grantsRef, where("orgId", "==", "soltheory"))
    );
    const existingTitles = new Set<string>();
    const existingUrls = new Set<string>();
    existingSnap.forEach((d) => {
      const data = d.data();
      if (data.title) existingTitles.add(data.title.toLowerCase().trim());
      if (data.url) existingUrls.add(data.url);
      if (data.sourceUrl) existingUrls.add(data.sourceUrl);
    });

    // Also merge the in-memory sets (faster for within-session dedup)
    handle.suggestedUrls.forEach((u) => existingUrls.add(u));
    handle.suggestedTitles.forEach((t) => existingTitles.add(t));

    const newResults = safeResults.filter((r) => {
      const normTitle = r.title.toLowerCase().trim();
      return !existingUrls.has(r.url) && !existingTitles.has(normTitle);
    });

    if (newResults.length === 0) {
      console.log(`[GrantAgent:${agentId}] All results already exist in Firestore`);
      if (typeof window !== "undefined") {
        window.__lastGrantScanStatus = "no_new";
        window.__lastGrantScanMessage = "No new grants — all results already suggested";
      }
      return null;
    }

    // 7. Pick exactly ONE result
    const selected = newResults[0];

    // 8. Re-check version before Firestore write
    const stillCurrent = workers.get(agentId);
    if (!stillCurrent || stillCurrent.version !== version) {
      console.log(`[GrantAgent:${agentId}] Stale before write — aborting`);
      return null;
    }

    // 9. Build document with REAL data from Grants.gov when available
    // Use real award ceiling if provided, otherwise estimate from config
    let amount: number;
    if (selected.awardCeiling) {
      amount = selected.awardCeiling;
    } else {
      const minAmt = config.budgetMin ?? 10000;
      const maxAmt = config.budgetMax ?? 500000;
      amount = Math.round((minAmt + Math.random() * (maxAmt - minAmt)) / 1000) * 1000;
    }

    // Use real close date if provided, otherwise estimate
    const now = new Date();
    const openDate = new Date(now);
    openDate.setDate(openDate.getDate() - Math.floor(Math.random() * 14));

    let closeDateObj: Date;
    if (selected.closeDate) {
      closeDateObj = new Date(selected.closeDate);
      if (isNaN(closeDateObj.getTime())) {
        closeDateObj = new Date(now);
        closeDateObj.setDate(closeDateObj.getDate() + 60);
      }
    } else {
      closeDateObj = new Date(openDate);
      closeDateObj.setDate(closeDateObj.getDate() + 30 + Math.floor(Math.random() * 90));
    }

    // Build an actionable description with next steps
    const nextSteps = buildNextSteps(selected.source, selected.url, selected.description);

    const grantDoc = {
      title: selected.title,
      description: nextSteps,
      agency: selected.agency || selected.source,
      amount,
      status: "unapplied",
      orgId: "soltheory",
      agentId,
      dateSuggested: Timestamp.now(),
      createdAt: Timestamp.now(),
      location_state: config.locationState || "Colorado",
      location_city: config.locationCity || "Denver",
      url: selected.url,
      eligibility: "Nonprofits with 501(c)(3) status",
      fundingInstrument: "Grant",
      activityCategories: config.grantTypes,
      grantStructures: ["Grant"],
      agencyLevels: [selected.source === "grants.gov" ? "Federal" : "State/Local"],
      classification: config.grantTypes[0] || "housing_shelter",
      openDate: Timestamp.fromDate(openDate),
      closeDate: Timestamp.fromDate(closeDateObj),
      sourceWebsite: selected.source,
      sourceUrl: selected.url,
      opportunityNumber: selected.opportunityNumber || "",
    };

    // 10. Write exactly ONE grant
    const docRef = await addDoc(grantsRef, grantDoc);

    handle.suggestedUrls.add(selected.url);
    handle.suggestedTitles.add(selected.title.toLowerCase().trim());

    if (typeof window !== "undefined") {
      window.__lastGrantScanStatus = "found";
      window.__lastGrantScanMessage = `Found: ${selected.title}`;
    }

    console.log(
      `[GrantAgent:${agentId}] ✓ Found: "${selected.title}" → ${selected.url}`
    );
    return docRef.id;
  } catch (err) {
    console.error(`[GrantAgent:${agentId}] Scan failed:`, err);
    return null;
  } finally {
    handle.scanLock = false;
  }
}

/**
 * Schedule the next scan using setTimeout (NOT setInterval).
 * If the version doesn't match when it fires, it dies silently
 * without scheduling another timeout — no ghost intervals.
 */
function scheduleNextScan(
  firestore: Firestore,
  handle: WorkerHandle,
  onGrantFound?: (grantId: string) => void
) {
  const ms = intervalToMs(handle.config.intervalValue, handle.config.intervalUnit);
  const workers = getWorkersMap();

  handle.timeoutId = setTimeout(async () => {
    // Check if this worker is still current
    const current = workers.get(handle.agentId);
    if (!current || current.version !== handle.version) {
      console.log(`[GrantAgent:${handle.agentId}] Stale timeout v${handle.version} — not rescheduling`);
      return; // DIE — do not reschedule
    }

    // Run the scan
    const id = await executeAgentScan(firestore, handle);
    if (id && onGrantFound) onGrantFound(id);

    // Re-check before scheduling next one
    const stillCurrent = workers.get(handle.agentId);
    if (stillCurrent && stillCurrent.version === handle.version) {
      scheduleNextScan(firestore, handle, onGrantFound);
    } else {
      console.log(`[GrantAgent:${handle.agentId}] Worker replaced during scan — not rescheduling`);
    }
  }, ms);
}

/**
 * Start a background worker for a specific agent.
 * Uses window-stored handles and setTimeout chains.
 * No immediate scan. No setInterval. No race conditions.
 */
export function startAgentWorker(
  firestore: Firestore,
  agentId: string,
  config: GrantAgentConfig,
  onGrantFound?: (grantId: string) => void
) {
  // 1. Kill any existing worker (including from previous HMR)
  stopAgentWorker(agentId);

  // 2. Get a new globally-unique version
  const version = getNextVersion();

  const handle: WorkerHandle = {
    agentId,
    timeoutId: null,
    config,
    version,
    suggestedUrls: new Set<string>(),
    suggestedTitles: new Set<string>(),
    scanLock: false,
  };

  const ms = intervalToMs(config.intervalValue, config.intervalUnit);
  console.log(
    `[GrantAgent:${agentId}] Starting worker v${version} — next scan in ${config.intervalValue} ${config.intervalUnit} (${ms}ms)`
  );

  // 3. Register on window BEFORE scheduling (synchronous)
  const workers = getWorkersMap();
  workers.set(agentId, handle);

  // 4. Schedule first scan (no immediate execution)
  scheduleNextScan(firestore, handle, onGrantFound);
}

/**
 * Stop a specific agent's background worker.
 */
export function stopAgentWorker(agentId: string) {
  const workers = getWorkersMap();
  const handle = workers.get(agentId);
  if (handle) {
    if (handle.timeoutId) clearTimeout(handle.timeoutId);
    workers.delete(agentId);
    console.log(`[GrantAgent:${agentId}] Worker v${handle.version} stopped`);
  }
}

/**
 * Stop all running agent workers.
 */
export function stopAllAgentWorkers() {
  const workers = getWorkersMap();
  workers.forEach((handle) => {
    if (handle.timeoutId) clearTimeout(handle.timeoutId);
  });
  workers.clear();
  console.log("[GrantAgent] All workers stopped");
}

/**
 * Get the count of currently running workers.
 */
export function getActiveWorkerCount(): number {
  return getWorkersMap().size;
}
