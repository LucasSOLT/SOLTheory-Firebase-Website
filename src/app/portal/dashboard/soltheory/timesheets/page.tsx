import { TimesheetGrid } from "@/components/portal/TimesheetGrid";

const SOL_THEORY_USERS = [
  { name: "Lucas Huff", initials: "LH", color: "#2563eb" },
  { name: "Steve Huff", initials: "SH", color: "#7c3aed" },
  { name: "Gerard Jardin", initials: "GJ", color: "#059669" },
];

export default function SolTheoryTimesheetsPage() {
  return <TimesheetGrid users={SOL_THEORY_USERS} />;
}
