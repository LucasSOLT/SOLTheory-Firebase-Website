/**
 * RBAC (Role-Based Access Control) configuration.
 * Centralized source of truth for access levels across the platform.
 */

import { ADMIN_EMAILS } from './admin';

/** All access levels, ordered from lowest to highest privilege. */
export const ACCESS_LEVELS = [
  'Read Only',
  'User-Level',
  'Client-Level',
  'Admin-Level',
  'Oracle',
] as const;

export type AccessLevel = typeof ACCESS_LEVELS[number];

/** Human-readable descriptions for each access level. */
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

/** Determine the default access level for a given email. */
export function getDefaultAccessLevel(email: string): AccessLevel {
  if (ADMIN_EMAILS.includes(email as typeof ADMIN_EMAILS[number])) {
    return 'Admin-Level';
  }
  return 'User-Level';
}
