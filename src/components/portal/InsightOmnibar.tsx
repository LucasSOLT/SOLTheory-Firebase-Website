"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Home,
  Bot,
  Brain,
  Users,
  Mail,
  BarChart3,
  LayoutDashboard,
  CalendarDays,
  HardDrive,
  Send,
  Compass,
  Settings,
  MessageSquare,
  Youtube,
  FileText,
  Presentation,
  Table,
  Sparkles,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  X,
  Lightbulb,
  Loader2,
  CheckSquare,
  Calendar,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { getAuthHeaders } from "@/lib/api-auth-client";
import { useUser, useFirestore } from "@/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useCRMStore, type Customer } from "@/stores/crm-store";

/* ─────────────── Types ─────────────── */

interface InsightOmnibarProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  dashboardHome: string;
}

interface NavItem {
  id: string;
  label: string;
  route: string;
  icon: React.ReactNode;
  keywords: string[];
}

interface SearchResult {
  id: string;
  label: string;
  secondary: string;
  icon: React.ReactNode;
  action: () => void;
  category: "navigation" | "recent";
}

/** Command handler state machine */
type CommandStep =
  | { type: "idle" }
  | { type: "loading"; label: string }
  | { type: "result"; content: string; label: string }
  | { type: "ai_streaming"; label: string }
  | { type: "email_step"; step: "ask_recipient" | "searching_crm" | "pick_contact" | "ask_purpose" | "generating" | "done"; data: EmailFlowData }
  | { type: "error"; message: string };

interface EmailFlowData {
  recipientQuery: string;
  matchedContacts: Customer[];
  selectedContact: Customer | null;
  purpose: string;
  draftHtml: string;
}

/* ─────────────── Helpers ─────────────── */

function fuzzyMatch(needle: string, haystack: string): boolean {
  const lower = haystack.toLowerCase();
  const term = needle.toLowerCase();
  let j = 0;
  for (let i = 0; i < lower.length && j < term.length; i++) {
    if (lower[i] === term[j]) j++;
  }
  return j === term.length;
}

function fuzzyScore(needle: string, haystack: string): number {
  const lower = haystack.toLowerCase();
  const term = needle.toLowerCase();
  if (lower.startsWith(term)) return 0;
  if (lower.includes(term)) return 1;
  return 2;
}

const RECENT_KEY = "insight_omnibar_recent";
const MAX_RECENT = 5;

function loadRecent(): { label: string; route: string }[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(label: string, route: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadRecent();
    const filtered = existing.filter((r) => r.route !== route);
    const updated = [{ label, route }, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {}
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/* ─────────────── Quick Prompt Definitions ─────────────── */

interface QuickPrompt {
  label: string;
  icon: React.ReactNode;
  commandType: "tasks" | "calendar" | "inbox" | "ai";
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { label: "Summarize my tasks", icon: <CheckSquare className="w-3 h-3" />, commandType: "tasks" },
  { label: "What's on my calendar?", icon: <Calendar className="w-3 h-3" />, commandType: "calendar" },
  { label: "Search my inbox", icon: <Search className="w-3 h-3" />, commandType: "inbox" },
];

/* ─────────────── Component ─────────────── */

export function InsightOmnibar({ isOpen, onClose, orgId, dashboardHome }: InsightOmnibarProps) {
  const { isDarkMode } = useTheme();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query_, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commandState, setCommandState] = useState<CommandStep>({ type: "idle" });
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // CRM store for email drafting
  const crmCustomers = useCRMStore((s) => s.customers);

  // Detect macOS for shortcut display
  useEffect(() => {
    setIsMac(navigator?.platform?.includes("Mac") || false);
  }, []);

  // Focus input when opened, reset state
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setCommandState({ type: "idle" });
      setAiResponse("");
      setIsAiLoading(false);
      if (abortRef.current) abortRef.current.abort();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build navigation items registry
  const navItems: NavItem[] = useMemo(() => [
    { id: "home", label: "Homepage", route: dashboardHome, icon: <Home className="w-4 h-4" />, keywords: ["home", "dashboard", "main"] },
    { id: "jarvis", label: "Agent Manager (Jarvis)", route: `${dashboardHome}/ai-agents/jarvis`, icon: <Bot className="w-4 h-4" />, keywords: ["jarvis", "ai", "agent", "chat", "assistant"] },
    { id: "kb", label: "AI Knowledge Base", route: `${dashboardHome}/ai-knowledge-base`, icon: <Brain className="w-4 h-4" />, keywords: ["knowledge", "base", "documents", "rag", "brain"] },
    { id: "walkthroughs", label: "Insight Walkthroughs", route: `${dashboardHome}/walkthroughs`, icon: <Lightbulb className="w-4 h-4" />, keywords: ["walkthroughs", "tutorials", "help", "guides"] },
    { id: "crm", label: "CRM", route: `${dashboardHome}/crm`, icon: <Users className="w-4 h-4" />, keywords: ["crm", "contacts", "customers", "pipeline", "sales"] },
    { id: "gmail", label: "Email (Gmail)", route: `${dashboardHome}/gmail`, icon: <Mail className="w-4 h-4" />, keywords: ["email", "gmail", "inbox", "mail", "messages"] },
    { id: "bi", label: "Business Intelligence", route: `${dashboardHome}/business-intelligence`, icon: <BarChart3 className="w-4 h-4" />, keywords: ["business", "intelligence", "reports", "analytics", "bi", "data"] },
    { id: "action-board", label: "Action Board", route: `${dashboardHome}/action-board`, icon: <LayoutDashboard className="w-4 h-4" />, keywords: ["action", "board", "kanban", "tasks", "todo"] },
    { id: "timesheets", label: "Timesheets", route: `${dashboardHome}/timesheets`, icon: <CalendarDays className="w-4 h-4" />, keywords: ["timesheets", "hours", "clock", "time", "tracking"] },
    { id: "media", label: "Media Library", route: `${dashboardHome}/media-library`, icon: <HardDrive className="w-4 h-4" />, keywords: ["media", "library", "files", "assets", "uploads"] },
    { id: "campaigning", label: "Agentic Campaigning", route: `${dashboardHome}/agentic-campaigning`, icon: <Send className="w-4 h-4" />, keywords: ["campaign", "instagram", "social", "content", "posting"] },
    { id: "prospecting", label: "Agentic Prospecting", route: `${dashboardHome}/agentic-prospecting`, icon: <Compass className="w-4 h-4" />, keywords: ["prospect", "grants", "funding", "opportunities", "search"] },
    { id: "calendar", label: "Google Calendar", route: `${dashboardHome}/calendar`, icon: <CalendarDays className="w-4 h-4" />, keywords: ["calendar", "events", "schedule", "meetings", "google"] },
    { id: "youtube", label: "YouTube Creator", route: `${dashboardHome}/youtube`, icon: <Youtube className="w-4 h-4" />, keywords: ["youtube", "video", "creator", "channel", "content"] },
    { id: "docs", label: "Google Docs", route: `${dashboardHome}/docs`, icon: <FileText className="w-4 h-4" />, keywords: ["docs", "documents", "google", "write", "editor"] },
    { id: "sheets", label: "Google Sheets", route: `${dashboardHome}/sheets`, icon: <Table className="w-4 h-4" />, keywords: ["sheets", "spreadsheet", "google", "data", "table"] },
    { id: "slides", label: "Google Slides", route: `${dashboardHome}/slides`, icon: <Presentation className="w-4 h-4" />, keywords: ["slides", "presentation", "google", "deck"] },
    { id: "drive", label: "Google Drive", route: `${dashboardHome}/drive`, icon: <HardDrive className="w-4 h-4" />, keywords: ["drive", "google", "files", "storage", "cloud"] },
    { id: "dm", label: "Direct Messages", route: `${dashboardHome}/communications/dm`, icon: <MessageSquare className="w-4 h-4" />, keywords: ["messages", "dm", "direct", "chat", "communications"] },
    { id: "settings", label: "Settings", route: `${dashboardHome}/settings`, icon: <Settings className="w-4 h-4" />, keywords: ["settings", "preferences", "config", "profile", "account"] },
  ], [dashboardHome]);

  // ─── COMMAND: Summarize Action Board Tasks ───
  const runTasksSummary = useCallback(async () => {
    setCommandState({ type: "loading", label: "Summarize my tasks" });
    try {
      const tasksRef = collection(firestore, "action_board_tasks");
      const q = query(tasksRef, where("orgId", "==", orgId));
      const snapshot = await getDocs(q);

      interface ABTask {
        id: string;
        title: string;
        column: string;
        priority: string;
        dueDate?: any;
        assignedToName?: string;
        isLate?: boolean;
      }

      const tasks: ABTask[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (!data.isArchived) {
          tasks.push({
            id: d.id,
            title: data.title || "Untitled",
            column: data.column || "todo",
            priority: data.priority || "Medium",
            dueDate: data.dueDate?.toDate?.() || null,
            assignedToName: data.assignedToName || data.assignedToEmail || "Unassigned",
            isLate: data.isLate || false,
          });
        }
      });

      const todo = tasks.filter((t) => t.column === "todo");
      const doing = tasks.filter((t) => t.column === "doing");
      const done = tasks.filter((t) => t.column === "done");
      const overdue = tasks.filter((t) => t.isLate);
      const highPri = tasks.filter((t) => t.priority === "High" && t.column !== "done");

      let summary = `## 📋 Action Board Summary\n\n`;
      summary += `**${tasks.length}** total tasks · **${todo.length}** to do · **${doing.length}** in progress · **${done.length}** done\n\n`;

      if (overdue.length > 0) {
        summary += `### ⚠️ Overdue (${overdue.length})\n`;
        overdue.forEach((t) => {
          summary += `- **${t.title}** — ${t.assignedToName}${t.dueDate ? ` · Due ${formatRelativeDate(t.dueDate)}` : ""}\n`;
        });
        summary += "\n";
      }

      if (highPri.length > 0) {
        summary += `### 🔴 High Priority (${highPri.length})\n`;
        highPri.forEach((t) => {
          summary += `- **${t.title}** — ${t.column === "doing" ? "In Progress" : "To Do"}${t.dueDate ? ` · ${formatRelativeDate(t.dueDate)}` : ""}\n`;
        });
        summary += "\n";
      }

      if (doing.length > 0) {
        summary += `### 🔵 In Progress (${doing.length})\n`;
        doing.slice(0, 5).forEach((t) => {
          summary += `- **${t.title}** — ${t.assignedToName}\n`;
        });
        if (doing.length > 5) summary += `- ...and ${doing.length - 5} more\n`;
        summary += "\n";
      }

      if (todo.length > 0) {
        summary += `### ⚪ To Do (${todo.length})\n`;
        todo.slice(0, 5).forEach((t) => {
          summary += `- **${t.title}** — ${t.priority} priority\n`;
        });
        if (todo.length > 5) summary += `- ...and ${todo.length - 5} more\n`;
      }

      if (tasks.length === 0) {
        summary = "## 📋 Action Board\n\nNo active tasks on the board. You're all caught up! 🎉";
      }

      setCommandState({ type: "result", content: summary, label: "Summarize my tasks" });
    } catch (err: any) {
      console.error("[Omnibar] Tasks error:", err);
      setCommandState({ type: "error", message: `Failed to load tasks: ${err.message}` });
    }
  }, [firestore, orgId]);

  // ─── COMMAND: What's on my calendar? ───
  const runCalendar = useCallback(async () => {
    setCommandState({ type: "loading", label: "What's on my calendar?" });
    try {
      // Get user's refresh token from Firestore
      if (!user?.uid) throw new Error("Not signed in");
      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      const userData = userDoc.data();
      const rToken =
        userData?.gmailOAuth_jarvis?.refreshToken ||
        userData?.gmailOAuth_morpheus?.refreshToken ||
        userData?.gmailOAuth_email?.refreshToken ||
        null;

      if (!rToken) {
        setCommandState({ type: "error", message: "Google Calendar is not connected. Connect it in Settings → Integrations." });
        return;
      }

      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers,
        body: JSON.stringify({
          refreshToken: rToken,
          timeMin: now.toISOString(),
          timeMax: weekEnd.toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const events = data.events || [];
      let summary = `## 📅 Your Week Ahead\n\n`;

      if (events.length === 0) {
        summary += "No events scheduled for the next 7 days. Your calendar is clear! ✨";
      } else {
        // Group by day
        const byDay: Record<string, typeof events> = {};
        events.forEach((ev: any) => {
          const d = new Date(ev.start);
          const dayKey = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
          if (!byDay[dayKey]) byDay[dayKey] = [];
          byDay[dayKey].push(ev);
        });

        Object.entries(byDay).forEach(([day, evts]) => {
          summary += `### ${day}\n`;
          (evts as any[]).forEach((ev: any) => {
            if (ev.allDay) {
              summary += `- **${ev.title}** — All day\n`;
            } else {
              const start = new Date(ev.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              const end = new Date(ev.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              summary += `- **${ev.title}** — ${start} – ${end}${ev.location ? ` · ${ev.location}` : ""}\n`;
            }
          });
          summary += "\n";
        });

        summary += `*${events.length} event${events.length > 1 ? "s" : ""} total*`;
      }

      setCommandState({ type: "result", content: summary, label: "What's on my calendar?" });
    } catch (err: any) {
      console.error("[Omnibar] Calendar error:", err);
      setCommandState({ type: "error", message: `Calendar: ${err.message}` });
    }
  }, [firestore, user?.uid]);

  // ─── COMMAND: Draft an email (multi-step flow) ───
  const startEmailDraft = useCallback(() => {
    setCommandState({
      type: "email_step",
      step: "ask_recipient",
      data: { recipientQuery: "", matchedContacts: [], selectedContact: null, purpose: "", draftHtml: "" },
    });
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleEmailInput = useCallback(
    (input: string) => {
      if (commandState.type !== "email_step") return;
      const { step, data } = commandState;

      if (step === "ask_recipient") {
        // Search CRM for matching contacts
        const searchTerm = input.toLowerCase().trim();
        setCommandState({ type: "email_step", step: "searching_crm", data: { ...data, recipientQuery: input } });

        const matches = crmCustomers.filter((c) => {
          const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
          return (
            fullName.includes(searchTerm) ||
            c.firstName.toLowerCase().includes(searchTerm) ||
            c.lastName.toLowerCase().includes(searchTerm) ||
            c.email.toLowerCase().includes(searchTerm)
          );
        });

        if (matches.length === 0) {
          setCommandState({
            type: "email_step",
            step: "pick_contact",
            data: { ...data, recipientQuery: input, matchedContacts: [] },
          });
        } else if (matches.length === 1) {
          // Exact match — auto-select
          setCommandState({
            type: "email_step",
            step: "ask_purpose",
            data: { ...data, recipientQuery: input, matchedContacts: matches, selectedContact: matches[0] },
          });
        } else {
          // Multiple matches — ask user to pick
          setCommandState({
            type: "email_step",
            step: "pick_contact",
            data: { ...data, recipientQuery: input, matchedContacts: matches },
          });
        }
        setQuery("");
        return;
      }

      if (step === "ask_purpose") {
        // User entered what the email is about — generate it with AI
        setCommandState({
          type: "email_step",
          step: "generating",
          data: { ...data, purpose: input },
        });
        setQuery("");
        generateEmailDraft(data.selectedContact!, input);
        return;
      }
    },
    [commandState, crmCustomers]
  );

  const selectEmailContact = useCallback(
    (contact: Customer) => {
      if (commandState.type !== "email_step") return;
      setCommandState({
        type: "email_step",
        step: "ask_purpose",
        data: { ...commandState.data, selectedContact: contact, matchedContacts: [contact] },
      });
    },
    [commandState]
  );

  // Generate the email draft via /api/chat (lightweight, non-blocking)
  const generateEmailDraft = useCallback(
    async (contact: Customer, purpose: string) => {
      try {
        const headers = await getAuthHeaders();
        headers["Content-Type"] = "application/json";

        const prompt = `Draft a professional email to ${contact.firstName} ${contact.lastName} (${contact.email})${contact.company ? ` from ${contact.company}` : ""}. The email should be about: ${purpose}. 

Keep it concise and professional. Write ONLY the email body text (no subject line, no greeting like "Dear" unless appropriate). Start with a natural greeting.`;

        const res = await fetch("/api/chat", {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            agentId: `${orgId}_jarvis`,
            soul: "You are an email drafting assistant. Write concise professional emails. Output ONLY the email text, nothing else.",
            brain: "",
            uid: user?.uid,
            userName: user?.displayName || undefined,
            model: "openai/gpt-oss-120b",
            stream: true,
            userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const contentType = res.headers.get("content-type") || "";
        let emailText = "";

        if (contentType.includes("text/event-stream") && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const payload = JSON.parse(line.slice(6));
                if (payload.token) emailText += payload.token;
              } catch {}
            }
          }
          // Flush buffer
          if (buffer.startsWith("data: ")) {
            try {
              const payload = JSON.parse(buffer.slice(6));
              if (payload.token) emailText += payload.token;
            } catch {}
          }
        } else {
          const data = await res.json();
          emailText = data.response || "Could not generate draft.";
        }

        setCommandState((prev) => {
          if (prev.type !== "email_step") return prev;
          return { type: "email_step", step: "done", data: { ...prev.data, draftHtml: emailText } };
        });
      } catch (err: any) {
        console.error("[Omnibar] Email draft error:", err);
        setCommandState({ type: "error", message: `Failed to generate email: ${err.message}` });
      }
    },
    [orgId, user?.uid, user?.displayName]
  );

  // ─── COMMAND: Ask Jarvis (general AI) ───
  const sendToJarvis = useCallback(
    async (text: string) => {
      if (!text.trim() || isAiLoading) return;
      setCommandState({ type: "ai_streaming", label: text });
      setIsAiLoading(true);
      setAiResponse("");

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const headers = await getAuthHeaders();
        headers["Content-Type"] = "application/json";
        const res = await fetch("/api/chat", {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            messages: [{ role: "user", content: text }],
            agentId: `${orgId}_jarvis`,
            soul: "You are J.A.R.V.I.S. — the user's AI executive assistant inside the Insight dashboard. Be concise and helpful. Keep responses brief (2-4 sentences max) since you are answering inside a compact omnibar.",
            brain: "",
            uid: user?.uid,
            userName: user?.displayName || undefined,
            model: "auto",
            stream: true,
            userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          setAiResponse(`Error: ${err.error || `HTTP ${res.status}`}`);
          setIsAiLoading(false);
          return;
        }

        const contentType = res.headers.get("content-type") || "";
        let fullText = "";

        if (contentType.includes("text/event-stream") && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const payload = JSON.parse(line.slice(6));
                // Token events: { token: "text" }
                if (payload.token) {
                  fullText += payload.token;
                  setAiResponse(fullText);
                }
                // Done event: { done: true }
                if (payload.done) break;
                // Error event: { error: "msg" }
                if (payload.error) {
                  fullText += "\n\nSomething went wrong. Try asking in the Agent Manager.";
                  setAiResponse(fullText);
                }
              } catch {}
            }
          }
          // Flush remaining buffer
          if (buffer.trim() && buffer.startsWith("data: ")) {
            try {
              const payload = JSON.parse(buffer.slice(6));
              if (payload.token) {
                fullText += payload.token;
                setAiResponse(fullText);
              }
            } catch {}
          }

          if (!fullText) {
            setAiResponse("I couldn't generate a response. Try asking in the full Agent Manager.");
          }
        } else {
          const data = await res.json();
          setAiResponse(data.response || data.fullText || "No response received.");
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setAiResponse(`Error: ${err.message || "Failed to connect to Jarvis"}`);
      } finally {
        setIsAiLoading(false);
      }
    },
    [orgId, user?.uid, user?.displayName, isAiLoading]
  );

  // ─── COMMAND: Search Inbox ───
  const startInboxSearch = useCallback(() => {
    setCommandState({ type: "loading", label: "Search my inbox" });
    // Immediately transition to ask what to search
    setTimeout(() => {
      setCommandState({ type: "inbox_ask" as any, label: "Search my inbox" });
      setQuery("");
      inputRef.current?.focus();
    }, 100);
  }, []);

  const executeInboxSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) return;
      setCommandState({ type: "ai_streaming", label: `Searching inbox for "${searchQuery}"` });
      setIsAiLoading(true);
      setAiResponse("");

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const headers = await getAuthHeaders();
        headers["Content-Type"] = "application/json";

        // Get user's refresh token for Gmail access
        let rToken = "";
        if (user?.uid) {
          const userDoc = await getDoc(doc(firestore, "users", user.uid));
          const userData = userDoc.data();
          rToken =
            userData?.gmailOAuth_jarvis?.refreshToken ||
            userData?.gmailOAuth_morpheus?.refreshToken ||
            userData?.gmailOAuth_email?.refreshToken ||
            "";
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            messages: [{ role: "user", content: `Search my Gmail inbox for: ${searchQuery}. Summarize the most relevant emails you find.` }],
            agentId: `${orgId}_jarvis`,
            soul: "You are J.A.R.V.I.S. Search the user's Gmail inbox using the search_emails tool and summarize what you find. Be concise.",
            brain: "",
            uid: user?.uid,
            refreshToken: rToken,
            userName: user?.displayName || undefined,
            model: "auto",
            stream: true,
            userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          setAiResponse(`Error: ${err.error || `HTTP ${res.status}`}`);
          setIsAiLoading(false);
          return;
        }

        const contentType = res.headers.get("content-type") || "";
        let fullText = "";

        if (contentType.includes("text/event-stream") && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const payload = JSON.parse(line.slice(6));
                if (payload.token) {
                  fullText += payload.token;
                  setAiResponse(fullText);
                }
                if (payload.done) break;
                if (payload.error) {
                  fullText += "\n\nSomething went wrong searching your inbox.";
                  setAiResponse(fullText);
                }
              } catch {}
            }
          }
          if (buffer.trim() && buffer.startsWith("data: ")) {
            try {
              const payload = JSON.parse(buffer.slice(6));
              if (payload.token) {
                fullText += payload.token;
                setAiResponse(fullText);
              }
            } catch {}
          }
          if (!fullText) {
            setAiResponse("Couldn't search your inbox. Make sure Gmail is connected in Settings.");
          }
        } else {
          const data = await res.json();
          setAiResponse(data.response || "No results.");
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setAiResponse(`Error: ${err.message || "Failed to search inbox"}`);
      } finally {
        setIsAiLoading(false);
      }
    },
    [orgId, user?.uid, user?.displayName, firestore]
  );

  // Execute a quick prompt command
  const executeQuickPrompt = useCallback(
    (prompt: QuickPrompt) => {
      setQuery("");
      switch (prompt.commandType) {
        case "tasks":
          runTasksSummary();
          break;
        case "calendar":
          runCalendar();
          break;
        case "inbox":
          startInboxSearch();
          break;
        case "ai":
          sendToJarvis(prompt.label);
          break;
      }
    },
    [runTasksSummary, runCalendar, startInboxSearch, sendToJarvis]
  );

  // Filter nav results based on query
  const results: SearchResult[] = useMemo(() => {
    const isInCommandFlow = commandState.type !== "idle";
    if (isInCommandFlow) return [];

    if (!query_.trim()) {
      const recent = loadRecent();
      return recent.map((r, i) => ({
        id: `recent-${i}`,
        label: r.label,
        secondary: "Recent",
        icon: <Clock className="w-4 h-4 opacity-40" />,
        action: () => {
          router.push(r.route);
          onClose();
        },
        category: "recent" as const,
      }));
    }

    const term = query_.toLowerCase().trim();
    return navItems
      .filter((item) => fuzzyMatch(term, item.label) || item.keywords.some((kw) => fuzzyMatch(term, kw)))
      .sort((a, b) => {
        const scoreA = Math.min(fuzzyScore(term, a.label), ...a.keywords.map((kw) => fuzzyScore(term, kw)));
        const scoreB = Math.min(fuzzyScore(term, b.label), ...b.keywords.map((kw) => fuzzyScore(term, kw)));
        return scoreA - scoreB;
      })
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        label: item.label,
        secondary: item.route.replace(dashboardHome, "~"),
        icon: item.icon,
        action: () => {
          saveRecent(item.label, item.route);
          router.push(item.route);
          onClose();
        },
        category: "navigation" as const,
      }));
  }, [query_, navItems, dashboardHome, router, onClose, commandState.type]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, query_]);

  // Detect AI-like queries
  const looksLikeAiQuery = useMemo(() => {
    if (!query_.trim() || query_.trim().length < 8) return false;
    const lower = query_.toLowerCase().trim();
    const questionPatterns = /^(what|how|why|when|where|who|can|could|should|will|is|are|do|does|tell|show|help|create|draft|write|send|find|search|summarize|explain|generate|make|build|list|give|get|check|look|update|schedule|analyze|compare)/;
    if (questionPatterns.test(lower)) return true;
    if (lower.split(/\s+/).length >= 4) return true;
    return false;
  }, [query_]);

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // Always go back one step; only close if already idle
        if (abortRef.current) abortRef.current.abort();
        if (commandState.type !== "idle") {
          setCommandState({ type: "idle" });
          setAiResponse("");
          setIsAiLoading(false);
          setQuery("");
          setTimeout(() => inputRef.current?.focus(), 50);
        } else {
          onClose();
        }
        return;
      }

      // Inbox search flow: Enter submits search query
      if ((commandState as any).type === "inbox_ask") {
        if (e.key === "Enter" && query_.trim()) {
          e.preventDefault();
          executeInboxSearch(query_.trim());
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        // If we're in a result/ai view and user typed something, send as follow-up to Jarvis
        if ((commandState.type === "result" || commandState.type === "ai_streaming" || commandState.type === "error") && query_.trim()) {
          sendToJarvis(query_.trim());
          return;
        }
        if (commandState.type !== "idle") return;
        if (results.length > 0 && selectedIndex < results.length) {
          results[selectedIndex].action();
        } else if (query_.trim()) {
          sendToJarvis(query_.trim());
        }
        return;
      }
    },
    [results, selectedIndex, onClose, commandState, query_, sendToJarvis, executeInboxSearch]
  );

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (abortRef.current) abortRef.current.abort();
        onClose();
      }
    },
    [onClose]
  );

  // ─── Determine what to show in input placeholder ───
  const getPlaceholder = (): string => {
    if ((commandState as any).type === "inbox_ask") return "What are you looking for in your inbox?";
    if (commandState.type === "result" || commandState.type === "ai_streaming") return "Ask Jarvis a follow-up...";
    if (commandState.type === "error") return "Try asking something else...";
    return "Search or ask Jarvis...";
  };

  if (!isOpen) return null;

  // ─── Render: Command Result Area ───
  const renderCommandArea = () => {
    if (commandState.type === "loading") {
      return (
        <div className={`px-5 py-4 border-b flex items-center gap-3 ${isDarkMode ? "border-slate-700/40" : "border-slate-200/60"}`}>
          <Loader2 className={`w-5 h-5 animate-spin ${isDarkMode ? "text-indigo-400" : "text-indigo-500"}`} />
          <span className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{commandState.label}...</span>
        </div>
      );
    }

    if (commandState.type === "result") {
      return (
        <div className={`px-5 py-4 border-b max-h-[360px] overflow-y-auto ${isDarkMode ? "border-slate-700/40" : "border-slate-200/60"}`}>
          <div className={`text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            {commandState.content.split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h2 key={i} className="text-base font-bold mb-2 mt-1">{line.replace("## ", "")}</h2>;
              if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold mb-1 mt-3">{line.replace("### ", "")}</h3>;
              if (line.startsWith("- **")) {
                const m = line.match(/^- \*\*(.+?)\*\*(.*)$/);
                if (m) return <div key={i} className="flex items-start gap-2 ml-2 mb-0.5"><span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-current opacity-40" /><span><strong>{m[1]}</strong>{m[2]}</span></div>;
              }
              if (line.startsWith("*") && line.endsWith("*")) return <p key={i} className={`text-xs mt-2 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{line.replace(/\*/g, "")}</p>;
              if (!line.trim()) return <div key={i} className="h-1" />;
              return <p key={i}>{line}</p>;
            })}
          </div>
        </div>
      );
    }

    if (commandState.type === "ai_streaming") {
      return (
        <div className={`px-5 py-4 border-b max-h-[280px] overflow-y-auto ${isDarkMode ? "border-slate-700/40" : "border-slate-200/60"}`}>
          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isDarkMode ? "bg-indigo-500/20" : "bg-indigo-50"}`}>
              <Bot className={`w-3.5 h-3.5 ${isDarkMode ? "text-indigo-400" : "text-indigo-500"}`} />
            </div>
            <div className={`flex-1 text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              {aiResponse || <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>Thinking...</span>}
              {isAiLoading && <span className={`inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm ${isDarkMode ? "bg-indigo-400" : "bg-indigo-500"}`} />}
            </div>
          </div>
          {!isAiLoading && aiResponse && (
            <button
              onClick={() => { router.push(`${dashboardHome}/ai-agents/jarvis`); onClose(); }}
              className={`mt-3 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${isDarkMode ? "text-indigo-400 hover:bg-indigo-500/10" : "text-indigo-600 hover:bg-indigo-50"}`}
            >
              Continue in Agent Manager →
            </button>
          )}
        </div>
      );
    }

    // Inbox search: ask step
    if ((commandState as any).type === "inbox_ask") {
      return (
        <div className={`px-5 py-4 border-b ${isDarkMode ? "border-slate-700/40" : "border-slate-200/60"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Search className={`w-4 h-4 ${isDarkMode ? "text-indigo-400" : "text-indigo-500"}`} />
            <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Search Inbox</span>
          </div>
          <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            What are you looking for? Type a keyword, name, or topic and press Enter.
          </p>
        </div>
      );
    }

    if (commandState.type === "error") {
      return (
        <div className={`px-5 py-4 border-b ${isDarkMode ? "border-slate-700/40" : "border-slate-200/60"}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <span className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{commandState.message}</span>
          </div>
        </div>
      );
    }

    return null;
  };

  // ─── Render: Email Draft Flow ───
  const renderEmailFlow = () => {
    if (commandState.type !== "email_step") return null;
    const { step, data } = commandState;

    return (
      <div className={`px-5 py-4 border-b max-h-[400px] overflow-y-auto ${isDarkMode ? "border-slate-700/40" : "border-slate-200/60"}`}>
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-3">
          <Mail className={`w-4 h-4 ${isDarkMode ? "text-indigo-400" : "text-indigo-500"}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Draft Email</span>
        </div>

        {step === "ask_recipient" && (
          <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            Who should the email be sent to? Type a name or email address and press Enter.
          </p>
        )}

        {step === "searching_crm" && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Searching CRM for &ldquo;{data.recipientQuery}&rdquo;...</span>
          </div>
        )}

        {step === "pick_contact" && (
          <div>
            {data.matchedContacts.length === 0 ? (
              <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                No contacts found matching &ldquo;{data.recipientQuery}&rdquo; in your CRM. 
                <button
                  onClick={() => setCommandState({ type: "email_step", step: "ask_recipient", data: { ...data, recipientQuery: "" } })}
                  className={`ml-2 font-semibold cursor-pointer ${isDarkMode ? "text-indigo-400" : "text-indigo-600"}`}
                >
                  Try again
                </button>
              </p>
            ) : (
              <div>
                <p className={`text-sm mb-3 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                  Found {data.matchedContacts.length} matching contact{data.matchedContacts.length > 1 ? "s" : ""}. Which one?
                </p>
                <div className="space-y-1.5">
                  {data.matchedContacts.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectEmailContact(c)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        isDarkMode
                          ? "hover:bg-slate-800/80 text-slate-300"
                          : "hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isDarkMode ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
                        {c.firstName?.[0]}{c.lastName?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.firstName} {c.lastName}</div>
                        <div className={`text-[11px] truncate ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                          {c.email}{c.company ? ` · ${c.company}` : ""}{c.phone ? ` · ${c.phone}` : ""}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDarkMode ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400"}`}>
                        {c.leadStatus}
                      </span>
                    </button>
                  ))}
                </div>
                {data.matchedContacts.length > 1 && (
                  <p className={`text-[11px] mt-2 ${isDarkMode ? "text-slate-600" : "text-slate-400"}`}>
                    💡 If these are duplicate contacts, you can merge them in the CRM.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {step === "ask_purpose" && data.selectedContact && (
          <div>
            <div className={`flex items-center gap-3 px-3 py-2 rounded-xl mb-3 ${isDarkMode ? "bg-slate-800/60" : "bg-slate-50"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isDarkMode ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
                {data.selectedContact.firstName?.[0]}{data.selectedContact.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{data.selectedContact.firstName} {data.selectedContact.lastName}</div>
                <div className={`text-[11px] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                  {data.selectedContact.email}{data.selectedContact.company ? ` · ${data.selectedContact.company}` : ""}
                  {data.selectedContact.location ? ` · ${data.selectedContact.location}` : ""}
                </div>
              </div>
            </div>
            <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              What is this email about? Describe the purpose and press Enter.
            </p>
          </div>
        )}

        {step === "generating" && (
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            <span className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Drafting email to {data.selectedContact?.firstName}...</span>
          </div>
        )}

        {step === "done" && data.selectedContact && (
          <div>
            <div className={`flex items-center justify-between mb-3`}>
              <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? "text-green-400" : "text-green-600"}`}>✓ Draft Ready</span>
              <span className={`text-[11px] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>To: {data.selectedContact.email}</span>
            </div>
            <div className={`text-sm leading-relaxed whitespace-pre-wrap p-4 rounded-xl border ${
              isDarkMode ? "bg-slate-800/60 border-slate-700/40 text-slate-200" : "bg-white border-slate-200 text-slate-800"
            }`}>
              {data.draftHtml}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(data.draftHtml);
                }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  isDarkMode ? "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                }`}
              >
                Copy to clipboard
              </button>
              <button
                onClick={() => { router.push(`${dashboardHome}/gmail`); onClose(); }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  isDarkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                Open Gmail →
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-[15vh] px-4" onClick={handleBackdropClick}>
      {/* Backdrop */}
      <div className={`absolute inset-0 ${isDarkMode ? "bg-black/50 backdrop-blur-sm" : "bg-black/20 backdrop-blur-sm"}`} />

      {/* Palette Container */}
      <div
        ref={containerRef}
        className={`relative w-full max-w-2xl flex flex-col overflow-hidden rounded-2xl transition-all duration-300 ${
          isDarkMode
            ? "bg-slate-900/90 backdrop-blur-2xl border border-slate-700/60 border-t-white/[0.12] shadow-xl shadow-indigo-500/5"
            : "bg-white/95 backdrop-blur-2xl border border-slate-200/80 border-t-white/80 shadow-xl shadow-slate-300/30"
        }`}
        style={{ animation: "omnibarSlideIn 0.2s ease-out" }}
      >
        {/* Input Row */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${isDarkMode ? "border-slate-700/40" : "border-slate-200/60"}`}>
          <div className={`shrink-0 ${commandState.type === "loading" || commandState.type === "ai_streaming" ? "animate-pulse" : ""}`}>
            {isAiLoading || commandState.type === "loading" ? (
              <Loader2 className={`w-5 h-5 animate-spin ${isDarkMode ? "text-indigo-400" : "text-indigo-500"}`} />
            ) : (
              <Sparkles className={`w-5 h-5 ${isDarkMode ? "text-indigo-400" : "text-indigo-500"}`} />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query_}
            onChange={(e) => {
              setQuery(e.target.value);
              // If user starts typing in error mode, go back to idle
              if (commandState.type === "error") {
                setCommandState({ type: "idle" });
                setAiResponse("");
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            className={`flex-1 bg-transparent outline-none text-sm font-medium placeholder:font-normal ${
              isDarkMode ? "text-slate-100 placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"
            }`}
            autoComplete="off"
            spellCheck={false}
          />

          {/* Right side badges */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[9px] font-bold tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap ${
              isDarkMode ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "bg-indigo-50 text-indigo-500 border border-indigo-100"
            }`}>
              ✦ Insight AI
            </span>
            <kbd className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md hidden sm:inline-block ${
              isDarkMode ? "bg-slate-800 text-slate-500 border border-slate-700" : "bg-slate-100 text-slate-400 border border-slate-200"
            }`}>
              {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>
            <button
              onClick={() => { if (abortRef.current) abortRef.current.abort(); onClose(); }}
              className={`p-1 rounded-md transition-colors cursor-pointer ${isDarkMode ? "text-slate-500 hover:text-slate-300 hover:bg-slate-800" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Command Result Area */}
        {renderCommandArea()}

        {/* Nav Results List — only in idle/search mode */}
        {commandState.type === "idle" && (
          <div className="max-h-[340px] overflow-y-auto">
            {results.length > 0 ? (
              <div className="py-2 px-2">
                {results.map((result, idx) => (
                  <button
                    key={result.id}
                    onClick={result.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer group ${
                      idx === selectedIndex
                        ? isDarkMode ? "bg-slate-800/80 text-white" : "bg-slate-100 text-slate-900"
                        : isDarkMode ? "text-slate-300 hover:bg-slate-800/50" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      idx === selectedIndex
                        ? isDarkMode ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-50 text-indigo-500"
                        : isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
                    }`}>
                      {result.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block truncate">{result.label}</span>
                      <span className={`text-[11px] truncate block ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{result.secondary}</span>
                    </div>
                    {idx === selectedIndex && <CornerDownLeft className={`w-3.5 h-3.5 shrink-0 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`} />}
                  </button>
                ))}
              </div>
            ) : query_.trim() ? (
              <div className="py-8 px-5 text-center">
                <p className={`text-sm ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>No results for &ldquo;{query_}&rdquo;</p>
                {looksLikeAiQuery && (
                  <button
                    onClick={() => sendToJarvis(query_.trim())}
                    className={`mt-3 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer ${
                      isDarkMode ? "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20" : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    Ask Jarvis instead
                  </button>
                )}
              </div>
            ) : null}

            {/* "Ask Jarvis" prompt row */}
            {looksLikeAiQuery && results.length > 0 && (
              <div className="px-2 pb-2">
                <button
                  onClick={() => sendToJarvis(query_.trim())}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    isDarkMode
                      ? "bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-400 border border-indigo-500/10"
                      : "bg-indigo-50/50 hover:bg-indigo-50 text-indigo-600 border border-indigo-100/50"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? "bg-indigo-500/20" : "bg-indigo-100"}`}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Ask Jarvis: &ldquo;{query_.trim()}&rdquo;</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick Prompt Suggestions — shown when idle and no query */}
        {!query_.trim() && commandState.type === "idle" && (
          <div className={`px-5 py-3 border-t ${isDarkMode ? "border-slate-700/40" : "border-slate-200/60"}`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2.5 ${isDarkMode ? "text-slate-600" : "text-slate-400"}`}>
              Quick commands
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  onClick={() => executeQuickPrompt(prompt)}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer hover:scale-105 active:scale-100 ${
                    isDarkMode
                      ? "bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 border border-slate-700/40"
                      : "bg-slate-100/80 hover:bg-slate-200/80 text-slate-500 hover:text-slate-700 border border-slate-200/60"
                  }`}
                >
                  {prompt.icon}
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`px-5 py-2.5 border-t flex items-center justify-between ${isDarkMode ? "border-slate-700/40 bg-slate-900/50" : "border-slate-200/60 bg-slate-50/50"}`}>
          <div className="flex items-center gap-1">
            <kbd className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? "bg-slate-800 text-slate-500" : "bg-slate-200/80 text-slate-400"}`}>esc</kbd>
            <span className={`text-[9px] ml-0.5 ${isDarkMode ? "text-slate-600" : "text-slate-400"}`}>{commandState.type !== "idle" ? "Back" : "Close"}</span>
          </div>
          <span className={`text-[9px] ${isDarkMode ? "text-slate-600" : "text-slate-400"}`}>Powered by Jarvis</span>
        </div>
      </div>

      <style>{`
        @keyframes omnibarSlideIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
