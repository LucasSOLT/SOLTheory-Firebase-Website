"use client";

import CampaignCalendar from "@/components/crm/CampaignCalendar";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/components/ThemeProvider';

import KPIHeaderStrip from "@/components/crm/KPIHeaderStrip";
import CRMCommandPalette from "@/components/crm/CRMCommandPalette";
import BulkActionsBar from "@/components/crm/BulkActionsBar";
import PipelineSetup from "@/components/crm/PipelineSetup";
import type { PipelineConfig } from "@/components/crm/PipelineSetup";
import CRMFollowUps from "@/components/crm/views/CRMFollowUps";
import FilterBuilder from "@/components/crm/FilterBuilder";
import type { SavedSegment } from "@/components/crm/FilterBuilder";
import DuplicateDetector, { getDuplicateCount } from "@/components/crm/DuplicateDetector";
import AIInsightsPanel from "@/components/crm/AIInsightsPanel";
import CRMSettingsView from "@/components/crm/views/CRMSettingsView";
import InlineEditCell from "@/components/crm/InlineEditCell";
import { useCrmPermissions } from "@/hooks/useCrmPermissions";

import { useUser, useFirestore } from "@/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { useCRMStore, INITIAL_TAGS } from "@/stores/crm-store";
import type { Customer, Meeting, CrmNotification, Conversation, InboxMessage, InboxChannel, TicketStatus, ChatMessage } from "@/stores/crm-store";
import { ToastContainer } from "@/components/crm/Toast";
import { DashboardSkeleton, AnalyticsSkeleton } from "@/components/crm/Skeletons";
import PipelineBoard from "@/components/crm/views/PipelineBoard";
import ContactProfilePanel from "@/components/crm/contact-profile/ContactProfilePanel";
import ManageFieldsSidebar from "@/components/crm/ManageFieldsSidebar";
import CSVFieldMergeDialog from "@/components/crm/CSVFieldMergeDialog";
import ExportModal from "@/components/crm/ExportModal";
import { useContactFields } from "@/hooks/useContactFields";
import {
  type ContactFieldDef,
  matchAllCSVHeaders,
  needsMergeDialog,
  createCustomField,
  type CSVFieldMatch,
  type FieldConfig,
  type MatchResult
} from "@/lib/contactFieldTypes";
import { parseCSV } from "@/lib/utils";
import {
  Search, Plus, Bell, LayoutDashboard, Users, GitBranch, BarChart3,
  UserPlus, Mail, ChevronDown, ChevronUp, Filter, Download, Brain,
  Phone, DollarSign, Activity, ArrowUpRight, MoreHorizontal, X,
  MessageCircle, PanelRightClose, PanelRightOpen, Send, Sparkles, Trash2,
  CheckSquare, Square, Tag, MailPlus, Calendar, Clock, ToggleLeft, ToggleRight,
  CalendarCheck, Check, Eye, MessageSquare, Smartphone, Hash, Zap, SearchX,
  Menu, Palette, Link2, Edit3, Trash, Loader2, ImagePlus, PenTool, CalendarRange,
  Table2, MapPin, Building2, ChevronLeft, ChevronRight, AlertTriangle, Save, Contact,
  Settings2, ArrowUpDown, ArrowUp, ArrowDown, Copy, Maximize2, Minimize2,
  Database, CheckCircle2,
} from "lucide-react";
import { logActivity } from '@/lib/activity-logger';
import { getAuthHeaders } from '@/lib/api-auth-client';

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

const STANDARD_TAGS = [
  // C-Suite / Executive
  "CEO", "COO", "CFO", "CTO", "CMO", "CIO", "CHRO", "CRO", "President", "Founder", "Co-Founder", "VP of Engineering", "VP of Sales", "VP of Marketing", "Director", "Executive Board", "Board Member",
  // Management
  "General Manager", "Manager", "Team Lead", "Supervisor", "Project Manager", "Product Owner", "Operations Lead", "Branch Manager",
  // Roles / Jobs
  "Employee", "Contractor", "Consultant", "Freelancer", "Intern", "Advisor", "Specialist", "Analyst", "Engineer", "Developer", "Designer", "UX Writer", "Content Strategist", "Marketer", "Copywriter", "Sales Executive", "Account Executive", "Business Analyst", "System Administrator", "HR Manager", "Recruiter", "Legal Counsel", "Accountant", "Executive Assistant",
  // Customer Types / Segments
  "Client", "User", "Customer", "Lead", "Warm Lead", "Cold Lead", "Hot Lead", "Prospect", "Active Client", "Inactive Client", "Churned Client", "Enterprise Client", "SMB Client", "SME Client", "VIP Client", "High-Value Client", "Low-Value Client", "Key Account", "Target Account",
  // Lead Sources / Lifecycle
  "MQL", "SQL", "Inbound Lead", "Outbound Lead", "Referral", "Partner", "Affiliate", "Reseller", "Distributor", "Supplier", "Vendor", "Subcontractor", "Stakeholder", "Investor", "Angel Investor", "Venture Capitalist",
  // Status / Engagement
  "Subscriber", "Newsletter Subscriber", "Subscribed", "Unsubscribed", "Opt-In", "Opt-Out", "Do Not Contact", "Blacklisted", "Advocate", "Influencer", "Brand Ambassador", "Beta Tester", "Early Adopter", "Event Attendee", "Webinar Registrant", "Community Member", "Alumni", "Media/Press"
];

interface TagSelectorProps {
  value: string;
  onChange: (val: string) => void;
  isDarkMode: boolean;
}

function TagSelector({ value, onChange, isDarkMode }: TagSelectorProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedTags = useMemo(() => {
    return value
      ? value.split(",").map(t => t.trim()).filter(Boolean)
      : [];
  }, [value]);

  const filteredTags = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) {
      return STANDARD_TAGS.filter(tag => !selectedTags.includes(tag)).slice(0, 15);
    }
    return STANDARD_TAGS.filter(tag => 
      tag.toLowerCase().includes(query) && !selectedTags.includes(tag)
    );
  }, [search, selectedTags]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (!selectedTags.includes(trimmed)) {
      const updated = [...selectedTags, trimmed];
      onChange(updated.join(", "));
    }
    setSearch("");
  };

  const removeTag = (tagToRemove: string) => {
    const updated = selectedTags.filter(t => t !== tagToRemove);
    onChange(updated.join(", "));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (search.trim()) {
        addTag(search);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selectedTags.map(tag => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all ${
              isDarkMode
                ? "bg-indigo-950/40 text-indigo-300 border-indigo-900/60 hover:bg-indigo-900/40"
                : "bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100"
            }`}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-red-500 rounded-full w-3.5 h-3.5 flex items-center justify-center transition-colors focus:outline-none cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search standard tags or type custom..."
          className={`w-full h-9 px-3 pr-8 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${
            isDarkMode ? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-500" : "border-[#E5E7EB] bg-[#F9FAFB] text-slate-700 placeholder:text-slate-400"
          }`}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
          <Search className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

      {isOpen && (filteredTags.length > 0 || search.trim()) && (
        <div
          className={`absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border shadow-xl z-[150] py-1 ${
            isDarkMode ? "bg-slate-800 border-slate-700 text-white shadow-black/40" : "bg-white border-slate-200 text-slate-700 shadow-slate-200/50"
          }`}
        >
          {filteredTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                isDarkMode ? "hover:bg-slate-700 text-indigo-400" : "hover:bg-slate-50 text-indigo-600"
              }`}
            >
              + {tag}
            </button>
          ))}
          {search.trim() && !STANDARD_TAGS.includes(search.trim()) && !selectedTags.includes(search.trim()) && (
            <button
              type="button"
              onClick={() => addTag(search)}
              className={`w-full text-left px-3 py-1.5 text-xs font-bold border-t transition-colors cursor-pointer ${
                isDarkMode ? "border-slate-700 hover:bg-slate-700 text-amber-400" : "border-slate-100 hover:bg-slate-50 text-amber-600"
              }`}
            >
              + Add Custom: &quot;{search.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── NAV CONFIG ─────────────────────────── */

const crmNavItems = [
  { id: "dashboard", label: "Database", icon: Table2 },
  { id: "board", label: "Pipeline", icon: LayoutDashboard },
  { id: "follow_ups", label: "Follow-Ups", icon: CalendarCheck },
  { id: "insights", label: "Insights", icon: Sparkles },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;

type CrmView = "dashboard" | "board" | "campaigns" | "analytics" | "follow_ups" | "insights" | "settings";

/* ─── AVATAR COLOR HELPER ─── */

const AVATAR_PALETTE = [
  { bg: "bg-slate-200 dark:bg-slate-700", text: "text-slate-600 dark:text-slate-300" },
  { bg: "bg-stone-200 dark:bg-stone-700", text: "text-stone-600 dark:text-stone-300" },
  { bg: "bg-zinc-200 dark:bg-zinc-700", text: "text-zinc-600 dark:text-zinc-300" },
  { bg: "bg-neutral-200 dark:bg-neutral-700", text: "text-neutral-600 dark:text-neutral-300" },
  { bg: "bg-gray-200 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-300" },
  { bg: "bg-slate-300 dark:bg-slate-600", text: "text-slate-700 dark:text-slate-200" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/* ─── STATUS & TAG HELPERS ─── */

/* ─── RELATIVE TIME HELPER ─── */
function getRelativeTime(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const getStatusLabel = (status: string, isSpanish: boolean) => {
  if (!isSpanish) return status;
  switch (status) {
    case "Cold Lead": return "Prospecto Frío";
    case "Warm Lead": return "Prospecto Tibio";
    case "Interested": return "Interesado";
    case "Sale Completed": return "Venta Completada";
    default: return status;
  }
};

const getTagStyles = (tag: string) => {
  switch (tag) {
    case "VIP": return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
    case "Enterprise": return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800";
    case "Inbound": return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800";
    case "Referral": return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
    case "High-Value": return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800";
    default: return "bg-[#faf6ed] text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700";
  }
};

const getStatusStyles = (status: string) => {
  switch (status) {
    case "Cold Lead": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800";
    case "Warm Lead": return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800";
    case "Interested": return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800";
    case "Sale Completed": return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
    default: return "bg-[#faf6ed] text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700";
  }
};

/* ─── EMPTY STATES ─── */

function EmptyContacts({ onAdd }: { onAdd: () => void }) {
  const { t, lang } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-400">
        <Users className="w-9 h-9" />
      </div>
      <h3 className="text-lg font-semibold mb-1.5 text-slate-800 dark:text-white">{t.crmNoContactsYet}</h3>
      <p className="text-sm text-center max-w-sm mb-6 leading-relaxed text-slate-500 dark:text-slate-400">
        {t.crmNoContactsDesc}
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/10 cursor-pointer"
      >
        <UserPlus className="w-4 h-4" />
        {t.crmAddFirstContact}
      </button>
    </div>
  );
}

function EmptyPipeline() {
  const { t, lang } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-400">
        <GitBranch className="w-9 h-9" />
      </div>
      <h3 className="text-lg font-semibold mb-1.5 text-slate-800 dark:text-white">{t.crmPipelineEmpty}</h3>
      <p className="text-sm text-center max-w-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {t.crmPipelineEmptyDesc}
      </p>
    </div>
  );
}

function EmptyInbox() {
  const { t, lang } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-400">
        <Mail className="w-9 h-9" />
      </div>
      <h3 className="text-lg font-semibold mb-1.5 text-slate-800 dark:text-white">{t.crmInboxClear}</h3>
      <p className="text-sm text-center max-w-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {t.crmInboxClearDesc}
      </p>
    </div>
  );
}

function EmptyAnalytics() {
  const { t, lang } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-400">
        <BarChart3 className="w-9 h-9" />
      </div>
      <h3 className="text-lg font-semibold mb-1.5 text-slate-800 dark:text-white">{t.crmNoDataAnalyze}</h3>
      <p className="text-sm text-center max-w-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {t.crmNoDataAnalyzeDesc}
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
    <div className="p-5 flex flex-col gap-2.5 border-b border-r bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-white">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div>
        <span className="text-xl font-bold tracking-tight">{value}</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          {trend && (
            <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              {trend}
            </span>
          )}
          <span className="text-[10px] text-slate-400">{subtext}</span>
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
  const crmSettings = useCRMStore((s) => s.crmSettings);
  const saveCrmSettings = useCRMStore((s) => s.saveCrmSettings);
  const activeInstanceId = useCRMStore((s) => s.activeInstanceId);
  const availableInstances = useCRMStore((s) => s.availableInstances);
  const switchInstance = useCRMStore((s) => s.switchInstance);
  const createInstance = useCRMStore((s) => s.createInstance);
  const deleteInstance = useCRMStore((s) => s.deleteInstance);
  const renameInstance = useCRMStore((s) => s.renameInstance);
  const loadInstances = useCRMStore((s) => s.loadInstances);
  const [showDbDropdown, setShowDbDropdown] = useState(false);
  const [showNewDbInput, setShowNewDbInput] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  /* Inline CRM label editing */
  const [isEditingCrmLabel, setIsEditingCrmLabel] = useState(false);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const crmLabelInputRef = useRef<HTMLInputElement>(null);
  const [activeView, setActiveViewRaw] = useState<CrmView>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('crm_active_view') as CrmView | null;
      if (saved && ["dashboard", "board", "campaigns", "analytics", "follow_ups", "insights", "settings"].includes(saved)) {
        return saved;
      }
    }
    return "dashboard";
  });
  // Wrap setActiveView to also persist to localStorage
  const setActiveView = useCallback((view: CrmView) => {
    setActiveViewRaw(view);
    if (typeof window !== 'undefined') {
      localStorage.setItem('crm_active_view', view);
    }
  }, []);
  const { t, lang } = useTranslation();
  const { isDarkMode } = useTheme();

  /* ─────────── RBAC ─────────── */
  const { canEdit: rbacCanEdit, canDelete: rbacCanDelete, canExport: rbacCanExport, canImport: rbacCanImport, canManageFields: rbacCanManageFields, canManageRoles: rbacCanManageRoles } = useCrmPermissions();

  /* ─────────── INLINE EDIT HANDLER ─────────── */
  const handleInlineSave = useCallback((contactId: string, fieldId: string, newValue: any) => {
    const knownKeys = ['firstName', 'lastName', 'email', 'phone', 'company', 'leadStatus', 'location',
      'totalRevenue', 'outstandingBalance', 'tags', 'notes', 'aiNotes', 'jobTitle', 'department',
      'industry', 'role', 'service', 'birthday', 'website', 'linkedinUrl', 'twitterHandle', 'facebookUrl', 'instagramHandle',
      'mobilePhone', 'workPhone', 'secondaryEmail', 'tertiaryEmail', 'lastContactedDate', 'dateCreated', 'dateModified'];
    
    if (knownKeys.includes(fieldId)) {
      store.updateCustomer(contactId, { [fieldId]: newValue });
    } else {
      const customer = customers.find(c => c.id === contactId);
      const existingCustom = (customer as any)?.customFields || {};
      store.updateCustomer(contactId, { customFields: { ...existingCustom, [fieldId]: newValue } } as any);
    }
  }, [store, customers]);
  const getCrmNavLabel = (id: string) => {
    switch (id) {
      case "dashboard": return "Database";
      case "board": return "Pipeline";
      case "follow_ups": return "Follow-Ups";
      case "insights": return "Insights";
      case "settings": return "Settings";
      case "campaigns": return t.crmCampaignManager;
      case "analytics": return t.crmAnalytics;
      default: return "";
    }
  };
  // Command palette state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  // Pipeline setup state
  const [showPipelineSetup, setShowPipelineSetup] = useState(false);
  // Smart Filters state
  const [segmentFilterFn, setSegmentFilterFn] = useState<((c: Customer) => boolean) | null>(null);
  const [savedSegments, setSavedSegments] = useState<SavedSegment[]>([]);
  // Duplicate detector state
  const [showDuplicateDetector, setShowDuplicateDetector] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [editingTagIdx, setEditingTagIdx] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDashAddDropdownOpen, setIsDashAddDropdownOpen] = useState(false);
  const [isContactsAddDropdownOpen, setIsContactsAddDropdownOpen] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  // Column-level sort (independent, takes priority over sortKey/sortDir)
  const [columnSortField, setColumnSortField] = useState<string | null>(null);
  const [columnSortDir, setColumnSortDir] = useState<'asc' | 'desc'>('asc');
  // Column widths for manual/auto-fit resize — persisted to localStorage
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('crm_column_widths');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {};
  });
  const tableRef = useRef<HTMLTableElement>(null);
  const resizingRef = useRef<{ fieldId: string; startX: number; startWidth: number } | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactsViewMode, setContactsViewMode] = useState<"table" | "pipeline">("table");
  const CRM_BATCH_SIZE = 200;
  const [visibleCount, setVisibleCount] = useState(CRM_BATCH_SIZE);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<string>("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [tableViewMode, setTableViewMode] = useState<"database" | "simplified" | "contacts">("database");
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const isSimplifiedView = tableViewMode === "simplified";
  const [mruPresetTag, setMruPresetTag] = useState<string | null>(null);
  const [fieldFilters, setFieldFilters] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFilterFrom, setDateFilterFrom] = useState("");
  const [dateFilterTo, setDateFilterTo] = useState("");
  const hasActiveFilters = !!tagFilter || !!statusFilter || !!dateFilterFrom || !!dateFilterTo || Object.values(fieldFilters).some(Boolean);
  const clearAllFilters = () => { setTagFilter(""); setStatusFilter(""); setDateFilterFrom(""); setDateFilterTo(""); setFieldFilters({}); };
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [emailSendMode, setEmailSendMode] = useState<"individual" | "cc">("individual");
  const [isEmailMaximized, setIsEmailMaximized] = useState(false);
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

  // ── Manage Fields state ──
  const [showManageFields, setShowManageFields] = useState(false);
  const contactFieldsHook = useContactFields("crm");
  const { fieldConfig, setVisibleFields, addCustomField: hookAddCustomField, addFieldsFromCSV, saveConfig, getVisibleFieldDefs, applyConfig } = contactFieldsHook;

  // ── CSV Merge Dialog state ──
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [csvMergeMatches, setCsvMergeMatches] = useState<CSVFieldMatch[]>([]);
  const [csvMergeHeaders, setCsvMergeHeaders] = useState<string[]>([]);
  const [pendingCSVData, setPendingCSVData] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);

  // ── Export Modal state ──
  const [showExportModal, setShowExportModal] = useState(false);

  // ── Sidebar collapse state ──
  const presetTagNames = useMemo(() => INITIAL_TAGS.map(t => t.name), []);
  const sortedAvailableTags = useMemo(() => {
    const allNames = customTags.map(t => t.name);
    const customNames = allNames.filter(name => !presetTagNames.includes(name));
    const presetNames = presetTagNames.filter(name => allNames.includes(name));
    
    if (mruPresetTag && presetNames.includes(mruPresetTag)) {
      const idx = presetNames.indexOf(mruPresetTag);
      presetNames.splice(idx, 1);
      presetNames.unshift(mruPresetTag);
    }
    
    return [...customNames, ...presetNames];
  }, [customTags, presetTagNames, mruPresetTag]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('crm_sidebar_collapsed') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('crm_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);


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
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  // ── Multi-user edit, contact view, delete confirm state ──
  const [editModalIds, setEditModalIds] = useState<string[]>([]);
  const [editModalIndex, setEditModalIndex] = useState(0);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [showContactView, setShowContactView] = useState(false);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Known Customer property keys (everything else goes to customFields)
  const KNOWN_CUSTOMER_KEYS = new Set([
    "firstName", "lastName", "email", "phone", "company", "location",
    "birthday", "leadStatus", "tags", "totalRevenue", "outstandingBalance",
    "aiNotes", "lastContactedDate",
  ]);

  const buildEditFormFromCustomer = (c: Customer) => {
    const form: Record<string, any> = {};
    const visibleFields = getVisibleFieldDefs();
    for (const field of visibleFields) {
      if (KNOWN_CUSTOMER_KEYS.has(field.id)) {
        const val = (c as any)[field.id];
        // Tags: join as comma-separated for editing
        if (field.id === "tags" && Array.isArray(val)) {
          form[field.id] = val.join(", ");
        } else {
          form[field.id] = val ?? "";
        }
      } else {
        form[field.id] = c.customFields?.[field.id] ?? "";
      }
    }
    return form;
  };

  const openEditModal = (ids: string[]) => {
    if (ids.length === 0) return;
    setEditModalIds(ids);
    setEditModalIndex(0);
    const c = customers.find(x => x.id === ids[0]);
    if (c) setEditForm(buildEditFormFromCustomer(c));
  };

  const saveEditForm = async (customerId: string) => {
    setIsSavingEdit(true);
    const visibleFields = getVisibleFieldDefs();
    const existingCustomer = customers.find(x => x.id === customerId);
    const directUpdates: Partial<Customer> = {};
    const customFieldUpdates: Record<string, any> = {};
    let hasChanges = false;
    for (const field of visibleFields) {
      const val = editForm[field.id];
      if (KNOWN_CUSTOMER_KEYS.has(field.id)) {
        let newVal: any;
        if (field.id === "tags") {
          newVal = typeof val === "string"
            ? val.split(",").map((t: string) => t.trim()).filter(Boolean)
            : Array.isArray(val) ? val : [];
          const oldVal = (existingCustomer as any)?.tags ?? [];
          if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
            (directUpdates as any).tags = newVal;
            hasChanges = true;
          }
        } else if (field.type === "number" || field.type === "currency") {
          newVal = parseFloat(val) || 0;
          if (newVal !== ((existingCustomer as any)?.[field.id] ?? 0)) {
            (directUpdates as any)[field.id] = newVal;
            hasChanges = true;
          }
        } else {
          newVal = val ?? "";
          if (newVal !== ((existingCustomer as any)?.[field.id] ?? "")) {
            (directUpdates as any)[field.id] = newVal;
            hasChanges = true;
          }
        }
      } else {
        const newVal = val ?? "";
        const oldVal = existingCustomer?.customFields?.[field.id] ?? "";
        if (newVal !== oldVal) {
          customFieldUpdates[field.id] = newVal;
          hasChanges = true;
        }
      }
    }
    if (hasChanges) {
      // Merge customFields with existing ones (don't overwrite fields not visible)
      const mergedCustomFields = { ...(existingCustomer?.customFields || {}), ...customFieldUpdates };
      await store.updateCustomer(customerId, { ...directUpdates, ...(Object.keys(customFieldUpdates).length > 0 ? { customFields: mergedCustomFields } : {}) } as Partial<Customer>);
      showToast("Contact updated successfully", "success");
    }
    setIsSavingEdit(false);
  };

  const navigateEdit = async (direction: "prev" | "next") => {
    // Auto-save current before navigating
    const currentId = editModalIds[editModalIndex];
    if (currentId) await saveEditForm(currentId);
    const newIndex = direction === "next" ? editModalIndex + 1 : editModalIndex - 1;
    if (newIndex < 0 || newIndex >= editModalIds.length) return;
    setEditModalIndex(newIndex);
    const c = customers.find(x => x.id === editModalIds[newIndex]);
    if (c) setEditForm(buildEditFormFromCustomer(c));
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    bulkDelete(ids);
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
    showToast(`Deleted ${ids.length} contact${ids.length === 1 ? "" : "s"}`, "success");
  };
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
    if (recipientsWithEmails.length > 100) {
      showToast("Maximum 100 recipients per batch. Please select fewer contacts.", "error");
      return;
    }
    
    const modeLabel = emailSendMode === "cc" ? "CC'd together in one email" : "sent individually";
    const isConfirmed = window.confirm(`Send this email to ${recipientsWithEmails.length} recipient${recipientsWithEmails.length === 1 ? '' : 's'}? (${modeLabel})`);
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
      const authHeaders = await getAuthHeaders();
      const res = await fetch("/api/crm/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          refreshToken: rToken,
          subject: emailSubject,
          htmlBody: formattedBody,
          recipients: recipientsWithEmails.map(c => c.email),
          sendMode: emailSendMode,
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        showToast(`✅ Successfully sent ${data.sentCount} emails!`);
        logActivity(db, 'item_created', { email: user?.email || '', displayName: user?.displayName }, 'Sent email campaign: ' + emailSubject);
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

  // Load pipeline config + CRM settings + available databases on mount
  useEffect(() => {
    if (user?.uid && db) {
      store.loadPipelineConfig();
      store.loadCrmSettings().then(() => {
        // If no localStorage override exists, use the Firestore defaultView as initial landing page
        const saved = localStorage.getItem('crm_active_view');
        if (!saved) {
          const dv = store.crmSettings.defaultView;
          if (dv && dv !== "dashboard") {
            setActiveView(dv);
          }
        }
      });
      loadInstances();
    }
  }, [user?.uid, db]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;

      // ⌘K / Ctrl+K: Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      // Don't trigger shortcuts when typing in inputs
      if (isInput) return;

      // N: New contact
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowAddModal(true);
        return;
      }

      // /: Focus search
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search..."]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
        return;
      }

      // Esc: Close panels/modals
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) { setIsCommandPaletteOpen(false); return; }
        if (showPipelineSetup) { setShowPipelineSetup(false); return; }
        if (showDuplicateDetector) { setShowDuplicateDetector(false); return; }
        if (showFilterPanel) { setShowFilterPanel(false); return; }
        if (selectedContactId) { setSelectedContactId(null); return; }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, showPipelineSetup, showDuplicateDetector, showFilterPanel, selectedContactId]);


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
    logActivity(db, 'item_created', { email: user?.email || '', displayName: user?.displayName }, 'Sent inbox reply', { messagePreview: inboxReply.substring(0, 200) });
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

  const [form, setForm] = useState({ firstName:"", lastName:"", email:"", phone:"", birthday:"", leadStatus:"Cold Lead" as Customer["leadStatus"], tags:"", company:"", location:"" });
  const resetForm = () => setForm({ firstName:"", lastName:"", email:"", phone:"", birthday:"", leadStatus:"Cold Lead", tags:"", company:"", location:"" });
  
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
    if (!db || !user?.uid) {
      showToast("⚠️ Database not connected. Please refresh the page and try again.", "error");
      return;
    }
    const id = `CUST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const parsedTags = form.tags.split(",").map(t=>t.trim()).filter(Boolean);
    const c: Customer = { id, firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim(), email: form.email.trim(), birthday: form.birthday, leadStatus: form.leadStatus, tags: parsedTags, totalRevenue: 0, aiNotes: "", transactions: [], outstandingBalance: 0, company: form.company.trim(), location: form.location.trim(), lastContactedDate: "" };
    console.log("[CRM] Adding contact:", c.id, c.firstName, c.lastName);
    // Auto-sync new tags to customTags in settings
    const existingTagNames = customTags.map(t => t.name.toLowerCase());
    const newTags = parsedTags.filter(t => !existingTagNames.includes(t.toLowerCase()));
    if (newTags.length > 0) {
      const tagColors = ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f97316","#06b6d4","#84cc16","#ef4444"];
      setCustomTags((prev: any) => [...prev, ...newTags.map((name, i) => ({ name, color: tagColors[(prev.length + i) % tagColors.length] }))]);
    }
    try {
      await addContact(c);
      logActivity(db, 'crm_entry_created', { email: user?.email || '', displayName: user?.displayName }, `Added contact: ${c.firstName} ${c.lastName}`);
      resetForm(); setShowAddModal(false);
    } catch (err) {
      console.error("[CRM] Failed to add contact:", err);
      showToast("⚠️ Failed to add contact. Check console for details.", "error");
    }
  };

  const handleCSVSubmit = async () => {
    try {
      let textToParse = csvText;
      if (csvFile) {
        try {
          textToParse = await csvFile.text();
        } catch (err) {
          console.error("[CSV] Failed to read file:", err);
          showToast("Failed to read CSV file.", "error");
          return;
        }
      }
      
      if (!textToParse.trim()) {
        showToast("Please paste CSV text or upload a CSV file.", "error");
        return;
      }

      const parsedData = parseCSV(textToParse);
      console.log("[CSV] Parsed rows:", parsedData.length, "headers:", parsedData[0]);
      if (parsedData.length < 2) {
        showToast("CSV must have a header row and at least one data row.", "error");
        return;
      }

      const csvHeaders = parsedData[0];
      const matches = matchAllCSVHeaders(csvHeaders, fieldConfig.allFields);
      console.log("[CSV] Field matches:", matches.map(m => `${m.csvHeader} → ${m.matchedFieldId} (${m.matchResult})`));

      if (!needsMergeDialog(matches)) {
        await executeCSVImport(textToParse, Object.fromEntries(matches.map(m => [m.csvHeader, m.matchedFieldId])));
      } else {
        setPendingCSVData(textToParse);
        setCsvMergeHeaders(csvHeaders);
        setCsvMergeMatches(matches);
        setShowMergeDialog(true);
      }
    } catch (err) {
      console.error("[CSV] handleCSVSubmit error:", err);
      showToast("⚠️ CSV import failed. Check console for details.", "error");
    }
  };

  const handleAutoMerge = async () => {
    const mappings: Record<string, string | null> = {};
    const newFieldsToCreate: ContactFieldDef[] = [];

    for (const match of csvMergeMatches) {
      if (match.matchResult === "exact" || match.matchResult === "fuzzy") {
        mappings[match.csvHeader] = match.matchedFieldId;
      } else {
        const newField = createCustomField(match.csvHeader, "text");
        newFieldsToCreate.push(newField);
        mappings[match.csvHeader] = newField.id;
      }
    }

    if (newFieldsToCreate.length > 0) {
      addFieldsFromCSV(newFieldsToCreate);
      const existingIds = new Set(fieldConfig.allFields.map(f => f.id));
      const trulyNew = newFieldsToCreate.filter(f => !existingIds.has(f.id));
      const updatedConfig = {
        visibleFields: [...fieldConfig.visibleFields, ...trulyNew.map(f => f.id)],
        allFields: [...fieldConfig.allFields, ...trulyNew],
      };
      await saveConfig(updatedConfig);
    }

    setShowMergeDialog(false);
    await executeCSVImport(pendingCSVData, mappings);
  };

  const handleManualMerge = async (mappings: Record<string, string | null>) => {
    const newFieldsToCreate: ContactFieldDef[] = [];

    for (const [csvHeader, fieldId] of Object.entries(mappings)) {
      if (fieldId === null) {
        const newField = createCustomField(csvHeader, "text");
        newFieldsToCreate.push(newField);
        mappings[csvHeader] = newField.id;
      }
    }

    if (newFieldsToCreate.length > 0) {
      addFieldsFromCSV(newFieldsToCreate);
      const existingIds = new Set(fieldConfig.allFields.map(f => f.id));
      const trulyNew = newFieldsToCreate.filter(f => !existingIds.has(f.id));
      const updatedConfig = {
        visibleFields: [...fieldConfig.visibleFields, ...trulyNew.map(f => f.id)],
        allFields: [...fieldConfig.allFields, ...trulyNew],
      };
      await saveConfig(updatedConfig);
    }

    setShowMergeDialog(false);
    await executeCSVImport(pendingCSVData, mappings);
  };

  const executeCSVImport = async (text: string, mappings: Record<string, string | null>) => {
    const parsedData = parseCSV(text);
    if (parsedData.length < 2) { setIsImporting(false); return; }
    setIsImporting(true);
    showToast(`⏳ Processing ${parsedData.length - 1} contacts...`);

    const csvHeaders = parsedData[0];
    const knownFieldKeys = new Set(["firstName", "lastName", "email", "phone", "company", "location", "birthday", "lastContactedDate", "tags", "totalRevenue", "outstandingBalance", "leadStatus", "aiNotes"]);
    
    const matchStatus = (str: string): Customer["leadStatus"] | null => {
      const s = str.trim().toLowerCase();
      if (s.includes("cold")) return "Cold Lead";
      if (s.includes("warm")) return "Warm Lead";
      if (s.includes("interest")) return "Interested";
      if (s.includes("sale") || s.includes("complet")) return "Sale Completed";
      return null;
    };

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const existingByEmail = new Map<string, Customer>();
    for (const c of customers) {
      const e = c.email?.toLowerCase().trim();
      if (e) existingByEmail.set(e, c);
    }

    for (let i = 1; i < parsedData.length; i++) {
      const values = parsedData[i];
      const rowData: Record<string, string> = {};
      csvHeaders.forEach((header, idx) => {
        const fieldId = mappings[header];
        if (fieldId && idx < values.length) {
          rowData[fieldId] = values[idx];
        }
      });

      const firstName = rowData["firstName"] || "";
      const lastName = rowData["lastName"] || "";
      const rowEmail = (rowData["email"] || "").trim().toLowerCase();
      const existingContact = rowEmail ? existingByEmail.get(rowEmail) : undefined;

      if (existingContact) {
        // MERGE: fill in empty fields on the existing contact
        const updates: Record<string, any> = {};
        if (!existingContact.company && rowData["company"]) updates.company = rowData["company"];
        if (!existingContact.phone && rowData["phone"]) updates.phone = rowData["phone"];
        if (!existingContact.location && rowData["location"]) updates.location = rowData["location"];
        if (!existingContact.birthday && rowData["birthday"]) updates.birthday = rowData["birthday"];
        if (!existingContact.lastContactedDate && rowData["lastContactedDate"]) updates.lastContactedDate = rowData["lastContactedDate"];

        const customFieldUpdates: Record<string, any> = { ...(existingContact.customFields || {}) };
        let hasCustomUpdates = false;
        for (const [fieldId, value] of Object.entries(rowData)) {
          if (!knownFieldKeys.has(fieldId) && value && !customFieldUpdates[fieldId]) {
            customFieldUpdates[fieldId] = value;
            hasCustomUpdates = true;
          }
        }
        if (hasCustomUpdates) updates.customFields = customFieldUpdates;

        if (rowData["tags"]) {
          const newTags = rowData["tags"].split(",").map(t => t.trim()).filter(Boolean);
          const existingTagsLower = existingContact.tags.map(t => t.toLowerCase());
          const trulyNewTags = newTags.filter(t => !existingTagsLower.includes(t.toLowerCase()));
          if (trulyNewTags.length > 0) updates.tags = [...existingContact.tags, ...trulyNewTags];
        }

        if (Object.keys(updates).length > 0) {
          try { await store.updateCustomer(existingContact.id, updates); updatedCount++; } catch (err) { console.error(`[CSV] Update failed for ${rowEmail}:`, err); }
        } else {
          skippedCount++;
        }
      } else {
        if (!firstName && !lastName) { skippedCount++; continue; }
        let leadStatus: Customer["leadStatus"] = "Cold Lead";
        if (rowData["leadStatus"]) { const matched = matchStatus(rowData["leadStatus"]); if (matched) leadStatus = matched; }

        const customFieldValues: Record<string, any> = {};
        for (const [fieldId, value] of Object.entries(rowData)) {
          if (!knownFieldKeys.has(fieldId) && value) customFieldValues[fieldId] = value;
        }

        const id = `CUST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const parsedTags = (rowData["tags"] || "").split(",").map(t => t.trim()).filter(Boolean);
        const c: Customer = { id, firstName, lastName, phone: rowData["phone"] || "", email: rowData["email"] || "", birthday: rowData["birthday"] || "", leadStatus, tags: parsedTags, totalRevenue: parseFloat(rowData["totalRevenue"] || "0") || 0, aiNotes: rowData["aiNotes"] || "", transactions: [], outstandingBalance: parseFloat(rowData["outstandingBalance"] || "0") || 0, company: rowData["company"] || "", location: rowData["location"] || "", lastContactedDate: rowData["lastContactedDate"] || "", ...(Object.keys(customFieldValues).length > 0 ? { customFields: customFieldValues } : {}) };

        const existingTagNames = customTags.map(t => t.name.toLowerCase());
        const newTags = parsedTags.filter(t => !existingTagNames.includes(t.toLowerCase()));
        if (newTags.length > 0) {
          const tagColors = ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f97316","#06b6d4","#84cc16","#ef4444"];
          setCustomTags((prev: any) => [...prev, ...newTags.map((name, i) => ({ name, color: tagColors[(prev.length + i) % tagColors.length] }))]);
        }

        try { await addContact(c); if (rowEmail) existingByEmail.set(rowEmail, c); addedCount++; } catch (err) { console.error(`[CSV] Add failed for ${firstName} ${lastName}:`, err); }
      }
    }

    const parts: string[] = [];
    if (addedCount > 0) parts.push(`${addedCount} added`);
    if (updatedCount > 0) parts.push(`${updatedCount} updated`);
    if (skippedCount > 0) parts.push(`${skippedCount} unchanged`);
    logActivity(db, 'crm_entry_created', { email: user?.email || '', displayName: user?.displayName }, `CSV import: ${parts.join(', ') || 'No changes'}`);
    showToast(`✅ CSV Import: ${parts.join(', ') || 'No changes'}`, "success");

    setCsvText("");
    setCsvFile(null);
    setShowCSVModal(false);
    setPendingCSVData("");
    setCsvMergeHeaders([]);
    setCsvMergeMatches([]);
    setIsImporting(false);
  };

  const toggleSort = (key: SortKey) => { if (sortKey === key) setSortDir(d => d==="asc"?"desc":"asc"); else { setSortKey(key); setSortDir("asc"); } };
  const sortedCustomers = useMemo(() => {
    let list = [...customers];
    if (contactSearch) { const q = contactSearch.toLowerCase(); list = list.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.company||'').toLowerCase().includes(q) || c.tags.some(t=>t.toLowerCase().includes(q))); }
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
    // Field-level "has data" filters
    const activeFieldFilters = Object.entries(fieldFilters).filter(([, v]) => v).map(([k]) => k);
    if (activeFieldFilters.length > 0) {
      const knownKeys = new Set(['firstName','lastName','email','phone','company','location','birthday','lastContactedDate','tags','totalRevenue','outstandingBalance','leadStatus','aiNotes']);
      list = list.filter(c => {
        return activeFieldFilters.every(fieldId => {
          let val: any;
          if (knownKeys.has(fieldId)) {
            val = (c as any)[fieldId];
          } else {
            val = c.customFields?.[fieldId];
          }
          if (val == null || val === '' || val === 0) return false;
          if (Array.isArray(val) && val.length === 0) return false;
          return true;
        });
      });
    }
    // Apply smart segment filter (from FilterBuilder)
    if (segmentFilterFn) {
      list = list.filter(segmentFilterFn);
    }
    // Apply column-level sort (takes priority over default sortKey/sortDir)
    if (columnSortField) {
      list = [...list].sort((a, b) => {
        const knownA: Record<string, any> = {
          firstName: a.firstName, lastName: a.lastName, email: a.email,
          phone: a.phone, company: a.company, location: a.location,
          birthday: a.birthday, lastContactedDate: a.lastContactedDate,
          tags: a.tags, totalRevenue: a.totalRevenue,
          outstandingBalance: a.outstandingBalance, leadStatus: a.leadStatus,
          aiNotes: a.aiNotes,
        };
        const knownB: Record<string, any> = {
          firstName: b.firstName, lastName: b.lastName, email: b.email,
          phone: b.phone, company: b.company, location: b.location,
          birthday: b.birthday, lastContactedDate: b.lastContactedDate,
          tags: b.tags, totalRevenue: b.totalRevenue,
          outstandingBalance: b.outstandingBalance, leadStatus: b.leadStatus,
          aiNotes: b.aiNotes,
        };
        let va: any = columnSortField in knownA ? knownA[columnSortField] : (a.customFields?.[columnSortField] ?? "");
        let vb: any = columnSortField in knownB ? knownB[columnSortField] : (b.customFields?.[columnSortField] ?? "");
        // Handle arrays (tags)
        if (Array.isArray(va)) va = va.join(",");
        if (Array.isArray(vb)) vb = vb.join(",");
        // Handle numbers
        if (typeof va === 'number' && typeof vb === 'number') {
          return columnSortDir === 'asc' ? va - vb : vb - va;
        }
        const sa = String(va ?? "").toLowerCase();
        const sb = String(vb ?? "").toLowerCase();
        return columnSortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
      });
    }
    return list;
  }, [sortedCustomers, tagFilter, statusFilter, dateFilterFrom, dateFilterTo, fieldFilters, segmentFilterFn, columnSortField, columnSortDir]);

  // Infinite scroll: show visibleCount rows from the filtered list
  const paginatedCustomers = useMemo(() => {
    return filteredSortedCustomers.slice(0, visibleCount);
  }, [filteredSortedCustomers, visibleCount]);
  const hasMore = visibleCount < filteredSortedCustomers.length;
  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(CRM_BATCH_SIZE); }, [contactSearch, tagFilter, statusFilter, segmentFilterFn]);

  // IntersectionObserver: auto-load next batch when user scrolls to the sentinel
  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMore) {
        setVisibleCount(prev => Math.min(prev + CRM_BATCH_SIZE, filteredSortedCustomers.length));
      }
    }, { rootMargin: '200px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, filteredSortedCustomers.length]);

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => { const visible = filteredSortedCustomers.map(c => c.id); const allSelected = visible.every(id => selectedIds.has(id)); if (allSelected) setSelectedIds(prev => { const n = new Set(prev); visible.forEach(id => n.delete(id)); return n; }); else setSelectedIds(prev => { const n = new Set(prev); visible.forEach(id => n.add(id)); return n; }); };
  const selectedCustomers = customers.filter(c => selectedIds.has(c.id));
  const SortIcon = ({k}:{k:SortKey}) => sortKey===k ? (sortDir==="asc" ? <ChevronUp className="w-3 h-3 inline ml-1"/> : <ChevronDown className="w-3 h-3 inline ml-1"/>) : null;

  // Column sort toggle: null → asc → desc → null
  const toggleColumnSort = (fieldId: string) => {
    if (columnSortField !== fieldId) {
      setColumnSortField(fieldId);
      setColumnSortDir('asc');
    } else if (columnSortDir === 'asc') {
      setColumnSortDir('desc');
    } else {
      setColumnSortField(null);
      setColumnSortDir('asc');
    }
  };

  // Auto-fit column width on double-click
  const autoFitColumn = (fieldId: string, colIndex: number) => {
    if (!tableRef.current) return;
    const rows = tableRef.current.querySelectorAll('tbody tr');
    let maxWidth = 60; // minimum
    // Also measure the header
    const thCells = tableRef.current.querySelectorAll('thead th');
    if (thCells[colIndex + 1]) { // +1 for checkbox column
      const span = thCells[colIndex + 1].querySelector('span');
      if (span) maxWidth = Math.max(maxWidth, span.scrollWidth + 32);
    }
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      const cell = cells[colIndex + 1]; // +1 for checkbox column
      if (cell) {
        maxWidth = Math.max(maxWidth, cell.scrollWidth + 8);
      }
    });
    setColumnWidths(prev => {
      const next = { ...prev, [fieldId]: maxWidth };
      localStorage.setItem('crm_column_widths', JSON.stringify(next));
      return next;
    });
  };

  // Column resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).closest('th');
    const startWidth = th ? th.getBoundingClientRect().width : 130;
    resizingRef.current = { fieldId, startX: e.clientX, startWidth };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const { fieldId, startX, startWidth } = resizingRef.current;
      const diff = ev.clientX - startX;
      const newWidth = Math.max(60, startWidth + diff);
      setColumnWidths(prev => {
        const next = { ...prev, [fieldId]: newWidth };
        localStorage.setItem('crm_column_widths', JSON.stringify(next));
        return next;
      });
    };
    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  const getRowTint = (tags: string[]) => {
    for (const t of tags) {
      if (t === "VIP") return "bg-amber-50/20 dark:bg-amber-950/10";
      if (t === "Enterprise") return "bg-purple-50/20 dark:bg-purple-950/10";
      if (t === "High-Value") return "bg-rose-50/20 dark:bg-rose-950/10";
    }
    return "";
  };

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
        addJarvisMsg(`📋 **${match.firstName} ${match.lastName}** (${match.id})\n\n📧 ${match.email || "No email"}\n📞 ${match.phone || "No phone"}\n🎂 ${match.birthday || "No birthday"}\n📌 Status: ${match.leadStatus}\n🏷️ Tags: ${match.tags.length ? match.tags.join(", ") : "None"}\n💰 Revenue: $${match.totalRevenue.toFixed(2)}\n🧠 AI Notes: ${match.aiNotes || "None yet"}`); return;
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
      const newId = `CUST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newCustomer: Customer = { id: newId, firstName, lastName, phone: phoneMatch || "", email: emailMatch || "", birthday: "", leadStatus: "Cold Lead", tags: [], totalRevenue: 0, aiNotes: "", transactions: [], outstandingBalance: 0, company: "", location: "", lastContactedDate: "" };
      addContact(newCustomer);
      addJarvisMsg(`✓ Created **${firstName} ${lastName}** (${newId}) as a Cold Lead.${emailMatch ? " Email: " + emailMatch : ""}${phoneMatch ? " Phone: " + phoneMatch : ""}`); return;
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
        addJarvisMsg(`📝 Updated **${match.firstName} ${match.lastName}** from ${match.leadStatus} → **${foundStatus}**.`); return;
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
      addJarvisMsg(`📆 Done! I've scheduled a **${capitalTitle}** with **${customer.firstName} ${customer.lastName}** for **${meetDate}** at **${meetTime}**.\n\n✓ Synced to Google Calendar\n📍 Notification created`); return;
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
      <div className={`flex items-center justify-center min-h-screen ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-[#F9FAFB]'}`}>
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading Contacts...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-[#F9FAFB]'}`}>
        <div className={`rounded-2xl border shadow-xl p-10 max-w-md w-full mx-4 text-center space-y-6 ${isDarkMode ? 'bg-slate-900 border-slate-850 text-white' : 'bg-[#faf8f3] border-[#E5E7EB]'}`}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-lg">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">SOLTheory Contacts</h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Sign in to your account to access the Contacts dashboard, manage contacts, and track your sales pipeline.
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
    <div className={`flex h-[calc(100vh-0px)] md:h-screen ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-[#f5f1e8] text-slate-800'} overflow-hidden -mx-4 -mb-4 md:-mx-10 md:-mb-10`}>
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
      <aside className={`fixed lg:relative inset-y-0 left-0 z-[81] flex flex-col ${isSidebarCollapsed ? 'w-[60px]' : 'w-[220px]'} ${isDarkMode ? 'bg-slate-900 border-slate-850' : 'bg-[#f5f0e6] border-[#e8e0cc]'} border-r shrink-0 transition-all duration-300 ease-in-out ${
        isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}>
        {/* Sidebar Header */}
        <div className={`h-16 flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-between px-5'} border-b ${isDarkMode ? 'border-slate-850' : 'border-[#E5E7EB]'}`}>
          {isSidebarCollapsed ? (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-[#f2ece0] text-slate-500 hover:text-slate-700'}`}
              title="Expand sidebar"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                {isEditingCrmLabel ? (
                  <input
                    ref={crmLabelInputRef}
                    type="text"
                    value={editingLabelValue}
                    onChange={(e) => setEditingLabelValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = editingLabelValue.trim();
                        if (val) {
                          saveCrmSettings({ crmLabel: val, defaultView: crmSettings.defaultView });
                        }
                        setIsEditingCrmLabel(false);
                      }
                      if (e.key === "Escape") {
                        setIsEditingCrmLabel(false);
                      }
                    }}
                    onBlur={() => {
                      const val = editingLabelValue.trim();
                      if (val && val !== crmSettings.crmLabel) {
                        saveCrmSettings({ crmLabel: val, defaultView: crmSettings.defaultView });
                      }
                      setIsEditingCrmLabel(false);
                    }}
                    className={`text-[15px] font-bold tracking-tight w-[120px] bg-transparent border-b-2 outline-none px-0.5 ${
                      isDarkMode ? 'text-white border-indigo-500' : 'text-slate-800 border-indigo-500'
                    }`}
                    autoFocus
                  />
                ) : (
                  <span
                    className={`text-[15px] font-bold tracking-tight cursor-pointer select-none hover:opacity-70 transition-opacity ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
                    onDoubleClick={() => {
                      setEditingLabelValue(crmSettings.crmLabel);
                      setIsEditingCrmLabel(true);
                    }}
                    title="Double-click to rename"
                  >
                    {crmSettings.crmLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsSidebarCollapsed(true)}
                  className={`hidden lg:flex w-7 h-7 rounded-md items-center justify-center transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}
                  title="Collapse sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setIsMobileSidebarOpen(false)} className={`lg:hidden w-7 h-7 rounded-md ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} flex items-center justify-center text-slate-400 cursor-pointer`}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Nav Items */}
        <nav className={`flex-1 ${isSidebarCollapsed ? 'px-1.5' : 'px-3'} py-4 space-y-0.5`}>
          {crmNavItems.map((item) => {
            const isActive = activeView === item.id;
            const isSpecial = "special" in item && item.special;

            if (isSpecial) {
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveView(item.id); setIsMobileSidebarOpen(false); }}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'} my-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer border ${
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
                  {!isSidebarCollapsed && item.label}
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => { setActiveView(item.id); setIsMobileSidebarOpen(false); }}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'} rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
                  isActive
                    ? (isDarkMode ? "bg-indigo-950/40 text-indigo-400 font-semibold" : "bg-indigo-50 text-indigo-700 font-semibold")
                    : (isDarkMode ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-700 hover:bg-[#f2ece0]")
                }`}
              >
                <item.icon className={`w-[18px] h-[18px] ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                {!isSidebarCollapsed && item.label}
              </button>
            );
          })}
        </nav>

        {/* ── Sidebar Actions (visible when contacts selected) ── */}
        {!isSidebarCollapsed && (
        <div className={`px-3 pb-4 space-y-1 shrink-0 ${selectedIds.size > 0 ? '' : 'opacity-40 pointer-events-none'}`}>
          <div className={`h-px mx-2 mb-2 ${isDarkMode ? 'bg-slate-800' : 'bg-[#E5E7EB]'}`} />
          <span className={`block px-3 text-[9px] font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Actions {selectedIds.size > 0 && <span className="text-indigo-500">({selectedIds.size})</span>}
          </span>
          <button
            onClick={() => { if (selectedIds.size > 0) openEditModal(Array.from(selectedIds)); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
              isDarkMode ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-800 hover:bg-indigo-50'
            }`}
          >
            <Edit3 className="w-[18px] h-[18px] text-indigo-500" />
            Edit
          </button>
          <button
            onClick={() => { if (selectedIds.size > 0) setShowContactView(true); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
              isDarkMode ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-800 hover:bg-sky-50'
            }`}
          >
            <Contact className="w-[18px] h-[18px] text-sky-500" />
            <span className="hidden sm:inline">Contact</span>
          </button>
          {rbacCanDelete && (
          <button
            onClick={() => { if (selectedIds.size > 0) setShowDeleteConfirm(true); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
              isDarkMode ? 'text-red-400 hover:text-red-300 hover:bg-red-950/30' : 'text-red-500 hover:text-red-700 hover:bg-red-50'
            }`}
          >
            <Trash2 className="w-[18px] h-[18px]" />
            <span className="hidden sm:inline">Delete</span>
          </button>
          )}
          <button
            onClick={() => {
              if (selectedIds.size > 0) {
                if (selectedIds.size > 100) {
                  showToast("You can only email up to 100 contacts at a time.", "error");
                  return;
                }
                setEmailSendMode(selectedIds.size > 1 ? "individual" : "individual");
                setShowEmailModal(true);
              }
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
              isDarkMode ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-800 hover:bg-purple-50'
            } ${selectedIds.size === 0 ? 'opacity-40 pointer-events-none' : ''}`}
          >
            <MailPlus className="w-[18px] h-[18px] text-purple-500" />
            Draft Email
          </button>
        </div>
        )}
        {/* ── Collapsed sidebar: icon-only actions ── */}
        {isSidebarCollapsed && (
          <div className="px-1.5 pb-4 space-y-1 shrink-0 flex flex-col items-center">
            <div className={`h-px w-full mx-2 mb-2 ${isDarkMode ? 'bg-slate-800' : 'bg-[#E5E7EB]'}`} />
            {selectedIds.size > 0 && (
              <span className="text-[9px] font-bold text-indigo-500 mb-1">{selectedIds.size}</span>
            )}
            <button
              onClick={() => { if (selectedIds.size > 0) openEditModal(Array.from(selectedIds)); }}
              title="Edit"
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                selectedIds.size > 0
                  ? (isDarkMode ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-800 hover:bg-indigo-50')
                  : 'opacity-40 pointer-events-none text-slate-400'
              }`}
            >
              <Edit3 className="w-[18px] h-[18px] text-indigo-500" />
            </button>
            <button
              onClick={() => { if (selectedIds.size > 0) setShowContactView(true); }}
              title="Contact"
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                selectedIds.size > 0
                  ? (isDarkMode ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-800 hover:bg-sky-50')
                  : 'opacity-40 pointer-events-none text-slate-400'
              }`}
            >
              <Contact className="w-[18px] h-[18px] text-sky-500" />
            </button>
            {rbacCanDelete && (
            <button
              onClick={() => { if (selectedIds.size > 0) setShowDeleteConfirm(true); }}
              title="Delete"
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                selectedIds.size > 0
                  ? (isDarkMode ? 'text-red-400 hover:text-red-300 hover:bg-red-950/30' : 'text-red-500 hover:text-red-700 hover:bg-red-50')
                  : 'opacity-40 pointer-events-none text-slate-400'
              }`}
            >
              <Trash2 className="w-[18px] h-[18px]" />
            </button>
            )}
            <button
              onClick={() => {
                if (selectedIds.size > 0) {
                  if (selectedIds.size > 100) {
                    showToast("You can only email up to 100 contacts at a time.", "error");
                    return;
                  }
                  setEmailSendMode(selectedIds.size > 1 ? "individual" : "individual");
                  setShowEmailModal(true);
                }
              }}
              title="Draft Email"
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                selectedIds.size > 0
                  ? (isDarkMode ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-800 hover:bg-purple-50')
                  : 'opacity-40 pointer-events-none text-slate-400'
              }`}
            >
              <MailPlus className="w-[18px] h-[18px] text-purple-500" />
            </button>
          </div>
        )}
      </aside>

      {/* ──── Main Content Area ──── */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-[margin] duration-300 ease-in-out ${isJarvisOpen ? 'lg:mr-[340px]' : ''}`}>
        {/* ──── Top Navigation Bar ──── */}
        <header className={`h-11 md:h-14 border-b flex items-center justify-between px-5 shrink-0 shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] ${isDarkMode ? 'bg-slate-900 border-slate-850 text-white' : 'bg-[#f5f0e6] border-[#e8e0cc]'}`}>
          {/* Mobile nav toggle + breadcrumb */}
          <div className="flex items-center gap-3">
            {/* Hamburger menu (mobile) */}
            <button onClick={() => setIsMobileSidebarOpen(true)} className={`lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 cursor-pointer ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-[#f2ece0]'}`}>
              <Menu className="w-5 h-5" />
            </button>
            {/* Breadcrumb (desktop) */}
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <span className={`font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Contacts</span>
              <span className="text-slate-300">/</span>
              <span className={`font-semibold capitalize ${isDarkMode ? 'text-indigo-400' : 'text-slate-700'}`}>{getCrmNavLabel(activeView)}</span>
            </div>
          </div>
        </header>

        {/* ———— Scrollable Content ———— */}
        <main className={`flex-1 overflow-y-auto p-4 md:p-5 ${isDarkMode ? '' : 'bg-[#fefdfb]'}`}>
          {/* Skeleton Loading */}
          {isLoading ? (
            activeView === "campaigns" ? <DashboardSkeleton /> :
            activeView === "analytics" ? <AnalyticsSkeleton /> :
            <DashboardSkeleton />
          ) : (
          <>
          {/* ── ── ── ── ── ── ── DATABASE VIEW ── ── ── ── ── ── ── */}
          {activeView === "dashboard" && (
            <div className="w-full space-y-3">
              {/* Smart Filters & Segments */}
              <FilterBuilder
                customers={customers}
                onFilterChange={setSegmentFilterFn}
                savedSegments={savedSegments}
                onSaveSegment={(seg) => setSavedSegments(prev => [...prev, seg])}
                onDeleteSegment={(id) => setSavedSegments(prev => prev.filter(s => s.id !== id))}
              />
              {/* Page Header — Clean */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h1 className={`text-lg font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    Database
                  </h1>
                  {/* Database Switcher */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDbDropdown(!showDbDropdown)}
                      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        isDarkMode
                          ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-600'
                          : 'border-slate-200 bg-white text-slate-600 hover:text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <Database className="w-3 h-3" />
                      {availableInstances.find(i => i.id === activeInstanceId)?.name || "All Contacts"}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>
                    {showDbDropdown && (
                      <div className={`absolute left-0 top-full mt-1 w-56 rounded-xl border shadow-lg z-50 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Databases</div>
                        {availableInstances.map(inst => (
                          <button
                            key={inst.id}
                            onClick={() => { switchInstance(inst.id); setShowDbDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors ${
                              inst.id === activeInstanceId
                                ? isDarkMode ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                                : isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span className="font-medium truncate">{inst.name}</span>
                            {inst.id === activeInstanceId && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />}
                          </button>
                        ))}
                        <div className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                          {showNewDbInput ? (
                            <div className="px-3 py-2 flex items-center gap-2">
                              <input
                                autoFocus
                                value={newDbName}
                                onChange={(e) => setNewDbName(e.target.value)}
                                placeholder="Database name..."
                                className={`flex-1 h-7 px-2 text-xs rounded-md border outline-none ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && newDbName.trim()) {
                                    const newId = await createInstance(newDbName.trim());
                                    setNewDbName(""); setShowNewDbInput(false); setShowDbDropdown(false);
                                    switchInstance(newId);
                                  }
                                  if (e.key === 'Escape') { setShowNewDbInput(false); setNewDbName(""); }
                                }}
                              />
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowNewDbInput(true)}
                              className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 transition-colors ${isDarkMode ? 'text-indigo-400 hover:bg-slate-800' : 'text-indigo-600 hover:bg-slate-50'}`}
                            >
                              <Plus className="w-3.5 h-3.5" /> New Database
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className={`text-sm font-normal ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {filteredSortedCustomers.length}{filteredSortedCustomers.length !== customers.length ? ` of ${customers.length}` : ''} records
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative flex items-center">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search contacts, tags, or status..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className={`w-80 sm:w-96 lg:w-[28rem] h-10 pl-10 pr-14 text-sm rounded-xl border placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all ${
                        isDarkMode 
                          ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' 
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    />
                    {contactSearch && (
                      <span className={`absolute right-20 text-[10px] font-medium tabular-nums ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {filteredSortedCustomers.length} of {customers.length}
                      </span>
                    )}
                    <button
                      onClick={() => setIsCommandPaletteOpen(true)}
                      className={`absolute right-2 px-2 py-1 rounded-md border text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 ${
                        isDarkMode 
                          ? 'border-slate-700 bg-slate-800 text-slate-400 hover:text-white' 
                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-700'
                      }`}
                      title="Open command palette (⌘K)"
                    >
                      <span className="text-[9px]">⌘</span>K
                    </button>
                  </div>
                  {/* Actions Dropdown */}
                  <div className="relative flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setShowViewDropdown(!showViewDropdown)}
                        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          tableViewMode !== "database"
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-600'
                            : isDarkMode
                              ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-600'
                              : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </button>
                      {showViewDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowViewDropdown(false)} />
                          <div className={`absolute right-0 mt-1 w-52 rounded-xl border shadow-xl z-50 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/40' : 'bg-white border-slate-200 text-slate-700'}`}>
                            <div className="py-1">
                              {([
                                { id: "database" as const, label: "Database View", icon: <Table2 className="w-3.5 h-3.5" />, desc: "Full table with all fields" },
                                { id: "simplified" as const, label: "Simplified View", icon: <Activity className="w-3.5 h-3.5" />, desc: "Key fields only" },
                                { id: "contacts" as const, label: "Contact View", icon: <Contact className="w-3.5 h-3.5" />, desc: "Card layout like iOS contacts" },
                              ]).map(v => (
                                <button
                                  key={v.id}
                                  onClick={() => { setTableViewMode(v.id); setShowViewDropdown(false); }}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                                    tableViewMode === v.id
                                      ? (isDarkMode ? 'bg-indigo-950/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700')
                                      : (isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-600')
                                  }`}
                                >
                                  <span className={tableViewMode === v.id ? 'text-indigo-500' : 'text-slate-400'}>{v.icon}</span>
                                  <div>
                                    <p className="text-xs font-semibold">{v.label}</p>
                                    <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{v.desc}</p>
                                  </div>
                                  {tableViewMode === v.id && <Check className="w-3.5 h-3.5 ml-auto text-indigo-500" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setShowFilterPanel(!showFilterPanel)}
                      className={`relative inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-600' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                      <span className="hidden sm:inline">Actions</span>
                      {(hasActiveFilters || getDuplicateCount(customers) > 0) && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full" />
                      )}
                    </button>
                    {showFilterPanel && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowFilterPanel(false)} />
                        <div className={`absolute right-0 top-full mt-1 w-60 rounded-xl border shadow-xl z-[999] overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/40' : 'bg-white border-slate-200 text-slate-700'}`}>
                          {/* Filter Section */}
                          <div className={`px-3 py-2 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Filter by field</span>
                          </div>
                          <div className="max-h-36 overflow-y-auto px-1 py-1">
                            {getVisibleFieldDefs().map((field) => {
                              const isActive = !!fieldFilters[field.id];
                              return (
                                <button
                                  key={field.id}
                                  onClick={() => setFieldFilters(prev => ({ ...prev, [field.id]: !prev[field.id] }))}
                                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                    isActive
                                      ? (isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-800')
                                      : (isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-50 text-slate-500')
                                  }`}
                                >
                                  <span className="truncate">{field.label}</span>
                                  {isActive && <Check className="w-3 h-3 text-indigo-500 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                          {hasActiveFilters && (
                            <div className={`px-3 py-1.5 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                              <button
                                onClick={() => { clearAllFilters(); setShowFilterPanel(false); }}
                                className="text-[11px] text-indigo-500 hover:text-indigo-600 font-medium cursor-pointer"
                              >
                                Clear all filters
                              </button>
                            </div>
                          )}
                          {/* Action Items */}
                          <div className={`border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                            {rbacCanExport && (
                            <button
                              onClick={() => { setShowFilterPanel(false); setShowExportModal(true); }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-600'}`}
                            >
                              <Download className="w-3.5 h-3.5 text-slate-400" />
                              Export CSV
                            </button>
                            )}
                            <button
                              onClick={() => { setShowFilterPanel(false); setShowDuplicateDetector(true); }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-600'}`}
                            >
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              Find Duplicates
                              {getDuplicateCount(customers) > 0 && (
                                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">{getDuplicateCount(customers)}</span>
                              )}
                            </button>
                            <button
                              onClick={() => { setShowFilterPanel(false); setShowManageFields(true); }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-600'}`}
                            >
                              <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                              Manage Fields
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {rbacCanEdit && (
                  <div className="relative z-50">
                    <button
                      onClick={() => setIsDashAddDropdownOpen(!isDashAddDropdownOpen)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 dark:bg-white text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Add Record</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-80 hidden sm:block" />
                    </button>
                    {isDashAddDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsDashAddDropdownOpen(false)} />
                        <div className={`absolute right-0 top-full mt-1 w-56 rounded-lg border shadow-lg z-[999] overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/40' : 'bg-white border-slate-200 text-slate-700'}`}>
                          <button
                            onClick={() => { setIsDashAddDropdownOpen(false); setShowAddModal(true); }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-50 text-slate-700'}`}
                          >
                            Manual Contact Entry
                          </button>
                          <button
                            onClick={() => { setIsDashAddDropdownOpen(false); setShowCSVModal(true); }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-50 text-slate-700'}`}
                          >
                            CSV Import
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  )}
                </div>
              </div>

              {/* ── Spreadsheet Grid ── */}
              {customers.length === 0 ? (
                <EmptyContacts onAdd={() => setShowAddModal(true)} />
              ) : (
                <>
                <div className={`rounded-xl border shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#E5E7EB]'}`} style={{ display: tableViewMode === 'contacts' ? 'none' : undefined }}>
                  <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                    <table ref={tableRef} className="w-full text-[13px] border-collapse min-w-[1200px]" style={{ tableLayout: Object.keys(columnWidths).length > 0 ? 'fixed' : undefined }}>
                      <thead className="sticky top-0 z-20">
                        <tr className={isDarkMode ? 'bg-slate-800/70' : 'bg-[#F8F9FB]'}>
                          <th className={`sticky left-0 top-0 z-30 w-10 px-3 py-3 border-b border-r ${isDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-[#F8F9FB] border-[#E5E7EB]'}`}>
                            <input type="checkbox" checked={filteredSortedCustomers.length > 0 && filteredSortedCustomers.every(c => selectedIds.has(c.id))} onChange={toggleSelectAll} className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                          </th>
                          {(isSimplifiedView ? getVisibleFieldDefs().filter(f => ['firstName', 'lastName', 'email', 'phone', 'company', 'leadStatus'].includes(f.id)) : getVisibleFieldDefs()).map((field, fieldIdx) => {
                            const isColSorted = columnSortField === field.id;
                            const colWidth = columnWidths[field.id];
                            return (
                              <th
                                key={field.id}
                                onClick={() => toggleColumnSort(field.id)}
                                style={colWidth ? { width: colWidth, minWidth: colWidth, maxWidth: colWidth } : undefined}
                                className={`${!colWidth ? (field.width || 'w-[130px]') : ''} text-left text-[11px] font-semibold px-3 py-3 border-b border-r select-none relative cursor-pointer hover:text-indigo-600 ${isDarkMode ? 'text-slate-400 border-slate-700 bg-slate-800/95' : 'text-slate-500 border-[#E5E7EB] bg-[#F8F9FB]'}`}
                              >
                                <span className="inline-flex items-center gap-1">
                                  {field.label}
                                  {isColSorted ? (
                                    columnSortDir === 'asc'
                                      ? <ArrowUp className="w-3 h-3 text-indigo-500" />
                                      : <ArrowDown className="w-3 h-3 text-indigo-500" />
                                  ) : (
                                    <ArrowUpDown className={`w-3 h-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                                  )}
                                </span>
                                {/* Resize handle */}
                                <div
                                  onMouseDown={(e) => handleResizeMouseDown(e, field.id)}
                                  onDoubleClick={(e) => { e.stopPropagation(); autoFitColumn(field.id, fieldIdx); }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute top-0 right-0 w-[4px] h-full cursor-col-resize z-10 hover:bg-indigo-400/40 active:bg-indigo-500/60"
                                />
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedCustomers.map((c, idx) => (
                          <tr
                            key={c.id}
                            onClick={() => setSelectedContactId(selectedContactId === c.id ? null : c.id)}
                            style={{ height: '44px', maxHeight: '44px' }}
                            className={`group border-b transition-colors cursor-pointer ${
                              isDarkMode
                                ? `border-slate-800 ${idx % 2 === 1 ? 'bg-slate-800/20' : ''} hover:bg-slate-800/50`
                                : `border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''} hover:bg-indigo-50/30`
                            } ${selectedIds.has(c.id) ? (isDarkMode ? 'bg-indigo-950/20' : 'bg-indigo-50/40') : ''} ${getRowTint(c.tags)}`}
                          >
                            <td className={`sticky left-0 z-10 px-3 py-3 border-r ${isDarkMode ? (idx % 2 === 1 ? 'bg-slate-800/20' : 'bg-slate-900') + ' border-slate-700' : (idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white') + ' border-slate-200'} group-hover:${isDarkMode ? 'bg-slate-800/50' : 'bg-indigo-50/30'}`} onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                            </td>
                            {(isSimplifiedView ? getVisibleFieldDefs().filter(f => ['firstName', 'lastName', 'email', 'phone', 'company', 'leadStatus'].includes(f.id)) : getVisibleFieldDefs()).map((field) => {
                              // Get the value — check known Customer properties first, then customFields
                              const knownKeys: Record<string, any> = {
                                firstName: c.firstName, lastName: c.lastName, email: c.email,
                                phone: c.phone, company: c.company, location: c.location,
                                birthday: c.birthday, lastContactedDate: c.lastContactedDate,
                                tags: c.tags, totalRevenue: c.totalRevenue,
                                outstandingBalance: c.outstandingBalance, leadStatus: c.leadStatus,
                                aiNotes: c.aiNotes,
                              };
                              const val = field.id in knownKeys ? knownKeys[field.id] : (c.customFields?.[field.id] ?? "");
                              const dash = <span className="text-slate-400">&mdash;</span>;

                              // Render based on field type
                              switch (field.type) {
                                case "currency":
                                  const numVal = typeof val === "number" ? val : parseFloat(val) || 0;
                                  return (
                                    <td key={field.id} className={`px-3 py-3 text-right font-semibold tabular-nums border-r ${numVal > 0 ? 'text-emerald-600' : (isDarkMode ? 'text-slate-500' : 'text-slate-400')} ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`} style={columnWidths[field.id] ? { width: columnWidths[field.id], minWidth: columnWidths[field.id], maxWidth: columnWidths[field.id], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : { maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      ${numVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  );
                                case "tags":
                                  const tagsArr = Array.isArray(val) ? val : [];
                                  return (
                                    <td key={field.id} className={`px-3 py-3 border-r ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`} style={columnWidths[field.id] ? { width: columnWidths[field.id], minWidth: columnWidths[field.id], maxWidth: columnWidths[field.id], overflow: 'hidden' } : { maxWidth: '250px', overflow: 'hidden' }}>
                                      {tagsArr.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {tagsArr.slice(0, 2).map((tag: string) => (
                                            <span key={tag} className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${getTagStyles(tag)}`}>{tag}</span>
                                          ))}
                                          {tagsArr.length > 2 && <span className="text-[9px] font-medium text-slate-400">+{tagsArr.length - 2}</span>}
                                        </div>
                                      ) : dash}
                                    </td>
                                  );
                                case "select":
                                  if (field.id === "leadStatus") {
                                    return (
                                      <td key={field.id} className={`px-3 py-3 border-r ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`} style={columnWidths[field.id] ? { width: columnWidths[field.id], minWidth: columnWidths[field.id], maxWidth: columnWidths[field.id], overflow: 'hidden' } : { maxWidth: '250px', overflow: 'hidden' }}>
                                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${getStatusStyles(String(val))}`}>
                                          {String(val)}
                                        </span>
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={field.id} className={`px-3 py-3 border-r ${isDarkMode ? 'text-slate-300 border-slate-700' : 'text-slate-600 border-slate-200'}`} style={columnWidths[field.id] ? { width: columnWidths[field.id], minWidth: columnWidths[field.id], maxWidth: columnWidths[field.id], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } : { maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                      {val ? String(val) : dash}
                                    </td>
                                  );
                                case "date":
                                  return (
                                    <td key={field.id} className={`px-3 py-3 border-r ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-200'}`} style={columnWidths[field.id] ? { width: columnWidths[field.id], minWidth: columnWidths[field.id], maxWidth: columnWidths[field.id], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } : { maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                      {val ? new Date(String(val)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : dash}
                                    </td>
                                  );
                                case "boolean":
                                  return (
                                    <td key={field.id} className={`px-3 py-3 border-r ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`} style={columnWidths[field.id] ? { width: columnWidths[field.id], minWidth: columnWidths[field.id], maxWidth: columnWidths[field.id] } : { maxWidth: '250px', overflow: 'hidden' }}>
                                      {val ? <Check className="w-4 h-4 text-emerald-500" /> : dash}
                                    </td>
                                  );
                                case "email":
                                  return (
                                    <td key={field.id} className={`px-3 py-3 border-r ${isDarkMode ? 'text-slate-300 border-slate-700' : 'text-slate-600 border-slate-200'}`} style={columnWidths[field.id] ? { width: columnWidths[field.id], minWidth: columnWidths[field.id], maxWidth: columnWidths[field.id], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } : { maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                      {val ? String(val) : dash}
                                    </td>
                                  );
                                case "number":
                                  return (
                                    <td key={field.id} className={`px-3 py-3 tabular-nums border-r ${isDarkMode ? 'text-slate-300 border-slate-700' : 'text-slate-600 border-slate-200'}`} style={columnWidths[field.id] ? { width: columnWidths[field.id], minWidth: columnWidths[field.id], maxWidth: columnWidths[field.id], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } : { maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                      {val !== undefined && val !== "" ? String(val) : dash}
                                    </td>
                                  );
                                default: {
                                  const isName = field.id === "firstName" || field.id === "lastName";
                                  const isCompany = field.id === "company";
                                  const isLocation = field.id === "location";
                                  if (field.id === "firstName") {
                                    return (
                                      <td key={field.id} className={`px-3 py-3 border-r font-medium ${isDarkMode ? 'text-white border-slate-700' : 'text-slate-800 border-slate-200'}`} style={columnWidths[field.id] ? { width: columnWidths[field.id], minWidth: columnWidths[field.id], maxWidth: columnWidths[field.id] } : { maxWidth: '250px', overflow: 'hidden' }}>
                                        <div className="flex flex-col gap-1 items-start">
                                          <span>{val ? String(val) : dash}</span>
                                          {c.tags && c.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 max-w-full">
                                              {c.tags.slice(0, 3).map((tag: string) => (
                                                <span key={tag} className={`text-[8px] font-bold px-1.5 py-0.5 rounded border leading-none scale-95 origin-left ${getTagStyles(tag)}`}>{tag}</span>
                                              ))}
                                              {c.tags.length > 3 && (
                                                <span className="text-[8px] font-medium text-slate-400">+{c.tags.length - 3}</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  }
                                  if (isCompany) {
                                    return (
                                      <td key={field.id} className={`px-3 py-3 border-r ${isDarkMode ? 'text-slate-300 border-slate-700' : 'text-slate-600 border-slate-200'}`} style={columnWidths[field.id] ? { width: columnWidths[field.id], minWidth: columnWidths[field.id], maxWidth: columnWidths[field.id], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } : { maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                        {val ? (
                                          <span className="inline-flex items-center gap-1">
                                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                            {String(val)}
                                          </span>
                                        ) : dash}
                                      </td>
                                    );
                                  }
                                  if (isLocation) {
                                    return (
                                      <td key={field.id} className={`px-3 py-3 border-r ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-200'}`} style={columnWidths[field.id] ? { width: columnWidths[field.id], minWidth: columnWidths[field.id], maxWidth: columnWidths[field.id], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } : { maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                        {val ? (
                                          <span className="inline-flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                            {String(val)}
                                          </span>
                                        ) : dash}
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={field.id} className={`px-3 py-3 border-r ${isName ? 'font-medium' : ''} ${isDarkMode ? (isName ? 'text-white' : 'text-slate-300') + ' border-slate-700' : (isName ? 'text-slate-800' : 'text-slate-600') + ' border-slate-200'}`} style={columnWidths[field.id] ? { width: columnWidths[field.id], minWidth: columnWidths[field.id], maxWidth: columnWidths[field.id], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } : undefined}>
                                      {val ? String(val) : dash}
                                    </td>
                                  );
                                }
                              }
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Infinite scroll sentinel */}
                    <div ref={scrollSentinelRef} style={{ height: 1 }} />
                  </div>
                  {/* Footer — record count */}
                  <div className={`flex items-center justify-between px-4 py-2.5 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800/40' : 'border-[#E5E7EB] bg-[#FAFBFC]'}`}>
                    <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Showing {Math.min(visibleCount, filteredSortedCustomers.length)} of {filteredSortedCustomers.length} record{filteredSortedCustomers.length !== 1 ? 's' : ''}
                      {filteredSortedCustomers.length !== customers.length ? ` (${customers.length} total)` : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedIds.size > 0 && (
                        <span className={`text-[11px] mr-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {selectedIds.size} selected
                        </span>
                      )}
                      {hasMore && (
                        <span className={`text-[10px] ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`}>
                          Scroll for more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Contact View (iOS-style card grid) ── */}
                {tableViewMode === "contacts" && (
                  <div className="flex flex-col h-full">
                    <div className="overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1">
                        {filteredSortedCustomers.map(c => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedContactId(selectedContactId === c.id ? null : c.id)}
                            className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all cursor-pointer ${
                              selectedContactId === c.id
                                ? (isDarkMode ? 'bg-indigo-950/40 border-indigo-500/50 ring-1 ring-indigo-500/30' : 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200')
                                : (isDarkMode ? 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600' : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm')
                            }`}
                          >
                            {/* Avatar */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                              selectedContactId === c.id
                                ? 'bg-indigo-500 text-white'
                                : (isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600')
                            }`}>
                              {(c.firstName?.[0] || '').toUpperCase()}{(c.lastName?.[0] || '').toUpperCase()}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                {c.firstName} {c.lastName}
                              </p>
                              <div className="flex items-center gap-3 mt-0.5">
                                {c.email && (
                                  <span className={`text-[11px] truncate max-w-[180px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {c.email}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                {c.phone && (
                                  <span className={`text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {c.phone}
                                  </span>
                                )}
                                {c.company && (
                                  <span className={`text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    · {c.company}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Chevron */}
                            <ChevronRight className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Footer */}
                    <div className={`flex items-center justify-between px-4 py-2.5 border-t mt-auto ${isDarkMode ? 'border-slate-700 bg-slate-800/40' : 'border-[#E5E7EB] bg-[#FAFBFC]'}`}>
                      <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {filteredSortedCustomers.length} of {customers.length} contacts
                      </span>
                    </div>
                  </div>
                )}
                </>
              )}
            </div>
          )}




          {/* ——————————— CUSTOMER PROFILE VIEW ——————————— */}
          {/* Note: Profile moved to ContactProfilePanel */}


          {/* ━━━━━━━━━━━ BOARD VIEW ━━━━━━━━━━━ */}
          {activeView === "board" && (
            <>
              <PipelineBoard
                customers={customers}
                onUpdateStatus={(id, status) => updateStatus(id, status as any)}
                onOpenContact={(c) => setSelectedContactId(c.id)}
                pipelineConfig={store.pipelineConfig}
                onConfigureClick={() => setShowPipelineSetup(true)}
              />
              <PipelineSetup
                isOpen={showPipelineSetup}
                onClose={() => setShowPipelineSetup(false)}
                currentConfig={store.pipelineConfig}
                onApply={(config: PipelineConfig) => {
                  store.savePipelineConfig(config);
                  setShowPipelineSetup(false);
                }}
              />
            </>
          )}

          {/* ━━━━━━━━━━━ FOLLOW-UPS VIEW ━━━━━━━━━━━ */}
          {activeView === "follow_ups" && (
            <CRMFollowUps customers={customers} />
          )}

          {/* ━━━━━━━━━━━ AI INSIGHTS VIEW ━━━━━━━━━━━ */}
          {activeView === "insights" && (
            <AIInsightsPanel
              customers={customers}
              tasks={store.tasks}
              meetings={meetings}
              onNavigateToContact={(id) => setSelectedContactId(id)}
            />
          )}

          {/* ━━━━━━━━━━━ SETTINGS VIEW ━━━━━━━━━━━ */}
          {activeView === "settings" && (
            <CRMSettingsView
              customers={customers}
              onConfigurePipeline={() => setShowPipelineSetup(true)}
              onExportAll={() => setShowExportModal(true)}
              onFindDuplicates={() => setShowDuplicateDetector(true)}
            />
          )}

          {/* ━━━━━━━━━━━ ANALYTICS VIEW ━━━━━━━━━━━ */}
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
                  <h1 className={`text-xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Analytics</h1>
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
                  <div className={`rounded-xl border p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-[#faf8f3] border-[#E5E7EB]'}`}>
                    <h2 className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Revenue by Lead Status</h2>
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
                  <div className={`rounded-xl border p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-[#faf8f3] border-[#E5E7EB]'}`}>
                    <h2 className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Revenue Over Time</h2>
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
                <div className={`rounded-xl border shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-[#faf8f3] border-[#E5E7EB]'}`}>
                  <div className={`px-6 py-4 border-b ${isDarkMode ? "border-slate-800" : "border-[#E5E7EB]"}`}>
                    <h2 className={`text-sm font-bold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>Top Customers by Revenue</h2>
                  </div>
                  {customers.length === 0 ? (
                    <EmptyAnalytics />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className={isDarkMode ? "bg-slate-800/60 text-slate-300" : "bg-[#faf6ed]/60 text-slate-700"}>
                          <tr className={`border-b ${isDarkMode ? "border-slate-800" : "border-[#E5E7EB]"}`}>
                            <th className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 pl-6 pr-4">Rank</th>
                            <th className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Customer</th>
                            <th className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Status</th>
                            <th className="text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 px-4">Revenue</th>
                            <th className="text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider py-3 pr-6">Outstanding</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...customers].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10).map((c, i) => (
                            <tr key={c.id} className={`border-b transition-colors ${
                              isDarkMode ? "border-slate-800 hover:bg-slate-850" : "border-slate-50 hover:bg-[#f2ece0]/50"
                            }`}>
                              <td className="py-3 pl-6 pr-4">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  i < 3 
                                    ? (isDarkMode ? "bg-amber-950/40 text-amber-400 border border-amber-800" : "bg-amber-50 text-amber-700 border border-amber-200") 
                                    : (isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500")
                                }`}>
                                  {i + 1}
                                </span>
                              </td>
                              <td className={`py-3 px-4 font-semibold ${isDarkMode ? "text-white" : "text-slate-800"}`}>{c.firstName} {c.lastName}</td>
                              <td className="py-3 px-4"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusStyles(c.leadStatus)}`}>{c.leadStatus}</span></td>
                              <td className="py-3 px-4 text-right font-semibold text-emerald-600">${c.totalRevenue.toFixed(2)}</td>
                              <td className={`py-3 pr-6 text-right ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>${c.outstandingBalance.toFixed(2)}</td>
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


          {/* —————————— CAMPAIGNS VIEW —————————— */}
          {activeView === "campaigns" && (
            <CampaignCalendar />
          )}
          </>
          )}
        </main>
      </div>

      {/* ━━━━━━━━━━ Contact Profile Slide-over ━━━━━━━━━━ */}
      <ContactProfilePanel
        customer={selectedContactId ? (customers.find(c => c.id === selectedContactId) || null) : null}
        onClose={() => setSelectedContactId(null)}
        onEdit={() => {
          const customer = customers.find(c => c.id === selectedContactId);
          if (customer) {
            const idx = customers.findIndex(c => c.id === selectedContactId);
            setEditModalIds(customers.map(c => c.id));
            setEditModalIndex(idx);
            setEditForm(buildEditFormFromCustomer(customer));
            openEditModal([customer.id]);
          }
        }}
      />

      <ManageFieldsSidebar
        isOpen={showManageFields}
        onClose={() => setShowManageFields(false)}
        fieldConfig={fieldConfig}
        onApply={async (visibleFields, allFields) => {
          applyConfig(visibleFields, allFields);
          await saveConfig({ visibleFields, allFields });
          setShowManageFields(false);
          showToast("✅ Field configuration updated");
        }}
        isDarkMode={isDarkMode}
        customers={customers}
      />

      {/* ━━━━━━ EXPORT MODAL ━━━━━━ */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        fieldConfig={fieldConfig}
        customers={customers}
        filteredCustomers={filteredSortedCustomers}
        selectedCustomers={selectedCustomers}
        isDarkMode={isDarkMode}
      />
      {/* ━━━━━━ CSV FIELD MERGE DIALOG ━━━━━━ */}
      <CSVFieldMergeDialog
        isOpen={showMergeDialog}
        onClose={() => { setShowMergeDialog(false); setPendingCSVData(""); }}
        csvHeaders={csvMergeHeaders}
        matches={csvMergeMatches}
        allFields={fieldConfig.allFields}
        onAutoMerge={handleAutoMerge}
        onManualMerge={handleManualMerge}
        isDarkMode={isDarkMode}
        onRematch={(caseSensitive) => {
          const rematched = matchAllCSVHeaders(csvMergeHeaders, fieldConfig.allFields, caseSensitive);
          setCsvMergeMatches(rematched);
        }}
      />






      {/* ━━━━━━ EMAIL CAMPAIGN MODAL ━━━━━━ */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); setEmailTab("compose"); setShowSignatureEditor(false); setShowDrafts(false); setIsEmailMaximized(false); }}>
          <div className={`border shadow-2xl mx-4 overflow-hidden flex flex-col transition-all duration-300 ${isEmailMaximized ? 'w-full h-full max-w-none rounded-none' : 'w-full max-w-4xl rounded-2xl'} ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/60' : 'bg-[#faf8f3] border-[#E5E7EB]'}`} style={isEmailMaximized ? { maxHeight: "100vh" } : { maxHeight: "92vh" }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 bg-gradient-to-r ${isDarkMode ? 'border-slate-800 from-slate-900 to-slate-900/45 text-white' : 'border-[#E5E7EB] from-indigo-50/50 to-white'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <MailPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Email Campaign</h2>
                  <p className="text-xs text-slate-400 flex items-center gap-2">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{selectedCustomers.filter(c => c.email).length} recipients</span>
                    <span className="text-slate-300">·</span>
                    <span>{selectedCustomers.length} selected</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Tab Switcher */}
                <div className={`flex rounded-lg p-0.5 ${isDarkMode ? 'bg-slate-850' : 'bg-slate-100'}`}>
                  <button onClick={() => setEmailTab("compose")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${emailTab === "compose" ? (isDarkMode ? "bg-slate-800 text-white shadow-sm" : "bg-[#faf8f3] text-slate-800 shadow-sm") : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-700")}`}>Compose</button>
                  <button onClick={() => setEmailTab("preview")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${emailTab === "preview" ? (isDarkMode ? "bg-slate-800 text-white shadow-sm" : "bg-[#faf8f3] text-slate-800 shadow-sm") : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-700")}`}>Preview</button>
                </div>
                <button onClick={() => setIsEmailMaximized(!isEmailMaximized)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 cursor-pointer ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`} title={isEmailMaximized ? "Minimize" : "Maximize"}>
                  {isEmailMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={() => { setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); setEmailTab("compose"); setIsEmailMaximized(false); }} className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 cursor-pointer ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Recipients Bar */}
            <div className={`px-6 py-3 border-b shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-950/20' : 'border-[#E5E7EB] bg-[#faf6ed]/50'}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{emailSendMode === "cc" ? "CC:" : "To:"}</span>
                {selectedCustomers.filter(c => c.email).slice(0, 8).map(c => (
                  <span key={c.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium shadow-sm ${
                    isDarkMode ? "bg-slate-850 border-slate-700 text-slate-300" : "bg-[#faf8f3] border-slate-200 text-slate-600"
                  }`}>
                    <span className="w-3.5 h-3.5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[7px] font-bold">{c.firstName[0]}</span>
                    {c.firstName} {c.lastName}
                  </span>
                ))}
                {selectedCustomers.filter(c => c.email).length > 8 && <span className="text-[11px] text-slate-400 font-medium">+{selectedCustomers.filter(c => c.email).length - 8} more</span>}
              </div>
              {/* Send Mode Toggle + Gmail Rate Notice */}
              {selectedCustomers.filter(c => c.email).length > 1 && (
                <div className={`flex items-center justify-between mt-2.5 pt-2.5 border-t border-dashed ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/80'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Send mode:</span>
                    <button
                      onClick={() => setEmailSendMode(emailSendMode === "individual" ? "cc" : "individual")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-all cursor-pointer ${
                        emailSendMode === "individual"
                          ? (isDarkMode ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-700')
                          : (isDarkMode ? 'bg-amber-950/30 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700')
                      }`}
                    >
                      {emailSendMode === "individual" ? (
                        <><Mail className="w-3 h-3" /> Individual Send</>
                      ) : (
                        <><Users className="w-3 h-3" /> CC All Recipients</>
                      )}
                    </button>
                  </div>
                  <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    ⚡ Gmail limit: ~500 emails/day
                  </span>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden flex">
              {/* Compose Panel — hidden when Preview tab is active on mobile */}
              <div className={`flex-1 flex flex-col overflow-y-auto ${emailTab === "preview" ? "hidden" : ""}`}>
                <div className="px-6 py-5 space-y-4 flex-1">
                  {/* Subject */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Subject Line</label>
                    <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className={`w-full h-11 px-4 text-sm font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white' : 'border-[#E5E7EB] bg-[#faf8f3] text-slate-800'}`} placeholder="e.g. Exciting update for our valued partners" />
                  </div>

                  {/* Email Body — LARGER */}
                  <div className="flex-1 flex flex-col">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Email Body</label>
                    <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} className={`w-full flex-1 min-h-[320px] px-4 py-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all resize-none leading-relaxed ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white' : 'border-[#E5E7EB] bg-[#faf8f3] text-slate-700'}`} placeholder={"Write your email content here...\n\nUse line breaks to create paragraphs. Your signature will be appended automatically."} />
                  </div>

                  {/* Signature Block */}
                  <div className={`rounded-xl border overflow-hidden ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200"}`}>
                    <div className={`flex items-center justify-between px-4 py-2.5 ${isDarkMode ? "bg-slate-800/80" : "bg-[#faf6ed]"}`}>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Edit3 className="w-3 h-3" />Email Signature</span>
                      <button onClick={() => setShowSignatureEditor(!showSignatureEditor)} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer">
                        {emailSignature ? "Edit" : "+ Add Signature"}
                      </button>
                    </div>
                    {emailSignature && !showSignatureEditor && (
                      <div className={`px-4 py-3 border-t text-sm ${isDarkMode ? "border-slate-800 text-slate-300 bg-slate-900/40" : "border-slate-100 text-slate-600 bg-white"}`}>
                        {emailSignature.logoUrl && <img src={emailSignature.logoUrl} alt="Logo" className="max-h-12 max-w-[140px] mb-2" />}
                        <p className="font-normal">{emailSignature.signoff},</p>
                        {emailSignature.name && (
                          <p className={`mt-0.5 ${emailSignature.useCursive ? "text-xl text-white" : "font-bold"}`} style={emailSignature.useCursive ? { fontFamily: "'Dancing Script', cursive" } : undefined}>{emailSignature.name}</p>
                        )}
                        {(emailSignature.role || emailSignature.company) && <p className="text-xs text-slate-400">{[emailSignature.role, emailSignature.company].filter(Boolean).join(" | ")}</p>}
                        {(emailSignature.phone || emailSignature.website) && <p className="text-[11px] text-slate-400 mt-0.5">{[emailSignature.phone, emailSignature.website].filter(Boolean).join(" · ")}</p>}
                      </div>
                    )}
                    {showSignatureEditor && (
                      <div className={`px-4 py-4 border-t space-y-3 ${isDarkMode ? "border-slate-800" : "border-slate-100"}`}>
                        {/* Logo Upload */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1 block"><ImagePlus className="w-3 h-3" />Company Logo / Image</label>
                          <div className="flex items-center gap-3">
                            {sigForm.logoUrl ? (
                              <div className="relative group">
                                <img src={sigForm.logoUrl} alt="Logo" className={`h-10 max-w-[120px] rounded border object-contain p-1 ${
                                  isDarkMode ? "border-slate-750 bg-slate-900" : "border-slate-200 bg-[#faf8f3]"
                                }`} />
                                <button onClick={() => setSigForm(f => ({...f, logoUrl: ""}))} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                              </div>
                            ) : null}
                            <label className={`px-3 py-1.5 rounded-lg border border-dashed text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                              isDarkMode ? "border-slate-700 text-slate-400 hover:bg-slate-800" : "border-slate-300 text-slate-500 hover:bg-[#f2ece0]"
                            }`}>
                              <ImagePlus className="w-3 h-3" />{isUploadingLogo ? "Uploading..." : sigForm.logoUrl ? "Change" : "Upload Logo"}
                              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                            </label>
                            <span className="text-[9px] text-slate-400">Max 500KB</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Sign-off</label>
                            <input value={sigForm.signoff} onChange={e => setSigForm(f => ({...f, signoff: e.target.value}))} className={`w-full h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${
                              isDarkMode ? "border-slate-750 bg-slate-850 text-white" : "border-[#E5E7EB] bg-[#F9FAFB] text-slate-700"
                            }`} placeholder="Best regards" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Full Name</label>
                            <input value={sigForm.name} onChange={e => setSigForm(f => ({...f, name: e.target.value}))} className={`w-full h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${
                              isDarkMode ? "border-slate-750 bg-slate-850 text-white" : "border-[#E5E7EB] bg-[#F9FAFB] text-slate-700"
                            }`} placeholder="Lucas Huff" />
                          </div>
                        </div>
                        {/* Cursive toggle */}
                        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                          isDarkMode ? "bg-slate-850 border-slate-750" : "bg-[#faf6ed] border-slate-100"
                        }`}>
                          <PenTool className="w-3.5 h-3.5 text-indigo-500" />
                          <div className="flex-1">
                            <p className={`text-[11px] font-semibold ${isDarkMode ? "text-slate-350" : "text-slate-600"}`}>Cursive Signature</p>
                            <p className="text-[9px] text-slate-400">Display your name in an elegant handwritten font</p>
                          </div>
                          <button onClick={() => setSigForm(f => ({...f, useCursive: !f.useCursive}))} className="cursor-pointer">
                            {sigForm.useCursive ? <ToggleRight className="w-7 h-7 text-indigo-600" /> : <ToggleLeft className="w-7 h-7 text-slate-350" />}
                          </button>
                        </div>
                        {sigForm.useCursive && sigForm.name && (
                          <div className={`px-3 py-2 rounded-lg border ${isDarkMode ? "bg-slate-900 border-slate-850" : "bg-[#faf8f3] border-slate-200"}`}>
                            <p className="text-[9px] text-slate-400 mb-1 uppercase tracking-wider font-semibold">Preview</p>
                            <p className={`text-2xl ${isDarkMode ? "text-white" : "text-slate-800"}`} style={{ fontFamily: "'Dancing Script', cursive" }}>{sigForm.name}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Title / Role</label>
                            <input value={sigForm.role} onChange={e => setSigForm(f => ({...f, role: e.target.value}))} className={`w-full h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${
                              isDarkMode ? "border-slate-750 bg-slate-850 text-white" : "border-[#E5E7EB] bg-[#F9FAFB] text-slate-700"
                            }`} placeholder="CEO" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Company</label>
                            <input value={sigForm.company} onChange={e => setSigForm(f => ({...f, company: e.target.value}))} className={`w-full h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${
                              isDarkMode ? "border-slate-750 bg-slate-850 text-white" : "border-[#E5E7EB] bg-[#F9FAFB] text-slate-700"
                            }`} placeholder="SOL Theory" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Phone</label>
                            <input value={sigForm.phone} onChange={e => setSigForm(f => ({...f, phone: e.target.value}))} className={`w-full h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${
                              isDarkMode ? "border-slate-750 bg-slate-850 text-white" : "border-[#E5E7EB] bg-[#F9FAFB] text-slate-700"
                            }`} placeholder="+1 (555) 123-4567" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Website</label>
                            <input value={sigForm.website} onChange={e => setSigForm(f => ({...f, website: e.target.value}))} className={`w-full h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${
                              isDarkMode ? "border-slate-750 bg-slate-850 text-white" : "border-[#E5E7EB] bg-[#F9FAFB] text-slate-700"
                            }`} placeholder="www.soltheory.com" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button onClick={saveSignature} className="px-4 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer">Save Signature</button>
                          <button onClick={() => setShowSignatureEditor(false)} className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                            isDarkMode ? "border-slate-750 text-slate-400 hover:bg-slate-800" : "border-[#E5E7EB] text-slate-500 hover:bg-[#f2ece0]"
                          }`}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview Panel — full-width when Preview tab is active */}
              <div className={`flex flex-col overflow-y-auto ${emailTab === "preview" ? "flex-1" : "hidden lg:flex lg:w-[380px] lg:shrink-0"} border-l ${isDarkMode ? 'border-slate-800 bg-slate-900/60 text-white' : 'border-[#E5E7EB] bg-[#faf6ed]'}`}>
                <div className={`px-5 py-3 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-[#faf8f3]'}`}>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />Email Preview</h4>
                </div>
                <div className="flex-1 p-5 flex justify-center">
                  <div className={`rounded-xl border shadow-sm overflow-hidden w-full ${emailTab === "preview" ? "max-w-2xl" : ""} ${isDarkMode ? 'bg-slate-950 border-slate-850' : 'bg-[#faf8f3] border-slate-200'}`}>
                    {/* Fake email header */}
                    <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-slate-850 bg-slate-900/50' : 'border-slate-100 bg-[#faf6ed]/50'}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">{(emailSignature?.name || user?.displayName || "Y")[0]}</div>
                        <div>
                          <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{emailSignature?.name || user?.displayName || "You"}</p>
                          <p className="text-[11px] text-slate-400">to {selectedCustomers.filter(c=>c.email).length} recipients</p>
                        </div>
                      </div>
                      <p className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'} ${emailTab === "preview" ? "text-lg" : "text-sm"}`}>{emailSubject || "(No subject)"}</p>
                    </div>
                    {/* Email body preview */}
                    <div className={`px-6 py-5 leading-relaxed ${emailTab === "preview" ? "text-base min-h-[300px]" : "text-sm min-h-[150px]"} ${isDarkMode ? 'text-slate-350' : 'text-slate-700'}`}>
                      {emailBody ? emailBody.split('\n').map((line, i) => (
                        <p key={i} className="mb-3 last:mb-0">{line || <>&nbsp;</>}</p>
                      )) : <p className="text-slate-400 italic">Your email content will appear here...</p>}
                      {emailSignature && (
                        <div className={`border-t pt-3 mt-6 ${isDarkMode ? 'border-slate-850 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                          {emailSignature.logoUrl && <img src={emailSignature.logoUrl} alt="Logo" className="max-h-12 max-w-[140px] mb-2" />}
                          <p>{emailSignature.signoff},</p>
                          {emailSignature.name && (
                            <p className={`mt-0.5 ${emailSignature.useCursive ? "text-xl " + (isDarkMode ? "text-white" : "text-slate-800") : ("font-bold " + (isDarkMode ? "text-slate-300" : "text-slate-700"))}`} style={emailSignature.useCursive ? { fontFamily: "'Dancing Script', cursive" } : undefined}>{emailSignature.name}</p>
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
            <div className={`flex items-center justify-between px-6 py-3 border-t shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-950/40 text-white' : 'border-[#E5E7EB] bg-[#faf6ed]/80'}`}>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 font-medium">{selectedCustomers.filter(c => c.email).length} of {selectedCustomers.length} have email</span>
                {/* Draft controls */}
                <div className="relative">
                  <button onClick={() => setShowDrafts(!showDrafts)} className="text-[11px] text-indigo-600 font-semibold hover:text-indigo-700 cursor-pointer flex items-center gap-1">
                    <Download className="w-3 h-3" />{campaignDrafts.length > 0 ? `Drafts (${campaignDrafts.length})` : "Drafts"}
                  </button>
                  {showDrafts && (
                    <div className={`absolute bottom-full left-0 mb-2 w-72 rounded-xl border shadow-xl z-10 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-850' : 'bg-[#faf8f3] border-slate-200'}`}>
                      <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-250' : 'text-slate-700'}`}>Saved Drafts</span>
                        <button onClick={() => setShowDrafts(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {campaignDrafts.length === 0 ? (
                          <p className="px-4 py-4 text-xs text-slate-400 text-center">No drafts saved yet</p>
                        ) : campaignDrafts.map(draft => (
                          <div key={draft.id} className={`px-4 py-2.5 border-b flex items-center justify-between group cursor-pointer ${isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-50 hover:bg-[#f2ece0]'}`} onClick={() => loadDraft(draft)}>
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{draft.subject || "(No subject)"}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{new Date(draft.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); deleteDraft(draft.id); }} className={`opacity-0 group-hover:opacity-100 p-1 rounded text-red-400 hover:text-red-600 transition-all cursor-pointer ${isDarkMode ? 'hover:bg-red-950/20' : 'hover:bg-red-50'}`}><Trash className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={saveDraft} disabled={!emailSubject.trim()} className={`px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-350 hover:bg-slate-750' : 'border-[#E5E7EB] bg-[#faf8f3] text-slate-600 hover:bg-[#f2ece0]'
                }`}><Download className="w-3 h-3" />Save Draft</button>
                <button onClick={() => { setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); setEmailTab("compose"); }} className={`px-4 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-350 hover:bg-slate-750' : 'border-[#E5E7EB] bg-[#faf8f3] text-slate-600 hover:bg-[#f2ece0]'
                }`}>Cancel</button>
                <button disabled={!emailSubject.trim() || !emailBody.trim() || isSendingCampaign} onClick={handleSendCampaign} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 text-xs font-bold text-white hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer">
                  {isSendingCampaign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {isSendingCampaign ? "Sending..." : "Send Campaign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ━━━━━━ JARVIS COPILOT SIDEBAR ━━━━━━ */}
      {/* ────── JARVIS COPILOT SIDEBAR ────── */}
      <div className={`fixed top-0 right-0 h-full z-[80] transition-all duration-300 ease-in-out ${isJarvisOpen ? "w-full lg:w-[340px]" : "w-0"} overflow-hidden`}>
        <div className={`w-full lg:w-[340px] h-full border-l flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-[#f0e8d0] border-[#E5E7EB]'}`}>
          {/* Header */}
          <div className={`h-16 flex items-center justify-between px-5 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-[#E5E7EB]'}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className={`text-sm font-bold leading-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Jarvis AI Copilot</h3>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Online</span>
              </div>
            </div>
            <button onClick={() => setIsJarvisOpen(false)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 cursor-pointer ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
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
                    : (isDarkMode ? "bg-slate-800 text-slate-200 rounded-bl-md border border-slate-700" : "bg-slate-100 text-slate-700 rounded-bl-md border border-slate-200")
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className={`border-t px-4 py-3 shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-950/20' : 'border-[#E5E7EB] bg-[#f0e8d0]'}`}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={jarvisInput}
                onChange={e => setJarvisInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleJarvisSend(); }}
                placeholder="Ask Jarvis anything..."
                className={`flex-1 h-10 px-3.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-750 text-white placeholder:text-slate-500' : 'bg-[#F9FAFB] border-[#E5E7EB] text-slate-700 placeholder:text-slate-400'}`}
              />
              <button
                onClick={handleJarvisSend}
                disabled={!jarvisInput.trim()}
                className="w-10 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">Try "show all contacts" or "add contact Jane Doe"</p>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────── ADD CONTACT MODAL ──────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={()=>{setShowAddModal(false);resetForm();}}>
          <div className={`rounded-2xl border shadow-2xl w-full max-w-lg mx-4 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/60' : 'bg-[#faf8f3] border-[#E5E7EB]'}`} onClick={e=>e.stopPropagation()}>
            <div className={`flex items-center justify-between px-6 py-5 border-b ${isDarkMode ? 'border-slate-800' : 'border-[#E5E7EB]'}`}>
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{t.crmAddNewContact}</h2>
              <button onClick={()=>{setShowAddModal(false);resetForm();}} className={`w-8 h-8 rounded-lg ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} flex items-center justify-center text-slate-400 cursor-pointer`}><X className="w-4 h-4"/></button>
            </div>
            <div className="px-6 py-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1.5 uppercase tracking-wider`}>{lang === 'es' ? 'Nombre' : 'First Name'} *</label>
                  <input value={form.firstName} onChange={e=>setForm(f=>({...f,firstName:e.target.value}))} className={`w-full h-10 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-[#E5E7EB] bg-[#F9FAFB] text-slate-700'}`} placeholder={lang === 'es' ? 'Nombre' : 'First name'} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1.5 uppercase tracking-wider`}>{lang === 'es' ? 'Apellido' : 'Last Name'} *</label>
                  <input value={form.lastName} onChange={e=>setForm(f=>({...f,lastName:e.target.value}))} className={`w-full h-10 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-[#E5E7EB] bg-[#F9FAFB] text-slate-700'}`} placeholder={lang === 'es' ? 'Apellido' : 'Last name'} />
                </div>
              </div>
              <div>
                <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1.5 uppercase tracking-wider`}>{t.crmEmail}</label>
                <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} type="email" className={`w-full h-10 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-[#E5E7EB] bg-[#F9FAFB] text-slate-700'}`} placeholder="email@example.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1.5 uppercase tracking-wider`}>{t.crmPhone}</label>
                  <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className={`w-full h-10 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-[#E5E7EB] bg-[#F9FAFB] text-slate-700'}`} placeholder="+1 (555) 000-0000" />
                </div>
                <div>
                  <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1.5 uppercase tracking-wider`}>{lang === 'es' ? 'Cumpleaños' : 'Birthday'}</label>
                  <input value={form.birthday} onChange={e=>setForm(f=>({...f,birthday:e.target.value}))} type="date" className={`w-full h-10 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-[#E5E7EB] bg-[#F9FAFB] text-slate-700'}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1.5 uppercase tracking-wider`}>Company</label>
                  <input value={form.company} onChange={e=>setForm(f=>({...f,company:e.target.value}))} className={`w-full h-10 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-[#E5E7EB] bg-[#F9FAFB] text-slate-700'}`} placeholder="Acme Corp" />
                </div>
                <div>
                  <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1.5 uppercase tracking-wider`}>Location</label>
                  <input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} className={`w-full h-10 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-[#E5E7EB] bg-[#F9FAFB] text-slate-700'}`} placeholder="New York, NY" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1.5 uppercase tracking-wider`}>{t.crmLeadStatus}</label>
                  <select value={form.leadStatus} onChange={e=>setForm(f=>({...f,leadStatus:e.target.value as Customer["leadStatus"]}))} className={`w-full h-10 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-[#E5E7EB] bg-[#F9FAFB] text-slate-700'}`}>
                    <option value="Cold Lead">{getStatusLabel("Cold Lead", lang === "es")}</option>
                    <option value="Warm Lead">{getStatusLabel("Warm Lead", lang === "es")}</option>
                    <option value="Interested">{getStatusLabel("Interested", lang === "es")}</option>
                    <option value="Sale Completed">{getStatusLabel("Sale Completed", lang === "es")}</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1.5 uppercase tracking-wider`}>{t.crmTags}</label>
                  <input value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} className={`w-full h-10 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-[#E5E7EB] bg-[#F9FAFB] text-slate-700'}`} placeholder="VIP, Enterprise" />
                </div>
              </div>
            </div>
            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${isDarkMode ? 'border-slate-800 bg-slate-950/20' : 'border-[#E5E7EB] bg-[#faf6ed]/50'}`}>
              <button onClick={()=>{setShowAddModal(false);resetForm();}} className="px-4 py-2 rounded-lg border border-[#E5E7EB] bg-[#faf8f3] text-sm font-medium text-slate-600 hover:bg-[#f2ece0] cursor-pointer">Cancel</button>
              <button onClick={handleAddContact} disabled={!form.firstName.trim()||!form.lastName.trim()} className="px-5 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer">Add Contact</button>
            </div>
          </div>
        </div>
      )}

      {showCSVModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setShowCSVModal(false); setCsvText(""); setCsvFile(null); }}>
          <div className={`rounded-2xl border shadow-2xl w-full max-w-lg mx-4 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/60' : 'bg-[#faf8f3] border-[#E5E7EB]'}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-6 py-5 border-b ${isDarkMode ? 'border-slate-800' : 'border-[#E5E7EB]'}`}>
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {lang === 'es' ? 'Importar Contactos por CSV' : 'Import Contacts via CSV'}
              </h2>
              <button onClick={() => { setShowCSVModal(false); setCsvText(""); setCsvFile(null); }} className={`w-8 h-8 rounded-lg ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} flex items-center justify-center text-slate-400 cursor-pointer`}><X className="w-4 h-4" /></button>
            </div>
            
            <div className="px-6 py-6 space-y-5">
              <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} leading-relaxed space-y-2.5`}>
                <p>
                  Import multiple contacts at once using a <strong className={isDarkMode ? 'text-white' : 'text-slate-700'}>CSV file</strong> or by <strong className={isDarkMode ? 'text-white' : 'text-slate-700'}>pasting text</strong> directly below.
                </p>
                <p>
                  Your CSV <em>must</em> include a <strong className={isDarkMode ? 'text-white' : 'text-slate-700'}>header row</strong> with column names that <strong className={isDarkMode ? 'text-white' : 'text-slate-700'}>exactly match</strong> the CRM field names in <strong className={isDarkMode ? 'text-white' : 'text-slate-700'}>camelCase</strong> format:
                </p>
                <div className={`px-3 py-2 rounded-lg font-mono text-[10px] leading-relaxed ${isDarkMode ? 'bg-slate-800 text-indigo-300 border border-slate-700' : 'bg-slate-100 text-indigo-700 border border-slate-200'}`}>
                  firstName, lastName, company, email, phoneNumber,{' '}<br />pipelineStage, revenue, tags, location, lastContactedDate
                </div>
                <p>
                  <strong className={isDarkMode ? 'text-white' : 'text-slate-700'}>firstName</strong> and <strong className={isDarkMode ? 'text-white' : 'text-slate-700'}>lastName</strong> are <em>required</em>. All other columns are optional. Unrecognized column names will be <strong className={isDarkMode ? 'text-red-400' : 'text-red-600'}>rejected</strong>.
                </p>
              </div>

              {/* Monospace CSV Text area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider`}>
                    {lang === 'es' ? 'Pegar Datos CSV' : 'Paste CSV Data'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('csv-paste-area') as HTMLTextAreaElement | null;
                      if (el) {
                        if (el.style.height === '60vh') {
                          el.style.height = '';
                          el.rows = 5;
                        } else {
                          el.style.height = '60vh';
                        }
                      }
                    }}
                    className={`text-[10px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                  >
                    ⤢ {lang === 'es' ? 'Expandir' : 'Expand'}
                  </button>
                </div>
                <textarea
                  id="csv-paste-area"
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  rows={5}
                  disabled={!!csvFile}
                  style={{ resize: 'vertical', minHeight: '100px', maxHeight: '70vh' }}
                  className={`w-full p-3 text-xs rounded-lg border font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-[#E5E7EB] bg-[#F9FAFB] text-slate-700'} disabled:opacity-55`}
                  placeholder={"firstName, lastName, company, email, phoneNumber, pipelineStage, revenue, tags, location, lastContactedDate\nJohn, Doe, Acme Corp, john@test.com, 555-1234, Warm Lead, 0, VIP, New York, 2025-06-01"}
                />
              </div>

              <div className="flex items-center justify-center gap-2">
                <div className={`h-px flex-1 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{lang === 'es' ? 'O' : 'Or'}</span>
                <div className={`h-px flex-1 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
              </div>

              {/* Upload file selection */}
              <div className="space-y-1.5">
                <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider`}>
                  {lang === 'es' ? 'Subir Archivo .csv' : 'Upload .csv File'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setCsvFile(e.target.files[0]);
                        setCsvText("");
                      }
                    }}
                    className="hidden"
                    id="csv-file-selector"
                  />
                  <label
                    htmlFor="csv-file-selector"
                    className={`px-4 py-2 border rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm ${
                      isDarkMode 
                        ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750' 
                        : 'border-[#E5E7EB] bg-[#F9FAFB] text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {lang === 'es' ? 'Seleccionar archivo' : 'Choose File'}
                  </label>
                  <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} truncate flex-1`}>
                    {csvFile ? csvFile.name : (lang === 'es' ? 'Ningún archivo seleccionado' : 'No file selected')}
                  </span>
                  {csvFile && (
                    <button
                      onClick={() => setCsvFile(null)}
                      className={`w-7 h-7 rounded-md flex items-center justify-center text-slate-400 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} cursor-pointer`}
                      title="Clear file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${isDarkMode ? 'border-slate-800 bg-slate-950/20' : 'border-[#E5E7EB] bg-[#faf6ed]/50'}`}>
              <button
                onClick={() => { setShowCSVModal(false); setCsvText(""); setCsvFile(null); }}
                className={`px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                  isDarkMode 
                    ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750' 
                    : 'border-[#E5E7EB] bg-[#faf8f3] text-slate-600 hover:bg-[#f2ece0]'
                }`}
              >
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                onClick={handleCSVSubmit}
                disabled={(!csvText.trim() && !csvFile) || isImporting}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer inline-flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {lang === 'es' ? 'Importando...' : 'Importing...'}
                  </>
                ) : (
                  lang === 'es' ? 'Importar' : 'Import'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━ TOAST NOTIFICATIONS ━━━━━━ */}
      <ToastContainer />

      {/* ━━━━━━ EDITABLE CONTACT POPUP WITH MULTI-USER NAV ━━━━━━ */}
      {editModalIds.length > 0 && (() => {
        const currentCustomer = customers.find(x => x.id === editModalIds[editModalIndex]);
        if (!currentCustomer) return null;
        const inputClass = `w-full h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${
          isDarkMode ? "border-slate-700 bg-slate-800 text-white" : "border-[#E5E7EB] bg-[#F9FAFB] text-slate-700"
        }`;
        const labelClass = "block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5";
        return (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => { setEditModalIds([]); setEditForm({}); }}>
            <div className={`rounded-2xl border shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/60' : 'bg-[#faf8f3] border-[#E5E7EB]'}`} onClick={e => e.stopPropagation()}>
              {/* Header with Navigation */}
              <div className={`px-6 py-4 border-b flex items-center justify-between ${isDarkMode ? "border-slate-800" : "border-[#E5E7EB]"}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm border ${
                    isDarkMode ? "bg-indigo-950/40 text-indigo-400 border-indigo-900" : "bg-indigo-50 text-indigo-600 border-indigo-100"
                  }`}>{editForm.firstName?.[0] || ""}{editForm.lastName?.[0] || ""}</div>
                  <div>
                    <h2 className={`text-base font-bold ${isDarkMode ? "text-white" : "text-slate-800"}`}>Edit Contact</h2>
                    {editModalIds.length > 1 && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <button onClick={() => navigateEdit("prev")} disabled={editModalIndex === 0} className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className={`text-xs font-semibold tabular-nums ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{editModalIndex + 1}/{editModalIds.length}</span>
                        <button onClick={() => navigateEdit("next")} disabled={editModalIndex === editModalIds.length - 1} className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => { setEditModalIds([]); setEditForm({}); }} className={`w-8 h-8 rounded-lg ${isDarkMode ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-400"} flex items-center justify-center cursor-pointer`}><X className="w-4 h-4" /></button>
              </div>

              {/* Dynamic Editable Form — renders fields based on visible columns */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {/* Created date (read-only display) */}
                {currentCustomer?.createdAt && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/40' : 'bg-slate-50 border-slate-200/60'}`}>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Created:</span>
                    <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      {(() => {
                        const ts = typeof currentCustomer.createdAt?.toMillis === "function" ? currentCustomer.createdAt.toMillis() : new Date(currentCustomer.createdAt).getTime();
                        return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
                      })()}
                    </span>
                  </div>
                )}

                {/* Dynamic field grid — 2 columns */}
                <div className="grid grid-cols-2 gap-3">
                  {getVisibleFieldDefs().map((field) => {
                    const fieldVal = editForm[field.id] ?? "";
                    const onChange = (val: any) => setEditForm(f => ({ ...f, [field.id]: val }));

                    switch (field.type) {
                      case "select":
                        return (
                          <div key={field.id}>
                            <label className={labelClass}>{field.label}</label>
                            <select value={fieldVal || (field.options?.[0] ?? "")} onChange={e => onChange(e.target.value)} className={inputClass}>
                              {(field.options || (field.id === "leadStatus" ? ["Cold Lead", "Warm Lead", "Interested", "Sale Completed"] : [])).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </div>
                        );
                      case "date":
                        return (
                          <div key={field.id}>
                            <label className={labelClass}>{field.label}</label>
                            <input type="date" value={fieldVal} onChange={e => onChange(e.target.value)} className={inputClass} />
                          </div>
                        );
                      case "email":
                        return (
                          <div key={field.id}>
                            <label className={labelClass}>{field.label}</label>
                            <input type="email" value={fieldVal} onChange={e => onChange(e.target.value)} className={inputClass} placeholder="email@example.com" />
                          </div>
                        );
                      case "phone":
                        return (
                          <div key={field.id}>
                            <label className={labelClass}>{field.label}</label>
                            <input type="tel" value={fieldVal} onChange={e => onChange(e.target.value)} className={inputClass} placeholder="+1 (555) 000-0000" />
                          </div>
                        );
                      case "number":
                        return (
                          <div key={field.id}>
                            <label className={labelClass}>{field.label}</label>
                            <input type="number" value={fieldVal} onChange={e => onChange(e.target.value)} className={inputClass} />
                          </div>
                        );
                      case "currency":
                        return (
                          <div key={field.id}>
                            <label className={labelClass}>{field.label}</label>
                            <input type="number" step="0.01" value={fieldVal ?? 0} onChange={e => onChange(e.target.value)} className={inputClass} />
                          </div>
                        );
                      case "tags":
                        return (
                          <div key={field.id} className="col-span-2">
                            <label className={labelClass}>{field.label}</label>
                            <TagSelector value={fieldVal} onChange={onChange} isDarkMode={isDarkMode} />
                          </div>
                        );
                      case "boolean":
                        return (
                          <div key={field.id} className="flex items-center gap-2 py-1">
                            <input type="checkbox" checked={!!fieldVal} onChange={e => onChange(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            <label className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{field.label}</label>
                          </div>
                        );
                      case "url":
                        return (
                          <div key={field.id}>
                            <label className={labelClass}>{field.label}</label>
                            <input type="url" value={fieldVal} onChange={e => onChange(e.target.value)} className={inputClass} placeholder="https://" />
                          </div>
                        );
                      default:
                        // text and any other type
                        return (
                          <div key={field.id}>
                            <label className={labelClass}>{field.label}</label>
                            <input type="text" value={fieldVal} onChange={e => onChange(e.target.value)} className={inputClass} />
                          </div>
                        );
                    }
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className={`px-6 py-4 border-t flex items-center justify-between ${isDarkMode ? "border-slate-800" : "border-[#E5E7EB]"}`}>
                <button onClick={() => { setEditModalIds([]); setEditForm({}); }} className={`text-sm font-medium cursor-pointer ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}>Cancel</button>
                <button
                  disabled={isSavingEdit}
                  onClick={async () => {
                    await saveEditForm(editModalIds[editModalIndex]);
                    if (editModalIds.length === 1) { setEditModalIds([]); setEditForm({}); }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                >
                  {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ━━━━━━ CONTACT DETAILS VIEW ━━━━━━ */}
      {showContactView && (() => {
        const contactList = customers.filter(c => selectedIds.has(c.id));
        return (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => { setShowContactView(false); setExpandedContactId(null); }}>
            <div className={`rounded-2xl border shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[85vh] flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/60' : 'bg-[#faf8f3] border-[#E5E7EB]'}`} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className={`px-6 py-4 border-b flex items-center justify-between ${isDarkMode ? "border-slate-800" : "border-[#E5E7EB]"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-sky-950/40' : 'bg-sky-50'}`}>
                    <Contact className="w-4 h-4 text-sky-500" />
                  </div>
                  <div>
                    <h2 className={`text-base font-bold ${isDarkMode ? "text-white" : "text-slate-800"}`}>Contact Details</h2>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{contactList.length} contact{contactList.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <button onClick={() => { setShowContactView(false); setExpandedContactId(null); }} className={`w-8 h-8 rounded-lg ${isDarkMode ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-400"} flex items-center justify-center cursor-pointer`}><X className="w-4 h-4" /></button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
                {contactList.map(c => (
                  <div key={c.id} className={`rounded-xl border overflow-hidden transition-all ${isDarkMode ? 'border-slate-800' : 'border-[#E5E7EB]'}`}>
                    <button
                      onClick={() => setExpandedContactId(prev => prev === c.id ? null : c.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                        isDarkMode
                          ? expandedContactId === c.id ? 'bg-slate-800' : 'hover:bg-slate-800/60'
                          : expandedContactId === c.id ? 'bg-slate-50' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${isDarkMode ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>{c.firstName[0]}{c.lastName[0]}</div>
                        <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{c.firstName} {c.lastName}</span>
                      </div>
                      {expandedContactId === c.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {expandedContactId === c.id && (
                      <div className={`px-4 pb-3 space-y-2 ${isDarkMode ? 'bg-slate-800/40' : 'bg-slate-50/40'}`}>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Email", value: c.email || "—", icon: <Mail className="w-3 h-3 text-indigo-500" /> },
                            { label: "Phone", value: c.phone || "—", icon: <Phone className="w-3 h-3 text-emerald-500" /> },
                            { label: "Birthday", value: c.birthday || "—", icon: <Calendar className="w-3 h-3 text-amber-500" /> },
                            { label: "Revenue", value: `$${c.totalRevenue.toFixed(2)}`, icon: <DollarSign className="w-3 h-3 text-emerald-500" /> },
                          ].map(item => (
                            <div key={item.label} className={`p-2.5 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {item.icon}
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
                              </div>
                              <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusStyles(c.leadStatus)}`}>{c.leadStatus}</span>
                          {c.tags.map(t => <span key={t} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getTagStyles(t)}`}>{t}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ━━━━━━ DELETE CONFIRMATION DIALOG ━━━━━━ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowDeleteConfirm(false)}>
          <div className={`rounded-2xl border shadow-2xl w-full max-w-sm mx-4 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/60' : 'bg-[#faf8f3] border-[#E5E7EB]'}`} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-6 text-center">
              <div className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-red-950/40' : 'bg-red-50'}`}>
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Delete Contacts?</h3>
              <p className={`text-sm mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                You are about to permanently delete <span className="font-bold text-red-500">{selectedIds.size}</span> contact{selectedIds.size !== 1 ? "s" : ""}.
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>This action cannot be undone.</p>

              {/* Show names preview */}
              <div className={`mt-4 max-h-24 overflow-y-auto rounded-lg border p-2.5 text-left ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                {customers.filter(c => selectedIds.has(c.id)).slice(0, 10).map(c => (
                  <div key={c.id} className={`text-xs py-0.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {c.firstName} {c.lastName}
                  </div>
                ))}
                {selectedIds.size > 10 && <span className="text-[10px] text-slate-400">...and {selectedIds.size - 10} more</span>}
              </div>
            </div>
            <div className={`px-6 py-4 border-t flex items-center justify-end gap-3 ${isDarkMode ? 'border-slate-800' : 'border-[#E5E7EB]'}`}>
              <button onClick={() => setShowDeleteConfirm(false)} className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>Cancel</button>
              <button onClick={handleBulkDelete} className="px-4 py-2 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer shadow-sm">
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━ COMMAND PALETTE ━━━━━━ */}
      <CRMCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectContact={(c) => { setSelectedContactId(c.id); setIsCommandPaletteOpen(false); }}
        onNavigate={(view) => {
          if (view === "import") {
            setShowCSVModal(true);
          } else {
            setActiveView(view as CrmView);
          }
          setIsCommandPaletteOpen(false);
        }}
        onAddContact={() => { setShowAddModal(true); setIsCommandPaletteOpen(false); }}
      />

      {/* ━━━━━━ BULK ACTIONS BAR ━━━━━━ */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        onChangeStatus={(status) => {
          selectedIds.forEach(id => updateStatus(id, status as any));
          showToast(`Updated ${selectedIds.size} contacts to ${status}`);
          setSelectedIds(new Set());
        }}
        onAddTag={(tag) => {
          if (presetTagNames.includes(tag)) {
            setMruPresetTag(tag);
          }
          selectedIds.forEach(id => {
            const customer = customers.find(c => c.id === id);
            if (customer && !customer.tags.includes(tag)) {
              store.updateCustomer(id, { tags: [...customer.tags, tag] });
            }
          });
          showToast(`Added "${tag}" to ${selectedIds.size} contacts`);
        }}
        onRemoveTag={(tag) => {
          selectedIds.forEach(id => {
            const customer = customers.find(c => c.id === id);
            if (customer) {
              store.updateCustomer(id, { tags: customer.tags.filter(t => t !== tag) });
            }
          });
          showToast(`Removed "${tag}" from ${selectedIds.size} contacts`);
        }}
        onSendEmail={() => setShowEmailModal(true)}
        onExport={() => setShowExportModal(true)}
        onDelete={() => setShowDeleteConfirm(true)}
        onClearSelection={() => setSelectedIds(new Set())}
        availableTags={sortedAvailableTags}
        availableStatuses={["Cold Lead", "Warm Lead", "Interested", "Sale Completed"]}
      />

      {/* ━━━━━━ DUPLICATE DETECTOR ━━━━━━ */}
      <DuplicateDetector
        isOpen={showDuplicateDetector}
        onClose={() => setShowDuplicateDetector(false)}
        customers={customers}
      />
    </div>
  );
}
