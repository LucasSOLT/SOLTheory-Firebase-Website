"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useUser, useFirestore } from "@/firebase";
import { useTheme } from "@/components/ThemeProvider";
import { useParams } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { isOracle } from "@/lib/org-config";
import { useOrgRole } from "@/hooks/useOrgRole";
import { getAuthHeaders } from "@/lib/api-auth-client";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import {
  ShieldCheck,
  Search,
  UserCheck,
  UserX,
  ChevronDown,
  Users,
  Activity,
  Filter,
  Clock,
  ExternalLink,
  ChevronRight
} from "lucide-react";

type OrgUser = {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  frozenAt: string | null;
  frozenReason: string | null;
  lastLogin: string | null;
  createdAt: string | null;
  photoURL: string;
};

interface ActivityEntry {
  id: string;
  type: string;
  userEmail: string;
  userName: string;
  description: string;
  category: string;
  timestamp: any;
  metadata?: Record<string, any>;
}

const ROLE_OPTIONS = [
  { value: "read-only", label: "Read Only", color: "slate" },
  { value: "user", label: "User", color: "blue" },
  { value: "admin", label: "Admin", color: "amber" },
];

const ACTIVITY_CATEGORIES = [
  { key: "all", label: "All Categories" },
  { key: "auth", label: "Authentication" },
  { key: "crm", label: "CRM / Contacts" },
  { key: "tasks", label: "Action Board Tasks" },
  { key: "timesheets", label: "Timesheets" },
  { key: "ai", label: "AI & Chat" },
  { key: "files", label: "Media & Files" },
  { key: "settings", label: "Settings & Profile" },
  { key: "support", label: "Support Tickets" },
  { key: "general", label: "General" },
];

export default function AdminDashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { isDarkMode } = useTheme();
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const orgDomain = orgId ? `${orgId}.com` : "";

  // Dynamic Org Role from Firestore
  const { role: currentOrgRole, isLoading: isRoleLoading } = useOrgRole(orgId);

  // Tab State: 'members' | 'audit'
  const [activeTab, setActiveTab] = useState<"members" | "audit">("members");

  // Members state
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  // Audit Log State
  const [auditEntries, setAuditEntries] = useState<ActivityEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditCategory, setAuditCategory] = useState("all");
  const [auditUserFilter, setAuditUserFilter] = useState("all");
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [expandedAuditIds, setExpandedAuditIds] = useState<Set<string>>(new Set());

  // Access check: Oracle, Global Admin, or Org-specific Admin/Oracle role
  const hasAccess =
    user?.email &&
    (isOracle(user.email) ||
      isAdmin(user.email) ||
      currentOrgRole === "admin" ||
      currentOrgRole === "oracle");

  // Fetch Members via API
  const fetchUsers = useCallback(async () => {
    if (!hasAccess || !orgId) return;
    try {
      setLoadingUsers(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/org-users?orgId=${orgId}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
      setUserError(null);
    } catch (err: any) {
      setUserError(err.message);
    } finally {
      setLoadingUsers(false);
    }
  }, [orgId, hasAccess]);

  useEffect(() => {
    if (!isUserLoading && !isRoleLoading && hasAccess) {
      fetchUsers();
    }
  }, [isUserLoading, isRoleLoading, hasAccess, fetchUsers]);

  // Real-time Activity Log Listener
  useEffect(() => {
    if (!hasAccess || !firestore || !orgDomain) return;
    setLoadingAudit(true);

    try {
      const q = query(
        collection(firestore, "activity_log"),
        where("orgDomain", "==", orgDomain),
        orderBy("timestamp", "desc"),
        limit(300)
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const list: ActivityEntry[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              type: data.type || "",
              userEmail: data.userEmail || "",
              userName: data.userName || "",
              description: data.description || "",
              category: data.category || "",
              timestamp: data.timestamp,
              metadata: data.metadata,
            });
          });
          setAuditEntries(list);
          setLoadingAudit(false);
        },
        (err) => {
          console.warn("[Admin Audit] Fallback on snapshot error:", err);
          // Fallback query without orderBy in case composite index is still building
          const fallbackQuery = query(
            collection(firestore, "activity_log"),
            where("orgDomain", "==", orgDomain),
            limit(300)
          );
          onSnapshot(fallbackQuery, (snap) => {
            const list: ActivityEntry[] = [];
            snap.forEach((d) => {
              const data = d.data();
              list.push({
                id: d.id,
                type: data.type || "",
                userEmail: data.userEmail || "",
                userName: data.userName || "",
                description: data.description || "",
                category: data.category || "",
                timestamp: data.timestamp,
                metadata: data.metadata,
              });
            });
            list.sort((a, b) => {
              const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
              const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
              return tB - tA;
            });
            setAuditEntries(list);
            setLoadingAudit(false);
          });
        }
      );

      return () => unsub();
    } catch (e) {
      console.error("[Admin Audit] Failed to initialize listener:", e);
      setLoadingAudit(false);
    }
  }, [hasAccess, firestore, orgDomain]);

  // Handle Role Change
  const handleRoleChange = async (uid: string, newRole: string) => {
    setUpdatingUid(uid);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/org-users", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ uid, orgId, role: newRole }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u))
      );
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUpdatingUid(null);
    }
  };

  // Handle Freeze / Unfreeze
  const handleFreezeToggle = async (uid: string, currentlyFrozen: boolean) => {
    const action = currentlyFrozen ? "unfreeze" : "freeze";
    const reason = currentlyFrozen
      ? undefined
      : prompt("Reason for freezing this account (optional):");
    if (!currentlyFrozen && reason === null) return;

    setUpdatingUid(uid);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/org-users", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ uid, orgId, action, reason: reason || undefined }),
      });
      if (!res.ok) throw new Error(`Failed to ${action} user`);
      await fetchUsers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUpdatingUid(null);
    }
  };

  const toggleExpandAudit = (id: string) => {
    setExpandedAuditIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered lists
  const filteredUsers = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  const filteredAudit = auditEntries.filter((entry) => {
    const matchesCategory =
      auditCategory === "all" || entry.category === auditCategory;
    const matchesUser =
      auditUserFilter === "all" || entry.userEmail === auditUserFilter;
    const matchesSearch =
      !auditSearchQuery ||
      entry.description.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      entry.userEmail.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      entry.userName.toLowerCase().includes(auditSearchQuery.toLowerCase());
    return matchesCategory && matchesUser && matchesSearch;
  });

  // Unique users for audit filter
  const auditUsersList = Array.from(
    new Set(auditEntries.map((e) => e.userEmail).filter(Boolean))
  );

  // Loading state
  if (isUserLoading || isRoleLoading) {
    return (
      <div
        className={`flex items-center justify-center min-h-screen ${
          isDarkMode ? "bg-slate-950 text-white" : "bg-[#f5f1ea] text-slate-900"
        }`}
      >
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Access denied
  if (!hasAccess) {
    return (
      <div
        className={`flex flex-col items-center justify-center min-h-screen gap-4 ${
          isDarkMode ? "bg-slate-950 text-white" : "bg-[#f5f1ea] text-slate-900"
        }`}
      >
        <ShieldCheck className="w-16 h-16 text-red-400" />
        <h1 className="text-2xl font-bold">Access Restricted</h1>
        <p
          className={`text-sm ${
            isDarkMode ? "text-slate-400" : "text-slate-600"
          }`}
        >
          This dashboard is only available to organization administrators.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen p-6 md:p-10 ${
        isDarkMode ? "bg-slate-950 text-white" : "bg-[#f5f1ea] text-slate-900"
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div
            className={`p-3 rounded-2xl ${
              isDarkMode ? "bg-indigo-500/15" : "bg-indigo-50"
            }`}
          >
            <ShieldCheck className="w-7 h-7 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p
              className={`text-sm ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Organization governance, member access, and real-time audit logging
            </p>
          </div>
        </div>

        {/* Tab Toggle Buttons */}
        <div
          className={`flex items-center p-1 rounded-xl border ${
            isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          }`}
        >
          <button
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "members"
                ? isDarkMode
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-indigo-600 text-white shadow-sm"
                : isDarkMode
                ? "text-slate-400 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Team Members ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "audit"
                ? isDarkMode
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-indigo-600 text-white shadow-sm"
                : isDarkMode
                ? "text-slate-400 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Audit Trail ({auditEntries.length})
          </button>
        </div>
      </div>

      {/* ─── TAB 1: MEMBERS ─── */}
      {activeTab === "members" && (
        <div className="space-y-6">
          {/* Member Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Members", value: users.length, color: "indigo" },
              {
                label: "Admins",
                value: users.filter(
                  (u) => u.role === "admin" || u.role === "oracle"
                ).length,
                color: "amber",
              },
              {
                label: "Active Accounts",
                value: users.filter((u) => !u.frozenAt).length,
                color: "emerald",
              },
              {
                label: "Frozen Accounts",
                value: users.filter((u) => u.frozenAt).length,
                color: "red",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`p-4 rounded-2xl border ${
                  isDarkMode
                    ? "bg-slate-900 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <p
                  className={`text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {stat.label}
                </p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Search bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              />
              <input
                type="text"
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                placeholder="Search members by name or email..."
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border transition-colors ${
                  isDarkMode
                    ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 focus:border-indigo-500"
                    : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500"
                } outline-none`}
              />
            </div>
          </div>

          {/* Error notice */}
          {userError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {userError}
            </div>
          )}

          {/* Member Table */}
          {loadingUsers ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div
              className={`rounded-2xl border overflow-hidden ${
                isDarkMode
                  ? "bg-slate-900 border-slate-800"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className={isDarkMode ? "bg-slate-800/50" : "bg-slate-50"}
                    >
                      <th
                        className={`text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider ${
                          isDarkMode ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Member
                      </th>
                      <th
                        className={`text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider ${
                          isDarkMode ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Role
                      </th>
                      <th
                        className={`text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider ${
                          isDarkMode ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Status
                      </th>
                      <th
                        className={`text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider ${
                          isDarkMode ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Last Login
                      </th>
                      <th
                        className={`text-right px-6 py-3.5 text-xs font-semibold uppercase tracking-wider ${
                          isDarkMode ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className={`divide-y ${
                      isDarkMode ? "divide-slate-800" : "divide-slate-100"
                    }`}
                  >
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className={`px-6 py-12 text-center text-sm ${
                            isDarkMode ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          {memberSearchQuery
                            ? "No members match your search."
                            : "No members found in this organization."}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isFrozen = !!u.frozenAt;
                        const isCurrentUser = u.uid === user?.uid;
                        const initials =
                          u.displayName
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2) || "?";

                        return (
                          <tr
                            key={u.uid}
                            className={`transition-colors ${
                              isDarkMode
                                ? "hover:bg-slate-800/50"
                                : "hover:bg-slate-50/80"
                            } ${isFrozen ? "opacity-60" : ""}`}
                          >
                            {/* Member Identity */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isDarkMode
                                      ? "bg-indigo-500/20 text-indigo-300"
                                      : "bg-indigo-100 text-indigo-700"
                                  }`}
                                >
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate">
                                    {u.displayName || "Unnamed Member"}
                                    {isCurrentUser && (
                                      <span className="ml-2 text-[10px] font-medium text-indigo-400">
                                        (You)
                                      </span>
                                    )}
                                  </p>
                                  <p
                                    className={`text-xs truncate ${
                                      isDarkMode
                                        ? "text-slate-400"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {u.email}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Role Dropdown */}
                            <td className="px-6 py-4">
                              <div className="relative inline-block">
                                <select
                                  value={u.role}
                                  onChange={(e) =>
                                    handleRoleChange(u.uid, e.target.value)
                                  }
                                  disabled={
                                    isCurrentUser || updatingUid === u.uid
                                  }
                                  className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                                    isCurrentUser
                                      ? "opacity-50 cursor-not-allowed"
                                      : ""
                                  } ${
                                    isDarkMode
                                      ? "bg-slate-800 border-slate-700 text-white"
                                      : "bg-slate-50 border-slate-200 text-slate-700"
                                  }`}
                                >
                                  {ROLE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown
                                  className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${
                                    isDarkMode
                                      ? "text-slate-500"
                                      : "text-slate-400"
                                  }`}
                                />
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  isFrozen
                                    ? isDarkMode
                                      ? "bg-red-500/15 text-red-400"
                                      : "bg-red-50 text-red-600"
                                    : isDarkMode
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-emerald-50 text-emerald-600"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isFrozen ? "bg-red-500" : "bg-emerald-500"
                                  }`}
                                />
                                {isFrozen ? "Frozen" : "Active"}
                              </span>
                            </td>

                            {/* Last Login */}
                            <td
                              className={`px-6 py-4 text-xs ${
                                isDarkMode ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {u.lastLogin
                                ? new Date(u.lastLogin).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    }
                                  )
                                : "Never"}
                            </td>

                            {/* Actions */}
                            <td className="px-6 py-4 text-right">
                              {!isCurrentUser && (
                                <button
                                  onClick={() =>
                                    handleFreezeToggle(u.uid, isFrozen)
                                  }
                                  disabled={updatingUid === u.uid}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    isFrozen
                                      ? isDarkMode
                                        ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                                        : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                      : isDarkMode
                                      ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                                      : "bg-red-50 text-red-600 hover:bg-red-100"
                                  } ${
                                    updatingUid === u.uid
                                      ? "opacity-50 cursor-not-allowed"
                                      : ""
                                  }`}
                                >
                                  {isFrozen ? (
                                    <UserCheck className="w-3.5 h-3.5" />
                                  ) : (
                                    <UserX className="w-3.5 h-3.5" />
                                  )}
                                  {isFrozen ? "Unfreeze" : "Freeze"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: AUDIT TRAIL ─── */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              />
              <input
                type="text"
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                placeholder="Search audit descriptions, actions, users..."
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border transition-colors ${
                  isDarkMode
                    ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 focus:border-indigo-500"
                    : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500"
                } outline-none`}
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-3">
              {/* Category Filter */}
              <div className="relative">
                <select
                  value={auditCategory}
                  onChange={(e) => setAuditCategory(e.target.value)}
                  className={`appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                    isDarkMode
                      ? "bg-slate-900 border-slate-800 text-white"
                      : "bg-white border-slate-200 text-slate-800"
                  }`}
                >
                  {ACTIVITY_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                />
              </div>

              {/* User Filter */}
              <div className="relative">
                <select
                  value={auditUserFilter}
                  onChange={(e) => setAuditUserFilter(e.target.value)}
                  className={`appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                    isDarkMode
                      ? "bg-slate-900 border-slate-800 text-white"
                      : "bg-white border-slate-200 text-slate-800"
                  }`}
                >
                  <option value="all">All Members</option>
                  {auditUsersList.map((email) => (
                    <option key={email} value={email}>
                      {email}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Audit Stream List */}
          {loadingAudit ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : filteredAudit.length === 0 ? (
            <div
              className={`p-12 text-center rounded-2xl border ${
                isDarkMode
                  ? "bg-slate-900 border-slate-800 text-slate-400"
                  : "bg-white border-slate-200 text-slate-500"
              }`}
            >
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-40 text-indigo-500" />
              <p className="text-base font-semibold">No activity logged yet</p>
              <p className="text-xs mt-1">
                Actions taken by members across the Action Board, Timesheets, CRM,
                and AI will stream here live.
              </p>
            </div>
          ) : (
            <div
              className={`rounded-2xl border divide-y overflow-hidden ${
                isDarkMode
                  ? "bg-slate-900 border-slate-800 divide-slate-800"
                  : "bg-white border-slate-200 divide-slate-100"
              }`}
            >
              {filteredAudit.map((entry) => {
                const isExpanded = expandedAuditIds.has(entry.id);
                const timeStr = entry.timestamp?.toDate
                  ? entry.timestamp.toDate().toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "Just now";

                return (
                  <div
                    key={entry.id}
                    className={`p-4 transition-colors ${
                      isDarkMode ? "hover:bg-slate-800/40" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                            isDarkMode
                              ? "bg-indigo-500/15 text-indigo-400"
                              : "bg-indigo-50 text-indigo-600"
                          }`}
                        >
                          {entry.userName?.charAt(0) || "U"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">
                              {entry.userName || entry.userEmail}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                isDarkMode
                                  ? "bg-slate-800 text-slate-300 border border-slate-700"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              {entry.category || "action"}
                            </span>
                          </div>
                          <p
                            className={`text-xs mt-1 leading-relaxed ${
                              isDarkMode ? "text-slate-300" : "text-slate-700"
                            }`}
                          >
                            {entry.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs whitespace-nowrap ${
                            isDarkMode ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          {timeStr}
                        </span>

                        {entry.metadata &&
                          Object.keys(entry.metadata).length > 0 && (
                            <button
                              onClick={() => toggleExpandAudit(entry.id)}
                              className={`p-1 rounded-md transition-colors ${
                                isDarkMode
                                  ? "hover:bg-slate-800 text-slate-400"
                                  : "hover:bg-slate-100 text-slate-500"
                              }`}
                              title="Inspect action metadata"
                            >
                              <ChevronRight
                                className={`w-4 h-4 transition-transform ${
                                  isExpanded ? "rotate-90" : ""
                                }`}
                              />
                            </button>
                          )}
                      </div>
                    </div>

                    {/* Expandable Metadata Payload */}
                    {isExpanded && entry.metadata && (
                      <div
                        className={`mt-3 p-3 rounded-xl text-xs font-mono overflow-x-auto ${
                          isDarkMode
                            ? "bg-slate-950 border border-slate-800 text-slate-300"
                            : "bg-slate-50 border border-slate-200 text-slate-700"
                        }`}
                      >
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
