"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Plus, ChevronRight, ChevronLeft, Play, Pause, BarChart3,
  Mail, Clock, Users, Zap, CheckCircle2, XCircle, Eye,
  Trash2, Copy, Edit3, MoreHorizontal, X, ArrowRight,
  Calendar, Target, FileText, Sparkles, Send, AlertCircle,
  Timer, Pen, Check, UserPlus, Search, Inbox, ArrowUpRight,
  GitBranch, EyeOff, Reply, Settings, Save, Building2,
  ChevronDown,
} from "lucide-react";
import { useUser, useFirestore } from "@/firebase/provider";
import { collection, query, onSnapshot, doc, getDoc, setDoc } from "firebase/firestore";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type CampaignKind = "inbound" | "outbound" | "automated";

export interface Campaign {
  id: string;
  name: string;
  kind: CampaignKind;
  status: CampaignStatus;
  templateId: string | null;
  subject: string;
  body: string;
  recipients: { id: string; name: string; email: string }[];
  triggerAt: string;
  repeatDays: number;
  createdAt: string;
  sent: number;
  opened: number;
  clicked: number;
}

interface CRMContact {
  id: string;
  name: string;
  email: string;
  aliases?: string;
  tags?: string[];
}

/* ═══════════════════════════════════════════════════════════════
   TEMPLATES
   ═══════════════════════════════════════════════════════════════ */

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  color: string;
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: "tpl-newsletter",
    name: "Monthly Newsletter",
    category: "Marketing",
    subject: "{{org_name}} Monthly Update — {{month}} Edition",
    body: `Hi {{first_name}},\n\nHere's what's new this month at {{org_name}}:\n\n📌 HIGHLIGHTS\n• [Feature update or news]\n• [Achievement or milestone]\n\n📚 RESOURCES\n• [Blog post or article link]\n• [Upcoming event or webinar]\n\n💡 TIP OF THE MONTH\n[Share a valuable insight or best practice]\n\nStay tuned for more updates!\n\nCheers,\nThe {{org_name}} Team`,
    color: "from-purple-500 to-violet-600",
  },
  {
    id: "tpl-promo",
    name: "Promotional Offer",
    category: "Sales",
    subject: "🎉 Exclusive offer just for you, {{first_name}}",
    body: `Hi {{first_name}},\n\nAs a valued member of the {{org_name}} community, we're excited to offer you an exclusive deal:\n\n🎁 [OFFER DETAILS]\n• [Discount percentage or value]\n• [Validity period]\n• [How to redeem]\n\nThis offer is available for a limited time only. Don't miss out!\n\n[CTA Button: Claim Your Offer]\n\nQuestions? Reply to this email and we'll be happy to help.\n\nBest,\nThe {{org_name}} Team`,
    color: "from-rose-500 to-pink-600",
  },
  {
    id: "tpl-expert-qa",
    name: "Expert Q&A",
    category: "Thought Leadership",
    subject: "{{org_name}} Expert Insights — {{month}}",
    body: `Hi {{first_name}},\n\nWelcome to this month's Expert Q&A — your inside look at the trends and strategies shaping our industry.\n\n🎤 FEATURED EXPERT Q&A\nQ: [Question about a key industry challenge]\nA: [Detailed expert answer with actionable advice]\n\n💎 KEY INSIGHT\n"[A compelling quote or insight from the expert that readers can apply immediately.]"\n\n📊 By the Numbers\n• [Relevant statistic #1]\n• [Relevant statistic #2]\n\nWant to dive deeper? [CTA: Read the Full Interview →]\n\nHave a question for our next expert? Reply to this email — we'd love to feature it.\n\nBest regards,\nThe {{org_name}} Team`,
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "tpl-product-update",
    name: "Product Update",
    category: "Product",
    subject: "What's New at {{org_name}} — {{month}}",
    body: `Hi {{first_name}},\n\nHere's what we've been building this month at {{org_name}}:\n\n🚀 NEW FEATURES\n• [Feature name] — [Brief description of what it does and why it matters]\n• [Feature name] — [Brief description]\n\n⚡ IMPROVEMENTS\n• [Improvement #1 — e.g., "Faster load times across dashboards"]\n• [Improvement #2 — e.g., "Redesigned settings page for easier navigation"]\n\n🐛 BUG FIXES\n• [Fix #1 — e.g., "Resolved an issue where notifications were delayed"]\n• [Fix #2 — e.g., "Fixed CSV export formatting"]\n\nWant to see these updates in action? [CTA: Explore What's New →]\n\nAs always, your feedback shapes our roadmap. Let us know what you think!\n\nCheers,\nThe {{org_name}} Team`,
    color: "from-emerald-500 to-teal-600",
  },
  {
    id: "tpl-industry-digest",
    name: "Industry Digest",
    category: "Curation",
    subject: "{{org_name}} Industry Digest — {{month}}",
    body: `Hi {{first_name}},\n\nHere's your curated roundup of the most important industry news and insights this month.\n\n📰 TOP STORIES\n• [Headline #1] — [One-line summary and why it matters]\n• [Headline #2] — [One-line summary and why it matters]\n• [Headline #3] — [One-line summary and why it matters]\n\n🔥 TRENDING TOPICS\n• [Topic #1] — [Brief context on why this is gaining traction]\n• [Topic #2] — [Brief context]\n\n📖 MUST-READ\n• [Article or report title] — [Why this is worth your time]\n• [Article or report title] — [Key takeaway]\n\nStay ahead of the curve — [CTA: Read the Full Digest →]\n\nKnow someone who'd love this? Forward this email to a colleague.\n\nBest,\nThe {{org_name}} Team`,
    color: "from-amber-500 to-orange-600",
  },
  {
    id: "tpl-vip-early-access",
    name: "VIP Early Access",
    category: "VIP",
    subject: "Exclusive VIP Access for {{first_name}}",
    body: `Hi {{first_name}},\n\nYou're receiving this because you're one of our most valued members — and we wanted you to be the first to know.\n\n🔓 EXCLUSIVE EARLY ACCESS\n[Describe the product, feature, or offer that VIP members get access to before anyone else.]\n\n🎁 YOUR VIP PERKS\n• Early access before the public launch\n• [Special discount or bonus — e.g., "20% off for the first 48 hours"]\n• [Additional perk — e.g., "Priority support during your trial"]\n\n⏳ This exclusive window closes on [deadline date]. Don't miss your chance.\n\n[CTA Button: Claim Your VIP Access →]\n\nThank you for being part of our inner circle, {{first_name}}. We don't take your loyalty for granted.\n\nWith appreciation,\nThe {{org_name}} Team`,
    color: "from-slate-600 to-slate-800",
  },
];

/* ═══════════════════════════════════════════════════════════════
   CAMPAIGN SETTINGS (org name, sender, etc.)
   ═══════════════════════════════════════════════════════════════ */

export interface CampaignSettingsData {
  orgName: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  website: string;
}

const DEFAULT_SETTINGS: CampaignSettingsData = {
  orgName: "",
  senderName: "",
  senderEmail: "",
  replyToEmail: "",
  website: "",
};

/* ═══════════════════════════════════════════════════════════════
   MERGE FIELD RESOLUTION
   ═══════════════════════════════════════════════════════════════ */

function buildMergeData(
  recipient: { name: string; email: string } | null,
  settings: CampaignSettingsData,
): Record<string, string> {
  const firstName = recipient?.name?.split(" ")[0] || "First";
  const lastName = recipient?.name?.split(" ").slice(1).join(" ") || "Last";
  return {
    "{{first_name}}": firstName,
    "{{last_name}}": lastName,
    "{{org_name}}": settings.orgName || "Your Company",
    "{{email}}": recipient?.email || "recipient@example.com",
    "{{sender_name}}": settings.senderName || "Sender",
    "{{month}}": new Date().toLocaleString("en-US", { month: "long" }),
  };
}

function resolveMergeFields(
  text: string,
  recipient?: { name: string; email: string } | null,
  settings?: CampaignSettingsData,
): string {
  const data = buildMergeData(recipient || null, settings || DEFAULT_SETTINGS);
  let resolved = text;
  for (const [key, value] of Object.entries(data)) {
    resolved = resolved.replaceAll(key, value);
  }
  return resolved;
}

let campaignIdCounter = 0;
function nextCampaignId() { return `camp-${++campaignIdCounter}-${Date.now()}`; }

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function getDefaultTriggerTime() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function toLocalDatetimeValue(isoOrLocal: string): string {
  if (!isoOrLocal) return getDefaultTriggerTime();
  // If it's already in "YYYY-MM-DDTHH:mm" format (16 chars), return as-is
  if (isoOrLocal.length === 16) return isoOrLocal;
  // Otherwise parse as ISO and convert to local
  try {
    const d = new Date(isoOrLocal);
    if (isNaN(d.getTime())) return getDefaultTriggerTime();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return getDefaultTriggerTime();
  }
}

/* ═══════════════════════════════════════════════════════════════
   COUNTDOWN HOOK
   ═══════════════════════════════════════════════════════════════ */

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const target = new Date(targetDate).getTime();
      if (isNaN(target)) { setTimeLeft("—"); return; }
      const diff = target - Date.now();
      if (diff <= 0) { setTimeLeft("Triggered"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

/* ═══════════════════════════════════════════════════════════════
   CAMPAIGN KIND CONFIG
   ═══════════════════════════════════════════════════════════════ */

const CAMPAIGN_KINDS: { id: CampaignKind; name: string; desc: string; icon: typeof Mail; gradient: string; tagline: string }[] = [
  {
    id: "inbound",
    name: "Inbound Response",
    desc: "Set up automated responses to incoming emails from your defined contacts. Perfect for support follow-ups and engagement replies.",
    icon: Reply,
    gradient: "from-blue-500 to-cyan-500",
    tagline: "Respond to your audience",
  },
  {
    id: "outbound",
    name: "Outbound Broadcast",
    desc: "Send newsletters, promotional offers, and one-way communications. Recipients receive your message without expecting a reply thread.",
    icon: ArrowUpRight,
    gradient: "from-violet-500 to-purple-600",
    tagline: "Reach your audience at scale",
  },
  {
    id: "automated",
    name: "Automated Flows",
    desc: "Build trigger-based workflows that automatically send emails when specific events occur. Set conditions, delays, and branching logic.",
    icon: GitBranch,
    gradient: "from-emerald-500 to-teal-600",
    tagline: "Event-driven automation",
  },
];

/* ═══════════════════════════════════════════════════════════════
   EMAIL PREVIEW MODAL
   ═══════════════════════════════════════════════════════════════ */

function EmailPreview({ subject, body, senderName, recipients, settings, onClose }: {
  subject: string; body: string; senderName: string;
  recipients: { id: string; name: string; email: string }[];
  settings: CampaignSettingsData;
  onClose: () => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const currentRecipient = recipients[selectedIdx] || null;
  const mergeData = buildMergeData(currentRecipient, settings);
  const resolvedSubject = resolveMergeFields(subject, currentRecipient, settings);
  const resolvedBody = resolveMergeFields(body, currentRecipient, settings);
  const fromEmail = settings.senderEmail || "you@yourcompany.com";

  return (
    <div className="fixed inset-0 bg-black/40 z-[500] flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-500" />
            <span className="text-[13px] font-semibold text-slate-700">Email Preview</span>
            {recipients.length > 0 && (
              <span className="text-[10px] font-medium text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{selectedIdx + 1} of {recipients.length}</span>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-200 text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        {/* Recipient Selector */}
        {recipients.length > 1 && (
          <div className="px-5 py-2.5 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Viewing as</span>
              <div className="relative flex-1">
                <button onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer text-left w-full">
                  <span className="text-[12px] font-semibold text-slate-700 truncate flex-1">{currentRecipient?.name || "Unknown"}</span>
                  <span className="text-[10px] text-slate-400 truncate">{currentRecipient?.email}</span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform shrink-0 ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-[510]" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 w-full max-h-[200px] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-[520] py-1">
                      {recipients.map((r, idx) => (
                        <button key={r.id} onClick={() => { setSelectedIdx(idx); setDropdownOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors cursor-pointer ${idx === selectedIdx ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                          <span className="text-[11px] font-semibold text-slate-700 truncate flex-1">{r.name || "(no name)"}</span>
                          <span className="text-[10px] text-slate-400 truncate">{r.email}</span>
                          {idx === selectedIdx && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Email */}
        <div className="p-6">
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase w-12 shrink-0">From</span>
                <span className="text-[12px] font-semibold text-slate-700">{senderName || "Your Name"} &lt;{fromEmail}&gt;</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase w-12 shrink-0">To</span>
                <span className="text-[12px] text-slate-600">{mergeData["{{first_name}}"]} {mergeData["{{last_name}}"]} &lt;{mergeData["{{email}}"]}&gt;</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase w-12 shrink-0">Subject</span>
                <span className="text-[13px] font-semibold text-slate-800">{resolvedSubject}</span>
              </div>
            </div>
            <div className="px-5 py-5 max-h-[400px] overflow-y-auto">
              <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap font-[system-ui]">{resolvedBody}</div>
            </div>
          </div>

          {/* Merge legend */}
          <div className="mt-4 p-3 rounded-xl bg-amber-50/50 border border-amber-100">
            <p className="text-[10px] font-semibold text-amber-600 mb-1.5">Resolved Merge Data</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(mergeData).map(([key, value]) => (
                <span key={key} className="text-[9px] text-amber-700">
                  <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">{key}</code> → <span className="font-semibold">{value}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CAMPAIGN TILE
   ═══════════════════════════════════════════════════════════════ */

function CampaignTile({ campaign, onEdit, onTogglePause, onDelete, onDuplicate }: {
  campaign: Campaign;
  onEdit: () => void;
  onTogglePause: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const countdown = useCountdown(campaign.triggerAt);
  const [menuOpen, setMenuOpen] = useState(false);
  const template = DEFAULT_TEMPLATES.find((t) => t.id === campaign.templateId);
  const gradient = template?.color || "from-slate-600 to-slate-800";
  const isPast = new Date(campaign.triggerAt).getTime() <= Date.now();
  const triggerDate = new Date(campaign.triggerAt);
  const isValidDate = !isNaN(triggerDate.getTime());
  const formattedDate = isValidDate ? triggerDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—";
  const formattedTime = isValidDate ? triggerDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : "—";
  const kindConfig = CAMPAIGN_KINDS.find((k) => k.id === campaign.kind);

  const statusConfig: Record<CampaignStatus, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    draft: { bg: "bg-slate-100", text: "text-slate-500", icon: <Edit3 className="w-3 h-3" />, label: "Draft" },
    active: { bg: "bg-emerald-50", text: "text-emerald-600", icon: <Play className="w-3 h-3" />, label: "Active" },
    paused: { bg: "bg-amber-50", text: "text-amber-600", icon: <Pause className="w-3 h-3" />, label: "Paused" },
    completed: { bg: "bg-blue-50", text: "text-blue-600", icon: <CheckCircle2 className="w-3 h-3" />, label: "Completed" },
  };
  const st = statusConfig[campaign.status];

  return (
    <div className="relative bg-white border border-slate-200/80 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200 group">
      {/* Gradient header strip */}
      <div className={`h-2 bg-gradient-to-r ${gradient}`} />

      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-[15px] font-bold text-slate-800 truncate">{campaign.name}</h3>
              <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${st.bg} ${st.text}`}>
                {st.icon} {st.label}
              </span>
              {kindConfig && (
                <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase">
                  {kindConfig.name}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">{campaign.subject}</p>
          </div>

          <div className="relative shrink-0 ml-2">
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-[300]" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-[150px] bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-[310]">
                  <button onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-600 hover:bg-slate-50 cursor-pointer"><Edit3 className="w-3 h-3" /> Edit</button>
                  <button onClick={() => { onTogglePause(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-600 hover:bg-slate-50 cursor-pointer">
                    {campaign.status === "active" ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Resume</>}
                  </button>
                  <button onClick={() => { onDuplicate(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-600 hover:bg-slate-50 cursor-pointer"><Copy className="w-3 h-3" /> Duplicate</button>
                  <button onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-600 hover:bg-red-50 cursor-pointer"><Trash2 className="w-3 h-3" /> Delete</button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-3 p-3.5 rounded-xl mb-4 ${
          campaign.status === "paused" ? "bg-amber-50/50 border border-amber-100" :
          isPast ? "bg-emerald-50/50 border border-emerald-100" : "bg-slate-50 border border-slate-100"
        }`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            campaign.status === "paused" ? "bg-amber-100 text-amber-600" :
            isPast ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"
          }`}>
            <Timer className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {campaign.status === "paused" ? "Paused" : isPast ? "Last Triggered" : "Next Trigger"}
            </p>
            <p className={`text-[14px] font-bold tabular-nums ${
              campaign.status === "paused" ? "text-amber-600" : isPast ? "text-emerald-600" : "text-slate-700"
            }`}>
              {campaign.status === "paused" ? "—" : countdown}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-slate-400">{formattedDate}</p>
            <p className="text-[11px] font-semibold text-slate-500">{formattedTime}</p>
          </div>
        </div>

        {/* Bottom stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold">{campaign.recipients.length}</span>
            <span className="text-slate-400">recipient{campaign.recipients.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold">{campaign.repeatDays > 0 ? `Every ${campaign.repeatDays}d` : "One-time"}</span>
          </div>
          {campaign.sent > 0 && (
            <>
              <div className="w-px h-4 bg-slate-200" />
              <div className="flex items-center gap-3 text-[11px]">
                <div className="text-center"><p className="font-bold text-slate-600">{campaign.sent}</p><p className="text-[8px] text-slate-400 uppercase">Sent</p></div>
                <div className="text-center"><p className="font-bold text-slate-600">{campaign.opened}</p><p className="text-[8px] text-slate-400 uppercase">Opened</p></div>
                <div className="text-center"><p className="font-bold text-slate-600">{campaign.clicked}</p><p className="text-[8px] text-slate-400 uppercase">Clicked</p></div>
              </div>
            </>
          )}
          {campaign.recipients.length > 0 && (
            <div className="ml-auto flex items-center -space-x-1.5">
              {campaign.recipients.slice(0, 4).map((r) => (
                <div key={r.id} className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500 border-2 border-white" title={r.name}>
                  {(r.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
              ))}
              {campaign.recipients.length > 4 && (
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400 border-2 border-white">+{campaign.recipients.length - 4}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CAMPAIGN CREATOR
   ═══════════════════════════════════════════════════════════════ */

function CampaignCreator({ onSave, onCancel, editCampaign, crmContacts, campaignSettings }: {
  onSave: (campaign: Campaign) => void;
  onCancel: () => void;
  editCampaign?: Campaign | null;
  crmContacts: CRMContact[];
  campaignSettings: CampaignSettingsData;
}) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<CampaignKind>(editCampaign?.kind || "outbound");
  const [name, setName] = useState(editCampaign?.name || "");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(editCampaign?.templateId || null);
  const [subject, setSubject] = useState(editCampaign?.subject || "");
  const [body, setBody] = useState(editCampaign?.body || "");
  const [recipients, setRecipients] = useState<{ id: string; name: string; email: string }[]>(editCampaign?.recipients || []);
  const [triggerAt, setTriggerAt] = useState(toLocalDatetimeValue(editCampaign?.triggerAt || ""));
  const [repeatDays, setRepeatDays] = useState(editCampaign?.repeatDays ?? 0);
  const [contactSearch, setContactSearch] = useState("");
  const [showFromScratch, setShowFromScratch] = useState(!!(editCampaign && !editCampaign.templateId));
  const [showPreview, setShowPreview] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const { user } = useUser();
  const creatorFirestore = useFirestore();
  const [personalInfo, setPersonalInfo] = useState<{ senderName: string; orgName: string; phoneNumber: string }>({ senderName: campaignSettings.senderName || '', orgName: campaignSettings.orgName || '', phoneNumber: '' });
  const [savedPresets, setSavedPresets] = useState<{ id: string; label: string; senderName: string; orgName: string; phoneNumber: string }[]>([]);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [presetLabel, setPresetLabel] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  // Sync personal info defaults from campaignSettings
  useEffect(() => {
    if (!user?.uid) return;
    setPersonalInfo(prev => ({
      senderName: prev.senderName || campaignSettings.senderName || '',
      orgName: prev.orgName || campaignSettings.orgName || '',
      phoneNumber: prev.phoneNumber || '',
    }));
  }, [campaignSettings, user?.uid]);

  // Load saved personal info presets from Firestore
  useEffect(() => {
    if (!creatorFirestore || !user?.uid) return;
    getDoc(doc(creatorFirestore, `users/${user.uid}/settings/personalInfoPresets`)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSavedPresets(data.presets || []);
      }
    }).catch(console.error);
  }, [creatorFirestore, user?.uid]);

  const savePreset = async () => {
    if (!presetLabel.trim() || !creatorFirestore || !user?.uid) return;
    const newPreset = { id: Date.now().toString(), label: presetLabel.trim(), ...personalInfo };
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    setPresetLabel('');
    setShowSaveForm(false);
    try {
      await setDoc(doc(creatorFirestore, `users/${user.uid}/settings/personalInfoPresets`), { presets: updated });
    } catch (err) { console.error('Failed to save preset:', err); }
  };

  const deletePreset = async (id: string) => {
    if (!creatorFirestore || !user?.uid) return;
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    try {
      await setDoc(doc(creatorFirestore, `users/${user.uid}/settings/personalInfoPresets`), { presets: updated });
    } catch (err) { console.error('Failed to delete preset:', err); }
  };

  const applyPreset = (preset: { senderName: string; orgName: string; phoneNumber: string }) => {
    setPersonalInfo({ senderName: preset.senderName, orgName: preset.orgName, phoneNumber: preset.phoneNumber });
    setShowPresetDropdown(false);
  };

  const wizardSteps = ["Campaign Type", "Choose Template", "Edit Content", "Select Recipients", "Schedule & Launch"];

  const selectTemplate = (tpl: EmailTemplate) => {
    setSelectedTemplate(tpl.id);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setShowFromScratch(false);
  };

  const startFromScratch = () => {
    setSelectedTemplate(null);
    setSubject("");
    setBody("");
    setShowFromScratch(true);
  };

  const toggleRecipient = (contact: CRMContact) => {
    setRecipients((prev) => {
      const exists = prev.find((r) => r.id === contact.id);
      if (exists) return prev.filter((r) => r.id !== contact.id);
      return [...prev, { id: contact.id, name: contact.name, email: contact.email }];
    });
  };

  const selectAll = () => {
    const filtered = filteredContacts;
    const allSelected = filtered.every((c) => recipients.some((r) => r.id === c.id));
    if (allSelected) {
      setRecipients((prev) => prev.filter((r) => !filtered.some((c) => c.id === r.id)));
    } else {
      const newR = [...recipients];
      filtered.forEach((c) => { if (!newR.some((r) => r.id === c.id)) newR.push({ id: c.id, name: c.name, email: c.email }); });
      setRecipients(newR);
    }
  };

  const allTags = Array.from(new Set(crmContacts.flatMap((c) => c.tags || [])));
  const filteredContacts = crmContacts.filter((c) => {
    const matchSearch = !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.email.toLowerCase().includes(contactSearch.toLowerCase());
    const matchTag = !tagFilter || (c.tags || []).includes(tagFilter);
    return matchSearch && matchTag;
  });

  const canProceed = [
    () => !!kind,                                              // step 0: kind selected
    () => selectedTemplate !== null || showFromScratch,         // step 1: template chosen
    () => subject.trim().length > 0 && body.trim().length > 0, // step 2: content filled
    () => recipients.length > 0,                               // step 3: recipients
    () => triggerAt.length > 0,                                // step 4: schedule
  ];

  const canFinish = subject.trim().length > 0 && recipients.length > 0;

  const handleSave = (asDraft: boolean) => {
    try {
      const triggerDate = new Date(triggerAt);
      const isoTrigger = isNaN(triggerDate.getTime()) ? new Date(Date.now() + 3600000).toISOString() : triggerDate.toISOString();
      onSave({
        id: editCampaign?.id || nextCampaignId(),
        name: name.trim() || `Campaign — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        kind,
        status: asDraft ? "draft" : "active",
        templateId: selectedTemplate,
        subject,
        body,
        recipients,
        triggerAt: isoTrigger,
        repeatDays,
        createdAt: editCampaign?.createdAt || new Date().toISOString(),
        sent: editCampaign?.sent || 0,
        opened: editCampaign?.opened || 0,
        clicked: editCampaign?.clicked || 0,
      });
    } catch (err) {
      console.error("[CampaignCreator] Save error:", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200/80 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-[15px] font-semibold text-slate-800">{editCampaign ? "Edit Campaign" : "New Campaign"}</h2>
        </div>
        <div className="flex items-center gap-1">
          {wizardSteps.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <button onClick={() => { if (i <= step) setStep(i); }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors cursor-pointer ${
                  i === step ? "bg-slate-800 text-white" : i < step ? "bg-slate-100 text-slate-600" : "text-slate-400"
                }`}>
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                  i === step ? "bg-white text-slate-800" : i < step ? "bg-slate-300 text-white" : "bg-slate-200 text-slate-400"
                }`}>{i < step ? "✓" : i + 1}</span>
                <span className="hidden lg:inline">{label}</span>
              </button>
              {i < wizardSteps.length - 1 && <ChevronRight className="w-2.5 h-2.5 text-slate-300" />}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ═══ Step 0: Campaign Type ═══ */}
        {step === 0 && (
          <div className="w-full py-10 px-8 lg:px-16 space-y-8">
            <div>
              <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block mb-2">Campaign Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q3 Newsletter Blast, Welcome Series"
                className="w-full px-5 py-4 rounded-xl border border-slate-200 text-base outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all placeholder:text-slate-300" />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block mb-4">Campaign Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {CAMPAIGN_KINDS.map((k) => {
                  const Icon = k.icon;
                  return (
                    <button key={k.id} onClick={() => k.id !== "automated" && setKind(k.id)}
                      className={`group text-left rounded-2xl border p-6 transition-all relative overflow-hidden ${
                        kind === k.id
                          ? "border-slate-800 bg-slate-50 ring-1 ring-slate-800 shadow-sm cursor-pointer"
                          : k.id === "automated"
                            ? "border-slate-200 opacity-50 cursor-not-allowed"
                            : "border-slate-200 hover:border-slate-300 hover:shadow-sm cursor-pointer"
                      }`}>
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${k.gradient} flex items-center justify-center text-white mb-4 ${
                        kind === k.id ? "shadow-md" : "shadow-sm"
                      }`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <p className={`text-base font-bold mb-1 ${kind === k.id ? "text-slate-800" : "text-slate-700"}`}>{k.name}</p>
                      <p className="text-xs font-semibold text-slate-400 mb-2">{k.tagline}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{k.desc}</p>
                      {kind === k.id && (
                        <div className="absolute top-4 right-4">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>
                        </div>
                      )}
                      {k.id === "automated" && (
                        <div className="mt-3 flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full uppercase">Coming Soon</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Step 1: Choose Template ═══ */}
        {step === 1 && (
          <div className="w-full py-10 px-8 lg:px-16 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Select a Template</label>
              <button onClick={startFromScratch}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  showFromScratch ? "bg-slate-800 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}>
                <Pen className="w-4 h-4" /> Start from Scratch
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {DEFAULT_TEMPLATES.map((tpl) => (
                <button key={tpl.id} onClick={() => selectTemplate(tpl)}
                  className={`group text-left rounded-xl border p-5 transition-all cursor-pointer ${
                    selectedTemplate === tpl.id && !showFromScratch
                      ? "border-slate-800 bg-slate-50 ring-1 ring-slate-800"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }`}>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tpl.color} flex items-center justify-center text-white mb-3`}>
                    <Mail className="w-5 h-5" />
                  </div>
                  <p className={`text-sm font-semibold mb-0.5 ${selectedTemplate === tpl.id && !showFromScratch ? "text-slate-800" : "text-slate-700"}`}>{tpl.name}</p>
                  <p className="text-xs text-slate-400">{tpl.category}</p>
                  <p className="text-xs text-slate-400 mt-2 truncate italic">&ldquo;{tpl.subject}&rdquo;</p>
                  {selectedTemplate === tpl.id && !showFromScratch && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600 font-semibold"><Check className="w-4 h-4" /> Selected</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Step 2: Edit Content ═══ */}
        {step === 2 && (
          <div className="w-full py-10 px-8 lg:px-16 space-y-6">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Email Content</p>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Subject Line</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Following up on our conversation"
                className="w-full px-5 py-4 rounded-xl border border-slate-200 text-base outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 placeholder:text-slate-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase block mb-2">Email Body</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)}
                placeholder={"Write your email content here...\n\nUse {{first_name}} for personalization."}
                className="w-full h-[450px] px-5 py-4 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-200 resize-none leading-relaxed placeholder:text-slate-300 font-mono" />
            </div>
            {/* Personal Information */}
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Personal Information</p>
                <div className="relative">
                  <button onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 border border-slate-200 hover:bg-white transition-colors cursor-pointer">
                    <ChevronDown className="w-3.5 h-3.5" /> Saved Presets
                  </button>
                  {showPresetDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
                      {savedPresets.length === 0 ? (
                        <p className="text-xs text-slate-400 p-3 text-center">No saved presets yet</p>
                      ) : (
                        savedPresets.map((p) => (
                          <div key={p.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors">
                            <button onClick={() => applyPreset(p)} className="flex-1 text-left cursor-pointer">
                              <p className="text-xs font-semibold text-slate-700">{p.label}</p>
                              <p className="text-[10px] text-slate-400">{p.senderName} · {p.orgName}</p>
                            </button>
                            <button onClick={() => deletePreset(p.id)} className="text-slate-300 hover:text-red-500 cursor-pointer p-1"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Sender Name</label>
                  <input type="text" value={personalInfo.senderName} onChange={(e) => setPersonalInfo(prev => ({ ...prev, senderName: e.target.value }))}
                    placeholder="e.g., John Doe"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Organization Name</label>
                  <input type="text" value={personalInfo.orgName} onChange={(e) => setPersonalInfo(prev => ({ ...prev, orgName: e.target.value }))}
                    placeholder="e.g., SOL Theory"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Phone Number</label>
                  <input type="text" value={personalInfo.phoneNumber} onChange={(e) => setPersonalInfo(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="e.g., (555) 123-4567"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300" />
                </div>
              </div>
              {!showSaveForm ? (
                <button onClick={() => setShowSaveForm(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer transition-colors">
                  <Save className="w-3.5 h-3.5" /> Save as Preset
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="text" value={presetLabel} onChange={(e) => setPresetLabel(e.target.value)}
                    placeholder="Preset name, e.g., Work Info"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-300" />
                  <button onClick={savePreset} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 cursor-pointer transition-colors">Save</button>
                  <button onClick={() => { setShowSaveForm(false); setPresetLabel(''); }} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors">Cancel</button>
                </div>
              )}
            </div>
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-blue-600">Merge Fields</p>
                <div className="group relative">
                  <AlertCircle className="w-3.5 h-3.5 text-blue-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 p-2.5 rounded-lg bg-slate-800 text-white text-[10px] leading-relaxed shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    Merge fields are dynamic placeholders that get replaced with each recipient&apos;s actual data when the email is sent. For example, <strong>{'{{'} first_name {'}}' }</strong> becomes the recipient&apos;s first name.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 -mt-1" />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {["{{first_name}}", "{{last_name}}", "{{org_name}}", "{{email}}", "{{sender_name}}", "{{month}}"].map((field) => (
                  <button key={field} onClick={() => setBody((prev) => prev + " " + field)}
                    className="text-[11px] font-mono px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors">
                    {field}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Step 3: Select Recipients ═══ */}
        {step === 3 && (
          <div className="w-full py-10 px-8 lg:px-16 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Select Recipients</p>
              <span className="text-sm font-semibold text-slate-400">{recipients.length} selected</span>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 placeholder:text-slate-400" />
            </div>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setTagFilter(null)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${!tagFilter ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>All</button>
                {allTags.map((tag) => (
                  <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${tagFilter === tag ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{tag}</button>
                ))}
              </div>
            )}
            <button onClick={selectAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
              <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                filteredContacts.length > 0 && filteredContacts.every((c) => recipients.some((r) => r.id === c.id))
                  ? "bg-slate-800 border-slate-800 text-white" : "border-slate-300"
              }`}>
                {filteredContacts.length > 0 && filteredContacts.every((c) => recipients.some((r) => r.id === c.id)) && <Check className="w-3.5 h-3.5" />}
              </div>
              Select All ({filteredContacts.length})
            </button>
            {crmContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3"><Users className="w-7 h-7 text-slate-300" /></div>
                <p className="text-sm font-semibold text-slate-400 mb-1">No contacts in your CRM</p>
                <p className="text-xs text-slate-400 max-w-xs">Go to Communications → Contacts to add contacts first.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {filteredContacts.map((contact) => {
                  const isSelected = recipients.some((r) => r.id === contact.id);
                  return (
                    <button key={contact.id} onClick={() => toggleRecipient(contact)}
                      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all cursor-pointer ${
                        isSelected ? "bg-slate-50 border border-slate-200" : "hover:bg-slate-50 border border-transparent"
                      }`}>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? "bg-slate-800 border-slate-800 text-white" : "border-slate-300"
                      }`}>{isSelected && <Check className="w-3.5 h-3.5" />}</div>
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                        {(contact.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-slate-700 truncate">{contact.name}</p>
                        <p className="text-xs text-slate-400 truncate">{contact.email}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ Step 4: Schedule & Launch ═══ */}
        {step === 4 && (
          <div className="w-full py-10 px-8 lg:px-16 space-y-6">
            <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/30 space-y-4">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Campaign Summary</p>
              <div className="grid grid-cols-2 gap-5">
                <div><p className="text-xs text-slate-400 uppercase font-semibold">Name</p><p className="text-base font-semibold text-slate-700 mt-1">{name || "Untitled"}</p></div>
                <div><p className="text-xs text-slate-400 uppercase font-semibold">Type</p><p className="text-base font-semibold text-slate-700 mt-1">{CAMPAIGN_KINDS.find((k) => k.id === kind)?.name}</p></div>
                <div><p className="text-xs text-slate-400 uppercase font-semibold">Template</p><p className="text-base font-semibold text-slate-700 mt-1">{selectedTemplate ? DEFAULT_TEMPLATES.find((t) => t.id === selectedTemplate)?.name : "Custom"}</p></div>
                <div><p className="text-xs text-slate-400 uppercase font-semibold">Recipients</p><p className="text-base font-semibold text-slate-700 mt-1">{recipients.length} contact{recipients.length !== 1 ? "s" : ""}</p></div>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block mb-2">Trigger Date & Time</label>
              <input type="datetime-local" value={triggerAt} onChange={(e) => setTriggerAt(e.target.value)}
                className="w-full px-5 py-4 rounded-xl border border-slate-200 text-base outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all" />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block mb-3">Repeat Interval</label>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "One-time", value: 0 },
                  { label: "Daily", value: 1 },
                  { label: "Weekly", value: 7 },
                  { label: "Monthly", value: 30 },
                ].map((opt) => (
                  <button key={opt.value} onClick={() => setRepeatDays(opt.value)}
                    className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                      repeatDays === opt.value ? "border-slate-800 bg-slate-50 text-slate-800" : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}>{opt.label}</button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Recipients ({recipients.length})</p>
              <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto">
                {recipients.map((r) => (
                  <span key={r.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                    <span className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center text-[8px] font-bold text-white">{(r.name || "?")[0].toUpperCase()}</span>
                    {r.name || r.email}
                    <button onClick={() => setRecipients((prev) => prev.filter((x) => x.id !== r.id))} className="hover:text-red-500 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  </span>
                ))}
              </div>
            </div>

            {/* Preview button */}
            <button onClick={() => setShowPreview(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
              <Eye className="w-4.5 h-4.5" /> Preview Final Email
            </button>

            {showPreview && (
              <EmailPreview
                subject={subject}
                body={body}
                senderName={campaignSettings.senderName || user?.displayName || user?.email?.split("@")[0] || "You"}
                recipients={recipients}
                settings={campaignSettings}
                onClose={() => setShowPreview(false)}
              />
            )}

            {!canFinish && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-[11px] text-amber-700">Please complete all fields: subject line and at least one recipient.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200/80 bg-white shrink-0">
        <button onClick={step > 0 ? () => setStep(step - 1) : onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-medium text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer">
          <ChevronLeft className="w-3 h-3" /> {step > 0 ? "Back" : "Cancel"}
        </button>
        <div className="flex items-center gap-2">
          {step === 4 && (
            <button onClick={() => handleSave(true)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
              Save as Draft
            </button>
          )}
          {step < 4 ? (
            <button onClick={() => setStep(step + 1)}
              disabled={!canProceed[step]?.()}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer ${
                !canProceed[step]?.() ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-slate-800 text-white hover:bg-slate-900"
              }`}>
              Next <ChevronRight className="w-3 h-3" />
            </button>
          ) : (
            <button onClick={() => handleSave(false)} disabled={!canFinish}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer ${
                canFinish ? "bg-slate-800 text-white hover:bg-slate-900" : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}>
              <Play className="w-3 h-3" /> Launch Campaign
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CAMPAIGN SETTINGS PANEL
   ═══════════════════════════════════════════════════════════════ */

function CampaignSettingsPanel({ settings, onSave, onBack }: {
  settings: CampaignSettingsData;
  onSave: (s: CampaignSettingsData) => void;
  onBack: () => void;
}) {
  const [local, setLocal] = useState<CampaignSettingsData>({ ...settings });
  const [saved, setSaved] = useState(false);

  const update = (key: keyof CampaignSettingsData, value: string) => setLocal((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    onSave(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fields: { key: keyof CampaignSettingsData; label: string; placeholder: string; desc: string }[] = [
    { key: "orgName", label: "Organization Name", placeholder: "e.g., SOL Theory", desc: "Used for {{org_name}} merge field in email templates." },
    { key: "senderName", label: "Default Sender Name", placeholder: "e.g., Lucas Huff", desc: "Used for {{sender_name}} and the \"From\" name in outbound emails." },
    { key: "senderEmail", label: "Sender Email Address", placeholder: "e.g., hello@soltheory.com", desc: "Displayed as the \"From\" address in email previews." },
    { key: "replyToEmail", label: "Reply-To Email", placeholder: "e.g., support@soltheory.com", desc: "Where replies to outbound campaigns will be directed." },
    { key: "website", label: "Company Website", placeholder: "e.g., https://soltheory.com", desc: "Used in footer links and branding of outbound emails." },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/80 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center"><Building2 className="w-3.5 h-3.5 text-slate-500" /></div>
            <div>
              <h2 className="text-[14px] font-semibold text-slate-800">Sender Profile</h2>
              <p className="text-[10px] text-slate-400">Configure your organization details for email campaigns</p>
            </div>
          </div>
        </div>
        <button onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-white text-[12px] font-semibold hover:bg-slate-900 transition-colors cursor-pointer">
          {saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto py-8 px-6 space-y-6">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">{f.label}</label>
              <input type="text" value={local[f.key]} onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-[14px] outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all placeholder:text-slate-300" />
              <p className="text-[10px] text-slate-400 mt-1.5">{f.desc}</p>
            </div>
          ))}

          {/* Preview of merge fields */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Merge Field Preview</p>
            <div className="space-y-1.5">
              {Object.entries(buildMergeData({ name: "Jane Doe", email: "jane@example.com" }, local)).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <code className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded w-[120px] shrink-0">{key}</code>
                  <span className="text-[11px] text-slate-400">→</span>
                  <span className="text-[11px] font-semibold text-slate-700">{value || <span className="text-slate-300 italic">Not set</span>}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN CAMPAIGN MANAGER
   ═══════════════════════════════════════════════════════════════ */

export default function CampaignManager({ onBack }: { onBack: () => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [view, setView] = useState<"list" | "creator" | "settings">("list");
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [crmContacts, setCrmContacts] = useState<CRMContact[]>([]);
  const [campaignSettings, setCampaignSettings] = useState<CampaignSettingsData>(DEFAULT_SETTINGS);
  const { user } = useUser();
  const firestore = useFirestore();

  // Load CRM contacts
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const q = query(collection(firestore, `users/${user.uid}/contacts`));
    const unsub = onSnapshot(q, (snap) => {
      const contacts: CRMContact[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const fullName = [data.firstName || "", data.lastName || ""].filter(Boolean).join(" ");
        contacts.push({ id: d.id, name: fullName, email: data.email || "", aliases: data.aliases, tags: data.tags || [] });
      });
      contacts.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setCrmContacts(contacts);
    });
    return () => unsub();
  }, [firestore, user?.uid]);

  // Load campaign settings from Firestore
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const settingsRef = doc(firestore, `users/${user.uid}/settings/campaigning`);
    getDoc(settingsRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<CampaignSettingsData>;
        setCampaignSettings((prev) => ({ ...prev, ...data }));
      }
    }).catch(console.error);
  }, [firestore, user?.uid]);

  // Save campaign settings
  const saveCampaignSettings = useCallback(async (s: CampaignSettingsData) => {
    setCampaignSettings(s);
    if (!firestore || !user?.uid) return;
    try {
      await setDoc(doc(firestore, `users/${user.uid}/settings/campaigning`), s, { merge: true });
    } catch (err) {
      console.error("Failed to save campaign settings:", err);
    }
  }, [firestore, user?.uid]);

  const handleSave = useCallback((campaign: Campaign) => {
    setCampaigns((prev) => {
      const idx = prev.findIndex((c) => c.id === campaign.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = campaign; return u; }
      return [campaign, ...prev];
    });
    setView("list");
    setEditingCampaign(null);
  }, []);

  const togglePause = useCallback((id: string) => {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: c.status === "active" ? "paused" as CampaignStatus : "active" as CampaignStatus } : c)));
  }, []);

  const deleteCampaign = useCallback((id: string) => { setCampaigns((prev) => prev.filter((c) => c.id !== id)); }, []);

  const duplicateCampaign = useCallback((id: string) => {
    setCampaigns((prev) => {
      const orig = prev.find((c) => c.id === id);
      if (!orig) return prev;
      return [{ ...orig, id: nextCampaignId(), name: `${orig.name} (Copy)`, status: "draft" as CampaignStatus, sent: 0, opened: 0, clicked: 0 }, ...prev];
    });
  }, []);

  if (view === "settings") {
    return (
      <CampaignSettingsPanel
        settings={campaignSettings}
        onSave={saveCampaignSettings}
        onBack={() => setView("list")}
      />
    );
  }

  if (view === "creator") {
    return (
      <CampaignCreator
        onSave={handleSave}
        onCancel={() => { setView("list"); setEditingCampaign(null); }}
        editCampaign={editingCampaign}
        crmContacts={crmContacts}
        campaignSettings={campaignSettings}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/80 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
          <div>
            <h2 className="text-[14px] font-semibold text-slate-800">Campaigns</h2>
            <p className="text-[10px] text-slate-400">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} · {crmContacts.length} CRM contacts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("settings")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 text-[12px] font-medium hover:bg-slate-50 transition-colors cursor-pointer">
            <Settings className="w-3.5 h-3.5" /> Sender Profile
          </button>
          <button onClick={() => { setEditingCampaign(null); setView("creator"); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-white text-[12px] font-semibold hover:bg-slate-900 transition-colors cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> New Campaign
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4"><Zap className="w-7 h-7 text-slate-300" /></div>
            <p className="text-[14px] font-semibold text-slate-400 mb-1">No campaigns yet</p>
            <p className="text-[12px] text-slate-400 max-w-sm leading-relaxed mb-4">
              Create inbound, outbound, or automated campaigns. Choose a template or build from scratch, select CRM contacts, and schedule.
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditingCampaign(null); setView("creator"); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-[12px] font-semibold hover:bg-slate-900 transition-colors cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Create Campaign
              </button>
              {!campaignSettings.orgName && (
                <button onClick={() => setView("settings")}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-[12px] font-medium text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer">
                  <Settings className="w-3.5 h-3.5" /> Set Up Profile
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {campaigns.map((c) => (
              <CampaignTile
                key={c.id}
                campaign={c}
                onEdit={() => { setEditingCampaign(c); setView("creator"); }}
                onTogglePause={() => togglePause(c.id)}
                onDelete={() => deleteCampaign(c.id)}
                onDuplicate={() => duplicateCampaign(c.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
