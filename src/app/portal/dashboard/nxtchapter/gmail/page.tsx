"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Mail, Send, Search, Star, StarOff, Inbox, Archive, Trash2, RefreshCw,
  Paperclip, Reply, ReplyAll, Forward,
  ArrowLeft, Pen, X, Filter, Check, Loader2, UserPlus, MailOpen,
} from "lucide-react";
import AIComposeAssist from "@/components/campaigning/AIComposeAssist";
import SmartReply from "@/components/campaigning/SmartReply";
import { GmailAIPanel } from "@/components/portal/GmailAIPanel";
import { useUser, useFirestore } from "@/firebase/provider";
import { collection, query, onSnapshot } from "firebase/firestore";
import { getRefreshToken, fetchEmails, sendEmail as gmailSend, getGmailConnectUrl, type GmailMessage } from "@/lib/gmail-api";

/* ═══════════════════════════════════════════════════════════════
   TYPES
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

/* ═══════════════════════════════════════════════════════════════
   GMAIL VIEW
   ═══════════════════════════════════════════════════════════════ */

function GmailView({ uid, refreshToken, userEmail, userName, onConnectAccount }: { uid?: string; refreshToken?: string; userEmail?: string; userName?: string; onConnectAccount?: () => void }) {
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
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [highlightedEmailIds, setHighlightedEmailIds] = useState<string[]>([]);
  const [aiPanelWidth, setAiPanelWidth] = useState(380);
  const [contacts, setContacts] = useState<{ name: string; email: string; aliases?: string }[]>([]);
  const [emailSelectMode, setEmailSelectMode] = useState(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const isConnected = !!(uid && refreshToken);
  const displayInitials = (userName || userEmail || "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const displayName = userName || userEmail?.split("@")[0] || "User";

  const folderToGmail: Record<string, string> = {
    inbox: "INBOX", starred: "STARRED", sent: "SENT",
    drafts: "DRAFT", archive: "ARCHIVE", trash: "TRASH",
  };

  /* ── Fetch contacts from Firestore for AI name resolution ── */
  const firestore = useFirestore();
  useEffect(() => {
    if (!firestore || !uid) return;

    const q = query(collection(firestore, `users/${uid}/contacts`));
    const unsub = onSnapshot(q, (snap) => {
      const fetched: { name: string; email: string; aliases?: string }[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.email) {
          fetched.push({
            name: data.name || "",
            email: data.email,
            aliases: data.aliases || undefined,
          });
        }
      });
      setContacts(fetched);
    });

    return () => unsub();
  }, [firestore, uid]);

  useEffect(() => {
    if (!isConnected) return;
    const load = async () => {
      setLoadingEmails(true);
      const gmailFolder = folderToGmail[activeFolder] || "INBOX";
      const data = await fetchEmails(uid!, refreshToken!, gmailFolder);
      const mapped: EmailMessage[] = data.map((e) => {
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
          folder: activeFolder === "unread" ? "inbox" : activeFolder,
        };
      });
      setEmails(mapped);
      setLoadingEmails(false);
    };
    load();
  }, [activeFolder, uid, refreshToken, isConnected]);

  const filteredEmails = emails.filter((e) => {
    const inFolder = activeFolder === "unread"
      ? !e.read
      : activeFolder === "starred"
        ? e.starred
        : e.folder === activeFolder;
    const matchSearch = !searchQuery ||
      e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.preview.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = !filterUnread || !e.read;
    return inFolder && matchSearch && matchFilter;
  });

  const folderCounts: Record<string, number> = {
    inbox: emails.filter((e) => e.folder === "inbox" && !e.read).length,
    unread: emails.filter((e) => !e.read).length,
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

  const markAsRead = useCallback((id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    setEmails((prev) => prev.map((em) => (em.id === id ? { ...em, read: true } : em)));
    if (uid && refreshToken) {
      fetch("/api/gmail-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_action",
          actionPayload: { type: "mark_read", emailIds: [id] },
          uid,
          refreshToken,
        }),
      }).catch(() => { /* non-blocking */ });
    }
  }, [uid, refreshToken]);

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

  const openCompose = useCallback((mode: ComposeMode, replyEmail?: EmailMessage) => {
    if (mode === "new") {
      setCompose({ to: "", cc: "", subject: "", body: "", mode: "new" });
    } else if (mode === "reply" && replyEmail) {
      setCompose({
        to: replyEmail.fromEmail, cc: "",
        subject: `Re: ${replyEmail.subject.replace(/^Re:\s*/i, "")}`,
        body: `\n\n──────────\nOn ${replyEmail.date} at ${replyEmail.time}, ${replyEmail.from} wrote:\n> ${replyEmail.preview}`,
        mode: "reply", replyToId: replyEmail.id,
      });
    } else if (mode === "replyAll" && replyEmail) {
      setCompose({
        to: replyEmail.fromEmail,
        cc: replyEmail.toEmail !== "me@soltheory.org" ? replyEmail.toEmail : "",
        subject: `Re: ${replyEmail.subject.replace(/^Re:\s*/i, "")}`,
        body: `\n\n──────────\nOn ${replyEmail.date} at ${replyEmail.time}, ${replyEmail.from} wrote:\n> ${replyEmail.preview}`,
        mode: "replyAll", replyToId: replyEmail.id,
      });
    } else if (mode === "forward" && replyEmail) {
      setCompose({
        to: "", cc: "",
        subject: `Fwd: ${replyEmail.subject.replace(/^Fwd:\s*/i, "")}`,
        body: `\n\n──────── Forwarded message ────────\nFrom: ${replyEmail.from} <${replyEmail.fromEmail}>\nDate: ${replyEmail.date} at ${replyEmail.time}\nSubject: ${replyEmail.subject}\n\n${replyEmail.preview}`,
        mode: "forward", replyToId: replyEmail.id,
      });
    }
    setComposeOpen(true);
  }, []);

  const handleSend = useCallback(async () => {
    if (!compose.to.trim() || !compose.subject.trim()) return;
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
      } else {
        alert("Failed to send: " + (result.error || "Unknown error"));
      }
      return;
    }
    const { date, time } = formatNow();
    const newEmail: EmailMessage = {
      id: nextId(), from: "You", fromEmail: "me@soltheory.org",
      to: compose.to.split(",")[0]?.trim() || compose.to, toEmail: compose.to.trim(),
      subject: compose.subject,
      preview: compose.body.split("\n").find((l) => l.trim() && !l.startsWith("─") && !l.startsWith(">") && !l.startsWith("On ") && !l.startsWith("From:") && !l.startsWith("Date:") && !l.startsWith("Subject:"))?.trim() || compose.body.slice(0, 100),
      body: `<p>${compose.body.replace(/\n/g, "<br/>")}</p>`,
      date, time, read: true, starred: false, hasAttachment: false, folder: "sent",
    };
    setEmails((prev) => [newEmail, ...prev]);
    setComposeOpen(false);
    setCompose({ to: "", cc: "", subject: "", body: "", mode: "new" });
    setSendSuccess(true);
    setTimeout(() => setSendSuccess(false), 2500);
  }, [compose, isConnected, uid, refreshToken]);

  const handleSaveDraft = useCallback(() => {
    if (!compose.subject.trim() && !compose.body.trim()) { setComposeOpen(false); return; }
    const { date, time } = formatNow();
    const draft: EmailMessage = {
      id: nextId(), from: "You (Draft)", fromEmail: "me@soltheory.org",
      to: compose.to || "", toEmail: compose.to || "",
      subject: compose.subject || "(no subject)",
      preview: compose.body.slice(0, 100) || "(empty draft)",
      body: `<p>${compose.body.replace(/\n/g, "<br/>")}</p>`,
      date, time, read: true, starred: false, hasAttachment: false, folder: "drafts",
    };
    setEmails((prev) => [draft, ...prev]);
    setComposeOpen(false);
    setCompose({ to: "", cc: "", subject: "", body: "", mode: "new" });
  }, [compose]);

  const folders = [
    { id: "inbox", label: "Inbox", icon: Inbox },
    { id: "unread", label: "Unread", icon: MailOpen },
    { id: "starred", label: "Starred", icon: Star },
    { id: "sent", label: "Sent", icon: Send },
    { id: "drafts", label: "Drafts", icon: Pen },
    { id: "archive", label: "Archive", icon: Archive },
    { id: "trash", label: "Trash", icon: Trash2 },
  ];

  const emptyMessages: Record<string, { title: string; desc: string }> = {
    inbox: { title: "Your inbox is empty", desc: "When you connect your Gmail account, emails will appear here." },
    unread: { title: "All caught up!", desc: "You have no unread emails. Nice work!" },
    starred: { title: "No starred emails", desc: "Star important emails to find them here quickly." },
    sent: { title: "No sent emails", desc: "Emails you send will appear here." },
    drafts: { title: "No drafts", desc: "Unsent messages will be saved here as drafts." },
    archive: { title: "Archive is empty", desc: "Archived emails are stored here for safekeeping." },
    trash: { title: "Trash is empty", desc: "Deleted emails will appear here for 30 days." },
  };

  return (
    <div className="flex h-full" style={{ WebkitFontSmoothing: "antialiased" } as React.CSSProperties}>
    <div className="flex flex-col flex-1 min-w-0 relative">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200/80 bg-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm">
            <Mail className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[14px] font-semibold text-slate-800">Gmail</span>
        </div>
        <div className="flex-1 max-w-lg mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mail..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[13px] outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all placeholder:text-slate-400" />
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
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{displayInitials}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-slate-700 truncate">{displayName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{userEmail}</p>
                      </div>
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    </div>
                  )}
                  <button onClick={() => { onConnectAccount?.(); setAccountMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0"><UserPlus className="w-3.5 h-3.5" /></div>
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
                    activeFolder === f.id ? "bg-slate-200/60 text-slate-800" : "text-slate-500 hover:bg-slate-100/60 hover:text-slate-700"
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
          <div className="flex-1 flex flex-col bg-white overflow-y-auto">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 shrink-0">
              <button onClick={() => setSelectedEmail(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer" title="Back to list">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 ml-auto">
                <button onClick={() => openCompose("reply", selectedEmail)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer" title="Reply"><Reply className="w-3.5 h-3.5" /></button>
                <button onClick={() => openCompose("replyAll", selectedEmail)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer" title="Reply All"><ReplyAll className="w-3.5 h-3.5" /></button>
                <button onClick={() => openCompose("forward", selectedEmail)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer" title="Forward"><Forward className="w-3.5 h-3.5" /></button>
                <div className="w-px h-4 bg-slate-200 mx-0.5" />
                <button onClick={() => archiveEmail(selectedEmail.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer" title="Archive"><Archive className="w-3.5 h-3.5" /></button>
                <button onClick={() => deleteEmail(selectedEmail.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 cursor-pointer" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
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

              <SmartReply
                emailBody={selectedEmail.body}
                emailSubject={selectedEmail.subject}
                emailFrom={selectedEmail.from}
                onSelectReply={(reply) => {
                  openCompose("reply", selectedEmail);
                  setTimeout(() => setCompose((prev) => ({ ...prev, body: reply + prev.body })), 50);
                }}
              />

              <div className="mt-4 pt-3 border-t border-slate-100">
                <button onClick={() => openCompose("reply", selectedEmail)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-[12px] text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer">
                  <Reply className="w-3.5 h-3.5" /> Reply
                </button>
              </div>
            </div>
          </div>
        ) : (
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
                  <p className="text-[14px] font-semibold text-slate-400 mb-1">{emptyMessages[activeFolder]?.title || "Nothing here"}</p>
                  <p className="text-[12px] text-slate-400 max-w-xs leading-relaxed">{emptyMessages[activeFolder]?.desc || "No emails in this folder."}</p>
                </div>
              ) : (
                filteredEmails.map((email) => {
                  const isHighlighted = highlightedEmailIds.includes(email.id);
                  const isSelected = emailSelectMode && selectedEmailIds.has(email.id);
                  return (
                  <div key={email.id} onClick={() => {
                    if (emailSelectMode) {
                      setSelectedEmailIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(email.id)) next.delete(email.id);
                        else next.add(email.id);
                        return next;
                      });
                    } else {
                      openEmail(email);
                    }
                  }}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100/80 cursor-pointer transition-all duration-300 group ${!email.read ? "bg-blue-50/20" : "opacity-50"} hover:bg-slate-50 ${isHighlighted ? "ring-2 ring-blue-400/60 bg-blue-50/40 shadow-sm" : ""} ${isSelected ? "!opacity-100 ring-2 ring-purple-400/60 bg-purple-50/40 shadow-sm" : ""}`}>
                    {emailSelectMode && (
                      <div className={`w-4 h-4 rounded-[5px] border-2 shrink-0 flex items-center justify-center transition-colors ${
                        isSelected ? "bg-purple-500 border-purple-500" : "border-slate-300"
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                    )}
                    <button onClick={(ev) => toggleStar(email.id, ev)} className="shrink-0 cursor-pointer">
                      {email.starred ? <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> : <StarOff className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />}
                    </button>
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold text-[9px] shrink-0">
                      {email.from.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[12px] truncate ${!email.read ? "font-semibold text-slate-800" : "font-normal text-slate-400"}`}>{email.from}</span>
                        {email.folder === "sent" && <span className="text-[10px] text-slate-400 shrink-0">→ {email.to || email.toEmail}</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[12px] truncate ${!email.read ? "font-medium text-slate-700" : "text-slate-400"}`}>{email.subject}</span>
                        <span className="text-[11px] text-slate-400 truncate flex-1">— {email.preview}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!email.read && (
                        <button
                          onClick={(ev) => markAsRead(email.id, ev)}
                          className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-blue-50 text-slate-400 hover:text-blue-500 transition-all cursor-pointer"
                          title="Mark as read"
                        >
                          <MailOpen className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {email.hasAttachment && <Paperclip className="w-3 h-3 text-slate-300" />}
                      <span className={`text-[10px] whitespace-nowrap ${!email.read ? "font-semibold text-slate-600" : "text-slate-400"}`}>{email.date}</span>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {composeOpen && (
        <div className="absolute bottom-4 left-4 w-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white">
            <span className="text-[13px] font-semibold">
              {compose.mode === "reply" ? "Reply" : compose.mode === "replyAll" ? "Reply All" : compose.mode === "forward" ? "Forward" : "New Message"}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={handleSaveDraft} className="text-[10px] px-2 py-1 rounded-md hover:bg-slate-700 text-slate-300 cursor-pointer" title="Save as draft">Save Draft</button>
              <button onClick={() => { setComposeOpen(false); setCompose({ to: "", cc: "", subject: "", body: "", mode: "new" }); }} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-slate-700 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-[12px] text-slate-400 w-8 shrink-0">To</span>
              <input type="text" placeholder="Recipients" value={compose.to} onChange={(e) => setCompose((s) => ({ ...s, to: e.target.value }))} className="flex-1 text-[13px] outline-none text-slate-700 placeholder:text-slate-300" />
            </div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-[12px] text-slate-400 w-8 shrink-0">Cc</span>
              <input type="text" value={compose.cc} onChange={(e) => setCompose((s) => ({ ...s, cc: e.target.value }))} className="flex-1 text-[13px] outline-none text-slate-700 placeholder:text-slate-300" />
            </div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-[12px] text-slate-400 w-8 shrink-0">Subj</span>
              <input type="text" placeholder="Subject" value={compose.subject} onChange={(e) => setCompose((s) => ({ ...s, subject: e.target.value }))} className="flex-1 text-[13px] outline-none text-slate-700 placeholder:text-slate-300" />
            </div>
            <textarea ref={bodyRef} placeholder="Write your message..." value={compose.body} onChange={(e) => setCompose((s) => ({ ...s, body: e.target.value }))}
              className="w-full h-44 text-[13px] outline-none resize-none text-slate-600 leading-relaxed p-1 placeholder:text-slate-300" />
          </div>
          <AIComposeAssist
            subject={compose.subject}
            body={compose.body}
            onApplySubject={(s) => setCompose((prev) => ({ ...prev, subject: s }))}
            onApplyBody={(b) => setCompose((prev) => ({ ...prev, body: b }))}
            onRewriteBody={(b) => setCompose((prev) => ({ ...prev, body: b }))}
          />
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button onClick={handleSend} disabled={!compose.to.trim() || !compose.subject.trim() || sendingEmail}
                className={`px-5 py-2 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  compose.to.trim() && compose.subject.trim() && !sendingEmail ? "bg-slate-800 text-white hover:bg-slate-900" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}>
                {sendingEmail ? (<><Loader2 className="w-3 h-3 animate-spin" /> Sending...</>) : "Send"}
              </button>
              <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer" title="Attach file"><Paperclip className="w-4 h-4" /></button>
            </div>
            <button onClick={() => { setComposeOpen(false); setCompose({ to: "", cc: "", subject: "", body: "", mode: "new" }); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 cursor-pointer" title="Discard">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>

      {/* ── AI Assistant Side Panel (inline) ── */}
      <GmailAIPanel
        isOpen={aiPanelOpen}
        onClose={() => { setAiPanelOpen(false); setHighlightedEmailIds([]); }}
        uid={uid}
        refreshToken={refreshToken}
        userEmail={userEmail}
        emailContext={emails.map((e) => ({ id: e.id, from: e.from, subject: e.subject, snippet: e.preview, read: e.read }))}
        contacts={contacts}
        onHighlightEmails={setHighlightedEmailIds}
        onActionExecuted={() => {
          const gmailFolder = folderToGmail[activeFolder] || "INBOX";
          setLoadingEmails(true);
          fetchEmails(uid!, refreshToken!, gmailFolder).then((data) => {
            const mapped: EmailMessage[] = data.map((e) => {
              const fromMatch = e.from.match(/^(.*?)\s*<(.+?)>$/);
              const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : e.from;
              const fromEmail = fromMatch ? fromMatch[2] : e.from;
              const toMatch = e.to.match(/^(.*?)\s*<(.+?)>$/);
              const toName = toMatch ? toMatch[1].replace(/"/g, "").trim() : e.to;
              const toEmail = toMatch ? toMatch[2] : e.to;
              const dateObj = new Date(e.internalDate);
              const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              return {
                id: e.id, from: fromName || fromEmail, fromEmail,
                to: toName || toEmail, toEmail,
                subject: e.subject, preview: e.snippet || "",
                body: e.body,
                date: `${months[dateObj.getMonth()]} ${dateObj.getDate()}`,
                time: dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
                read: !(e.labelIds || []).includes("UNREAD"),
                starred: (e.labelIds || []).includes("STARRED"),
                hasAttachment: (e.attachments || []).length > 0,
                folder: activeFolder === "unread" ? "inbox" : activeFolder,
              };
            });
            setEmails(mapped);
            setLoadingEmails(false);
            setHighlightedEmailIds([]);
          });
        }}
        onOpenCompose={(to, subject, body) => {
          setCompose({ to, cc: "", subject, body, mode: "new" });
          setComposeOpen(true);
        }}
        onSwitchFolder={(folder) => setActiveFolder(folder)}
        emailSelectMode={emailSelectMode}
        selectedEmailCount={selectedEmailIds.size}
        selectedEmailDetails={Array.from(selectedEmailIds).map((id) => {
          const em = emails.find((e) => e.id === id);
          return em ? { id: em.id, from: em.from, subject: em.subject, snippet: em.preview } : null;
        }).filter(Boolean) as { id: string; from: string; subject: string; snippet: string }[]}
        onSelectModeToggle={(on) => {
          setEmailSelectMode(on);
          if (!on) setSelectedEmailIds(new Set());
        }}
        onMarkLocalAsRead={(ids) => {
          setEmails((prev) => prev.map((e) => ids.includes(e.id) ? { ...e, read: true } : e));
        }}
        panelWidth={aiPanelWidth}
        onWidthChange={setAiPanelWidth}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GMAIL PAGE
   ═══════════════════════════════════════════════════════════════ */

export default function GmailPage() {
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (isUserLoading || !user) { setAuthChecked(!isUserLoading); return; }

    const params = new URLSearchParams(window.location.search);
    const rt = params.get("rt");
    if (rt) {
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

  return (
    <div className="w-full h-full bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200/80 relative" style={{ WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" } as React.CSSProperties}>
      <GmailView
        uid={currentUid || undefined}
        refreshToken={refreshTokenValue || undefined}
        userEmail={user?.email || undefined}
        userName={user?.displayName || undefined}
        onConnectAccount={() => { if (currentUid) window.location.href = getGmailConnectUrl(currentUid); }}
      />
    </div>
  );
}
