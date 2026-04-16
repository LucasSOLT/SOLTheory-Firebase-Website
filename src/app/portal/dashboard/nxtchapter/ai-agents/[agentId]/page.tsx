"use client";

import { useState, useRef, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, User, Plus, Search, Settings, LogOut, MessageSquare, Send, Menu, Loader2, Sun, Moon, Mail, Brain, Trash2, MoreVertical, X, CheckCircle2, Paperclip, Cloud } from "lucide-react";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import ReactMarkdown from "react-markdown";

let _msgCounter = 0;
const uid = () => `msg-${Date.now()}-${++_msgCounter}-${Math.random().toString(36).substring(2, 7)}`;

type Message = {
  id: string;
  text: string;
  isSelf: boolean;
  hiddenContext?: string;
};

type Session = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
};

type EmailMeta = {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  date: string;
};

export default function AgentChatbotPage(props: { params: Promise<{ agentId: string }> }) {
  const params = use(props.params);
  const { user } = useUser();
  const firestore = useFirestore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);


  
  // Observer Panel States
  const [incomingEmails, setIncomingEmails] = useState<EmailMeta[]>([]);
  const [ignoredEmails, setIgnoredEmails] = useState<string[]>([]);
  const [openEmailDropdown, setOpenEmailDropdown] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [isObserverOpen, setIsObserverOpen] = useState(false);
  const [isObserverFullScreen, setIsObserverFullScreen] = useState(false);
  const [isDeletingEmail, setIsDeletingEmail] = useState<string | null>(null);
  const [observerInputValue, setObserverInputValue] = useState("");
  const [isGmailConnected, setIsGmailConnected] = useState(false);

  // Agent Knowledge Base Config
  const [agentConfig, setAgentConfig] = useState({ soul: "", brain: "", heartbeat: "manual" });
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const agents: Record<string, { name: string, greeting: string, theme: string, chatBg: string, accent?: string }> = {
    "morpheus": { 
      name: "Morpheus (Executive Agent)", 
      greeting: "Hello. I am Morpheus, your dedicated AI assistant for NXT Chapter. How can I assist you today?", 
      theme: "border-blue-200 text-blue-600 bg-blue-50", 
      chatBg: "bg-white border-slate-200 shadow-sm",
      accent: "text-blue-600"
    }
  };

  const agent = agents[params.agentId as string];

  if (!agent) {
    notFound();
  }

  // Session & Theme Initialization
  useEffect(() => {

    const savedSessionsStr = localStorage.getItem(`agent_sessions_${params.agentId}`);
    if (savedSessionsStr) {
      try {
        const parsed: Session[] = JSON.parse(savedSessionsStr);
        // Deduplicate message IDs (purges stale voice-agent duplicates from localStorage)
        const deduped = parsed.map(s => {
          const seen = new Set<string>();
          return { ...s, messages: s.messages.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; }) };
        });
        setSessions(deduped);
        if (deduped.length > 0) {
          const mostRecent = deduped.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setActiveSessionId(mostRecent.id);
          setMessages(mostRecent.messages);
        } else {
          startNewSession();
        }
      } catch(e) { 
        startNewSession(); 
      }
    } else {
      startNewSession();
    }
  }, [params.agentId]);

  useEffect(() => {
    const savedConfig = localStorage.getItem(`agent_config_${params.agentId}`);
    if (savedConfig) {
      try { setAgentConfig(JSON.parse(savedConfig)); } catch (e) {}
    }
  }, [params.agentId]);

  useEffect(() => {
    localStorage.setItem(`agent_config_${params.agentId}`, JSON.stringify(agentConfig));
  }, [agentConfig, params.agentId]);

  useEffect(() => {
    if (params.agentId !== "morpheus" || !user?.uid || !firestore) return;
    getDoc(doc(firestore, "users", user.uid)).then(docSnap => {
      const data = docSnap.data();
      const connected = !!data?.[`gmailOAuth_${params.agentId}`]?.refreshToken 
        || !!data?.gmailOAuth_morpheus?.refreshToken
        || !!data?.gmailOAuth_email?.refreshToken
        || !!data?.["gmailOAuth_inbound-email"]?.refreshToken
        || !!data?.gmailOAuth?.refreshToken;
      setIsGmailConnected(connected);
    });
  }, [user, firestore, params.agentId]);



  // Ignored Emails Persistence
  useEffect(() => {
    const savedIgnored = localStorage.getItem('agent_ignored_emails');
    if (savedIgnored) {
      try { setIgnoredEmails(JSON.parse(savedIgnored)); } catch(e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('agent_ignored_emails', JSON.stringify(ignoredEmails));
  }, [ignoredEmails]);

  useEffect(() => {
    if (activeSessionId) {
      setSessions(prev => {
        const updated = prev.map(s => {
          if (s.id === activeSessionId) {
            const title = s.title === "New Chat" && messages.filter(m => m.isSelf).length > 0 
              ? messages.filter(m => m.isSelf)[0].text.substring(0, 30) + "..."
              : s.title;
            return { ...s, messages, title };
          }
          return s;
        });
        return updated;
      });
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeSessionId, params.agentId]);

  useEffect(() => {
    if (sessions.length > 0 && !isTyping) {
      const savedSessions = sessions.map(s => s.id === activeSessionId ? { ...s, updatedAt: Date.now() } : s);
      localStorage.setItem(`agent_sessions_${params.agentId}`, JSON.stringify(savedSessions));
    }
  }, [sessions, isTyping, activeSessionId, params.agentId]);

  // Observer Polling Effect
  useEffect(() => {
    if (params.agentId !== "morpheus" || !user?.uid || !firestore) return;

    const pollInbox = async () => {
      try {
        setIsPolling(true);
        const userDoc = await getDoc(doc(firestore, "users", user.uid));
        const userData = userDoc.data();
        let refreshToken = userData?.[`gmailOAuth_${params.agentId}`]?.refreshToken
          || userData?.gmailOAuth_morpheus?.refreshToken
          || userData?.gmailOAuth_email?.refreshToken
          || userData?.["gmailOAuth_inbound-email"]?.refreshToken
          || userData?.gmailOAuth?.refreshToken;
        if (!refreshToken) {
           setIsPolling(false);
           return;
        }

        const res = await fetch("/api/webhooks/gmail/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: user.uid, refreshToken })
        });
        const data = await res.json();
        if (data.status === "success") {
          setIncomingEmails(data.emails || []);
        }
      } catch (err) {
        console.error("Polling error:", err);
      } finally {
        setIsPolling(false);
      }
    };

    pollInbox();
    if (agentConfig.heartbeat === "manual") return;
    const intervalId = setInterval(pollInbox, typeof agentConfig.heartbeat === "string" && agentConfig.heartbeat.includes('m') ? 60000 : 30000);
    return () => clearInterval(intervalId);
  }, [params.agentId, user, firestore, agentConfig.heartbeat]);

  const startNewSession = () => {
    const newSession: Session = {
      id: Date.now().toString(),
      title: "New Chat",
      updatedAt: Date.now(),
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
  };

  const loadSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setActiveSessionId(session.id);
      setMessages(session.messages);
      setIsKnowledgeBaseOpen(false);
    }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    localStorage.setItem(`agent_sessions_${params.agentId}`, JSON.stringify(updated));
    
    if (activeSessionId === id) {
      if (updated.length > 0) {
        const mostRecent = updated.sort((a,b) => b.updatedAt - a.updatedAt)[0];
        setActiveSessionId(mostRecent.id);
        setMessages(mostRecent.messages);
      } else {
        startNewSession();
      }
    }
  };

  // Fetch all knowledge base text from client-side Firestore
  const getKnowledgeBaseText = async (): Promise<string> => {
    if (!user?.uid || !firestore) return "";
    try {
      const { collection, getDocs } = await import("firebase/firestore");
      
      const possibleAgentIds = [
        params.agentId,
        `soltheory_${params.agentId}`,
        `nxtchapter_${params.agentId}`
      ];
      if (params.agentId === "morpheus") {
        possibleAgentIds.push("email", "soltheory_email", "nxtchapter_email");
      }

      const texts: string[] = [];
      
      for (const searchId of possibleAgentIds) {
        try {
          const chunksSnap = await getDocs(collection(firestore, "users", user.uid, "agents", searchId, "knowledge_chunks"));
          chunksSnap.forEach(d => {
            const data = d.data();
            if (data.text && typeof data.text === "string") texts.push(data.text);
          });
        } catch (err) {
          // ignore error for missing collections
        }
      }
      
      // Cap at 30 chunks to stay within context limits
      return texts.slice(0, 30).join("\n\n");
    } catch (err) {
      console.error("KB fetch error:", err);
      return "";
    }
  };

  const handleIgnoreEmail = (email: EmailMeta) => {
    setIgnoredEmails(prev => [...prev, email.from]);
    setIncomingEmails(prev => prev.filter(e => e.from !== email.from));
    setOpenEmailDropdown(null);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMsg: Message = { id: uid(), text: inputValue, isSelf: true };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsTyping(true);
    setInputValue("");

    try {
      let rToken = null;
      if (user?.uid && firestore && isGmailConnected) {
        const docSnap = await getDoc(doc(firestore, "users", user.uid));
        const docData = docSnap.data();
        rToken = docData?.[`gmailOAuth_${params.agentId}`]?.refreshToken;
        if (!rToken) rToken = docData?.gmailOAuth_morpheus?.refreshToken;
        if (!rToken) rToken = docData?.gmailOAuth_email?.refreshToken;
        if (!rToken) rToken = docData?.["gmailOAuth_inbound-email"]?.refreshToken;
        if (!rToken) rToken = docData?.gmailOAuth?.refreshToken;
      }

      const apiMessages = newMessages.map(m => ({
        role: m.isSelf ? "user" : "assistant",
        content: m.hiddenContext ? `${m.hiddenContext}\n\n[USER COMMENT]: ${m.text}` : m.text
      }));

      const kbText = await getKnowledgeBaseText();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: apiMessages, 
          agentId: `nxtchapter_${params.agentId}`,
          soul: `${agentConfig.soul}\n\n[USER CONTEXT]\nAct on behalf of this user. The user's email address is: ${user?.email || 'Unknown'}. Do not ask them for their email.`,
          brain: agentConfig.brain,
          uid: user?.uid,
          refreshToken: rToken,
          contacts: [],
          knowledgeBaseText: kbText
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      const aiMsg: Message = { 
        id: uid(), 
        text: data.response || "No response generated.", 
        isSelf: false 
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      console.error(error);
      const errorMsg: Message = { 
        id: uid(), 
        text: `Error: ${error.message}. Please check your terminal or .env.local keys.`, 
        isSelf: false 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleBatchSync = async () => {
    if (!user?.uid || !firestore || incomingEmails.length === 0) return;
    setIsBatchSyncing(true);
    try {
      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      const userData = userDoc.data();
      let refreshToken = userData?.[`gmailOAuth_${params.agentId}`]?.refreshToken;
      if (!refreshToken && params.agentId === "morpheus") {
        refreshToken = userData?.gmailOAuth_email?.refreshToken;
      }
      if (!refreshToken) refreshToken = userData?.gmailOAuth_morpheus?.refreshToken;
      if (!refreshToken) refreshToken = userData?.gmailOAuth?.refreshToken;
      
      const res = await fetch("/api/webhooks/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, refreshToken })
      });
      const data = await res.json();
      if (res.ok) {
        // Drop a system message into chat for context
        setMessages(prev => [...prev, { id: uid(), text: `✅ System: Drafted replies for ${incomingEmails.length} emails. Check your Gmail Drafts folder!`, isSelf: false }]);
        setIncomingEmails([]);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { id: uid(), text: `Error processing emails: ${err.message}`, isSelf: false }]);
    } finally {
      setIsBatchSyncing(false);
    }
  };

  return (
    <div className={`flex w-full h-full bg-slate-50  overflow-hidden transition-colors duration-300`}>
      {/* Sessions Sidebar */}
      <div className="hidden md:flex w-[260px] flex-col bg-slate-100  border-r border-slate-200  shrink-0">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo className="w-6 h-6  invert opacity-80 " />
            <span className="font-bold text-lg text-slate-900 ">NXT Chapter</span>
          </div>
        </div>
        <div className="px-3 py-2 space-y-1">
          <Button variant="outline" className="w-full justify-start gap-2 h-10 bg-white  border-slate-300  hover:bg-slate-100 :bg-slate-800 text-slate-900  shadow-sm" onClick={startNewSession}>
            <Plus className="w-4 h-4" /> New chat
          </Button>
          
          {isSearchOpen ? (
            <div className="flex items-center gap-2 px-2 h-10 border border-slate-300  rounded-md bg-white  shadow-sm transition-all focus-within:ring-1 focus-within:ring-primary">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input 
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full bg-transparent border-none outline-none text-sm text-slate-800  placeholder:text-slate-400"
              />
              <button onClick={() => { setIsSearchOpen(false); setSearchQuery(""); }} className="text-slate-400 hover:text-slate-600 :text-slate-200 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setIsSearchOpen(true)} className="w-full justify-start gap-2 h-10 text-slate-500 hover:text-slate-800  :text-white :bg-slate-800">
              <Search className="w-4 h-4" /> Search chats
            </Button>
          )}

          <Button variant="ghost" asChild className="w-full justify-start gap-2 h-10 text-slate-500 hover:text-slate-800  :text-white :bg-slate-800">
            <Link href="/portal/dashboard/nxtchapter/settings">
              <Settings className="w-4 h-4" /> Settings
            </Link>
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-2 mt-4 flex items-center justify-between">
            Recent
          </div>
          {sessions.sort((a, b) => b.updatedAt - a.updatedAt).map((session) => {
            const isMatch = searchQuery.trim() !== "" && session.title.toLowerCase().includes(searchQuery.toLowerCase());
            return (
              <div 
                key={session.id} 
                className={`group flex items-center w-full px-2 mt-1 h-9 rounded-md transition-colors ${activeSessionId === session.id ? 'bg-slate-200  text-slate-900 ' : 'text-slate-600 hover:text-slate-900  :text-white hover:bg-slate-100 :bg-slate-800'} ${isMatch ? 'ring-2 ring-primary/50 bg-primary/10 ' : ''}`}
              >
                <button 
                  onClick={() => loadSession(session.id)}
                  className="flex-1 flex items-center justify-start font-normal h-full text-sm outline-none bg-transparent overflow-hidden"
                >
                  <MessageSquare className="w-4 h-4 mr-2 shrink-0" />
                  <span className="truncate">{session.title}</span>
                </button>
                <button onClick={(e) => deleteSession(e, session.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity ml-1 rounded hover:bg-slate-200 :bg-slate-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
        <div className="p-3 border-t border-slate-200 ">
          {user ? (
            <div className="flex items-center gap-3 px-2 py-2 hover:bg-slate-100 :bg-slate-800 rounded-md cursor-pointer transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0 border border-primary/30">
                {user.photoURL ? <img src={user.photoURL} alt="profile" /> : (user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
              </div>
              <div className="flex-1 truncate text-sm font-medium text-slate-700 ">
                {user.displayName || user.email}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-2 py-2 text-slate-500 ">
              <div className="w-8 h-8 rounded-full bg-slate-200  flex items-center justify-center shrink-0 border border-slate-300 ">
                <User className="w-4 h-4" />
              </div>
              <div className="text-sm font-medium truncate">Not logged in</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Chat Area */}
      <div className="flex-1 flex flex-col h-full relative bg-white  text-slate-800  transition-colors duration-300 min-w-0 overflow-hidden">
        {/* Top Nav (Mobile toggle + Exit button) */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200  shrink-0 z-10 bg-white/80  backdrop-blur-sm">
          <div className="md:hidden flex items-center gap-2 text-slate-800 ">
            <Button variant="ghost" size="icon" className="hover:bg-slate-200 :bg-slate-800">
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-semibold text-sm truncate">{agent.name}</span>
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" asChild className="gap-2 bg-white  border-slate-300  text-slate-900  hover:text-slate-900 :text-white hover:bg-slate-100 :bg-slate-800 shadow-sm">
            <Link href="/portal/dashboard/nxtchapter/ai-agents">
              <LogOut className="w-4 h-4" />
              Dashboard
            </Link>
          </Button>
        </div>

        {/* Chat Area */}
        {isKnowledgeBaseOpen ? (
<div className="flex-1 overflow-y-auto p-4 md:p-8">
                 <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-200 pb-56">

               <div className="flex items-center justify-between border-b border-slate-200/70  pb-6">
                 <div>
                   <h2 className="text-3xl font-extrabold flex items-center gap-3 text-slate-900  tracking-tight">
                     <Brain className="w-8 h-8 text-primary" /> Core Programming Logic
                   </h2>
                   <p className="text-slate-500  mt-2 text-sm">Inject the specific identity and operational directives for {agent.name.split(' ')[0]}.</p>
                 </div>
                 <Button variant="ghost" size="icon" onClick={() => setIsKnowledgeBaseOpen(false)} className="rounded-full hover:bg-slate-100 :bg-white/10 text-slate-500 hover:text-slate-900  :text-white">
                   <X className="w-6 h-6" />
                 </Button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                 {/* Soul Card */}
                 <div className="relative group bg-white/50  border border-slate-200/60  rounded-3xl p-6 shadow-sm hover:shadow-md transition-all hover:border-fuchsia-500/30 backdrop-blur-xl">
                   <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                   <div className="relative">
                     <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center mb-4 border border-fuchsia-500/20 shadow-inner">
                       <User className="w-5 h-5 text-fuchsia-500 " />
                     </div>
                     <h3 className="text-lg font-bold text-slate-900  mb-2">The Soul (Personality)</h3>
                     <p className="text-xs text-slate-500  mb-4 line-clamp-2">Describe exactly how the agent should speak, format its answers, and behave.</p>
                     <textarea
                       className="w-full h-32 p-4 bg-white/80  border border-slate-200  rounded-2xl resize-none focus:ring-1 focus:ring-fuchsia-500 outline-none transition-shadow text-sm text-slate-900  placeholder:text-slate-400 shadow-inner"
                       placeholder="e.g., You are incredibly enthusiastic, use heavy slang, and always sign off with 'Cheers!'."
                       value={agentConfig.soul}
                       onChange={e => setAgentConfig({ ...agentConfig, soul: e.target.value })}
                     />
                   </div>
                 </div>

                 {/* Brain Card */}
                 <div className="relative group bg-white/50  border border-slate-200/60  rounded-3xl p-6 shadow-sm hover:shadow-md transition-all hover:border-indigo-500/30 backdrop-blur-xl">
                   <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                   <div className="relative">
                     <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 border border-indigo-500/20 shadow-inner">
                       <Brain className="w-5 h-5 text-indigo-500 " />
                     </div>
                     <h3 className="text-lg font-bold text-slate-900  mb-2">The Brain (Directives)</h3>
                     <p className="text-xs text-slate-500  mb-4 line-clamp-2">Provide strict operational directives or knowledge context that the agent must absolutely adhere to.</p>
                     <textarea
                       className="w-full h-32 p-4 bg-white/80  border border-slate-200  rounded-2xl resize-none focus:ring-1 focus:ring-indigo-500 outline-none transition-shadow text-sm text-slate-900  placeholder:text-slate-400 shadow-inner"
                       placeholder="e.g., Never disclose internal API keys. Base pricing logic on $50/hr."
                       value={agentConfig.brain}
                       onChange={e => setAgentConfig({ ...agentConfig, brain: e.target.value })}
                     />
                   </div>
                 </div>

                 {/* Heartbeat Card (Full Width) */}
                 <div className="relative group bg-white/50  border border-slate-200/60  rounded-3xl p-6 shadow-sm hover:shadow-md transition-all hover:border-emerald-500/30 backdrop-blur-xl md:col-span-2 flex flex-col md:flex-row gap-6 items-center">
                   <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                   
                   <div className="relative flex items-center gap-4 flex-1">
                     <div className="w-12 h-12 shrink-0 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                       <Bot className="w-6 h-6 text-emerald-500 " />
                     </div>
                     <div>
                       <h3 className="text-lg font-bold text-slate-900  flex items-center gap-2">
                         The Heartbeat (Autonomous Engine)
                       </h3>
                       <p className="text-xs text-slate-500  mt-1 max-w-md">
                         Determine how frequently the agent performs automated background sweeps.
                       </p>
                     </div>
                   </div>

                   <div className="relative shrink-0 w-full md:w-64">
                     <select
                       className="w-full p-4 bg-white  border border-slate-200  rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none text-sm font-bold text-slate-900  shadow-inner transition-shadow hover:border-emerald-500/30 cursor-pointer appearance-none"
                       value={agentConfig.heartbeat}
                       onChange={e => setAgentConfig({ ...agentConfig, heartbeat: e.target.value })}
                     >
                       <option value="manual">Manual Execution Only</option>
                       <option value="30s">Autopilot: Every 30 Seconds</option>
                       <option value="1m">Autopilot: Every 1 Minute</option>
                     </select>
                     <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse pointer-events-none shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                   </div>
                 </div>
               </div>

               <div className="pt-8 flex justify-center">
                  <Button onClick={() => setIsKnowledgeBaseOpen(false)} className="bg-black hover:bg-slate-900 text-white  px-12 h-12 rounded-full font-bold shadow-xl transition-all transform hover:scale-105 active:scale-95 gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Compile Settings & Return
                  </Button>
               </div>
             </div>
           </div>
        ) : (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin">
          <div className="max-w-3xl mx-auto space-y-8 pb-56">
            
            {/* Model Title */}
            <div className="flex justify-center mb-12 pt-8">
              <div className="text-3xl font-bold opacity-30 text-slate-600  tracking-widest uppercase">{agent.name}</div>
            </div>

            {/* Agent Greeting (Always visible first) */}
            <div className="flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-white  shadow-sm ${agent.theme}`}>
                <Bot className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-2 pt-1">
                <div className="font-semibold text-sm text-slate-700 ">{agent.name.split(' ')[0]}</div>
                <div className={`text-slate-700  leading-relaxed inline-block p-4 rounded-2xl rounded-tl-sm border shadow-sm whitespace-pre-wrap ${agent.chatBg}`}>
                  {agent.greeting}
                </div>
              </div>
            </div>

            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.isSelf ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${msg.isSelf ? 'bg-slate-200  border-slate-300  text-slate-600 ' : `bg-white  shadow-sm ${agent.theme}`}`}>
                  {msg.isSelf ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className={`flex-1 space-y-2 pt-1 ${msg.isSelf ? 'text-right' : ''}`}>
                  <div className="font-semibold text-sm text-slate-700 ">{msg.isSelf ? 'You' : agent.name.split(' ')[0]}</div>
                  <div className={`text-slate-700  leading-relaxed inline-block p-4 rounded-2xl shadow-sm text-left ${msg.isSelf ? 'bg-slate-100  rounded-tr-sm border border-slate-200  whitespace-pre-wrap' : `${agent.chatBg} rounded-tl-sm border [&>p]:mb-4 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>strong]:font-bold`}`}>
                    {msg.isSelf ? msg.text : <ReactMarkdown>{msg.text}</ReactMarkdown>}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-4 group animate-in fade-in duration-300">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-white  shadow-sm ${agent.theme}`}>
                  <Bot className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-2 pt-1">
                  <div className="font-semibold text-sm text-slate-700 ">{agent.name.split(' ')[0]}</div>
                  <div className={`text-slate-500  inline-block p-4 rounded-xl rounded-tl-sm border shadow-sm flex items-center gap-2 h-14 ${agent.chatBg}`}>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> Thinking...
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} className="h-32" />
          </div>
        </div>
        )}

        {/* Input Area */}
        {!isKnowledgeBaseOpen && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 via-slate-50/95   to-transparent pt-10">
          <div className="max-w-3xl mx-auto relative flex flex-col items-center">
            
            <div className="w-full flex justify-start items-center mb-2 px-1 gap-2">
              <Button onClick={() => setIsKnowledgeBaseOpen(true)} variant="ghost" size="sm" className="h-7 text-xs gap-1.5 font-semibold text-slate-600  hover:text-slate-900 :text-white rounded-full bg-slate-200/50  hover:bg-slate-200 :bg-slate-800 transition-colors pointer-events-auto">
                 <Brain className="w-3.5 h-3.5" />
                 Knowledge Base (Soul, Brain, Heartbeat)
              </Button>
            </div>

            <div className="relative w-full border border-slate-300  rounded-2xl overflow-hidden bg-white/80  shadow-lg focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all flex items-center">
              <div className="flex items-center pl-3 gap-1 shrink-0">
                 <button onClick={() => window.location.href = `/api/auth/google?uid=${user?.uid || ""}&agentId=${params.agentId}&origin=nxtchapter`} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer" title="Connect Google Drive">
                   <Cloud className="w-5 h-5" />
                 </button>
                 <label className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer" title="Upload File">
                   <Paperclip className="w-5 h-5" />
                   <input type="file" className="hidden" onChange={async (e) => {
                     if(e.target.files?.length) {
                       const file = e.target.files[0];
                       setIsTyping(true);
                       try {
                         const formData = new FormData();
                         formData.append("file", file);
                         const res = await fetch("/api/knowledge/ingest", { method: "POST", body: formData });
                         const data = await res.json();
                         if (res.ok && data.chunks) {
                           const fullText = data.chunks.map((c: any) => c.text).join(" ");
                           const sysMsg: Message = { 
                             id: uid(), 
                             text: `Attached file: ${file.name}`, 
                             isSelf: true,
                             hiddenContext: `The user has attached a file named ${file.name}. Here are the extracted contents:\n\n${fullText}`
                           };
                           setMessages(prev => [...prev, sysMsg]);
                         } else {
                           throw new Error(data.error || "Failed to parse file");
                         }
                       } catch (err: any) {
                         setMessages(prev => [...prev, { id: uid(), text: `Failed to attach file: ${err.message}`, isSelf: false }]);
                       } finally {
                         setIsTyping(false);
                         e.target.value = "";
                       }
                     }
                   }} />
                 </label>
              </div>
              <Input 
                placeholder={`Message ${agent.name}...`} 
                className="border-0 focus-visible:ring-0 shadow-none flex-1 pr-14 min-h-[56px] py-4 bg-transparent resize-none overflow-hidden text-slate-800  placeholder:text-slate-500 focus-visible:ring-offset-0 focus-visible:outline-none focus:outline-none !border-l-0" 
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
                {isTyping ? <Loader2 className="w-4 h-4 ml-0.5 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
              </Button>
            </div>
            <div className="text-xs text-center text-slate-500 mt-3 flex justify-center gap-1 font-medium w-full">
              NXT Chapter AI • AI responses are generated via Groq integration.
            </div>
          </div>
        </div>
        )}
      </div>

      {/* RIGHT OBSERVER PANEL Ribbon Button */}
      {params.agentId === "morpheus" && !isObserverOpen && (
        <button 
          onClick={() => setIsObserverOpen(true)} 
          className="absolute top-1/2 right-0 z-30 transform -translate-y-1/2 bg-slate-200  hover:bg-slate-300 :bg-slate-700 text-slate-700  p-2 rounded-l-xl shadow-md border border-r-0 border-slate-300  transition-all duration-200"
          title="Open Observer Panel"
        >
          <Mail className="w-5 h-5" />
        </button>
      )}

      {/* RIGHT OBSERVER PANEL (Shown for email agents) */}
      {params.agentId === "morpheus" && (
        <div className={`transition-all duration-300 ease-in-out shrink-0 border-slate-200  bg-slate-50  overflow-hidden relative ${isObserverOpen ? 'w-full md:w-[380px] border-l opacity-100 flex flex-col z-20' : 'w-0 opacity-0 border-l-0 border-none'}`}>
          <div className="h-14 flex items-center justify-between px-5 border-b border-slate-200  shrink-0 bg-white ">
            <div className="font-semibold text-[15px] flex items-center gap-2 text-slate-800 ">
              <Mail className="w-[18px] h-[18px] text-green-500" />
              Inbox Observer {isPolling && <Loader2 className="w-4 h-4 animate-spin text-emerald-500 ml-2" />}
            </div>
            <div className="flex items-center gap-3">
              {isPolling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" title="Polling active" />
              )}
              <Button variant="ghost" size="icon" onClick={() => setIsObserverOpen(false)} className="h-8 w-8 text-slate-500 hover:text-slate-800  :text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {isGmailConnected ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                {incomingEmails.length === 0 || incomingEmails.filter(e => !ignoredEmails.includes(e.from)).length === 0 ? (
                  <div className="text-center text-slate-500  text-sm mt-12 flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-200  flex items-center justify-center">
                      <Mail className="w-5 h-5 text-slate-400" />
                    </div>
                    <span>No valid unread emails detected.<br/>Polling in background...</span>
                  </div>
                ) : (
                  incomingEmails
                    .filter(email => !ignoredEmails.includes(email.from))
                    .map(email => (
                    <div key={email.id} className="bg-white  border border-slate-200  rounded-lg p-3.5 text-sm flex flex-col gap-1.5 shadow-sm hover:shadow-md transition-shadow relative group">
                      <div className="flex items-start justify-between">
                        <div className="font-semibold text-slate-800  truncate pr-6">{email.from.replace(/"/g, '')}</div>
                        
                        {/* Three dots menu */}
                        <div className="absolute right-2 top-2 z-10">
                           <button onClick={() => setOpenEmailDropdown(openEmailDropdown === email.id ? null : email.id)} className="p-1 text-slate-400 hover:text-slate-600 :text-slate-200 rounded-full hover:bg-slate-100 :bg-slate-800/80 transition-colors">
                             <MoreVertical className="w-4 h-4" />
                           </button>
                           {openEmailDropdown === email.id && (
                             <div className="absolute right-0 top-full mt-1 w-[220px] bg-white  border border-slate-200  rounded-md shadow-lg py-1">
                               <button onClick={() => handleIgnoreEmail(email)} className="w-full text-left px-3 py-2 text-xs text-red-600  hover:bg-red-50 :bg-red-900/20 transition-colors">
                                 Stop replying to this email address
                               </button>
                               <button onClick={() => setOpenEmailDropdown(null)} className="w-full text-left px-3 py-2 text-xs text-slate-600  hover:bg-slate-100 :bg-slate-700 transition-colors">
                                 Cancel
                               </button>
                             </div>
                           )}
                        </div>
                      </div>
                      <div className="text-slate-700  font-medium truncate text-[13px]">{email.subject}</div>
                      <div className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">{email.snippet.replace(/&#39;/g, "'")}</div>
                      <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{new Date(email.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-4 border-t border-slate-200  shrink-0 bg-white ">
                <Button 
                  onClick={handleBatchSync} 
                  disabled={isBatchSyncing || incomingEmails.length === 0} 
                  className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 shadow-sm h-11 disabled:bg-slate-300 disabled: disabled:text-slate-500"
                >
                  {isBatchSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isBatchSyncing ? "Drafting..." : `Draft Replies (Top ${Math.min(incomingEmails.length, 15)})`}
                </Button>
                <div className="flex items-center justify-between justify-center mt-2 px-1">
                  <div className="text-[10px] text-slate-400  flex items-center gap-1 font-medium">Automatic sweeps draft top {Math.min(incomingEmails.length, 15)}</div>
                  <div className="w-6 h-6 rounded-md bg-slate-100  flex items-center justify-center text-[10px] font-bold text-slate-600 ">
                    N'
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
               <div className="bg-slate-200  rounded-full p-4 mb-2">
                 <Mail className="w-8 h-8 text-slate-400" />
               </div>
               <h3 className="text-lg font-bold text-slate-800 ">Gmail Disconnected</h3>
               <p className="text-sm text-slate-500 ">Connect a dedicated Gmail account for this agent to enable real-time tracking.</p>
               <Button onClick={() => window.location.href = `/api/auth/google?uid=${user?.uid}&agentId=${params.agentId}`} className="mt-4 bg-primary text-primary-foreground shadow-sm w-full font-semibold">
                 Connect Gmail
               </Button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
