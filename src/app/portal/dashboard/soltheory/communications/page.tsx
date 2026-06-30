"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Mail, Inbox, Sparkles, ArrowRight, Bot, Clock, Activity } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

type EmailItem = {
  sender: string;
  subject: string;
  preview: string;
  time: string;
  status: "new" | "read" | "processing";
};

type OutboundDraft = {
  text: string;
  aiConfidence: number;
  time: string;
  isSelf: boolean;
};

const INBOUND_STREAM: EmailItem[] = [
  { sender: "client@advancepathways.org", subject: "Review: Onboarding Process", preview: "We would like to request an overview of the...", time: "10:42 AM", status: "new" },
  { sender: "support@nxtchapter.org", subject: "Server Ticket #4419", preview: "The dashboard is routing correctly, but we...", time: "9:15 AM", status: "processing" },
  { sender: "admin@soltheory.com", subject: "AI Model Performance Report", preview: "Attached is the weekly generative metrics...", time: "Yesterday", status: "read" },
  { sender: "hello@investor.co", subject: "Meeting requested: Series A", preview: "I was hoping we could sit down to discuss...", time: "Yesterday", status: "read" },
];

const OUTBOUND_DRAFTS = [
  { text: "Drafting response to admin@soltheory.com regarding AI performance...", aiConfidence: 98, time: "Yesterday", isSelf: false },
  { text: "Approved. Sent report via PDF.", aiConfidence: 100, time: "Yesterday", isSelf: true },
  { text: "Analyzing Ticket #4419 from nxtchapter.org...", aiConfidence: 95, time: "9:16 AM", isSelf: false },
];

export default function SolTheoryCommunications() {
  const [inbox, setInbox] = useState<EmailItem[]>(INBOUND_STREAM);
  const [drafts, setDrafts] = useState<OutboundDraft[]>(OUTBOUND_DRAFTS);
  const [newMessage, setNewMessage] = useState("");
  const draftBottomRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => { const check = () => setIsDarkMode(localStorage.getItem('insight_theme') === 'dark'); check(); const interval = setInterval(check, 500); window.addEventListener('storage', check); return () => { clearInterval(interval); window.removeEventListener('storage', check); }; }, []);

  useEffect(() => {
    draftBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [drafts]);

  const handleSendDraft = () => {
    if (!newMessage.trim()) return;
    
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setDrafts(prev => [...prev, { text: newMessage, aiConfidence: 100, time: timeString, isSelf: true }]);
    setNewMessage("");

    // Simulate AI Agent processing a new draft outline
    setTimeout(() => {
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setDrafts(prev => [...prev, { text: "AI Agent tracking new input. Drafting fallback responses...", aiConfidence: 89, time: replyTime, isSelf: false }]);
    }, 2500);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 h-full overflow-y-auto pb-10">

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div className="space-y-1">
          <h1 className={`text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Comms <span className="text-indigo-600">Center</span>
          </h1>
          <p className={`text-base max-w-2xl font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Global inbox observability and AI-assisted outbound email drafting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'bg-emerald-900/30 border border-emerald-700 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {t.agentConnected || 'Agent Connected'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[700px]">
        
        {/* Left Column: Inbound Email Feed */}
        <Card className={`lg:col-span-5 border flex flex-col overflow-hidden shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#faf8f3] border-slate-200'}`}>
          <CardHeader className={`border-b pb-4 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
            <CardTitle className={`text-lg flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-indigo-500" />
                {t.inboundStream || 'Inbound Stream'}
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Live</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-grow overflow-y-auto p-0 scrollbar-thin">
            <div className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
              {inbox.map((email, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 transition-all cursor-pointer group border-l-2 ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-[#f2ece0]'} ${email.status === 'new' ? (isDarkMode ? 'border-amber-500 bg-amber-900/20' : 'border-amber-400 bg-amber-50/50') : email.status === 'processing' ? (isDarkMode ? 'border-indigo-500 bg-indigo-900/20' : 'border-indigo-500 bg-indigo-50/50') : 'border-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className={`w-8 h-8 border ${isDarkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-[#faf6ed]'}`}>
                        <AvatarFallback className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {email.sender.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className={`font-semibold text-sm truncate max-w-[180px] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{email.sender}</span>
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {email.time}
                    </span>
                  </div>
                  <h4 className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{email.subject}</h4>
                  <p className={`text-xs line-clamp-2 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {email.preview}
                  </p>
                  
                  {/* Status Badges */}
                  <div className="mt-3 flex gap-2">
                     {email.status === 'new' && (
                       <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isDarkMode ? 'bg-amber-900/40 text-amber-400 border border-amber-700' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>{t.actionRequired || 'Action Required'}</span>
                     )}
                     {email.status === 'processing' && (
                       <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400 border border-indigo-700' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'}`}>AI Drafting</span>
                     )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Outbound AI Agent */}
        <Card className={`lg:col-span-7 border flex flex-col shadow-sm relative overflow-hidden rounded-2xl ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#faf8f3] border-slate-200'}`}>
          <CardHeader className={`border-b pb-4 relative z-10 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
            <CardTitle className={`text-lg flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                {t.outboundLogicConsole || 'Outbound Logic Console'}
              </div>
            </CardTitle>
            <CardDescription className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Collaborate with the AI agent to draft and approve outbound emails.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col p-6 h-full relative z-10">
            <div className="flex-grow space-y-6 overflow-y-auto pr-4 mb-4 scrollbar-thin">
              {drafts.map((msg, i) => (
                <div key={i} className={`flex gap-4 max-w-[85%] ${msg.isSelf ? 'ml-auto flex-row-reverse' : ''}`}>
                  {!msg.isSelf && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-sm">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  {msg.isSelf && (
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-200'}`}>
                      <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>You</span>
                    </div>
                  )}
                  <div className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.isSelf 
                        ? (isDarkMode ? 'bg-slate-700 text-white rounded-tr-sm border border-slate-600' : 'bg-slate-100 text-slate-800 rounded-tr-sm border border-slate-200')
                        : (isDarkMode ? 'bg-indigo-900/30 text-white border border-indigo-800 rounded-tl-sm' : 'bg-indigo-50 text-slate-800 border border-indigo-100 rounded-tl-sm')
                    }`}>
                      {msg.text}
                      {!msg.isSelf && (
                        <div className={`mt-3 pt-3 border-t flex items-center justify-between gap-4 ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                          <span className="text-xs font-medium text-indigo-600 flex items-center gap-1">
                            <Activity className="w-3 h-3" /> Confidence: {msg.aiConfidence}%
                          </span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" className={`h-6 text-[10px] uppercase font-bold ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>{t.reject || 'Reject'}</Button>
                            <Button size="sm" className="h-6 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] uppercase font-bold tracking-wider">{t.approve || 'Approve'}</Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-2 font-medium px-1">
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={draftBottomRef} className="h-4" />
            </div>
            
            <div className={`relative mt-auto pt-4 border-t shrink-0 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <form onSubmit={(e) => { e.preventDefault(); handleSendDraft(); }} className="flex gap-3 relative">
                <Input 
                  placeholder="Prompt the AI to modify drafts or send direct commands..." 
                  className={`h-12 rounded-xl focus-visible:ring-indigo-500 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : 'bg-[#faf8f3] border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <Button type="submit" className="h-12 px-6 bg-indigo-600 hover:bg-indigo-500 text-white border-0 shadow-sm rounded-xl">
                  {t.send || 'Send'} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
