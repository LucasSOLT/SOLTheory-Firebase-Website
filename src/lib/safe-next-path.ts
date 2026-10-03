// ============================================================================
// lib/safe-next-path.ts — post-login return path (`?next=`) helpers
//
// Emailed deep links (e.g. "Review & sign") open
//   /portal/dashboard/{org}/onboarding?sign=<taskId>
// If the visitor isn't signed in, the dashboard layout sends them to the login
// page with `?next=<that path>`. After a successful login we return them there.
//
// SECURITY: this is an open-redirect surface, so a `next` value is honored only
// when it is a same-site, relative path under `/portal/dashboard/` AND belongs
// to the organization the user is actually being sent to.
// ============================================================================

const PREFIX = '/portal/dashboard/';
const MAX_LEN = 500;

/** Returns a safe relative path, or null if `raw` is missing / suspicious. */
export function sanitizeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v || v.length > MAX_LEN) return null;
  if (!v.startsWith(PREFIX)) return null;
  // No protocol-relative / absolute / backslash / control-char tricks.
  if (v.includes('//') || v.includes('\\') || /[\u0000-\u001f\u007f]/.test(v)) return null;
  if (/%2f|%5c|%00|%0a|%0d/i.test(v)) return null;
  const [pathPart] = v.split(/[?#]/);
  if (pathPart.split('/').some((seg) => seg === '..' || seg === '.')) return null;
  const orgSeg = pathPart.slice(PREFIX.length).split('/')[0];
  if (!orgSeg) return null;
  return v;
}

/**
 * Pick the post-login destination. `defaultPath` is where the user would go
 * anyway (`/portal/dashboard/{org}`); `next` is used only if it is inside that
 * same organization.
 */
export function resolveLoginDestination(defaultPath: string, raw: string | null | undefined): string {
  const next = sanitizeNextPath(raw);
  if (!next) return defaultPath;
  const orgOf = (p: string) => p.split(/[?#]/)[0].slice(PREFIX.length).split('/')[0];
  return orgOf(next) === orgOf(defaultPath) ? next : defaultPath;
}

/**
 * Phase 6.4: like `resolveLoginDestination`, but a deep link into ANY org the
 * user is a member of is honored (not just the org they would land on by
 * default). Membership is still enforced by the dashboard itself — this only
 * decides where to send them first, and still requires a safe same-site path.
 */
export function resolveLoginDestinationForOrgs(
  defaultPath: string,
  raw: string | null | undefined,
  allowedOrgs: readonly string[],
): string {
  const next = sanitizeNextPath(raw);
  if (!next) return defaultPath;
  const orgOf = (p: string) => p.split(/[?#]/)[0].slice(PREFIX.length).split('/')[0];
  const nextOrg = orgOf(next);
  return nextOrg === orgOf(defaultPath) || allowedOrgs.includes(nextOrg) ? next : defaultPath;
}

/** Client-only: read `?next=` from the current URL. */
export function readNextFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get('next');
  } catch {
    return null;
  }
}

/** Client-only: `/portal/login?next=<current path>` for an unauthenticated dashboard visit. */
export function loginUrlWithNext(base = '/portal/login'): string {
  if (typeof window === 'undefined') return base;
  const here = `${window.location.pathname}${window.location.search}`;
  const safe = sanitizeNextPath(here);
  return safe ? `${base}?next=${encodeURIComponent(safe)}` : base;
}
