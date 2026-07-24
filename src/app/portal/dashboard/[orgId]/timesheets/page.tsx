"use client";

import { TimesheetGrid } from "@/components/portal/TimesheetGrid";
import { useFirestore, useUser } from "@/firebase";
import { useParams } from "next/navigation";

const ORG_USERS = [
  { name: "Lucas Huff", initials: "LH", color: "#2563eb" },
  { name: "Steve Huff", initials: "SH", color: "#7c3aed" },
  { name: "Gerard Jardin", initials: "GJ", color: "#059669" },
];

export default function OrgTimesheetsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const firestore = useFirestore();
  const { user } = useUser();
  return (
    <TimesheetGrid
      users={ORG_USERS}
      firestore={firestore}
      orgDomain={`${orgId}.com`}
      userEmail={user?.email || ""}
    />
  );
}
