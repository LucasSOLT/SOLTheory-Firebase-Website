"use client";

import { useState, useRef, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VoiceAgentModal } from "@/components/communications/VoiceAgentModal";
import { Input } from "@/components/ui/input";
import { Bot, User, Plus, Search, LogOut, MessageSquare, Send, Menu, Loader2, Mail, Brain, Trash2, X, Sparkles, ArrowLeft, RefreshCw, Eye, CheckCircle2, Settings, CheckSquare, Sun, Moon, Maximize2, Minimize2, Users, FileText, Presentation, Table, Paperclip, Cloud, Mic } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { notFound } from "next/navigation";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import ReactMarkdown from "react-markdown";

let _msgCounter = 0;
const uid = () => `msg-${Date.now()}-${++_msgCounter}-${Math.random().toString(36).substring(2, 7)}`;

type Message = { id: string; text: string; isSelf: boolean; hiddenContext?: string; imageUrl?: string; };
type Session = { id: string; title: string; updatedAt: number; messages: Message[]; };
type EmailMeta = { id: string; subject: string; snippet: string; from: string; date: string; internalDate?: number; };
type AgentContact = { id: string; email: string; aliases: string; ignore: boolean; };

export default function SolTheoryAgentChatbotPage(props: { params: Promise<{ agentId: string }> }) {
  const searchParams = useSearchParams();
  const params = use(props.params);
  const { user } = useUser();
  const firestore = useFirestore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{url: string, name: string} | null>(null);


  // Observer Panel States
  const [incomingEmails, setIncomingEmails] = useState<EmailMeta[]>([]);
  const [ignoredEmails, setIgnoredEmails] = useState<string[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [totalGroqTokens, setTotalGroqTokens] = useState(0);
  const [totalElevenLabsChars, setTotalElevenLabsChars] = useState(0);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [isObserverOpen, setIsObserverOpen] = useState(false);
  const [isObserverFullScreen, setIsObserverFullScreen] = useState(false);
  const [isDeletingEmail, setIsDeletingEmail] = useState<string | null>(null);
  const [observerInputValue, setObserverInputValue] = useState("");
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

  const [agentContacts, setAgentContacts] = useState<AgentContact[]>([]);
  const [isContactsOpen, setIsContactsOpen] = useState(false);

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSet = new Set(selectedEmails);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      if (newSet.size >= 20) return; // 20-email cap
      newSet.add(id);
    }
    setSelectedEmails(newSet);
  };

  const toggleSelectAll = () => {
    if (incomingEmails.length === 0) return;
    const visibleCount = incomingEmails.filter(e => !agentContacts.find(c => c.ignore && c.email.toLowerCase() === (e.from.split('<').pop()?.replace('>', '') || '').toLowerCase())).length;
    if (selectedEmails.size === visibleCount) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(incomingEmails.filter(e => !agentContacts.find(c => c.ignore && c.email.toLowerCase() === (e.from.split('<').pop()?.replace('>', '') || '').toLowerCase())).map(e => e.id)));
    }
  };
  // Agent Knowledge Base Config
  const [agentConfig, setAgentConfig] = useState({ soul: "", brain: "", heartbeat: "manual" });
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"identity" | "data">("identity");
  const [ragDocs, setRagDocs] = useState<any[]>([]);
  const [isRAGUploading, setIsRAGUploading] = useState(false);
  const [isTextInputOpen, setIsTextInputOpen] = useState(false);
  const [ragTitle, setRagTitle] = useState("");
  const [ragTextContent, setRagTextContent] = useState("");

  const fetchRAGDocs = async () => {
    if (!user?.uid || !firestore) return;
    try {
      const { collection, getDocs, query, orderBy } = await import("firebase/firestore");
      const q = query(collection(firestore, "users", user.uid, "agents", `soltheory_${params.agentId}`, "knowledge_docs"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const docs: any[] = [];
      querySnapshot.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));
      setRagDocs(docs);
    } catch (err) { console.error("Failed to fetch RAG docs", err); }
  };

  useEffect(() => {
    if (isKnowledgeBaseOpen && activeSettingsTab === "data") {
      fetchRAGDocs();
    }
  }, [isKnowledgeBaseOpen, activeSettingsTab, user, firestore, params.agentId]);



  const bottomRef = useRef<HTMLDivElement>(null);

  const agents: Record<string, { name: string, greeting: string, theme: string, chatBg: string, accent: string }> = {
    "jarvis": {
      name: "Jarvis (Executive Agent)",
      greeting: "Hello. I am Jarvis. How can I assist you today?",
      theme: "border-blue-200 text-blue-600 bg-blue-50",
      chatBg: "bg-white border-slate-200 shadow-sm",
      accent: "text-blue-600"
    }
  };

  const agent = agents[params.agentId as string];
  if (!agent) notFound();

  const isEmailAgent = params.agentId === "jarvis";

  // Initialize
  useEffect(() => {
    const savedSessions = localStorage.getItem(`st_agent_sessions_${params.agentId}`);
    if (savedSessions) {
      try {
        const parsed: Session[] = JSON.parse(savedSessions);
        const uniqueSessions = new Map<string, Session>();
        parsed.forEach(s => {
          const seen = new Set<string>();
          s.messages = s.messages.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
          if (!uniqueSessions.has(s.id)) uniqueSessions.set(s.id, s);
        });
        const dedupedSessions = Array.from(uniqueSessions.values());
        setSessions(dedupedSessions);
        if (dedupedSessions.length > 0) {
          const mostRecent = dedupedSessions.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setActiveSessionId(mostRecent.id);
          setMessages(mostRecent.messages);
        } else startNewSession();
      } catch { startNewSession(); }
    } else startNewSession();

    const savedConfig = localStorage.getItem(`st_agent_config_${params.agentId}`);
    if (savedConfig) {
      try { setAgentConfig(JSON.parse(savedConfig)); } catch { }
    }
    const savedContacts = localStorage.getItem(`st_agent_contacts_${params.agentId}`);
    if (savedContacts) {
      try { setAgentContacts(JSON.parse(savedContacts)); } catch { }
    }
  }, [params.agentId]);

  useEffect(() => {
    localStorage.setItem(`st_agent_config_${params.agentId}`, JSON.stringify(agentConfig));
    localStorage.setItem(`st_agent_contacts_${params.agentId}`, JSON.stringify(agentContacts));
  }, [agentConfig, agentContacts, params.agentId]);

  // Load Lifetime Usage
  useEffect(() => {
    if (!user?.uid || !firestore) return;
    import("firebase/firestore").then(({ doc, onSnapshot }) => {
      const unsub = onSnapshot(doc(firestore, "users", user.uid), (docSnap) => {
        const data = docSnap.data();
        if (data) {
          setTotalGroqTokens(data.groqTokens || 0);
          setTotalElevenLabsChars(data.elevenLabsChars || 0);
        }
      });
      return () => unsub();
    });
  }, [user, firestore]);

  // Auth Binding Verification Map
  useEffect(() => {
    if (!isEmailAgent || !user?.uid || !firestore) return;

    // Check if we just returned from OAuth Callback
    const rt = searchParams.get("rt");
    if (rt) {
      import("firebase/firestore").then(({ setDoc }) => {
        setDoc(doc(firestore, "users", user.uid), {
          id: user.uid,
          [`gmailOAuth_${params.agentId}`]: { refreshToken: rt, connectedAt: new Date().toISOString() }
        }, { merge: true }).then(() => {
          setIsGmailConnected(true);
          // Clean the URL
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      });
      return;
    }

    getDoc(doc(firestore, "users", user.uid)).then(docSnap => {
      const data = docSnap.data();
      const connected = !!data?.[`gmailOAuth_${params.agentId}`]?.refreshToken
        || !!(data?.gmailOAuth_jarvis?.refreshToken || data?.gmailOAuth_morpheus?.refreshToken)
        || !!data?.gmailOAuth_email?.refreshToken
        || !!data?.["gmailOAuth_inbound-email"]?.refreshToken
        || !!data?.gmailOAuth?.refreshToken;
      setIsGmailConnected(connected);
    });
  }, [user, firestore, params.agentId, isEmailAgent, searchParams]);

  useEffect(() => {
    if (activeSessionId) {
      setSessions(prev => {
        const updated = prev.map(s => {
          if (s.id === activeSessionId) {
            const title = s.title === "New Chat" && messages.filter(m => m.isSelf).length > 0
              ? messages.filter(m => m.isSelf)[0].text.substring(0, 30) + "..." : s.title;
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
      localStorage.setItem(`st_agent_sessions_${params.agentId}`, JSON.stringify(savedSessions));
    }
  }, [sessions, isTyping, activeSessionId, params.agentId]);

  const startNewSession = () => {
    const newSession: Session = { id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, title: "New Chat", updatedAt: Date.now(), messages: [] };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
  };

  const loadSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) { setActiveSessionId(session.id); setMessages(session.messages); setIsKnowledgeBaseOpen(false); }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this chat?')) return;
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    localStorage.setItem(`st_agent_sessions_${params.agentId}`, JSON.stringify(updated));
    if (activeSessionId === id) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
        setMessages(updated[0].messages);
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
      if (params.agentId === "jarvis") {
        possibleAgentIds.push("email", "soltheory_email", "nxtchapter_email");
      }

      const texts: string[] = [];

      for (const searchId of possibleAgentIds) {
        try {
          // Fetch from the new flattened structure (knowledge_docs)
          const docsSnap = await getDocs(collection(firestore, "users", user.uid, "agents", searchId, "knowledge_docs"));
          docsSnap.forEach(d => {
            const data = d.data();
            if (data.content && typeof data.content === "string") texts.push(data.content);
          });

          // Legacy support: also fetch from old knowledge_chunks just in case they have undeleted legacy data
          const chunksSnap = await getDocs(collection(firestore, "users", user.uid, "agents", searchId, "knowledge_chunks"));
          chunksSnap.forEach(d => {
            const data = d.data();
            if (data.text && typeof data.text === "string") texts.push(data.text);
          });
        } catch (err) {
          // ignore error for missing collections
        }
      }

      // Send all chunks - server will cap by character count
      return texts.join("\n\n");
    } catch (err) {
      console.error("KB fetch error:", err);
      return "";
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;
    const userMsg: Message = { id: uid(), text: inputValue, isSelf: true };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages); setIsTyping(true); setInputValue("");

    try {
      let rToken = null;
      if (user?.uid && firestore && isGmailConnected) {
        const docSnap = await getDoc(doc(firestore, "users", user.uid));
        const docData = docSnap.data();
        rToken = docData?.[`gmailOAuth_${params.agentId}`]?.refreshToken;
        if (!rToken) rToken = (docData?.gmailOAuth_jarvis?.refreshToken || docData?.gmailOAuth_morpheus?.refreshToken);
        if (!rToken) rToken = docData?.gmailOAuth_email?.refreshToken;
        if (!rToken) rToken = docData?.["gmailOAuth_inbound-email"]?.refreshToken;
        if (!rToken) rToken = docData?.gmailOAuth?.refreshToken;
      }

      // Fetch knowledge base text from client-side Firestore
      const kbText = await getKnowledgeBaseText();

      const apiMessages = newMessages.map(m => ({ role: m.isSelf ? "user" : "assistant", content: m.hiddenContext ? `${m.hiddenContext}\n\n[USER COMMENT]: ${m.text}` : m.text }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          agentId: `soltheory_${params.agentId}`,
          soul: `${agentConfig.soul}\n\n[USER CONTEXT]\nAct on behalf of this user. The user's email address is: ${user?.email || 'Unknown'}. Do not ask them for their email.`,
          brain: agentConfig.brain,
          uid: user?.uid,
          refreshToken: rToken,
          contacts: agentContacts,
          knowledgeBaseText: kbText
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(prev => [...prev, { id: uid(), text: data.response, isSelf: false }]);
      
      const usage = data.usage || 0;
      if (usage > 0 && user?.uid && firestore) {
        import("firebase/firestore").then(({ doc, updateDoc, increment }) => {
          updateDoc(doc(firestore, "users", user.uid), { groqTokens: increment(usage) }).catch(console.error);
        });
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { id: uid(), text: `Error: ${error.message}.`, isSelf: false }]);
    } finally {
      setIsTyping(false);
    }
  };


  const handleObserverChat = async () => {
    if (!observerInputValue.trim() || isTyping) return;
    const msgText = observerInputValue;
    setObserverInputValue("");

    // Switch to Chat if not already visible/active
    setIsObserverFullScreen(false);

    // Add msg to main chat
    const userMsg: Message = { id: uid(), text: msgText, isSelf: true };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      let rToken = null;
      if (user?.uid && firestore && isGmailConnected) {
        const docSnap = await getDoc(doc(firestore, "users", user.uid));
        const docData = docSnap.data();
        rToken = docData?.[`gmailOAuth_${params.agentId}`]?.refreshToken;
        if (!rToken) rToken = (docData?.gmailOAuth_jarvis?.refreshToken || docData?.gmailOAuth_morpheus?.refreshToken);
        if (!rToken) rToken = docData?.gmailOAuth_email?.refreshToken;
        if (!rToken) rToken = docData?.["gmailOAuth_inbound-email"]?.refreshToken;
        if (!rToken) rToken = docData?.gmailOAuth?.refreshToken;
      }

      const apiMessages = newMessages.map(m => ({ role: m.isSelf ? "user" : "assistant", content: m.hiddenContext ? `${m.hiddenContext}\n\n[USER COMMENT]: ${m.text}` : m.text }));
      const kbText = await getKnowledgeBaseText();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          agentId: `soltheory_${params.agentId}`,
          soul: `${agentConfig.soul}\n\n[USER CONTEXT]\nAct on behalf of this user. The user's email address is: ${user?.email || 'Unknown'}. Do not ask them for their email.`,
          brain: agentConfig.brain,
          uid: user?.uid,
          refreshToken: rToken,
          contacts: agentContacts,
          knowledgeBaseText: kbText
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(prev => [...prev, { id: uid(), text: data.response, isSelf: false }]);
      
      const usage = data.usage || 0;
      if (usage > 0 && user?.uid && firestore) {
        import("firebase/firestore").then(({ doc, updateDoc, increment }) => {
          updateDoc(doc(firestore, "users", user.uid), { groqTokens: increment(usage) }).catch(console.error);
        });
      }
      
      // refresh inbox just in case
      fetchPulse();
    } catch (error: any) {
      setMessages(prev => [...prev, { id: uid(), text: `Error: ${error.message}.`, isSelf: false }]);
    } finally {
      setIsTyping(false);
    }
  };

  const processAgentFile = async (file: File) => {
    if (file.type === "image/jpeg" || file.type === "image/png") {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX = 400;
          if (width > height && width > MAX) { height *= MAX / width; width = MAX; }
          else if (height > MAX) { width *= MAX / height; height = MAX; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
          const sysMsg: Message = {
            id: uid(),
            text: `Uploaded image: ${file.name || "pasted-image.jpg"}`,
            isSelf: true,
            imageUrl: dataUrl
          };
          setMessages(prev => [...prev, sysMsg]);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
      return;
    }

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
          text: `Attached file: ${file.name || "pasted-file"}`,
          isSelf: true,
          hiddenContext: `The user has attached a file named ${file.name || "pasted-file"}. Here are the extracted contents:\n\n${fullText}`
        };
        setMessages(prev => [...prev, sysMsg]);
      } else {
        throw new Error(data.error || "Failed to parse file");
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { id: uid(), text: `Failed to attach file: ${err.message}`, isSelf: false }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) processAgentFile(file);
        break;
      }
    }
  };

  // OBSERVER PIPELINE
  const fetchPulse = async () => {
    if (!user?.uid || !firestore) return;
    setIsPolling(true);
    try {
      const docSnap = await getDoc(doc(firestore, "users", user.uid));
      const userData = docSnap.data();
      let rToken = userData?.[`gmailOAuth_${params.agentId}`]?.refreshToken
        || (userData?.gmailOAuth_jarvis?.refreshToken || userData?.gmailOAuth_morpheus?.refreshToken)
        || userData?.gmailOAuth_email?.refreshToken
        || userData?.["gmailOAuth_inbound-email"]?.refreshToken
        || userData?.gmailOAuth?.refreshToken;
      if (!rToken) throw new Error("Missing Refresh Token");

      const res = await fetch("/api/webhooks/gmail/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, refreshToken: rToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setIncomingEmails(data.emails || []);
        // Clean up selected emails that might have been processed or disappeared
        if (data.emails) {
          const currentIds = new Set((data.emails as any[]).map(e => e.id));
          setSelectedEmails(prev => {
            const next = new Set<string>();
            prev.forEach(id => { if (currentIds.has(id)) next.add(id); });
            return next;
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPolling(false);
    }
  };


  const handleDeleteEmail = async (id: string) => {
    if (!user?.uid || !firestore) return;
    setIsDeletingEmail(id);
    try {
      const docSnap = await getDoc(doc(firestore, "users", user.uid));
      const userData = docSnap.data();
      let rToken = userData?.[`gmailOAuth_${params.agentId}`]?.refreshToken;
      if (!rToken && params.agentId === "jarvis") {
        rToken = userData?.gmailOAuth_email?.refreshToken;
      }
      if (!rToken) rToken = (userData?.gmailOAuth_jarvis?.refreshToken || userData?.gmailOAuth_morpheus?.refreshToken);
      if (!rToken) rToken = userData?.gmailOAuth?.refreshToken;
      if (!rToken) rToken = (userData?.gmailOAuth_jarvis?.refreshToken || userData?.gmailOAuth_morpheus?.refreshToken);
      if (!rToken) rToken = userData?.gmailOAuth?.refreshToken;
      const res = await fetch("/api/webhooks/gmail/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: id, refreshToken: rToken })
      });
      if (res.ok) {
        setIncomingEmails(prev => prev.filter(e => e.id !== id));
        const newSelected = new Set(selectedEmails);
        newSelected.delete(id);
        setSelectedEmails(newSelected);
      }
    } catch (e) { console.error("Error deleting email", e); }
    finally { setIsDeletingEmail(null); }
  };

  const handleProcessInbox = async () => {
    if (!user?.uid || !firestore || incomingEmails.length === 0) return;
    setIsBatchSyncing(true);

    // Add UI system message showing autonomous trigger
    const sysMsg: Message = { id: uid(), text: "Initiated autonomous sweep of the inbox.", isSelf: true };
    setMessages(prev => [...prev, sysMsg]);
    setIsTyping(true);

    try {
      const docSnap = await getDoc(doc(firestore, "users", user.uid));
      const userData = docSnap.data();
      let rToken = userData?.[`gmailOAuth_${params.agentId}`]?.refreshToken;
      if (!rToken && params.agentId === "jarvis") {
        rToken = userData?.gmailOAuth_email?.refreshToken;
      }
      if (!rToken) rToken = (userData?.gmailOAuth_jarvis?.refreshToken || userData?.gmailOAuth_morpheus?.refreshToken);
      if (!rToken) rToken = userData?.gmailOAuth?.refreshToken;
      if (!rToken) rToken = (userData?.gmailOAuth_jarvis?.refreshToken || userData?.gmailOAuth_morpheus?.refreshToken);
      if (!rToken) rToken = userData?.gmailOAuth?.refreshToken;

      const kbText = await getKnowledgeBaseText();
      const res = await fetch("/api/webhooks/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          refreshToken: rToken,
          agentId: `soltheory_${params.agentId}`,
          soul: agentConfig.soul,
          brain: agentConfig.brain,
          selectedEmailIds: Array.from(selectedEmails),
          contacts: agentContacts,
          knowledgeBaseText: kbText
        }),
      });
      const data = await res.json();

      setMessages(prev => [...prev, {
        id: uid(),
        text: `Operation complete. ${data.message || 'Drafts compiled successfully.'}`,
        isSelf: false
      }]);
      // Refetch to clear the list and reset selection
      setSelectedEmails(new Set());
      fetchPulse();
    } catch (e: any) {
      setMessages(prev => [...prev, { id: uid(), text: `Error executing batch sync: ${e.message}`, isSelf: false }]);
    } finally {
      setIsTyping(false);
      setIsBatchSyncing(false);
    }
  };

  useEffect(() => {
    if (isObserverOpen && isGmailConnected) {
      fetchPulse();
      const interval = setInterval(() => {
        fetchPulse();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isObserverOpen, isGmailConnected]);

  return (
    <div className="flex w-full h-full bg-slate-50 ] text-slate-800  overflow-hidden font-sans selection:bg-fuchsia-500/30">

      {/* Sessions Sidebar */}
      <div className="hidden md:flex w-[300px] flex-col bg-white/80  backdrop-blur-3xl border-r border-slate-200  shrink-0 z-20">
        {/* Sidebar header unchanged for brevity (Using standard implementation) */}
        <div className="p-6 flex flex-col gap-4 border-b border-slate-200 ">
          <Link href="/portal/dashboard/soltheory/ai-agents" className="flex items-center gap-2 text-slate-500  hover:text-slate-900  transition-colors text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Matrix
          </Link>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] ${agent.theme}`}>
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-slate-900  tracking-tight">{agent.name.split(' ')[0]}</span>
              <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Linked
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin mt-2">
          <Button variant="outline" className="w-full justify-start gap-2 h-10 bg-slate-200/50  hover:bg-slate-300/50  border-slate-300  text-slate-900  mb-2" onClick={startNewSession}>
            <Plus className="w-4 h-4" /> New Session
          </Button>

          <div className="text-xs font-semibold text-slate-900  mb-2 px-1 uppercase tracking-widest mt-4">Chat History</div>
          {sessions.map(s => (
            <div key={s.id} onClick={() => loadSession(s.id)} className={`group cursor-pointer flex items-center w-full px-3 mt-1 h-10 rounded-lg transition-all ${activeSessionId === s.id ? 'bg-slate-300/50  text-slate-900  border border-slate-200 ' : 'text-slate-500  hover:text-slate-900  hover:bg-slate-200/50 '}`}>
              <MessageSquare className="w-4 h-4 mr-3 shrink-0 opacity-70" />
              <span className="truncate text-sm font-medium flex-1">{s.title}</span>
              <button onClick={(e) => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all ml-1 p-1 rounded-md hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main UI Pane */}
      <div className="flex-1 flex flex-col h-full relative z-10 overflow-hidden">

        {/* Background Ambient Glow */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-fuchsia-600/10 blur-[150px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-[20%] left-[20%] w-[600px] h-[600px] bg-indigo-600/10 blur-[150px] rounded-full mix-blend-screen" />
        </div>

        {/* Top Navigator */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0 z-20 bg-slate-100 backdrop-blur-xl">
          <div className="font-bold text-sm tracking-widest uppercase text-slate-900 opacity-80">{agent.name} Console</div>
        </div>

        {/* Dynamic Main Body (Chat vs Settings vs Observer) */}
        <div className="flex-1 flex relative overflow-hidden">

          {/* Chat / Settings Wrapper */}
          <div className="flex-1 flex flex-col relative z-10 transition-all duration-500 overflow-hidden h-full">
            {isKnowledgeBaseOpen ? (
              // Enhanced RAG Dashboard Screen
              <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Dashboard Header */}
                <div className="shrink-0 p-4 md:p-8 pb-0 max-w-5xl mx-auto w-full">
                  <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200/70  pb-6 gap-4">
                    <div>
                      <h2 className="text-3xl font-extrabold flex items-center gap-3 text-slate-900  tracking-tight">
                        <Brain className="w-8 h-8 text-primary" /> Agent Neural Configuration
                      </h2>
                      <p className="text-slate-500  mt-2 text-sm max-w-xl">
                        Design {agent.name.split(' ')[0]}'s core identity rules, and upload infinite factual data (PDFs/Text) to form its vector-based Knowledge Base.
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setIsKnowledgeBaseOpen(false)} className="rounded-full hover:bg-slate-100/10 text-slate-500">
                      <X className="w-6 h-6" />
                    </Button>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-6 mt-6 border-b border-slate-200/50 ">
                    <button
                      onClick={() => setActiveSettingsTab("identity")}
                      className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-colors ${activeSettingsTab === "identity" ? "border-fuchsia-500 text-fuchsia-600 " : "border-transparent text-slate-500 hover:text-slate-700"}`}
                    >
                      Identity & Rules
                    </button>
                    <button
                      onClick={() => setActiveSettingsTab("data")}
                      className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-2 ${activeSettingsTab === "data" ? "border-indigo-500 text-indigo-600 " : "border-transparent text-slate-500 hover:text-slate-700"}`}
                    >
                      Knowledge Base (RAG)
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-6 pb-56 max-w-5xl mx-auto w-full">
                  {activeSettingsTab === "identity" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Soul Card */}
                      <div className="relative group bg-white/50  border border-slate-200/60  rounded-3xl p-6 shadow-sm hover:shadow-md transition-all hover:border-fuchsia-500/30 backdrop-blur-xl flex flex-col h-[400px]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center border border-fuchsia-500/20 shadow-inner shrink-0">
                            <User className="w-5 h-5 text-fuchsia-500 " />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 ">The Soul</h3>
                            <p className="text-[10px] uppercase font-bold text-fuchsia-500/80 tracking-widest">Voice & Personality</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500  mb-4 flex-none">Describe how the agent should speak, format answers, and behave.</p>
                        <textarea
                          className="flex-1 w-full p-4 bg-white/80  border border-slate-200  rounded-2xl resize-none focus:ring-1 focus:ring-fuchsia-500 outline-none transition-shadow text-sm text-slate-900  placeholder:text-slate-400 shadow-inner"
                          placeholder="e.g., You are extremely professional but maintain a warm, welcoming tone."
                          value={agentConfig.soul}
                          onChange={e => setAgentConfig({ ...agentConfig, soul: e.target.value })}
                        />
                      </div>

                      {/* Brain Card */}
                      <div className="relative group bg-white/50  border border-slate-200/60  rounded-3xl p-6 shadow-sm hover:shadow-md transition-all hover:border-indigo-500/30 backdrop-blur-xl flex flex-col h-[400px]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner shrink-0">
                            <Brain className="w-5 h-5 text-indigo-500 " />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 ">The Brain</h3>
                            <p className="text-[10px] uppercase font-bold text-indigo-500/80 tracking-widest">Strict Wiring & Rules</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500  mb-4 flex-none">Provide strict operational directives or constraints that cannot be broken.</p>
                        <textarea
                          className="flex-1 w-full p-4 bg-white/80  border border-slate-200  rounded-2xl resize-none focus:ring-1 focus:ring-indigo-500 outline-none transition-shadow text-sm text-slate-900  placeholder:text-slate-400 shadow-inner"
                          placeholder="e.g., Never disclose PII. Do not share api keys. Deny invalid refund requests."
                          value={agentConfig.brain}
                          onChange={e => setAgentConfig({ ...agentConfig, brain: e.target.value })}
                        />
                      </div>

                      {/* Heartbeat Card (Full Width) */}
                      <div className="relative group bg-white/50  border border-slate-200/60  rounded-3xl p-6 shadow-sm hover:shadow-md transition-all hover:border-emerald-500/30 backdrop-blur-xl md:col-span-2 flex flex-col md:flex-row gap-6 items-center">
                        <div className="relative flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 shrink-0 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                            <Bot className="w-6 h-6 text-emerald-500 " />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 ">The Heartbeat (Autonomous Engine)</h3>
                            <p className="text-xs text-slate-500  mt-1 max-w-md">Determine how frequently the agent performs automated background sweeps.</p>
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

                      <div className="md:col-span-2 flex justify-center mt-6">
                        <Button onClick={() => setIsKnowledgeBaseOpen(false)} className="bg-black hover:bg-slate-900 text-white px-12 h-12 rounded-full font-bold shadow-xl transition-all transform hover:scale-105 active:scale-95 gap-2">
                          <CheckCircle2 className="w-5 h-5" /> Compile Rules & Return
                        </Button>
                      </div>

                    </div>
                  ) : (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      {/* KB Header */}
                      <div className="bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-3xl p-6 backdrop-blur-md">
                        <h3 className="text-lg font-extrabold text-emerald-700 mb-2 flex items-center gap-2"><Brain className="w-5 h-5" /> Knowledge Base</h3>
                        <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
                          Paste text data below (SOPs, FAQs, policies, company info). {agent.name.split(' ')[0]} will reference this data when answering your questions.
                        </p>
                      </div>

                      {/* Inline Text Entry Form */}
                      <div className="border border-slate-200 rounded-2xl bg-white p-6 space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Document Title</label>
                          <input type="text" className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-emerald-500 outline-none text-slate-900" value={ragTitle} onChange={e => setRagTitle(e.target.value)} placeholder="e.g. Company FAQ, SOPs, Product Info" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1">Text Content</label>
                          <textarea className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-1 focus:ring-emerald-500 outline-none resize-none text-slate-900 h-48" value={ragTextContent} onChange={e => setRagTextContent(e.target.value)} placeholder="Paste any factual data, policies, or knowledge here..." />
                        </div>
                        <div className="flex justify-end">
                          <Button onClick={async () => {
                            if (!ragTitle || !ragTextContent || !user?.uid || !firestore) return;
                            setIsRAGUploading(true);
                            try {
                              const { collection, doc: fsDoc, setDoc } = await import("firebase/firestore");
                              const docRef = fsDoc(collection(firestore, "users", user.uid, "agents", `soltheory_${params.agentId}`, "knowledge_docs"));
                              await setDoc(docRef, {
                                title: ragTitle,
                                type: 'text',
                                size: ragTextContent.length,
                                content: ragTextContent,
                                fileUrl: '',
                                createdAt: new Date().toISOString()
                              });
                              alert(`Saved! Document stored in Knowledge Base.`);
                              setRagTitle(''); setRagTextContent(''); fetchRAGDocs();
                            } catch (err) { alert('Failed to save text.'); console.error(err); }
                            finally { setIsRAGUploading(false); }
                          }} disabled={isRAGUploading || !ragTitle || !ragTextContent} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 border-0 shadow-lg shadow-emerald-500/30 px-6">
                            {isRAGUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save to Knowledge Base
                          </Button>
                        </div>
                      </div>

                      {/* Active Data Sources */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-slate-900">Active Data Sources</h4>
                          {isRAGUploading && <div className="text-xs font-bold text-emerald-500 animate-pulse flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</div>}
                        </div>
                        {ragDocs.length === 0 ? (
                          <div className="h-24 rounded-2xl border border-slate-200 flex items-center justify-center text-sm text-slate-500 bg-slate-50">
                            Knowledge base is currently empty. Add text entries above.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {ragDocs.map((ragDoc, i) => (
                              <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                                    <CheckSquare className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="font-bold text-sm text-slate-900">{ragDoc.title}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mt-0.5">{(ragDoc.size / 1024).toFixed(1)} KB • Synced</div>
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-400" onClick={async () => {
                                  if (confirm('Delete this knowledge entry?')) {
                                    try {
                                      const { doc: firestoreDoc, deleteDoc, collection, getDocs, query, where } = await import("firebase/firestore");
                                      // Delete the doc entry
                                      await deleteDoc(firestoreDoc(firestore!, "users", user!.uid, "agents", `soltheory_${params.agentId}`, "knowledge_docs", ragDoc.id));
                                      // Also delete all associated chunks
                                      try {
                                        const chunksRef = collection(firestore!, "users", user!.uid, "agents", `soltheory_${params.agentId}`, "knowledge_chunks");
                                        const chunksSnap = await getDocs(query(chunksRef, where("docId", "==", ragDoc.id)));
                                        for (const chunkDoc of chunksSnap.docs) {
                                          await deleteDoc(chunkDoc.ref);
                                        }
                                      } catch { }
                                      fetchRAGDocs();
                                    } catch (err) { alert('Failed to delete.'); }
                                  }
                                }}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Chat Screen
              <div className="flex-1 flex flex-col relative">
                {/* Unified Token Tracking Pill */}
                <button onClick={() => setShowCostBreakdown(!showCostBreakdown)} className="absolute top-6 right-6 z-50 px-4 h-9 rounded-full bg-white border border-slate-200 flex items-center gap-2.5 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
                  <Bot className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black tracking-wider text-slate-600 uppercase">
                    {totalGroqTokens.toLocaleString()} TOKENS (GROQ) <span className="opacity-30 mx-1">|</span> {totalElevenLabsChars.toLocaleString()} CHARS (VOICE) <span className="opacity-30 mx-1">|</span> ≈ ${((totalGroqTokens * 0.00000006) + (totalElevenLabsChars * 0.000167)).toFixed(4)}
                  </span>
                </button>

                {showCostBreakdown && (
                  <div className="absolute top-16 right-6 z-[200] w-[340px] bg-white border border-slate-200 rounded-[6px] shadow-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">Lifetime Cost Breakdown</h3>
                      <button onClick={() => setShowCostBreakdown(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="space-y-4">
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-[4px]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-500" />
                          <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Groq — LLM Inference</span>
                        </div>
                        <div className="text-xs text-slate-500 space-y-1">
                          <div className="flex justify-between"><span>Model</span><span className="font-bold text-slate-700">Llama 3.1 8B Instant</span></div>
                          <div className="flex justify-between"><span>Tokens Used</span><span className="font-bold text-slate-700">{totalGroqTokens.toLocaleString()}</span></div>
                          <div className="flex justify-between"><span>Rate</span><span className="font-bold text-slate-700">~$0.06 / 1M tokens</span></div>
                          <div className="h-px bg-slate-200 my-1" />
                          <div className="flex justify-between text-slate-900 font-black"><span>Subtotal</span><span>${(totalGroqTokens * 0.00000006).toFixed(6)}</span></div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-[4px]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">ElevenLabs — Voice</span>
                        </div>
                        <div className="text-xs text-slate-500 space-y-1">
                          <div className="flex justify-between"><span>Model</span><span className="font-bold text-slate-700">Turbo v2.5</span></div>
                          <div className="flex justify-between"><span>Chars Used</span><span className="font-bold text-slate-700">{totalElevenLabsChars.toLocaleString()}</span></div>
                          <div className="flex justify-between"><span>Rate</span><span className="font-bold text-slate-700">~$0.167 / 1K chars</span></div>
                          <div className="h-px bg-slate-200 my-1" />
                          <div className="flex justify-between text-slate-900 font-black"><span>Subtotal</span><span>${(totalElevenLabsChars * 0.000167).toFixed(6)}</span></div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-900 rounded-[4px]">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Lifetime Cost</span>
                          <span className="text-lg font-black text-white">${((totalGroqTokens * 0.00000006) + (totalElevenLabsChars * 0.000167)).toFixed(4)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-56">
                  <div className="max-w-3xl mx-auto space-y-8">
                    <div className="flex justify-center mb-10 pt-10">
                      <div className="text-3xl font-black opacity-10 tracking-[0.3em] uppercase">{agent.name}</div>
                    </div>
                    <div className="flex gap-4">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-slate-300  bg-slate-200/50 `}><Bot className={`w-5 h-5 ${agent.accent}`} /></div>
                      <div className="flex-1 space-y-1 pt-1">
                        <div className="font-bold text-sm text-slate-700 ">{agent.name.split(' ')[0]}</div>
                        <div className={`text-slate-800  inline-block p-4 rounded-2xl rounded-tl-sm border backdrop-blur-md ${agent.chatBg}`}>{agent.greeting}</div>
                      </div>
                    </div>
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex gap-4 ${msg.isSelf ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-slate-300  ${msg.isSelf ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-200/50 '}`}>{msg.isSelf ? <User className="w-5 h-5 text-slate-900 " /> : <Bot className={`w-5 h-5 ${agent.accent}`} />}</div>
                        <div className={`flex-1 space-y-1 pt-1 ${msg.isSelf ? 'text-right' : ''}`}>
                          <div className={`text-slate-800  inline-block p-4 rounded-2xl shadow-xl text-left backdrop-blur-md ${msg.isSelf ? 'bg-slate-300/50  rounded-tr-sm' : `${agent.chatBg} rounded-tl-sm [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>strong]:font-bold border`}`}>
                            {msg.imageUrl ? (
                              <div className="flex flex-col mb-2">
                                <span className="text-xs font-semibold text-slate-500 mb-2 truncate max-w-[200px]">{msg.text.replace('Uploaded image: ', '')}</span>
                                <img 
                                  src={msg.imageUrl} 
                                  alt="Uploaded Preview" 
                                  className="max-w-[200px] max-h-[200px] object-cover rounded shadow-md cursor-pointer hover:opacity-90 transition-opacity" 
                                  onClick={() => setLightboxImage({ url: msg.imageUrl!, name: msg.text.replace('Uploaded image: ', '') })}
                                />
                              </div>
                            ) : null}
                            {msg.isSelf && !msg.imageUrl ? msg.text : (!msg.imageUrl && <ReactMarkdown>{msg.text}</ReactMarkdown>)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-slate-300  bg-slate-200/50 `}><Bot className={`w-5 h-5 ${agent.accent}`} /></div>
                        <div className={`inline-block p-4 rounded-2xl rounded-tl-sm border backdrop-blur-md ${agent.chatBg} flex items-center gap-3`}><Loader2 className={`w-4 h-4 animate-spin ${agent.accent}`} /> Processing...</div>
                      </div>
                    )}
                    <div ref={bottomRef} className="h-32" />
                  </div>
                </div>

                {/* Chat Input Container */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent pt-12 z-20">
                  <div className="max-w-4xl mx-auto flex flex-col gap-2 relative">
                    {/* Interaction Buttons Overlay */}
                    <div className="flex justify-between items-center px-1 pointer-events-none mb-1">
                    </div>

                    <div className="relative w-full border border-slate-300 rounded-[24px] overflow-hidden bg-white/80 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] focus-within:ring-1 focus-within:ring-fuchsia-500 backdrop-blur-2xl flex items-center">
                      <div className="flex items-center pl-2 sm:pl-4 gap-1 sm:gap-2 shrink-0">
                        <button onClick={() => window.location.href = `/api/auth/google?uid=${user?.uid || ""}&agentId=${params.agentId}&origin=soltheory`} className="hidden sm:flex p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors cursor-pointer" title="Connect Google Drive">
                          <Cloud className="w-5 h-5" />
                        </button>
                        <label className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-full transition-colors cursor-pointer" title="Upload File">
                          <Paperclip className="w-5 h-5" />
                          <input type="file" accept="image/jpeg, image/png, application/pdf, text/plain" className="hidden" onChange={(e) => {
                            if (e.target.files?.length) {
                              processAgentFile(e.target.files[0]);
                              e.target.value = "";
                            }
                          }} />
                        </label>
                      </div>
                      <Input
                        placeholder="Instruct the agent..."
                        className="border-0 focus-visible:ring-0 shadow-none flex-1 pl-2 pr-20 sm:pr-24 min-h-[48px] sm:min-h-[64px] bg-transparent text-slate-900  placeholder:text-slate-500 text-sm sm:text-base focus-visible:ring-offset-0 focus-visible:outline-none focus:outline-none !border-l-0"
                        value={inputValue} onChange={e => setInputValue(e.target.value)} onPaste={handlePaste} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      />

                      <button
                        onClick={() => setIsVoiceModalOpen(true)}
                        className="absolute right-14 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-colors"
                        title="Start Voice Session"
                      >
                        <Mic className="w-5 h-5" />
                      </button>

                      <Button size="icon" onClick={handleSendMessage} disabled={!inputValue.trim() || isTyping} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white text-black hover:bg-slate-200 w-10 h-10 disabled:opacity-30">
                        {isTyping ? <Loader2 className="w-5 h-5 ml-0.5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>



          {/* RIGHT OBSERVER PANEL Ribbon Button */}
          {params.agentId === "jarvis" && !isObserverOpen && (
            <button
              onClick={() => setIsObserverOpen(true)}
              className="absolute top-1/2 right-0 z-30 transform -translate-y-1/2 bg-slate-200 hover:bg-slate-300 text-slate-700 p-2 rounded-l-xl shadow-md border border-r-0 border-slate-300 transition-all duration-200"
              title="Open Observer Panel"
            >
              <Mail className="w-5 h-5" />
            </button>
          )}

          {/* THE OBSERVER PANEL SLIDE-OUT */}
          {isObserverOpen && (
            <div className={`${isObserverFullScreen ? 'fixed inset-0 w-full z-50 bg-black/95' : 'w-[450px] bg-white/80 '} border-l border-slate-300  backdrop-blur-3xl shrink-0 flex flex-col relative z-20 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] animate-in ${isObserverFullScreen ? 'zoom-in-95' : 'slide-in-from-right'} duration-500`}>
              <div className="p-5 border-b border-slate-300  flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900  flex items-center gap-2"><Eye className="w-5 h-5 text-emerald-400" /> Observer Panel {isPolling && <Loader2 className="w-4 h-4 animate-spin text-emerald-400 ml-2" />}</h3>
                  <p className="text-xs text-slate-500  uppercase tracking-wider font-bold mt-1">Live Inbox Stream</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setIsContactsOpen(!isContactsOpen)} className={`transition-colors rounded-full ${isContactsOpen ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500  hover:text-emerald-400'}`}>
                    <Users className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setIsObserverFullScreen(!isObserverFullScreen)} className="text-slate-500  hover:text-slate-900  rounded-full">
                    {isObserverFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setIsObserverOpen(false)} className="text-slate-500  hover:text-slate-900  rounded-full">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {isContactsOpen ? (
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 ]">
                  <div className="p-4 border-b border-slate-300  shrink-0">
                    <h4 className="font-bold text-slate-800 ">Contact Glossary</h4>
                    <p className="text-xs text-slate-500 mt-1">Map email addresses to CSV nicknames so the AI understands who you're referring to. You can also hide senders from the stream.</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {agentContacts.map(contact => (
                      <div key={contact.id} className={`p-4 rounded-xl border relative shadow-sm ${contact.ignore ? 'bg-slate-200/30  border-slate-300  opacity-70' : 'bg-white  border-slate-300 '}`}>
                        <button onClick={() => setAgentContacts(prev => prev.filter(c => c.id !== contact.id))} className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-400 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                        <div className="space-y-3 mt-1">
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                            <input type="email" placeholder="steve@soltheory.com" value={contact.email} onChange={e => setAgentContacts(prev => prev.map(c => c.id === contact.id ? { ...c, email: e.target.value } : c))} className="w-full bg-slate-50  border border-slate-200  rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 " />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CSV Aliases</label>
                            <input type="text" placeholder="Steve Huff, Stevie, Big Steve" value={contact.aliases} onChange={e => setAgentContacts(prev => prev.map(c => c.id === contact.id ? { ...c, aliases: e.target.value } : c))} className="w-full bg-slate-50  border border-slate-200  rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 " />
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer mt-2 w-max">
                            <input type="checkbox" checked={contact.ignore} onChange={e => setAgentContacts(prev => prev.map(c => c.id === contact.id ? { ...c, ignore: e.target.checked } : c))} className="w-4 h-4 rounded appearance-none border border-slate-300  checked:bg-amber-500 checked:border-amber-500 flex items-center justify-center after:content-['✓'] after:text-white after:text-xs" />
                            <span className={`text-xs font-bold ${contact.ignore ? 'text-amber-500' : 'text-slate-500'}`}>Ignore Sender</span>
                          </label>
                        </div>
                      </div>
                    ))}
                    <Button onClick={() => setAgentContacts([...agentContacts, { id: Date.now().toString(), email: '', aliases: '', ignore: false }])} variant="outline" className="w-full border-dashed border-slate-300  text-slate-600  gap-2 h-10 hover:border-emerald-500 hover:text-emerald-500 transition-colors">
                      <Plus className="w-4 h-4" /> Add Contact
                    </Button>
                  </div>
                </div>
              ) : isGmailConnected ? (
                <>
                  <div className="p-4 bg-slate-200/50  border-b border-slate-300  flex flex-col gap-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700  font-medium">Inbox</span>
                      <span className={`font-bold text-xs px-2 py-0.5 rounded-full border ${selectedEmails.size >= 20 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>{selectedEmails.size}/20 selected</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button onClick={toggleSelectAll} variant="outline" className="w-full h-9 bg-slate-100  border-slate-300  text-slate-700  hover:text-slate-900  text-xs gap-2">
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> {selectedEmails.size === incomingEmails.filter(e => !agentContacts.find(c => c.ignore && c.email.toLowerCase() === (e.from.split('<').pop()?.replace('>', '') || '').toLowerCase())).length && incomingEmails.length > 0 ? 'Deselect All' : 'Select All'}
                      </Button>
                      <Button onClick={handleProcessInbox} disabled={selectedEmails.size === 0 || isBatchSyncing || isTyping} className="w-full h-9 bg-emerald-600 hover:bg-emerald-500 text-slate-900  text-xs font-bold border-0 shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 transition-all gap-1 truncate">
                        {isBatchSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Bot className="w-3.5 h-3.5 shrink-0" />} <span className="truncate">Draft Replies for ({selectedEmails.size})</span>
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                    {incomingEmails.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 p-8 text-center">
                        <Mail className="w-10 h-10 opacity-20" />
                        <p className="text-sm">The inbox queue is currently empty. The agent has no pending executions.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {incomingEmails.filter(email => {
                          const cleanFrom = email.from.split('<').pop()?.replace('>', '')?.trim() || "";
                          const contactMatch = agentContacts.find(c => c.email.toLowerCase() === cleanFrom.toLowerCase());
                          if (contactMatch && contactMatch.ignore) return false;
                          return true;
                        }).map(email => {
                          const senderName = email.from.split('<')[0].trim().replace(/"/g, '');
                          const isSelected = selectedEmails.has(email.id);
                          const isExpanded = expandedEmailId === email.id;
                          const ts = email.internalDate || 0;
                          const dateLabel = ts > 0
                            ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' • ' + new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '';
                          return (
                            <div key={email.id} onClick={() => setExpandedEmailId(isExpanded ? null : email.id)} className={`p-4 rounded-xl border transition-all group relative cursor-pointer ${isSelected ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-200/50  border-slate-300  hover:border-white/20'}`}>
                              <button
                                type="button"
                                onClick={(e) => toggleSelection(e, email.id)}
                                className={`absolute top-3.5 left-3.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-all z-10 flex-shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-100  border-white/30 hover:border-emerald-400'}`}
                              >
                                {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-black" />}
                              </button>
                              <div className="absolute top-3.5 right-3.5 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteEmail(email.id); }} className="p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-slate-900 " title="Delete Email">
                                  {isDeletingEmail === email.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              </div>
                              <div className="flex justify-between items-start mb-1 gap-2 pl-7">
                                <span className="font-bold text-sm text-slate-800  truncate">{senderName}</span>
                                <span className="text-[10px] text-slate-500  whitespace-nowrap shrink-0 font-medium tabular-nums">{dateLabel}</span>
                              </div>
                              <h4 className={`text-sm text-emerald-400 font-medium mb-1.5 pl-7 ${isExpanded ? '' : 'truncate'}`}>{email.subject}</h4>
                              <p className={`text-xs text-slate-500  leading-relaxed pl-7 break-words ${isExpanded ? '' : 'line-clamp-2'}`}>{(email.snippet || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"')}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  {/* Mini chat at the bottom of Observer Panel */}
                  <div className="p-4 bg-slate-100  border-t border-slate-300  flex items-center gap-2 relative shrink-0">
                    <Bot className={`w-5 h-5 absolute left-7 ${agent.accent}`} />
                    <Input
                      placeholder={`Instruct ${agent.name.split(' ')[0]} to modify these emails...`}
                      className="pl-10 pr-10 bg-slate-200/50  border-slate-300  text-sm h-11 text-slate-900  placeholder:text-slate-500 focus-visible:ring-emerald-500"
                      value={observerInputValue}
                      onChange={e => setObserverInputValue(e.target.value)}
                      onPaste={handlePaste}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleObserverChat()}
                    />
                    <Button size="icon" onClick={handleObserverChat} disabled={!observerInputValue.trim() || isTyping} className="absolute right-6 top-1/2 -translate-y-1/2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-slate-900  w-7 h-7 disabled:opacity-30">
                      {isTyping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    </Button>
                  </div>
                </>
              ) : (
                /* Gmail Disconnected State */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center border border-amber-500/20 shadow-inner">
                      <Mail className="w-9 h-9 text-amber-400" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                      <X className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Gmail Disconnected</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-[280px] leading-relaxed">
                      Connect a Gmail account to enable real-time inbox monitoring and autonomous email drafting.
                    </p>
                  </div>
                  <Button
                    onClick={() => window.location.href = `/api/auth/google?uid=${user?.uid}&agentId=${params.agentId}&origin=soltheory`}
                    disabled={!user?.uid}
                    className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-xl shadow-emerald-500/20 px-8 h-12 rounded-full font-bold transition-all transform hover:scale-105 active:scale-95 gap-2 border-0"
                  >
                    <Mail className="w-4 h-4" /> Connect Gmail Account
                  </Button>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Requires Google OAuth Authorization</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <VoiceAgentModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        agentName={agent.name}
        agentId={params.agentId as string}
        orgPrefix="soltheory"
        onUsageUpdate={(groqUsage, elevenLabsUsage) => {
          if ((groqUsage > 0 || elevenLabsUsage > 0) && user?.uid && firestore) {
            import("firebase/firestore").then(({ doc, updateDoc, increment }) => {
              updateDoc(doc(firestore, "users", user.uid), { 
                groqTokens: increment(groqUsage),
                elevenLabsChars: increment(elevenLabsUsage)
              }).catch(console.error);
            });
          }
        }}
        onCallAI={async (apiMessages) => {
          let rToken = null;
          if (user && firestore) {
            const { getDoc, doc } = await import("firebase/firestore");
            const docSnap = await getDoc(doc(firestore, "users", user.uid));
            const docData = docSnap.data();
            rToken = docData?.[`gmailOAuth_${params.agentId}`]?.refreshToken;
            if (!rToken) rToken = (docData?.gmailOAuth_jarvis?.refreshToken || docData?.gmailOAuth_morpheus?.refreshToken);
            if (!rToken) rToken = docData?.gmailOAuth_email?.refreshToken;
            if (!rToken) rToken = docData?.["gmailOAuth_inbound-email"]?.refreshToken;
            if (!rToken) rToken = docData?.gmailOAuth?.refreshToken;
          }
          const kbText = await getKnowledgeBaseText();
          
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: apiMessages,
              agentId: `soltheory_${params.agentId}`,
              soul: `${agentConfig.soul}\n\n[USER CONTEXT]\nAct on behalf of this user. The user's email address is: ${user?.email || 'Unknown'}. Do not ask them for their email.`,
              brain: agentConfig.brain,
              uid: user?.uid,
              refreshToken: rToken,
              contacts: agentContacts,
              knowledgeBaseText: kbText
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          return data;
        }}
      />
      {lightboxImage && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-full max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <div className="w-full flex justify-between items-center mb-4">
              <span className="text-white text-lg font-semibold drop-shadow-md">{lightboxImage.name}</span>
            </div>
            <img src={lightboxImage.url} alt="Expanded Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
          </div>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20" onClick={() => setLightboxImage(null)}>
            <X className="w-6 h-6" />
          </Button>
        </div>
      )}

    </div>
  );
}
