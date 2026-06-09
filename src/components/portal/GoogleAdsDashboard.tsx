"use client";

import React, { useState, useEffect, useRef } from "react";
import { Megaphone, Search, Menu, Settings, TrendingUp, MousePointerClick, Clock, DollarSign, Sparkles, X, Send, Play, CalendarClock, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc, setDoc, collection, onSnapshot } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { logActivity } from '@/lib/activity-logger';

let _msgCounter = 0;
const uid = () => `msg-${Date.now()}-${++_msgCounter}-${Math.random().toString(36).substring(2, 7)}`;

export function GoogleAdsDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [budget, setBudget] = useState<string>("50.00");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<{id: string, text: string, isSelf: boolean}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { t } = useTranslation();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [cronjobs, setCronjobs] = useState<any[]>([]);
  const [isFetchingCronjobs, setIsFetchingCronjobs] = useState(true);

  useEffect(() => {
    if (!user || !firestore) return;
    const unsub = onSnapshot(collection(firestore, "users", user.uid, "google_ads_cronjobs"), (snap) => {
       const jobs: any[] = [];
       snap.forEach(doc => jobs.push({ id: doc.id, ...doc.data() }));
       setCronjobs(jobs);
       setIsFetchingCronjobs(false);
    });
    return () => unsub();
  }, [user, firestore]);

  useEffect(() => {
    if (!user || !firestore) return;
    getDoc(doc(firestore, "users", user.uid, "settings", "google_ads")).then(docSnap => {
      if (docSnap.exists() && docSnap.data().budget) {
        setBudget(docSnap.data().budget);
      }
    }).catch(() => {});
  }, [user, firestore]);

  useEffect(() => {
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [messages, isTyping, isChatOpen]);

  const handleUpdateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    try {
       await setDoc(doc(firestore, "users", user.uid, "settings", "google_ads"), { budget }, { merge: true });
       alert(`Daily budget successfully updated to $${budget}`);
    } catch(err) {
       console.error(err);
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || isTyping) return;

    const inputMessage = chatMessage;
    const userMsg = { id: uid(), text: chatMessage, isSelf: true };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setChatMessage("");
    logActivity(firestore, 'ai_chat_sent', { email: user?.email || '', displayName: user?.displayName }, 'Sent message in Google Ads dashboard', { messagePreview: inputMessage.substring(0, 200) });

    try {
      let rToken = null;
      if (user?.uid && firestore) {
        const docSnap = await getDoc(doc(firestore, "users", user.uid));
        const docData = docSnap.data();
        rToken = (docData?.gmailOAuth_jarvis?.refreshToken || docData?.gmailOAuth_morpheus?.refreshToken) || docData?.gmailOAuth?.refreshToken || null;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [...messages, userMsg].map(m => ({
            role: m.isSelf ? "user" : "assistant",
            content: m.text
          })), 
          agentId: `nxtchapter_ads_assistant`,
          soul: `You are the Campaign Assistant, acting as a specialized Jarvis unit exclusively for Google Ads. You operate within a dashboard popup and have full authorization to 'manage' ads. Do not try to search google drive or use email tools. Do not break character. 
          
The user's CURRENT daily budget limit is set to: $${budget}.

[SIMULATION DIRECTIVES - CRITICAL]
If the user asks you to schedule a repetitive task, create an ad, or run a campaign:
1. enthusiastically confirm you have queued it.
2. APPEND exactly this marker to the VERY END of your message: [ACTION_SCHEDULED: <Short Task Name> | <Estimated Cost>]
Example: I have queued the image rotation ad. [ACTION_SCHEDULED: Daily LSA Image Rotation | $10/day]

If the user asks you to change or update their Daily Budget limit:
1. confirm you have updated it.
2. APPEND exactly this marker to the VERY END of your message: [BUDGET_UPDATED: <Number>]
Example: I have updated your daily limit. [BUDGET_UPDATED: 100.00]`,
          brain: "Do not hallucinate external API tools. Keep your responses very brief, confident, and professional, as you live in a small popup window.",
          uid: user?.uid,
          refreshToken: rToken,
          contacts: [],
          knowledgeBaseText: ""
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get response");
      
      let aiResponseText = data.response || "No response generated.";

      // SIMULATION OVERRIDES
      if (user && firestore) {
        // Parse Ad Draft / Cronjob
        const actionMatch = aiResponseText.match(/\[ACTION_SCHEDULED:\s*(.*?)\s*\|\s*(.*?)\]/);
        if (actionMatch) {
          const taskName = actionMatch[1].trim();
          const estCost = actionMatch[2].trim();
          aiResponseText = aiResponseText.replace(/\[ACTION_SCHEDULED:.*?\]/g, "").trim();
          
          try {
            const { addDoc, collection } = await import("firebase/firestore");
            await addDoc(collection(firestore, "users", user.uid, "google_ads_cronjobs"), {
              task: taskName,
              spend: estCost,
              status: "Simulated Ad Draft",
              nextRun: "Pending Activation"
            });
          } catch(e) { console.error("Failed to add mock draft", e); }
        }

        // Parse Budget Update
        const budgetMatch = aiResponseText.match(/\[BUDGET_UPDATED:\s*\$?(.*?)\]/);
        if (budgetMatch) {
          const newBudget = budgetMatch[1].trim();
          aiResponseText = aiResponseText.replace(/\[BUDGET_UPDATED:.*?\]/g, "").trim();
          
          try {
            setBudget(newBudget);
            const { setDoc, doc } = await import("firebase/firestore");
            await setDoc(doc(firestore, "users", user.uid, "settings", "google_ads"), { budget: newBudget }, { merge: true });
          } catch(e) { console.error("Failed to update budget map", e); }
        }
      }

      setMessages(prev => [...prev, { id: uid(), text: aiResponseText, isSelf: false }]);
    } catch (error: any) {
       setMessages(prev => [...prev, { id: uid(), text: `Error: ${error.message}`, isSelf: false }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#fefcf6] rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-[#fefcf6] shrink-0">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mr-4">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center shadow-sm">
              <Megaphone className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-medium text-slate-700 tracking-tight">
              Google Ads AI Manager
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 overflow-y-auto bg-[#faf6ed]/50 p-6 space-y-6">
        
        {/* Top Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-[#fefcf6] p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
               <MousePointerClick className="w-6 h-6 text-indigo-600" />
             </div>
             <div>
               <p className="text-sm text-slate-500 font-medium">Total Ad Clicks</p>
               <h3 className="text-2xl font-bold text-slate-800">12,408</h3>
               <p className="text-xs text-emerald-600 font-medium flex items-center mt-0.5">
                 <TrendingUp className="w-3 h-3 mr-1" /> +14.2% this week
               </p>
             </div>
           </div>

           <div className="bg-[#fefcf6] p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
               <DollarSign className="w-6 h-6 text-red-600" />
             </div>
             <div>
               <p className="text-sm text-slate-500 font-medium">Total Spent (30d)</p>
               <h3 className="text-2xl font-bold text-slate-800">$1,842.50</h3>
               <p className="text-xs text-slate-400 font-medium mt-0.5">
                 Avg. CPC: $0.15
               </p>
             </div>
           </div>

           <div className="bg-[#fefcf6] p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
               <Clock className="w-6 h-6 text-amber-600" />
             </div>
             <div>
               <p className="text-sm text-slate-500 font-medium">Avg. Time on Website</p>
               <h3 className="text-2xl font-bold text-slate-800">02:24</h3>
               <p className="text-xs text-emerald-600 font-medium flex items-center mt-0.5">
                 <TrendingUp className="w-3 h-3 mr-1" /> Highly engaged traffic
               </p>
             </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Left Area - Campaigns/Cronjobs */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-indigo-500" />
                Active AI Campaigns & Cronjobs
              </h3>
            </div>
            
            <div className="bg-[#fefcf6] rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100 min-h-[200px]">
              {isFetchingCronjobs ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : cronjobs.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <CalendarClock className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p>No active AI campaigns or cronjobs.</p>
                  <p className="text-xs mt-1">Use the Assistant chat to schedule one.</p>
                </div>
              ) : cronjobs.map((job) => (
                <div key={job.id} className="p-5 hover:bg-[#faf6ed] transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col min-w-0">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">
                        "{job.task}"
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                         <span className="flex items-center gap-1.5 font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                           <Play className="w-3 h-3 fill-current" /> {job.status || "Active"}
                         </span>
                         {job.nextRun && <span>Next run: {job.nextRun}</span>}
                         {job.spend && <span>Est. Cost: {job.spend}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="p-4 bg-indigo-50 flex items-center gap-3 border-t border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors">
                 <div className="w-8 h-8 rounded-full bg-[#fefcf6] flex items-center justify-center shadow-sm">
                   <Sparkles className="w-4 h-4 text-indigo-600" />
                 </div>
                 <div>
                   <p className="text-sm font-semibold text-indigo-900">Need a new automation?</p>
                   <p className="text-xs text-indigo-700 font-medium">Use the AI Assistant chat below to request a new Google Ads cronjob.</p>
                 </div>
              </div>
            </div>
          </div>

          {/* Right Area - Budget Control */}
          <div className="space-y-4">
             <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                Budget Configuration
              </h3>
             <div className="bg-[#fefcf6] rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
               {/* Decorative background element */}
               <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-emerald-50 rounded-full blur-3xl pointer-events-none" />
               
               <p className="text-sm text-slate-600 mb-6">
                 Set a strict daily budget limit. The AI will completely halt ad spending and operations if this limit is reached in a single day.
               </p>
               
               <form onSubmit={handleUpdateBudget} className="space-y-4 relative z-10">
                 <div>
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Daily Budget Limit (USD)</label>
                   <div className="relative">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">$</span>
                     <input 
                        type="number"
                        min="0"
                        step="0.01"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className="w-full pl-8 pr-4 py-3 bg-[#faf6ed] border border-slate-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                     />
                   </div>
                 </div>
                 <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition-colors shadow-md">
                   Update Limits
                 </button>
               </form>
             </div>
          </div>
        </div>
      </div>

      {/* â•â•â•â•â•â• AI COPILOT TOGGLE â•â•â•â•â•â• */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`fixed bottom-6 right-6 z-[90] w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all cursor-pointer ${isChatOpen ? "bg-slate-700 hover:bg-slate-800" : "bg-indigo-600 hover:bg-indigo-700"} text-white`}
      >
        {isChatOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>

      {/* â•â•â•â•â•â• AI COPILOT SIDEBAR â•â•â•â•â•â• */}
      <div className={`fixed top-0 right-0 h-full z-[80] transition-transform duration-300 ease-in-out ${isChatOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="w-[380px] h-full bg-[#fefcf6] border-l border-[#E5E7EB] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-[#E5E7EB] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 leading-tight">Campaign Assistant</h3>
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
                Hello! I am your Jarvis Ads Agent. Would you like me to analyze today's click-through rates or schedule a new campaign task?
              </div>
            </div>

            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.isSelf ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                  msg.isSelf
                    ? "bg-indigo-600 text-white rounded-br-md"
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
                  <span>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[#E5E7EB] px-4 py-3 shrink-0 bg-[#fefcf6]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                placeholder="Ask the AI agent..."
                className="flex-1 h-10 px-3.5 text-sm rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatMessage.trim() || isTyping}
                className="w-10 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">Try &quot;Schedule a new campaign&quot; or &quot;Update my budget&quot;</p>
          </div>
        </div>
      </div>

    </div>
  );
}
