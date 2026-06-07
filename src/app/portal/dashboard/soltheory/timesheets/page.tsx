"use client";

import { TimesheetGrid } from "@/components/portal/TimesheetGrid";
import { useFirestore, useUser } from "@/firebase";

const SOL_THEORY_USERS = [
  { name: "Lucas Huff", initials: "LH", color: "#2563eb" },
  { name: "Steve Huff", initials: "SH", color: "#7c3aed" },
  { name: "Gerard Jardin", initials: "GJ", color: "#059669" },
];

export default function SolTheoryTimesheetsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  return (
    <TimesheetGrid
      users={SOL_THEORY_USERS}
      firestore={firestore}
      orgDomain="soltheory.com"
      userEmail={user?.email || ""}
    />
  );
}
