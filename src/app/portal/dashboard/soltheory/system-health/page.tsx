"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useUser } from "@/firebase";
import { getAuthHeaders } from "@/lib/api-auth-client";
import {
  Activity,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Zap,
  BarChart3,
  Database,
  Terminal,
  XCircle,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  Key,
  Wifi,
  WifiOff,
  Users,
  Search,
  MoreVertical,
  ChevronDown
} from "lucide-react";

import {
  ROLE_COLORS,
  ROLE_LABELS,
  ALL_ROLES,
  isDeveloper,
  ORG_LABELS,
  ALL_ORGS,
  DEVELOPER_COLORS,
} from "@/lib/rbac";

/* ═══════════════════════════════════════════════════════════════
 * TYPES — Mirror the SAFE types from the backend.
 * No key names, no masked values, no env var identifiers.
 * ═══════════════════════════════════════════════════════════════ */

interface EnvKeyCheck {
  category: string;
  label: string;
  status: "configured" | "missing";
  requiredFor: string[];
}

interface AgentHealthStatus {
  id: string;
  name: string;
  category: string;
  status: "healthy" | "degraded" | "error";
  endpoint: string;
  latencyMs: number;
  lastChecked: string;
  message: string;
  missingCredentialCount: number;
  totalCredentialCount: number;
}

interface SystemHealthReport {
  overallStatus: "healthy" | "degraded" | "critical";
  healthyAgentsCount: number;
  totalAgentsCount: number;
  envCheck: EnvKeyCheck[];
  agents: AgentHealthStatus[];
  databaseStatus: { ok: boolean; latencyMs: number };
  tokenSummary: {
    totalTokens: number;
    totalCostUsd: number;
    totalCalls: number;
    byModel: Record<string, { tokens: number; cost: number; calls: number }>;
  };
  lastCheckTimestamp: string;
}

interface DiagnosticLog {
  id?: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  status: "healthy" | "degraded" | "error" | "warning";
  endpoint?: string;
  latencyMs?: number;
  message: string;
}

/* ═══════════════════════════════════════════════════════════════
 * CONSTANTS
 * ═══════════════════════════════════════════════════════════════ */

export default function SystemHealthPage() {
  const { isDarkMode } = useTheme();
  const { user, isUserLoading } = useUser();

  // Auth & access gates
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  // Data state
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [activeTab, setActiveTab] = useState<"agents" | "credentials" | "tokens" | "logs" | "users">("agents");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Users tab state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // Check if user is the developer
  const isDev = isDeveloper(user?.email);

  const fetchHealthData = useCallback(async (password: string, isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg(null);
    try {
      const baseHeaders = await getAuthHeaders();
      const res = await fetch("/api/admin/system-health", {
        method: "GET",
        headers: {
          ...baseHeaders,
          "x-system-health-password": password,
        },
      });

      const data = await res.json();

      if (data.requiresPassword) {
        setIsAuthorized(false);
        setPasswordError("Invalid password");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (data.success) {
        setIsAuthorized(true);
        setReport(data.report);
        setLogs(data.logs || []);
      } else {
        throw new Error(data.error || "Failed to fetch health report");
      }
    } catch (err: any) {
      console.error("[SystemHealthPage] Error:", err);
      setErrorMsg(err.message || "Failed to connect to diagnostic service.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && isAuthorized && passwordInput) {
      interval = setInterval(() => {
        fetchHealthData(passwordInput);
      }, 15000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, isAuthorized, passwordInput, fetchHealthData]);

  const fetchUsers = useCallback(async () => {
    if (!passwordInput) return;
    setUsersLoading(true);
    try {
      const baseHeaders = await getAuthHeaders();
      const res = await fetch("/api/admin/users", {
        headers: baseHeaders,
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsersList(data.users || []);
    } catch (err: any) {
      console.error("[SystemHealthPage] Fetch users error:", err);
    } finally {
      setUsersLoading(false);
    }
  }, [passwordInput]);

  useEffect(() => {
    if (activeTab === "users" && usersList.length === 0) {
      fetchUsers();
    }
  }, [activeTab, fetchUsers, usersList.length]);

  const handleUpdateUserRole = async (uid: string, org: string, newRole: string) => {
    try {
      const baseHeaders = await getAuthHeaders();
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { ...baseHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ uid, updates: { orgRoles: { [org]: newRole } } }),
      });
      if (res.ok) fetchUsers();
    } catch (err: any) {
      console.error("Update role error:", err);
    }
  };

  const handleToggleOrgAccess = async (uid: string, allowedOrgs: string[], orgToToggle: string) => {
    try {
      const newOrgs = allowedOrgs.includes(orgToToggle) 
        ? allowedOrgs.filter(o => o !== orgToToggle)
        : [...allowedOrgs, orgToToggle];
        
      const baseHeaders = await getAuthHeaders();
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { ...baseHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ uid, updates: { allowedOrgs: newOrgs } }),
      });
      if (res.ok) fetchUsers();
    } catch (err: any) {
      console.error("Toggle org error:", err);
    }
  };

  const handleToggleFreeze = async (uid: string, disabled: boolean) => {
    try {
      const baseHeaders = await getAuthHeaders();
      let payload: any = { action: "unfreeze" };
      if (!disabled) {
        const reason = prompt("Enter reason for freezing this user:");
        if (reason === null) return;
        payload = { action: "freeze", reason };
      }
      const res = await fetch(`/api/admin/users/${uid}`, {
        method: "POST",
        headers: { ...baseHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) fetchUsers();
    } catch (err: any) {
      console.error("Freeze error:", err);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this user?")) return;
    try {
      const baseHeaders = await getAuthHeaders();
      const res = await fetch(`/api/admin/users/${uid}`, {
        method: "DELETE",
        headers: baseHeaders,
      });
      if (res.ok) fetchUsers();
    } catch (err: any) {
      console.error("Delete error:", err);
    }
  };

  // Handle password submission
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setPasswordError("Please enter the access password");
      return;
    }
    setPasswordError("");
    setVerifyingPassword(true);
    await fetchHealthData(passwordInput);
    setVerifyingPassword(false);
  };

  const getStatusBadge = (status: "healthy" | "degraded" | "critical" | "error" | "warning") => {
    switch (status) {
      case "healthy":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
          </span>
        );
      case "degraded":
      case "warning":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Degraded
          </span>
        );
      case "critical":
      case "error":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Critical
          </span>
        );
    }
  };

  /* ═══════════════════════════════════════════════════════════════
   * GATE 1: Not logged in or loading
   * ═══════════════════════════════════════════════════════════════ */
  if (isUserLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? "bg-[#0b0f19]" : "bg-slate-50"}`}>
        <div className="w-8 h-8 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
   * GATE 2: Not the developer — full block
   * ═══════════════════════════════════════════════════════════════ */
  if (!isDev) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${isDarkMode ? "bg-[#0b0f19] text-slate-100" : "bg-slate-50 text-slate-900"}`}>
        <div className={`max-w-md w-full p-8 rounded-2xl border text-center ${isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200"}`}>
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-6">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-2xl font-extrabold mb-2">Access Restricted</h1>
          <p className={`text-sm mb-6 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            This diagnostic panel is restricted to the system developer only. 
            Contact your administrator if you believe this is an error.
          </p>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium ${isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
            <Lock className="w-3.5 h-3.5" />
            Signed in as: {user?.email || "Unknown"}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
   * GATE 3: Password required
   * ═══════════════════════════════════════════════════════════════ */
  if (!isAuthorized) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${isDarkMode ? "bg-[#0b0f19] text-slate-100" : "bg-slate-50 text-slate-900"}`}>
        <div className={`max-w-md w-full p-8 rounded-2xl border ${isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-lg"}`}>
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-extrabold mb-2 text-center">System Health Access</h1>
          <p className={`text-sm mb-6 text-center ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            Enter the developer access password to view system diagnostics.
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={passwordInput}
                onChange={e => { setPasswordInput(e.target.value); setPasswordError(""); }}
                placeholder="Enter access password"
                autoFocus
                className={`w-full px-4 py-3 pr-12 rounded-xl border text-sm font-mono transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                  passwordError
                    ? "border-rose-500/50 bg-rose-500/5"
                    : isDarkMode
                    ? "bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500"
                    : "bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"}`}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {passwordError && (
              <p className="text-rose-400 text-xs font-medium flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> {passwordError}
              </p>
            )}

            <button
              type="submit"
              disabled={verifyingPassword}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                verifyingPassword
                  ? "bg-amber-500/50 text-white cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 active:scale-[0.98]"
              }`}
            >
              {verifyingPassword ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Unlock Diagnostics
                </>
              )}
            </button>
          </form>

          {errorMsg && (
            <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
   * MAIN DASHBOARD — Only visible after all gates pass
   * ═══════════════════════════════════════════════════════════════ */
  return (
    <div className={`min-h-screen p-6 md:p-8 transition-colors duration-200 ${isDarkMode ? "bg-[#0b0f19] text-slate-100" : "bg-slate-50 text-slate-900"}`}>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isDarkMode ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-amber-100 text-amber-900"}`}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">System Diagnostics</h1>
            <p className={`text-sm mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
              Agent health monitoring, credential status, token usage & audit logs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer ${isDarkMode ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-700"}`}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded text-amber-500 focus:ring-amber-500"
            />
            Auto-refresh (15s)
          </label>

          <button
            onClick={() => fetchHealthData(passwordInput, true)}
            disabled={refreshing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md active:scale-95 ${
              refreshing
                ? "bg-amber-500/50 text-white cursor-not-allowed"
                : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Running..." : "Run Diagnostics"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => fetchHealthData(passwordInput, true)} className="underline font-semibold hover:text-rose-300">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
            <Sparkles className="w-5 h-5 text-amber-500 absolute top-3 left-3 animate-pulse" />
          </div>
          <p className={`text-sm font-medium ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            Running synthetic agent health checks...
          </p>
        </div>
      ) : report ? (
        <>
          {/* ─── Top Overview Cards ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* System Status */}
            <div className={`p-5 rounded-2xl border ${isDarkMode ? "bg-slate-900/60 border-slate-800/80 shadow-lg" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                <span>System Health</span>
                <Activity className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-2xl font-bold capitalize mt-1">{report.overallStatus}</div>
                  <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {report.healthyAgentsCount} of {report.totalAgentsCount} agents operational
                  </p>
                </div>
                {getStatusBadge(report.overallStatus)}
              </div>
            </div>

            {/* Credentials */}
            <div className={`p-5 rounded-2xl border ${isDarkMode ? "bg-slate-900/60 border-slate-800/80 shadow-lg" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                <span>Credentials</span>
                <Key className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-2xl font-bold mt-1">
                    {report.envCheck.filter(e => e.status === "configured").length} / {report.envCheck.length}
                  </div>
                  <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {report.envCheck.filter(e => e.status === "missing").length} missing
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                  report.envCheck.every(e => e.status === "configured")
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}>
                  {report.envCheck.every(e => e.status === "configured") ? "All Set" : "Action Needed"}
                </span>
              </div>
            </div>

            {/* Database */}
            <div className={`p-5 rounded-2xl border ${isDarkMode ? "bg-slate-900/60 border-slate-800/80 shadow-lg" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                <span>Database</span>
                <Database className="w-4 h-4 text-sky-500" />
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-2xl font-bold mt-1 flex items-center gap-2">
                    {report.databaseStatus.ok ? (
                      <><Wifi className="w-5 h-5 text-emerald-400" /> Online</>
                    ) : (
                      <><WifiOff className="w-5 h-5 text-rose-400" /> Offline</>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    Latency: {report.databaseStatus.latencyMs}ms
                  </p>
                </div>
                {report.databaseStatus.ok
                  ? <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Connected</span>
                  : <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">Error</span>
                }
              </div>
            </div>

            {/* Token Usage */}
            <div className={`p-5 rounded-2xl border ${isDarkMode ? "bg-slate-900/60 border-slate-800/80 shadow-lg" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                <span>Token Usage</span>
                <BarChart3 className="w-4 h-4 text-purple-500" />
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-2xl font-bold mt-1">
                    {report.tokenSummary.totalCalls.toLocaleString()} <span className="text-xs font-normal text-slate-400">calls</span>
                  </div>
                  <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {report.tokenSummary.totalTokens.toLocaleString()} tokens · ${report.tokenSummary.totalCostUsd.toFixed(4)}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Tracked
                </span>
              </div>
            </div>
          </div>

          {/* ─── Navigation Tabs ─── */}
          <div className="flex items-center gap-2 border-b mb-6 pb-2 border-slate-200 dark:border-slate-800 overflow-x-auto">
            {([
              { key: "agents" as const, icon: Cpu, label: `Agent Status (${report.agents.length})` },
              { key: "credentials" as const, icon: ShieldCheck, label: `Credentials (${report.envCheck.length})` },
              { key: "tokens" as const, icon: BarChart3, label: "Token & Rate Limits" },
              { key: "logs" as const, icon: Terminal, label: `Audit Logs (${logs.length})` },
              { key: "users" as const, icon: Users, label: "End-User Management" },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                    : isDarkMode ? "hover:bg-slate-800/80 text-slate-400" : "hover:bg-slate-200/80 text-slate-600"
                }`}
              >
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </div>

          {/* ─── TAB: AGENTS ─── */}
          {activeTab === "agents" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {report.agents.map(agent => (
                <div
                  key={agent.id}
                  className={`p-6 rounded-2xl border transition-all hover:border-amber-500/40 ${
                    isDarkMode ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">{agent.category}</span>
                      <h3 className="text-lg font-bold mt-0.5">{agent.name}</h3>
                      <p className={`text-xs mt-1 font-mono ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                        {agent.endpoint}
                      </p>
                    </div>
                    {getStatusBadge(agent.status)}
                  </div>

                  <div className={`p-3 rounded-xl text-xs mb-4 ${
                    agent.status === "healthy"
                      ? isDarkMode ? "bg-emerald-500/5 text-emerald-400 border border-emerald-500/10" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : agent.status === "degraded"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}>
                    {agent.message}
                  </div>

                  <div className="space-y-2 border-t pt-3 border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Response Check:</span>
                      <span className="font-semibold text-emerald-400">{agent.latencyMs}ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Credentials:</span>
                      <span className={`font-semibold ${agent.missingCredentialCount === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                        {agent.totalCredentialCount - agent.missingCredentialCount} / {agent.totalCredentialCount} configured
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── TAB: CREDENTIALS (No key names, no masked values) ─── */}
          {activeTab === "credentials" && (
            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-slate-200"}`}>
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" /> Credential Status Overview
                </h3>
                <span className="text-xs text-slate-400">
                  {report.envCheck.filter(e => e.status === "configured").length} / {report.envCheck.length} Configured
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className={`border-b uppercase font-semibold text-[11px] ${isDarkMode ? "bg-slate-800/40 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                    <tr>
                      <th className="p-4">Service</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Used By</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {report.envCheck.map((cred, idx) => (
                      <tr key={idx} className={isDarkMode ? "hover:bg-slate-800/30" : "hover:bg-slate-50"}>
                        <td className="p-4 font-semibold">{cred.label}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"}`}>
                            {cred.category}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {cred.requiredFor.map((dep, i) => (
                              <span key={i} className={`px-2 py-0.5 rounded text-[10px] ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"}`}>
                                {dep}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4">
                          {cred.status === "configured" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Configured
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                              <XCircle className="w-3.5 h-3.5" /> Missing
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB: TOKEN & RATE LIMITS ─── */}
          {activeTab === "tokens" && (
            <div className="space-y-6">
              <div className={`p-6 rounded-2xl border ${isDarkMode ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-slate-200"}`}>
                <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-500" /> Token Usage by Model Provider
                </h3>
                {Object.keys(report.tokenSummary.byModel).length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-4">
                    No token consumption records logged yet. Run agent queries to populate live stats.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(report.tokenSummary.byModel).map(([model, data]) => (
                      <div key={model} className={`p-4 rounded-xl border ${isDarkMode ? "bg-slate-800/40 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-bold text-sm text-amber-400">{model}</span>
                          <span className="text-xs text-slate-400">{data.calls} requests</span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Tokens:</span>
                            <span className="font-semibold">{data.tokens.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Est. Cost:</span>
                            <span className="font-semibold text-purple-400">${data.cost.toFixed(4)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── TAB: AUDIT LOGS ─── */}
          {activeTab === "logs" && (
            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-slate-200"}`}>
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-500" /> Diagnostic Audit Log
                </h3>
                <span className="text-xs text-slate-400">{logs.length} entries</span>
              </div>
              {logs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  No errors or degraded events logged. All systems operational.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className={`border-b uppercase font-semibold text-[11px] ${isDarkMode ? "bg-slate-800/40 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                      <tr>
                        <th className="p-4">Timestamp</th>
                        <th className="p-4">Agent</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {logs.map((log, idx) => (
                        <tr key={log.id || idx} className={isDarkMode ? "hover:bg-slate-800/30" : "hover:bg-slate-50"}>
                          <td className="p-4 font-mono text-slate-400 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="p-4 font-bold">{log.agentName}</td>
                          <td className="p-4">{getStatusBadge(log.status)}</td>
                          <td className="p-4">{log.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── TAB: END-USER MANAGEMENT ─── */}
          {activeTab === "users" && (
            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-slate-200"}`}>
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-500" /> End-User Management
                </h3>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className={`pl-9 pr-4 py-1.5 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                        isDarkMode 
                          ? "bg-slate-800/60 border-slate-700 text-slate-200 placeholder:text-slate-500" 
                          : "bg-slate-50 border-slate-300 text-slate-800 placeholder:text-slate-400"
                      }`}
                    />
                  </div>
                  <button onClick={fetchUsers} disabled={usersLoading} className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}>
                    <RefreshCw className={`w-4 h-4 ${usersLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className={`border-b uppercase font-semibold text-[11px] ${isDarkMode ? "bg-slate-800/40 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                    <tr>
                      <th className="p-4">User</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Org Access</th>
                      <th className="p-4">Primary Role</th>
                      <th className="p-4">Created / Login</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {usersList
                      .filter(u => 
                        (u.email || "").toLowerCase().includes(userSearch.toLowerCase()) || 
                        (u.displayName || "").toLowerCase().includes(userSearch.toLowerCase())
                      )
                      .map((u) => {
                        const isDevAccount = isDeveloper(u.email);
                        const userRoleColors = isDevAccount ? DEVELOPER_COLORS : (ROLE_COLORS[u.orgRoles?.["soltheory"] as keyof typeof ROLE_COLORS] || ROLE_COLORS["read-only"]);
                        const roleLabel = isDevAccount ? "Developer" : (ROLE_LABELS[u.orgRoles?.["soltheory"] as keyof typeof ROLE_LABELS] || "None");
                        const initial = (u.displayName || u.email || "?").charAt(0).toUpperCase();
                        
                        return (
                          <tr key={u.uid} className={isDarkMode ? "hover:bg-slate-800/30" : "hover:bg-slate-50"}>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-600"}`}>
                                  {initial}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-semibold">{u.displayName || "Unknown Name"}</span>
                                  <span className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{u.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              {u.disabled ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                  Frozen
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1.5">
                                {ALL_ORGS.map(org => {
                                  const hasAccess = u.allowedOrgs?.includes(org);
                                  return (
                                    <button
                                      key={org}
                                      onClick={() => handleToggleOrgAccess(u.uid, u.allowedOrgs || [], org)}
                                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                                        hasAccess
                                          ? isDarkMode ? "bg-sky-500/10 text-sky-400 border-sky-500/30 hover:bg-sky-500/20" : "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"
                                          : isDarkMode ? "bg-slate-800/50 text-slate-500 border-slate-700 hover:bg-slate-800" : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                                      }`}
                                    >
                                      {ORG_LABELS[org]}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="relative group inline-block">
                                <select 
                                  className={`appearance-none pl-3 pr-8 py-1 rounded-full text-xs font-semibold border focus:outline-none cursor-pointer ${
                                    isDarkMode ? `${userRoleColors.darkBg} ${userRoleColors.darkText} ${userRoleColors.darkBorder}` : `${userRoleColors.bg} ${userRoleColors.text} ${userRoleColors.border}`
                                  }`}
                                  value={isDevAccount ? "developer" : (u.orgRoles?.["soltheory"] || "read-only")}
                                  onChange={(e) => handleUpdateUserRole(u.uid, "soltheory", e.target.value)}
                                  disabled={isDevAccount}
                                >
                                  {isDevAccount && <option value="developer">Developer</option>}
                                  {!isDevAccount && ALL_ROLES.map(role => (
                                    <option key={role} value={role}>{ROLE_LABELS[role as keyof typeof ROLE_LABELS]}</option>
                                  ))}
                                </select>
                                {!isDevAccount && (
                                  <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-xs font-mono text-slate-400 whitespace-nowrap">
                              <div>{u.metadata?.creationTime ? new Date(u.metadata.creationTime).toLocaleDateString() : 'N/A'}</div>
                              <div className="text-[10px] opacity-70 mt-0.5">{u.metadata?.lastSignInTime ? new Date(u.metadata.lastSignInTime).toLocaleDateString() : 'Never'}</div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!isDevAccount && (
                                  <>
                                    <button
                                      onClick={() => handleToggleFreeze(u.uid, u.disabled)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                        u.disabled
                                          ? isDarkMode ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                                          : isDarkMode ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                                      }`}
                                    >
                                      {u.disabled ? "Unfreeze" : "Freeze"}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(u.uid)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                        isDarkMode ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20" : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                                      }`}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    {usersList.length > 0 && usersList.filter(u => 
                        (u.email || "").toLowerCase().includes(userSearch.toLowerCase()) || 
                        (u.displayName || "").toLowerCase().includes(userSearch.toLowerCase())
                      ).length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-sm text-slate-400">
                            No users found matching "{userSearch}"
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
