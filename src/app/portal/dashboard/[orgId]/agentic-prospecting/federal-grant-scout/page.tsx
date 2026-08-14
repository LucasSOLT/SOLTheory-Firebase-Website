"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

/**
 * Federal Grant Web Scraper — Redirect
 * 
 * This page previously hosted the Scout discovery UI.
 * All functionality has been merged into the Grant Command Center
 * at /portal/dashboard/[orgId]/grant-statuses.
 */
export default function FederalGrantScoutRedirect() {
  const router = useRouter();
  const { orgId } = useParams<{ orgId: string }>();

  useEffect(() => {
    router.replace(`/portal/dashboard/${orgId}/grant-statuses`);
  }, [router, orgId]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-sm text-slate-400 animate-pulse">Redirecting to Grant Command Center…</p>
    </div>
  );
}
