import { OrgThread } from "@/components/communications/OrgThread";

export default function OrgThreadPage() {
  return (
    <div className="h-full w-full flex flex-col pt-2 max-w-7xl mx-auto space-y-4 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            Organization Threads
          </h1>
          <p className="text-slate-500 text-sm max-w-2xl font-medium">
            Internal subreddits for organization-wide secure communication.
          </p>
        </div>
      </div>
      <div className="flex-1 pb-10 min-h-0">
        <OrgThread />
      </div>
    </div>
  );
}
