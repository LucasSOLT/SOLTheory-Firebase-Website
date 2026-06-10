"use client";

import { useEffect, useState, useCallback } from "react";
import { useFirestore, useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { doc, updateDoc, setDoc, onSnapshot } from "firebase/firestore";
import { Clock, ExternalLink, Activity, ChevronRight, Settings } from "lucide-react";
import { WeeklyTimesheetChart } from "@/components/portal/WeeklyTimesheetChart";
import { NearestDueTasksWidget } from "@/components/portal/NearestDueTasksWidget";
import { GrantCompletionsLineChart } from "@/components/portal/GrantCompletionsLineChart";
import { GrantStatusPieChart } from "@/components/portal/GrantStatusPieChart";
import { SuggestedGrantsList } from "@/components/portal/SuggestedGrantsList";
import { GrantAgentHub } from "@/components/portal/GrantAgentHub";
import { useGrantsData } from "@/hooks/useGrantsData";
import { AgentWorkerController, type AgentSlotData } from "@/components/portal/AgentWorkerController";
import { ActiveAgentsPreview } from "@/components/portal/ActiveAgentsPreview";
import { NewsSlideshow } from "@/components/portal/NewsSlideshow";
import { OrgActivityFeed } from "@/components/portal/OrgActivityFeed";
import { ContentManagerBar } from "@/components/admin/ContentManagerBar";
import { useContentManagerStore } from "@/stores/content-manager-store";
import { TileSettingsPopup } from "@/components/admin/TileSettingsPopup";
import { NewsSlideshowSettings, type SlideData, type SlideshowSettings } from "@/components/admin/NewsSlideshowSettings";

export default function SolTheoryDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [isGrantConfigOpen, setIsGrantConfigOpen] = useState(false);
  const { grants: grantsData, loading: grantsLoading } = useGrantsData();
  const [agentSlots, setAgentSlots] = useState<AgentSlotData[]>([]);
  const handleSlotsChange = useCallback((slots: AgentSlotData[]) => setAgentSlots(slots), []);
  const [activeTilePopup, setActiveTilePopup] = useState<string | null>(null);

  // Admin Content Manager state (from shared store)
  const contentManagerActive = useContentManagerStore((s) => s.active);
  const setContentManagerActive = useContentManagerStore((s) => s.setActive);
  const selectedOrgs = useContentManagerStore((s) => s.selectedOrgs);
  const handleToggleOrg = useContentManagerStore((s) => s.toggleOrg);
  const handleSelectAll = useContentManagerStore((s) => s.selectAll);
  const handleDeselectAll = useContentManagerStore((s) => s.deselectAll);

  // News slideshow data from Firestore
  const DEFAULT_SLIDES: SlideData[] = [
    { headline: "NXT Chapter × Advanced Pathways", subtitle: "New Denver Shelter Partnership — Expanding capacity to 3 additional locations across the metro area.", gradient: "from-indigo-600 via-violet-600 to-purple-700", badge: "PARTNERSHIP", date: "June 2025" },
    { headline: "AI Grant Discovery Launched", subtitle: "SOL Theory's autonomous grant agents now scan Grants.gov 24/7 — surfacing federal funding opportunities in real time.", gradient: "from-emerald-600 via-teal-600 to-cyan-700", badge: "PRODUCT", date: "May 2025" },
    { headline: "Q2 Impact Report: 1,200+ Served", subtitle: "Across all partner shelters, NXT Chapter programs reached over 1,200 individuals with housing, workforce, and behavioral health services.", gradient: "from-amber-500 via-orange-500 to-red-500", badge: "IMPACT", date: "April 2025" },
    { headline: "Community Resource Fair — July 2025", subtitle: "Save the date: Denver Community Resource Fair bringing together 40+ service providers, employers, and housing partners.", gradient: "from-rose-500 via-pink-500 to-fuchsia-600", badge: "EVENT", date: "Upcoming" },
    { headline: "Dashboard v2.0 — Real-Time Analytics", subtitle: "New grant status tracking, Action Board with email triggers, and AI-powered insights rolling out across all client dashboards.", gradient: "from-sky-500 via-blue-600 to-indigo-700", badge: "TECH UPDATE", date: "June 2025" },
  ];
  const [newsSlides, setNewsSlides] = useState<SlideData[]>(DEFAULT_SLIDES);
  const [newsShuffleInterval, setNewsShuffleInterval] = useState(15000);

  // Listen for Firestore news slideshow config
  useEffect(() => {
    if (!firestore) return;
    const docRef = doc(firestore, "cms_config", "news_slideshow");
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.slides?.length) setNewsSlides(data.slides);
        if (data.shuffleInterval) setNewsShuffleInterval(data.shuffleInterval);
      }
    }, () => {});
    return () => unsub();
  }, [firestore]);

  // Save news slideshow to Firestore
  const handleSaveNewsSlideshow = useCallback(async (slides: SlideData[], settings: SlideshowSettings) => {
    if (!firestore) throw new Error('Firestore not available');
    const docRef = doc(firestore, "cms_config", "news_slideshow");
    console.log('[CMS] Saving slideshow to Firestore...', { slides: slides.length, interval: settings.shuffleInterval });
    await setDoc(docRef, { slides, shuffleInterval: settings.shuffleInterval, updatedAt: new Date().toISOString() });
    console.log('[CMS] Slideshow saved successfully!');
  }, [firestore]);

  /* presence tracking (keep existing logic) */
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const userRef = doc(firestore, "users", user.uid);
    updateDoc(userRef, { currentDashboard: "soltheory" }).catch(() => {});
    const handleBeforeUnload = () => updateDoc(userRef, { currentDashboard: null }).catch(() => {});
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      updateDoc(userRef, { currentDashboard: null }).catch(() => {});
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [firestore, user?.uid]);

  const CmsTileWrapper = useCallback(({ tileId, tileName, children, className }: { tileId: string; tileName: string; children: React.ReactNode; className?: string }) => {
    if (!contentManagerActive) return <div className={className}>{children}</div>;
    return (
      <div
        className={`relative cursor-pointer group/cms-tile ${className || ''}`}
        onClick={(e) => { e.stopPropagation(); setActiveTilePopup(tileId); }}
      >
        <div className="h-full transition-all duration-300 group-hover/cms-tile:grayscale-0 group-hover/cms-tile:opacity-100 group-hover/cms-tile:ring-2 group-hover/cms-tile:ring-indigo-400 group-hover/cms-tile:ring-offset-2 rounded-2xl overflow-hidden">
          {children}
        </div>
        {/* Edit indicator */}
        <div className="absolute top-2 right-2 z-50 opacity-0 group-hover/cms-tile:opacity-100 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shadow-lg">
            <Settings className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      </div>
    );
  }, [contentManagerActive]);

  return (
    <div className="w-full mx-auto animate-in fade-in duration-700 h-full overflow-y-auto pb-10 px-3 sm:px-4 md:px-8 focus:outline-none" tabIndex={-1}>
      <div className="space-y-4 md:space-y-6 min-w-0 w-full">
        {/* Content Manager Bar */}
        {contentManagerActive && (
          <ContentManagerBar
            selectedOrgs={selectedOrgs}
            onToggleOrg={handleToggleOrg}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onExit={() => setContentManagerActive(false)}
          />
        )}

        {/* Dashboard Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-3xl font-light italic font-cormorant text-slate-800 tracking-wide">
            Welcome back, <span className="not-italic font-semibold">{user?.displayName || "Lucas"}</span>.
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Here is your week at a glance.
          </p>
        </div>

        {/* Uniform Grid Layout with Solid White Structural Tiles & Hover Bookmarks */}
        <div className={`space-y-4 md:space-y-5 transition-all duration-500 ${contentManagerActive ? 'opacity-80 saturate-[0.6] select-none' : ''}`}>
          {/* CMS overlay label */}
          {contentManagerActive && (
            <div className="!pointer-events-none flex items-center justify-center py-4">
              <div className="px-5 py-2.5 bg-slate-900/5 border border-slate-200 rounded-xl">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Click any tile to configure</span>
              </div>
            </div>
          )}
          
          {/* Row 1: Top (Left 2:3 stacked, Right 16:9 split) */}
          <div className="flex flex-col lg:flex-row gap-4 md:gap-5 w-full">
            {/* Slot 1: Aspect 2:3 (Narrow, Tall) -> Splits vertically into 2 cards */}
            <div className="flex-[3] md:aspect-[2/3] flex flex-col gap-4 md:gap-5">
              {/* Card 1A: Weekly Timesheet Hours (Real QuickBooks data!) */}
              <CmsTileWrapper tileId="tile-1" tileName="Weekly Hours Worked" className="flex-1 min-h-0">
              <div className="relative group h-full bg-[#fefcf6] border border-[#ede8da]/80 shadow-sm rounded-2xl p-3 sm:p-5 flex flex-col hover:shadow-md transition-shadow min-h-[200px] md:min-h-0">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 1
                </div>
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Weekly Hours Worked</span>
                  <Clock className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex-1 min-h-0 w-full">
                  <WeeklyTimesheetChart />
                </div>
              </div>
              </CmsTileWrapper>

              {/* Card 1B: Needs Your Attention (Action Board tasks) */}
              <CmsTileWrapper tileId="tile-2" tileName="Needs Your Attention" className="flex-1 min-h-0">
              <div className="relative group h-full bg-[#fefcf6] border border-[#ede8da]/80 shadow-sm rounded-2xl p-3 sm:p-5 flex flex-col hover:shadow-md transition-shadow min-h-[200px] md:min-h-0">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 2
                </div>
                <div className="flex-1 min-h-0 w-full">
                  <NearestDueTasksWidget />
                </div>
              </div>
              </CmsTileWrapper>
            </div>

            {/* Slot 2: Aspect 16:9 (Wide, Large) -> Custom Grid of 3 Infographics */}
            <div className="hidden md:grid flex-[8] md:aspect-[16/9] grid-cols-2 grid-rows-[auto_1fr] gap-5 overflow-hidden">
              {/* Card 2A: Grant Agent Interface (Tile 3) */}
              <CmsTileWrapper tileId="tile-3" tileName="Grant Agent Interface">
              <div className="relative group bg-[#fefcf6] border border-[#ede8da]/80 shadow-sm rounded-2xl p-4 flex flex-col hover:shadow-md transition-shadow min-h-[60px]">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 3
                </div>
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grant Agent Interface</span>
                  <button onClick={() => setIsGrantConfigOpen(true)} className="p-1 rounded-lg bg-indigo-50 border border-indigo-200/60 hover:bg-indigo-100 text-indigo-500 hover:text-indigo-700 transition-colors shadow-sm cursor-pointer">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
                <ActiveAgentsPreview slots={agentSlots} onOpenHub={() => setIsGrantConfigOpen(true)} />
              </div>
              </CmsTileWrapper>

              {/* Card 2B: Grant Statuses (Manual) (Tile 4) */}
              <CmsTileWrapper tileId="tile-4" tileName="Grant Statuses">
              <div
                onClick={() => router.push("/portal/dashboard/soltheory/grant-statuses")}
                className="relative group bg-[#fefcf6] border border-[#ede8da]/80 shadow-sm rounded-2xl p-4 flex flex-col hover:shadow-md transition-shadow min-h-[60px] cursor-pointer"
              >
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 4
                </div>
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grant Statuses (Manual)</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
                <div className="flex-1 flex items-center justify-center border border-dashed border-indigo-100 bg-indigo-50/20 rounded-xl min-h-[40px] py-1 px-2 group-hover:bg-indigo-50/40 transition-colors">
                  <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider">View All Statuses</span>
                </div>
              </div>
              </CmsTileWrapper>

              {/* Card 2C / Tile 5: Bottom span-2 - Blank White Card with seamless internal grid layout */}
              <CmsTileWrapper tileId="tile-5" tileName="Grant Analytics" className="col-span-2">
              <div className="relative group bg-[#fefcf6] border border-[#ede8da]/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow min-h-[100px] overflow-hidden p-5 flex gap-5">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 5
                </div>
                
                {/* Left Column (50% width) - Split vertically into Top-Left and Bottom-Left */}
                <div className="flex-1 flex flex-col gap-4 h-full min-h-0">
                  {/* Top-Left: Grant Completions Line Graph */}
                  <div className="flex-1 min-h-[100px]">
                    <GrantCompletionsLineChart grants={grantsData} loading={grantsLoading} />
                  </div>
                  {/* Bottom-Left: Grant Status Pie/Donut Chart */}
                  <div className="flex-1 min-h-[100px]">
                    <GrantStatusPieChart grants={grantsData} loading={grantsLoading} />
                  </div>
                </div>

                {/* Right Column (50% width) - Suggested Grants scrollable list */}
                <div className="flex-1 flex flex-col h-full min-h-0">
                  <SuggestedGrantsList grants={grantsData} loading={grantsLoading} />
                </div>
              </div>
              </CmsTileWrapper>
            </div>
          </div>

          {/* Row 2: Middle (Left 16:9 Bar Chart, Right 16:9 Donut + Sparkline) */}
          <div className="flex flex-col lg:flex-row gap-4 md:gap-5 w-full">
            {/* Slot 3: Left (Aspect 16:9) -> News Slideshow (Tile 6) */}
            <CmsTileWrapper tileId="tile-6" tileName="SOL Theory News" className="flex-1">
            <div className="relative h-full aspect-video md:aspect-[16/9] rounded-2xl overflow-hidden">
              <NewsSlideshow />
              {/* Very light pastel yellow overlay to blend with earthy theme */}
              <div className="absolute inset-0 bg-amber-100/10 pointer-events-none rounded-2xl" />
            </div>
            </CmsTileWrapper>

            {/* Slot 4: Right (Aspect 16:9) -> Split vertically 2/3 and 1/3 (Blank White Cards) */}
            <div className="flex-1 md:aspect-[16/9] flex flex-col gap-4 md:gap-5">
              {/* Card 4A (2/3 Height): Organization Activity Feed (Tile 7) */}
              <CmsTileWrapper tileId="tile-7" tileName="Organization Activity" className="flex-[2] min-h-0">
              <div className="relative group h-full bg-[#fefcf6] border border-[#ede8da]/80 shadow-sm rounded-2xl w-full hover:shadow-md transition-shadow min-h-[180px] md:min-h-0 overflow-hidden">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 7
                </div>
                <OrgActivityFeed />
              </div>
              </CmsTileWrapper>

              {/* Card 4B (1/3 Height): Real-time Latency (Blank White Card) */}
              <CmsTileWrapper tileId="tile-8" tileName="Tile 8" className="flex-[1] min-h-0">
              <div className="relative group h-full bg-[#fefcf6] border border-[#ede8da]/80 shadow-sm rounded-2xl w-full hover:shadow-md transition-shadow min-h-0">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 8
                </div>
              </div>
              </CmsTileWrapper>
            </div>
          </div>

          {/* Row 3: Bottom (Left 16:9 KPI/Line Grid, Right 2:3 Stacked Milestones/Uptime) */}
          <div className="hidden md:flex flex-col lg:flex-row gap-5 w-full">
            {/* Slot 5: Aspect 16:9 (Wide, Large) -> Custom Grid of 3 Infographics (Blank White Cards) */}
            <div className="flex-[8] aspect-[16/9] grid grid-cols-2 grid-rows-[auto_1fr] gap-5">
              {/* Card 5A: Retention Rate (Left KPI - Blank White Card) */}
              <CmsTileWrapper tileId="tile-9" tileName="Tile 9">
              <div className="relative group bg-[#fefcf6] border border-[#ede8da]/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow min-h-[60px]">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 9
                </div>
              </div>
              </CmsTileWrapper>

              {/* Card 5B: Satisfaction CSAT (Right KPI - Blank White Card) */}
              <CmsTileWrapper tileId="tile-10" tileName="Tile 10">
              <div className="relative group bg-[#fefcf6] border border-[#ede8da]/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow min-h-[60px]">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 10
                </div>
              </div>
              </CmsTileWrapper>

              {/* Card 5C: Uptime Line Chart (Bottom span-2 - Blank White Card) */}
              <CmsTileWrapper tileId="tile-11" tileName="Tile 11" className="col-span-2">
              <div className="relative group bg-[#fefcf6] border border-[#ede8da]/80 shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow min-h-[100px]">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 11
                </div>
              </div>
              </CmsTileWrapper>
            </div>

            {/* Slot 6: Aspect 2:3 (Narrow, Tall) -> Splits vertically into 2 cards (Blank White Cards) */}
            <div className="flex-[3] aspect-[2/3] flex flex-col gap-5">
              {/* Card 6A: Upcoming Milestones (Blank White Card) */}
              <CmsTileWrapper tileId="tile-12" tileName="Tile 12" className="flex-1">
              <div className="relative group h-full bg-[#fefcf6] border border-[#ede8da]/80 shadow-sm rounded-2xl w-full hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 12
                </div>
              </div>
              </CmsTileWrapper>

              {/* Card 6B: System Status / Health (Blank White Card) */}
              <CmsTileWrapper tileId="tile-13" tileName="Tile 13" className="flex-1">
              <div className="relative group h-full bg-[#fefcf6] border border-[#ede8da]/80 shadow-sm rounded-2xl w-full hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 bg-slate-950 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-tl-2xl rounded-br-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none tracking-wider uppercase">
                  Tile 13
                </div>
              </div>
              </CmsTileWrapper>
            </div>
          </div>

        </div>
      </div>
      {/* Grant Agent Hub Modal */}
      {isGrantConfigOpen && (
        <GrantAgentHub onClose={() => setIsGrantConfigOpen(false)} />
      )}
      {/* Persistent background worker controller — always mounted */}
      <AgentWorkerController onSlotsChange={handleSlotsChange} />

      {/* CMS Tile Settings Popups */}
      {activeTilePopup && activeTilePopup !== 'tile-6' && (
        <TileSettingsPopup
          tileId={activeTilePopup}
          tileName={{
            'tile-1': 'Weekly Hours Worked',
            'tile-2': 'Nearest Due Tasks',
            'tile-3': 'Grant Agent Interface',
            'tile-4': 'Grant Statuses',
            'tile-5': 'Grant Analytics',
            'tile-7': 'Tile 7',
            'tile-8': 'Tile 8',
            'tile-9': 'Tile 9',
            'tile-10': 'Tile 10',
            'tile-11': 'Tile 11',
            'tile-12': 'Tile 12',
            'tile-13': 'Tile 13',
          }[activeTilePopup] || activeTilePopup}
          isOpen={true}
          onClose={() => setActiveTilePopup(null)}
        />
      )}
      {activeTilePopup === 'tile-6' && (
        <NewsSlideshowSettings
          isOpen={true}
          onClose={() => setActiveTilePopup(null)}
          slides={newsSlides}
          shuffleInterval={newsShuffleInterval}
          onSave={handleSaveNewsSlideshow}
        />
      )}
    </div>
  );
}
