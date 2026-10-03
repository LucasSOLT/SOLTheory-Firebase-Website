"use client";

import { useParams } from 'next/navigation';
import { useOrgId } from "@/contexts/OrgContext";
import { getOrgConfig } from "@/lib/org-config";
import { useState, useRef, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VoiceAgentModal } from "@/components/communications/VoiceAgentModal";
import { Input } from "@/components/ui/input";
import { Bot, User, Plus, Search, LogOut, MessageSquare, Send, Menu, Loader2, Mail, Brain, Trash2, X, Sparkles, ArrowLeft, RefreshCw, CheckCircle2, Settings, CheckSquare, Sun, Moon, Maximize2, Minimize2, Users, FileText, Presentation, Table, Paperclip, Cloud, Mic, BookOpen, Image as ImageIcon, Video, Music, Code , AudioLines, SquarePen, Edit, ChevronDown, MessageCircle, Inbox, Star, Archive, Clock, Filter, SlidersHorizontal, MailOpen, Reply, Zap, Tag, Hash, Globe, Palette, Telescope, ArrowUp, Square, CornerDownLeft, Copy, Pin, Check, Volume2, VolumeX, ShieldCheck} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import AgentLibrary from "@/components/portal/AgentLibrary";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, getDocs, query, orderBy, where, deleteDoc, writeBatch, limit as firestoreLimit, arrayUnion } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { solTheoryKnowledge } from "@/lib/soltheory-knowledge";
import { logActivity } from '@/lib/activity-logger';
import { useTranslation } from "@/lib/i18n";
import { retrieveRelevantSnippets } from "@/lib/kb-retriever";
import { getAuthHeaders } from "@/lib/api-auth-client";
import { useCRMStore } from "@/stores/crm-store";
import { useChatStore } from "@/stores/chat-store";
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { isDemoOrg, useDemoGating } from '@/hooks/useDemoGating';
import ThinkingDisplay from './_components/ThinkingDisplay';
import ScopeToggle from '@/components/chat/ScopeToggle';
import type { AgentEvent } from '@/lib/agent-events';
import { createStreamThrottle } from './utils/stream-throttle';

let _msgCounter = 0;
const uid = () => `msg-${Date.now()}-${++_msgCounter}-${Math.random().toString(36).substring(2, 7)}`;

type EmailPreviewData = { to: string; subject: string; body: string; intent: 'send' | 'draft' | 'ambiguous' };
type Message = { id: string; text: string; isSelf: boolean; hiddenContext?: string; imageUrl?: string; citations?: { text: string; source: string; type: string }[]; agentEvents?: AgentEvent[]; sendTimestamp?: number; isPendingImage?: boolean; emailPreview?: EmailPreviewData; };
type Session = { id: string; title: string; updatedAt: number; scope?: 'user' | 'org'; messages: Message[]; };
type EmailMeta = { id: string; subject: string; snippet: string; from: string; to?: string; cc?: string; replyTo?: string; date: string; internalDate?: number; labelIds?: string[]; body?: string; attachments?: { filename: string; mimeType: string; size: number; attachmentId?: string }[]; };
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
  const orgId = useOrgId();
  const staticKnowledge = getOrgConfig(orgId)?.knowledgeModule ? solTheoryKnowledge : '';
  const searchParams = useSearchParams();
  const params = use(props.params);
  const { user } = useUser();
  const firestore = useFirestore();
  const { t } = useTranslation();
  const router = useRouter();
  const [isAgentSwitcherOpen, setIsAgentSwitcherOpen] = useState(false);
  const [showAgentLibrary, setShowAgentLibrary] = useState(false);
  // ── Chat state from Zustand store (Supabase-backed) ──
  const chatStore = useChatStore();
  const { scope: chatScope } = chatStore;
  const sessions = chatStore.sessions;
  const activeSessionId = chatStore.activeSessionId;
  const messages = chatStore.messages;
  const setMessages = chatStore.setMessages;
  const sessionsLoaded = chatStore.sessionsLoaded;
  const sessionStatuses = chatStore.sessionStatuses;
  // Compatibility wrappers — delegate to store so existing setSessions/setActiveSessionId calls work
  const setSessions: React.Dispatch<React.SetStateAction<Session[]>> = (action) => {
    if (typeof action === 'function') {
      const updated = action(chatStore.sessions);
      useChatStore.setState({ sessions: updated });
    } else {
      useChatStore.setState({ sessions: action });
    }
  };
  const setActiveSessionId = (id: string | null) => chatStore.setActiveSession(id);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<{ file: File; preview: string }[]>([]);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [pendingCitations, setPendingCitations] = useState<{ text: string; source: string; type: string }[]>([]);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const speechRecRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const plusMenuFileInputRef = useRef<HTMLInputElement>(null);
  const VOICE_CHAT_ENABLED = false; // Disabled: voice-to-voice JARVIS is too slow/clunky for now

  // ── Voice-over (TTS on JARVIS responses) ──
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(false);
  const voiceoverAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Copy & Pin for bot messages ──
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set());

  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleTogglePin = (msgId: string) => {
    setPinnedMessages(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const playTTS = async (text: string) => {
    try {
      // Stop any currently playing TTS audio
      if (voiceoverAudioRef.current) {
        voiceoverAudioRef.current.pause();
        voiceoverAudioRef.current = null;
      }
      // Cap at 3000 chars to avoid ElevenLabs limits and cost
      const cleanText = text.replace(/[#*_`~>\[\]()!|]/g, '').substring(0, 3000);
      if (!cleanText.trim()) return;
      const res = await fetch(`/api/tts?text=${encodeURIComponent(cleanText)}&uid=${user?.uid || 'anonymous'}&org=${orgId}`, {
        headers: await getAuthHeaders(),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      voiceoverAudioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        voiceoverAudioRef.current = null;
      };
      audio.play();
    } catch (err) {
      console.error('[TTS] Playback error:', err);
    }
  };

  // Close plus menu on outside click or Escape
  useEffect(() => {
    if (!isPlusMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-plus-menu]')) setIsPlusMenuOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPlusMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isPlusMenuOpen]);

  // Auto-resize textarea as user types (1-8 lines, then scrollable)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto'; // Reset to recalculate scrollHeight
    const lineHeight = 24; // ~leading-relaxed at text-base
    const maxLines = 8;
    const maxHeight = lineHeight * maxLines; // 192px
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [inputValue]);

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
  useEffect(() => {
    const check = () => setIsDarkMode(localStorage.getItem('insight_theme') === 'dark');
    check();
    const onStorage = (e: StorageEvent) => { if (e.key === 'insight_theme') setIsDarkMode(e.newValue === 'dark'); };
    window.addEventListener('storage', onStorage);
    const interval = setInterval(check, 500);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(interval); };
  }, []);
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

  const [lastDraftedEmail, setLastDraftedEmail] = useState<{ to: string; subject: string; body: string; timestamp: number } | null>(null);

  // Chat sidebar resizable state
  const [chatSidebarWidth, setChatSidebarWidth] = useState(300);
  const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const sidebarResizeRef = useRef<{ startX: number; startW: number } | null>(null);

  const [isPolling, setIsPolling] = useState(false);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
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

  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [starredEmails, setStarredEmails] = useState<Set<string>>(new Set());
  const [readEmails, setReadEmails] = useState<Set<string>>(new Set());
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  // Tag system — tags are assigned to sender email addresses
  const [emailTags, setEmailTags] = useState<{ name: string; color: string }[]>([
    { name: 'Client', color: '#3b82f6' },
    { name: 'Vendor', color: '#8b5cf6' },
    { name: 'Internal', color: '#10b981' },
    { name: 'Lead', color: '#f59e0b' },
  ]);
  const [senderTagMap, setSenderTagMap] = useState<Record<string, string[]>>({});
  const [isTagPopupOpen, setIsTagPopupOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [sessionInstructions, setSessionInstructions] = useState("");
  const [isSystemInstructionsOpen, setIsSystemInstructionsOpen] = useState(false);
  const { isDemo: isDemoFromHook } = useDemoGating();
  const isDemoUser = isDemoOrg(orgId) || isDemoFromHook;
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') {
      // Demo users are locked to Nemotron (free model)
      if (isDemoOrg(orgId)) return 'nemotron-3-ultra';
      const stored = localStorage.getItem(`${orgId}_selectedModel`) || 'gemini-3.5-flash';
      // Reset to default if stored model was removed
      const validModels = ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'nemotron-3-ultra', 'claude-opus-5', 'gpt-5.6-sol', 'gemini-3.5-flash', 'auto'];
      if (!validModels.includes(stored)) {
        localStorage.setItem(`${orgId}_selectedModel`, 'gemini-3.5-flash');
        return 'gemini-3.5-flash';
      }
      return stored;
    }
    return 'gemini-3.5-flash';
  });
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const isLiteModel = selectedModel === 'nemotron-3-ultra' || selectedModel === 'qwen/qwen3.6-27b';
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  const [tagFilterOpen, setTagFilterOpen] = useState(false);

  const [exploreTab, setExploreTab] = useState<"models" | "agents">("models");
  const [selectedExploreItem, setSelectedExploreItem] = useState<string | null>(null);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  const [isAgentRequestModalOpen, setIsAgentRequestModalOpen] = useState(false);
  const [agentRequestForm, setAgentRequestForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [isSubmittingAgentRequest, setIsSubmittingAgentRequest] = useState(false);

  // Persist model selection to localStorage
  useEffect(() => {
    localStorage.setItem(`${orgId}_selectedModel`, selectedModel);
  }, [selectedModel]);

  // Pre-warm server connections on dashboard load (eliminates cold-start on first message)
  useEffect(() => {
    const warmup = async () => {
      try {
        const headers = await getAuthHeaders();
        fetch('/api/warmup', { headers }).catch(() => {});
      } catch {}
    };
    warmup();
  }, []);

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
        toEmail: getOrgConfig(orgId)?.supportEmail || "support@soltheory.com",
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
  const [crmContacts, setCrmContacts] = useState<string>("");
  const crmActiveInstanceId = useCRMStore((s) => s.activeInstanceId) || "default";
  const crmAvailableInstances = useCRMStore((s) => s.availableInstances) || [];

  // Fetch CRM contacts for Jarvis context (so users can ask about their CRM data)
  // Gated behind feature flag — when CRM is disabled, skip the 500-contact load
  useEffect(() => {
    if (!FEATURE_FLAGS.crm || !firestore || !user?.uid || !orgId) return;
    const fetchCrm = async () => {
      try {
        const crmRef = collection(firestore, `orgs/${orgId}/crm-instances/${crmActiveInstanceId}/contacts`);
        const snap = await getDocs(query(crmRef, firestoreLimit(500)));
        if (snap.empty) return;
        // Build compact contact lines for LLM context — includes key CRM fields & relationship memories
        const lines = snap.docs.map(d => {
          const c = d.data();
          const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || '';
          if (!name) return '';
          const parts = [name];
          if (c.email) parts.push(c.email);
          if (c.phone) parts.push(c.phone);
          if (c.mobilePhone && c.mobilePhone !== c.phone) parts.push(c.mobilePhone);
          if (c.company) parts.push(c.company);
          if (c.jobTitle) parts.push(c.jobTitle);
          if (c.leadStatus && c.leadStatus !== 'Cold Lead') parts.push(c.leadStatus);
          if (c.tags && Array.isArray(c.tags) && c.tags.length > 0) parts.push(`[${c.tags.join(',')}]`);

          // 1. Extract personal facts, sports, hobbies, or conversation starters
          const rawAiNotes = String(c.aiNotes || '');
          const factMatches = rawAiNotes.match(/[•-]\s*(?:\([^)]+\)\s*)?([^•\n\r]+)/g);
          if (factMatches && factMatches.length > 0) {
            const cleanFacts = factMatches
              .slice(0, 3)
              .map(f => f.replace(/^[•-]\s*(?:\([^)]+\)\s*)?/, '').trim())
              .filter(Boolean)
              .join('; ');
            if (cleanFacts) {
              const snippet = cleanFacts.length > 90 ? cleanFacts.slice(0, 90) + '...' : cleanFacts;
              parts.push(`Facts: [${snippet}]`);
            }
          } else {
            // Check for **Personal Interests section from enrichment
            const interestMatch = rawAiNotes.match(/\*\*Personal Interests[^*]*\*\*([^*]+)/i);
            if (interestMatch && interestMatch[1]) {
              const cleanInterests = interestMatch[1].replace(/\s+/g, ' ').trim();
              if (cleanInterests && !cleanInterests.toLowerCase().includes("no personal interests identified")) {
                const snippet = cleanInterests.length > 80 ? cleanInterests.slice(0, 80) + '...' : cleanInterests;
                parts.push(`Interests: ${snippet}`);
              }
            }
          }

          if (c.customFields?.interests) {
            parts.push(`Interests: ${String(c.customFields.interests).slice(0, 60)}`);
          }

          // 2. Add concise professional summary snippet
          const summaryMatch = rawAiNotes.match(/\*\*Professional Summary\*\*([^*]+)/i);
          const professionalSnippet = summaryMatch && summaryMatch[1]
            ? summaryMatch[1].replace(/\s+/g, ' ').trim()
            : rawAiNotes.replace(/\s+/g, ' ').trim();

          if (professionalSnippet && !professionalSnippet.startsWith('**Key Facts')) {
            const snippet = professionalSnippet.length > 80 ? professionalSnippet.slice(0, 80) + '...' : professionalSnippet;
            parts.push(`Research: ${snippet}`);
          } else if (c.notes) {
            const cleanNotes = String(c.notes).replace(/\s+/g, ' ').trim();
            const snippet = cleanNotes.length > 80 ? cleanNotes.slice(0, 80) + '...' : cleanNotes;
            parts.push(`Notes: ${snippet}`);
          }
          return parts.join(' | ');
        }).filter(l => l.length > 2);
        setCrmContacts(lines.join('\n'));
        console.log(`[CRM] Loaded ${lines.length} contacts for Jarvis context`);
      } catch (err) {
        console.warn('[CRM] Failed to load contacts:', (err as any)?.message);
      }
    };
    fetchCrm();
  }, [firestore, user?.uid, orgId, crmActiveInstanceId]);

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

  // Escape key to close email detail view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedEmailId) {
        setExpandedEmailId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedEmailId]);

  // Agent Knowledge Base Config
  const [agentConfig, setAgentConfig] = useState({ soul: "", brain: "", heartbeat: "manual" });
  const [orgBrain, setOrgBrain] = useState<string>("");
  const [orgBrainLoaded, setOrgBrainLoaded] = useState(false);
  const [orgBrainSaving, setOrgBrainSaving] = useState(false);
  const orgBrainSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [personalBrainText, setPersonalBrainText] = useState<string>("");
  const [pdfUploading, setPdfUploading] = useState(false);
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"identity" | "data" | "pact">(() => {
    // Auto-open PACT tab from notification link
    if (typeof window !== 'undefined') {
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      if (urlTab === 'pact') return 'pact';
    }
    return 'identity';
  });

  // Auto-open Agent Studio when navigated with ?tab=pact
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab === 'pact') {
      setIsKnowledgeBaseOpen(true);
      setActiveSettingsTab('pact');
    }
  }, [searchParams]);
  const [ragDocs, setRagDocs] = useState<any[]>([]);
  const [isRAGUploading, setIsRAGUploading] = useState(false);
  const [isTextInputOpen, setIsTextInputOpen] = useState(false);
  const [ragTitle, setRagTitle] = useState("");
  const [ragTextContent, setRagTextContent] = useState("");


  // P.A.C.T. — Personalized AI Conversation Training (Dual-Scope Working Memory)
  type PACTEntry = { id: string; question: string; answer: string; source: string; orgId: string; scope: 'user' | 'org'; category?: string; confidence?: string; createdAt: number; updatedAt: number; markedForDeletion?: number; deletionReason?: string };
  const [personalPactEntries, setPersonalPactEntries] = useState<PACTEntry[]>([]);
  const [orgPactEntries, setOrgPactEntries] = useState<PACTEntry[]>([]);
  const [pactLoaded, setPactLoaded] = useState(false);
  // Active entries based on current chat scope
  const pactEntries = chatScope === 'org' ? orgPactEntries : personalPactEntries;

  // PACT enabled toggle
  const [pactEnabled, setPactEnabled] = useState(true);

  // Heartbeat — autonomous PACT cleanup
  const [heartbeatInterval, setHeartbeatInterval] = useState<string>("off");
  const [heartbeatRunning, setHeartbeatRunning] = useState(false);
  const [heartbeatPulseVisible, setHeartbeatPulseVisible] = useState(false);
  const heartbeatPulseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [heartbeatNotification, setHeartbeatNotification] = useState<{ count: number; timestamp: number } | null>(null);
  const [lastHeartbeatRun, setLastHeartbeatRun] = useState<number | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatLockRef = useRef(false);

  // Live-ticking clock for PACT auto-delete countdowns (updates every 60s)
  const [pactTickNow, setPactTickNow] = useState(Date.now());

  const fetchRAGDocs = async () => {
    if (!user?.uid || !firestore) return;
    try {
      const { collection, getDocs, query, orderBy } = await import("firebase/firestore");
      const q = query(collection(firestore, "users", user.uid, "agents", `${orgId}_${params.agentId}`, "knowledge_docs"), orderBy("createdAt", "desc"));
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

  // Load P.A.C.T. entries from Supabase working_memories API (dual-scope)
  const fetchPACTEntries = async () => {
    if (!user?.uid) return;
    try {
      const headers = await getAuthHeaders();
      // Fetch both scopes in parallel
      const [personalRes, orgRes] = await Promise.all([
        fetch(`/api/pact/memories?scope=user&orgId=${orgId}`, { headers }),
        fetch(`/api/pact/memories?scope=org&orgId=${orgId}`, { headers }),
      ]);
      if (personalRes.ok) {
        const data = await personalRes.json();
        setPersonalPactEntries((data || []).map((item: any) => ({
          id: item.id,
          question: item.question,
          answer: item.answer,
          source: item.source || 'server_background',
          orgId: orgId,
          scope: 'user' as const,
          category: item.category,
          confidence: item.confidence,
          createdAt: new Date(item.created_at).getTime(),
          updatedAt: new Date(item.updated_at).getTime(),
          markedForDeletion: item.marked_for_deletion ? new Date(item.marked_for_deletion).getTime() : undefined,
          deletionReason: item.deletion_reason || undefined,
        })));
      }
      if (orgRes.ok) {
        const data = await orgRes.json();
        setOrgPactEntries((data || []).map((item: any) => ({
          id: item.id,
          question: item.question,
          answer: item.answer,
          source: item.source || 'server_background',
          orgId: orgId,
          scope: 'org' as const,
          category: item.category,
          confidence: item.confidence,
          createdAt: new Date(item.created_at).getTime(),
          updatedAt: new Date(item.updated_at).getTime(),
          markedForDeletion: item.marked_for_deletion ? new Date(item.marked_for_deletion).getTime() : undefined,
          deletionReason: item.deletion_reason || undefined,
        })));
      }
      setPactLoaded(true);
    } catch (err) { console.error("Failed to load PACT entries from Supabase", err); }
  };

  useEffect(() => {
    if (user?.uid) {
      fetchPACTEntries();
    }
  }, [user?.uid, chatScope]);

  // Build PACT text for API injection — scope-aware, exclude soft-deleted entries, respect pactEnabled
  const pactText = pactEntries.length > 0 && pactEnabled
    ? pactEntries.filter(e => !e.markedForDeletion).map(e => `Q: ${e.question}\nA: ${e.answer}`).join("\n\n")
    : "";

  // Heartbeat — autonomous PACT cleanup (uses in-memory entries + Supabase API)
  const runHeartbeatCleanup = useCallback(async () => {
    if (heartbeatLockRef.current || !user?.uid) return;
    heartbeatLockRef.current = true;
    setHeartbeatRunning(true);
    try {
      // Work with the current scope's active entries
      const currentEntries = pactEntries.filter(e => !e.markedForDeletion);
      if (currentEntries.length === 0) {
        setLastHeartbeatRun(Date.now());
        setHeartbeatRunning(false);
        heartbeatLockRef.current = false;
        return;
      }

      const res = await fetch("/api/pact-evaluate", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          entries: currentEntries.map((e: any) => ({ question: e.question, answer: e.answer })),
          userName: user?.displayName || undefined
        })
      });
      const data = await res.json();
      const decisions: any[] = data.decisions || [];

      // Build a map of active entry indices that should be discarded
      const discardIndices = new Set<number>();
      decisions.forEach((d: any) => {
        if (!d.keep && typeof d.index === "number") {
          discardIndices.add(d.index);
        }
      });

      if (discardIndices.size > 0) {
        // Push notification to shared notification tray
        const existing = JSON.parse(localStorage.getItem('st_all_notifications') || '[]');
        const newNotif = {
          id: `heartbeat-${Date.now()}`,
          title: `Cleaned ${discardIndices.size} P.A.C.T. ${discardIndices.size === 1 ? 'entry' : 'entries'}`,
          desc: `Review flagged entries before they auto-delete in 24h.`,
          time: Date.now(),
          type: 'heartbeat',
          link: `/portal/dashboard/${orgId}/ai-agents/${params.agentId}?tab=pact`
        };
        localStorage.setItem('st_all_notifications', JSON.stringify([newNotif, ...existing].slice(0, 50)));
        setHeartbeatNotification({ count: discardIndices.size, timestamp: Date.now() });
      }

      setLastHeartbeatRun(Date.now());
      await fetchPACTEntries();
    } catch (err) {
      console.error("[Heartbeat] Cleanup error:", err);
    } finally {
      setHeartbeatRunning(false);
      heartbeatLockRef.current = false;
    }
  }, [user?.uid, user?.displayName, pactEntries, chatScope]);

  // Heartbeat interval management
  useEffect(() => {
    // Load saved interval + pact enabled
    const saved = localStorage.getItem(`st_heartbeat_interval_${params.agentId}`);
    if (saved) setHeartbeatInterval(saved);
    const savedPact = localStorage.getItem(`st_pact_enabled_${params.agentId}`);
    if (savedPact !== null) setPactEnabled(savedPact === 'true');
    const savedLastRun = localStorage.getItem(`st_heartbeat_lastrun_${params.agentId}`);
    if (savedLastRun) setLastHeartbeatRun(parseInt(savedLastRun));
  }, [params.agentId]);

  useEffect(() => {
    localStorage.setItem(`st_heartbeat_interval_${params.agentId}`, heartbeatInterval);
  }, [heartbeatInterval, params.agentId]);

  useEffect(() => {
    localStorage.setItem(`st_pact_enabled_${params.agentId}`, String(pactEnabled));
  }, [pactEnabled, params.agentId]);

  useEffect(() => {
    if (lastHeartbeatRun) localStorage.setItem(`st_heartbeat_lastrun_${params.agentId}`, String(lastHeartbeatRun));
  }, [lastHeartbeatRun, params.agentId]);

  useEffect(() => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    if (heartbeatInterval === "off") return;

    const intervalMs: Record<string, number> = {
      "5m": 5 * 60 * 1000, "10m": 10 * 60 * 1000, "15m": 15 * 60 * 1000,
      "30m": 30 * 60 * 1000, "1h": 60 * 60 * 1000, "2h": 2 * 60 * 60 * 1000, "4h": 4 * 60 * 60 * 1000
    };
    const ms = intervalMs[heartbeatInterval];
    if (!ms) return;

    heartbeatTimerRef.current = setInterval(() => {
      runHeartbeatCleanup();
    }, ms);

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [heartbeatInterval, runHeartbeatCleanup]);

  // Heartbeat pulse indicator for chat UI — flash every 30s when active
  useEffect(() => {
    if (heartbeatPulseTimerRef.current) clearInterval(heartbeatPulseTimerRef.current);
    if (heartbeatInterval === "off") { setHeartbeatPulseVisible(false); return; }

    heartbeatPulseTimerRef.current = setInterval(() => {
      setHeartbeatPulseVisible(true);
      setTimeout(() => setHeartbeatPulseVisible(false), 3000);
    }, 30000);

    return () => {
      if (heartbeatPulseTimerRef.current) clearInterval(heartbeatPulseTimerRef.current);
    };
  }, [heartbeatInterval, runHeartbeatCleanup]);

  // Final sweep when user leaves — complete one cleanup before shutting down
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (heartbeatInterval !== "off" && !heartbeatLockRef.current) {
        // Fire a beacon to trigger the cleanup — this works even when the page is closing
        navigator.sendBeacon("/api/pact-evaluate", JSON.stringify({ finalSweep: true }));
        // Also try to run cleanup synchronously (best effort)
        runHeartbeatCleanup();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [heartbeatInterval, runHeartbeatCleanup]);

  // Tick the PACT timer every 60s so countdowns update live + auto-purge expired entries
  useEffect(() => {
    const tickInterval = setInterval(() => {
      const now = Date.now();
      setPactTickNow(now);

      // Auto-purge entries that have expired (markedForDeletion > 24h ago)
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const hasExpired = pactEntries.some(e => e.markedForDeletion && (now - e.markedForDeletion) > TWENTY_FOUR_HOURS);
      if (hasExpired && user?.uid) {
        const remaining = pactEntries.filter(e => !(e.markedForDeletion && (now - e.markedForDeletion) > TWENTY_FOUR_HOURS));
        // Update the correct scope's state
        if (chatScope === 'org') setOrgPactEntries(remaining);
        else setPersonalPactEntries(remaining);
      }
    }, 60000);
    return () => clearInterval(tickInterval);
  }, [pactEntries, firestore, user?.uid]);


  // Org Brain — editable organizational knowledge base stored in Firestore
  const fetchOrgBrain = async () => {
    if (!firestore || !orgId) return;
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const snap = await getDoc(doc(firestore, "organizations", orgId));
      if (snap.exists()) {
        const data = snap.data();
        setOrgBrain(data?.orgBrain || "");

        // Sync org-level Soul (Voice & Personality) & Brain (Rules) into agentConfig
        const orgSoul = data?.soul || data?.orgSoul || "";
        let orgBrainRules = "";
        if (Array.isArray(data?.brainRules)) {
          orgBrainRules = data.brainRules.join("\n");
        } else if (data?.brain && typeof data.brain === "string") {
          orgBrainRules = data.brain;
        }

        setAgentConfig(prev => ({
          ...prev,
          soul: orgSoul || prev.soul,
          brain: orgBrainRules || prev.brain,
        }));
      }
      setOrgBrainLoaded(true);
    } catch (err) { /* org brain read may fail due to Firestore security rules — non-critical */ setOrgBrainLoaded(true); }
  };

  const saveOrgBrain = async () => {
    if (!firestore || !orgId) return;
    setOrgBrainSaving(true);
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(firestore, "organizations", orgId), { orgBrain }, { merge: true });
      logActivity(firestore, 'ai_agent_config_changed', { email: user?.email || '', displayName: user?.displayName }, `Updated org brain for ${orgId}`);
    } catch (err) { console.error("Failed to save org brain", err); }
    finally { setOrgBrainSaving(false); }
  };

  // Auto-save org brain on change (debounced 1.5s)
  const handleOrgBrainChange = (val: string) => {
    setOrgBrain(val);
    if (orgBrainSaveTimerRef.current) clearTimeout(orgBrainSaveTimerRef.current);
    orgBrainSaveTimerRef.current = setTimeout(() => {
      saveOrgBrain();
    }, 1500);
  };

  useEffect(() => {
    if (firestore && orgId) fetchOrgBrain();
  }, [firestore, orgId]);

  // Fetch personal AI brain profile (compiled briefing) for injection into chat
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const loadPersonalBrain = async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const snap = await getDoc(doc(firestore, "users", user.uid));
        const profile = snap.data()?.aiBrainProfile;
        if (profile?.compiledBriefing) {
          setPersonalBrainText(profile.compiledBriefing);
        }
      } catch { /* non-critical */ }
    };
    loadPersonalBrain();
  }, [firestore, user?.uid]);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Global click-outside and Escape key handler for all dropdowns/popups
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Close model dropdown if clicking outside it
      if (isModelDropdownOpen && !target.closest('[data-dropdown="model"], [data-dropdown="model-mobile"]')) {
        setIsModelDropdownOpen(false);
      }
      // Close agent switcher if clicking outside it
      if (isAgentSwitcherOpen && !target.closest('[data-dropdown="agent-switcher"]')) {
        setIsAgentSwitcherOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModelDropdownOpen(false);
        setIsAgentSwitcherOpen(false);
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
  }, [isModelDropdownOpen, isAgentSwitcherOpen, isSystemInstructionsOpen, lightboxImage, isObserverFullScreen, isKnowledgeBaseOpen]);

  const agents: Record<string, { name: string, greeting: string, theme: string, chatBg: string, accent: string, heroDesc?: string, heroIcon?: string, quickActions?: { label: string, action: string }[] }> = {
    "jarvis": {
      name: "Jarvis (Executive Agent)",
      greeting: "Hello. I am Jarvis. How can I assist you today?",
      theme: "border-blue-200 text-blue-600 bg-blue-50",
      chatBg: isDarkMode ? "bg-[#2F2F2F] border-[#383838]" : "bg-white border-[#E5E4DE]",
      accent: isDarkMode ? "text-[#B4B4B4]" : "text-[#6B6860]",
      heroDesc: "Ask anything \u2014 from drafting emails and scheduling events to strategy advice and deep research.",
      heroIcon: "bot",
      quickActions: [
        { label: 'Draft an email', action: 'Draft an email' },
        { label: 'Schedule a meeting', action: 'Schedule a meeting' },
        { label: 'Research a topic', action: 'Research a topic' },
        { label: 'Add a contact', action: 'Add a contact' },
        { label: 'Edit contact book', action: 'Edit contact book' },
      ],
    },
    "iris": {
      name: "Iris (Illustrative Agent)",
      greeting: "Hello! I'm Iris. Describe any image and I'll bring it to life.",
      theme: "border-purple-200 text-purple-600 bg-purple-50",
      chatBg: isDarkMode ? "bg-[#2F2F2F] border-[#383838]" : "bg-white border-[#E5E4DE]",
      accent: isDarkMode ? "text-[#B4B4B4]" : "text-[#6B6860]",
      heroDesc: "Describe any image \u2014 from creative illustrations and marketing graphics to concept art and social media visuals.",
      heroIcon: "palette",
      quickActions: [
        { label: 'Generate artwork', action: '__iris_followup__artwork' },
        { label: 'Design a logo', action: '__iris_followup__logo' },
        { label: 'Create a social post', action: '__iris_followup__social' },
        { label: 'Illustrate a scene', action: '__iris_followup__scene' },
        { label: 'Sketch a concept', action: '__iris_followup__sketch' },
      ],
    },
    "bobby": {
      name: "Bobby (Workflow Maestro)",
      greeting: "Hey there! I'm Bobby \u2014 your scheduling and workflow partner. Need help organizing your calendar or keeping tasks on track?",
      theme: "border-amber-200 text-amber-600 bg-amber-50",
      chatBg: isDarkMode ? "bg-[#2F2F2F] border-[#383838]" : "bg-white border-[#E5E4DE]",
      accent: isDarkMode ? "text-[#B4B4B4]" : "text-[#6B6860]",
      heroDesc: "Your proactive scheduling partner \u2014 from organizing calendars and deadlines to sending gentle reminders and keeping your team on track.",
      heroIcon: "wrench",
      quickActions: [
        { label: 'Schedule orientation meetings', action: 'Schedule the Day 1 orientation meetings for a new hire on our team.' },
        { label: 'Review upcoming deadlines', action: 'Show me all upcoming onboarding deadlines for active new hires.' },
        { label: 'Check task progress', action: 'Give me a progress summary of all active onboarding tracks.' },
        { label: 'Send a reminder', action: 'Send a gentle reminder about pending compliance documents that are coming due.' },
      ],
    },
    "monica": {
      name: "Monica (Compliance Controller)",
      greeting: "Hello. I'm Monica \u2014 your regulatory compliance partner. Let me help you ensure everything is audit-ready and properly documented.",
      theme: "border-emerald-200 text-emerald-600 bg-emerald-50",
      chatBg: isDarkMode ? "bg-[#2F2F2F] border-[#383838]" : "bg-white border-[#E5E4DE]",
      accent: isDarkMode ? "text-[#B4B4B4]" : "text-[#6B6860]",
      heroDesc: "Your meticulous compliance auditor \u2014 from tracking document verifications and regulatory requirements to generating audit-ready reports.",
      heroIcon: "shield-check",
      quickActions: [
        { label: 'Compliance status report', action: 'Generate a compliance status report for all active new hires.' },
        { label: 'Check missing documents', action: 'Which new hires have overdue compliance documents?' },
        { label: 'Verification summary', action: 'Show me the verification status of all uploaded compliance documents.' },
        { label: 'Audit readiness check', action: 'Run an audit readiness check for our organization.' },
      ],
    },
  };

  const agent = agents[params.agentId as string];
  if (!agent) notFound();

  const isEmailAgent = params.agentId === "jarvis";
  const isImageAgent = params.agentId === "iris";
  const isBobbyAgent = params.agentId === "bobby";
  const isMonicaAgent = params.agentId === "monica";

  // Initialize – Load sessions from Supabase via chat store
  const sessionsLoadedRef = useRef(false);
  const kbCacheRef = useRef<string | null>(null);
  useEffect(() => {
    if (sessionsLoadedRef.current) return;
    if (!user?.uid) return;

    chatStore.loadSessions(orgId);
    sessionsLoadedRef.current = true;


    const savedConfig = localStorage.getItem(`st_agent_config_${params.agentId}`);
    if (savedConfig) {
      try { setAgentConfig(JSON.parse(savedConfig)); } catch { }
    }
    const savedContacts = localStorage.getItem(`st_agent_contacts_${params.agentId}`);
    if (savedContacts) {
      try { setAgentContacts(JSON.parse(savedContacts)); } catch { }
    }
    const savedRead = localStorage.getItem(`st_read_emails_${params.agentId}`);
    if (savedRead) {
      try { setReadEmails(new Set(JSON.parse(savedRead))); } catch { }
    }
    const savedStarred = localStorage.getItem(`st_starred_emails_${params.agentId}`);
    if (savedStarred) {
      try { setStarredEmails(new Set(JSON.parse(savedStarred))); } catch { }
    }

    // Load tags from Firestore (persists across sessions/devices)
    if (user?.uid && firestore) {
      getDoc(doc(firestore, "users", user.uid, "email_settings", params.agentId)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.emailTags) setEmailTags(data.emailTags);
          if (data.senderTagMap) setSenderTagMap(data.senderTagMap);
        } else {
          // Migrate from localStorage if Firestore has no data yet
          const savedTags = localStorage.getItem(`st_email_tags_${params.agentId}`);
          if (savedTags) { try { setEmailTags(JSON.parse(savedTags)); } catch { } }
          const savedSenderTags = localStorage.getItem(`st_sender_tag_map_${params.agentId}`);
          if (savedSenderTags) { try { setSenderTagMap(JSON.parse(savedSenderTags)); } catch { } }
        }
      }).catch(() => {
        // Fallback to localStorage if Firestore fails
        const savedTags = localStorage.getItem(`st_email_tags_${params.agentId}`);
        if (savedTags) { try { setEmailTags(JSON.parse(savedTags)); } catch { } }
        const savedSenderTags = localStorage.getItem(`st_sender_tag_map_${params.agentId}`);
        if (savedSenderTags) { try { setSenderTagMap(JSON.parse(savedSenderTags)); } catch { } }
      });
    }
  }, [params.agentId, firestore, user?.uid]);

  // Save config + contacts to localStorage
  useEffect(() => {
    localStorage.setItem(`st_agent_config_${params.agentId}`, JSON.stringify(agentConfig));
    localStorage.setItem(`st_agent_contacts_${params.agentId}`, JSON.stringify(agentContacts));
    localStorage.setItem(`st_read_emails_${params.agentId}`, JSON.stringify(Array.from(readEmails)));
    localStorage.setItem(`st_starred_emails_${params.agentId}`, JSON.stringify(Array.from(starredEmails)));
  }, [agentConfig, agentContacts, readEmails, starredEmails, params.agentId]);

  // Save tags to Firestore (debounced) — persists across sessions/devices/accounts
  const tagSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!user?.uid || !firestore) return;
    // Also write to localStorage as a fast cache
    localStorage.setItem(`st_email_tags_${params.agentId}`, JSON.stringify(emailTags));
    localStorage.setItem(`st_sender_tag_map_${params.agentId}`, JSON.stringify(senderTagMap));
    // Debounced Firestore write (1s)
    if (tagSaveTimerRef.current) clearTimeout(tagSaveTimerRef.current);
    tagSaveTimerRef.current = setTimeout(() => {
      setDoc(doc(firestore, "users", user.uid, "email_settings", params.agentId), {
        emailTags,
        senderTagMap,
        updatedAt: Date.now(),
      }, { merge: true }).catch(err => console.error("Failed to save email tags to Firestore:", err));
    }, 1000);
    return () => { if (tagSaveTimerRef.current) clearTimeout(tagSaveTimerRef.current); };
  }, [emailTags, senderTagMap, params.agentId, user?.uid, firestore]);



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

  // Persist active session ID to sessionStorage so page refresh restores the current chat
  useEffect(() => {
    if (activeSessionId) {
      sessionStorage.setItem(`st_active_session_${params.agentId}`, activeSessionId);
    } else {
      sessionStorage.removeItem(`st_active_session_${params.agentId}`);
    }
  }, [activeSessionId, params.agentId]);

  // Save active session to Supabase on message changes — ONLY if it has user messages
  useEffect(() => {
    if (sessions.length > 0 && !isTyping && activeSessionId && sessionsLoaded) {
      const activeSession = sessions.find(s => s.id === activeSessionId);
      if (activeSession && activeSession.messages.filter(m => m.isSelf).length > 0) {
        chatStore.saveMessages(activeSessionId, activeSession.title);
      }
    }
  }, [sessions, isTyping, activeSessionId, sessionsLoaded]);



  const startNewSession = () => {
    chatStore.startNewSession();
    setSelectedExploreItem(null);
  };

  const loadSession = (id: string) => {
    chatStore.setActiveSession(id);
    chatStore.setSessionRead(id);
    setIsKnowledgeBaseOpen(false);
    setSelectedExploreItem(null);
  };

  const renderSessionIcon = (s: Session) => {
    const status = sessionStatuses?.[s.id];
    if (status === 'thinking') {
      return <Loader2 className={`w-4 h-4 mr-3 shrink-0 animate-spin ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`} />;
    }
    if (status === 'unread') {
      return (
        <div className="w-4 h-4 mr-3 shrink-0 flex items-center justify-center" title="New response ready">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-500/20 shadow-sm shadow-blue-500/50" />
        </div>
      );
    }
    if (s.scope === 'org') {
      return <Users className="w-4 h-4 mr-3 shrink-0 opacity-70 text-emerald-500" />;
    }
    return <MessageSquare className="w-4 h-4 mr-3 shrink-0 opacity-70" />;
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const session = sessions.find(s => s.id === id);
    const isEmpty = session && session.title === "New Chat" && session.messages.filter(m => m.isSelf).length === 0;
    // Empty "New Chat" sessions can be removed silently (no confirm)
    // Sessions with content require confirmation
    if (!isEmpty && !confirm('Delete this chat?')) return;
    chatStore.deleteSession(id);
    if (activeSessionId === id) {
      setSelectedExploreItem(null);
    }
  };

  // Fetch all knowledge base text from client-side Firestore
  const getKnowledgeBaseText = async (): Promise<string> => {
    // Return cached KB text if available (KB doesn't change during a session)
    if (kbCacheRef.current !== null) return kbCacheRef.current;
    if (!user?.uid || !firestore) return "";
    try {
      const { collection, getDocs } = await import("firebase/firestore");

      const possibleAgentIds = [
        params.agentId,
        `${orgId}_${params.agentId}`,
        `nxtchapter_${params.agentId}`
      ];
      if (params.agentId === "jarvis") {
        possibleAgentIds.push("email", `${orgId}_email`);

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

      // Cache the result and return
      const result = texts.join("\n\n");
      kbCacheRef.current = result;
      return result;
    } catch (err) {
      console.error("KB fetch error:", err);
      return "";
    }
  };
  // Strip markdown from session titles for clean sidebar display
  const stripMarkdown = (text: string) => text.replace(/#{1,6}\s?/g, '').replace(/\*{1,2}([^*]*)\*{1,2}/g, '$1').trim();

  // Speech-to-text handler
  const toggleSpeechToText = () => {
    if (isListening) {
      speechRecRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let finalTranscript = inputValue;
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInputValue(finalTranscript + (interim ? ' ' + interim : ''));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    speechRecRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = overrideText ?? inputValue;
    if ((!textToSend.trim() && pendingAttachments.length === 0) || isTyping) return;

    // Lazily create a new session on first message if no active session exists
    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      try {
        currentSessionId = await chatStore.createSession(orgId, "New Chat");
      } catch {
        // Fallback: create a local-only session ID if API fails
        currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newSession: Session = { id: currentSessionId, title: "New Chat", updatedAt: Date.now(), scope: chatScope, messages: [] };
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(currentSessionId);
      }
    }

    // Capture attachments and clear pending list
    const attachmentsToProcess = [...pendingAttachments];
    setPendingAttachments([]);

    let userMsgImageUrl: string | undefined = undefined;
    let attachedFilesTextContext = "";
    const extraUserMessages: Message[] = [];

    if (attachmentsToProcess.length > 0) {
      for (const att of attachmentsToProcess) {
        if (att.preview) URL.revokeObjectURL(att.preview);
        
        if (att.file.type.startsWith('image/')) {
          const base64Data = await resizeImageToBase64(att.file);
          if (base64Data) {
            if (!userMsgImageUrl) {
              userMsgImageUrl = base64Data;
            } else {
              extraUserMessages.push({
                id: uid(),
                text: `Uploaded image: ${att.file.name || "pasted-image.jpg"}`,
                isSelf: true,
                imageUrl: base64Data
              });
            }
          }
        } else {
          // Process document files immediately
          setIsTyping(true);
          try {
            const formData = new FormData();
            formData.append("file", att.file);
            const headers = await getAuthHeaders();
            delete (headers as Record<string, string>)["Content-Type"];
            const res = await fetch("/api/knowledge/ingest", { method: "POST", headers, body: formData });
            const data = await res.json();
            if (res.ok && data.chunks) {
              const fullText = data.chunks.map((c: any) => c.text).join(" ");
              attachedFilesTextContext += `\n\n[ATTACHED FILE: ${att.file.name}]\n${fullText}`;
            }
          } catch (err: any) {
            console.error("Failed to ingest file", err);
          } finally {
            setIsTyping(false);
          }
        }
      }
    }

    // Map internal action keys to user-facing display text
    const irisButtonLabels: Record<string, string> = {
      '__iris_followup__artwork': 'Generate artwork',
      '__iris_followup__logo': 'Design a logo',
      '__iris_followup__social': 'Create a social post',
      '__iris_followup__scene': 'Illustrate a scene',
      '__iris_followup__sketch': 'Sketch a concept',
    };
    const msgSendTimestamp = Date.now();
    const realMessages = messages.filter(m => m.isSelf || messages.some(um => um.isSelf));
    const msgText = irisButtonLabels[textToSend.trim()] || textToSend.trim() || (userMsgImageUrl ? "Attached image" : "Uploaded file");
    const userMsg: Message = { id: uid(), text: msgText, isSelf: true, sendTimestamp: msgSendTimestamp };
    if (userMsgImageUrl) {
      userMsg.imageUrl = userMsgImageUrl;
      const imageNote = `[System Note: The user has attached an image named "pasted-image.jpg" to this message.]`;
      userMsg.hiddenContext = imageNote;
    }
    if (attachedFilesTextContext) {
      const fileNote = `The user has attached files. Here are their extracted contents:${attachedFilesTextContext}`;
      userMsg.hiddenContext = userMsg.hiddenContext 
        ? `${userMsg.hiddenContext}\n\n${fileNote}`
        : fileNote;
    }

    const newMessages = [...realMessages, userMsg, ...extraUserMessages];
    // Create bot placeholder immediately so the ThinkingDisplay timer starts from 0s
    const botMsgIdEarly = uid();
    const botPlaceholder: Message = { id: botMsgIdEarly, text: '', isSelf: false, sendTimestamp: msgSendTimestamp, agentEvents: [{ type: 'thinking' as const, content: '', timestamp: msgSendTimestamp }] };
    setMessages([...newMessages, botPlaceholder]); setIsTyping(false); setInputValue("");
    // Mark this session as 'thinking' in the store (persists across sidebar navigation)
    if (currentSessionId) chatStore.setSessionThinking(currentSessionId);

    // ── IRIS: Image Generation Path ──
    // Route to /api/generate-image instead of /api/chat when using Iris
    if (isImageAgent) {
      // Map internal action keys to user-facing display text for conversational responses
      const irisButtonLabels: Record<string, string> = {
        '__iris_followup__artwork': 'Generate artwork',
        '__iris_followup__logo': 'Design a logo',
        '__iris_followup__social': 'Create a social post',
        '__iris_followup__scene': 'Illustrate a scene',
        '__iris_followup__sketch': 'Sketch a concept',
      };

      // Handle conversational follow-up buttons (zero-token, client-side only)
      const irisFollowups: Record<string, string> = {
        '__iris_followup__artwork': 'What kind of artwork would you like me to generate? Describe the style, subject, and mood.',
        '__iris_followup__logo': 'What kind of logo would you like? Tell me about the brand, colors, or concept.',
        '__iris_followup__social': "What's the social media post about? Describe the vibe, message, and any text to include.",
        '__iris_followup__scene': 'What scene would you like me to illustrate? Describe what you see in your mind.',
        '__iris_followup__sketch': 'What concept would you like me to sketch? Give me the details and style.',
      };

      const rawText = textToSend.trim();
      const followupResponse = irisFollowups[rawText];
      
      if (followupResponse) {
        // Instant client-side response — no API call, zero tokens
        const botMsg: Message = { id: uid(), text: followupResponse, isSelf: false };
        const updatedMsgs = [...newMessages, botMsg];
        setMessages(updatedMsgs);
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: updatedMsgs, updatedAt: Date.now(), title: s.title === 'New Chat' ? 'Iris Chat' : s.title } : s));
        setIsTyping(false);
        return;
      }

      // Real image generation — call the API
      const pendingBotMsgId = uid();
      const pendingBotMsg: Message = {
        id: pendingBotMsgId,
        text: '',
        isSelf: false,
        sendTimestamp: msgSendTimestamp,
        agentEvents: [], // Empty events list starts the timer!
        isPendingImage: true, // Show the skeleton loader
      };

      const messagesWithPending = [...newMessages, pendingBotMsg];
      setMessages(messagesWithPending);
      setIsTyping(false); // Disable standard generic loading indicator

      try {
        const headers = await getAuthHeaders();
        headers['Content-Type'] = 'application/json';
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers,
          body: JSON.stringify({ prompt: rawText, orgId }),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        const botMsg: Message = {
          id: pendingBotMsgId, // Replace the pending message by keeping the same ID
          text: '',
          isSelf: false,
          sendTimestamp: msgSendTimestamp, // Keep same timestamp so timer calculation is accurate
          agentEvents: [{ type: 'done' as const, timestamp: Date.now() }], // This stops the timer!
        };

        if (data.imageBase64) {
          botMsg.imageUrl = `data:${data.mimeType || 'image/png'};base64,${data.imageBase64}`;
          botMsg.text = data.textContent || '';
        } else {
          botMsg.text = data.textContent || 'I wasn\'t able to generate that image. Please try a different description.';
        }

        // Replace the pending message with the final generated result
        setMessages(prev => prev.map(m => m.id === pendingBotMsgId ? botMsg : m));

        // Save session in state (auto-saves to Firestore via useEffect)
        const updatedMsgs = messagesWithPending.map(m => m.id === pendingBotMsgId ? botMsg : m);
        const sessionTitle = rawText.slice(0, 40) || 'Image Generation';
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: updatedMsgs, updatedAt: Date.now(), title: s.title === 'New Chat' ? sessionTitle : s.title } : s));
      } catch (err: any) {
        console.error('[Iris] Image generation error:', err);
        const errorBotMsg: Message = {
          id: pendingBotMsgId,
          text: `Image generation failed: ${err.message}`,
          isSelf: false,
          sendTimestamp: msgSendTimestamp,
          agentEvents: [{ type: 'done' as const, timestamp: Date.now() }], // Stop the timer on error
        };
        setMessages(prev => prev.map(m => m.id === pendingBotMsgId ? errorBotMsg : m));

        const updatedMsgs = messagesWithPending.map(m => m.id === pendingBotMsgId ? errorBotMsg : m);
        const sessionTitle = rawText.slice(0, 40) || 'Image Generation';
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: updatedMsgs, updatedAt: Date.now(), title: s.title === 'New Chat' ? sessionTitle : s.title } : s));
      }
      return; // Skip the normal chat flow
    }

    // Pre-compute citations client-side (instant — pure string matching) for thinking bubble
    try {
      const previewCitations = retrieveRelevantSnippets(textToSend, {
        pactText: pactText || "",
        knowledgeBaseText: "", // Don't send full KB text client-side for perf, server will do full search
        orgBrainText: orgBrain || "",
      });
      if (previewCitations.length > 0) setPendingCitations(previewCitations);
    } catch { /* non-critical */ }



    let rToken: string | null = null;
    let kbText = "";

    try {
      // Fetch refresh token and knowledge base in parallel for speed
      const getRefreshTokenAsync = async () => {
        if (!user?.uid || !firestore) return null;
        const docSnap = await getDoc(doc(firestore, "users", user.uid));
        const docData = docSnap.data();
        let t = docData?.[`gmailOAuth_${params.agentId}`]?.refreshToken;
        if (!t) t = (docData?.gmailOAuth_jarvis?.refreshToken || docData?.gmailOAuth_morpheus?.refreshToken);
        if (!t) t = docData?.gmailOAuth_email?.refreshToken;
        if (!t) t = docData?.["gmailOAuth_inbound-email"]?.refreshToken;
        if (!t) t = docData?.gmailOAuth?.refreshToken;
        return t || null;
      };

      [rToken, kbText] = await Promise.all([
        getRefreshTokenAsync(),
        isLiteModel ? Promise.resolve('') : getKnowledgeBaseText(),
      ]);

      const OPENROUTER_MODEL_IDS = ['claude-opus-5', 'gpt-5.6-sol', 'gemini-3.5-flash', 'nemotron-3-ultra'];
      const apiMessages = newMessages.map(m => {
        const role = m.isSelf ? "user" : "assistant";
        const textContent = m.hiddenContext ? `${m.hiddenContext}\n\n[USER COMMENT]: ${m.text}` : m.text;
        // If this message has an image, send as multimodal content (vision format)
        if (m.isSelf && m.imageUrl && m.imageUrl.startsWith('data:')) {
          return {
            role,
            content: [
              { type: 'text' as const, text: textContent },
              { type: 'image_url' as const, image_url: { url: m.imageUrl } },
            ],
          };
        }
        return { role, content: textContent };
      });
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          messages: apiMessages,
          agentId: `${orgId}_${params.agentId}`,
          soul: `${agentConfig.soul ? `[ORGANIZATION VOICE & PERSONALITY]\n${agentConfig.soul}\n\n` : ''}${sessionInstructions ? `\n\n[SESSION INSTRUCTIONS]\n${sessionInstructions}` : ''}\n\n[RELATIONSHIP & CRM INTELLIGENCE]\nYou have direct access to the user's CRM contact database and relationship memories (personal facts, sports fandom, hobbies, background). When asked about contacts, leverage these details naturally. For deep contact history, research dossiers, or past interaction timelines, ALWAYS call crm_get_contact_profile.\n\n[MODEL IDENTITY]\nYou are currently powered by ${(() => { const names: Record<string, string> = { 'openai/gpt-oss-120b': 'GPT OSS 120B (Groq)', 'qwen/qwen3.6-27b': 'Qwen 3.6 27B (Groq)', 'nemotron-3-ultra': 'Nemotron 3 Ultra (NVIDIA via OpenRouter)', 'claude-opus-5': 'Claude Opus 5 (Anthropic via OpenRouter)', 'gpt-5.6-sol': 'GPT-5.6 Sol (OpenAI via OpenRouter)', 'gemini-3.5-flash': 'Gemini 3.5 Flash (Google via OpenRouter)' }; return names[selectedModel] || selectedModel; })()}. If a user asks what model you are, tell them truthfully.\n\n[USER CONTEXT]\nAct on behalf of this user. The user's email address is: ${user?.email || 'Unknown'}. Do not ask them for their email.`,
          brain: agentConfig.brain,
          uid: user?.uid,
          refreshToken: rToken,
          contacts: agentContacts,
          // Budget models skip heavy context for speed — Google Suite only
          ...(isLiteModel ? {} : {
            knowledgeBaseText: kbText,
            orgBrainText: orgBrain,
            personalBrainText,
            pactText,
            crmData: crmContacts || undefined,
            crmInstanceId: crmActiveInstanceId,
            crmInstances: crmAvailableInstances.length > 0 ? crmAvailableInstances : [{ id: "default", name: "All Contacts" }],
          }),
          userName: user?.displayName || undefined,
          model: selectedModel,
          stream: true,
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          chatScope,
        }),
      });
      console.log(`%c[JARVIS] Model: ${selectedModel} | Provider: ${OPENROUTER_MODEL_IDS.includes(selectedModel) ? 'OpenRouter' : 'Groq'} | Lite: ${isLiteModel}`, 'color: #10b981; font-weight: bold; font-size: 12px');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      // --- SSE Streaming Response Reader ---
      // Read tokens as they arrive and render in real-time
      let data: { response: string; usage?: number; executedTools?: any[]; enrichmentUrls?: any[]; citations?: any[] } = { response: '' };
      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') && res.body) {
        // Streaming mode — render tokens as they arrive
        const botMsgId = botMsgIdEarly; // Reuse the placeholder created before the fetch
        let fullText = '';
        // Bot placeholder already in messages — just ensure isTyping is off
        setIsTyping(false); // Hide spinner immediately — text is arriving

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Frame-throttled rendering: batch SSE updates into ~30fps React state flushes
        // instead of re-rendering on every single token (~100+ times/sec)
        const throttle = createStreamThrottle(setMessages, botMsgId);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const payload = JSON.parse(line.slice(6));

              // Log server metadata to F12 console for debugging
              if (payload.type === 'server_meta') {
                console.log(
                  `%c[SERVER] Model: ${payload.model} | Provider: ${payload.provider} | OpenRouter Key: ${payload.openrouterKeySet ? '✅ SET' : '❌ MISSING'}`,
                  `color: ${payload.openrouterKeySet ? '#22c55e' : '#ef4444'}; font-weight: bold; font-size: 13px; background: #1e293b; padding: 4px 8px; border-radius: 4px;`
                );
                continue;
              }

              // Handle agent events — queue via throttle instead of per-event setState
              if (payload.type && ['routing', 'plan', 'step_start', 'step_complete', 'tool_call', 'thinking', 'done'].includes(payload.type)) {
                throttle.addEvent(payload as AgentEvent);
                continue; // Don't process as token
              }

              // Handle streamed reasoning/thinking chunks — append to the thinking event, NOT to visible text
              if (payload.type === 'thinking_chunk' && payload.token) {
                throttle.appendThinking(payload.token);
                continue; // Don't process as token — this is internal reasoning
              }

              if (payload.token) {
                fullText += payload.token;
                throttle.appendText(payload.token);
              }
              if (payload.done) {
                // Final metadata event — capture citations, tools, enrichment, usage
                data = {
                  response: fullText,
                  usage: payload.usage,
                  executedTools: payload.executedTools,
                  enrichmentUrls: payload.enrichmentUrls,
                  citations: payload.citations,
                };
                // Queue citations via throttle if present
                if (payload.citations && payload.citations.length > 0) {
                  throttle.setCitations(payload.citations);
                }
              }
              if (payload.error) {
                fullText += '\n\nI had a momentary hiccup. Could you try asking me that again?';
                throttle.appendError('\n\nI had a momentary hiccup. Could you try asking me that again?');
              }
            } catch (parseErr) {
              // Skip malformed SSE lines
            }
          }
        }

        // Flush any remaining data in buffer after stream ends
        if (buffer.trim()) {
          const remainingLine = buffer.trim();
          if (remainingLine.startsWith('data: ')) {
            try {
              const payload = JSON.parse(remainingLine.slice(6));
              if (payload.token) {
                fullText += payload.token;
                throttle.appendText(payload.token);
              }
              if (payload.done) {
                // Process done event from remaining buffer
                if (payload.usage) data.usage = payload.usage;
                if (payload.citations) {
                  data.citations = payload.citations;
                  throttle.setCitations(payload.citations);
                }
              }
            } catch (e) { /* ignore parse errors in trailing buffer */ }
          }
        }

        // Synchronously flush any remaining throttled updates before post-stream processing
        throttle.flush();
        throttle.dispose();

        // If the stream ended with no text tokens (e.g., orchestration completed but synthesis was empty),
        // ensure the user always sees a response
        if (!fullText.trim()) {
          fullText = `I completed the task but wasn't able to generate a summary. Please check your Google Drive or email for the results, or try asking me again.`;
          setMessages(prev => prev.map(m =>
            m.id === botMsgId ? { ...m, text: fullText } : m
          ));
        }
        // Push a 'done' event so ThinkingDisplay knows to stop its timer
        setMessages(prev => prev.map(m =>
          m.id === botMsgId 
            ? { ...m, agentEvents: [...(m.agentEvents || []), { type: 'done' as const, timestamp: Date.now() }] } 
            : m
        ));
        // Voice-over: read JARVIS response aloud via ElevenLabs TTS
        if (voiceoverEnabled && fullText.trim()) {
          playTTS(fullText);
        }
        // Detect email preview in executedTools and attach structured data to message
        if (data.executedTools && Array.isArray(data.executedTools)) {
          // If a send or draft action was executed, do NOT show a preview card — it's redundant
          const sendOrDraftTool = data.executedTools.find((t: any) => t.name === 'email' && (t.args?.action === 'send' || t.args?.action === 'draft'));
          if (!sendOrDraftTool) {
            const previewTool = data.executedTools.find((t: any) => t.name === 'email' && t.args?.action === 'preview');
            if (previewTool?.args) {
              const userMsg = textToSend.toLowerCase();
              let intent: 'send' | 'draft' | 'ambiguous' = 'ambiguous';
              if (/\b(draft|save.?a?.?draft|prepare.?a?.?draft)\b/i.test(userMsg)) intent = 'draft';
              else if (/\b(send|fire.?off|shoot|email\s+them|message\s+them)\b/i.test(userMsg)) intent = 'send';
              const emailPreview: EmailPreviewData = {
                to: previewTool.args.to || '',
                subject: previewTool.args.subject || '',
                body: (previewTool.args.body || '').replace(/\\n/g, '\n'),
                intent,
              };
              // Strip the raw preview text from LLM response — the card component will handle display
              setMessages(prev => prev.map(m => {
                if (m.id !== botMsgId) return m;
                let cleanText = m.text;
                // Remove EMAIL_PREVIEW_START...END block if present
                cleanText = cleanText.replace(/EMAIL_PREVIEW_START[\s\S]*?EMAIL_PREVIEW_END\s*/g, '');
                // Since executedTools confirms this is a preview, aggressively strip everything
                // and keep only a trailing follow-up question if present
                const questionMatch = cleanText.match(/(Ready to (?:send|save as draft)\??|Would you like me to (?:send|save).*?\??|Send it now.*?\??|Shall I (?:send|save).*?\??)/i);
                cleanText = questionMatch ? questionMatch[0] : '';
                return { ...m, text: cleanText, emailPreview };
              }));
            }
          }
        }
        setPendingCitations([]);
      } else {
        // Fallback: non-streaming JSON response (shouldn't happen in normal flow)
        data = await res.json();
        const botCitations = data.citations && Array.isArray(data.citations) ? data.citations : [];
        setMessages(prev => prev.map(m =>
          m.id === botMsgIdEarly
            ? { ...m, text: data.response, agentEvents: [{ type: 'done' as const, timestamp: Date.now() }], citations: botCitations.length > 0 ? botCitations : undefined }
            : m
        ));
        setPendingCitations([]);
        // Voice-over: read JARVIS response aloud via ElevenLabs TTS (non-streaming path)
        if (voiceoverEnabled && data.response?.trim()) {
          playTTS(data.response);
        }
      }



      logActivity(firestore, 'ai_chat_sent', { email: user?.email || '', displayName: user?.displayName }, 'Sent AI chat message to ' + (agent?.name || params.agentId), { messagePreview: textToSend.substring(0, 200) });

      // Generate AI title for new sessions after first exchange
      const activeSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
      if (activeSession && (activeSession.title === "New Chat" || !activeSession.title)) {
        fetch("/api/chat", {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            messages: [
              { role: "system", content: "You are a title generator. Given a user message and AI response, output ONLY a short comma-separated list of 3-5 key topic words that summarize the conversation. No full sentences, no quotes, no explanation. Example output: US History, D-Day, Normandy Beaches" },
              { role: "user", content: `User said: ${textToSend}\nAI replied: ${data.response.substring(0, 200)}` }
            ],
            agentId: `${orgId}_jarvis`,
            soul: "",
            brain: "",
          }),
        }).then(r => r.json()).then(titleData => {
          if (titleData.response) {
            const aiTitle = titleData.response.replace(/["']/g, '').trim().substring(0, 60);
            chatStore.updateSessionTitle(currentSessionId!, aiTitle);
          }
        }).catch(() => {
          // Fallback: use first few words of user message
          const fallback = textToSend.split(' ').slice(0, 6).join(' ');
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
      if (user?.uid && pactEnabled) {
        // Build recent history (last 3 exchanges = up to 6 messages) for multi-turn context
        const recentMsgs = newMessages.slice(-6).map(m => ({ role: m.isSelf ? "user" : "assistant", content: m.text }));
        fetch("/api/pact/extract", {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            userMessage: textToSend,
            aiResponse: data.response,
            userName: user?.displayName || undefined,
            uid: user.uid,
            orgId: orgId,
            recentHistory: recentMsgs.length > 2 ? recentMsgs.slice(0, -2) : undefined
          })
        }).then(res => res.json()).then(async (extractData) => {
          if (extractData.facts && extractData.facts.length > 0 && user?.uid) {
            const headers = await getAuthHeaders();
            for (const f of extractData.facts) {
              await fetch('/api/pact/memories', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  scope: chatScope || 'user',
                  orgId,
                  question: f.question,
                  answer: f.answer,
                  category: f.category || 'preference',
                  confidence: f.confidence || 'medium',
                  source: 'chat_extraction',
                }),
              }).catch(console.error);
            }
            setTimeout(fetchPACTEntries, 1000);
          }
        }).catch(console.error);
      }

    } catch (error: any) {
      console.error("[handleSendMessage] Error:", error?.message || error);
      const errorMsg = error?.message || "";
      // Provide user-friendly error messages
      let friendlyError = "Hmm, something went wrong on my end. Let me try that again...";
      if (errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError") || errorMsg.includes("net::")) {
        friendlyError = "I'm having trouble connecting. Please check your internet connection and try again.";
      } else if (errorMsg.includes("timeout") || errorMsg.includes("Timeout")) {
        friendlyError = "That took longer than expected. Let me try again with a simpler approach.";
      }

      // Auto-retry once on generic errors
      if (!errorMsg.includes("Failed to fetch") && !errorMsg.includes("NetworkError")) {
        try {
          console.log("[handleSendMessage] Auto-retrying...");
          const retryMessages = newMessages.map(m => ({ role: m.isSelf ? "user" : "assistant", content: m.text }));
          const retryRes = await fetch("/api/chat", {
            method: "POST",
            headers: await getAuthHeaders(),
            body: JSON.stringify({
              messages: retryMessages,
              agentId: `${orgId}_${params.agentId}`,
              soul: agentConfig.soul,
              brain: agentConfig.brain,
              uid: user?.uid,
              refreshToken: rToken,
              contacts: agentContacts,
              knowledgeBaseText: kbText,
              orgBrainText: orgBrain,
              personalBrainText,
              pactText,
              userName: user?.displayName || undefined,
              model: selectedModel,
              crmData: crmContacts || undefined,
              crmInstanceId: crmActiveInstanceId,
              crmInstances: crmAvailableInstances.length > 0 ? crmAvailableInstances : [{ id: "default", name: "All Contacts" }]
            }),
          });
          const retryData = await retryRes.json();
          if (retryData.response && retryData.response.length > 5) {
            setMessages(prev => prev.map(m => m.id === botMsgIdEarly ? { ...m, text: retryData.response, agentEvents: [{ type: 'done' as const, timestamp: Date.now() }] } : m));
            setIsTyping(false);
            return;
          }
        } catch (retryErr) {
          console.error("[handleSendMessage] Retry also failed:", retryErr);
        }
      }

      setMessages(prev => prev.map(m => m.id === botMsgIdEarly ? { ...m, text: friendlyError, agentEvents: [{ type: 'done' as const, timestamp: Date.now() }] } : m));
    } finally {
      setIsTyping(false);
      setPendingCitations([]);
      // Transition session from 'thinking' to 'unread' (or 'idle' if user is still viewing it)
      if (currentSessionId) chatStore.setSessionUnread(currentSessionId);
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
      try {
        await chatStore.createSession(orgId, "New Chat");
      } catch {
        const newSession: Session = { id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, title: "New Chat", updatedAt: Date.now(), scope: chatScope, messages: [] };
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
      }
    }

    // Add msg to main chat
    const userMsg: Message = { id: uid(), text: msgText, isSelf: true };
    const realMessages = messages.filter(m => m.isSelf || messages.some(um => um.isSelf));
    const newMessages = [...realMessages, userMsg];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      let rToken = null;
      if (user?.uid && firestore) {
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
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          messages: apiMessages,
          agentId: `${orgId}_${params.agentId}`,
          soul: `${agentConfig.soul ? `[ORGANIZATION VOICE & PERSONALITY]\n${agentConfig.soul}\n\n` : ''}${sessionInstructions ? `\n\n[SESSION INSTRUCTIONS]\n${sessionInstructions}` : ''}\n\n[RELATIONSHIP & CRM INTELLIGENCE]\nYou have direct access to the user's CRM contact database and relationship memories (personal facts, sports fandom, hobbies, background). When asked about contacts, leverage these details naturally. For deep contact history, research dossiers, or past interaction timelines, ALWAYS call crm_get_contact_profile.\n\n[USER CONTEXT]\nAct on behalf of this user. The user's email address is: ${user?.email || 'Unknown'}. Do not ask them for their email.`,
          brain: agentConfig.brain,
          uid: user?.uid,
          refreshToken: rToken,
          contacts: agentContacts,
          knowledgeBaseText: kbText,
          orgBrainText: orgBrain,
          personalBrainText,
          pactText,
          userName: user?.displayName || undefined,
          model: selectedModel,
          crmData: crmContacts || undefined,
          crmInstanceId: crmActiveInstanceId,
          crmInstances: crmAvailableInstances.length > 0 ? crmAvailableInstances : [{ id: "default", name: "All Contacts" }]
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
      if (data.pactFacts && data.pactFacts.length > 0 && user?.uid) {
        (async () => {
          try {
            const headers = await getAuthHeaders();
            for (const f of data.pactFacts) {
              await fetch('/api/pact/memories', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  scope: chatScope || 'user',
                  orgId,
                  question: f.question,
                  answer: f.answer,
                  category: f.category || 'preference',
                  confidence: f.confidence || 'medium',
                  source: 'chat_extraction',
                }),
              }).catch(console.error);
            }
            fetchPACTEntries();
            console.log(`[PACT] Saved ${data.pactFacts.length} facts (observer, unified path)`);
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
      const headers = await getAuthHeaders();
      delete (headers as Record<string, string>)["Content-Type"];
      const res = await fetch("/api/knowledge/ingest", { method: "POST", headers, body: formData });
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

  const resizeImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve('');
        return;
      }
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
          resolve(dataUrl);
        };
        img.onerror = () => resolve('');
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Global paste listener — catches image pastes regardless of which element has focus
  // Much more reliable than onPaste on <input> which may not forward file clipboard items on some browsers
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        const previews = files.map(f => ({
          file: f,
          preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
        }));
        setPendingAttachments(prev => [...prev, ...previews]);
      }
    };
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const removePendingAttachment = (idx: number) => {
    setPendingAttachments(prev => {
      const removed = prev[idx];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Attachment download / preview handler
  const [downloadingAttachment, setDownloadingAttachment] = useState<string | null>(null);
  const handleAttachmentAction = async (messageId: string, att: { filename: string; mimeType: string; size: number; attachmentId?: string }, mode: 'download' | 'preview') => {
    if (!att.attachmentId || !user?.uid || !firestore) return;
    setDownloadingAttachment(`${messageId}-${att.attachmentId}`);
    try {
      const docSnap = await getDoc(doc(firestore, "users", user.uid));
      const userData = docSnap.data();
      let rToken = userData?.[`gmailOAuth_${params.agentId}`]?.refreshToken
        || (userData?.gmailOAuth_jarvis?.refreshToken || userData?.gmailOAuth_morpheus?.refreshToken)
        || userData?.gmailOAuth_email?.refreshToken
        || userData?.[`gmailOAuth_inbound-email`]?.refreshToken
        || userData?.gmailOAuth?.refreshToken;
      if (!rToken) throw new Error("Missing Refresh Token");

      const res = await fetch("/api/webhooks/gmail/attachment", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ uid: user.uid, refreshToken: rToken, messageId, attachmentId: att.attachmentId }),
      });

      if (!res.ok) throw new Error("Failed to fetch attachment");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (mode === 'preview') {
        // Open in new tab for previewable types
        window.open(url, '_blank');
      } else {
        // Download
        const a = document.createElement('a');
        a.href = url;
        a.download = att.filename || 'attachment';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error("Attachment error:", err);
    } finally {
      setDownloadingAttachment(null);
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
        headers: await getAuthHeaders(),
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
        headers: await getAuthHeaders(),
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
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          uid: user.uid,
          refreshToken: rToken,
          agentId: `${orgId}_${params.agentId}`,
          soul: agentConfig.soul,
          brain: agentConfig.brain,
          selectedEmailIds: Array.from(selectedEmails),
          contacts: agentContacts,
          knowledgeBaseText: kbText,
          orgBrainText: orgBrain,
          personalBrainText,
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

  return (
    <>
    <style>{`
      /* Override dashboard layout padding for Agent Manager — fills edge-to-edge */
      main.flex-1 { padding: 0 !important; overflow: hidden !important; height: 100% !important; max-height: 100% !important; }
      /* Lock the entire viewport — only the internal chat message list should scroll */
      html, body {
        overflow: hidden !important;
        overscroll-behavior: none !important;
        height: 100% !important;
        height: 100dvh !important;
        width: 100% !important;
        max-width: 100vw !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
    <div className={`flex w-full flex-1 min-h-0 overflow-hidden font-sans selection:bg-stone-300/40 ${isDarkMode ? 'bg-[#212121] text-[#ECECEC] border-t border-[#383838]' : 'bg-[#FAF9F5] text-[#1F1E1D] border-t border-[#E5E4DE]'}`} style={{ height: '100%' }}>

      {/* Sessions Sidebar */}
      <div className={`hidden md:flex flex-col shrink-0 z-20 relative overflow-hidden ${isDarkMode ? 'bg-[#171717] border-r border-[#383838]' : 'bg-[#F3F2EC] border-r border-[#E5E4DE]'}`} style={{ width: isChatSidebarCollapsed ? 40 : chatSidebarWidth, minWidth: isChatSidebarCollapsed ? 40 : 180, maxWidth: 500, transition: sidebarResizeRef.current ? 'none' : 'width 0.3s ease' }}>
        {/* Collapse/Expand Toggle */}
        <div className={`flex items-center ${isChatSidebarCollapsed ? 'justify-center' : 'justify-end'} px-2 pt-2 pb-1 shrink-0`}>
          <button
            onClick={() => setIsChatSidebarCollapsed(!isChatSidebarCollapsed)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isDarkMode ? 'text-[#737373] hover:text-[#ECECEC] hover:bg-[#2F2F2F]' : 'text-[#9C978D] hover:text-[#1F1E1D] hover:bg-[#EAE7DF]'}`}
            title={isChatSidebarCollapsed ? 'Expand chat history' : 'Collapse chat history'}
          >
            {isChatSidebarCollapsed ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" /></svg>
            )}
          </button>
        </div>

        {!isChatSidebarCollapsed && (
          <>
            {/* Sidebar header unchanged for brevity (Using standard implementation) */}
            <div className={`p-3 flex flex-col gap-2 ${isDarkMode ? 'border-b border-[#383838]' : 'border-b border-[#E5E4DE]'}`}>
              {/* Compact Model Selector */}
              <div className="relative" data-dropdown="model">
                <button
                  onClick={() => {
                    if (!isModelDropdownOpen) setIsAgentSwitcherOpen(false);
                    setIsModelDropdownOpen(!isModelDropdownOpen);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${isDarkMode ? 'border-[#383838] bg-[#2F2F2F] hover:bg-[#353535]' : 'border-[#E5E4DE] bg-white hover:bg-[#F3F2EC]'}`}
                >
                  <span className={`text-xs font-medium truncate ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`}>
                    {[
                      {id:'openai/gpt-oss-120b',name:'GPT OSS 120B'},
                      {id:'qwen/qwen3.6-27b',name:'Qwen 3.6 27B'},
                      {id:'nemotron-3-ultra',name:'Nemotron 3 Ultra'},
                      {id:'claude-opus-5',name:'Claude Opus 5'},
                      {id:'gpt-5.6-sol',name:'GPT-5.6 Sol'},
                      {id:'gemini-3.5-flash',name:'Gemini 3.5 Flash'},
                    ].find(m => m.id === selectedModel)?.name || 'GPT OSS 120B'}
                  </span>
                  <svg className={`w-3.5 h-3.5 transition-transform ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'} ${isModelDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isModelDropdownOpen && (
                  <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 max-h-[70vh] overflow-y-auto ${isDarkMode ? 'bg-[#2F2F2F] border border-[#383838]' : 'bg-white border border-[#E5E4DE]'}`}>
                    {/* Standard Models Section */}
                    <div className={`px-4 pt-3 pb-1 ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>
                      <span className="text-[9px] font-bold uppercase tracking-widest">Standard</span>
                    </div>
                    {[
                      { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', desc: '500 t/s — most powerful open model', tag: 'Default', tagColor: isDarkMode ? 'bg-[#383838] text-[#B4B4B4]' : 'bg-[#EAE7DF] text-[#6B6860]' },
                      { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B', desc: 'Strong reasoning model', tag: 'Reliable', tagColor: isDarkMode ? 'bg-[#383838] text-[#B4B4B4]' : 'bg-[#EAE7DF] text-[#6B6860]' },
                      { id: 'nemotron-3-ultra', name: 'Nemotron 3 Ultra', desc: 'NVIDIA 550B MoE — 1M context', tag: 'Free', tagColor: isDarkMode ? 'bg-[#383838] text-[#B4B4B4]' : 'bg-[#EAE7DF] text-[#6B6860]' },
                    ].map(model => {
                      const isLocked = isDemoUser && model.id !== 'nemotron-3-ultra';
                      return (
                      <button
                        key={model.id}
                        disabled={isLocked}
                        onClick={() => {
                          if (isLocked) return;
                          setSelectedModel(model.id);
                          setIsModelDropdownOpen(false);
                          if (typeof window !== 'undefined') localStorage.setItem(`${orgId}_selectedModel`, model.id);
                          setMessages(prev => [...prev, { id: `switch-${Date.now()}`, text: `Switched to **${model.name}**. Token rates vary.`, isSelf: false }]);
                          console.log(`%c[MODEL SWITCH] → ${model.name} (${model.id})`, 'color: #f59e0b; font-weight: bold; font-size: 13px');
                        }}
                        className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${isDarkMode ? `hover:bg-[#383838] ${selectedModel === model.id ? 'bg-[#383838]' : ''}` : `hover:bg-[#F3F2EC] ${selectedModel === model.id ? 'bg-[#F3F2EC]' : ''}`}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {selectedModel === model.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                          <div className="min-w-0">
                            <span className={`text-sm font-medium block ${isLocked ? 'line-through' : ''} ${isDarkMode ? (selectedModel === model.id ? 'text-white' : 'text-[#B4B4B4]') : (selectedModel === model.id ? 'text-[#1F1E1D]' : 'text-[#6B6860]')}`}>{model.name}</span>
                            <span className={`text-[10px] block ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>{model.desc}</span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${isLocked ? (isDarkMode ? 'bg-[#383838] text-[#737373]' : 'bg-[#EAE7DF] text-[#9C978D]') : model.tagColor}`}>{isLocked ? 'Locked' : model.tag}</span>
                      </button>
                      );
                    })}
                    {/* Premium Models Section */}
                    <div className={`px-4 pt-3 pb-1 border-t ${isDarkMode ? 'text-[#737373] border-[#383838]' : 'text-[#9C978D] border-[#E5E4DE]'}`}>
                      <span className="text-[9px] font-bold uppercase tracking-widest">Frontier</span>
                    </div>
                    {[
                      { id: 'claude-opus-5', name: 'Claude Opus 5', desc: 'Anthropic flagship — deepest reasoning', tag: 'Elite', tagColor: isDarkMode ? 'bg-[#383838] text-[#B4B4B4]' : 'bg-[#EAE7DF] text-[#6B6860]' },
                      { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', desc: 'OpenAI flagship — strongest overall', tag: 'Elite', tagColor: isDarkMode ? 'bg-[#383838] text-[#B4B4B4]' : 'bg-[#EAE7DF] text-[#6B6860]' },
                      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', desc: 'Google — fast & smart, 1M context', tag: 'Smart', tagColor: isDarkMode ? 'bg-[#383838] text-[#B4B4B4]' : 'bg-[#EAE7DF] text-[#6B6860]' },
                    ].map(model => {
                      const isLocked = isDemoUser;
                      return (
                      <button
                        key={model.id}
                        disabled={isLocked}
                        onClick={() => {
                          if (isLocked) return;
                          setSelectedModel(model.id);
                          setIsModelDropdownOpen(false);
                          if (typeof window !== 'undefined') localStorage.setItem(`${orgId}_selectedModel`, model.id);
                          setMessages(prev => [...prev, { id: `switch-${Date.now()}`, text: `Switched to **${model.name}**. Token rates vary.`, isSelf: false }]);
                          console.log(`%c[MODEL SWITCH] → ${model.name} (${model.id})`, 'color: #f59e0b; font-weight: bold; font-size: 13px');
                        }}
                        className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${isDarkMode ? `hover:bg-[#383838] ${selectedModel === model.id ? 'bg-[#383838]' : ''}` : `hover:bg-[#F3F2EC] ${selectedModel === model.id ? 'bg-[#F3F2EC]' : ''}`}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {selectedModel === model.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                          <div className="min-w-0">
                            <span className={`text-sm font-medium block ${isLocked ? 'line-through' : ''} ${isDarkMode ? (selectedModel === model.id ? 'text-white' : 'text-[#B4B4B4]') : (selectedModel === model.id ? 'text-[#1F1E1D]' : 'text-[#6B6860]')}`}>{model.name}</span>
                            <span className={`text-[10px] block ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>{model.desc}</span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${isLocked ? (isDarkMode ? 'bg-[#383838] text-[#737373]' : 'bg-[#EAE7DF] text-[#9C978D]') : model.tagColor}`}>{isLocked ? 'Locked' : model.tag}</span>
                      </button>
                      );
                    })}
                    {/* Demo disclaimer */}
                    {isDemoUser && (
                      <div className={`px-4 py-2.5 text-[10px] border-t ${isDarkMode ? 'text-[#737373] border-[#383838] bg-[#2A2A2A]' : 'text-[#9C978D] border-[#E5E4DE] bg-[#F3F2EC]'}`}>
                        Demo accounts use the free Nemotron model only. Upgrade to an organization account for premium AI.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Compact System Instructions trigger */}
              <button
                onClick={() => setIsSystemInstructionsOpen(true)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${isDarkMode ? 'border-[#383838] bg-[#2F2F2F] hover:bg-[#353535]' : 'border-[#E5E4DE] bg-white hover:bg-[#F3F2EC]'}`}
              >
                <span className={`text-xs font-medium truncate ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`}>
                  {sessionInstructions ? sessionInstructions.substring(0, 30) + (sessionInstructions.length > 30 ? '…' : '') : 'System instructions'}
                </span>
                {sessionInstructions && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-hide mt-2">
              {/* Agent Library Button */}
              
                        {/* Scope Toggle — User vs Org context */}
                        <div className="mb-3 px-1">
                          <ScopeToggle isDarkMode={isDarkMode} orgName={getOrgConfig(orgId)?.label} orgId={orgId} />
                        </div>
                        <div className="flex items-center justify-between mb-2 px-1">
                          <span className={`text-xs font-semibold uppercase tracking-widest ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'}`}>{chatScope === 'org' ? 'Team Chats' : 'Chat History'}</span>
                          <button onClick={() => setIsChatSidebarCollapsed(true)} className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${isDarkMode ? 'text-[#737373] hover:text-[#ECECEC] hover:bg-[#2F2F2F]' : 'text-[#9C978D] hover:text-[#1F1E1D] hover:bg-[#EAE7DF]'}`} title="Collapse sidebar">
                            <svg className="w-3 h-3 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </button>
                        </div>
              <button onClick={() => startNewSession()} className={`w-full text-left p-3 rounded-xl border border-dashed transition-colors flex items-center gap-3 mb-4 group ${isDarkMode ? 'border-[#383838] bg-[#2F2F2F] hover:bg-[#353535]' : 'border-[#D5D3CC] bg-white hover:bg-[#F3F2EC]'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'bg-[#383838] text-[#B4B4B4] group-hover:bg-[#444]' : 'bg-[#EAE7DF] text-[#6B6860] group-hover:bg-[#E0DDD4]'}`}>
                  <SquarePen className="w-4 h-4" />
                </div>
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'}`}>New Chat</span>
              </button>
              {sessions.filter(s => s.messages.filter(m => m.isSelf).length > 0 || s.title !== "New Chat" || sessionStatuses?.[s.id] === 'thinking' || sessionStatuses?.[s.id] === 'unread').length === 0 && (
                <div className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'} px-1 py-4 text-center`}>No conversations yet.<br/>Start typing below to begin.</div>
              )}
              {sessions.filter(s => s.messages.filter(m => m.isSelf).length > 0 || s.title !== "New Chat" || sessionStatuses?.[s.id] === 'thinking' || sessionStatuses?.[s.id] === 'unread').map(s => (
                <div key={s.id} onClick={() => loadSession(s.id)} className={`group cursor-pointer flex items-center w-full px-3 mt-1 min-h-[40px] py-2 rounded-lg transition-all ${isDarkMode ? (activeSessionId === s.id ? (s.scope === 'org' ? 'bg-emerald-900/20 text-white border border-emerald-800' : 'bg-[#2F2F2F] text-white border border-[#383838]') : 'text-[#737373] hover:text-[#ECECEC] hover:bg-[#2A2A2A]') : (activeSessionId === s.id ? (s.scope === 'org' ? 'bg-emerald-50/50 text-[#1F1E1D] border border-emerald-200/50' : 'bg-[#EAE7DF] text-[#1F1E1D] border border-[#E5E4DE]') : 'text-[#6B6860] hover:text-[#1F1E1D] hover:bg-[#EAE7DF]')}`}>
                  {renderSessionIcon(s)}
                  <span className="text-sm font-medium flex-1 break-words leading-snug">{stripMarkdown(s.title)}</span>
                  <button onClick={(e) => deleteSession(e, s.id)} className={`opacity-60 sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-500 transition-all ml-1 p-1 rounded-md ${isDarkMode ? 'hover:bg-[#2F2F2F]' : 'hover:bg-[#EAE7DF]'}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

      </div>

      {/* Sidebar Resize Handle */}
      <div
        className="hidden md:flex w-[5px] cursor-col-resize items-center justify-center group hover:bg-stone-400/20 active:bg-stone-400/30 transition-colors relative z-30 shrink-0"
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
        <div className={`w-[2px] h-8 rounded-full transition-colors ${isDarkMode ? 'bg-[#383838] group-hover:bg-[#737373]' : 'bg-[#E5E4DE] group-hover:bg-[#9C978D]'}`} />
      </div>

      {/* Sidebar Collapse Toggle */}
      {isChatSidebarCollapsed && (
        <button
          onClick={() => setIsChatSidebarCollapsed(false)}
          className={`hidden md:flex w-6 h-12 shadow-sm rounded-r-lg items-center justify-center transition-all z-30 cursor-pointer shrink-0 my-auto ${isDarkMode ? 'bg-[#2F2F2F] border border-[#383838] text-[#737373] hover:text-[#ECECEC] hover:bg-[#353535]' : 'bg-white border border-[#E5E4DE] text-[#9C978D] hover:text-[#1F1E1D] hover:bg-[#F3F2EC]'}`}
          title="Expand sidebar"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          {/* Slide-in panel */}
          <div className={`absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 ${isDarkMode ? 'bg-[#171717]' : 'bg-[#F3F2EC]'}`}>
            <div className={`p-4 flex items-center justify-between ${isDarkMode ? 'border-b border-[#383838]' : 'border-b border-[#E5E4DE]'}`}>
              <span className={`text-sm font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'}`}>{chatScope === 'org' ? 'Team Chats' : 'Chat History'}</span>
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-[#737373] hover:text-[#ECECEC] hover:bg-[#2F2F2F]' : 'text-[#9C978D] hover:text-[#1F1E1D] hover:bg-[#EAE7DF]'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-3 pt-3 pb-1 shrink-0">
              {/* Scope Toggle — User vs Org context */}
              <div className="mb-3">
                <ScopeToggle isDarkMode={isDarkMode} orgName={getOrgConfig(orgId)?.label} orgId={orgId} />
              </div>
              <button onClick={() => { startNewSession(); setIsMobileSidebarOpen(false); }} className={`w-full text-left p-3 rounded-xl border border-dashed transition-colors flex items-center gap-3 group ${isDarkMode ? 'border-[#383838] bg-[#2F2F2F] hover:bg-[#353535]' : 'border-[#D5D3CC] bg-white hover:bg-[#F3F2EC]'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'bg-[#383838] text-[#B4B4B4] group-hover:bg-[#444]' : 'bg-[#EAE7DF] text-[#6B6860] group-hover:bg-[#E0DDD4]'}`}>
                  <SquarePen className="w-4 h-4" />
                </div>
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'}`}>New Chat</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-hide">
              {sessions.filter(s => s.messages.filter(m => m.isSelf).length > 0 || s.title !== "New Chat" || sessionStatuses?.[s.id] === 'thinking' || sessionStatuses?.[s.id] === 'unread').length === 0 && (
                <div className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'} px-1 py-4 text-center`}>No conversations yet.<br/>Start typing below to begin.</div>
              )}
              {sessions.filter(s => s.messages.filter(m => m.isSelf).length > 0 || s.title !== "New Chat" || sessionStatuses?.[s.id] === 'thinking' || sessionStatuses?.[s.id] === 'unread').map(s => (
                <div
                  key={s.id}
                  onClick={() => { loadSession(s.id); setIsMobileSidebarOpen(false); }}
                  className={`group cursor-pointer flex items-center w-full px-3 mt-1 min-h-[44px] py-2.5 rounded-lg transition-all ${isDarkMode ? (activeSessionId === s.id ? (s.scope === 'org' ? 'bg-emerald-900/20 text-white border border-emerald-700' : 'bg-[#2F2F2F] text-white border border-[#383838]') : 'text-[#737373] hover:text-[#ECECEC] hover:bg-[#2A2A2A]') : (activeSessionId === s.id ? (s.scope === 'org' ? 'bg-emerald-50/50 text-[#1F1E1D] border border-emerald-200' : 'bg-[#EAE7DF] text-[#1F1E1D] border border-[#E5E4DE]') : 'text-[#6B6860] hover:text-[#1F1E1D] hover:bg-[#EAE7DF]')}`}
                >
                  {renderSessionIcon(s)}
                  <span className="text-sm font-medium flex-1 break-words leading-snug">{stripMarkdown(s.title)}</span>
                  <button onClick={(e) => deleteSession(e, s.id)} className={`opacity-60 hover:text-red-500 transition-all ml-1 p-1 rounded-md ${isDarkMode ? 'hover:bg-red-900/30' : 'hover:bg-red-50'}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main UI Pane */}
      <div className={`flex-1 flex flex-col h-full relative z-10 overflow-hidden ${isDarkMode ? 'bg-[#212121]' : 'bg-[#FAF9F5]'}`}>

        {/* Background — clean editorial surface, no ambient glow */}

        {/* Top Navigator */}
        <div className={`h-11 sm:h-16 flex items-center justify-between px-3 sm:px-6 shrink-0 z-20 sticky top-0 ${isDarkMode ? 'bg-[#212121] border-b border-[#383838]' : 'bg-[#FAF9F5] border-b border-[#E5E4DE]'}`}>
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile hamburger menu */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className={`md:hidden p-2 -ml-1 rounded-lg transition-colors shrink-0 ${isDarkMode ? 'text-[#737373] hover:text-[#ECECEC] hover:bg-[#2F2F2F]' : 'text-[#9C978D] hover:text-[#1F1E1D] hover:bg-[#EAE7DF]'}`}
              title="Chat history"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className={`font-bold text-xs sm:text-sm tracking-wide opacity-80 truncate ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'}`}>
              {(() => {
                if (!activeSessionId || messages.filter(m => m.isSelf).length === 0) return '';
                const title = sessions.find(s => s.id === activeSessionId)?.title || '';
                return title === 'New Chat' ? '' : title;
              })()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Agent Switcher — moved to header for mobile space conservation */}
            <div className="relative" data-dropdown="agent-switcher">
              <button
                onClick={() => {
                  if (!isAgentSwitcherOpen) setIsModelDropdownOpen(false);
                  setIsAgentSwitcherOpen(!isAgentSwitcherOpen);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  isAgentSwitcherOpen
                    ? (isDarkMode ? 'bg-[#383838] text-[#ECECEC]' : 'bg-[#E0DDD4] text-[#1F1E1D]')
                    : (isDarkMode ? 'bg-[#2F2F2F] text-[#B4B4B4] border border-[#383838]' : 'bg-white text-[#6B6860] border border-[#E5E4DE]')
                }`}
                title="Switch Agent"
              >
                {params.agentId === 'iris' ? <Palette className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                <span className="max-w-[80px] truncate">{agent.name.split(' (')[0]}</span>
                <ChevronDown className={`w-3 h-3 opacity-50 transition-transform ${isAgentSwitcherOpen ? 'rotate-180' : ''}`} />
              </button>
              {isAgentSwitcherOpen && (
                <div className={`absolute top-full right-0 mt-1 rounded-xl shadow-2xl border overflow-hidden z-[60] min-w-[240px] animate-in fade-in slide-in-from-top-2 duration-200 ${isDarkMode ? 'bg-[#2F2F2F] border-[#383838]' : 'bg-white border-[#E5E4DE]'}`}>
                  <div className={`px-4 py-2 border-b ${isDarkMode ? 'border-[#383838]' : 'border-[#E5E4DE]'}`}>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>Switch Agent</span>
                  </div>
                  {Object.entries(agents).map(([id, ag]) => {
                    const isCurrent = id === params.agentId;
                    const isAvailable = id === 'jarvis' || id === 'iris';
                    const subtitle = id === 'iris' ? 'Creative Studio' : id === 'bobby' ? 'Workflow Maestro' : id === 'monica' ? 'Compliance Controller' : 'Chief of Staff';
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          if (!isAvailable) return;
                          setIsAgentSwitcherOpen(false);
                          if (!isCurrent) {
                            router.push(`/portal/dashboard/${orgId}/ai-agents/${id}`);
                          }
                        }}
                        disabled={isCurrent || !isAvailable}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                          !isAvailable
                            ? 'opacity-40 cursor-not-allowed'
                            : isCurrent
                              ? (isDarkMode ? 'bg-[#383838] cursor-default' : 'bg-[#F3F2EC] cursor-default')
                              : (isDarkMode ? 'hover:bg-[#383838] cursor-pointer' : 'hover:bg-[#F3F2EC] cursor-pointer')
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isCurrent
                            ? (isDarkMode ? 'bg-[#444] border border-[#383838]' : 'bg-[#EAE7DF] border border-[#E5E4DE]')
                            : (isDarkMode ? 'bg-[#383838]' : 'bg-[#EAE7DF]')
                        }`}>
                          {id === 'iris' ? <Palette className={`w-4 h-4 ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`} /> : id === 'bobby' ? <Settings className={`w-4 h-4 ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`} /> : id === 'monica' ? <ShieldCheck className={`w-4 h-4 ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`} /> : <Bot className={`w-4 h-4 ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`} />}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className={`text-xs font-semibold truncate ${isCurrent ? (isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]') : (isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]')}`}>{ag.name.split(' (')[0]}</span>
                          <span className={`text-[10px] ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>
                            {isAvailable ? subtitle : 'Coming Soon'}
                          </span>
                        </div>
                        {isCurrent && (
                          <Check className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mobile-only model selector */}
            <div className="relative md:hidden" data-dropdown="model">
              <button
                onClick={() => {
                  if (!isModelDropdownOpen) setIsAgentSwitcherOpen(false);
                  setIsModelDropdownOpen(!isModelDropdownOpen);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${isDarkMode ? 'bg-[#2F2F2F] text-[#B4B4B4] border border-[#383838]' : 'bg-white text-[#6B6860] border border-[#E5E4DE]'}`}
              >
                <span className="max-w-[100px] truncate">
                  {[
                    {id:'openai/gpt-oss-120b',name:'GPT OSS 120B'},
                    {id:'qwen/qwen3.6-27b',name:'Qwen 3.6 27B'},
                    {id:'nemotron-3-ultra',name:'Nemotron 3 Ultra'},
                    {id:'claude-opus-5',name:'Claude Opus 5'},
                    {id:'gpt-5.6-sol',name:'GPT-5.6 Sol'},
                    {id:'gemini-3.5-flash',name:'Gemini 3.5 Flash'},
                  ].find(m => m.id === selectedModel)?.name || 'GPT OSS 120B'}
                </span>
                <svg className={`w-3 h-3 opacity-50 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {isModelDropdownOpen && (
                  <div className={`absolute top-full right-0 mt-1 w-64 rounded-xl shadow-xl z-[60] overflow-hidden max-h-[70vh] overflow-y-auto ${isDarkMode ? 'bg-[#2F2F2F] border border-[#383838]' : 'bg-white border border-[#E5E4DE]'}`}>
                  <div className={`px-3 pt-2.5 pb-1 ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>
                    <span className="text-[9px] font-bold uppercase tracking-widest">Standard</span>
                  </div>
                  {[
                    { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', tag: 'Default', tagColor: isDarkMode ? 'bg-[#383838] text-[#B4B4B4]' : 'bg-[#EAE7DF] text-[#6B6860]' },
                    { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B', tag: 'Reliable', tagColor: isDarkMode ? 'bg-[#383838] text-[#B4B4B4]' : 'bg-[#EAE7DF] text-[#6B6860]' },
                    { id: 'nemotron-3-ultra', name: 'Nemotron 3 Ultra', tag: 'Free', tagColor: isDarkMode ? 'bg-[#383838] text-[#B4B4B4]' : 'bg-[#EAE7DF] text-[#6B6860]' },
                  ].map(model => {
                    const isLocked = isDemoUser && model.id !== 'nemotron-3-ultra';
                    return (
                    <button
                      key={model.id}
                      disabled={isLocked}
                      onClick={() => {
                        if (isLocked) return;
                        setSelectedModel(model.id);
                        setIsModelDropdownOpen(false);
                        if (typeof window !== 'undefined') localStorage.setItem(`${orgId}_selectedModel`, model.id);
                        setMessages(prev => [...prev, { id: `switch-${Date.now()}`, text: `Switched to **${model.name}**.`, isSelf: false }]);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${isDarkMode ? `hover:bg-[#383838] ${selectedModel === model.id ? 'bg-[#383838]' : ''}` : `hover:bg-[#F3F2EC] ${selectedModel === model.id ? 'bg-[#F3F2EC]' : ''}`}`}
                    >
                      <div className="flex items-center gap-2">
                        {selectedModel === model.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        <span className={`text-xs font-medium ${isLocked ? 'line-through' : ''} ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`}>{model.name}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isLocked ? (isDarkMode ? 'bg-[#383838] text-[#737373]' : 'bg-[#EAE7DF] text-[#9C978D]') : model.tagColor}`}>{isLocked ? 'Locked' : model.tag}</span>
                    </button>
                    );
                  })}
                  <div className={`px-3 pt-2 pb-1 border-t ${isDarkMode ? 'text-[#737373] border-[#383838]' : 'text-[#9C978D] border-[#E5E4DE]'}`}>
                    <span className="text-[9px] font-bold uppercase tracking-widest">Frontier</span>
                  </div>
                  {[
                    { id: 'claude-opus-5', name: 'Claude Opus 5', tag: 'Elite', tagColor: isDarkMode ? 'bg-[#383838] text-[#B4B4B4]' : 'bg-[#EAE7DF] text-[#6B6860]' },
                    { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', tag: 'Elite', tagColor: isDarkMode ? 'bg-[#383838] text-[#B4B4B4]' : 'bg-[#EAE7DF] text-[#6B6860]' },
                    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', tag: 'Smart', tagColor: isDarkMode ? 'bg-[#383838] text-[#B4B4B4]' : 'bg-[#EAE7DF] text-[#6B6860]' },
                  ].map(model => (
                    <button
                      key={model.id}
                      disabled={isDemoUser}
                      onClick={() => {
                        if (isDemoUser) return;
                        setSelectedModel(model.id);
                        setIsModelDropdownOpen(false);
                        if (typeof window !== 'undefined') localStorage.setItem(`${orgId}_selectedModel`, model.id);
                        setMessages(prev => [...prev, { id: `switch-${Date.now()}`, text: `Switched to **${model.name}**.`, isSelf: false }]);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${isDemoUser ? 'opacity-40 cursor-not-allowed' : ''} ${isDarkMode ? `hover:bg-[#383838] ${selectedModel === model.id ? 'bg-[#383838]' : ''}` : `hover:bg-[#F3F2EC] ${selectedModel === model.id ? 'bg-[#F3F2EC]' : ''}`}`}
                    >
                      <div className="flex items-center gap-2">
                        {selectedModel === model.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        <span className={`text-xs font-medium ${isDemoUser ? 'line-through' : ''} ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`}>{model.name}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDemoUser ? (isDarkMode ? 'bg-[#383838] text-[#737373]' : 'bg-[#EAE7DF] text-[#9C978D]') : model.tagColor}`}>{isDemoUser ? 'Locked' : model.tag}</span>
                    </button>
                  ))}
                  {isDemoUser && (
                    <div className={`px-3 py-2 text-[9px] border-t ${isDarkMode ? 'text-[#737373] border-[#383838]' : 'text-[#9C978D] border-[#E5E4DE]'}`}>
                      Free model only. Upgrade for premium AI.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Main Body (Chat vs Settings vs Observer) */}
        <div className="flex-1 flex relative overflow-hidden">

          {/* Chat Wrapper */}
          <div className={`flex-1 flex flex-col relative z-10 transition-all duration-500 overflow-x-hidden h-full overflow-hidden min-h-0`}>
              <div className="flex-1 flex flex-col relative min-h-0">
                <div className={`flex-1 p-0 ${messages.length === 0 && !selectedExploreItem && !activeSessionId ? 'flex items-center justify-center overflow-hidden' : 'overflow-y-auto'}`} style={{ scrollbarGutter: 'stable' }}>
                  <div className={`${messages.length === 0 && !selectedExploreItem && !activeSessionId ? 'flex flex-col items-center justify-center w-full px-4' : 'mx-auto px-6 sm:px-8 md:px-12 pt-4 sm:pt-6 pb-4 sm:pb-8 max-w-4xl space-y-8'}`}>
                    {messages.length === 0 && !selectedExploreItem && !activeSessionId ? (
                      <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-xl mx-auto" style={{ fontFamily: 'var(--font-outfit), ui-sans-serif, system-ui, sans-serif' }}>
                        
                        {/* Clean editorial welcome */}
                        <div className="relative w-full">
                          
                          <div className={`relative rounded-[2rem] p-8 sm:p-10 transition-all duration-300`}>
                            <div className="flex flex-col items-center justify-center">
                              {/* Clean centered greeting */}
                              <div className="flex flex-col items-center gap-4 mb-8">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                                  isDarkMode
                                    ? 'bg-[#2F2F2F] border border-[#383838]'
                                    : 'bg-[#EAE7DF] border border-[#E5E4DE]'
                                }`}>
                                  {agent.heroIcon === 'palette'
                                    ? <Palette className={`w-7 h-7 ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`} />
                                    : agent.heroIcon === 'wrench'
                                    ? <Settings className={`w-7 h-7 ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`} />
                                    : agent.heroIcon === 'shield-check'
                                    ? <ShieldCheck className={`w-7 h-7 ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`} />
                                    : <Bot className={`w-7 h-7 ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`} />}
                                </div>
                                <h2 className={`text-xl sm:text-3xl md:text-5xl font-light ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'}`} style={{ letterSpacing: '-0.03em', fontFamily: 'var(--font-outfit), ui-sans-serif, system-ui, sans-serif' }}>
                                  {agent.name}
                                </h2>
                                <p className={`text-center text-sm max-w-md leading-relaxed ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`} style={{ letterSpacing: '-0.01em', fontFamily: 'var(--font-outfit), ui-sans-serif, system-ui, sans-serif' }}>
                                  {agent.heroDesc || 'Ask anything \u2014 from drafting emails and scheduling events to strategy advice and deep research.'}
                                </p>
                              </div>
                              
                              {/* Quick action suggestions */}
                              <div className="flex flex-wrap justify-center gap-2.5 max-w-lg px-2">
                                {(agent.quickActions || [
                                  { label: 'Draft an email', action: 'Draft an email' },
                                  { label: 'Schedule a meeting', action: 'Schedule a meeting' },
                                  { label: 'Research a topic', action: 'Research a topic' },
                                  { label: 'Add a contact', action: 'Add a contact' },
                                  { label: 'Edit contact book', action: 'Edit contact book' },
                                ]).map((suggestion) => (
                                  <button
                                    key={suggestion.label}
                                    onClick={() => handleSendMessage(suggestion.action)}
                                    className={`px-4 py-2.5 sm:px-3.5 sm:py-2 rounded-full text-xs sm:text-[11px] font-medium cursor-pointer border min-h-[38px] flex items-center transition-all duration-200 ${
                                      isDarkMode
                                        ? 'border-[#383838] bg-[#2F2F2F] text-[#B4B4B4] hover:bg-[#353535] hover:border-[#444] hover:text-[#ECECEC]'
                                        : 'border-[#E5E4DE] bg-white text-[#6B6860] hover:bg-[#F3F2EC] hover:border-[#D5D3CC] hover:text-[#1F1E1D]'
                                    }`}
                                    style={{ fontFamily: 'var(--font-outfit), ui-sans-serif, system-ui, sans-serif' }}
                                  >
                                    {suggestion.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                                                                  <>
                         <div className="hidden md:flex justify-center mb-10 pt-10 w-full">
                          <div className="text-lg sm:text-2xl md:text-3xl font-black opacity-10 tracking-[0.15em] sm:tracking-[0.3em] uppercase text-center w-full px-2 sm:px-4">{agent.name}</div>
                        </div>
                        {messages.map(msg => (
                      <div key={msg.id} className="space-y-1">
                        {/* Thinking display — OUTSIDE the message bubble, shown first */}
                        {!msg.isSelf && (msg.sendTimestamp || (msg.agentEvents && msg.agentEvents.length > 0)) && (
                          <div className="pl-1 sm:pl-2 mb-1">
                            <ThinkingDisplay events={msg.agentEvents || []} isDarkMode={isDarkMode} sendTimestamp={msg.sendTimestamp} />
                          </div>
                        )}
                        {/* Message row — only show when there's actual content (text or image) to display */}
                        {(msg.isSelf || msg.text || msg.imageUrl || msg.isPendingImage) && (
                        <div className={`flex items-start gap-2 sm:gap-3 ${msg.isSelf ? 'justify-end pr-1 sm:pr-2 pl-4 sm:pl-20' : 'justify-start pl-1 sm:pl-2 pr-4 sm:pr-20'}`}>
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border mt-0.5 ${msg.isSelf ? (isDarkMode ? 'bg-[#2F2F2F] border-[#383838] order-last' : 'bg-[#1F1E1D] border-[#1F1E1D] order-last') : (isDarkMode ? 'bg-[#2F2F2F] border-[#383838]' : 'bg-[#EAE7DF] border-[#E5E4DE]')}`}>{msg.isSelf ? <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : (isImageAgent ? <Palette className={`w-4 h-4 sm:w-5 sm:h-5 ${agent.accent}`} /> : isBobbyAgent ? <Settings className={`w-4 h-4 sm:w-5 sm:h-5 ${agent.accent}`} /> : isMonicaAgent ? <ShieldCheck className={`w-4 h-4 sm:w-5 sm:h-5 ${agent.accent}`} /> : <Bot className={`w-4 h-4 sm:w-5 sm:h-5 ${agent.accent}`} />)}</div>
                        <div className={`min-w-0 max-w-[88%] sm:max-w-[75%] ${msg.isSelf ? 'text-right' : 'group/msg relative'}`}>
                          {/* Copy & Pin action buttons — bot messages only, absolutely positioned to not affect layout */}
                          {!msg.isSelf && msg.text && (
                            <div className={`absolute -top-5 right-0 flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 z-10 ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>
                              <button
                                onClick={() => handleCopyMessage(msg.id, msg.text)}
                                className={`p-1 rounded-md transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-[#383838] text-[#737373] hover:text-[#ECECEC]' : 'hover:bg-[#EAE7DF] text-[#9C978D] hover:text-[#1F1E1D]'}`}
                                title={copiedMessageId === msg.id ? 'Copied!' : 'Copy'}
                              >
                                {copiedMessageId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleTogglePin(msg.id)}
                                className={`p-1 rounded-md transition-colors cursor-pointer ${pinnedMessages.has(msg.id) ? 'text-fuchsia-500' : ''} ${isDarkMode ? 'hover:bg-[#383838] text-[#737373] hover:text-[#ECECEC]' : 'hover:bg-[#EAE7DF] text-[#9C978D] hover:text-[#1F1E1D]'}`}
                                title={pinnedMessages.has(msg.id) ? 'Unpin' : 'Pin'}
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          <div className={`inline-block text-left text-sm sm:text-base max-w-full break-words animate-in fade-in duration-300 ${msg.isSelf ? `p-3 sm:p-4 rounded-2xl shadow-lg text-white ${isDarkMode ? 'bg-[#2F2F2F]' : 'bg-[#1F1E1D]'} rounded-tr-sm` : `pt-0.5 ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'} [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>strong]:font-bold [&>h2]:text-lg [&>h2]:font-bold [&>h2]:mt-4 [&>h2]:mb-2`} ${!msg.isSelf && pinnedMessages.has(msg.id) ? (isDarkMode ? 'border-l-2 border-[#737373] pl-4' : 'border-l-2 border-[#9C978D] pl-4') : ''}`}>
                            {msg.isPendingImage ? (
                              <div className="flex flex-col mb-2">
                                <style>{`
                                  @keyframes shimmer {
                                    0% { transform: translateX(-100%); }
                                    100% { transform: translateX(100%); }
                                  }
                                `}</style>
                                <div className={`relative overflow-hidden w-[260px] h-[260px] sm:w-[400px] sm:h-[400px] rounded-lg border animate-pulse ${
                                  isDarkMode 
                                    ? 'bg-[#2F2F2F] border-[#383838]' 
                                    : 'bg-white border-[#E5E4DE]'
                                }`}>
                                  <div 
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full" 
                                    style={{
                                      animation: 'shimmer 1.5s infinite',
                                      background: isDarkMode 
                                        ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' 
                                        : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)'
                                    }} 
                                  />
                                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                    <Palette className={`w-8 h-8 animate-bounce ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`} />
                                    <span className={`text-xs font-medium tracking-wide ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>
                                      Generating Image...
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {msg.imageUrl ? (
                              <div className="flex flex-col mb-2">
                                {msg.isSelf && (
                                  <span className={`text-xs font-semibold ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'} mb-2 truncate max-w-[200px]`}>
                                    {msg.text.startsWith('Uploaded image:') ? msg.text.replace('Uploaded image: ', '') : (msg.text === 'Uploaded image' || msg.text === 'Attached image' ? 'pasted-image.jpg' : 'image.jpg')}
                                  </span>
                                )}
                                <img
                                  src={msg.imageUrl}
                                  alt={msg.isSelf ? 'Uploaded Preview' : 'Generated Image'}
                                  className={`${msg.isSelf ? 'max-w-[200px] max-h-[200px] object-cover' : 'max-w-full sm:max-w-[400px] max-h-[400px] object-contain'} rounded-lg shadow-md cursor-pointer hover:opacity-90 transition-opacity`}
                                  onClick={() => setLightboxImage({ url: msg.imageUrl!, name: msg.isSelf ? (msg.text.startsWith('Uploaded image:') ? msg.text.replace('Uploaded image: ', '') : 'pasted-image.jpg') : 'generated-image.png' })}
                                />
                              </div>
                            ) : null}
                            
                            {msg.isSelf ? (
                              (msg.text !== 'Uploaded image' && msg.text !== 'Attached image' && !msg.text.startsWith('Uploaded image:')) && (
                                <div className={msg.imageUrl ? "mt-2" : ""}>{msg.text}</div>
                              )
                            ) : (
                              <>
                                {msg.text && (
                                  <div className={`${msg.imageUrl ? "mt-2" : ""} overflow-x-auto max-w-full [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_table]:block [&_table]:overflow-x-auto`}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => (<a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline underline-offset-2 break-all">{children}</a>) }}>
                                      {msg.text}
                                    </ReactMarkdown>
                                  </div>
                                )}
                                {/* Inline Email Preview Card */}
                                {msg.emailPreview && (
                                  <div className={`mt-3 rounded-xl border overflow-hidden ${isDarkMode ? 'border-[#383838] bg-[#2F2F2F]' : 'border-[#E5E4DE] bg-white'}`}>
                                    {/* Card Header */}
                                    <div className={`px-4 py-2.5 text-xs font-medium ${isDarkMode ? 'bg-[#383838] text-[#B4B4B4] border-b border-[#383838]' : 'bg-[#F3F2EC] text-[#6B6860] border-b border-[#E5E4DE]'}`}>
                                      📧 Email Preview
                                    </div>
                                    {/* Email Content */}
                                    <div className={`px-4 py-3 space-y-1.5 text-sm ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'}`}>
                                      <div><span className={`font-semibold ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>To:</span> {msg.emailPreview.to}</div>
                                      <div><span className={`font-semibold ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>Subject:</span> {msg.emailPreview.subject}</div>
                                      <div className={`mt-3 pt-3 whitespace-pre-wrap leading-relaxed ${isDarkMode ? 'border-t border-[#383838]' : 'border-t border-[#E5E4DE]'}`}>
                                        {msg.emailPreview.body.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                                          /^https?:\/\//.test(part)
                                            ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 underline break-all">{part}</a>
                                            : part
                                        )}
                                      </div>
                                    </div>
                                    {/* Card Footer with Actions */}
                                    <div className={`px-4 py-3 flex flex-col gap-3 ${isDarkMode ? 'bg-[#383838] border-t border-[#383838]' : 'bg-[#F3F2EC] border-t border-[#E5E4DE]'}`}>
                                      <span className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>
                                        {msg.emailPreview.intent === 'draft' ? 'Ready to save as draft?' : msg.emailPreview.intent === 'send' ? 'Ready to send?' : 'Send it now, or save as a draft?'}
                                      </span>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => {
                                            const confirmMsg = msg.emailPreview!.intent === 'draft' ? 'Yes, save as draft' : msg.emailPreview!.intent === 'send' ? 'Yes, send it' : 'Yes, send it';
                                            handleSendMessage(confirmMsg);
                                            // Remove the preview card after action
                                            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, emailPreview: undefined } : m));
                                          }}
                                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                                        >
                                          <CornerDownLeft className="w-3.5 h-3.5" />
                                          Run
                                        </button>
                                        <button
                                          onClick={() => {
                                            handleSendMessage("Cancel, don't do it");
                                            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, emailPreview: undefined } : m));
                                          }}
                                          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${isDarkMode ? 'bg-[#383838] hover:bg-[#444] text-[#B4B4B4]' : 'bg-[#EAE7DF] hover:bg-[#E0DDD4] text-[#6B6860]'}`}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          {/* Citation tile — below bot message */}
                          {!msg.isSelf && msg.citations && msg.citations.length > 0 && (
                            <div className="flex mt-1.5 animate-in fade-in duration-500">
                              <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium ${isDarkMode ? 'bg-[#2F2F2F] border border-[#383838] text-[#B4B4B4]' : 'bg-[#EAE7DF] border border-[#E5E4DE] text-[#6B6860]'}`}>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                <span>Knowledge Base</span>
                              </div>
                            </div>
                          )}
                        </div>
                        </div>
                        )}
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex gap-2 sm:gap-4 justify-start pl-2 sm:pl-4">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border ${isDarkMode ? 'bg-[#2F2F2F] border-[#383838]' : 'bg-[#EAE7DF] border-[#E5E4DE]'}`}><Bot className={`w-4 h-4 sm:w-5 sm:h-5 ${agent.accent}`} /></div>
                        <div className="space-y-1 pt-1 min-w-0">
                          <div className={`inline-block px-4 py-2.5 rounded-2xl rounded-tl-sm border backdrop-blur-md ${isDarkMode ? 'bg-[#2F2F2F] border-[#383838] text-[#737373]' : 'bg-white border-[#E5E4DE] text-[#9C978D]'} flex items-center gap-2`}>
                            <Loader2 className={`w-3.5 h-3.5 animate-spin ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`} />
                            <span className="text-xs">Thinking...</span>
                          </div>

                        </div>
                      </div>
                    )}
                      </>
                    )}
                    <div ref={bottomRef} className="h-4" />
                  </div>
                </div>

                {/* Chat input — ALWAYS visible at bottom */}
                <div className="w-full shrink-0 px-3 sm:px-4 pb-1 sm:pb-2 pt-1 sm:pt-2 z-20">
                  <div className="w-full max-w-4xl mx-auto flex flex-col gap-2 relative">
                    {/* Interaction Buttons Overlay */}
                    <div className="flex justify-between items-center px-1 pointer-events-none mb-1">
                    </div>

                    <div className="w-full flex items-center">
                    <div data-plus-menu className={`relative flex-1 min-w-0 border rounded-xl sm:rounded-2xl overflow-visible shadow-[0_4px_20px_-6px_rgba(0,0,0,0.15)] focus-within:ring-1 focus-within:ring-fuchsia-500 backdrop-blur-2xl flex flex-col ${isDarkMode ? 'bg-[#2F2F2F] border-[#383838]' : 'bg-white border-[#E5E4DE]'}`}>
                      {pendingAttachments.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-[#ede8da]/60 bg-[#faf6ed]/50">
                          {pendingAttachments.map((att, idx) => (
                            <div key={idx} className="relative shrink-0 group">
                              {att.preview ? (
                                <img src={att.preview} alt="" className="w-16 h-16 rounded-lg object-cover border border-[#ede8da] shadow-sm" />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-[#faf6ed] border border-[#ede8da] flex items-center justify-center shadow-sm">
                                  <svg className={`w-6 h-6 ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                </div>
                              )}
                              <button
                                onClick={() => removePendingAttachment(idx)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs leading-none shadow-sm cursor-pointer transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Plus Menu Drop-up */}
                      {isPlusMenuOpen && (
                        <div className={`absolute bottom-full left-0 right-0 mb-1 rounded-xl border shadow-xl z-50 animate-in slide-in-from-bottom-2 duration-200 overflow-hidden ${isDarkMode ? 'bg-[#2F2F2F] border-[#383838]' : 'bg-white border-[#E5E4DE]'}`}>
                          {[
                            { icon: <Paperclip className="w-4 h-4" />, label: 'Add photos & files', desc: 'Upload from computer', active: true, action: 'upload' },
                            { icon: <Globe className="w-4 h-4" />, label: 'Web search', desc: 'Find real-time news and info', active: false },
                            { icon: <Palette className="w-4 h-4" />, label: 'Create image', desc: 'Visualize anything', active: false },
                            { icon: <Telescope className="w-4 h-4" />, label: 'Deep research', desc: 'Get a detailed report', active: false },
                            { icon: <Cloud className="w-4 h-4" />, label: 'Google Re-auth', desc: 'Re-connect Google Suite', active: true, action: 'reauth' },
                          ].map((item, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                if (item.action === 'upload') {
                                  plusMenuFileInputRef.current?.click();
                                } else if (item.action === 'reauth') {
                                  window.location.href = `/api/auth/google?uid=${user?.uid || ""}&agentId=${params.agentId}&origin=${orgId}`;
                                }
                                setIsPlusMenuOpen(false);
                              }}
                              disabled={!item.active}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${item.active ? (isDarkMode ? 'hover:bg-[#383838] text-[#ECECEC]' : 'hover:bg-[#F3F2EC] text-[#1F1E1D]') : (isDarkMode ? 'text-[#444] cursor-default' : 'text-[#D5D3CC] cursor-default')}`}
                            >
                              <span className={item.active ? (isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]') : (isDarkMode ? 'text-[#444]' : 'text-[#D5D3CC]')}>{item.icon}</span>
                              <span className="text-sm font-medium">{item.label}</span>
                              <span className={`text-xs ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>{item.desc}</span>
                              {!item.active && <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-[#383838] text-[#737373]' : 'bg-[#EAE7DF] text-[#9C978D]'}`}>Soon</span>}
                            </button>
                          ))}
                        </div>
                      )}

                      <input
                        ref={plusMenuFileInputRef}
                        id="plus-menu-file-input"
                        type="file"
                        accept="image/jpeg, image/png, application/pdf, text/plain"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) {
                            const file = e.target.files[0];
                            const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
                            setPendingAttachments(prev => [...prev, { file, preview: previewUrl }]);
                            e.target.value = "";
                          }
                        }}
                      />

                      <div className="flex items-center w-full relative">
                        <button
                          onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                          className={`ml-2 sm:ml-3 p-2 rounded-full transition-all shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer ${isPlusMenuOpen ? (isDarkMode ? 'bg-[#383838] text-[#ECECEC] rotate-45' : 'bg-[#EAE7DF] text-[#1F1E1D] rotate-45') : (isDarkMode ? 'text-[#737373] hover:text-[#ECECEC] hover:bg-[#383838]' : 'text-[#9C978D] hover:text-[#1F1E1D] hover:bg-[#EAE7DF]')}`}
                          title="More options"
                        >
                          <Plus className="w-5 h-5 transition-transform" />
                        </button>

                        <textarea
                          ref={textareaRef}
                          placeholder="Ask anything..."
                          className={`border-0 focus-visible:ring-0 shadow-none flex-1 min-w-0 pl-2 sm:pl-3 pr-14 sm:pr-24 min-h-[44px] sm:min-h-[52px] text-base resize-none overflow-hidden leading-relaxed py-3 focus:outline-none ${isDarkMode ? 'bg-transparent text-[#ECECEC] placeholder:text-[#737373]' : 'bg-transparent text-[#1F1E1D] placeholder:text-[#9C978D]'}`}
                          value={inputValue}
                          onChange={e => setInputValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (inputValue.trim()) {
                                // Stop STT if active when sending
                                if (isListening) { speechRecRef.current?.stop(); setIsListening(false); }
                                handleSendMessage();
                                setIsPlusMenuOpen(false);
                                setIsAgentSwitcherOpen(false);
                              }
                            }
                          }}
                          rows={1}
                        />

                        {/* Mic & Send buttons — inside the input box on the right side */}
                        <div className="absolute right-1.5 sm:right-3 bottom-1.5 sm:bottom-2 flex items-center gap-0.5 sm:gap-1">
                          {/* STT Mic button — inside the text entry box, to the LEFT of the send arrow */}
                          {typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) && (
                            <button
                              onClick={toggleSpeechToText}
                              className={`p-1.5 sm:p-2 rounded-full transition-all cursor-pointer ${isListening ? 'text-white bg-red-500 animate-pulse shadow-lg shadow-red-500/30' : (isDarkMode ? 'text-[#737373] hover:text-[#ECECEC] hover:bg-[#383838]' : 'text-[#9C978D] hover:text-[#1F1E1D] hover:bg-[#EAE7DF]')}`}
                              title={isListening ? 'Stop listening' : 'Speech to text'}
                            >
                              {isListening ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
                            </button>
                          )}

                          {/* Send button — inside the text entry box */}
                          <Button size="icon" onClick={() => { if (isListening) { speechRecRef.current?.stop(); setIsListening(false); } handleSendMessage(); setIsPlusMenuOpen(false); setIsAgentSwitcherOpen(false); }} disabled={(!inputValue.trim() && pendingAttachments.length === 0) || isTyping} className={`rounded-full w-8 h-8 sm:w-10 sm:h-10 disabled:opacity-30 transition-all ${isDarkMode ? 'bg-[#ECECEC] text-[#171717] hover:bg-white' : 'bg-[#1F1E1D] text-white hover:bg-[#383734]'}`}>
                            {isTyping ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                    </div>

                    {/* Voice-over toggle — absolutely positioned so it doesn't affect input box centering */}
                    <button
                      onClick={() => {
                        const next = !voiceoverEnabled;
                        setVoiceoverEnabled(next);
                        // Stop any playing audio when turning off
                        if (!next && voiceoverAudioRef.current) {
                          voiceoverAudioRef.current.pause();
                          voiceoverAudioRef.current = null;
                        }
                      }}
                      className={`absolute -right-11 bottom-2 w-8 h-8 rounded-lg hidden sm:flex items-center justify-center transition-all cursor-pointer ${
                        voiceoverEnabled
                          ? 'bg-red-500/15 text-red-500 border border-red-400/40 animate-[pulse_3s_ease-in-out_infinite]'
                          : (isDarkMode ? 'text-[#737373] hover:text-[#ECECEC] border border-[#383838] bg-[#2F2F2F]/60 hover:bg-[#383838]' : 'text-[#9C978D] hover:text-[#1F1E1D] border border-[#E5E4DE] bg-white/60 hover:bg-[#EAE7DF]')
                      }`}
                      title={voiceoverEnabled ? 'Turn off voice-over' : 'Turn on voice-over — JARVIS will read responses aloud'}
                    >
                      {voiceoverEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>

                    {/* Heartbeat pulse indicator */}
                    {heartbeatPulseVisible && heartbeatInterval !== "off" && (
                      <div className="absolute -right-11 bottom-12 hidden sm:flex flex-col items-center gap-0 animate-in fade-in zoom-in-95 duration-300 pointer-events-none">
                        <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                        <span className="text-[6px] text-blue-400 uppercase tracking-widest font-bold">{t.heartbeat}</span>
                      </div>
                    )}
                </div>
                <div className="flex justify-center mt-1">
                  <button
                    onClick={() => setIsLearnMoreOpen(true)}
                    className={`text-[10px] font-medium transition-colors cursor-pointer hover:underline ${isDarkMode ? 'text-[#737373] hover:text-[#B4B4B4]' : 'text-[#9C978D] hover:text-[#6B6860]'}`}
                  >
                    Learn More
                  </button>
                </div>
                </div>
              </div>
          </div>




        </div>
      </div>

      {/* System Instructions Popup */}
      {isSystemInstructionsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsSystemInstructionsOpen(false)}>
          <div className={`rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-[#212121]' : 'bg-[#FAF9F5]'}`} onClick={e => e.stopPropagation()}>
            <div className={`p-6 ${isDarkMode ? 'border-b border-[#383838]' : 'border-b border-[#E5E4DE]'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-bold ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'}`}>System instructions</h3>
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>Provide tone, style, or context instructions for this session. These apply to every message in the current chat.</p>
                </div>
                <button onClick={() => setIsSystemInstructionsOpen(false)} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'text-[#737373] hover:text-[#ECECEC] hover:bg-[#2F2F2F]' : 'text-[#9C978D] hover:text-[#1F1E1D] hover:bg-[#EAE7DF]'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <textarea
                autoFocus
                className={`w-full h-28 sm:h-40 p-4 border rounded-xl resize-none focus:ring-2 focus:ring-stone-400/30 focus:border-stone-400 outline-none transition-all text-base sm:text-sm leading-relaxed ${isDarkMode ? 'bg-[#2F2F2F] border-[#383838] text-[#ECECEC] placeholder:text-[#737373]' : 'bg-[#FAF9F5] border-[#E5E4DE] text-[#1F1E1D] placeholder:text-[#9C978D]'}`}
                placeholder="e.g., Respond in a formal business tone. Keep answers concise. Focus on actionable advice. Always include specific examples."
                value={sessionInstructions}
                onChange={e => setSessionInstructions(e.target.value)}
              />
              <div className="flex items-center justify-between mt-3">
                <span className={`text-[10px] font-mono ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>{sessionInstructions.length} {t.characters}</span>
                <div className="flex items-center gap-2">
                  {sessionInstructions && (
                    <button onClick={() => setSessionInstructions("")} className={`px-3 py-1.5 text-xs rounded-lg transition-colors font-medium ${isDarkMode ? 'text-[#737373] hover:text-red-400 hover:bg-red-900/20' : 'text-[#9C978D] hover:text-red-500 hover:bg-red-50'}`}>
                      Clear
                    </button>
                  )}
                  <button onClick={() => setIsSystemInstructionsOpen(false)} className={`px-4 py-1.5 text-xs rounded-lg transition-colors font-semibold ${isDarkMode ? 'bg-[#ECECEC] text-[#171717] hover:bg-white' : 'bg-[#1F1E1D] text-white hover:bg-[#383734]'}`}>
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Learn More Modal */}
      {isLearnMoreOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsLearnMoreOpen(false)}>
          <div className={`rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-[#212121]' : 'bg-[#FAF9F5]'}`} onClick={e => e.stopPropagation()}>
            <div className={`p-6 shrink-0 ${isDarkMode ? 'border-b border-[#383838]' : 'border-b border-[#E5E4DE]'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-bold ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'}`}>AI Agent Capabilities</h3>
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>Everything {agent.name} can do for you.</p>
                </div>
                <button onClick={() => setIsLearnMoreOpen(false)} className={`p-2 rounded-full transition-colors cursor-pointer ${isDarkMode ? 'text-[#737373] hover:text-[#ECECEC] hover:bg-[#2F2F2F]' : 'text-[#9C978D] hover:text-[#1F1E1D] hover:bg-[#EAE7DF]'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-6 space-y-3">
              {[
                { title: 'Semantic Knowledge Base', desc: 'Searches your uploaded documents using intelligent matching — finds relevant info even when keywords don\'t match exactly.' },
                { title: 'Multi-Tool Execution', desc: 'Can search emails, create calendar events, draft Google Docs, Sheets, Slides, and YouTube videos — all in one conversation.' },
                { title: 'Gmail Integration', desc: 'Full inbox management: search, draft, delete, block senders, and manage folders — hands-free.' },
                { title: 'Calendar & Google Meet', desc: 'Schedule events, check availability, and auto-generate Meet links with a single request.' },
                { title: 'YouTube Creative Director', desc: 'Draft video concepts with titles, descriptions, and scripts pushed directly to YouTube Studio.' },
                { title: 'iMessage / SMS', desc: 'Read, search, and send text messages through your connected Twilio number.' },
                { title: 'Real-Time Web Search', desc: 'Searches the live web for current events, facts, and research — always up to date.' },
                { title: 'Past Conversation Memory', desc: 'Search across all your previous chat sessions to pull up context and decisions from earlier talks.' },
                { title: 'AI Survey Creator', desc: 'Generate intelligent surveys with AI-crafted questions and email them directly to recipients.' },
                { title: 'Grant Scout Agents', desc: 'Spawn up to 4 autonomous sub-agents that research and match you with relevant grants.' },
                { title: 'P.A.C.T. Memory', desc: 'Automatically learns personal facts (preferences, relationships, goals) and naturally uses them in future conversations.' },
                { title: 'Heart / Brain / Soul', desc: 'Heart = autonomous background tasks. Brain = operational rules. Soul = personality & tone customization.' },
                { title: 'Knowledge Base Documents', desc: 'Upload PDFs and text documents for Jarvis to reference authoritatively in responses.' },
                { title: 'Voice-to-Voice', desc: 'Real-time voice conversations with natural speech synthesis and instant responses.' },
                { title: 'Smart Context Window', desc: 'Keeps 32 messages in active memory with intelligent summarization of older messages for continuity.' },
              ].map((feature, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-[#2A2A2A]' : 'hover:bg-[#F3F2EC]'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${isDarkMode ? 'bg-[#737373]' : 'bg-[#9C978D]'}`} />
                  <div>
                    <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'}`}>{feature.title}</h4>
                    <p className={`text-xs leading-relaxed mt-0.5 ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {VOICE_CHAT_ENABLED && (
      <VoiceAgentModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        agentName={selectedExploreItem ? (exploreItemsMeta[selectedExploreItem]?.name || agent.name) : agent.name}
        agentId={params.agentId as string}
        orgPrefix={orgId}
        voiceId={selectedExploreItem ? exploreItemsMeta[selectedExploreItem]?.voiceId : undefined}
        systemInstructions={sessionInstructions}
        knowledgeBaseText={orgBrain}
        pactText={pactText}
        crmInstanceId={crmActiveInstanceId}
        crmInstances={crmAvailableInstances.length > 0 ? crmAvailableInstances : [{ id: "default", name: "All Contacts" }]}
        existingMessages={messages.map(m => ({ role: m.isSelf ? "user" : "assistant", content: m.text }))}
        onTranscriptUpdate={async (userText, aiReply) => {
          // Lazily create a session if none exists (voice started from blank screen)
          let currentSessionId = activeSessionId;
          if (!currentSessionId) {
            try {
              currentSessionId = await chatStore.createSession(orgId, "New Chat");
            } catch {
              const newSession: Session = { id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, title: "New Chat", updatedAt: Date.now(), scope: chatScope, messages: [] };
              currentSessionId = newSession.id;
              setSessions(prev => [newSession, ...prev]);
              setActiveSessionId(newSession.id);
            }
          }

          // Trigger AI Title generator if needed
          const existingSession = sessions.find(s => s.id === currentSessionId);
          if (!existingSession || existingSession.title === "New Chat" || !existingSession.title) {
            fetch("/api/chat", {
              method: "POST",
              headers: await getAuthHeaders(),
              body: JSON.stringify({
                messages: [
                  { role: "system", content: "You are a title generator. Given a user message and AI response, output ONLY a short comma-separated list of 3-5 key topic words that summarize the conversation. No full sentences, no quotes, no explanation. Example output: US History, D-Day, Normandy Beaches" },
                  { role: "user", content: `User said: ${userText}\nAI replied: ${aiReply.substring(0, 200)}` }
                ],
                agentId: `${orgId}_jarvis`,
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
          if (user?.uid && pactEnabled && userText.trim().length > 5) {
            // Build recent history from current messages for multi-turn context
            const voiceRecentMsgs = messages.slice(-6).map(m => ({ role: m.isSelf ? "user" : "assistant", content: m.text }));
            fetch("/api/pact/extract", {
              method: "POST",
              headers: await getAuthHeaders(),
              body: JSON.stringify({
                userMessage: userText,
                aiResponse: aiReply,
                userName: user?.displayName || undefined,
                uid: user.uid,
                orgId: orgId,
                recentHistory: voiceRecentMsgs.length > 0 ? voiceRecentMsgs : undefined
              })
            }).then(res => res.json()).then(async (extractData) => {
              if (extractData.facts && extractData.facts.length > 0 && user?.uid) {
                const headers = await getAuthHeaders();
                for (const f of extractData.facts) {
                  await fetch('/api/pact/memories', {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      scope: chatScope || 'user',
                      orgId,
                      question: f.question,
                      answer: f.answer,
                      category: f.category || 'preference',
                      confidence: f.confidence || 'medium',
                      source: 'chat_extraction',
                    }),
                  }).catch(console.error);
                }
                setTimeout(fetchPACTEntries, 1000);
              }
            }).catch(console.error);
          }        }}
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
            headers: await getAuthHeaders(),
            body: JSON.stringify({
              messages: apiMessages,
              agentId: `${orgId}_${params.agentId}`,
              soul: `${agentConfig.soul ? `[ORGANIZATION VOICE & PERSONALITY]\n${agentConfig.soul}\n\n` : ''}[USER CONTEXT]\nAct on behalf of this user. The user's email address is: ${user?.email || 'Unknown'}. Do not ask them for their email. IMPORTANT: You are in a VOICE CONVERSATION. Keep spoken responses to 1-3 sentences. Be direct. Never use markdown, bullet points, or code blocks. HOWEVER, you MUST still use tools when the user requests actions like sending emails, checking calendar, spawning grant agents, etc. Always execute the tool first, then confirm verbally.`,
              brain: agentConfig.brain,
              uid: user?.uid,
              refreshToken: rToken,
              contacts: agentContacts,
              knowledgeBaseText: kbText,
              orgBrainText: orgBrain,
              personalBrainText,
              pactText,
              userName: user?.displayName || undefined,
              model: selectedModel,
              crmData: crmContacts || undefined,
              crmInstanceId: crmActiveInstanceId,
              crmInstances: crmAvailableInstances.length > 0 ? crmAvailableInstances : [{ id: "default", name: "All Contacts" }]
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          return data;
        }}
      />
      )}
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
          <div className={`rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-[#212121] border-[#383838]' : 'bg-[#FAF9F5] border-[#E5E4DE]'}`}>
            <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'border-[#383838] bg-[#171717]' : 'border-[#E5E4DE] bg-[#F3F2EC]'}`}>
              <h3 className={`text-lg font-bold flex items-center gap-2 ${isDarkMode ? 'text-[#ECECEC]' : 'text-[#1F1E1D]'}`}>
                <Plus className={`w-5 h-5 ${isDarkMode ? 'text-[#B4B4B4]' : 'text-[#6B6860]'}`} />
                Submit an Agent Request
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setIsAgentRequestModalOpen(false)} className={`rounded-full ${isDarkMode ? 'text-[#737373] hover:text-[#ECECEC] hover:bg-[#2F2F2F]' : 'text-[#9C978D] hover:text-[#1F1E1D] hover:bg-[#EAE7DF]'}`}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className={`text-xs font-bold uppercase tracking-widest pl-1 ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>Name *</label>
                <Input placeholder="John Doe" value={agentRequestForm.name} onChange={e => setAgentRequestForm({...agentRequestForm, name: e.target.value})} className="mt-1" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`text-xs font-bold uppercase tracking-widest pl-1 ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>Email *</label>
                  <Input placeholder="john@example.com" type="email" value={agentRequestForm.email} onChange={e => setAgentRequestForm({...agentRequestForm, email: e.target.value})} className="mt-1" />
                </div>
                <div>
                  <label className={`text-xs font-bold uppercase tracking-widest pl-1 ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>Phone</label>
                  <Input placeholder="(555) 000-0000" type="tel" value={agentRequestForm.phone} onChange={e => setAgentRequestForm({...agentRequestForm, phone: e.target.value})} className="mt-1" />
                </div>
              </div>
              <div>
                <label className={`text-xs font-bold uppercase tracking-widest pl-1 ${isDarkMode ? 'text-[#737373]' : 'text-[#9C978D]'}`}>Message *</label>
                <textarea 
                  placeholder="Describe the agent you'd like us to build..." 
                  value={agentRequestForm.message} 
                  onChange={e => setAgentRequestForm({...agentRequestForm, message: e.target.value})} 
                  className={`w-full mt-1 border rounded-xl p-4 text-sm focus:ring-2 outline-none resize-none h-32 ${isDarkMode ? 'bg-[#2F2F2F] border-[#383838] text-[#ECECEC] focus:ring-stone-400/30 focus:border-stone-400' : 'bg-[#FAF9F5] border-[#E5E4DE] text-[#1F1E1D] focus:ring-stone-400/30 focus:border-stone-400'}`} 
                />
              </div>
            </div>
            <div className={`p-6 border-t flex justify-end gap-3 ${isDarkMode ? 'border-[#383838] bg-[#171717]' : 'border-[#E5E4DE] bg-[#F3F2EC]'}`}>
              <Button variant="outline" onClick={() => setIsAgentRequestModalOpen(false)}>Cancel</Button>
              <Button onClick={submitAgentRequest} disabled={isSubmittingAgentRequest || !agentRequestForm.name || !agentRequestForm.email || !agentRequestForm.message} className={`min-w-[120px] ${isDarkMode ? 'bg-[#ECECEC] text-[#171717] hover:bg-white' : 'bg-[#1F1E1D] hover:bg-[#383734] text-white'}`}>
                {isSubmittingAgentRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Request"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>

      <AgentLibrary 
        isOpen={showAgentLibrary}
        onClose={() => setShowAgentLibrary(false)}
        onSelectAgent={(id) => router.push(`/portal/dashboard/${orgId}/ai-agents/${id}`)}
        isDarkMode={isDarkMode}
      />
    </>
  );
}
