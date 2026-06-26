"use client";

import CampaignCalendar from "@/components/crm/CampaignCalendar";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTranslation } from '@/lib/i18n';
import { useDarkMode } from "@/lib/useDarkMode";
import { useUser, useFirestore } from "@/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { useCRMStore } from "@/stores/crm-store";
import type { Customer, Meeting, CrmNotification, Conversation, InboxMessage, InboxChannel, TicketStatus, ChatMessage } from "@/stores/crm-store";
import { ToastContainer } from "@/components/crm/Toast";
import { DashboardSkeleton, AnalyticsSkeleton } from "@/components/crm/Skeletons";
import {
  Search, Plus, Bell, LayoutDashboard, Users, GitBranch, BarChart3,
  UserPlus, Mail, ChevronDown, ChevronUp, Filter, Download, Brain,
  Phone, DollarSign, Activity, ArrowUpRight, MoreHorizontal, X,
  MessageCircle, PanelRightClose, PanelRightOpen, Send, Sparkles, Trash2,
  CheckSquare, Square, Tag, MailPlus, Calendar, Clock, ToggleLeft, ToggleRight,
  CalendarCheck, Eye, MessageSquare, Smartphone, Hash, Zap, SearchX,
  Menu, Palette, Link2, Edit3, Trash, Loader2, ImagePlus, PenTool, CalendarRange,
  Table2, MapPin, Building2,
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

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ NAV CONFIG Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */

const crmNavItems = [
  { id: "dashboard", label: "Database", icon: Table2 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;

type CrmView = "dashboard" | "campaigns" | "analytics";

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ STATUS & TAG HELPERS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */

const getStatusLabel = (status: string, isSpanish: boolean) => {
  if (!isSpanish) return status;
  switch (status) {
    case "Cold Lead": return "Prospecto FrÃƒÂ­o";
    case "Warm Lead": return "Prospecto Tibio";
    case "Interested": return "Interesado";
    case "Sale Completed": return "Venta Completada";
    default: return status;
  }
};

const getTagStyles = (tag: string, isDarkMode: boolean) => {
  if (isDarkMode) {
    switch (tag) {
      case "VIP": return "bg-amber-950/40 text-amber-400 border-amber-800";
      case "Enterprise": return "bg-purple-950/40 text-purple-400 border-purple-800";
      case "Inbound": return "bg-sky-950/40 text-sky-400 border-sky-800";
      case "Referral": return "bg-emerald-950/40 text-emerald-400 border-emerald-800";
      case "High-Value": return "bg-rose-950/40 text-rose-400 border-rose-800";
      default: return "bg-slate-900 text-slate-300 border-slate-700";
    }
  } else {
    return TAG_COLORS[tag] || "${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-[#faf6ed] text-slate-600 border-slate-200'}";
  }
};

const getStatusStyles = (status: string, isDarkMode: boolean) => {
  if (isDarkMode) {
    switch (status) {
      case "Cold Lead": return "bg-blue-950/40 text-blue-400 border-blue-800";
      case "Warm Lead": return "bg-orange-950/40 text-orange-400 border-orange-800";
      case "Interested": return "bg-purple-950/40 text-purple-400 border-purple-800";
      case "Sale Completed": return "bg-emerald-950/40 text-emerald-400 border-emerald-800";
      default: return "bg-slate-900 text-slate-300 border-slate-700";
    }
  } else {
    return STATUS_COLORS[status] || "bg-[#faf6ed] text-slate-600 border-slate-200";
  }
};

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ EMPTY STATES Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */

function EmptyContacts({ onAdd }: { onAdd: () => void }) {
  const { t, lang } = useTranslation();
  const isDarkMode = useDarkMode();

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-300'}`}>
        <Users className="w-9 h-9" />
      </div>
      <h3 className={`text-lg font-semibold mb-1.5 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{t.crmNoContactsYet}</h3>
      <p className={`text-sm text-center max-w-sm mb-6 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
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
  const isDarkMode = useDarkMode();

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-300'}`}>
        <GitBranch className="w-9 h-9" />
      </div>
      <h3 className={`text-lg font-semibold mb-1.5 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{t.crmPipelineEmpty}</h3>
      <p className={`text-sm text-center max-w-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {t.crmPipelineEmptyDesc}
      </p>
    </div>
  );
}

function EmptyInbox() {
  const { t, lang } = useTranslation();
  const isDarkMode = useDarkMode();

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-300'}`}>
        <Mail className="w-9 h-9" />
      </div>
      <h3 className={`text-lg font-semibold mb-1.5 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{t.crmInboxClear}</h3>
      <p className={`text-sm text-center max-w-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {t.crmInboxClearDesc}
      </p>
    </div>
  );
}

function EmptyAnalytics() {
  const { t, lang } = useTranslation();
  const isDarkMode = useDarkMode();

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-300'}`}>
        <BarChart3 className="w-9 h-9" />
      </div>
      <h3 className={`text-lg font-semibold mb-1.5 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{t.crmNoDataAnalyze}</h3>
      <p className={`text-sm text-center max-w-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {t.crmNoDataAnalyzeDesc}
      </p>
    </div>
  );
}

/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ METRIC CARD ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */

function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  isDarkMode,
}: {
  label: string;
  value: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  isDarkMode?: boolean;
}) {
  return (
    <div className={`p-5 flex flex-col gap-2.5 border-b border-r ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
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

  /* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ ZUSTAND STORE ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
  const store = useCRMStore();
  const { customers, meetings, notifications, conversations, chatMessages, customTags, integrations,
    isLoading, isAddingContact, isDeducing, isSendingReply,
    initializeStore, teardown, addContact, updateStatus, deleteContact, bulkDelete, setCustomers,
    addMeeting, addNotification, markNotificationsRead,
    sendInboxReply: storeSendReply, updateTicketStatus, markConversationRead,
    addJarvisMessage, runDeduction,
    setCustomTags, setIntegrations, showToast } = store;

  /* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ LOCAL UI STATE ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
  const [activeView, setActiveView] = useState<CrmView>("dashboard");
  const { t, lang } = useTranslation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => { const check = () => setIsDarkMode(localStorage.getItem('insight_theme') === 'dark'); check(); const interval = setInterval(check, 500); window.addEventListener('storage', check); return () => { clearInterval(interval); window.removeEventListener('storage', check); }; }, []);
  const getCrmNavLabel = (id: string) => {
    switch (id) {
      case "dashboard": return "Database";
      case "campaigns": return t.crmCampaignManager;
      case "analytics": return t.crmAnalytics;
      default: return "";
    }
  };
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
    if (contactParts.length > 0) parts.push(`<p style="margin:2px 0 0 0;color:#9ca3af;font-size:12px;">${contactParts.join(" Ãƒâ€šÃ‚Â· ")}</p>`);
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
        showToast(`Ã¢Å“â€¦ Successfully sent ${data.sentCount} emails!`);
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

  /* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ INITIALIZE FIRESTORE ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
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

  /* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ INBOX LOCAL UI ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
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

  /* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ OMNI-SEARCH ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
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
    await addContact(c);
    logActivity(db, 'crm_entry_created', { email: user?.email || '', displayName: user?.displayName }, `Added contact: ${c.firstName} ${c.lastName}`);
    resetForm(); setShowAddModal(false);
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    
    // Required camelCase column names that exactly match our CRM schema
    const VALID_COLUMNS = ['firstName', 'lastName', 'company', 'email', 'phoneNumber', 'pipelineStage', 'revenue', 'tags', 'location', 'lastContactedDate'];
    
    const parsed: { firstName: string; lastName: string; email: string; phone: string; leadStatus: Customer["leadStatus"]; tags: string; company: string; location: string; lastContactedDate: string; revenue: number }[] = [];
    
    // Parse a single CSV row (handles quoted fields)
    const parseRow = (line: string): string[] => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' || ch === "'") { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ""; }
        else { current += ch; }
      }
      values.push(current.trim());
      return values.map(v => {
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        return v.trim();
      });
    };

    // First line MUST be a header row
    const headers = parseRow(lines[0]);
    
    // Validate that all headers are recognized
    const unrecognized = headers.filter(h => !VALID_COLUMNS.includes(h));
    if (unrecognized.length > 0) {
      showToast(`Unrecognized column(s): ${unrecognized.join(', ')}. Columns must exactly match: ${VALID_COLUMNS.join(', ')}`, 'error');
      return [];
    }
    
    // Require firstName and lastName
    if (!headers.includes('firstName') || !headers.includes('lastName')) {
      showToast('CSV must include "firstName" and "lastName" columns.', 'error');
      return [];
    }
    
    // Build column index map
    const colIdx = (name: string) => headers.indexOf(name);
    
    const matchStatus = (str: string): Customer["leadStatus"] | null => {
      const s = str.trim().toLowerCase();
      if (s.includes("cold")) return "Cold Lead";
      if (s.includes("warm")) return "Warm Lead";
      if (s.includes("interest")) return "Interested";
      if (s.includes("sale") || s.includes("complet")) return "Sale Completed";
      return null;
    };

    for (let i = 1; i < lines.length; i++) {
      const values = parseRow(lines[i]);
      
      const get = (name: string) => {
        const idx = colIdx(name);
        return idx !== -1 && idx < values.length ? values[idx] : '';
      };
      
      const firstName = get('firstName');
      const lastName = get('lastName');
      if (!firstName && !lastName) continue;
      
      let leadStatus: Customer["leadStatus"] = "Cold Lead";
      const stageVal = get('pipelineStage');
      if (stageVal) {
        const matched = matchStatus(stageVal);
        if (matched) leadStatus = matched;
      }
      
      parsed.push({
        firstName,
        lastName,
        email: get('email'),
        phone: get('phoneNumber'),
        leadStatus,
        tags: get('tags'),
        company: get('company'),
        location: get('location'),
        lastContactedDate: get('lastContactedDate'),
        revenue: parseFloat(get('revenue')) || 0,
      });
    }

    return parsed;
  };

  const handleCSVSubmit = async () => {
    let textToParse = csvText;
    if (csvFile) {
      try {
        textToParse = await csvFile.text();
      } catch (err) {
        showToast("Failed to read CSV file.", "error");
        return;
      }
    }
    
    if (!textToParse.trim()) {
      showToast("Please paste CSV text or upload a CSV file.", "error");
      return;
    }
    
    const parsed = parseCSV(textToParse);
    if (parsed.length === 0) {
      showToast("No valid contacts found. Ensure you have First Name and Last Name.", "error");
      return;
    }
    
    let addedCount = 0;
    for (const item of parsed) {
      const id = `CUST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const parsedTags = item.tags.split(",").map(t=>t.trim()).filter(Boolean);
      const c: Customer = {
        id,
        firstName: item.firstName,
        lastName: item.lastName,
        phone: item.phone,
        email: item.email,
        birthday: "",
        leadStatus: item.leadStatus,
        tags: parsedTags,
        totalRevenue: item.revenue || 0,
        aiNotes: "",
        transactions: [],
        outstandingBalance: 0,
        company: item.company || "",
        location: item.location || "",
        lastContactedDate: item.lastContactedDate || ""
      };
      
      const existingTagNames = customTags.map(t => t.name.toLowerCase());
      const newTags = parsedTags.filter(t => !existingTagNames.includes(t.toLowerCase()));
      if (newTags.length > 0) {
        const tagColors = ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f97316","#06b6d4","#84cc16","#ef4444"];
        setCustomTags((prev: any) => [...prev, ...newTags.map((name, i) => ({ name, color: tagColors[(prev.length + i) % tagColors.length] }))]);
      }
      
      await addContact(c);
      addedCount++;
    }
    
    logActivity(db, 'crm_entry_created', { email: user?.email || '', displayName: user?.displayName }, `Imported ${addedCount} contacts via CSV`);
    showToast(`Successfully imported ${addedCount} contact(s).`, "success");
    
    setCsvText("");
    setCsvFile(null);
    setShowCSVModal(false);
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
  const getRowTint = (tags: string[]) => {
    for (const t of tags) {
      if (t === "VIP") return isDarkMode ? "bg-amber-950/10" : "bg-amber-50/20";
      if (t === "Enterprise") return isDarkMode ? "bg-purple-950/10" : "bg-purple-50/20";
      if (t === "High-Value") return isDarkMode ? "bg-rose-950/10" : "bg-rose-50/20";
    }
    return "";
  };

  /* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ JARVIS AI COPILOT STATE ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
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

    // READ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â show all
    if (lower.includes("show") && (lower.includes("all") || lower.includes("contacts") || lower.includes("everyone"))) {
      if (customers.length === 0) { addJarvisMsg("Your contact list is currently empty. Want me to add someone?"); return; }
      const summary = customers.map(c => `ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ **${c.firstName} ${c.lastName}** (${c.id}) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${c.leadStatus}${c.tags.length ? ` [${c.tags.join(", ")}]` : ""}`).join("\n");
      addJarvisMsg(`Here are all ${customers.length} contacts:\n\n${summary}`); return;
    }

    // READ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â find specific contact
    if (lower.match(/\b(find|lookup|look up|show|who is|get)\s+/)) {
      const nameQuery = input.replace(/.*?\b(find|lookup|look up|show|who is|get)\s+/i, "").trim();
      const match = customers.find(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(nameQuery.toLowerCase()));
      if (match) {
        addJarvisMsg(`ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ **${match.firstName} ${match.lastName}** (${match.id})\n\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â§ ${match.email || "No email"}\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â¾ ${match.phone || "No phone"}\nÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Å¡ ${match.birthday || "No birthday"}\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  Status: ${match.leadStatus}\nÃƒÂ°Ã…Â¸Ã‚ÂÃ‚Â·ÃƒÂ¯Ã‚Â¸Ã‚Â Tags: ${match.tags.length ? match.tags.join(", ") : "None"}\nÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â° Revenue: $${match.totalRevenue.toFixed(2)}\nÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â  AI Notes: ${match.aiNotes || "None yet"}`); return;
      }
      addJarvisMsg(`I couldn't find anyone matching "${nameQuery}". Try \"show all contacts\" to see who's in the system.`); return;
    }

    // CREATE ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â add contact
    if (lower.match(/\b(add|create)\s+/)) {
      const parts = input.replace(/.*?\b(add|create)\s+(?:contact\s+)?/i, "").trim().split(/\s+/);
      if (parts.length < 2) { addJarvisMsg("Please provide at least a first and last name. Example: \"Add contact Jane Doe jane@test.com\""); return; }
      const firstName = parts[0], lastName = parts[1];
      const emailMatch = parts.find(p => p.includes("@"));
      const phoneMatch = parts.find(p => /^\+?\d[\d\-() ]{6,}$/.test(p));
      const newId = `CUST-${String(customers.length + 1).padStart(3, "0")}`;
      const newCustomer: Customer = { id: newId, firstName, lastName, phone: phoneMatch || "", email: emailMatch || "", birthday: "", leadStatus: "Cold Lead", tags: [], totalRevenue: 0, aiNotes: "", transactions: [], outstandingBalance: 0, company: "", location: "", lastContactedDate: "" };
      addContact(newCustomer);
      addJarvisMsg(`ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Created **${firstName} ${lastName}** (${newId}) as a Cold Lead.${emailMatch ? " Email: " + emailMatch : ""}${phoneMatch ? " Phone: " + phoneMatch : ""}`); return;
    }

    // UPDATE STATUS ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â set X to Y
    if (lower.match(/\b(set|change|move|update status)\b/)) {
      const statusMap: Record<string, Customer["leadStatus"]> = { "cold": "Cold Lead", "cold lead": "Cold Lead", "warm": "Warm Lead", "warm lead": "Warm Lead", "interested": "Interested", "sale": "Sale Completed", "sale completed": "Sale Completed", "completed": "Sale Completed" };
      let foundStatus: Customer["leadStatus"] | null = null;
      for (const [key, val] of Object.entries(statusMap)) { if (lower.includes(key)) { foundStatus = val; break; } }
      if (!foundStatus) { addJarvisMsg("I need a valid status: Cold Lead, Warm Lead, Interested, or Sale Completed."); return; }
      const cleaned = input.replace(/.*?\b(set|change|move|update status)\s+(?:of\s+)?/i, "").replace(new RegExp(`\\b(to\\s+)?(cold lead|warm lead|interested|sale completed|cold|warm|sale|completed)\\b`, "gi"), "").trim();
      const match = customers.find(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(cleaned.toLowerCase()));
      if (match) {
        handleStatusChange(match.id, foundStatus);
        addJarvisMsg(`ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ Updated **${match.firstName} ${match.lastName}** from ${match.leadStatus} ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ **${foundStatus}**.`); return;
      }
      addJarvisMsg(`Couldn't find a contact matching "${cleaned}".`); return;
    }

    // DELETE
    if (lower.match(/\b(delete|remove)\b/)) {
      const nameQuery = input.replace(/.*?\b(delete|remove)\s+(?:contact\s+)?/i, "").trim();
      const match = customers.find(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(nameQuery.toLowerCase()));
      if (match) {
        deleteContact(match.id);
        addJarvisMsg(`ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã¢â‚¬ËœÃƒÂ¯Ã‚Â¸Ã‚Â Deleted **${match.firstName} ${match.lastName}** (${match.id}) from the CRM.`); return;
      }
      addJarvisMsg(`Couldn't find a contact matching "${nameQuery}" to delete.`); return;
    }

    // ANALYZE ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â add AI notes
    if (lower.match(/\b(analyze|note|insight)\b/)) {
      const body = input.replace(/.*?\b(analyze|note|insight)\s+/i, "").trim();
      const colonIdx = body.indexOf(":");
      if (colonIdx === -1) { addJarvisMsg("Use the format: \"Analyze [Name]: [Your note]\" ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â e.g., \"Analyze Jane Doe: Very interested in automation\""); return; }
      const nameQuery = body.slice(0, colonIdx).trim();
      const noteText = body.slice(colonIdx + 1).trim();
      const match = customers.find(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(nameQuery.toLowerCase()));
      if (match) {
        const stamp = `Jarvis Deduction (${new Date().toLocaleDateString()}): ${noteText}`;
        const newNotes = match.aiNotes ? match.aiNotes + "\n" + stamp : stamp;
        store.updateCustomer(match.id, { aiNotes: newNotes });
        addJarvisMsg(`ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â  Added AI note to **${match.firstName} ${match.lastName}**:\n\n_${stamp}_`); return;
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
      addJarvisMsg(`ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¦ Done! I've scheduled a **${capitalTitle}** with **${customer.firstName} ${customer.lastName}** for **${meetDate}** at **${meetTime}**.\n\nÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Synced to Google Calendar\nÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Â Notification created`); return;
    }

    // FINANCIAL QUERIES
    if (lower.includes("top") && lower.includes("revenue")) {
      if (customers.length === 0) { addJarvisMsg("No contacts in the system yet."); return; }
      const numMatch = lower.match(/(\d+)/);
      const count = numMatch ? parseInt(numMatch[1]) : 5;
      const sorted = [...customers].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, count);
      const list = sorted.map((c, i) => `${i + 1}. **${c.firstName} ${c.lastName}** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â $${c.totalRevenue.toFixed(2)}`).join("\n");
      addJarvisMsg(`ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â° Top ${count} customers by revenue:\n\n${list}`); return;
    }

    if ((lower.includes("how much") || lower.includes("revenue") || lower.includes("money") || lower.includes("total")) && (lower.includes("cold") || lower.includes("warm") || lower.includes("interested") || lower.includes("completed") || lower.includes("sale"))) {
      const statusMap: Record<string, Customer["leadStatus"]> = { "cold": "Cold Lead", "warm": "Warm Lead", "interested": "Interested", "sale": "Sale Completed", "completed": "Sale Completed" };
      let qStatus: Customer["leadStatus"] | null = null;
      for (const [key, val] of Object.entries(statusMap)) { if (lower.includes(key)) { qStatus = val; break; } }
      if (qStatus) {
        const filtered = customers.filter(c => c.leadStatus === qStatus);
        const total = filtered.reduce((sum, c) => sum + c.totalRevenue, 0);
        addJarvisMsg(`ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â° **${qStatus}** column:\n\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Contacts: ${filtered.length}\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Total Revenue: **$${total.toFixed(2)}**\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Avg Revenue: $${filtered.length ? (total / filtered.length).toFixed(2) : "0.00"}`); return;
      }
    }

    if (lower.includes("total revenue") || lower.includes("overall revenue") || (lower.includes("how much") && lower.includes("total"))) {
      const total = customers.reduce((sum, c) => sum + c.totalRevenue, 0);
      const outstanding = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);
      addJarvisMsg(`ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â° **Financial Summary**\n\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Total Revenue: **$${total.toFixed(2)}**\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Outstanding Balances: **$${outstanding.toFixed(2)}**\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Contacts: ${customers.length}\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Avg Revenue/Contact: $${customers.length ? (total / customers.length).toFixed(2) : "0.00"}`); return;
    }

    // FALLBACK
    addJarvisMsg("I'm not sure what you mean. Here's what I can do:\n\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ **show all contacts** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â list everyone\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ **find [name]** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â look up a contact\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ **add [first] [last] [email]** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â create a contact\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ **set [name] to [status]** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â update status\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ **delete [name]** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â remove a contact\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ **analyze [name]: [note]** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â add AI insight\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ **schedule meeting with [name] for [date] at [time]**\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ **top 5 customers by revenue** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â leaderboard\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ **how much revenue in Warm Leads?** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â status breakdown\nÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ **total revenue** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â financial summary");
  }, [customers, addJarvisMsg, handleStatusChange, setCustomers, scheduleMeeting]);

  const handleJarvisSend = () => {
    if (!jarvisInput.trim()) return;
    processJarvisCommand(jarvisInput.trim());
    setJarvisInput("");
  };

  /* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ AUTH GATE ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */
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
        <div className={`rounded-2xl border shadow-xl p-10 max-w-md w-full mx-4 text-center space-y-6 ${isDarkMode ? 'bg-slate-900 border-slate-850 text-white' : 'bg-[#fefcf6] border-[#E5E7EB]'}`}>
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
    <div className={`flex h-[calc(100vh-0px)] md:h-screen ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-[#F9FAFB] text-slate-800'} overflow-hidden -m-0`}>
      {/* Load cursive font for email signatures */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap" rel="stylesheet" />
      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Mobile Sidebar Overlay ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden" onClick={() => setIsMobileSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
        </div>
      )}

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ CRM Sidebar ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <aside className={`fixed lg:relative inset-y-0 left-0 z-[81] flex flex-col w-[220px] ${isDarkMode ? 'bg-slate-900 border-slate-850' : 'bg-[#fefcf6] border-[#E5E7EB]'} border-r shrink-0 transition-transform duration-200 ease-in-out ${
        isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}>
        {/* Sidebar Header */}
        <div className={`h-16 flex items-center justify-between px-5 border-b ${isDarkMode ? 'border-slate-850' : 'border-[#E5E7EB]'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <span className={`text-[15px] font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Contacts</span>
          </div>
          <button onClick={() => setIsMobileSidebarOpen(false)} className={`lg:hidden w-7 h-7 rounded-md ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} flex items-center justify-center text-slate-400 cursor-pointer`}>
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
                    ? (isDarkMode ? "bg-indigo-950/40 text-indigo-400 font-semibold" : "bg-indigo-50 text-indigo-700 font-semibold")
                    : (isDarkMode ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-700 hover:bg-[#faf6ed]")
                }`}
              >
                <item.icon className={`w-[18px] h-[18px] ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Main Content Area ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-[margin] duration-300 ease-in-out ${isJarvisOpen ? 'mr-[340px]' : ''}`}>
        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Top Navigation Bar ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        <header className={`h-14 border-b flex items-center justify-between px-5 shrink-0 shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] ${isDarkMode ? 'bg-slate-900 border-slate-850 text-white' : 'bg-[#fefcf6] border-[#E5E7EB]'}`}>
          {/* Mobile nav toggle + breadcrumb */}
          <div className="flex items-center gap-3">
            {/* Hamburger menu (mobile) */}
            <button onClick={() => setIsMobileSidebarOpen(true)} className={`lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 cursor-pointer ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-[#faf6ed]'}`}>
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

        {/* Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€ Scrollable Content Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€ */}
        <main className="flex-1 overflow-y-auto p-4 md:p-5">
          {/* Skeleton Loading */}
          {isLoading ? (
            activeView === "campaigns" ? <DashboardSkeleton /> :
            activeView === "analytics" ? <AnalyticsSkeleton /> :
            <DashboardSkeleton />
          ) : (
          <>
          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Ã¢â€â‚¬Ã¢â€â‚¬ Ã¢â€â‚¬Ã¢â€â‚¬ Ã¢â€â‚¬Ã¢â€â‚¬ Ã¢â€â‚¬Ã¢â€â‚¬ Ã¢â€â‚¬Ã¢â€â‚¬ Ã¢â€â‚¬Ã¢â€â‚¬ DATABASE VIEW Ã¢â€â‚¬Ã¢â€â‚¬ Ã¢â€â‚¬Ã¢â€â‚¬ Ã¢â€â‚¬Ã¢â€â‚¬ Ã¢â€â‚¬Ã¢â€â‚¬ Ã¢â€â‚¬Ã¢â€â‚¬ Ã¢â€â‚¬Ã¢â€â‚¬ Ã¢â€â‚¬Ã¢â€â‚¬ */}
          {activeView === "dashboard" && (
            <div className="w-full space-y-4">
              {/* Page Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className={`text-xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Database</h1>
                  <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {customers.length} record{customers.length !== 1 ? 's' : ''} &middot; Manage your client and prospect data
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search records..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className={`w-56 h-9 pl-9 pr-4 text-sm rounded-lg border placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-[#E5E7EB] text-slate-700'}`}
                    />
                  </div>
                  <button className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750' : 'border-[#E5E7EB] bg-white text-slate-600 hover:bg-slate-50'}`}>
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setIsDashAddDropdownOpen(!isDashAddDropdownOpen)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm shadow-indigo-600/10"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Record</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                    </button>
                    {isDashAddDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsDashAddDropdownOpen(false)} />
                        <div className={`absolute right-0 mt-1 w-56 rounded-lg border shadow-lg z-20 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/40' : 'bg-white border-slate-200 text-slate-700'}`}>
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
                </div>
              </div>

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ Spreadsheet Grid Ã¢â€â‚¬Ã¢â€â‚¬ */}
              {customers.length === 0 ? (
                <EmptyContacts onAdd={() => setShowAddModal(true)} />
              ) : (
                <div className={`rounded-xl border shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#E5E7EB]'}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px] border-collapse min-w-[1200px]">
                      <thead>
                        <tr className={isDarkMode ? 'bg-slate-800/70' : 'bg-[#F8F9FB]'}>
                          <th className={`sticky left-0 z-10 w-10 px-3 py-3 border-b ${isDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-[#F8F9FB] border-[#E5E7EB]'}`}>
                            <input type="checkbox" checked={filteredSortedCustomers.length > 0 && filteredSortedCustomers.every(c => selectedIds.has(c.id))} onChange={toggleSelectAll} className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                          </th>
                          {[
                            { key: "id" as const, label: "id", w: "w-[110px]" },
                            { key: "name" as const, label: "firstName", w: "w-[110px]" },
                            { key: "name" as const, label: "lastName", w: "w-[110px]" },
                            { key: "company" as const, label: "company", w: "w-[130px]" },
                            { key: "email" as const, label: "email", w: "w-[180px]" },
                            { key: "phone" as const, label: "phoneNumber", w: "w-[130px]" },
                            { key: "status" as const, label: "pipelineStage", w: "w-[140px]" },
                            { key: "revenue" as const, label: "revenue", w: "w-[110px]" },
                            { key: "tags" as const, label: "tags", w: "w-[140px]" },
                            { key: "location" as const, label: "location", w: "w-[130px]" },
                            { key: "lastContacted" as const, label: "lastContactedDate", w: "w-[130px]" },
                          ].map((col) => (
                            <th
                              key={col.label}
                              onClick={() => {
                                if (col.key === "name" || col.key === "email" || col.key === "phone" || col.key === "tags" || col.key === "status") {
                                  toggleSort(col.key as SortKey);
                                }
                              }}
                              className={`${col.w} text-left text-[11px] font-semibold px-3 py-3 border-b select-none ${
                                (col.key === "name" || col.key === "email" || col.key === "phone" || col.key === "tags" || col.key === "status") ? 'cursor-pointer hover:text-indigo-600' : ''
                              } ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-[#E5E7EB]'}`}
                            >
                              <span className="inline-flex items-center gap-0.5">
                                {col.label}
                                {(col.key === "name" || col.key === "email" || col.key === "phone" || col.key === "tags" || col.key === "status") && sortKey === col.key && (
                                  sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                )}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSortedCustomers.map((c, idx) => (
                          <tr
                            key={c.id}
                            onClick={() => setViewingCustomer(c.id)}
                            className={`group border-b transition-colors cursor-pointer ${
                              isDarkMode
                                ? `border-slate-800 ${idx % 2 === 1 ? 'bg-slate-800/20' : ''} hover:bg-slate-800/50`
                                : `border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''} hover:bg-indigo-50/30`
                            } ${selectedIds.has(c.id) ? (isDarkMode ? 'bg-indigo-950/20' : 'bg-indigo-50/40') : ''} ${getRowTint(c.tags)}`}
                          >
                            <td className={`sticky left-0 z-10 px-3 py-3 ${isDarkMode ? (idx % 2 === 1 ? 'bg-slate-800/20' : 'bg-slate-900') : (idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white')} group-hover:${isDarkMode ? 'bg-slate-800/50' : 'bg-indigo-50/30'}`} onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                            </td>
                            {/* ID */}
                            <td className={`px-3 py-3 font-mono text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              {c.id.length > 16 ? c.id.slice(0, 16) + 'Ã¢â‚¬Â¦' : c.id}
                            </td>
                            {/* First Name */}
                            <td className={`px-3 py-3 font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                              {c.firstName}
                            </td>
                            {/* Last Name */}
                            <td className={`px-3 py-3 font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                              {c.lastName}
                            </td>
                            {/* Company */}
                            <td className={`px-3 py-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {c.company ? (
                                <span className="inline-flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                  {c.company}
                                </span>
                              ) : <span className="text-slate-400">&mdash;</span>}
                            </td>
                            {/* Email */}
                            <td className={`px-3 py-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {c.email || <span className="text-slate-400">&mdash;</span>}
                            </td>
                            {/* Phone */}
                            <td className={`px-3 py-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              {c.phone || <span className="text-slate-400">&mdash;</span>}
                            </td>
                            {/* Pipeline Stage */}
                            <td className="px-3 py-3">
                              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${getStatusStyles(c.leadStatus, isDarkMode)}`}>
                                {c.leadStatus}
                              </span>
                            </td>
                            {/* Revenue */}
                            <td className={`px-3 py-3 text-right font-semibold tabular-nums ${c.totalRevenue > 0 ? 'text-emerald-600' : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}`}>
                              ${c.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            {/* Tags */}
                            <td className="px-3 py-3">
                              {c.tags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {c.tags.slice(0, 2).map(tag => (
                                    <span key={tag} className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${getTagStyles(tag, isDarkMode)}`}>{tag}</span>
                                  ))}
                                  {c.tags.length > 2 && <span className="text-[9px] font-medium text-slate-400">+{c.tags.length - 2}</span>}
                                </div>
                              ) : <span className="text-slate-400">&mdash;</span>}
                            </td>
                            {/* Location */}
                            <td className={`px-3 py-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              {c.location ? (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  {c.location}
                                </span>
                              ) : <span className="text-slate-400">&mdash;</span>}
                            </td>
                            {/* Last Contacted */}
                            <td className={`px-3 py-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              {c.lastContactedDate ? new Date(c.lastContactedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : <span className="text-slate-400">&mdash;</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Footer Ã¢â‚¬â€ record count */}
                  <div className={`flex items-center justify-between px-4 py-2.5 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800/40' : 'border-[#E5E7EB] bg-[#FAFBFC]'}`}>
                    <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Showing {filteredSortedCustomers.length} of {customers.length} record{customers.length !== 1 ? 's' : ''}
                    </span>
                    <span className={`text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {selectedIds.size > 0 ? `${selectedIds.size} selected` : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}




          {/* Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€ CUSTOMER PROFILE VIEW Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€ */}
          {viewingCustomer && (() => {
            const c = customers.find(x => x.id === viewingCustomer);
            if (!c) return null;
            const customerMeetings = meetings.filter(m => m.customerId === c.id);
            return (
              <div className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-sm flex items-center justify-center" onClick={() => setViewingCustomer(null)}>
                <div className={`rounded-2xl border shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/60' : 'bg-[#fefcf6] border-[#E5E7EB]'}`} onClick={e => e.stopPropagation()}>
                  {/* Profile Header */}
                  <div className={`px-6 py-5 border-b flex items-center justify-between ${isDarkMode ? "border-slate-800" : "border-[#E5E7EB]"}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border ${
                        isDarkMode ? "bg-indigo-950/40 text-indigo-400 border-indigo-900" : "bg-indigo-50 text-indigo-600 border-indigo-100"
                      }`}>{c.firstName[0]}{c.lastName[0]}</div>
                      <div>
                        <h2 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-slate-800"}`}>{c.firstName} {c.lastName}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusStyles(c.leadStatus, isDarkMode)}`}>{c.leadStatus}</span>
                          <span className="text-[10px] text-slate-400">{c.id}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setViewingCustomer(null)} className={`w-8 h-8 rounded-lg ${isDarkMode ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-400"} flex items-center justify-center cursor-pointer`}><X className="w-4 h-4" /></button>
                  </div>

                  {/* Profile Body */}
                  <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* Contact Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`p-3 rounded-lg border ${isDarkMode ? "bg-slate-800/60 border-slate-750" : "bg-[#F9FAFB] border-[#E5E7EB]"}`}>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Email</span>
                        <span className={`text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{c.email || "Ã¢â‚¬â€"}</span>
                      </div>
                      <div className={`p-3 rounded-lg border ${isDarkMode ? "bg-slate-800/60 border-slate-750" : "bg-[#F9FAFB] border-[#E5E7EB]"}`}>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Phone</span>
                        <span className={`text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{c.phone || "Ã¢â‚¬â€"}</span>
                      </div>
                      <div className={`p-3 rounded-lg border ${isDarkMode ? "bg-slate-800/60 border-slate-750" : "bg-[#F9FAFB] border-[#E5E7EB]"}`}>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Birthday</span>
                        <span className={`text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{c.birthday || "Ã¢â‚¬â€"}</span>
                      </div>
                      <div className={`p-3 rounded-lg border ${isDarkMode ? "bg-slate-800/60 border-slate-750" : "bg-[#F9FAFB] border-[#E5E7EB]"}`}>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Revenue</span>
                        <span className={`text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>${c.totalRevenue.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Tags */}
                    {c.tags.length > 0 && (
                      <div><span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Tags</span><div className="flex flex-wrap gap-1.5">{c.tags.map(t => <span key={t} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${getTagStyles(t, isDarkMode)}`}>{t}</span>)}</div></div>
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
                        <div className={`p-3 rounded-lg border text-xs whitespace-pre-wrap leading-relaxed ${
                          isDarkMode ? "bg-purple-950/20 border-purple-900 text-slate-200" : "bg-purple-50/50 border-purple-100 text-slate-700"
                        }`}><Brain className="w-3.5 h-3.5 text-purple-500 inline mr-1.5" />{c.aiNotes}</div>
                      ) : (
                        <div className={`text-center py-6 border border-dashed rounded-lg ${
                          isDarkMode ? "border-purple-900 bg-purple-950/10" : "border-purple-200 bg-purple-50/20"
                        }`}>
                          <Brain className="w-6 h-6 text-purple-200 mx-auto mb-1.5" />
                          <p className="text-xs text-slate-400">No AI notes yet. Click &quot;Ask Jarvis to Deduce&quot; to generate insights.</p>
                        </div>
                      )}
                    </div>

                    {/* Ã¢â€â‚¬Ã¢â€â‚¬ Financials Card Ã¢â€â‚¬Ã¢â€â‚¬ */}
                    <div className={`border-t pt-5 ${isDarkMode ? "border-slate-800" : "border-[#E5E7EB]"}`}>
                      <div className="flex items-center gap-2 mb-4">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <h3 className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-slate-800"}`}>Financials</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className={`p-3.5 rounded-lg border ${
                          isDarkMode ? "bg-emerald-950/20 border-emerald-900/50" : "bg-emerald-50/50 border-emerald-100"
                        }`}>
                          <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider block mb-1">Total Revenue</span>
                          <span className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-slate-800"}`}>${c.totalRevenue.toFixed(2)}</span>
                        </div>
                        <div className={`p-3.5 rounded-lg border ${
                          isDarkMode ? "bg-orange-950/20 border-orange-900/50" : "bg-orange-50/50 border-orange-100"
                        }`}>
                          <span className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider block mb-1">Outstanding</span>
                          <span className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-slate-800"}`}>${c.outstandingBalance.toFixed(2)}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Transaction History</span>
                        {c.transactions.length === 0 ? (
                          <div className={`text-center py-6 border border-dashed rounded-lg ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}>
                            <DollarSign className="w-6 h-6 text-slate-200 mx-auto mb-1.5" />
                            <p className="text-xs text-slate-400">No transactions recorded yet</p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {c.transactions.map(tx => (
                              <div key={tx.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${
                                isDarkMode ? "bg-slate-800/60 border-slate-750" : "bg-[#F9FAFB] border-[#E5E7EB]"
                              }`}>
                                <div>
                                  <p className={`text-xs font-medium ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{tx.description}</p>
                                  <p className="text-[10px] text-slate-400">{tx.date}</p>
                                </div>
                                <span className={`text-xs font-bold ${tx.amount >= 0 ? "text-emerald-600" : "text-red-500"}`}>{tx.amount >= 0 ? "+" : ""}${tx.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ã¢â€â‚¬Ã¢â€â‚¬ Schedule Meeting Section Ã¢â€â‚¬Ã¢â€â‚¬ */}
                    <div className={`border-t pt-5 ${isDarkMode ? "border-slate-800" : "border-[#E5E7EB]"}`}>
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        <h3 className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-slate-800"}`}>Schedule Meeting</h3>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Meeting Title</label>
                          <input value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} className={`w-full h-10 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${
                            isDarkMode ? "border-slate-750 bg-slate-800 text-white" : "border-[#E5E7EB] bg-[#F9FAFB] text-slate-700"
                          }`} placeholder="e.g. Consultation Call" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Date</label>
                            <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className={`w-full h-10 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${
                              isDarkMode ? "border-slate-750 bg-slate-800 text-white" : "border-[#E5E7EB] bg-[#F9FAFB] text-slate-700"
                            }`} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Time</label>
                            <input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} className={`w-full h-10 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 ${
                              isDarkMode ? "border-slate-750 bg-slate-800 text-white" : "border-[#E5E7EB] bg-[#F9FAFB] text-slate-700"
                            }`} />
                          </div>
                        </div>
                        <div className={`flex items-center justify-between p-3 rounded-lg border ${
                          isDarkMode ? "bg-slate-800/60 border-slate-750" : "bg-[#F9FAFB] border-[#E5E7EB]"
                        }`}>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>Sync to Google Calendar</span>
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
                            <div key={m.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                              isDarkMode ? "bg-emerald-950/20 border-emerald-900/50" : "bg-emerald-50/50 border-emerald-100"
                            }`}>
                              <div className="flex items-center gap-2.5">
                                <CalendarCheck className="w-4 h-4 text-emerald-600" />
                                <div>
                                  <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>{m.title}</p>
                                  <p className="text-[10px] text-slate-400">{m.date} at {m.time} {m.syncToGoogle && "Ãƒâ€šÃ‚Â· Google Calendar"}</p>
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


          {/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â ANALYTICS VIEW ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */}
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
                  <MetricCard isDarkMode={isDarkMode} label="Total Revenue" value={`$${totalRevenue.toFixed(0)}`} subtext={`${customers.length} contacts`} icon={DollarSign} />
                  <MetricCard isDarkMode={isDarkMode} label="Outstanding" value={`$${totalOutstanding.toFixed(0)}`} subtext="pending balances" icon={Activity} />
                  <MetricCard isDarkMode={isDarkMode} label="Avg. Revenue" value={`$${customers.length ? (totalRevenue / customers.length).toFixed(0) : "0"}`} subtext="per contact" icon={ArrowUpRight} />
                  <MetricCard isDarkMode={isDarkMode} label="Completed Sales" value={String(customers.filter(c => c.leadStatus === "Sale Completed").length)} subtext="converted leads" icon={Users} />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar Chart ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Revenue by Lead Status */}
                  <div className={`rounded-xl border p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-[#fefcf6] border-[#E5E7EB]'}`}>
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

                  {/* Line Chart ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Revenue Over Time */}
                  <div className={`rounded-xl border p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-[#fefcf6] border-[#E5E7EB]'}`}>
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
                <div className={`rounded-xl border shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-[#fefcf6] border-[#E5E7EB]'}`}>
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
                              isDarkMode ? "border-slate-800 hover:bg-slate-850" : "border-slate-50 hover:bg-[#faf6ed]/50"
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
                              <td className="py-3 px-4"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusStyles(c.leadStatus, isDarkMode)}`}>{c.leadStatus}</span></td>
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


          {/* Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€ CAMPAIGNS VIEW Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€Ã¢â‚¬â€ */}
          {activeView === "campaigns" && (
            <CampaignCalendar />
          )}
          </>
          )}
        </main>
      </div>

      <ToastContainer />

      {/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â FLOATING BULK ACTIONS BAR ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */}
      {selectedIds.size > 0 && (
        <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[85] rounded-xl border shadow-xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white shadow-black/40' : 'bg-[#fefcf6] border-[#E5E7EB]'}`}>
          <span className={`text-sm font-semibold ${isDarkMode ? 'text-slate-250' : 'text-slate-700'}`}>{selectedIds.size} selected</span>
          <div className={`w-px h-6 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
          <button onClick={() => setShowEmailModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer">
            <MailPlus className="w-4 h-4" />New Email Campaign
          </button>
          <button onClick={() => { 
            const ids = Array.from(selectedIds); 
            if (window.confirm(`Are you sure you want to permanently delete ${ids.length} contact${ids.length === 1 ? '' : 's'}?`)) {
              bulkDelete(ids); 
              setSelectedIds(new Set()); 
            }
          }} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${isDarkMode ? 'border-red-900 bg-red-950/20 text-red-400 hover:bg-red-900/30' : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'}`}>
            <Trash2 className="w-3.5 h-3.5" />Delete
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">Clear</button>
        </div>
      )}

      {/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â EMAIL CAMPAIGN MODAL ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); setEmailTab("compose"); setShowSignatureEditor(false); setShowDrafts(false); }}>
          <div className={`rounded-2xl border shadow-2xl w-full max-w-4xl mx-4 overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/60' : 'bg-[#fefcf6] border-[#E5E7EB]'}`} style={{ maxHeight: "92vh" }} onClick={e => e.stopPropagation()}>
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
                    <span className="text-slate-300">Ãƒâ€šÃ‚Â·</span>
                    <span>{selectedCustomers.length} selected</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Tab Switcher */}
                <div className={`flex rounded-lg p-0.5 ${isDarkMode ? 'bg-slate-850' : 'bg-slate-100'}`}>
                  <button onClick={() => setEmailTab("compose")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${emailTab === "compose" ? (isDarkMode ? "bg-slate-800 text-white shadow-sm" : "bg-[#fefcf6] text-slate-800 shadow-sm") : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-700")}`}>Compose</button>
                  <button onClick={() => setEmailTab("preview")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${emailTab === "preview" ? (isDarkMode ? "bg-slate-800 text-white shadow-sm" : "bg-[#fefcf6] text-slate-800 shadow-sm") : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-700")}`}>Preview</button>
                </div>
                <button onClick={() => { setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); setEmailTab("compose"); }} className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 cursor-pointer ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Recipients Bar */}
            {/* Recipients Bar */}
            <div className={`px-6 py-3 border-b shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-950/20' : 'border-[#E5E7EB] bg-[#faf6ed]/50'}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To:</span>
                {selectedCustomers.slice(0, 8).map(c => (
                  <span key={c.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium shadow-sm ${
                    isDarkMode ? "bg-slate-850 border-slate-700 text-slate-300" : "bg-[#fefcf6] border-slate-200 text-slate-600"
                  }`}>
                    <span className="w-3.5 h-3.5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[7px] font-bold">{c.firstName[0]}</span>
                    {c.firstName} {c.lastName}
                  </span>
                ))}
                {selectedCustomers.length > 8 && <span className="text-[11px] text-slate-400 font-medium">+{selectedCustomers.length - 8} more</span>}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden flex">
              {/* Compose Panel Ã¢â‚¬â€ hidden when Preview tab is active on mobile */}
              <div className={`flex-1 flex flex-col overflow-y-auto ${emailTab === "preview" ? "hidden" : ""}`}>
                <div className="px-6 py-5 space-y-4 flex-1">
                  {/* Subject */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Subject Line</label>
                    <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className={`w-full h-11 px-4 text-sm font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white' : 'border-[#E5E7EB] bg-[#fefcf6] text-slate-800'}`} placeholder="e.g. Exciting update for our valued partners" />
                  </div>

                  {/* Email Body Ã¢â‚¬â€ LARGER */}
                  <div className="flex-1 flex flex-col">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Email Body</label>
                    <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} className={`w-full flex-1 min-h-[320px] px-4 py-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all resize-none leading-relaxed ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white' : 'border-[#E5E7EB] bg-[#fefcf6] text-slate-700'}`} placeholder={"Write your email content here...\n\nUse line breaks to create paragraphs. Your signature will be appended automatically."} />
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
                        {(emailSignature.phone || emailSignature.website) && <p className="text-[11px] text-slate-400 mt-0.5">{[emailSignature.phone, emailSignature.website].filter(Boolean).join(" Ã‚Â· ")}</p>}
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
                                  isDarkMode ? "border-slate-750 bg-slate-900" : "border-slate-200 bg-[#fefcf6]"
                                }`} />
                                <button onClick={() => setSigForm(f => ({...f, logoUrl: ""}))} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                              </div>
                            ) : null}
                            <label className={`px-3 py-1.5 rounded-lg border border-dashed text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                              isDarkMode ? "border-slate-700 text-slate-400 hover:bg-slate-800" : "border-slate-300 text-slate-500 hover:bg-[#faf6ed]"
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
                          <div className={`px-3 py-2 rounded-lg border ${isDarkMode ? "bg-slate-900 border-slate-850" : "bg-[#fefcf6] border-slate-200"}`}>
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
                            isDarkMode ? "border-slate-750 text-slate-400 hover:bg-slate-800" : "border-[#E5E7EB] text-slate-500 hover:bg-[#faf6ed]"
                          }`}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview Panel Ã¢â‚¬â€ full-width when Preview tab is active */}
              <div className={`flex flex-col overflow-y-auto ${emailTab === "preview" ? "flex-1" : "hidden lg:flex lg:w-[380px] lg:shrink-0"} border-l ${isDarkMode ? 'border-slate-800 bg-slate-900/60 text-white' : 'border-[#E5E7EB] bg-[#faf6ed]'}`}>
                <div className={`px-5 py-3 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-[#fefcf6]'}`}>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />Email Preview</h4>
                </div>
                <div className="flex-1 p-5 flex justify-center">
                  <div className={`rounded-xl border shadow-sm overflow-hidden w-full ${emailTab === "preview" ? "max-w-2xl" : ""} ${isDarkMode ? 'bg-slate-950 border-slate-850' : 'bg-[#fefcf6] border-slate-200'}`}>
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
                          {(emailSignature.phone || emailSignature.website) && <p className="text-[11px] text-slate-400 mt-0.5">{[emailSignature.phone, emailSignature.website].filter(Boolean).join(" Ã‚Â· ")}</p>}
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
                    <div className={`absolute bottom-full left-0 mb-2 w-72 rounded-xl border shadow-xl z-10 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-850' : 'bg-[#fefcf6] border-slate-200'}`}>
                      <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-250' : 'text-slate-700'}`}>Saved Drafts</span>
                        <button onClick={() => setShowDrafts(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {campaignDrafts.length === 0 ? (
                          <p className="px-4 py-4 text-xs text-slate-400 text-center">No drafts saved yet</p>
                        ) : campaignDrafts.map(draft => (
                          <div key={draft.id} className={`px-4 py-2.5 border-b flex items-center justify-between group cursor-pointer ${isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-50 hover:bg-[#faf6ed]'}`} onClick={() => loadDraft(draft)}>
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
                  isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-350 hover:bg-slate-750' : 'border-[#E5E7EB] bg-[#fefcf6] text-slate-600 hover:bg-[#faf6ed]'
                }`}><Download className="w-3 h-3" />Save Draft</button>
                <button onClick={() => { setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); setEmailTab("compose"); }} className={`px-4 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-350 hover:bg-slate-750' : 'border-[#E5E7EB] bg-[#fefcf6] text-slate-600 hover:bg-[#faf6ed]'
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


      {/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â JARVIS COPILOT SIDEBAR ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */}
      {/* ────── JARVIS COPILOT SIDEBAR ────── */}
      <div className={`fixed top-0 right-0 h-full z-[80] transition-all duration-300 ease-in-out ${isJarvisOpen ? "w-[340px]" : "w-0"} overflow-hidden`}>
        <div className={`w-[340px] h-full border-l flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-[#fefcf6] border-[#E5E7EB]'}`}>
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
          <div className={`border-t px-4 py-3 shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-950/20' : 'border-[#E5E7EB] bg-[#fefcf6]'}`}>
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
          <div className={`rounded-2xl border shadow-2xl w-full max-w-lg mx-4 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/60' : 'bg-[#fefcf6] border-[#E5E7EB]'}`} onClick={e=>e.stopPropagation()}>
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
                  <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1.5 uppercase tracking-wider`}>{lang === 'es' ? 'CumpleaÃƒÂ±os' : 'Birthday'}</label>
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
              <button onClick={()=>{setShowAddModal(false);resetForm();}} className="px-4 py-2 rounded-lg border border-[#E5E7EB] bg-[#fefcf6] text-sm font-medium text-slate-600 hover:bg-[#faf6ed] cursor-pointer">Cancel</button>
              <button onClick={handleAddContact} disabled={!form.firstName.trim()||!form.lastName.trim()} className="px-5 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer">Add Contact</button>
            </div>
          </div>
        </div>
      )}

      {showCSVModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setShowCSVModal(false); setCsvText(""); setCsvFile(null); }}>
          <div className={`rounded-2xl border shadow-2xl w-full max-w-lg mx-4 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white shadow-black/60' : 'bg-[#fefcf6] border-[#E5E7EB]'}`} onClick={e => e.stopPropagation()}>
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
                <label className={`block text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider`}>
                  {lang === 'es' ? 'Pegar Datos CSV' : 'Paste CSV Data'}
                </label>
                <textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  rows={5}
                  disabled={!!csvFile}
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
                    {csvFile ? csvFile.name : (lang === 'es' ? 'NingÃƒÂºn archivo seleccionado' : 'No file selected')}
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
                    : 'border-[#E5E7EB] bg-[#fefcf6] text-slate-600 hover:bg-[#faf6ed]'
                }`}
              >
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                onClick={handleCSVSubmit}
                disabled={(!csvText.trim() && !csvFile)}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
              >
                {lang === 'es' ? 'Importar' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â TOAST NOTIFICATIONS ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */}
      <ToastContainer />
    </div>
  );
}
