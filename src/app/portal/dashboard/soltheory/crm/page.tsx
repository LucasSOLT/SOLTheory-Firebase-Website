"use client";

import CampaignCalendar from "@/components/crm/CampaignCalendar";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useUser, useFirestore } from "@/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { useCRMStore } from "@/stores/crm-store";
import type { Customer, Meeting, CrmNotification, Conversation, InboxMessage, InboxChannel, TicketStatus, ChatMessage } from "@/stores/crm-store";
import { ToastContainer } from "@/components/crm/Toast";
import { DashboardSkeleton, ContactsTableSkeleton, InboxSkeleton, AnalyticsSkeleton } from "@/components/crm/Skeletons";
import {
  Search, Plus, Bell, LayoutDashboard, Users, GitBranch, Inbox, BarChart3,
  UserPlus, Mail, ChevronDown, ChevronUp, Settings, Filter, Download, Brain,
  Phone, DollarSign, Activity, ArrowUpRight, MoreHorizontal, X,
  MessageCircle, PanelRightClose, PanelRightOpen, Send, Sparkles, Trash2,
  CheckSquare, Square, Tag, MailPlus, Calendar, Clock, ToggleLeft, ToggleRight,
  CalendarCheck, Eye, MessageSquare, Smartphone, Hash, Zap, SearchX,
  Menu, Palette, Link2, Edit3, Trash, Loader2, ImagePlus, PenTool, CalendarRange,
} from "lucide-react";
import { logActivity } from '@/lib/activity-logger';

type SortKey = "name" | "email" | "phone" | "tags" | "status";
type SortDir = "asc" | "desc";

const TAG_COLORS: Record<string, string> = {
  VIP: "bg-amber-50 text-amber-700 border-amber-200",
  Enterprise: "bg-purple-50 text-purple-700 border-purple-200",
  Inbound: "bg-sky-50 text-sky-700 border-sky-200",
  Referral: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "High-Value": "bg-rose-50 text-rose-700 border-rose-200",
};
const TAG_ROW_TINTS: Record<string, string> = {
  VIP: "bg-amber-50/40",
  Enterprise: "bg-purple-50/40",
  "High-Value": "bg-rose-50/40",
};
const STATUS_COLORS: Record<string, string> = {
  "Cold Lead": "bg-blue-50 text-blue-700 border-blue-200",
  "Warm Lead": "bg-orange-50 text-orange-700 border-orange-200",
  "Interested": "bg-purple-50 text-purple-700 border-purple-200",
  "Sale Completed": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

/* ─────────────────────────── NAV CONFIG ─────────────────────── */

const crmNavItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "campaigns", label: "Campaign Manager", icon: CalendarRange, special: true },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type CrmView = (typeof crmNavItems)[number]["id"];

/* ─────────────────────────── EMPTY STATES ────────────────────── */

function EmptyContacts({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
        <Users className="w-9 h-9 text-slate-300" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-1.5">No contacts yet</h3>
      <p className="text-sm text-slate-400 text-center max-w-sm mb-6 leading-relaxed">
        Add your first customer to start building relationships and tracking insights with AI.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/10 cursor-pointer"
      >
        <UserPlus className="w-4 h-4" />
        Add First Contact
      </button>
    </div>
  );
}

function EmptyPipeline() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
        <GitBranch className="w-9 h-9 text-slate-300" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-1.5">Pipeline is empty</h3>
      <p className="text-sm text-slate-400 text-center max-w-sm leading-relaxed">
        As you add contacts and move them through stages, your pipeline will populate here.
      </p>
    </div>
  );
}

function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
        <Mail className="w-9 h-9 text-slate-300" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-1.5">Inbox is clear</h3>
      <p className="text-sm text-slate-400 text-center max-w-sm leading-relaxed">
        Customer communications and AI-flagged follow-ups will appear here.
      </p>
    </div>
  );
}

function EmptyAnalytics() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
        <BarChart3 className="w-9 h-9 text-slate-300" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-1.5">No data to analyze</h3>
      <p className="text-sm text-slate-400 text-center max-w-sm leading-relaxed">
        Once customer data is flowing, revenue trends and engagement metrics will render here.
      </p>
    </div>
  );
}

/* ─────────────────────────── METRIC CARD ─────────────────────── */

function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 flex flex-col gap-3 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-slate-400" />
        </div>
      </div>
      <div>
        <span className="text-2xl font-bold text-slate-800 tracking-tight">{value}</span>
        <div className="flex items-center gap-1.5 mt-1">
          {trend && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              {trend}
            </span>
          )}
          <span className="text-xs text-slate-400">{subtext}</span>
        </div>
      </div>
    </div>
  );
}

export default function CRMPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  /* ─────────── ZUSTAND STORE ─────────── */
  const store = useCRMStore();
  const { customers, meetings, notifications, conversations, chatMessages, customTags, integrations,
    isLoading, isAddingContact, isDeducing, isSendingReply,
    initializeStore, teardown, addContact, updateStatus, deleteContact, bulkDelete, setCustomers,
    addMeeting, addNotification, markNotificationsRead,
    sendInboxReply: storeSendReply, updateTicketStatus, markConversationRead,
    addJarvisMessage, runDeduction,
    setCustomTags, setIntegrations, showToast } = store;

  /* ─────────── LOCAL UI STATE ─────────── */
  const [activeView, setActiveView] = useState<CrmView>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [editingTagIdx, setEditingTagIdx] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [contactSearch, setContactSearch] = useState("");
  const [contactsViewMode, setContactsViewMode] = useState<"table" | "pipeline">("table");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<string>("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFilterFrom, setDateFilterFrom] = useState("");
  const [dateFilterTo, setDateFilterTo] = useState("");
  const hasActiveFilters = !!tagFilter || !!statusFilter || !!dateFilterFrom || !!dateFilterTo;
  const clearAllFilters = () => { setTagFilter(""); setStatusFilter(""); setDateFilterFrom(""); setDateFilterTo(""); };
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  // Email Campaign v2 state
  const [emailTab, setEmailTab] = useState<"compose" | "preview">("compose");
  const [emailSignature, setEmailSignature] = useState<{
    signoff: string;
    name: string;
    role: string;
    company: string;
    phone: string;
    website: string;
    logoUrl?: string;
    useCursive?: boolean;
  } | null>(null);
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const [sigForm, setSigForm] = useState({ signoff: "Best regards", name: "", role: "", company: "", phone: "", website: "", logoUrl: "", useCursive: false });
  const [campaignDrafts, setCampaignDrafts] = useState<{id: string, subject: string, body: string, savedAt: string}[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Load signature from Firestore
  useEffect(() => {
    if (!user?.uid || !db) return;
    (async () => {
      const { doc: firestoreDoc, getDoc } = await import("firebase/firestore");
      const sigDoc = await getDoc(firestoreDoc(db, "users", user.uid, "settings", "emailSignature"));
      if (sigDoc.exists()) {
        setEmailSignature(sigDoc.data() as any);
        setSigForm(sigDoc.data() as any);
      } else {
        // Auto-fill with user display name
        setSigForm(f => ({ ...f, name: user.displayName || "" }));
      }
      // Load drafts
      const { collection, getDocs } = await import("firebase/firestore");
      const draftsSnap = await getDocs(collection(db, "users", user.uid, "emailDrafts"));
      const d: any[] = [];
      draftsSnap.forEach(doc => d.push({ id: doc.id, ...doc.data() }));
      d.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
      setCampaignDrafts(d);
    })();
  }, [user?.uid, db]);

  const saveSignature = async () => {
    if (!user?.uid || !db) return;
    const { doc: firestoreDoc, setDoc } = await import("firebase/firestore");
    await setDoc(firestoreDoc(db, "users", user.uid, "settings", "emailSignature"), sigForm);
    setEmailSignature(sigForm);
    setShowSignatureEditor(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) { alert("Image must be under 500KB"); return; }
    setIsUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = () => {
      setSigForm(f => ({ ...f, logoUrl: reader.result as string }));
      setIsUploadingLogo(false);
    };
    reader.readAsDataURL(file);
  };

  const saveDraft = async () => {
    if (!user?.uid || !db || !emailSubject.trim()) return;
    const { collection, addDoc } = await import("firebase/firestore");
    const ref = await addDoc(collection(db, "users", user.uid, "emailDrafts"), {
      subject: emailSubject,
      body: emailBody,
      savedAt: new Date().toISOString()
    });
    setCampaignDrafts(prev => [{ id: ref.id, subject: emailSubject, body: emailBody, savedAt: new Date().toISOString() }, ...prev]);
  };

  const loadDraft = (draft: typeof campaignDrafts[0]) => {
    setEmailSubject(draft.subject);
    setEmailBody(draft.body);
    setShowDrafts(false);
  };

  const deleteDraft = async (draftId: string) => {
    if (!user?.uid || !db) return;
    const { doc: firestoreDoc, deleteDoc } = await import("firebase/firestore");
    await deleteDoc(firestoreDoc(db, "users", user.uid, "emailDrafts", draftId));
    setCampaignDrafts(prev => prev.filter(d => d.id !== draftId));
  };

  const renderSignatureHtml = () => {
    if (!emailSignature) return "";
    const parts = [];
    if (emailSignature.logoUrl) parts.push(`<img src="${emailSignature.logoUrl}" alt="Logo" style="max-height:48px;max-width:160px;margin-bottom:8px;display:block;" />`);
    if (emailSignature.signoff) parts.push(`<p style="margin:0;">${emailSignature.signoff},</p>`);
    if (emailSignature.name) {
      if (emailSignature.useCursive) {
        // Gmail blocks custom fonts + data URIs, so use bold italic as the email-safe equivalent
        parts.push(`<p style="font-weight:bold;font-style:italic;font-size:18px;margin:4px 0 0 0;color:#1e293b;">${emailSignature.name}</p>`);
      } else {
        parts.push(`<p style="font-weight:bold;margin:4px 0 0 0;">${emailSignature.name}</p>`);
      }
    }
    if (emailSignature.role || emailSignature.company) parts.push(`<p style="margin:0;color:#6b7280;font-size:13px;">${[emailSignature.role, emailSignature.company].filter(Boolean).join(" | ")}</p>`);
    const contactParts = [];
    if (emailSignature.phone) contactParts.push(emailSignature.phone);
    if (emailSignature.website) contactParts.push(emailSignature.website);
    if (contactParts.length > 0) parts.push(`<p style="margin:2px 0 0 0;color:#9ca3af;font-size:12px;">${contactParts.join(" · ")}</p>`);
    return parts.length > 0 ? `<br/><div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:16px;">${parts.join("")}</div>` : "";
  };
  const [showNotifications, setShowNotifications] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<string | null>(null);
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingSyncGoogle, setMeetingSyncGoogle] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const handleSendCampaign = async () => {
    if (!user?.uid) return;
    const recipientsWithEmails = selectedCustomers.filter(c => c.email);
    if (recipientsWithEmails.length === 0) {
      showToast("No selected contacts have email addresses.", "error");
      return;
    }
    
    const isConfirmed = window.confirm(`Are you sure you want to permanently send this email campaign to ${recipientsWithEmails.length} recipient${recipientsWithEmails.length === 1 ? '' : 's'}?`);
    if (!isConfirmed) return;

    setIsSendingCampaign(true);
    
    try {
      // Fetch refresh token from Firestore (same pattern as chat route)
      let rToken = null;
      if (db) {
        const { doc: firestoreDoc, getDoc } = await import("firebase/firestore");
        const userDoc = await getDoc(firestoreDoc(db, "users", user.uid));
        const data = userDoc.data();
        rToken = data?.gmailOAuth_jarvis?.refreshToken
          || data?.gmailOAuth_morpheus?.refreshToken
          || data?.gmailOAuth_email?.refreshToken
          || data?.["gmailOAuth_inbound-email"]?.refreshToken
          || data?.gmailOAuth?.refreshToken
          || null;
      }

      if (!rToken) {
        showToast("No Gmail account connected. Please connect via Settings or AI Agents first.", "error");
        setIsSendingCampaign(false);
        return;
      }

      const formattedBody = emailBody.split('\n').map(line => `<p style="margin:0 0 12px 0;">${line}</p>`).join('') + renderSignatureHtml();
      const res = await fetch("/api/crm/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refreshToken: rToken,
          subject: emailSubject,
          htmlBody: formattedBody,
          recipients: recipientsWithEmails.map(c => c.email)
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        showToast(`✅ Successfully sent ${data.sentCount} emails!`);
        setShowEmailModal(false);
        setEmailSubject("");
        setEmailBody("");
        setSelectedIds(new Set());
      } else {
        showToast(data.error || "Failed to send campaign", "error");
      }
    } catch (err) {
      showToast("An error occurred while sending the campaign.", "error");
    } finally {
      setIsSendingCampaign(false);
    }
  };

  /* ─────────── INITIALIZE FIRESTORE ─────────── */
  useEffect(() => {
    if (user?.uid && db) {
      initializeStore(db, user.uid);
    }
    return () => { teardown(); };
  }, [user?.uid, db, initializeStore, teardown]);


  const scheduleMeeting = useCallback(async (customerId: string, customerName: string, title: string, date: string, time: string, syncGoogle: boolean, createdBy: "user" | "jarvis" = "user") => {
    return await addMeeting({ customerId, customerName, title, date, time, syncToGoogle: syncGoogle, createdBy });
  }, [addMeeting]);

  const unreadCount = notifications.filter(n => !n.read).length;

  /* ─────────── INBOX LOCAL UI ─────────── */
  const [activeConversation, setActiveConversation] = useState<string>("conv-1");
  const [inboxReply, setInboxReply] = useState("");
  const inboxChatEndRef = useRef<HTMLDivElement>(null);

  const channelIcon = (ch: InboxChannel) => {
    if (ch === "email") return <Mail className="w-3.5 h-3.5 text-blue-500" />;
    if (ch === "whatsapp") return <MessageSquare className="w-3.5 h-3.5 text-green-500" />;
    return <Smartphone className="w-3.5 h-3.5 text-indigo-500" />;
  };
  const channelLabel = (ch: InboxChannel) => ch === "email" ? "Email" : ch === "whatsapp" ? "WhatsApp" : "iMessage";

  const ticketColors: Record<TicketStatus, string> = {
    "Open Issue": "bg-red-50 text-red-700 border-red-200",
    "Pending": "bg-amber-50 text-amber-700 border-amber-200",
    "Resolved": "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  const handleSendInboxReply = async () => {
    if (!inboxReply.trim() || !activeConversation) return;
    await storeSendReply(activeConversation, inboxReply.trim());
    setInboxReply("");
    setTimeout(() => inboxChatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const handleTicketStatusChange = (convId: string, status: TicketStatus) => {
    updateTicketStatus(convId, status);
  };

  /* ─────────── OMNI-SEARCH ─────────── */
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setIsSearchFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const omniResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;
    const contactResults = customers.filter(c =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q))
    ).slice(0, 5);
    const meetingResults = meetings.filter(m =>
      m.customerName.toLowerCase().includes(q) ||
      m.title.toLowerCase().includes(q)
    ).slice(0, 5);
    const ticketResults = conversations.filter(c =>
      c.customerName.toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q)
    ).slice(0, 5);
    return { contacts: contactResults, meetings: meetingResults, tickets: ticketResults };
  }, [searchQuery, customers, meetings, conversations]);

  const hasResults = omniResults && (omniResults.contacts.length > 0 || omniResults.meetings.length > 0 || omniResults.tickets.length > 0);

  const [form, setForm] = useState({ firstName:"", lastName:"", email:"", phone:"", birthday:"", leadStatus:"Cold Lead" as Customer["leadStatus"], tags:"" });
  const resetForm = () => setForm({ firstName:"", lastName:"", email:"", phone:"", birthday:"", leadStatus:"Cold Lead", tags:"" });
  
  const handleStatusChange = (id: string, newStatus: Customer["leadStatus"]) => {
    updateStatus(id, newStatus);
  };

  const handleDragStart = (e: React.DragEvent, customerId: string) => {
    e.dataTransfer.setData("customerId", customerId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: Customer["leadStatus"]) => {
    e.preventDefault();
    const customerId = e.dataTransfer.getData("customerId");
    if (customerId) {
      handleStatusChange(customerId, newStatus);
    }
  };

  const handleAddContact = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    const id = `CUST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const parsedTags = form.tags.split(",").map(t=>t.trim()).filter(Boolean);
    const c: Customer = { id, firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim(), email: form.email.trim(), birthday: form.birthday, leadStatus: form.leadStatus, tags: parsedTags, totalRevenue: 0, aiNotes: "", transactions: [], outstandingBalance: 0 };
    console.log("[CRM] Adding contact:", c.id, c.firstName, c.lastName);
    // Auto-sync new tags to customTags in settings
    const existingTagNames = customTags.map(t => t.name.toLowerCase());
    const newTags = parsedTags.filter(t => !existingTagNames.includes(t.toLowerCase()));
    if (newTags.length > 0) {
      const tagColors = ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f97316","#06b6d4","#84cc16","#ef4444"];
      setCustomTags((prev: any) => [...prev, ...newTags.map((name, i) => ({ name, color: tagColors[(prev.length + i) % tagColors.length] }))]);
    }
    await addContact(c);
    logActivity(db, 'crm_entry_created', { email: user?.email || '', displayName: user?.displayName }, `Added contact: ${c.firstName} ${c.lastName}`);
    resetForm(); setShowAddModal(false);
  };
  const toggleSort = (key: SortKey) => { if (sortKey === key) setSortDir(d => d==="asc"?"desc":"asc"); else { setSortKey(key); setSortDir("asc"); } };
  const sortedCustomers = useMemo(() => {
    let list = [...customers];
    if (contactSearch) { const q = contactSearch.toLowerCase(); list = list.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.tags.some(t=>t.toLowerCase().includes(q))); }
    list.sort((a,b) => { let va="", vb=""; if (sortKey==="name") { va=`${a.firstName} ${a.lastName}`; vb=`${b.firstName} ${b.lastName}`; } else if (sortKey==="email") { va=a.email; vb=b.email; } else if (sortKey==="phone") { va=a.phone; vb=b.phone; } else if (sortKey==="tags") { va=a.tags.join(","); vb=b.tags.join(","); } else { va=a.leadStatus; vb=b.leadStatus; } return sortDir==="asc" ? va.localeCompare(vb) : vb.localeCompare(va); });
    return list;
  }, [customers, sortKey, sortDir, contactSearch]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    customers.forEach(c => c.tags.forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [customers]);

  const filteredSortedCustomers = useMemo(() => {
    let list = sortedCustomers;
    if (tagFilter) list = list.filter(c => c.tags.includes(tagFilter));
    if (statusFilter) list = list.filter(c => c.leadStatus === statusFilter);
    // Date filtering uses the contact ID timestamp (CUST-{timestamp}-xxx)
    if (dateFilterFrom || dateFilterTo) {
      list = list.filter(c => {
        const match = c.id.match(/CUST-(\d+)/);
        if (!match) return true;
        const created = new Date(parseInt(match[1]));
        if (dateFilterFrom && created < new Date(dateFilterFrom)) return false;
        if (dateFilterTo) { const to = new Date(dateFilterTo); to.setDate(to.getDate()+1); if (created >= to) return false; }
        return true;
      });
    }
    return list;
  }, [sortedCustomers, tagFilter, statusFilter, dateFilterFrom, dateFilterTo]);

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => { const visible = filteredSortedCustomers.map(c => c.id); const allSelected = visible.every(id => selectedIds.has(id)); if (allSelected) setSelectedIds(prev => { const n = new Set(prev); visible.forEach(id => n.delete(id)); return n; }); else setSelectedIds(prev => { const n = new Set(prev); visible.forEach(id => n.add(id)); return n; }); };
  const selectedCustomers = customers.filter(c => selectedIds.has(c.id));
  const SortIcon = ({k}:{k:SortKey}) => sortKey===k ? (sortDir==="asc" ? <ChevronUp className="w-3 h-3 inline ml-1"/> : <ChevronDown className="w-3 h-3 inline ml-1"/>) : null;
  const getRowTint = (tags: string[]) => { for (const t of tags) { if (TAG_ROW_TINTS[t]) return TAG_ROW_TINTS[t]; } return ""; };

  /* ─────────── JARVIS AI COPILOT STATE ─────────── */
  const [isJarvisOpen, setIsJarvisOpen] = useState(false);
  const [jarvisInput, setJarvisInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const addJarvisMsg = useCallback((content: string) => {
    addJarvisMessage({ id: `j-${Date.now()}`, role: "jarvis", content, timestamp: new Date() });
  }, [addJarvisMessage]);

  const processJarvisCommand = useCallback((input: string) => {
    const lower = input.toLowerCase().trim();
    addJarvisMessage({ id: `u-${Date.now()}`, role: "user", content: input, timestamp: new Date() });

    // READ — show all
    if (lower.includes("show") && (lower.includes("all") || lower.includes("contacts") || lower.includes("everyone"))) {
      if (customers.length === 0) { addJarvisMsg("Your contact list is currently empty. Want me to add someone?"); return; }
      const summary = customers.map(c => `• **${c.firstName} ${c.lastName}** (${c.id}) — ${c.leadStatus}${c.tags.length ? ` [${c.tags.join(", ")}]` : ""}`).join("\n");
      addJarvisMsg(`Here are all ${customers.length} contacts:\n\n${summary}`); return;
    }

    // READ — find specific contact
    if (lower.match(/\b(find|lookup|look up|show|who is|get)\s+/)) {
      const nameQuery = input.replace(/.*?\b(find|lookup|look up|show|who is|get)\s+/i, "").trim();
      const match = customers.find(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(nameQuery.toLowerCase()));
      if (match) {
        addJarvisMsg(`📋 **${match.firstName} ${match.lastName}** (${match.id})\n\n📧 ${match.email || "No email"}\n📞 ${match.phone || "No phone"}\n🎂 ${match.birthday || "No birthday"}\n📊 Status: ${match.leadStatus}\n🏷️ Tags: ${match.tags.length ? match.tags.join(", ") : "None"}\n💰 Revenue: $${match.totalRevenue.toFixed(2)}\n🧠 AI Notes: ${match.aiNotes || "None yet"}`); return;
      }
      addJarvisMsg(`I couldn't find anyone matching "${nameQuery}". Try \"show all contacts\" to see who's in the system.`); return;
    }

    // CREATE — add contact
    if (lower.match(/\b(add|create)\s+/)) {
      const parts = input.replace(/.*?\b(add|create)\s+(?:contact\s+)?/i, "").trim().split(/\s+/);
      if (parts.length < 2) { addJarvisMsg("Please provide at least a first and last name. Example: \"Add contact Jane Doe jane@test.com\""); return; }
      const firstName = parts[0], lastName = parts[1];
      const emailMatch = parts.find(p => p.includes("@"));
      const phoneMatch = parts.find(p => /^\+?\d[\d\-() ]{6,}$/.test(p));
      const newId = `CUST-${String(customers.length + 1).padStart(3, "0")}`;
      const newCustomer: Customer = { id: newId, firstName, lastName, phone: phoneMatch || "", email: emailMatch || "", birthday: "", leadStatus: "Cold Lead", tags: [], totalRevenue: 0, aiNotes: "", transactions: [], outstandingBalance: 0 };
      addContact(newCustomer);
      addJarvisMsg(`✅ Created **${firstName} ${lastName}** (${newId}) as a Cold Lead.${emailMatch ? " Email: " + emailMatch : ""}${phoneMatch ? " Phone: " + phoneMatch : ""}`); return;
    }

    // UPDATE STATUS — set X to Y
    if (lower.match(/\b(set|change|move|update status)\b/)) {
      const statusMap: Record<string, Customer["leadStatus"]> = { "cold": "Cold Lead", "cold lead": "Cold Lead", "warm": "Warm Lead", "warm lead": "Warm Lead", "interested": "Interested", "sale": "Sale Completed", "sale completed": "Sale Completed", "completed": "Sale Completed" };
      let foundStatus: Customer["leadStatus"] | null = null;
      for (const [key, val] of Object.entries(statusMap)) { if (lower.includes(key)) { foundStatus = val; break; } }
      if (!foundStatus) { addJarvisMsg("I need a valid status: Cold Lead, Warm Lead, Interested, or Sale Completed."); return; }
      const cleaned = input.replace(/.*?\b(set|change|move|update status)\s+(?:of\s+)?/i, "").replace(new RegExp(`\\b(to\\s+)?(cold lead|warm lead|interested|sale completed|cold|warm|sale|completed)\\b`, "gi"), "").trim();
      const match = customers.find(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(cleaned.toLowerCase()));
      if (match) {
        handleStatusChange(match.id, foundStatus);
        addJarvisMsg(`🔄 Updated **${match.firstName} ${match.lastName}** from ${match.leadStatus} → **${foundStatus}**.`); return;
      }
      addJarvisMsg(`Couldn't find a contact matching "${cleaned}".`); return;
    }

    // DELETE
    if (lower.match(/\b(delete|remove)\b/)) {
      const nameQuery = input.replace(/.*?\b(delete|remove)\s+(?:contact\s+)?/i, "").trim();
      const match = customers.find(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(nameQuery.toLowerCase()));
      if (match) {
        deleteContact(match.id);
        addJarvisMsg(`🗑️ Deleted **${match.firstName} ${match.lastName}** (${match.id}) from the CRM.`); return;
      }
      addJarvisMsg(`Couldn't find a contact matching "${nameQuery}" to delete.`); return;
    }

    // ANALYZE — add AI notes
    if (lower.match(/\b(analyze|note|insight)\b/)) {
      const body = input.replace(/.*?\b(analyze|note|insight)\s+/i, "").trim();
      const colonIdx = body.indexOf(":");
      if (colonIdx === -1) { addJarvisMsg("Use the format: \"Analyze [Name]: [Your note]\" — e.g., \"Analyze Jane Doe: Very interested in automation\""); return; }
      const nameQuery = body.slice(0, colonIdx).trim();
      const noteText = body.slice(colonIdx + 1).trim();
      const match = customers.find(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(nameQuery.toLowerCase()));
      if (match) {
        const stamp = `Jarvis Deduction (${new Date().toLocaleDateString()}): ${noteText}`;
        const newNotes = match.aiNotes ? match.aiNotes + "\n" + stamp : stamp;
        store.updateCustomer(match.id, { aiNotes: newNotes });
        addJarvisMsg(`🧠 Added AI note to **${match.firstName} ${match.lastName}**:\n\n_${stamp}_`); return;
      }
      addJarvisMsg(`Couldn't find a contact matching "${nameQuery}".`); return;
    }

    // SCHEDULE MEETING
    if (lower.includes("schedule") || lower.includes("book") || lower.includes("meeting")) {
      // Parse: "schedule a meeting with Jane Doe for 2026-06-01 at 6pm"
      // or: "book consultation with Jane Doe tuesday 3pm"
      const withMatch = input.match(/(?:with|for)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
      if (!withMatch) { addJarvisMsg("Please include the contact name. Example: \"Schedule a meeting with Jane Doe for 2026-06-01 at 6pm\""); return; }
      const contactName = withMatch[1];
      const customer = customers.find(c => `${c.firstName} ${c.lastName}`.toLowerCase() === contactName.toLowerCase());
      if (!customer) { addJarvisMsg(`Couldn't find a contact named "${contactName}".`); return; }

      // Extract date
      const dateMatch = input.match(/(\d{4}-\d{2}-\d{2})/);
      const dayNames: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      let meetDate = "";
      if (dateMatch) { meetDate = dateMatch[1]; }
      else {
        const dayMatch = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/);
        if (dayMatch) {
          const now = new Date();
          if (dayMatch[1] === "today") { meetDate = now.toISOString().split("T")[0]; }
          else if (dayMatch[1] === "tomorrow") { now.setDate(now.getDate() + 1); meetDate = now.toISOString().split("T")[0]; }
          else {
            const target = dayNames[dayMatch[1]];
            const diff = (target - now.getDay() + 7) % 7 || 7;
            now.setDate(now.getDate() + diff);
            meetDate = now.toISOString().split("T")[0];
          }
        } else { const fallback = new Date(); fallback.setDate(fallback.getDate() + 1); meetDate = fallback.toISOString().split("T")[0]; }
      }

      // Extract time
      const timeMatch = input.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
      let meetTime = "12:00";
      if (timeMatch) {
        let h = parseInt(timeMatch[1]);
        const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3].toLowerCase();
        if (ampm === "pm" && h < 12) h += 12;
        if (ampm === "am" && h === 12) h = 0;
        meetTime = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
      }

      // Extract title from context
      const titleMatch = input.match(/(?:schedule|book)\s+(?:a\s+)?(.+?)\s+(?:with|for)/i);
      const meetTitle = titleMatch ? titleMatch[1].replace(/^(a|an)\s+/i, "").trim() : "Meeting";
      const capitalTitle = meetTitle.charAt(0).toUpperCase() + meetTitle.slice(1);

      scheduleMeeting(customer.id, `${customer.firstName} ${customer.lastName}`, capitalTitle, meetDate, meetTime, true, "jarvis");
      addJarvisMsg(`📅 Done! I've scheduled a **${capitalTitle}** with **${customer.firstName} ${customer.lastName}** for **${meetDate}** at **${meetTime}**.\n\n✅ Synced to Google Calendar\n🔔 Notification created`); return;
    }

    // FINANCIAL QUERIES
    if (lower.includes("top") && lower.includes("revenue")) {
      if (customers.length === 0) { addJarvisMsg("No contacts in the system yet."); return; }
      const numMatch = lower.match(/(\d+)/);
      const count = numMatch ? parseInt(numMatch[1]) : 5;
      const sorted = [...customers].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, count);
      const list = sorted.map((c, i) => `${i + 1}. **${c.firstName} ${c.lastName}** — $${c.totalRevenue.toFixed(2)}`).join("\n");
      addJarvisMsg(`💰 Top ${count} customers by revenue:\n\n${list}`); return;
    }

    if ((lower.includes("how much") || lower.includes("revenue") || lower.includes("money") || lower.includes("total")) && (lower.includes("cold") || lower.includes("warm") || lower.includes("interested") || lower.includes("completed") || lower.includes("sale"))) {
      const statusMap: Record<string, Customer["leadStatus"]> = { "cold": "Cold Lead", "warm": "Warm Lead", "interested": "Interested", "sale": "Sale Completed", "completed": "Sale Completed" };
      let qStatus: Customer["leadStatus"] | null = null;
      for (const [key, val] of Object.entries(statusMap)) { if (lower.includes(key)) { qStatus = val; break; } }
      if (qStatus) {
        const filtered = customers.filter(c => c.leadStatus === qStatus);
        const total = filtered.reduce((sum, c) => sum + c.totalRevenue, 0);
        addJarvisMsg(`💰 **${qStatus}** column:\n\n• Contacts: ${filtered.length}\n• Total Revenue: **$${total.toFixed(2)}**\n• Avg Revenue: $${filtered.length ? (total / filtered.length).toFixed(2) : "0.00"}`); return;
      }
    }

    if (lower.includes("total revenue") || lower.includes("overall revenue") || (lower.includes("how much") && lower.includes("total"))) {
      const total = customers.reduce((sum, c) => sum + c.totalRevenue, 0);
      const outstanding = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);
      addJarvisMsg(`💰 **Financial Summary**\n\n• Total Revenue: **$${total.toFixed(2)}**\n• Outstanding Balances: **$${outstanding.toFixed(2)}**\n• Contacts: ${customers.length}\n• Avg Revenue/Contact: $${customers.length ? (total / customers.length).toFixed(2) : "0.00"}`); return;
    }

    // FALLBACK
    addJarvisMsg("I'm not sure what you mean. Here's what I can do:\n\n• **show all contacts** — list everyone\n• **find [name]** — look up a contact\n• **add [first] [last] [email]** — create a contact\n• **set [name] to [status]** — update status\n• **delete [name]** — remove a contact\n• **analyze [name]: [note]** — add AI insight\n• **schedule meeting with [name] for [date] at [time]**\n• **top 5 customers by revenue** — leaderboard\n• **how much revenue in Warm Leads?** — status breakdown\n• **total revenue** — financial summary");
  }, [customers, addJarvisMsg, handleStatusChange, setCustomers, scheduleMeeting]);

  const handleJarvisSend = () => {
    if (!jarvisInput.trim()) return;
    processJarvisCommand(jarvisInput.trim());
    setJarvisInput("");
  };

  /* ─────────── AUTH GATE ─────────── */
  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F9FAFB]">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading CRM...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F9FAFB]">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xl p-10 max-w-md w-full mx-4 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-lg">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">SOLTheory CRM</h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Sign in to your account to access the CRM dashboard, manage contacts, and track your sales pipeline.
            </p>
          </div>
          <div className="pt-2">
            <a
              href="/portal/login"
              className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
            >
              Sign In to Continue
            </a>
          </div>
          <p className="text-[11px] text-slate-400">
            Your data is encrypted and scoped to your account
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-0px)] md:h-screen bg-[#F9FAFB] overflow-hidden -m-0">
      {/* Load cursive font for email signatures */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap" rel="stylesheet" />
      {/* ──── Mobile Sidebar Overlay ──── */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden" onClick={() => setIsMobileSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
        </div>
      )}

      {/* ──── CRM Sidebar ──── */}
      <aside className={`fixed lg:relative inset-y-0 left-0 z-[81] flex flex-col w-[220px] bg-white border-r border-[#E5E7EB] shrink-0 transition-transform duration-200 ease-in-out ${
        isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-bold text-slate-800 tracking-tight">CRM</span>
          </div>
          <button onClick={() => setIsMobileSidebarOpen(false)} className="lg:hidden w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {crmNavItems.map((item) => {
            const isActive = activeView === item.id;
            const isSpecial = "special" in item && item.special;

            if (isSpecial) {
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveView(item.id); setIsMobileSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 my-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer border ${
                    isActive
                      ? "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border-amber-300 shadow-sm shadow-amber-500/10"
                      : "bg-gradient-to-r from-amber-50/60 to-orange-50/40 text-amber-700 border-amber-200/80 hover:from-amber-50 hover:to-orange-50 hover:border-amber-300 hover:shadow-sm"
                  }`}
                >
                  <div className={`w-[26px] h-[26px] rounded-md flex items-center justify-center border ${
                    isActive
                      ? "bg-gradient-to-br from-amber-500 to-orange-600 border-amber-600 shadow-sm shadow-amber-500/30"
                      : "bg-gradient-to-br from-amber-400 to-orange-500 border-amber-500/60"
                  }`}>
                    <item.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  {item.label}
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => { setActiveView(item.id); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <item.icon className={`w-[18px] h-[18px] ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ──── Main Content Area ──── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ──── Top Navigation Bar ──── */}
        <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-6 shrink-0 shadow-[0_1px_2px_0_rgba(0,0,0,0.03)]">
          {/* Mobile nav toggle + breadcrumb */}
          <div className="flex items-center gap-3">
            {/* Hamburger menu (mobile) */}
            <button onClick={() => setIsMobileSidebarOpen(true)} className="lg:hidden w-9 h-9 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-500 cursor-pointer">
              <Menu className="w-5 h-5" />
            </button>
            {/* Breadcrumb (desktop) */}
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-slate-400 font-medium">CRM</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-700 font-semibold capitalize">{activeView}</span>
            </div>
          </div>

          {/* Right side: search + notifications + avatar */}
          <div className="flex items-center gap-3">
            {/* Global Omni-Search */}
            <div className="relative hidden md:block" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search everything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                className="w-64 h-9 pl-9 pr-4 text-sm rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
              />
              {/* Omni-Search Dropdown */}
              {isSearchFocused && searchQuery.trim() && (
                <div className="absolute top-full left-0 mt-2 w-[420px] bg-white rounded-xl border border-[#E5E7EB] shadow-2xl z-[70] overflow-hidden">
                  {!hasResults ? (
                    <div className="py-12 text-center">
                      <SearchX className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-500">No results found</p>
                      <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
                    </div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
                      {/* Contacts */}
                      {omniResults && omniResults.contacts.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-slate-50/80 border-b border-[#E5E7EB]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Users className="w-3 h-3" /> Contacts</span>
                          </div>
                          {omniResults.contacts.map(c => (
                            <button key={c.id} onClick={() => { setViewingCustomer(c.id); setSearchQuery(""); setIsSearchFocused(false); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-3 border-b border-slate-50">
                              <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[9px] border border-indigo-100 shrink-0">{c.firstName[0]}{c.lastName[0]}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{c.firstName} {c.lastName}</p>
                                <p className="text-[10px] text-slate-400 truncate">{c.email} · {c.leadStatus}</p>
                              </div>
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[c.leadStatus]||""}`}>{c.leadStatus}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Calendar Events */}
                      {omniResults && omniResults.meetings.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-slate-50/80 border-b border-[#E5E7EB]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Calendar Events</span>
                          </div>
                          {omniResults.meetings.map(m => (
                            <div key={m.id} className="px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-3 border-b border-slate-50">
                              <CalendarCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{m.title}</p>
                                <p className="text-[10px] text-slate-400">{m.customerName} · {m.date} at {m.time}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Support Tickets */}
                      {omniResults && omniResults.tickets.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-slate-50/80 border-b border-[#E5E7EB]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><MessageCircle className="w-3 h-3" /> Support Tickets</span>
                          </div>
                          {omniResults.tickets.map(t => (
                            <button key={t.id} onClick={() => { setActiveView("inbox"); setActiveConversation(t.id); setSearchQuery(""); setIsSearchFocused(false); }} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-3 border-b border-slate-50">
                              {channelIcon(t.channel)}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{t.customerName}</p>
                                <p className="text-[10px] text-slate-400 truncate">{t.lastMessage}</p>
                              </div>
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${ticketColors[t.ticketStatus]}`}>{t.ticketStatus}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative w-9 h-9 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                <Bell className="w-[18px] h-[18px]" />
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full ring-2 ring-white text-[9px] font-bold text-white flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl border border-[#E5E7EB] shadow-2xl z-[60] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
                    <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
                    {notifications.length > 0 && <button onClick={() => markNotificationsRead()} className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer">Mark all read</button>}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center"><Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" /><p className="text-xs text-slate-400">No notifications yet</p></div>
                    ) : (
                      notifications.slice(0, 20).map(n => (
                        <div key={n.id} className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${!n.read ? "bg-indigo-50/30" : ""}`}>
                          <div className="flex items-start gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${n.type === "meeting" ? "bg-emerald-50" : "bg-indigo-50"}`}>
                              {n.type === "meeting" ? <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Bell className="w-3.5 h-3.5 text-indigo-600" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-slate-700 leading-relaxed">{n.message}</p>
                              <p className="text-[10px] text-slate-400 mt-1">{n.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="w-px h-7 bg-[#E5E7EB] hidden md:block" />

            {/* User Profile */}
            <button className="flex items-center gap-2.5 hover:bg-slate-50 rounded-lg py-1.5 px-2 transition-colors cursor-pointer">
              <Avatar className="h-8 w-8 ring-1 ring-slate-200">
                <AvatarImage src={user?.photoURL || undefined} />
                <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold text-xs">
                  {user?.displayName?.[0] || user?.email?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-xs font-semibold text-slate-700 leading-tight">
                  {user?.displayName || "User"}
                </span>
                <span className="text-[10px] text-slate-400 leading-tight">Admin</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
            </button>
          </div>
        </header>

        {/* ──── Scrollable Content ──── */}
        <main className="flex-1 overflow-y-auto p-5 md:p-8">
          {/* Skeleton Loading */}
          {isLoading ? (
            activeView === "contacts" ? <ContactsTableSkeleton /> :
            activeView === "campaigns" ? <DashboardSkeleton /> :
            activeView === "inbox" ? <InboxSkeleton /> :
            activeView === "analytics" ? <AnalyticsSkeleton /> :
            <DashboardSkeleton />
          ) : (
          <>
          {/* ═══════════ DASHBOARD VIEW ═══════════ */}
          {activeView === "dashboard" && (
            <div className="max-w-[1400px] mx-auto space-y-6">
              {/* Page Title */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
                  <p className="text-sm text-slate-400 mt-0.5">
                    An overview of your customer relationships and revenue.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] cursor-pointer">
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                  <button
                    onClick={() => { setActiveView("contacts"); setShowAddModal(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/10 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Contact
                  </button>
                </div>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Total Contacts"
                  value={customers.length.toString()}
                  subtext="all time"
                  icon={Users}
                />
                <MetricCard
                  label="Total Revenue"
                  value={`$${customers.reduce((s, c) => s + c.totalRevenue, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  subtext="lifetime"
                  icon={DollarSign}
                />
                <MetricCard
                  label="Active Leads"
                  value={customers.filter((c) => c.leadStatus === "Cold Lead" || c.leadStatus === "Warm Lead" || c.leadStatus === "Interested").length.toString()}
                  subtext="in pipeline"
                  icon={Activity}
                />
                <MetricCard
                  label="AI Insights"
                  value={customers.filter((c) => c.aiNotes.length > 0).length.toString()}
                  subtext="notes generated"
                  icon={Brain}
                />
              </div>

              {/* Recent Contacts Table Card */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
                  <h2 className="text-sm font-bold text-slate-700">Recent Contacts</h2>
                  <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer">
                    View All
                  </button>
                </div>

                {customers.length === 0 ? (
                  <EmptyContacts onAdd={() => { setActiveView("contacts"); setShowAddModal(true); }} />
                ) : (
                  <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>
                    {customers.slice(0,5).map(c => (
                      <tr key={c.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${getRowTint(c.tags)} ${selectedIds.has(c.id) ? "bg-indigo-50/30" : ""}`}>
                        <td className="py-3 pl-6 pr-2 w-10">
                          <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">{c.firstName} {c.lastName}</td>
                        <td className="py-3 px-4 text-slate-500">{c.email}</td>
                        <td className="py-3 px-4"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.leadStatus]||""}`}>{c.leadStatus}</span></td>
                      </tr>
                    ))}
                  </tbody></table></div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ CONTACTS VIEW ═══════════ */}
          {activeView === "contacts" && (
            <div className="max-w-[1400px] mx-auto space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-800 tracking-tight">Contacts</h1>
                  <p className="text-sm text-slate-400 mt-0.5">Manage all your customer records in one place.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button onClick={() => setContactsViewMode("table")} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors cursor-pointer ${contactsViewMode === "table" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Table View</button>
                    <button onClick={() => setContactsViewMode("pipeline")} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors cursor-pointer ${contactsViewMode === "pipeline" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Pipeline View</button>
                  </div>
                  <div className="hidden sm:block w-px h-6 bg-slate-200"></div>
                  <div className="relative">
                    <button onClick={() => setShowFilterPanel(!showFilterPanel)} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${hasActiveFilters ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-[#E5E7EB] bg-white text-slate-600 hover:bg-slate-50'}`}>
                      <Filter className="w-3.5 h-3.5" />Filter
                      {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                    </button>
                    {showFilterPanel && (
                      <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-[#E5E7EB] shadow-xl z-50 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filters</h4>
                          <div className="flex items-center gap-2">
                            {hasActiveFilters && <button onClick={clearAllFilters} className="text-[10px] font-semibold text-red-500 hover:text-red-600 cursor-pointer">Clear All</button>}
                            <button onClick={() => setShowFilterPanel(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <div className="px-4 py-3 space-y-4 max-h-[400px] overflow-y-auto">
                          {/* Tag Filter */}
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Tags</label>
                            <div className="flex flex-wrap gap-1.5">
                              {allTags.map(tag => (
                                <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? '' : tag)} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${tagFilter === tag ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                                  {tag}
                                </button>
                              ))}
                              {allTags.length === 0 && <p className="text-[11px] text-slate-400">No tags yet</p>}
                            </div>
                          </div>
                          {/* Status Filter */}
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Lead Status</label>
                            <div className="grid grid-cols-2 gap-1.5">
                              {['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'].map(status => (
                                <button key={status} onClick={() => setStatusFilter(statusFilter === status ? '' : status)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${statusFilter === status ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                                  {status}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Date Range */}
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Date Added</label>
                            <div className="flex items-center gap-2">
                              <input type="date" value={dateFilterFrom} onChange={e => setDateFilterFrom(e.target.value)} className="flex-1 h-8 px-2.5 text-xs rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                              <span className="text-[10px] text-slate-400">to</span>
                              <input type="date" value={dateFilterTo} onChange={e => setDateFilterTo(e.target.value)} className="flex-1 h-8 px-2.5 text-xs rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                          </div>
                        </div>
                        {/* Active filter summary */}
                        {hasActiveFilters && (
                          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                            <p className="text-[10px] text-slate-500">
                              Showing {filteredSortedCustomers.length} of {customers.length} contacts
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setShowAddModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"><UserPlus className="w-4 h-4" />Add Contact</button>
                </div>
              </div>
              
              {contactsViewMode === "table" ? (
                <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden">
                  {/* Search + Tag Filter Bar */}
                  <div className="px-6 py-4 border-b border-[#E5E7EB] flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input type="text" placeholder="Search by name, email, or tags..." value={contactSearch} onChange={e=>setContactSearch(e.target.value)} className="w-full h-9 pl-9 pr-4 text-sm rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all" />
                    </div>
                    {allTags.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-slate-400" />
                        <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="h-9 px-3 pr-8 text-sm rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 cursor-pointer">
                          <option value="">All Tags</option>
                          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        {tagFilter && <button onClick={() => setTagFilter("")} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">&times; Clear</button>}
                      </div>
                    )}
                  </div>
                  {customers.length === 0 ? (
                    <EmptyContacts onAdd={()=>setShowAddModal(true)} />
                  ) : (
                    <div className="overflow-x-auto -mx-0">
                      <table className="w-full text-sm min-w-[700px]">
                        <thead className="bg-slate-50/60">
                          <tr className="border-b border-[#E5E7EB]">
                            <th className="w-12 py-3.5 pl-5">
                              <input 
                                type="checkbox" 
                                checked={filteredSortedCustomers.length > 0 && filteredSortedCustomers.every(c => selectedIds.has(c.id))} 
                                onChange={toggleSelectAll} 
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </th>
                            <th onClick={()=>toggleSort("name")} className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 pr-4 cursor-pointer hover:text-slate-700 select-none">Name<SortIcon k="name"/></th>
                            <th onClick={()=>toggleSort("email")} className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4 cursor-pointer hover:text-slate-700 select-none">Email<SortIcon k="email"/></th>
                            <th onClick={()=>toggleSort("phone")} className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4 cursor-pointer hover:text-slate-700 select-none">Phone<SortIcon k="phone"/></th>
                            <th onClick={()=>toggleSort("tags")} className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4 cursor-pointer hover:text-slate-700 select-none">Tags<SortIcon k="tags"/></th>
                            <th onClick={()=>toggleSort("status")} className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3.5 px-4 cursor-pointer hover:text-slate-700 select-none">Status<SortIcon k="status"/></th>
                            <th className="w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSortedCustomers.map(c => (
                            <tr key={c.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${getRowTint(c.tags)} ${selectedIds.has(c.id) ? "bg-indigo-50/30" : ""}`}>
                              <td className="py-3.5 pl-5">
                                <input 
                                  type="checkbox" 
                                  checked={selectedIds.has(c.id)} 
                                  onChange={() => toggleSelect(c.id)} 
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-3.5 pr-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[10px] border border-indigo-100 shrink-0">{c.firstName[0]}{c.lastName[0]}</div>
                                  <div><div className="font-semibold text-slate-800">{c.firstName} {c.lastName}</div><div className="text-[10px] text-slate-400 uppercase tracking-wide">{c.id}</div></div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600">{c.email}</td>
                              <td className="py-3.5 px-4 text-slate-600">{c.phone}</td>
                              <td className="py-3.5 px-4"><div className="flex flex-wrap gap-1">{c.tags.map(t=>(<span key={t} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TAG_COLORS[t]||"bg-slate-50 text-slate-600 border-slate-200"}`}>{t}</span>))}</div></td>
                              <td className="py-3.5 px-4">
                                <select value={c.leadStatus} onChange={(e) => handleStatusChange(c.id, e.target.value as Customer["leadStatus"])} className={`text-[10px] font-semibold px-2 py-1 rounded-full border outline-none cursor-pointer appearance-none ${STATUS_COLORS[c.leadStatus]||""}`}>
                                  <option value="Cold Lead">Cold Lead</option><option value="Warm Lead">Warm Lead</option><option value="Interested">Interested</option><option value="Sale Completed">Sale Completed</option>
                                </select>
                              </td>
                              <td className="py-3.5 pr-4"><button onClick={() => setViewingCustomer(c.id)} className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-pointer"><Eye className="w-4 h-4"/></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start overflow-x-auto pb-4">
                  {(["Cold Lead", "Warm Lead", "Interested", "Sale Completed"] as const).map(status => (
                    <div 
                      key={status} 
                      className="bg-slate-100/50 rounded-xl p-3 min-h-[400px] border border-slate-200"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, status)}
                    >
                      <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className={`text-xs font-bold uppercase tracking-wider ${
                          status === "Cold Lead" ? "text-blue-700" :
                          status === "Warm Lead" ? "text-orange-700" :
                          status === "Interested" ? "text-purple-700" : "text-emerald-700"
                        }`}>{status}</h3>
                        <span className="text-xs font-semibold text-slate-400 bg-white px-2 py-0.5 rounded-md shadow-sm">
                          {customers.filter(c => c.leadStatus === status).length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {customers.filter(c => c.leadStatus === status).map(c => (
                          <div 
                            key={c.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, c.id)}
                            className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-colors"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold text-slate-800 text-sm">{c.firstName} {c.lastName}</h4>
                              <MoreHorizontal className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="text-xs text-slate-500 mb-3 space-y-1">
                              <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-400"/> {c.email}</div>
                              {c.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-400"/> {c.phone}</div>}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {c.tags.slice(0, 2).map(t => (
                                <span key={t} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${TAG_COLORS[t]||"bg-slate-50 text-slate-600 border-slate-200"}`}>{t}</span>
                              ))}
                              {c.tags.length > 2 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">+{c.tags.length - 2}</span>}
                            </div>
                          </div>
                        ))}
                        {customers.filter(c => c.leadStatus === status).length === 0 && (
                          <div className="text-center p-4 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-medium">
                            Drop contacts here
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* ═══════════ CUSTOMER PROFILE VIEW ═══════════ */}
          {viewingCustomer && (() => {
            const c = customers.find(x => x.id === viewingCustomer);
            if (!c) return null;
            const customerMeetings = meetings.filter(m => m.customerId === c.id);
            return (
              <div className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setViewingCustomer(null)}>
                <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  {/* Profile Header */}
                  <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-100">{c.firstName[0]}{c.lastName[0]}</div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-800">{c.firstName} {c.lastName}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.leadStatus]||""}`}>{c.leadStatus}</span>
                          <span className="text-[10px] text-slate-400">{c.id}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setViewingCustomer(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
                  </div>

                  {/* Profile Body */}
                  <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* Contact Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]"><span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Email</span><span className="text-sm text-slate-700">{c.email || "—"}</span></div>
                      <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]"><span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Phone</span><span className="text-sm text-slate-700">{c.phone || "—"}</span></div>
                      <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]"><span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Birthday</span><span className="text-sm text-slate-700">{c.birthday || "—"}</span></div>
                      <div className="p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]"><span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Revenue</span><span className="text-sm text-slate-700">${c.totalRevenue.toFixed(2)}</span></div>
                    </div>

                    {/* Tags */}
                    {c.tags.length > 0 && (
                      <div><span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Tags</span><div className="flex flex-wrap gap-1.5">{c.tags.map(t => <span key={t} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${TAG_COLORS[t]||"bg-slate-50 text-slate-600 border-slate-200"}`}>{t}</span>)}</div></div>
                    )}

                    {/* AI Notes + Deduce Button */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">AI Notes</span>
                        <button
                          onClick={() => runDeduction(c.id)}
                          disabled={isDeducing}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-[10px] font-semibold text-white hover:from-indigo-600 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                        >
                          {isDeducing ? (
                            <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing...</>
                          ) : (
                            <><Zap className="w-3 h-3" /> Ask Jarvis to Deduce</>
                          )}
                        </button>
                      </div>
                      {c.aiNotes ? (
                        <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-100 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed"><Brain className="w-3.5 h-3.5 text-purple-500 inline mr-1.5" />{c.aiNotes}</div>
                      ) : (
                        <div className="text-center py-6 border border-dashed border-purple-200 rounded-lg bg-purple-50/20">
                          <Brain className="w-6 h-6 text-purple-200 mx-auto mb-1.5" />
                          <p className="text-xs text-slate-400">No AI notes yet. Click &quot;Ask Jarvis to Deduce&quot; to generate insights.</p>
                        </div>
                      )}
                    </div>

                    {/* ── Financials Card ── */}
                    <div className="border-t border-[#E5E7EB] pt-5">
                      <div className="flex items-center gap-2 mb-4">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-sm font-bold text-slate-800">Financials</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3.5 bg-emerald-50/50 rounded-lg border border-emerald-100">
                          <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider block mb-1">Total Revenue</span>
                          <span className="text-lg font-bold text-slate-800">${c.totalRevenue.toFixed(2)}</span>
                        </div>
                        <div className="p-3.5 bg-orange-50/50 rounded-lg border border-orange-100">
                          <span className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider block mb-1">Outstanding</span>
                          <span className="text-lg font-bold text-slate-800">${c.outstandingBalance.toFixed(2)}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Transaction History</span>
                        {c.transactions.length === 0 ? (
                          <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg">
                            <DollarSign className="w-6 h-6 text-slate-200 mx-auto mb-1.5" />
                            <p className="text-xs text-slate-400">No transactions recorded yet</p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {c.transactions.map(tx => (
                              <div key={tx.id} className="flex items-center justify-between p-2.5 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                                <div>
                                  <p className="text-xs font-medium text-slate-700">{tx.description}</p>
                                  <p className="text-[10px] text-slate-400">{tx.date}</p>
                                </div>
                                <span className={`text-xs font-bold ${tx.amount >= 0 ? "text-emerald-600" : "text-red-500"}`}>{tx.amount >= 0 ? "+" : ""}${tx.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Schedule Meeting Section ── */}
                    <div className="border-t border-[#E5E7EB] pt-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-sm font-bold text-slate-800">Schedule Meeting</h3>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Meeting Title</label>
                          <input value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" placeholder="e.g. Consultation Call" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Date</label>
                            <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Time</label>
                            <input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600">Sync to Google Calendar</span>
                          </div>
                          <button onClick={() => setMeetingSyncGoogle(!meetingSyncGoogle)} className="cursor-pointer text-slate-400">
                            {meetingSyncGoogle ? <ToggleRight className="w-8 h-8 text-indigo-600" /> : <ToggleLeft className="w-8 h-8" />}
                          </button>
                        </div>
                        <button
                          disabled={!meetingTitle.trim() || !meetingDate || !meetingTime}
                          onClick={() => {
                            scheduleMeeting(c.id, `${c.firstName} ${c.lastName}`, meetingTitle.trim(), meetingDate, meetingTime, meetingSyncGoogle, "user");
                            setMeetingTitle(""); setMeetingDate(""); setMeetingTime(""); setMeetingSyncGoogle(false);
                          }}
                          className="w-full h-10 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
                        >
                          <CalendarCheck className="w-4 h-4" />Schedule Meeting
                        </button>
                      </div>
                    </div>

                    {/* Upcoming Meetings */}
                    {customerMeetings.length > 0 && (
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Upcoming Meetings</span>
                        <div className="space-y-2">
                          {customerMeetings.map(m => (
                            <div key={m.id} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
                              <div className="flex items-center gap-2.5">
                                <CalendarCheck className="w-4 h-4 text-emerald-600" />
                                <div>
                                  <p className="text-xs font-semibold text-slate-700">{m.title}</p>
                                  <p className="text-[10px] text-slate-400">{m.date} at {m.time} {m.syncToGoogle && "· Google Calendar"}</p>
                                </div>
                              </div>
                              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">{m.createdBy === "jarvis" ? "Via Jarvis" : "Manual"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ═══════════ INBOX VIEW ═══════════ */}
          {activeView === "inbox" && (() => {
            const activeConv = conversations.find(c => c.id === activeConversation);
            return (
              <div className="max-w-[1400px] mx-auto space-y-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-800 tracking-tight">Unified Inbox</h1>
                  <p className="text-sm text-slate-400 mt-0.5">All customer communications in one place.</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden flex" style={{ height: "calc(100vh - 220px)" }}>
                  {/* Left: Conversation List */}
                  <div className="w-[340px] shrink-0 border-r border-[#E5E7EB] flex flex-col">
                    <div className="px-4 py-3 border-b border-[#E5E7EB]">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input type="text" placeholder="Search conversations..." className="w-full h-9 pl-9 pr-4 text-sm rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
                      {conversations.map(conv => (
                        <button
                          key={conv.id}
                          onClick={() => { setActiveConversation(conv.id); markConversationRead(conv.id); }}
                          className={`w-full text-left px-4 py-3.5 border-b border-slate-50 hover:bg-slate-50/70 transition-colors cursor-pointer flex gap-3 ${
                            activeConversation === conv.id ? "bg-indigo-50/40" : ""
                          }`}
                        >
                          {/* Avatar */}
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs border border-slate-200">
                              {conv.customerName.split(" ").map(n => n[0]).join("")}
                            </div>
                            {conv.unread && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-indigo-500 rounded-full ring-2 ring-white" />}
                          </div>
                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className={`text-[13px] truncate ${conv.unread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{conv.customerName}</span>
                              <span className="text-[10px] text-slate-400 shrink-0 ml-2">{conv.lastTimestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {channelIcon(conv.channel)}
                              <p className={`text-xs truncate flex-1 ${conv.unread ? "font-semibold text-slate-700" : "text-slate-500"}`}>{conv.lastMessage}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${ticketColors[conv.ticketStatus]}`}>{conv.ticketStatus}</span>
                              <span className="text-[9px] text-slate-400">{channelLabel(conv.channel)}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right: Chat Window */}
                  <div className="flex-1 flex flex-col min-w-0 bg-[#F9FAFB]">
                    {activeConv ? (
                      <>
                        {/* Ticket Header */}
                        <div className="px-5 py-3.5 bg-white border-b border-[#E5E7EB] flex items-center justify-between shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[10px] border border-slate-200">
                              {activeConv.customerName.split(" ").map(n => n[0]).join("")}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-800">{activeConv.customerName}</h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {channelIcon(activeConv.channel)}
                                <span className="text-[10px] text-slate-400">{channelLabel(activeConv.channel)} · Case #{activeConv.id.replace("conv-", "")}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Status:</span>
                            <select
                              value={activeConv.ticketStatus}
                              onChange={e => handleTicketStatusChange(activeConv.id, e.target.value as TicketStatus)}
                              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border cursor-pointer outline-none ${ticketColors[activeConv.ticketStatus]}`}
                            >
                              <option value="Open Issue">Open Issue</option>
                              <option value="Pending">Pending</option>
                              <option value="Resolved">Resolved</option>
                            </select>
                          </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
                          {activeConv.messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.sender === "agent" ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[70%] px-4 py-2.5 rounded-xl text-[13px] leading-relaxed ${
                                msg.sender === "agent"
                                  ? "bg-indigo-600 text-white rounded-br-md"
                                  : "bg-white text-slate-700 border border-[#E5E7EB] rounded-bl-md shadow-sm"
                              }`}>
                                <p>{msg.text}</p>
                                <p className={`text-[9px] mt-1.5 ${msg.sender === "agent" ? "text-indigo-200" : "text-slate-400"}`}>
                                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                            </div>
                          ))}
                          <div ref={inboxChatEndRef} />
                        </div>

                        {/* Reply Input */}
                        <div className="px-5 py-3.5 bg-white border-t border-[#E5E7EB] shrink-0">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={inboxReply}
                              onChange={e => setInboxReply(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") handleSendInboxReply(); }}
                              placeholder="Type a reply..."
                              className="flex-1 h-10 px-4 text-sm rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
                            />
                            <button
                              onClick={handleSendInboxReply}
                              disabled={!inboxReply.trim()}
                              className="w-10 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                          <Inbox className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                          <p className="text-sm text-slate-400">Select a conversation to get started</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ═══════════ ANALYTICS VIEW ═══════════ */}
          {activeView === "analytics" && (() => {
            const totalRevenue = customers.reduce((s, c) => s + c.totalRevenue, 0);
            const totalOutstanding = customers.reduce((s, c) => s + c.outstandingBalance, 0);

            const revenueByStatus = (["Cold Lead", "Warm Lead", "Interested", "Sale Completed"] as const).map(status => ({
              status,
              revenue: customers.filter(c => c.leadStatus === status).reduce((s, c) => s + c.totalRevenue, 0),
              count: customers.filter(c => c.leadStatus === status).length,
            }));

            const statusColorMap: Record<string, string> = { "Cold Lead": "#3b82f6", "Warm Lead": "#f97316", "Interested": "#8b5cf6", "Sale Completed": "#10b981" };

            // Revenue over time (group by month from transactions across all customers)
            const txByMonth = new Map<string, number>();
            customers.forEach(c => c.transactions.forEach(tx => {
              const month = tx.date.slice(0, 7); // YYYY-MM
              txByMonth.set(month, (txByMonth.get(month) || 0) + tx.amount);
            }));
            // If no transactions, generate demo months from today
            let revenueOverTime: { month: string; revenue: number }[];
            if (txByMonth.size === 0) {
              const now = new Date();
              revenueOverTime = Array.from({ length: 6 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
                return { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, revenue: 0 };
              });
            } else {
              revenueOverTime = Array.from(txByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, revenue]) => ({ month, revenue }));
            }

            return (
              <div className="max-w-[1400px] mx-auto space-y-6">
                <div>
                  <h1 className="text-xl font-bold text-slate-800 tracking-tight">Analytics</h1>
                  <p className="text-sm text-slate-400 mt-0.5">Revenue trends, engagement metrics, and AI-powered forecasts.</p>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label="Total Revenue" value={`$${totalRevenue.toFixed(0)}`} subtext={`${customers.length} contacts`} icon={DollarSign} />
                  <MetricCard label="Outstanding" value={`$${totalOutstanding.toFixed(0)}`} subtext="pending balances" icon={Activity} />
                  <MetricCard label="Avg. Revenue" value={`$${customers.length ? (totalRevenue / customers.length).toFixed(0) : "0"}`} subtext="per contact" icon={ArrowUpRight} />
                  <MetricCard label="Completed Sales" value={String(customers.filter(c => c.leadStatus === "Sale Completed").length)} subtext="converted leads" icon={Users} />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar Chart — Revenue by Lead Status */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-6">
                    <h2 className="text-sm font-bold text-slate-700 mb-1">Revenue by Lead Status</h2>
                    <p className="text-[10px] text-slate-400 mb-5">Breakdown of total revenue across pipeline stages</p>
                    {customers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16"><BarChart3 className="w-10 h-10 text-slate-200 mb-2" /><p className="text-xs text-slate-400">Add contacts to see revenue data</p></div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={revenueByStatus} barSize={40}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="status" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                          <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
                          <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="#6366f1">
                            {revenueByStatus.map((entry) => (
                              <rect key={entry.status} fill={statusColorMap[entry.status] || "#6366f1"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Line Chart — Revenue Over Time */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] p-6">
                    <h2 className="text-sm font-bold text-slate-700 mb-1">Revenue Over Time</h2>
                    <p className="text-[10px] text-slate-400 mb-5">Monthly revenue trend from transactions</p>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={revenueOverTime}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                        <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
                        <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Revenue Leaderboard Table */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#E5E7EB]">
                    <h2 className="text-sm font-bold text-slate-700">Top Customers by Revenue</h2>
                  </div>
                  {customers.length === 0 ? (
                    <EmptyAnalytics />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50/60">
                          <tr className="border-b border-[#E5E7EB]">
                            <th className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 pl-6 pr-4">Rank</th>
                            <th className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Customer</th>
                            <th className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Status</th>
                            <th className="text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Revenue</th>
                            <th className="text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 pr-6">Outstanding</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...customers].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10).map((c, i) => (
                            <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 pl-6 pr-4"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span></td>
                              <td className="py-3 px-4 font-semibold text-slate-800">{c.firstName} {c.lastName}</td>
                              <td className="py-3 px-4"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.leadStatus]||""}`}>{c.leadStatus}</span></td>
                              <td className="py-3 px-4 text-right font-semibold text-emerald-600">${c.totalRevenue.toFixed(2)}</td>
                              <td className="py-3 pr-6 text-right text-slate-500">${c.outstandingBalance.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          {/* ═══════════ SETTINGS VIEW ═══════════ */}
          {activeView === "settings" && (
            <div className="max-w-[900px] mx-auto space-y-6">
              <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Settings</h1>
                <p className="text-sm text-slate-400 mt-0.5">Manage tags, integrations, and CRM preferences.</p>
              </div>

              {/* Tag Manager */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
                  <Palette className="w-4 h-4 text-indigo-600" />
                  <h2 className="text-sm font-bold text-slate-700">Tag Manager</h2>
                </div>
                <div className="p-6 space-y-4">
                  {/* Existing Tags */}
                  <div className="space-y-2">
                    {customTags.map((tag, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                        <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm shrink-0" style={{ backgroundColor: tag.color }} />
                        {editingTagIdx === idx ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              value={tag.name}
                              onChange={e => setCustomTags(prev => prev.map((t, i) => i === idx ? { ...t, name: e.target.value } : t))}
                              className="flex-1 h-8 px-2 text-sm rounded-md border border-[#E5E7EB] bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <input
                              type="color"
                              value={tag.color}
                              onChange={e => setCustomTags(prev => prev.map((t, i) => i === idx ? { ...t, color: e.target.value } : t))}
                              className="w-8 h-8 rounded-md border border-[#E5E7EB] cursor-pointer"
                            />
                            <button onClick={() => setEditingTagIdx(null)} className="px-2.5 py-1 rounded-md bg-indigo-600 text-[10px] font-semibold text-white hover:bg-indigo-700 cursor-pointer">Done</button>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1 text-sm font-medium text-slate-700">{tag.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{tag.color}</span>
                            <button onClick={() => setEditingTagIdx(idx)} className="w-7 h-7 rounded-md hover:bg-white flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-pointer"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setCustomTags(prev => prev.filter((_, i) => i !== idx))} className="w-7 h-7 rounded-md hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500 cursor-pointer"><Trash className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add New Tag */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={e => setNewTagColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-[#E5E7EB] cursor-pointer shrink-0"
                    />
                    <input
                      value={newTagName}
                      onChange={e => setNewTagName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && newTagName.trim()) { setCustomTags(prev => [...prev, { name: newTagName.trim(), color: newTagColor }]); setNewTagName(""); } }}
                      placeholder="New tag name..."
                      className="flex-1 h-9 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                    />
                    <button
                      onClick={() => { if (newTagName.trim()) { setCustomTags(prev => [...prev, { name: newTagName.trim(), color: newTagColor }]); setNewTagName(""); } }}
                      disabled={!newTagName.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Integrations */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-indigo-600" />
                  <h2 className="text-sm font-bold text-slate-700">Integrations</h2>
                </div>
                <div className="p-6 space-y-5">
                  {/* Google Calendar */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" /> Google Calendar API Key
                    </label>
                    <input
                      value={integrations.googleCalendar}
                      onChange={e => setIntegrations({ ...integrations, googleCalendar: e.target.value })}
                      placeholder="AIzaSy..."
                      className="w-full h-10 px-4 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 font-mono"
                    />
                    <p className="text-[10px] text-slate-400">Enables real-time calendar sync for scheduled meetings.</p>
                  </div>

                  {/* Mail Provider */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <Mail className="w-3.5 h-3.5 text-indigo-500" /> Mail Provider API Key
                    </label>
                    <input
                      value={integrations.mailProvider}
                      onChange={e => setIntegrations({ ...integrations, mailProvider: e.target.value })}
                      placeholder="SG.xxxxx..."
                      className="w-full h-10 px-4 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 font-mono"
                    />
                    <p className="text-[10px] text-slate-400">Used for email campaigns (SendGrid, Resend, etc.).</p>
                  </div>

                  {/* WhatsApp */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <MessageSquare className="w-3.5 h-3.5 text-green-500" /> WhatsApp Business API Key
                    </label>
                    <input
                      value={integrations.whatsapp}
                      onChange={e => setIntegrations({ ...integrations, whatsapp: e.target.value })}
                      placeholder="whatsapp_business_xxxxx..."
                      className="w-full h-10 px-4 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 font-mono"
                    />
                    <p className="text-[10px] text-slate-400">Connects WhatsApp Business for direct messaging.</p>
                  </div>

                  <div className="pt-3 border-t border-[#E5E7EB]">
                    <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer">
                      <CalendarCheck className="w-4 h-4" /> Save Integrations
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ CAMPAIGNS VIEW ═══════════ */}
          {activeView === "campaigns" && (
            <CampaignCalendar />
          )}
          </>
          )}
        </main>
      </div>

      <ToastContainer />

      {/* ══════ FLOATING BULK ACTIONS BAR ══════ */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[85] bg-white rounded-xl border border-[#E5E7EB] shadow-xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-200">
          <span className="text-sm font-semibold text-slate-700">{selectedIds.size} selected</span>
          <div className="w-px h-6 bg-slate-200"></div>
          <button onClick={() => setShowEmailModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer">
            <MailPlus className="w-4 h-4" />New Email Campaign
          </button>
          <button onClick={() => { 
            const ids = Array.from(selectedIds); 
            if (window.confirm(`Are you sure you want to permanently delete ${ids.length} contact${ids.length === 1 ? '' : 's'}?`)) {
              bulkDelete(ids); 
              setSelectedIds(new Set()); 
            }
          }} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" />Delete
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">Clear</button>
        </div>
      )}

      {/* ══════ EMAIL CAMPAIGN MODAL ══════ */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); setEmailTab("compose"); setShowSignatureEditor(false); setShowDrafts(false); }}>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-4xl mx-4 overflow-hidden flex flex-col" style={{ maxHeight: "92vh" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0 bg-gradient-to-r from-indigo-50/50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <MailPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Email Campaign</h2>
                  <p className="text-xs text-slate-400 flex items-center gap-2">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{selectedCustomers.filter(c => c.email).length} recipients</span>
                    <span className="text-slate-300">·</span>
                    <span>{selectedCustomers.length} selected</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Tab Switcher */}
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  <button onClick={() => setEmailTab("compose")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${emailTab === "compose" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Compose</button>
                  <button onClick={() => setEmailTab("preview")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${emailTab === "preview" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Preview</button>
                </div>
                <button onClick={() => { setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); setEmailTab("compose"); }} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Recipients Bar */}
            <div className="px-6 py-3 border-b border-[#E5E7EB] bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To:</span>
                {selectedCustomers.slice(0, 8).map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[11px] font-medium text-slate-600 shadow-sm">
                    <span className="w-3.5 h-3.5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[7px] font-bold">{c.firstName[0]}</span>
                    {c.firstName} {c.lastName}
                  </span>
                ))}
                {selectedCustomers.length > 8 && <span className="text-[11px] text-slate-400 font-medium">+{selectedCustomers.length - 8} more</span>}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden flex">
              {/* Compose Panel — hidden when Preview tab is active on mobile */}
              <div className={`flex-1 flex flex-col overflow-y-auto ${emailTab === "preview" ? "hidden" : ""}`}>
                <div className="px-6 py-5 space-y-4 flex-1">
                  {/* Subject */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Subject Line</label>
                    <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full h-11 px-4 text-sm font-medium rounded-lg border border-[#E5E7EB] bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all" placeholder="e.g. Exciting update for our valued partners" />
                  </div>

                  {/* Email Body — LARGER */}
                  <div className="flex-1 flex flex-col">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Email Body</label>
                    <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} className="w-full flex-1 min-h-[320px] px-4 py-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all resize-none leading-relaxed" placeholder={"Write your email content here...\n\nUse line breaks to create paragraphs. Your signature will be appended automatically."} />
                  </div>

                  {/* Signature Block */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Edit3 className="w-3 h-3" />Email Signature</span>
                      <button onClick={() => setShowSignatureEditor(!showSignatureEditor)} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer">
                        {emailSignature ? "Edit" : "+ Add Signature"}
                      </button>
                    </div>
                    {emailSignature && !showSignatureEditor && (
                      <div className="px-4 py-3 border-t border-slate-100 text-sm text-slate-600">
                        {emailSignature.logoUrl && <img src={emailSignature.logoUrl} alt="Logo" className="max-h-12 max-w-[140px] mb-2" />}
                        <p className="font-normal">{emailSignature.signoff},</p>
                        {emailSignature.name && (
                          <p className={`mt-0.5 ${emailSignature.useCursive ? "text-xl text-slate-800" : "font-bold"}`} style={emailSignature.useCursive ? { fontFamily: "'Dancing Script', cursive" } : undefined}>{emailSignature.name}</p>
                        )}
                        {(emailSignature.role || emailSignature.company) && <p className="text-xs text-slate-400">{[emailSignature.role, emailSignature.company].filter(Boolean).join(" | ")}</p>}
                        {(emailSignature.phone || emailSignature.website) && <p className="text-[11px] text-slate-400 mt-0.5">{[emailSignature.phone, emailSignature.website].filter(Boolean).join(" · ")}</p>}
                      </div>
                    )}
                    {showSignatureEditor && (
                      <div className="px-4 py-4 border-t border-slate-100 space-y-3">
                        {/* Logo Upload */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1 block"><ImagePlus className="w-3 h-3" />Company Logo / Image</label>
                          <div className="flex items-center gap-3">
                            {sigForm.logoUrl ? (
                              <div className="relative group">
                                <img src={sigForm.logoUrl} alt="Logo" className="h-10 max-w-[120px] rounded border border-slate-200 object-contain bg-white p-1" />
                                <button onClick={() => setSigForm(f => ({...f, logoUrl: ""}))} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                              </div>
                            ) : null}
                            <label className="px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-[11px] font-medium text-slate-500 hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 transition-colors">
                              <ImagePlus className="w-3 h-3" />{isUploadingLogo ? "Uploading..." : sigForm.logoUrl ? "Change" : "Upload Logo"}
                              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                            </label>
                            <span className="text-[9px] text-slate-400">Max 500KB</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Sign-off</label>
                            <input value={sigForm.signoff} onChange={e => setSigForm(f => ({...f, signoff: e.target.value}))} className="w-full h-9 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" placeholder="Best regards" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Full Name</label>
                            <input value={sigForm.name} onChange={e => setSigForm(f => ({...f, name: e.target.value}))} className="w-full h-9 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" placeholder="Lucas Huff" />
                          </div>
                        </div>
                        {/* Cursive toggle */}
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                          <PenTool className="w-3.5 h-3.5 text-indigo-500" />
                          <div className="flex-1">
                            <p className="text-[11px] font-semibold text-slate-600">Cursive Signature</p>
                            <p className="text-[9px] text-slate-400">Display your name in an elegant handwritten font</p>
                          </div>
                          <button onClick={() => setSigForm(f => ({...f, useCursive: !f.useCursive}))} className="cursor-pointer">
                            {sigForm.useCursive ? <ToggleRight className="w-7 h-7 text-indigo-600" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                          </button>
                        </div>
                        {sigForm.useCursive && sigForm.name && (
                          <div className="px-3 py-2 bg-white rounded-lg border border-slate-200">
                            <p className="text-[9px] text-slate-400 mb-1 uppercase tracking-wider font-semibold">Preview</p>
                            <p className="text-2xl text-slate-800" style={{ fontFamily: "'Dancing Script', cursive" }}>{sigForm.name}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Title / Role</label>
                            <input value={sigForm.role} onChange={e => setSigForm(f => ({...f, role: e.target.value}))} className="w-full h-9 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" placeholder="CEO" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Company</label>
                            <input value={sigForm.company} onChange={e => setSigForm(f => ({...f, company: e.target.value}))} className="w-full h-9 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" placeholder="SOL Theory" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Phone</label>
                            <input value={sigForm.phone} onChange={e => setSigForm(f => ({...f, phone: e.target.value}))} className="w-full h-9 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" placeholder="+1 (555) 123-4567" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Website</label>
                            <input value={sigForm.website} onChange={e => setSigForm(f => ({...f, website: e.target.value}))} className="w-full h-9 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" placeholder="www.soltheory.com" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button onClick={saveSignature} className="px-4 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer">Save Signature</button>
                          <button onClick={() => setShowSignatureEditor(false)} className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-xs font-medium text-slate-500 hover:bg-slate-50 cursor-pointer">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview Panel — full-width when Preview tab is active */}
              <div className={`flex flex-col overflow-y-auto ${emailTab === "preview" ? "flex-1" : "hidden lg:flex lg:w-[380px] lg:shrink-0"} border-l border-[#E5E7EB] bg-slate-50`}>
                <div className="px-5 py-3 border-b border-slate-200 bg-white">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />Email Preview</h4>
                </div>
                <div className="flex-1 p-5 flex justify-center">
                  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full ${emailTab === "preview" ? "max-w-2xl" : ""}`}>
                    {/* Fake email header */}
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">{(emailSignature?.name || user?.displayName || "Y")[0]}</div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{emailSignature?.name || user?.displayName || "You"}</p>
                          <p className="text-[11px] text-slate-400">to {selectedCustomers.filter(c=>c.email).length} recipients</p>
                        </div>
                      </div>
                      <p className={`font-bold text-slate-800 ${emailTab === "preview" ? "text-lg" : "text-sm"}`}>{emailSubject || "(No subject)"}</p>
                    </div>
                    {/* Email body preview */}
                    <div className={`px-6 py-5 text-slate-700 leading-relaxed ${emailTab === "preview" ? "text-base min-h-[300px]" : "text-sm min-h-[150px]"}`}>
                      {emailBody ? emailBody.split('\n').map((line, i) => (
                        <p key={i} className="mb-3 last:mb-0">{line || <>&nbsp;</>}</p>
                      )) : <p className="text-slate-400 italic">Your email content will appear here...</p>}
                      {emailSignature && (
                        <div className="border-t border-slate-100 pt-3 mt-6 text-slate-500">
                          {emailSignature.logoUrl && <img src={emailSignature.logoUrl} alt="Logo" className="max-h-12 max-w-[140px] mb-2" />}
                          <p>{emailSignature.signoff},</p>
                          {emailSignature.name && (
                            <p className={`mt-0.5 ${emailSignature.useCursive ? "text-xl text-slate-800" : "font-bold text-slate-700"}`} style={emailSignature.useCursive ? { fontFamily: "'Dancing Script', cursive" } : undefined}>{emailSignature.name}</p>
                          )}
                          {(emailSignature.role || emailSignature.company) && <p className="text-xs text-slate-400">{[emailSignature.role, emailSignature.company].filter(Boolean).join(" | ")}</p>}
                          {(emailSignature.phone || emailSignature.website) && <p className="text-[11px] text-slate-400 mt-0.5">{[emailSignature.phone, emailSignature.website].filter(Boolean).join(" · ")}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-[#E5E7EB] bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 font-medium">{selectedCustomers.filter(c => c.email).length} of {selectedCustomers.length} have email</span>
                {/* Draft controls */}
                <div className="relative">
                  <button onClick={() => setShowDrafts(!showDrafts)} className="text-[11px] text-indigo-600 font-semibold hover:text-indigo-700 cursor-pointer flex items-center gap-1">
                    <Download className="w-3 h-3" />{campaignDrafts.length > 0 ? `Drafts (${campaignDrafts.length})` : "Drafts"}
                  </button>
                  {showDrafts && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-xl border border-slate-200 shadow-xl z-10 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Saved Drafts</span>
                        <button onClick={() => setShowDrafts(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {campaignDrafts.length === 0 ? (
                          <p className="px-4 py-4 text-xs text-slate-400 text-center">No drafts saved yet</p>
                        ) : campaignDrafts.map(draft => (
                          <div key={draft.id} className="px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between group cursor-pointer" onClick={() => loadDraft(draft)}>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">{draft.subject || "(No subject)"}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{new Date(draft.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); deleteDraft(draft.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-all cursor-pointer"><Trash className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={saveDraft} disabled={!emailSubject.trim()} className="px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"><Download className="w-3 h-3" />Save Draft</button>
                <button onClick={() => { setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); setEmailTab("compose"); }} className="px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button disabled={!emailSubject.trim() || !emailBody.trim() || isSendingCampaign} onClick={handleSendCampaign} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 text-xs font-bold text-white hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer">
                  {isSendingCampaign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {isSendingCampaign ? "Sending..." : "Send Campaign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ JARVIS COPILOT TOGGLE ══════ */}
      <button
        onClick={() => setIsJarvisOpen(!isJarvisOpen)}
        className={`fixed bottom-6 right-6 z-[90] w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all cursor-pointer ${isJarvisOpen ? "bg-slate-700 hover:bg-slate-800" : "bg-indigo-600 hover:bg-indigo-700"} text-white`}
      >
        {isJarvisOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>

      {/* ══════ JARVIS COPILOT SIDEBAR ══════ */}
      <div className={`fixed top-0 right-0 h-full z-[80] transition-transform duration-300 ease-in-out ${isJarvisOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="w-[380px] h-full bg-white border-l border-[#E5E7EB] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-[#E5E7EB] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 leading-tight">Jarvis AI Copilot</h3>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Online</span>
              </div>
            </div>
            <button onClick={() => setIsJarvisOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer">
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-md"
                    : "bg-slate-100 text-slate-700 rounded-bl-md border border-slate-200"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[#E5E7EB] px-4 py-3 shrink-0 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={jarvisInput}
                onChange={e => setJarvisInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleJarvisSend(); }}
                placeholder="Ask Jarvis anything..."
                className="flex-1 h-10 px-3.5 text-sm rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
              />
              <button
                onClick={handleJarvisSend}
                disabled={!jarvisInput.trim()}
                className="w-10 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">Try &quot;show all contacts&quot; or &quot;add contact Jane Doe&quot;</p>
          </div>
        </div>
      </div>

      {/* ══════ ADD CONTACT MODAL ══════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={()=>{setShowAddModal(false);resetForm();}}>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB]">
              <h2 className="text-lg font-bold text-slate-800">Add New Contact</h2>
              <button onClick={()=>{setShowAddModal(false);resetForm();}} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer"><X className="w-4 h-4"/></button>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">First Name *</label><input value={form.firstName} onChange={e=>setForm(f=>({...f,firstName:e.target.value}))} className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" placeholder="First name"/></div>
                <div><label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Last Name *</label><input value={form.lastName} onChange={e=>setForm(f=>({...f,lastName:e.target.value}))} className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" placeholder="Last name"/></div>
              </div>
              <div><label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Email</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} type="email" className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" placeholder="email@example.com"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" placeholder="+1 (555) 000-0000"/></div>
                <div><label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Birthday</label><input value={form.birthday} onChange={e=>setForm(f=>({...f,birthday:e.target.value}))} type="date" className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"/></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Status</label><select value={form.leadStatus} onChange={e=>setForm(f=>({...f,leadStatus:e.target.value as Customer["leadStatus"]}))} className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"><option>Cold Lead</option><option>Warm Lead</option><option>Interested</option><option>Sale Completed</option></select></div>
                <div><label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Tags</label><input value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" placeholder="VIP, Enterprise"/></div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E5E7EB] bg-slate-50/50">
              <button onClick={()=>{setShowAddModal(false);resetForm();}} className="px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button onClick={handleAddContact} disabled={!form.firstName.trim()||!form.lastName.trim()} className="px-5 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer">Add Contact</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ TOAST NOTIFICATIONS ══════ */}
      <ToastContainer />
    </div>
  );
}
