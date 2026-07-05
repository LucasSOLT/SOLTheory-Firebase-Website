"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail, MessageSquare, Send, ChevronRight, ChevronLeft,
  Search, Star, StarOff, Inbox, Archive, Trash2, RefreshCw,
  Clock, Paperclip, Reply, ReplyAll, Forward,
  ArrowLeft, Pen, X, Plus, Filter, Check, Zap, CalendarDays, Maximize2, Minimize2,
  Phone, Hash, Globe, Link2, Loader2, ChevronUp, LogOut, UserPlus, Settings,
  Instagram, Camera, Youtube,
} from "lucide-react";
import CampaignManager from "@/components/campaigning/CampaignManager";
import type { Campaign } from "@/components/campaigning/CampaignManager";
import AIComposeAssist from "@/components/campaigning/AIComposeAssist";
import SmartReply from "@/components/campaigning/SmartReply";
import { useUser, useFirestore } from "@/firebase";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useTranslation } from "@/lib/i18n";
import { getRefreshToken, fetchEmails, sendEmail as gmailSend, deleteGmailEmail, getGmailConnectUrl, type GmailMessage } from "@/lib/gmail-api";
import CalendarPreviewModal from "./_components/CalendarPreviewModal";
import type { CalendarIGPost as CalendarIGPostType } from "./_components/CalendarPreviewModal";

/* ═══════════════════════════════════════════════════════════════
   PLATFORM DEFINITIONS
   ═══════════════════════════════════════════════════════════════ */

interface Platform {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  available: boolean;
  badge?: string;
  route?: string;
}

import { stripHtml } from "@/lib/utils";

const getPlatforms = (orgPrefix: string): Platform[] => [
  {
    id: "gmail",
    name: "Gmail Campaign",
    description: "Drip campaigns, scheduled sends, and AI-optimized engagement tracking.",
    icon: <Mail className="w-6 h-6" />,
    gradient: "from-red-500 to-rose-600",
    available: true,
  },
  {
    id: "instagram",
    name: "Instagram Campaign",
    description: "Plan, generate, and schedule automated post campaigns with AI.",
    icon: <Instagram className="w-6 h-6" />,
    gradient: "from-pink-500 via-purple-500 to-orange-400",
    available: true,
    badge: "New",
    route: `/portal/dashboard/${orgPrefix}/agentic-campaigning/instagram`,
  },
  {
    id: "sms",
    name: "SMS Campaign",
    description: "Send and manage text message conversations with Twilio-powered SMS.",
    icon: <Phone className="w-6 h-6" />,
    gradient: "from-emerald-500 to-green-700",
    available: true,
    route: `/portal/dashboard/${orgPrefix}/communications/imessage`,
  },
  {
    id: "youtube",
    name: "YouTube Campaign",
    description: "Manage your YouTube channel, upload videos, and optimize content.",
    icon: <Youtube className="w-6 h-6" />,
    gradient: "from-red-600 to-red-800",
    available: true,
    route: `/portal/dashboard/${orgPrefix}/youtube`,
  },
];

/* ═══════════════════════════════════════════════════════════════
   GMAIL VIEW
   ═══════════════════════════════════════════════════════════════ */

interface EmailMessage {
  id: string;
  from: string;
  fromEmail: string;
  to: string;
  toEmail: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  time: string;
  read: boolean;
  starred: boolean;
  hasAttachment: boolean;
  folder: string;
}

type ComposeMode = "new" | "reply" | "replyAll" | "forward";

interface ComposeState {
  to: string;
  cc: string;
  subject: string;
  body: string;
  mode: ComposeMode;
  replyToId?: string;
}

let emailIdCounter = 0;
function nextId() {
  return `email-${++emailIdCounter}-${Date.now()}`;
}

function formatNow() {
  const d = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return {
    date: `${months[d.getMonth()]} ${d.getDate()}`,
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

function GmailView({ onBack, hideTopBar, uid, refreshToken, userEmail, userName, onConnectAccount }: { onBack: () => void; hideTopBar?: boolean; uid?: string; refreshToken?: string; userEmail?: string; userName?: string; onConnectAccount?: () => void }) {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState<ComposeState>({ to: "", cc: "", subject: "", body: "", mode: "new" });
  const [sendSuccess, setSendSuccess] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const isConnected = !!(uid && refreshToken);
  const displayInitials = (userName || userEmail || "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const displayName = userName || userEmail?.split("@")[0] || "User";

  // Folder -> Gmail API folder mapping
  const folderToGmail: Record<string, string> = {
    inbox: "INBOX", starred: "STARRED", sent: "SENT",
    drafts: "DRAFT", archive: "ARCHIVE", trash: "TRASH",
  };

  // Fetch real emails when folder changes (if connected)
  useEffect(() => {
    if (!isConnected) return;
    const load = async () => {
      setLoadingEmails(true);
      const gmailFolder = folderToGmail[activeFolder] || "INBOX";
      const data = await fetchEmails(uid!, refreshToken!, gmailFolder);
      const mapped: EmailMessage[] = data.map((e) => {
        // Parse "Name <email>" format
        const fromMatch = e.from.match(/^(.*?)\s*<(.+?)>$/);
        const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : e.from;
        const fromEmail = fromMatch ? fromMatch[2] : e.from;
        const toMatch = e.to.match(/^(.*?)\s*<(.+?)>$/);
        const toName = toMatch ? toMatch[1].replace(/"/g, "").trim() : e.to;
        const toEmail = toMatch ? toMatch[2] : e.to;
        const dateObj = new Date(e.internalDate);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return {
          id: e.id,
          from: fromName || fromEmail,
          fromEmail: fromEmail,
          to: toName || toEmail,
          toEmail: toEmail,
          subject: e.subject,
          preview: e.snippet || "",
          body: e.body,
          date: `${months[dateObj.getMonth()]} ${dateObj.getDate()}`,
          time: dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
          read: !(e.labelIds || []).includes("UNREAD"),
          starred: (e.labelIds || []).includes("STARRED"),
          hasAttachment: (e.attachments || []).length > 0,
          folder: activeFolder,
        };
      });
      setEmails(mapped);
      setLoadingEmails(false);
    };
    load();
  }, [activeFolder, uid, refreshToken, isConnected]);

  const filteredEmails = emails.filter((e) => {
    const inFolder = activeFolder === "starred" ? e.starred : e.folder === activeFolder;
    const matchSearch = !searchQuery ||
      e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.preview.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = !filterUnread || !e.read;
    return inFolder && matchSearch && matchFilter;
  });

  const folderCounts: Record<string, number> = {
    inbox: emails.filter((e) => e.folder === "inbox" && !e.read).length,
    starred: emails.filter((e) => e.starred).length,
    sent: emails.filter((e) => e.folder === "sent").length,
    drafts: emails.filter((e) => e.folder === "drafts").length,
    archive: emails.filter((e) => e.folder === "archive").length,
    trash: emails.filter((e) => e.folder === "trash").length,
  };

  const toggleStar = useCallback((id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setEmails((prev) => prev.map((em) => (em.id === id ? { ...em, starred: !em.starred } : em)));
  }, []);

  const openEmail = useCallback((email: EmailMessage) => {
    setEmails((prev) => prev.map((em) => (em.id === email.id ? { ...em, read: true } : em)));
    setSelectedEmail({ ...email, read: true });
  }, []);

  const moveToFolder = useCallback((id: string, folder: string) => {
    setEmails((prev) => prev.map((em) => (em.id === id ? { ...em, folder } : em)));
    setSelectedEmail(null);
  }, []);

  const deleteEmail = useCallback((id: string) => moveToFolder(id, "trash"), [moveToFolder]);
  const archiveEmail = useCallback((id: string) => moveToFolder(id, "archive"), [moveToFolder]);

  const markAllAsRead = useCallback(() => {
    setEmails((prev) => prev.map((em) => ({ ...em, read: true })));
  }, []);

  // ─── Compose helpers ───
  const openCompose = useCallback((mode: ComposeMode, replyEmail?: EmailMessage) => {
    if (mode === "new") {
      setCompose({ to: "", cc: "", subject: "", body: "", mode: "new" });
    } else if (mode === "reply" && replyEmail) {
      setCompose({
        to: replyEmail.fromEmail,
        cc: "",
        subject: `Re: ${replyEmail.subject.replace(/^Re:\s*/i, "")}`,
        body: `\n\n──────────\nOn ${replyEmail.date} at ${replyEmail.time}, ${replyEmail.from} wrote:\n> ${replyEmail.preview}`,
        mode: "reply",
        replyToId: replyEmail.id,
      });
    } else if (mode === "replyAll" && replyEmail) {
      setCompose({
        to: replyEmail.fromEmail,
        cc: replyEmail.toEmail !== "me@soltheory.org" ? replyEmail.toEmail : "",
        subject: `Re: ${replyEmail.subject.replace(/^Re:\s*/i, "")}`,
        body: `\n\n──────────\nOn ${replyEmail.date} at ${replyEmail.time}, ${replyEmail.from} wrote:\n> ${replyEmail.preview}`,
        mode: "replyAll",
        replyToId: replyEmail.id,
      });
    } else if (mode === "forward" && replyEmail) {
      setCompose({
        to: "",
        cc: "",
        subject: `Fwd: ${replyEmail.subject.replace(/^Fwd:\s*/i, "")}`,
        body: `\n\n──────── Forwarded message ────────\nFrom: ${replyEmail.from} <${replyEmail.fromEmail}>\nDate: ${replyEmail.date} at ${replyEmail.time}\nSubject: ${replyEmail.subject}\n\n${replyEmail.preview}`,
        mode: "forward",
        replyToId: replyEmail.id,
      });
    }
    setComposeOpen(true);
  }, []);

  const handleSend = useCallback(async () => {
    if (!compose.to.trim() || !compose.subject.trim()) return;

    // Real Gmail API send
    if (isConnected) {
      setSendingEmail(true);
      const result = await gmailSend(uid!, refreshToken!, compose.to.trim(), compose.subject, compose.body, {
        cc: compose.cc || undefined,
      });
      setSendingEmail(false);
      if (result.success) {
        setComposeOpen(false);
        setCompose({ to: "", cc: "", subject: "", body: "", mode: "new" });
        setSendSuccess(true);
        setTimeout(() => setSendSuccess(false), 2500);
        // Refresh current folder to show updated state
        if (activeFolder === "sent") {
          const data = await fetchEmails(uid!, refreshToken!, "SENT");
          // Re-map would happen via the useEffect, just trigger re-render
        }
      } else {
        alert("Failed to send: " + (result.error || "Unknown error"));
      }
      return;
    }

    // Fallback: local mock
    const { date, time } = formatNow();
    const newEmail: EmailMessage = {
      id: nextId(),
      from: "You",
      fromEmail: "me@soltheory.org",
      to: compose.to.split(",")[0]?.trim() || compose.to,
      toEmail: compose.to.trim(),
      subject: compose.subject,
      preview: compose.body.split("\n").find((l) => l.trim() && !l.startsWith("─") && !l.startsWith(">") && !l.startsWith("On ") && !l.startsWith("From:") && !l.startsWith("Date:") && !l.startsWith("Subject:"))?.trim() || compose.body.slice(0, 100),
      body: `<p>${compose.body.replace(/\n/g, "<br/>")}</p>`,
      date,
      time,
      read: true,
      starred: false,
      hasAttachment: false,
      folder: "sent",
    };
    setEmails((prev) => [newEmail, ...prev]);
    setComposeOpen(false);
    setCompose({ to: "", cc: "", subject: "", body: "", mode: "new" });
    setSendSuccess(true);
    setTimeout(() => setSendSuccess(false), 2500);
  }, [compose, isConnected, uid, refreshToken, activeFolder]);

  const handleSaveDraft = useCallback(() => {
    if (!compose.subject.trim() && !compose.body.trim()) {
      setComposeOpen(false);
      return;
    }
    const { date, time } = formatNow();
    const draft: EmailMessage = {
      id: nextId(),
      from: "You (Draft)",
      fromEmail: "me@soltheory.org",
      to: compose.to || "",
      toEmail: compose.to || "",
      subject: compose.subject || "(no subject)",
      preview: compose.body.slice(0, 100) || "(empty draft)",
      body: `<p>${compose.body.replace(/\n/g, "<br/>")}</p>`,
      date,
      time,
      read: true,
      starred: false,
      hasAttachment: false,
      folder: "drafts",
    };
    setEmails((prev) => [draft, ...prev]);
    setComposeOpen(false);
    setCompose({ to: "", cc: "", subject: "", body: "", mode: "new" });
  }, [compose]);

  const folders = [
    { id: "inbox", label: "Inbox", icon: Inbox },
    { id: "starred", label: "Starred", icon: Star },
    { id: "sent", label: "Sent", icon: Send },
    { id: "drafts", label: "Drafts", icon: Pen },
    { id: "archive", label: "Archive", icon: Archive },
    { id: "trash", label: "Trash", icon: Trash2 },
  ];

  const emptyMessages: Record<string, { title: string; desc: string }> = {
    inbox: { title: "Your inbox is empty", desc: "When you connect your Gmail account and start campaigns, emails will appear here." },
    starred: { title: "No starred emails", desc: "Star important emails to find them here quickly." },
    sent: { title: "No sent emails", desc: "Emails you send will appear here." },
    drafts: { title: "No drafts", desc: "Unsent messages will be saved here as drafts." },
    archive: { title: "Archive is empty", desc: "Archived emails are stored here for safekeeping." },
    trash: { title: "Trash is empty", desc: "Deleted emails will appear here for 30 days." },
  };

  return (
    <div className="flex flex-col h-full" style={{ WebkitFontSmoothing: "antialiased" } as React.CSSProperties}>
      {/* Top Bar — hidden when parent provides tab bar */}
      {!hideTopBar && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200/80 bg-[#fefdfb] shrink-0">
          <button onClick={onBack} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm">
              <Mail className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[14px] font-semibold text-slate-800">Gmail</span>
          </div>
          <div className="flex-1 max-w-lg mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mail..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[13px] outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          {/* NXT Suite Account Widget */}
          <div className="relative" ref={accountMenuRef}>
            <button onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded-full border border-slate-200/80 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white">
              <span className="text-[11px] font-semibold text-slate-500 pl-1.5">NXT Suite</span>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {displayInitials}
              </div>
            </button>

            {/* Account Dropdown */}
            {accountMenuOpen && (
              <>
                <div className="fixed inset-0 z-[200]" onClick={() => setAccountMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-[300px] bg-white rounded-2xl border border-slate-200 shadow-2xl z-[210] overflow-hidden">
                  {/* Header */}
                  <div className="p-5 text-center border-b border-slate-100">
                    <p className="text-[13px] font-semibold text-slate-800">{userEmail || "No account connected"}</p>
                    {isConnected && <p className="text-[11px] text-slate-400 mt-0.5">Managed by NXT Suite</p>}
                  </div>

                  {/* User Avatar + Name */}
                  <div className="px-5 py-4 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-xl font-bold mb-2 ring-2 ring-slate-200 ring-offset-2">
                      {displayInitials}
                    </div>
                    <p className="text-[15px] font-semibold text-slate-800 mt-1">Hi, {displayName.split(" ")[0]}!</p>
                  </div>

                  {/* Compose Button */}
                  <div className="px-4 pb-3">
                    <button onClick={() => { openCompose("new"); setAccountMenuOpen(false); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-[12px] font-semibold hover:bg-slate-900 transition-colors cursor-pointer">
                      <Pen className="w-3 h-3" /> Compose New Email
                    </button>
                  </div>

                  {/* Connected Accounts */}
                  <div className="border-t border-slate-100 px-3 py-3">
                    {isConnected && (
                      <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                          {displayInitials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-slate-700 truncate">{displayName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{userEmail}</p>
                        </div>
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      </div>
                    )}

                    {/* Add another account */}
                    <button onClick={() => { onConnectAccount?.(); setAccountMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <UserPlus className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[12px] font-medium text-slate-600">Add another account</span>
                    </button>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-center">
                    <span className="text-[10px] text-slate-400">Privacy Policy · Terms of Service</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Slim search bar when top bar is hidden */}
      {hideTopBar && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-[#fefdfb] shrink-0">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mail..."
              className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-50 border border-slate-200/60 text-[12px] outline-none focus:ring-2 focus:ring-slate-100 focus:border-slate-300 transition-all placeholder:text-slate-400" />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {/* NXT Suite Account Widget (slim) */}
          <div className="relative" ref={accountMenuRef}>
            <button onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              className="flex items-center gap-1.5 px-1.5 py-1 rounded-full border border-slate-200/80 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white">
              <span className="text-[10px] font-semibold text-slate-500 pl-1">NXT Suite</span>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                {displayInitials}
              </div>
            </button>

            {/* Account Dropdown (same as full top bar) */}
            {accountMenuOpen && (
              <>
                <div className="fixed inset-0 z-[200]" onClick={() => setAccountMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-[300px] bg-white rounded-2xl border border-slate-200 shadow-2xl z-[210] overflow-hidden">
                  <div className="p-5 text-center border-b border-slate-100">
                    <p className="text-[13px] font-semibold text-slate-800">{userEmail || "No account connected"}</p>
                    {isConnected && <p className="text-[11px] text-slate-400 mt-0.5">Managed by NXT Suite</p>}
                  </div>
                  <div className="px-5 py-4 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-xl font-bold mb-2 ring-2 ring-slate-200 ring-offset-2">
                      {displayInitials}
                    </div>
                    <p className="text-[15px] font-semibold text-slate-800 mt-1">Hi, {displayName.split(" ")[0]}!</p>
                  </div>
                  <div className="px-4 pb-3">
                    <button onClick={() => { openCompose("new"); setAccountMenuOpen(false); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-[12px] font-semibold hover:bg-slate-900 transition-colors cursor-pointer">
                      <Pen className="w-3 h-3" /> Compose New Email
                    </button>
                  </div>
                  <div className="border-t border-slate-100 px-3 py-3">
                    {isConnected && (
                      <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                          {displayInitials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-slate-700 truncate">{displayName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{userEmail}</p>
                        </div>
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      </div>
                    )}
                    <button onClick={() => { onConnectAccount?.(); setAccountMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <UserPlus className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[12px] font-medium text-slate-600">Add another account</span>
                    </button>
                  </div>
                  <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-center">
                    <span className="text-[10px] text-slate-400">Privacy Policy · Terms of Service</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Send Success Toast */}
      {sendSuccess && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl shadow-lg text-[12px] font-medium animate-in fade-in slide-in-from-top-2 duration-200">
          <Check className="w-3.5 h-3.5 text-emerald-400" /> Message sent successfully
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-48 border-r border-slate-200/80 bg-[#faf8f3]/30 flex flex-col py-2.5 shrink-0">
          <div className="space-y-0.5 px-2">
            {folders.map((f) => {
              const count = folderCounts[f.id] || 0;
              return (
                <button key={f.id} onClick={() => { setActiveFolder(f.id); setSelectedEmail(null); setFilterUnread(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                    activeFolder === f.id
                      ? "bg-slate-200/60 text-slate-800"
                      : "text-slate-500 hover:bg-slate-100/60 hover:text-slate-700"
                  }`}>
                  <f.icon className={`w-3.5 h-3.5 ${activeFolder === f.id ? "text-slate-700" : "text-slate-400"}`} />
                  <span className="flex-1 text-left">{f.label}</span>
                  {count > 0 && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                      activeFolder === f.id ? "bg-slate-300/50 text-slate-600" : "bg-slate-200/60 text-slate-400"
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Email content */}
        {selectedEmail ? (
          /* ─── Email Detail ─── */
          <div className="flex-1 flex flex-col bg-[#fefdfb] overflow-y-auto">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 shrink-0">
              <button onClick={() => setSelectedEmail(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer" title="Back to list">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 ml-auto">
                <button onClick={() => openCompose("reply", selectedEmail)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer" title="Reply">
                  <Reply className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => openCompose("replyAll", selectedEmail)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer" title="Reply All">
                  <ReplyAll className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => openCompose("forward", selectedEmail)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer" title="Forward">
                  <Forward className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-slate-200 mx-0.5" />
                <button onClick={() => archiveEmail(selectedEmail.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer" title="Archive">
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteEmail(selectedEmail.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 cursor-pointer" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={(ev) => toggleStar(selectedEmail.id, ev)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 cursor-pointer" title="Star">
                  {emails.find((e) => e.id === selectedEmail.id)?.starred
                    ? <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    : <Star className="w-3.5 h-3.5 text-slate-300" />}
                </button>
              </div>
            </div>

            <div className="px-8 py-6 max-w-3xl">
              <h1 className="text-lg font-semibold text-slate-900 mb-4 leading-snug">{selectedEmail.subject}</h1>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-[11px]">
                  {selectedEmail.from.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-slate-800">{selectedEmail.from}</span>
                    <span className="text-[11px] text-slate-400">&lt;{selectedEmail.fromEmail}&gt;</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {selectedEmail.folder === "sent" ? `to ${selectedEmail.to || selectedEmail.toEmail}` : "to me"} · {selectedEmail.date} at {selectedEmail.time}
                  </span>
                </div>
              </div>
              <div className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: selectedEmail.body }} />
              {selectedEmail.hasAttachment && (
                <div className="mt-5 p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center gap-3">
                  <Paperclip className="w-4 h-4 text-slate-400" />
                  <span className="text-[12px] font-medium text-slate-500">1 Attachment</span>
                  <button className="ml-auto text-[11px] font-semibold text-slate-600 hover:text-slate-800 cursor-pointer">Download</button>
                </div>
              )}

              {/* AI Smart Reply suggestions */}
              <SmartReply
                emailBody={selectedEmail.body}
                emailSubject={selectedEmail.subject}
                emailFrom={selectedEmail.from}
                onSelectReply={(reply) => {
                  openCompose("reply", selectedEmail);
                  setTimeout(() => setCompose((prev) => ({ ...prev, body: reply + prev.body })), 50);
                }}
              />

              {/* Quick reply */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button onClick={() => openCompose("reply", selectedEmail)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-[12px] text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer">
                  <Reply className="w-3.5 h-3.5" /> Reply
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ─── Email List ─── */
          <div className="flex-1 flex flex-col bg-[#fefdfb]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-1.5">
                <button onClick={markAllAsRead} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer" title="Mark all as read">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setFilterUnread((v) => !v)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${filterUnread ? "bg-blue-50 text-blue-500" : "hover:bg-slate-100 text-slate-400"}`} title={filterUnread ? "Show all" : "Show unread only"}>
                  <Filter className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {filteredEmails.length} conversation{filteredEmails.length !== 1 ? "s" : ""}
                {filterUnread && " (unread)"}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto relative">
              {loadingEmails && (
                <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                    <span className="text-[12px] text-slate-400 font-medium">Loading emails...</span>
                  </div>
                </div>
              )}
              {filteredEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-8 py-20">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    {activeFolder === "trash" ? <Trash2 className="w-7 h-7 text-slate-300" /> :
                     activeFolder === "archive" ? <Archive className="w-7 h-7 text-slate-300" /> :
                     activeFolder === "sent" ? <Send className="w-7 h-7 text-slate-300" /> :
                     activeFolder === "starred" ? <Star className="w-7 h-7 text-slate-300" /> :
                     activeFolder === "drafts" ? <Pen className="w-7 h-7 text-slate-300" /> :
                     <Inbox className="w-7 h-7 text-slate-300" />}
                  </div>
                  <p className="text-[14px] font-semibold text-slate-400 mb-1">
                    {emptyMessages[activeFolder]?.title || "Nothing here"}
                  </p>
                  <p className="text-[12px] text-slate-400 max-w-xs leading-relaxed">
                    {emptyMessages[activeFolder]?.desc || "No emails in this folder."}
                  </p>
                </div>
              ) : (
                filteredEmails.map((email) => (
                  <div key={email.id} onClick={() => openEmail(email)}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100/80 cursor-pointer transition-colors group ${
                      !email.read ? "bg-blue-50/20" : ""
                    } hover:bg-slate-50`}>
                    <button onClick={(ev) => toggleStar(email.id, ev)} className="shrink-0 cursor-pointer">
                      {email.starred
                        ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        : <StarOff className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />}
                    </button>
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold text-[9px] shrink-0">
                      {email.from.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[12px] truncate ${!email.read ? "font-semibold text-slate-800" : "font-medium text-slate-500"}`}>
                          {email.from}
                        </span>
                        {email.folder === "sent" && (
                          <span className="text-[10px] text-slate-400 shrink-0">→ {email.to || email.toEmail}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[12px] truncate ${!email.read ? "font-medium text-slate-700" : "text-slate-500"}`}>
                          {email.subject}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate flex-1">— {email.preview}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {email.hasAttachment && <Paperclip className="w-3 h-3 text-slate-300" />}
                      <span className={`text-[10px] whitespace-nowrap ${!email.read ? "font-semibold text-slate-600" : "text-slate-400"}`}>
                        {email.date}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Compose Modal ─── */}
      {composeOpen && (
        <div className="absolute bottom-4 right-4 w-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white">
            <span className="text-[13px] font-semibold">
              {compose.mode === "reply" ? "Reply" : compose.mode === "replyAll" ? "Reply All" : compose.mode === "forward" ? "Forward" : "New Message"}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={handleSaveDraft} className="text-[10px] px-2 py-1 rounded-md hover:bg-slate-700 text-slate-300 cursor-pointer" title="Save as draft">
                Save Draft
              </button>
              <button onClick={() => { setComposeOpen(false); setCompose({ to: "", cc: "", subject: "", body: "", mode: "new" }); }} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-slate-700 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-[12px] text-slate-400 w-8 shrink-0">To</span>
              <input type="text" placeholder="Recipients" value={compose.to}
                onChange={(e) => setCompose((s) => ({ ...s, to: e.target.value }))}
                className="flex-1 text-[13px] outline-none text-slate-700 placeholder:text-slate-300" />
            </div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-[12px] text-slate-400 w-8 shrink-0">Cc</span>
              <input type="text" value={compose.cc}
                onChange={(e) => setCompose((s) => ({ ...s, cc: e.target.value }))}
                className="flex-1 text-[13px] outline-none text-slate-700 placeholder:text-slate-300" />
            </div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-[12px] text-slate-400 w-8 shrink-0">Subj</span>
              <input type="text" placeholder="Subject" value={compose.subject}
                onChange={(e) => setCompose((s) => ({ ...s, subject: e.target.value }))}
                className="flex-1 text-[13px] outline-none text-slate-700 placeholder:text-slate-300" />
            </div>
            <textarea ref={bodyRef} placeholder="Write your message..."
              value={compose.body}
              onChange={(e) => setCompose((s) => ({ ...s, body: e.target.value }))}
              className="w-full h-44 text-[13px] outline-none resize-none text-slate-600 leading-relaxed p-1 placeholder:text-slate-300" />
          </div>
          {/* AI Compose Assistant */}
          <AIComposeAssist
            subject={compose.subject}
            body={compose.body}
            onApplySubject={(s) => setCompose((prev) => ({ ...prev, subject: s }))}
            onApplyBody={(b) => setCompose((prev) => ({ ...prev, body: b }))}
            onRewriteBody={(b) => setCompose((prev) => ({ ...prev, body: b }))}
          />
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button onClick={handleSend}
                disabled={!compose.to.trim() || !compose.subject.trim() || sendingEmail}
                className={`px-5 py-2 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  compose.to.trim() && compose.subject.trim() && !sendingEmail
                    ? "bg-slate-800 text-white hover:bg-slate-900"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}>
                {sendingEmail ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Sending...</>
                ) : "Send"}
              </button>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer" title="Attach file">
                <Paperclip className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => { setComposeOpen(false); setCompose({ to: "", cc: "", subject: "", body: "", mode: "new" }); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 cursor-pointer" title="Discard">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INSTAGRAM CALENDAR TYPES
   ═══════════════════════════════════════════════════════════════ */

interface CalendarIGPost {
  id: string;
  clientId: string;
  caption: string;
  mediaItemUrls: string[];
  scheduledTime: Date;
  status: 'draft' | 'scheduled' | 'processing' | 'published' | 'failed';
}

function igStatusColor(status: CalendarIGPost['status']): string {
  switch (status) {
    case 'scheduled': return 'bg-blue-500';
    case 'processing': return 'bg-orange-500';
    case 'published': return 'bg-emerald-500';
    case 'failed': return 'bg-red-500';
    default: return 'bg-slate-400';
  }
}

function igStatusLabel(status: CalendarIGPost['status']): string {
  switch (status) {
    case 'scheduled': return 'Scheduled';
    case 'processing': return 'Processing';
    case 'published': return 'Published';
    case 'failed': return 'Failed';
    default: return 'Draft';
  }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function AgenticCampaigningPage() {
  const router = useRouter();
  const pathname = usePathname();
  const orgPrefix = pathname.includes('/nxtchapter/') ? 'nxtchapter' : 'soltheory';
  const PLATFORMS = getPlatforms(orgPrefix);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [gmailTab, setGmailTab] = useState<"email" | "campaigns">("email");
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const { user, isUserLoading } = useUser();

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [zoomMode, setZoomMode] = useState<'off' | 'picking-start' | 'picking-end' | 'zoomed'>('off');
  const [zoomStart, setZoomStart] = useState<number | null>(null);
  const [zoomEnd, setZoomEnd] = useState<number | null>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Campaign | null>(null);
  const [focusCampaignId, setFocusCampaignId] = useState<string | null>(null);

  // Color palette for campaign events
  const EVENT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  const getCampaignColor = (id: string) => EVENT_COLORS[Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % EVENT_COLORS.length];
  useEffect(() => {
    const saved = localStorage.getItem('insight_theme');
    if (saved === 'dark') setIsDarkMode(true);
    const handler = (e: StorageEvent) => {
      if (e.key === 'insight_theme') setIsDarkMode(e.newValue === 'dark');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Load campaigns from Firestore for calendar
  useEffect(() => {
    if (!user?.uid) return;
    import('firebase/firestore').then(({ collection: col, query: q, onSnapshot: snap }) => {
      import('@/firebase').then(({ initializeFirebase }) => {
        const { firestore } = initializeFirebase();
        const unsub = snap(q(col(firestore, `users/${user.uid}/campaigns`)), (snapshot) => {
          const loaded: Campaign[] = [];
          snapshot.forEach((d) => loaded.push({ ...(d.data() as Campaign), id: d.id }));
          setCampaigns(loaded);
        });
        return () => unsub();
      });
    });
  }, [user?.uid]);

  // ── Instagram Scheduled Posts for Calendar ──
  const [igPosts, setIgPosts] = useState<CalendarIGPost[]>([]);
  const [selectedIGPost, setSelectedIGPost] = useState<CalendarIGPost | null>(null);
  const [igModalOpen, setIgModalOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;

    import('firebase/firestore').then(({ collection: col, query: q, where, onSnapshot: snap, orderBy }) => {
      import('@/firebase').then(({ initializeFirebase }) => {
        if (cancelled) return;
        const { firestore } = initializeFirebase();
        const startOfMonth = new Date(calYear, calMonth, 1);
        const endOfMonth = new Date(calYear, calMonth + 1, 0, 23, 59, 59);
        unsub = snap(
          q(
            col(firestore, 'scheduled_instagram_posts'),
            where('clientId', '==', orgPrefix),
            where('scheduledTime', '>=', startOfMonth),
            where('scheduledTime', '<=', endOfMonth),
            orderBy('scheduledTime', 'asc')
          ),
          (snapshot) => {
            const loaded: CalendarIGPost[] = [];
            snapshot.forEach((d) => {
              const data = d.data();
              loaded.push({
                id: d.id,
                clientId: data.clientId,
                caption: data.caption || '',
                mediaItemUrls: data.mediaItemUrls || [],
                scheduledTime: data.scheduledTime?.toDate?.() || new Date(data.scheduledTime),
                status: data.status || 'scheduled',
              });
            });
            setIgPosts(loaded);
          }
        );
      });
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user?.uid, calYear, calMonth]);

  /** Get Instagram posts for a given calendar day. */
  const getIGPostsForDay = (day: number): CalendarIGPost[] => {
    return igPosts.filter((p) => {
      const d = p.scheduledTime;
      return d.getDate() === day && d.getMonth() === calMonth && d.getFullYear() === calYear;
    });
  };

  /* ── Active-Campaign Carousel Logic ──────────────────────────── */
  const activeCampaigns = useMemo(() => campaigns.filter(c => c.status === 'active'), [campaigns]);
  const totalActiveTiles = igPosts.length + activeCampaigns.length;
  const shouldCarousel = totalActiveTiles >= 4;

  const carouselRef = useRef<HTMLDivElement>(null);
  const carouselInnerRef = useRef<HTMLDivElement>(null);
  const carouselAnimRef = useRef<number | null>(null);
  const carouselDragRef = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });
  const carouselPausedRef = useRef(false);

  // Auto-scroll effect: continuously scroll, reset position for seamless loop
  useEffect(() => {
    if (!shouldCarousel) return;
    const el = carouselRef.current;
    if (!el) return;

    const speed = 0.5; // px per frame
    let raf: number;

    const step = () => {
      if (!carouselPausedRef.current && el) {
        el.scrollLeft += speed;
        // When we've scrolled past the first set of tiles, jump back seamlessly
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) {
          el.scrollLeft -= half;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    carouselAnimRef.current = raf;

    return () => cancelAnimationFrame(raf);
  }, [shouldCarousel, totalActiveTiles]);

  // Drag-to-scroll handlers
  const onCarouselMouseDown = useCallback((e: React.MouseEvent) => {
    const el = carouselRef.current;
    if (!el) return;
    carouselPausedRef.current = true;
    carouselDragRef.current = { isDragging: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }, []);

  const onCarouselMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = carouselDragRef.current;
    if (!drag.isDragging) return;
    const el = carouselRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - drag.startX) * 1.5;
    el.scrollLeft = drag.scrollLeft - walk;
  }, []);

  const onCarouselMouseUp = useCallback(() => {
    carouselDragRef.current.isDragging = false;
    carouselPausedRef.current = false;
    const el = carouselRef.current;
    if (el) { el.style.cursor = 'grab'; el.style.userSelect = ''; }
  }, []);

  const onCarouselTouchStart = useCallback((e: React.TouchEvent) => {
    const el = carouselRef.current;
    if (!el) return;
    carouselPausedRef.current = true;
    carouselDragRef.current = { isDragging: true, startX: e.touches[0].pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
  }, []);

  const onCarouselTouchMove = useCallback((e: React.TouchEvent) => {
    const drag = carouselDragRef.current;
    if (!drag.isDragging) return;
    const el = carouselRef.current;
    if (!el) return;
    const x = e.touches[0].pageX - el.offsetLeft;
    const walk = (x - drag.startX) * 1.5;
    el.scrollLeft = drag.scrollLeft - walk;
  }, []);

  const onCarouselTouchEnd = useCallback(() => {
    carouselDragRef.current.isDragging = false;
    carouselPausedRef.current = false;
  }, []);

  const { t, lang } = useTranslation();

  // Resolve Gmail OAuth token when user is available
  useEffect(() => {
    if (isUserLoading || !user) { setAuthChecked(!isUserLoading); return; }

    // Check for OAuth callback redirect
    const params = new URLSearchParams(window.location.search);
    const rt = params.get("rt");
    if (rt) {
      // Save the token to Firestore (same pattern as settings page)
      import("firebase/firestore").then(async ({ doc: fsDoc, setDoc }) => {
        const { initializeFirebase } = await import("@/firebase");
        const { firestore } = initializeFirebase();
        await setDoc(fsDoc(firestore, "users", user.uid), {
          gmailOAuth_campaigning: { refreshToken: rt, connectedAt: new Date().toISOString() },
        }, { merge: true });
        setRefreshTokenValue(rt);
        window.history.replaceState({}, "", window.location.pathname);
        setAuthChecked(true);
      });
    } else {
      getRefreshToken(user.uid).then((token) => {
        setRefreshTokenValue(token);
        setAuthChecked(true);
      });
    }
  }, [user, isUserLoading]);

  const currentUid = user?.uid || null;
  const isGmailConnected = !!(currentUid && refreshTokenValue);

  if (selectedPlatform === "gmail") {
    return (
      <div className={`w-full h-full rounded-2xl overflow-hidden shadow-sm relative flex flex-col ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-[#fefdfb] border border-slate-200/80'}`} style={{ WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" } as React.CSSProperties}>
        <CampaignManager onBack={() => setSelectedPlatform(null)} focusCampaignId={focusCampaignId} onFocusHandled={() => setFocusCampaignId(null)} />
      </div>
    );
  }

  return (
    <div className={`-mx-4 -mb-4 md:-mx-10 md:-mb-10 w-full h-full overflow-y-auto pb-4 px-3 sm:px-4 md:px-8 animate-in fade-in duration-500 ${isDarkMode ? 'bg-slate-950' : 'bg-[#f5f1e8]'}`} style={{ WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" } as React.CSSProperties}>
      <div className="max-w-full px-6 md:px-14 mx-auto pt-6 pb-4 space-y-5">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Send className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {lang === 'es' ? 'Campa\u00f1as Ag\u00e9nticas' : 'Agentic Campaigning'}
              </h1>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {lang === 'es'
                  ? 'Crea, automatiza y rastrea campa\u00f1as multicanal impulsadas por IA.'
                  : 'Create, automate, and track AI-powered multi-channel campaigns.'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: lang === 'es' ? 'Campa\u00f1as Activas' : 'Active Campaigns', value: '\u2014' },
            { label: lang === 'es' ? 'Mensajes Enviados' : 'Messages Sent', value: '\u2014' },
            { label: lang === 'es' ? 'Tasa de Apertura' : 'Open Rate', value: '\u2014' },
            { label: lang === 'es' ? 'Tasa de Clics' : 'Click-Through Rate', value: '\u2014' },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl p-3 transition-shadow ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-[#fefdfb] border border-slate-200/80 shadow-sm'}`}>
              <p className={`text-[10px] font-semibold tracking-wider uppercase mb-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{stat.label}</p>
              <p className={`text-xl font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>{stat.value}</p>
              <p className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                {lang === 'es' ? 'Se completa con el uso' : 'Populates with usage'}
              </p>
            </div>
          ))}
        </div>

        {/* Platform Selection */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {lang === 'es' ? 'Selecciona una Plataforma' : 'Select a Platform'}
            </h2>
            <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200/60'}`} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {PLATFORMS.map((platform, index) => (
              <motion.button
                key={platform.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
                whileHover={platform.available ? { y: -3, scale: 1.015 } : {}}
                whileTap={platform.available ? { scale: 0.985 } : {}}
                onClick={() => {
                  if (!platform.available) return;
                  if (platform.route) {
                    router.push(platform.route);
                  } else {
                    setSelectedPlatform(platform.id);
                  }
                }}
                disabled={!platform.available}
                className={`group relative text-left border rounded-xl p-4 transition-colors duration-200 ${
                  platform.available
                    ? `${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:shadow-lg' : 'bg-[#fefdfb] border-slate-200/80 hover:border-indigo-200 hover:shadow-md'} cursor-pointer`
                    : `${isDarkMode ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/60 border-slate-100'} cursor-not-allowed`
                }`}
              >
                {/* Badge — "New" / "Beta" / "Coming Soon" */}
                {platform.badge ? (
                  <div className="absolute top-3 right-3">
                    <span className="text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 text-white shadow-sm">
                      {platform.badge}
                    </span>
                  </div>
                ) : !platform.available ? (
                  <div className="absolute top-3 right-3">
                    <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${isDarkMode ? 'text-slate-500 bg-slate-800' : 'text-slate-400 bg-slate-100'}`}>
                      {lang === 'es' ? 'Pr\u00f3ximamente' : 'Coming Soon'}
                    </span>
                  </div>
                ) : null}

                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${platform.gradient} flex items-center justify-center text-white mb-3 ${
                  platform.available ? 'shadow-sm group-hover:shadow-md group-hover:scale-105' : 'opacity-30'
                } transition-all`}>
                  {platform.icon}
                </div>
                <h3 className={`text-sm font-semibold mb-1 ${platform.available ? (isDarkMode ? 'text-slate-200' : 'text-slate-800') : (isDarkMode ? 'text-slate-600' : 'text-slate-400')}`}>{platform.name}</h3>
                <p className={`text-[11px] leading-relaxed ${platform.available ? (isDarkMode ? 'text-slate-400' : 'text-slate-500') : (isDarkMode ? 'text-slate-700' : 'text-slate-400')}`}>
                  {platform.description}
                </p>
                {platform.available && (
                  <div className={`flex items-center gap-1 mt-3 text-[11px] font-semibold ${
                    platform.id === 'instagram'
                      ? 'text-pink-500 group-hover:text-pink-400'
                      : isDarkMode ? 'text-indigo-400 group-hover:text-indigo-300' : 'text-indigo-600 group-hover:text-indigo-700'
                  }`}>
                    <span>{lang === 'es' ? 'Abrir' : 'Open'}</span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Active Campaigns ──────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Active Campaigns
            </h2>
            <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200/60'}`} />
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              {totalActiveTiles} total
            </span>
          </div>

          {totalActiveTiles === 0 ? (
            <div className={`rounded-xl p-6 text-center ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-[#fefdfb] border border-slate-200/80 shadow-sm'}`}>
              <CalendarDays className={`w-6 h-6 mx-auto mb-2 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
              <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>No active campaigns</p>
              <p className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Schedule posts from Gmail or Instagram to see them here.</p>
            </div>
          ) : shouldCarousel ? (
            /* ── Infinite auto-scrolling carousel ── */
            <div
              className="relative overflow-hidden"
              onMouseEnter={() => { carouselPausedRef.current = true; }}
              onMouseLeave={() => { if (!carouselDragRef.current.isDragging) carouselPausedRef.current = false; }}
            >
              {/* Fade edges */}
              <div className={`pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 ${isDarkMode ? 'bg-gradient-to-r from-slate-950 to-transparent' : 'bg-gradient-to-r from-white to-transparent'}`} />
              <div className={`pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 ${isDarkMode ? 'bg-gradient-to-l from-slate-950 to-transparent' : 'bg-gradient-to-l from-white to-transparent'}`} />

              <div
                ref={carouselRef}
                className="flex gap-3 overflow-x-hidden cursor-grab"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                onMouseDown={onCarouselMouseDown}
                onMouseMove={onCarouselMouseMove}
                onMouseUp={onCarouselMouseUp}
                onMouseLeave={onCarouselMouseUp}
                onTouchStart={onCarouselTouchStart}
                onTouchMove={onCarouselTouchMove}
                onTouchEnd={onCarouselTouchEnd}
              >
                {/* Render tiles twice for seamless infinite loop */}
                {[0, 1].map((setIdx) => (
                  <div key={setIdx} ref={setIdx === 0 ? carouselInnerRef : undefined} className="flex gap-3 shrink-0">
                    {/* Gmail Active Campaigns */}
                    {activeCampaigns.map((c) => (
                      <div
                        key={`${setIdx}-gmail-${c.id}`}
                        onClick={() => { if (!carouselDragRef.current.isDragging) { setFocusCampaignId(c.id); setSelectedPlatform('gmail'); } }}
                        className={`group rounded-xl border p-3 flex items-start gap-3 cursor-pointer transition-all hover:shadow-md shrink-0 w-[260px] ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-[#fefdfb] border-slate-200/80 hover:border-indigo-200'}`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{c.name}</p>
                          <p className={`text-[10px] truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{c.subject}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className={`text-[9px] font-semibold uppercase tracking-wider text-emerald-600`}>Active</span>
                            <span className={`text-[9px] ml-auto ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              {new Date(c.triggerAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Instagram Scheduled Posts */}
                    {igPosts.map((post) => (
                      <div
                        key={`${setIdx}-ig-${post.id}`}
                        onClick={() => { if (!carouselDragRef.current.isDragging) { setSelectedIGPost(post); setIgModalOpen(true); } }}
                        className={`group rounded-xl border p-3 flex items-start gap-3 cursor-pointer transition-all hover:shadow-md shrink-0 w-[260px] ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-[#fefdfb] border-slate-200/80 hover:border-pink-200'}`}
                      >
                        {post.mediaItemUrls[0] ? (
                          <img src={post.mediaItemUrls[0]} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center shrink-0">
                            <Instagram className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                            {stripHtml(post.caption).slice(0, 40) || 'Instagram Post'}
                            {stripHtml(post.caption).length > 40 ? '…' : ''}
                          </p>
                          <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {post.scheduledTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at {post.scheduledTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${igStatusColor(post.status)}`} />
                            <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                              post.status === 'published' ? 'text-emerald-600' :
                              post.status === 'failed' ? 'text-red-500' :
                              isDarkMode ? 'text-amber-400' : 'text-amber-600'
                            }`}>{igStatusLabel(post.status)}</span>
                            <span className={`text-[9px] font-medium ml-auto px-1.5 py-0.5 rounded-full ${isDarkMode ? 'bg-pink-500/10 text-pink-400' : 'bg-pink-50 text-pink-600'}`}>
                              Instagram
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── Normal grid for < 4 tiles ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Gmail Active Campaigns */}
              {activeCampaigns.map((c) => (
                <div
                  key={c.id}
                  onClick={() => { setFocusCampaignId(c.id); setSelectedPlatform('gmail'); }}
                  className={`group rounded-xl border p-3 flex items-start gap-3 cursor-pointer transition-all hover:shadow-md ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-[#fefdfb] border-slate-200/80 hover:border-indigo-200'}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{c.name}</p>
                    <p className={`text-[10px] truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{c.subject}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className={`text-[9px] font-semibold uppercase tracking-wider text-emerald-600`}>Active</span>
                      <span className={`text-[9px] ml-auto ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {new Date(c.triggerAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Instagram Scheduled Posts */}
              {igPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => { setSelectedIGPost(post); setIgModalOpen(true); }}
                  className={`group rounded-xl border p-3 flex items-start gap-3 cursor-pointer transition-all hover:shadow-md ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-[#fefdfb] border-slate-200/80 hover:border-pink-200'}`}
                >
                  {post.mediaItemUrls[0] ? (
                    <img src={post.mediaItemUrls[0]} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center shrink-0">
                      <Instagram className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                      {stripHtml(post.caption).slice(0, 40) || 'Instagram Post'}
                      {stripHtml(post.caption).length > 40 ? '…' : ''}
                    </p>
                    <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {post.scheduledTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at {post.scheduledTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${igStatusColor(post.status)}`} />
                      <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                        post.status === 'published' ? 'text-emerald-600' :
                        post.status === 'failed' ? 'text-red-500' :
                        isDarkMode ? 'text-amber-400' : 'text-amber-600'
                      }`}>{igStatusLabel(post.status)}</span>
                      <span className={`text-[9px] font-medium ml-auto px-1.5 py-0.5 rounded-full ${isDarkMode ? 'bg-pink-500/10 text-pink-400' : 'bg-pink-50 text-pink-600'}`}>
                        Instagram
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Campaign Calendar */}
        <div className={`rounded-xl max-w-[1575px] mx-auto ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-[#fefdfb] border border-slate-200 shadow-sm'}`}>
          <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            {/* Left: arrows + month name */}
            <div className="flex items-center gap-1">
              <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); setZoomMode('off'); setZoomStart(null); setZoomEnd(null); }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => { setCalMonth(new Date().getMonth()); setCalYear(new Date().getFullYear()); setZoomMode('off'); setZoomStart(null); setZoomEnd(null); }}
                className={`px-2 py-1 rounded-lg cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {new Date(calYear, calMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
              </button>
              <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); setZoomMode('off'); setZoomStart(null); setZoomEnd(null); }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {/* Right: zoom range button */}
            <div className="flex items-center gap-2">
              {zoomMode === 'picking-start' && (
                <span className={`text-[10px] font-medium ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Click a start date...</span>
              )}
              {zoomMode === 'picking-end' && (
                <span className={`text-[10px] font-medium ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Click an end date...</span>
              )}
              {zoomMode === 'zoomed' ? (
                <button onClick={() => { setZoomMode('off'); setZoomStart(null); setZoomEnd(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors border ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                  <Minimize2 className="w-3 h-3" /> Monthly View
                </button>
              ) : (
                <button onClick={() => { setZoomMode(zoomMode === 'off' ? 'picking-start' : 'off'); setZoomStart(null); setZoomEnd(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors border ${
                    zoomMode !== 'off'
                      ? (isDarkMode ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-indigo-400 bg-indigo-50 text-indigo-600')
                      : (isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')
                  }`}>
                  <Maximize2 className="w-3 h-3" /> Zoom Range
                </button>
              )}
            </div>
          </div>
          <div className="p-2">
            {zoomMode === 'zoomed' && zoomStart !== null && zoomEnd !== null ? (
              /* ── Zoomed View ── */
              <>
                <div className={`grid gap-px ${(zoomEnd - zoomStart + 1) <= 4 ? 'grid-cols-' + (zoomEnd - zoomStart + 1) : 'grid-cols-4'}`} style={{ gridTemplateColumns: `repeat(${Math.min(zoomEnd - zoomStart + 1, 7)}, 1fr)` }}>
                  {Array.from({ length: zoomEnd - zoomStart + 1 }, (_, i) => zoomStart + i).map(day => {
                    const date = new Date(calYear, calMonth, day);
                    const dayName = date.toLocaleString('default', { weekday: 'short' });
                    const today = new Date();
                    const isToday = today.getDate() === day && today.getMonth() === calMonth && today.getFullYear() === calYear;
                    return (
                      <div key={day} className={`min-h-[200px] p-3 border ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-[#fefdfb]'} rounded-lg`}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`text-[10px] font-semibold uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{dayName}</span>
                          <span className={`text-lg font-bold inline-flex items-center justify-center w-8 h-8 rounded-full ${
                            isToday ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-200' : 'text-slate-700'
                          }`}>{day}</span>
                        </div>
                        {/* Instagram Posts in zoomed view */}
                        {(() => {
                          const dayIGPosts = getIGPostsForDay(day);
                          if (dayIGPosts.length === 0) return <p className={`text-[10px] italic ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>No events</p>;
                          return dayIGPosts.map((post) => (
                            <Popover key={post.id}>
                              <PopoverTrigger asChild>
                                <button className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 truncate px-0.5 mb-1 w-full text-left">
                                  {post.mediaItemUrls[0] ? (
                                    <img src={post.mediaItemUrls[0]} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                                  ) : (
                                    <span className="w-6 h-6 rounded bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center shrink-0">
                                      <Instagram className="w-3 h-3 text-white" />
                                    </span>
                                  )}
                                  <span className={`w-[5px] h-[5px] rounded-full shrink-0 ${igStatusColor(post.status)}`} />
                                  <span className="text-[8px] truncate" style={{ color: '#e74694' }}>{stripHtml(post.caption).slice(0, 20) || 'Instagram Post'}</span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className={`w-64 p-0 overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : ''}`}>
                                {post.mediaItemUrls[0] && (
                                  <img src={post.mediaItemUrls[0]} alt="" className="w-full h-32 object-cover" />
                                )}
                                <div className="p-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${igStatusColor(post.status)}`} />
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{igStatusLabel(post.status)}</span>
                                    <span className={`ml-auto text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                      {post.scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                    {stripHtml(post.caption).slice(0, 80)}{stripHtml(post.caption).length > 80 ? '…' : ''}
                                  </p>
                                  <div className="flex gap-2 pt-1">
                                    <button onClick={() => { setSelectedIGPost(post); setIgModalOpen(true); }} className={`flex-1 text-[10px] font-semibold py-1.5 rounded-lg transition-colors cursor-pointer ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Edit Post</button>
                                    <button onClick={() => { setSelectedIGPost(post); setIgModalOpen(true); }} className={`flex-1 text-[10px] font-semibold py-1.5 rounded-lg transition-colors cursor-pointer ${isDarkMode ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30' : 'bg-pink-50 text-pink-600 hover:bg-pink-100'}`}>Reschedule</button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ));
                        })()}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              /* ── Monthly View ── */
              <>
                <div className="grid grid-cols-7 mb-1">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} className={`text-center text-[10px] font-semibold py-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {(() => {
                    const firstDay = new Date(calYear, calMonth, 1).getDay();
                    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                    const today = new Date();
                    const isToday = (day: number) => today.getDate() === day && today.getMonth() === calMonth && today.getFullYear() === calYear;
                    const isInRange = (day: number) => {
                      if (zoomMode === 'picking-end' && zoomStart !== null && hoverDay !== null) {
                        const lo = Math.min(zoomStart, hoverDay);
                        const hi = Math.max(zoomStart, hoverDay);
                        return day >= lo && day <= hi;
                      }
                      return false;
                    };
                    const cells: React.ReactElement[] = [];
                    for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} className={`h-[80px] md:h-[210px] border-r border-b border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`} />);

                    // Get campaign events for a given day
                    const getEventsForDay = (day: number): { campaign: Campaign; isMultiDay: boolean; isStart: boolean; isEnd: boolean; isMiddle: boolean }[] => {
                      const dayDate = new Date(calYear, calMonth, day);
                      const evts: { campaign: Campaign; isMultiDay: boolean; isStart: boolean; isEnd: boolean; isMiddle: boolean }[] = [];
                      for (const c of campaigns) {
                        if (c.status !== 'active' && c.status !== 'completed') continue;
                        const start = new Date(c.triggerAt);
                        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                        const end = c.endAt ? new Date(c.endAt) : null;
                        const endDay = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : null;
                        if (c.repeatDays === 0) {
                          if (startDay.getTime() === dayDate.getTime()) {
                            evts.push({ campaign: c, isMultiDay: false, isStart: true, isEnd: true, isMiddle: false });
                          }
                        } else {
                          const effectiveEnd = endDay || new Date(calYear, calMonth + 1, 0);
                          if (dayDate >= startDay && dayDate <= effectiveEnd) {
                            const isFirstDay = dayDate.getTime() === startDay.getTime();
                            const isLastDay = endDay ? dayDate.getTime() === endDay.getTime() : false;
                            if (c.repeatDays === 1) {
                              evts.push({ campaign: c, isMultiDay: true, isStart: isFirstDay, isEnd: isLastDay, isMiddle: !isFirstDay && !isLastDay });
                            } else {
                              const diffDays = Math.floor((dayDate.getTime() - startDay.getTime()) / 86400000);
                              if (diffDays % c.repeatDays === 0) {
                                evts.push({ campaign: c, isMultiDay: false, isStart: true, isEnd: true, isMiddle: false });
                              }
                            }
                          }
                        }
                      }
                      return evts;
                    };

                    for (let day = 1; day <= daysInMonth; day++) {
                      const clickable = zoomMode === 'picking-start' || zoomMode === 'picking-end';
                      const dayEvents = getEventsForDay(day);
                      cells.push(
                        <div key={day}
                          onClick={() => {
                            if (zoomMode === 'picking-start') {
                              setZoomStart(day);
                              setZoomEnd(null);
                              setHoverDay(null);
                              setZoomMode('picking-end');
                            } else if (zoomMode === 'picking-end' && zoomStart !== null) {
                              const end = Math.max(day, zoomStart);
                              const start = Math.min(day, zoomStart);
                              setZoomStart(start);
                              setZoomEnd(end);
                              setHoverDay(null);
                              setZoomMode('zoomed');
                            }
                          }}
                          onMouseEnter={() => { if (zoomMode === 'picking-end') setHoverDay(day); }}
                          onMouseLeave={() => { if (zoomMode === 'picking-end') setHoverDay(null); }}
                          className={`h-[80px] md:h-[210px] p-1 border-r border-b ${(firstDay + day - 1) < 7 ? 'border-t' : ''} relative transition-colors ${
                            isDarkMode ? 'border-slate-700' : 'border-slate-200'
                          } ${
                            clickable ? 'cursor-pointer ' + (isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-indigo-50') : ''
                          } ${
                            isInRange(day) ? (isDarkMode ? 'bg-indigo-900/20' : 'bg-indigo-50') : ''
                          } ${
                            zoomStart === day ? (isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-100') : ''
                          }`}>
                          <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                            isToday(day) ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-300' : 'text-slate-700'
                          }`}>{day}</span>
                          {/* Campaign events */}
                          <div className="mt-0.5 space-y-px overflow-hidden" style={{ maxHeight: '149px' }}>
                            {dayEvents.map((ev, ei) => {
                              const color = getCampaignColor(ev.campaign.id);
                              if (!ev.isMultiDay) {
                                return (
                                  <div key={ei} onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev.campaign); }}
                                    className="flex items-center gap-1 cursor-pointer hover:opacity-80 truncate px-0.5">
                                    <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ backgroundColor: color }} />
                                    <span className="text-[10px] truncate" style={{ color }}>{ev.campaign.name}</span>
                                  </div>
                                );
                              } else {
                                return (
                                  <div key={ei} onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev.campaign); }}
                                    className={`text-[10px] text-white font-medium truncate cursor-pointer hover:opacity-90 px-1 py-px ${
                                      ev.isStart ? 'rounded-l' : ''} ${ev.isEnd ? 'rounded-r' : ''}`}
                                    style={{
                                      backgroundColor: color,
                                      marginLeft: ev.isStart ? '0' : '-6px',
                                      marginRight: ev.isEnd ? '0' : '-6px',
                                      paddingLeft: ev.isStart ? '4px' : '2px',
                                    }}>
                                    {ev.isStart ? ev.campaign.name : ''}
                                  </div>
                                );
                              }
                            })}
                            {/* Instagram scheduled posts */}
                            {getIGPostsForDay(day).map((post) => (
                              <Popover key={`ig-${post.id}`}>
                                <PopoverTrigger asChild>
                                  <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 cursor-pointer hover:opacity-80 truncate px-0.5 w-full text-left">
                                    {post.mediaItemUrls[0] ? (
                                      <img src={post.mediaItemUrls[0]} alt="" className="w-4 h-4 rounded-sm object-cover shrink-0" />
                                    ) : (
                                      <span className="w-4 h-4 rounded-sm bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center shrink-0">
                                        <Instagram className="w-2.5 h-2.5 text-white" />
                                      </span>
                                    )}
                                    <span className={`w-[5px] h-[5px] rounded-full shrink-0 ${igStatusColor(post.status)}`} />
                                    <span className="text-[10px] truncate" style={{ color: '#e74694' }}>
                                      {stripHtml(post.caption).slice(0, 14) || 'IG Post'}
                                    </span>
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align="start" sideOffset={6} className={`w-64 p-0 overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : ''}`}>
                                  {post.mediaItemUrls[0] && (
                                    <img src={post.mediaItemUrls[0]} alt="" className="w-full h-32 object-cover" />
                                  )}
                                  <div className="p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full ${igStatusColor(post.status)}`} />
                                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{igStatusLabel(post.status)}</span>
                                      <span className={`ml-auto text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Post at {post.scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                      {stripHtml(post.caption).slice(0, 80)}{stripHtml(post.caption).length > 80 ? '…' : ''}
                                    </p>
                                    <div className="flex gap-2 pt-1">
                                      <button onClick={() => { setSelectedIGPost(post); setIgModalOpen(true); }} className={`flex-1 text-[10px] font-semibold py-1.5 rounded-lg transition-colors cursor-pointer ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Edit Post</button>
                                      <button onClick={() => { setSelectedIGPost(post); setIgModalOpen(true); }} className={`flex-1 text-[10px] font-semibold py-1.5 rounded-lg transition-colors cursor-pointer ${isDarkMode ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30' : 'bg-pink-50 text-pink-600 hover:bg-pink-100'}`}>Reschedule</button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return cells;
                  })()}
                </div>

                {/* Campaign Event Detail Popup */}
                {selectedEvent && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelectedEvent(null)}>
                    <div onClick={(e) => e.stopPropagation()} className={`rounded-2xl shadow-2xl p-6 ${selectedEvent.htmlContent ? 'max-w-2xl' : 'max-w-md'} w-full mx-4 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{selectedEvent.name}</h3>
                        <button onClick={() => setSelectedEvent(null)} className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                          <span className="text-lg">&times;</span>
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCampaignColor(selectedEvent.id) }} />
                          <span className={`text-xs font-semibold uppercase tracking-wider ${selectedEvent.status === 'active' ? 'text-emerald-600' : selectedEvent.status === 'paused' ? 'text-amber-600' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{selectedEvent.status}</span>
                        </div>
                        <div className={`text-sm space-y-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          <p><span className="font-semibold">Subject:</span> {selectedEvent.subject}</p>
                          <p><span className="font-semibold">Recipients:</span> {selectedEvent.recipients?.length || 0} contacts</p>
                          <p><span className="font-semibold">Starts:</span> {new Date(selectedEvent.triggerAt).toLocaleString()}</p>
                          {selectedEvent.endAt && <p><span className="font-semibold">Ends:</span> {new Date(selectedEvent.endAt).toLocaleString()}</p>}
                          <p><span className="font-semibold">Repeat:</span> {selectedEvent.repeatDays === 0 ? 'One-time' : selectedEvent.repeatDays === 1 ? 'Daily' : selectedEvent.repeatDays === 7 ? 'Weekly' : 'Monthly'}</p>
                          <p><span className="font-semibold">Sent:</span> {selectedEvent.sent || 0}</p>
                        </div>
                        {selectedEvent.htmlContent ? (
                          <div className="mt-3">
                            <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Email Preview</p>
                            <iframe
                              srcDoc={selectedEvent.htmlContent}
                              sandbox="allow-same-origin"
                              className={`w-full h-[300px] rounded-lg border ${isDarkMode ? 'border-slate-600' : 'border-slate-300'}`}
                              title="Email preview"
                            />
                          </div>
                        ) : selectedEvent.body ? (
                          <div className="mt-3">
                            <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Email Body</p>
                            <div className={`text-sm whitespace-pre-wrap rounded-lg p-3 border ${isDarkMode ? 'bg-slate-900 border-slate-600 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                              {selectedEvent.body}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Instagram Post Preview Modal ──────────────────────────────── */}
      <CalendarPreviewModal
        post={selectedIGPost}
        open={igModalOpen}
        onOpenChange={(open) => {
          setIgModalOpen(open);
          if (!open) setSelectedIGPost(null);
        }}
        isDark={isDarkMode}
      />
    </div>
  );
}
