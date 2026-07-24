"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * OrgContext — provides the current orgId to all dashboard components.
 *
 * Wrapped by the dashboard layout so every page under /portal/dashboard/[orgId]
 * can call `useOrgId()` instead of reaching for useParams() or prop-drilling.
 */
const OrgContext = createContext<string>("");

export function useOrgId(): string {
  const orgId = useContext(OrgContext);
  if (!orgId) {
    // Graceful fallback — this should never happen in the dashboard tree
    // because the layout always provides it, but guard against misuse.
    if (typeof window !== "undefined") {
      const match = window.location.pathname.match(/\/portal\/dashboard\/([^/]+)/);
      if (match) return match[1];
    }
  }
  return orgId;
}

export function OrgProvider({ orgId, children }: { orgId: string; children: ReactNode }) {
  return <OrgContext.Provider value={orgId}>{children}</OrgContext.Provider>;
}
