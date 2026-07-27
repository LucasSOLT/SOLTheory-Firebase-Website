"use client";

import { TimesheetGrid } from "@/components/portal/TimesheetGrid";
import { useFirestore, useUser } from "@/firebase";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

/** Deterministic color palette for user avatars */
const USER_COLORS = [
  "#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626",
  "#0891b2", "#4f46e5", "#be185d", "#15803d", "#9333ea",
];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

export default function OrgTimesheetsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const firestore = useFirestore();
  const { user } = useUser();
  const [orgUsers, setOrgUsers] = useState<{ name: string; initials: string; color: string }[]>([]);

  // Load org members dynamically from Firestore
  useEffect(() => {
    if (!firestore || !orgId) return;
    let cancelled = false;

    (async () => {
      try {
        const membersSnap = await getDocs(collection(firestore, `orgs/${orgId}/members`));
        if (cancelled) return;

        const users = membersSnap.docs
          .map((doc, idx) => {
            const data = doc.data();
            const name = data.displayName || data.email?.split("@")[0] || "Unknown";
            return {
              name,
              initials: getInitials(name),
              color: USER_COLORS[idx % USER_COLORS.length],
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        setOrgUsers(users);
      } catch (err) {
        console.error("[Timesheets] Failed to load org members:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [firestore, orgId]);

  return (
    <TimesheetGrid
      users={orgUsers}
      firestore={firestore}
      orgDomain={`${orgId}.com`}
      userEmail={user?.email || ""}
    />
  );
}
