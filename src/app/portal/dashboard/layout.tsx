"use client";

import React, { useState } from "react";
import { useUser } from "@/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/logo";
import { Search, Bell, MessageSquare, ChevronDown, ChevronRight, Hash, UserSquare, Ticket, LogOut, FileText, Presentation, Table, Settings, Video, Youtube, Megaphone, MapPin, Globe, HardDrive, Sparkles, Activity, Lightbulb, ClipboardList, BookUser, Home, Users, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useUser();
  const pathname = usePathname();
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Detect which org the user is in based on the current path
  const dashboardHome = pathname.includes('/nxtchapter') ? '/portal/dashboard/nxtchapter' : '/portal/dashboard/soltheory';

  React.useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const renderSkeletonBoxes = (count: number) => {
    return Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer mb-2">
        <div className="w-5 h-5 rounded-md bg-slate-200"></div>
        <div className="h-2.5 w-24 rounded-full bg-slate-200"></div>
      </div>
    ));
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden text-slate-900 font-sans">
      {/* Sidebar Wrapper */}
      <div className={`relative flex flex-col h-full flex-shrink-0 z-40 transition-all duration-300 ease-in-out group/sidebar overflow-visible ${isSidebarCollapsed ? "w-0" : "w-64"}`}>
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-slate-200 shadow-sm rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 z-50 transition-all cursor-pointer"
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${isSidebarCollapsed ? "" : "rotate-180"}`} />
        </button>

        <aside className="w-full bg-white flex flex-col h-full relative shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-x-hidden">
          <div className="w-64 flex flex-col h-full"> {/* Inner fixed width container */}
            <Link href={dashboardHome} className="p-6 pt-8 pb-8 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer">
              {pathname.includes('/nxtchapter') ? (
                <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-40 h-auto object-contain" />
              ) : (
             <>
               <div className="bg-black text-white p-1.5 rounded-lg shrink-0">
                 <Logo className="w-5 h-5 text-white" />
               </div>
               <span className="font-bold text-lg text-slate-900">{t.dashboard}</span>
             </>
           )}
        </Link>

        <div className="flex-grow overflow-y-auto px-4 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Section 1 */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 mb-3 px-3 tracking-widest uppercase">{t.menu}</div>
            <div className="space-y-1 mb-4 pt-1">
              <Link href={`${dashboardHome}`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname === dashboardHome ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname === dashboardHome ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                  <Home className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Homepage</span>
              </Link>
              <Link href={`${dashboardHome}/ai-agents/jarvis`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.includes('/ai-agents') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.includes('/ai-agents') ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Agent Manager</span>
              </Link>
              <Link href={`${dashboardHome}/faq`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/faq') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/faq') ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                  <HelpCircle className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">FAQ</span>
              </Link>
            </div>
            
            {/* @Messages Collapsible */}
            <div className="mt-2">
              <button 
                onClick={() => setIsMessagesOpen(!isMessagesOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors cursor-pointer mb-1 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-900 transition-colors">{t.messages}</span>
                </div>
                {isMessagesOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              
              {isMessagesOpen && (
                <div className="pl-12 pr-3 py-1 space-y-1 animate-in slide-in-from-top-1 fade-in duration-200">
                  <Link href={`${dashboardHome}/communications/dm`} className={`flex items-center gap-2 py-2 px-2 cursor-pointer rounded-lg transition-colors ${pathname.endsWith('/communications/dm') ? 'bg-indigo-50 text-indigo-900 font-semibold shadow-sm' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'}`}>
                    <UserSquare className={`w-3.5 h-3.5 ${pathname.endsWith('/communications/dm') ? 'text-indigo-600' : ''}`} />
                    <span className="text-xs font-medium">{t.dm}</span>
                  </Link>
                  <Link href={`${dashboardHome}/communications/org-thread`} className={`flex items-center gap-2 py-2 px-2 cursor-pointer rounded-lg transition-colors ${pathname.endsWith('/communications/org-thread') ? 'bg-indigo-50 text-indigo-900 font-semibold shadow-sm' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'}`}>
                    <Hash className={`w-3.5 h-3.5 ${pathname.endsWith('/communications/org-thread') ? 'text-indigo-600' : ''}`} />
                    <span className="text-xs font-medium">{t.orgThread}</span>
                  </Link>
                  <Link href={`${dashboardHome}/communications/contacts`} className={`flex items-center gap-2 py-2 px-2 cursor-pointer rounded-lg transition-colors ${pathname.endsWith('/communications/contacts') ? 'bg-indigo-50 text-indigo-900 font-semibold shadow-sm' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'}`}>
                    <BookUser className={`w-3.5 h-3.5 ${pathname.endsWith('/communications/contacts') ? 'text-indigo-600' : ''}`} />
                    <span className="text-xs font-medium">Contacts</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
          
          {/* Section 2 */}
          <div className="mb-2">
            <div className="text-[10px] font-bold text-slate-400 mb-3 px-3 tracking-widest uppercase">{t.reports}</div>
            
            <div className="space-y-1">
              <Link href={`${dashboardHome}/analytics`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/analytics') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/analytics') ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                  <Activity className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm font-medium">Analytics</span>
              </Link>
              <Link href={`${dashboardHome}/support-tickets`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-2 font-semibold ${pathname.endsWith('/support-tickets') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/support-tickets') ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                  <Ticket className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm font-medium">Submit a support ticket</span>
              </Link>

              <Link href={`${dashboardHome}/surveys`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/surveys') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/surveys') ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                  <ClipboardList className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm font-medium">Surveys</span>
              </Link>
            </div>
          </div>

          {/* Section 3 */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 mb-3 px-3 tracking-widest uppercase">{t.googleIntegrations}</div>
            
            <Link href={`${dashboardHome}/calendar`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-2 font-semibold ${pathname.endsWith('/calendar') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/calendar') ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>
              </div>
              <span className="text-sm">{t.googleCalendar}</span>
            </Link>

           <div className="space-y-1 mb-2">
             <Link href={`${dashboardHome}/docs`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-2 font-semibold ${pathname.endsWith('/docs') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
               <FileText className="w-4 h-4 ml-1 text-slate-500" />
               <span className="text-sm font-medium">{t.googleDocs}</span>
             </Link>
             <Link href={`${dashboardHome}/slides`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-2 font-semibold ${pathname.endsWith('/slides') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
               <Presentation className="w-4 h-4 ml-1 text-slate-500" />
               <span className="text-sm font-medium">{t.googleSlides}</span>
             </Link>
             <Link href={`${dashboardHome}/sheets`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-2 font-semibold ${pathname.endsWith('/sheets') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
               <Table className="w-4 h-4 ml-1 text-slate-500" />
               <span className="text-sm font-medium">{t.googleSheets}</span>
             </Link>

             {/* Disabled Integrations */}
             <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
               <Video className="w-4 h-4 ml-1" />
               <span className="text-sm">Google Meet</span>
             </div>
             <Link href={`${dashboardHome}/youtube`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-1 font-semibold ${pathname.endsWith('/youtube') ? 'bg-fuchsia-50 text-fuchsia-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-fuchsia-900'}`}>
               <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/youtube') ? 'bg-fuchsia-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-fuchsia-600'}`}>
                 <Youtube className="w-4 h-4 ml-1" />
               </div>
               <span className="text-sm">YouTube</span>
             </Link>
             <Link href={`${dashboardHome}/google-ads`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-1 font-semibold ${pathname.endsWith('/google-ads') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
               <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/google-ads') ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                 <Megaphone className="w-4 h-4 ml-1" />
               </div>
               <span className="text-sm">Google Ads</span>
             </Link>
             <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
               <MapPin className="w-4 h-4 ml-1" />
               <span className="text-sm">Google Maps</span>
             </div>
             <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
               <Globe className="w-4 h-4 ml-1" />
               <span className="text-sm">Google Earth</span>
             </div>
              <Link href={`${dashboardHome}/drive`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-2 font-semibold ${pathname.endsWith('/drive') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <HardDrive className="w-4 h-4 ml-1 text-slate-500" />
                <span className="text-sm font-medium">Google Drive</span>
              </Link>
             <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
               <Sparkles className="w-4 h-4 ml-1" />
               <span className="text-sm">Gemini AI</span>
             </div>
           </div>

            {renderSkeletonBoxes(3)}
          </div>
        </div>

        {/* User Footer Profile */}
        <div className="p-4 mt-auto mb-4 flex items-center gap-2">
          <Link href={`${dashboardHome}/settings`} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors shrink-0 text-slate-400 hover:text-slate-900 bg-white border border-slate-100 shadow-sm">
             <Settings className="w-5 h-5" />
          </Link>
          <div className="flex-1 flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback className="bg-slate-100 font-bold text-sm text-slate-600">{user?.displayName?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate text-slate-900">{user?.displayName || "User"}</span>
              <span className="text-[10px] text-slate-500 truncate">{user?.email || ""}</span>
            </div>
          </div>
        </div>
          </div>
        </aside>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col h-full overflow-hidden w-full relative z-10">
        {/* Top Navbar */}
        <header className="h-[88px] flex items-center justify-between px-10 shrink-0">
          <div className="flex-grow max-w-[480px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={t.searchPlaceholder}
              className="pl-12 bg-white border border-slate-100 shadow-sm focus-visible:ring-1 focus-visible:ring-slate-200 rounded-full h-12 w-full text-sm font-medium text-slate-700 placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 px-4 py-2 bg-rose-500/90 hover:bg-rose-600 text-white text-sm font-semibold rounded-full transition-colors shadow-sm">
                <LogOut className="h-3.5 w-3.5" />
                {t.exitDashboard}
              </Link>
              <button className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-white transition-colors bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center relative">
                <Bell className="h-4 w-4" />
                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
             </button>
             <div className="h-8 w-px bg-slate-200 mx-2"></div>
             <Avatar className="h-10 w-10 cursor-pointer ring-2 ring-white shadow-sm">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback className="bg-slate-800 text-white font-bold">{user?.displayName?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-grow overflow-hidden px-10 pb-10 flex flex-col relative w-full h-full">
          {children}
        </main>
      </div>
    </div>
  );
}
