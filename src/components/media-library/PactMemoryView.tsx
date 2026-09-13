"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useUser, useFirestore } from "@/firebase";
import { getAuthHeaders } from "@/lib/api-auth-client";
import { logActivity } from "@/lib/activity-logger";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Trash2,
  Loader2,
  RotateCcw,
  Check,
  AlertTriangle,
  Info,
  Shield,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export interface PACTEntry {
  id: string;
  question: string;
  answer: string;
  source: string;
  orgId: string;
  createdAt: number;
  updatedAt: number;
  markedForDeletion?: number;
  deletionReason?: string;
  scannedAt?: number; // legacy — kept for compat but no longer used for filtering
  // Review history fields
  reviewCount?: number;
  lastReviewedAt?: number;
  lastReviewResult?: "kept" | "flagged";
  lastReviewReason?: string;
  userRestored?: boolean; // true if user manually restored after AI flagging
}

interface ToastMessage {
  id: string;
  text: string;
  type: "info" | "success" | "warn" | "error";
}

interface PactMemoryViewProps {
  orgId: string;
  isDark?: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   LAYER 1 — DETERMINISTIC PATTERN FILTERS
   Catches obvious junk before any AI call.
   Runs on EVERY sweep regardless of review history.
   ═══════════════════════════════════════════════════════════════ */

interface FilterResult {
  shouldDelete: boolean;
  reason: string;
}

function applyDeterministicFilter(question: string, answer: string): FilterResult {
  const q = question.toLowerCase().trim();
  const a = answer.toLowerCase().trim();

  // ── Temporal / ephemeral states ──
  if (
    q.includes("current temporal context") ||
    q.includes("currently") ||
    q.includes("right now") ||
    q.match(/^(is|was) the user (currently|presently|right now|now)/) ||
    q.match(/what is the user (doing|trying|attempting) (right now|currently|now|at the moment)/)
  ) {
    return { shouldDelete: true, reason: "Ephemeral state — not a lasting fact" };
  }

  // ── Meta-AI commands / tool expectations ──
  if (
    q.includes("want the ai to") ||
    q.includes("want jarvis to") ||
    q.includes("expect the ai to") ||
    q.includes("what tool does the user expect") ||
    q.includes("what does the user want the ai") ||
    q.includes("does the user want jarvis")
  ) {
    return { shouldDelete: true, reason: "AI command — not a personal fact" };
  }

  // ── Action-in-progress ──
  if (
    q.match(/^(is|was) the user (trying|attempting|working on|in the process)/) ||
    q.match(/what (is|was) the user trying to/) ||
    q.match(/what (action|task) (did|does|is) the user/)
  ) {
    return { shouldDelete: true, reason: "Temporary action — not a lasting fact" };
  }

  // ── Self-referential AI conversation ──
  if (
    q.includes("conversation with jarvis") ||
    q.includes("chatting with jarvis") ||
    q.includes("interaction with the ai") ||
    q.includes("conversation with the ai")
  ) {
    return { shouldDelete: true, reason: "Self-referential — trivially obvious" };
  }

  // ── Inbox / browsing chatter ──
  if (
    q.match(/^is the user (checking|browsing|looking at|viewing|in) (their|the|an)?\s?(inbox|email|dashboard|page|screen)/) ||
    q.includes("checking their inbox")
  ) {
    return { shouldDelete: true, reason: "Transient browsing state" };
  }

  // ── Ultra-short binary answers with no real info ──
  if (a.length <= 5 && (a === "yes" || a === "no" || a === "yes." || a === "no." || a === "true" || a === "false")) {
    return { shouldDelete: true, reason: "Binary answer with no detail" };
  }

  // ── "What is the user trying to do with the AI" ──
  if (
    q.includes("trying to do with the ai") ||
    q.includes("trying to accomplish with") ||
    q.includes("user's goal with the ai") ||
    q.includes("user's intent with")
  ) {
    return { shouldDelete: true, reason: "Temporary AI task — not a lasting fact" };
  }

  return { shouldDelete: false, reason: "" };
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function PactMemoryView({ orgId, isDark = false }: PactMemoryViewProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const agentId = "jarvis";

  const [pactEntries, setPactEntries] = useState<PACTEntry[]>([]);
  const [pactLoaded, setPactLoaded] = useState(false);
  const [pactEnabled, setPactEnabled] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [reviewProgress, setReviewProgress] = useState("");
  const [pactTickNow, setPactTickNow] = useState(Date.now());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const reviewLockRef = useRef(false);

  const showToast = useCallback((text: string, type: ToastMessage["type"] = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = pactEntries.length;
    const expiring = pactEntries.filter((e) => !!e.markedForDeletion).length;
    const active = total - expiring;
    // Find most recent review timestamp across all entries
    const lastReviewedAt = pactEntries.reduce((max, e) => Math.max(max, e.lastReviewedAt || 0), 0);
    return { total, expiring, active, lastReviewedAt };
  }, [pactEntries]);

  // ─── Format relative time ─────────────────────────────────────────────────
  const formatRelativeTime = useCallback((ts: number) => {
    if (!ts) return "";
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, []);

  // ─── Fetch PACT Entries ───────────────────────────────────────────────────
  const fetchPACTEntries = useCallback(async () => {
    if (!user?.uid || !firestore) return;
    try {
      const { getDoc, doc } = await import("firebase/firestore");
      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      const entries: PACTEntry[] = [];
      const fieldData = userDoc.data()?.[`pact_entries_${orgId}`] || [];
      fieldData.forEach((item: any, index: number) => {
        entries.push({
          id: `field-${index}`,
          question: item.question,
          answer: item.answer,
          source: item.source || "server_background",
          orgId: orgId,
          createdAt: item.createdAt || Date.now(),
          updatedAt: item.updatedAt || Date.now(),
          markedForDeletion: item.markedForDeletion || undefined,
          deletionReason: item.deletionReason || undefined,
          scannedAt: item.scannedAt || undefined,
          reviewCount: item.reviewCount || 0,
          lastReviewedAt: item.lastReviewedAt || undefined,
          lastReviewResult: item.lastReviewResult || undefined,
          lastReviewReason: item.lastReviewReason || undefined,
          userRestored: item.userRestored || undefined,
        });
      });
      entries.sort((a, b) => b.createdAt - a.createdAt);
      setPactEntries(entries);
      setPactLoaded(true);
    } catch (err) {
      console.error("Failed to load PACT entries", err);
      setPactLoaded(true);
    }
  }, [user?.uid, firestore, orgId]);

  useEffect(() => {
    if (user?.uid && firestore) fetchPACTEntries();
  }, [user?.uid, firestore, fetchPACTEntries]);

  // ─── Persist Enabled ──────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(`st_pact_enabled_${agentId}`);
    if (saved !== null) setPactEnabled(saved === "true");
  }, [agentId]);
  useEffect(() => {
    localStorage.setItem(`st_pact_enabled_${agentId}`, String(pactEnabled));
  }, [pactEnabled, agentId]);

  // ─── REVIEW MEMORY ITEMS — Full Sweep Pipeline ───────────────────────────
  const handleReviewFacts = useCallback(async () => {
    if (reviewLockRef.current || !user?.uid || !firestore) return;

    // Full sweep: process ALL active (non-deleted) entries
    const activeEntries = pactEntries.filter((e) => !e.markedForDeletion);
    if (activeEntries.length === 0) {
      showToast("No active memory items to review.", "info");
      return;
    }

    reviewLockRef.current = true;
    setReviewing(true);

    try {
      const { getDoc, doc, updateDoc } = await import("firebase/firestore");
      const userDocRef = doc(firestore, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      let currentEntries: any[] = userDocSnap.data()?.[`pact_entries_${orgId}`] || [];

      // Purge expired items first
      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;
      currentEntries = currentEntries.filter(
        (e: any) => !(e.markedForDeletion && now - e.markedForDeletion > DAY_MS)
      );

      // Get only active entries from the fresh data
      const freshActive = currentEntries.filter((e: any) => !e.markedForDeletion);

      // ═══ LAYER 1: Deterministic Pattern Filters ═══
      setReviewProgress(`Scanning ${freshActive.length} items with pattern filters...`);

      const patternFlagged: { question: string; answer: string; reason: string }[] = [];
      const needsAI: { question: string; answer: string; reviewCount: number; lastReviewResult?: string; lastReviewReason?: string; userRestored?: boolean }[] = [];

      freshActive.forEach((entry: any) => {
        // User-restored items bypass Layer 1 pattern filters — user explicitly wants them
        if (entry.userRestored) {
          needsAI.push({
            question: entry.question,
            answer: entry.answer,
            reviewCount: entry.reviewCount || 0,
            lastReviewResult: entry.lastReviewResult,
            lastReviewReason: entry.lastReviewReason,
            userRestored: true,
          });
          return;
        }

        const result = applyDeterministicFilter(entry.question, entry.answer);
        if (result.shouldDelete) {
          patternFlagged.push({ question: entry.question, answer: entry.answer, reason: result.reason });
        } else {
          needsAI.push({
            question: entry.question,
            answer: entry.answer,
            reviewCount: entry.reviewCount || 0,
            lastReviewResult: entry.lastReviewResult,
            lastReviewReason: entry.lastReviewReason,
            userRestored: entry.userRestored || false,
          });
        }
      });

      // ═══ LAYER 2: Gemini Flash AI Evaluation (in batches of 25) ═══
      const BATCH_SIZE = 25;
      const aiFlagged: { question: string; answer: string; reason: string }[] = [];
      const aiKept: { question: string; answer: string; reason: string }[] = [];

      if (needsAI.length > 0) {
        const batches: typeof needsAI[] = [];
        for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
          batches.push(needsAI.slice(i, i + BATCH_SIZE));
        }

        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
          const batch = batches[batchIdx];
          setReviewProgress(
            `Evaluating batch ${batchIdx + 1}/${batches.length} with AI (${batch.length} items)...`
          );

          try {
            const res = await fetch("/api/pact-evaluate", {
              method: "POST",
              headers: await getAuthHeaders(),
              body: JSON.stringify({
                entries: batch.map((e) => ({
                  question: e.question,
                  answer: e.answer,
                  reviewCount: e.reviewCount,
                  lastReviewResult: e.lastReviewResult,
                  lastReviewReason: e.lastReviewReason,
                  userRestored: e.userRestored,
                })),
                userName: user?.displayName || undefined,
              }),
            });

            if (!res.ok) {
              console.warn(`[PACT Review] Batch ${batchIdx + 1} API error: ${res.status}`);
              batch.forEach((e) => aiKept.push({ question: e.question, answer: e.answer, reason: "API error — kept safely" }));
              continue;
            }

            const data = await res.json();
            const decisions: any[] = data.decisions || [];

            batch.forEach((entry, entryIdx) => {
              const decision = decisions.find((d: any) => d.index === entryIdx);
              if (decision && decision.keep === false) {
                aiFlagged.push({ question: entry.question, answer: entry.answer, reason: decision.reason || "Low value" });
              } else {
                aiKept.push({ question: entry.question, answer: entry.answer, reason: decision?.reason || "Deemed valuable" });
              }
            });
          } catch (err: any) {
            console.error(`[PACT Review] Batch ${batchIdx + 1} failed:`, err);
            batch.forEach((e) => aiKept.push({ question: e.question, answer: e.answer, reason: "API error — kept safely" }));
          }
        }
      }

      // ═══ LAYER 3: Apply Results to Firestore ═══
      setReviewProgress("Saving results...");

      const scanTimestamp = Date.now();

      // Build lookup maps
      const patternFlaggedSet = new Set(patternFlagged.map((e) => `${e.question}|||${e.answer}`));
      const aiFlaggedMap = new Map(aiFlagged.map((e) => [`${e.question}|||${e.answer}`, e.reason]));
      const aiKeptMap = new Map(aiKept.map((e) => [`${e.question}|||${e.answer}`, e.reason]));

      const updatedEntries = currentEntries.map((e: any) => {
        const key = `${e.question}|||${e.answer}`;

        // Skip already-deleted entries
        if (e.markedForDeletion) return e;

        const prevReviewCount = e.reviewCount || 0;

        if (patternFlaggedSet.has(key)) {
          const reason = patternFlagged.find((p) => p.question === e.question && p.answer === e.answer)?.reason || "Pattern filter";
          return {
            ...e,
            markedForDeletion: scanTimestamp,
            deletionReason: reason,
            reviewCount: prevReviewCount + 1,
            lastReviewedAt: scanTimestamp,
            lastReviewResult: "flagged",
            lastReviewReason: reason,
          };
        }

        if (aiFlaggedMap.has(key)) {
          const reason = aiFlaggedMap.get(key) || "Low value";
          return {
            ...e,
            markedForDeletion: scanTimestamp,
            deletionReason: reason,
            reviewCount: prevReviewCount + 1,
            lastReviewedAt: scanTimestamp,
            lastReviewResult: "flagged",
            lastReviewReason: reason,
          };
        }

        // Kept — update review history
        const keepReason = aiKeptMap.get(key) || "Deemed valuable";
        return {
          ...e,
          reviewCount: prevReviewCount + 1,
          lastReviewedAt: scanTimestamp,
          lastReviewResult: "kept",
          lastReviewReason: keepReason,
        };
      });

      await updateDoc(userDocRef, { [`pact_entries_${orgId}`]: updatedEntries });

      const totalFlagged = patternFlagged.length + aiFlagged.length;
      const totalKept = aiKept.length;

      logActivity(
        firestore,
        "item_updated",
        { email: user?.email || "", displayName: user?.displayName },
        `Full sweep of ${freshActive.length} PACT items: ${totalKept} kept, ${totalFlagged} flagged (${patternFlagged.length} by filter, ${aiFlagged.length} by AI)`
      );

      await fetchPACTEntries();

      if (totalFlagged > 0) {
        showToast(
          `Reviewed ${freshActive.length} items: ${totalKept} kept, ${totalFlagged} flagged for deletion`,
          "warn"
        );
      } else {
        showToast(`Reviewed ${freshActive.length} items — all verified as valuable`, "success");
      }
    } catch (err: any) {
      console.error("[PACT Review Error]:", err);
      showToast(`Review failed: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setReviewing(false);
      setReviewProgress("");
      reviewLockRef.current = false;
    }
  }, [user?.uid, firestore, user?.displayName, user?.email, orgId, pactEntries, fetchPACTEntries, showToast]);

  // ─── Auto-purge expired entries every 60s ─────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      setPactTickNow(now);
      const DAY_MS = 24 * 60 * 60 * 1000;
      const hasExpired = pactEntries.some((e) => e.markedForDeletion && now - e.markedForDeletion > DAY_MS);
      if (hasExpired && firestore && user?.uid) {
        const remaining = pactEntries.filter((e) => !(e.markedForDeletion && now - e.markedForDeletion > DAY_MS));
        setPactEntries(remaining);
        import("firebase/firestore").then(({ doc, updateDoc }) => {
          updateDoc(doc(firestore, "users", user.uid), { [`pact_entries_${orgId}`]: remaining }).catch(console.error);
        });
      }
    }, 60000);
    return () => clearInterval(tick);
  }, [pactEntries, firestore, user?.uid, orgId]);

  // ─── Styles ───────────────────────────────────────────────────────────────
  const cardBg = isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const textMuted = isDark ? "text-slate-500" : "text-slate-400";

  // ─── Sorted entries: active first, then expiring ──────────────────────────
  const sortedEntries = useMemo(
    () =>
      [...pactEntries].sort((a, b) => {
        if (a.markedForDeletion && !b.markedForDeletion) return 1;
        if (!a.markedForDeletion && b.markedForDeletion) return -1;
        return 0;
      }),
    [pactEntries]
  );

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-5 animate-in fade-in duration-300 relative">
      {/* ── Toast Notifications ── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border backdrop-blur-md animate-in slide-in-from-bottom-2 max-w-sm ${
                toast.type === "success"
                  ? isDark ? "bg-emerald-950/90 border-emerald-700 text-emerald-200" : "bg-emerald-50/95 border-emerald-300 text-emerald-900"
                  : toast.type === "warn"
                  ? isDark ? "bg-amber-950/90 border-amber-700 text-amber-200" : "bg-amber-50/95 border-amber-300 text-amber-900"
                  : toast.type === "error"
                  ? isDark ? "bg-red-950/90 border-red-700 text-red-200" : "bg-red-50/95 border-red-300 text-red-900"
                  : isDark ? "bg-slate-800/95 border-slate-700 text-slate-200" : "bg-white/95 border-slate-200 text-slate-800"
              }`}
            >
              {toast.type === "success" && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
              {toast.type === "warn" && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
              {toast.type === "error" && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
              {toast.type === "info" && <Info className="w-4 h-4 text-indigo-500 shrink-0" />}
              <span>{toast.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Header Card ── */}
      <div className={`border rounded-2xl p-5 shadow-sm ${cardBg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
                <BookOpen className="w-4 h-4" />
              </div>
              <h3 className={`text-lg font-bold ${textPrimary}`}>P.A.C.T. Memory</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                pactEnabled
                  ? isDark ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : isDark ? "bg-slate-800 text-slate-400 border border-slate-700" : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}>
                {pactEnabled ? "Active" : "Disabled"}
              </span>
            </div>
            {/* Stats bar */}
            {pactLoaded && stats.total > 0 && (
              <div className={`flex items-center gap-3 text-[11px] font-medium ${textMuted} flex-wrap`}>
                <span className={textSecondary}>{stats.total} items</span>
                {stats.expiring > 0 && <><span>·</span><span className="text-red-500">{stats.expiring} expiring</span></>}
                {stats.lastReviewedAt > 0 && (
                  <><span>·</span><span>Last reviewed {formatRelativeTime(stats.lastReviewedAt)}</span></>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* Review memory items button — always active, full sweep */}
            <button
              disabled={reviewing || !user?.uid || stats.active === 0}
              onClick={handleReviewFacts}
              className={`text-[13px] font-semibold px-4 py-2 rounded-xl border transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                reviewing
                  ? isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-500"
                  : isDark
                  ? "bg-emerald-950/50 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60 shadow-sm"
                  : "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 shadow-sm"
              }`}
            >
              {reviewing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Reviewing...
                </span>
              ) : (
                "Review memory items"
              )}
            </button>

            {/* Toggle Enable/Disable */}
            <button
              type="button"
              onClick={() => setPactEnabled(!pactEnabled)}
              className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                pactEnabled
                  ? isDark ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : isDark ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-500"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${pactEnabled ? "bg-emerald-500" : "bg-slate-400"}`} />
              {pactEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        </div>

        {/* Review progress bar */}
        {reviewing && reviewProgress && (
          <div className={`mt-3 pt-3 border-t flex items-center gap-2 text-xs font-medium animate-pulse ${
            isDark ? "border-slate-800 text-indigo-400" : "border-slate-100 text-indigo-600"
          }`}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{reviewProgress}</span>
          </div>
        )}
      </div>

      {/* ── Entries ── */}
      {!pactLoaded ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : pactEntries.length === 0 ? (
        <div className={`h-56 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center gap-3 p-8 ${
          isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-slate-50/50"
        }`}>
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
            isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 shadow-sm"
          }`}>
            <BookOpen className="w-5 h-5 text-slate-400" />
          </div>
          <p className={`text-sm font-semibold ${textPrimary}`}>No learned facts yet</p>
          <p className={`text-xs max-w-sm ${textSecondary}`}>
            As you chat with Jarvis, personal details, project notes, and preferences will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sortedEntries.map((entry, idx) => {
            const isMarked = !!entry.markedForDeletion;
            const isProtected = !!entry.userRestored;
            const reviewCount = entry.reviewCount || 0;

            const msLeft = isMarked
              ? Math.max(0, 24 * 60 * 60 * 1000 - (pactTickNow - entry.markedForDeletion!))
              : 0;
            const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));
            const minsLeft = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));

            return (
              <div
                key={entry.id}
                className={`border rounded-xl px-5 py-4 transition-all group ${
                  isMarked
                    ? isDark ? "border-red-900/60 bg-red-950/20" : "border-red-200 bg-red-50/30"
                    : isDark ? "border-slate-800 bg-slate-900 hover:border-slate-700" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Question */}
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className={`text-[10px] font-black w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                        isMarked ? "bg-red-500 text-white"
                          : isDark ? "bg-slate-800 text-slate-300 border border-slate-700" : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className={`text-sm font-semibold leading-tight ${isMarked ? "line-through text-slate-400" : textPrimary}`}>
                          {entry.question}
                        </span>
                        {/* User-protected shield */}
                        {isProtected && !isMarked && (
                          <span title="User protected — won't be flagged again">
                            <Shield className={`w-3 h-3 shrink-0 ${isDark ? "text-blue-400" : "text-blue-500"}`} />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Answer */}
                    <p className={`text-sm pl-7 leading-relaxed ${
                      isMarked ? "line-through text-slate-400" : isDark ? "text-slate-300" : "text-slate-600"
                    }`}>
                      {entry.answer}
                    </p>

                    {/* Metadata row */}
                    <div className="flex items-center gap-2 mt-2 pl-7 flex-wrap">
                      <span className={`text-[10px] font-medium capitalize ${textMuted}`}>
                        {entry.source === "voice" ? "Voice" : "Chat"}
                      </span>
                      <span className={`text-[10px] ${textMuted}`}>·</span>
                      <span className={`text-[10px] font-medium ${textMuted}`}>
                        {new Date(entry.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>

                      {/* Review count badge */}
                      {reviewCount > 0 && !isMarked && (
                        <>
                          <span className={`text-[10px] ${textMuted}`}>·</span>
                          <span className={`text-[9px] font-semibold ${textMuted}`}>
                            Reviewed {reviewCount}×
                          </span>
                        </>
                      )}

                      {/* Flagged info */}
                      {isMarked && (
                        <>
                          <span className={`text-[10px] ${textMuted}`}>·</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isDark ? "bg-red-950 text-red-400 border border-red-800/50" : "bg-red-100 text-red-600 border border-red-200"
                          }`}>
                            {entry.deletionReason || "Flagged"}
                          </span>
                          <span className={`text-[10px] font-semibold ${isDark ? "text-red-400" : "text-red-500"}`}>
                            Deletes in {hoursLeft}h {minsLeft}m
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {isMarked ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`shrink-0 rounded-lg h-8 w-8 ${
                        isDark ? "text-red-400 hover:text-white hover:bg-red-900/50" : "text-red-600 hover:text-red-800 hover:bg-red-100"
                      }`}
                      title="Restore this fact (becomes user-protected)"
                      onClick={async () => {
                        if (!user?.uid || !firestore) return;
                        try {
                          const { getDoc, doc, updateDoc } = await import("firebase/firestore");
                          const ref = doc(firestore, "users", user.uid);
                          const snap = await getDoc(ref);
                          const current: any[] = snap.data()?.[`pact_entries_${orgId}`] || [];
                          const updated = current.map((e: any) => {
                            if (e.question === entry.question && e.answer === entry.answer) {
                              const { markedForDeletion, deletionReason, ...rest } = e;
                              return {
                                ...rest,
                                userRestored: true, // Mark as user-protected
                                lastReviewedAt: Date.now(),
                                lastReviewResult: "kept",
                                lastReviewReason: "User restored — protected",
                              };
                            }
                            return e;
                          });
                          await updateDoc(ref, { [`pact_entries_${orgId}`]: updated });
                          setPactEntries((prev) =>
                            prev.map((e) =>
                              e.id === entry.id
                                ? { ...e, markedForDeletion: undefined, deletionReason: undefined, userRestored: true, lastReviewedAt: Date.now(), lastReviewResult: "kept" as const, lastReviewReason: "User restored — protected" }
                                : e
                            )
                          );
                          showToast("Fact restored and protected from future flagging", "success");
                        } catch (err) {
                          console.error("Failed to restore", err);
                        }
                      }}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`shrink-0 rounded-lg h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity ${
                        isDark ? "text-slate-400 hover:text-red-400 hover:bg-red-950/50" : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                      }`}
                      title="Delete fact"
                      onClick={async () => {
                        if (!user?.uid || !firestore) return;
                        try {
                          const { getDoc, doc, updateDoc } = await import("firebase/firestore");
                          const ref = doc(firestore, "users", user.uid);
                          const snap = await getDoc(ref);
                          const current: any[] = snap.data()?.[`pact_entries_${orgId}`] || [];
                          const filtered = current.filter(
                            (e: any) => !(e.question === entry.question && e.answer === entry.answer)
                          );
                          await updateDoc(ref, { [`pact_entries_${orgId}`]: filtered });
                          logActivity(firestore, "item_deleted", { email: user?.email || "", displayName: user?.displayName }, `Deleted PACT entry: ${entry.question}`);
                          setPactEntries((prev) => prev.filter((e) => e.id !== entry.id));
                        } catch (err) {
                          console.error("Failed to delete", err);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
