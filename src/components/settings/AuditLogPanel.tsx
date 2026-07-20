"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useFirestore } from "@/firebase";
import { collection, query, orderBy, limit, getDocs, startAfter, DocumentSnapshot, where } from "firebase/firestore";
import { Clock, Search, Filter, ChevronDown, Loader2, Shield, Users, Trash2, Edit3, LogIn, Settings, Database, AlertTriangle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  type: string;
  userEmail: string;
  userName: string;
  description: string;
  category: string;
  timestamp: any; // Firestore Timestamp
  metadata?: Record<string, any>;
}

// ─── Activity type icon / color mapping ──────────────────────────────────────

const ACTIVITY_ICONS: Record<string, { icon: any; color: string; darkColor: string }> = {
  login:            { icon: LogIn,    color: 'text-blue-600 bg-blue-50',       darkColor: 'text-blue-400 bg-blue-900/30' },
  contact_created:  { icon: Users,    color: 'text-emerald-600 bg-emerald-50', darkColor: 'text-emerald-400 bg-emerald-900/30' },
  contact_deleted:  { icon: Trash2,   color: 'text-red-600 bg-red-50',         darkColor: 'text-red-400 bg-red-900/30' },
  contact_updated:  { icon: Edit3,    color: 'text-amber-600 bg-amber-50',     darkColor: 'text-amber-400 bg-amber-900/30' },
  settings_changed: { icon: Settings, color: 'text-violet-600 bg-violet-50',   darkColor: 'text-violet-400 bg-violet-900/30' },
  data_export:      { icon: Database, color: 'text-sky-600 bg-sky-50',         darkColor: 'text-sky-400 bg-sky-900/30' },
  role_changed:     { icon: Shield,   color: 'text-fuchsia-600 bg-fuchsia-50', darkColor: 'text-fuchsia-400 bg-fuchsia-900/30' },
};

const DEFAULT_ACTIVITY_STYLE = {
  icon: AlertTriangle,
  color: 'text-slate-600 bg-slate-50',
  darkColor: 'text-slate-400 bg-slate-900/30',
};

// ─── Filter option labels ────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',              label: 'All Activity' },
  { value: 'login',            label: 'Login' },
  { value: 'contact_created',  label: 'Contact Created' },
  { value: 'contact_deleted',  label: 'Contact Deleted' },
  { value: 'contact_updated',  label: 'Contact Updated' },
  { value: 'settings_changed', label: 'Settings Changed' },
  { value: 'data_export',      label: 'Data Export' },
  { value: 'role_changed',     label: 'Role Changed' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFullTimestamp(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' at ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

// ─── Component ───────────────────────────────────────────────────────────────

export default function AuditLogPanel() {
  const { isDarkMode } = useTheme();
  const db = useFirestore();

  // State
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ── Initial fetch ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!db) return;

    async function fetchLogs() {
      setIsLoading(true);
      try {
        const q = query(
          collection(db!, 'activity_log'),
          orderBy('timestamp', 'desc'),
          limit(PAGE_SIZE)
        );
        const snapshot = await getDocs(q);
        const entries: AuditEntry[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<AuditEntry, 'id'>),
        }));
        setLogs(entries);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } catch (err) {
        console.error('[AuditLogPanel] Failed to fetch audit logs:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLogs();
  }, [db]);

  // ── Load more ──────────────────────────────────────────────────────────────

  async function loadMore() {
    if (!db || !lastDoc || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const q = query(
        collection(db, 'activity_log'),
        orderBy('timestamp', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(q);
      const entries: AuditEntry[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<AuditEntry, 'id'>),
      }));
      setLogs((prev) => [...prev, ...entries]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('[AuditLogPanel] Failed to load more audit logs:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }

  // ── Client-side filtering ─────────────────────────────────────────────────

  const filteredLogs = useMemo(() => {
    let result = logs;

    // Filter by activity type
    if (filterType !== 'all') {
      result = result.filter((entry) => entry.type === filterType);
    }

    // Filter by search query (email or description)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (entry) =>
          (entry.userEmail ?? '').toLowerCase().includes(q) ||
          (entry.description ?? '').toLowerCase().includes(q) ||
          (entry.userName ?? '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [logs, filterType, searchQuery]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  function getActivityStyle(type: string) {
    return ACTIVITY_ICONS[type] ?? DEFAULT_ACTIVITY_STYLE;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={`rounded-xl border transition-all ${
        isDarkMode
          ? 'bg-gray-800/50 border-gray-700/60'
          : 'bg-white border-gray-200'
      }`}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className={`px-5 py-4 border-b ${
          isDarkMode ? 'border-gray-700/60' : 'border-gray-100'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-lg ${
              isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50'
            }`}
          >
            <Clock
              className={`w-4.5 h-4.5 ${
                isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
              }`}
            />
          </div>
          <div>
            <h3
              className={`text-lg font-bold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}
            >
              Audit Log
            </h3>
            <p
              className={`text-xs ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Recent security events and user activity
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters row ─────────────────────────────────────────────────── */}
      <div
        className={`px-5 py-3 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center ${
          isDarkMode ? 'border-gray-700/60' : 'border-gray-100'
        }`}
      >
        {/* Search input */}
        <div className="relative flex-1 w-full sm:w-auto">
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`}
          />
          <input
            type="text"
            placeholder="Search by email or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border transition-all focus:outline-none focus:ring-2 ${
              isDarkMode
                ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-500 focus:ring-indigo-500/40 focus:border-indigo-500'
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-indigo-500/30 focus:border-indigo-400'
            }`}
          />
        </div>

        {/* Activity type dropdown */}
        <div className="relative">
          <Filter
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`}
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={`appearance-none pl-9 pr-8 py-2 text-sm rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-2 ${
              isDarkMode
                ? 'bg-gray-700/50 border-gray-600 text-white focus:ring-indigo-500/40 focus:border-indigo-500'
                : 'bg-gray-50 border-gray-200 text-gray-900 focus:ring-indigo-500/30 focus:border-indigo-400'
            }`}
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`}
          />
        </div>

        {/* Visible count badge */}
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
            isDarkMode
              ? 'bg-gray-700 text-gray-300'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      <div className="max-h-[500px] overflow-y-auto">
        {isLoading ? (
          /* Loading skeleton */
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2
              className={`w-6 h-6 animate-spin ${
                isDarkMode ? 'text-indigo-400' : 'text-indigo-500'
              }`}
            />
            <p
              className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Loading audit log…
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className={`p-3 rounded-full ${
                isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
              }`}
            >
              <Clock
                className={`w-6 h-6 ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`}
              />
            </div>
            <p
              className={`text-sm font-medium ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              No activity recorded yet.
            </p>
            {(searchQuery || filterType !== 'all') && (
              <p
                className={`text-xs ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                Try adjusting your filters.
              </p>
            )}
          </div>
        ) : (
          /* Entries list */
          <ul className="divide-y divide-transparent">
            {filteredLogs.map((entry, idx) => {
              const style = getActivityStyle(entry.type);
              const IconComponent = style.icon;
              const colorClasses = isDarkMode ? style.darkColor : style.color;

              // Extract the border-accent color from the icon color class
              const accentBorder = isDarkMode
                ? style.darkColor.split(' ')[0].replace('text-', 'border-')
                : style.color.split(' ')[0].replace('text-', 'border-');

              return (
                <li
                  key={entry.id}
                  className={`group flex items-start gap-3.5 px-5 py-3.5 border-l-2 transition-all ${accentBorder} ${
                    idx % 2 === 0
                      ? isDarkMode
                        ? 'bg-gray-800/30'
                        : 'bg-white'
                      : isDarkMode
                        ? 'bg-gray-750/20'
                        : 'bg-gray-50/60'
                  } ${
                    isDarkMode
                      ? 'hover:bg-gray-700/40'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Icon circle */}
                  <div
                    className={`flex-shrink-0 p-2 rounded-lg transition-transform group-hover:scale-105 ${colorClasses}`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-snug ${
                        isDarkMode ? 'text-gray-200' : 'text-gray-800'
                      }`}
                    >
                      {entry.description}
                    </p>
                    <p
                      className={`text-xs mt-0.5 truncate ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    >
                      {entry.userEmail}
                      {entry.userName ? ` · ${entry.userName}` : ''}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div className="flex-shrink-0 text-right">
                    <p
                      className={`text-xs font-medium ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}
                      title={formatFullTimestamp(entry.timestamp)}
                    >
                      {relativeTime(entry.timestamp)}
                    </p>
                    <p
                      className={`text-[11px] mt-0.5 hidden sm:block ${
                        isDarkMode ? 'text-gray-600' : 'text-gray-300'
                      }`}
                    >
                      {formatFullTimestamp(entry.timestamp)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Load More ───────────────────────────────────────────────────── */}
      {hasMore && !isLoading && logs.length > 0 && (
        <div
          className={`px-5 py-3 border-t text-center ${
            isDarkMode ? 'border-gray-700/60' : 'border-gray-100'
          }`}
        >
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isDarkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
