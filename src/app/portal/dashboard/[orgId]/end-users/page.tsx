"use client";

/**
 * @file end-users/page.tsx
 * @description Redirect stub. The End User Dashboard UI has been consolidated
 * into the Organizational RBAC panel inside Settings > Security > Access Control.
 * Any existing bookmarks or links to /end-users will redirect there seamlessly.
 */

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EndUserDashboardRedirect() {
  const params = useParams();
  const router = useRouter();
  const orgId = params?.orgId as string;

  useEffect(() => {
    router.replace(`/portal/dashboard/${orgId}/settings?tab=profile&subPage=org-rbac`);
  }, [orgId, router]);

  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-slate-400 font-medium">Redirecting to Settings…</p>
    </div>
  );
}
