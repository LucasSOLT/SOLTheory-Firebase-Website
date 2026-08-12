"use client";

import { useEffect, useState, useMemo } from "react";
import { useFirestore } from "@/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  orderBy,
  Timestamp,
} from "firebase/firestore";

/* ── Types ─────────────────────────────────────────────── */

export interface CRMContact {
  id: string;
  firstName: string;
  lastName: string;
  leadStatus: string;
  totalRevenue: number;
  outstandingBalance: number;
  transactions: { id: string; date: string; description: string; amount: number }[];
  createdAt: any;
}

export interface GrantSuggestion {
  id: string;
  title: string;
  status: string; // unreviewed | bookmarked | drafting | submitted | awarded | denied
  matchScore: number;
  awardAmountMin: number | null;
  awardAmountMax: number | null;
  postedDate: string;
  closeDate: string;
  createdAt: any;
}

export interface TimesheetEntry {
  id: string;
  userName: string;
  userEmail: string;
  startDate: string;
  durationMinutes: number;
  billableRate: number | null;
  serviceName: string;
  notes: string;
  createdAt: any;
}

export interface InstagramPost {
  id: string;
  status: string; // draft | scheduled | processing | published | failed
  scheduledTime: any;
  campaignGoal: string;
  createdAt: any;
}

export type DateRange = "7d" | "30d" | "90d" | "all";

/* ── Helpers ───────────────────────────────────────────── */

function cutoffDate(range: DateRange): Date | null {
  if (range === "all") return null;
  const now = new Date();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 86_400_000);
}

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (v?.seconds) return new Date(v.seconds * 1000);
  return null;
}

function afterCutoff(dateVal: any, cutoff: Date | null): boolean {
  if (!cutoff) return true;
  const d = toDate(dateVal);
  return d ? d >= cutoff : true; // keep items without dates
}

/* ── Hook ──────────────────────────────────────────────── */

export interface BIPipelineStage {
  id: string;
  name: string;
  color: string;
  probability: number;
}

export interface BIPipelineConfig {
  id: string;
  name: string;
  stages: BIPipelineStage[];
}

export interface BIData {
  crmContacts: CRMContact[];
  grants: GrantSuggestion[];
  timesheetEntries: TimesheetEntry[];
  instagramPosts: InstagramPost[];
  pipelineConfig: BIPipelineConfig | null;
  isLoading: boolean;
  error: string | null;
}

export function useBIData(orgId: string, dateRange: DateRange): BIData {
  const firestore = useFirestore();
  const [crmRaw, setCrmRaw] = useState<CRMContact[]>([]);
  const [grantsRaw, setGrantsRaw] = useState<GrantSuggestion[]>([]);
  const [timesheetsRaw, setTimesheetsRaw] = useState<TimesheetEntry[]>([]);
  const [instaRaw, setInstaRaw] = useState<InstagramPost[]>([]);
  const [pipelineConfig, setPipelineConfig] = useState<BIPipelineConfig | null>(null);
  const [loadingFlags, setLoadingFlags] = useState({ crm: true, grants: true, ts: true, ig: true, pipeline: true });
  const [error, setError] = useState<string | null>(null);

  // ── Pipeline Config ──
  useEffect(() => {
    if (!firestore || !orgId) return;
    const docRef = doc(firestore, "orgs", orgId, "crm-instances", "default", "settings", "pipelineConfig");
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setPipelineConfig(snap.data() as BIPipelineConfig);
      }
      setLoadingFlags((f) => ({ ...f, pipeline: false }));
    }, (err) => {
      console.error("[BI] Pipeline config snapshot error:", err);
      setLoadingFlags((f) => ({ ...f, pipeline: false }));
    });
    return unsub;
  }, [firestore, orgId]);

  // ── CRM Contacts ──
  useEffect(() => {
    if (!firestore || !orgId) return;
    const ref = collection(firestore, "orgs", orgId, "crm-instances", "default", "contacts");
    const unsub = onSnapshot(ref, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CRMContact));
      setCrmRaw(docs);
      setLoadingFlags((f) => ({ ...f, crm: false }));
    }, (err) => {
      console.error("[BI] CRM snapshot error:", err);
      setLoadingFlags((f) => ({ ...f, crm: false }));
    });
    return unsub;
  }, [firestore, orgId]);

  // ── Grants ──
  useEffect(() => {
    if (!firestore || !orgId) return;
    const q = query(
      collection(firestore, "grant_suggestions"),
      where("orgId", "==", orgId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as GrantSuggestion));
      setGrantsRaw(docs);
      setLoadingFlags((f) => ({ ...f, grants: false }));
    }, (err) => {
      console.error("[BI] Grants snapshot error:", err);
      setLoadingFlags((f) => ({ ...f, grants: false }));
    });
    return unsub;
  }, [firestore, orgId]);

  // ── Timesheets ──
  useEffect(() => {
    if (!firestore || !orgId) return;
    const orgDomain = `${orgId}.com`;
    const q = query(
      collection(firestore, "timesheet_entries"),
      where("orgDomain", "==", orgDomain)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimesheetEntry));
      setTimesheetsRaw(docs);
      setLoadingFlags((f) => ({ ...f, ts: false }));
    }, (err) => {
      console.error("[BI] Timesheets snapshot error:", err);
      setLoadingFlags((f) => ({ ...f, ts: false }));
    });
    return unsub;
  }, [firestore, orgId]);

  // ── Instagram Posts ──
  useEffect(() => {
    if (!firestore || !orgId) return;
    const q = query(
      collection(firestore, "scheduled_instagram_posts"),
      where("clientId", "==", orgId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InstagramPost));
      setInstaRaw(docs);
      setLoadingFlags((f) => ({ ...f, ig: false }));
    }, (err) => {
      console.error("[BI] Instagram snapshot error:", err);
      setLoadingFlags((f) => ({ ...f, ig: false }));
    });
    return unsub;
  }, [firestore, orgId]);

  // ── Date-range filtering (memoized) ──
  const cutoff = useMemo(() => cutoffDate(dateRange), [dateRange]);

  const crmContacts = useMemo(
    () => crmRaw.filter((c) => afterCutoff(c.createdAt, cutoff)),
    [crmRaw, cutoff]
  );
  const grants = useMemo(
    () => grantsRaw.filter((g) => afterCutoff(g.createdAt ?? g.postedDate, cutoff)),
    [grantsRaw, cutoff]
  );
  const timesheetEntries = useMemo(
    () => timesheetsRaw.filter((t) => afterCutoff(t.startDate, cutoff)),
    [timesheetsRaw, cutoff]
  );
  const instagramPosts = useMemo(
    () => instaRaw.filter((p) => afterCutoff(p.createdAt ?? p.scheduledTime, cutoff)),
    [instaRaw, cutoff]
  );

  const isLoading = Object.values(loadingFlags).some(Boolean);

  return { crmContacts, grants, timesheetEntries, instagramPosts, pipelineConfig, isLoading, error };
}
