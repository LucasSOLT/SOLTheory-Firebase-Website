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

/* ─── Database Grid Skeleton ─── */
export function DashboardSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Shimmer className="h-7 w-40 mb-2" />
          <Shimmer className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-3">
          <Shimmer className="h-9 w-64 rounded-lg" />
          <Shimmer className="h-9 w-28 rounded-lg" />
          <Shimmer className="h-9 w-36 rounded-lg" />
        </div>
      </div>
      {/* Grid header */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E5E7EB] bg-slate-50/50">
          <Shimmer className="h-4 w-4 rounded" />
          {["w-20", "w-[72px]", "w-[72px]", "w-24", "w-[140px]", "w-[100px]", "w-[110px]", "w-20", "w-[100px]", "w-24", "w-[100px]"].map((w, i) => (
            <Shimmer key={i} className={`h-3.5 rounded ${w}`} />
          ))}
        </div>
        {/* Grid rows */}
        {[...Array(10)].map((_, i) => (
          <div key={i} className={`flex items-center gap-2 px-4 py-3.5 border-b border-slate-50 ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
            <Shimmer className="h-4 w-4 rounded" />
            <Shimmer className="h-3.5 w-20" />
            <Shimmer className="h-3.5 w-16" />
            <Shimmer className="h-3.5 w-16" />
            <Shimmer className="h-3.5 w-24" />
            <Shimmer className="h-3.5 w-36" />
            <Shimmer className="h-3.5 w-24" />
            <Shimmer className="h-5 w-20 rounded-full" />
            <Shimmer className="h-3.5 w-20" />
            <Shimmer className="h-4 w-16 rounded-full" />
            <Shimmer className="h-3.5 w-24" />
            <Shimmer className="h-3.5 w-20" />
          </div>
        ))}
        {/* Footer */}
        <div className="px-4 py-3 flex items-center justify-between">
          <Shimmer className="h-3.5 w-40" />
          <Shimmer className="h-3.5 w-24" />
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
