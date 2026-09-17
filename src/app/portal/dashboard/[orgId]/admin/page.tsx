"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useUser } from "@/firebase";
import { useTheme } from "@/components/ThemeProvider";
import { useParams } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { isOracle } from "@/lib/org-config";
import { getAuthHeaders } from "@/lib/api-auth-client";
import { ShieldCheck, Search, UserCheck, UserX, ChevronDown } from "lucide-react";

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

const ROLE_OPTIONS = [
  { value: "read-only", label: "Read Only", color: "slate" },
  { value: "user", label: "User", color: "blue" },
  { value: "admin", label: "Admin", color: "amber" },
];

export default function AdminDashboardPage() {
  const { user, isUserLoading } = useUser();
  const { isDarkMode } = useTheme();
  const params = useParams();
  const orgId = params.orgId as string;

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  // Access check: must be admin or oracle
  const hasAccess = user?.email && (isAdmin(user.email) || isOracle(user.email));

  const fetchUsers = useCallback(async () => {
    if (!hasAccess) return;
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/org-users?orgId=${orgId}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId, hasAccess]);

  useEffect(() => {
    if (!isUserLoading && hasAccess) fetchUsers();
  }, [isUserLoading, hasAccess, fetchUsers]);

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
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleFreezeToggle = async (uid: string, currentlyFrozen: boolean) => {
    const action = currentlyFrozen ? "unfreeze" : "freeze";
    const reason = currentlyFrozen ? undefined : prompt("Reason for freezing this account (optional):");
    if (!currentlyFrozen && reason === null) return; // user cancelled

    setUpdatingUid(uid);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/org-users", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ uid, action, reason: reason || undefined }),
      });
      if (!res.ok) throw new Error(`Failed to ${action} user`);
      await fetchUsers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUpdatingUid(null);
    }
  };

  // Filter users by search
  const filtered = users.filter(u =>
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading state
  if (isUserLoading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-[#f5f1ea] text-slate-900'}`}>
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Access denied
  if (!hasAccess) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen gap-4 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-[#f5f1ea] text-slate-900'}`}>
        <ShieldCheck className="w-16 h-16 text-red-400" />
        <h1 className="text-2xl font-bold">Access Restricted</h1>
        <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          This page is only available to organization administrators.
        </p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 md:p-10 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-[#f5f1ea] text-slate-900'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-indigo-500/15' : 'bg-indigo-50'}`}>
            <ShieldCheck className="w-7 h-7 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Manage your organization&apos;s members and permissions
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border transition-colors ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500'
                : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500'
            } outline-none`}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Members", value: users.length, color: "indigo" },
          { label: "Admins", value: users.filter(u => u.role === "admin" || u.role === "oracle").length, color: "amber" },
          { label: "Active", value: users.filter(u => !u.frozenAt).length, color: "emerald" },
          { label: "Frozen", value: users.filter(u => u.frozenAt).length, color: "red" },
        ].map(stat => (
          <div key={stat.label} className={`p-4 rounded-2xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <p className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}>
                  <th className={`text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Member</th>
                  <th className={`text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Role</th>
                  <th className={`text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Status</th>
                  <th className={`text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Last Login</th>
                  <th className={`text-right px-6 py-3.5 text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`px-6 py-12 text-center text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {searchQuery ? "No members match your search." : "No members found in this organization."}
                    </td>
                  </tr>
                ) : (
                  filtered.map(u => {
                    const isFrozen = !!u.frozenAt;
                    const isCurrentUser = u.uid === user?.uid;
                    const initials = u.displayName?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?";

                    return (
                      <tr key={u.uid} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/80'} ${isFrozen ? 'opacity-60' : ''}`}>
                        {/* Member */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{u.displayName || "Unnamed"}</p>
                              <p className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role Dropdown */}
                        <td className="px-6 py-4">
                          <div className="relative">
                            <select
                              value={u.role}
                              onChange={e => handleRoleChange(u.uid, e.target.value)}
                              disabled={isCurrentUser || updatingUid === u.uid}
                              className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                                isCurrentUser ? 'opacity-50 cursor-not-allowed' : ''
                              } ${
                                isDarkMode
                                  ? 'bg-slate-800 border-slate-700 text-white'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              {ROLE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isFrozen
                              ? (isDarkMode ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600')
                              : (isDarkMode ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isFrozen ? 'bg-red-500' : 'bg-emerald-500'}`} />
                            {isFrozen ? "Frozen" : "Active"}
                          </span>
                        </td>

                        {/* Last Login */}
                        <td className={`px-6 py-4 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric"
                          }) : "Never"}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          {!isCurrentUser && (
                            <button
                              onClick={() => handleFreezeToggle(u.uid, isFrozen)}
                              disabled={updatingUid === u.uid}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                isFrozen
                                  ? (isDarkMode ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100')
                                  : (isDarkMode ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-red-50 text-red-600 hover:bg-red-100')
                              } ${updatingUid === u.uid ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {isFrozen ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
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
  );
}
