"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { Customer, CrmActivity } from "@/stores/crm-store";
import { useCRMStore } from "@/stores/crm-store";
import { useTheme } from "@/components/ThemeProvider";
import {
  X, Mail, Phone, MapPin, Building2, Tag, Brain, Loader2, Video,
  ChevronDown, ChevronUp, Search, Clock, ExternalLink, AlertTriangle,
  RotateCw, Sparkles, MessageCircle, ArrowLeft, Send, Copy, Check,
  BookOpen, Activity, BarChart3, Briefcase, Globe, DollarSign,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import ActivityTimeline from "./ActivityTimeline";
import { getAuthHeaders } from "@/lib/api-auth-client";

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface ContactProfilePanelProps {
  customer: Customer | null;
  onClose: () => void;
  onEdit: () => void;
}

type TabId = "chat" | "insights" | "activity";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Markdown-lite: **bold**, URLs, bullets ─── */
function renderMarkdown(text: string, isDarkMode: boolean) {
  return text.split("\n").map((line, i) => {
    if (line.trim() === "") return <div key={i} className="h-2" />;

    const segments: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*)|(https?:\/\/[^\s,)]+)/g;
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIdx) segments.push(line.slice(lastIdx, match.index));
      if (match[1]) {
        segments.push(
          <strong key={`b-${i}-${match.index}`} className={`font-bold ${isDarkMode ? 'text-white' : 'text-indigo-900'}`}>
            {match[2]}
          </strong>
        );
      } else if (match[3]) {
        const url = match[3].replace(/[.,;:!?)]+$/, "");
        segments.push(
          <a key={`u-${i}-${match.index}`} href={url} target="_blank" rel="noopener noreferrer"
            className="text-indigo-500 hover:text-indigo-600 underline underline-offset-2 decoration-indigo-300/50 hover:decoration-indigo-500 transition-colors inline-flex items-center gap-0.5 break-all">
            {url}<ExternalLink className="w-3 h-3 shrink-0 inline-block" />
          </a>
        );
      }
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < line.length) segments.push(line.slice(lastIdx));

    const isBullet = line.trim().startsWith("•") || line.trim().startsWith("-");
    return (
      <p key={i} className={`text-[13px] leading-relaxed ${isBullet ? "pl-2" : ""}`}>
        {segments.length > 0 ? segments : line}
      </p>
    );
  });
}

/* ─── Timestamp formatter ─── */
function formatInsightTimestamp(dateInput?: any): string {
  if (!dateInput) return "";
  const d = dateInput instanceof Date ? dateInput : (dateInput?.toDate ? dateInput.toDate() : new Date(dateInput));
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  if (d.getFullYear() !== now.getFullYear()) return `${day}/${month}/${d.getFullYear()}, ${h}:${m} ${ampm}`;
  return `${day}/${month}, ${h}:${m} ${ampm}`;
}

/* ─── Loading skeleton ─── */
function InsightSkeleton({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className={`rounded-xl border p-4 space-y-3 animate-pulse ${isDarkMode ? 'bg-indigo-950/30 border-indigo-800/40' : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100/60'}`}>
      <div className="flex items-center gap-2">
        <div className={`w-4 h-4 rounded ${isDarkMode ? 'bg-indigo-800' : 'bg-indigo-200'}`} />
        <div className={`h-3 w-32 rounded ${isDarkMode ? 'bg-indigo-800' : 'bg-indigo-200'}`} />
      </div>
      <div className="space-y-2">
        <div className={`h-3 w-full rounded ${isDarkMode ? 'bg-indigo-900/60' : 'bg-indigo-100'}`} />
        <div className={`h-3 w-4/5 rounded ${isDarkMode ? 'bg-indigo-900/60' : 'bg-indigo-100'}`} />
        <div className={`h-3 w-3/5 rounded ${isDarkMode ? 'bg-indigo-900/60' : 'bg-indigo-100'}`} />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Jarvis is researching the web...</span>
      </div>
    </div>
  );
}

/* ─── Clipboard copy button ─── */
function CopyButton({ text, isDarkMode }: { text: string; isDarkMode: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className={`p-1 rounded-md transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`} title="Copy">
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

function ContactProfilePanel({ customer, onClose, onEdit }: ContactProfilePanelProps) {
  const { isDarkMode } = useTheme();
  const { updateCustomer, addActivity, showToast, activities } = useCRMStore();

  /* ─── Tab state ─── */
  const [activeTab, setActiveTab] = useState<TabId>("chat");

  /* ─── Insights state ─── */
  const [isEnriching, setIsEnriching] = useState(false);
  const [insightExpanded, setInsightExpanded] = useState(false);
  const [searchContext, setSearchContext] = useState("");
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const [contextHint, setContextHint] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const lastEnrichTime = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ─── Chat state (ephemeral — NOT persisted to Firestore) ─── */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  /* ─── Animation ─── */
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    if (customer) {
      requestAnimationFrame(() => setIsVisible(true));
    }
  }, [customer]);

  /* Reset state when customer changes */
  useEffect(() => {
    setChatMessages([]);
    setChatInput("");
    setActiveTab("chat");
    setSelectedInsightId(null);
    setInsightExpanded(false);
    setEnrichError(null);
    setSearchContext("");
  }, [customer?.id]);

  /* Scroll chat to bottom */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  if (!customer) return null;

  /* ─── Derived data ─── */
  const insightActivities = activities
    .filter(a => a.customerId === customer.id && a.type === "insight")
    .sort((a, b) => {
      const tA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp || 0).getTime();
      const tB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp || 0).getTime();
      return tB - tA;
    });

  const activeInsight = selectedInsightId
    ? insightActivities.find(a => a.id === selectedInsightId)
    : insightActivities[0] || null;

  const activeInsightContent = activeInsight?.content || "";
  const activeInsightTimestamp = activeInsight?.timestamp;

  const firstName = customer.firstName || "this contact";

  /* ═══════════════════════════════════════════════════════════════
     HANDLERS
     ═══════════════════════════════════════════════════════════════ */

  /* ─── Quick Actions ─── */
  const handleEmail = () => {
    if (!customer.email) { showToast("Email not found — add an email address in Edit Profile first.", "error"); return; }
    window.open(`mailto:${customer.email}?subject=${encodeURIComponent(`Following up — ${customer.firstName}`)}`, "_self");
    addActivity({ customerId: customer.id, type: "email", content: `Opened email client to contact ${customer.email}.`, createdBy: "user" });
  };

  const handleCall = () => {
    if (!customer.phone) { showToast("Phone # not found — add a phone number in Edit Profile first.", "error"); return; }
    window.open(`tel:${customer.phone}`, "_self");
    addActivity({ customerId: customer.id, type: "call", content: `Initiated call to ${customer.phone}.`, createdBy: "user" });
  };

  const handleMeet = () => {
    if (!customer.email) { showToast("Email not found — need an email to send a meeting invite.", "error"); return; }
    const title = encodeURIComponent(`Meeting with ${customer.firstName} ${customer.lastName}`);
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&add=${encodeURIComponent(customer.email)}`, "_blank");
    addActivity({ customerId: customer.id, type: "meeting", content: `Opened Google Calendar to schedule a meeting with ${customer.firstName}.`, createdBy: "user" });
  };

  /* ─── Enrichment (Generate Insights) ─── */
  const handleEnrich = async () => {
    const now = Date.now();
    const timeSinceLastSearch = now - lastEnrichTime.current;

    if (timeSinceLastSearch < 120_000 && !searchContext.trim() && insightActivities.length > 0) {
      setContextHint(true);
      searchInputRef.current?.focus();
      setTimeout(() => setContextHint(false), 3000);
      if (timeSinceLastSearch < 10_000) {
        showToast("Tip: Add context in the search box for different results!", "info");
        return;
      }
    }

    setIsEnriching(true);
    setEnrichError(null);
    lastEnrichTime.current = now;

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch("/api/crm/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          company: customer.company,
          phone: customer.phone,
          location: customer.location,
          tags: customer.tags,
          leadStatus: customer.leadStatus,
          totalRevenue: customer.totalRevenue,
          outstandingBalance: customer.outstandingBalance,
          userContext: searchContext.trim() || undefined,
          previousInsight: activeInsightContent || undefined,
          jobTitle: customer.customFields?.jobTitle || undefined,
          role: customer.customFields?.role || undefined,
          department: customer.customFields?.department || undefined,
          industry: customer.customFields?.industry || undefined,
          website: customer.customFields?.website || undefined,
          linkedinUrl: customer.customFields?.linkedinUrl || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Enrichment failed (${res.status})`);
      }

      const data = await res.json();

      const insightActivity = await addActivity({
        customerId: customer.id,
        type: "insight",
        content: data.enrichment,
        createdBy: "jarvis"
      });

      await updateCustomer(customer.id, { aiNotes: data.enrichment });

      await addActivity({
        customerId: customer.id,
        type: "note",
        content: `Jarvis researched ${customer.firstName} ${customer.lastName}${searchContext ? ` (context: "${searchContext}")` : ""}${data.hasWebData ? " using live web search" : ""} and generated an enrichment report.`,
        createdBy: "jarvis"
      });

      const providerLabel = data.provider?.startsWith("gemini") ? "Gemini AI"
        : data.provider === "groq" ? "Groq AI"
        : data.provider === "tavily-search" ? "Web Search"
        : "AI";
      showToast(`Jarvis enriched via ${providerLabel}${data.hasWebData ? " + Web Search" : ""}`, "success");
      setSearchContext("");
      setSelectedInsightId(insightActivity.id);
      setInsightExpanded(true);
    } catch (err: any) {
      console.error("[CRM Enrich] Client error:", err);
      setEnrichError(err.message || "Enrichment failed");
    } finally {
      setIsEnriching(false);
    }
  };

  /* ─── AI Chat ─── */
  const handleSendChat = async (overrideMessage?: string) => {
    const msg = overrideMessage || chatInput.trim();
    if (!msg || isChatLoading) return;

    const userMessage: ChatMessage = { role: "user", content: msg };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const authHeaders = await getAuthHeaders();

      // Build activity summary for context
      const contactActivities = activities
        .filter(a => a.customerId === customer.id)
        .slice(0, 30) // Last 30 activities
        .map(a => {
          const d = a.timestamp?.toDate ? a.timestamp.toDate() : new Date();
          return `[${a.type}] ${d.toLocaleDateString()}: ${a.content.slice(0, 200)}`;
        })
        .join("\n");

      const insightTexts = insightActivities.map(a => a.content.slice(0, 500));

      const res = await fetch("/api/crm/contact-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          messages: updatedMessages,
          contactData: {
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone,
            company: customer.company,
            location: customer.location,
            leadStatus: customer.leadStatus,
            tags: customer.tags,
            totalRevenue: customer.totalRevenue,
            outstandingBalance: customer.outstandingBalance,
            customFields: customer.customFields,
          },
          insights: insightTexts,
          activitySummary: contactActivities,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const data = await res.json();
      let responseText = data.response || "I'm sorry, I couldn't process that request.";

      // Handle action responses from AI
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.action === "add_note" && parsed.content) {
          await addActivity({ customerId: customer.id, type: "note", content: parsed.content, createdBy: "jarvis" });
          responseText = `✅ Note added: "${parsed.content.slice(0, 100)}${parsed.content.length > 100 ? '...' : ''}"`;
          showToast("Note saved to activity timeline", "success");
        } else if (parsed.action === "generate_insights") {
          responseText = "Starting insight generation now...";
          setTimeout(() => { setActiveTab("insights"); handleEnrich(); }, 500);
        }
      } catch {
        // Not JSON — it's a normal text response, which is fine
      }

      setChatMessages(prev => [...prev, { role: "assistant", content: responseText }]);
    } catch (err) {
      console.error("[Contact Chat] Error:", err);
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  /* ═══════════════════════════════════════════════════════════════
     TAB DEFINITIONS
     ═══════════════════════════════════════════════════════════════ */

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "chat", label: "AI Chat", icon: <MessageCircle className="w-3.5 h-3.5" /> },
    { id: "insights", label: "Insights", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: "activity", label: "Activity", icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  /* ═══════════════════════════════════════════════════════════════
     QUICK ACTION CHIPS (for chat welcome)
     ═══════════════════════════════════════════════════════════════ */

  const quickChips = [
    { label: "Generate insights", action: () => { setActiveTab("insights"); handleEnrich(); } },
    { label: "Find LinkedIn", action: () => handleSendChat(`Find LinkedIn profile for ${customer.firstName} ${customer.lastName}${customer.company ? ` at ${customer.company}` : ""}`) },
    { label: "Draft follow-up email", action: () => handleSendChat(`Draft a professional follow-up email to ${customer.firstName} ${customer.lastName}`) },
    { label: "Summarize activity", action: () => handleSendChat(`Summarize all activity and notes for ${customer.firstName} ${customer.lastName}`) },
  ];

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${isDarkMode ? 'bg-black/40' : 'bg-black/20'} backdrop-blur-sm`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex flex-col transition-transform duration-300 ease-out
          w-full sm:max-w-[520px]
          ${isDarkMode ? 'bg-slate-900 border-l border-white/10' : 'bg-white border-l border-slate-200'}
          shadow-2xl ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}
      >

        {/* ─── Header ─── */}
        <div className={`px-5 py-4 flex items-center justify-between shrink-0 border-b ${isDarkMode ? 'border-white/10 bg-slate-900' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile back button */}
            <button onClick={handleClose} className={`sm:hidden p-1.5 -ml-1 rounded-lg transition-colors ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Avatar className="w-10 h-10 rounded-xl ring-2 ring-slate-100/50 shrink-0">
              <AvatarFallback className={`text-sm font-bold rounded-xl ${isDarkMode ? 'bg-indigo-950/50 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                {customer.firstName?.[0]}{customer.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className={`text-base font-semibold leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {customer.firstName} {customer.lastName}
              </h2>
              <div className={`flex items-center gap-1.5 mt-0.5 text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {customer.company && <span className="flex items-center gap-1 truncate"><Building2 className="w-3 h-3 shrink-0" /> {customer.company}</span>}
                {customer.company && customer.location && <span>·</span>}
                {customer.location && <span className="truncate">{customer.location}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onEdit} className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Edit
            </button>
            <button onClick={handleClose} className={`hidden sm:flex p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Tab Carousel ─── */}
        <div className={`flex gap-1 px-4 py-2 shrink-0 border-b ${isDarkMode ? 'border-white/10 bg-slate-900/80' : 'border-slate-100 bg-slate-50/50'}`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === tab.id
                  ? isDarkMode
                    ? 'bg-indigo-500/15 text-indigo-300 shadow-sm'
                    : 'bg-indigo-50 text-indigo-700 shadow-sm'
                  : isDarkMode
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Tab Content ─── */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* ════════════ AI CHAT TAB ════════════ */}
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {chatMessages.length === 0 ? (
                  /* Welcome state */
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                      <Sparkles className={`w-7 h-7 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                    </div>
                    <h3 className={`text-xl font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      Hello! 👋
                    </h3>
                    <p className={`text-lg mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      How can I help with {firstName}?
                    </p>
                    <p className={`text-sm mb-8 max-w-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      I can see all of {firstName}&apos;s data, insights, notes, and emails.
                    </p>

                    {/* Quick action chips */}
                    <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                      {quickChips.map(chip => (
                        <button
                          key={chip.label}
                          onClick={chip.action}
                          className={`px-3 py-1.5 text-[12px] font-medium rounded-full border transition-all hover:-translate-y-0.5 cursor-pointer ${
                            isDarkMode
                              ? 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Chat messages */
                  <>
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? `rounded-2xl rounded-br-md ${isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white'}`
                            : `rounded-2xl rounded-bl-md ${isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`
                        }`}>
                          {msg.role === "assistant"
                            ? renderMarkdown(msg.content, isDarkMode)
                            : msg.content}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className={`px-4 py-3 rounded-2xl rounded-bl-md ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full animate-bounce ${isDarkMode ? 'bg-slate-500' : 'bg-slate-400'}`} style={{ animationDelay: "0ms" }} />
                            <div className={`w-2 h-2 rounded-full animate-bounce ${isDarkMode ? 'bg-slate-500' : 'bg-slate-400'}`} style={{ animationDelay: "150ms" }} />
                            <div className={`w-2 h-2 rounded-full animate-bounce ${isDarkMode ? 'bg-slate-500' : 'bg-slate-400'}`} style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              {/* Chat input */}
              <div className={`px-4 py-3 border-t shrink-0 ${isDarkMode ? 'border-white/10 bg-slate-900' : 'border-slate-100 bg-white'}`}>
                <div className={`flex items-end gap-2 rounded-2xl border px-3 py-2 ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                  <textarea
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChat();
                      }
                    }}
                    placeholder={`Ask about ${firstName}...`}
                    rows={1}
                    className={`flex-1 text-sm resize-none outline-none bg-transparent py-1 max-h-24 ${isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'}`}
                  />
                  <button
                    onClick={() => handleSendChat()}
                    disabled={!chatInput.trim() || isChatLoading}
                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className={`text-[10px] mt-1.5 text-center ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </div>
          )}

          {/* ════════════ INSIGHTS TAB ════════════ */}
          {activeTab === "insights" && (
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={handleEmail} className={`flex flex-col items-center justify-center p-3 border rounded-xl transition-colors group cursor-pointer ${isDarkMode ? 'border-slate-700 hover:border-indigo-500/30 hover:bg-indigo-950/20' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'}`}>
                  <Mail className={`w-5 h-5 mb-1.5 ${isDarkMode ? 'text-slate-400 group-hover:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-600'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-500 group-hover:text-indigo-400' : 'text-slate-500 group-hover:text-indigo-700'}`}>Email</span>
                </button>
                <button onClick={handleCall} className={`flex flex-col items-center justify-center p-3 border rounded-xl transition-colors group cursor-pointer ${isDarkMode ? 'border-slate-700 hover:border-emerald-500/30 hover:bg-emerald-950/20' : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'}`}>
                  <Phone className={`w-5 h-5 mb-1.5 ${isDarkMode ? 'text-slate-400 group-hover:text-emerald-400' : 'text-slate-400 group-hover:text-emerald-600'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-500 group-hover:text-emerald-400' : 'text-slate-500 group-hover:text-emerald-700'}`}>Call</span>
                </button>
                <button onClick={handleMeet} className={`flex flex-col items-center justify-center p-3 border rounded-xl transition-colors group cursor-pointer ${isDarkMode ? 'border-slate-700 hover:border-purple-500/30 hover:bg-purple-950/20' : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50'}`}>
                  <Video className={`w-5 h-5 mb-1.5 ${isDarkMode ? 'text-slate-400 group-hover:text-purple-400' : 'text-slate-400 group-hover:text-purple-600'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-500 group-hover:text-purple-400' : 'text-slate-500 group-hover:text-purple-700'}`}>Meet</span>
                </button>
              </div>

              {/* Generate Insights */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleEnrich}
                  disabled={isEnriching}
                  className={`w-full flex items-center justify-center gap-2.5 px-4 py-2.5 text-xs font-bold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wider shadow-sm border-2 cursor-pointer ${
                    isDarkMode
                      ? 'bg-slate-800 border-indigo-500/30 text-indigo-300 hover:bg-indigo-950/30 hover:border-indigo-500/50'
                      : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300'
                  }`}
                >
                  {isEnriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                  {isEnriching ? "Searching the web..." : "Generate Insights"}
                </button>

                {/* Context Input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchContext}
                    onChange={(e) => setSearchContext(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !isEnriching) handleEnrich(); }}
                    placeholder='Guide Jarvis (e.g. "find LinkedIn")'
                    className={`w-full pl-8 pr-3 py-2 text-xs border rounded-lg outline-none transition-all ${
                      contextHint
                        ? "border-amber-400 ring-2 ring-amber-400/30 bg-amber-50/50"
                        : isDarkMode
                          ? 'border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                          : 'border-slate-200 bg-slate-50 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20'
                    }`}
                  />
                  {contextHint && (
                    <div className="absolute -bottom-6 left-0 text-[10px] font-semibold text-amber-600 animate-pulse">
                      Add context for more targeted results
                    </div>
                  )}
                </div>

                {/* Loading Skeleton */}
                {isEnriching && <InsightSkeleton isDarkMode={isDarkMode} />}

                {/* Error Card */}
                {enrichError && !isEnriching && (
                  <div className={`rounded-xl border p-3.5 ${isDarkMode ? 'bg-red-950/20 border-red-800/40' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className={`text-xs font-bold mb-1 ${isDarkMode ? 'text-red-300' : 'text-red-800'}`}>Enrichment Failed</p>
                        <p className={`text-[11px] leading-relaxed mb-2 ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>{enrichError.slice(0, 200)}</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEnrichError(null); handleEnrich(); }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white text-[10px] font-bold rounded-md hover:bg-red-700 transition-colors uppercase tracking-wider cursor-pointer"
                          >
                            <RotateCw className="w-3 h-3" /> Retry
                          </button>
                          <span className="text-[10px] text-red-400">or add context above</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Insight History Tiles */}
                {insightActivities.length > 0 && !isEnriching && (
                  <div className="flex flex-col gap-2 mt-1">
                    <h4 className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      <Brain className="w-3 h-3" /> Insights ({insightActivities.length})
                    </h4>

                    {insightActivities.map((insight) => {
                      const isActive = activeInsight?.id === insight.id;
                      const ts = insight.timestamp?.toDate ? insight.timestamp.toDate() : new Date(insight.timestamp || 0);
                      const preview = insight.content.replace(/\*\*/g, "").slice(0, 80);

                      return (
                        <button
                          key={insight.id}
                          onClick={() => { setSelectedInsightId(insight.id); setInsightExpanded(true); setEnrichError(null); }}
                          className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                            isActive
                              ? isDarkMode ? "bg-indigo-950/30 border-indigo-700/60 ring-1 ring-indigo-600/30" : "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300/50"
                              : isDarkMode ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600" : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? (isDarkMode ? "text-indigo-400" : "text-indigo-600") : (isDarkMode ? "text-slate-500" : "text-slate-400")}`}>
                              Insight Report
                            </span>
                            <span className={`text-[10px] font-medium flex items-center gap-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              <Clock className="w-2.5 h-2.5" />
                              {formatInsightTimestamp(ts)}
                            </span>
                          </div>
                          <p className={`text-xs leading-relaxed truncate ${isActive ? (isDarkMode ? "text-indigo-300" : "text-indigo-800") : (isDarkMode ? "text-slate-400" : "text-slate-600")}`}>
                            {preview}...
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Full Report Display */}
                {activeInsight && !isEnriching && (
                  <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-indigo-950/20 border-indigo-800/40' : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100/60'}`}>
                    <button
                      onClick={() => setInsightExpanded(!insightExpanded)}
                      className={`w-full px-4 py-3 flex items-center justify-between transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-indigo-900/20' : 'hover:bg-indigo-100/30'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Brain className={`w-4 h-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`} />
                        <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-300' : 'text-indigo-800'}`}>Full Report</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeInsightTimestamp && (
                          <span className={`text-[10px] font-medium ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`}>{formatInsightTimestamp(activeInsightTimestamp)}</span>
                        )}
                        {insightExpanded ? <ChevronUp className={`w-4 h-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`} /> : <ChevronDown className={`w-4 h-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`} />}
                      </div>
                    </button>

                    <div className={`relative transition-all duration-300 ease-in-out ${insightExpanded ? "max-h-[50vh]" : "max-h-[100px]"}`}>
                      <div className={`px-4 pb-4 ${isDarkMode ? 'text-indigo-200/80' : 'text-indigo-900/80'} ${insightExpanded ? "max-h-[50vh] overflow-y-auto" : "max-h-[100px] overflow-hidden"}`}>
                        {renderMarkdown(activeInsightContent, isDarkMode)}
                      </div>
                      {!insightExpanded && (
                        <div className={`absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t flex items-end justify-center pb-2 cursor-pointer ${isDarkMode ? 'from-slate-900' : 'from-indigo-50'}`}
                          onClick={(e) => { e.stopPropagation(); setInsightExpanded(true); }}>
                          <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`}>
                            <ChevronDown className="w-3 h-3" /> Show more
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {insightActivities.length === 0 && !isEnriching && !enrichError && (
                  <div className={`rounded-xl border border-dashed p-4 text-center ${isDarkMode ? 'bg-indigo-950/10 border-indigo-800/30' : 'bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border-indigo-200'}`}>
                    <Brain className={`w-6 h-6 mx-auto mb-2 ${isDarkMode ? 'text-indigo-500' : 'text-indigo-300'}`} />
                    <p className={`text-xs font-medium leading-relaxed ${isDarkMode ? 'text-indigo-400' : 'text-indigo-400'}`}>
                      No insights yet. Click &quot;Generate Insights&quot; to let Jarvis research this contact using live web search.
                    </p>
                  </div>
                )}
              </div>

              {/* About Contact — EXPANDED to show all non-empty fields */}
              <div>
                <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>About Contact</h4>
                <div className="space-y-3.5">
                  {customer.email && (
                    <div className="flex items-start gap-3">
                      <Mail className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-semibold uppercase mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Email</div>
                        <div className={`text-sm font-medium break-all flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          {customer.email}
                          <CopyButton text={customer.email} isDarkMode={isDarkMode} />
                        </div>
                      </div>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-semibold uppercase mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Phone</div>
                        <div className={`text-sm font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          {customer.phone}
                          <CopyButton text={customer.phone} isDarkMode={isDarkMode} />
                        </div>
                      </div>
                    </div>
                  )}
                  {customer.company && (
                    <div className="flex items-start gap-3">
                      <Building2 className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-semibold uppercase mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Company</div>
                        <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{customer.company}</div>
                      </div>
                    </div>
                  )}
                  {customer.location && (
                    <div className="flex items-start gap-3">
                      <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-semibold uppercase mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Location</div>
                        <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{customer.location}</div>
                      </div>
                    </div>
                  )}
                  {customer.leadStatus && (
                    <div className="flex items-start gap-3">
                      <BarChart3 className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-semibold uppercase mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Lead Status</div>
                        <div className={`text-sm font-medium capitalize ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{customer.leadStatus}</div>
                      </div>
                    </div>
                  )}
                  {(customer.totalRevenue !== undefined && customer.totalRevenue > 0) && (
                    <div className="flex items-start gap-3">
                      <DollarSign className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-semibold uppercase mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Total Revenue</div>
                        <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>${customer.totalRevenue.toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                  {customer.customFields?.jobTitle && (
                    <div className="flex items-start gap-3">
                      <Briefcase className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-semibold uppercase mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Job Title</div>
                        <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{customer.customFields.jobTitle}</div>
                      </div>
                    </div>
                  )}
                  {customer.customFields?.linkedinUrl && (
                    <div className="flex items-start gap-3">
                      <Globe className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-semibold uppercase mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>LinkedIn</div>
                        <a href={customer.customFields.linkedinUrl} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium text-indigo-500 hover:text-indigo-600 underline underline-offset-2 break-all">
                          {customer.customFields.linkedinUrl}
                        </a>
                      </div>
                    </div>
                  )}
                  {customer.tags && customer.tags.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Tag className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-semibold uppercase mb-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Tags</div>
                        <div className="flex flex-wrap gap-1.5">
                          {customer.tags.map(tag => (
                            <span key={tag} className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════════════ ACTIVITY TAB ════════════ */}
          {activeTab === "activity" && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <ActivityTimeline
                customerId={customer.id}
                onInsightClick={(activityId) => {
                  setSelectedInsightId(activityId);
                  setInsightExpanded(true);
                  setActiveTab("insights");
                }}
              />
            </div>
          )}

        </div>
      </div>
    </>
  );
}

export default React.memo(ContactProfilePanel);
