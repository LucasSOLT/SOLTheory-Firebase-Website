"use client";

import { TimesheetGrid } from "@/components/portal/TimesheetGrid";
import { useFirestore, useUser } from "@/firebase";

const NXT_CHAPTER_USERS = [
  { name: "Josie Burton", initials: "JB", color: "#e11d48" },
];

export default function NxtChapterTimesheetsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  return (
    <TimesheetGrid
      users={NXT_CHAPTER_USERS}
      firestore={firestore}
      orgDomain="nxtchapter.com"
      userEmail={user?.email || ""}
    />
  );
}
