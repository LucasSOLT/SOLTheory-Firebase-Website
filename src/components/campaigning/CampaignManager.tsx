"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Plus, ChevronRight, ChevronLeft, Play, Pause, BarChart3,
  Mail, Clock, Users, Zap, CheckCircle2, XCircle, Eye,
  Trash2, Copy, Edit3, MoreHorizontal, X, ArrowRight,
  Calendar, Target, FileText, Sparkles, Send, AlertCircle,
  Timer, Pen, Check, UserPlus, Search, Inbox, ArrowUpRight,
  GitBranch, EyeOff, Reply, Settings, Save, Building2,
  ChevronDown, Upload, Image as ImageIcon, Monitor, Smartphone,
  MessageSquare, RotateCcw, Wand2, Paperclip,
} from "lucide-react";
import { useUser, useFirestore, useStorage } from "@/firebase/provider";
import { collection, query, onSnapshot, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { uploadCampaignImage, deleteCampaignImage } from "@/lib/campaign-image-upload";
import type { UploadedImage } from "@/lib/campaign-image-upload";
import { SKELETON_REGISTRY } from "@/lib/email-skeletons";
import { useKnowledgeBase } from "@/hooks/useKnowledgeBase";

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
  htmlContent?: string;
  images?: string[];
  skeletonId?: string;
  composerMode?: "classic" | "smart" | "import";
  slotData?: Record<string, any>;
  recipients: { id: string; name: string; email: string }[];
  triggerAt: string;
  endAt?: string;
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
  phoneNumber: string;
}

const DEFAULT_SETTINGS: CampaignSettingsData = {
  orgName: "",
  senderName: "",
  senderEmail: "",
  replyToEmail: "",
  website: "",
  phoneNumber: "",
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
    "{{phone_number}}": settings.phoneNumber || "",
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

function useCountdown(targetDate: string, repeatDays?: number, status?: string) {
  const [timeLeft, setTimeLeft] = useState("");
  const [phase, setPhase] = useState<'countdown' | 'triggered' | 'next' | 'completed'>('countdown');

  useEffect(() => {
    const update = () => {
      const target = new Date(targetDate).getTime();
      if (isNaN(target)) { setTimeLeft("—"); setPhase('countdown'); return; }
      if (status === 'completed' || status === 'paused') {
        setTimeLeft(status === 'paused' ? "—" : "Completed");
        setPhase(status === 'completed' ? 'completed' : 'countdown');
        return;
      }
      const diff = target - Date.now();
      if (diff <= 0) {
        const elapsedSinceTrigger = Date.now() - target;
        // Show "Triggered" for 60 seconds after the trigger time
        if (elapsedSinceTrigger < 60_000) {
          setTimeLeft("Triggered");
          setPhase('triggered');
          return;
        }
        // After 60s, if repeating, calculate next occurrence
        if (repeatDays && repeatDays > 0) {
          const repeatMs = repeatDays * 24 * 60 * 60 * 1000;
          // Find the next future occurrence
          let nextTrigger = target;
          while (nextTrigger <= Date.now()) {
            nextTrigger += repeatMs;
          }
          const nextDiff = nextTrigger - Date.now();
          const d = Math.floor(nextDiff / 86400000);
          const h = Math.floor((nextDiff % 86400000) / 3600000);
          const m = Math.floor((nextDiff % 3600000) / 60000);
          const s = Math.floor((nextDiff % 60000) / 1000);
          setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
          setPhase('next');
          return;
        }
        // Non-repeating, past trigger, past 60s → completed
        setTimeLeft("Completed");
        setPhase('completed');
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
      setPhase('countdown');
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetDate, repeatDays, status]);

  return { timeLeft, phase };
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

function EmailPreview({ subject, body, senderName, recipients, settings, onClose, htmlContent, uid, refreshToken }: {
  subject: string; body: string; senderName: string;
  recipients: { id: string; name: string; email: string }[];
  settings: CampaignSettingsData;
  onClose: () => void;
  htmlContent?: string;
  uid?: string;
  refreshToken?: string;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const currentRecipient = recipients[selectedIdx] || null;
  const mergeData = buildMergeData(currentRecipient, settings);
  const resolvedSubject = resolveMergeFields(subject, currentRecipient, settings);
  const resolvedBody = resolveMergeFields(body, currentRecipient, settings);
  const fromEmail = settings.senderEmail || "you@yourcompany.com";

  // Resolve merge fields in htmlContent too
  const resolvedHtml = htmlContent ? resolveMergeFields(htmlContent, currentRecipient, settings) : null;

  const sendTestEmail = async () => {
    if (!uid || !refreshToken || testSending) return;
    setTestSending(true);
    try {
      const resp = await fetch("/api/campaigning/email/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refreshToken,
          html: resolvedHtml || `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6;">${resolvedBody.split('\n').join('<br/>')}</div>`,
          subject: resolvedSubject,
          senderEmail: fromEmail,
          testRecipientEmail: fromEmail,
        }),
      });
      if (resp.ok) {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 4000);
      }
    } catch (err) {
      console.error("[EmailPreview] Test send error:", err);
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[500] flex items-center justify-center p-4" onClick={onClose}>
      <div className={`w-full ${resolvedHtml ? 'max-w-4xl' : 'max-w-2xl'} bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-500" />
            <span className="text-[13px] font-semibold text-slate-700">Email Preview</span>
            {recipients.length > 0 && (
              <span className="text-[10px] font-medium text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{selectedIdx + 1} of {recipients.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {resolvedHtml && (
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                <button onClick={() => setPreviewDevice("desktop")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${previewDevice === "desktop" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600"}`}>
                  <Monitor className="w-3 h-3" /> Desktop
                </button>
                <button onClick={() => setPreviewDevice("mobile")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${previewDevice === "mobile" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600"}`}>
                  <Smartphone className="w-3 h-3" /> Mobile
                </button>
              </div>
            )}
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-200 text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Recipient Selector */}
        {recipients.length > 1 && (
          <div className="px-5 py-2.5 border-b border-slate-100 bg-white shrink-0">
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
        <div className="p-6 overflow-y-auto flex-1">
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
            {resolvedHtml ? (
              <div className="flex justify-center bg-slate-100 p-4">
                <iframe
                  srcDoc={resolvedHtml}
                  sandbox="allow-same-origin"
                  title="Email Preview"
                  className="bg-white border-0 transition-all duration-300"
                  style={{
                    width: previewDevice === "mobile" ? "375px" : "100%",
                    height: "500px",
                    maxWidth: "100%",
                  }}
                />
              </div>
            ) : (
              <div className="px-5 py-5 max-h-[400px] overflow-y-auto">
                <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap font-[system-ui]">{resolvedBody}</div>
              </div>
            )}
          </div>

          {/* Send Test Email + Merge Legend */}
          <div className="mt-4 flex items-start gap-3">
            {uid && refreshToken && (
              <button onClick={sendTestEmail} disabled={testSending}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  testSent ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                  testSending ? "bg-slate-100 text-slate-400 cursor-wait" :
                  "bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100"
                }`}>
                {testSent ? <><CheckCircle2 className="w-3.5 h-3.5" /> Sent! Check your inbox</> :
                 testSending ? <><RotateCcw className="w-3.5 h-3.5 animate-spin" /> Sending...</> :
                 <><Send className="w-3.5 h-3.5" /> Send Test Email to Me</>}
              </button>
            )}
            <div className="flex-1 p-3 rounded-xl bg-amber-50/50 border border-amber-100">
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CAMPAIGN TILE
   ═══════════════════════════════════════════════════════════════ */

function CampaignTile({ campaign, onEdit, onTogglePause, onDelete, onDuplicate, id }: {
  campaign: Campaign;
  onEdit: () => void;
  onTogglePause: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  id?: string;
}) {
  const { timeLeft: countdown, phase: countdownPhase } = useCountdown(campaign.triggerAt, campaign.repeatDays, campaign.status);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recipientHover, setRecipientHover] = useState(false);
  const [recipientPopupOpen, setRecipientPopupOpen] = useState(false);
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
    <div id={id} className="relative bg-white border border-slate-200/80 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200 group">
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
              {campaign.status === "paused" ? "Paused" : countdownPhase === 'triggered' ? "Just Triggered" : countdownPhase === 'next' ? "Next Trigger" : isPast ? "Last Triggered" : "Next Trigger"}
            </p>
            <p className={`text-[14px] font-bold tabular-nums ${
              campaign.status === "paused" ? "text-amber-600" :
              countdownPhase === 'triggered' ? "text-emerald-500 animate-pulse" :
              isPast ? "text-emerald-600" : "text-slate-700"
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
            <div className="ml-auto relative"
              onMouseEnter={() => setRecipientHover(true)}
              onMouseLeave={() => setRecipientHover(false)}
            >
              <div className="flex items-center -space-x-1.5 cursor-default">
                {campaign.recipients.slice(0, 4).map((r) => (
                  <div key={r.id} className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500 border-2 border-white">
                    {(r.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                ))}
                {campaign.recipients.length > 4 && (
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400 border-2 border-white">+{campaign.recipients.length - 4}</div>
                )}
                <div
                  className="w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center cursor-pointer ml-1 shadow-sm transition-colors"
                  onClick={(e) => { e.stopPropagation(); setRecipientPopupOpen(true); }}
                  title="View all recipients"
                >
                  <ArrowUpRight className="w-3 h-3" />
                </div>
              </div>
              {/* Hover popup */}
              {recipientHover && (
                <div className="absolute right-0 bottom-full mb-2 w-[220px] bg-white border border-slate-200 rounded-xl shadow-lg py-2 px-1 z-[200]">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2.5 pb-1.5 border-b border-slate-100 mb-1">
                    Recipients ({campaign.recipients.length})
                  </p>
                  <div className="max-h-[200px] overflow-y-auto">
                    {campaign.recipients.slice(0, 10).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50">
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[7px] font-bold text-slate-500 shrink-0">
                          {(r.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-slate-700 truncate">{r.name}</p>
                          <p className="text-[9px] text-slate-400 truncate">{r.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {campaign.recipients.length > 10 && (
                    <p
                      className="text-[9px] text-blue-500 hover:text-blue-600 text-center pt-1.5 border-t border-slate-100 mt-1 cursor-pointer font-semibold"
                      onClick={(e) => { e.stopPropagation(); setRecipientPopupOpen(true); setRecipientHover(false); }}
                    >
                      View all {campaign.recipients.length} →
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Full recipient list modal */}
          {recipientPopupOpen && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40" onClick={() => setRecipientPopupOpen(false)}>
              <div
                className={`rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col ${
                  typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-800'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 border-b ${
                  typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                    ? 'border-slate-700'
                    : 'border-slate-200'
                }`}>
                  <h3 className="text-[16px] font-bold">All Recipients ({campaign.recipients.length})</h3>
                  <button
                    onClick={() => setRecipientPopupOpen(false)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                      typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                        ? 'hover:bg-slate-700 text-slate-400'
                        : 'hover:bg-slate-100 text-slate-400'
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* Body - 5 column grid */}
                <div className="grid grid-cols-5 gap-2 p-4 overflow-y-auto">
                  {campaign.recipients.map((r) => (
                    <div
                      key={r.id}
                      className={`flex flex-col items-center text-center p-2 rounded-xl transition-colors ${
                        typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                          ? 'hover:bg-slate-700/50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold mb-1.5 ${
                        typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                          ? 'bg-slate-700 text-slate-300'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        {(r.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <p className={`text-[11px] font-semibold truncate w-full ${
                        typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                          ? 'text-slate-200'
                          : 'text-slate-700'
                      }`}>{r.name}</p>
                      <p className={`text-[9px] truncate w-full ${
                        typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                          ? 'text-slate-400'
                          : 'text-slate-400'
                      }`}>{r.email}</p>
                    </div>
                  ))}
                </div>
              </div>
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
  const [endAt, setEndAt] = useState(editCampaign?.endAt ? toLocalDatetimeValue(editCampaign.endAt).split('T')[0] : '');
  const [contactSearch, setContactSearch] = useState("");
  const [showFromScratch, setShowFromScratch] = useState(!!(editCampaign && !editCampaign.templateId));
  const [showPreview, setShowPreview] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const { user } = useUser();
  const creatorFirestore = useFirestore();
  const creatorStorage = useStorage();
  const { knowledgeBaseText, pactText } = useKnowledgeBase('soltheory');
  const [personalInfo, setPersonalInfo] = useState<{ senderName: string; orgName: string; phoneNumber: string }>({ senderName: campaignSettings.senderName || '', orgName: campaignSettings.orgName || '', phoneNumber: campaignSettings.phoneNumber || '' });
  const [savedPresets, setSavedPresets] = useState<{ id: string; label: string; senderName: string; orgName: string; phoneNumber: string }[]>([]);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [presetLabel, setPresetLabel] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  // ── Smart Composer State ──
  const [composerMode, setComposerMode] = useState<"classic" | "smart" | "import">(editCampaign?.composerMode || "classic");
  const [importTab, setImportTab] = useState<"paste" | "upload" | "ai">("paste");
  const htmlFileInputRef = useRef<HTMLInputElement>(null);
  const [importAiMessages, setImportAiMessages] = useState<{ role: "user" | "ai"; text: string; images?: string[] }[]>([]);
  const [importAiPrompt, setImportAiPrompt] = useState("");
  const [importAiLoading, setImportAiLoading] = useState(false);
  const importAiChatRef = useRef<HTMLDivElement>(null);
  const [importAiImages, setImportAiImages] = useState<string[]>([]);
  const importAiFileRef = useRef<HTMLInputElement>(null);
  const [assembledHtml, setAssembledHtml] = useState<string>(editCampaign?.htmlContent || "");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "ai"; text: string; renderedEmail?: boolean; quickReplies?: string[] }[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAssembling, setIsAssembling] = useState(false);
  const [dialogueStep, setDialogueStep] = useState(0); // 0=not started, 1=tone asked, 2=purpose asked, 3=context asked, 4+=free chat
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [selectedSkeletonId, setSelectedSkeletonId] = useState<string | null>(editCampaign?.skeletonId || null);
  const [currentSlotData, setCurrentSlotData] = useState<Record<string, any>>(editCampaign?.slotData || {});
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [gmailRefreshToken, setGmailRefreshToken] = useState<string | null>(null);
  const aiChatRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const testSendingRef = useRef(false); // guard against double-send
  const [lastFocusedInput, setLastFocusedInput] = useState<'subject' | 'chat'>('chat');
  const campaignIdRef = useRef(editCampaign?.id || nextCampaignId());

  // Load Gmail refresh token for test sends
  useEffect(() => {
    if (!user?.uid) return;
    import('@/lib/gmail-api').then(({ getRefreshToken }) => {
      getRefreshToken(user.uid).then(setGmailRefreshToken).catch(() => {});
    });
  }, [user?.uid]);

  // Auto-scroll AI chat to bottom
  useEffect(() => {
    if (aiChatRef.current) {
      aiChatRef.current.scrollTop = aiChatRef.current.scrollHeight;
    }
  }, [aiMessages]);

  // Sync personal info defaults from campaignSettings (Sender Profile)
  useEffect(() => {
    if (!user?.uid) return;
    setPersonalInfo(prev => ({
      senderName: prev.senderName || campaignSettings.senderName || '',
      orgName: prev.orgName || campaignSettings.orgName || '',
      phoneNumber: prev.phoneNumber || campaignSettings.phoneNumber || '',
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
    setComposerMode("classic");
  };

  const startFromScratch = () => {
    setSelectedTemplate(null);
    setSubject("");
    setBody("");
    setShowFromScratch(true);
    setComposerMode("smart");
    setSelectedSkeletonId(null);
  };

  const selectSmartTemplate = (skeletonId: string) => {
    setSelectedTemplate(null);
    setShowFromScratch(true);
    setComposerMode("smart");
    setSelectedSkeletonId(skeletonId);
  };

  const startImport = () => {
    setSelectedTemplate(null);
    setShowFromScratch(true);
    setComposerMode("import");
    setSelectedSkeletonId(null);
    setAssembledHtml("");
    setBody("");
  };

  // ── MIME email source extraction ──
  // When user pastes raw email source or uploads a .eml file from Gmail,
  // this extracts the HTML part and decodes quoted-printable / base64.
  const extractHtmlFromPaste = (raw: string): { html: string; subject?: string } => {
    // Quick check: if it starts with < or DOCTYPE, it's already HTML
    const trimmed = raw.trim();
    if (trimmed.startsWith('<') || trimmed.startsWith('<!')) {
      return { html: raw };
    }

    // Try to extract Subject from MIME headers
    let mimeSubject: string | undefined;
    const subjectMatch = raw.match(/^Subject:\s*(.+)$/mi);
    if (subjectMatch) mimeSubject = subjectMatch[1].trim();

    // Decode quoted-printable with proper UTF-8 multi-byte support
    const decodeQP = (str: string): string => {
      // Remove soft line breaks (= at end of line)
      str = str.replace(/=\r?\n/g, '');
      // Convert =XX sequences to bytes, then decode as UTF-8
      const bytes: number[] = [];
      for (let i = 0; i < str.length; i++) {
        if (str[i] === '=' && i + 2 < str.length) {
          const hex = str.substring(i + 1, i + 3);
          if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
            bytes.push(parseInt(hex, 16));
            i += 2;
            continue;
          }
        }
        // Regular ASCII character
        const code = str.charCodeAt(i);
        if (code === 13) continue; // skip CR
        bytes.push(code);
      }
      try {
        return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
      } catch {
        return str; // fallback
      }
    };

    // Find the boundary from Content-Type header
    const boundaryMatch = raw.match(/boundary="?([^";\r\n]+)"?/i);
    const boundary = boundaryMatch ? boundaryMatch[1].trim() : null;

    // Try to find HTML part in multipart MIME
    if (boundary) {
      const parts = raw.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'));
      for (const part of parts) {
        // Look for text/html content type in this part
        if (/Content-Type:\s*text\/html/i.test(part)) {
          // Find the encoding
          const encMatch = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
          const encoding = (encMatch?.[1] || '').toLowerCase();

          // The actual content starts after the first blank line in this part
          const blankLineIdx = part.search(/\r?\n\r?\n/);
          if (blankLineIdx === -1) continue;
          let htmlContent = part.substring(blankLineIdx).replace(/^\r?\n\r?\n/, '').trim();

          // Remove trailing boundary marker if present
          htmlContent = htmlContent.replace(/--$/, '').trim();

          if (encoding === 'base64') {
            try {
              // Decode base64 to bytes, then to UTF-8 string
              const binaryStr = atob(htmlContent.replace(/\s/g, ''));
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
              htmlContent = new TextDecoder('utf-8').decode(bytes);
            } catch { /* not valid base64, use as-is */ }
          } else if (encoding === 'quoted-printable') {
            htmlContent = decodeQP(htmlContent);
          }

          if (htmlContent.includes('<') && htmlContent.includes('>')) {
            return { html: htmlContent, subject: mimeSubject };
          }
        }
      }
    }

    // Fallback: try the simple regex approach for non-multipart or weird formats
    const htmlPartRegex = /Content-Type:\s*text\/html[^\n]*\n(?:Content-Transfer-Encoding:\s*(\S+)\n)?(?:\n)+([\s\S]*?)(?:\n--[^\n]+|$)/i;
    const match = raw.match(htmlPartRegex);
    if (match) {
      const encoding = (match[1] || '').toLowerCase();
      let htmlContent = match[2].trim();
      if (encoding === 'quoted-printable') htmlContent = decodeQP(htmlContent);
      else if (encoding === 'base64') {
        try {
          const binaryStr = atob(htmlContent.replace(/\s/g, ''));
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          htmlContent = new TextDecoder('utf-8').decode(bytes);
        } catch { /* fallback */ }
      }
      if (htmlContent.includes('<') && htmlContent.includes('>')) {
        return { html: htmlContent, subject: mimeSubject };
      }
    }

    // Pattern 3: Just find anything between <html> and </html>
    const htmlTagMatch = raw.match(/<html[\s\S]*<\/html>/i) || raw.match(/<table[\s\S]*<\/table>/i);
    if (htmlTagMatch) {
      return { html: htmlTagMatch[0], subject: mimeSubject };
    }

    // Not MIME, return as-is
    return { html: raw, subject: mimeSubject };
  };

  const handleImportPaste = (text: string) => {
    const { html, subject: mimeSubject } = extractHtmlFromPaste(text);
    setAssembledHtml(html);
    if (mimeSubject && !subject) setSubject(mimeSubject);
  };

  // ── Import mode AI edit handler ──
  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleImportAiSend = async () => {
    if ((!importAiPrompt.trim() && importAiImages.length === 0) || importAiLoading || !assembledHtml) return;
    const userMsg = importAiPrompt.trim() || (importAiImages.length > 0 ? "(attached image)" : "");
    const images = [...importAiImages];
    setImportAiPrompt("");
    setImportAiImages([]);
    setImportAiMessages(prev => [...prev, { role: "user", text: userMsg, images: images.length > 0 ? images : undefined }]);
    setImportAiLoading(true);
    setTimeout(() => importAiChatRef.current?.scrollTo({ top: importAiChatRef.current.scrollHeight, behavior: 'smooth' }), 50);

    // Build message content with image markers
    let msgContent = userMsg;
    if (images.length > 0) {
      msgContent = userMsg + images.map(img => `\n[IMAGE]${img}[/IMAGE]`).join('');
    }

    try {
      const resp = await fetch("/api/campaigning/email/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-uid": user?.uid || "" },
        body: JSON.stringify({
          action: "edit-html",
          currentHtml: assembledHtml,
          subject,
          imageUrls: images,
          conversationHistory: [
            ...importAiMessages.map(m => {
              let content = m.text;
              if (m.images?.length) content += m.images.map(img => `\n[IMAGE]${img}[/IMAGE]`).join('');
              return { role: m.role === "user" ? "user" as const : "assistant" as const, content };
            }),
            { role: "user" as const, content: msgContent },
          ],
        }),
      });
      const data = await resp.json();
      if (data.intent === "edit" && data.html) {
        setAssembledHtml(data.html);
        if (data.subject) setSubject(data.subject);
        setImportAiMessages(prev => [...prev, { role: "ai", text: data.message || "Done! I've updated the email." }]);
      } else {
        setImportAiMessages(prev => [...prev, { role: "ai", text: data.message || "I'm not sure how to help with that. Try describing a specific change." }]);
      }
    } catch (err: any) {
      setImportAiMessages(prev => [...prev, { role: "ai", text: `⚠️ Error: ${err.message}` }]);
    } finally {
      setImportAiLoading(false);
      setTimeout(() => importAiChatRef.current?.scrollTo({ top: importAiChatRef.current.scrollHeight, behavior: 'smooth' }), 50);
    }
  };

  // ── Smart Composer Handlers ──

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || !user?.uid || !creatorStorage) return;
    setIsUploadingImage(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadCampaignImage(creatorStorage, user.uid, campaignIdRef.current, file);
        setUploadedImages((prev) => [...prev, result]);
      }
    } catch (err: any) {
      console.error("[SmartComposer] Image upload error:", err);
      setAiMessages((prev) => [...prev, { role: "ai", text: `⚠️ Upload failed: ${err.message}` }]);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeImage = async (idx: number) => {
    const img = uploadedImages[idx];
    if (!img || !creatorStorage) return;
    try {
      await deleteCampaignImage(creatorStorage, img.storagePath);
    } catch (e) { /* ignore delete errors for already-deleted files */ }
    setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleJarvisMessage = async (prompt: string, isQuickReply?: boolean) => {
    if (!prompt.trim() || isAssembling) return;
    setIsAssembling(true);
    const newUserMessage = { role: "user" as const, text: prompt };
    setAiMessages((prev) => {
      // Remove quickReplies from last AI message once user responds
      const cleaned = prev.map((m, idx) => idx === prev.length - 1 && m.role === "ai" ? { ...m, quickReplies: undefined } : m);
      return [...cleaned, newUserMessage];
    });
    setAiPrompt("");

    // ── Guided dialogue flow ──
    const currentStep = dialogueStep;

    // Step 0 → User just sent first message. Send to API, then ask tone.
    if (currentStep === 0) {
      try {
        const fullHistory = [...aiMessages, newUserMessage].map((msg) => ({
          role: msg.role === "user" ? "user" as const : "assistant" as const,
          content: msg.text,
        }));

        const resp = await fetch("/api/campaigning/email/assemble", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-uid": user?.uid || "" },
          body: JSON.stringify({
            action: "chat",
            prompt,
            images: uploadedImages.map((i) => i.url),
            subject: subject || undefined,
            skeletonId: selectedSkeletonId || undefined,
            brandSettings: {
              primaryColor: undefined,
              logoUrl: undefined,
              senderName: personalInfo.senderName || campaignSettings.senderName || "",
              orgName: personalInfo.orgName || campaignSettings.orgName || "",
              phoneNumber: personalInfo.phoneNumber || campaignSettings.phoneNumber || "",
              email: campaignSettings.senderEmail || "",
              website: campaignSettings.website || "",
            },
            knowledgeBaseText: knowledgeBaseText || "",
            pactText: pactText || "",
            conversationHistory: fullHistory,
            hasEmailPreview: assembledHtml.length > 0,
            currentSlotData: Object.keys(currentSlotData).length > 0 ? currentSlotData : undefined,
            currentSkeletonId: selectedSkeletonId || undefined,
          }),
        });

        const data = await resp.json();
        const aiText = data.message || "Got it! Let me help you craft this email.";

        setAiMessages((prev) => [...prev, {
          role: "ai",
          text: aiText + "\n\nWhat tone would you like for this email?",
          quickReplies: [
            "Professional — Formal, polished, and business-appropriate language",
            "Casual — Friendly, relaxed, and conversational. Like talking to a friend",
            "Neutral — Clear and balanced, neither too formal nor too informal",
            "Skip",
          ],
        }]);
        setDialogueStep(1);
      } catch (err: any) {
        setAiMessages((prev) => [...prev, { role: "ai", text: `⚠️ Error: ${err.message}` }]);
      } finally {
        setIsAssembling(false);
      }
      return;
    }

    // Step 1 → Tone answered. Now ask about email purpose/length.
    if (currentStep === 1) {
      const toneNote = prompt === "Skip" ? "" : `\n\nGot it — I'll use a ${prompt.split(" — ")[0].toLowerCase()} tone.`;
      setAiMessages((prev) => [...prev, {
        role: "ai",
        text: `Great!${toneNote}\n\nHow detailed should the email be?`,
        quickReplies: [
          "Short & sweet — A few sentences, straight to the point",
          "Moderate — A well-rounded email with key details and context",
          "Detailed — Comprehensive with thorough explanations and supporting info",
          "Skip",
        ],
      }]);
      setDialogueStep(2);
      setIsAssembling(false);
      return;
    }

    // Step 2 → Length answered. Now ask for extra context (free-text + Skip).
    if (currentStep === 2) {
      const lengthNote = prompt === "Skip" ? "" : `\n\nPerfect — I'll aim for a ${prompt.split(" — ")[0].toLowerCase()} email.`;
      setAiMessages((prev) => [...prev, {
        role: "ai",
        text: `Noted!${lengthNote}\n\nAnything else you'd like me to know? Extra context, specific details, things to mention or avoid — type it out below, or skip if you're ready.`,
        quickReplies: [
          "Skip",
        ],
      }]);
      setDialogueStep(3);
      setIsAssembling(false);
      return;
    }

    // Step 3 → Extra context provided (or skipped). Now build the email via API.
    if (currentStep === 3) {
      setDialogueStep(4); // Move to free chat from here on
    }

    // Step 4+ or step 3 falling through → Normal API chat
    try {
      const fullHistory = [...aiMessages, newUserMessage].map((msg) => ({
        role: msg.role === "user" ? "user" as const : "assistant" as const,
        content: msg.text,
      }));

      const resp = await fetch("/api/campaigning/email/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-uid": user?.uid || "" },
        body: JSON.stringify({
          action: "chat",
          prompt,
          images: uploadedImages.map((i) => i.url),
          subject: subject || undefined,
          skeletonId: selectedSkeletonId || undefined,
          brandSettings: {
            primaryColor: undefined,
            logoUrl: undefined,
            senderName: personalInfo.senderName || campaignSettings.senderName || "",
            orgName: personalInfo.orgName || campaignSettings.orgName || "",
            phoneNumber: personalInfo.phoneNumber || campaignSettings.phoneNumber || "",
            email: campaignSettings.senderEmail || "",
            website: campaignSettings.website || "",
          },
          knowledgeBaseText: knowledgeBaseText || "",
          pactText: pactText || "",
          conversationHistory: fullHistory,
          hasEmailPreview: assembledHtml.length > 0,
          currentSlotData: Object.keys(currentSlotData).length > 0 ? currentSlotData : undefined,
          currentSkeletonId: selectedSkeletonId || undefined,
        }),
      });

      const data = await resp.json();

      if (data.intent === "render" || data.intent === "iterate") {
        if (data.html) {
          setAssembledHtml(data.html);
          if (data.subject) setSubject(data.subject);
          if (data.skeletonUsed) setSelectedSkeletonId(data.skeletonUsed);
          if (data.slotData) setCurrentSlotData(data.slotData);
        }
        setAiMessages((prev) => [...prev, {
          role: "ai",
          text: data.message || "Done! Check the preview.",
          renderedEmail: true,
        }]);
      } else {
        setAiMessages((prev) => [...prev, {
          role: "ai",
          text: data.message || data.error || "I'm not sure how to respond to that. Could you rephrase?",
        }]);
      }
    } catch (err: any) {
      setAiMessages((prev) => [...prev, { role: "ai", text: `⚠️ Error: ${err.message}` }]);
    } finally {
      setIsAssembling(false);
    }
  };

  const handleTestSend = async () => {
    if (!user?.uid || !gmailRefreshToken || testSending || testSendingRef.current) return;
    testSendingRef.current = true;
    setTestSending(true);
    try {
      const fromEmail = campaignSettings.senderEmail || user.email || "";
      const resp = await fetch("/api/campaigning/email/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refreshToken: gmailRefreshToken,
          html: assembledHtml,
          subject: subject || "Test Email",
          senderEmail: fromEmail,
          testRecipientEmail: fromEmail,
        }),
      });
      if (resp.ok) {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 4000);
      }
    } catch (err) {
      console.error("[SmartComposer] Test send error:", err);
    } finally {
      setTestSending(false);
      testSendingRef.current = false;
    }
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
    () => composerMode === "smart" || composerMode === "import" // step 2: smart/import mode needs subject + html
      ? subject.trim().length > 0 && assembledHtml.length > 0
      : subject.trim().length > 0 && body.trim().length > 0,
    () => recipients.length > 0,                               // step 3: recipients
    () => triggerAt.length > 0,                                // step 4: schedule
  ];

  const canFinish = subject.trim().length > 0 && recipients.length > 0;

  const handleSave = (asDraft: boolean) => {
    try {
      const triggerDate = new Date(triggerAt);
      const isoTrigger = isNaN(triggerDate.getTime()) ? new Date(Date.now() + 3600000).toISOString() : triggerDate.toISOString();
      onSave({
        id: editCampaign?.id || campaignIdRef.current,
        name: name.trim() || `Campaign — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        kind,
        status: asDraft ? "draft" : "active",
        templateId: selectedTemplate,
        subject,
        body,
        htmlContent: (composerMode === "smart" || composerMode === "import") && assembledHtml ? assembledHtml : undefined,
        images: composerMode === "smart" && uploadedImages.length > 0 ? uploadedImages.map((i) => i.url) : undefined,
        skeletonId: composerMode === "smart" && selectedSkeletonId ? selectedSkeletonId : undefined,
        composerMode: composerMode,
        slotData: composerMode === "smart" && Object.keys(currentSlotData).length > 0 ? currentSlotData : undefined,
        recipients,
        triggerAt: isoTrigger,
        endAt: endAt ? new Date(endAt + 'T' + (triggerAt.split('T')[1] || '12:00')).toISOString() : undefined,
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
      <div className={`flex-1 ${step === 2 && composerMode === "smart" ? "overflow-hidden" : "overflow-y-auto"}`}>

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
          <div className="w-full py-10 px-8 lg:px-16 space-y-8">
            {/* Smart Templates Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Wand2 className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 block">Smart Templates</label>
                    <p className="text-[10px] text-slate-400">AI-powered · Upload images · Live preview</p>
                  </div>
                </div>
                <button onClick={startFromScratch}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                    showFromScratch && !selectedSkeletonId ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}>
                  <Sparkles className="w-4 h-4" /> Start from Scratch with AI
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {SKELETON_REGISTRY.map((skel) => {
                  const isSelected = composerMode === "smart" && selectedSkeletonId === skel.id;
                  const iconMap: Record<string, typeof Mail> = {
                    'hero-cta': Target, 'newsletter': FileText, 'product-showcase': BarChart3,
                    'announcement': Sparkles, 'minimal-branded': Mail, 'image-forward': ImageIcon,
                  };
                  const Icon = iconMap[skel.id] || Mail;
                  const colorMap: Record<string, string> = {
                    'hero-cta': 'from-rose-500 to-pink-600', 'newsletter': 'from-blue-500 to-indigo-600',
                    'product-showcase': 'from-emerald-500 to-teal-600', 'announcement': 'from-amber-500 to-orange-600',
                    'minimal-branded': 'from-slate-500 to-slate-700', 'image-forward': 'from-violet-500 to-purple-600',
                  };
                  return (
                    <button key={skel.id} onClick={() => selectSmartTemplate(skel.id)}
                      className={`group text-left rounded-xl border p-4 transition-all cursor-pointer ${
                        isSelected ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 shadow-sm" : "border-slate-200 hover:border-indigo-300 hover:shadow-sm"
                      }`}>
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${colorMap[skel.id] || 'from-slate-500 to-slate-600'} flex items-center justify-center text-white mb-2.5`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className={`text-xs font-semibold mb-0.5 ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>{skel.name}</p>
                      <p className="text-[9px] text-slate-400 leading-snug line-clamp-2">{skel.description.split('.')[0]}</p>
                      {isSelected && (
                        <div className="mt-2 flex items-center gap-1 text-[9px] text-indigo-600 font-semibold"><Check className="w-3 h-3" /> Selected</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider — Import */}
            <div className="flex items-center gap-4">
              <div className="flex-1 border-t border-slate-200" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">or import your own</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* Import Your Own Email */}
            <div>
              <button onClick={startImport}
                className={`w-full text-left rounded-xl border p-5 transition-all cursor-pointer flex items-center gap-4 ${
                  composerMode === "import" ? "border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 shadow-sm" : "border-slate-200 hover:border-emerald-300 hover:shadow-sm"
                }`}>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold mb-0.5 ${composerMode === "import" ? "text-emerald-700" : "text-slate-700"}`}>Import Your Own Email</p>
                  <p className="text-xs text-slate-400">Paste HTML from Canva, Mailchimp, or any design tool. We&apos;ll send it to your selected recipients.</p>
                </div>
                {composerMode === "import" && (
                  <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold shrink-0"><Check className="w-4 h-4" /> Selected</div>
                )}
              </button>
            </div>

            {/* Divider — Text Templates */}
            <div className="flex items-center gap-4">
              <div className="flex-1 border-t border-slate-200" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">or use a text template</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* Classic Text Templates */}
            <div>
              <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block mb-3">Text Templates</label>
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
          </div>
        )}

        {/* ═══ Step 2: Edit Content ═══ */}
        {step === 2 && composerMode === "classic" && (
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
                {["{{first_name}}", "{{last_name}}", "{{org_name}}", "{{email}}", "{{sender_name}}", "{{phone_number}}", "{{month}}"].map((field) => (
                  <button key={field} onClick={() => setBody((prev) => prev + " " + field)}
                    className="text-[11px] font-mono px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors">
                    {field}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Step 2: Import Mode ═══ */}
        {step === 2 && composerMode === "import" && (
          <div className="flex h-full">
            {/* Left Pane: Live Preview */}
            <div className="flex-[3] flex flex-col border-r border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Live Preview</span>
                <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                  <button onClick={() => setPreviewMode("desktop")}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                      previewMode === "desktop" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600"
                    }`}>
                    <Monitor className="w-3 h-3" /> Desktop
                  </button>
                  <button onClick={() => setPreviewMode("mobile")}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                      previewMode === "mobile" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600"
                    }`}>
                    <Smartphone className="w-3 h-3" /> Mobile
                  </button>
                </div>
              </div>
              <div className="flex-1 flex items-start justify-center overflow-auto p-6 bg-slate-100">
                {assembledHtml ? (
                  <div className={`bg-white shadow-lg rounded-xl overflow-hidden transition-all duration-300 ${
                    previewMode === "mobile" ? "w-[375px]" : "w-full max-w-[680px]"
                  }`}>
                    <iframe
                      srcDoc={assembledHtml}
                      className="w-full border-0"
                      style={{ minHeight: 500, height: "70vh" }}
                      sandbox="allow-same-origin"
                      title="Email Preview"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Upload className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm font-medium">Paste or upload your HTML to see a preview</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Pane: Import Panel */}
            <div className="flex-[2] flex flex-col bg-white min-w-0">
              <div className="px-5 py-4 border-b border-slate-200 shrink-0">
                <h3 className="text-sm font-bold text-slate-700 mb-1">Import Your Email</h3>
                <p className="text-[11px] text-slate-400">Paste HTML from Canva, Mailchimp, or upload a .html file</p>
              </div>

              {/* Subject Line */}
              <div className="px-5 py-3 border-b border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Subject Line</label>
                <input
                  type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter your email subject..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200 shrink-0">
                <button onClick={() => setImportTab("paste")}
                  className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                    importTab === "paste" ? "text-emerald-600 border-b-2 border-emerald-600" : "text-slate-400 hover:text-slate-600"
                  }`}>
                  Paste HTML
                </button>
                <button onClick={() => setImportTab("upload")}
                  className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                    importTab === "upload" ? "text-emerald-600 border-b-2 border-emerald-600" : "text-slate-400 hover:text-slate-600"
                  }`}>
                  Upload File
                </button>
                <button onClick={() => setImportTab("ai")}
                  className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                    importTab === "ai" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"
                  }`}
                  disabled={!assembledHtml}
                  title={!assembledHtml ? "Import HTML first to enable AI editing" : ""}
                >
                  ✨ Edit with AI
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto p-5">
                {importTab === "paste" ? (
                  <div className="space-y-3 h-full flex flex-col">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HTML Code</label>
                      <button
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text) handleImportPaste(text);
                          } catch { /* clipboard access denied */ }
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Copy className="w-3 h-3" /> Paste from Clipboard
                      </button>
                    </div>
                    <textarea
                      value={assembledHtml}
                      onChange={(e) => handleImportPaste(e.target.value)}
                      placeholder={'Paste your email HTML here...\n\nFor example, from Canva:\n1. Open your Canva email design\n2. Click Share → More → Embed\n3. Copy the HTML code\n4. Paste it here'}
                      className="flex-1 w-full p-3 text-xs font-mono border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-slate-50 min-h-[200px]"
                      spellCheck={false}
                    />
                  </div>
                ) : importTab === "upload" ? (
                  <div className="space-y-4">
                    <input
                      ref={htmlFileInputRef}
                      type="file"
                      accept=".html,.htm,.eml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const content = ev.target?.result as string;
                          if (content) handleImportPaste(content);
                        };
                        reader.readAsText(file);
                      }}
                    />
                    <div
                      onClick={() => htmlFileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
                    >
                      <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-600 mb-1">Click to upload a file</p>
                      <p className="text-xs text-slate-400">Supports .html files and .eml files (from Gmail&apos;s &quot;Download message&quot;)</p>
                    </div>
                    {assembledHtml && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                        <CheckCircle2 className="w-4 h-4" /> HTML loaded successfully ({Math.round(assembledHtml.length / 1024)}KB)
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Merge Fields Helper */}
                {importTab !== "ai" && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Available Merge Fields</p>
                  <p className="text-[11px] text-slate-400 mb-2">Add these to your HTML to personalize each email:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['{{first_name}}', '{{last_name}}', '{{email}}', '{{org_name}}', '{{sender_name}}', '{{phone_number}}'].map((field) => (
                      <button
                        key={field}
                        onClick={() => navigator.clipboard.writeText(field)}
                        className="px-2 py-1 text-[10px] font-mono font-medium bg-white border border-slate-200 rounded-md hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors cursor-pointer text-slate-600"
                        title={`Click to copy ${field}`}
                      >
                        {field}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Click any field to copy it, then paste into your HTML where you want it personalized.</p>
                </div>
                )}

                {/* AI Edit Chat */}
                {importTab === "ai" && (
                  <div className="flex flex-col h-full -mx-5 -mb-5">
                    {/* Chat messages */}
                    <div ref={importAiChatRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 200 }}>
                      {importAiMessages.length === 0 && (
                        <div className="text-center py-8">
                          <Sparkles className="w-8 h-8 text-indigo-300 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-slate-600 mb-1">Edit with Jarvis</p>
                          <p className="text-xs text-slate-400 max-w-[250px] mx-auto">Describe what you want to change and I&apos;ll update the HTML for you. Try things like:</p>
                          <div className="mt-3 space-y-1.5">
                            {['"Add a personalized greeting with {{first_name}}"', '"Change the button color to blue"', '"Add a new section about our services"', '"Remove the footer"'].map((suggestion) => (
                              <button key={suggestion} onClick={() => { setImportAiPrompt(suggestion.replace(/"/g, '')); }}
                                className="block mx-auto text-[11px] text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1 rounded-lg transition-colors cursor-pointer">
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {importAiMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-indigo-600 text-white rounded-br-sm'
                              : 'bg-slate-100 text-slate-700 rounded-bl-sm'
                          }`}>
                            {msg.images && msg.images.length > 0 && (
                              <div className="flex gap-1.5 mb-1.5 flex-wrap">
                                {msg.images.map((img, ii) => (
                                  <img key={ii} src={img} alt="" className="w-16 h-16 rounded-lg object-cover border border-white/20" />
                                ))}
                              </div>
                            )}
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      {importAiLoading && (
                        <div className="flex justify-start">
                          <div className="bg-slate-100 text-slate-500 px-3 py-2 rounded-xl rounded-bl-sm text-xs flex items-center gap-2">
                            <div className="flex gap-1">
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            Editing...
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Chat input */}
                    <div className="border-t border-slate-200 px-4 py-3 bg-white shrink-0">
                      {/* Pending image thumbnails */}
                      {importAiImages.length > 0 && (
                        <div className="flex gap-2 mb-2 flex-wrap">
                          {importAiImages.map((img, i) => (
                            <div key={i} className="relative group">
                              <img src={img} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
                              <button onClick={() => setImportAiImages(prev => prev.filter((_, idx) => idx !== i))}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <input ref={importAiFileRef} type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                        const files = e.target.files;
                        if (!files) return;
                        for (const file of Array.from(files)) {
                          const b64 = await fileToBase64(file);
                          setImportAiImages(prev => [...prev, b64]);
                        }
                        e.target.value = '';
                      }} />
                      <form onSubmit={(e) => { e.preventDefault(); handleImportAiSend(); }} className="flex gap-2">
                        <button type="button" onClick={() => importAiFileRef.current?.click()}
                          className="px-2 py-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer" title="Attach image">
                          <Paperclip className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="text"
                          value={importAiPrompt}
                          onChange={(e) => setImportAiPrompt(e.target.value)}
                          onPaste={async (e) => {
                            const items = e.clipboardData?.items;
                            if (!items) return;
                            for (const item of Array.from(items)) {
                              if (item.type.startsWith('image/')) {
                                e.preventDefault();
                                const file = item.getAsFile();
                                if (file) {
                                  const b64 = await fileToBase64(file);
                                  setImportAiImages(prev => [...prev, b64]);
                                }
                              }
                            }
                          }}
                          placeholder={importAiImages.length > 0 ? "Add a message or send images..." : "Describe what to change..."}
                          className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                          disabled={importAiLoading}
                        />
                        <button type="submit" disabled={importAiLoading || (!importAiPrompt.trim() && importAiImages.length === 0)}
                          className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Step 2: Smart Composer ═══ */}
        {step === 2 && composerMode === "smart" && (
          <div className="flex h-full">
            {/* ── Left Pane: Live Preview ── */}
            <div className="flex-[3] flex flex-col border-r border-slate-200 bg-slate-50/50">
              {/* Preview header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Live Preview</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                    <button onClick={() => setPreviewMode("desktop")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                        previewMode === "desktop" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600"
                      }`}>
                      <Monitor className="w-3 h-3" /> Desktop
                    </button>
                    <button onClick={() => setPreviewMode("mobile")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                        previewMode === "mobile" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600"
                      }`}>
                      <Smartphone className="w-3 h-3" /> Mobile
                    </button>
                  </div>
                </div>
              </div>

              {/* Preview content */}
              <div className="flex-1 overflow-auto flex items-start justify-center p-4 min-h-0">
                {assembledHtml ? (
                  <iframe
                    srcDoc={assembledHtml}
                    sandbox="allow-same-origin"
                    title="Smart Composer Preview"
                    className="bg-white rounded-lg shadow-sm border border-slate-200 transition-all duration-300"
                    style={{
                      width: previewMode === "mobile" ? "375px" : "600px",
                      height: "100%",
                      minHeight: "300px",
                      maxWidth: "100%",
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center px-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-4">
                      <Mail className="w-7 h-7 text-indigo-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-400 mb-1">Your email preview will appear here</p>
                    <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                      Chat with Jarvis on the right — brainstorm your email, and when you&apos;re ready, tell him to build it. The preview will appear here instantly.
                    </p>
                  </div>
                )}
              </div>

              {/* Preview footer with test send */}
              {assembledHtml && (
                <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-200 bg-white shrink-0">
                  <button onClick={handleTestSend} disabled={testSending || !gmailRefreshToken}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      testSent ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                      testSending ? "bg-slate-100 text-slate-400 cursor-wait" :
                      !gmailRefreshToken ? "bg-slate-100 text-slate-300 cursor-not-allowed" :
                      "bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100"
                    }`}>
                    {testSent ? <><CheckCircle2 className="w-3.5 h-3.5" /> Sent! Check inbox</> :
                     testSending ? <><RotateCcw className="w-3.5 h-3.5 animate-spin" /> Sending...</> :
                     <><Send className="w-3.5 h-3.5" /> Send Test Email</>}
                  </button>
                  <span className="text-[10px] text-slate-400">Sends to your own email for final verification</span>
                </div>
              )}
            </div>

            {/* ── Right Pane: Jarvis Chat ── */}
            <div className="flex-[2] flex flex-col bg-white min-w-[320px]">
              {/* Subject line — compact */}
              <div className="px-4 py-2.5 border-b border-slate-100 shrink-0">
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Subject Line</label>
                <input ref={subjectInputRef} type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                  onFocus={() => setLastFocusedInput('subject')}
                  placeholder="Jarvis will generate this, or type your own"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 placeholder:text-slate-300" />
              </div>

              {/* Chat messages — scrollable, takes all remaining space */}
              <div ref={aiChatRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                {aiMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-3">
                      <Wand2 className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-slate-600 mb-1">Chat with Jarvis</p>
                    <p className="text-xs text-slate-400 max-w-[260px] leading-relaxed mb-4">
                      I&apos;m your email strategist. Tell me who you&apos;re emailing and what you want to say — we can brainstorm together, and I&apos;ll build the email when you&apos;re ready.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {[
                        "Help me email 500 CEOs",
                        "Write a product launch email",
                        "What tone should I use?",
                      ].map((suggestion) => (
                        <button key={suggestion} onClick={() => { setAiPrompt(suggestion); }}
                          className="text-[10px] px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 transition-colors cursor-pointer">
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {aiMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[85%]">
                      <div className={`px-3.5 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-slate-800 text-white rounded-br-sm"
                          : "bg-slate-100 text-slate-700 rounded-bl-sm"
                      }`}>
                        {msg.text}
                      </div>
                      {/* Quick reply buttons */}
                      {msg.quickReplies && msg.quickReplies.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-2">
                          {msg.quickReplies.filter(r => r !== "Skip").map((reply) => (
                            <button key={reply} onClick={() => handleJarvisMessage(reply, true)}
                              disabled={isAssembling}
                              className="text-left text-[12px] px-3.5 py-2 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 hover:border-indigo-300 transition-all cursor-pointer leading-snug">
                              {reply}
                            </button>
                          ))}
                          {msg.quickReplies.includes("Skip") && (
                            <button onClick={() => handleJarvisMessage("Skip", true)}
                              disabled={isAssembling}
                              className="text-[11px] px-3 py-1.5 rounded-lg border border-slate-200 text-slate-400 bg-slate-50 hover:bg-slate-100 hover:text-slate-600 transition-all cursor-pointer self-start mt-0.5">
                              Skip
                            </button>
                          )}
                        </div>
                      )}
                      {/* Skip, and generate draft — shown on AI messages after guided dialogue */}
                      {msg.role === "ai" && !msg.quickReplies && !msg.renderedEmail && dialogueStep >= 4 && i === aiMessages.length - 1 && (
                        <button
                          onClick={() => handleJarvisMessage("Please generate the email draft now based on everything we've discussed.", true)}
                          disabled={isAssembling}
                          className="mt-2 text-[12px] px-3.5 py-2 rounded-lg border border-slate-200 text-slate-400 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all cursor-pointer self-start">
                          Skip, and generate draft
                        </button>
                      )}
                      {msg.renderedEmail && (
                        <div className="flex items-center gap-1 mt-1 ml-1">
                          <span className="text-[9px] font-semibold text-indigo-500 flex items-center gap-1">
                            <Mail className="w-2.5 h-2.5" /> Preview updated
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isAssembling && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 px-3.5 py-2.5 rounded-xl rounded-bl-sm text-sm text-slate-500 flex items-center gap-2">
                      <RotateCcw className="w-3 h-3 animate-spin" /> Jarvis is thinking...
                    </div>
                  </div>
                )}
              </div>

              {/* ── Bottom bar: images + prompt input (always visible) ── */}
              <div className="border-t border-slate-200 shrink-0">
                {/* Uploaded image thumbnails — compact row */}
                {uploadedImages.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 overflow-x-auto">
                    {uploadedImages.map((img, i) => (
                      <div key={i} className="relative group shrink-0">
                        <img src={img.url} alt={img.filename} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                        <button onClick={() => removeImage(i)}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    <span className="text-[9px] text-slate-400 shrink-0">{uploadedImages.length} image{uploadedImages.length > 1 ? "s" : ""}</span>
                  </div>
                )}

                {/* Prompt input row */}
                <div className="px-4 py-3 bg-slate-50/50">
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files)} />
                  <div className="flex items-end gap-2">
                    {/* Attach image button */}
                    <button onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all cursor-pointer shrink-0 ${
                        isUploadingImage
                          ? "border-indigo-200 bg-indigo-50 text-indigo-500"
                          : "border-slate-200 bg-white text-slate-400 hover:text-indigo-500 hover:border-indigo-300"
                      }`}
                      title="Attach images">
                      {isUploadingImage
                        ? <RotateCcw className="w-4 h-4 animate-spin" />
                        : <ImageIcon className="w-4 h-4" />}
                    </button>

                    {/* Text input */}
                    <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                      onFocus={() => setLastFocusedInput('chat')}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleJarvisMessage(aiPrompt);
                        }
                      }}
                      placeholder={aiMessages.length === 0 ? "Tell Jarvis about the email you need..." : "Chat with Jarvis..."}
                      rows={1}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 resize-none placeholder:text-slate-400 leading-relaxed max-h-[80px]" />

                    {/* Send button */}
                    <button onClick={() => handleJarvisMessage(aiPrompt)}
                      disabled={!aiPrompt.trim() || isAssembling}
                      className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all cursor-pointer shrink-0 ${
                        !aiPrompt.trim() || isAssembling ? "bg-slate-200 text-slate-400" : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm hover:shadow-md"
                      }`}>
                      {isAssembling ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Merge fields as subtle chips — insert into subject or chat based on last focus */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[8px] text-slate-400">Merge:</span>
                    {["{{first_name}}", "{{org_name}}", "{{sender_name}}"].map((field) => (
                      <button key={field} onClick={() => {
                        if (lastFocusedInput === 'subject') {
                          setSubject((prev) => prev + " " + field);
                          // Refocus subject input so user can keep typing
                          setTimeout(() => subjectInputRef.current?.focus(), 0);
                        } else {
                          setAiPrompt((prev) => prev + " " + field);
                        }
                      }}
                        className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-400 border border-blue-100 hover:bg-blue-100 cursor-pointer transition-colors">
                        {field}
                      </button>
                    ))}
                  </div>
                </div>
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

            {repeatDays > 0 && (
              <div>
                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block mb-2">End Date</label>
                <input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border border-slate-200 text-base outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all" />
                <p className="text-xs text-slate-400 mt-1">The campaign will stop sending after this date. Leave empty for no end date.</p>
              </div>
            )}

            <p className="text-xs text-slate-400 mt-1">
              {repeatDays === 0 ? 'This campaign will be sent once on the trigger date and time.' :
               repeatDays === 1 ? 'This campaign will be sent every day at the trigger time, starting on the trigger date.' :
               repeatDays === 7 ? 'This campaign will be sent every 7 days at the trigger time, starting on the trigger date.' :
               'This campaign will be sent every 30 days at the trigger time, starting on the trigger date.'}
            </p>

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
                senderName={personalInfo.senderName || campaignSettings.senderName || user?.displayName || user?.email?.split("@")[0] || "You"}
                recipients={recipients}
                settings={{ ...campaignSettings, senderName: personalInfo.senderName || campaignSettings.senderName, orgName: personalInfo.orgName || campaignSettings.orgName, phoneNumber: personalInfo.phoneNumber || campaignSettings.phoneNumber || '' }}
                onClose={() => setShowPreview(false)}
                htmlContent={(composerMode === "smart" || composerMode === "import") ? assembledHtml : undefined}
                uid={user?.uid}
                refreshToken={gmailRefreshToken || undefined}
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

export default function CampaignManager({ onBack, focusCampaignId, onFocusHandled }: { onBack: () => void; focusCampaignId?: string | null; onFocusHandled?: () => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [view, setView] = useState<"list" | "creator" | "settings">("list");
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [crmContacts, setCrmContacts] = useState<CRMContact[]>([]);
  const [campaignSettings, setCampaignSettings] = useState<CampaignSettingsData>(DEFAULT_SETTINGS);
  const { user } = useUser();
  const firestore = useFirestore();

  // Scroll-to and highlight a campaign tile when navigated from the home screen (desktop only)
  useEffect(() => {
    if (!focusCampaignId) return;
    // Only scroll on desktop
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      onFocusHandled?.();
      return;
    }
    // Wait for the DOM to render the tiles
    const timer = setTimeout(() => {
      const el = document.getElementById(`campaign-tile-${focusCampaignId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Apply highlight flash
        el.style.transition = 'background-color 0.3s ease';
        el.style.backgroundColor = '#e2e8f0'; // slate-200
        setTimeout(() => {
          el.style.transition = 'background-color 2.5s ease';
          el.style.backgroundColor = 'transparent';
        }, 400);
        setTimeout(() => {
          el.style.backgroundColor = '';
          el.style.transition = '';
        }, 3000);
      }
      onFocusHandled?.();
    }, 350);
    return () => clearTimeout(timer);
  }, [focusCampaignId, onFocusHandled]);

  // Load CRM contacts (from both shared CRM and per-user collections)
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    let sharedContacts: CRMContact[] = [];
    let userContacts: CRMContact[] = [];

    const mergeAndSet = () => {
      // Merge both, deduplicate by email (prefer shared CRM)
      const seen = new Map<string, CRMContact>();
      for (const c of sharedContacts) {
        if (c.email) seen.set(c.email.toLowerCase(), c);
        else seen.set(c.id, c);
      }
      for (const c of userContacts) {
        const key = c.email ? c.email.toLowerCase() : c.id;
        if (!seen.has(key)) seen.set(key, c);
      }
      const merged = Array.from(seen.values());
      merged.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setCrmContacts(merged);
    };

    // Listen to shared CRM contacts
    const sharedQ = query(collection(firestore, "shared/crm/contacts"));
    const unsubShared = onSnapshot(sharedQ, (snap) => {
      sharedContacts = [];
      snap.forEach((d) => {
        const data = d.data();
        const fullName = [data.firstName || "", data.lastName || ""].filter(Boolean).join(" ");
        sharedContacts.push({ id: d.id, name: fullName, email: data.email || "", aliases: data.aliases, tags: data.tags || [] });
      });
      mergeAndSet();
    });

    // Listen to per-user contacts
    const userQ = query(collection(firestore, `users/${user.uid}/contacts`));
    const unsubUser = onSnapshot(userQ, (snap) => {
      userContacts = [];
      snap.forEach((d) => {
        const data = d.data();
        const fullName = [data.firstName || "", data.lastName || ""].filter(Boolean).join(" ");
        userContacts.push({ id: d.id, name: fullName, email: data.email || "", aliases: data.aliases, tags: data.tags || [] });
      });
      mergeAndSet();
    });

    return () => { unsubShared(); unsubUser(); };
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

  // Load campaigns from Firestore
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const q = query(collection(firestore, `users/${user.uid}/campaigns`));
    const unsub = onSnapshot(q, (snap) => {
      const loaded: Campaign[] = [];
      snap.forEach((d) => {
        loaded.push({ ...(d.data() as Campaign), id: d.id });
      });
      loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCampaigns(loaded);
    });
    return () => unsub();
  }, [firestore, user?.uid]);

  // ── Polling: check for due campaigns every 30 seconds ──
  const processingCampaignsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const checkDueCampaigns = async () => {
      const now = Date.now();
      const dueCampaigns = campaigns.filter((c) => {
        if (c.status !== 'active') return false;
        if (processingCampaignsRef.current.has(c.id)) return false;
        const triggerTime = new Date(c.triggerAt).getTime();
        if (isNaN(triggerTime)) return false;
        // Due if triggerAt is in the past (within a 10-minute window to avoid re-sending old ones)
        return triggerTime <= now && (now - triggerTime) < 600_000;
      });

      for (const campaign of dueCampaigns) {
        // Check if already sent (sent > 0 and not repeating)
        if ((campaign.sent || 0) > 0 && (!campaign.repeatDays || campaign.repeatDays === 0)) continue;
        
        processingCampaignsRef.current.add(campaign.id);
        console.log(`[Campaign Poller] Campaign ${campaign.id} is due — sending now.`);

        try {
          const { getRefreshToken, sendEmail } = await import('@/lib/gmail-api');
          const refreshToken = await getRefreshToken(user!.uid);
          if (!refreshToken) {
            console.warn(`[Campaign Poller] No refresh token — skipping ${campaign.id}`);
            processingCampaignsRef.current.delete(campaign.id);
            continue;
          }

          // Load sender settings
          let effectiveSettings = { ...campaignSettings };
          try {
            const presetSnap = await getDoc(doc(firestore, `users/${user!.uid}/settings/personalInfoPresets`));
            if (presetSnap.exists()) {
              const presets = presetSnap.data().presets || [];
              if (presets.length > 0) {
                const latest = presets[presets.length - 1];
                if (latest.senderName) effectiveSettings.senderName = latest.senderName;
                if (latest.orgName) effectiveSettings.orgName = latest.orgName;
                if (latest.phoneNumber) effectiveSettings.phoneNumber = latest.phoneNumber;
              }
            }
          } catch (e) { console.warn('[Campaign Poller] Could not load presets:', e); }

          let sentCount = 0;
          for (const recipient of campaign.recipients) {
            const resolvedSubject = resolveMergeFields(campaign.subject, recipient, effectiveSettings);
            let emailBody: string;
            if (campaign.htmlContent) {
              emailBody = resolveMergeFields(campaign.htmlContent, recipient, effectiveSettings);
            } else {
              let resolvedBody = resolveMergeFields(campaign.body, recipient, effectiveSettings);
              const senderName = effectiveSettings.senderName || '';
              const phone = effectiveSettings.phoneNumber || '';
              const replyEmail = effectiveSettings.replyToEmail || '';
              const website = effectiveSettings.website || '';
              if (senderName || phone || replyEmail || website) {
                resolvedBody += '\n\n---\n';
                if (senderName) resolvedBody += senderName + '\n';
                if (phone) resolvedBody += phone + '\n';
                if (replyEmail) resolvedBody += replyEmail + '\n';
                if (website) resolvedBody += website + '\n';
              }
              emailBody = resolvedBody;
            }
            try {
              await sendEmail(user!.uid, refreshToken, recipient.email, resolvedSubject, emailBody);
              sentCount++;
              console.log(`[Campaign Poller] Sent to ${recipient.email}`);
            } catch (err) {
              console.error(`[Campaign Poller] Failed to send to ${recipient.email}:`, err);
            }
          }

          // Update Firestore
          const updateData: Record<string, unknown> = {
            sent: (campaign.sent || 0) + sentCount,
            lastSentAt: new Date().toISOString(),
          };
          if (!campaign.repeatDays || campaign.repeatDays === 0) {
            updateData.status = 'completed';
          }
          await setDoc(doc(firestore, `users/${user!.uid}/campaigns`, campaign.id), updateData, { merge: true });
          console.log(`[Campaign Poller] ✓ ${campaign.id}: sent ${sentCount}/${campaign.recipients.length}`);
        } catch (err) {
          console.error(`[Campaign Poller] Error processing ${campaign.id}:`, err);
        } finally {
          // Remove from processing after a delay to prevent re-trigger
          setTimeout(() => processingCampaignsRef.current.delete(campaign.id), 120_000);
        }
      }
    };

    // Run immediately, then every 30 seconds
    checkDueCampaigns();
    const interval = setInterval(checkDueCampaigns, 30_000);
    return () => clearInterval(interval);
  }, [firestore, user?.uid, campaigns, campaignSettings]);

  const handleSave = useCallback(async (campaign: Campaign) => {
    if (!firestore || !user?.uid) return;
    try {
      // Strip undefined values — Firestore rejects them
      const cleanCampaign = Object.fromEntries(
        Object.entries(campaign).filter(([, v]) => v !== undefined)
      );
      await setDoc(doc(firestore, `users/${user.uid}/campaigns`, campaign.id), cleanCampaign);

      // Only send emails if the campaign is "active" AND its triggerAt time has passed
      // If triggerAt is in the future, the email cron will pick it up at the right time
      if (campaign.status === 'active' && campaign.recipients.length > 0) {
        const triggerDate = new Date(campaign.triggerAt);
        const now = new Date();
        const isDueNow = triggerDate.getTime() <= now.getTime() + 60_000; // within 1 minute

        if (isDueNow) {
          // Trigger time is now or past → send immediately
          // Mark in processingRef to prevent poller from double-sending
          processingCampaignsRef.current.add(campaign.id);
          const { getRefreshToken, sendEmail } = await import('@/lib/gmail-api');
          const refreshToken = await getRefreshToken(user.uid);
          if (refreshToken) {
            // Build effective settings by loading personalInfo presets
            let effectiveSettings = { ...campaignSettings };
            try {
              const presetSnap = await getDoc(doc(firestore, `users/${user.uid}/settings/personalInfoPresets`));
              if (presetSnap.exists()) {
                const presets = presetSnap.data().presets || [];
                if (presets.length > 0) {
                  const latest = presets[presets.length - 1];
                  if (latest.senderName) effectiveSettings.senderName = latest.senderName;
                  if (latest.orgName) effectiveSettings.orgName = latest.orgName;
                  if (latest.phoneNumber) effectiveSettings.phoneNumber = latest.phoneNumber;
                }
              }
            } catch (e) { console.warn('[Campaign] Could not load personal info presets:', e); }

            let sentCount = 0;
            for (const recipient of campaign.recipients) {
              const resolvedSubject = resolveMergeFields(campaign.subject, recipient, effectiveSettings);

              let emailBody: string;
              if (campaign.htmlContent) {
                // Smart Composer: send the pre-assembled HTML as-is (with merge fields resolved)
                emailBody = resolveMergeFields(campaign.htmlContent, recipient, effectiveSettings);
              } else {
                // Classic mode: plain text body with sign-off appended
                let resolvedBody = resolveMergeFields(campaign.body, recipient, effectiveSettings);

                // Append professional sign-off
                const senderName = effectiveSettings.senderName || '';
                const phone = effectiveSettings.phoneNumber || '';
                const replyEmail = effectiveSettings.replyToEmail || '';
                const website = effectiveSettings.website || '';
                if (senderName || phone || replyEmail || website) {
                  resolvedBody += '\n\n---\n';
                  if (senderName) resolvedBody += senderName + '\n';
                  if (phone) resolvedBody += phone + '\n';
                  if (replyEmail) resolvedBody += replyEmail + '\n';
                  if (website) resolvedBody += website + '\n';
                }
                emailBody = resolvedBody;
              }

              try {
                await sendEmail(user.uid, refreshToken, recipient.email, resolvedSubject, emailBody);
                sentCount++;
                console.log(`[Campaign] Sent to ${recipient.email}`);
              } catch (err) {
                console.error(`[Campaign] Failed to send to ${recipient.email}:`, err);
              }
            }
            // Handle repeating vs one-time campaigns
            const updateData: Record<string, unknown> = {
              sent: sentCount,
              lastSentAt: new Date().toISOString(),
            };
            if (!campaign.repeatDays || campaign.repeatDays === 0) {
              updateData.status = 'completed';
            }
            await setDoc(doc(firestore, `users/${user.uid}/campaigns`, campaign.id), updateData, { merge: true });
          } else {
            console.warn('[Campaign] No Gmail refresh token found - cannot send emails');
          }
          // Keep in processingRef for 2 min to prevent poller duplicate
          setTimeout(() => processingCampaignsRef.current.delete(campaign.id), 120_000);
        } else {
          // Trigger time is in the future → do NOT send now
          // The polling interval in useEffect will pick it up when it's due
          console.log(`[Campaign] Scheduled for ${triggerDate.toISOString()} — polling will pick it up.`);
        }
      }
    } catch (err) {
      console.error('[Campaign] Save error:', err);
    }
    setView('list');
    setEditingCampaign(null);
  }, [firestore, user?.uid, campaignSettings]);

  const togglePause = useCallback(async (id: string) => {
    if (!firestore || !user?.uid) return;
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;
    const newStatus = campaign.status === 'active' ? 'paused' as CampaignStatus : 'active' as CampaignStatus;
    await setDoc(doc(firestore, `users/${user.uid}/campaigns`, id), { status: newStatus }, { merge: true });
  }, [firestore, user?.uid, campaigns]);

  const deleteCampaign = useCallback(async (id: string) => {
    if (!firestore || !user?.uid) return;
    await deleteDoc(doc(firestore, `users/${user.uid}/campaigns`, id));
  }, [firestore, user?.uid]);

  const duplicateCampaign = useCallback(async (id: string) => {
    if (!firestore || !user?.uid) return;
    const orig = campaigns.find(c => c.id === id);
    if (!orig) return;
    const newId = nextCampaignId();
    const copy = { ...orig, id: newId, name: `${orig.name} (Copy)`, status: 'draft' as CampaignStatus, sent: 0, opened: 0, clicked: 0 };
    const cleanCopy = Object.fromEntries(Object.entries(copy).filter(([, v]) => v !== undefined));
    await setDoc(doc(firestore, `users/${user.uid}/campaigns`, newId), cleanCopy);
  }, [firestore, user?.uid, campaigns]);

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
                id={`campaign-tile-${c.id}`}
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
