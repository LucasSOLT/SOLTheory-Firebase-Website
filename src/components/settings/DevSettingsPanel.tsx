"use client";

/**
 * @file DevSettingsPanel.tsx
 * @description Developer-only cross-organization management panel.
 * Provides visibility into ALL organizations, ALL users, and ALL member assignments.
 * Only visible to lucas@soltheory.com — if the current user is not a developer,
 * the component renders nothing.
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useDevSettings, type GlobalUser } from "@/hooks/useDevSettings";
import { ALL_ROLES, ROLE_LABELS, ROLE_COLORS, type OrgRole } from "@/lib/rbac";
import {
  Users,
  Shield,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  Loader2,
  UserPlus,
  Trash2,
  Check,
  X,
  Building2,
  Code,
  Crown,
  AlertTriangle,
} from "lucide-react";

/* ─── Org Color Mapping ─────────────────────────────────────────────────────── */

const ORG_COLOR_MAP: Record<
  string,
  { light: string; dark: string; accent: string; darkAccent: string }
> = {
  fuchsia: {
    light: "bg-fuchsia-100 text-fuchsia-600",
    dark: "bg-fuchsia-900/30 text-fuchsia-400",
    accent: "border-fuchsia-200",
    darkAccent: "border-fuchsia-800",
  },
  indigo: {
    light: "bg-indigo-100 text-indigo-600",
    dark: "bg-indigo-900/30 text-indigo-400",
    accent: "border-indigo-200",
    darkAccent: "border-indigo-800",
  },
  emerald: {
    light: "bg-emerald-100 text-emerald-600",
    dark: "bg-emerald-900/30 text-emerald-400",
    accent: "border-emerald-200",
    darkAccent: "border-emerald-800",
  },
  amber: {
    light: "bg-amber-100 text-amber-600",
    dark: "bg-amber-900/30 text-amber-400",
    accent: "border-amber-200",
    darkAccent: "border-amber-800",
  },
  sky: {
    light: "bg-sky-100 text-sky-600",
    dark: "bg-sky-900/30 text-sky-400",
    accent: "border-sky-200",
    darkAccent: "border-sky-800",
  },
  rose: {
    light: "bg-rose-100 text-rose-600",
    dark: "bg-rose-900/30 text-rose-400",
    accent: "border-rose-200",
    darkAccent: "border-rose-800",
  },
};

const DEFAULT_ORG_COLOR = {
  light: "bg-slate-100 text-slate-600",
  dark: "bg-slate-800 text-slate-400",
  accent: "border-slate-200",
  darkAccent: "border-slate-700",
};

function getOrgColor(color: string) {
  return ORG_COLOR_MAP[color] ?? DEFAULT_ORG_COLOR;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export default function DevSettingsPanel() {
  const { isDarkMode } = useTheme();
  const {
    isDeveloper,
    isLoading,
    allOrgs,
    allUsers,
    orgMembers,
    assignUserToOrg,
    removeUserFromOrg,
    updateUserRole,
    syncAllUsersToOrgs,
  } = useDevSettings();

  /* ── State ──────────────────────────────────────────────────────────────────── */

  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const [addingUserToOrg, setAddingUserToOrg] = useState<{
    orgId: string;
    uid: string;
    role: OrgRole;
  } | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);

  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [roleDropdownUid, setRoleDropdownUid] = useState<string | null>(null);

  const [confirmRemove, setConfirmRemove] = useState<{
    orgId: string;
    uid: string;
  } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const addUserDropdownRef = useRef<HTMLDivElement>(null);

  /* ── Click-outside handler for dropdowns ────────────────────────────────────── */

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(e.target as Node)
      ) {
        setRoleDropdownUid(null);
      }
      if (
        addUserDropdownRef.current &&
        !addUserDropdownRef.current.contains(e.target as Node)
      ) {
        setAddingUserToOrg(null);
      }
    }
    if (roleDropdownUid || addingUserToOrg) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [roleDropdownUid, addingUserToOrg]);

  /* ── Auto-clear sync result ─────────────────────────────────────────────────── */

  useEffect(() => {
    if (syncResult) {
      const timer = setTimeout(() => setSyncResult(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [syncResult]);

  /* ── Handlers ───────────────────────────────────────────────────────────────── */

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncAllUsersToOrgs();
      setSyncResult(`Synced ${result.assigned} user${result.assigned !== 1 ? "s" : ""}!`);
    } catch (err) {
      console.error("[DevSettingsPanel] Sync failed:", err);
      setSyncResult("Sync failed — check console");
    } finally {
      setIsSyncing(false);
    }
  }, [syncAllUsersToOrgs]);

  const handleRoleChange = useCallback(
    async (uid: string, orgId: string, newRole: OrgRole) => {
      setChangingRole(uid);
      setRoleDropdownUid(null);
      try {
        await updateUserRole(uid, orgId, newRole);
      } catch (err) {
        console.error("[DevSettingsPanel] Role change failed:", err);
      } finally {
        setChangingRole(null);
      }
    },
    [updateUserRole]
  );

  const handleRemoveUser = useCallback(
    async (uid: string, orgId: string) => {
      setIsRemoving(true);
      try {
        await removeUserFromOrg(uid, orgId);
      } catch (err) {
        console.error("[DevSettingsPanel] Remove failed:", err);
      } finally {
        setConfirmRemove(null);
        setIsRemoving(false);
      }
    },
    [removeUserFromOrg]
  );

  const handleAddUser = useCallback(
    async (uid: string, orgId: string, role: OrgRole) => {
      setIsAddingUser(true);
      try {
        await assignUserToOrg(uid, orgId, role);
      } catch (err) {
        console.error("[DevSettingsPanel] Add user failed:", err);
      } finally {
        setAddingUserToOrg(null);
        setIsAddingUser(false);
      }
    },
    [assignUserToOrg]
  );

  /* ── Filtered users for the global table ────────────────────────────────────── */

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return allUsers;
    const q = userSearch.toLowerCase();
    return allUsers.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [allUsers, userSearch]);

  /* ── Helper: get orgs a user belongs to ─────────────────────────────────────── */

  const getUserOrgs = useCallback(
    (uid: string) => {
      const result: { orgId: string; orgName: string; color: string; role: OrgRole }[] = [];
      for (const org of allOrgs) {
        const members = orgMembers[org.id] ?? [];
        const member = members.find((m) => m.uid === uid);
        if (member) {
          result.push({
            orgId: org.id,
            orgName: org.name,
            color: org.color,
            role: member.role,
          });
        }
      }
      return result;
    },
    [allOrgs, orgMembers]
  );

  /* ── Guard clauses ──────────────────────────────────────────────────────────── */

  if (!isDeveloper) return null;

  if (isLoading) {
    return (
      <div
        className={`rounded-xl border p-12 flex items-center justify-center ${
          isDarkMode
            ? "bg-slate-900/80 border-slate-700/60"
            : "bg-white border-[#ede8da]/80"
        }`}
      >
        <Loader2
          className={`w-5 h-5 animate-spin ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}
        />
        <span
          className={`ml-2 text-sm ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Loading developer settings…
        </span>
      </div>
    );
  }

  /* ── Total member count ─────────────────────────────────────────────────────── */

  const totalMembers = allOrgs.reduce((sum, org) => sum + org.memberCount, 0);

  /* ─── Render ───────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className={`rounded-xl border p-5 ${
          isDarkMode
            ? "bg-slate-900/80 border-slate-700/60"
            : "bg-white border-[#ede8da]/80"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              isDarkMode ? "bg-indigo-900/40" : "bg-indigo-50"
            }`}
          >
            <Code
              className={`w-5 h-5 ${
                isDarkMode ? "text-indigo-400" : "text-indigo-600"
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              className={`text-lg font-bold ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}
            >
              🔧 Developer Settings
            </h2>
            <p
              className={`text-xs mt-0.5 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Platform-wide admin tools — lucas@soltheory.com only
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <div
          className={`mt-4 flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 ${
            isDarkMode
              ? "bg-amber-900/20 border-amber-800/50 text-amber-300"
              : "bg-amber-50 border-amber-200 text-amber-700"
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-medium">
            Changes here affect all organizations across the platform.
          </span>
        </div>
      </div>

      {/* ── Section 1: Organizations Grid ───────────────────────────────────── */}
      <div
        className={`rounded-xl border ${
          isDarkMode
            ? "bg-slate-900/80 border-slate-700/60"
            : "bg-white border-[#ede8da]/80"
        }`}
      >
        {/* Section Header */}
        <div
          className="px-5 py-4 flex items-center gap-3 border-b"
          style={{
            borderColor: isDarkMode
              ? "rgba(51,65,85,0.6)"
              : "rgba(237,232,218,0.8)",
          }}
        >
          <div
            className={`p-2 rounded-lg ${
              isDarkMode ? "bg-violet-900/40" : "bg-violet-50"
            }`}
          >
            <Building2
              className={`w-4 h-4 ${
                isDarkMode ? "text-violet-400" : "text-violet-600"
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className={`text-sm font-semibold ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}
            >
              Organizations
            </h3>
            <p
              className={`text-xs mt-0.5 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {allOrgs.length} org{allOrgs.length !== 1 ? "s" : ""} · {totalMembers}{" "}
              total member{totalMembers !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Sync Result */}
          {syncResult && (
            <span
              className={`text-xs font-medium animate-in fade-in duration-200 ${
                syncResult.includes("failed")
                  ? isDarkMode
                    ? "text-red-400"
                    : "text-red-600"
                  : isDarkMode
                  ? "text-emerald-400"
                  : "text-emerald-600"
              }`}
            >
              {syncResult}
            </span>
          )}

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              border transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60
              ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }
            `}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
            />
            Sync Users
          </button>
        </div>

        {/* Org Cards Grid */}
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allOrgs.map((org) => {
              const orgColor = getOrgColor(org.color);
              const isExpanded = expandedOrgId === org.id;

              return (
                <div key={org.id}>
                  <button
                    onClick={() =>
                      setExpandedOrgId((prev) =>
                        prev === org.id ? null : org.id
                      )
                    }
                    className={`
                      w-full rounded-xl border p-4 cursor-pointer transition-all text-left
                      ${
                        isDarkMode
                          ? `bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:shadow-lg hover:shadow-black/20 ${
                              isExpanded ? "ring-1 ring-indigo-500/40 border-indigo-500/30" : ""
                            }`
                          : `bg-white border-slate-200/80 hover:shadow-md hover:border-slate-300 ${
                              isExpanded ? "ring-1 ring-indigo-500/30 border-indigo-300" : ""
                            }`
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      {/* Org Icon */}
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isDarkMode ? orgColor.dark : orgColor.light
                        }`}
                      >
                        <Building2 className="w-4 h-4" />
                      </div>

                      {/* Org Info */}
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-sm font-semibold block truncate ${
                            isDarkMode ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {org.name}
                        </span>
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          {org.memberCount} member{org.memberCount !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Member Count Badge */}
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          isDarkMode
                            ? "bg-slate-700 text-slate-300"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {org.memberCount}
                      </span>

                      {/* Chevron */}
                      <ChevronRight
                        className={`w-4 h-4 transition-transform duration-200 shrink-0 ${
                          isExpanded ? "rotate-90" : ""
                        } ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}
                      />
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── Expanded Org Members ──────────────────────────────────────────── */}
          {expandedOrgId && (
            <div
              className={`
                mt-4 rounded-xl border overflow-hidden
                animate-in fade-in slide-in-from-top-2 duration-200
                ${
                  isDarkMode
                    ? "bg-slate-800/40 border-slate-700/50"
                    : "bg-slate-50/80 border-slate-200/80"
                }
              `}
            >
              {/* Expanded Header */}
              <div
                className="px-4 py-3 flex items-center gap-2 border-b"
                style={{
                  borderColor: isDarkMode
                    ? "rgba(51,65,85,0.5)"
                    : "rgba(226,232,240,0.8)",
                }}
              >
                <Shield
                  className={`w-3.5 h-3.5 ${
                    isDarkMode ? "text-indigo-400" : "text-indigo-600"
                  }`}
                />
                <span
                  className={`text-xs font-semibold ${
                    isDarkMode ? "text-white" : "text-slate-800"
                  }`}
                >
                  Members of{" "}
                  {allOrgs.find((o) => o.id === expandedOrgId)?.name ?? expandedOrgId}
                </span>
              </div>

              {/* Members List */}
              {(orgMembers[expandedOrgId] ?? []).length === 0 ? (
                <div className="px-4 py-8 flex flex-col items-center justify-center gap-2">
                  <Users
                    className={`w-7 h-7 ${
                      isDarkMode ? "text-slate-600" : "text-slate-300"
                    }`}
                  />
                  <p
                    className={`text-xs text-center ${
                      isDarkMode ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    No members in this organization yet.
                    <br />
                    Click &quot;Sync Users&quot; or add manually below.
                  </p>
                </div>
              ) : (
                <div
                  className="divide-y"
                  style={{
                    borderColor: isDarkMode
                      ? "rgba(51,65,85,0.4)"
                      : "rgba(226,232,240,0.6)",
                  }}
                >
                  {(orgMembers[expandedOrgId] ?? []).map((member) => {
                    const initial = (
                      member.displayName ||
                      member.email ||
                      "?"
                    )
                      .charAt(0)
                      .toUpperCase();
                    const roleColors = ROLE_COLORS[member.role];
                    const isChangingThis = changingRole === member.uid;
                    const isRoleOpen = roleDropdownUid === member.uid;
                    const isConfirmingRemove =
                      confirmRemove?.orgId === expandedOrgId &&
                      confirmRemove?.uid === member.uid;

                    return (
                      <div
                        key={member.uid}
                        className={`px-4 py-3 flex items-center gap-3 transition-colors ${
                          isDarkMode
                            ? "hover:bg-slate-700/30"
                            : "hover:bg-white/80"
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                            isDarkMode
                              ? "bg-slate-700 text-slate-300"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {initial}
                        </div>

                        {/* Name + Email */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-sm font-medium truncate ${
                                isDarkMode ? "text-white" : "text-slate-900"
                              }`}
                            >
                              {member.displayName || member.email}
                            </span>
                            {member.role === "owner" && (
                              <Crown
                                className={`w-3 h-3 shrink-0 ${
                                  isDarkMode
                                    ? "text-amber-400"
                                    : "text-amber-500"
                                }`}
                              />
                            )}
                          </div>
                          {member.displayName && (
                            <p
                              className={`text-xs truncate mt-0.5 ${
                                isDarkMode
                                  ? "text-slate-500"
                                  : "text-slate-400"
                              }`}
                            >
                              {member.email}
                            </p>
                          )}
                        </div>

                        {/* Role Badge / Dropdown */}
                        <div
                          className="relative shrink-0"
                          ref={isRoleOpen ? roleDropdownRef : undefined}
                        >
                          {isChangingThis ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1">
                              <Loader2
                                className={`w-3 h-3 animate-spin ${
                                  isDarkMode
                                    ? "text-slate-400"
                                    : "text-slate-500"
                                }`}
                              />
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                setRoleDropdownUid((prev) =>
                                  prev === member.uid ? null : member.uid
                                )
                              }
                              className={`
                                inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold
                                border transition-all cursor-pointer
                                ${
                                  isDarkMode
                                    ? `${roleColors.darkBg} ${roleColors.darkText} ${roleColors.darkBorder} hover:brightness-125`
                                    : `${roleColors.bg} ${roleColors.text} ${roleColors.border} hover:brightness-95`
                                }
                              `}
                            >
                              {ROLE_LABELS[member.role]}
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  isRoleOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          )}

                          {/* Role Dropdown */}
                          {isRoleOpen && (
                            <div
                              className={`
                                absolute right-0 top-full mt-1 z-50 min-w-[140px]
                                rounded-lg border shadow-lg overflow-hidden
                                animate-in fade-in slide-in-from-top-1 duration-150
                                ${
                                  isDarkMode
                                    ? "bg-slate-800 border-slate-700 shadow-black/40"
                                    : "bg-white border-slate-200 shadow-slate-200/60"
                                }
                              `}
                            >
                              {ALL_ROLES.map((r) => {
                                const rColors = ROLE_COLORS[r];
                                const isCurrentRole = r === member.role;

                                return (
                                  <button
                                    key={r}
                                    onClick={() =>
                                      handleRoleChange(
                                        member.uid,
                                        expandedOrgId,
                                        r
                                      )
                                    }
                                    disabled={isCurrentRole}
                                    className={`
                                      w-full px-3 py-2 flex items-center justify-between gap-2
                                      text-xs font-medium transition-colors
                                      ${
                                        isCurrentRole
                                          ? isDarkMode
                                            ? "bg-slate-700/50 cursor-default"
                                            : "bg-slate-50 cursor-default"
                                          : isDarkMode
                                          ? "hover:bg-slate-700/70 cursor-pointer"
                                          : "hover:bg-slate-50 cursor-pointer"
                                      }
                                      ${
                                        isDarkMode
                                          ? rColors.darkText
                                          : rColors.text
                                      }
                                    `}
                                  >
                                    <span className="flex items-center gap-2">
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          isDarkMode
                                            ? rColors.darkBg
                                            : rColors.bg
                                        }`}
                                        style={{
                                          boxShadow: `inset 0 0 0 1px ${
                                            isDarkMode
                                              ? "rgba(255,255,255,0.1)"
                                              : "rgba(0,0,0,0.05)"
                                          }`,
                                        }}
                                      />
                                      {ROLE_LABELS[r]}
                                    </span>
                                    {isCurrentRole && (
                                      <Check
                                        className={`w-3 h-3 ${
                                          isDarkMode
                                            ? "text-emerald-400"
                                            : "text-emerald-600"
                                        }`}
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Remove Button */}
                        <div className="shrink-0">
                          {isConfirmingRemove ? (
                            <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                              <span
                                className={`text-[10px] font-medium ${
                                  isDarkMode
                                    ? "text-slate-400"
                                    : "text-slate-500"
                                }`}
                              >
                                Remove?
                              </span>
                              <button
                                onClick={() =>
                                  handleRemoveUser(member.uid, expandedOrgId)
                                }
                                disabled={isRemoving}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  isDarkMode
                                    ? "hover:bg-red-900/30 text-red-400"
                                    : "hover:bg-red-50 text-red-500"
                                }`}
                              >
                                {isRemoving ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmRemove(null)}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  isDarkMode
                                    ? "hover:bg-slate-700 text-slate-400"
                                    : "hover:bg-slate-100 text-slate-500"
                                }`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                setConfirmRemove({
                                  orgId: expandedOrgId,
                                  uid: member.uid,
                                })
                              }
                              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                isDarkMode
                                  ? "hover:bg-red-900/30 text-slate-500 hover:text-red-400"
                                  : "hover:bg-red-50 text-slate-400 hover:text-red-500"
                              }`}
                              title="Remove from organization"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add User Row */}
              <div
                className="px-4 py-3 border-t"
                style={{
                  borderColor: isDarkMode
                    ? "rgba(51,65,85,0.5)"
                    : "rgba(226,232,240,0.8)",
                }}
              >
                {addingUserToOrg?.orgId === expandedOrgId ? (
                  <div
                    ref={addUserDropdownRef}
                    className="animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      {/* User Select */}
                      <select
                        value={addingUserToOrg.uid}
                        onChange={(e) =>
                          setAddingUserToOrg((prev) =>
                            prev ? { ...prev, uid: e.target.value } : null
                          )
                        }
                        className={`
                          flex-1 px-3 py-1.5 rounded-lg text-xs border transition-colors
                          ${
                            isDarkMode
                              ? "bg-slate-800 border-slate-700 text-white"
                              : "bg-white border-slate-200 text-slate-900"
                          }
                        `}
                      >
                        <option value="">Select a user…</option>
                        {allUsers
                          .filter(
                            (u) =>
                              !(orgMembers[expandedOrgId] ?? []).some(
                                (m) => m.uid === u.uid
                              )
                          )
                          .map((u) => (
                            <option key={u.uid} value={u.uid}>
                              {u.displayName || u.email} ({u.email})
                            </option>
                          ))}
                      </select>

                      {/* Role Select */}
                      <select
                        value={addingUserToOrg.role}
                        onChange={(e) =>
                          setAddingUserToOrg((prev) =>
                            prev
                              ? { ...prev, role: e.target.value as OrgRole }
                              : null
                          )
                        }
                        className={`
                          px-3 py-1.5 rounded-lg text-xs border transition-colors
                          ${
                            isDarkMode
                              ? "bg-slate-800 border-slate-700 text-white"
                              : "bg-white border-slate-200 text-slate-900"
                          }
                        `}
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>

                      {/* Add / Cancel */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            if (addingUserToOrg.uid) {
                              handleAddUser(
                                addingUserToOrg.uid,
                                addingUserToOrg.orgId,
                                addingUserToOrg.role
                              );
                            }
                          }}
                          disabled={!addingUserToOrg.uid || isAddingUser}
                          className={`
                            px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                            disabled:opacity-50 disabled:cursor-not-allowed
                            ${
                              isDarkMode
                                ? "bg-indigo-600 text-white hover:bg-indigo-500"
                                : "bg-indigo-600 text-white hover:bg-indigo-700"
                            }
                          `}
                        >
                          {isAddingUser ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            "Add"
                          )}
                        </button>
                        <button
                          onClick={() => setAddingUserToOrg(null)}
                          className={`
                            p-1.5 rounded-lg transition-colors cursor-pointer
                            ${
                              isDarkMode
                                ? "hover:bg-slate-700 text-slate-400"
                                : "hover:bg-slate-100 text-slate-500"
                            }
                          `}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      setAddingUserToOrg({
                        orgId: expandedOrgId,
                        uid: "",
                        role: "user",
                      })
                    }
                    className={`
                      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                      border transition-all cursor-pointer
                      ${
                        isDarkMode
                          ? "border-dashed border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300 hover:bg-slate-800/50"
                          : "border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-600 hover:bg-slate-50"
                      }
                    `}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add User to Organization
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Global Users Table ───────────────────────────────────── */}
      <div
        className={`rounded-xl border ${
          isDarkMode
            ? "bg-slate-900/80 border-slate-700/60"
            : "bg-white border-[#ede8da]/80"
        }`}
      >
        {/* Section Header */}
        <div
          className="px-5 py-4 flex items-center gap-3 border-b"
          style={{
            borderColor: isDarkMode
              ? "rgba(51,65,85,0.6)"
              : "rgba(237,232,218,0.8)",
          }}
        >
          <div
            className={`p-2 rounded-lg ${
              isDarkMode ? "bg-emerald-900/40" : "bg-emerald-50"
            }`}
          >
            <Users
              className={`w-4 h-4 ${
                isDarkMode ? "text-emerald-400" : "text-emerald-600"
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className={`text-sm font-semibold ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}
            >
              All Registered Users
            </h3>
            <p
              className={`text-xs mt-0.5 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {allUsers.length} user{allUsers.length !== 1 ? "s" : ""} across
              the platform
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3">
          <div className="relative">
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className={`
                w-full pl-9 pr-3 py-2 rounded-lg text-xs border transition-colors
                ${
                  isDarkMode
                    ? "bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500/50"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-300"
                }
                focus:outline-none focus:ring-1 focus:ring-indigo-500/20
              `}
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="max-h-[400px] overflow-y-auto">
          {/* Table Header */}
          <div
            className={`px-5 py-2 grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-center text-[10px] font-semibold uppercase tracking-wider border-y sticky top-0 z-10 ${
              isDarkMode
                ? "bg-slate-800/90 border-slate-700/60 text-slate-500 backdrop-blur-sm"
                : "bg-slate-50/90 border-slate-200/80 text-slate-400 backdrop-blur-sm"
            }`}
          >
            <span className="w-7" />
            <span>User</span>
            <span>Organizations</span>
            <span>Status</span>
          </div>

          {/* Table Rows */}
          {filteredUsers.length === 0 ? (
            <div className="px-5 py-8 flex flex-col items-center justify-center gap-2">
              <Search
                className={`w-6 h-6 ${
                  isDarkMode ? "text-slate-600" : "text-slate-300"
                }`}
              />
              <p
                className={`text-xs ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              >
                No users match your search
              </p>
            </div>
          ) : (
            <div
              className="divide-y"
              style={{
                borderColor: isDarkMode
                  ? "rgba(51,65,85,0.3)"
                  : "rgba(226,232,240,0.5)",
              }}
            >
              {filteredUsers.map((user) => {
                const initial = (user.displayName || user.email || "?")
                  .charAt(0)
                  .toUpperCase();
                const userOrgs = getUserOrgs(user.uid);

                return (
                  <div
                    key={user.uid}
                    className={`px-5 py-3 grid grid-cols-[auto_1fr_1fr_auto] gap-3 items-center transition-colors ${
                      isDarkMode
                        ? "hover:bg-slate-800/40"
                        : "hover:bg-slate-50/60"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                        isDarkMode
                          ? "bg-slate-700 text-slate-300"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {initial}
                    </div>

                    {/* Name + Email */}
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          isDarkMode ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {user.displayName || user.email}
                      </p>
                      {user.displayName && (
                        <p
                          className={`text-xs truncate mt-0.5 ${
                            isDarkMode ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          {user.email}
                        </p>
                      )}
                    </div>

                    {/* Org Pills */}
                    <div className="flex flex-wrap gap-1 min-w-0">
                      {userOrgs.length === 0 ? (
                        <span
                          className={`text-[10px] italic ${
                            isDarkMode ? "text-slate-600" : "text-slate-400"
                          }`}
                        >
                          No org
                        </span>
                      ) : (
                        userOrgs.map((uo) => {
                          const oColor = getOrgColor(uo.color);
                          return (
                            <span
                              key={uo.orgId}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${
                                isDarkMode
                                  ? `${oColor.dark} ${oColor.darkAccent}`
                                  : `${oColor.light} ${oColor.accent}`
                              }`}
                            >
                              {uo.orgName}
                            </span>
                          );
                        })
                      )}
                    </div>

                    {/* Status */}
                    <span
                      className={`text-[10px] font-medium whitespace-nowrap ${
                        user.walkthroughCompleted
                          ? isDarkMode
                            ? "text-emerald-400"
                            : "text-emerald-600"
                          : isDarkMode
                          ? "text-amber-400"
                          : "text-amber-600"
                      }`}
                    >
                      {user.walkthroughCompleted ? "✅ Active" : "⏳ Pending"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
