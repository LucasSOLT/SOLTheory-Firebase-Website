"use client";

import React, { useState } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  HelpCircle, 
  Settings, 
  Menu,
  Plus,
  Calendar as CalendarIcon,
  Check,
  MoreVertical,
  Users,
  ChevronDown,
  Loader2
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser, useFirestore } from "@/firebase";
import { useSearchParams, usePathname } from "next/navigation";
import { doc, setDoc, getDoc } from "firebase/firestore";

export function CalendarView() {
  const { user } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("Month");
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  // Helper to generate calendar grid data
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const gridDays = [];
  // Previous month filler days
  const prevMonthDays = getDaysInMonth(year, month - 1);
  for (let i = firstDay - 1; i >= 0; i--) {
    gridDays.push({ day: prevMonthDays - i, isCurrentMonth: false });
  }
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    gridDays.push({ day: i, isCurrentMonth: true });
  }
  // Next month filler days (to make up 35 or 42 grid cells)
  const remainingCells = 42 - gridDays.length;
  for (let i = 1; i <= remainingCells; i++) {
    gridDays.push({ day: i, isCurrentMonth: false });
  }

  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [events, setEvents] = useState<any[]>([]);
  const [isFetched, setIsFetched] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Detect which org the user is in based on the URL path
  const origin = pathname.includes('/nxtchapter') ? 'nxtchapter' : 'soltheory';

  // Helper: fetch calendar events from backend
  const fetchCalendarEvents = async (uid: string) => {
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid })
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setIsGmailConnected(true);
      }
    } catch (err) {
      console.log("Calendar fetch error:", err);
    } finally {
      setIsFetched(true);
    }
  };

  // Step 1: Intercept OAuth redirect token, save it, then fetch events
  React.useEffect(() => {
    if (!user?.uid || !firestore) return;

    const rt = searchParams.get("rt");
    const agent = searchParams.get("agent") || "morpheus";

    if (rt) {
      // We just came back from OAuth — save the token to Firestore
      setIsConnecting(true);
      setDoc(doc(firestore, "users", user.uid), {
        id: user.uid,
        [`gmailOAuth_${agent}`]: { refreshToken: rt, connectedAt: new Date().toISOString() }
      }, { merge: true }).then(() => {
        // Clean the URL so the token isn't hanging around
        window.history.replaceState({}, document.title, window.location.pathname);
        // Now fetch the calendar with the freshly saved token
        fetchCalendarEvents(user.uid).finally(() => setIsConnecting(false));
      }).catch(err => {
        console.error("Failed to save OAuth token:", err);
        setIsFetched(true);
        setIsConnecting(false);
      });
    } else {
      // Normal page load — just try fetching events
      fetchCalendarEvents(user.uid);
    }
  }, [user, firestore, searchParams]);

  const today = new Date();
  const isToday = (d: number, isCurrent: boolean) => {
    return isCurrent && d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 mr-4">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center shadow-sm">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-medium text-slate-700 tracking-tight">Calendar</span>
          </div>

          <button onClick={goToday} className="px-4 py-1.5 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Today
          </button>

          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <h2 className="text-xl font-medium text-slate-800 w-48">
            {monthNames[month]} {year}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"><Search className="w-5 h-5" /></button>
            <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"><HelpCircle className="w-5 h-5" /></button>
            <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"><Settings className="w-5 h-5" /></button>
          </div>
          
          <select 
            value={view} 
            onChange={(e) => setView(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 outline-none cursor-pointer hidden md:block"
          >
            <option>Day</option>
            <option>Week</option>
            <option>Month</option>
            <option>Year</option>
            <option>Schedule</option>
          </select>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar */}
        <aside className="w-[280px] bg-white border-r border-slate-200 flex flex-col hidden lg:flex shrink-0">
          <div className="p-4">
            {/* Create Button (Google Style) */}
            <button className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:bg-slate-50 transition-all font-medium text-slate-700">
              <svg width="24" height="24" viewBox="0 0 36 36"><path fill="#34A853" d="M16 16v14h4V20z"></path><path fill="#4285F4" d="M30 16H20l-4 4h14z"></path><path fill="#FBBC05" d="M6 16v4h10l4-4z"></path><path fill="#EA4335" d="M20 16V6h-4v14z"></path><path fill="none" d="M0 0h36v36H0z"></path></svg>
              Create
            </button>
          </div>

          <div className="px-6 py-2">
            <h3 className="text-sm font-medium text-slate-800 mb-4">{monthNames[month]} {year}</h3>
            {/* Mini Calendar visualization can go here - simplified for now */}
            <div className="grid grid-cols-7 gap-1 text-center mb-6">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={`mini-h-${i}`} className="text-[10px] text-slate-500 font-medium py-1">{d}</div>
              ))}
              {gridDays.slice(0, 35).map((d, i) => (
                <div key={`mini-d-${i}`} className={`text-xs py-1 rounded-full ${isToday(d.day, d.isCurrentMonth) ? 'bg-blue-600 text-white' : (d.isCurrentMonth ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-400')}`}>
                  {d.day}
                </div>
              ))}
            </div>
            
            {/* Calendar Lists */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between text-sm font-medium text-slate-800 mb-2 px-2 hover:bg-slate-100 rounded-md py-1 cursor-pointer">
                  <span>My calendars</span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </div>
                <div className="space-y-1">
                  <label className="flex items-center gap-3 px-2 py-1.5 hover:bg-slate-100 rounded-md cursor-pointer group">
                    <div className="w-4 h-4 rounded appearance-none border-2 border-blue-500 bg-blue-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-slate-700 flex-1 truncate">{user?.displayName || "Personal"}</span>
                    <MoreVertical className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                  </label>
                  <label className="flex items-center gap-3 px-2 py-1.5 hover:bg-slate-100 rounded-md cursor-pointer group">
                    <div className="w-4 h-4 rounded appearance-none border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-slate-700 flex-1 truncate">Agent Actions</span>
                    <MoreVertical className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                  </label>
                  <label className="flex items-center gap-3 px-2 py-1.5 hover:bg-slate-100 rounded-md cursor-pointer group">
                    <div className="w-4 h-4 rounded appearance-none border-2 border-purple-500 bg-white flex items-center justify-center"></div>
                    <span className="text-sm text-slate-700 flex-1 truncate">Follow-ups</span>
                    <MoreVertical className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100" />
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm font-medium text-slate-800 mb-2 px-2 hover:bg-slate-100 rounded-md py-1 cursor-pointer">
                  <span>Other calendars</span>
                  <Plus className="w-4 h-4 text-slate-500" />
                </div>
                <div className="space-y-1">
                  <label className="flex items-center gap-3 px-2 py-1.5 hover:bg-slate-100 rounded-md cursor-pointer group">
                    <div className="w-4 h-4 rounded appearance-none border-2 border-amber-500 bg-amber-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-slate-700 flex-1 truncate">Holidays in United States</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Calendar Grid wrapper */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
          
          {/* Calendar Authorization Alert Layer */}
          {!isGmailConnected && isFetched && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-50 border border-amber-200 text-amber-800 px-6 py-3 rounded-xl shadow-lg flex items-center gap-4 text-sm font-medium animate-in slide-in-from-top-4">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
               <CalendarIcon className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <span>Connect your Google Account to view and edit real events.</span>
            </div>
            <button 
              onClick={() => {window.location.href=`/api/auth/google?uid=${user?.uid || ""}&agentId=morpheus&origin=${origin}&returnTo=calendar`}} 
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap shadow-sm"
            >
              Connect Google
            </button>
          </div>
          )}

          <div className="flex border-b border-slate-200 shrink-0">
            {daysOfWeek.map((day, i) => (
              <div key={day} className="flex-1 text-center py-2 text-[11px] font-medium text-slate-500 border-r border-slate-200 last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          
          <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-6">
            {gridDays.map((dateObj, i) => {
              const todayFlag = isToday(dateObj.day, dateObj.isCurrentMonth);
              let event = null;
              if (dateObj.isCurrentMonth) {
                // Find event mapping to this day
                const currentDayFormatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(dateObj.day).padStart(2, '0')}`;
                event = events.find(e => e.start && e.start.startsWith(currentDayFormatted));
                if (event) {
                  // Reformat for the UI
                  const dObj = new Date(event.start);
                  event = {
                    title: event.title,
                    color: event.color,
                    time: event.allDay ? "All Day" : dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase().replace(' ', '')
                  };
                }
              }
              
              return (
                <div 
                  key={i} 
                  className={`border-r border-b border-slate-200 p-1 flex flex-col min-h-[100px] transition-colors relative hover:bg-slate-50 group
                    ${!dateObj.isCurrentMonth ? 'bg-slate-50/50' : 'bg-white'}
                  `}
                >
                  <div className="flex justify-center mb-1">
                    <span className={`
                      text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mt-1
                      ${todayFlag ? 'bg-blue-600 text-white font-bold' : (dateObj.isCurrentMonth ? 'text-slate-700' : 'text-slate-400')}
                      ${!todayFlag && 'group-hover:bg-slate-200 cursor-pointer'}
                    `}>
                      {ifFirstOfMonth(dateObj.day) && !todayFlag ? `${monthNames[dateObj.isCurrentMonth ? month : (dateObj.day < 15 ? month + 1 : month - 1)].substring(0,3)} 1` : dateObj.day}
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-1 px-1 scrollbar-thin">
                    {event && (
                      <div className={`text-[11px] truncate px-2 py-0.5 rounded-md text-white font-medium shadow-sm cursor-pointer ${event.color}`}>
                        {event.time !== "All Day" ? <span className="font-bold opacity-80 mr-1">{event.time}</span> : ""} 
                        {event.title}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ifFirstOfMonth(day: number) {
  return day === 1;
}
