"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useUser } from "@/firebase";

export function CollapsibleTile({
  id,
  title,
  icon,
  children,
  className = "",
}: {
  id: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const { user } = useUser();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined" && user?.uid) {
      return localStorage.getItem(`collapse-tile-${user.uid}-${id}`) === 'true';
    }
    return false;
  });

  useEffect(() => {
    const handleGlobalCollapse = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.collapsed === 'boolean') {
        const next = customEvent.detail.collapsed;
        setIsCollapsed(next);
        if (user?.uid) {
          localStorage.setItem(`collapse-tile-${user.uid}-${id}`, next.toString());
        }
      }
    };
    window.addEventListener('dashboard-toggle-collapse', handleGlobalCollapse);
    return () => {
      window.removeEventListener('dashboard-toggle-collapse', handleGlobalCollapse);
    };
  }, [user?.uid, id]);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    if (user?.uid) {
      localStorage.setItem(`collapse-tile-${user.uid}-${id}`, next.toString());
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-full h-[52px] rounded-2xl bg-white border border-slate-100 shadow-sm px-4 flex items-center justify-between hover:shadow-md transition-all group relative">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 text-indigo-500">
             {icon}
          </div>
          <p className="text-xs font-semibold text-slate-700 truncate">{title}</p>
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={toggleCollapse}
            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full rounded-2xl bg-white border border-slate-100 shadow-sm relative group hover:shadow-md transition-shadow ${className}`}>
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
        <button
          onClick={toggleCollapse}
          className="w-6 h-6 rounded-md bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors"
        >
          <ChevronUp className="w-3 h-3 text-slate-400" />
        </button>
      </div>
      {children}
    </div>
  );
}
