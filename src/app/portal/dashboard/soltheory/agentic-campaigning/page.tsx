"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Mail, MessageSquare, Send, ChevronRight, ChevronLeft,
  Search, Star, StarOff, Inbox, Archive, Trash2, RefreshCw,
  Clock, Paperclip, Reply, ReplyAll, Forward,
  ArrowLeft, Pen, X, Plus, Filter, Check, Zap, CalendarDays, Maximize2, Minimize2,
  Phone, Hash, Globe, Link2, Loader2, ChevronUp, LogOut, UserPlus, Settings,
} from "lucide-react";
import CampaignManager from "@/components/campaigning/CampaignManager";
import AIComposeAssist from "@/components/campaigning/AIComposeAssist";
import SmartReply from "@/components/campaigning/SmartReply";
import { useUser, useFirestore } from "@/firebase/provider";
import { useTranslation } from "@/lib/i18n";
import { getRefreshToken, fetchEmails, sendEmail as gmailSend, deleteGmailEmail, getGmailConnectUrl, type GmailMessage } from "@/lib/gmail-api";

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
}

const PLATFORMS: Platform[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Crea campañas de goteo, programa envíos y rastrea interacción con horarios optimizados por IA.",
    icon: <Mail className="w-6 h-6" />,
    gradient: "from-red-500 to-rose-600",
    available: true,
  },
  {
    id: "outlook",
    name: "Outlook",
    description: "Campañas de correo empresarial con integración de Microsoft 365 y sincronización de calendario.",
    icon: <Mail className="w-6 h-6" />,
    gradient: "from-blue-500 to-blue-700",
    available: false,
  },
  {
    id: "sms",
    name: "SMS",
    description: "Secuencias automatizadas de mensajes de texto con seguimiento de entrega y gestión de exclusión.",
    icon: <Phone className="w-6 h-6" />,
    gradient: "from-emerald-500 to-green-700",
    available: false,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Mensajería automatizada en Slack para campañas internas de equipo y notificaciones de canal.",
    icon: <Hash className="w-6 h-6" />,
    gradient: "from-purple-500 to-violet-700",
    available: false,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Campañas de mensajería empresarial con soporte de medios enriquecidos y confirmaciones de lectura.",
    icon: <MessageSquare className="w-6 h-6" />,
    gradient: "from-green-500 to-teal-600",
    available: false,
  },
  {
    id: "google-services",
    name: "Google Services",
    description: "Aprovecha Google Ads, Analytics y Search Console para información de campañas multicanal.",
    icon: <Globe className="w-6 h-6" />,
    gradient: "from-amber-500 to-orange-600",
    available: false,
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
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200/80 bg-white shrink-0">
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
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-white shrink-0">
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
        <div className="w-48 border-r border-slate-200/80 bg-slate-50/30 flex flex-col py-2.5 shrink-0">
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
          <div className="flex-1 flex flex-col bg-white overflow-y-auto">
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
          <div className="flex-1 flex flex-col bg-white">
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
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function AgenticCampaigningPage() {
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
  useEffect(() => {
    const saved = localStorage.getItem('insight_theme');
    if (saved === 'dark') setIsDarkMode(true);
    const handler = (e: StorageEvent) => {
      if (e.key === 'insight_theme') setIsDarkMode(e.newValue === 'dark');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
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
      <div className={`w-full h-full rounded-2xl overflow-hidden shadow-sm relative flex flex-col ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200/80'}`} style={{ WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" } as React.CSSProperties}>
        <CampaignManager onBack={() => setSelectedPlatform(null)} />
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-y-auto pb-10 px-3 sm:px-4 md:px-8 animate-in fade-in duration-500 ${isDarkMode ? 'bg-slate-950' : ''}`} style={{ WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" } as React.CSSProperties}>
      <div className="max-w-full px-4 md:px-10 mx-auto py-8 space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
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
            <div key={stat.label} className={`rounded-xl p-5 transition-shadow ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200/80 shadow-sm'}`}>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                onClick={() => platform.available && setSelectedPlatform(platform.id)}
                disabled={!platform.available}
                className={`group relative text-left border rounded-xl p-6 transition-all duration-200 ${
                  platform.available
                    ? `${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:shadow-lg' : 'bg-white border-slate-200/80 hover:border-indigo-200 hover:shadow-md'} cursor-pointer`
                    : `${isDarkMode ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/60 border-slate-100'} cursor-not-allowed`
                }`}
              >
                {!platform.available && (
                  <div className="absolute top-3 right-3">
                    <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${isDarkMode ? 'text-slate-500 bg-slate-800' : 'text-slate-400 bg-slate-100'}`}>
                      {lang === 'es' ? 'Pr\u00f3ximamente' : 'Coming Soon'}
                    </span>
                  </div>
                )}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${platform.gradient} flex items-center justify-center text-white mb-3 ${
                  platform.available ? 'shadow-sm group-hover:shadow-md group-hover:scale-105' : 'opacity-30'
                } transition-all`}>
                  {platform.icon}
                </div>
                <h3 className={`text-sm font-semibold mb-1 ${platform.available ? (isDarkMode ? 'text-slate-200' : 'text-slate-800') : (isDarkMode ? 'text-slate-600' : 'text-slate-400')}`}>{platform.name}</h3>
                <p className={`text-[11px] leading-relaxed ${platform.available ? (isDarkMode ? 'text-slate-400' : 'text-slate-500') : (isDarkMode ? 'text-slate-700' : 'text-slate-400')}`}>
                  {lang === 'es' ? platform.description : (
                    platform.id === 'gmail' ? 'Create drip campaigns, schedule sends, and track engagement with AI-optimized timing.' :
                    platform.id === 'outlook' ? 'Enterprise email campaigns with Microsoft 365 integration and calendar sync.' :
                    platform.id === 'sms' ? 'Automated text message sequences with delivery tracking and opt-out management.' :
                    platform.id === 'slack' ? 'Automated Slack messaging for internal team campaigns and channel notifications.' :
                    platform.id === 'whatsapp' ? 'Business messaging campaigns with rich media support and read receipts.' :
                    'Leverage Google Ads, Analytics, and Search Console for cross-channel campaign insights.'
                  )}
                </p>
                {platform.available && (
                  <div className={`flex items-center gap-1 mt-3 text-[11px] font-semibold ${isDarkMode ? 'text-indigo-400 group-hover:text-indigo-300' : 'text-indigo-600 group-hover:text-indigo-700'}`}>
                    <span>{lang === 'es' ? 'Abrir' : 'Open'}</span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Campaign Calendar */}
        <div className={`rounded-xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200 shadow-sm'}`}>
          <div className={`flex items-center justify-between px-5 py-3.5 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
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
          <div className="p-4">
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
                      <div key={day} className={`min-h-[200px] p-3 border ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white'} rounded-lg`}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`text-[10px] font-semibold uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{dayName}</span>
                          <span className={`text-lg font-bold inline-flex items-center justify-center w-8 h-8 rounded-full ${
                            isToday ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-200' : 'text-slate-700'
                          }`}>{day}</span>
                        </div>
                        <p className={`text-[10px] italic ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>No events</p>
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
                    <div key={d} className={`text-center text-[10px] font-semibold py-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {(() => {
                    const firstDay = new Date(calYear, calMonth, 1).getDay();
                    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                    const today = new Date();
                    const isToday = (day: number) => today.getDate() === day && today.getMonth() === calMonth && today.getFullYear() === calYear;
                    const isInRange = (day: number) => {
                      if (zoomMode === 'picking-end' && zoomStart !== null) return day >= zoomStart && day <= (zoomEnd || day);
                      return false;
                    };
                    const cells: React.ReactElement[] = [];
                    for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} className={`h-[88px] border-r border-b border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`} />);
                    for (let day = 1; day <= daysInMonth; day++) {
                      const clickable = zoomMode === 'picking-start' || zoomMode === 'picking-end';
                      cells.push(
                        <div key={day}
                          onClick={() => {
                            if (zoomMode === 'picking-start') {
                              setZoomStart(day);
                              setZoomEnd(null);
                              setZoomMode('picking-end');
                            } else if (zoomMode === 'picking-end' && zoomStart !== null) {
                              const end = day >= zoomStart ? day : zoomStart;
                              const start = day < zoomStart ? day : zoomStart;
                              setZoomStart(start);
                              setZoomEnd(end);
                              setZoomMode('zoomed');
                            }
                          }}
                          className={`h-[88px] p-1.5 border-r border-b ${(firstDay + day - 1) < 7 ? 'border-t' : ''} relative transition-colors ${
                            isDarkMode ? 'border-slate-700' : 'border-slate-200'
                          } ${
                            clickable ? 'cursor-pointer ' + (isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-indigo-50') : ''
                          } ${
                            isInRange(day) ? (isDarkMode ? 'bg-indigo-900/20' : 'bg-indigo-50') : ''
                          } ${
                            zoomStart === day ? (isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-100') : ''
                          }`}>
                          <span className={`text-[11px] font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                            isToday(day) ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-300' : 'text-slate-700'
                          }`}>{day}</span>
                        </div>
                      );
                    }
                    return cells;
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
