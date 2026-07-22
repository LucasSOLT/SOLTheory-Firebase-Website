"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getAuthHeaders } from "@/lib/api-auth-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot, User, Brain, Trash2, X, ArrowLeft, RefreshCw,
  CheckCircle2, Settings, CheckSquare, Loader2,
  FileText, BookOpen, Plus
} from "lucide-react";
import { useUser, useFirestore } from "@/firebase";
import { solTheoryKnowledge } from "@/lib/soltheory-knowledge";
import { logActivity } from '@/lib/activity-logger';
import { useTranslation } from "@/lib/i18n";

export default function AIKnowledgeBasePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { t } = useTranslation();
  const agentId = "jarvis";

  // Theme
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const check = () => setIsDarkMode(localStorage.getItem('insight_theme') === 'dark');
    check();
    const onStorage = (e: StorageEvent) => { if (e.key === 'insight_theme') setIsDarkMode(e.newValue === 'dark'); };
    window.addEventListener('storage', onStorage);
    const interval = setInterval(check, 500);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(interval); };
  }, []);

  // Agent Config (Soul + Brain)
  const [agentConfig, setAgentConfig] = useState({ soul: "", brain: "", heartbeat: "manual" });

  // Org Brain
  const [orgBrain, setOrgBrain] = useState<string>("");
  const [orgBrainLoaded, setOrgBrainLoaded] = useState(false);
  const [orgBrainSaving, setOrgBrainSaving] = useState(false);
  const orgBrainSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Knowledge Base
  const [pdfUploading, setPdfUploading] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"identity" | "data" | "pact">("data");
  const [ragDocs, setRagDocs] = useState<any[]>([]);
  const [isRAGUploading, setIsRAGUploading] = useState(false);
  const [ragTitle, setRagTitle] = useState("");
  const [ragTextContent, setRagTextContent] = useState("");

  // P.A.C.T.
  type PACTEntry = { id: string; question: string; answer: string; source: string; orgId: string; createdAt: number; updatedAt: number; markedForDeletion?: number; deletionReason?: string };
  const [pactEntries, setPactEntries] = useState<PACTEntry[]>([]);
  const [pactLoaded, setPactLoaded] = useState(false);
  const [pactEnabled, setPactEnabled] = useState(true);

  // Heartbeat
  const [heartbeatInterval, setHeartbeatInterval] = useState<string>("off");
  const [heartbeatRunning, setHeartbeatRunning] = useState(false);
  const [lastHeartbeatRun, setLastHeartbeatRun] = useState<number | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatLockRef = useRef(false);
  const [pactTickNow, setPactTickNow] = useState(Date.now());

  // ── Data Loading ──────────────────────────────────────────────────────
  const fetchRAGDocs = async () => {
    if (!user?.uid || !firestore) return;
    try {
      const { collection, getDocs, query, orderBy } = await import("firebase/firestore");
      const q = query(collection(firestore, "users", user.uid, "agents", `soltheory_${agentId}`, "knowledge_docs"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const docs: any[] = [];
      querySnapshot.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));
      setRagDocs(docs);
    } catch (err) { console.error("Failed to fetch RAG docs", err); }
  };

  const fetchPACTEntries = async () => {
    if (!user?.uid || !firestore) return;
    try {
      const { getDoc, doc } = await import("firebase/firestore");
      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      const entries: PACTEntry[] = [];
      const fieldData = userDoc.data()?.pact_entries_soltheory || [];
      fieldData.forEach((item: any, index: number) => {
        entries.push({
          id: `field-${index}`,
          question: item.question,
          answer: item.answer,
          source: item.source || "server_background",
          orgId: "soltheory",
          createdAt: item.createdAt || Date.now(),
          updatedAt: item.updatedAt || Date.now(),
          markedForDeletion: item.markedForDeletion || undefined,
          deletionReason: item.deletionReason || undefined
        });
      });
      entries.sort((a, b) => b.createdAt - a.createdAt);
      setPactEntries(entries);
      setPactLoaded(true);
    } catch (err) { console.error("Failed to load PACT entries", err); }
  };

  const fetchOrgBrain = async () => {
    if (!firestore) return;
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const snap = await getDoc(doc(firestore, "organizations", "soltheory"));
      if (snap.exists()) {
        setOrgBrain(snap.data()?.orgBrain || "");
      }
      setOrgBrainLoaded(true);
    } catch (err) { console.error("Failed to load org brain", err); setOrgBrainLoaded(true); }
  };

  const saveOrgBrain = async () => {
    if (!firestore) return;
    setOrgBrainSaving(true);
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(firestore, "organizations", "soltheory"), { orgBrain }, { merge: true });
      logActivity(firestore, 'ai_agent_config_changed', { email: user?.email || '', displayName: user?.displayName }, 'Updated org brain for soltheory');
    } catch (err) { console.error("Failed to save org brain", err); }
    finally { setOrgBrainSaving(false); }
  };

  const handleOrgBrainChange = (val: string) => {
    setOrgBrain(val);
    if (orgBrainSaveTimerRef.current) clearTimeout(orgBrainSaveTimerRef.current);
    orgBrainSaveTimerRef.current = setTimeout(() => { saveOrgBrain(); }, 1500);
  };

  // Heartbeat cleanup
  const runHeartbeatCleanup = useCallback(async () => {
    if (heartbeatLockRef.current || !user?.uid || !firestore) return;
    heartbeatLockRef.current = true;
    setHeartbeatRunning(true);
    try {
      const { getDoc, doc, updateDoc } = await import("firebase/firestore");
      const userDocRef = doc(firestore, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      let currentEntries: any[] = userDocSnap.data()?.pact_entries_soltheory || [];
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const beforePurge = currentEntries.length;
      currentEntries = currentEntries.filter((e: any) => {
        if (e.markedForDeletion && (now - e.markedForDeletion) > TWENTY_FOUR_HOURS) return false;
        return true;
      });
      if (currentEntries.length !== beforePurge) {
        await updateDoc(userDocRef, { pact_entries_soltheory: currentEntries });
      }
      const activeEntries = currentEntries.filter((e: any) => !e.markedForDeletion);
      if (activeEntries.length === 0) {
        setLastHeartbeatRun(Date.now());
        setHeartbeatRunning(false);
        heartbeatLockRef.current = false;
        await fetchPACTEntries();
        return;
      }
      const res = await fetch("/api/pact-evaluate", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          entries: activeEntries.map((e: any) => ({ question: e.question, answer: e.answer })),
          userName: user?.displayName || undefined
        })
      });
      const data = await res.json();
      const decisions: any[] = data.decisions || [];
      const discardIndices = new Set<number>();
      const reasonMap = new Map<number, string>();
      decisions.forEach((d: any) => {
        if (!d.keep && typeof d.index === "number") {
          discardIndices.add(d.index);
          reasonMap.set(d.index, d.reason || "Low value");
        }
      });
      if (discardIndices.size > 0) {
        let activeIdx = 0;
        const updated = currentEntries.map((e: any) => {
          if (!e.markedForDeletion) {
            if (discardIndices.has(activeIdx)) {
              const reason = reasonMap.get(activeIdx) || "Low value";
              activeIdx++;
              return { ...e, markedForDeletion: Date.now(), deletionReason: reason };
            }
            activeIdx++;
          }
          return e;
        });
        await updateDoc(userDocRef, { pact_entries_soltheory: updated });
      }
      setLastHeartbeatRun(Date.now());
      await fetchPACTEntries();
    } catch (err) { console.error("[Heartbeat] Cleanup error:", err); }
    finally { setHeartbeatRunning(false); heartbeatLockRef.current = false; }
  }, [user?.uid, firestore, user?.displayName]);

  // ── Effects ───────────────────────────────────────────────────────────
  useEffect(() => { if (firestore) fetchOrgBrain(); }, [firestore]);
  useEffect(() => { if (user?.uid && firestore) { fetchPACTEntries(); fetchRAGDocs(); } }, [user?.uid, firestore]);

  useEffect(() => {
    const saved = localStorage.getItem(`st_heartbeat_interval_${agentId}`);
    if (saved) setHeartbeatInterval(saved);
    const savedPact = localStorage.getItem(`st_pact_enabled_${agentId}`);
    if (savedPact !== null) setPactEnabled(savedPact === 'true');
    const savedLastRun = localStorage.getItem(`st_heartbeat_lastrun_${agentId}`);
    if (savedLastRun) setLastHeartbeatRun(parseInt(savedLastRun));
  }, []);

  useEffect(() => { localStorage.setItem(`st_heartbeat_interval_${agentId}`, heartbeatInterval); }, [heartbeatInterval]);
  useEffect(() => { localStorage.setItem(`st_pact_enabled_${agentId}`, String(pactEnabled)); }, [pactEnabled]);
  useEffect(() => { if (lastHeartbeatRun) localStorage.setItem(`st_heartbeat_lastrun_${agentId}`, String(lastHeartbeatRun)); }, [lastHeartbeatRun]);

  useEffect(() => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    if (heartbeatInterval === "off") return;
    const intervalMs: Record<string, number> = { "5m": 5*60*1000, "10m": 10*60*1000, "15m": 15*60*1000, "30m": 30*60*1000, "1h": 60*60*1000, "2h": 2*60*60*1000, "4h": 4*60*60*1000 };
    const ms = intervalMs[heartbeatInterval];
    if (!ms) return;
    heartbeatTimerRef.current = setInterval(() => { runHeartbeatCleanup(); }, ms);
    return () => { if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current); };
  }, [heartbeatInterval, runHeartbeatCleanup]);

  useEffect(() => {
    const tickInterval = setInterval(() => {
      const now = Date.now();
      setPactTickNow(now);
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const hasExpired = pactEntries.some(e => e.markedForDeletion && (now - e.markedForDeletion) > TWENTY_FOUR_HOURS);
      if (hasExpired && firestore && user?.uid) {
        const remaining = pactEntries.filter(e => !(e.markedForDeletion && (now - e.markedForDeletion) > TWENTY_FOUR_HOURS));
        setPactEntries(remaining);
        import("firebase/firestore").then(({ doc, updateDoc }) => {
          updateDoc(doc(firestore, "users", user.uid), { pact_entries_soltheory: remaining }).catch(console.error);
        });
      }
    }, 60000);
    return () => clearInterval(tickInterval);
  }, [pactEntries, firestore, user?.uid]);

  // ── Render ────────────────────────────────────────────────────────────
  const bg = isDarkMode ? 'bg-slate-950' : 'bg-[#f5f1e8]';
  const cardBg = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-[#fefdfb] border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`w-full h-full overflow-y-auto -mx-4 -mb-4 md:-mx-10 md:-mb-10 ${bg} animate-in fade-in duration-500`} style={{ WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" } as React.CSSProperties}>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/dashboard/soltheory/ai-agents/jarvis">
              <Button variant="ghost" size="icon" className={`rounded-xl ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className={`text-lg font-extrabold tracking-tight ${textPrimary}`}>AI Knowledge Base</h1>
                <p className={`text-xs ${textSecondary}`}>Configure agent identity, knowledge, and memory</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`border rounded-2xl overflow-hidden ${cardBg}`}>
          <div className="flex items-stretch">
            {[
              { key: "identity", label: t.identityAndRules || "Identity & Rules", onClick: () => setActiveSettingsTab("identity") },
              { key: "data", label: t.knowledgeBase || "Knowledge Base", onClick: () => { setActiveSettingsTab("data"); fetchRAGDocs(); } },
              { key: "pact", label: t.pact || "P.A.C.T.", onClick: () => { setActiveSettingsTab("pact"); fetchPACTEntries(); }, badge: pactEntries.length > 0 ? pactEntries.length : null },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={tab.onClick}
                className={`flex-1 py-4 text-xs font-bold tracking-widest uppercase border-b-2 transition-all flex items-center justify-center gap-2 ${
                  activeSettingsTab === tab.key
                    ? (isDarkMode ? 'border-white text-white bg-slate-800' : 'border-slate-900 text-slate-900 bg-slate-50')
                    : (isDarkMode ? 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50')
                }`}
              >
                {activeSettingsTab === tab.key && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                {tab.label}
                {tab.badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ml-1 ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-900 text-white'}`}>{tab.badge}</span>}
              </button>
            ))}
          </div>

          {/* Tab description */}
          <div className={`px-6 py-3 ${isDarkMode ? 'bg-slate-800/50 border-t border-slate-800' : 'bg-[#faf8f3]/50 border-t border-slate-100'}`}>
            <p className={`text-xs text-center ${textSecondary}`}>
              {activeSettingsTab === "identity" && "Define how your AI agents communicate, their personality, and operational rules."}
              {activeSettingsTab === "data" && "Upload files and text for your agents to reference. Organization-wide knowledge is shared across all agents."}
              {activeSettingsTab === "pact" && "Facts your agents have learned about you — automatically extracted from conversations."}
            </p>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">

          {/* ═══ IDENTITY & RULES ═══ */}
          {activeSettingsTab === "identity" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Soul Section */}
              <div className={`border rounded-2xl overflow-hidden ${cardBg}`}>
                <div className={`px-6 py-4 flex items-center justify-between ${isDarkMode ? 'border-b border-slate-700' : 'border-b border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className={`font-semibold text-sm ${textPrimary}`}>{t.soul || "Soul"}</h4>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">{t.voiceAndPersonality || "Voice & Personality"}</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold uppercase tracking-wider">{t.step1 || "Step 1"}</span>
                </div>
                <div className="p-6 pt-4">
                  <p className={`text-xs ${textSecondary} mb-3 leading-relaxed`}>Describe the tone, personality, and communication style the agent should adopt.</p>
                  <textarea
                    className={`w-full h-40 p-4 border rounded-xl resize-none focus:ring-2 outline-none transition-all text-sm leading-relaxed ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 focus:ring-slate-600 placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-slate-300 focus:border-slate-400 placeholder:text-slate-300'}`}
                    placeholder="e.g., You are extremely professional but maintain a warm, welcoming tone. Use clear, concise language."
                    value={agentConfig.soul}
                    onChange={e => setAgentConfig({ ...agentConfig, soul: e.target.value })}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-300 font-mono">{agentConfig.soul?.length || 0} {t.characters || "characters"}</span>
                  </div>
                </div>
              </div>

              {/* Brain Section */}
              <div className={`border rounded-2xl overflow-hidden ${cardBg}`}>
                <div className={`px-6 py-4 flex items-center justify-between ${isDarkMode ? 'border-b border-slate-700' : 'border-b border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
                      <Brain className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className={`font-semibold text-sm ${textPrimary}`}>{t.brain || "Brain"}</h4>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">{t.strictWiringAndRules || "Strict Wiring & Rules"}</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold uppercase tracking-wider">{t.step2 || "Step 2"}</span>
                </div>
                <div className="p-6 pt-4">
                  <p className={`text-xs ${textSecondary} mb-3 leading-relaxed`}>Define strict operational directives, hard constraints, and non-negotiable rules.</p>
                  <textarea
                    className={`w-full h-40 p-4 border rounded-xl resize-none focus:ring-2 outline-none transition-all text-sm leading-relaxed ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 focus:ring-slate-600 placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-slate-300 focus:border-slate-400 placeholder:text-slate-300'}`}
                    placeholder="e.g., Never disclose PII. Do not share API keys. Always verify user identity before sensitive actions."
                    value={agentConfig.brain}
                    onChange={e => setAgentConfig({ ...agentConfig, brain: e.target.value })}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-300 font-mono">{agentConfig.brain?.length || 0} {t.characters || "characters"}</span>
                  </div>
                </div>
              </div>

              {/* Heartbeat Section */}
              <div className={`border rounded-2xl overflow-hidden ${cardBg}`}>
                <div className={`px-6 py-4 flex items-center justify-between ${isDarkMode ? 'border-b border-slate-700' : 'border-b border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center relative">
                      <Bot className="w-4 h-4 text-white" />
                      {heartbeatInterval !== "off" && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />}
                    </div>
                    <div>
                      <h4 className={`font-semibold text-sm ${textPrimary}`}>{t.heartbeat || "Heartbeat"}</h4>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">{t.autonomousMemoryCleanup || "Autonomous Memory Cleanup"}</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold uppercase tracking-wider">{t.step3 || "Step 3"}</span>
                </div>
                <div className="p-6 pt-4 space-y-4">
                  <p className={`text-xs ${textSecondary} leading-relaxed`}>Periodically evaluates P.A.C.T. entries and soft-deletes low-value facts. Marked entries auto-purge after 24 hours unless you cancel.</p>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-2 block">Cleanup Interval</label>
                    <div className={`flex items-center rounded-xl p-1 gap-0 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                      {[
                        { value: "off", label: "Off" }, { value: "5m", label: "5m" }, { value: "10m", label: "10m" },
                        { value: "15m", label: "15m" }, { value: "30m", label: "30m" }, { value: "1h", label: "1h" },
                        { value: "2h", label: "2h" }, { value: "4h", label: "4h" },
                      ].map((opt) => (
                        <button key={opt.value} onClick={() => setHeartbeatInterval(opt.value)}
                          className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${heartbeatInterval === opt.value ? (isDarkMode ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-900 text-white shadow-sm') : (isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${heartbeatInterval === "off" ? (isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500') : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
                        <div className={`w-2 h-2 rounded-full ${heartbeatInterval === "off" ? "bg-slate-400" : "bg-blue-500 animate-pulse"}`} />
                        {heartbeatInterval === "off" ? "Inactive" : "Active"}
                      </div>
                      {lastHeartbeatRun && <span className="text-[10px] text-slate-400">Last run: {new Date(lastHeartbeatRun).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
                    </div>
                    <Button variant="ghost" size="sm" disabled={heartbeatRunning || !user?.uid} onClick={() => runHeartbeatCleanup()} className="text-xs font-bold text-slate-600 hover:text-slate-900 gap-1.5 h-8">
                      {heartbeatRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      {heartbeatRunning ? "Running..." : "Run Now"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ KNOWLEDGE BASE ═══ */}
          {activeSettingsTab === "data" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Upload Section */}
              <div className={`border rounded-2xl overflow-hidden ${cardBg}`}>
                <div className={`p-5 ${isDarkMode ? 'border-b border-slate-700' : 'border-b border-slate-100'} flex items-center gap-3`}>
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center"><Brain className="w-4 h-4 text-white" /></div>
                  <div>
                    <h3 className={`text-sm font-extrabold ${textPrimary}`}>Add Knowledge</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Upload PDF or enter text</p>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  {/* PDF Upload */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-2 block">Upload PDF File</label>
                    <label className={`flex items-center justify-center gap-3 h-20 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${pdfUploading ? (isDarkMode ? 'border-slate-600 bg-slate-800' : 'border-slate-300 bg-slate-50') : (isDarkMode ? 'border-slate-700 hover:border-slate-500 hover:bg-slate-800' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50')}`}>
                      {pdfUploading ? (<><Loader2 className="w-5 h-5 animate-spin text-slate-400" /><span className={`text-sm font-medium ${textSecondary}`}>Processing PDF...</span></>) : (<><FileText className="w-5 h-5 text-slate-400" /><span className={`text-sm ${textSecondary}`}>Click to upload a PDF</span></>)}
                      <input type="file" accept=".pdf" className="hidden" disabled={pdfUploading} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !user?.uid || !firestore) return;
                        e.target.value = "";
                        setPdfUploading(true);
                        try {
                          const arrayBuffer = await file.arrayBuffer();
                          const pdfjsLib = await import('pdfjs-dist');
                          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
                          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                          let fullText = '';
                          for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const content = await page.getTextContent();
                            const pageText = content.items.map((item: any) => item.str).join(' ');
                            fullText += pageText + '\n\n';
                          }
                          fullText = fullText.trim();
                          if (!fullText) { alert('Could not extract text from this PDF.'); return; }
                          const { collection, doc: fsDoc, setDoc } = await import("firebase/firestore");
                          const docRef = fsDoc(collection(firestore, "users", user.uid, "agents", `soltheory_${agentId}`, "knowledge_docs"));
                          await setDoc(docRef, { title: file.name.replace('.pdf', ''), type: 'pdf', size: fullText.length, content: fullText, fileUrl: '', createdAt: new Date().toISOString() });
                          logActivity(firestore, 'file_uploaded', { email: user?.email || '', displayName: user?.displayName }, `Uploaded PDF: ${file.name}`);
                          fetchRAGDocs();
                        } catch (err) { console.error('PDF upload error:', err); alert('Failed to process PDF.'); }
                        finally { setPdfUploading(false); }
                      }} />
                    </label>
                    <p className="text-[10px] text-slate-400 mt-1.5 pl-1">PDF text is extracted and stored as searchable knowledge.</p>
                  </div>
                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">or enter text</span>
                    <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                  </div>
                  {/* Text Entry */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Document Title</label>
                    <input type="text" className={`w-full mt-1 border rounded-xl px-4 py-3 text-sm focus:ring-1 outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 focus:ring-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-slate-400'}`} value={ragTitle} onChange={e => setRagTitle(e.target.value)} placeholder="e.g. Company FAQ, SOPs, Product Info" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1">Text Content</label>
                    <textarea className={`w-full mt-1 border rounded-xl p-4 text-sm focus:ring-1 outline-none resize-none h-48 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 focus:ring-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-slate-400'}`} value={ragTextContent} onChange={e => setRagTextContent(e.target.value)} placeholder="Paste any factual data, policies, or knowledge here..." />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={async () => {
                      if (!ragTitle || !ragTextContent || !user?.uid || !firestore) return;
                      setIsRAGUploading(true);
                      try {
                        const { collection, doc: fsDoc, setDoc } = await import("firebase/firestore");
                        const docRef = fsDoc(collection(firestore, "users", user.uid, "agents", `soltheory_${agentId}`, "knowledge_docs"));
                        await setDoc(docRef, { title: ragTitle, type: 'text', size: ragTextContent.length, content: ragTextContent, fileUrl: '', createdAt: new Date().toISOString() });
                        logActivity(firestore, 'file_uploaded', { email: user?.email || '', displayName: user?.displayName }, `Uploaded knowledge doc: ${ragTitle}`);
                        setRagTitle(''); setRagTextContent(''); fetchRAGDocs();
                      } catch (err) { alert('Failed to save text.'); console.error(err); }
                      finally { setIsRAGUploading(false); }
                    }} disabled={isRAGUploading || !ragTitle || !ragTextContent} className={`gap-2 border-0 shadow-lg px-6 ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
                      {isRAGUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save Entry
                    </Button>
                  </div>
                </div>
              </div>

              {/* Active Data Sources */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className={`font-bold ${textPrimary}`}>Active Data Sources</h4>
                  {(isRAGUploading || pdfUploading) && <div className="text-xs font-bold text-slate-500 animate-pulse flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</div>}
                </div>
                {ragDocs.length === 0 ? (
                  <div className={`h-24 rounded-2xl border border-dashed flex items-center justify-center text-sm ${isDarkMode ? 'border-slate-700 text-slate-500 bg-slate-900' : 'border-slate-200 text-slate-500 bg-[#fefdfb]'}`}>
                    Knowledge base is currently empty. Upload a PDF or add text above.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ragDocs.map((ragDoc, i) => (
                      <div key={i} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${isDarkMode ? 'border-slate-700 bg-slate-900 hover:border-slate-600' : 'border-slate-200 bg-[#fefdfb] hover:border-slate-300'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${ragDoc.type === 'pdf' ? 'bg-red-50 text-red-500' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')}`}>
                            {ragDoc.type === 'pdf' ? <FileText className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className={`font-bold text-sm ${textPrimary}`}>{ragDoc.title}</div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mt-0.5">{(ragDoc.size / 1024).toFixed(1)} KB • {ragDoc.type === 'pdf' ? 'PDF' : 'Text'} • Synced</div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-400" onClick={async () => {
                          if (confirm('Delete this knowledge entry?')) {
                            try {
                              const { doc: firestoreDoc, deleteDoc, collection, getDocs, query, where } = await import("firebase/firestore");
                              await deleteDoc(firestoreDoc(firestore!, "users", user!.uid, "agents", `soltheory_${agentId}`, "knowledge_docs", ragDoc.id));
                              try {
                                const chunksRef = collection(firestore!, "users", user!.uid, "agents", `soltheory_${agentId}`, "knowledge_chunks");
                                const chunksSnap = await getDocs(query(chunksRef, where("docId", "==", ragDoc.id)));
                                for (const chunkDoc of chunksSnap.docs) { await deleteDoc(chunkDoc.ref); }
                              } catch { }
                              fetchRAGDocs();
                              logActivity(firestore!, 'file_deleted', { email: user?.email || '', displayName: user?.displayName }, `Deleted knowledge doc: ${ragDoc.title}`);
                            } catch (err) { alert('Failed to delete.'); }
                          }
                        }}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Org Brain */}
              <div className={`border rounded-2xl overflow-hidden ${cardBg}`}>
                <div className={`p-4 ${isDarkMode ? 'border-b border-slate-700' : 'border-b border-slate-100'} flex items-center justify-between`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center"><Brain className="w-3 h-3 text-white" /></div>
                    <span className={`text-xs font-bold uppercase tracking-widest ${textPrimary}`}>Organization Brain</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {orgBrainSaving && <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium"><Loader2 className="w-3 h-3 animate-spin" />Saving...</div>}
                    <span className="text-[10px] text-slate-400 font-mono">{orgBrain.length.toLocaleString()} chars</span>
                  </div>
                </div>
                <div className="p-4">
                  <textarea
                    value={orgBrain}
                    onChange={(e) => handleOrgBrainChange(e.target.value)}
                    placeholder="Add shared organizational knowledge here. This is accessible to all agents and auto-saves as you type..."
                    className={`w-full min-h-[200px] p-4 text-sm font-sans leading-relaxed border rounded-xl focus:outline-none focus:ring-2 resize-y ${isDarkMode ? 'text-slate-200 border-slate-600 bg-slate-800 focus:ring-slate-500 focus:border-slate-500' : 'text-slate-700 border-slate-200 bg-slate-50 focus:ring-slate-300 focus:border-slate-400'}`}
                  />
                  <p className="text-[10px] text-slate-400 mt-2 pl-1">Auto-saves as you type. All agents share this knowledge.</p>
                </div>
              </div>

              {/* Default Knowledge */}
              <div className={`border rounded-2xl overflow-hidden ${cardBg}`}>
                <div className={`p-4 ${isDarkMode ? 'border-b border-slate-700' : 'border-b border-slate-100'} flex items-center justify-between`}>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Default Knowledge (Built-in)</span>
                  <span className="text-[10px] text-slate-400 font-mono">{solTheoryKnowledge.length.toLocaleString()} chars</span>
                </div>
                <div className="p-6 max-h-[200px] overflow-y-auto scrollbar-thin">
                  <pre className={`text-sm whitespace-pre-wrap font-sans leading-relaxed ${textSecondary}`}>{solTheoryKnowledge}</pre>
                </div>
              </div>
            </div>
          )}

          {/* ═══ P.A.C.T. ═══ */}
          {activeSettingsTab === "pact" && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className={`border rounded-2xl p-6 ${cardBg}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-base font-extrabold ${textPrimary} mb-1.5 flex items-center gap-2.5`}>
                      <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center"><BookOpen className="w-4 h-4 text-white" /></div>
                      P.A.C.T. Memory
                    </h3>
                    <p className={`text-xs ${textSecondary} leading-relaxed max-w-2xl`}>Facts your AI has learned about you. The Heartbeat periodically reviews and cleans up low-value entries.</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-6">
                    {heartbeatRunning && <div className="flex items-center gap-1.5 text-[10px] text-blue-500 font-bold"><Loader2 className="w-3 h-3 animate-spin" />Cleaning...</div>}
                    <button onClick={() => setPactEnabled(!pactEnabled)} className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${pactEnabled ? 'bg-blue-50 border-blue-200 text-blue-600' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-400')}`}>
                      <div className={`w-2 h-2 rounded-full ${pactEnabled ? 'bg-blue-500' : 'bg-slate-400'}`} />
                      {pactEnabled ? 'Active' : 'Disabled'}
                    </button>
                    {pactEntries.filter(e => e.markedForDeletion).length > 0 && (
                      <div className={`border rounded-xl px-4 py-2 text-center ${isDarkMode ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50'}`}>
                        <div className="text-xl font-black text-red-500 tabular-nums">{pactEntries.filter(e => e.markedForDeletion).length}</div>
                        <div className="text-[9px] text-red-400 uppercase tracking-wider font-bold">Expiring</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {pactEntries.length === 0 ? (
                <div className={`h-48 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center gap-3 p-8 ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-[#fefdfb]'}`}>
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <BookOpen className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className={`text-sm font-medium max-w-sm ${textSecondary}`}>No learned facts yet. As you chat with your AI, personal details you share will appear here.</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Try sharing your name, role, or preferences</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {[...pactEntries].sort((a, b) => {
                    if (a.markedForDeletion && !b.markedForDeletion) return 1;
                    if (!a.markedForDeletion && b.markedForDeletion) return -1;
                    return 0;
                  }).map((entry, idx) => {
                    const isMarked = !!entry.markedForDeletion;
                    const msLeft = isMarked ? Math.max(0, 24 * 60 * 60 * 1000 - (pactTickNow - entry.markedForDeletion!)) : 0;
                    const hoursLeft = Math.ceil(msLeft / (60 * 60 * 1000));
                    return (
                      <div key={entry.id} className={`border rounded-xl px-5 py-4 transition-all group ${
                        isMarked ? (isDarkMode ? 'border-red-800 bg-red-900/20' : 'border-red-200 bg-red-50/30')
                        : isDarkMode ? 'border-slate-700 bg-slate-900 hover:bg-slate-800/50 hover:border-slate-600' : 'border-slate-200 bg-[#fefdfb] hover:bg-slate-50/50 hover:border-slate-300'
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-[10px] font-black w-5 h-5 rounded flex items-center justify-center shrink-0 ${isMarked ? 'bg-red-500 text-white' : 'bg-slate-900 text-white'}`}>{idx + 1}</span>
                              <span className={`text-sm font-semibold leading-tight ${isMarked ? 'line-through text-slate-400' : textPrimary}`}>{entry.question}</span>
                            </div>
                            <p className={`text-sm pl-7 leading-relaxed ${isMarked ? 'line-through text-slate-400' : isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{entry.answer}</p>
                            <div className="flex items-center gap-2 mt-2 pl-7 flex-wrap">
                              <span className="text-[10px] text-slate-400 font-medium">{entry.source === "voice" ? "Voice" : "Text"}</span>
                              <span className="text-[10px] text-slate-300">·</span>
                              <span className="text-[10px] text-slate-400 font-medium">{new Date(entry.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              {isMarked && (
                                <>
                                  <span className="text-[10px] text-slate-300">·</span>
                                  <span className="text-[9px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">{entry.deletionReason || "Flagged"}</span>
                                  <span className="text-[10px] text-red-400 font-medium">Auto-deletes in {hoursLeft}h</span>
                                </>
                              )}
                            </div>
                          </div>
                          {isMarked ? (
                            <Button variant="ghost" size="icon" className="text-red-400 hover:text-slate-900 hover:bg-slate-100 transition-all shrink-0 rounded-lg h-8 w-8" title="Cancel deletion" onClick={async () => {
                              if (!user?.uid || !firestore) return;
                              try {
                                const { getDoc, doc, updateDoc } = await import("firebase/firestore");
                                const userDocRef = doc(firestore, "users", user.uid);
                                const userDocSnap = await getDoc(userDocRef);
                                const currentEntries: any[] = userDocSnap.data()?.pact_entries_soltheory || [];
                                const updated = currentEntries.map((e: any) => (e.question === entry.question && e.answer === entry.answer) ? { ...e, markedForDeletion: undefined, deletionReason: undefined } : e);
                                const cleaned = updated.map((e: any) => { const { markedForDeletion, deletionReason, ...rest } = e; if (markedForDeletion) return e; return rest; });
                                await updateDoc(userDocRef, { pact_entries_soltheory: cleaned });
                                setPactEntries(prev => prev.map(e => e.id === entry.id ? { ...e, markedForDeletion: undefined, deletionReason: undefined } : e));
                              } catch (err) { console.error("Failed to restore PACT entry", err); }
                            }}>
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0 rounded-lg h-8 w-8" onClick={async () => {
                              if (!user?.uid || !firestore) return;
                              try {
                                const { getDoc, doc, updateDoc } = await import("firebase/firestore");
                                const userDocRef = doc(firestore, "users", user.uid);
                                const userDocSnap = await getDoc(userDocRef);
                                const currentEntries: any[] = userDocSnap.data()?.pact_entries_soltheory || [];
                                const filtered = currentEntries.filter((e: any) => !(e.question === entry.question && e.answer === entry.answer));
                                await updateDoc(userDocRef, { pact_entries_soltheory: filtered });
                                logActivity(firestore, 'item_deleted', { email: user?.email || '', displayName: user?.displayName }, `Deleted PACT entry: ${entry.question}`);
                                setPactEntries(prev => prev.filter(e => e.id !== entry.id));
                              } catch (err) { console.error("Failed to delete PACT entry", err); }
                            }}><Trash2 className="w-3.5 h-3.5" /></Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
