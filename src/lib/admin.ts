/**
 * Admin configuration — centralized source of truth for admin privileges.
 * Now pulls from org-config.ts for org-specific data.
 */

import { ORG_REGISTRY, isGlobalAdmin, getAllOrgs } from './org-config';

/** All admin emails across all orgs (flattened). */
export const ADMIN_EMAILS = [
  ...new Set(Object.values(ORG_REGISTRY).flatMap(org => org.adminEmails))
] as readonly string[];

/** Check if a given email belongs to an admin user. */
export const isAdmin = (email: string | null | undefined): boolean =>
  !!email && isGlobalAdmin(email);

/** All available organizations for the content manager. */
export const ALL_ORGS = getAllOrgs().map(org => ({
  id: org.id,
  name: org.label,
  icon: org.theme.icon,
  color: org.theme.color,
}));

export type OrgId = string;

