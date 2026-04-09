"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Mail, Inbox, Sparkles, ArrowRight, Bot, Clock, ArrowLeft, Activity } from "lucide-react";
import Link from "next/link";

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
    <div className="flex flex-col h-full overflow-y-auto bg-[#0A0A0B] text-slate-200 selection:bg-fuchsia-500/30">
      <Header />
      
      {/* Ambient Glow Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50%] h-[50%] bg-fuchsia-600/10 blur-[150px] rounded-full" />
      </div>

      <main className="flex-grow py-8 pt-24 px-4 md:px-8 relative z-10">
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
            <div className="space-y-1">
              <Link href="/portal/dashboard/soltheory" className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Hub
              </Link>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white flex items-center gap-3">
                Comms <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-fuchsia-400">Center</span>
              </h1>
              <p className="text-slate-400 text-lg max-w-2xl">
                Global inbox observability and AI-assisted outbound email drafting.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
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
            <Card className="lg:col-span-5 bg-white/5 backdrop-blur-xl border-white/10 flex flex-col overflow-hidden shadow-2xl">
              <CardHeader className="border-b border-white/5 bg-black/20 pb-4">
                <CardTitle className="text-lg text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Inbox className="w-5 h-5 text-fuchsia-400" />
                    Inbound Stream
                  </div>
                  <span className="text-xs font-medium bg-white/10 px-2 py-1 rounded text-slate-300">Live</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow overflow-y-auto p-0 scrollbar-thin">
                <div className="divide-y divide-white/5">
                  {inbox.map((email, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 hover:bg-white/5 transition-all cursor-pointer group border-l-2 ${email.status === 'new' ? 'border-amber-400 bg-amber-500/5' : email.status === 'processing' ? 'border-fuchsia-500 bg-fuchsia-500/5' : 'border-transparent'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8 border border-white/10 bg-black/40">
                            <AvatarFallback className="text-xs font-bold text-slate-300">
                              {email.sender.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-sm text-white truncate max-w-[180px]">{email.sender}</span>
                        </div>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {email.time}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-slate-200 mb-1">{email.subject}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {email.preview}
                      </p>
                      
                      {/* Status Badges */}
                      <div className="mt-3 flex gap-2">
                         {email.status === 'new' && (
                           <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">Action Required</span>
                         )}
                         {email.status === 'processing' && (
                           <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30">AI Drafting</span>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Right Column: Outbound AI Agent */}
            <Card className="lg:col-span-7 bg-white/5 backdrop-blur-xl border-white/10 flex flex-col shadow-2xl relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-tr from-fuchsia-500/5 to-transparent pointer-events-none" />
              <CardHeader className="border-b border-white/5 bg-black/20 pb-4 relative z-10">
                <CardTitle className="text-lg text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    Outbound Logic Console
                  </div>
                </CardTitle>
                <CardDescription className="text-slate-400">Collaborate with the AI agent to draft and approve outbound emails.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col p-6 h-full relative z-10">
                <div className="flex-grow space-y-6 overflow-y-auto pr-4 mb-4 scrollbar-thin">
                  {drafts.map((msg, i) => (
                    <div key={i} className={`flex gap-4 max-w-[85%] ${msg.isSelf ? 'ml-auto flex-row-reverse' : ''}`}>
                      {!msg.isSelf && (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-fuchsia-900/50 border border-white/20">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                      )}
                      {msg.isSelf && (
                        <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-slate-300">You</span>
                        </div>
                      )}
                      <div className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                        <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${
                          msg.isSelf 
                            ? 'bg-white/10 text-white rounded-tr-sm border border-white/10 backdrop-blur-md' 
                            : 'bg-black/40 text-slate-200 border border-fuchsia-500/20 rounded-tl-sm backdrop-blur-md'
                        }`}>
                          {msg.text}
                          {!msg.isSelf && (
                            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-4">
                              <span className="text-xs font-medium text-fuchsia-400 flex items-center gap-1">
                                <Activity className="w-3 h-3" /> Confidence: {msg.aiConfidence}%
                              </span>
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] uppercase font-bold text-slate-400 hover:text-white">Reject</Button>
                                <Button size="sm" className="h-6 px-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[10px] uppercase font-bold tracking-wider">Approve</Button>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-2 font-medium px-1">
                          {msg.time}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={draftBottomRef} className="h-4" />
                </div>
                
                <div className="relative mt-auto pt-4 border-t border-white/5 shrink-0">
                  <form onSubmit={handleSendDraft} className="flex gap-3 relative">
                    <Input 
                      placeholder="Prompt the AI to modify drafts or send direct commands..." 
                      className="bg-black/50 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-fuchsia-500 h-12 rounded-xl backdrop-blur-md"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <Button type="submit" className="h-12 px-6 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-fuchsia-900/20 rounded-xl">
                      Send <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
