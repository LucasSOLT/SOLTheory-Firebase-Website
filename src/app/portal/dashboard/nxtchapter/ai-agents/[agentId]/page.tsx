"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, User, Plus, Search, Settings, LogOut, MessageSquare, Send, Menu, Loader2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { useUser } from "@/firebase";

const mockHistory = [
  "Campaign strategy draft",
  "Follow-up email sequence",
  "A/B testing results",
  "Quarterly newsletter",
  "Client onboard templates"
];

type Message = {
  id: string;
  text: string;
  isSelf: boolean;
};

export default function AgentChatbotPage({ params }: { params: { agentId: string } }) {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const agents: Record<string, { name: string, greeting: string, theme: string, chatBg: string }> = {
    "outbound-email": { name: "Vance (Outbound Email)", greeting: "Hey there! I'm Vance. Ready to crush some outbound email campaigns and close those deals?", theme: "border-blue-500 text-blue-500", chatBg: "bg-blue-600/10 border-blue-500/20" },
    "inbound-email": { name: "Clara (Inbound Email)", greeting: "Hello! I'm Clara. Let's get these incoming messages sorted and keep our customers smiling.", theme: "border-green-500 text-green-500", chatBg: "bg-green-600/10 border-green-500/20" },
    "outbound-phone": { name: "Dex (Outbound Phone)", greeting: "What's up? It's Dex. Let's hit the phones and build some serious rapport today. Got the list?", theme: "border-purple-500 text-purple-500", chatBg: "bg-purple-600/10 border-purple-500/20" },
    "analytics": { name: "Aris (Analytics)", greeting: "Greetings. Aris here. I've compiled the latest data dashboards. Which metrics are we diving into?", theme: "border-orange-500 text-orange-500", chatBg: "bg-orange-600/10 border-orange-500/20" },
    "prospecting": { name: "Piper (Prospecting)", greeting: "Hi guys! Piper here. I've been scanning for the hottest new leads. Who are we targeting next?", theme: "border-pink-500 text-pink-500", chatBg: "bg-pink-600/10 border-pink-500/20" },
    "billing": { name: "Benji (Billing)", greeting: "Hi! Benji here. Let's process those invoices and look at the financials. Stress-free, guaranteed!", theme: "border-yellow-500 text-yellow-500", chatBg: "bg-yellow-600/10 border-yellow-500/20" },
  };

  const agent = agents[params.agentId as string];

  if (!agent) {
    notFound();
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), text: inputValue, isSelf: true };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    const currentInput = inputValue; // save for fetch payload
    setInputValue("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: currentInput, agentId: params.agentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        text: data.response || "No response generated.", 
        isSelf: false 
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      console.error(error);
      const errorMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        text: `Error: ${error.message}. Please check your terminal or .env.local keys.`, 
        isSelf: false 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden dark">
      {/* Sidebar */}
      <div className="hidden md:flex w-[260px] flex-col bg-muted/30 border-r border-slate-800">
        <div className="p-4 flex items-center gap-2">
          <Logo className="w-6 h-6" />
          <span className="font-bold text-lg text-white">NXT Chapter</span>
        </div>
        <div className="px-3 py-2 space-y-1">
          <Button variant="outline" className="w-full justify-start gap-2 h-10 border-slate-800 hover:bg-slate-800 text-white" onClick={() => setMessages([])}>
            <Plus className="w-4 h-4" /> New chat
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2 h-10 text-slate-400 hover:text-white hover:bg-slate-800">
            <Search className="w-4 h-4" /> Search chats
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2 h-10 text-slate-400 hover:text-white hover:bg-slate-800">
            <Settings className="w-4 h-4" /> Settings
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-2 mt-4 flex items-center justify-between">
            Recent 
            <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full border border-primary/20">Mock Data</span>
          </div>
          {mockHistory.map((item, i) => (
            <Button key={i} variant="ghost" className="w-full justify-start font-normal px-2 h-9 text-slate-400 hover:text-white hover:bg-slate-800">
              <MessageSquare className="w-4 h-4 mr-2" />
              <span className="truncate">{item}</span>
            </Button>
          ))}
        </div>
        <div className="p-3 border-t border-slate-800">
          {user ? (
            <div className="flex items-center gap-3 px-2 py-2 hover:bg-slate-800 rounded-md cursor-pointer transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0 border border-primary/30">
                {user.photoURL ? <img src={user.photoURL} alt="profile" /> : (user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
              </div>
              <div className="flex-1 truncate text-sm font-medium text-slate-200">
                {user.displayName || user.email}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-2 py-2 text-slate-400">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                <User className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium truncate">Not logged in</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative bg-[#0a0c10] text-slate-200">
        {/* Top Nav (Mobile toggle + Exit button) */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800 md:border-none shrink-0 z-10 bg-background/80 backdrop-blur-sm">
          <div className="md:hidden flex items-center gap-2 text-white">
            <Button variant="ghost" size="icon" className="hover:bg-slate-800">
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-semibold text-sm truncate">{agent.name}</span>
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" asChild className="gap-2 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800">
            <Link href="/portal/dashboard/nxtchapter/ai-agents">
              <LogOut className="w-4 h-4" />
              Dashboard
            </Link>
          </Button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin">
          <div className="max-w-3xl mx-auto space-y-8 pb-32">
            
            {/* Model Title */}
            <div className="flex justify-center mb-12 pt-8">
              <div className="text-3xl font-bold opacity-30 text-white tracking-widest uppercase">{agent.name}</div>
            </div>

            {/* Agent Greeting (Always visible first) */}
            <div className="flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-background shadow-sm ${agent.theme}`}>
                <Bot className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-2 pt-1">
                <div className="font-semibold text-sm text-slate-200">{agent.name.split(' ')[0]}</div>
                <div className={`text-slate-300 leading-relaxed inline-block p-4 rounded-2xl rounded-tl-sm border shadow-sm whitespace-pre-wrap ${agent.chatBg}`}>
                  {agent.greeting}
                </div>
              </div>
            </div>

            {/* Re-map to simulate chat log */}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.isSelf ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${msg.isSelf ? 'bg-slate-800 border-slate-700 text-slate-400' : `bg-background shadow-sm ${agent.theme}`}`}>
                  {msg.isSelf ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className={`flex-1 space-y-2 pt-1 ${msg.isSelf ? 'text-right' : ''}`}>
                  <div className="font-semibold text-sm text-slate-200">{msg.isSelf ? 'You' : agent.name.split(' ')[0]}</div>
                  <div className={`text-slate-300 leading-relaxed inline-block p-4 rounded-2xl shadow-sm whitespace-pre-wrap ${msg.isSelf ? 'bg-slate-800 rounded-tr-sm border border-slate-700' : `${agent.chatBg} rounded-tl-sm border`}`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-4 group animate-in fade-in duration-300">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-background shadow-sm ${agent.theme}`}>
                  <Bot className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-2 pt-1">
                  <div className="font-semibold text-sm text-slate-200">{agent.name.split(' ')[0]}</div>
                  <div className={`text-slate-400 inline-block p-4 rounded-xl rounded-tl-sm border shadow-sm flex items-center gap-2 h-14 ${agent.chatBg}`}>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> Thinking...
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} className="h-1" />
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0c10] via-[#0a0c10]/95 to-transparent pt-10">
          <div className="max-w-3xl mx-auto relative">
            <div className="relative border border-slate-700 rounded-2xl overflow-hidden bg-slate-900/80 shadow-lg focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
              <Input 
                placeholder={`Message ${agent.name}...`} 
                className="border-0 focus-visible:ring-0 shadow-none pr-12 min-h-[56px] py-4 bg-transparent resize-none overflow-hidden text-slate-200 placeholder:text-slate-500" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              />
              <Button 
                size="icon" 
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground w-8 h-8 transition-opacity disabled:opacity-50"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            </div>
            <div className="text-xs text-center text-slate-500 mt-3 flex justify-center gap-1 font-medium">
              SOL Theory AI Demo • AI responses are generated via Google Genkit API.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
