"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  SearchX,
  User,
  Calendar,
  CheckSquare,
  Plus,
  ChevronRight,
  Command,
  Clock,
  X,
  Zap,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
} from "lucide-react";
import { useCRMStore } from "@/stores/crm-store";
import type { Customer, Meeting, CrmTask } from "@/stores/crm-store";
import { useTheme } from "@/components/ThemeProvider";

/* ─────────────── Types ─────────────── */

interface CRMCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (customer: Customer) => void;
  onNavigate: (view: string) => void;
  onAddContact: () => void;
}

type ResultCategory = "recent" | "contacts" | "meetings" | "tasks" | "actions";

interface SearchResult {
  id: string;
  category: ResultCategory;
  icon: React.ReactNode;
  primary: string;
  secondary: string;
  data?: Customer | Meeting | CrmTask;
  action?: () => void;
}

/* ─────────────── Constants ─────────────── */

const RECENT_SEARCHES_KEY = "crm_command_palette_recent";
const MAX_RECENT = 5;
const MAX_PER_CATEGORY = 5;

/* ─────────────── Helpers ─────────────── */

/** Simple fuzzy match — checks if all characters of the needle appear in order within the haystack */
function fuzzyMatch(needle: string, haystack: string): boolean {
  const lower = haystack.toLowerCase();
  const term = needle.toLowerCase();
  let j = 0;
  for (let i = 0; i < lower.length && j < term.length; i++) {
    if (lower[i] === term[j]) j++;
  }
  return j === term.length;
}

/** Compute a rough relevance score — lower is better */
function fuzzyScore(needle: string, haystack: string): number {
  const lower = haystack.toLowerCase();
  const term = needle.toLowerCase();
  // Exact prefix gets highest score
  if (lower.startsWith(term)) return 0;
  // Contains gets second-best
  if (lower.includes(term)) return 1;
  // Fuzzy gets lowest
  return 2;
}

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string) {
  if (typeof window === "undefined" || !term.trim()) return;
  try {
    const existing = loadRecentSearches();
    const filtered = existing.filter((s) => s.toLowerCase() !== term.toLowerCase());
    const updated = [term.trim(), ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/* ─────────────── Initials Avatar ─────────────── */

const AVATAR_COLORS = [
  "from-amber-400 to-orange-500",
  "from-violet-400 to-purple-600",
  "from-sky-400 to-blue-600",
  "from-emerald-400 to-green-600",
  "from-rose-400 to-pink-600",
  "from-teal-400 to-cyan-600",
  "from-fuchsia-400 to-purple-500",
  "from-lime-400 to-green-500",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ─────────────── Component ─────────────── */

export default function CRMCommandPalette({
  isOpen,
  onClose,
  onSelectContact,
  onNavigate,
  onAddContact,
}: CRMCommandPaletteProps) {
  const { isDarkMode } = useTheme();
  const { customers, meetings, tasks } = useCRMStore();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Load recent searches on mount
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(loadRecentSearches());
    }
  }, [isOpen]);

  // Focus input when opened, reset state
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      // Small delay so the animation doesn't block focus
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  /* ─── Build Results ─── */

  const quickActions: SearchResult[] = useMemo(
    () => [
      {
        id: "action-add-contact",
        category: "actions" as ResultCategory,
        icon: <Plus className="w-4 h-4" />,
        primary: "Add Contact",
        secondary: "Create a new contact record",
        action: () => {
          onAddContact();
          onClose();
        },
      },
      {
        id: "action-create-task",
        category: "actions" as ResultCategory,
        icon: <CheckSquare className="w-4 h-4" />,
        primary: "Create Task",
        secondary: "Add a new task to your pipeline",
        action: () => {
          onNavigate("tasks");
          onClose();
        },
      },
      {
        id: "action-schedule-meeting",
        category: "actions" as ResultCategory,
        icon: <Calendar className="w-4 h-4" />,
        primary: "Schedule Meeting",
        secondary: "Book a meeting with a contact",
        action: () => {
          onNavigate("meetings");
          onClose();
        },
      },
    ],
    [onAddContact, onNavigate, onClose]
  );

  const results: SearchResult[] = useMemo(() => {
    const trimmed = query.trim();

    // If no query, show recent searches + quick actions
    if (!trimmed) {
      const recentResults: SearchResult[] = recentSearches.map((term, i) => ({
        id: `recent-${i}`,
        category: "recent" as ResultCategory,
        icon: <Clock className="w-4 h-4" />,
        primary: term,
        secondary: "Recent search",
        action: () => setQuery(term),
      }));
      return [...recentResults, ...quickActions];
    }

    const all: SearchResult[] = [];

    // Search contacts
    const contactResults = customers
      .filter((c) => {
        const fullName = `${c.firstName} ${c.lastName}`;
        const searchable = [fullName, c.email, c.phone, c.company, c.aiNotes, c.location].join(" ");
        return fuzzyMatch(trimmed, searchable);
      })
      .map((c) => ({
        customer: c,
        score: Math.min(
          fuzzyScore(trimmed, `${c.firstName} ${c.lastName}`),
          fuzzyScore(trimmed, c.email),
          fuzzyScore(trimmed, c.company)
        ),
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, MAX_PER_CATEGORY)
      .map(({ customer: c }) => ({
        id: `contact-${c.id}`,
        category: "contacts" as ResultCategory,
        icon: (
          <div
            className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(
              c.firstName + c.lastName
            )} flex items-center justify-center text-white text-[10px] font-bold shadow-sm`}
          >
            {getInitials(c.firstName, c.lastName)}
          </div>
        ),
        primary: `${c.firstName} ${c.lastName}`,
        secondary: [c.company, c.email].filter(Boolean).join(" · "),
        data: c,
        action: () => {
          onSelectContact(c);
          saveRecentSearch(`${c.firstName} ${c.lastName}`);
          onClose();
        },
      }));

    all.push(...contactResults);

    // Search meetings
    const meetingResults = meetings
      .filter((m) => {
        const searchable = [m.title, m.customerName, m.date].join(" ");
        return fuzzyMatch(trimmed, searchable);
      })
      .sort((a, b) => fuzzyScore(trimmed, a.title) - fuzzyScore(trimmed, b.title))
      .slice(0, MAX_PER_CATEGORY)
      .map((m) => ({
        id: `meeting-${m.id}`,
        category: "meetings" as ResultCategory,
        icon: <Calendar className="w-4 h-4" />,
        primary: m.title,
        secondary: [m.customerName, m.date ? formatDate(m.date) : "", m.time]
          .filter(Boolean)
          .join(" · "),
        data: m,
        action: () => {
          onNavigate("meetings");
          saveRecentSearch(m.title);
          onClose();
        },
      }));

    all.push(...meetingResults);

    // Search tasks
    const taskResults = tasks
      .filter((t) => {
        const searchable = [t.title, t.dueDate].join(" ");
        return fuzzyMatch(trimmed, searchable);
      })
      .sort((a, b) => fuzzyScore(trimmed, a.title) - fuzzyScore(trimmed, b.title))
      .slice(0, MAX_PER_CATEGORY)
      .map((t) => ({
        id: `task-${t.id}`,
        category: "tasks" as ResultCategory,
        icon: <CheckSquare className="w-4 h-4" />,
        primary: t.title,
        secondary: [t.completed ? "✓ Completed" : "Pending", t.dueDate ? formatDate(t.dueDate) : ""]
          .filter(Boolean)
          .join(" · "),
        data: t,
        action: () => {
          onNavigate("tasks");
          saveRecentSearch(t.title);
          onClose();
        },
      }));

    all.push(...taskResults);

    // Filter quick actions by query
    const filteredActions = quickActions.filter((a) => fuzzyMatch(trimmed, a.primary));
    all.push(...filteredActions);

    return all;
  }, [query, customers, meetings, tasks, quickActions, recentSearches, onSelectContact, onNavigate, onClose]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, query]);

  // Scroll selected item into view
  useEffect(() => {
    const el = itemRefs.current.get(selectedIndex);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  /* ─── Keyboard Navigation ─── */

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]?.action) {
            results[selectedIndex].action!();
            if (query.trim()) saveRecentSearch(query.trim());
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, onClose, query]
  );

  /* ─── Category Headers ─── */

  const categoryMeta: Record<ResultCategory, { label: string; icon: React.ReactNode }> = {
    recent: { label: "Recent", icon: <Clock className="w-3.5 h-3.5" /> },
    contacts: { label: "Contacts", icon: <User className="w-3.5 h-3.5" /> },
    meetings: { label: "Meetings", icon: <Calendar className="w-3.5 h-3.5" /> },
    tasks: { label: "Tasks", icon: <CheckSquare className="w-3.5 h-3.5" /> },
    actions: { label: "Quick Actions", icon: <Zap className="w-3.5 h-3.5" /> },
  };

  // Group results by category preserving order
  const groupedResults = useMemo(() => {
    const groups: { category: ResultCategory; items: { result: SearchResult; globalIndex: number }[] }[] = [];
    let currentCategory: ResultCategory | null = null;

    results.forEach((result, globalIndex) => {
      if (result.category !== currentCategory) {
        currentCategory = result.category;
        groups.push({ category: result.category, items: [] });
      }
      groups[groups.length - 1].items.push({ result, globalIndex });
    });

    return groups;
  }, [results]);

  if (!isOpen) return null;

  const hasQuery = query.trim().length > 0;
  const noResults = hasQuery && results.length === 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          isDarkMode ? "bg-black/60" : "bg-black/40"
        } backdrop-blur-sm`}
      />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className={`
          relative w-full max-w-2xl mx-4
          rounded-2xl shadow-2xl
          border overflow-hidden
          transform transition-all duration-200 ease-out
          animate-in fade-in slide-in-from-top-2
          ${
            isDarkMode
              ? "bg-slate-900 border-slate-700/60 shadow-black/40"
              : "bg-[#faf8f3] border-[#ede8da] shadow-amber-900/10"
          }
        `}
        style={{
          animation: "commandPaletteIn 200ms ease-out forwards",
        }}
      >
        {/* Search Input Area */}
        <div
          className={`
            flex items-center gap-3 px-5 py-4
            border-b
            ${isDarkMode ? "border-slate-700/60" : "border-[#ede8da]"}
          `}
        >
          <Search
            className={`w-5 h-5 flex-shrink-0 ${
              isDarkMode ? "text-slate-400" : "text-stone-400"
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts, tasks, meetings..."
            className={`
              flex-1 bg-transparent outline-none text-sm
              placeholder:text-stone-400
              ${isDarkMode ? "text-slate-100 placeholder:text-slate-500" : "text-stone-800"}
            `}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className={`
                p-1 rounded-md transition-colors duration-150
                ${isDarkMode ? "hover:bg-slate-700/60 text-slate-400" : "hover:bg-stone-200/60 text-stone-400"}
              `}
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div
            className={`
              flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium
              border flex-shrink-0
              ${
                isDarkMode
                  ? "bg-slate-800 border-slate-600 text-slate-400"
                  : "bg-[#f5f1e8] border-[#ede8da] text-stone-400"
              }
            `}
          >
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[400px] overflow-y-auto overscroll-contain"
          style={{ scrollbarGutter: "stable" }}
        >
          {noResults ? (
            /* No Results State */
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div
                className={`
                  w-14 h-14 rounded-2xl flex items-center justify-center mb-4
                  ${isDarkMode ? "bg-slate-800" : "bg-[#f5f1e8]"}
                `}
              >
                <SearchX
                  className={`w-7 h-7 ${isDarkMode ? "text-slate-500" : "text-stone-400"}`}
                />
              </div>
              <p
                className={`text-sm font-medium ${
                  isDarkMode ? "text-slate-300" : "text-stone-700"
                }`}
              >
                No results found
              </p>
              <p
                className={`text-xs mt-1 ${
                  isDarkMode ? "text-slate-500" : "text-stone-400"
                }`}
              >
                Try a different search term or use a quick action
              </p>
            </div>
          ) : (
            <div className="py-2">
              {groupedResults.map((group) => (
                <div key={group.category}>
                  {/* Category Header */}
                  <div
                    className={`
                      flex items-center gap-2 px-5 py-2 mt-1
                      ${isDarkMode ? "text-slate-500" : "text-stone-400"}
                    `}
                  >
                    {categoryMeta[group.category].icon}
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      {categoryMeta[group.category].label}
                    </span>
                    <div
                      className={`flex-1 h-px ${
                        isDarkMode ? "bg-slate-800" : "bg-[#ede8da]/60"
                      }`}
                    />
                  </div>

                  {/* Category Items */}
                  {group.items.map(({ result, globalIndex }) => {
                    const isSelected = globalIndex === selectedIndex;
                    const isContact = result.category === "contacts";
                    const isAction = result.category === "actions";

                    return (
                      <button
                        key={result.id}
                        ref={(el) => {
                          if (el) itemRefs.current.set(globalIndex, el);
                          else itemRefs.current.delete(globalIndex);
                        }}
                        onClick={() => result.action?.()}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`
                          w-full flex items-center gap-3 px-5 py-2.5
                          text-left transition-all duration-150
                          group cursor-pointer
                          ${
                            isSelected
                              ? isDarkMode
                                ? "bg-slate-800/80"
                                : "bg-[#f5f1e8]/80"
                              : "bg-transparent"
                          }
                          ${
                            !isSelected
                              ? isDarkMode
                                ? "hover:bg-slate-800/50"
                                : "hover:bg-[#f5f1e8]/50"
                              : ""
                          }
                        `}
                      >
                        {/* Icon */}
                        <div
                          className={`
                            flex-shrink-0 flex items-center justify-center
                            ${isContact ? "" : "w-8 h-8 rounded-lg"}
                            ${
                              isContact
                                ? ""
                                : isAction
                                ? isDarkMode
                                  ? "bg-amber-500/15 text-amber-400"
                                  : "bg-amber-100 text-amber-600"
                                : result.category === "meetings"
                                ? isDarkMode
                                  ? "bg-sky-500/15 text-sky-400"
                                  : "bg-sky-100 text-sky-600"
                                : result.category === "tasks"
                                ? isDarkMode
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-emerald-100 text-emerald-600"
                                : isDarkMode
                                ? "bg-slate-700 text-slate-400"
                                : "bg-stone-200 text-stone-500"
                            }
                          `}
                        >
                          {result.icon}
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`
                              text-sm font-medium truncate
                              ${
                                isAction
                                  ? isDarkMode
                                    ? "text-amber-300"
                                    : "text-amber-700"
                                  : isDarkMode
                                  ? "text-slate-200"
                                  : "text-stone-800"
                              }
                            `}
                          >
                            {isAction && (
                              <span className="mr-1">+</span>
                            )}
                            {result.primary}
                          </p>
                          {result.secondary && (
                            <p
                              className={`
                                text-xs truncate mt-0.5
                                ${isDarkMode ? "text-slate-500" : "text-stone-400"}
                              `}
                            >
                              {result.secondary}
                            </p>
                          )}
                        </div>

                        {/* Arrow */}
                        <ChevronRight
                          className={`
                            w-4 h-4 flex-shrink-0 transition-all duration-200
                            ${
                              isSelected
                                ? isDarkMode
                                  ? "text-slate-400 translate-x-0"
                                  : "text-stone-400 translate-x-0"
                                : "text-transparent -translate-x-1"
                            }
                          `}
                        />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`
            flex items-center justify-between px-5 py-3
            border-t text-[10px]
            ${isDarkMode ? "border-slate-700/60 text-slate-500" : "border-[#ede8da] text-stone-400"}
          `}
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className={`
                  inline-flex items-center justify-center w-5 h-5 rounded
                  border
                  ${isDarkMode ? "bg-slate-800 border-slate-600" : "bg-[#f5f1e8] border-[#ede8da]"}
                `}
              >
                <ArrowUp className="w-2.5 h-2.5" />
              </span>
              <span
                className={`
                  inline-flex items-center justify-center w-5 h-5 rounded
                  border
                  ${isDarkMode ? "bg-slate-800 border-slate-600" : "bg-[#f5f1e8] border-[#ede8da]"}
                `}
              >
                <ArrowDown className="w-2.5 h-2.5" />
              </span>
              <span className="ml-0.5">Navigate</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={`
                  inline-flex items-center justify-center w-5 h-5 rounded
                  border
                  ${isDarkMode ? "bg-slate-800 border-slate-600" : "bg-[#f5f1e8] border-[#ede8da]"}
                `}
              >
                <CornerDownLeft className="w-2.5 h-2.5" />
              </span>
              <span className="ml-0.5">Open</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={`
                  inline-flex items-center justify-center px-1.5 h-5 rounded
                  border font-medium
                  ${isDarkMode ? "bg-slate-800 border-slate-600" : "bg-[#f5f1e8] border-[#ede8da]"}
                `}
              >
                Esc
              </span>
              <span className="ml-0.5">Close</span>
            </span>
          </div>
          <span className="font-medium">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Keyframes injected inline for the entrance animation */}
      <style jsx>{`
        @keyframes commandPaletteIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
