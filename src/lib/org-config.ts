/**
 * Centralized Organization Registry
 * ────────────────────────────────────────────────────────────────
 * This is the SINGLE SOURCE OF TRUTH for all organization-specific
 * configuration. To onboard a new customer org, add an entry to
 * ORG_REGISTRY below — no other file changes required.
 */

export interface OrgConfig {
  /** Unique slug used in URLs and Firestore paths, e.g. "soltheory" */
  id: string;
  /** Human-readable display name, e.g. "SOL Theory" */
  label: string;
  /** Email domains that auto-route to this org on login */
  emailDomains: string[];
  /** Admin email addresses for this org */
  adminEmails: string[];
  /** Primary support/contact email */
  supportEmail: string;
  /** SendGrid "from" email address */
  fromEmail: string;
  /** Optional knowledge base module key (for AI agents) */
  knowledgeModule?: string;
  /** Theme / branding */
  theme: {
    icon: string;
    color: string;
  };
}

// ─────────────────────────────────────────────
// REGISTRY — Add new orgs here
// ─────────────────────────────────────────────

export const ORG_REGISTRY: Record<string, OrgConfig> = {
  soltheory: {
    id: "soltheory",
    label: "SOL Theory",
    emailDomains: ["soltheory.com", "soltheory.org"],
    adminEmails: ["lucas@soltheory.com", "steve@soltheory.com", "gerard@soltheory.com"],
    supportEmail: "lucas@soltheory.com",
    fromEmail: process.env.SENDGRID_FROM_EMAIL || "noreply@soltheory.com",
    knowledgeModule: "soltheory",
    theme: { icon: "◆", color: "fuchsia" },
  },
  nxtchapter: {
    id: "nxtchapter",
    label: "NXT Chapter",
    emailDomains: ["nxtchapter.com", "nxtchapter.org"],
    adminEmails: [],
    supportEmail: "nxtchapterorg@gmail.com",
    fromEmail: process.env.SENDGRID_FROM_EMAIL || "noreply@soltheory.com",
    knowledgeModule: "nxtchapter",
    theme: { icon: "▲", color: "indigo" },
  },
  lnu: {
    id: "lnu",
    label: "LifeNavigationU",
    emailDomains: [],
    adminEmails: [],
    supportEmail: "lucas@soltheory.com",
    fromEmail: process.env.SENDGRID_FROM_EMAIL || "noreply@soltheory.com",
    theme: { icon: "●", color: "emerald" },
  },
};

// ─────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────

/** Get the config for a given orgId, or undefined if not found. */
export function getOrgConfig(orgId: string): OrgConfig | undefined {
  return ORG_REGISTRY[orgId];
}

/** Get the display label for an orgId. Falls back to the orgId itself. */
export function getOrgLabel(orgId: string): string {
  return ORG_REGISTRY[orgId]?.label ?? orgId;
}

/** Find the org that owns a given email domain (e.g. "lucas@soltheory.com" → soltheory config). */
export function getOrgByEmailDomain(email: string): OrgConfig | undefined {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return undefined;
  return Object.values(ORG_REGISTRY).find((org) =>
    org.emailDomains.some((d) => domain === d)
  );
}

/** Check if an email is an admin for a specific org. */
export function isOrgAdmin(orgId: string, email: string): boolean {
  const org = ORG_REGISTRY[orgId];
  if (!org) return false;
  return org.adminEmails.includes(email.toLowerCase());
}

/** Check if an email is an admin for ANY org. */
export function isGlobalAdmin(email: string): boolean {
  return Object.values(ORG_REGISTRY).some((org) =>
    org.adminEmails.includes(email.toLowerCase())
  );
}

/** Get all org IDs. */
export function getAllOrgIds(): string[] {
  return Object.keys(ORG_REGISTRY);
}

/** Get all org configs as an array. */
export function getAllOrgs(): OrgConfig[] {
  return Object.values(ORG_REGISTRY);
}

/** Build a Record<string, string> of orgId → label (backwards-compat with ORG_LABELS). */
export function getOrgLabelsMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [id, cfg] of Object.entries(ORG_REGISTRY)) {
    map[id] = cfg.label;
  }
  return map;
}

/**
 * Get the list of orgs a user has access to, based on their email domain.
 * Used as a fallback when Firestore `allowedOrgs` is not set.
 */
export function getDefaultAllowedOrgs(email: string): string[] {
  const matched = getOrgByEmailDomain(email);
  return matched ? [matched.id] : [];
}

/**
 * Developer email — the platform owner who bypasses org checks.
 * Kept as a simple constant for backwards compatibility.
 */
export const DEVELOPER_EMAIL = "lucas@soltheory.com";

export function isDeveloper(email: string | undefined | null): boolean {
  return !!email && email.toLowerCase() === DEVELOPER_EMAIL;
}
