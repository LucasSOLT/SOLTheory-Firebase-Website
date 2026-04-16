"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Menu, Settings, TrendingUp, Users, Clock, Sparkles, MessageSquare, X, Send, Bot, Play, Loader2, User, Youtube, Lightbulb, UserCheck, PlaySquare, Video } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc, setDoc, collection, onSnapshot, addDoc } from "firebase/firestore";
import ReactMarkdown from "react-markdown";

let _msgCounter = 0;
const uid = () => `msg-${Date.now()}-${++_msgCounter}-${Math.random().toString(36).substring(2, 7)}`;

export function YouTubeDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [demographic, setDemographic] = useState<string>("Young Adult Entrepreneurs");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<{id: string, text: string, isSelf: boolean}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { t } = useTranslation();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [drafts, setDrafts] = useState<any[]>([]);
  const [isFetchingDrafts, setIsFetchingDrafts] = useState(true);

  useEffect(() => {
    if (!user || !firestore) return;
    const unsub = onSnapshot(collection(firestore, "users", user.uid, "youtube_drafts"), (snap) => {
       const jobs: any[] = [];
       snap.forEach(doc => jobs.push({ id: doc.id, ...doc.data() }));
       setDrafts(jobs);
       setIsFetchingDrafts(false);
    });
    return () => unsub();
  }, [user, firestore]);

  useEffect(() => {
    if (!user || !firestore) return;
    getDoc(doc(firestore, "users", user.uid, "settings", "youtube_director")).then(docSnap => {
      if (docSnap.exists() && docSnap.data().demographic) {
        setDemographic(docSnap.data().demographic);
      }
    }).catch(() => {});
  }, [user, firestore]);

  useEffect(() => {
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [messages, isTyping, isChatOpen]);

  const handleUpdateDemographic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    try {
       await setDoc(doc(firestore, "users", user.uid, "settings", "youtube_director"), { demographic }, { merge: true });
       alert(`Target demographic successfully updated to: ${demographic}`);
    } catch(err) {
       console.error(err);
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || isTyping) return;

    const userMsg = { id: uid(), text: chatMessage, isSelf: true };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setChatMessage("");

    try {
      let rToken = null;
      if (user?.uid && firestore) {
        const docSnap = await getDoc(doc(firestore, "users", user.uid));
        const docData = docSnap.data();
        rToken = docData?.gmailOAuth_morpheus?.refreshToken || docData?.gmailOAuth?.refreshToken || null;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [...messages, userMsg].map(m => ({
            role: m.isSelf ? "user" : "assistant",
            content: m.text
          })), 
          agentId: `nxtchapter_youtube_director`,
          soul: `You are the YouTube Creative Director, a highly skilled AI strategist operating within a dashboard popup. 
          
The user's CURRENT Target Audience/Demographic is set to: "${demographic}". You must tailor your video ideas to this audience.

[SIMULATION DIRECTIVES - CRITICAL]
If the user asks you to draft a video, brainstorm a concept, or generate SEO metadata for a video:
1. Enthusiastically confirm you have added it to their Video Concepts board.
2. APPEND exactly this marker to the VERY END of your message: [DRAFT_CREATED: <Impactful Video Title> | <1 Sentence Description>]
Example: I have added this video concept to your board! [DRAFT_CREATED: How To Start A Business in 2026 | A step-by-step beginner guide to building LLCs, featuring viral hooks.]

If the user asks you to change or update their Target Demographic:
1. Confirm you have updated their target audience strategy.
2. APPEND exactly this marker to the VERY END of your message: [DEMOGRAPHIC_UPDATED: <New Target Audience>]
Example: I have refocused our strategy. [DEMOGRAPHIC_UPDATED: Teenagers interested in finance]`,
          brain: "Do not hallucinate external API tools or try to upload actual video files. Keep your responses very brief, confident, and professional, as you live in a small popup window.",
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
        // Parse Draft Concept
        const draftMatch = aiResponseText.match(/\[DRAFT_CREATED:\s*(.*?)\s*\|\s*(.*?)\]/);
        if (draftMatch) {
          const title = draftMatch[1].trim();
          const desc = draftMatch[2].trim();
          aiResponseText = aiResponseText.replace(/\[DRAFT_CREATED:.*?\]/g, "").trim();
          
          try {
            await addDoc(collection(firestore, "users", user.uid, "youtube_drafts"), {
              title: title,
              description: desc,
              status: "Awaiting Production",
              tags: "AI, Trending, Educational"
            });
          } catch(e) { console.error("Failed to add mock draft", e); }
        }

        // Parse Demographic Update
        const demoMatch = aiResponseText.match(/\[DEMOGRAPHIC_UPDATED:\s*(.*?)\]/);
        if (demoMatch) {
          const newDemo = demoMatch[1].trim();
          aiResponseText = aiResponseText.replace(/\[DEMOGRAPHIC_UPDATED:.*?\]/g, "").trim();
          
          try {
            setDemographic(newDemo);
            await setDoc(doc(firestore, "users", user.uid, "settings", "youtube_director"), { demographic: newDemo }, { merge: true });
          } catch(e) { console.error("Failed to update demographic map", e); }
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
    <div className="flex flex-col h-full w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mr-4">
            <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center shadow-sm">
              <Youtube className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-medium text-slate-700 tracking-tight">
              YouTube Creative Director
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
      <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 space-y-6">
        
        {/* Top Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
               <Video className="w-6 h-6 text-indigo-600" />
             </div>
             <div>
               <p className="text-sm text-slate-500 font-medium">Total Channel Views</p>
               <h3 className="text-2xl font-bold text-slate-800">142.5K</h3>
               <p className="text-xs text-emerald-600 font-medium flex items-center mt-0.5">
                 <TrendingUp className="w-3 h-3 mr-1" /> +8.4% this week
               </p>
             </div>
           </div>

           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
               <Users className="w-6 h-6 text-red-600" />
             </div>
             <div>
               <p className="text-sm text-slate-500 font-medium">Total Subscribers</p>
               <h3 className="text-2xl font-bold text-slate-800">12,184</h3>
               <p className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center">
                 <TrendingUp className="w-3 h-3 mr-1" /> +205 this month
               </p>
             </div>
           </div>

           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
               <Clock className="w-6 h-6 text-amber-600" />
             </div>
             <div>
               <p className="text-sm text-slate-500 font-medium">Avg. Watch Time</p>
               <h3 className="text-2xl font-bold text-slate-800">4m 12s</h3>
               <p className="text-xs text-emerald-600 font-medium flex items-center mt-0.5">
                 <TrendingUp className="w-3 h-3 mr-1" /> Highly engaged audience
               </p>
             </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Left Area - Concept Drafts */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-indigo-500" />
                AI Video Concept Board
              </h3>
            </div>
            
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100 min-h-[200px]">
              {isFetchingDrafts ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : drafts.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <PlaySquare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p>No video drafts available.</p>
                  <p className="text-xs mt-1">Use your Creative Director chat to brainstorm a concept!</p>
                </div>
              ) : drafts.map((draft) => (
                <div key={draft.id} className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col min-w-0">
                      <p className="text-sm font-bold text-slate-800 leading-snug">
                        {draft.title}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {draft.description}
                      </p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                         <span className="flex items-center gap-1.5 font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                           <Play className="w-3 h-3 fill-current" /> {draft.status || "Awaiting Production"}
                         </span>
                         {draft.tags && <span>Tags: {draft.tags}</span>}
                      </div>
                    </div>
                    <button className="flex-shrink-0 px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-xs font-semibold hover:bg-red-100 transition-colors border border-red-100">
                      Copy Metadata
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Area - Strategy Control */}
          <div className="space-y-4">
             <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-fuchsia-500" />
                Audience Strategy
              </h3>
             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
               {/* Decorative background element */}
               <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-fuchsia-50 rounded-full blur-3xl pointer-events-none" />
               
               <p className="text-sm text-slate-600 mb-6">
                 Set the target demographic for your channel. The AI Creative Director will use this to heavily tailor its video ideas, tone, and SEO tags.
               </p>
               
               <form onSubmit={handleUpdateDemographic} className="space-y-4 relative z-10">
                 <div>
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Target Audience</label>
                   <div className="relative">
                     <textarea 
                        value={demographic}
                        onChange={(e) => setDemographic(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 transition-all outline-none resize-none font-medium h-24 text-sm"
                     />
                   </div>
                 </div>
                 <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition-colors shadow-md">
                   Lock Strategy
                 </button>
               </form>
             </div>
          </div>
        </div>
      </div>

      {/* Floating AI Assistant Chat Widget */}
      <div className="absolute bottom-6 right-6 z-50 flex flex-col items-end">
         {/* Chat Interface Window */}
         {isChatOpen && (
           <div className="w-[340px] h-[450px] bg-white rounded-2xl shadow-2xl border border-slate-200 mb-4 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
             <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                   <Bot className="w-4 h-4 text-fuchsia-300" />
                 </div>
                 <div>
                   <p className="text-sm font-semibold">Creative Director</p>
                   <p className="text-[10px] text-slate-400 flex items-center gap-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Analyzing Trends
                   </p>
                 </div>
               </div>
               <button onClick={() => setIsChatOpen(false)} className="p-1 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white">
                 <X className="w-4 h-4" />
               </button>
             </div>
             
             {/* Chat History Area */}
             <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col gap-4">
                <div className="flex gap-3">
                   <div className="w-8 h-8 rounded-full bg-fuchsia-100 flex items-center justify-center shrink-0">
                     <Sparkles className="w-4 h-4 text-fuchsia-600" />
                   </div>
                   <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3 shadow-sm max-w-[85%]">
                      <p className="text-sm text-slate-700 leading-relaxed">
                        Hey there! I'm your Morpheus YouTube Director. Do you want to brainstorm some viral video concepts based on your current demographic strategy?
                      </p>
                   </div>
                </div>

                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-3 ${msg.isSelf ? 'flex-row-reverse' : ''}`}>
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.isSelf ? 'bg-slate-200 text-slate-600' : 'bg-fuchsia-100 text-fuchsia-600'}`}>
                       {msg.isSelf ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                     </div>
                     <div className={`border rounded-2xl p-3 shadow-sm max-w-[85%] ${msg.isSelf ? 'bg-slate-100 border-slate-200 rounded-tr-sm' : 'bg-white border-slate-200 rounded-tl-sm'}`}>
                        <div className={`text-sm text-slate-700 leading-relaxed ${!msg.isSelf ? '[&>p]:mb-2 [&>p:last-child]:mb-0' : ''}`}>
                          {msg.isSelf ? msg.text : <ReactMarkdown>{msg.text}</ReactMarkdown>}
                        </div>
                     </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex gap-3">
                     <div className="w-8 h-8 rounded-full bg-fuchsia-100 flex items-center justify-center shrink-0">
                       <Sparkles className="w-4 h-4 text-fuchsia-600" />
                     </div>
                     <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3 shadow-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        <span className="text-sm text-slate-500">Brainstorming...</span>
                     </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
             </div>

             {/* Input Area */}
             <div className="p-3 border-t border-slate-100 bg-white">
                <div className="relative">
                  <input 
                    type="text" 
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Ask the Director..."
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-100 border-transparent focus:bg-white border focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100 rounded-xl text-sm transition-all outline-none text-slate-700"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && chatMessage.trim()) {
                        handleSendMessage();
                      }
                    }}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!chatMessage.trim() || isTyping}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-fuchsia-600 disabled:bg-slate-300 text-white rounded-lg transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
             </div>
           </div>
         )}

         {/* Chat Toggle Button */}
         <button 
           onClick={() => setIsChatOpen(!isChatOpen)}
           className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-105 ${isChatOpen ? 'bg-slate-800 text-white' : 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'}`}
         >
           {isChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
         </button>
      </div>

    </div>
  );
}
