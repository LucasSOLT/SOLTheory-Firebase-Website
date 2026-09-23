"use client";

/**
 * @file OrgRBACPanel.tsx
 * @description Settings panel for managing organizational Role-Based Access Control.
 * Renders a full-page "End User Dashboard" style UI with:
 *   - Oracle Mode card (for Oracle users to test different role perspectives)
 *   - 4-column member table (First Name, Last Name, Email, Access Level)
 *   - Unassigned users section for domain-matching users not yet in the org
 *   - Sticky Access Levels reference panel
 * Intended to be embedded inside the Settings > Security page — the parent page
 * handles visibility gating.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useOrgRole } from "@/hooks/useOrgRole";
import { useUser, useFirestore } from "@/firebase";
import { collection, query, onSnapshot, doc, setDoc } from "firebase/firestore";
import {
  Users,
  Shield,
  ShieldAlert,
  Eye,
  Settings,
  ChevronDown,
  Crown,
  Check,
  Loader2,
  UserPlus,
  Trash2,
  Sparkles,
} from "lucide-react";
import type { OrgRole, OrgMember } from "@/lib/rbac";
import {
  ROLE_LABELS,
  ROLE_COLORS,
  ALL_ROLES,
  ACCESS_LEVELS,
  ACCESS_LEVEL_INFO,
  canModifyMember,
  getAssignableRoles,
  hasPermission,
} from "@/lib/rbac";
import { getOrgConfig, getOrgLabel, isOracle as checkIsOracle } from "@/lib/org-config";
import { useOrgId } from "@/contexts/OrgContext";
import { getAuthHeaders } from "@/lib/api-auth-client";

/* ─── Role descriptions for reference panel ──────────────────────────────────── */

const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  oracle: "Platform god-mode. Cross-org management. Can modify anyone's role. Reserved for lucas@soltheory.com.",
  admin: "Full CRM management. Manage fields, instances, import/export. Can promote/demote members below admin.",
  user: "View and edit contacts. Basic CRM access. Import and export.",
  "read-only": "View contacts and dashboards only. No modifications allowed.",
};

/* ─── Extended user type with name fields ────────────────────────────────────── */

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
}

/* ─── Props ──────────────────────────────────────────────────────────────────── */

interface OrgRBACPanelProps {
  orgId?: string;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export default function OrgRBACPanel({ orgId: orgIdProp }: OrgRBACPanelProps) {
  const contextOrgId = useOrgId();
  const orgId = orgIdProp || contextOrgId;
  const { isDarkMode } = useTheme();
  const { role: currentUserRole, members, setMemberRole, isLoading, setEffectiveRole } = useOrgRole(orgId);
  const firestore = useFirestore();
  const { user } = useUser();

  const [openDropdownUid, setOpenDropdownUid] = useState<string | null>(null);
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ─── State for cross-referencing /users and Oracle mode ──────────────────── */
  const [globalUsers, setGlobalUsers] = useState<UserProfile[]>([]);
  const [assigningUid, setAssigningUid] = useState<string | null>(null);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

  // Oracle effective role — derived from useOrgRole
  const trueIsOracle = checkIsOracle(user?.email);
  const { role: effectiveRole } = useOrgRole(orgId);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownUid(null);
      }
    }
    if (openDropdownUid) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openDropdownUid]);

  /* ─── Firestore listener for /users collection ───────────────────────────── */
  useEffect(() => {
    if (!firestore) return;

    const orgConfig = getOrgConfig(orgId);
    const domains = orgConfig?.emailDomains.map(d => "@" + d) ?? [];
    if (domains.length === 0) return;

    const usersRef = collection(firestore, "users");
    const q = query(usersRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const filtered: UserProfile[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const email = (data.email || "").toLowerCase();
            const matchesDomain = domains.some((d) => email.endsWith(d));
            if (matchesDomain) {
              filtered.push({
                uid: docSnap.id,
                email: data.email || "",
                displayName: data.displayName || data.name || "",
                firstName: data.firstName || "",
                lastName: data.lastName || "",
              });
            }
          });
          setGlobalUsers(filtered);
        } catch (err) {
          console.error("[OrgRBACPanel] Error processing /users snapshot:", err);
        }
      },
      (error) => {
        console.error("[OrgRBACPanel] /users listener error:", error);
      }
    );

    return () => unsubscribe();
  }, [firestore, orgId]);

  /* ─── Derive unassigned users ─────────────────────────────────────────────── */
  const memberUids = useMemo(() => new Set(members.map((m) => m.uid)), [members]);

  const unassignedUsers = useMemo(
    () => globalUsers.filter((u) => !memberUids.has(u.uid)),
    [globalUsers, memberUids]
  );

  /* ─── Build a map from uid → {firstName, lastName} for member table ──────── */
  const userProfileMap = useMemo(() => {
    const map = new Map<string, { firstName: string; lastName: string }>();
    for (const u of globalUsers) {
      map.set(u.uid, { firstName: u.firstName, lastName: u.lastName });
    }
    return map;
  }, [globalUsers]);

  /* ─── Handlers ────────────────────────────────────────────────────────────── */

  const handleRoleChange = useCallback(
    async (targetUid: string, newRole: OrgRole) => {
      setChangingRoleFor(targetUid);
      setOpenDropdownUid(null);
      try {
        await setMemberRole(targetUid, newRole);
      } catch (err) {
        console.error("[OrgRBACPanel] Failed to change role:", err);
      } finally {
        setChangingRoleFor(null);
      }
    },
    [setMemberRole]
  );

  const handleCleanupDuplicates = useCallback(async () => {
    if (!window.confirm("Clean up cross-org duplicate memberships across all organizations? Accounts will be restricted strictly to their single primary organization.")) return;
    setIsCleaningDuplicates(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/org/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({ action: "cleanup-duplicates" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cleanup failed");
      const removedCount = data.report?.removed?.length || 0;
      alert(`Cleanup complete! Removed ${removedCount} duplicate membership(s). Each account is now locked to its single organization.`);
    } catch (err: any) {
      console.error("[OrgRBACPanel] Cleanup error:", err);
      alert(err.message || "Failed to clean up duplicates");
    } finally {
      setIsCleaningDuplicates(false);
    }
  }, []);

  const handleAssignUser = useCallback(
    async (assignUser: UserProfile, role: OrgRole) => {
      setAssigningUid(assignUser.uid);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/org/members", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            orgId,
            targetUid: assignUser.uid,
            email: assignUser.email,
            displayName: assignUser.displayName,
            role,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to assign user to organization");
        }
      } catch (err: any) {
        console.error("[OrgRBACPanel] Failed to assign user:", err);
        alert(err.message || "Failed to assign user");
      } finally {
        setAssigningUid(null);
      }
    },
    [orgId]
  );

  const handleRemoveMember = useCallback(
    async (member: OrgMember) => {
      const confirm = window.confirm(`Remove ${member.displayName || member.email} from this organization?`);
      if (!confirm) return;

      setChangingRoleFor(member.uid);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/org/members", {
          method: "DELETE",
          headers,
          body: JSON.stringify({ orgId, targetUid: member.uid }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to remove member");
        }
      } catch (err: any) {
        console.error("[OrgRBACPanel] Remove error:", err);
        alert(err.message || "Failed to remove member");
      } finally {
        setChangingRoleFor(null);
      }
    },
    [orgId]
  );

  const assignableRoles = getAssignableRoles(currentUserRole);
  const orgDisplayName = getOrgLabel(orgId);

  /* ─── Loading State ────────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-16 ${isDarkMode ? "bg-slate-900" : "bg-[#faf6ed]"}`}>
        <Loader2 className={`w-5 h-5 animate-spin ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
        <span className={`ml-2 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          Loading members…
        </span>
      </div>
    );
  }

  /* ─── Main Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
          <Users className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {orgDisplayName} — Access Control
          </h3>
          <p className={`text-sm mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            All registered members and their access levels.
          </p>
        </div>
        {currentUserRole === "oracle" && (
          <button
            onClick={handleCleanupDuplicates}
            disabled={isCleaningDuplicates}
            title="Clean up cross-org duplicate accounts across all organizations"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              isDarkMode
                ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400"
                : "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700"
            }`}
          >
            {isCleaningDuplicates ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Clean Duplicates</span>
          </button>
        )}
      </div>

      {/* Oracle Mode Card */}
      {trueIsOracle && (
        <div className={`p-4 sm:p-6 border rounded-lg shadow-sm ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-[#faf6ed] border-slate-900"}`}>
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <h2 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>Oracle Mode</h2>
            <div className="ml-auto flex items-center gap-2">
              <span className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Effective Role:</span>
              <span className="px-2 py-1 text-xs font-bold rounded bg-amber-100 text-amber-800 border border-amber-300">
                {effectiveRole}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setEffectiveRole("read-only")}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${effectiveRole === "read-only" ? "bg-orange-100 text-orange-700 border-orange-300 border" : isDarkMode ? "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-transparent" : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"}`}
            >
              <Eye className="w-4 h-4" />
              Read-Only
            </button>
            <button
              onClick={() => setEffectiveRole("user")}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${effectiveRole === "user" ? "bg-blue-100 text-blue-700 border-blue-300 border" : isDarkMode ? "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-transparent" : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"}`}
            >
              <Users className="w-4 h-4" />
              User
            </button>
            <button
              onClick={() => setEffectiveRole("admin")}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${effectiveRole === "admin" ? "bg-slate-800 text-white border-slate-900 border" : isDarkMode ? "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-transparent" : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"}`}
            >
              <Settings className="w-4 h-4" />
              Admin
            </button>
            <button
              onClick={() => setEffectiveRole("oracle")}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${effectiveRole === "oracle" ? "bg-amber-100 text-amber-800 border border-amber-300" : isDarkMode ? "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-transparent" : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"}`}
            >
              <Shield className="w-4 h-4" />
              Oracle (Restore)
            </button>
          </div>
        </div>
      )}

      {/* Main 2-column layout: Table + Access Levels Panel */}
      <div className="flex gap-6 min-h-0 flex-1">
        {/* Left Column: Member Table */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Active Members Table */}
          <div className={`border rounded-lg overflow-hidden ${isDarkMode ? "border-slate-700" : "border-slate-900"}`}>
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_1fr_1.5fr_auto_auto] bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
              <div className={`px-4 py-3 border-r border-slate-700`}>First Name</div>
              <div className={`px-4 py-3 border-r border-slate-700`}>Last Name</div>
              <div className={`px-4 py-3 border-r border-slate-700`}>Email</div>
              <div className="px-4 py-3 border-r border-slate-700 min-w-[120px]">Access Level</div>
              <div className="px-4 py-3 w-12"></div>
            </div>

            {/* Table Body */}
            {members.length === 0 ? (
              <div className={`px-4 py-8 text-center text-sm ${isDarkMode ? "text-slate-400 bg-slate-900" : "text-slate-400 bg-[#faf6ed]"}`}>
                No members found. Users appear here after they log in.
              </div>
            ) : (
              members.map((member, idx) => {
                const profile = userProfileMap.get(member.uid);
                const firstName = profile?.firstName || "";
                const lastName = profile?.lastName || "";
                const safeRole: OrgRole = (member.role in ROLE_COLORS) ? member.role : "user";
                const canModify = canModifyMember(currentUserRole, safeRole);
                const isOracleMember = safeRole === "oracle";
                const isCurrentUser = user?.uid === member.uid;
                const isUserOracle = currentUserRole === "oracle";
                const canRemove = (isUserOracle && (orgId !== "soltheory" || (!isOracleMember && !isCurrentUser))) ||
                                  (canModify && !isOracleMember && !isCurrentUser);
                const isChanging = changingRoleFor === member.uid;
                const isDropdownOpen = openDropdownUid === member.uid;

                return (
                  <div
                    key={member.uid}
                    className={`grid grid-cols-[1fr_1fr_1.5fr_auto_auto] text-sm border-t ${isDarkMode ? "border-slate-700" : "border-slate-900"} ${idx % 2 === 0 ? (isDarkMode ? "bg-slate-900" : "bg-[#faf6ed]") : (isDarkMode ? "bg-slate-800/50" : "bg-[#f5f0e1]")}`}
                  >
                    <div className={`px-4 py-3 border-r font-medium truncate ${isDarkMode ? "border-slate-700 text-slate-200" : "border-slate-200 text-slate-800"}`}>
                      {firstName || "—"}
                    </div>
                    <div className={`px-4 py-3 border-r font-medium truncate ${isDarkMode ? "border-slate-700 text-slate-200" : "border-slate-200 text-slate-800"}`}>
                      {lastName || "—"}
                    </div>
                    <div className={`px-4 py-3 border-r truncate ${isDarkMode ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-600"}`}>
                      {member.email}
                    </div>
                    <div className="px-4 py-3 relative min-w-[120px] border-r border-slate-200 dark:border-slate-700">
                      {isChanging ? (
                        <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
                      ) : (
                        <>
                          <button
                            title={isOracleMember ? "Oracle role cannot be changed from the UI" : undefined}
                            onClick={() => {
                              if (!canModify) return;
                              setOpenDropdownUid(isDropdownOpen ? null : member.uid);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-colors ${
                              isOracleMember
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : safeRole === "admin"
                                ? "bg-slate-800 text-white"
                                : safeRole === "read-only"
                                ? "bg-orange-100 text-orange-700 border border-orange-300"
                                : "bg-slate-100 text-slate-600"
                            } ${!canModify ? "cursor-default" : "cursor-pointer hover:opacity-80"}`}
                          >
                            {isOracleMember ? "Oracle" : ROLE_LABELS[safeRole]}
                            {canModify && <ChevronDown className="w-3 h-3 opacity-50" />}
                          </button>

                          {/* Role Dropdown */}
                          {isDropdownOpen && canModify && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setOpenDropdownUid(null)} />
                              <div
                                ref={openDropdownUid === member.uid ? dropdownRef : undefined}
                                className={`absolute left-4 top-full mt-1 w-40 border rounded-lg shadow-lg z-40 py-1 animate-in fade-in slide-in-from-top-1 duration-100 ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-[#faf8f3] border-slate-200"}`}
                              >
                                {assignableRoles.map((level) => (
                                  <button
                                    key={level}
                                    onClick={() => handleRoleChange(member.uid, level)}
                                    className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                                      safeRole === level
                                        ? (isDarkMode ? "bg-slate-700 text-white font-bold" : "bg-slate-100 text-slate-900 font-bold")
                                        : (isDarkMode ? "text-slate-300 hover:bg-slate-700 hover:text-white" : "text-slate-600 hover:bg-[#f2ece0] hover:text-slate-900")
                                    }`}
                                  >
                                    {ROLE_LABELS[level]}
                                    {safeRole === level && <span className="ml-1 text-green-600">✓</span>}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    <div className="px-2 py-3 w-12 flex items-center justify-center">
                      {canRemove && !isChanging && (
                        <button
                          onClick={() => handleRemoveMember(member)}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            isDarkMode
                              ? "text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                              : "text-slate-400 hover:bg-red-50 hover:text-red-500"
                          }`}
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Unassigned Users Table */}
          {unassignedUsers.length > 0 && (
            <div>
              <div className={`flex items-center gap-2 mb-3 ${isDarkMode ? "text-amber-400" : "text-amber-700"}`}>
                <UserPlus className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Unassigned Users ({unassignedUsers.length})
                </span>
              </div>
              <div className={`border rounded-lg overflow-hidden ${isDarkMode ? "border-slate-700" : "border-slate-900"}`}>
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_1fr_1.5fr_auto] bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
                  <div className={`px-4 py-3 border-r border-slate-700`}>First Name</div>
                  <div className={`px-4 py-3 border-r border-slate-700`}>Last Name</div>
                  <div className={`px-4 py-3 border-r border-slate-700`}>Email</div>
                  <div className="px-4 py-3 min-w-[120px]">Action</div>
                </div>

                {unassignedUsers.map((u, idx) => (
                  <UnassignedTableRow
                    key={u.uid}
                    user={u}
                    idx={idx}
                    isDarkMode={isDarkMode}
                    assignableRoles={assignableRoles}
                    isAssigning={assigningUid === u.uid}
                    onAssign={handleAssignUser}
                    canAssign={hasPermission(currentUserRole, "admin")}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Access Levels Reference Panel */}
        <div className="w-72 shrink-0 hidden lg:block">
          <div className={`border rounded-lg overflow-hidden sticky top-6 ${isDarkMode ? "border-slate-700" : "border-slate-900"}`}>
            <div className="bg-slate-800 text-white px-4 py-3">
              <h3 className="text-xs font-bold uppercase tracking-wider">Access Levels</h3>
            </div>
            <div className={`divide-y ${isDarkMode ? "divide-slate-700" : "divide-slate-300"}`}>
              {ACCESS_LEVELS.map((level) => {
                const info = ACCESS_LEVEL_INFO[level];
                return (
                  <div key={level} className={`px-4 py-3 ${isDarkMode ? "bg-slate-800" : "bg-[#faf6ed]"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold ${
                        level === "Admin-Level"
                          ? (isDarkMode ? "text-slate-200" : "text-slate-900")
                          : level === "Oracle"
                          ? "text-amber-500"
                          : (isDarkMode ? "text-slate-400" : "text-slate-600")
                      }`}>{level}</span>
                      {info.functional && (
                        <span className="text-[9px] font-bold uppercase tracking-wide text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Active</span>
                      )}
                    </div>
                    <p className={`text-[11px] leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{info.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Unassigned User Table Row ──────────────────────────────────────────────── */

interface UnassignedTableRowProps {
  user: UserProfile;
  idx: number;
  isDarkMode: boolean;
  assignableRoles: OrgRole[];
  isAssigning: boolean;
  onAssign: (user: UserProfile, role: OrgRole) => void;
  canAssign: boolean;
}

function UnassignedTableRow({
  user,
  idx,
  isDarkMode,
  assignableRoles,
  isAssigning,
  onAssign,
  canAssign,
}: UnassignedTableRowProps) {
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [localRole, setLocalRole] = useState<OrgRole>("user");

  return (
    <div
      className={`grid grid-cols-[1fr_1fr_1.5fr_auto] text-sm border-t ${isDarkMode ? "border-slate-700" : "border-slate-900"} ${idx % 2 === 0 ? (isDarkMode ? "bg-slate-900" : "bg-[#faf6ed]") : (isDarkMode ? "bg-slate-800/50" : "bg-[#f5f0e1]")}`}
    >
      <div className={`px-4 py-3 border-r font-medium truncate ${isDarkMode ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-700"}`}>
        {user.firstName || "—"}
      </div>
      <div className={`px-4 py-3 border-r font-medium truncate ${isDarkMode ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-700"}`}>
        {user.lastName || "—"}
      </div>
      <div className={`px-4 py-3 border-r truncate ${isDarkMode ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-600"}`}>
        {user.email}
        <span className={`ml-2 inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium ${
          isDarkMode
            ? "bg-amber-900/30 text-amber-400/80 border border-amber-800/40"
            : "bg-amber-100/70 text-amber-700/80 border border-amber-200/60"
        }`}>
          Unassigned
        </span>
      </div>
      <div className="px-4 py-3 min-w-[120px]">
        {isAssigning ? (
          <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? "text-amber-400" : "text-amber-600"}`} />
        ) : showRoleSelect && canAssign ? (
          <div className="flex items-center gap-1.5">
            <select
              value={localRole}
              onChange={(e) => setLocalRole(e.target.value as OrgRole)}
              className={`text-[11px] font-medium rounded-md px-2 py-1 border cursor-pointer transition-colors appearance-none ${
                isDarkMode
                  ? "bg-slate-800 text-slate-300 border-slate-600 focus:border-amber-500"
                  : "bg-white text-slate-700 border-slate-300 focus:border-amber-500"
              }`}
            >
              {assignableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                onAssign(user, localRole);
                setShowRoleSelect(false);
              }}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border transition-all cursor-pointer ${
                isDarkMode
                  ? "bg-emerald-900/40 text-emerald-300 border-emerald-800 hover:bg-emerald-900/60"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => setShowRoleSelect(false)}
              className={`px-1.5 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                isDarkMode ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              ✕
            </button>
          </div>
        ) : canAssign ? (
          <button
            onClick={() => setShowRoleSelect(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-all cursor-pointer ${
              isDarkMode
                ? "bg-amber-900/30 text-amber-300 border-amber-800/60 hover:bg-amber-900/50"
                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            }`}
          >
            <UserPlus className="w-3 h-3" />
            Assign
          </button>
        ) : (
          <span className={`text-[10px] ${isDarkMode ? "text-slate-600" : "text-slate-400"}`}>
            No permission
          </span>
        )}
      </div>
    </div>
  );
}
