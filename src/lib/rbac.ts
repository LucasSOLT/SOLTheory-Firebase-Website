/**
 * @file rbac.ts
 * @description Centralized Role-Based Access Control (RBAC) engine for the Insight platform.
 * Pure TypeScript — no React, no Firebase. Can be used in hooks, components, API routes, and Firestore rules logic.
 *
 * Role Hierarchy (lowest → highest):
 *   read-only (0) → user (1) → super-user (2) → admin (3) → owner (4)
 */

import { ADMIN_EMAILS } from './admin';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export type OrgRole = "read-only" | "user" | "super-user" | "admin" | "owner";

export interface OrgMember {
  uid: string;
  email: string;
  displayName: string;
  role: OrgRole;
  joinedAt: string;       // ISO timestamp
  promotedBy?: string;    // UID of the person who last changed this member's role
  promotedAt?: string;    // ISO timestamp of last role change
}

/* ─── Legacy Compat (keep old exports alive until migrated everywhere) ────── */

export const ACCESS_LEVELS = [
  'Read Only',
  'User-Level',
  'Client-Level',
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
    functional: false,
  },
  'Client-Level': {
    description: 'Full access to organization tools, CRM, and reports. Cannot manage users or system settings.',
    functional: false,
  },
  'Admin-Level': {
    description: 'Full platform access. Can manage users, content, and system settings.',
    functional: true,
  },
  'Oracle': {
    description: 'Highest level. All Admin capabilities plus ability to demote admins. Reserved for lucas@soltheory.com.',
    functional: false,
  },
};

export function getDefaultAccessLevel(email: string): AccessLevel {
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
  "super-user": 2,
  "admin": 3,
  "owner": 4,
};

/** Human-readable labels for each role. */
export const ROLE_LABELS: Record<OrgRole, string> = {
  "read-only": "Read-Only",
  "user": "User",
  "super-user": "Super-User",
  "admin": "Admin",
  "owner": "Owner",
};

/** Color tokens for each role badge. */
export const ROLE_COLORS: Record<OrgRole, { bg: string; text: string; border: string; darkBg: string; darkText: string; darkBorder: string }> = {
  "read-only": { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", darkBg: "bg-slate-800", darkText: "text-slate-400", darkBorder: "border-slate-700" },
  "user":       { bg: "bg-blue-50",  text: "text-blue-700",  border: "border-blue-200",  darkBg: "bg-blue-900/30",  darkText: "text-blue-300",  darkBorder: "border-blue-800" },
  "super-user": { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", darkBg: "bg-violet-900/30", darkText: "text-violet-300", darkBorder: "border-violet-800" },
  "admin":      { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", darkBg: "bg-amber-900/30", darkText: "text-amber-300", darkBorder: "border-amber-800" },
  "owner":      { bg: "bg-red-50",   text: "text-red-700",   border: "border-red-200",   darkBg: "bg-red-900/30",   darkText: "text-red-300",   darkBorder: "border-red-800" },
};

/** All roles in ascending order. */
export const ALL_ROLES: OrgRole[] = ["read-only", "user", "super-user", "admin", "owner"];

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
 *   - Owners can set anyone to any role (including other Owners).
 *   - Admins can set roles BELOW their own level (not Admin or Owner).
 *   - Everyone else cannot change roles at all.
 */
export function canPromoteTo(promoterRole: OrgRole, targetRole: OrgRole): boolean {
  if (promoterRole === "owner") return true;
  if (promoterRole === "admin") return ROLE_HIERARCHY[targetRole] < ROLE_HIERARCHY["admin"];
  return false;
}

/**
 * Check if a promoter can change the role of a member who currently holds `currentRole`.
 * Rules:
 *   - Owners can change anyone's role.
 *   - Admins can only change roles of members below Admin level.
 *   - Nobody else can change roles.
 */
export function canModifyMember(promoterRole: OrgRole, currentRole: OrgRole): boolean {
  if (promoterRole === "owner") return true;
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
 */
export function getCrmPermissions(role: OrgRole): CrmPermissions {
  const level = ROLE_HIERARCHY[role];
  return {
    canView:            level >= ROLE_HIERARCHY["read-only"],
    canEdit:            level >= ROLE_HIERARCHY["user"],
    canDelete:          level >= ROLE_HIERARCHY["super-user"],
    canExport:          level >= ROLE_HIERARCHY["user"],
    canImport:          level >= ROLE_HIERARCHY["user"],
    canManageFields:    level >= ROLE_HIERARCHY["admin"],
    canManageInstances: level >= ROLE_HIERARCHY["admin"],
    canManageRoles:     level >= ROLE_HIERARCHY["admin"],
  };
}
