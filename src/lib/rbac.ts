/**
 * @file rbac.ts
 * @description Centralized Role-Based Access Control (RBAC) engine for the Insight platform.
 * Pure TypeScript — no React, no Firebase. Can be used in hooks, components, API routes, and Firestore rules logic.
 *
 * Role Hierarchy (lowest → highest):
 *   read-only (0) → user (1) → admin (2) → oracle (3)
 *
 * Oracle is the platform god-mode — reserved exclusively for lucas@soltheory.com.
 * Oracle can manipulate ANY user across ALL organizations.
 * Oracle cannot be demoted except manually in Firebase Console.
 * Oracle can "fake demote" itself to test other roles while retaining the Oracle badge.
 */

import { ADMIN_EMAILS } from './admin';
import { DEVELOPER_EMAIL, isDeveloper, isOracle, ORACLE_EMAIL, getOrgLabelsMap, getAllOrgIds } from './org-config';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export type OrgRole = "read-only" | "user" | "admin" | "oracle";

export interface OrgMember {
  uid: string;
  email: string;
  displayName: string;
  role: OrgRole;
  effectiveRole?: OrgRole;  // Oracle's fake-demoted role (only set when Oracle is testing other roles)
  joinedAt: string;         // ISO timestamp
  promotedBy?: string;      // UID of the person who last changed this member's role
  promotedAt?: string;      // ISO timestamp of last role change
}

/* ─── Legacy Compat (keep old exports alive until migrated everywhere) ────── */

export const ACCESS_LEVELS = [
  'Read Only',
  'User-Level',
  'Admin-Level',
  'Oracle',
] as const;

export type AccessLevel = typeof ACCESS_LEVELS[number];

export const ACCESS_LEVEL_INFO: Record<AccessLevel, { description: string; functional: boolean }> = {
  'Read Only': {
    description: 'Can view dashboards and reports. Cannot modify or change any data.',
    functional: true,
  },
  'User-Level': {
    description: 'Can view and interact with assigned tools. Cannot access admin features.',
    functional: true,
  },
  'Admin-Level': {
    description: 'Full platform access. Can manage users, content, and system settings for their organization.',
    functional: true,
  },
  'Oracle': {
    description: `Highest level. All Admin capabilities plus cross-org management and ability to promote/demote anyone. Reserved for ${ORACLE_EMAIL}.`,
    functional: true,
  },
};

export function getDefaultAccessLevel(email: string): AccessLevel {
  if (isOracle(email)) {
    return 'Oracle';
  }
  if (ADMIN_EMAILS.includes(email as typeof ADMIN_EMAILS[number])) {
    return 'Admin-Level';
  }
  return 'User-Level';
}

/* ─── New RBAC System ───────────────────────────────────────────────────────── */

/** Numeric weight for each role — higher = more powerful. */
export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  "read-only": 0,
  "user": 1,
  "admin": 2,
  "oracle": 3,
};

/** Human-readable labels for each role. */
export const ROLE_LABELS: Record<OrgRole, string> = {
  "read-only": "Read-Only",
  "user": "User",
  "admin": "Admin",
  "oracle": "Oracle",
};

/** Color tokens for each role badge. */
export const ROLE_COLORS: Record<OrgRole, { bg: string; text: string; border: string; darkBg: string; darkText: string; darkBorder: string }> = {
  "read-only": { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", darkBg: "bg-slate-800", darkText: "text-slate-400", darkBorder: "border-slate-700" },
  "user":      { bg: "bg-blue-50",  text: "text-blue-700",  border: "border-blue-200",  darkBg: "bg-blue-900/30",  darkText: "text-blue-300",  darkBorder: "border-blue-800" },
  "admin":     { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", darkBg: "bg-amber-900/30", darkText: "text-amber-300", darkBorder: "border-amber-800" },
  "oracle":    { bg: "bg-gradient-to-r from-amber-50 to-yellow-50", text: "text-amber-700", border: "border-amber-400", darkBg: "bg-gradient-to-r from-amber-900/40 to-yellow-900/40", darkText: "text-amber-300", darkBorder: "border-amber-600" },
};

/** All roles in ascending order. */
export const ALL_ROLES: OrgRole[] = ["read-only", "user", "admin", "oracle"];

/** Roles that non-Oracle promoters can see/assign (oracle is never assignable via UI). */
export const ASSIGNABLE_ROLES: OrgRole[] = ["read-only", "user", "admin"];

/* ─── Oracle Identity ──────────────────────────────────────────────────────── */

/**
 * Oracle is the highest OrgRole — the platform god-mode.
 * Only lucas@soltheory.com can ever hold this role.
 * Re-exported from org-config.ts (single source of truth).
 *
 * Legacy: DEVELOPER_EMAIL and isDeveloper are kept as aliases for backward compatibility.
 */
export { DEVELOPER_EMAIL, isDeveloper, ORACLE_EMAIL, isOracle } from './org-config';

/** Oracle badge colors — distinctive gold/amber gradient. */
export const ORACLE_COLORS = {
  bg: "bg-gradient-to-r from-amber-50 to-yellow-50",
  text: "text-amber-700",
  border: "border-amber-400",
  darkBg: "bg-gradient-to-r from-amber-900/40 to-yellow-900/40",
  darkText: "text-amber-300",
  darkBorder: "border-amber-600",
};

/**
 * @deprecated Use ORACLE_COLORS instead. Kept for backward compatibility.
 */
export const DEVELOPER_COLORS = ORACLE_COLORS;

/* ─── Organization Registry ─────────────────────────────────────────────────── */

/**
 * Known organizations and their display labels.
 * Dynamically built from org-config.ts (single source of truth).
 */
export const ORG_LABELS: Record<string, string> = getOrgLabelsMap();

/** All known org IDs. */
export const ALL_ORGS = getAllOrgIds();

/* ─── Permission Checks ─────────────────────────────────────────────────────── */

/**
 * Check if a user's role meets the minimum required role level.
 * Example: hasPermission('user', 'read-only') → true (user ≥ read-only)
 */
export function hasPermission(userRole: OrgRole, requiredRole: OrgRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if a promoter can promote/set someone TO the target role.
 * Rules:
 *   - Oracle can assign any role EXCEPT oracle (oracle is hardcoded, never assignable via UI).
 *   - Admins can set roles BELOW their own level (read-only, user only).
 *   - Everyone else cannot change roles at all.
 */
export function canPromoteTo(promoterRole: OrgRole, targetRole: OrgRole): boolean {
  // Nobody can assign oracle via UI — it's hardcoded to lucas@soltheory.com
  if (targetRole === "oracle") return false;
  if (promoterRole === "oracle") return true;
  if (promoterRole === "admin") return ROLE_HIERARCHY[targetRole] < ROLE_HIERARCHY["admin"];
  return false;
}

/**
 * Check if a promoter can change the role of a member who currently holds `currentRole`.
 * Rules:
 *   - Oracle can change anyone's role (except other Oracles — there's only one).
 *   - Admins can only change roles of members below Admin level.
 *   - Nobody else can change roles.
 */
export function canModifyMember(promoterRole: OrgRole, currentRole: OrgRole): boolean {
  // Nobody can modify Oracle's role
  if (currentRole === "oracle") return false;
  if (promoterRole === "oracle") return true;
  if (promoterRole === "admin") return ROLE_HIERARCHY[currentRole] < ROLE_HIERARCHY["admin"];
  return false;
}

/**
 * Returns the list of roles that a promoter is allowed to assign.
 */
export function getAssignableRoles(promoterRole: OrgRole): OrgRole[] {
  return ALL_ROLES.filter(r => canPromoteTo(promoterRole, r));
}

/* ─── CRM-Specific Permission Matrix ───────────────────────────────────────── */

export interface CrmPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canImport: boolean;
  canManageFields: boolean;
  canManageInstances: boolean;
  canManageRoles: boolean;
}

/**
 * Derive CRM-specific permissions from an org role.
 * With the new hierarchy (read-only=0, user=1, admin=2, oracle=3):
 *   - read-only: can view only
 *   - user: can view, edit, export, import
 *   - admin: all user perms + delete, manage fields/instances/roles
 *   - oracle: all permissions
 */
export function getCrmPermissions(role: OrgRole): CrmPermissions {
  const level = ROLE_HIERARCHY[role];
  return {
    canView:            level >= ROLE_HIERARCHY["read-only"],   // 0+
    canEdit:            level >= ROLE_HIERARCHY["user"],        // 1+
    canDelete:          level >= ROLE_HIERARCHY["admin"],       // 2+ (was super-user, now admin)
    canExport:          level >= ROLE_HIERARCHY["user"],        // 1+
    canImport:          level >= ROLE_HIERARCHY["user"],        // 1+
    canManageFields:    level >= ROLE_HIERARCHY["admin"],       // 2+
    canManageInstances: level >= ROLE_HIERARCHY["admin"],       // 2+
    canManageRoles:     level >= ROLE_HIERARCHY["admin"],       // 2+
  };
}
