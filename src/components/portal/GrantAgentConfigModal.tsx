"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  X, Loader2, Rocket, CheckCircle2, MapPin, DollarSign, Calendar,
  Timer, FileText, Tag, Plus, ShieldCheck, ChevronDown, ChevronRight,
  Users, Hash, Building2, Globe, MapPinned, Clock, Zap, Search,
  Heart, Home, GraduationCap, Leaf, Palette, Microscope, TrendingUp, Bus,
  Check, AlertTriangle, Layers, Lock, Sparkles,
} from "lucide-react";
import { SERVICE_AREA_GROUPS, type ServiceAreaGroup } from "@/data/service-areas";
import { POPULATION_CATEGORIES } from "@/data/populations";
import type { OrgProfileData } from "@/hooks/useOrgProfile";

/* ——————————————————————————————————————————————————————————————————
   Config Schema (extended — backward compatible)
   —————————————————————————————————————————————————————————————————— */
export interface GrantAgentConfig {
  // Legacy fields (preserved for backward compat)
  grantTypes: string[];
  locationState: string;
  locationCity: string;
  budgetMin: number | null;
  budgetMax: number | null;
  openDate: string;
  closeDate: string;
  intervalValue: number;
  intervalUnit: "minutes" | "hours" | "days" | "weeks";
  companyDescription: string;
  welfareKeywords: string[];
  eligibilityType: string;

  // New fields from Config Overhaul
  serviceAreas: string[];
  populationsServed: string[];
  eligibilityTypes: string[];
  fundingInstruments: string[];
  fundingSources: string[];
  geoScope: "nationwide" | "state" | "metro" | "local";
  deadlineWindow: "30" | "60" | "90" | "180" | "any" | "custom";
  orgBudget: number | null;
  orgStaffSize: number | null;
  orgEin: string;
  orgSamUei: string;
  orgYearFounded: number | null;
}

export const DEFAULT_CONFIG: GrantAgentConfig = {
  grantTypes: ["housing_shelter", "health_human_services"],
  locationState: "Colorado",
  locationCity: "Denver",
  budgetMin: null,
  budgetMax: null,
  openDate: "",
  closeDate: "",
  intervalValue: 1,
  intervalUnit: "days",
  companyDescription: "",
  welfareKeywords: [],
  eligibilityType: "nonprofit_501c3",
  serviceAreas: [],
  populationsServed: [],
  eligibilityTypes: ["nonprofit_501c3"],
  fundingInstruments: [],
  fundingSources: ["federal"],
  geoScope: "state",
  deadlineWindow: "90",
  orgBudget: null,
  orgStaffSize: null,
  orgEin: "",
  orgSamUei: "",
  orgYearFounded: null,
};

export const ELIGIBILITY_TYPE_OPTIONS = [
  { value: "nonprofit_501c3", label: "501(c)(3) Nonprofits" },
  { value: "nonprofit_other", label: "Other Nonprofits" },
  { value: "state_government", label: "State Government" },
  { value: "city_government", label: "City/Local Government" },
  { value: "tribal", label: "Tribal Organizations" },
  { value: "small_business", label: "Small Businesses" },
  { value: "education", label: "Educational Institutions" },
  { value: "individual", label: "Individuals" },
];

export const WELFARE_KEYWORD_OPTIONS = [
  "501(c)(3) grants", "CoC grants", "HOME-ARP", "ESG (Emergency Solutions)",
  "SSBG (Social Services)", "SAMHSA", "social services", "substance abuse",
  "behavioral health", "block grants", "homeless shelters", "food kitchens",
];

const FUNDING_INSTRUMENTS = [
  { id: "grant", label: "Grants" },
  { id: "cooperative_agreement", label: "Cooperative Agreements" },
  { id: "contract", label: "Contracts" },
  { id: "subaward", label: "Sub-awards / Pass-through" },
  { id: "formula_grant", label: "Formula / Block Grants" },
  { id: "fellowship", label: "Fellowships & Scholarships" },
];

const FUNDING_SOURCES = [
  { id: "federal", label: "Federal (Grants.gov, SAM.gov)", enabled: true },
  { id: "federal_subawards", label: "Federal Sub-awards (USAspending)", enabled: true },
  { id: "state", label: "State Government", enabled: false },
  { id: "foundation", label: "Private Foundations (Candid)", enabled: false },
  { id: "corporate", label: "Corporate Giving", enabled: false },
];

const AWARD_PRESETS = [
  { label: "Micro", sub: "$1K – $25K", min: 1000, max: 25000 },
  { label: "Small", sub: "$25K – $100K", min: 25000, max: 100000 },
  { label: "Mid", sub: "$100K – $500K", min: 100000, max: 500000 },
  { label: "Large", sub: "$500K – $2M", min: 500000, max: 2000000 },
  { label: "Major", sub: "$2M+", min: 2000000, max: null },
  { label: "Any", sub: "No limit", min: null, max: null },
];

const DEADLINE_PRESETS = [
  { value: "30" as const, label: "30 days" },
  { value: "60" as const, label: "60 days" },
  { value: "90" as const, label: "90 days" },
  { value: "180" as const, label: "6 months" },
  { value: "any" as const, label: "Any" },
  { value: "custom" as const, label: "Custom" },
];

const GEO_SCOPE_OPTIONS = [
  { value: "nationwide" as const, label: "Nationwide", desc: "Search all U.S. grants", icon: Globe },
  { value: "state" as const, label: "State-level", desc: "Grants in or targeting a specific state", icon: MapPinned },
  { value: "metro" as const, label: "Metro area", desc: "City and surrounding area", icon: Building2 },
  { value: "local" as const, label: "Local only", desc: "Specific city / county", icon: MapPin },
];

/* ——— Icon lookup for service area groups ——— */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Home, Heart, Users, GraduationCap, Leaf, Palette, Microscope, TrendingUp, Bus,
};

/* ——— US State + City Dataset ——— */
const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming","District of Columbia",
];

const CITY_DATABASE: Record<string, string[]> = {
  "Colorado": ["Denver","Colorado Springs","Aurora","Fort Collins","Lakewood","Thornton","Arvada","Westminster","Pueblo","Boulder","Greeley","Longmont","Loveland","Broomfield","Castle Rock","Commerce City","Parker","Littleton","Northglenn","Brighton"],
  "California": ["Los Angeles","San Francisco","San Diego","San Jose","Sacramento","Oakland","Fresno","Long Beach","Bakersfield","Anaheim","Santa Ana","Riverside","Stockton","Irvine","Chula Vista"],
  "New York": ["New York City","Buffalo","Rochester","Yonkers","Syracuse","Albany","New Rochelle","Mount Vernon","Schenectady","Utica"],
  "Texas": ["Houston","San Antonio","Dallas","Austin","Fort Worth","El Paso","Arlington","Corpus Christi","Plano","Laredo"],
  "Florida": ["Jacksonville","Miami","Tampa","Orlando","St. Petersburg","Hialeah","Port St. Lucie","Tallahassee","Cape Coral","Fort Lauderdale"],
  "Illinois": ["Chicago","Aurora","Joliet","Naperville","Rockford","Springfield","Elgin","Peoria","Champaign","Waukegan"],
  "Pennsylvania": ["Philadelphia","Pittsburgh","Allentown","Erie","Reading","Scranton","Bethlehem","Lancaster","Harrisburg","York"],
  "Ohio": ["Columbus","Cleveland","Cincinnati","Toledo","Akron","Dayton","Parma","Canton","Youngstown","Lorain"],
  "Georgia": ["Atlanta","Augusta","Columbus","Savannah","Athens","Sandy Springs","Roswell","Macon","Johns Creek","Albany"],
  "Michigan": ["Detroit","Grand Rapids","Warren","Sterling Heights","Ann Arbor","Lansing","Flint","Dearborn","Livonia","Troy"],
  "Washington": ["Seattle","Spokane","Tacoma","Vancouver","Bellevue","Kent","Everett","Renton","Federal Way","Yakima"],
  "Arizona": ["Phoenix","Tucson","Mesa","Chandler","Scottsdale","Glendale","Gilbert","Tempe","Peoria","Surprise"],
  "Massachusetts": ["Boston","Worcester","Springfield","Lowell","Cambridge","New Bedford","Brockton","Quincy","Lynn","Fall River"],
};

/* ═══════════════════════════════════════════════════════════════════
   LocationAutocomplete — reused from original
   ═══════════════════════════════════════════════════════════════════ */
function LocationAutocomplete({
  label, value, onChange, options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return options.slice(0, 8);
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 8);
  }, [query, options]);

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setFocused(true); }}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf6ed] focus:bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400"
        />
      </div>
      {focused && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[70] bg-[#faf8f3] border border-slate-200 rounded-xl shadow-lg py-1 max-h-[180px] overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setQuery(opt); setFocused(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                opt === value ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700 hover:bg-[#f2ece0]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Reusable pill toggle
   ═══════════════════════════════════════════════════════════════════ */
function TogglePill({ active, label, onClick, disabled, disabledLabel }: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      title={disabled ? (disabledLabel || "Coming soon") : undefined}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 ${
        disabled
          ? "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-60"
          : active
            ? "bg-violet-100 border-violet-300 text-violet-800 shadow-sm cursor-pointer"
            : "bg-violet-50/60 border-violet-200/80 text-violet-500 hover:bg-violet-50 cursor-pointer"
      }`}
    >
      {active && !disabled && <CheckCircle2 className="w-3 h-3 text-violet-600" />}
      {disabled && <Lock className="w-3 h-3" />}
      {label}
      {disabled && <span className="text-[9px] font-bold text-slate-400 ml-0.5">SOON</span>}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Section card wrapper
   ═══════════════════════════════════════════════════════════════════ */
function SectionCard({ icon: Icon, iconBg, iconColor, title, description, children }: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#faf6ed] border border-slate-100 rounded-2xl p-4.5 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {title}
        </label>
      </div>
      {description && (
        <p className="text-[11px] text-slate-500 leading-normal">{description}</p>
      )}
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Step indicator
   ═══════════════════════════════════════════════════════════════════ */
const STEP_LABELS = ["Your Org", "What You Need", "Where & When", "Review"];

function StepIndicator({ current, completed }: { current: number; completed: number[] }) {
  return (
    <div className="flex items-center justify-between px-4">
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isDone = completed.includes(stepNum);
        const isUpcoming = !isActive && !isDone;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : isDone
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-400"
              }`}>
                {isDone ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span className={`text-[10px] font-bold tracking-wide ${
                isActive ? "text-indigo-700" : isDone ? "text-emerald-600" : "text-slate-400"
              }`}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 rounded-full mt-[-12px] ${
                isDone ? "bg-emerald-400" : "bg-slate-200"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MODAL COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export function GrantAgentConfigModal({
  onClose,
  initialConfig,
  onSave,
  orgProfile,
  onSaveOrgProfile,
  isEditMode = false,
  lastScanTimestamp,
}: {
  onClose: () => void;
  initialConfig?: GrantAgentConfig;
  onSave?: (config: GrantAgentConfig, options?: { resetTimer?: boolean }) => void;
  orgProfile?: OrgProfileData | null;
  onSaveOrgProfile?: (profile: Partial<OrgProfileData>) => void;
  isEditMode?: boolean;
  /** Pass the most recent scan timestamp (Firestore Timestamp or Date) when editing, to show timer progress */
  lastScanTimestamp?: any;
}) {
  const [resetTimer, setResetTimer] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const hasOrgProfile = !!(orgProfile && orgProfile.companyDescription);
  const [config, setConfig] = useState<GrantAgentConfig>(() => {
    const base = initialConfig ?? DEFAULT_CONFIG;
    // Merge priority: initialConfig > orgProfile > DEFAULT_CONFIG
    const org = orgProfile || {} as Partial<OrgProfileData>;
    const merged: GrantAgentConfig = {
      ...DEFAULT_CONFIG,
      ...base,
      // Auto-fill from org profile if initialConfig doesn't have the data
      companyDescription: base.companyDescription || org.companyDescription || DEFAULT_CONFIG.companyDescription,
      orgBudget: base.orgBudget ?? org.orgBudget ?? null,
      orgStaffSize: base.orgStaffSize ?? org.orgStaffSize ?? null,
      orgEin: base.orgEin || org.orgEin || "",
      orgSamUei: base.orgSamUei || org.orgSamUei || "",
      orgYearFounded: base.orgYearFounded ?? org.orgYearFounded ?? null,
      locationState: base.locationState || org.locationState || DEFAULT_CONFIG.locationState,
      locationCity: base.locationCity || org.locationCity || DEFAULT_CONFIG.locationCity,
      eligibilityTypes: base.eligibilityTypes ?? org.eligibilityTypes ?? (base.eligibilityType ? [base.eligibilityType] : ["nonprofit_501c3"]),
      grantTypes: base.grantTypes && base.grantTypes.length > 0 ? base.grantTypes : DEFAULT_CONFIG.grantTypes,
      welfareKeywords: base.welfareKeywords ?? [],
      serviceAreas: (base.serviceAreas && base.serviceAreas.length > 0) ? base.serviceAreas : (org.serviceAreas?.length ? org.serviceAreas : []),
      populationsServed: (base.populationsServed && base.populationsServed.length > 0) ? base.populationsServed : (org.populationsServed?.length ? org.populationsServed : []),
      fundingInstruments: base.fundingInstruments ?? [],
      fundingSources: base.fundingSources ?? ["federal"],
      geoScope: base.geoScope ?? "state",
      deadlineWindow: base.deadlineWindow ?? "90",
    };
    return merged;
  });

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [customKeywordInput, setCustomKeywordInput] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [keywordsExpanded, setKeywordsExpanded] = useState(false);
  const totalSteps = 4;

  // Track completed steps
  const completedSteps = useMemo(() => {
    const c: number[] = [];
    if (step > 1) c.push(1);
    if (step > 2) c.push(2);
    if (step > 3) c.push(3);
    return c;
  }, [step]);

  const cityOptions = useMemo(() => CITY_DATABASE[config.locationState] || [], [config.locationState]);

  /* ——— Helpers ——— */
  function toggleArrayItem(field: keyof GrantAgentConfig, item: string) {
    setConfig((prev) => {
      const current = (prev[field] as string[]) || [];
      const updated = current.includes(item) ? current.filter((k) => k !== item) : [...current, item];
      return { ...prev, [field]: updated };
    });
  }

  function toggleGroupExpanded(groupId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  }

  function toggleEntireGroup(group: ServiceAreaGroup) {
    setConfig((prev) => {
      const current = prev.serviceAreas || [];
      const allSubIds = group.subcategories.map((s) => s.id);
      const allSelected = allSubIds.every((id) => current.includes(id));
      const updated = allSelected
        ? current.filter((id) => !allSubIds.includes(id))
        : [...current, ...allSubIds.filter((id) => !current.includes(id))];
      return { ...prev, serviceAreas: updated };
    });
  }

  function addCustomKeyword() {
    const trimmed = customKeywordInput.trim().toLowerCase();
    if (!trimmed) return;
    setConfig((prev) => {
      const current = prev.welfareKeywords || [];
      if (current.includes(trimmed)) return prev;
      return { ...prev, welfareKeywords: [...current, trimmed] };
    });
    setCustomKeywordInput("");
  }

  function removeWelfareKeyword(keyword: string) {
    setConfig((prev) => ({
      ...prev,
      welfareKeywords: (prev.welfareKeywords || []).filter((k) => k !== keyword),
    }));
  }

  function toggleWelfareKeyword(keyword: string) {
    setConfig((prev) => {
      const current = prev.welfareKeywords || [];
      const updated = current.includes(keyword) ? current.filter((k) => k !== keyword) : [...current, keyword];
      return { ...prev, welfareKeywords: updated };
    });
  }

  function setAwardPreset(min: number | null, max: number | null) {
    setConfig((prev) => ({ ...prev, budgetMin: min, budgetMax: max }));
  }

  function canProceed(): boolean {
    switch (step) {
      case 1: return true;
      case 2: return config.serviceAreas.length > 0;
      case 3: return true;
      default: return true;
    }
  }

  async function handleSave() {
    if (onSave) {
      setSaving(true);
      await new Promise((r) => setTimeout(r, 400));
      const finalConfig = {
        ...config,
        intervalValue: Math.max(1, config.intervalValue || 1),
        eligibilityType: config.eligibilityTypes?.[0] || config.eligibilityType || "nonprofit_501c3",
      };

      // Save org profile if checkbox is checked
      if (saveAsDefault && onSaveOrgProfile) {
        onSaveOrgProfile({
          companyDescription: config.companyDescription,
          orgBudget: config.orgBudget,
          orgStaffSize: config.orgStaffSize,
          orgEin: config.orgEin,
          orgSamUei: config.orgSamUei,
          orgYearFounded: config.orgYearFounded,
          locationState: config.locationState,
          locationCity: config.locationCity,
          eligibilityTypes: config.eligibilityTypes,
          serviceAreas: config.serviceAreas,
          populationsServed: config.populationsServed,
        });
      }

      onSave(finalConfig, isEditMode ? { resetTimer } : undefined);
      setSaving(false);
      return;
    }
    onClose();
  }

  const descCharCount = (config.companyDescription || "").length;
  const activePreset = AWARD_PRESETS.find(
    (p) => p.min === config.budgetMin && p.max === config.budgetMax
  );

  /* ═══ Format helpers for review ═══ */
  function fmtDollar(n: number | null) {
    if (n === null || n === undefined) return "—";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n}`;
  }

  /* ═══════════════════════════════════════════════════════════════
     STEP 1 — YOUR ORGANIZATION
     ═══════════════════════════════════════════════════════════════ */
  function renderStep1() {
    return (
      <div className="space-y-5">
        {/* Auto-fill Banner */}
        {hasOrgProfile && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold text-emerald-700">Pre-filled from your organization profile — tweak anything below for this agent.</span>
          </div>
        )}
        {/* A: Org Profile */}
        <SectionCard
          icon={FileText}
          iconBg="bg-indigo-100"
          iconColor="text-indigo-600"
          title="Organization Profile & Mission"
          description="Describe your organization's mission, target demography, and programs. The AI agent uses this to analyze and rank matching opportunities."
        >
          <textarea
            value={config.companyDescription || ""}
            onChange={(e) => setConfig((prev) => ({ ...prev, companyDescription: e.target.value.slice(0, 500) }))}
            placeholder={"e.g. NXT Chapter is a 501(c)(3) nonprofit in Denver, CO that operates transitional housing programs and provides wraparound services — including behavioral health, job training, and case management — for individuals experiencing homelessness and substance use disorders."}
            rows={4}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 leading-relaxed resize-none font-medium"
          />
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-semibold ${descCharCount < 100 ? "text-amber-500" : "text-slate-400"}`}>
              {descCharCount} / 500 characters
            </span>
            {descCharCount > 0 && descCharCount < 100 && (
              <span className="text-[10px] font-semibold text-amber-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Short descriptions reduce AI matching accuracy
              </span>
            )}
          </div>
        </SectionCard>

        {/* B: Organization Details */}
        <SectionCard
          icon={Building2}
          iconBg="bg-sky-100"
          iconColor="text-sky-600"
          title="Organization Details"
          description="Optional structured data helps narrow results and pre-fill eligibility checks."
        >
          <div className="grid grid-cols-3 gap-3">
            {/* Annual Budget */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Annual Budget</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="number"
                  min={0}
                  value={config.orgBudget ?? ""}
                  onChange={(e) => setConfig((p) => ({ ...p, orgBudget: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="e.g. 500000"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            {/* Year Founded */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Year Founded</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="number"
                  min={1800}
                  max={2030}
                  value={config.orgYearFounded ?? ""}
                  onChange={(e) => setConfig((p) => ({ ...p, orgYearFounded: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="e.g. 2015"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            {/* Staff Size */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Staff Size</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="number"
                  min={0}
                  value={config.orgStaffSize ?? ""}
                  onChange={(e) => setConfig((p) => ({ ...p, orgStaffSize: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="e.g. 12"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* EIN */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">EIN (optional)</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={config.orgEin}
                  onChange={(e) => setConfig((p) => ({ ...p, orgEin: e.target.value }))}
                  placeholder="XX-XXXXXXX"
                  maxLength={12}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>
            {/* SAM UEI */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">SAM UEI (optional)</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={config.orgSamUei}
                  onChange={(e) => setConfig((p) => ({ ...p, orgSamUei: e.target.value }))}
                  placeholder="XXXXXXXXXXXX"
                  maxLength={14}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* C: Organization Type (multi-select pills) */}
        <SectionCard
          icon={ShieldCheck}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          title="Organization Type"
          description="Select all applicable organization types. Used to filter grants by eligible applicant categories."
        >
          <div className="flex flex-wrap gap-2">
            {ELIGIBILITY_TYPE_OPTIONS.map((opt) => (
              <TogglePill
                key={opt.value}
                active={(config.eligibilityTypes || []).includes(opt.value)}
                label={opt.label}
                onClick={() => toggleArrayItem("eligibilityTypes", opt.value)}
              />
            ))}
          </div>
        </SectionCard>

        {/* D: Save as Default Checkbox */}
        {onSaveOrgProfile && (
          <label className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors select-none">
            <input
              type="checkbox"
              checked={saveAsDefault}
              onChange={(e) => setSaveAsDefault(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-xs font-semibold text-slate-600">Save these details as my default organization profile</span>
            <span className="text-[10px] text-slate-400 font-medium ml-auto">Auto-fills future agents</span>
          </label>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     STEP 2 — WHAT YOU'RE LOOKING FOR
     ═══════════════════════════════════════════════════════════════ */
  function renderStep2() {
    const totalSelected = config.serviceAreas.length;

    return (
      <div className="space-y-5">
        {/* A: Service Areas */}
        <SectionCard
          icon={Layers}
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
          title="Service Areas"
          description="Select the program areas your organization serves. This drives search queries and category filtering."
        >
          {/* Selected count */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold ${totalSelected > 0 ? "text-violet-700" : "text-slate-400"}`}>
              {totalSelected} service area{totalSelected !== 1 ? "s" : ""} selected
            </span>
            {totalSelected === 0 && (
              <span className="text-[10px] font-semibold text-amber-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                At least 1 required
              </span>
            )}
          </div>

          {/* Accordion groups */}
          <div className="space-y-2">
            {SERVICE_AREA_GROUPS.map((group) => {
              const GroupIcon = ICON_MAP[group.icon] || Layers;
              const expanded = expandedGroups.has(group.id);
              const selectedInGroup = group.subcategories.filter((s) => config.serviceAreas.includes(s.id)).length;
              const allSelected = selectedInGroup === group.subcategories.length;

              return (
                <div key={group.id} className="border border-slate-200 rounded-xl overflow-hidden bg-[#faf8f3]">
                  {/* Group header */}
                  <div
                    className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-[#f5f0e5] transition-colors select-none"
                    onClick={() => toggleGroupExpanded(group.id)}
                  >
                    <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                      <GroupIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800 flex-1">{group.label}</span>
                    {selectedInGroup > 0 && (
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                        {selectedInGroup}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleEntireGroup(group); }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                        allSelected
                          ? "bg-violet-200 text-violet-700 hover:bg-violet-300"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {allSelected ? "Deselect All" : "Select All"}
                    </button>
                    {expanded
                      ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    }
                  </div>

                  {/* Subcategories grid */}
                  {expanded && (
                    <div className="px-3.5 pb-3 pt-1 border-t border-slate-100">
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                        {group.subcategories.map((sub) => {
                          const active = config.serviceAreas.includes(sub.id);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => toggleArrayItem("serviceAreas", sub.id)}
                              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${
                                active
                                  ? "bg-violet-100 border-violet-300 text-violet-800 shadow-sm"
                                  : "bg-white/60 border-slate-200 text-slate-600 hover:bg-violet-50 hover:border-violet-200"
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                {active && <CheckCircle2 className="w-3 h-3 text-violet-600 shrink-0" />}
                                {sub.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* B: Populations Served */}
        <SectionCard
          icon={Users}
          iconBg="bg-rose-100"
          iconColor="text-rose-600"
          title="Populations Served"
          description="Select the demographics your programs focus on. This improves relevance scoring."
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold ${config.populationsServed.length > 0 ? "text-rose-700" : "text-slate-400"}`}>
              {config.populationsServed.length} population{config.populationsServed.length !== 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {POPULATION_CATEGORIES.map((pop) => (
              <TogglePill
                key={pop.id}
                active={config.populationsServed.includes(pop.id)}
                label={pop.label}
                onClick={() => toggleArrayItem("populationsServed", pop.id)}
              />
            ))}
          </div>
        </SectionCard>

        {/* C: Search Keywords (collapsed by default) */}
        <div className="bg-[#faf6ed] border border-slate-100 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setKeywordsExpanded(!keywordsExpanded)}
            className="w-full flex items-center gap-2 px-4.5 py-3.5 cursor-pointer hover:bg-[#f5f0e5] transition-colors"
          >
            <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <Search className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex-1 text-left">
              Advanced: Custom Keywords
            </span>
            {(config.welfareKeywords || []).length > 0 && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {(config.welfareKeywords || []).length}
              </span>
            )}
            {keywordsExpanded
              ? <ChevronDown className="w-4 h-4 text-slate-400" />
              : <ChevronRight className="w-4 h-4 text-slate-400" />
            }
          </button>
          {keywordsExpanded && (
            <div className="px-4.5 pb-4 pt-1 border-t border-slate-100 space-y-3">
              <p className="text-[11px] text-slate-500 leading-normal">
                Add specific program names, acronyms, or CFDA numbers to refine search queries.
              </p>
              <div className="flex flex-wrap gap-2">
                {WELFARE_KEYWORD_OPTIONS.map((kw) => {
                  const kwLower = kw.toLowerCase();
                  const active = config.welfareKeywords?.some((k) => {
                    const kLower = k.toLowerCase();
                    return kLower === kwLower || kwLower.startsWith(kLower) || kLower.startsWith(kwLower) || kwLower.includes(kLower) || kLower.includes(kwLower);
                  });
                  return (
                    <TogglePill key={kw} active={!!active} label={kw} onClick={() => toggleWelfareKeyword(kwLower)} />
                  );
                })}
                {/* Custom keywords not in default list */}
                {config.welfareKeywords?.filter((k) => {
                  const kLower = k.toLowerCase();
                  return !WELFARE_KEYWORD_OPTIONS.some((o) => {
                    const oLower = o.toLowerCase();
                    return kLower === oLower || oLower.startsWith(kLower) || kLower.startsWith(oLower) || oLower.includes(kLower) || kLower.includes(oLower);
                  });
                }).map((kw) => (
                  <div key={kw} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-violet-100 border border-violet-300 text-violet-800 shadow-sm flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-violet-600" />
                    {kw}
                    <button type="button" onClick={(e) => { e.stopPropagation(); removeWelfareKeyword(kw); }} className="w-4 h-4 rounded-full bg-violet-200 hover:bg-red-200 flex items-center justify-center transition-colors ml-0.5 cursor-pointer" title="Remove keyword">
                      <X className="w-2.5 h-2.5 text-violet-600 hover:text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 max-w-sm">
                <input
                  type="text"
                  value={customKeywordInput}
                  onChange={(e) => setCustomKeywordInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomKeyword(); } }}
                  placeholder="Add custom keyword…"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-xs text-slate-800 placeholder:text-slate-400 font-medium"
                />
                <button type="button" onClick={addCustomKeyword} className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* D: Funding Instruments */}
        <SectionCard
          icon={Tag}
          iconBg="bg-sky-100"
          iconColor="text-sky-600"
          title="Funding Instruments"
          description="What types of funding mechanisms are you looking for?"
        >
          <div className="flex flex-wrap gap-2">
            {FUNDING_INSTRUMENTS.map((fi) => (
              <TogglePill
                key={fi.id}
                active={config.fundingInstruments.includes(fi.id)}
                label={fi.label}
                onClick={() => toggleArrayItem("fundingInstruments", fi.id)}
              />
            ))}
          </div>
        </SectionCard>

        {/* E: Funding Sources */}
        <SectionCard
          icon={Zap}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          title="Data Sources"
          description="Where should the agent search for opportunities?"
        >
          <div className="flex flex-wrap gap-2">
            {FUNDING_SOURCES.map((fs) => (
              <TogglePill
                key={fs.id}
                active={config.fundingSources.includes(fs.id)}
                label={fs.label}
                onClick={() => toggleArrayItem("fundingSources", fs.id)}
                disabled={!fs.enabled}
                disabledLabel="Coming soon"
              />
            ))}
          </div>
        </SectionCard>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     STEP 3 — WHERE & WHEN
     ═══════════════════════════════════════════════════════════════ */
  function renderStep3() {
    return (
      <div className="space-y-5">
        {/* A: Geographic Scope */}
        <SectionCard
          icon={Globe}
          iconBg="bg-indigo-100"
          iconColor="text-indigo-600"
          title="Geographic Scope"
          description="Define how geographically specific the search should be."
        >
          <div className="grid grid-cols-2 gap-2.5">
            {GEO_SCOPE_OPTIONS.map((opt) => {
              const active = config.geoScope === opt.value;
              const ScopeIcon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setConfig((p) => ({ ...p, geoScope: opt.value }))}
                  className={`flex items-start gap-3 px-3.5 py-3 rounded-xl border transition-all text-left cursor-pointer ${
                    active
                      ? "bg-indigo-50 border-indigo-300 shadow-sm"
                      : "bg-white/50 border-slate-200 hover:bg-indigo-50/50 hover:border-indigo-200"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                  }`}>
                    <ScopeIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${active ? "text-indigo-800" : "text-slate-700"}`}>{opt.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {/* Location fields — visible when not nationwide */}
          {config.geoScope !== "nationwide" && (
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-100">
              <LocationAutocomplete
                label="State"
                value={config.locationState}
                onChange={(val) => setConfig((p) => ({ ...p, locationState: val, locationCity: "" }))}
                options={US_STATES}
                placeholder="Search state…"
              />
              {(config.geoScope === "metro" || config.geoScope === "local") && (
                <LocationAutocomplete
                  label="City / Town"
                  value={config.locationCity}
                  onChange={(val) => setConfig((p) => ({ ...p, locationCity: val }))}
                  options={cityOptions}
                  placeholder="Search city…"
                />
              )}
            </div>
          )}
        </SectionCard>

        {/* B: Award Size */}
        <SectionCard
          icon={DollarSign}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          title="Award Size"
          description="Set a target award range or pick a preset."
        >
          {/* Presets */}
          <div className="flex flex-wrap gap-2 mb-3">
            {AWARD_PRESETS.map((preset) => {
              const isActive = activePreset?.label === preset.label;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setAwardPreset(preset.min, preset.max)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isActive
                      ? "bg-emerald-100 border-emerald-300 text-emerald-800 shadow-sm"
                      : "bg-white/60 border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200"
                  }`}
                >
                  <span className="block">{preset.label}</span>
                  <span className={`text-[9px] font-semibold ${isActive ? "text-emerald-600" : "text-slate-400"}`}>{preset.sub}</span>
                </button>
              );
            })}
          </div>
          {/* Min/max manual inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Minimum ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="number"
                  min={0}
                  value={config.budgetMin ?? ""}
                  onChange={(e) => setConfig((p) => ({ ...p, budgetMin: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="0"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Maximum ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="number"
                  min={0}
                  value={config.budgetMax ?? ""}
                  onChange={(e) => setConfig((p) => ({ ...p, budgetMax: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="No limit"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* C: Deadline Window */}
        <SectionCard
          icon={Clock}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          title="Deadline Window"
          description="Only show opportunities closing within this window."
        >
          <div className="flex flex-wrap gap-2">
            {DEADLINE_PRESETS.map((dp) => {
              const active = config.deadlineWindow === dp.value;
              return (
                <button
                  key={dp.value}
                  type="button"
                  onClick={() => setConfig((p) => ({ ...p, deadlineWindow: dp.value }))}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    active
                      ? "bg-amber-100 border-amber-300 text-amber-800 shadow-sm"
                      : "bg-white/60 border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200"
                  }`}
                >
                  {dp.label}
                </button>
              );
            })}
          </div>
          {/* Custom date pickers */}
          {config.deadlineWindow === "custom" && (
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Open Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={config.openDate}
                    onChange={(e) => setConfig((p) => ({ ...p, openDate: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Close Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={config.closeDate}
                    onChange={(e) => setConfig((p) => ({ ...p, closeDate: e.target.value }))}
                    min={config.openDate || undefined}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* D: Scan Interval */}
        <SectionCard
          icon={Timer}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          title="Agent Scan Interval"
          description="How frequently should this agent scan for new grant opportunities?"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 font-medium shrink-0">Every</span>
            <div className="relative">
              <Timer className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={config.intervalValue || ""}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  if (raw === "") { setConfig((p) => ({ ...p, intervalValue: 0 })); }
                  else { const num = parseInt(raw, 10); if (!isNaN(num) && num <= 999) setConfig((p) => ({ ...p, intervalValue: num })); }
                }}
                className="w-24 pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800"
              />
            </div>
            <div className="relative">
              <select
                value={config.intervalUnit}
                onChange={(e) => setConfig((p) => ({ ...p, intervalUnit: e.target.value as GrantAgentConfig["intervalUnit"] }))}
                className="appearance-none pl-4 pr-8 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 cursor-pointer"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>

          {/* Timer continuation option — only in edit mode */}
          {isEditMode && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">When you save changes</p>
              {(() => {
                // Calculate remaining time
                let elapsed = 0;
                let totalMs = 0;
                let remaining = 0;
                let hasTimerData = false;

                if (lastScanTimestamp) {
                  const lastMs = typeof lastScanTimestamp.toMillis === "function"
                    ? lastScanTimestamp.toMillis()
                    : new Date(lastScanTimestamp).getTime();
                  if (!isNaN(lastMs)) {
                    const multipliers: Record<string, number> = {
                      minutes: 60_000, hours: 3_600_000, days: 86_400_000, weeks: 604_800_000,
                    };
                    totalMs = (initialConfig?.intervalValue || 1) * (multipliers[initialConfig?.intervalUnit || "days"] || 86_400_000);
                    elapsed = Date.now() - lastMs;
                    remaining = Math.max(0, totalMs - elapsed);
                    hasTimerData = true;
                  }
                }

                const fmtRemaining = (ms: number) => {
                  if (ms <= 0) return "due now";
                  if (ms < 60_000) return "< 1 min remaining";
                  if (ms < 3_600_000) return `~${Math.ceil(ms / 60_000)} min remaining`;
                  if (ms < 86_400_000) return `~${Math.ceil(ms / 3_600_000)} hr remaining`;
                  return `~${Math.ceil(ms / 86_400_000)} day${Math.ceil(ms / 86_400_000) > 1 ? "s" : ""} remaining`;
                };

                const progress = hasTimerData && totalMs > 0 ? Math.min(100, (elapsed / totalMs) * 100) : 0;

                return (
                  <div className="space-y-2">
                    {/* Progress bar */}
                    {hasTimerData && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-400 font-medium">Current timer progress</span>
                          <span className="text-[10px] font-semibold text-indigo-600">
                            {remaining <= 0 ? "Ready to scan" : fmtRemaining(remaining)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Continue option */}
                    <button
                      type="button"
                      onClick={() => setResetTimer(false)}
                      className={`w-full flex items-start gap-3 px-3.5 py-3 rounded-xl border transition-all text-left cursor-pointer ${
                        !resetTimer
                          ? "bg-emerald-50 border-emerald-300 shadow-sm"
                          : "bg-white/50 border-slate-200 hover:bg-emerald-50/50 hover:border-emerald-200"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                        !resetTimer ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                      }`}>
                        {!resetTimer && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${!resetTimer ? "text-emerald-800" : "text-slate-700"}`}>
                          Continue where it left off
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                          {hasTimerData && remaining > 0
                            ? `The agent has ${fmtRemaining(remaining)} on its current cycle. It will complete that countdown before starting the new interval.`
                            : "The agent will keep its current scan history and continue on schedule."
                          }
                        </p>
                      </div>
                    </button>

                    {/* Reset option */}
                    <button
                      type="button"
                      onClick={() => setResetTimer(true)}
                      className={`w-full flex items-start gap-3 px-3.5 py-3 rounded-xl border transition-all text-left cursor-pointer ${
                        resetTimer
                          ? "bg-amber-50 border-amber-300 shadow-sm"
                          : "bg-white/50 border-slate-200 hover:bg-amber-50/50 hover:border-amber-200"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                        resetTimer ? "border-amber-500 bg-amber-500" : "border-slate-300"
                      }`}>
                        {resetTimer && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${resetTimer ? "text-amber-800" : "text-slate-700"}`}>
                          Reset timer
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                          Clear the timer and start fresh. The agent will scan immediately, then repeat every {config.intervalValue || 1} {config.intervalUnit || "days"}.
                        </p>
                      </div>
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     STEP 4 — REVIEW & DEPLOY
     ═══════════════════════════════════════════════════════════════ */
  function renderStep4() {
    const orgName = config.companyDescription?.split(/[.\n]/)?.[0]?.trim()?.slice(0, 60) || "Your Organization";
    const eligLabels = ELIGIBILITY_TYPE_OPTIONS.filter((o) => config.eligibilityTypes?.includes(o.value)).map((o) => o.label);
    const popLabels = POPULATION_CATEGORIES.filter((p) => config.populationsServed?.includes(p.id)).map((p) => p.label);
    const instrLabels = FUNDING_INSTRUMENTS.filter((fi) => config.fundingInstruments?.includes(fi.id)).map((fi) => fi.label);
    const sourceLabels = FUNDING_SOURCES.filter((fs) => config.fundingSources?.includes(fs.id));
    const scopeLabel = GEO_SCOPE_OPTIONS.find((g) => g.value === config.geoScope)?.label || "—";
    const deadlineLabel = DEADLINE_PRESETS.find((d) => d.value === config.deadlineWindow)?.label || "—";

    // Group service areas by parent group
    const serviceAreasByGroup = SERVICE_AREA_GROUPS
      .map((g) => ({
        label: g.label,
        selected: g.subcategories.filter((s) => config.serviceAreas.includes(s.id)).map((s) => s.label),
      }))
      .filter((g) => g.selected.length > 0);

    function ReviewRow({ icon: Icon, iconBg, iconColor, label, children }: {
      icon: React.ComponentType<{ className?: string }>;
      iconBg: string;
      iconColor: string;
      label: string;
      children: React.ReactNode;
    }) {
      return (
        <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
          <div className={`w-7 h-7 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center shrink-0 mt-0.5`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <div className="text-sm text-slate-800">{children}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-[#faf6ed] to-[#f5f0e8] border border-indigo-100 rounded-2xl p-5 space-y-0">
          {/* Org */}
          <ReviewRow icon={Building2} iconBg="bg-indigo-100" iconColor="text-indigo-600" label="Organization">
            <p className="font-semibold text-slate-900">{orgName}</p>
            {eligLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {eligLabels.map((l) => (
                  <span key={l} className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{l}</span>
                ))}
              </div>
            )}
          </ReviewRow>

          {/* Service Areas */}
          <ReviewRow icon={Layers} iconBg="bg-violet-100" iconColor="text-violet-600" label={`Service Areas (${config.serviceAreas.length})`}>
            {serviceAreasByGroup.length > 0 ? (
              <div className="space-y-1.5">
                {serviceAreasByGroup.map((g) => (
                  <div key={g.label}>
                    <span className="text-[10px] font-bold text-slate-500">{g.label}:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {g.selected.map((s) => (
                        <span key={s} className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 text-xs">None selected</span>
            )}
          </ReviewRow>

          {/* Populations */}
          <ReviewRow icon={Users} iconBg="bg-rose-100" iconColor="text-rose-600" label="Populations Served">
            {popLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {popLabels.map((l) => (
                  <span key={l} className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{l}</span>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 text-xs">All populations</span>
            )}
          </ReviewRow>

          {/* Location */}
          <ReviewRow icon={MapPin} iconBg="bg-sky-100" iconColor="text-sky-600" label="Location">
            <p className="font-semibold">
              {scopeLabel}
              {config.geoScope !== "nationwide" && config.locationState && ` — ${config.locationState}`}
              {config.locationCity && `, ${config.locationCity}`}
            </p>
          </ReviewRow>

          {/* Award Size */}
          <ReviewRow icon={DollarSign} iconBg="bg-emerald-100" iconColor="text-emerald-600" label="Award Size">
            <p className="font-semibold">
              {config.budgetMin || config.budgetMax
                ? `${fmtDollar(config.budgetMin)} — ${fmtDollar(config.budgetMax)}`
                : "Any size"
              }
            </p>
          </ReviewRow>

          {/* Deadline */}
          <ReviewRow icon={Clock} iconBg="bg-amber-100" iconColor="text-amber-600" label="Deadline Window">
            <p className="font-semibold">{deadlineLabel}</p>
          </ReviewRow>

          {/* Funding Instruments */}
          {instrLabels.length > 0 && (
            <ReviewRow icon={Tag} iconBg="bg-sky-100" iconColor="text-sky-600" label="Funding Instruments">
              <div className="flex flex-wrap gap-1.5">
                {instrLabels.map((l) => (
                  <span key={l} className="text-[10px] font-semibold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">{l}</span>
                ))}
              </div>
            </ReviewRow>
          )}

          {/* Data Sources */}
          <ReviewRow icon={Zap} iconBg="bg-emerald-100" iconColor="text-emerald-600" label="Data Sources">
            <div className="flex flex-wrap gap-1.5">
              {sourceLabels.map((fs) => (
                <span key={fs.id} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  fs.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                }`}>
                  {fs.label.split("(")[0].trim()}
                  {!fs.enabled && " (soon)"}
                </span>
              ))}
            </div>
          </ReviewRow>

          {/* Keywords */}
          {(config.welfareKeywords || []).length > 0 && (
            <ReviewRow icon={Search} iconBg="bg-amber-100" iconColor="text-amber-600" label="Custom Keywords">
              <div className="flex flex-wrap gap-1.5">
                {config.welfareKeywords.map((kw) => (
                  <span key={kw} className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{kw}</span>
                ))}
              </div>
            </ReviewRow>
          )}

          {/* Scan Interval */}
          <ReviewRow icon={Timer} iconBg="bg-purple-100" iconColor="text-purple-600" label="Scan Interval">
            <p className="font-semibold">Every {config.intervalValue || 1} {config.intervalUnit}</p>
          </ReviewRow>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#faf8f3] rounded-2xl shadow-2xl w-full max-w-3xl animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Rocket className="w-4 h-4 text-white" />
            </div>
            Configure Grant Agent
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 border-b border-slate-100 shrink-0">
          <StepIndicator current={step} completed={completedSteps} />
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
          <div key={step} className="animate-in fade-in slide-in-from-right-3 duration-300">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
          {/* Left: Cancel or Back */}
          <div>
            {step === 1 ? (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-[#f2ece0] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-[#f2ece0] transition-colors cursor-pointer flex items-center gap-1"
              >
                ← Back
              </button>
            )}
          </div>

          {/* Center: validation */}
          <div className="text-[10px] text-slate-400 font-medium">
            {step === 2 && config.serviceAreas.length === 0 && (
              <span className="text-amber-500 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Select at least one service area to continue
              </span>
            )}
            {step === 2 && config.serviceAreas.length > 0 && (
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {config.serviceAreas.length} areas · {config.populationsServed.length} populations
              </span>
            )}
          </div>

          {/* Right: Next or Deploy */}
          <div>
            {step < totalSteps ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Rocket className="w-3.5 h-3.5" />
                )}
                {saving ? (isEditMode ? "Saving…" : "Deploying…") : (isEditMode ? "Save Changes" : "Deploy Agent")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
