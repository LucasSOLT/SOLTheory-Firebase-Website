"use client";

import React, { useState, useEffect, useRef } from "react";
import { useFirestore } from "@/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { useDarkMode } from "@/lib/useDarkMode";

/* ─────────────────────────────────────────────────────────────
   AgenticProspectingFeed
   ────────────────────────────────────────────────────────────
   2D-scrolling feed for the Agentic Prospecting library.
   • Vertical (up/down):  Switch between prospecting tools
   • Horizontal (left/right): Scroll through findings per tool
   Tools only appear when they have ≥1 result.
   ───────────────────────────────────────────────────────────── */

interface Finding {
  id: string;
  title: string;
  description: string;
  author: string;       // agency name
  createdAt: number;    // unix ms
  url: string;
  toolType: string;     // "Federal Grant Prospector" etc.
  sourceWebsite: string;
}

interface ProspectingTool {
  id: string;
  name: string;
  icon: string;         // emoji
  findings: Finding[];
}

interface AgenticProspectingFeedProps {
  orgId: string;
}

/* ── Helpers ── */
function tsToMs(ts: any): number {
  if (!ts) return 0;
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === "number") return ts < 1e12 ? ts * 1000 : ts;
  if (typeof ts === "string") return new Date(ts).getTime() || 0;
  if (ts?.seconds) return ts.seconds * 1000;
  return 0;
}

function formatDate(ms: number): string {
  if (!ms) return "N/A";
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

function domainFromUrl(url: string): string {
  if (!url) return "N/A";
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url.length > 30 ? url.slice(0, 30) + "\u2026" : url;
  }
}

/* ── Tool config ── */
const TOOL_CONFIG: Record<string, { name: string; icon: string }> = {
  federal: { name: "Federal Grant Prospector", icon: "\ud83c\udfe6" },
  philanthropic: { name: "Philanthropic Grant Scout", icon: "\ud83c\udf1f" },
};

/* ── Card width ── */
const CARD_W = 220;

export default function AgenticProspectingFeed({ orgId }: AgenticProspectingFeedProps) {
  const isDarkMode = useDarkMode();
  const firestore = useFirestore();
  const [rawFindings, setRawFindings] = useState<any[]>([]);

  /* ── Subscribe to grant_suggestions ── */
  useEffect(() => {
    if (!firestore || !orgId) return;
    let activeSub: (() => void) | null = null;

    const primaryQuery = query(
      collection(firestore, "grant_suggestions"),
      where("orgId", "==", orgId),
      orderBy("dateSuggested", "desc"),
      limit(30)
    );
    activeSub = onSnapshot(primaryQuery, (snap) => {
      const docs: any[] = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
      setRawFindings(docs);
    }, () => {
      // Fallback without orderBy if composite index is missing
      const fallbackQuery = query(
        collection(firestore, "grant_suggestions"),
        where("orgId", "==", orgId),
        limit(30)
      );
      activeSub = onSnapshot(fallbackQuery, (snap) => {
        const docs: any[] = [];
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
        setRawFindings(docs);
      }, () => {});
    });
    return () => { if (activeSub) activeSub(); };
  }, [firestore, orgId]);

  /* ── Group by searchMode into tools ── */
  const tools: ProspectingTool[] = React.useMemo(() => {
    const groups: Record<string, Finding[]> = {};

    for (const doc of rawFindings) {
      const mode = doc.searchMode || "federal";
      if (!groups[mode]) groups[mode] = [];
      groups[mode].push({
        id: doc.id,
        title: doc.title || "Untitled",
        description: doc.description || "",
        author: doc.agency || "N/A",
        createdAt: tsToMs(doc.dateSuggested) || tsToMs(doc.createdAt),
        url: doc.url || "",
        toolType: TOOL_CONFIG[mode]?.name || mode,
        sourceWebsite: doc.sourceWebsite || "",
      });
    }

    // Sort each group by createdAt desc (most recent first)
    const result: ProspectingTool[] = [];
    for (const [mode, findings] of Object.entries(groups)) {
      findings.sort((a, b) => b.createdAt - a.createdAt);
      const cfg = TOOL_CONFIG[mode] || { name: mode, icon: "\ud83d\udd0d" };
      result.push({ id: mode, name: cfg.name, icon: cfg.icon, findings });
    }

    // Stable order: federal first, then philanthropic, then any others
    const order = ["federal", "philanthropic"];
    result.sort((a, b) => {
      const ai = order.indexOf(a.id);
      const bi = order.indexOf(b.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    return result;
  }, [rawFindings]);

  /* ── Empty state ── */
  if (tools.length === 0) {
    return (
      <div className="flex flex-col h-full w-full min-h-0 select-none">
        <div className="flex items-center justify-between shrink-0 mb-3">
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
              Agentic Prospecting
            </h3>
            <p className={`text-[10px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Autonomous discovery feed
            </p>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
            <svg className={`w-5 h-5 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <div className="text-center">
            <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>No findings yet</p>
            <p className={`text-[10px] mt-0.5 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Deploy a prospecting agent to start</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full min-h-0 select-none">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-3">
        <div>
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
            Agentic Prospecting
          </h3>
          <p className={`text-[10px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {rawFindings.length} finding{rawFindings.length !== 1 ? "s" : ""} across {tools.length} tool{tools.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Vertical scroll: tools */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5" style={{ scrollbarWidth: "thin", overscrollBehavior: "contain" }}>
        <div className="flex flex-col gap-4">
          {tools.map((tool) => (
            <ToolRow key={tool.id} tool={tool} isDarkMode={isDarkMode} />
          ))}

          {/* Blank placeholder rows — fill empty space for future prospecting tools */}
          {Array.from({ length: 3 }).map((_, rowIdx) => (
            <div key={`placeholder-row-${rowIdx}`} className="shrink-0">
              <div className="flex gap-3 pb-2">
                {Array.from({ length: 3 }).map((_, cardIdx) => (
                  <div
                    key={`ph-${rowIdx}-${cardIdx}`}
                    className={`shrink-0 rounded-xl border ${isDarkMode ? "bg-slate-800/20 border-slate-700/30" : "bg-slate-50/40 border-slate-200/50"}`}
                    style={{ width: CARD_W, minHeight: 160 }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Tool Row with horizontal findings scroll ── */
function ToolRow({ tool, isDarkMode }: { tool: ProspectingTool; isDarkMode: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="shrink-0">
      {/* Tool header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm leading-none">{tool.icon}</span>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-300" : "text-slate-500"}`}>
          {tool.name}
        </span>
        <span className={`text-[9px] font-medium tabular-nums ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          {tool.findings.length}
        </span>
      </div>

      {/* Horizontal scroll: findings */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2"
        role="list"
        aria-label={`${tool.name} findings`}
        style={{
          scrollSnapType: "x mandatory",
          scrollbarWidth: "thin",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        {tool.findings.map((finding) => (
          <FindingCard key={finding.id} finding={finding} isDarkMode={isDarkMode} />
        ))}
      </div>
    </div>
  );
}

/* ── Individual finding card ── */
function FindingCard({ finding, isDarkMode }: { finding: Finding; isDarkMode: boolean }) {
  return (
    <div
      className={`shrink-0 rounded-xl border p-3 flex flex-col ${
        isDarkMode
          ? "bg-slate-800/50 border-slate-700/50"
          : "bg-white/60 border-slate-200/80"
      }`}
      role="listitem"
      style={{
        width: CARD_W,
        minHeight: 160,
        scrollSnapAlign: "start",
      }}
    >
      {/* Header: Title */}
      <h4 className={`text-[11px] font-bold leading-snug mb-1.5 line-clamp-2 ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
        {finding.title}
      </h4>

      {/* Body: Description */}
      <p className={`text-[10px] leading-relaxed flex-1 line-clamp-3 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
        {truncate(finding.description.replace(/<[^>]*>/g, ""), 120)}
      </p>

      {/* Metadata Footer */}
      <div className={`mt-2 pt-2 border-t space-y-0.5 ${isDarkMode ? "border-slate-700/50" : "border-slate-200/60"}`}>
        <MetaLine label={finding.author || "N/A"} isDarkMode={isDarkMode} />
        <MetaLine label={formatDate(finding.createdAt) || "N/A"} isDarkMode={isDarkMode} />
        <MetaLine
          label={finding.url ? domainFromUrl(finding.url) : "N/A"}
          href={finding.url}
          isDarkMode={isDarkMode}
        />
        <MetaLine label={finding.toolType} isDarkMode={isDarkMode} />
      </div>
    </div>
  );
}

/* ── Metadata line ── */
function MetaLine({ label, href, isDarkMode }: { label: string; href?: string; isDarkMode: boolean }) {
  const cls = `text-[8px] leading-tight font-medium truncate block ${isDarkMode ? "text-slate-500" : "text-slate-400"}`;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${cls} hover:underline`}
        onClick={(e) => e.stopPropagation()}
      >
        {label}
      </a>
    );
  }
  return <span className={cls}>{label}</span>;
}
