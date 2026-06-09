"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, query, orderBy, limit, where, onSnapshot } from "firebase/firestore";
import { Activity, ChevronDown, ChevronRight, Filter, Search, X } from "lucide-react";

interface ActivityEntry {
  id: string;
  type: string;
  userEmail: string;
  userName: string;
  description: string;
  category: string;
  timestamp: any;
  metadata?: Record<string, any>;
}

const ALL_CATEGORIES = [
  { key: "all", label: "All Activity" },
  { key: "auth", label: "Authentication" },
  { key: "grants", label: "Grants" },
  { key: "support", label: "Support" },
  { key: "tasks", label: "Tasks" },
  { key: "crm", label: "CRM" },
  { key: "timesheets", label: "Timesheets" },
  { key: "ai", label: "AI" },
  { key: "settings", label: "Settings" },
  { key: "files", label: "Files" },
  { key: "navigation", label: "Navigation" },
  { key: "general", label: "General" },
];

const TYPE_LABELS: Record<string, string> = {
  login: "User Login",
  logout: "User Logout",
  grant_agent_created: "Grant Agent Created",
  grant_agent_deleted: "Grant Agent Deleted",
  grant_agent_started: "Grant Agent Started",
  grant_agent_stopped: "Grant Agent Stopped",
  grant_status_changed: "Grant Status Changed",
  support_ticket_created: "Support Ticket Created",
  support_ticket_replied: "Support Ticket Reply",
  action_board_created: "Task Created",
  action_board_updated: "Task Updated",
  action_board_deleted: "Task Deleted",
  action_board_completed: "Task Completed",
  crm_entry_created: "CRM Entry Created",
  crm_entry_updated: "CRM Entry Updated",
  crm_entry_deleted: "CRM Entry Deleted",
  timesheet_entry_created: "Timesheet Entry Logged",
  timesheet_entry_updated: "Timesheet Entry Updated",
  timesheet_entry_deleted: "Timesheet Entry Deleted",
  timesheet_customer_created: "Timesheet Customer Added",
  timesheet_service_created: "Timesheet Service Added",
  ai_chat_sent: "AI Chat Message",
  ai_agent_config_changed: "AI Agent Config Changed",
  settings_changed: "Settings Changed",
  profile_updated: "Profile Updated",
  file_uploaded: "File Uploaded",
  file_deleted: "File Deleted",
  page_visited: "Page Visited",
  item_created: "Item Created",
  item_updated: "Item Updated",
  item_deleted: "Item Deleted",
};

export default function ActivityLogPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const fallbackUnsubRef = useRef<(() => void) | null>(null);

  const orgDomain = user?.email?.split('@')[1] || '';

  // Real-time listener for activity log — with fallback if index is still building
  useEffect(() => {
    if (!orgDomain || !firestore) return;
    setLoading(true);

    // Try the optimized composite-index query first
    const q = query(
      collection(firestore, "activity_log"),
      where("orgDomain", "==", orgDomain),
      orderBy("timestamp", "desc"),
      limit(500)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ActivityEntry[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            type: data.type || "",
            userEmail: data.userEmail || "",
            userName: data.userName || "",
            description: data.description || "",
            category: data.category || "",
            timestamp: data.timestamp,
            metadata: data.metadata,
          });
        });
        setEntries(list);
        setLoading(false);
      },
      (err) => {
        console.warn("[Activity Log] Composite index query failed, using fallback:", err.message);
        // Fallback: fetch without composite index — just orderBy timestamp, filter client-side
        const fallbackQ = query(
          collection(firestore, "activity_log"),
          orderBy("timestamp", "desc"),
          limit(500)
        );
        const fallbackUnsub = onSnapshot(fallbackQ, (snap) => {
          const list: ActivityEntry[] = [];
          snap.forEach((d) => {
            const data = d.data();
            if (data.orgDomain === orgDomain) {
              list.push({
                id: d.id,
                type: data.type || "",
                userEmail: data.userEmail || "",
                userName: data.userName || "",
                description: data.description || "",
                category: data.category || "",
                timestamp: data.timestamp,
                metadata: data.metadata,
              });
            }
          });
          setEntries(list);
          setLoading(false);
        }, () => setLoading(false));
        // Store fallback unsub for cleanup
        fallbackUnsubRef.current = fallbackUnsub;
      }
    );

    return () => {
      unsub();
      if (fallbackUnsubRef.current) fallbackUnsubRef.current();
    };
  }, [firestore, orgDomain]);

  // Get unique users from entries
  const uniqueUsers = Array.from(new Set(entries.map((e) => e.userEmail))).sort();

  // Filter entries
  const filteredEntries = entries.filter((e) => {
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
    if (userFilter !== "all" && e.userEmail !== userFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !e.description.toLowerCase().includes(q) &&
        !e.userName.toLowerCase().includes(q) &&
        !e.type.toLowerCase().includes(q) &&
        !e.category.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const formatTimestamp = (ts: any): string => {
    if (!ts) return "—";
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "—";
    }
  };

  const getRelativeTime = (ts: any): string => {
    if (!ts) return "";
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days < 7) return `${days}d ago`;
      return "";
    } catch {
      return "";
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case "auth": return "bg-blue-100 text-blue-700";
      case "grants": return "bg-purple-100 text-purple-700";
      case "support": return "bg-amber-100 text-amber-700";
      case "tasks": return "bg-green-100 text-green-700";
      case "crm": return "bg-rose-100 text-rose-700";
      case "timesheets": return "bg-indigo-100 text-indigo-700";
      case "ai": return "bg-cyan-100 text-cyan-700";
      case "settings": return "bg-slate-200 text-slate-700";
      case "files": return "bg-orange-100 text-orange-700";
      case "navigation": return "bg-teal-100 text-teal-700";
      case "general": return "bg-gray-100 text-gray-600";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  const activeFilterLabel = ALL_CATEGORIES.find((c) => c.key === categoryFilter)?.label || "All Activity";

  const hasExpandableContent = (entry: ActivityEntry): boolean => {
    return !!(entry.metadata?.messagePreview || entry.metadata?.details || entry.metadata?.fileName || Object.keys(entry.metadata || {}).length > 0);
  };

  return (
    <div className="flex flex-col h-full bg-[#faf6ed] overflow-auto">
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Activity Log</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">All actions across your organization — real-time.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none w-44 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* User Filter */}
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">All Users</option>
              {uniqueUsers.map((email) => (
                <option key={email} value={email}>{email.split("@")[0]}</option>
              ))}
            </select>

            {/* Category Filter */}
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>{activeFilterLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
              </button>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setFilterOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[170px] max-h-[300px] overflow-y-auto">
                    {ALL_CATEGORIES.map((cat) => {
                      const count = cat.key === "all" ? entries.length : entries.filter((e) => e.category === cat.key).length;
                      return (
                        <button
                          key={cat.key}
                          onClick={() => { setCategoryFilter(cat.key); setFilterOpen(false); }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold transition-colors ${
                            categoryFilter === cat.key
                              ? "text-indigo-600 bg-indigo-50/60"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span>{cat.label}</span>
                          <span className="text-[10px] font-bold text-slate-400 tabular-nums">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 px-4 sm:px-8 pb-8">
        <div className="border border-slate-900 rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[32px_170px_130px_95px_100px_1fr] bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
            <div className="px-1 py-3"></div>
            <div className="px-4 py-3 border-l border-slate-700">Timestamp</div>
            <div className="px-4 py-3 border-l border-slate-700">User</div>
            <div className="px-4 py-3 border-l border-slate-700">Category</div>
            <div className="px-4 py-3 border-l border-slate-700">Action</div>
            <div className="px-4 py-3 border-l border-slate-700">Description</div>
          </div>

          {/* Table Body */}
          {loading ? (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">Loading activity...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">
              {categoryFilter === "all" && userFilter === "all" && !searchQuery
                ? "No activity recorded yet."
                : "No matching activity found."}
            </div>
          ) : (
            filteredEntries.map((entry, idx) => {
              const relTime = getRelativeTime(entry.timestamp);
              const isExpanded = expandedIds.has(entry.id);
              const canExpand = hasExpandableContent(entry);
              const typeLabel = TYPE_LABELS[entry.type] || entry.type.replace(/_/g, " ");

              return (
                <div key={entry.id}>
                  {/* Main Row */}
                  <div
                    className={`grid grid-cols-[32px_170px_130px_95px_100px_1fr] text-sm border-t border-slate-900 ${
                      idx % 2 === 0 ? "bg-[#faf6ed]" : "bg-[#f5f0e1]"
                    } ${canExpand ? "cursor-pointer hover:bg-blue-50/40" : ""} transition-colors`}
                    onClick={() => canExpand && toggleExpanded(entry.id)}
                  >
                    {/* Expand toggle */}
                    <div className="flex items-center justify-center">
                      {canExpand ? (
                        <button className="p-0.5 rounded text-slate-400 hover:text-slate-700 transition-colors">
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />
                          }
                        </button>
                      ) : (
                        <span className="w-3.5 h-3.5 flex items-center justify-center text-[8px] text-slate-300">●</span>
                      )}
                    </div>

                    <div className="px-4 py-3 border-l border-slate-200 text-slate-500 text-xs font-medium">
                      <div>{formatTimestamp(entry.timestamp)}</div>
                      {relTime && <div className="text-[10px] text-slate-400 mt-0.5">{relTime}</div>}
                    </div>
                    <div className="px-4 py-3 border-l border-slate-200">
                      <div className="text-slate-800 font-medium truncate text-xs">{entry.userName}</div>
                      <div className="text-[10px] text-slate-400 truncate">{entry.userEmail}</div>
                    </div>
                    <div className="px-4 py-3 border-l border-slate-200">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${getCategoryColor(entry.category)}`}>
                        {entry.category}
                      </span>
                    </div>
                    <div className="px-4 py-3 border-l border-slate-200">
                      <span className="text-[10px] font-semibold text-slate-600 leading-tight">
                        {typeLabel}
                      </span>
                    </div>
                    <div className="px-4 py-3 border-l border-slate-200 text-slate-600 text-xs truncate">
                      {entry.description}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && canExpand && (
                    <div className={`border-t border-slate-200 ${idx % 2 === 0 ? "bg-[#f5f0e1]/60" : "bg-[#faf6ed]/60"}`}>
                      <div className="px-8 py-4 ml-8 border-l-2 border-indigo-300">
                        <div className="space-y-2">
                          {/* Full description */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Description</span>
                            <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{entry.description}</p>
                          </div>

                          {/* Message Preview */}
                          {entry.metadata?.messagePreview && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Message Content</span>
                              <div className="mt-1 p-3 bg-white/80 border border-slate-200 rounded-lg">
                                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                                  {entry.metadata.messagePreview}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* File info */}
                          {entry.metadata?.fileName && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">File</span>
                              <p className="text-xs text-slate-700 mt-0.5 font-mono">{entry.metadata.fileName}</p>
                            </div>
                          )}

                          {/* Any other metadata */}
                          {entry.metadata && Object.keys(entry.metadata).filter(k => k !== "messagePreview" && k !== "fileName" && k !== "details").length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Details</span>
                              <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1">
                                {Object.entries(entry.metadata)
                                  .filter(([k]) => k !== "messagePreview" && k !== "fileName" && k !== "details")
                                  .map(([key, value]) => (
                                    <div key={key} className="flex items-baseline gap-2">
                                      <span className="text-[10px] text-slate-500 font-semibold capitalize">{key.replace(/_/g, " ")}:</span>
                                      <span className="text-[10px] text-slate-700 font-mono truncate">{String(value)}</span>
                                    </div>
                                  ))
                                }
                              </div>
                            </div>
                          )}

                          {/* Event ID for audit trail */}
                          <div className="pt-1 border-t border-slate-100 mt-2">
                            <span className="text-[9px] text-slate-400 font-mono">Event ID: {entry.id}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Entry count */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Showing {filteredEntries.length} of {entries.length} events
          </span>
          {(categoryFilter !== "all" || userFilter !== "all" || searchQuery) && (
            <button
              onClick={() => { setCategoryFilter("all"); setUserFilter("all"); setSearchQuery(""); }}
              className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 uppercase tracking-wider transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
