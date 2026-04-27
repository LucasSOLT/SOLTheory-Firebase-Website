"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { IntegrationColumn } from "@/components/portal/IntegrationPicker";
import { CollapsibleTile } from "@/components/ui/collapsible-tile";
import { DailyDigest } from "@/components/portal/DailyDigest";
import { RecentPlaces } from "@/components/portal/RecentPlaces";
import { RadialGraphs } from "@/components/portal/RadialGraphs";
import { TimeSheets } from "@/components/portal/TimeSheets";
import { useTranslation } from "@/lib/i18n";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import {
  Eye, DollarSign, TrendingDown, ArrowUpRight, Filter, ArrowDownUp,
  Settings, CalendarDays, ChevronDown, Download,
  Zap, MessageSquare, Globe, FileText, BarChart3, Users, HardDrive, Youtube, Bot, Clock, Lock, Smile, Wallet, UserPlus, PieChart as PieChartIcon, Blocks, User, Activity, Database, Mail, Landmark, Maximize2, Minimize2, RefreshCw
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";

/* ───── static mock data to match the reference design ───── */
const salesData: any[] = [];

const subscriberData = [
  { day: "Sun", value: 0 },
  { day: "Mon", value: 0 },
  { day: "Tue", value: 0 },
  { day: "Wed", value: 0 },
  { day: "Thu", value: 0 },
  { day: "Fri", value: 0 },
  { day: "Sat", value: 0 },
];

const distributionData: any[] = [];

const integrations: any[] = [];

/* ───── component ───── */
export default function SolTheoryDashboard() {
  const { t } = useTranslation();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isQuickBooksLinked, setIsQuickBooksLinked] = useState(false);
  const [qbData, setQbData] = useState<any>(null);
  const [isAllCollapsed, setIsAllCollapsed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [surveyAvg, setSurveyAvg] = useState<number | null>(null);
  const [surveyCount, setSurveyCount] = useState(0);

  /* presence tracking (keep existing logic) */
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const userRef = doc(firestore, "users", user.uid);
    updateDoc(userRef, { currentDashboard: "soltheory" }).catch(() => {});
    const handleBeforeUnload = () => updateDoc(userRef, { currentDashboard: null }).catch(() => {});
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      updateDoc(userRef, { currentDashboard: null }).catch(() => {});
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [firestore, user?.uid]);

  /* Fetch QuickBooks Data */
  const fetchQbData = useCallback(async () => {
    if (!firestore || !user?.uid) return;
    try {
      setIsRefreshing(true);
      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      if (userDoc.exists() && userDoc.data()?.quickbooksOAuth?.refreshToken) {
        setIsQuickBooksLinked(true);
        const qb = userDoc.data().quickbooksOAuth;
        const endpoints = ["accounts", "profit_loss", "expenses", "transactions", "invoices", "invoices_all", "aged_receivables_summary"];
        const results = await Promise.all(endpoints.map(ep =>
          fetch("/api/quickbooks/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              realmId: qb.realmId,
              accessToken: qb.accessToken,
              refreshToken: qb.refreshToken,
              endpoint: ep,
            }),
          }).then(r => r.json()).then(d => ({ endpoint: ep, ...d }))
            .catch(() => ({ endpoint: ep, error: true }))
        ));
        const mapped: any = {};
        results.forEach(r => { mapped[r.endpoint] = r; });
        setQbData(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  }, [firestore, user?.uid]);

  useEffect(() => {
    fetchQbData();
    const interval = setInterval(fetchQbData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchQbData]);

  /* Fetch Survey Response Average */
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const fetchSurveyAvg = async () => {
      try {
        const { collection: col, getDocs: gd, query: q, where: w } = await import("firebase/firestore");
        // Get surveys created by this user
        const surveysSnap = await gd(q(col(firestore, "custom_surveys"), w("userId", "==", user.uid)));
        if (surveysSnap.empty) return;
        const surveyIds = surveysSnap.docs.map(d => d.id);
        // Get all responses for those surveys
        const responsesSnap = await gd(col(firestore, "custom_survey_responses"));
        let totalScore = 0, totalMax = 0, responseCount = 0;
        responsesSnap.docs.forEach(d => {
          const data = d.data();
          if (!surveyIds.includes(data.surveyId)) return;
          responseCount++;
          const answers = data.answers || {};
          // Find the survey to check question types
          const surveyDoc = surveysSnap.docs.find(s => s.id === data.surveyId);
          const questions = surveyDoc?.data()?.questions || [];
          questions.forEach((question: any) => {
            const answer = answers[question.id];
            if (question.type === "rating" && typeof answer === "number") {
              totalScore += answer;
              totalMax += 5; // ratings are 1-5
            } else if (question.type === "choice" && answer) {
              totalScore += 1; // answered = positive signal
              totalMax += 1;
            } else if (question.type === "text" && answer && answer.trim().length > 0) {
              totalScore += 1;
              totalMax += 1;
            }
          });
        });
        setSurveyCount(responseCount);
        if (totalMax > 0) {
          setSurveyAvg(Math.round((totalScore / totalMax) * 100));
        }
      } catch (err) { console.error("Survey avg error", err); }
    };
    fetchSurveyAvg();
  }, [firestore, user?.uid]);

  /* ─── Parse QuickBooks data into usable formats ─── */
  const qbParsed = useMemo(() => {
    if (!qbData) return null;

    // Expenses
    const purchases = qbData.expenses?.data?.QueryResponse?.Purchase || [];
    const totalExpenses = purchases.reduce((sum: number, p: any) => sum + (p.TotalAmt || 0), 0);

    // P&L Report
    let plIncome = 0, plExpenses = 0, plNet = 0;
    const plReport = qbData.profit_loss?.data;
    if (plReport?.Rows?.Row) {
      for (const row of plReport.Rows.Row) {
        if (row.group === "Income") {
          plIncome = parseFloat(row.Summary?.ColData?.[1]?.value || "0");
        } else if (row.group === "Expenses") {
          plExpenses = parseFloat(row.Summary?.ColData?.[1]?.value || "0");
        } else if (row.type === "Section" && row.group === "NetIncome") {
          plNet = parseFloat(row.Summary?.ColData?.[1]?.value || "0");
        }
      }
      if (plNet === 0) plNet = plIncome - plExpenses;
    }

    // Bank Accounts — filter to real bank accounts (non-zero balance), sort by balance descending
    const allAccounts = qbData.accounts?.data?.QueryResponse?.Account || [];
    const accounts = allAccounts
      .filter((a: any) => Math.abs(a.CurrentBalance || 0) > 0 || a.AccountType === 'Bank')
      .filter((a: any) => !['Inventory', 'Inventory Asset', 'Goodwill', 'Intangibles', 'Deferred tax assets', 'Prepaid expenses', 'Uncategorized Asset', 'Undeposited Funds', 'Allowance for bad debt', 'Assets held for sale', 'Available for sale assets (short-term)', 'Long-Term Investments'].includes(a.Name))
      .sort((a: any, b: any) => Math.abs(b.CurrentBalance || 0) - Math.abs(a.CurrentBalance || 0));
    const totalBalance = accounts.reduce((sum: number, a: any) => sum + (a.CurrentBalance || 0), 0);

    // Invoices
    const invoices = qbData.invoices?.data?.QueryResponse?.Invoice || [];
    const totalUnpaid = invoices.reduce((sum: number, i: any) => sum + (i.Balance || 0), 0);

    // Transactions
    const transactions = qbData.transactions?.data?.QueryResponse?.Purchase || [];

    // AR Aging - parse the summary report
    const arBuckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days91plus: 0, total: 0 };
    const arReport = qbData.aged_receivables_summary?.data;
    if (arReport?.Rows?.Row) {
      // The last row is typically the total row
      for (const row of arReport.Rows.Row) {
        if (row.type === "Section" && row.Summary?.ColData) {
          // Skip, handled in total
        }
        if (row.Summary?.ColData) {
          const cols = row.Summary.ColData;
          // Columns: Name, Current, 1-30, 31-60, 61-90, 91+, Total
          if (cols.length >= 7) {
            arBuckets.current += parseFloat(cols[1]?.value || "0");
            arBuckets.days1to30 += parseFloat(cols[2]?.value || "0");
            arBuckets.days31to60 += parseFloat(cols[3]?.value || "0");
            arBuckets.days61to90 += parseFloat(cols[4]?.value || "0");
            arBuckets.days91plus += parseFloat(cols[5]?.value || "0");
            arBuckets.total += parseFloat(cols[6]?.value || "0");
          }
        }
      }
    }
    // If total wasn't populated from report, sum the buckets
    if (arBuckets.total === 0) {
      arBuckets.total = arBuckets.current + arBuckets.days1to30 + arBuckets.days31to60 + arBuckets.days61to90 + arBuckets.days91plus;
    }

    // All Invoices (for the Invoices tile with overdue/paid breakdown)
    const allInvoices = qbData.invoices_all?.data?.QueryResponse?.Invoice || [];
    const now = new Date();
    let overdueAmount = 0, notDueYetAmount = 0, paidAmount = 0;
    allInvoices.forEach((inv: any) => {
      if (inv.Balance > 0) {
        const dueDate = inv.DueDate ? new Date(inv.DueDate) : null;
        if (dueDate && dueDate < now) {
          overdueAmount += inv.Balance;
        } else {
          notDueYetAmount += inv.Balance;
        }
      }
      // Paid = TotalAmt - Balance
      const paid = (inv.TotalAmt || 0) - (inv.Balance || 0);
      if (paid > 0) paidAmount += paid;
    });

    return {
      purchases, totalExpenses,
      plIncome, plExpenses, plNet,
      accounts, totalBalance,
      invoices, totalUnpaid,
      transactions,
      arBuckets,
      allInvoices, overdueAmount, notDueYetAmount, paidAmount,
    };
  }, [qbData]);

  return (
    <div className="w-full mx-auto animate-in fade-in duration-700 h-full overflow-y-auto pb-10">
      <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr_220px] gap-5 items-stretch">
        {/* Left Integration Slots */}
        <div className="hidden xl:flex flex-col gap-5 h-full">
          <IntegrationColumn side="left" />
          <div className="flex-1 flex flex-col min-h-0">
            <RecentPlaces />
          </div>
        </div>

        {/* Center Dashboard Content */}
        <div className="space-y-6 min-w-0">

      {/* ─── Dashboard Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => {
              const next = !isAllCollapsed;
              setIsAllCollapsed(next);
              window.dispatchEvent(new CustomEvent('dashboard-toggle-collapse', { detail: { collapsed: next } }));
            }}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            {isAllCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            {isAllCollapsed ? "Maximize All" : "Collapse All"}
          </button>
          <button 
            onClick={fetchQbData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} /> 
            Refresh
          </button>
        </div>
      </div>

      {/* ─── Top 3 Metric Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Page Views */}
        <CollapsibleTile id="st-page-views" title="Page Views" icon={<Eye className="w-4 h-4 text-indigo-500" />} className="p-5 flex flex-col gap-3 hover:shadow-md transition-shadow min-h-[180px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                <Eye className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Page Views</span>
            </div>
            <div className="w-7 h-7 rounded-full border border-slate-100 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-auto">
            <span className="text-3xl font-bold text-slate-800 tracking-tight">0</span>
            <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">0%</span>
          </div>
        </CollapsibleTile>

        {/* Accounts Receivable */}
        <CollapsibleTile id="st-accounts-receivable" title="Accounts Receivable" icon={<DollarSign className="w-4 h-4 text-indigo-500" />} className="p-5 flex flex-col hover:shadow-md transition-shadow min-h-[180px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Accounts Receivable</span>
            </div>
            <span className="text-[10px] font-medium text-slate-400">As of today</span>
          </div>
          {!isQuickBooksLinked ? (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-400">
               <Lock className="w-5 h-5 mb-1 opacity-50" />
               <span className="text-[10px] font-medium text-center leading-tight">Connect QuickBooks</span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="text-[10px] text-emerald-600 font-semibold">Total</div>
              <div className="text-2xl font-bold text-slate-800 mb-2">
                ${qbParsed ? qbParsed.arBuckets.total.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
              </div>
              <div className="flex items-center gap-3 flex-1">
                <div className="w-[70px] h-[70px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Current", value: qbParsed?.arBuckets.current || 0.01 },
                          { name: "1-30", value: qbParsed?.arBuckets.days1to30 || 0 },
                          { name: "31-60", value: qbParsed?.arBuckets.days31to60 || 0 },
                          { name: "61-90", value: qbParsed?.arBuckets.days61to90 || 0 },
                          { name: "91+", value: qbParsed?.arBuckets.days91plus || 0 },
                        ].filter(d => d.value > 0)}
                        cx="50%" cy="50%"
                        innerRadius={20} outerRadius={32}
                        paddingAngle={2} dataKey="value"
                        stroke="none"
                      >
                        {["#22c55e", "#3b82f6", "#a855f7", "#2563eb", "#14b8a6"].map((c, i) => (
                          <Cell key={i} fill={c} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1 text-[9px]">
                  {[
                    { label: "Current", val: qbParsed?.arBuckets.current, color: "#22c55e" },
                    { label: "1 - 30", val: qbParsed?.arBuckets.days1to30, color: "#3b82f6" },
                    { label: "31 - 60", val: qbParsed?.arBuckets.days31to60, color: "#a855f7" },
                    { label: "61 - 90", val: qbParsed?.arBuckets.days61to90, color: "#2563eb" },
                    { label: "91 and over", val: qbParsed?.arBuckets.days91plus, color: "#14b8a6" },
                  ].map(b => (
                    <div key={b.label} className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: b.color }} />
                      <span className="text-slate-500">{b.label}:</span>
                      <span className="font-bold text-slate-700">${(b.val || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CollapsibleTile>

        {/* Survey Response Avg. */}
        <CollapsibleTile id="st-survey-response" title="Survey Response Avg." icon={<Smile className="w-4 h-4 text-indigo-500" />} className="p-5 flex flex-col gap-3 hover:shadow-md transition-shadow min-h-[180px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
                <Smile className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Survey Response Avg.</span>
            </div>
            <div className="w-7 h-7 rounded-full border border-slate-100 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-auto">
            <span className={`text-3xl font-bold tracking-tight ${surveyAvg !== null ? 'text-slate-800' : 'text-slate-300'}`}>
              {surveyAvg !== null ? `${surveyAvg}%` : 'N/A'}
            </span>
            <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
              {surveyCount > 0 ? `${surveyCount} response${surveyCount !== 1 ? 's' : ''}` : 'No responses'}
            </span>
          </div>
        </CollapsibleTile>
      </div>

      {/* ─── Middle Row: Sales Overview + Total Subscribers ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Expenses — 3 cols */}
        <CollapsibleTile id="st-expenses" title="Expenses" icon={<Wallet className="w-4 h-4 text-slate-500" />} className="lg:col-span-3 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Expenses</h3>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                Last 30 days <ChevronDown className="w-3 h-3" />
              </button>
              <button className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                •••
              </button>
            </div>
          </div>
          {!isQuickBooksLinked ? (
             <div className="flex-1 flex flex-col items-center justify-center min-h-[220px] text-center gap-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 mt-4">
               <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                 <Lock className="w-5 h-5 text-slate-400" />
               </div>
               <div>
                 <h4 className="text-sm font-semibold text-slate-700">QuickBooks Not Linked</h4>
                 <p className="text-xs text-slate-500 mt-1">Connect your QuickBooks account to view expenses.</p>
               </div>
             </div>
          ) : (
            <div className="flex flex-col mt-4">
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-3xl font-bold text-slate-800">${qbParsed ? qbParsed.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</span>
              </div>
              <div className="text-xs text-slate-500 font-medium mb-6">
                {qbParsed ? `${qbParsed.purchases.length} expense transaction${qbParsed.purchases.length !== 1 ? 's' : ''} found` : 'Loading...'}
              </div>
    
              <div className="flex-1 space-y-2 max-h-[200px] overflow-y-auto">
                {qbParsed && qbParsed.purchases.length > 0 ? qbParsed.purchases.slice(0, 10).map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{p.EntityRef?.name || p.Line?.[0]?.Description || 'Expense'}</p>
                      <p className="text-[10px] text-slate-400">{new Date(p.TxnDate).toLocaleDateString()}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-800 ml-3">${(p.TotalAmt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )) : (
                  <div className="text-sm text-slate-500 text-center py-4">No expenses recorded.</div>
                )}
              </div>
            </div>
          )}
        </CollapsibleTile>

        {/* Profit & Loss — 2 cols */}
        <CollapsibleTile id="st-profit-loss" title="Profit & Loss" icon={<Activity className="w-4 h-4 text-slate-500" />} className="lg:col-span-2 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Profit & Loss</h3>
            </div>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
              This month <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          {!isQuickBooksLinked ? (
             <div className="flex-1 flex flex-col items-center justify-center min-h-[220px] text-center gap-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 mt-4">
               <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                 <Lock className="w-5 h-5 text-slate-400" />
               </div>
               <div>
                 <p className="text-xs text-slate-500 mt-1">QuickBooks Required</p>
               </div>
             </div>
          ) : (
            <div className="flex flex-col mt-4">
              <div className="text-xs text-slate-500 font-medium mb-1">Net profit for this month</div>
              <div className="flex items-baseline gap-3 mb-1">
                <span className={`text-3xl font-bold ${qbParsed && qbParsed.plNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {qbParsed && qbParsed.plNet < 0 ? '-' : ''}${qbParsed ? Math.abs(qbParsed.plNet).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </span>
              </div>
              
              <div className="space-y-6 flex-1 min-h-[160px] mt-4">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-slate-800">${qbParsed ? qbParsed.plIncome.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'} <span className="font-medium text-slate-500 ml-1">Income</span></span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${qbParsed && qbParsed.plIncome > 0 ? Math.min(100, (qbParsed.plIncome / Math.max(qbParsed.plIncome, qbParsed.plExpenses)) * 100) : 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-slate-800">${qbParsed ? qbParsed.plExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'} <span className="font-medium text-slate-500 ml-1">Expenses</span></span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                     <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${qbParsed && qbParsed.plExpenses > 0 ? Math.min(100, (qbParsed.plExpenses / Math.max(qbParsed.plIncome, qbParsed.plExpenses)) * 100) : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CollapsibleTile>
      </div>

      {/* ─── Bottom Row: Sales Distribution + Bank Accounts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Bank Accounts */}
        <CollapsibleTile id="st-bank-accounts" title="Bank Accounts" icon={<Landmark className="w-4 h-4 text-slate-500" />} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
                <Landmark className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 leading-none uppercase tracking-wide">Bank Accounts</h3>
            </div>
            <span className="text-xs font-medium text-slate-500">As of today</span>
          </div>

          {!isQuickBooksLinked ? (
             <div className="flex-1 flex flex-col items-center justify-center min-h-[160px] text-center gap-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
               <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                 <Lock className="w-4 h-4 text-slate-400" />
               </div>
               <div>
                 <p className="text-xs text-slate-500 mt-1">QuickBooks Required</p>
               </div>
             </div>
          ) : (
            <div className="flex flex-col">
              {/* Total balance header */}
              <div className="mb-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-medium text-emerald-600">Just updated</span>
                  <RefreshCw className="w-2.5 h-2.5 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-slate-800">
                  ${qbParsed ? qbParsed.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </div>
              </div>

              {/* Individual accounts */}
              <div className="mt-4 border-t border-slate-100 pt-4 flex flex-col gap-4 max-h-[300px] overflow-y-auto scrollbar-thin">
                {qbParsed && qbParsed.accounts.length > 0 ? qbParsed.accounts.map((a: any, i: number) => {
                  // Parse last updated time
                  const lastUpdated = a.MetaData?.LastUpdatedTime;
                  let updatedLabel = "";
                  if (lastUpdated) {
                    const diff = Date.now() - new Date(lastUpdated).getTime();
                    const hours = Math.floor(diff / 3600000);
                    const days = Math.floor(hours / 24);
                    if (days > 0) updatedLabel = `Updated ${days} day${days !== 1 ? 's' : ''} ago`;
                    else if (hours > 0) updatedLabel = `Updated ${hours} hour${hours !== 1 ? 's' : ''} ago`;
                    else updatedLabel = "Just updated";
                  }

                  return (
                    <div key={i} className="flex items-start gap-3 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                      <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                        <Landmark className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 mb-1.5">{a.Name}</p>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-slate-500">Bank balance</span>
                          <span className="font-bold text-slate-800">${(a.CurrentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-slate-500">In QuickBooks</span>
                          <span className="font-bold text-slate-800">${(a.CurrentBalanceWithSubAccounts || a.CurrentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        {updatedLabel && (
                          <span className="text-[10px] text-slate-400 font-medium">{updatedLabel}</span>
                        )}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-sm text-slate-500 text-center py-4">No bank accounts linked.</div>
                )}
              </div>
            </div>
          )}
        </CollapsibleTile>

        {/* Time Sheets */}
        <CollapsibleTile id="st-time-sheets" title="Time Sheets" icon={<Clock className="w-4 h-4 text-slate-500" />} className="p-6">
          <TimeSheets />
        </CollapsibleTile>

        {/* Invoices – QuickBooks-style */}
        <CollapsibleTile id="st-invoices" title="Invoices" icon={<FileText className="w-4 h-4 text-slate-500" />} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 leading-none uppercase tracking-wide">Invoices</h3>
            </div>
          </div>

          {!isQuickBooksLinked ? (
             <div className="flex-1 flex flex-col items-center justify-center min-h-[160px] text-center gap-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
               <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                 <Lock className="w-4 h-4 text-slate-400" />
               </div>
               <p className="text-xs text-slate-500 mt-1">QuickBooks Required</p>
             </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Unpaid Section */}
              <div>
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-lg font-bold text-slate-800">
                    ${qbParsed ? qbParsed.totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 0 }) : '0'}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">Unpaid</span>
                  <span className="text-[10px] text-slate-400 ml-auto">Last 365 days</span>
                </div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 font-bold">${qbParsed ? qbParsed.overdueAmount.toLocaleString(undefined, { minimumFractionDigits: 0 }) : '0'}</span>
                  <span className="text-slate-600 font-bold">${qbParsed ? qbParsed.notDueYetAmount.toLocaleString(undefined, { minimumFractionDigits: 0 }) : '0'}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                  <span>Overdue</span>
                  <span>Not due yet</span>
                </div>
                <div className="h-4 w-full flex rounded overflow-hidden">
                  <div className="h-full bg-orange-400 transition-all" style={{ width: `${qbParsed && qbParsed.totalUnpaid > 0 ? (qbParsed.overdueAmount / qbParsed.totalUnpaid) * 100 : 50}%` }} />
                  <div className="h-full bg-slate-200 transition-all flex-1" />
                </div>
              </div>

              {/* Paid Section */}
              <div>
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-lg font-bold text-slate-800">
                    ${qbParsed ? qbParsed.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 0 }) : '0'}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">Paid</span>
                  <span className="text-[10px] text-slate-400 ml-auto">Last 30 days</span>
                </div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 font-bold">${qbParsed ? Math.round(qbParsed.paidAmount * 0.5).toLocaleString() : '0'}</span>
                  <span className="text-slate-600 font-bold">${qbParsed ? Math.round(qbParsed.paidAmount * 0.5).toLocaleString() : '0'}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                  <span>Not deposited</span>
                  <span>Deposited</span>
                </div>
                <div className="h-4 w-full flex rounded overflow-hidden">
                  <div className="h-full bg-green-400 transition-all" style={{ width: '50%' }} />
                  <div className="h-full bg-green-600 transition-all flex-1" />
                </div>
              </div>
            </div>
          )}
        </CollapsibleTile>
        {/* Team Activity (mock) */}
        <CollapsibleTile id="st-team-activity" title="Team Activity" icon={<User className="w-4 h-4 text-slate-500" />} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-500">
                <User className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Team Activity</h3>
            </div>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
              This Week <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-4">
            {[
              { name: user?.displayName || "You", role: "Admin", status: "Online", color: "bg-emerald-500" }
            ].map((m) => (
              <div key={m.name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{(m.name || "U").charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{m.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{m.role}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${m.color}`} />
                  <span className="text-[10px] text-slate-500 font-medium">{m.status}</span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleTile>

        {/* Connected Integrations */}
        <CollapsibleTile id="st-list-int" title="Connected Integrations" icon={<Blocks className="w-4 h-4 text-slate-500" />} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                <Blocks className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Connected Integrations</h3>
            </div>
          </div>

          <div className="space-y-3">
            {/* Google Workspace */}
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:shadow-sm transition-shadow">
              <div className="w-9 h-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">Google Workspace</p>
                <p className="text-[10px] text-slate-400">Calendar, Gmail, Drive, Docs, Sheets</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-600">Connected</span>
              </div>
            </div>

            {/* QuickBooks */}
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:shadow-sm transition-shadow">
              <div className="w-9 h-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#2CA01C"/><path d="M7.5 7v10h2v-3h1.5c2.5 0 4-1.5 4-3.5S13.5 7 11 7H7.5zm2 2h1.5c1.2 0 2 .7 2 1.5S12.2 12 11 12H9.5V9z" fill="white"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">QuickBooks Online</p>
                <p className="text-[10px] text-slate-400">Accounting, Invoices, Expenses, Timesheets</p>
              </div>
              <div className="flex items-center gap-1.5">
                {isQuickBooksLinked ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-600">Connected</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-[10px] font-bold text-slate-400">Not connected</span>
                  </>
                )}
              </div>
            </div>

            {/* YouTube */}
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:shadow-sm transition-shadow">
              <div className="w-9 h-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                <Youtube className="w-4.5 h-4.5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">YouTube</p>
                <p className="text-[10px] text-slate-400">Video management, Analytics</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-600">Connected</span>
              </div>
            </div>
          </div>
        </CollapsibleTile>
        {/* Upcoming Events (mock) */}
        <CollapsibleTile id="st-upcoming" title="Upcoming Events" icon={<CalendarDays className="w-4 h-4 text-slate-500" />} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                <CalendarDays className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Upcoming Events</h3>
            </div>
            <button className="text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors">View Calendar</button>
          </div>
          <div className="space-y-3">
             <div className="text-xs text-center text-slate-400 py-6 border border-dashed border-slate-200 rounded-xl">No upcoming events scheduled.</div>
          </div>
        </CollapsibleTile>

        {/* Active Services */}
        <CollapsibleTile id="st-active-services" title="Active Services" icon={<Activity className="w-4 h-4 text-slate-500" />} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Active Services</h3>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Email Sync", status: "Active", Icon: Mail, color: "text-blue-500", bg: "bg-blue-50" },
              { label: "Drive Indexer", status: "Idle", Icon: HardDrive, color: "text-slate-500", bg: "bg-slate-50" },
              { label: "Cal Sync", status: "Active", Icon: CalendarDays, color: "text-emerald-500", bg: "bg-emerald-50" },
              { label: "Backup", status: "2h ago", Icon: Database, color: "text-amber-500", bg: "bg-amber-50" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg} ${s.color}`}>
                  <s.Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{s.label}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{s.status}</p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleTile>
      </div>
        </div>

        {/* Right Integration Slots */}
        <div className="hidden xl:flex flex-col gap-5 h-full">
          <IntegrationColumn side="right" />
          <div className="flex-1 flex flex-col min-h-0">
            <RadialGraphs />
          </div>
        </div>
      </div>
    </div>
  );
}
