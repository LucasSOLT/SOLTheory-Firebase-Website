"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X, Save, Loader2, Rocket, CheckCircle2, MapPin, DollarSign, Calendar, Timer } from "lucide-react";

/* ─── Updated Config Schema ─── */
export interface GrantAgentConfig {
  grantTypes: string[];
  locationState: string;
  locationCity: string;
  budgetMin: number | null;
  budgetMax: number | null;
  openDate: string;
  closeDate: string;
  intervalValue: number;
  intervalUnit: "minutes" | "hours" | "days" | "weeks";
}

export const DEFAULT_CONFIG: GrantAgentConfig = {
  grantTypes: [],
  locationState: "Colorado",
  locationCity: "Denver",
  budgetMin: null,
  budgetMax: null,
  openDate: "",
  closeDate: "",
  intervalValue: 1,
  intervalUnit: "days",
};

/* ─── Grant Type Options ─── */
const GRANT_TYPE_OPTIONS = [
  { key: "homeless_assistance", label: "Homeless Assistance Grants" },
  { key: "esg", label: "Emergency Solutions Grants (ESG)" },
  { key: "coc", label: "Continuum of Care (CoC) Program Grants" },
  { key: "cdbg", label: "Community Development Block Grants (CDBG)" },
  { key: "home_arp", label: "HOME Investment Partnerships Program (HOME-ARP)" },
  { key: "hhs", label: "Health and Human Services (HHS) Discretionary Grants" },
  { key: "ssbg", label: "Social Services Block Grants (SSBG)" },
  { key: "thr", label: "Transformational Homelessness Response (THR) Colorado Grants" },
  { key: "host", label: "Denver HOST Rapid Resolution Grants" },
  { key: "samhsa", label: "SAMHSA Grants for Benefit of Homeless Individuals (GBHI)" },
  { key: "private_foundation", label: "Private Foundation Program Grants" },
  { key: "capacity_building", label: "Capacity Building and Operating Grants" },
  { key: "capital_improvement", label: "Capital Improvement and Brick-and-Mortar Grants" },
];

/* ─── US State + City Dataset ─── */
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

/* ─── Autocomplete Component ─── */
function LocationAutocomplete({
  label,
  value,
  onChange,
  options,
  placeholder,
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
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setFocused(true); }}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400"
        />
      </div>
      {focused && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[70] bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-[180px] overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setQuery(opt); setFocused(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                opt === value ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
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

/* ─── Modal ─── */
export function GrantAgentConfigModal({
  onClose,
  initialConfig,
  onSave,
}: {
  onClose: () => void;
  initialConfig?: GrantAgentConfig;
  onSave?: (config: GrantAgentConfig) => void;
}) {
  const [config, setConfig] = useState<GrantAgentConfig>(initialConfig ?? DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  const cityOptions = useMemo(() => {
    return CITY_DATABASE[config.locationState] || [];
  }, [config.locationState]);

  function toggleGrantType(key: string) {
    setConfig((prev) => ({
      ...prev,
      grantTypes: prev.grantTypes.includes(key)
        ? prev.grantTypes.filter((k) => k !== key)
        : [...prev.grantTypes, key],
    }));
  }

  function selectAllGrantTypes() {
    setConfig((prev) => ({
      ...prev,
      grantTypes: GRANT_TYPE_OPTIONS.map((o) => o.key),
    }));
  }

  function clearAllGrantTypes() {
    setConfig((prev) => ({ ...prev, grantTypes: [] }));
  }

  async function handleSave() {
    if (onSave) {
      setSaving(true);
      // Small delay for visual feedback
      await new Promise((r) => setTimeout(r, 400));
      onSave(config);
      setSaving(false);
      return;
    }
    onClose();
  }

  const allSelected = config.grantTypes.length === GRANT_TYPE_OPTIONS.length;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 min-h-0">

          {/* ═══ Section 1: Grant Types ═══ */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Grant Type Classifications
              </label>
              <button
                onClick={allSelected ? clearAllGrantTypes : selectAllGrantTypes}
                className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer"
              >
                {allSelected ? "Clear All" : "Select All"}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Select the grant categories this agent should search for.
            </p>
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
              {GRANT_TYPE_OPTIONS.map((opt) => {
                const checked = config.grantTypes.includes(opt.key);
                return (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                      checked
                        ? "bg-indigo-50/60 border-indigo-200 text-slate-800"
                        : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGrantType(opt.key)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer"
                    />
                    <span className="text-[12px] font-medium leading-tight">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* ═══ Section 2: Location ═══ */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Target Location
            </label>
            <div className="grid grid-cols-2 gap-4">
              <LocationAutocomplete
                label="State"
                value={config.locationState}
                onChange={(val) => setConfig((p) => ({ ...p, locationState: val, locationCity: "" }))}
                options={US_STATES}
                placeholder="Search state..."
              />
              <LocationAutocomplete
                label="City / Town"
                value={config.locationCity}
                onChange={(val) => setConfig((p) => ({ ...p, locationCity: val }))}
                options={cityOptions}
                placeholder="Search city..."
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* ═══ Section 3: Budget Range ═══ */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Target Budget Range
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Minimum ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="number"
                    min={0}
                    value={config.budgetMin ?? ""}
                    onChange={(e) => setConfig((p) => ({ ...p, budgetMin: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Maximum ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="number"
                    min={0}
                    value={config.budgetMax ?? ""}
                    onChange={(e) => setConfig((p) => ({ ...p, budgetMax: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="No limit"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* ═══ Section 4: Application Window ═══ */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Application Window
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Open Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={config.openDate}
                    onChange={(e) => setConfig((p) => ({ ...p, openDate: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Close Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={config.closeDate}
                    onChange={(e) => setConfig((p) => ({ ...p, closeDate: e.target.value }))}
                    min={config.openDate || undefined}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* ═══ Section 5: Agent Scan Interval ═══ */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Agent Scan Interval
            </label>
            <p className="text-[11px] text-slate-400 mb-3">
              How frequently should this agent scan for new grant opportunities?
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500 font-medium shrink-0">Every</span>
              <div className="relative">
                <Timer className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={config.intervalValue}
                  onChange={(e) => setConfig((p) => ({ ...p, intervalValue: Math.max(1, Number(e.target.value) || 1) }))}
                  className="w-24 pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="relative">
                <select
                  value={config.intervalUnit}
                  onChange={(e) => setConfig((p) => ({ ...p, intervalUnit: e.target.value as GrantAgentConfig["intervalUnit"] }))}
                  className="appearance-none pl-4 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 cursor-pointer"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-slate-400">
            {config.grantTypes.length === 0 && (
              <span className="text-amber-500 font-semibold">⚠ Select at least one grant type</span>
            )}
            {config.grantTypes.length > 0 && (
              <span>{config.grantTypes.length} grant type{config.grantTypes.length !== 1 ? "s" : ""} selected</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || config.grantTypes.length === 0}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Rocket className="w-3.5 h-3.5" />
              )}
              {saving ? "Deploying..." : "Deploy Agent"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
