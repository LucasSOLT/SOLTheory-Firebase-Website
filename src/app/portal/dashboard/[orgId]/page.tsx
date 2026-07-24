"use client";

import { useOrgId } from "@/contexts/OrgContext";
import { SolTheoryHome } from "./SolTheoryHome";
import { NxtChapterHome } from "./NxtChapterHome";
import type { ComponentType } from "react";

/**
 * Org-specific home components.
 * To add a custom home for a new org, create a component and add it here.
 * Orgs not listed will get the default SolTheoryHome (generic dashboard).
 */
const ORG_HOME_COMPONENTS: Record<string, ComponentType> = {
  soltheory: SolTheoryHome,
  nxtchapter: NxtChapterHome,
};

export default function DashboardHome() {
  const orgId = useOrgId();

  const HomeComponent = ORG_HOME_COMPONENTS[orgId] || SolTheoryHome;
  return <HomeComponent />;
}
