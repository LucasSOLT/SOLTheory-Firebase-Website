"use client";

/**
 * @file OrgRBACPanel.tsx
 * @description Settings panel for managing organizational Role-Based Access Control.
 * Shows all org members in a table with role badges and allows admins/owners
 * to change member roles via a dropdown. Also cross-references the global /users
 * collection to surface unassigned users that can be added to the org.
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
  ChevronDown,
  ChevronUp,
  Crown,
  Check,
  Loader2,
  UserPlus,
  Info,
} from "lucide-react";
import type { OrgRole, OrgMember } from "@/lib/rbac";
import {
  ROLE_LABELS,
  ROLE_COLORS,
  ALL_ROLES,
  canModifyMember,
  getAssignableRoles,
  hasPermission,
} from "@/lib/rbac";

/* ─── Org ↔ Email Domain mapping ─────────────────────────────────────────────── */

const ORG_EMAIL_DOMAINS: Record<string, string[]> = {
  soltheory: ["@soltheory.com"],
  nxtchapter: ["@nxtchapter.com", "@nxtchapter.org"],
  lnu: ["@lifenavigationu.com"],
};

/** Human-readable org names */
const ORG_DISPLAY_NAMES: Record<string, string> = {
  soltheory: "SOL Theory",
  nxtchapter: "NXT Chapter",
  lnu: "Life Navigation U",
};

/* ─── Role descriptions for guide ────────────────────────────────────────────── */

const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Full platform access. Manage all roles, fields, instances. Delete anything.",
  admin: "Full CRM access. Manage fields, import/export. Cannot manage roles.",
  "super-user": "View, edit, import/export contacts. Cannot delete or manage fields.",
  user: "View and edit contacts. Basic CRM access.",
  "read-only": "View contacts only. No modifications allowed.",
};

/* ─── Props ──────────────────────────────────────────────────────────────────── */

interface OrgRBACPanelProps {
  orgId?: string;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export default function OrgRBACPanel({ orgId = "soltheory" }: OrgRBACPanelProps) {
  const { isDarkMode } = useTheme();
  const { role: currentUserRole, members, setMemberRole, isLoading } = useOrgRole(orgId);
  const firestore = useFirestore();

  const [openDropdownUid, setOpenDropdownUid] = useState<string | null>(null);
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ─── New state for cross-referencing /users and role guide ───────────────── */
  const [globalUsers, setGlobalUsers] = useState<{ uid: string; email: string; displayName: string }[]>([]);
  const [assigningUid, setAssigningUid] = useState<string | null>(null);
  const [assignRole, setAssignRole] = useState<OrgRole>("user");
  const [showRoleGuide, setShowRoleGuide] = useState(false);

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

    const domains = ORG_EMAIL_DOMAINS[orgId] ?? [];
    if (domains.length === 0) return;

    const usersRef = collection(firestore, "users");
    const q = query(usersRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const filtered: { uid: string; email: string; displayName: string }[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const email = (data.email || "").toLowerCase();
            const matchesDomain = domains.some((d) => email.endsWith(d));
            if (matchesDomain) {
              filtered.push({
                uid: docSnap.id,
                email: data.email || "",
                displayName: data.displayName || data.name || "",
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

  const handleAssignUser = useCallback(
    async (user: { uid: string; email: string; displayName: string }, role: OrgRole) => {
      if (!firestore) return;
      setAssigningUid(user.uid);
      try {
        const memberDocRef = doc(firestore, "orgs", orgId, "members", user.uid);
        await setDoc(memberDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role,
          joinedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[OrgRBACPanel] Failed to assign user:", err);
      } finally {
        setAssigningUid(null);
      }
    },
    [firestore, orgId]
  );

  const assignableRoles = getAssignableRoles(currentUserRole);
  const orgDisplayName = ORG_DISPLAY_NAMES[orgId] || orgId;

  /* ─── Loading State ────────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div
        className={`rounded-xl border p-8 flex items-center justify-center ${
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
          Loading members…
        </span>
      </div>
    );
  }

  /* ─── Main Render ──────────────────────────────────────────────────────────── */

  return (
    <div
      className={`rounded-xl border transition-shadow ${
        isDarkMode
          ? "bg-slate-900/80 border-slate-700/60"
          : "bg-white border-[#ede8da]/80"
      }`}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 flex items-center gap-3 border-b"
        style={{
          borderColor: isDarkMode ? "rgba(51,65,85,0.6)" : "rgba(237,232,218,0.8)",
        }}
      >
        <div
          className={`p-2 rounded-lg ${
            isDarkMode ? "bg-indigo-900/40" : "bg-indigo-50"
          }`}
        >
          <Shield
            className={`w-4 h-4 ${
              isDarkMode ? "text-indigo-400" : "text-indigo-600"
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={`text-sm font-semibold ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            {orgDisplayName} — Access Control
          </h3>
          <p
            className={`text-xs mt-0.5 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {members.length} active member{members.length !== 1 ? "s" : ""}
            {unassignedUsers.length > 0 && (
              <span
                className={`ml-1 ${
                  isDarkMode ? "text-amber-400/80" : "text-amber-600/80"
                }`}
              >
                · {unassignedUsers.length} unassigned
              </span>
            )}
          </p>
        </div>
        <Users
          className={`w-4 h-4 ${
            isDarkMode ? "text-slate-500" : "text-slate-400"
          }`}
        />
      </div>

      {/* ── Role Guide (collapsible) ────────────────────────────────────────── */}
      <div
        className="px-5 py-3 border-b"
        style={{
          borderColor: isDarkMode ? "rgba(51,65,85,0.4)" : "rgba(237,232,218,0.6)",
        }}
      >
        <button
          onClick={() => setShowRoleGuide((prev) => !prev)}
          className={`
            flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer
            ${isDarkMode ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}
          `}
        >
          <Info className="w-3.5 h-3.5" />
          <span>📖 Understanding Roles</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              showRoleGuide ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Expanded guide content */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            showRoleGuide ? "max-h-[500px] opacity-100 mt-3" : "max-h-0 opacity-0"
          }`}
        >
          <div
            className={`rounded-xl border p-4 ${
              isDarkMode
                ? "bg-slate-800/60 border-slate-700/50"
                : "bg-slate-50/80 border-[#ede8da]/60"
            }`}
          >
            <div className="space-y-2.5">
              {(["owner", "admin", "super-user", "user", "read-only"] as OrgRole[]).map((role) => {
                const colors = ROLE_COLORS[role];
                return (
                  <div key={role} className="flex items-start gap-3">
                    <span
                      className={`
                        inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 mt-0.5
                        ${isDarkMode
                          ? `${colors.darkBg} ${colors.darkText} ${colors.darkBorder}`
                          : `${colors.bg} ${colors.text} ${colors.border}`
                        }
                      `}
                      style={{ minWidth: "72px", justifyContent: "center" }}
                    >
                      {ROLE_LABELS[role]}
                    </span>
                    <span
                      className={`text-xs leading-relaxed ${
                        isDarkMode ? "text-slate-400" : "text-slate-600"
                      }`}
                    >
                      {ROLE_DESCRIPTIONS[role]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Members Section ──────────────────────────────────────────── */}
      <div>
        <div
          className={`px-5 py-2.5 flex items-center gap-2 ${
            isDarkMode ? "bg-slate-800/30" : "bg-slate-50/50"
          }`}
          style={{
            borderBottom: `1px solid ${isDarkMode ? "rgba(51,65,85,0.4)" : "rgba(237,232,218,0.6)"}`,
          }}
        >
          <Shield
            className={`w-3.5 h-3.5 ${
              isDarkMode ? "text-emerald-400/70" : "text-emerald-600/70"
            }`}
          />
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Active Members ({members.length})
          </span>
        </div>

        {members.length === 0 ? (
          /* Empty State */
          <div className="px-5 py-10 flex flex-col items-center justify-center gap-2">
            <Users
              className={`w-8 h-8 ${
                isDarkMode ? "text-slate-600" : "text-slate-300"
              }`}
            />
            <p
              className={`text-sm ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              No members found
            </p>
          </div>
        ) : (
          <div className="divide-y"
            style={{
              borderColor: isDarkMode ? "rgba(51,65,85,0.4)" : "rgba(237,232,218,0.6)",
            }}
          >
            {members.map((member) => (
              <MemberRow
                key={member.uid}
                member={member}
                currentUserRole={currentUserRole}
                assignableRoles={assignableRoles}
                isDarkMode={isDarkMode}
                isOpen={openDropdownUid === member.uid}
                isChanging={changingRoleFor === member.uid}
                onToggleDropdown={() =>
                  setOpenDropdownUid((prev) =>
                    prev === member.uid ? null : member.uid
                  )
                }
                onRoleChange={handleRoleChange}
                dropdownRef={openDropdownUid === member.uid ? dropdownRef : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Unassigned Users Section ────────────────────────────────────────── */}
      {unassignedUsers.length > 0 && (
        <div>
          {/* Section divider */}
          <div
            className={`px-5 py-2.5 flex items-center gap-2 ${
              isDarkMode ? "bg-amber-900/10" : "bg-amber-50/60"
            }`}
            style={{
              borderTop: `1px solid ${isDarkMode ? "rgba(51,65,85,0.4)" : "rgba(237,232,218,0.6)"}`,
              borderBottom: `1px solid ${isDarkMode ? "rgba(51,65,85,0.4)" : "rgba(237,232,218,0.6)"}`,
            }}
          >
            <UserPlus
              className={`w-3.5 h-3.5 ${
                isDarkMode ? "text-amber-400/70" : "text-amber-600/70"
              }`}
            />
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                isDarkMode ? "text-amber-400/80" : "text-amber-700/70"
              }`}
            >
              Unassigned Users ({unassignedUsers.length})
            </span>
          </div>

          <div
            className="divide-y"
            style={{
              borderColor: isDarkMode ? "rgba(51,65,85,0.4)" : "rgba(237,232,218,0.6)",
            }}
          >
            {unassignedUsers.map((user) => (
              <UnassignedRow
                key={user.uid}
                user={user}
                isDarkMode={isDarkMode}
                assignableRoles={assignableRoles}
                isAssigning={assigningUid === user.uid}
                assignRole={assignRole}
                onAssignRoleChange={setAssignRole}
                onAssign={handleAssignUser}
                canAssign={hasPermission(currentUserRole, "admin")}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Member Row ─────────────────────────────────────────────────────────────── */

interface MemberRowProps {
  member: OrgMember;
  currentUserRole: OrgRole;
  assignableRoles: OrgRole[];
  isDarkMode: boolean;
  isOpen: boolean;
  isChanging: boolean;
  onToggleDropdown: () => void;
  onRoleChange: (uid: string, newRole: OrgRole) => void;
  dropdownRef?: React.RefObject<HTMLDivElement | null>;
}

function MemberRow({
  member,
  currentUserRole,
  assignableRoles,
  isDarkMode,
  isOpen,
  isChanging,
  onToggleDropdown,
  onRoleChange,
  dropdownRef,
}: MemberRowProps) {
  const canModify = canModifyMember(currentUserRole, member.role);
  const initial = (member.displayName || member.email || "?").charAt(0).toUpperCase();
  const colors = ROLE_COLORS[member.role];
  const isOwner = member.role === "owner";

  return (
    <div
      className={`relative px-5 py-3 flex items-center gap-3 transition-colors ${
        isDarkMode
          ? "hover:bg-slate-800/50"
          : "hover:bg-slate-50/80"
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
          isDarkMode
            ? "bg-slate-700 text-slate-300"
            : "bg-slate-100 text-slate-600"
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
          {isOwner && (
            <Crown
              className={`w-3 h-3 shrink-0 ${
                isDarkMode ? "text-amber-400" : "text-amber-500"
              }`}
            />
          )}
        </div>
        {member.displayName && (
          <p
            className={`text-xs truncate mt-0.5 ${
              isDarkMode ? "text-slate-500" : "text-slate-400"
            }`}
          >
            {member.email}
          </p>
        )}
      </div>

      {/* Role Badge / Dropdown Trigger */}
      <div className="relative shrink-0" ref={dropdownRef}>
        {isChanging ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1">
            <Loader2
              className={`w-3 h-3 animate-spin ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            />
          </div>
        ) : canModify ? (
          <button
            onClick={onToggleDropdown}
            className={`
              inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold
              border transition-all cursor-pointer
              ${isDarkMode
                ? `${colors.darkBg} ${colors.darkText} ${colors.darkBorder} hover:brightness-125`
                : `${colors.bg} ${colors.text} ${colors.border} hover:brightness-95`
              }
            `}
          >
            {ROLE_LABELS[member.role]}
            <ChevronDown
              className={`w-3 h-3 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        ) : (
          <span
            className={`
              inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-semibold border
              ${isDarkMode
                ? `${colors.darkBg} ${colors.darkText} ${colors.darkBorder}`
                : `${colors.bg} ${colors.text} ${colors.border}`
              }
            `}
          >
            {ROLE_LABELS[member.role]}
          </span>
        )}

        {/* Dropdown */}
        {isOpen && canModify && (
          <div
            className={`
              absolute right-0 top-full mt-1 z-50 min-w-[140px]
              rounded-lg border shadow-lg overflow-hidden
              animate-in fade-in slide-in-from-top-1 duration-150
              ${isDarkMode
                ? "bg-slate-800 border-slate-700 shadow-black/40"
                : "bg-white border-slate-200 shadow-slate-200/60"
              }
            `}
          >
            {assignableRoles.map((r) => {
              const rColors = ROLE_COLORS[r];
              const isCurrentRole = r === member.role;

              return (
                <button
                  key={r}
                  onClick={() => onRoleChange(member.uid, r)}
                  disabled={isCurrentRole}
                  className={`
                    w-full px-3 py-2 flex items-center justify-between gap-2
                    text-xs font-medium transition-colors
                    ${isCurrentRole
                      ? isDarkMode
                        ? "bg-slate-700/50 cursor-default"
                        : "bg-slate-50 cursor-default"
                      : isDarkMode
                        ? "hover:bg-slate-700/70 cursor-pointer"
                        : "hover:bg-slate-50 cursor-pointer"
                    }
                    ${isDarkMode ? rColors.darkText : rColors.text}
                  `}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isDarkMode ? rColors.darkBg : rColors.bg
                      }`}
                      style={{
                        // Ensure the dot is visible even when bg class is semi-transparent
                        boxShadow: `inset 0 0 0 1px ${
                          isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"
                        }`,
                      }}
                    />
                    {ROLE_LABELS[r]}
                  </span>
                  {isCurrentRole && (
                    <Check
                      className={`w-3 h-3 ${
                        isDarkMode ? "text-emerald-400" : "text-emerald-600"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Unassigned User Row ────────────────────────────────────────────────────── */

interface UnassignedRowProps {
  user: { uid: string; email: string; displayName: string };
  isDarkMode: boolean;
  assignableRoles: OrgRole[];
  isAssigning: boolean;
  assignRole: OrgRole;
  onAssignRoleChange: (role: OrgRole) => void;
  onAssign: (user: { uid: string; email: string; displayName: string }, role: OrgRole) => void;
  canAssign: boolean;
}

function UnassignedRow({
  user,
  isDarkMode,
  assignableRoles,
  isAssigning,
  assignRole,
  onAssignRoleChange,
  onAssign,
  canAssign,
}: UnassignedRowProps) {
  const initial = (user.displayName || user.email || "?").charAt(0).toUpperCase();
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  const [localRole, setLocalRole] = useState<OrgRole>("user");

  return (
    <div
      className={`relative px-5 py-3 flex items-center gap-3 transition-colors ${
        isDarkMode
          ? "hover:bg-slate-800/30 bg-amber-950/5"
          : "hover:bg-amber-50/40 bg-amber-50/20"
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
          isDarkMode
            ? "bg-amber-900/30 text-amber-300/70 border border-amber-800/40"
            : "bg-amber-100/60 text-amber-700/70 border border-amber-200/60"
        }`}
      >
        {initial}
      </div>

      {/* Name + Email */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-sm font-medium truncate ${
              isDarkMode ? "text-slate-300" : "text-slate-700"
            }`}
          >
            {user.displayName || user.email}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium ${
              isDarkMode
                ? "bg-amber-900/30 text-amber-400/80 border border-amber-800/40"
                : "bg-amber-100/70 text-amber-700/80 border border-amber-200/60"
            }`}
          >
            Unassigned
          </span>
        </div>
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

      {/* Assign controls */}
      <div className="shrink-0 flex items-center gap-2">
        {isAssigning ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1">
            <Loader2
              className={`w-3 h-3 animate-spin ${
                isDarkMode ? "text-amber-400" : "text-amber-600"
              }`}
            />
          </div>
        ) : showRoleSelect && canAssign ? (
          /* Inline role selector */
          <div className="flex items-center gap-1.5">
            <select
              value={localRole}
              onChange={(e) => setLocalRole(e.target.value as OrgRole)}
              className={`
                text-[11px] font-medium rounded-md px-2 py-1 border cursor-pointer
                transition-colors appearance-none
                ${isDarkMode
                  ? "bg-slate-800 text-slate-300 border-slate-600 focus:border-amber-500"
                  : "bg-white text-slate-700 border-slate-300 focus:border-amber-500"
                }
              `}
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
              className={`
                inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold
                border transition-all cursor-pointer
                ${isDarkMode
                  ? "bg-emerald-900/40 text-emerald-300 border-emerald-800 hover:bg-emerald-900/60"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                }
              `}
            >
              <Check className="w-3 h-3" />
              Confirm
            </button>
            <button
              onClick={() => setShowRoleSelect(false)}
              className={`
                px-1.5 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer
                ${isDarkMode
                  ? "text-slate-500 hover:text-slate-300"
                  : "text-slate-400 hover:text-slate-600"
                }
              `}
            >
              ✕
            </button>
          </div>
        ) : canAssign ? (
          <button
            onClick={() => setShowRoleSelect(true)}
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold
              border transition-all cursor-pointer
              ${isDarkMode
                ? "bg-amber-900/30 text-amber-300 border-amber-800/60 hover:bg-amber-900/50"
                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
              }
            `}
          >
            <UserPlus className="w-3 h-3" />
            Assign
          </button>
        ) : (
          <span
            className={`text-[10px] ${
              isDarkMode ? "text-slate-600" : "text-slate-400"
            }`}
          >
            No permission
          </span>
        )}
      </div>
    </div>
  );
}
