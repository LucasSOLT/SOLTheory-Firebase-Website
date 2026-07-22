"use client";

import { getAuthHeaders } from "@/lib/api-auth-client";

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
  Loader2,
  Sparkles,
  X,
  Send,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser, useFirestore } from "@/firebase";
import { useSearchParams, usePathname } from "next/navigation";
import { doc, setDoc, getDoc } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { logActivity } from '@/lib/activity-logger';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';

let _msgCounter = 0;
const uid = () => `msg-${Date.now()}-${++_msgCounter}-${Math.random().toString(36).substring(2, 7)}`;

export function CalendarView() {
  const { user } = useUser();
  const { knowledgeBaseText, pactText, orgBrainText } = useKnowledgeBase('soltheory');
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

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<{id: string, text: string, isSelf: boolean}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatBottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [messages, isTyping, isChatOpen]);

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || isTyping) return;

    const inputMessage = chatMessage;
    const userMsg = { id: uid(), text: chatMessage, isSelf: true };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setChatMessage("");
    logActivity(firestore, 'ai_chat_sent', { email: user?.email || '', displayName: user?.displayName }, 'Sent message in Calendar assistant', { messagePreview: inputMessage.substring(0, 200) });

    try {
      let rToken = null;
      if (user?.uid && firestore) {
        const docSnap = await getDoc(doc(firestore, "users", user.uid));
        const docData = docSnap.data();
        rToken = (docData?.gmailOAuth_jarvis?.refreshToken || docData?.gmailOAuth_morpheus?.refreshToken) || docData?.gmailOAuth?.refreshToken || null;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ 
          messages: [...messages, userMsg].map(m => ({
            role: m.isSelf ? "user" : "assistant",
            content: m.text
          })), 
          agentId: `nxtchapter_calendar_assistant`,
          soul: `You are the Google Calendar Assistant for this dashboard. You have direct authorization to manage the user's schedule. If the user asks you to schedule an event or check their calendar, USE your \`list_calendar_events\`, \`create_calendar_event\`, \`update_calendar_event\`, and \`delete_calendar_event\` function tools respectively. Do not pretend. Keep conversational replies extremely brief and to the point since you live in a popup window.`,
          brain: "",
          uid: user?.uid,
          refreshToken: rToken,
          contacts: [],
          knowledgeBaseText,
          pactText,
          orgBrainText
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get response");
      
      setMessages(prev => [...prev, { id: uid(), text: data.response || "No response generated.", isSelf: false }]);
      if (rToken) fetchCalendarEvents(rToken);
    } catch (error: any) {
       setMessages(prev => [...prev, { id: uid(), text: `Error: ${error.message}`, isSelf: false }]);
    } finally {
      setIsTyping(false);
    }
  };

  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isFetched, setIsFetched] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Detect which org the user is in based on the URL path
  const origin = pathname.includes('/nxtchapter') ? 'nxtchapter' : 'soltheory';

  // Helper: read refresh token from Firestore
  const getRefreshToken = async (uid: string): Promise<string | null> => {
    if (!firestore) return null;
    const docSnap = await getDoc(doc(firestore, "users", uid));
    const data = docSnap.data();
    return (data?.gmailOAuth_jarvis?.refreshToken || data?.gmailOAuth_morpheus?.refreshToken)
      || data?.gmailOAuth_email?.refreshToken
      || data?.["gmailOAuth_inbound-email"]?.refreshToken
      || data?.gmailOAuth?.refreshToken
      || null;
  };

  // Helper: fetch calendar events from backend using the refresh token
  const fetchCalendarEvents = async (refreshToken: string) => {
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ refreshToken })
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

  // Main effect: intercept OAuth redirect, or just load events
  React.useEffect(() => {
    if (!user?.uid || !firestore) return;

    const rt = searchParams.get("rt");
    const agent = searchParams.get("agent") || "jarvis";

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
        fetchCalendarEvents(rt).finally(() => setIsConnecting(false));
      }).catch(err => {
        console.error("Failed to save OAuth token:", err);
        setIsFetched(true);
        setIsConnecting(false);
      });
    } else {
      // Normal page load — read token from Firestore, then fetch events
      getRefreshToken(user.uid).then(token => {
        if (token) {
          fetchCalendarEvents(token);
        } else {
          setIsFetched(true);
        }
      });
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
              onClick={() => {window.location.href=`/api/auth/google?uid=${user?.uid || ""}&agentId=jarvis&origin=${origin}&returnTo=calendar`}} 
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
              let dayEvents: any[] = [];
              if (dateObj.isCurrentMonth) {
                // Find all events mapping to this day
                const currentDayFormatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(dateObj.day).padStart(2, '0')}`;
                dayEvents = events.filter(e => e.start && e.start.startsWith(currentDayFormatted)).map(e => {
                  const dObj = new Date(e.start);
                  return {
                    ...e,
                    time: e.allDay ? "All Day" : dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase().replace(' ', '')
                  };
                });
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
                  
                  <div className="flex-1 overflow-y-auto space-y-1 px-1 scrollbar-thin pb-1">
                    {dayEvents.map((evt, idx) => (
                      <div key={idx} onClick={() => setSelectedEvent(evt)} className={`text-[11px] truncate px-1.5 py-0.5 rounded bg-blue-500 text-white font-medium shadow-sm cursor-pointer ${evt.color || 'bg-blue-500'} hover:opacity-90`}>
                        {evt.time !== "All Day" ? <span className="font-bold opacity-80 mr-1">{evt.time}</span> : ""} 
                        {evt.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className={`p-4 ${selectedEvent.color || 'bg-blue-500'} flex items-center justify-between text-white`}>
              <h3 className="font-medium text-lg truncate flex-1">{selectedEvent.title}</h3>
              <button onClick={() => setSelectedEvent(null)} className="p-1 hover:bg-white/20 rounded-md transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
               <div>
                 <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Time</p>
                 <p className="text-slate-800 text-sm font-medium">{selectedEvent.time}</p>
               </div>
               {selectedEvent.location && (
                 <div>
                   <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Location</p>
                   <p className="text-slate-800 text-sm whitespace-pre-wrap">{selectedEvent.location}</p>
                 </div>
               )}
               {selectedEvent.link && (
                 <div>
                   <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Meeting Link</p>
                   <a href={selectedEvent.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-sm font-medium break-all underline flex items-center gap-1.5 mt-1">
                     Join Video Call <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                   </a>
                 </div>
               )}
               {selectedEvent.description && (
                 <div>
                   <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Notes / Description</p>
                   <div className="text-slate-700 text-sm bg-slate-50 border border-slate-100 rounded-xl p-4 whitespace-pre-wrap max-h-56 overflow-y-auto my-1">
                     {selectedEvent.description.replace(/<[^>]*>?/gm, '')}
                   </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* ══════ AI COPILOT TOGGLE ══════ */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`fixed bottom-6 right-6 z-[90] w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all cursor-pointer ${isChatOpen ? "bg-slate-700 hover:bg-slate-800" : "bg-blue-600 hover:bg-blue-700"} text-white`}
      >
        {isChatOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>

      {/* ══════ AI COPILOT SIDEBAR ══════ */}
      <div className={`fixed top-0 right-0 h-full z-[80] transition-transform duration-300 ease-in-out ${isChatOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="w-[380px] h-full bg-white border-l border-[#E5E7EB] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-[#E5E7EB] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 leading-tight">Calendar Assistant</h3>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Online</span>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
            {/* Welcome message */}
            <div className="flex justify-start">
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap bg-slate-100 text-slate-700 rounded-bl-md border border-slate-200">
                Hey there! I&apos;m your Calendar Assistant. Would you like me to schedule a meeting or check your availability?
              </div>
            </div>

            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.isSelf ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                  msg.isSelf
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-slate-100 text-slate-700 rounded-bl-md border border-slate-200"
                }`}>
                  {msg.isSelf ? msg.text : (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({node, ...props}) => <a {...props} className="text-blue-600 hover:text-blue-800 hover:underline font-medium break-all" target="_blank" rel="noopener noreferrer" />,
                        p: ({node, ...props}) => <p {...props} className="mb-2 last:mb-0" />
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed bg-slate-100 text-slate-700 rounded-bl-md border border-slate-200 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  <span>Checking schedule...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[#E5E7EB] px-4 py-3 shrink-0 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                placeholder="Ask the Assistant..."
                className="flex-1 h-10 px-3.5 text-sm rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatMessage.trim() || isTyping}
                className="w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">Try &quot;Schedule a meeting&quot; or &quot;Check my availability&quot;</p>
          </div>
        </div>
      </div>

    </div>
  );
}

function ifFirstOfMonth(day: number) {
  return day === 1;
}
