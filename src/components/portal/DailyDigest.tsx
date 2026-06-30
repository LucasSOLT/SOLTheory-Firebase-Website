"use client";

import { useState, useEffect } from "react";
import { Zap, MessageSquare, Globe, FileText, Users, HardDrive, Youtube, Bot, Clock, BarChart3, CalendarDays, Settings, Mail, Presentation, Table, HelpCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { CollapsibleTile } from "@/components/ui/collapsible-tile";

type DigestEntry = {
  id: string;
  type: "navigation" | "ai_chat";
  label: string;
  detail?: string;
  timestamp: number;
  icon: string;
  path?: string;
};

const STORAGE_KEY = "soltheory_daily_digest";

const iconMap: Record<string, any> = {
  Globe, FileText, Users, HardDrive, Youtube, Bot, BarChart3,
  CalendarDays, Settings, Mail, MessageSquare, Presentation, Table, HelpCircle, Zap,
};

function getIconForPath(path: string): { icon: string; label: string } {
  if (path.includes("/ai-agents")) return { icon: "Bot", label: "Agent Manager" };
  if (path.includes("/youtube")) return { icon: "Youtube", label: "YouTube Dashboard" };
  if (path.includes("/calendar")) return { icon: "CalendarDays", label: "Google Calendar" };
  if (path.includes("/docs")) return { icon: "FileText", label: "Google Docs" };
  if (path.includes("/slides")) return { icon: "Presentation", label: "Google Slides" };
  if (path.includes("/sheets")) return { icon: "Table", label: "Google Sheets" };
  if (path.includes("/drive")) return { icon: "HardDrive", label: "Google Drive" };
  if (path.includes("/analytics")) return { icon: "BarChart3", label: "Analytics" };
  if (path.includes("/settings")) return { icon: "Settings", label: "Settings" };
  if (path.includes("/communications")) return { icon: "MessageSquare", label: "Messages" };
  if (path.includes("/faq")) return { icon: "HelpCircle", label: "FAQ" };
  if (path.includes("/surveys")) return { icon: "FileText", label: "Surveys" };
  if (path.includes("/support-tickets")) return { icon: "Mail", label: "Support Tickets" };
  if (path.includes("/google-ads")) return { icon: "Globe", label: "Google Ads" };
  return { icon: "Globe", label: "Dashboard" };
}

function loadEntries(): DigestEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries: DigestEntry[] = JSON.parse(raw);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return entries.filter((e) => e.timestamp >= todayStart.getTime()).slice(0, 10);
  } catch {
    return [];
  }
}

function saveEntries(entries: DigestEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 50)));
}

export function logDigestEntry(entry: Omit<DigestEntry, "id" | "timestamp">) {
  const entries = loadEntries();
  // Dedupe: skip if same label within last 5 seconds
  if (entries.length > 0 && entries[0].label === entry.label && Date.now() - entries[0].timestamp < 5000) return;
  const newEntry: DigestEntry = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now() };
  saveEntries([newEntry, ...entries]);
  window.dispatchEvent(new Event("digest-update"));
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function DailyDigest() {
  const [entries, setEntries] = useState<DigestEntry[]>([]);
  const pathname = usePathname();

  // Navigation tracking is now handled at the layout level (see dashboard/layout.tsx)

  // Listen for updates
  useEffect(() => {
    const refresh = () => setEntries(loadEntries());
    refresh();
    const interval = setInterval(refresh, 5000);
    window.addEventListener("digest-update", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("digest-update", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <CollapsibleTile id="daily-digest" title="Daily Digest" icon={<Zap className="w-4 h-4" />} className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-sm">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Daily Digest</h3>
            <p className="text-[10px] text-slate-400 font-medium">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-full">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Live</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm text-slate-400 font-medium">No activity yet today</p>
          <p className="text-xs text-slate-300 mt-1">Navigate around to see your actions appear here</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry, i) => {
            const IconComp = iconMap[entry.icon] || Zap;
            const isChat = entry.type === "ai_chat";
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${i === 0 ? "bg-indigo-50/60 border border-indigo-100" : "hover:bg-[#f2ece0]"}`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isChat ? "bg-fuchsia-100 text-fuchsia-600" : "bg-indigo-100 text-indigo-600"}`}>
                  <IconComp className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{entry.label}</p>
                  {entry.detail && <p className="text-[10px] text-slate-400 truncate">{entry.detail}</p>}
                </div>
                <span className="text-[10px] text-slate-400 font-medium shrink-0 tabular-nums">{timeAgo(entry.timestamp)}</span>
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleTile>
  );
}
