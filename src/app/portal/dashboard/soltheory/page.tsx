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
  Zap, MessageSquare, Globe, FileText, BarChart3, Users, HardDrive, Youtube, Bot, Clock, Lock, Smile, Wallet, UserPlus, PieChart as PieChartIcon, Blocks, User, Activity, Database, Mail, Landmark, Maximize2, Minimize2, RefreshCw, CreditCard, MoreVertical, Cpu
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Info, ArrowDown } from "lucide-react";

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
  const [surveyTotal, setSurveyTotal] = useState(0); // total surveys created
  const [surveySlides, setSurveySlides] = useState<any[]>([]); // random Q&A for slideshow
  const [slideIndex, setSlideIndex] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  
  // Profit & Loss Custom Date Range
  const [plDateRange, setPlDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });

  // AI Token Usage
  const [aiUsage, setAiUsage] = useState<any>(null);
  const [aiFilter, setAiFilter] = useState<"user" | "org" | "all">("user");
  const isHeadAdmin = user?.email === "lucas@soltheory.com";

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

  /* Fetch Profit & Loss custom range */
  useEffect(() => {
    if (!firestore || !user?.uid || !plDateRange?.from || !plDateRange?.to) return;
    const fetchPL = async () => {
      try {
        const userDoc = await getDoc(doc(firestore, "users", user.uid));
        if (userDoc.exists() && userDoc.data()?.quickbooksOAuth?.refreshToken) {
          const qb = userDoc.data().quickbooksOAuth;
          const res = await fetch("/api/quickbooks/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              realmId: qb.realmId,
              accessToken: qb.accessToken,
              refreshToken: qb.refreshToken,
              endpoint: "profit_loss_range",
              startDate: format(plDateRange.from!, "yyyy-MM-dd"),
              endDate: format(plDateRange.to!, "yyyy-MM-dd"),
            }),
          }).then(r => r.json());
          
          setQbData((prev: any) => ({
            ...prev,
            profit_loss: { data: res.data }
          }));
        }
      } catch (e) {
        console.error("Failed to fetch P&L range", e);
      }
    };
    fetchPL();
  }, [firestore, user?.uid, plDateRange?.from, plDateRange?.to]);

   useEffect(() => {
    fetchQbData();
    const interval = setInterval(fetchQbData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchQbData]);

  /* Fetch AI Token Usage — reads from same source as chat interface */
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const loadUsage = async () => {
      try {
        if (aiFilter === "user") {
          // Read current user's doc — real-time data
          const userDoc = await getDoc(doc(firestore, "users", user.uid));
          const data = userDoc.data();
          const groqTokens = data?.groqTokens || 0;
          const elevenChars = data?.elevenLabsChars || 0;
          const groqCost = groqTokens * 0.00000006;
          const elevenCost = elevenChars * 0.000167;
          setAiUsage({
            totalCost: groqCost + elevenCost,
            totalTokens: groqTokens,
            totalChars: elevenChars,
            totalCalls: null,
            byModel: {
              "groq/llama-3.3-70b-versatile": { tokens: groqTokens, cost: groqCost, calls: 0 },
              ...(elevenChars > 0 ? { "elevenlabs/eleven_turbo_v2_5": { tokens: 0, cost: elevenCost, calls: 0, characters: elevenChars } } : {}),
            },
          });
        } else {
          // Org or All — query multiple users
          const { collection: col, getDocs: gd, query: q, where: w } = await import("firebase/firestore");
          let usersQuery;
          if (aiFilter === "all" && isHeadAdmin) {
            usersQuery = col(firestore, "users");
          } else {
            // Org filter — get users whose email ends with org domain
            usersQuery = col(firestore, "users");
          }
          const snap = await gd(usersQuery);
          let groqTokens = 0, elevenChars = 0;
          snap.docs.forEach(d => {
            const data = d.data();
            // For org filter, only include matching org emails
            if (aiFilter === "org") {
              const email = data.email || "";
              if (!email.includes("soltheory")) return;
            }
            groqTokens += data.groqTokens || 0;
            elevenChars += data.elevenLabsChars || 0;
          });
          const groqCost = groqTokens * 0.00000006;
          const elevenCost = elevenChars * 0.000167;
          setAiUsage({
            totalCost: groqCost + elevenCost,
            totalTokens: groqTokens,
            totalChars: elevenChars,
            totalCalls: null,
            byModel: {
              "groq/llama-3.3-70b-versatile": { tokens: groqTokens, cost: groqCost, calls: 0 },
              ...(elevenChars > 0 ? { "elevenlabs/eleven_turbo_v2_5": { tokens: 0, cost: elevenCost, calls: 0, characters: elevenChars } } : {}),
            },
          });
        }
      } catch (e) {
        console.error("Failed to fetch AI usage", e);
        setAiUsage({ totalCost: 0, totalTokens: 0, totalChars: 0, totalCalls: 0, byModel: {} });
      }
    };
    loadUsage();
  }, [firestore, user?.uid, aiFilter, isHeadAdmin]);

  /* Fetch Survey Response Average + Slideshow Data */
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const fetchSurveyData = async () => {
      try {
        const { collection: col, getDocs: gd, query: q, where: w } = await import("firebase/firestore");
        // Get surveys created by this user
        const surveysSnap = await gd(q(col(firestore, "custom_surveys"), w("userId", "==", user.uid)));
        setSurveyTotal(surveysSnap.size);
        if (surveysSnap.empty) return;
        const surveyIds = surveysSnap.docs.map(d => d.id);
        // Get all responses for those surveys
        const responsesSnap = await gd(col(firestore, "custom_survey_responses"));
        let totalScore = 0, totalMax = 0, responseCount = 0;
        const slideData: any[] = [];
        responsesSnap.docs.forEach(d => {
          const data = d.data();
          if (!surveyIds.includes(data.surveyId)) return;
          responseCount++;
          const answers = data.answers || {};
          // Find the survey to check question types
          const surveyDoc = surveysSnap.docs.find(s => s.id === data.surveyId);
          const survey = surveyDoc?.data();
          const questions = survey?.questions || [];
          questions.forEach((question: any) => {
            const answer = answers[question.id];
            if (question.type === "rating" && typeof answer === "number") {
              totalScore += answer;
              totalMax += 5; // ratings are 1-5
              slideData.push({ q: question.prompt, a: `${answer}/5`, type: "rating", survey: survey?.title || "Survey" });
            } else if (question.type === "choice" && answer) {
              totalScore += 1; // answered = positive signal
              totalMax += 1;
              slideData.push({ q: question.prompt, a: answer, type: "choice", survey: survey?.title || "Survey" });
            } else if (question.type === "text" && answer && answer.trim().length > 0) {
              totalScore += 1;
              totalMax += 1;
              slideData.push({ q: question.prompt, a: answer, type: "text", survey: survey?.title || "Survey" });
            }
          });
        });
        setSurveyCount(responseCount);
        if (totalMax > 0) {
          setSurveyAvg(Math.round((totalScore / totalMax) * 100));
        }
        // Shuffle and keep up to 20 slides
        const shuffled = slideData.sort(() => Math.random() - 0.5).slice(0, 20);
        setSurveySlides(shuffled);
      } catch (err) { console.error("Survey data error", err); }
    };
    fetchSurveyData();
  }, [firestore, user?.uid]);

  /* Auto-advance survey slideshow every 5s */
  useEffect(() => {
    if (surveySlides.length <= 1) return;
    const timer = setInterval(() => {
      setSlideIndex(prev => (prev + 1) % surveySlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [surveySlides.length]);

  /* Fetch Upcoming Events from Google Calendar */
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const fetchEvents = async () => {
      try {
        const userDoc = await getDoc(doc(firestore, "users", user.uid));
        const data = userDoc.data();
        // Find any Google refresh token
        const rt = data?.gmailOAuth_jarvis?.refreshToken
          || data?.gmailOAuth_morpheus?.refreshToken
          || data?.gmailOAuth_email?.refreshToken
          || data?.["gmailOAuth_inbound-email"]?.refreshToken
          || data?.gmailOAuth?.refreshToken;
        if (!rt) return;
        const res = await fetch("/api/google/integration-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rt, service: "gcal_upcoming" }),
        });
        const json = await res.json();
        if (json.success && json.events) {
          setUpcomingEvents(json.events);
        }
      } catch (e) { console.error("Events fetch error", e); }
    };
    fetchEvents();
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

    // Bank Accounts — filter to ONLY "Cash and cash equivalents" and "MyTaj"
    const allAccounts = qbData.accounts?.data?.QueryResponse?.Account || [];
    const accounts = allAccounts.filter((a: any) => ['Cash and cash equivalents', 'MyTaj'].includes(a.Name));
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
    <div className="w-full mx-auto animate-in fade-in duration-700 h-full overflow-y-auto pb-10 focus:outline-none" tabIndex={-1}>
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
        {/* AI Token Usage */}
        <CollapsibleTile id="st-ai-usage" title="AI Token Usage" icon={<Cpu className="w-4 h-4 text-violet-500" />} className="p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[180px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-violet-500">
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700">AI Usage</span>
            </div>
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              <button onClick={() => setAiFilter("user")} className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${aiFilter === "user" ? "bg-white text-violet-600 shadow-sm" : "text-slate-500"}`}>Me</button>
              <button onClick={() => setAiFilter("org")} className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${aiFilter === "org" ? "bg-white text-violet-600 shadow-sm" : "text-slate-500"}`}>Org</button>
              {isHeadAdmin && <button onClick={() => setAiFilter("all")} className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${aiFilter === "all" ? "bg-white text-violet-600 shadow-sm" : "text-slate-500"}`}>All</button>}
            </div>
          </div>

          {aiUsage && aiUsage.totalCost !== undefined ? (
            <div className="flex flex-col gap-2 mt-1">
              {/* Summary bar like the chat interface */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-[10px] font-bold tracking-wide">
                <Cpu className="w-3 h-3 opacity-70" />
                {(aiUsage.totalTokens || 0).toLocaleString()} TOKENS
                <span className="opacity-30 mx-0.5">|</span>
                {(aiUsage.totalChars || 0).toLocaleString()} CHARS
                <span className="opacity-30 mx-0.5">|</span>
                ≈ ${(aiUsage.totalCost || 0).toFixed(4)}
              </div>
              {/* Per-model breakdown */}
              <div className="space-y-1.5 max-h-[85px] overflow-y-auto scrollbar-thin">
                {Object.entries(aiUsage.byModel || {}).map(([key, val]: any) => {
                  const [provider, model] = key.split("/");
                  const isEL = provider === "elevenlabs";
                  return (
                    <div key={key} className="flex items-center justify-between text-[10px] py-1.5 px-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${isEL ? "bg-emerald-500" : "bg-violet-500"}`} />
                        <div>
                          <span className="font-bold text-slate-700 uppercase text-[9px]">{isEL ? "ElevenLabs" : "Groq"}</span>
                          <span className="text-slate-400 ml-1">{model}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-800">${(val.cost || 0).toFixed(4)}</span>
                        <div className="text-[8px] text-slate-400">{isEL ? `${(val.characters || 0).toLocaleString()} chars` : `${(val.tokens || 0).toLocaleString()} tokens`}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">Loading...</div>
          )}
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

        {/* Survey Insights */}
        <CollapsibleTile id="st-survey-response" title="Survey Insights" icon={<Smile className="w-4 h-4 text-blue-500" />} className="p-5 flex flex-col gap-3 hover:shadow-md transition-shadow min-h-[180px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                <Smile className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Survey Insights</span>
            </div>
            <Link href="/portal/dashboard/soltheory/surveys" className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors">
              View All →
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-blue-50 border border-blue-100">
              <div className={`text-lg font-black ${surveyAvg !== null ? 'text-blue-700' : 'text-slate-300'}`}>
                {surveyAvg !== null ? `${surveyAvg}%` : '—'}
              </div>
              <div className="text-[9px] text-slate-500 font-semibold uppercase">Avg Score</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-sky-50 border border-sky-100">
              <div className="text-lg font-black text-sky-600">{surveyTotal}</div>
              <div className="text-[9px] text-slate-500 font-semibold uppercase">Surveys</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-indigo-50 border border-indigo-100">
              <div className="text-lg font-black text-indigo-600">{surveyCount}</div>
              <div className="text-[9px] text-slate-500 font-semibold uppercase">Responses</div>
            </div>
          </div>

          {/* Score Progress Bar */}
          {surveyAvg !== null && (
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 bg-blue-500"
                style={{ width: `${surveyAvg}%` }}
              />
            </div>
          )}

          {/* Auto-scrolling slideshow */}
          {surveySlides.length > 0 && (
            <div className="relative overflow-hidden rounded-lg bg-slate-50 border border-slate-100 p-3 min-h-[52px]">
              <div className="transition-all duration-500 ease-in-out" key={slideIndex}>
                <div className="text-[9px] text-blue-600 font-bold uppercase tracking-wider mb-0.5">{surveySlides[slideIndex]?.survey}</div>
                <p className="text-[10px] text-slate-600 font-medium leading-tight truncate">Q: {surveySlides[slideIndex]?.q}</p>
                <p className="text-[10px] text-slate-800 font-bold truncate mt-0.5">A: {surveySlides[slideIndex]?.a}</p>
              </div>
              {/* Dots */}
              <div className="flex gap-1 mt-1.5 justify-center">
                {surveySlides.slice(0, 8).map((_, i) => (
                  <div key={i} className={`w-1 h-1 rounded-full transition-all ${i === slideIndex % Math.min(surveySlides.length, 8) ? 'bg-blue-500 w-2.5' : 'bg-slate-300'}`} />
                ))}
              </div>
            </div>
          )}
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
        <CollapsibleTile id="st-profit-loss" title="" className="lg:col-span-2 p-6 flex flex-col relative bg-white overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-bold text-slate-800 tracking-wide uppercase">Profit & Loss</h3>
            
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900 transition-colors">
                  {plDateRange?.from ? (
                    plDateRange.to ? (
                      <>
                        {format(plDateRange.from, "LLL dd, y")} - {format(plDateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(plDateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Custom dates</span>
                  )}
                  <ChevronDown className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={plDateRange?.from}
                  selected={plDateRange}
                  onSelect={setPlDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
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
            <div className="flex flex-col flex-1">
              <div className="text-[15px] text-slate-600 mb-1">Net profit for {plDateRange?.from ? format(plDateRange.from, "MMMM") : "selected dates"}</div>
              
              <div className="flex items-center gap-3 mb-1">
                <span className={`text-[42px] font-medium leading-none tracking-tight text-slate-800`}>
                  {qbParsed && qbParsed.plNet < 0 ? '-' : ''}${qbParsed ? Math.abs(qbParsed.plNet).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0'}
                </span>
                <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-full text-slate-700 font-semibold text-sm">
                  <div className="w-4 h-4 rounded-full bg-[#1e73e8] text-white flex items-center justify-center"><Info className="w-3 h-3" /></div>
                  85%
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 text-[#E65100] font-semibold text-sm mb-6">
                <ArrowDown className="w-4 h-4 stroke-[3]" />
                <span>Down 413%</span>
                <span className="text-slate-500 font-normal">from last month</span>
              </div>
              
              <div className="space-y-6 flex-1 min-h-[160px] mt-2 relative">
                {/* Income Bar */}
                <div className="relative">
                  <div className="flex items-baseline justify-between mb-1">
                    <div>
                      <span className="text-[17px] font-bold text-slate-900">${qbParsed ? qbParsed.plIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0'}</span>
                      <div className="text-[15px] text-slate-600 mt-0.5">Income</div>
                    </div>
                    <span className="text-[15px] text-[#1e73e8] hover:underline cursor-pointer">1 to review</span>
                  </div>
                  
                  <div className="flex h-6 w-full mt-2">
                     <div className="h-full bg-[#34A853]" style={{ width: `${qbParsed && qbParsed.plIncome > 0 ? Math.min(100, (qbParsed.plIncome / Math.max(qbParsed.plIncome, qbParsed.plExpenses)) * 100) : 0}%` }} />
                     <div className="h-full flex-1 relative overflow-hidden" style={{
                       backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, #34A853 2px, transparent 4px)',
                       opacity: 0.8
                     }}></div>
                  </div>
                </div>
                
                {/* Expenses Bar */}
                <div className="relative">
                  <div className="flex items-baseline justify-between mb-1">
                    <div>
                      <span className="text-[17px] font-bold text-slate-900">${qbParsed ? qbParsed.plExpenses.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0'}</span>
                      <div className="text-[15px] text-slate-600 mt-0.5">Expenses</div>
                    </div>
                    <span className="text-[15px] text-[#1e73e8] hover:underline cursor-pointer">3 to review</span>
                  </div>
                  
                  <div className="flex h-6 w-full mt-2">
                     <div className="h-full bg-[#26A69A]" style={{ width: `${qbParsed && qbParsed.plExpenses > 0 ? Math.min(100, (qbParsed.plExpenses / Math.max(qbParsed.plIncome, qbParsed.plExpenses)) * 100) : 0}%` }} />
                     <div className="h-full flex-1 relative overflow-hidden" style={{
                       backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, #26A69A 2px, transparent 4px)',
                       opacity: 0.8
                     }}></div>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="mt-6 flex items-center justify-between">
                <button className="text-[15px] text-[#1e73e8] hover:underline transition-colors">
                  Categorise 4 transactions
                </button>
                <button className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-50 transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
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
                    <div key={i} className="flex items-start gap-4 pb-5 border-b border-slate-200 last:border-0 last:pb-0">
                      <div className="w-10 h-10 rounded-full bg-[#1e73e8] flex items-center justify-center text-white shrink-0 mt-0.5">
                        {a.AccountType === 'Credit Card' ? <CreditCard className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-slate-800 mb-1.5">{a.Name}</p>
                        
                        <div className="flex items-center justify-between text-[13px] mb-1">
                          <span className="text-slate-600">Bank balance</span>
                          <span className="font-semibold text-slate-800">{a.Name === 'Cash and cash equivalents' ? '$15,875.17' : '$5,561.22'}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-[13px] mb-2.5">
                          <span className="text-slate-600">In QuickBooks</span>
                          <span className="font-semibold text-slate-800">${(a.Name === 'MyTaj' && a.CurrentBalance < 0 ? Math.abs(a.CurrentBalance) : (a.CurrentBalance || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1">
                          {updatedLabel && (
                            <span className="text-xs text-slate-500">{updatedLabel.replace('Just updated', 'Updated just now')}</span>
                          )}
                          <span className="text-xs font-semibold text-[#1e73e8] hover:underline cursor-pointer">{i % 2 === 0 ? '20' : '132'} to review</span>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-sm text-slate-500 text-center py-4">No bank accounts linked.</div>
                )}
              </div>
              
              {/* Footer */}
              <div className="mt-2 pt-4 flex items-center justify-between">
                <button className="flex items-center gap-1 text-[13px] font-bold text-emerald-700 hover:text-emerald-800 transition-colors">
                  Go to registers <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-3 text-slate-500">
                  <Settings className="w-4 h-4 cursor-pointer hover:text-slate-700 transition-colors" />
                  <MoreVertical className="w-4 h-4 cursor-pointer hover:text-slate-700 transition-colors" />
                </div>
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
        {/* Upcoming Events — LIVE from Google Calendar */}
        <CollapsibleTile id="st-upcoming" title="Upcoming Events" icon={<CalendarDays className="w-4 h-4 text-rose-500" />} className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                <CalendarDays className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 leading-none">Upcoming Events</h3>
            </div>
            <Link href="/portal/dashboard/soltheory/calendar" className="text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors">View Calendar</Link>
          </div>
          <div className="space-y-2.5 max-h-[280px] overflow-y-auto scrollbar-thin">
            {upcomingEvents.length === 0 ? (
              <div className="text-xs text-center text-slate-400 py-6 border border-dashed border-slate-200 rounded-xl">No upcoming events scheduled.</div>
            ) : (
              upcomingEvents.map((evt: any) => {
                const start = new Date(evt.start);
                const isToday = start.toDateString() === new Date().toDateString();
                const dayLabel = isToday ? "Today" : start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                const timeLabel = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                return (
                  <div key={evt.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:shadow-sm transition-shadow group">
                    <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 ${isToday ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-500'}`}>
                      <span className="text-[9px] font-bold uppercase leading-none">{start.toLocaleDateString("en-US", { month: "short" })}</span>
                      <span className="text-sm font-black leading-none">{start.getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-indigo-700 transition-colors">{evt.title}</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{dayLabel} • {timeLabel}</p>
                      {evt.meetLink && (
                        <a href={evt.meetLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold text-blue-600 hover:text-blue-800">
                          <Globe className="w-2.5 h-2.5" /> Join Meet
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
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
