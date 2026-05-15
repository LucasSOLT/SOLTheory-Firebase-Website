"use client";

/* ─── Skeleton building blocks with shimmer animation ─── */

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded bg-slate-100 ${className}`}>
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

/* ─── Dashboard Skeleton ─── */
export function DashboardSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <Shimmer className="h-6 w-40 mb-2" />
        <Shimmer className="h-4 w-72" />
      </div>
      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-3">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-8 w-24" />
            <Shimmer className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB] flex gap-3">
          <Shimmer className="h-9 flex-1" />
          <Shimmer className="h-9 w-32" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-slate-50">
            <Shimmer className="h-4 w-4 rounded" />
            <Shimmer className="h-8 w-8 rounded-full" />
            <Shimmer className="h-4 flex-1" />
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Contacts Table Skeleton ─── */
export function ContactsTableSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Shimmer className="h-6 w-32 mb-2" />
          <Shimmer className="h-4 w-48" />
        </div>
        <Shimmer className="h-9 w-36 rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[#E5E7EB]">
          <Shimmer className="h-9 flex-1 rounded-lg" />
          <Shimmer className="h-9 w-28 rounded-lg" />
          <Shimmer className="h-9 w-28 rounded-lg" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-3.5 border-b border-slate-50">
            <Shimmer className="h-4 w-4 rounded" />
            <Shimmer className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Shimmer className="h-3.5 w-32" />
              <Shimmer className="h-3 w-44" />
            </div>
            <Shimmer className="h-3.5 w-28" />
            <Shimmer className="h-5 w-16 rounded-full" />
            <Shimmer className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Inbox Skeleton ─── */
export function InboxSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <div>
        <Shimmer className="h-6 w-36 mb-2" />
        <Shimmer className="h-4 w-60" />
      </div>
      <div className="bg-white rounded-xl border border-[#E5E7EB] flex overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
        {/* Left */}
        <div className="w-[340px] shrink-0 border-r border-[#E5E7EB]">
          <div className="p-4 border-b border-[#E5E7EB]">
            <Shimmer className="h-9 w-full rounded-lg" />
          </div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-50">
              <Shimmer className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Shimmer className="h-3.5 w-28" />
                <Shimmer className="h-3 w-full" />
                <Shimmer className="h-3 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        {/* Right */}
        <div className="flex-1 p-6 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-[#E5E7EB]">
            <Shimmer className="h-9 w-9 rounded-full" />
            <div className="space-y-1.5">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-3 w-24" />
            </div>
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
              <Shimmer className="h-16 w-64 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Analytics Skeleton ─── */
export function AnalyticsSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <Shimmer className="h-6 w-28 mb-2" />
        <Shimmer className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-3">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-7 w-20" />
            <Shimmer className="h-3 w-14" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-4">
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-3 w-60" />
            <Shimmer className="h-[220px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
