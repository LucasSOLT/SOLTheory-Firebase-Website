"use client";

import { useState, useEffect } from "react";
import { Clock, Globe, FileText, Users, HardDrive, Youtube, Bot, BarChart3, CalendarDays, Settings, Mail, MessageSquare, Presentation, Table, HelpCircle, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CollapsibleTile } from "@/components/ui/collapsible-tile";

const STORAGE_KEY = "soltheory_daily_digest";

const iconMap: Record<string, any> = {
  Globe, FileText, Users, HardDrive, Youtube, Bot, BarChart3,
  CalendarDays, Settings, Mail, MessageSquare, Presentation, Table, HelpCircle, Zap,
};

type DigestEntry = {
  id: string;
  type: "navigation" | "ai_chat";
  label: string;
  path?: string;
  timestamp: number;
  icon: string;
};

export function RecentPlaces() {
  const [places, setPlaces] = useState<DigestEntry[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    const loadPlaces = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const entries: DigestEntry[] = JSON.parse(raw);
        
        // Filter for navigation only, and get unique paths
        const uniquePaths = new Set<string>();
        const recent: DigestEntry[] = [];
        
        for (const entry of entries) {
          if (entry.type === "navigation" && entry.path) {
            // Ignore dashboard root paths to focus on inner tools
            if (entry.path.endsWith("/soltheory") || entry.path.endsWith("/nxtchapter")) continue;
            
            if (!uniquePaths.has(entry.path)) {
              uniquePaths.add(entry.path);
              recent.push(entry);
              if (recent.length >= 5) break; // Limit to 5
            }
          }
        }
        setPlaces(recent);
      } catch (e) {
        console.error(e);
      }
    };

    loadPlaces();
    window.addEventListener("digest-update", loadPlaces);
    window.addEventListener("storage", loadPlaces);
    return () => {
      window.removeEventListener("digest-update", loadPlaces);
      window.removeEventListener("storage", loadPlaces);
    };
  }, [pathname]);

  return (
    <CollapsibleTile id="recent-places" title="Recent Places" icon={<Clock className="w-4 h-4" />} className="w-full h-full min-h-[300px] p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
          <Clock className="w-4 h-4 text-indigo-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Recent Places</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Your quick shortcuts</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-2.5">
        {places.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-xs text-slate-400 font-medium">No recent places yet.</p>
            <p className="text-[10px] text-slate-300 mt-1">Explore the tools to see them here.</p>
          </div>
        ) : (
          places.map((place) => {
            const IconComp = iconMap[place.icon] || Globe;
            return (
              <Link 
                key={place.id}
                href={place.path || "#"}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-50 hover:border-indigo-100 bg-slate-50/50 hover:bg-indigo-50/30 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <IconComp className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-indigo-700 transition-colors">
                    {place.label.replace("Visited ", "")}
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
              </Link>
            );
          })
        )}
      </div>
    </CollapsibleTile>
  );
}
