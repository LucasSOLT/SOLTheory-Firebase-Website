import { OrgThread } from "@/components/communications/OrgThread";

export default function OrgThreadPage() {
  return (
    <div className="h-full w-full flex flex-col pb-6 animate-in fade-in duration-700">
      <div className="flex-1 min-h-0">
        <OrgThread />
      </div>
    </div>
  );
}
