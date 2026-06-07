import { TimesheetGrid } from "@/components/portal/TimesheetGrid";

const NXT_CHAPTER_USERS = [
  { name: "Josie Burton", initials: "JB", color: "#e11d48" },
];

export default function NxtChapterTimesheetsPage() {
  return <TimesheetGrid users={NXT_CHAPTER_USERS} />;
}
