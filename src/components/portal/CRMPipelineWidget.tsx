"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { useDarkMode } from "@/lib/useDarkMode";
import { useFirestore, useUser } from "@/firebase";

interface CRMContact {
  id: string;
  firstName: string;
  lastName: string;
  leadStatus: string;
  totalRevenue: number;
  outstandingBalance: number;
  createdAt: any;
  transactions?: any[];
}

const STATUS_CONFIG = [
  { key: "Cold Lead", label: "Cold Lead", labelEs: "Frío", color: "#38bdf8", bgLight: "bg-sky-50", bgDark: "bg-sky-950/30", textColor: "text-sky-500" },
  { key: "Warm Lead", label: "Warm Lead", labelEs: "Tibio", color: "#fbbf24", bgLight: "bg-amber-50", bgDark: "bg-amber-950/30", textColor: "text-amber-500" },
  { key: "Interested", label: "Interested", labelEs: "Interesado", color: "#a78bfa", bgLight: "bg-violet-50", bgDark: "bg-violet-950/30", textColor: "text-violet-500" },
  { key: "Sale Completed", label: "Sale Completed", labelEs: "Cerrado", color: "#34d399", bgLight: "bg-emerald-50", bgDark: "bg-emerald-950/30", textColor: "text-emerald-500" },
];

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* Mini SVG Sparkline with month markers */
function Sparkline({ data, months, color, width = 200, height = 36 }: { data: number[]; months: string[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) {
    const y = height / 2;
    return (
      <div className="w-full flex flex-col items-center">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <line x1={0} y1={y} x2={width} y2={y} stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <circle cx={width / 2} cy={y} r={2.5} fill={color} />
        </svg>
        {months.length > 0 && (
          <div className="flex justify-center w-full">
            <span className="text-[9px] font-bold text-slate-400">{months[0]}</span>
          </div>
        )}
      </div>
    );
  }
  
  const max = Math.max(...data, 1);
  const range = max || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 4 - (v / range) * (height - 8);
    return { x, y };
  });
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
  const areaPath = `M${pts[0].x},${pts[0].y} ${pts.slice(1).map(p => `L${p.x},${p.y}`).join(' ')} L${width},${height} L0,${height} Z`;
  const gradId = `spk-${color.replace('#','')}`;

  // Pick label indices: show all when 3 or fewer months, otherwise first/mid/last
  const labelIndices: number[] = months.length <= 3
    ? months.map((_, i) => i)
    : [0, Math.floor(months.length / 2), months.length - 1];

  return (
    <div className="w-full flex flex-col">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r={2.5} fill={color} />
        {/* Tick marks at label positions */}
        {labelIndices.map(i => {
          if (i >= pts.length) return null;
          return <line key={i} x1={pts[i].x} y1={height - 2} x2={pts[i].x} y2={height} stroke="#94a3b8" strokeWidth={0.8} strokeOpacity={0.5} />;
        })}
      </svg>
      {/* Month labels */}
      <div className="flex justify-between w-full" style={{ marginTop: 1 }}>
        {labelIndices.map(i => (
          <span key={i} className="text-[9px] font-bold text-slate-400 leading-none">{months[i] || ""}</span>
        ))}
      </div>
    </div>
  );
}

export function CRMPipelineWidget() {
  const { lang } = useTranslation();
  const isDarkMode = useDarkMode();
  const firestore = useFirestore();
  const { user } = useUser();
  const [customers, setCustomers] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(true);

  // Load CRM customers from Firestore — correct path: users/{uid}/contacts
  useEffect(() => {
    if (!firestore || !user?.uid) { setLoading(false); return; }
    let unsub: (() => void) | undefined;
    import("firebase/firestore").then(({ collection, onSnapshot, query }) => {
      const q = query(collection(firestore, "users", user.uid, "contacts"));
      unsub = onSnapshot(q, (snap) => {
        const list: CRMContact[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            leadStatus: data.leadStatus || "Cold Lead",
            totalRevenue: data.totalRevenue || 0,
            outstandingBalance: data.outstandingBalance || 0,
            createdAt: data.createdAt,
            transactions: data.transactions || [],
          });
        });
        setCustomers(list);
        setLoading(false);
      }, () => setLoading(false));
    });
    return () => { if (unsub) unsub(); };
  }, [firestore, user?.uid]);

  const totalRevenue = useMemo(() => customers.reduce((s, c) => s + c.totalRevenue, 0), [customers]);
  const totalOutstanding = useMemo(() => customers.reduce((s, c) => s + c.outstandingBalance, 0), [customers]);

  const newContactsThisMonth = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return customers.filter(c => {
      if (!c.createdAt) return false;
      const ts = typeof c.createdAt.toMillis === "function" ? c.createdAt.toMillis() : new Date(c.createdAt).getTime();
      return ts >= startOfMonth;
    }).length;
  }, [customers]);

  // Build month-based sparkline data — fixed 3-month window, incremental counts
  const statusData = useMemo(() => {
    const now = new Date();

    // Always show exactly 3 months: (current-2), (current-1), current
    // e.g. in August 2026: Jun, Jul, Aug
    const monthBuckets: { year: number; month: number; label: string; start: number; end: number }[] = [];
    for (let offset = -2; offset <= 0; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      monthBuckets.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: MONTH_LABELS[d.getMonth()],
        start: d.getTime(),
        end: nextMonth.getTime(),
      });
    }

    // Helper: get timestamp from Firestore Timestamp or date string
    const getTs = (createdAt: any): number => {
      if (!createdAt) return 0;
      if (typeof createdAt.toMillis === "function") return createdAt.toMillis();
      const t = new Date(createdAt).getTime();
      return isNaN(t) ? 0 : t;
    };

    return STATUS_CONFIG.map(cfg => {
      const matching = customers.filter(c => c.leadStatus === cfg.key);
      const count = matching.length;

      // Count NEW contacts added in each month bucket (incremental, not cumulative)
      const sparkData = monthBuckets.map(mb => {
        return matching.filter(c => {
          const ts = getTs(c.createdAt);
          if (ts === 0) return false; // skip contacts without dates
          return ts >= mb.start && ts < mb.end;
        }).length;
      });

      return {
        ...cfg,
        count,
        sparkData,
        monthLabels: monthBuckets.map(m => m.label),
      };
    });
  }, [customers]);

  const fmtMoney = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="flex flex-col h-full w-full min-h-0 select-none">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-3">
        <div>
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            {lang === "es" ? "Relaciones con Clientes" : "Customer Relations"}
          </h3>
          <p className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {customers.length} {lang === "es" ? "contactos" : "contacts"} · {lang === "es" ? "métricas en vivo" : "live metrics"}
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 shrink-0 mb-3">
        {/* Revenue */}
        <div className={`p-2 rounded-lg border border-l-2 ${isDarkMode ? 'bg-slate-800/40 border-slate-700/30 border-l-emerald-500' : 'bg-white/50 border-slate-200/60 border-l-emerald-500'}`}>
          <span className={`text-[8px] font-semibold uppercase tracking-widest block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Revenue</span>
          <span className={`text-sm font-extrabold tracking-tight block mt-0.5 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{fmtMoney(totalRevenue)}</span>
        </div>
        {/* Outstanding */}
        <div className={`p-2 rounded-lg border border-l-2 ${isDarkMode ? 'bg-slate-800/40 border-slate-700/30 border-l-amber-500' : 'bg-white/50 border-slate-200/60 border-l-amber-500'}`}>
          <span className={`text-[8px] font-semibold uppercase tracking-widest block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Outstanding</span>
          <span className={`text-sm font-extrabold tracking-tight block mt-0.5 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{fmtMoney(totalOutstanding)}</span>
        </div>
        {/* New Contacts */}
        <div className={`p-2 rounded-lg border border-l-2 ${isDarkMode ? 'bg-slate-800/40 border-slate-700/30 border-l-indigo-500' : 'bg-white/50 border-slate-200/60 border-l-indigo-500'}`}>
          <span className={`text-[8px] font-semibold uppercase tracking-widest block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>New</span>
          <span className={`text-sm font-extrabold tracking-tight block mt-0.5 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{newContactsThisMonth}</span>
        </div>
      </div>

      {/* Pipeline Trends */}
      <div className="flex-1 min-h-0 flex flex-col">
        <span className={`text-[8px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {lang === "es" ? "Pipeline" : "Pipeline"}
        </span>
        <div className="flex-1 min-h-0 flex flex-col gap-1.5">
          {statusData.map((s) => (
            <div
              key={s.key}
              className={`flex items-center gap-3 px-2.5 py-1.5 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-slate-800/30 hover:bg-slate-800/50'
                  : 'bg-slate-50/60 hover:bg-slate-100/60'
              }`}
            >
              {/* Status dot + label + count */}
              <div className="flex items-center gap-2 min-w-0 shrink-0" style={{ width: '28%' }}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className={`text-[10px] font-medium truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {lang === "es" ? s.labelEs : s.label}
                </span>
                <span className={`text-[11px] font-bold ml-auto tabular-nums shrink-0 ${s.textColor}`}>
                  {s.count}
                </span>
              </div>
              {/* Sparkline — fill remaining width */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <Sparkline data={s.sparkData} months={s.monthLabels} color={s.color} width={200} height={36} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
