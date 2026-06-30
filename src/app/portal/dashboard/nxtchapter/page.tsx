"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useFirestore, useUser } from "@/firebase";
import { useRouter } from "next/navigation";

import { doc, updateDoc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { Clock, ExternalLink, Activity, ChevronRight, Settings } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useDarkMode } from '@/lib/useDarkMode';
import { WeeklyTimesheetChart } from "@/components/portal/WeeklyTimesheetChart";
import { NearestDueTasksWidget } from "@/components/portal/NearestDueTasksWidget";
import { GrantCompletionsLineChart } from "@/components/portal/GrantCompletionsLineChart";
import { GrantStatusPieChart } from "@/components/portal/GrantStatusPieChart";
import { SuggestedGrantsList } from "@/components/portal/SuggestedGrantsList";
import { GrantAgentHub } from "@/components/portal/GrantAgentHub";
import { useGrantsData } from "@/hooks/useGrantsData";
import { AgentWorkerController, type AgentSlotData } from "@/components/portal/AgentWorkerController";

import { NewsSlideshow } from "@/components/portal/NewsSlideshow";
import { OrgActivityFeed } from "@/components/portal/OrgActivityFeed";
import { QuickOverviewWidget } from "@/components/portal/QuickOverviewWidget";
import { AIAgentOperationsWidget } from "@/components/portal/AIAgentOperationsWidget";
import { CRMPipelineWidget } from "@/components/portal/CRMPipelineWidget";
import { UpcomingDeadlinesWidget } from "@/components/portal/UpcomingDeadlinesWidget";
import { ContentManagerBar } from "@/components/admin/ContentManagerBar";
import { useContentManagerStore } from "@/stores/content-manager-store";
import { TileSettingsPopup } from "@/components/admin/TileSettingsPopup";
import { NewsSlideshowSettings, type SlideData, type SlideshowSettings } from "@/components/admin/NewsSlideshowSettings";

export default function NxtChapterDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const isDarkMode = useDarkMode();
  const [isGrantConfigOpen, setIsGrantConfigOpen] = useState(false);
  const { grants: grantsData, loading: grantsLoading } = useGrantsData("nxtchapter");
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
    { headline: "NXT Chapter x Advanced Pathways", subtitle: "New Denver Shelter Partnership -- Expanding capacity to 3 additional locations across the metro area.", gradient: "from-indigo-600 via-violet-600 to-purple-700", badge: "PARTNERSHIP", date: "June 2025" },
    { headline: "AI Grant Discovery Launched", subtitle: "SOL Theory's autonomous grant agents now scan Grants.gov 24/7 -- surfacing federal funding opportunities in real time.", gradient: "from-emerald-600 via-teal-600 to-cyan-700", badge: "PRODUCT", date: "May 2025" },
    { headline: "Q2 Impact Report: 1,200+ Served", subtitle: "Across all partner shelters, NXT Chapter programs reached over 1,200 individuals with housing, workforce, and behavioral health services.", gradient: "from-amber-500 via-orange-500 to-red-500", badge: "IMPACT", date: "April 2025" },
    { headline: "Community Resource Fair -- July 2025", subtitle: "Save the date: Denver Community Resource Fair bringing together 40+ service providers, employers, and housing partners.", gradient: "from-rose-500 via-pink-500 to-fuchsia-600", badge: "EVENT", date: "Upcoming" },
    { headline: "Dashboard v2.0 -- Real-Time Analytics", subtitle: "New grant status tracking, Action Board with email triggers, and AI-powered insights rolling out across all client dashboards.", gradient: "from-sky-500 via-blue-600 to-indigo-700", badge: "TECH UPDATE", date: "June 2025" },
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

  /* presence tracking */
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const userRef = doc(firestore, "users", user.uid);
    updateDoc(userRef, { currentDashboard: "nxtchapter" }).catch(() => {});
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

  const { t, lang } = useTranslation();
  const tileStyle = isDarkMode ? 'bg-slate-900/80 border border-slate-700/60' : 'bg-[#faf8f3] border border-[#ede8da]/80';
  const [currentTime, setCurrentTime] = useState('');
  const [userTimezone, setUserTimezone] = useState('');

  // Load user timezone from localStorage / Firestore
  useEffect(() => {
    const savedTz = localStorage.getItem('user_timezone');
    if (savedTz) {
      setUserTimezone(savedTz);
    } else if (firestore && user?.uid) {
      getDoc(doc(firestore, 'users', user.uid)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          const tz = data.timezone || data.location || '';
          if (tz) {
            setUserTimezone(tz);
            localStorage.setItem('user_timezone', tz);
          }
        }
      }).catch(() => {});
    }
  }, [firestore, user?.uid]);

  // Live clock that updates every second
  useEffect(() => {
    const updateClock = () => {
      try {
        const opts: Intl.DateTimeFormatOptions = {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          ...(userTimezone ? { timeZone: userTimezone } : {}),
        };
        const formatted = new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-US', opts).format(new Date());
        setCurrentTime(formatted);
      } catch {
        setCurrentTime(new Date().toLocaleString());
      }
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [userTimezone, lang]);

  return (
    <div className={`w-full mx-auto animate-in fade-in duration-700 h-full overflow-y-auto overflow-x-hidden pt-4 md:pt-6 pb-10 px-3 sm:px-4 md:px-8 focus:outline-none transition-colors duration-500 ${isDarkMode ? 'bg-slate-950 text-slate-200' : ''}`} tabIndex={-1}>
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
          <h1 className={`text-xl sm:text-3xl font-light italic font-cormorant tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {t.welcomeBack} <span className="not-italic font-semibold">{(user?.displayName || t.user).replace(/\bLuke\b/g, lang === 'es' ? 'Lucas' : 'Luke')}</span>.
          </h1>
          <p className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {t.weekAtGlance}
          </p>
        </div>

        {/* Uniform Grid Layout with Solid White Structural Tiles & Hover Bookmarks */}
        <div className={`space-y-4 md:space-y-5 transition-all duration-500 ${contentManagerActive ? 'opacity-80 saturate-[0.6] select-none' : ''}`}>
          {/* CMS overlay label */}
          {contentManagerActive && (
            <div className="!pointer-events-none flex items-center justify-center py-4">
              <div className={`px-5 py-2.5 rounded-xl ${isDarkMode ? 'bg-slate-800/50 border border-slate-600' : 'bg-slate-900/5 border border-slate-200'}`}>
                <span className={`text-xs font-semibold uppercase tracking-[0.15em] ${isDarkMode ? 'text-slate-300' : 'text-slate-400'}`}>{t.clickTileToConfigure}</span>
              </div>
            </div>
          )}
          
          {/* Row 1: Top (Left: Focus tile, Right: News — balanced inline) */}
          <div className="flex flex-col lg:flex-row gap-4 md:gap-5 w-full" style={{ height: '420px', minHeight: '420px' }}>
            {/* Card: Here's what to focus on today */}
            <CmsTileWrapper tileId="tile-2" tileName="Needs Your Attention" className="flex-[5] min-h-0">
            <div className={`relative group h-full ${tileStyle} shadow-sm rounded-2xl p-3 sm:p-4 md:p-5 flex flex-col hover:shadow-md transition-shadow min-h-0`}>
              <div className="flex items-center justify-between mb-3 shrink-0">
                <span className={`text-xl font-medium font-cormorant tracking-wide ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Here&apos;s what to focus on today</span>
              </div>
              <div className="flex-1 min-h-0 w-full overflow-y-auto">
                <NearestDueTasksWidget orgId="nxtchapter" />
              </div>
            </div>
            </CmsTileWrapper>

            {/* Slot: News Slideshow (Tile 6) — compact inline */}
            <CmsTileWrapper tileId="tile-6" tileName="Company News" className="flex-[6] h-full">
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              <NewsSlideshow />
              <div className="absolute inset-0 bg-amber-100/10 pointer-events-none rounded-2xl" />
            </div>
            </CmsTileWrapper>
          </div>

          {/* Row 2: Middle (Left Grant Analytics, Right Quick Overview) */}
          <div className="flex flex-col lg:flex-row gap-4 md:gap-5 w-full items-stretch" style={{ maxHeight: "420px" }}>
            {/* Slot 3: Grant Analytics (merged Tiles 3+4+5) — wider */}
            <CmsTileWrapper tileId="tile-grants" tileName="Grant Analytics" className="flex-[2.5] min-w-0 overflow-hidden">
            <div className={`relative group ${tileStyle} shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow overflow-hidden p-5 flex flex-col`}>
              <div className="flex-1 flex gap-5 min-h-0 overflow-hidden">
                  {/* Left Column: Charts */}
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Header row with button */}
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-400'}`}>{t.performance}</span>
                      <button
                        onClick={() => setIsGrantConfigOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer"
                      >
                        <Activity className="w-3 h-3" />
                        {t.spawnSubagent}
                      </button>
                    </div>
                    <div className="flex-1 min-h-0">
                      <GrantCompletionsLineChart grants={grantsData} loading={grantsLoading} />
                    </div>
                    <div className="flex-1 min-h-0">
                      <GrantStatusPieChart grants={grantsData} loading={grantsLoading} />
                    </div>
                  </div>

                  {/* Divider */}
                  <div className={`w-px shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200/60'}`} />

                  {/* Right Column: Suggested Grants */}
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Header row with button */}
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-400'}`}>{t.suggestedGrants}</span>
                      <button
                        onClick={() => router.push("/portal/dashboard/nxtchapter/grant-statuses")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {t.viewAllGrants}
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <SuggestedGrantsList grants={grantsData} loading={grantsLoading} />
                    </div>
                  </div>
                </div>
            </div>
            </CmsTileWrapper>

            {/* Slot 4: Quick Overview — narrower */}
            <CmsTileWrapper tileId="tile-7" tileName="Quick Overview" className="flex-[1.5] min-w-0">
            <div className={`relative group ${tileStyle} shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-shadow overflow-hidden flex flex-col`}>
              <QuickOverviewWidget />
            </div>
            </CmsTileWrapper>
          </div>

          {/* Row 3: Bottom (Left 16:9 KPI/Line Grid, Right 2:3 Stacked) */}
          <div className="flex flex-col lg:flex-row gap-5 w-full">
            {/* Slot 5: Aspect 16:9 (Wide, Large) -> Two-column grid of AI Agent Operations and CRM Funnel */}
            <div className="flex-[8] aspect-[16/9] grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              {/* Tile 9: AI Agent Operations */}
              <CmsTileWrapper tileId="tile-9" tileName="Tile 9" className="h-full">
              <div className={`relative group ${tileStyle} shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-all duration-300 p-4 md:p-5 flex flex-col overflow-hidden`}>
                <AIAgentOperationsWidget orgId="nxtchapter" />
              </div>
              </CmsTileWrapper>

              {/* Tile 11: CRM Pipeline */}
              <CmsTileWrapper tileId="tile-11" tileName="Tile 11" className="h-full">
              <div className={`relative group ${tileStyle} shadow-sm rounded-2xl h-full w-full hover:shadow-md transition-all duration-300 p-4 md:p-5 flex flex-col overflow-hidden`}>
                <CRMPipelineWidget />
              </div>
              </CmsTileWrapper>
            </div>

            {/* Slot 6: Aspect 2:3 (Narrow, Tall) -> Splits vertically into 2 cards */}
            <div className="flex-[3] aspect-[2/3] flex flex-col gap-5">
              {/* Tile 10 */}
              <CmsTileWrapper tileId="tile-10" tileName="Tile 10" className="flex-1">
              <div className={`relative group h-full ${tileStyle} shadow-sm rounded-2xl w-full hover:shadow-md transition-all duration-300 p-4 md:p-5 flex flex-col overflow-hidden`}>
                <UpcomingDeadlinesWidget />
              </div>
              </CmsTileWrapper>

              {/* Card 6B: Weekly Hours Worked (moved from Row 1) */}
              <CmsTileWrapper tileId="tile-13" tileName="Weekly Hours Worked" className="flex-1">
              <div className={`relative group h-full ${tileStyle} shadow-sm rounded-2xl w-full hover:shadow-md transition-shadow p-3 sm:p-4 md:p-5 flex flex-col`}>
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-400'}`}>{t.weeklyHoursWorked}</span>
                  <Clock className={`w-4 h-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`} />
                </div>
                <div className="flex-1 min-h-0 w-full">
                  <WeeklyTimesheetChart />
                </div>
              </div>
              </CmsTileWrapper>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className={`mt-10 pt-6 pb-2 border-t text-center ${isDarkMode ? 'border-slate-700/40' : 'border-slate-200/40'}`}>
        <div className={`flex items-center justify-center gap-2 text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
          <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400/80'}>MyTaj LLC</span>
          <span className={isDarkMode ? 'text-slate-600' : 'text-slate-300'}>·</span>
          <a href="#" className={`transition-colors ${isDarkMode ? 'hover:text-slate-200' : 'hover:text-slate-600'}`}>{t.termsOfService}</a>
          <span className={isDarkMode ? 'text-slate-600' : 'text-slate-300'}>·</span>
          <a href="#" className={`transition-colors ${isDarkMode ? 'hover:text-slate-200' : 'hover:text-slate-600'}`}>{t.privacyPolicy}</a>
          <span className={isDarkMode ? 'text-slate-600' : 'text-slate-300'}>·</span>
          <button onClick={() => window.dispatchEvent(new Event('open-welcome-walkthrough'))} className={`transition-colors cursor-pointer ${isDarkMode ? 'hover:text-slate-200' : 'hover:text-slate-600'}`}>{t.howToUseInsight}</button>
        </div>
      </footer>

      {/* Grant Agent Hub Modal */}
      {isGrantConfigOpen && (
        <GrantAgentHub onClose={() => setIsGrantConfigOpen(false)} />
      )}
      {/* Persistent background worker controller */}
      <AgentWorkerController onSlotsChange={handleSlotsChange} />

      {/* CMS Tile Settings Popups */}
      {activeTilePopup && activeTilePopup !== 'tile-6' && (
        <TileSettingsPopup
          tileId={activeTilePopup}
          tileName={{
            'tile-2': "Here's What to Focus On",
            'tile-grants': 'Grant Analytics',
            'tile-7': 'Organization Activity',
            'tile-9': 'Tile 9',
            'tile-10': 'Tile 10',
            'tile-11': 'Customer Relations',
            'tile-13': 'Weekly Hours Worked',
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
