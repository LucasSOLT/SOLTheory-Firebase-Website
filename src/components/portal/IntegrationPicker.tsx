"use client";

import { getAuthHeaders } from "@/lib/api-auth-client";

import React, { useState, useEffect } from "react";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  X, Search, MessageSquare, Mail, Calendar, Inbox, Headphones, Users,
  ClipboardList, HeartPulse, UserCheck, BadgeDollarSign, Wallet,
  Package, ShoppingCart, Wrench, Truck, Landmark, Gift, Smartphone,
  BarChart3, Bot, ChevronRight, Plus, Bell, ExternalLink, Settings2,
  Video, HardDrive, FileText, Table, Youtube, Phone, MonitorSmartphone,
  Megaphone, Globe, Shield, Zap, Database, Receipt, PieChart, Workflow,
  Loader2, ChevronUp, ChevronDown
} from "lucide-react";

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Integration Data
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export type Integration = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  statusLabel: string;
  statusColor: string;
  badgeBg: string;
  isGoogle?: boolean;
  googleService?: string; // maps to API service param
};

const INTEGRATIONS: Integration[] = [
  // â”€â”€ Google Integrations â”€â”€
  { id: "gmail", name: "Gmail Inbox", description: "Unread email count, priority flags & starred threads", category: "Google Integrations", icon: Mail, statusLabel: "Live", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50", isGoogle: true, googleService: "gmail" },
  { id: "gcal", name: "Google Calendar", description: "Upcoming events, RSVP status & scheduling conflicts", category: "Google Integrations", icon: Calendar, statusLabel: "Live", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50", isGoogle: true, googleService: "gcal" },
  { id: "gmeet", name: "Google Meet", description: "Scheduled video meetings, join links & participant counts", category: "Google Integrations", icon: Video, statusLabel: "Live", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50", isGoogle: true, googleService: "gmeet" },
  { id: "gdrive", name: "Google Drive", description: "Storage usage, recent files & shared document activity", category: "Google Integrations", icon: HardDrive, statusLabel: "Live", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50", isGoogle: true, googleService: "gdrive" },
  { id: "youtube", name: "YouTube Analytics", description: "Subscriber count, channel views & video performance", category: "Google Integrations", icon: Youtube, statusLabel: "Live", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50", isGoogle: true, googleService: "youtube" },
  { id: "gsheets", name: "Google Sheets", description: "Linked spreadsheet updates & data sync status", category: "Google Integrations", icon: Table, statusLabel: "Live", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50", isGoogle: true },
  { id: "gdocs", name: "Google Docs", description: "Recent document edits, comments & sharing activity", category: "Google Integrations", icon: FileText, statusLabel: "Live", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50", isGoogle: true },

  // â”€â”€ Communications â”€â”€
  { id: "slack", name: "Slack Messages", description: "Unread DMs, channel mentions & thread replies across workspaces", category: "Communications", icon: MessageSquare, statusLabel: "Webhook", statusColor: "text-violet-600", badgeBg: "bg-violet-50" },
  { id: "outlook", name: "Microsoft Outlook", description: "Inbox summary, flagged items & meeting invitations", category: "Communications", icon: Inbox, statusLabel: "Polling", statusColor: "text-blue-600", badgeBg: "bg-blue-50" },
  { id: "sms", name: "SMS Platform", description: "Broadcast delivery status, inbound messages & opt-out alerts", category: "Communications", icon: Smartphone, statusLabel: "Webhook", statusColor: "text-violet-600", badgeBg: "bg-violet-50" },
  { id: "iphone", name: "iPhone Notifications", description: "Push notification hub, iMessage alerts & call log summary", category: "Communications", icon: Phone, statusLabel: "Push", statusColor: "text-sky-600", badgeBg: "bg-sky-50" },
  { id: "imessage", name: "iMessage / Apple Messages", description: "Unread iMessages, group chats & media attachments", category: "Communications", icon: MonitorSmartphone, statusLabel: "Push", statusColor: "text-sky-600", badgeBg: "bg-sky-50" },

  // â”€â”€ Productivity â”€â”€
  { id: "support", name: "Support Tickets", description: "Open/escalated tickets, SLA breaches & agent assignments", category: "Productivity", icon: Headphones, statusLabel: "Polling", statusColor: "text-blue-600", badgeBg: "bg-blue-50" },
  { id: "jira", name: "Jira / Project Mgmt", description: "Sprint progress, blocked issues & overdue tasks", category: "Productivity", icon: Workflow, statusLabel: "Webhook", statusColor: "text-violet-600", badgeBg: "bg-violet-50" },
  { id: "powerbi", name: "Power BI / Reporting", description: "Dashboard refresh status, KPI alerts & scheduled reports", category: "Productivity", icon: PieChart, statusLabel: "Scheduled", statusColor: "text-amber-600", badgeBg: "bg-amber-50" },

  // â”€â”€ CRM & Donations â”€â”€
  { id: "crm", name: "CRM Alerts", description: "Donation follow-ups, partner updates & volunteer signups requiring action", category: "CRM & Donations", icon: Users, statusLabel: "Real-time", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50" },
  { id: "donations", name: "Donation Platform", description: "Large gifts, recurring failures, campaign performance & receipts", category: "CRM & Donations", icon: Gift, statusLabel: "Webhook", statusColor: "text-violet-600", badgeBg: "bg-violet-50" },
  { id: "salesforce", name: "Salesforce", description: "Lead status, opportunity pipeline & activity feed", category: "CRM & Donations", icon: Globe, statusLabel: "Polling", statusColor: "text-blue-600", badgeBg: "bg-blue-50" },
  { id: "hubspot", name: "HubSpot", description: "Contact activity, deal stage changes & marketing metrics", category: "CRM & Donations", icon: Megaphone, statusLabel: "Webhook", statusColor: "text-violet-600", badgeBg: "bg-violet-50" },

  // â”€â”€ Client Services â”€â”€
  { id: "cms", name: "Case Management", description: "Client intake updates, housing placements & service escalations", category: "Client Services", icon: ClipboardList, statusLabel: "Real-time", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50" },
  { id: "ehr", name: "EHR Notifications", description: "Medication logs, care plan updates & incident flags", category: "Client Services", icon: HeartPulse, statusLabel: "Polling", statusColor: "text-blue-600", badgeBg: "bg-blue-50" },

  // â”€â”€ Workforce â”€â”€
  { id: "staffing", name: "Staffing Platform", description: "Shift coverage gaps, call-offs, overtime alerts & schedule changes", category: "Workforce", icon: UserCheck, statusLabel: "Real-time", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50" },
  { id: "hris", name: "HRIS Notifications", description: "New hires, onboarding tasks & expiring certifications", category: "Workforce", icon: BadgeDollarSign, statusLabel: "Polling", statusColor: "text-blue-600", badgeBg: "bg-blue-50" },
  { id: "payroll", name: "Payroll Status", description: "Pending approvals, processed runs & tax filing deadlines", category: "Workforce", icon: Wallet, statusLabel: "Scheduled", statusColor: "text-amber-600", badgeBg: "bg-amber-50" },
  { id: "quickbooks", name: "QuickBooks / Accounting", description: "Invoice status, expense approvals & cash flow alerts", category: "Workforce", icon: Receipt, statusLabel: "Polling", statusColor: "text-blue-600", badgeBg: "bg-blue-50" },

  // â”€â”€ Facilities & Supply â”€â”€
  { id: "inventory", name: "Resource Inventory", description: "Beds, hygiene kits, food supplies & threshold alerts per shelter", category: "Facilities & Supply", icon: Package, statusLabel: "Real-time", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50" },
  { id: "purchase", name: "Purchase Orders", description: "Approval queue, delivery ETAs & vendor confirmations", category: "Facilities & Supply", icon: ShoppingCart, statusLabel: "Polling", statusColor: "text-blue-600", badgeBg: "bg-blue-50" },
  { id: "maintenance", name: "Facility Maintenance", description: "Urgent work orders, scheduled inspections & repair status", category: "Facilities & Supply", icon: Wrench, statusLabel: "Webhook", statusColor: "text-violet-600", badgeBg: "bg-violet-50" },
  { id: "transport", name: "Transportation", description: "Vehicle availability, scheduled pickups & route delays", category: "Facilities & Supply", icon: Truck, statusLabel: "Real-time", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50" },

  // â”€â”€ Compliance & Analytics â”€â”€
  { id: "grants", name: "Grant Management", description: "Deadlines, compliance reminders & reporting milestones", category: "Compliance & Analytics", icon: Landmark, statusLabel: "Scheduled", statusColor: "text-amber-600", badgeBg: "bg-amber-50" },
  { id: "analytics", name: "Analytics KPI Snapshot", description: "Occupancy rate, turnaways, exits to housing & trend data", category: "Compliance & Analytics", icon: BarChart3, statusLabel: "Polling", statusColor: "text-blue-600", badgeBg: "bg-blue-50" },
  { id: "automation", name: "Automation Health", description: "JARVIS jobs, failed syncs & last successful run timestamps", category: "Compliance & Analytics", icon: Bot, statusLabel: "Real-time", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50" },
  { id: "security", name: "Security & Compliance", description: "Login anomalies, access audit logs & policy violations", category: "Compliance & Analytics", icon: Shield, statusLabel: "Real-time", statusColor: "text-emerald-600", badgeBg: "bg-emerald-50" },
  { id: "datawarehouse", name: "Data Warehouse", description: "ETL pipeline health, query performance & sync freshness", category: "Compliance & Analytics", icon: Database, statusLabel: "Polling", statusColor: "text-blue-600", badgeBg: "bg-blue-50" },
];

const GOOGLE_IDS = new Set(INTEGRATIONS.filter(i => i.isGoogle).map(i => i.id));
const CATEGORIES = [...new Set(INTEGRATIONS.map(i => i.category))];

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Picker Modal
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export function IntegrationPickerModal({
  open,
  onClose,
  onSelect,
  alreadySelected,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (integration: Integration) => void;
  alreadySelected: string[];
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  if (!open) return null;

  const filtered = INTEGRATIONS.filter(i => {
    if (alreadySelected.includes(i.id)) return false;
    if (activeCategory && i.category !== activeCategory) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-[#faf8f3] rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Add Integration</h2>
              <p className="text-xs text-slate-400 mt-0.5">Choose an external data source to display on your dashboard</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#faf6ed] hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search integrations..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#faf6ed] border border-slate-100 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
            />
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!activeCategory ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-[#faf6ed] text-slate-500 border border-slate-100 hover:bg-slate-100'}`}
            >
              All
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCategory === cat ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-[#faf6ed] text-slate-500 border border-slate-100 hover:bg-slate-100'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No integrations found matching your criteria.
            </div>
          ) : filtered.map(integration => {
            const Icon = integration.icon;
            return (
              <button
                key={integration.id}
                onClick={() => { onSelect(integration); onClose(); }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[#faf6ed] group-hover:bg-indigo-100 flex items-center justify-center shrink-0 transition-colors">
                  <Icon className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors">{integration.name}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${integration.badgeBg} ${integration.statusColor}`}>
                      {integration.statusLabel}
                    </span>
                    {integration.isGoogle && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                        Google
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{integration.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Dotted Placeholder Box
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export function DottedPlaceholder({ onClick, index, side }: { onClick: () => void, index: number, side: string }) {
  const { user } = useUser();
  const id = `dotted-${side}-${index}`;
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined" && user?.uid) {
      return localStorage.getItem(`collapse-state-${user.uid}-${id}`) === 'true';
    }
    return false;
  });

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isCollapsed;
    setIsCollapsed(next);
    if (user?.uid) {
      localStorage.setItem(`collapse-state-${user.uid}-${id}`, next.toString());
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-full h-[52px] rounded-2xl border-2 border-dashed border-slate-200 bg-[#faf6ed]/50 hover:border-indigo-300 hover:bg-indigo-50/20 px-4 flex items-center justify-between transition-all group cursor-pointer" onClick={onClick}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#faf8f3] shadow-sm">
            <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400" />
          </div>
          <p className="text-xs font-semibold text-slate-400 truncate group-hover:text-indigo-400">Empty Slot</p>
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={toggleCollapse}
            className="w-7 h-7 rounded-md bg-[#faf8f3] hover:bg-slate-100 flex items-center justify-center transition-colors shadow-sm"
          >
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[140px] rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 flex flex-col items-center justify-center gap-2 transition-all hover:bg-indigo-50/20 group cursor-pointer relative" onClick={onClick}>
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={toggleCollapse}
          className="w-6 h-6 rounded-md bg-[#faf8f3] hover:bg-slate-100 shadow-sm flex items-center justify-center transition-colors"
        >
          <ChevronUp className="w-3 h-3 text-slate-400" />
        </button>
      </div>

      <div className="w-8 h-8 rounded-full bg-[#faf8f3] shadow-sm flex items-center justify-center transition-colors">
        <Plus className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
      </div>
      <span className="text-[11px] text-slate-300 group-hover:text-indigo-400 font-medium transition-colors">Click to personalize</span>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Filled Integration Widget (after selection)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export function IntegrationWidget({
  integration,
  onRemove,
}: {
  integration: Integration;
  onRemove: () => void;
}) {
  const Icon = integration.icon;
  const { user } = useUser();
  const firestore = useFirestore();

  const [liveData, setLiveData] = useState<{ value: string; label: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined" && user?.uid) {
      const orgKey = (integration as any)._orgId || 'default';
      return localStorage.getItem(`collapse-state-${user.uid}-${orgKey}-${integration.id}`) === 'true';
    }
    return false;
  });

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    if (user?.uid) {
      const orgKey = (integration as any)._orgId || 'default';
      localStorage.setItem(`collapse-state-${user.uid}-${orgKey}-${integration.id}`, next.toString());
    }
  };

  // Fetch real data for Google integrations
  useEffect(() => {
    if (!integration.isGoogle || !integration.googleService || !user?.uid || !firestore) return;

    const fetchData = async () => {
      setLoading(true);
      setError(false);
      try {
        const docSnap = await getDoc(doc(firestore, "users", user.uid));
        const docData = docSnap.data();
        const rToken = docData?.gmailOAuth_jarvis?.refreshToken || docData?.gmailOAuth_morpheus?.refreshToken || docData?.gmailOAuth?.refreshToken;
        if (!rToken) {
          setError(true);
          setLoading(false);
          return;
        }

        const res = await fetch("/api/google/integration-data", {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({ refreshToken: rToken, service: integration.googleService }),
        });
        const data = await res.json();
        if (data.success) {
          setLiveData({ value: data.value, label: data.label });
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [integration, user?.uid, firestore]);

  // Determine what to display
  const isGoogleWithData = integration.isGoogle && integration.googleService;
  const showConnected = isGoogleWithData && liveData;
  const showLoading = isGoogleWithData && loading;
  const showError = isGoogleWithData && error && !loading;
  const showNotConnected = !isGoogleWithData;

  if (isCollapsed) {
    return (
      <div className="w-full h-[52px] rounded-2xl bg-[#faf8f3] border border-slate-100 shadow-sm px-4 flex items-center justify-between hover:shadow-md transition-all group relative">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${integration.isGoogle ? 'bg-blue-50' : 'bg-indigo-50'}`}>
            <Icon className={`w-3.5 h-3.5 ${integration.isGoogle ? 'text-blue-500' : 'text-indigo-500'}`} />
          </div>
          <p className="text-xs font-semibold text-slate-700 truncate">{integration.name}</p>
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={toggleCollapse}
            className="w-7 h-7 rounded-md bg-[#faf6ed] hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <button
            onClick={onRemove}
            className="w-7 h-7 rounded-md bg-[#faf6ed] hover:bg-red-50 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[140px] rounded-2xl bg-[#faf8f3] border border-slate-100 shadow-sm p-4 flex flex-col justify-between hover:shadow-md transition-shadow group relative">
      {/* Top Controls */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={toggleCollapse}
          className="w-6 h-6 rounded-md bg-[#faf6ed] hover:bg-slate-100 flex items-center justify-center transition-colors"
        >
          <ChevronUp className="w-3 h-3 text-slate-400" />
        </button>
        <button
          onClick={onRemove}
          className="w-6 h-6 rounded-md bg-[#faf6ed] hover:bg-red-50 flex items-center justify-center transition-colors"
        >
          <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
        </button>
      </div>

      {/* Top */}
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${integration.isGoogle ? 'bg-blue-50' : 'bg-indigo-50'}`}>
          <Icon className={`w-4 h-4 ${integration.isGoogle ? 'text-blue-500' : 'text-indigo-500'}`} />
        </div>
        <div className="min-w-0 pr-12">
          <p className="text-xs font-semibold text-slate-700 truncate">{integration.name}</p>
          <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${integration.badgeBg} ${integration.statusColor}`}>
            {integration.statusLabel}
          </span>
        </div>
      </div>

      {/* Metric / Status */}
      <div className="mt-2">
        {showLoading && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            <span className="text-xs text-slate-400">Fetching...</span>
          </div>
        )}
        {showConnected && (
          <>
            <span className="text-2xl font-bold text-slate-800">{liveData!.value}</span>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">{liveData!.label}</p>
          </>
        )}
        {showError && (
          <p className="text-xs text-amber-500 font-medium">Connect Google account in Settings</p>
        )}
        {showNotConnected && (
          <p className="text-xs text-slate-300 font-medium">Not connected yet</p>
        )}
        {/* Google integration without googleService (Sheets, Docs) */}
        {integration.isGoogle && !integration.googleService && !loading && (
          <p className="text-xs text-slate-300 font-medium">Available via Google</p>
        )}
      </div>

      {/* Footer Links */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-50">
        <button className="flex items-center gap-1 text-[10px] text-indigo-500 font-medium hover:text-indigo-700 transition-colors">
          <ExternalLink className="w-3 h-3" /> Drill down
        </button>
        <button className="flex items-center gap-1 text-[10px] text-slate-400 font-medium hover:text-slate-600 transition-colors">
          <Settings2 className="w-3 h-3" /> Thresholds
        </button>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Integration Sidebar Column (6 slots)
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export function IntegrationColumn({ side, limit = 6, orgId = "default" }: { side: "left" | "right", limit?: number, orgId?: string }) {
  const [slots, setSlots] = useState<(Integration | null)[]>(Array(limit).fill(null));
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { user } = useUser();

  useEffect(() => {
    if (user?.uid) {
      const saved = localStorage.getItem(`integration-slots-${user.uid}-${orgId}-${side}`);
      if (saved) {
        try {
          const parsedIds = JSON.parse(saved);
          const restored = parsedIds.map((id: string | null) => 
            id ? INTEGRATIONS.find(i => i.id === id) || null : null
          );
          while (restored.length < limit) restored.push(null);
          setSlots(restored.slice(0, limit));
        } catch (e) {}
      }
      setLoaded(true);
    }
  }, [user?.uid, side, limit, orgId]);

  const selectedIds = slots.filter(Boolean).map(s => s!.id);

  const handleSelect = (index: number, integration: Integration) => {
    setSlots(prev => {
      const next = [...prev];
      // Attach orgId so widget collapse state is also scoped
      next[index] = { ...integration, _orgId: orgId } as any;
      if (user?.uid) {
        localStorage.setItem(`integration-slots-${user.uid}-${orgId}-${side}`, JSON.stringify(next.map(s => s?.id || null)));
      }
      return next;
    });
  };

  const handleRemove = (index: number) => {
    setSlots(prev => {
      const next = [...prev];
      next[index] = null;
      if (user?.uid) {
        localStorage.setItem(`integration-slots-${user.uid}-${orgId}-${side}`, JSON.stringify(next.map(s => s?.id || null)));
      }
      return next;
    });
  };

  if (!loaded) {
    return (
      <div className="flex flex-col gap-5 w-full">
        {Array(limit).fill(null).map((_, i) => (
          <div key={i} className="w-full h-[140px] animate-pulse bg-[#faf6ed]/50 rounded-2xl border-2 border-dashed border-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-5 w-full">
        {slots.map((slot, i) => (
          <div key={`${side}-${i}`} className="transition-all duration-300">
            {slot ? (
              <IntegrationWidget integration={slot} onRemove={() => handleRemove(i)} />
            ) : (
              <DottedPlaceholder onClick={() => setPickerOpen(i)} index={i} side={side} />
            )}
          </div>
        ))}
      </div>

      <IntegrationPickerModal
        open={pickerOpen !== null}
        onClose={() => setPickerOpen(null)}
        onSelect={(integration) => {
          if (pickerOpen !== null) {
            handleSelect(pickerOpen, integration);
          }
        }}
        alreadySelected={selectedIds}
      />
    </>
  );
}
