"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Mail, Inbox, Sparkles, ArrowRight, Bot, Clock, Activity } from "lucide-react";

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
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            Comms <span className="text-indigo-600">Center</span>
          </h1>
          <p className="text-slate-500 text-base max-w-2xl font-medium">
            Global inbox observability and AI-assisted outbound email drafting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Agent Connected
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[700px]">
        
        {/* Left Column: Inbound Email Feed */}
        <Card className="lg:col-span-5 bg-white border border-slate-200 flex flex-col overflow-hidden shadow-sm rounded-2xl">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg text-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-indigo-500" />
                Inbound Stream
              </div>
              <span className="text-xs font-medium bg-slate-100 px-2 py-1 rounded text-slate-500">Live</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-grow overflow-y-auto p-0 scrollbar-thin">
            <div className="divide-y divide-slate-100">
              {inbox.map((email, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 hover:bg-slate-50 transition-all cursor-pointer group border-l-2 ${email.status === 'new' ? 'border-amber-400 bg-amber-50/50' : email.status === 'processing' ? 'border-indigo-500 bg-indigo-50/50' : 'border-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8 border border-slate-200 bg-slate-50">
                        <AvatarFallback className="text-xs font-bold text-slate-600">
                          {email.sender.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-sm text-slate-900 truncate max-w-[180px]">{email.sender}</span>
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {email.time}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-slate-700 mb-1">{email.subject}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {email.preview}
                  </p>
                  
                  {/* Status Badges */}
                  <div className="mt-3 flex gap-2">
                     {email.status === 'new' && (
                       <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">Action Required</span>
                     )}
                     {email.status === 'processing' && (
                       <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">AI Drafting</span>
                     )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Outbound AI Agent */}
        <Card className="lg:col-span-7 bg-white border border-slate-200 flex flex-col shadow-sm relative overflow-hidden rounded-2xl">
          <CardHeader className="border-b border-slate-100 pb-4 relative z-10">
            <CardTitle className="text-lg text-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                Outbound Logic Console
              </div>
            </CardTitle>
            <CardDescription className="text-slate-500">Collaborate with the AI agent to draft and approve outbound emails.</CardDescription>
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
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-slate-500">You</span>
                    </div>
                  )}
                  <div className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.isSelf 
                        ? 'bg-slate-100 text-slate-800 rounded-tr-sm border border-slate-200' 
                        : 'bg-indigo-50 text-slate-800 border border-indigo-100 rounded-tl-sm'
                    }`}>
                      {msg.text}
                      {!msg.isSelf && (
                        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between gap-4">
                          <span className="text-xs font-medium text-indigo-600 flex items-center gap-1">
                            <Activity className="w-3 h-3" /> Confidence: {msg.aiConfidence}%
                          </span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] uppercase font-bold text-slate-400 hover:text-slate-900">Reject</Button>
                            <Button size="sm" className="h-6 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] uppercase font-bold tracking-wider">Approve</Button>
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
            
            <div className="relative mt-auto pt-4 border-t border-slate-100 shrink-0">
              <form onSubmit={(e) => { e.preventDefault(); handleSendDraft(); }} className="flex gap-3 relative">
                <Input 
                  placeholder="Prompt the AI to modify drafts or send direct commands..." 
                  className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-500 h-12 rounded-xl"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <Button type="submit" className="h-12 px-6 bg-indigo-600 hover:bg-indigo-500 text-white border-0 shadow-sm rounded-xl">
                  Send <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
