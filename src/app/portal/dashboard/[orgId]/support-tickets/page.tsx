"use client";

import { SupportTicketsViewer } from "@/components/portal/SupportTicketsViewer";
import { useParams } from "next/navigation";

export default function OrgSupportTicketsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  return <SupportTicketsViewer dashboardName={orgId} />;
}
