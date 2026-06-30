"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X, Save, Loader2, Rocket, CheckCircle2, MapPin, DollarSign, Calendar, Timer, FileText, Tag, Plus, Trash2 } from "lucide-react";

/* â”€â”€â”€ Updated Config Schema â”€â”€â”€ */
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
  
  // Custom filters for social welfare
  companyDescription: string;
  welfareKeywords: string[];
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
  
  // Start blank â€” user fills in their own org info
  companyDescription: "",
  welfareKeywords: [],
};

export const WELFARE_KEYWORD_OPTIONS = [
  "501(c)(3) grants",
  "CoC grants",
  "HOME-ARP",
  "ESG (Emergency Solutions)",
  "SSBG (Social Services)",
  "SAMHSA",
  "social services",
  "substance abuse",
  "behavioral health",
  "block grants",
  "homeless shelters",
  "food kitchens"
];



/* â”€â”€â”€ US State + City Dataset â”€â”€â”€ */
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

/* â”€â”€â”€ Autocomplete Component â”€â”€â”€ */
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

/* â”€â”€â”€ Modal â”€â”€â”€ */
export function GrantAgentConfigModal({
  onClose,
  initialConfig,
  onSave,
}: {
  onClose: () => void;
  initialConfig?: GrantAgentConfig;
  onSave?: (config: GrantAgentConfig) => void;
}) {
  const [config, setConfig] = useState<GrantAgentConfig>(() => {
    const base = initialConfig ?? DEFAULT_CONFIG;
    return {
      ...DEFAULT_CONFIG,
      ...base,
      grantTypes: base.grantTypes && base.grantTypes.length > 0 ? base.grantTypes : DEFAULT_CONFIG.grantTypes,
      welfareKeywords: base.welfareKeywords ?? [],
    };
  });
  const [customKeywordInput, setCustomKeywordInput] = useState("");
  const [saving, setSaving] = useState(false);

  const cityOptions = useMemo(() => {
    return CITY_DATABASE[config.locationState] || [];
  }, [config.locationState]);

  function toggleWelfareKeyword(keyword: string) {
    setConfig((prev) => {
      const current = prev.welfareKeywords || [];
      const updated = current.includes(keyword)
        ? current.filter((k) => k !== keyword)
        : [...current, keyword];
      return { ...prev, welfareKeywords: updated };
    });
  }

  function removeWelfareKeyword(keyword: string) {
    setConfig((prev) => {
      const current = prev.welfareKeywords || [];
      return { ...prev, welfareKeywords: current.filter((k) => k !== keyword) };
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

  async function handleSave() {
    if (onSave) {
      setSaving(true);
      await new Promise((r) => setTimeout(r, 400));
      // Ensure intervalValue is at least 1 on save
      const finalConfig = {
        ...config,
        intervalValue: Math.max(1, config.intervalValue || 1),
      };
      onSave(finalConfig);
      setSaving(false);
      return;
    }
    onClose();
  }

  const hasKeywords = !!(config.welfareKeywords && config.welfareKeywords.length > 0);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#faf8f3] rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
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

          {/* â•â•â• Section 1: Organization Profile & Mission â•â•â• */}
          <div className="bg-[#faf6ed] border border-slate-100 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Organization Profile & Mission
              </label>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Describe your organization's mission, target demography, and status (e.g. 501(c)(3)). The agent uses this text to analyze and rank matching opportunities.
            </p>
            <textarea
              value={config.companyDescription || ""}
              onChange={(e) => setConfig((prev) => ({ ...prev, companyDescription: e.target.value }))}
              placeholder="e.g. NXT Chapter is a non-profit programming/management company working with Advanced Pathways and their homeless shelters across Denver..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 leading-relaxed resize-none font-medium"
            />
          </div>

          <hr className="border-slate-100" />

          {/* â•â•â• Section 2: Target Social Welfare Programs â•â•â• */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Target Programs & Welfare Keywords
                </label>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Select key programs or funding streams you want to target. Active keywords will be used to generate web search queries.
            </p>

            {/* Keyword Pills Grid */}
            <div className="flex flex-wrap gap-2">
              {WELFARE_KEYWORD_OPTIONS.map((kw) => {
                const kwLower = kw.toLowerCase();
                const active = config.welfareKeywords?.some(k => {
                  const kLower = k.toLowerCase();
                  return kLower === kwLower || kwLower.startsWith(kLower) || kLower.startsWith(kwLower) || kwLower.includes(kLower) || kLower.includes(kwLower);
                });
                return (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => toggleWelfareKeyword(kwLower)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? "bg-violet-100 border-violet-300 text-violet-800 shadow-sm"
                        : "bg-violet-50/60 border-violet-200/80 text-violet-500 hover:bg-violet-50"
                    }`}
                  >
                    {active && <CheckCircle2 className="w-3 h-3 text-violet-600" />}
                    {kw}
                  </button>
                );
              })}

              {/* Display Custom Keywords that aren't in the default options */}
              {config.welfareKeywords?.filter(
                (k) => {
                  const kLower = k.toLowerCase();
                  return !WELFARE_KEYWORD_OPTIONS.some(o => {
                    const oLower = o.toLowerCase();
                    return kLower === oLower || oLower.startsWith(kLower) || kLower.startsWith(oLower) || oLower.includes(kLower) || kLower.includes(oLower);
                  });
                }
              ).map((kw) => (
                <div
                  key={kw}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-violet-100 border border-violet-300 text-violet-800 shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3 h-3 text-violet-600" />
                  {kw}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeWelfareKeyword(kw); }}
                    className="w-4 h-4 rounded-full bg-violet-200 hover:bg-red-200 flex items-center justify-center transition-colors ml-0.5 cursor-pointer"
                    title="Remove keyword"
                  >
                    <X className="w-2.5 h-2.5 text-violet-600 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>

            {/* Custom Tag Creator Input */}
            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                value={customKeywordInput}
                onChange={(e) => setCustomKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomKeyword();
                  }
                }}
                placeholder="Add custom keyword (e.g. food bank)..."
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-[#faf6ed] focus:bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-xs text-slate-800 placeholder:text-slate-400 font-medium"
              />
              <button
                type="button"
                onClick={addCustomKeyword}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />



          {/* â•â•â• Section 2: Location â•â•â• */}
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

          {/* â•â•â• Section 3: Budget Range â•â•â• */}
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
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf6ed] focus:bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf6ed] focus:bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* â•â•â• Section 4: Application Window â•â•â• */}
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
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf6ed] focus:bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 cursor-pointer"
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
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf6ed] focus:bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* â•â•â• Section 5: Agent Scan Interval â•â•â• */}
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={config.intervalValue || ""}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    if (raw === "") {
                      setConfig((p) => ({ ...p, intervalValue: 0 }));
                    } else {
                      const num = parseInt(raw, 10);
                      if (!isNaN(num) && num <= 999) {
                        setConfig((p) => ({ ...p, intervalValue: num }));
                      }
                    }
                  }}
                  className="w-24 pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-[#faf6ed] focus:bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800"
                />
              </div>
              <div className="relative">
                <select
                  value={config.intervalUnit}
                  onChange={(e) => setConfig((p) => ({ ...p, intervalUnit: e.target.value as GrantAgentConfig["intervalUnit"] }))}
                  className="appearance-none pl-4 pr-8 py-2.5 rounded-xl border border-slate-200 bg-[#faf6ed] focus:bg-[#faf8f3] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 cursor-pointer"
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
          <div className="text-[10px] text-slate-400 font-medium">
            {!hasKeywords ? (
              <span className="text-amber-500 font-semibold">âš  Select at least one keyword or grant type</span>
            ) : (
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {(config.welfareKeywords || []).length} keywords + {config.grantTypes.length} types active
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-[#f2ece0] transition-colors cursor-pointer font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasKeywords}
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
