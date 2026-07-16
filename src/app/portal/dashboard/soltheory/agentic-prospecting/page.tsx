"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot, Search, Plus, Activity, ArrowUpRight, CheckCircle2, ArrowRight,
  ClipboardList, Mail, Send, AlertCircle, ExternalLink,
  X as XIcon, CalendarDays, FileText, Layers, Target, TrendingUp
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useUser, useFirestore } from "@/firebase";
import { useTranslation } from "@/lib/i18n";
import Image from "next/image";

/* ── Types ── */
interface AgentScout {
  id: string;
  name: string;
  tagline: string;
  description: string;
  orgCategory: string;
  icon: React.ReactNode;
  status: "active" | "locked" | "custom";
  details: string[];
  actionLabel: string;
  imageUrl?: string;
  route?: string;
}

/* ═══════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════ */

export default function AgenticProspectingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isDarkMode: dk } = useTheme();
  const { t } = useTranslation();
  const { user } = useUser();
  const firestore = useFirestore();

  const orgPrefix = pathname.includes("/nxtchapter/") ? "nxtchapter" : "soltheory";
  const dash = `/portal/dashboard/${orgPrefix}`;

  /* ── state ── */
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // consultation modal
  const [isConsultOpen, setIsConsultOpen] = useState(false);
  const [consultSubject, setConsultSubject] = useState("Consultation Request: Custom Agentic Prospecting Build");
  const [consultBody, setConsultBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<"success" | "error" | null>(null);
  const [sendErrorMsg, setSendErrorMsg] = useState("");
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  /* ── check gmail ── */
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const { getRefreshToken } = await import("@/lib/gmail-api");
        const tok = await getRefreshToken(user.uid);
        if (!cancelled) { setRefreshToken(tok); setGmailConnected(!!tok); }
      } catch { if (!cancelled) setGmailConnected(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  /* ── agents ── */
  const agents: AgentScout[] = [
    {
      id: "federal-grants",
      name: "Federal Grant Scout",
      tagline: "Autonomous Grant Scouting & Matching",
      description: "Scans federal repositories daily, matches eligibility with your organizational profile, and compiles comprehensive grant opportunity reports.",
      orgCategory: "Health and Human Services",
      icon: <ClipboardList className="w-5 h-5" />,
      status: "active",
      details: ["Region: XT Chapter Area", "Frequency: Daily", "Source: Grants.gov"],
      actionLabel: "Open Dashboard",
      imageUrl: "/federal_grant_scout_demo.png",
      route: `${dash}/agentic-prospecting/federal-grant-scout`,
    },
    {
      id: "philanthropic-grants",
      name: "Philanthropic Grant Scout",
      tagline: "Foundation & Private Funding Discovery",
      description: "Discovers private foundations, corporate giving programs, and philanthropic organizations aligned with your mission using IRS 990 data and foundation databases.",
      orgCategory: "Health and Human Services",
      icon: <ClipboardList className="w-5 h-5" />,
      status: "active",
      details: ["Source: ProPublica, IRS 990-PF", "Focus: Foundations & Philanthropists", "Frequency: Configurable"],
      actionLabel: "Open Dashboard",
      imageUrl: "/philanthropic_grant_scout_demo.png",
      route: `${dash}/agentic-prospecting/philanthropic-grant-scout`,
    },
  ];

  const categories = ["All", ...Array.from(new Set(agents.map(a => a.orgCategory)))];
  const filtered = agents.filter(a => {
    const catOk = activeCategory === "All" || a.orgCategory === activeCategory;
    const qOk = !searchQuery || [a.name, a.description, a.tagline].some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return catOk && qOk;
  });

  /* ── handlers ── */
  const handleAction = (a: AgentScout) => {
    if (a.status === "active" && a.route) router.push(a.route);
    else openConsult();
  };

  const openConsult = useCallback(() => {
    setConsultSubject("Consultation Request: Custom Agentic Prospecting Build");
    setConsultBody(`Hello SOL Theory team,\n\nI am reaching out to schedule a consultation call regarding a custom Agentic Prospecting build for our organization.\n\nWe are interested in discussing:\n• Our specific data targets and use cases\n• Deliverables and expected outputs\n• Timeline and implementation scope\n• Pricing and engagement terms\n\nPlease let me know your earliest availability.\n\nBest regards,\n${user?.displayName || user?.email || "Team Member"}`);
    setSendResult(null); setSendErrorMsg(""); setIsConsultOpen(true);
  }, [user?.displayName, user?.email]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !refreshToken) return;
    setIsSending(true); setSendResult(null); setSendErrorMsg("");
    try {
      const { sendEmail } = await import("@/lib/gmail-api");
      const res = await sendEmail(user.uid, refreshToken, "steve@soltheory.com", consultSubject, consultBody.replace(/\n/g, "<br/>"));
      if (res.success) {
        if (firestore) {
          const { collection, addDoc, Timestamp } = await import("firebase/firestore");
          await addDoc(collection(firestore, "support_tickets"), {
            subject: consultSubject, description: consultBody, status: "Unanswered", priority: "high",
            category: "Agentic Prospecting Consultation", organizationId: orgPrefix,
            fromEmail: user.email || "unknown", fromName: user.displayName || "User",
            toEmail: "steve@soltheory.com", toName: "Steve — SOL Theory",
            createdBy: user.uid, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
            tags: ["agentic-prospecting-consultation", "email-sent"],
          });
        }
        setSendResult("success");
      } else { setSendResult("error"); setSendErrorMsg(res.error || "Failed to send."); }
    } catch (err: any) { setSendResult("error"); setSendErrorMsg(err?.message || "An error occurred."); }
    finally { setIsSending(false); }
  };

  const gmailUrl = user?.uid ? `/api/auth/google?uid=${user.uid}&agentId=campaigning&origin=soltheory&returnTo=agentic-prospecting` : "#";

  /* ── common classes ── */
  const surface  = dk ? "bg-[#111214] border-[#1e2028]" : "bg-white border-slate-200";
  const surface2 = dk ? "bg-[#0c0d0f]" : "bg-[#f7f7f5]";
  const txt      = dk ? "text-slate-100" : "text-slate-900";
  const txt2     = dk ? "text-slate-400" : "text-slate-500";
  const txt3     = dk ? "text-slate-500" : "text-slate-400";
  const divide   = dk ? "border-[#1e2028]" : "border-slate-200";

  return (
    <div className={`min-h-screen ${surface2} ${txt} overflow-y-auto`} style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-8">

        {/* ── header ── */}
        <div className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className={`text-[11px] font-medium uppercase tracking-wide mb-2 ${txt3}`}>Flagship Capability</p>
              <h1 className={`text-2xl font-semibold tracking-tight mb-2 ${txt}`}>{t.agenticProspecting || "Agentic Prospecting"}</h1>
              <p className={`text-[14px] leading-relaxed max-w-xl ${txt2}`}>
                Deploy autonomous AI agents custom-engineered to scan databases, match eligibility, and deliver qualified targets — each one calibrated through consultation with the SOL Theory team.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={openConsult}
                className={`inline-flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer ${dk ? "bg-slate-100 text-slate-900 hover:bg-white" : "bg-slate-900 text-white hover:bg-slate-800"}`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Schedule Consultation
              </button>
              <button
                onClick={() => router.push(`${dash}/support-tickets`)}
                className={`inline-flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-lg border transition-colors cursor-pointer ${dk ? "border-[#1e2028] text-slate-300 hover:bg-[#17181c]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                Support
              </button>
            </div>
          </div>
        </div>

        {/* ── filter bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className={`text-[15px] font-semibold ${txt}`}>Agent Directory</h2>
            <div className={`flex items-center gap-0.5 p-0.5 rounded-lg border ${dk ? "border-[#1e2028] bg-[#111214]" : "border-slate-200 bg-slate-100"}`}>
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setActiveCategory(c)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                    activeCategory === c
                      ? dk ? "bg-[#1e2028] text-slate-100 shadow-sm" : "bg-white text-slate-900 shadow-sm"
                      : `${txt3} hover:${txt2}`
                  }`}
                >{c}</button>
              ))}
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${txt3} pointer-events-none`} />
            <input
              type="text" placeholder="Search agents…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-lg text-[13px] border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${dk ? "bg-[#111214] border-[#1e2028] text-slate-100 placeholder-slate-600" : "bg-white border-slate-200 text-slate-800 placeholder-slate-400"}`}
            />
          </div>
        </div>

        {/* ── agent cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-14">
          {filtered.map(agent => (
            <div
              key={agent.id}
              className={`group flex flex-col rounded-xl border overflow-hidden transition-shadow hover:shadow-md ${surface}`}
            >
              {/* Image */}
              <div className={`relative w-full h-44 overflow-hidden ${dk ? "bg-[#0c0d0f]" : "bg-slate-50"}`}>
                {agent.imageUrl ? (
                  <Image src={agent.imageUrl} alt={agent.name} fill className="object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Bot className={`w-10 h-10 ${txt3}`} />
                  </div>
                )}
                <div className={`absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t ${dk ? "from-[#111214]" : "from-white"} to-transparent`} />

                <span className={`absolute bottom-3 left-4 text-[10px] font-medium px-2 py-0.5 rounded-md ${dk ? "bg-[#111214]/80 text-slate-400 backdrop-blur-sm" : "bg-white/80 text-slate-500 backdrop-blur-sm"}`}>
                  {agent.orgCategory}
                </span>
              </div>

              {/* Body */}
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${dk ? "bg-[#1e2028] text-indigo-400" : "bg-slate-50 text-indigo-600"}`}>
                    {agent.icon}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className={`text-[15px] font-semibold mb-0.5 ${txt}`}>{agent.name}</h3>
                    <p className={`text-[11px] font-medium uppercase tracking-wide ${txt3}`}>{agent.tagline}</p>
                  </div>
                </div>

                <p className={`text-[13px] leading-relaxed mb-4 flex-1 ${txt2}`}>{agent.description}</p>

                {/* specs */}
                <div className={`rounded-lg p-3 mb-4 space-y-1.5 ${dk ? "bg-[#0c0d0f]" : "bg-slate-50"}`}>
                  {agent.details.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-indigo-500 shrink-0" />
                      <span className={`text-[12px] ${txt2}`}>{d}</span>
                    </div>
                  ))}
                </div>

                {/* actions */}
                <div className={`flex items-center gap-2 pt-3 border-t ${divide}`}>
                  <button
                    onClick={() => handleAction(agent)}
                    className={`flex-1 py-2 rounded-lg text-[13px] font-medium cursor-pointer flex items-center justify-center gap-1.5 transition-colors ${
                      agent.status === "active"
                        ? dk ? "bg-slate-100 text-slate-900 hover:bg-white" : "bg-slate-900 text-white hover:bg-slate-800"
                        : dk ? "bg-[#1e2028] text-slate-300 hover:bg-[#252830]" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {agent.actionLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  {agent.status === "active" && (
                    <button
                      onClick={() => router.push(`${dash}/grant-statuses`)}
                      className={`px-2.5 py-2 rounded-lg border transition-colors cursor-pointer ${dk ? "border-[#1e2028] text-slate-400 hover:text-slate-200 hover:bg-[#17181c]" : "border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50"}`}
                      title="View Grants"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* placeholder tile */}
          <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed p-8 min-h-[380px] ${dk ? "border-[#1e2028] bg-[#0c0d0f]" : "border-slate-200 bg-[#f7f7f5]"}`}>
            <div className={`w-10 h-10 rounded-lg border border-dashed flex items-center justify-center mb-3 ${dk ? "border-[#2a2d38]" : "border-slate-300"}`}>
              <Plus className={`w-4 h-4 ${txt3}`} />
            </div>
            <p className={`text-[13px] font-medium mb-1 ${dk ? "text-slate-400" : "text-slate-500"}`}>More agents coming soon</p>
            <p className={`text-[12px] text-center max-w-[220px] mb-4 ${txt3}`}>Custom agents are built after consultation, tailored to your needs.</p>
            <button
              onClick={openConsult}
              className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${dk ? "bg-[#1e2028] text-slate-300 hover:bg-[#252830]" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              <Mail className="w-3 h-3" />
              Request a Build
            </button>
          </div>
        </div>

        {/* ── how it works ── */}
        <div className="mb-14">
          <div className="flex items-center justify-between mb-5">
            <h2 className={`text-[15px] font-semibold ${txt}`}>How Custom Tailoring Works</h2>
            <button
              onClick={openConsult}
              className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${dk ? "bg-slate-100 text-slate-900 hover:bg-white" : "bg-slate-900 text-white hover:bg-slate-800"}`}
            >
              <Send className="w-3 h-3" />
              Start Consultation
            </button>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-3 border rounded-xl overflow-hidden ${surface} ${divide}`}>
            {[
              { n: "01", title: "Consultation", desc: "Define data targets, compliance requirements, delivery preferences, and pricing with our solutions engineers.", icon: <Target className="w-4 h-4" /> },
              { n: "02", title: "Build & Calibrate", desc: "We engineer a custom pipeline tuned to your CRM schemas, trained on your proprietary documents, and configured to your schedules.", icon: <Layers className="w-4 h-4" /> },
              { n: "03", title: "Deploy & Monitor", desc: "Your agent goes live — scanning continuously, firing alerts when matches are found, and improving from your feedback.", icon: <TrendingUp className="w-4 h-4" /> },
            ].map((s, i) => (
              <div key={s.n} className={`p-6 ${i > 0 ? (dk ? "md:border-l border-t md:border-t-0 border-[#1e2028]" : "md:border-l border-t md:border-t-0 border-slate-200") : ""}`}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className={`${dk ? "text-indigo-400" : "text-indigo-600"}`}>{s.icon}</span>
                  <span className={`text-[11px] font-medium uppercase tracking-wide ${txt3}`}>Step {s.n}</span>
                </div>
                <h3 className={`text-[14px] font-semibold mb-1.5 ${txt}`}>{s.title}</h3>
                <p className={`text-[13px] leading-relaxed ${txt2}`}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── footer ── */}
        <div className={`flex items-center justify-between py-4 border-t ${divide}`}>
          <p className={`text-[11px] ${txt3}`}>
            All prospecting agents are enterprise-grade pipelines with private model training and webhook integrations.
          </p>
        </div>
      </div>

      {/* ═══════════ CONSULTATION MODAL ═══════════ */}
      <AnimatePresence>
        {isConsultOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsConsultOpen(false)}>
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }} onClick={e => e.stopPropagation()}
              className={`w-full max-w-lg rounded-xl border overflow-hidden shadow-xl ${dk ? "bg-[#111214] border-[#1e2028]" : "bg-white border-slate-200"}`}
            >
              {/* header */}
              <div className={`px-6 pt-5 pb-4 border-b ${divide} flex items-center justify-between`}>
                <div>
                  <h2 className={`text-[15px] font-semibold ${txt}`}>Request a Consultation</h2>
                  <p className={`text-[12px] mt-0.5 ${txt3}`}>Send a message to the SOL Theory team</p>
                </div>
                <button onClick={() => setIsConsultOpen(false)} className={`w-7 h-7 rounded-md flex items-center justify-center cursor-pointer ${dk ? "text-slate-500 hover:bg-[#1e2028]" : "text-slate-400 hover:bg-slate-100"}`}>
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5">
                {/* gmail warning */}
                {gmailConnected === false && (
                  <div className={`flex items-start gap-3 p-3 rounded-lg mb-5 ${dk ? "bg-amber-500/5 border border-amber-500/15" : "bg-amber-50 border border-amber-200/60"}`}>
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className={`text-[13px] font-medium mb-1 ${dk ? "text-amber-300" : "text-amber-800"}`}>Google account not connected</p>
                      <p className={`text-[12px] leading-relaxed mb-2 ${dk ? "text-amber-400/80" : "text-amber-700/80"}`}>
                        Connect your Google account to send this directly from your email.
                      </p>
                      <a href={gmailUrl} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-medium transition-colors cursor-pointer">
                        <ExternalLink className="w-3 h-3" /> Connect Account
                      </a>
                    </div>
                  </div>
                )}

                {/* what to expect */}
                <div className={`p-3 rounded-lg mb-5 ${dk ? "bg-[#0c0d0f] border border-[#1e2028]" : "bg-slate-50 border border-slate-100"}`}>
                  <p className={`text-[12px] font-medium mb-1 ${txt2}`}>What to expect</p>
                  <ul className={`text-[11px] leading-relaxed space-y-0.5 ${txt3}`}>
                    <li>• Discovery call with a solutions engineer</li>
                    <li>• Review of data targets and compliance needs</li>
                    <li>• Deliverables, timeline, and scope outline</li>
                    <li>• Pricing and engagement terms</li>
                  </ul>
                </div>

                {sendResult === "success" ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                    <h3 className={`text-[15px] font-semibold mb-1 ${txt}`}>Request Sent</h3>
                    <p className={`text-[13px] max-w-sm mx-auto ${txt2}`}>
                      Your message has been sent to <span className="font-medium">steve@soltheory.com</span>. Expect a follow-up within 1–2 business days.
                    </p>
                    <button onClick={() => setIsConsultOpen(false)} className={`mt-4 px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer ${dk ? "bg-slate-100 text-slate-900" : "bg-slate-900 text-white"}`}>Close</button>
                  </div>
                ) : (
                  <form onSubmit={handleSend} className="space-y-4">
                    {/* to */}
                    <div>
                      <label className={`text-[11px] font-medium uppercase tracking-wide block mb-1.5 ${txt3}`}>To</label>
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[13px] ${dk ? "bg-[#0c0d0f] border-[#1e2028] text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                        <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="font-medium">steve@soltheory.com</span>
                      </div>
                    </div>
                    {/* subject */}
                    <div>
                      <label className={`text-[11px] font-medium uppercase tracking-wide block mb-1.5 ${txt3}`}>Subject</label>
                      <input type="text" required value={consultSubject} onChange={e => setConsultSubject(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg text-[13px] border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${dk ? "bg-[#0c0d0f] border-[#1e2028] text-slate-100" : "bg-white border-slate-200 text-slate-800"}`} />
                    </div>
                    {/* body */}
                    <div>
                      <label className={`text-[11px] font-medium uppercase tracking-wide block mb-1.5 ${txt3}`}>Message</label>
                      <textarea required rows={7} value={consultBody} onChange={e => setConsultBody(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg text-[13px] border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none leading-relaxed ${dk ? "bg-[#0c0d0f] border-[#1e2028] text-slate-100" : "bg-white border-slate-200 text-slate-800"}`} />
                    </div>
                    {sendResult === "error" && (
                      <div className={`flex items-center gap-2 p-2.5 rounded-lg text-[13px] ${dk ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"}`}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {sendErrorMsg}
                      </div>
                    )}
                    {gmailConnected && (
                      <p className={`flex items-center gap-1.5 text-[11px] ${txt3}`}>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Sending from <span className="font-medium">{user?.email}</span>
                      </p>
                    )}
                  </form>
                )}
              </div>

              {/* footer */}
              {sendResult !== "success" && (
                <div className={`px-6 py-4 border-t flex items-center justify-end gap-2 ${divide}`}>
                  <button type="button" onClick={() => setIsConsultOpen(false)} className={`px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer ${dk ? "text-slate-400 hover:bg-[#1e2028]" : "text-slate-500 hover:bg-slate-100"}`}>Cancel</button>
                  <button
                    onClick={handleSend as any} disabled={isSending || !gmailConnected}
                    className={`px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer flex items-center gap-1.5 transition-colors ${!gmailConnected ? "bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-[#1e2028] dark:text-slate-600" : dk ? "bg-slate-100 text-slate-900 hover:bg-white" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                  >
                    {isSending ? <><Activity className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <><Send className="w-3.5 h-3.5" /> Send Request</>}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
