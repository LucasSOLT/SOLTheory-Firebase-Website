export default function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 transition-colors">
      <div className="flex flex-col items-center gap-6">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 animate-pulse" />
          <div className="absolute inset-[3px] rounded-xl bg-white dark:bg-slate-950" />
          <div className="absolute inset-[6px] rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-600/20 animate-pulse" />
        </div>
        <div className="w-48 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 animate-loading-bar" />
        </div>
        <style>{`
          @keyframes loading-bar {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(50%); }
            100% { transform: translateX(200%); }
          }
          .animate-loading-bar { animation: loading-bar 1.5s ease-in-out infinite; }
        `}</style>
      </div>
    </div>
  );
}
