"use client";

import { useState, useEffect, useMemo } from "react";
import { Users, UserPlus, ArrowUpRight, ArrowDownRight } from "lucide-react";
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
function Sparkline({ data, months, color, width = 120, height = 36 }: { data: number[]; months: string[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) {
    const y = height / 2;
    return (
      <div className="shrink-0 flex flex-col items-center">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <line x1={0} y1={y} x2={width} y2={y} stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <circle cx={width / 2} cy={y} r={2.5} fill={color} />
        </svg>
        {months.length > 0 && (
          <div className="flex justify-center w-full" style={{ width }}>
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

  // Pick label indices: first and last always, plus middle if > 3 months
  const labelIndices: number[] = [0];
  if (months.length > 3) labelIndices.push(Math.floor(months.length / 2));
  if (months.length > 1) labelIndices.push(months.length - 1);

  return (
    <div className="shrink-0 flex flex-col">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
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
      {/* Month labels as HTML for legibility */}
      <div className="flex justify-between" style={{ width, marginTop: 1 }}>
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

  // Build month-based sparkline data with month labels
  const statusData = useMemo(() => {
    const now = new Date();
    
    // Find the earliest createdAt across all contacts
    let earliest = now.getTime();
    customers.forEach(c => {
      if (!c.createdAt) return;
      const ts = typeof c.createdAt.toMillis === "function" ? c.createdAt.toMillis() : new Date(c.createdAt).getTime();
      if (ts > 0 && ts < earliest) earliest = ts;
    });

    // Build month buckets from earliest to now
    const startDate = new Date(earliest);
    const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthBuckets: { year: number; month: number; label: string }[] = [];
    const iter = new Date(startMonth);
    while (iter <= endMonth) {
      monthBuckets.push({ 
        year: iter.getFullYear(), 
        month: iter.getMonth(),
        label: MONTH_LABELS[iter.getMonth()]
      });
      iter.setMonth(iter.getMonth() + 1);
    }
    // Ensure at least 2 months for a line
    if (monthBuckets.length < 2) {
      const prev = new Date(startMonth);
      prev.setMonth(prev.getMonth() - 1);
      monthBuckets.unshift({ year: prev.getFullYear(), month: prev.getMonth(), label: MONTH_LABELS[prev.getMonth()] });
    }

    return STATUS_CONFIG.map(cfg => {
      const count = customers.filter(c => c.leadStatus === cfg.key).length;
      
      // Build cumulative count per month
      const monthlyData = monthBuckets.map(mb => {
        return customers.filter(c => {
          if (c.leadStatus !== cfg.key) return false;
          if (!c.createdAt) return true; // include contacts without createdAt in all months
          const ts = typeof c.createdAt.toMillis === "function" ? c.createdAt.toMillis() : new Date(c.createdAt).getTime();
          const contactMonth = new Date(ts);
          // Contact exists in this month if it was created on or before the end of this month
          return (contactMonth.getFullYear() < mb.year) || 
                 (contactMonth.getFullYear() === mb.year && contactMonth.getMonth() <= mb.month);
        }).length;
      });

      return { 
        ...cfg, 
        count, 
        sparkData: monthlyData,
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
      <div className="flex items-center justify-between shrink-0 mb-2.5">
        <div>
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            {lang === "es" ? "Relaciones con Clientes" : "Customer Relations"}
          </h3>
          <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {lang === "es" ? "Contactos y revenue en tiempo real" : "Live contacts & revenue metrics"}
          </p>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border ${
          customers.length > 0
            ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
            : 'text-slate-400 bg-slate-500/10 border-slate-500/10'
        }`}>
          <Users className="w-3 h-3" />
          <span>{customers.length} {lang === "es" ? "contactos" : "contacts"}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 shrink-0 mb-3">
        <div className={`p-2 rounded-xl border ${isDarkMode ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-emerald-50/60 border-emerald-100'} flex flex-col`}>
          <span className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wider block">Revenue</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-sm font-extrabold tracking-tight ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{fmtMoney(totalRevenue)}</span>
            {totalRevenue > 0 && <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
          </div>
        </div>
        <div className={`p-2 rounded-xl border ${isDarkMode ? 'bg-amber-950/20 border-amber-900/30' : 'bg-amber-50/60 border-amber-100'} flex flex-col`}>
          <span className="text-[9px] font-semibold text-amber-600 uppercase tracking-wider block">Outstanding</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-sm font-extrabold tracking-tight ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>{fmtMoney(totalOutstanding)}</span>
            {totalOutstanding > 0 && <ArrowDownRight className="w-3 h-3 text-amber-500" />}
          </div>
        </div>
        <div className={`p-2 rounded-xl border ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/30' : 'bg-indigo-50/60 border-indigo-100'} flex flex-col`}>
          <span className="text-[9px] font-semibold text-indigo-600 uppercase tracking-wider block">New Contacts</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-sm font-extrabold tracking-tight ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>{newContactsThisMonth}</span>
            {newContactsThisMonth > 0 && <UserPlus className="w-3 h-3 text-indigo-500" />}
          </div>
        </div>
      </div>

      {/* Pipeline Sparklines */}
      <div className="flex-1 min-h-0 flex flex-col">
        <span className={`text-[9px] font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
          {lang === "es" ? "Pipeline" : "Pipeline Trends"}
        </span>
        <div className="flex-1 min-h-0 grid grid-rows-4 gap-1.5">
          {statusData.map((s) => (
            <div
              key={s.key}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-colors ${
                isDarkMode
                  ? `${s.bgDark} border-slate-700/40`
                  : `${s.bgLight} border-slate-200/60`
              }`}
            >
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className={`text-[10px] font-semibold truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {lang === "es" ? s.labelEs : s.label}
                </span>
                <span className={`text-[11px] font-extrabold ml-auto tabular-nums ${s.textColor}`}>
                  {s.count}
                </span>
              </div>
              <Sparkline data={s.sparkData} months={s.monthLabels} color={s.color} width={120} height={36} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
