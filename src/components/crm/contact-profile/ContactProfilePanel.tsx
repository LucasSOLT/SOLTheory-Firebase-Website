"use client";

import React, { useState, useMemo, useRef } from "react";
import type { Customer, CrmActivity } from "@/stores/crm-store";
import { useCRMStore } from "@/stores/crm-store";
import { X, Mail, Phone, MapPin, Building2, Tag, Brain, Loader2, Video, ChevronDown, ChevronUp, Search, Clock, ExternalLink, AlertTriangle, RotateCw, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import ActivityTimeline from "./ActivityTimeline";
import { getAuthHeaders } from "@/lib/api-auth-client";

interface ContactProfilePanelProps {
  customer: Customer | null;
  onClose: () => void;
  onEdit: () => void;
}

/* ─── Markdown-lite: **bold**, URLs, bullets ─── */
function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.trim() === "") return <div key={i} className="h-2" />;

    const segments: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*)|(https?:\/\/[^\s,)]+)/g;
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIdx) segments.push(line.slice(lastIdx, match.index));
      if (match[1]) {
        segments.push(<strong key={`b-${i}-${match.index}`} className="font-bold text-indigo-900">{match[2]}</strong>);
      } else if (match[3]) {
        const url = match[3].replace(/[.,;:!?)]+$/, "");
        segments.push(
          <a key={`u-${i}-${match.index}`} href={url} target="_blank" rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-500 transition-colors inline-flex items-center gap-0.5 break-all">
            {url}<ExternalLink className="w-3 h-3 shrink-0 inline-block" />
          </a>
        );
      }
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < line.length) segments.push(line.slice(lastIdx));

    const isBullet = line.trim().startsWith("•") || line.trim().startsWith("-");
    return <p key={i} className={`text-[13px] leading-relaxed ${isBullet ? "pl-2" : ""}`}>{segments.length > 0 ? segments : line}</p>;
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
function InsightSkeleton() {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100/60 p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-indigo-200 rounded" />
        <div className="h-3 w-32 bg-indigo-200 rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-indigo-100 rounded" />
        <div className="h-3 w-4/5 bg-indigo-100 rounded" />
        <div className="h-3 w-3/5 bg-indigo-100 rounded" />
        <div className="h-2" />
        <div className="h-3 w-full bg-indigo-100 rounded" />
        <div className="h-3 w-2/3 bg-indigo-100 rounded" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Jarvis is researching the web...</span>
      </div>
    </div>
  );
}

function ContactProfilePanel({ customer, onClose, onEdit }: ContactProfilePanelProps) {
  const { updateCustomer, addActivity, showToast, activities } = useCRMStore();
  const [isEnriching, setIsEnriching] = useState(false);
  const [insightExpanded, setInsightExpanded] = useState(false);
  const [searchContext, setSearchContext] = useState("");
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const [contextHint, setContextHint] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const lastEnrichTime = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!customer) return null;

  /* ─── Insight history for this contact ─── */
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

  /* ─── Quick Action Handlers ─── */
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

  /* ─── Enrichment with differential + web search ─── */
  const handleEnrich = async () => {
    const now = Date.now();
    const timeSinceLastSearch = now - lastEnrichTime.current;

    if (timeSinceLastSearch < 120_000 && !searchContext.trim() && insightActivities.length > 0) {
      setContextHint(true);
      inputRef.current?.focus();
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
          // Custom fields for precise filtering/disambiguation
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

  return (
    <div className="fixed inset-y-0 right-0 w-[800px] bg-slate-50 shadow-2xl z-50 flex flex-col border-l border-slate-200 transform transition-transform duration-300">
      <div className="fixed inset-0 bg-black/20 -z-10" onClick={onClose} />

      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <Avatar className="w-12 h-12 rounded-xl ring-2 ring-slate-100">
            <AvatarFallback className="bg-indigo-50 text-indigo-700 text-lg font-bold rounded-xl">
              {customer.firstName?.[0]}{customer.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800 leading-tight">
                {customer.firstName} {customer.lastName}
              </h2>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                Contact Intelligence
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 font-medium">
              {customer.company && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {customer.company}</span>}
              {customer.company && customer.location && <span>•</span>}
              {customer.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {customer.location}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onEdit} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm">
            Edit Profile
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Sidebar */}
        <div className="w-80 bg-white border-r border-slate-200 p-6 overflow-y-auto shrink-0 flex flex-col gap-6">

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleEmail} className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors group cursor-pointer">
              <Mail className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 mb-1.5" />
              <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-700 uppercase tracking-wide">Email</span>
            </button>
            <button onClick={handleCall} className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-colors group cursor-pointer">
              <Phone className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 mb-1.5" />
              <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-700 uppercase tracking-wide">Call</span>
            </button>
            <button onClick={handleMeet} className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-colors group cursor-pointer">
              <Video className="w-5 h-5 text-slate-400 group-hover:text-purple-600 mb-1.5" />
              <span className="text-[10px] font-bold text-slate-500 group-hover:text-purple-700 uppercase tracking-wide">Meet</span>
            </button>
          </div>

          {/* ─── Agentic Insights ─── */}
          <div className="flex flex-col gap-3">
            {/* Generate Button */}
            <button
              onClick={handleEnrich}
              disabled={isEnriching}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white border-2 border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-50 hover:border-indigo-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wider shadow-sm"
            >
              {isEnriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {isEnriching ? "Searching the web..." : "Generate Insights"}
            </button>

            {/* Context Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchContext}
                onChange={(e) => setSearchContext(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !isEnriching) handleEnrich(); }}
                placeholder='Guide Jarvis (e.g. "find LinkedIn")'
                className={`w-full pl-8 pr-3 py-2 text-xs border rounded-lg focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 outline-none bg-slate-50 placeholder:text-slate-400 transition-all ${
                  contextHint ? "border-amber-400 ring-2 ring-amber-400/30 bg-amber-50/50" : "border-slate-200"
                }`}
              />
              {contextHint && (
                <div className="absolute -bottom-6 left-0 text-[10px] font-semibold text-amber-600 animate-pulse">
                  Add context for more targeted results
                </div>
              )}
            </div>

            {/* Loading Skeleton */}
            {isEnriching && <InsightSkeleton />}

            {/* Error Card */}
            {enrichError && !isEnriching && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-red-800 mb-1">Enrichment Failed</p>
                    <p className="text-[11px] text-red-700 leading-relaxed mb-2">{enrichError.slice(0, 200)}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEnrichError(null); handleEnrich(); }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white text-[10px] font-bold rounded-md hover:bg-red-700 transition-colors uppercase tracking-wider"
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
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
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
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isActive
                          ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300/50"
                          : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
                          Insight Report
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatInsightTimestamp(ts)}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed truncate ${isActive ? "text-indigo-800" : "text-slate-600"}`}>
                        {preview}...
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Full Report Display */}
            {activeInsight && !isEnriching && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100/60 overflow-hidden">
                <button
                  onClick={() => setInsightExpanded(!insightExpanded)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-indigo-100/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-indigo-700" />
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">Full Report</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeInsightTimestamp && (
                      <span className="text-[10px] text-indigo-500 font-medium">{formatInsightTimestamp(activeInsightTimestamp)}</span>
                    )}
                    {insightExpanded ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-indigo-500" />}
                  </div>
                </button>

                <div className={`relative transition-all duration-300 ease-in-out ${insightExpanded ? "max-h-[50vh]" : "max-h-[100px]"}`}>
                  <div className={`px-4 pb-4 text-indigo-900/80 ${insightExpanded ? "max-h-[50vh] overflow-y-auto" : "max-h-[100px] overflow-hidden"}`}>
                    {renderMarkdown(activeInsightContent)}
                  </div>
                  {!insightExpanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-indigo-50 to-transparent flex items-end justify-center pb-2 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setInsightExpanded(true); }}>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 flex items-center gap-1">
                        <ChevronDown className="w-3 h-3" /> Show more
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Empty state */}
            {insightActivities.length === 0 && !isEnriching && !enrichError && (
              <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-xl border border-dashed border-indigo-200 p-4 text-center">
                <Brain className="w-6 h-6 text-indigo-300 mx-auto mb-2" />
                <p className="text-xs text-indigo-400 font-medium leading-relaxed">
                  No insights yet. Click &quot;Generate Insights&quot; to let Jarvis research this contact using live web search.
                </p>
              </div>
            )}
          </div>

          {/* About Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">About Contact</h4>
            <div className="space-y-4">
              {customer.email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-slate-400 mb-0.5">Email Address</div>
                    <div className="text-sm font-medium text-slate-800 break-all">{customer.email}</div>
                  </div>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-slate-400 mb-0.5">Phone Number</div>
                    <div className="text-sm font-medium text-slate-800">{customer.phone}</div>
                  </div>
                </div>
              )}
              {customer.tags && customer.tags.length > 0 && (
                <div className="flex items-start gap-3">
                  <Tag className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-slate-400 mb-1.5">Tags</div>
                    <div className="flex flex-wrap gap-1.5">
                      {customer.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-md border border-slate-200">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Timeline */}
        <div className="flex-1 bg-slate-50/50 p-6 overflow-hidden flex flex-col">
          <ActivityTimeline
            customerId={customer.id}
            onInsightClick={(activityId) => { setSelectedInsightId(activityId); setInsightExpanded(true); }}
          />
        </div>
      </div>
    </div>
  );
}

export default React.memo(ContactProfilePanel);
