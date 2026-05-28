"use client";

import { useState, useRef, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VoiceAgentModal } from "@/components/communications/VoiceAgentModal";
import { JarvisViewBrowser, type JarvisViewNavigation } from "@/components/ui/jarvis-view-browser";
import { Input } from "@/components/ui/input";
import { Bot, User, Plus, Search, LogOut, MessageSquare, Send, Menu, Loader2, Mail, Brain, Trash2, X, Sparkles, ArrowLeft, RefreshCw, Eye, CheckCircle2, Settings, CheckSquare, Sun, Moon, Maximize2, Minimize2, Users, FileText, Presentation, Table, Paperclip, Cloud, Mic, BookOpen, Image as ImageIcon, Video, Music, Code , AudioLines, SquarePen, Edit, ChevronDown, MessageCircle, Smartphone, Monitor, Inbox, Star, Archive, Clock} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { notFound } from "next/navigation";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc, setDoc, addDoc, collection, getDocs, query, orderBy, where, deleteDoc, writeBatch, limit as firestoreLimit } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { solTheoryKnowledge } from "@/lib/soltheory-knowledge";

let _msgCounter = 0;
const uid = () => `msg-${Date.now()}-${++_msgCounter}-${Math.random().toString(36).substring(2, 7)}`;

type Message = { id: string; text: string; isSelf: boolean; hiddenContext?: string; imageUrl?: string; };
type Session = { id: string; title: string; updatedAt: number; messages: Message[]; };
type EmailMeta = { id: string; subject: string; snippet: string; from: string; date: string; internalDate?: number; };
type AgentContact = { id: string; email: string; phone?: string; aliases: string; ignore: boolean; };


const exploreItemsMeta: Record<string, { name: string, greeting: string, voiceId: string, color: string }> = {
  "Featured": { name: "Felix", greeting: "Hello. I'm Felix, what premium models would you like to test today?", voiceId: "pFZP5JQG7iQjIQuC4Bku", color: "amber" },
  "Conversational AI": { name: "Jarvis", greeting: "Hello. I am Jarvis. How can I assist you today?", voiceId: "mZ8K1MPRiT5wDQaasg3i", color: "blue" },
  "Image Generation": { name: "Iris", greeting: "Hello. I'm Iris, what kind of image can I help you generate today?", voiceId: "EXAVITQu4vr4xnSDxMaL", color: "purple" },
  "Video Generation": { name: "Victor", greeting: "Hello. I'm Victor, what video concept are we working on today?", voiceId: "VR6AewLTigWG4xSOukaG", color: "green" },
  "Music Generation": { name: "Mac", greeting: "Hello. I'm Mac, can I help generate some music for you?", voiceId: "TX3LPaxmHKxFdv7VOQHJ", color: "rose" },
  "Code Generation": { name: "Cody", greeting: "Hello. I'm Cody, what logic-related endeavor are we tackling today?", voiceId: "iP95p4xoKVk53GoZ742B", color: "orange" },
  
  "Email Agents": { name: "Emma", greeting: "Hello. I'm Emma, what kind of email campaign are we setting up today?", voiceId: "XB0fDUnXU5powFXDhCwa", color: "blue" },
  "Social Media Agents": { name: "Sam", greeting: "Hello. I'm Sam, what social media posts are we scheduling today?", voiceId: "onwK4e9ZLuTAKqWW03F9", color: "pink" },
  "Message Agents": { name: "Max", greeting: "Hello. I'm Max, what messaging integration are we building today?", voiceId: "N2lVS1w4EtoT3dr4eOWO", color: "emerald" },
  "Advertising Agents": { name: "Adam", greeting: "Hello. I'm Adam, what advertising campaign are we launching today?", voiceId: "ErXwobaYiN019PkySvjV", color: "amber" },
  "Build your own Agent": { name: "Builder", greeting: "Hello. I'm Builder, how can I help you configure your custom agent today?", voiceId: "JBFqnCBsd6RMkjVDRZzb", color: "slate" }
};

const LOADING_PHRASES = [
  "Thinking deeply...",
  "Analyzing your request...",
  "Searching the web...",
  "Gathering information...",
  "Reading sources...",
  "Processing data...",
  "Connecting the dots...",
  "Synthesizing insights...",
  "Crafting response...",
  "Cross-referencing...",
  "Consulting knowledge base...",
  "Parsing context...",
  "Evaluating options...",
  "Running analysis...",
  "Checking references...",
  "Compiling results...",
  "Building answer...",
  "Sifting through data...",
  "Examining details...",
  "Reviewing findings...",
  "Formulating thoughts...",
  "Digging deeper...",
  "Scanning databases...",
  "Interpreting results...",
  "Structuring response...",
  "Weighing perspectives...",
  "Correlating data points...",
  "Exploring possibilities...",
  "Refining analysis...",
  "Mapping connections...",
  "Assessing relevance...",
  "Computing insights...",
  "Distilling information...",
  "Querying sources...",
  "Crunching numbers...",
  "Piecing it together...",
  "Reasoning through this...",
  "Fetching latest data...",
  "Reviewing documents...",
  "Analyzing patterns...",
  "Generating insights...",
  "Preparing your answer...",
  "Almost there...",
  "Processing context...",
  "Evaluating sources...",
  "Organizing thoughts...",
  "Bridging concepts...",
  "Validating information...",
  "Harmonizing data...",
  "Calibrating response...",
  "Extracting key points...",
  "Surveying the landscape...",
  "Running diagnostics...",
  "Contextualizing...",
  "Pulling threads...",
  "Mining insights...",
  "Aggregating findings...",
  "Tracing connections...",
  "Benchmarking results...",
  "Fact-checking...",
  "Iterating on ideas...",
  "Filtering noise...",
  "Prioritizing info...",
  "Decoding complexity...",
  "Assembling the puzzle...",
  "Triangulating sources...",
  "Optimizing output...",
  "Reviewing context...",
  "Deep processing...",
  "Analyzing sentiment...",
  "Scanning for patterns...",
  "Building connections...",
  "Researching topic...",
  "Navigating data...",
  "Exploring databases...",
  "Indexing results...",
  "Sorting through findings...",
  "Unpacking concepts...",
  "Verifying accuracy...",
  "Collating responses...",
  "Enriching context...",
  "Rendering insights...",
  "Resolving queries...",
  "Profiling data...",
  "Sequencing thoughts...",
  "Drafting response...",
  "Fine-tuning output...",
  "Aligning perspectives...",
  "Charting a course...",
  "Mapping the terrain...",
  "Surveying options...",
  "Deciphering patterns...",
  "Orchestrating data...",
  "Curating insights...",
  "Weaving narratives...",
  "Sculpting response...",
  "Illuminating details...",
  "Crystallizing thoughts...",
  "Converging on answer...",
  "Polishing response...",
  "Finalizing output...",
];

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
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

  // Rotate loading phrases while Jarvis is typing
  useEffect(() => {
    if (!isTyping) {
      setLoadingPhraseIndex(Math.floor(Math.random() * LOADING_PHRASES.length));
      return;
    }
    const interval = setInterval(() => {
      setLoadingPhraseIndex(Math.floor(Math.random() * LOADING_PHRASES.length));
    }, 2500);
    return () => clearInterval(interval);
  }, [isTyping]);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string, name: string } | null>(null);


  // Observer Panel States
  const [isObserverFullScreen, setIsObserverFullScreen] = useState(false);
  const [isObserverOpen, setIsObserverOpen] = useState(false);
  const [observerInputValue, setObserverInputValue] = useState("");
  const [incomingEmails, setIncomingEmails] = useState<EmailMeta[]>([]);
  const [ignoredEmails, setIgnoredEmails] = useState<string[]>([]);

  const [isDeletingEmail, setIsDeletingEmail] = useState<string | null>(null);

  // Agent Eye States
  const [agentEyeTab, setAgentEyeTab] = useState<'gmail' | 'outlook' | 'sms' | 'jarvis-view'>('gmail');
  const [agentEyeDropdownOpen, setAgentEyeDropdownOpen] = useState(false);
  const [isAgentEyeOpen, setIsAgentEyeOpen] = useState(false);
  const [agentEyePos, setAgentEyePos] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return { x: 10, y: 80 };
    return { x: 200, y: 120 };
  });
  const [agentEyeSize, setAgentEyeSize] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return { w: Math.min(280, window.innerWidth - 20), h: 300 };
    return { w: 420, h: 420 };
  });
  const [agentEyeExpanded, setAgentEyeExpanded] = useState(false);
  const [jarvisNavQueue, setJarvisNavQueue] = useState<JarvisViewNavigation[]>([]);
  const agentEyeDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const agentEyeResizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; origX: number; origY: number; edge: string } | null>(null);

  // Agent Eye Minimize state
  const [isAgentEyeMinimized, setIsAgentEyeMinimized] = useState(false);
  const [agentEyeMinRight, setAgentEyeMinRight] = useState(16);
  const agentEyeMinDragRef = useRef<{ startX: number; origRight: number } | null>(null);

  // Chat sidebar resizable state
  const [chatSidebarWidth, setChatSidebarWidth] = useState(300);
  const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = useState(false);
  const sidebarResizeRef = useRef<{ startX: number; startW: number } | null>(null);

  // Keep a ref of current size so drag handler can access it without re-creating
  const agentEyeSizeRef = useRef(agentEyeSize);
  agentEyeSizeRef.current = agentEyeSize;

  // Agent Eye drag handlers
  const onAgentEyeDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    agentEyeDragRef.current = { startX: e.clientX, startY: e.clientY, origX: agentEyePos.x, origY: agentEyePos.y };
  }, [agentEyePos]);

  const onAgentEyeDragMove = useCallback((e: React.PointerEvent) => {
    if (!agentEyeDragRef.current) return;
    const dx = e.clientX - agentEyeDragRef.current.startX;
    const dy = e.clientY - agentEyeDragRef.current.startY;
    const maxX = window.innerWidth - agentEyeSizeRef.current.w;
    const maxY = window.innerHeight - agentEyeSizeRef.current.h;
    setAgentEyePos({
      x: Math.max(0, Math.min(maxX, agentEyeDragRef.current.origX + dx)),
      y: Math.max(0, Math.min(maxY, agentEyeDragRef.current.origY + dy))
    });
  }, []);

  const onAgentEyeDragEnd = useCallback(() => {
    agentEyeDragRef.current = null;
  }, []);

  // Keep a ref of current position so resize handler can access it
  const agentEyePosRef = useRef(agentEyePos);
  agentEyePosRef.current = agentEyePos;

  // Agent Eye resize handlers — supports all edges and corners
  const onAgentEyeEdgeResizeStart = useCallback((edge: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    agentEyeResizeRef.current = {
      startX: e.clientX, startY: e.clientY,
      origW: agentEyeSize.w, origH: agentEyeSize.h,
      origX: agentEyePos.x, origY: agentEyePos.y,
      edge
    };
  }, [agentEyeSize, agentEyePos]);

  const onAgentEyeResizeMove = useCallback((e: React.PointerEvent) => {
    if (!agentEyeResizeRef.current) return;
    const { startX, startY, origW, origH, origX, origY, edge } = agentEyeResizeRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let newW = origW, newH = origH, newX = origX, newY = origY;

    if (edge.includes('r')) { newW = Math.max(280, Math.min(window.innerWidth - origX, origW + dx)); }
    if (edge.includes('b')) { newH = Math.max(280, Math.min(window.innerHeight - origY, origH + dy)); }
    if (edge.includes('l')) {
      const dw = Math.min(dx, origW - 280);
      newW = origW - dw;
      newX = Math.max(0, origX + dw);
    }
    if (edge.includes('t')) {
      const dh = Math.min(dy, origH - 280);
      newH = origH - dh;
      newY = Math.max(0, origY + dh);
    }

    setAgentEyeSize({ w: newW, h: newH });
    if (edge.includes('l') || edge.includes('t')) setAgentEyePos({ x: newX, y: newY });
  }, []);

  const onAgentEyeResizeEnd = useCallback(() => {
    agentEyeResizeRef.current = null;
  }, []);

  // Double-click header to toggle 2x expanded size
  const onAgentEyeDoubleClick = useCallback(() => {
    if (agentEyeExpanded) {
      setAgentEyeSize({ w: 420, h: 420 });
      setAgentEyeExpanded(false);
    } else {
      const targetW = 780, targetH = 680;
      const x = Math.max(0, Math.min(agentEyePos.x, window.innerWidth - targetW));
      const y = Math.max(0, Math.min(agentEyePos.y, window.innerHeight - targetH));
      setAgentEyeSize({ w: targetW, h: targetH });
      setAgentEyePos({ x, y });
      setAgentEyeExpanded(true);
    }
  }, [agentEyeExpanded, agentEyePos]);

  // SMS Sound Effects
  const playSmsSound = useCallback((type: 'sent' | 'received') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (type === 'sent') {
        // Swoosh — ascending tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      } else {
        // Ding — two-tone chime
        [600, 800].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = freq;
          const t = ctx.currentTime + i * 0.12;
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          osc.start(t);
          osc.stop(t + 0.3);
        });
      }
      setTimeout(() => ctx.close(), 500);
    } catch { /* audio not available */ }
  }, []);
  const [isPolling, setIsPolling] = useState(false);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // SMS Observer States
  const [smsConversations, setSmsConversations] = useState<{contact: string; lastMessage: string; lastTime: string; direction: string; unreadCount: number; messageCount: number}[]>([]);
  const [smsMessages, setSmsMessages] = useState<{id: string; from: string; to: string; body: string; direction: string; createdAt: string}[]>([]);
  const [smsActiveContact, setSmsActiveContact] = useState<string | null>(null);
  const [smsNewMessage, setSmsNewMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsTwilioNumber, setSmsTwilioNumber] = useState<string | null>(null);
  const smsEndRef = useRef<HTMLDivElement>(null);

  const openVoiceSession = () => {
    if (typeof window !== "undefined") {
      // 1. Initialize and play a brief silent sound to unlock the audio element on mobile
      let audio = (window as any).jarvisAudio;
      if (!audio) {
        audio = document.createElement("audio");
        audio.setAttribute("playsinline", "true");
        audio.setAttribute("webkit-playsinline", "true");
        (window as any).jarvisAudio = audio;
      }
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
      }).catch((e: any) => console.warn("Audio unlock failed on trigger click:", e));

      // 2. Warm up AudioContext
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        let ctx = (window as any).jarvisAudioContext;
        if (!ctx || ctx.state === "closed") {
          ctx = new AudioCtx();
          (window as any).jarvisAudioContext = ctx;
        }
        if (ctx.state === "suspended") {
          ctx.resume().catch((e: any) => console.warn("Context resume failed on trigger click:", e));
        }
      }
    }
    setIsVoiceModalOpen(true);
  };
  const [totalGroqTokens, setTotalGroqTokens] = useState(0);
  const [totalElevenLabsChars, setTotalElevenLabsChars] = useState(0);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [sessionInstructions, setSessionInstructions] = useState("");
  const [isSystemInstructionsOpen, setIsSystemInstructionsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("llama-3.3-70b-versatile");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const [exploreTab, setExploreTab] = useState<"models" | "agents">("models");
  const [selectedExploreItem, setSelectedExploreItem] = useState<string | null>(null);

  const [isAgentRequestModalOpen, setIsAgentRequestModalOpen] = useState(false);
  const [agentRequestForm, setAgentRequestForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [isSubmittingAgentRequest, setIsSubmittingAgentRequest] = useState(false);

  const submitAgentRequest = async () => {
    if (!agentRequestForm.name || !agentRequestForm.email || !agentRequestForm.message) {
      alert("Name, Email, and Message are required fields.");
      return;
    }
    setIsSubmittingAgentRequest(true);
    try {
      const { collection, addDoc } = await import("firebase/firestore");
      await addDoc(collection(firestore, "support_tickets"), {
        subject: "New Agent Request",
        message: `Name: ${agentRequestForm.name}\nPhone: ${agentRequestForm.phone}\nEmail: ${agentRequestForm.email}\n\nRequest:\n${agentRequestForm.message}`,
        fromEmail: agentRequestForm.email,
        fromName: agentRequestForm.name,
        toEmail: "lucas@soltheory.com",
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAgentRequest: true
      });
      alert("Agent Request Submitted!");
      setIsAgentRequestModalOpen(false);
      setAgentRequestForm({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      console.error(err);
      alert("Failed to submit request.");
    } finally {
      setIsSubmittingAgentRequest(false);
    }
  };

  const [agentContacts, setAgentContacts] = useState<AgentContact[]>([]);

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
  const [orgBrain, setOrgBrain] = useState<string>("");
  const [orgBrainLoaded, setOrgBrainLoaded] = useState(false);
  const [orgBrainSaving, setOrgBrainSaving] = useState(false);
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"identity" | "data" | "brain" | "pact" | "orgbrain">("identity");
  const [ragDocs, setRagDocs] = useState<any[]>([]);
  const [isRAGUploading, setIsRAGUploading] = useState(false);
  const [isTextInputOpen, setIsTextInputOpen] = useState(false);
  const [ragTitle, setRagTitle] = useState("");
  const [ragTextContent, setRagTextContent] = useState("");

  // P.A.C.T. — Personalized AI Conversation Training
  type PACTEntry = { id: string; question: string; answer: string; source: string; orgId: string; createdAt: number; updatedAt: number };
  const [pactEntries, setPactEntries] = useState<PACTEntry[]>([]);
  const [pactLoaded, setPactLoaded] = useState(false);

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

  // Load P.A.C.T. entries from Firestore
  const fetchPACTEntries = async () => {
    if (!user?.uid || !firestore) return;
    try {
      const { getDoc, doc } = await import("firebase/firestore");
      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      const entries: PACTEntry[] = [];

      // Fallback: Read from the field
      const fieldData = userDoc.data()?.pact_entries_soltheory || [];
      fieldData.forEach((item: any, index: number) => {
        entries.push({
          id: `field-${index}`,
          question: item.question,
          answer: item.answer,
          source: item.source || "server_background",
          orgId: "soltheory",
          createdAt: item.createdAt || Date.now(),
          updatedAt: item.updatedAt || Date.now()
        });
      });

      entries.sort((a, b) => b.createdAt - a.createdAt);

      setPactEntries(entries);
      setPactLoaded(true);
    } catch (err) { console.error("Failed to load PACT entries", err); }
  };

  useEffect(() => {
    if (user?.uid && firestore) {
      fetchPACTEntries();
    }
  }, [user?.uid, firestore]);

  // Build PACT text for API injection
  const pactText = pactEntries.length > 0
    ? pactEntries.map(e => `Q: ${e.question}\nA: ${e.answer}`).join("\n\n")
    : "";



  // Org Brain — editable organizational knowledge base stored in Firestore
  const fetchOrgBrain = async () => {
    if (!firestore) return;
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const snap = await getDoc(doc(firestore, "organizations", "soltheory"));
      if (snap.exists()) {
        setOrgBrain(snap.data()?.orgBrain || "");
      }
      setOrgBrainLoaded(true);
    } catch (err) { console.error("Failed to load org brain", err); setOrgBrainLoaded(true); }
  };

  const saveOrgBrain = async () => {
    if (!firestore) return;
    setOrgBrainSaving(true);
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(firestore, "organizations", "soltheory"), { orgBrain }, { merge: true });
    } catch (err) { console.error("Failed to save org brain", err); alert("Failed to save. Check Firestore rules."); }
    finally { setOrgBrainSaving(false); }
  };

  useEffect(() => {
    if (firestore) fetchOrgBrain();
  }, [firestore]);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Global click-outside and Escape key handler for all dropdowns/popups
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Close model dropdown if clicking outside it
      if (isModelDropdownOpen && !target.closest('[data-dropdown="model"]')) {
        setIsModelDropdownOpen(false);
      }
      // Close cost breakdown if clicking outside it
      if (showCostBreakdown && !target.closest('[data-popup="cost"]')) {
        setShowCostBreakdown(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModelDropdownOpen(false);
        setShowCostBreakdown(false);
        if (isSystemInstructionsOpen) setIsSystemInstructionsOpen(false);
        if (lightboxImage) setLightboxImage(null);
        if (isObserverFullScreen) setIsObserverFullScreen(false);
        if (isKnowledgeBaseOpen) setIsKnowledgeBaseOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isModelDropdownOpen, showCostBreakdown, isSystemInstructionsOpen, lightboxImage, isObserverFullScreen, isKnowledgeBaseOpen]);

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

  // Initialize – Load sessions from Firestore (with localStorage fallback migration)
  useEffect(() => {
    if (!firestore || !user?.uid) {
      // Fallback for unauthenticated: use localStorage
      const savedSessions = localStorage.getItem(`st_agent_sessions_${params.agentId}`);
      if (savedSessions) {
        try {
          const parsed: Session[] = JSON.parse(savedSessions);
          const validParsed = parsed.filter(s => s.messages.filter(m => m.isSelf).length > 0);
          setSessions(validParsed);
        } catch { /* no-op */ }
      }
      // Start with a blank screen — no active session, no messages
      setActiveSessionId(null);
      setMessages([]);
      setSessionsLoaded(true);
      return;
    }

    // Load from Firestore
    const loadSessions = async () => {
      try {
        const sessionsRef = collection(firestore, "users", user.uid, "jarvis_sessions");
        const q = query(sessionsRef, orderBy("updatedAt", "desc"), firestoreLimit(50));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const loaded: Session[] = [];
          snap.forEach(doc => {
            const data = doc.data();
            loaded.push({
              id: doc.id,
              title: data.title || "New Chat",
              updatedAt: data.updatedAt || 0,
              messages: data.messages || [],
            });
          });
          // Filter out empty ghost sessions (no user messages and title is "New Chat")
          const validSessions = loaded.filter(s =>
            s.messages.filter((m: Message) => m.isSelf).length > 0 || s.title !== "New Chat"
          );
          // Clean up ghost sessions from Firestore
          const ghostIds = loaded.filter(s =>
            s.messages.filter((m: Message) => m.isSelf).length === 0 && s.title === "New Chat"
          ).map(s => s.id);
          for (const gid of ghostIds) {
            deleteDoc(doc(firestore, "users", user.uid, "jarvis_sessions", gid)).catch(() => { });
          }
          // Load only valid sessions — start with blank screen
          setSessions(validSessions);
          setActiveSessionId(null);
          setMessages([]);
        } else {
          // Check for localStorage sessions to migrate
          const savedSessions = localStorage.getItem(`st_agent_sessions_${params.agentId}`);
          if (savedSessions) {
            try {
              const parsed: Session[] = JSON.parse(savedSessions);
              if (parsed.length > 0) {
                // Migrate localStorage sessions to Firestore
                for (const s of parsed) {
                  if (s.messages.filter(m => m.isSelf).length > 0) {
                    await setDoc(doc(firestore, "users", user.uid, "jarvis_sessions", s.id), {
                      title: s.title,
                      updatedAt: s.updatedAt,
                      messages: s.messages,
                      migratedFromLocalStorage: true,
                    });
                  }
                }
                const validParsed = parsed.filter(s => s.messages.filter(m => m.isSelf).length > 0);
                setSessions(validParsed);
                // Clear localStorage after migration
                localStorage.removeItem(`st_agent_sessions_${params.agentId}`);
              }
            } catch { /* no-op */ }
          }
          // Blank screen — no active session
          setActiveSessionId(null);
          setMessages([]);
        }
      } catch (err) {
        console.error("Failed to load sessions from Firestore", err);
        setActiveSessionId(null);
        setMessages([]);
      }
      setSessionsLoaded(true);
    };

    loadSessions();

    const savedConfig = localStorage.getItem(`st_agent_config_${params.agentId}`);
    if (savedConfig) {
      try { setAgentConfig(JSON.parse(savedConfig)); } catch { }
    }
    const savedContacts = localStorage.getItem(`st_agent_contacts_${params.agentId}`);
    if (savedContacts) {
      try { setAgentContacts(JSON.parse(savedContacts)); } catch { }
    }
  }, [params.agentId, firestore, user?.uid]);

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
            // Title will be set by the AI summarizer after the first exchange
            const userMessages = messages.filter(m => m.isSelf);
            return { ...s, messages, updatedAt: userMessages.length > 0 ? Date.now() : s.updatedAt };
          }
          return s;
        });
        return updated;
      });
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, activeSessionId, params.agentId]);

  // Save active session to Firestore on message changes — ONLY if it has user messages
  useEffect(() => {
    if (sessions.length > 0 && !isTyping && activeSessionId && sessionsLoaded && firestore && user?.uid) {
      const activeSession = sessions.find(s => s.id === activeSessionId);
      if (activeSession && activeSession.messages.filter(m => m.isSelf).length > 0) {
        const sessionData = {
          title: activeSession.title,
          updatedAt: activeSession.updatedAt,
          messages: activeSession.messages,
          lastMessagePreview: activeSession.messages.length > 0
            ? activeSession.messages[activeSession.messages.length - 1].text.substring(0, 100)
            : "",
        };
        setDoc(
          doc(firestore, "users", user.uid, "jarvis_sessions", activeSessionId),
          sessionData,
          { merge: true }
        ).catch(console.error);
      }
    }
  }, [sessions, isTyping, activeSessionId, sessionsLoaded, firestore, user?.uid]);



  const startNewSession = () => {
    // Reset to blank screen — no session is created until the user sends a message
    setActiveSessionId(null);
    setMessages([]);
    setSelectedExploreItem(null);
  };

  const loadSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) { setActiveSessionId(session.id); setMessages(session.messages); setIsKnowledgeBaseOpen(false); setSelectedExploreItem(null); }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const session = sessions.find(s => s.id === id);
    const isEmpty = session && session.title === "New Chat" && session.messages.filter(m => m.isSelf).length === 0;
    // Empty "New Chat" sessions can be removed silently (no confirm)
    // Sessions with content require confirmation
    if (!isEmpty && !confirm('Delete this chat?')) return;
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    // Delete from Firestore if saved
    if (firestore && user?.uid) {
      deleteDoc(doc(firestore, "users", user.uid, "jarvis_sessions", id)).catch(() => { });
    }
    if (activeSessionId === id) {
      // Return to blank screen
      setActiveSessionId(null);
      setMessages([]);
      setSelectedExploreItem(null);
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

    // Lazily create a new session on first message if no active session exists
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const newSession: Session = {
        id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: "New Chat",
        updatedAt: Date.now(),
        messages: []
      };
      currentSessionId = newSession.id;
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(currentSessionId);
    }

    // Filter out welcome greeting messages (bot-only messages that were never part of a real session)
    const realMessages = messages.filter(m => m.isSelf || messages.some(um => um.isSelf));
    const newMessages = [...realMessages, userMsg];
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
          soul: `${agentConfig.soul}${sessionInstructions ? `\n\n[SESSION INSTRUCTIONS]\n${sessionInstructions}` : ''}\n\n[USER CONTEXT]\nAct on behalf of this user. The user's email address is: ${user?.email || 'Unknown'}. Do not ask them for their email.`,
          brain: agentConfig.brain,
          uid: user?.uid,
          refreshToken: rToken,
          contacts: agentContacts,
          knowledgeBaseText: kbText,
          orgBrainText: orgBrain,
          pactText,
          userName: user?.displayName || undefined,
          model: selectedModel
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Check if Jarvis searched the web — orchestrate sequential animation
      const webSearchNavs: JarvisViewNavigation[] = [];
      if (data.executedTools && Array.isArray(data.executedTools)) {
        const webSearchTools = data.executedTools.filter((t: any) => t.name === 'web_search');
        webSearchTools.forEach((t: any) => {
          const results = t.args?.searchResults || [];
          results.forEach((r: any) => {
            if (r.url) webSearchNavs.push({ url: r.url, title: r.title });
          });
        });
      }

      // Limit to 2 websites by default
      const limitedNavs = webSearchNavs.slice(0, 2);

      if (limitedNavs.length > 0) {
        // Sequential flow: animate first URL → show response → animate second URL
        setAgentEyeTab('jarvis-view');
        setIsAgentEyeMinimized(false);
        setIsAgentEyeOpen(true);

        // Small delay to let the component mount before pushing nav queue
        await new Promise(resolve => setTimeout(resolve, 300));

        // 1. Navigate to first URL
        setJarvisNavQueue(prev => [...prev, limitedNavs[0]]);

        // 2. Wait for first animation (~4s for cursor + typing + loading), then show response
        await new Promise(resolve => setTimeout(resolve, 4000));
        setMessages(prev => [...prev, { id: uid(), text: data.response, isSelf: false }]);

        // 3. If there's a second URL, navigate to it after a brief pause
        if (limitedNavs.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          setJarvisNavQueue(prev => [...prev, limitedNavs[1]]);
        }
      } else {
        // No web search — show response immediately
        setMessages(prev => [...prev, { id: uid(), text: data.response, isSelf: false }]);
      }

      // Generate AI title for new sessions after first exchange
      const activeSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
      if (activeSession && (activeSession.title === "New Chat" || !activeSession.title)) {
        fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "system", content: "You are a title generator. Given a user message and AI response, output ONLY a short comma-separated list of 3-5 key topic words that summarize the conversation. No full sentences, no quotes, no explanation. Example output: US History, D-Day, Normandy Beaches" },
              { role: "user", content: `User said: ${inputValue}\nAI replied: ${data.response.substring(0, 200)}` }
            ],
            agentId: "soltheory_jarvis",
            soul: "",
            brain: "",
          }),
        }).then(r => r.json()).then(titleData => {
          if (titleData.response) {
            const aiTitle = titleData.response.replace(/["']/g, '').trim().substring(0, 60);
            setSessions(prev => prev.map(s =>
              s.id === currentSessionId ? { ...s, title: aiTitle } : s
            ));
          }
        }).catch(() => {
          // Fallback: use first few words of user message
          const fallback = inputValue.split(' ').slice(0, 6).join(' ');
          setSessions(prev => prev.map(s =>
            s.id === currentSessionId ? { ...s, title: fallback } : s
          ));
        });
      }

      const usage = data.usage || 0;
      if (usage > 0 && user?.uid && firestore) {
        import("firebase/firestore").then(({ doc, updateDoc, increment }) => {
          updateDoc(doc(firestore, "users", user.uid), { groqTokens: increment(usage) }).catch(console.error);
        });
      }

      // Trigger background PACT extraction securely on the server
      if (user?.uid) {
        fetch("/api/pact/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessage: inputValue,
            aiResponse: data.response,
            userName: user?.displayName || undefined,
            uid: user.uid,
            orgId: "soltheory"
          })
        }).then(res => res.json()).then(async (extractData) => {
          if (extractData.facts && extractData.facts.length > 0 && firestore && user?.uid) {
            const { doc, getDoc, updateDoc, arrayUnion } = await import("firebase/firestore");
            const userDocRef = doc(firestore, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            const existingField = userDocSnap.data()?.pact_entries_soltheory || [];
            const existingQs = new Set(existingField.map((f: any) => f.question?.toLowerCase()?.trim()));

            const newFacts = extractData.facts.filter((f: any) => !existingQs.has(f.question?.toLowerCase()?.trim())).map((f: any) => ({
              question: f.question,
              answer: f.answer,
              source: "server_background",
              createdAt: Date.now(),
              updatedAt: Date.now()
            }));

            if (newFacts.length > 0) {
              await updateDoc(userDocRef, {
                pact_entries_soltheory: arrayUnion(...newFacts)
              });
              setTimeout(fetchPACTEntries, 1000);
            }
          }
        }).catch(console.error);
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

    // Lazily create a new session on first message if no active session exists
    if (!activeSessionId) {
      const newSession: Session = {
        id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: "New Chat",
        updatedAt: Date.now(),
        messages: []
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    }

    // Add msg to main chat
    const userMsg: Message = { id: uid(), text: msgText, isSelf: true };
    const realMessages = messages.filter(m => m.isSelf || messages.some(um => um.isSelf));
    const newMessages = [...realMessages, userMsg];
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
          soul: `${agentConfig.soul}${sessionInstructions ? `\n\n[SESSION INSTRUCTIONS]\n${sessionInstructions}` : ''}\n\n[USER CONTEXT]\nAct on behalf of this user. The user's email address is: ${user?.email || 'Unknown'}. Do not ask them for their email.`,
          brain: agentConfig.brain,
          uid: user?.uid,
          refreshToken: rToken,
          contacts: agentContacts,
          knowledgeBaseText: kbText,
          orgBrainText: orgBrain,
          pactText,
          userName: user?.displayName || undefined,
          model: selectedModel
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

      // --- Save P.A.C.T. facts from API response ---
      if (data.pactFacts && data.pactFacts.length > 0 && user?.uid && firestore) {
        (async () => {
          try {
            const orgId = "soltheory";
            const pactCol = collection(firestore, "users", user.uid, "pact_entries");
            const existingSnap = await getDocs(query(pactCol, where("orgId", "==", orgId)));
            const existingQs = new Set<string>();
            existingSnap.forEach(d => existingQs.add(d.data().question?.toLowerCase()?.trim()));
            for (const fact of data.pactFacts) {
              const nq = fact.question.toLowerCase().trim();
              if (!existingQs.has(nq) && existingSnap.size < 200) {
                await addDoc(pactCol, { question: fact.question, answer: fact.answer, source: "text", orgId, createdAt: Date.now(), updatedAt: Date.now() });
                existingQs.add(nq);
              }
            }
            fetchPACTEntries();
            console.log(`[PACT] Saved ${data.pactFacts.length} facts locally (observer)`);
          } catch (e) { console.error("[PACT] Client save error:", e); }
        })();
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
          knowledgeBaseText: kbText,
          orgBrainText: orgBrain,
          pactText,
          userName: user?.displayName || undefined
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
    if (isAgentEyeOpen && agentEyeTab === 'gmail' && isGmailConnected) {
      fetchPulse();
      const interval = setInterval(() => {
        fetchPulse();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isAgentEyeOpen, agentEyeTab, isGmailConnected]);

  // SMS fetch helpers
  const fetchSmsConversations = useCallback(async () => {
    if (!user?.uid || !firestore) return;
    setSmsLoading(true);
    try {
      // check twilio number
      const uDoc = await getDoc(doc(firestore, 'users', user.uid));
      const twNum = uDoc.data()?.twilioPhoneNumber;
      setSmsTwilioNumber(twNum || null);
      if (!twNum) { setSmsLoading(false); return; }

      const snap = await getDocs(query(collection(firestore, 'users', user.uid, 'sms_messages'), orderBy('createdAt', 'desc'), firestoreLimit(500)));
      const convMap = new Map<string, any>();
      snap.docs.forEach(d => {
        const data = d.data();
        const contact = data.direction === 'inbound' ? data.from : data.to;
        if (!convMap.has(contact)) convMap.set(contact, { contact, lastMessage: data.body || '', lastTime: data.createdAt, direction: data.direction, unreadCount: 0, messageCount: 0 });
        const c = convMap.get(contact)!;
        c.messageCount++;
        if (data.direction === 'inbound' && !data.read) c.unreadCount++;
      });
      const newConvos = Array.from(convMap.values()).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
      // Detect new inbound messages and play sound
      if (smsConversations.length > 0 && newConvos.length > 0) {
        const oldTotal = smsConversations.reduce((sum, c) => sum + c.messageCount, 0);
        const newTotal = newConvos.reduce((sum: number, c: any) => sum + c.messageCount, 0);
        const hasNewInbound = newConvos.some((nc: any) => {
          const oc = smsConversations.find(c => c.contact === nc.contact);
          return oc && nc.messageCount > oc.messageCount && nc.direction === 'inbound';
        });
        if (newTotal > oldTotal && hasNewInbound) playSmsSound('received');
      }
      setSmsConversations(newConvos);
    } catch (e) { console.error('[SMS] fetch error', e); }
    finally { setSmsLoading(false); }
  }, [user?.uid, firestore, smsConversations, playSmsSound]);

  const fetchSmsThread = useCallback(async (contact: string) => {
    if (!user?.uid || !firestore) return;
    try {
      const snap = await getDocs(query(collection(firestore, 'users', user.uid, 'sms_messages'), orderBy('createdAt', 'desc'), firestoreLimit(200)));
      const normalized = contact.replace(/[^+\d]/g, '');
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
        .filter((m: any) => (m.from || '').includes(normalized) || (m.to || '').includes(normalized))
        .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setSmsMessages(msgs);
      setTimeout(() => smsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) { console.error('[SMS] thread error', e); }
  }, [user?.uid, firestore]);

  const sendSms = useCallback(async () => {
    if (!smsNewMessage.trim() || !smsActiveContact || !smsTwilioNumber || !user?.uid || !firestore) return;
    setSmsSending(true);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: smsTwilioNumber, to: smsActiveContact, message: smsNewMessage })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Save to Firestore
      await addDoc(collection(firestore, 'users', user.uid, 'sms_messages'), {
        sid: data.sid, from: smsTwilioNumber, to: data.to || smsActiveContact,
        body: smsNewMessage, direction: 'outbound', status: 'sent', createdAt: new Date().toISOString()
      });
      playSmsSound('sent');
      setSmsNewMessage('');
      await fetchSmsThread(smsActiveContact);
      await fetchSmsConversations();
    } catch (e: any) { console.error('[SMS] send error', e); }
    finally { setSmsSending(false); }
  }, [smsNewMessage, smsActiveContact, smsTwilioNumber, user?.uid, firestore, fetchSmsThread, fetchSmsConversations, playSmsSound]);

  // SMS polling
  useEffect(() => {
    if (isAgentEyeOpen && agentEyeTab === 'sms') {
      fetchSmsConversations();
      const interval = setInterval(fetchSmsConversations, 10000);
      return () => clearInterval(interval);
    }
  }, [isAgentEyeOpen, agentEyeTab, fetchSmsConversations]);

  // Refetch thread when active contact changes
  useEffect(() => {
    if (smsActiveContact && isAgentEyeOpen && agentEyeTab === 'sms') fetchSmsThread(smsActiveContact);
  }, [smsActiveContact, isAgentEyeOpen, agentEyeTab, fetchSmsThread]);

  return (
    <>
    <div className="flex w-full flex-1 min-h-0 bg-slate-50 text-slate-800 overflow-hidden font-sans selection:bg-fuchsia-500/30">

      {/* Sessions Sidebar */}
      <div className="hidden md:flex flex-col bg-white/80 backdrop-blur-3xl border-r border-slate-200 shrink-0 z-20 relative overflow-hidden" style={{ width: isChatSidebarCollapsed ? 0 : chatSidebarWidth, minWidth: isChatSidebarCollapsed ? 0 : 180, maxWidth: 500, transition: sidebarResizeRef.current ? 'none' : 'width 0.3s ease' }}>
        {/* Sidebar header unchanged for brevity (Using standard implementation) */}
        <div className="p-4 flex flex-col gap-3 border-b border-slate-200">
          {/* Model Selector */}
          <div className="relative" data-dropdown="model">
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="w-full text-left p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Model</div>
                <div className="text-sm font-semibold text-slate-800 truncate mt-0.5">
                  {[{id:'llama-3.3-70b-versatile',name:'Llama 3.3'},{id:'openai/gpt-oss-120b',name:'GPT 120B'},{id:'openai/gpt-oss-20b',name:'GPT 20B'},{id:'qwen/qwen3-32b',name:'Qwen 3'}].find(m => m.id === selectedModel)?.name || 'Llama 3.3'}
                </div>
              </div>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isModelDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {[
                  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3', desc: 'Best all-around model', tag: 'Default', tagColor: 'bg-blue-50 text-blue-600' },
                  { id: 'openai/gpt-oss-120b', name: 'GPT 120B', desc: 'Most powerful reasoning', tag: 'Pro', tagColor: 'bg-purple-50 text-purple-600' },
                  { id: 'openai/gpt-oss-20b', name: 'GPT 20B', desc: 'Lightweight & fast', tag: 'Fast', tagColor: 'bg-emerald-50 text-emerald-600' },
                  { id: 'qwen/qwen3-32b', name: 'Qwen 3', desc: 'Advanced reasoning & math', tag: 'Smart', tagColor: 'bg-amber-50 text-amber-600' },
                ].map(model => (
                  <button
                    key={model.id}
                    onClick={() => { setSelectedModel(model.id); setIsModelDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedModel === model.id ? 'bg-slate-50' : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedModel === model.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                      <div className="min-w-0">
                        <span className={`text-sm font-medium block ${selectedModel === model.id ? 'text-slate-900' : 'text-slate-600'}`}>{model.name}</span>
                        <span className="text-[10px] text-slate-400 block">{model.desc}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${model.tagColor}`}>{model.tag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* System Instructions Box */}
          <button
            onClick={() => setIsSystemInstructionsOpen(true)}
            className="w-full text-left p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">System instructions</span>
              {sessionInstructions && <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {sessionInstructions
                ? sessionInstructions.substring(0, 60) + (sessionInstructions.length > 60 ? '...' : '')
                : 'Optional tone and style instructions for the model'}
            </p>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin mt-2">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs font-semibold text-slate-900 uppercase tracking-widest">Chat History</span>
                      <button onClick={() => setIsChatSidebarCollapsed(true)} className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors" title="Collapse sidebar">
                        <svg className="w-3 h-3 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
          <button onClick={() => startNewSession()} className="w-full text-left p-3 rounded-xl border border-dashed border-slate-300/50 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center gap-3 mb-4 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-100 transition-colors">
              <SquarePen className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-slate-700">New Chat</span>
          </button>
          {sessions.filter(s => s.messages.filter(m => m.isSelf).length > 0 || s.title !== "New Chat").length === 0 && (
            <div className="text-xs text-slate-400 px-1 py-4 text-center">No conversations yet.<br/>Start typing below to begin.</div>
          )}
          {sessions.filter(s => s.messages.filter(m => m.isSelf).length > 0 || s.title !== "New Chat").map(s => (
            <div key={s.id} onClick={() => loadSession(s.id)} className={`group cursor-pointer flex items-center w-full px-3 mt-1 min-h-[40px] py-2 rounded-lg transition-all ${activeSessionId === s.id ? 'bg-slate-300/50  text-slate-900  border border-slate-200 ' : 'text-slate-500  hover:text-slate-900  hover:bg-slate-200/50 '}`}>
              <MessageSquare className="w-4 h-4 mr-3 shrink-0 opacity-70" />
              <span className="text-sm font-medium flex-1 break-words leading-snug">{s.title}</span>
              <button onClick={(e) => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all ml-1 p-1 rounded-md hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>


      </div>

      {/* Sidebar Resize Handle */}
      <div
        className="hidden md:flex w-[5px] cursor-col-resize items-center justify-center group hover:bg-indigo-500/20 active:bg-indigo-500/30 transition-colors relative z-30 shrink-0"
        style={{ marginLeft: -2.5, display: isChatSidebarCollapsed ? 'none' : undefined }}
        onPointerDown={(e) => {
          e.preventDefault();
          sidebarResizeRef.current = { startX: e.clientX, startW: chatSidebarWidth };
          const onMove = (ev: PointerEvent) => {
            if (!sidebarResizeRef.current) return;
            const delta = ev.clientX - sidebarResizeRef.current.startX;
            const newW = Math.max(180, Math.min(500, sidebarResizeRef.current.startW + delta));
            setChatSidebarWidth(newW);
          };
          const onUp = () => {
            sidebarResizeRef.current = null;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
          };
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        }}
      >
        <div className="w-[2px] h-8 rounded-full bg-slate-300 group-hover:bg-indigo-400 transition-colors" />
      </div>

      {/* Sidebar Collapse Toggle */}
      {isChatSidebarCollapsed && (
        <button
          onClick={() => setIsChatSidebarCollapsed(false)}
          className="hidden md:flex w-6 h-12 bg-white border border-slate-200 shadow-sm rounded-r-lg items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all z-30 cursor-pointer shrink-0 my-auto"
          title="Expand sidebar"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {/* Main UI Pane */}
      <div className="flex-1 flex flex-col h-full relative z-10 overflow-hidden">

        {/* Background Ambient Glow */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 pointer-events-none" style={{ animation: 'spin 180s linear infinite', opacity: messages.length === 0 && !selectedExploreItem ? 1 : 0, transition: 'opacity 1s ease' }}>
            <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-fuchsia-600/10 blur-[150px] rounded-full mix-blend-screen" />
            <div className="absolute bottom-[20%] left-[20%] w-[600px] h-[600px] bg-indigo-600/10 blur-[150px] rounded-full mix-blend-screen" />
          </div>
        </div>

        {/* Top Navigator */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0 z-20 bg-slate-100 backdrop-blur-xl">
          <div className="font-bold text-sm tracking-wide text-slate-900 opacity-80">
            {(() => {
              if (!activeSessionId || messages.filter(m => m.isSelf).length === 0) return '';
              const title = sessions.find(s => s.id === activeSessionId)?.title || '';
              return title === 'New Chat' ? '' : title;
            })()}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAgentEyeOpen(!isAgentEyeOpen)}
              className={`flex items-center gap-2 px-3 h-9 rounded-full text-xs font-bold tracking-wider uppercase transition-all border ${isAgentEyeOpen ? 'bg-amber-50 text-amber-600 border-amber-300' : 'bg-white text-slate-500 border-slate-200 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50'}`}
              title="Agent Eye"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden md:inline">Agent Eye</span>
            </button>
            <button
              onClick={() => { setIsKnowledgeBaseOpen(!isKnowledgeBaseOpen); }}
              className={`flex items-center gap-2 px-3 h-9 rounded-full text-xs font-bold tracking-wider uppercase transition-all border ${isKnowledgeBaseOpen ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50'}`}
              title="Agent Neural Configuration"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden md:inline">Brain & Settings</span>
            </button>
          </div>
        </div>

        {/* Dynamic Main Body (Chat vs Settings vs Observer) */}
        <div className="flex-1 flex relative overflow-hidden">

          {/* Chat / Settings Wrapper */}
          <div className={`flex-1 flex flex-col relative z-10 transition-all duration-500 overflow-x-hidden h-full ${isKnowledgeBaseOpen ? "overflow-y-auto" : "overflow-hidden"}`}>
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
                    <button
                      onClick={() => setActiveSettingsTab("brain")}
                      className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-2 ${activeSettingsTab === "brain" ? "border-blue-500 text-blue-600 " : "border-transparent text-slate-500 hover:text-slate-700"}`}
                    >
                      <Brain className="w-3.5 h-3.5" /> Org Brain
                    </button>
                    <button
                      onClick={() => { setActiveSettingsTab("pact"); fetchPACTEntries(); }}
                      className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-2 ${activeSettingsTab === "pact" ? "border-emerald-500 text-emerald-600 " : "border-transparent text-slate-500 hover:text-slate-700"}`}
                    >
                      <BookOpen className="w-3.5 h-3.5" /> P.A.C.T.
                      {pactEntries.length > 0 && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-black">{pactEntries.length}</span>}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-6 pb-56 max-w-5xl mx-auto w-full">
                  {activeSettingsTab === "identity" ? (
                    <div className="space-y-8 animate-in fade-in duration-300">

                      {/* Section Header */}
                      <div className="flex items-center gap-3 pb-2">
                        <div className="w-1 h-8 rounded-full bg-gradient-to-b from-indigo-500 to-fuchsia-500" />
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Agent Personality Configuration</h3>
                          <p className="text-xs text-slate-400 mt-0.5">Define how {agent.name.split(' ')[0]} communicates, what rules it follows, and how it operates autonomously.</p>
                        </div>
                      </div>

                      {/* Soul Section */}
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500/15 to-purple-500/15 flex items-center justify-center">
                              <User className="w-4.5 h-4.5 text-fuchsia-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900 text-sm">The Soul</h4>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Voice & Personality</p>
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-fuchsia-50 text-fuchsia-600 font-semibold uppercase tracking-wider border border-fuchsia-100">Step 1</span>
                        </div>
                        <div className="p-6 pt-4">
                          <p className="text-xs text-slate-500 mb-3 leading-relaxed">Describe the tone, personality, and communication style the agent should adopt in every interaction.</p>
                          <textarea
                            className="w-full h-40 p-4 bg-slate-50/80 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-300 leading-relaxed"
                            placeholder="e.g., You are extremely professional but maintain a warm, welcoming tone. Use clear, concise language. Be proactive in offering solutions."
                            value={agentConfig.soul}
                            onChange={e => setAgentConfig({ ...agentConfig, soul: e.target.value })}
                          />
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-slate-300 font-mono">{agentConfig.soul?.length || 0} characters</span>
                          </div>
                        </div>
                      </div>

                      {/* Brain Section */}
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/15 to-blue-500/15 flex items-center justify-center">
                              <Brain className="w-4.5 h-4.5 text-indigo-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900 text-sm">The Brain</h4>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Strict Wiring & Rules</p>
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 font-semibold uppercase tracking-wider border border-indigo-100">Step 2</span>
                        </div>
                        <div className="p-6 pt-4">
                          <p className="text-xs text-slate-500 mb-3 leading-relaxed">Define strict operational directives, hard constraints, and non-negotiable rules the agent must always follow.</p>
                          <textarea
                            className="w-full h-40 p-4 bg-slate-50/80 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-300 leading-relaxed"
                            placeholder="e.g., Never disclose PII. Do not share API keys. Deny invalid refund requests. Always verify user identity before sensitive actions."
                            value={agentConfig.brain}
                            onChange={e => setAgentConfig({ ...agentConfig, brain: e.target.value })}
                          />
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-slate-300 font-mono">{agentConfig.brain?.length || 0} characters</span>
                          </div>
                        </div>
                      </div>

                      {/* Heartbeat Section */}
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 flex items-center justify-center relative">
                              <Bot className="w-4.5 h-4.5 text-emerald-600" />
                              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900 text-sm">The Heartbeat</h4>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Autonomous Engine</p>
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-semibold uppercase tracking-wider border border-emerald-100">Step 3</span>
                        </div>
                        <div className="p-6 pt-4">
                          <p className="text-xs text-slate-500 mb-4 leading-relaxed">Control how frequently the agent performs automated background sweeps and proactive actions.</p>
                          <div className="flex items-center gap-4">
                            <select
                              className="flex-1 p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none text-sm font-medium text-slate-800 transition-all cursor-pointer appearance-none hover:border-emerald-300"
                              value={agentConfig.heartbeat}
                              onChange={e => setAgentConfig({ ...agentConfig, heartbeat: e.target.value })}
                            >
                              <option value="manual">Manual Execution Only</option>
                              <option value="30s">Autopilot: Every 30 Seconds</option>
                              <option value="1m">Autopilot: Every 1 Minute</option>
                            </select>
                            <div className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${agentConfig.heartbeat === 'manual' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                              <div className={`w-2 h-2 rounded-full ${agentConfig.heartbeat === 'manual' ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]'}`} />
                              {agentConfig.heartbeat === 'manual' ? 'Inactive' : 'Active'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-center pt-2 pb-8">
                        <Button onClick={() => setIsKnowledgeBaseOpen(false)} className="bg-slate-900 hover:bg-slate-800 text-white px-10 h-11 rounded-xl font-semibold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4" /> Save & Return to Chat
                        </Button>
                      </div>

                    </div>
                  ) : activeSettingsTab === "brain" ? (
                    /* ═══ ORG BRAIN TAB ═══ */
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div className="bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20 rounded-3xl p-6 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-extrabold text-blue-700 mb-2 flex items-center gap-2"><Brain className="w-5 h-5" /> SOL Theory — Organization Brain</h3>
                            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
                              Edit the organizational knowledge base that all agents and models reference. Changes are saved to Firestore and take effect immediately on all future conversations — no code changes needed.
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <div className="text-xs font-bold text-blue-500">{((orgBrain.length + solTheoryKnowledge.length) / 1024).toFixed(1)} KB</div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">Editable + Default</div>
                          </div>
                        </div>
                      </div>

                      {/* Editable Org Brain */}
                      <div className="border border-blue-200 rounded-2xl bg-white overflow-hidden">
                        <div className="p-4 border-b border-blue-100 flex items-center justify-between bg-blue-50/50">
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">✏️ Editable Knowledge (Saved to Cloud)</span>
                          <span className="text-[10px] text-slate-400 font-mono">{orgBrain.length.toLocaleString()} chars</span>
                        </div>
                        <div className="p-4">
                          <textarea
                            value={orgBrain}
                            onChange={(e) => setOrgBrain(e.target.value)}
                            placeholder="Add custom organizational knowledge here. This text will be injected into every agent's context alongside the default knowledge below.&#10;&#10;Example:&#10;- New product launches&#10;- Updated pricing&#10;- Team changes&#10;- Custom instructions for all agents"
                            className="w-full min-h-[300px] p-4 text-sm text-slate-700 font-sans leading-relaxed border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 resize-y bg-slate-50"
                          />
                          <div className="flex items-center justify-between mt-3">
                            <p className="text-[11px] text-slate-400">All agents (text + voice) across all model/agent modes will use this knowledge.</p>
                            <Button
                              onClick={saveOrgBrain}
                              disabled={orgBrainSaving}
                              className="bg-blue-600 hover:bg-blue-500 text-white px-6 h-9 rounded-lg font-semibold text-sm gap-2 transition-all"
                            >
                              {orgBrainSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                              {orgBrainSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Read-only Default */}
                      <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">🔒 Default Knowledge (Built-in)</span>
                          <span className="text-[10px] text-slate-400 font-mono">{solTheoryKnowledge.length.toLocaleString()} chars</span>
                        </div>
                        <div className="p-6 max-h-[300px] overflow-y-auto scrollbar-thin">
                          <pre className="text-sm text-slate-500 whitespace-pre-wrap font-sans leading-relaxed">{solTheoryKnowledge}</pre>
                        </div>
                      </div>
                    </div>
                  ) : activeSettingsTab === "pact" ? (
                    /* ═══ P.A.C.T. TAB ═══ */
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div className="bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-3xl p-6 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-extrabold text-emerald-700 mb-2 flex items-center gap-2"><BookOpen className="w-5 h-5" /> P.A.C.T. — Personalized AI Conversation Training</h3>
                            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
                              Facts {agent.name.split(' ')[0]} has learned about you from your conversations. These are automatically extracted and used to personalize future interactions.
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <div className="text-2xl font-black text-emerald-600">{pactEntries.length}</div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">{pactEntries.length === 1 ? 'Fact Learned' : 'Facts Learned'}</div>
                          </div>
                        </div>
                      </div>

                      {pactEntries.length === 0 ? (
                        <div className="h-48 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center bg-slate-50 gap-3 p-8">
                          <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-slate-300" />
                          </div>
                          <p className="text-sm text-slate-500 font-medium max-w-sm">No learned facts yet. As you chat with {agent.name.split(' ')[0]}, personal details you share will automatically appear here.</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Try telling {agent.name.split(' ')[0]} your name, age, or role</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {pactEntries.map((entry) => (
                            <div key={entry.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-all group">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-100">Q</span>
                                    <span className="text-sm font-semibold text-slate-800">{entry.question}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider border border-blue-100">A</span>
                                    <span className="text-sm text-slate-600">{entry.answer}</span>
                                  </div>
                                  <div className="flex items-center gap-3 pt-1">
                                    <span className="text-[10px] text-slate-400 font-medium">{entry.source === "voice" ? "🎤 Voice" : "⌨️ Text"}</span>
                                    <span className="text-[10px] text-slate-300">•</span>
                                    <span className="text-[10px] text-slate-400 font-medium">{new Date(entry.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={async () => {
                                  if (!user?.uid || !firestore) return;
                                  try {
                                    await deleteDoc(doc(firestore, "users", user.uid, "pact_entries", entry.id));
                                    setPactEntries(prev => prev.filter(e => e.id !== entry.id));
                                  } catch (err) { console.error("Failed to delete PACT entry", err); }
                                }}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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
                <button data-popup="cost" onClick={() => setShowCostBreakdown(!showCostBreakdown)} className="absolute top-6 right-6 z-50 px-4 h-9 rounded-full bg-white border border-slate-200 flex items-center gap-2.5 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
                  <Bot className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black tracking-wider text-slate-600 uppercase">
                    {totalGroqTokens.toLocaleString()} TOKENS (GROQ) <span className="opacity-30 mx-1">|</span> {totalElevenLabsChars.toLocaleString()} CHARS (VOICE) <span className="opacity-30 mx-1">|</span> ≈ ${((totalGroqTokens * 0.00000006) + (totalElevenLabsChars * 0.000167)).toFixed(4)}
                  </span>
                </button>

                {showCostBreakdown && (
                  <div data-popup="cost" className="absolute top-16 right-6 z-[200] w-[340px] bg-white border border-slate-200 rounded-[6px] shadow-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-200">
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

                <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 pb-8">
                  <div className={`mx-auto space-y-8 ${messages.length === 0 && !selectedExploreItem ? 'max-w-6xl' : 'max-w-3xl'}`}>
                    {messages.length === 0 && !selectedExploreItem ? (
                      <div className="flex flex-col items-center justify-center pt-8 md:pt-32 lg:pt-40 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        
                        <div className="w-full">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4 w-full">
                             <h2 className="text-[24px] md:text-[40px] font-light text-slate-700 tracking-tight">
                               Explore INSiGHT {exploreTab === "models" ? "Models" : "Agents"}
                             </h2>
                             <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200/60 self-start md:self-auto">
                               <button onClick={() => setExploreTab("models")} className={`px-5 py-2 text-[13px] font-semibold rounded-full shadow-sm transition-all ${exploreTab === 'models' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 border border-transparent'}`}>Models</button>
                               <button onClick={() => setExploreTab("agents")} className={`px-5 py-2 text-[13px] font-semibold rounded-full shadow-sm transition-all ${exploreTab === 'agents' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 border border-transparent'}`}>Agents</button>
                             </div>
                          </div>
                          
                                                                                                        {exploreTab === "models" ? (
                            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
                               <div onClick={() => setSelectedExploreItem("Featured")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-amber-50 group-hover:bg-amber-100 transition-colors flex items-center justify-center text-amber-500">
                                     <Sparkles className="w-4 h-4" />
                                   </div>
                                   <h3 className="font-semibold text-[12px] md:text-[14px] text-slate-800 whitespace-nowrap">Featured</h3>
                                 </div>
                                 <p className="text-[11px] md:text-[13px] text-slate-500 leading-snug font-normal hidden md:block">Test out our premium Groq models.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Conversational AI")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-blue-500">
                                     <MessageSquare className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[12px] md:text-[14px] text-slate-800 whitespace-nowrap">Conversational AI</h3>
                                 </div>
                                 <p className="text-[11px] md:text-[13px] text-slate-500 leading-snug font-normal hidden md:block">Converse with our voice agent, Jarvis.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Image Generation")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-purple-50 group-hover:bg-purple-100 transition-colors flex items-center justify-center text-purple-500">
                                     <ImageIcon className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[12px] md:text-[14px] text-slate-800 whitespace-nowrap">Image Generation</h3>
                                 </div>
                                 <p className="text-[11px] md:text-[13px] text-slate-500 leading-snug font-normal hidden md:block">Create and edit cutting-edge AI images - Coming Soon.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Video Generation")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-green-50 group-hover:bg-green-100 transition-colors flex items-center justify-center text-green-600">
                                     <Video className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[12px] md:text-[14px] text-slate-800 whitespace-nowrap">Video Generation</h3>
                                 </div>
                                 <p className="text-[11px] md:text-[13px] text-slate-500 leading-snug font-normal hidden md:block">Generate state of the art AI videos - Coming Soon.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Music Generation")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-rose-50 group-hover:bg-rose-100 transition-colors flex items-center justify-center text-rose-500">
                                     <Music className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[12px] md:text-[14px] text-slate-800 whitespace-nowrap">Music Generation</h3>
                                 </div>
                                 <p className="text-[11px] md:text-[13px] text-slate-500 leading-snug font-normal hidden md:block">Explore our text to speech and music models - Coming Soon.</p>
                               </div>
                               
                               <div onClick={() => setSelectedExploreItem("Code Generation")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-orange-50 group-hover:bg-orange-100 transition-colors flex items-center justify-center text-orange-500">
                                     <Code className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[12px] md:text-[14px] text-slate-800 whitespace-nowrap">Code Generation</h3>
                                 </div>
                                 <p className="text-[11px] md:text-[13px] text-slate-500 leading-snug font-normal hidden md:block">Tackle your logic-related endeavors.</p>
                               </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
                               <div onClick={() => setSelectedExploreItem("Email Agents")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-8 h-8 rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-blue-500">
                                     <Mail className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[14px] text-slate-800 whitespace-nowrap">Email Agents</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-snug font-normal">Set up scheduled email campaigns!</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Social Media Agents")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-8 h-8 rounded-lg bg-pink-50 group-hover:bg-pink-100 transition-colors flex items-center justify-center text-pink-500">
                                     <Users className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[14px] text-slate-800 whitespace-nowrap">Social Media Agents</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-snug font-normal">Set up scheduled social media posts.</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Message Agents")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-8 h-8 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors flex items-center justify-center text-emerald-500">
                                     <MessageSquare className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[14px] text-slate-800 whitespace-nowrap">Message Agents</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-snug font-normal">Create messaging app integrations with AI.</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Advertising Agents")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-8 h-8 rounded-lg bg-amber-50 group-hover:bg-amber-100 transition-colors flex items-center justify-center text-amber-500">
                                     <Presentation className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[14px] text-slate-800 whitespace-nowrap">Advertising Agents</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-snug font-normal">Build cron jobs for advertising campagins - Coming Soon.</p>
                               </div>

                               <div onClick={() => setIsAgentRequestModalOpen(true)} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-8 h-8 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 transition-colors flex items-center justify-center text-indigo-500">
                                     <Plus className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[14px] text-slate-800 whitespace-nowrap">Submit an Agent Request</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-snug font-normal">Submit a new agent request to the team.</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Build your own Agent")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-slate-200 transition-colors flex items-center justify-center text-slate-600">
                                     <Settings className="w-5 h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[14px] text-slate-800 whitespace-nowrap">Build your own Agent</h3>
                                 </div>
                                 <p className="text-[13px] text-slate-500 leading-snug font-normal">Configure a custom agent with our drag & drop system - Coming Soon.</p>
                               </div>
                            </div>
                          )}
                        </div>

                        {/* Quick Chat + Voice */}
                        <div className="w-full max-w-2xl mx-auto mt-6 md:mt-12">
                          <p className="text-center text-xs md:text-sm text-slate-400 mb-3">Ask Jarvis anything — he's a jack of all trades.</p>
                          <div className="flex items-center gap-2">
                            <form onSubmit={(e) => {
                              e.preventDefault();
                              if (!inputValue.trim()) return;
                              setSelectedExploreItem('Conversational AI');
                              // handleSendMessage will pick up inputValue and auto-create a session
                              setTimeout(() => handleSendMessage(), 50);
                            }} className="flex-1 flex items-center gap-2 bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3 hover:shadow-md transition-shadow">
                              <Bot className="w-5 h-5 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="What's on your mind?"
                                className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
                              />
                              <button type="submit" disabled={!inputValue.trim()} className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 text-white disabled:text-slate-400 flex items-center justify-center transition-colors shrink-0">
                                <Send className="w-4 h-4" />
                              </button>
                            </form>
                            <button
                              onClick={() => {
                                setSelectedExploreItem('Conversational AI');
                                openVoiceSession();
                              }}
                              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/20 shrink-0 cursor-pointer"
                              title="Talk to Jarvis"
                            >
                              <div className="relative flex items-center justify-center w-5 h-5">
                                <AudioLines className="w-5 h-5" />
                                <Sparkles className="w-2.5 h-2.5 absolute -top-1 -right-1 text-indigo-200" />
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                                                                  <>
                         <div className="flex justify-center mb-10 pt-10">
                          <div className="text-3xl font-black opacity-10 tracking-[0.3em] uppercase text-center max-w-full truncate px-4">{selectedExploreItem ? `${exploreItemsMeta[selectedExploreItem]?.name || ''} - ${selectedExploreItem}` : agent.name}</div>
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
                            {msg.isSelf && !msg.imageUrl ? msg.text : (!msg.imageUrl && <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => (<a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline underline-offset-2 break-all">{children}</a>) }}>{msg.text}</ReactMarkdown>)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-slate-300  bg-slate-200/50 `}><Bot className={`w-5 h-5 ${agent.accent}`} /></div>
                        <div className={`inline-block p-4 rounded-2xl rounded-tl-sm border backdrop-blur-md ${agent.chatBg} flex items-center gap-3`}>
                          <Loader2 className={`w-4 h-4 animate-spin ${agent.accent}`} />
                          <span key={loadingPhraseIndex} className="animate-in fade-in duration-500 text-sm text-slate-600">{LOADING_PHRASES[loadingPhraseIndex % LOADING_PHRASES.length]}</span>
                        </div>
                      </div>
                    )}
                      </>
                    )}
                    <div ref={bottomRef} className="h-4" />
                  </div>
                </div>

                {/* Chat Input Container - hidden on chooser screen */}
                <div className={`shrink-0 px-4 pb-6 pt-2 z-20 ${messages.length === 0 && !selectedExploreItem && !activeSessionId ? "hidden" : ""}`}>
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
                        onClick={openVoiceSession}
                        className="absolute right-14 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-colors"
                        title="Start Voice Session"
                      >
                        <div className="relative flex items-center justify-center w-5 h-5">
                          <AudioLines className="w-5 h-5 text-indigo-500" />
                          <Sparkles className="w-2.5 h-2.5 absolute -top-1 -right-1 text-indigo-400" />
                        </div>
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




        </div>
      </div>

      {/* System Instructions Popup */}
      {isSystemInstructionsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsSystemInstructionsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">System instructions</h3>
                  <p className="text-xs text-slate-400 mt-1">Provide tone, style, or context instructions for this session. These apply to every message in the current chat.</p>
                </div>
                <button onClick={() => setIsSystemInstructionsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <textarea
                autoFocus
                className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-300 leading-relaxed"
                placeholder="e.g., Respond in a formal business tone. Keep answers concise. Focus on actionable advice. Always include specific examples."
                value={sessionInstructions}
                onChange={e => setSessionInstructions(e.target.value)}
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-slate-300 font-mono">{sessionInstructions.length} characters</span>
                <div className="flex items-center gap-2">
                  {sessionInstructions && (
                    <button onClick={() => setSessionInstructions("")} className="px-3 py-1.5 text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors font-medium">
                      Clear
                    </button>
                  )}
                  <button onClick={() => setIsSystemInstructionsOpen(false)} className="px-4 py-1.5 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-semibold">
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <VoiceAgentModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        agentName={selectedExploreItem ? (exploreItemsMeta[selectedExploreItem]?.name || agent.name) : agent.name}
        agentId={params.agentId as string}
        orgPrefix="soltheory"
        voiceId={selectedExploreItem ? exploreItemsMeta[selectedExploreItem]?.voiceId : undefined}
        systemInstructions={sessionInstructions}
        knowledgeBaseText={orgBrain}
        pactText={pactText}
        existingMessages={messages.map(m => ({ role: m.isSelf ? "user" : "assistant", content: m.text }))}
        onTranscriptUpdate={(userText, aiReply) => {
          // Lazily create a session if none exists (voice started from blank screen)
          let currentSessionId = activeSessionId;
          if (!currentSessionId) {
            const newSession: Session = {
              id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              title: "New Chat",
              updatedAt: Date.now(),
              messages: []
            };
            currentSessionId = newSession.id;
            setSessions(prev => [newSession, ...prev]);
            setActiveSessionId(newSession.id);
          }

          // Trigger AI Title generator if needed
          const existingSession = sessions.find(s => s.id === currentSessionId);
          if (!existingSession || existingSession.title === "New Chat" || !existingSession.title) {
            fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [
                  { role: "system", content: "You are a title generator. Given a user message and AI response, output ONLY a short comma-separated list of 3-5 key topic words that summarize the conversation. No full sentences, no quotes, no explanation. Example output: US History, D-Day, Normandy Beaches" },
                  { role: "user", content: `User said: ${userText}\nAI replied: ${aiReply.substring(0, 200)}` }
                ],
                agentId: "soltheory_jarvis",
                soul: "",
                brain: "",
              }),
            }).then(r => r.json()).then(titleData => {
              if (titleData.response) {
                const aiTitle = titleData.response.replace(/["']/g, '').trim().substring(0, 60);
                setSessions(prev => prev.map(s =>
                  s.id === currentSessionId ? { ...s, title: aiTitle } : s
                ));
              }
            }).catch(() => {
              const fallback = userText.split(' ').slice(0, 6).join(' ');
              setSessions(prev => prev.map(s =>
                s.id === currentSessionId ? { ...s, title: fallback } : s
              ));
            });
          }

          // Save voice messages to the active chat session (filter out welcome greeting)
          setMessages(prev => {
            const real = prev.filter(m => m.isSelf || prev.some(um => um.isSelf));
            return [
              ...real,
              { id: uid(), text: userText, isSelf: true },
              { id: uid(), text: aiReply, isSelf: false },
            ];
          });

          // Trigger background PACT extraction securely on the server
          if (user?.uid && userText.trim().length > 15) {
            fetch("/api/pact/extract", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userMessage: userText,
                aiResponse: aiReply,
                userName: user?.displayName || undefined,
                uid: user.uid,
                orgId: "soltheory"
              })
            }).then(res => res.json()).then(async (extractData) => {
              if (extractData.facts && extractData.facts.length > 0 && firestore && user?.uid) {
                const { doc, getDoc, updateDoc, arrayUnion } = await import("firebase/firestore");
                const userDocRef = doc(firestore, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                const existingField = userDocSnap.data()?.pact_entries_soltheory || [];
                const existingQs = new Set(existingField.map((f: any) => f.question?.toLowerCase()?.trim()));

                const newFacts = extractData.facts.filter((f: any) => !existingQs.has(f.question?.toLowerCase()?.trim())).map((f: any) => ({
                  question: f.question,
                  answer: f.answer,
                  source: "server_background",
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                }));

                if (newFacts.length > 0) {
                  await updateDoc(userDocRef, {
                    pact_entries_soltheory: arrayUnion(...newFacts)
                  });
                  setTimeout(fetchPACTEntries, 1000);
                }
              }
            }).catch(console.error);
          }
        }}
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
              soul: `${agentConfig.soul}\n\n[USER CONTEXT]\nAct on behalf of this user. The user's email address is: ${user?.email || 'Unknown'}. Do not ask them for their email. IMPORTANT: You are in a VOICE CONVERSATION. Keep responses to 1-3 sentences. Be direct. Never use markdown, bullet points, or code blocks.`,
              brain: agentConfig.brain,
              uid: user?.uid,
              refreshToken: rToken,
              contacts: agentContacts,
              knowledgeBaseText: kbText,
              pactText,
              userName: user?.displayName || undefined
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


      {isAgentRequestModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-500" />
                Submit an Agent Request
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setIsAgentRequestModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Name *</label>
                <Input placeholder="John Doe" value={agentRequestForm.name} onChange={e => setAgentRequestForm({...agentRequestForm, name: e.target.value})} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Email *</label>
                  <Input placeholder="john@example.com" type="email" value={agentRequestForm.email} onChange={e => setAgentRequestForm({...agentRequestForm, email: e.target.value})} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Phone</label>
                  <Input placeholder="(555) 000-0000" type="tel" value={agentRequestForm.phone} onChange={e => setAgentRequestForm({...agentRequestForm, phone: e.target.value})} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Message *</label>
                <textarea 
                  placeholder="Describe the agent you'd like us to build..." 
                  value={agentRequestForm.message} 
                  onChange={e => setAgentRequestForm({...agentRequestForm, message: e.target.value})} 
                  className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-slate-900 h-32" 
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsAgentRequestModalOpen(false)}>Cancel</Button>
              <Button onClick={submitAgentRequest} disabled={isSubmittingAgentRequest || !agentRequestForm.name || !agentRequestForm.email || !agentRequestForm.message} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]">
                {isSubmittingAgentRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Request"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Eye rendered outside flex container for z-index */}
    </div>

      {/* Agent Eye Floating Popup */}
      {(isAgentEyeOpen || isAgentEyeMinimized) && (
        <div
          style={isAgentEyeMinimized ? {
            position: 'fixed' as const,
            bottom: 16,
            right: agentEyeMinRight,
            width: 260,
            height: 44,
            zIndex: 9999,
          } : {
            position: 'fixed' as const,
            left: agentEyePos.x,
            top: agentEyePos.y,
            width: agentEyeSize.w,
            height: agentEyeSize.h,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column' as const,
          }}
          className="rounded-2xl shadow-2xl border border-amber-200/60 bg-white/95 backdrop-blur-xl overflow-hidden"
        >
          {/* Title Bar — draggable, double-click to expand */}
          <div
            onPointerDown={isAgentEyeMinimized ? (e: React.PointerEvent) => {
              e.preventDefault();
              agentEyeMinDragRef.current = { startX: e.clientX, origRight: agentEyeMinRight };
              const el = e.currentTarget;
              el.setPointerCapture(e.pointerId);
            } : onAgentEyeDragStart}
            onPointerMove={isAgentEyeMinimized ? (e: React.PointerEvent) => {
              if (!agentEyeMinDragRef.current) return;
              const delta = e.clientX - agentEyeMinDragRef.current.startX;
              const newRight = Math.max(0, Math.min(window.innerWidth - 260, agentEyeMinDragRef.current.origRight - delta));
              setAgentEyeMinRight(newRight);
            } : onAgentEyeDragMove}
            onPointerUp={isAgentEyeMinimized ? (e: React.PointerEvent) => {
              agentEyeMinDragRef.current = null;
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } : onAgentEyeDragEnd}
            onDoubleClick={isAgentEyeMinimized ? () => {
              setIsAgentEyeMinimized(false);
              setIsAgentEyeOpen(true);
            } : onAgentEyeDoubleClick}
            className="flex items-center justify-between h-11 px-4 shrink-0 select-none cursor-grab active:cursor-grabbing"
            style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)' }}
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-white/90" />
              <span className="text-xs font-bold uppercase tracking-widest text-white/95">Agent Eye</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Minimize / Maximize button */}
              <button
                onClick={() => {
                  if (isAgentEyeMinimized) {
                    setIsAgentEyeMinimized(false);
                    setIsAgentEyeOpen(true);
                  } else {
                    setIsAgentEyeMinimized(true);
                    setIsAgentEyeOpen(false);
                  }
                }}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                title={isAgentEyeMinimized ? 'Maximize' : 'Minimize'}
              >
                {isAgentEyeMinimized ? (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 14h6m0 0v6m0-6L3 21M20 10h-6m0 0V4m0 6l7-7" /></svg>
                ) : (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14H5" /></svg>
                )}
              </button>
              {/* Close button */}
              <button
                onClick={() => { setIsAgentEyeOpen(false); setIsAgentEyeMinimized(false); }}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          {!isAgentEyeMinimized && (<>
          {/* Observer Dropdown Selector */}
          <div className="relative shrink-0 border-b border-slate-200 bg-slate-50/80">
            <button
              onClick={() => setAgentEyeDropdownOpen(!agentEyeDropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {agentEyeTab === 'gmail' && <Mail className="w-4 h-4 text-red-500" />}
                {agentEyeTab === 'outlook' && <Mail className="w-4 h-4 text-blue-500" />}
                {agentEyeTab === 'sms' && <Smartphone className="w-4 h-4 text-purple-500" />}
                {agentEyeTab === 'jarvis-view' && <Monitor className="w-4 h-4 text-amber-500" />}
                <span>
                  {agentEyeTab === 'gmail' && 'Gmail'}
                  {agentEyeTab === 'outlook' && 'Outlook'}
                  {agentEyeTab === 'sms' && 'SMS'}
                  {agentEyeTab === 'jarvis-view' && 'Jarvis View'}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${agentEyeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {agentEyeDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-b-xl shadow-xl overflow-hidden">
                {[
                  { id: 'gmail' as const, label: 'Gmail', icon: <Mail className="w-4 h-4 text-red-500" />, ready: true },
                  { id: 'outlook' as const, label: 'Outlook', icon: <Mail className="w-4 h-4 text-blue-500" />, ready: false },
                  { id: 'sms' as const, label: 'SMS', icon: <Smartphone className="w-4 h-4 text-purple-500" />, ready: true },
                  { id: 'jarvis-view' as const, label: 'Jarvis View', icon: <Monitor className="w-4 h-4 text-amber-500" />, ready: true },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setAgentEyeTab(item.id); setAgentEyeDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                      agentEyeTab === item.id ? 'bg-amber-50 font-semibold text-amber-700' : 'text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    {!item.ready && <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Soon</span>}
                    {agentEyeTab === item.id && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Observer Body */}
          <div className="flex-1 overflow-auto flex flex-col">

            {/* ──── Gmail Observer ──── */}
            {agentEyeTab === 'gmail' && (
              <div className="flex-1 flex flex-col h-full">
                {!isGmailConnected ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                      <Mail className="w-7 h-7 text-red-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700">Gmail not connected</p>
                      <p className="text-xs text-slate-400 mt-1">Connect Gmail in Brain &amp; Settings → Data</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col h-full">
                    {/* Gmail-style Toolbar */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-white shrink-0">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={toggleSelectAll}
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
                          title="Select all"
                        >
                          <CheckSquare className={`w-4 h-4 ${selectedEmails.size > 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                        </button>
                        <button
                          onClick={fetchPulse}
                          disabled={isPolling}
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
                          title="Refresh"
                        >
                          <RefreshCw className={`w-4 h-4 text-slate-400 ${isPolling ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        {selectedEmails.size > 0 && (
                          <button
                            onClick={handleProcessInbox}
                            disabled={isBatchSyncing}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            {isBatchSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Process {selectedEmails.size}
                          </button>
                        )}
                        <span className="text-[11px] text-slate-400 tabular-nums ml-1">
                          {incomingEmails.length} email{incomingEmails.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Email List — Gmail-style */}
                    <div className="flex-1 overflow-y-auto">
                      {incomingEmails.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                          <Inbox className="w-12 h-12 text-slate-200 mb-3" />
                          <p className="text-sm font-medium text-slate-400">Inbox is empty</p>
                          <p className="text-xs text-slate-300 mt-1">New emails will appear here</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {incomingEmails.map(email => {
                            const isSelected = selectedEmails.has(email.id);
                            const senderName = email.from.split('<')[0].trim().replace(/"/g, '') || email.from;
                            const senderEmail = email.from.split('<').pop()?.replace('>', '') || '';
                            const isIgnored = agentContacts.find(c => c.ignore && c.email.toLowerCase() === senderEmail.toLowerCase());
                            if (isIgnored) return null;
                            const dateStr = (() => {
                              try {
                                const d = email.internalDate ? new Date(Number(email.internalDate)) : new Date(email.date);
                                const now = new Date();
                                if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                                return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                              } catch { return ''; }
                            })();
                            return (
                              <div
                                key={email.id}
                                onClick={() => toggleSelection({ stopPropagation: () => {} } as any, email.id)}
                                className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors group ${
                                  isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                                }`}
                              >
                                {/* Checkbox */}
                                <div className="pt-0.5 shrink-0">
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-slate-400'
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[13px] font-semibold text-slate-800 truncate">{senderName}</span>
                                    <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">{dateStr}</span>
                                  </div>
                                  <p className="text-[12.5px] font-medium text-slate-700 truncate mt-0.5">{email.subject || '(no subject)'}</p>
                                  <p className="text-[11.5px] text-slate-400 truncate mt-0.5 leading-snug">{email.snippet}</p>
                                </div>
                                {/* Delete */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteEmail(email.id); }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded transition-all shrink-0 mt-0.5"
                                  title="Delete"
                                >
                                  {isDeletingEmail === email.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ──── Coming Soon Screens ──── */}
            {agentEyeTab === 'outlook' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-slate-700">Outlook</p>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-[200px]">Outlook inbox observer is coming soon</p>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-500 text-[10px] font-bold uppercase tracking-widest">Coming Soon</div>
              </div>
            )}



            {agentEyeTab === 'sms' && (
              <div className="flex-1 flex flex-col h-full">
                {!smsTwilioNumber ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center">
                      <Smartphone className="w-7 h-7 text-purple-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700">SMS not connected</p>
                      <p className="text-xs text-slate-400 mt-1">Set up your Twilio number in Messages</p>
                    </div>
                  </div>
                ) : !smsActiveContact ? (
                  /* ── Conversation List ── */
                  <div className="flex-1 flex flex-col h-full">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-white shrink-0">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-purple-500" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Messages</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={fetchSmsConversations} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 transition-colors">
                          <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${smsLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <span className="text-[10px] text-slate-400 tabular-nums">{smsConversations.length}</span>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {smsConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                          <MessageCircle className="w-10 h-10 text-slate-200 mb-2" />
                          <p className="text-sm text-slate-400">No conversations yet</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {smsConversations.map(conv => {
                            const digits = conv.contact.replace(/\D/g, '');
                            const display = digits.length === 11 && digits.startsWith('1')
                              ? `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`
                              : digits.length === 10 ? `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}` : conv.contact;
                            const timeStr = (() => { try { const d = new Date(conv.lastTime); const now = new Date(); return d.toDateString() === now.toDateString() ? d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : d.toLocaleDateString([], {month:'short',day:'numeric'}); } catch { return ''; } })();
                            return (
                              <button key={conv.contact} onClick={() => setSmsActiveContact(conv.contact)}
                                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left">
                                <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="text-[11px] font-bold text-purple-600">{conv.contact.slice(-2)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[13px] font-semibold text-slate-800 truncate">{display}</span>
                                    <span className="text-[10px] text-slate-400 shrink-0">{timeStr}</span>
                                  </div>
                                  <p className="text-[11.5px] text-slate-400 truncate mt-0.5">
                                    {conv.direction === 'outbound' ? 'You: ' : ''}{conv.lastMessage || 'No messages'}
                                  </p>
                                </div>
                                {conv.unreadCount > 0 && (
                                  <span className="bg-purple-500 text-white text-[9px] font-bold rounded-full w-4.5 h-4.5 px-1.5 py-0.5 flex items-center justify-center shrink-0 mt-1">{conv.unreadCount}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ── Thread View ── */
                  <div className="flex-1 flex flex-col h-full">
                    {/* Thread Header */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-white shrink-0">
                      <button onClick={() => { setSmsActiveContact(null); setSmsMessages([]); }} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-4 h-4 text-slate-400" />
                      </button>
                      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-purple-600">{smsActiveContact.slice(-2)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-slate-800 truncate">
                          {(() => { const d = smsActiveContact.replace(/\D/g,''); return d.length===11&&d.startsWith('1') ? `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}` : d.length===10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : smsActiveContact; })()}
                        </p>
                        <p className="text-[9px] text-slate-400">SMS</p>
                      </div>
                      <button onClick={() => fetchSmsThread(smsActiveContact)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100">
                        <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5" style={{ backgroundColor: '#f8f7f4' }}>
                      {smsMessages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-400 text-xs">No messages</div>
                      ) : smsMessages.map((msg, i) => {
                        const isMe = msg.direction === 'outbound';
                        return (
                          <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-[12px] leading-relaxed shadow-sm ${
                              isMe ? 'bg-purple-500 text-white rounded-br-md' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
                            }`}>
                              {msg.body || '📎 Media'}
                              <div className={`text-[8px] mt-0.5 ${isMe ? 'text-purple-200 text-right' : 'text-slate-400'}`}>
                                {(() => { try { return new Date(msg.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); } catch { return ''; } })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={smsEndRef} className="h-1" />
                    </div>
                    {/* Send Bar */}
                    <div className="border-t border-slate-200 p-2 bg-white shrink-0">
                      <form onSubmit={(e) => { e.preventDefault(); sendSms(); }} className="flex gap-1.5">
                        <input
                          value={smsNewMessage}
                          onChange={e => setSmsNewMessage(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1 h-9 px-3 text-[12px] bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-1 focus:ring-purple-300 text-slate-800 placeholder:text-slate-400"
                          disabled={smsSending}
                        />
                        <button type="submit" disabled={!smsNewMessage.trim() || smsSending}
                          className="w-9 h-9 flex items-center justify-center rounded-full bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-40 transition-colors">
                          {smsSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {agentEyeTab === 'jarvis-view' && (
              <JarvisViewBrowser
                navigationQueue={jarvisNavQueue}
                onNavigationComplete={() => {}}
              />
            )}

          </div>

          {/* Resize Handle — bottom-right corner */}
          <div
            onPointerDown={onAgentEyeEdgeResizeStart('br')}
            onPointerMove={onAgentEyeResizeMove}
            onPointerUp={onAgentEyeResizeEnd}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-10"
            style={{ touchAction: 'none' }}
          >
            <svg viewBox="0 0 20 20" className="w-full h-full text-amber-400/60">
              <line x1="14" y1="20" x2="20" y2="14" stroke="currentColor" strokeWidth="1.5" />
              <line x1="10" y1="20" x2="20" y2="10" stroke="currentColor" strokeWidth="1.5" />
              <line x1="6" y1="20" x2="20" y2="6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          {/* Resize Handle — bottom-left corner */}
          <div
            onPointerDown={onAgentEyeEdgeResizeStart('bl')}
            onPointerMove={onAgentEyeResizeMove}
            onPointerUp={onAgentEyeResizeEnd}
            className="absolute bottom-0 left-0 w-5 h-5 cursor-nesw-resize z-10"
            style={{ touchAction: 'none', transform: 'scaleX(-1)' }}
          >
            <svg viewBox="0 0 20 20" className="w-full h-full text-amber-400/60">
              <line x1="14" y1="20" x2="20" y2="14" stroke="currentColor" strokeWidth="1.5" />
              <line x1="10" y1="20" x2="20" y2="10" stroke="currentColor" strokeWidth="1.5" />
              <line x1="6" y1="20" x2="20" y2="6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          {/* Edge resize — right */}
          <div onPointerDown={onAgentEyeEdgeResizeStart('r')} onPointerMove={onAgentEyeResizeMove} onPointerUp={onAgentEyeResizeEnd}
            className="absolute top-11 right-0 w-1.5 bottom-5 cursor-ew-resize z-10 hover:bg-amber-300/20 transition-colors" style={{ touchAction: 'none' }} />
          {/* Edge resize — left */}
          <div onPointerDown={onAgentEyeEdgeResizeStart('l')} onPointerMove={onAgentEyeResizeMove} onPointerUp={onAgentEyeResizeEnd}
            className="absolute top-11 left-0 w-1.5 bottom-5 cursor-ew-resize z-10 hover:bg-amber-300/20 transition-colors" style={{ touchAction: 'none' }} />
          {/* Edge resize — bottom */}
          <div onPointerDown={onAgentEyeEdgeResizeStart('b')} onPointerMove={onAgentEyeResizeMove} onPointerUp={onAgentEyeResizeEnd}
            className="absolute bottom-0 left-5 right-5 h-1.5 cursor-ns-resize z-10 hover:bg-amber-300/20 transition-colors" style={{ touchAction: 'none' }} />
          {/* Edge resize — top */}
          <div onPointerDown={onAgentEyeEdgeResizeStart('t')} onPointerMove={onAgentEyeResizeMove} onPointerUp={onAgentEyeResizeEnd}
            className="absolute top-0 left-5 right-5 h-1.5 cursor-ns-resize z-10 hover:bg-amber-300/20 transition-colors" style={{ touchAction: 'none' }} />
          {/* Resize Handle — top-right corner */}
          <div onPointerDown={onAgentEyeEdgeResizeStart('tr')} onPointerMove={onAgentEyeResizeMove} onPointerUp={onAgentEyeResizeEnd}
            className="absolute top-0 right-0 w-5 h-5 cursor-nesw-resize z-10" style={{ touchAction: 'none' }} />
          {/* Resize Handle — top-left corner */}
          <div onPointerDown={onAgentEyeEdgeResizeStart('tl')} onPointerMove={onAgentEyeResizeMove} onPointerUp={onAgentEyeResizeEnd}
            className="absolute top-0 left-0 w-5 h-5 cursor-nwse-resize z-10" style={{ touchAction: 'none' }} />
      </>)}
        </div>
      )}
    </>
  );
}
