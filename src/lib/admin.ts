/**
 * Admin configuration — centralized source of truth for admin privileges.
 */

export const ADMIN_EMAILS = ['lucas@soltheory.com', 'steve@soltheory.com', 'gerard@soltheory.com'] as const;

/** Check if a given email belongs to an admin user. */
export const isAdmin = (email: string | null | undefined): boolean =>
  !!email && ADMIN_EMAILS.includes(email as typeof ADMIN_EMAILS[number]);

/** All available organizations for the content manager. */
export const ALL_ORGS = [
  { id: 'soltheory', name: 'SOL Theory', icon: '◆', color: 'fuchsia' },
  { id: 'nxtchapter', name: 'NXT Chapter', icon: '▲', color: 'indigo' },
  { id: 'lnu', name: 'LifeNavigationU', icon: '●', color: 'emerald' },
] as const;

export type OrgId = typeof ALL_ORGS[number]['id'];
