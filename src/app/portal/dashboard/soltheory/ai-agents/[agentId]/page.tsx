"use client";

import { useState, useRef, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VoiceAgentModal } from "@/components/communications/VoiceAgentModal";
import { JarvisViewBrowser, type JarvisViewNavigation } from "@/components/ui/jarvis-view-browser";
import { Input } from "@/components/ui/input";
import { Bot, User, Plus, Search, LogOut, MessageSquare, Send, Menu, Loader2, Mail, Brain, Trash2, X, Sparkles, ArrowLeft, RefreshCw, Eye, CheckCircle2, Settings, CheckSquare, Sun, Moon, Maximize2, Minimize2, Users, FileText, Presentation, Table, Paperclip, Cloud, Mic, BookOpen, Image as ImageIcon, Video, Music, Code , AudioLines, SquarePen, Edit, ChevronDown, MessageCircle, Smartphone, Monitor, Inbox, Star, Archive, Clock, Filter, SlidersHorizontal, MailOpen, Reply, Zap, Tag, Hash} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { notFound } from "next/navigation";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc, setDoc, addDoc, collection, getDocs, query, orderBy, where, deleteDoc, writeBatch, limit as firestoreLimit } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { solTheoryKnowledge } from "@/lib/soltheory-knowledge";
import { logActivity } from '@/lib/activity-logger';

let _msgCounter = 0;
const uid = () => `msg-${Date.now()}-${++_msgCounter}-${Math.random().toString(36).substring(2, 7)}`;

type Message = { id: string; text: string; isSelf: boolean; hiddenContext?: string; imageUrl?: string; };
type Session = { id: string; title: string; updatedAt: number; messages: Message[]; };
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

function GmailViewTypingBody({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  
  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(interval);
      } else {
        setDisplayed(text.slice(0, i));
      }
    }, 12);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
      {displayed}
      {!done && <span className="inline-block w-0.5 h-4 bg-slate-800 animate-pulse ml-0.5 align-text-bottom" />}
    </div>
  );
}

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
  const [pendingAttachments, setPendingAttachments] = useState<{ file: File; preview: string }[]>([]);
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
  const [lastDraftedEmail, setLastDraftedEmail] = useState<{ to: string; subject: string; body: string; timestamp: number } | null>(null);
  const [gmailFilterMenuOpen, setGmailFilterMenuOpen] = useState(false);
  const [gmailActiveFilters, setGmailActiveFilters] = useState<Set<string>>(new Set());
  const [isAgentEyeOpen, setIsAgentEyeOpen] = useState(false);
  const [agentEyePos, setAgentEyePos] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return { x: 8, y: 40 };
    if (typeof window !== 'undefined' && window.innerWidth < 768) return { x: 16, y: 60 };
    // Center in the visible area (after the ~240px sidebar)
    const sidebarW = 240;
    const defaultW = 780, defaultH = 620;
    const availableW = typeof window !== 'undefined' ? window.innerWidth - sidebarW : 800;
    const availableH = typeof window !== 'undefined' ? window.innerHeight : 700;
    const x = sidebarW + Math.max(20, (availableW - defaultW) / 2);
    const y = Math.max(40, (availableH - defaultH) / 2);
    return { x, y };
  });
  const [agentEyeSize, setAgentEyeSize] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) return { w: Math.min(window.innerWidth - 16, 380), h: 400 };
    if (typeof window !== 'undefined' && window.innerWidth < 768) return { w: Math.min(420, window.innerWidth - 32), h: 480 };
    return { w: 780, h: 620 };
  });
  const [agentEyeExpanded, setAgentEyeExpanded] = useState(false);
  const [jarvisNavQueue, setJarvisNavQueue] = useState<JarvisViewNavigation[]>([]);
  const jarvisNavCountRef = useRef(0);

  // Topic-aware mock URL picker — analyzes the user's message and returns relevant URLs
  const getTopicUrls = useCallback((userInput: string): JarvisViewNavigation[] => {
    const q = userInput.toLowerCase();

    // Topic → URL pool mapping (each topic has 4-6 believable sources)
    const topicMap: Record<string, JarvisViewNavigation[]> = {
      entertainment: [
        { url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(userInput.split(' ').slice(0, 4).join('_')), title: "Wikipedia" },
        { url: "https://www.imdb.com/find?q=" + encodeURIComponent(userInput), title: "IMDb" },
        { url: "https://www.rottentomatoes.com/search?search=" + encodeURIComponent(userInput), title: "Rotten Tomatoes" },
        { url: "https://variety.com/results/?q=" + encodeURIComponent(userInput), title: "Variety" },
        { url: "https://www.hollywoodreporter.com/search/" + encodeURIComponent(userInput), title: "Hollywood Reporter" },
        { url: "https://www.rollingstone.com/results/" + encodeURIComponent(userInput), title: "Rolling Stone" },
      ],
      science: [
        { url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(userInput.split(' ').slice(0, 4).join('_')), title: "Wikipedia" },
        { url: "https://www.nature.com/search?q=" + encodeURIComponent(userInput), title: "Nature" },
        { url: "https://scholar.google.com/scholar?q=" + encodeURIComponent(userInput), title: "Google Scholar" },
        { url: "https://www.sciencedirect.com/search?qs=" + encodeURIComponent(userInput), title: "ScienceDirect" },
        { url: "https://www.nationalgeographic.com/search?q=" + encodeURIComponent(userInput), title: "National Geographic" },
      ],
      history: [
        { url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(userInput.split(' ').slice(0, 4).join('_')), title: "Wikipedia" },
        { url: "https://www.britannica.com/search?query=" + encodeURIComponent(userInput), title: "Britannica" },
        { url: "https://www.history.com/search?q=" + encodeURIComponent(userInput), title: "History.com" },
        { url: "https://www.smithsonianmag.com/search/?q=" + encodeURIComponent(userInput), title: "Smithsonian" },
        { url: "https://www.bbc.com/news/topics/" + encodeURIComponent(userInput.split(' ').slice(0, 3).join('-')), title: "BBC" },
      ],
      tech: [
        { url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(userInput.split(' ').slice(0, 4).join('_')), title: "Wikipedia" },
        { url: "https://stackoverflow.com/search?q=" + encodeURIComponent(userInput), title: "Stack Overflow" },
        { url: "https://www.theverge.com/search?q=" + encodeURIComponent(userInput), title: "The Verge" },
        { url: "https://techcrunch.com/search/" + encodeURIComponent(userInput), title: "TechCrunch" },
        { url: "https://arstechnica.com/search/?q=" + encodeURIComponent(userInput), title: "Ars Technica" },
      ],
      finance: [
        { url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(userInput.split(' ').slice(0, 4).join('_')), title: "Wikipedia" },
        { url: "https://www.investopedia.com/search?q=" + encodeURIComponent(userInput), title: "Investopedia" },
        { url: "https://finance.yahoo.com/quote/" + encodeURIComponent(userInput), title: "Yahoo Finance" },
        { url: "https://www.bloomberg.com/search?query=" + encodeURIComponent(userInput), title: "Bloomberg" },
        { url: "https://www.wsj.com/search?query=" + encodeURIComponent(userInput), title: "Wall Street Journal" },
      ],
      health: [
        { url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(userInput.split(' ').slice(0, 4).join('_')), title: "Wikipedia" },
        { url: "https://www.mayoclinic.org/search/search-results?q=" + encodeURIComponent(userInput), title: "Mayo Clinic" },
        { url: "https://www.webmd.com/search/search_results/default.aspx?query=" + encodeURIComponent(userInput), title: "WebMD" },
        { url: "https://www.nih.gov/search-results?q=" + encodeURIComponent(userInput), title: "NIH" },
        { url: "https://medlineplus.gov/search/?query=" + encodeURIComponent(userInput), title: "MedlinePlus" },
      ],
      sports: [
        { url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(userInput.split(' ').slice(0, 4).join('_')), title: "Wikipedia" },
        { url: "https://www.espn.com/search/_/q/" + encodeURIComponent(userInput), title: "ESPN" },
        { url: "https://www.si.com/search?query=" + encodeURIComponent(userInput), title: "Sports Illustrated" },
        { url: "https://bleacherreport.com/search?q=" + encodeURIComponent(userInput), title: "Bleacher Report" },
      ],
      food: [
        { url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(userInput.split(' ').slice(0, 4).join('_')), title: "Wikipedia" },
        { url: "https://www.allrecipes.com/search?q=" + encodeURIComponent(userInput), title: "Allrecipes" },
        { url: "https://www.foodnetwork.com/search/" + encodeURIComponent(userInput), title: "Food Network" },
        { url: "https://www.seriouseats.com/search?q=" + encodeURIComponent(userInput), title: "Serious Eats" },
      ],
      travel: [
        { url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(userInput.split(' ').slice(0, 4).join('_')), title: "Wikipedia" },
        { url: "https://www.lonelyplanet.com/search?q=" + encodeURIComponent(userInput), title: "Lonely Planet" },
        { url: "https://www.tripadvisor.com/Search?q=" + encodeURIComponent(userInput), title: "TripAdvisor" },
        { url: "https://www.nationalgeographic.com/travel/search?q=" + encodeURIComponent(userInput), title: "Nat Geo Travel" },
      ],
      news: [
        { url: "https://www.reuters.com/search/news?query=" + encodeURIComponent(userInput), title: "Reuters" },
        { url: "https://www.bbc.com/search?q=" + encodeURIComponent(userInput), title: "BBC News" },
        { url: "https://www.nytimes.com/search?query=" + encodeURIComponent(userInput), title: "NY Times" },
        { url: "https://apnews.com/search?q=" + encodeURIComponent(userInput), title: "AP News" },
      ],
      general: [
        { url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(userInput.split(' ').slice(0, 4).join('_')), title: "Wikipedia" },
        { url: "https://www.britannica.com/search?query=" + encodeURIComponent(userInput), title: "Britannica" },
        { url: "https://www.google.com/search?q=" + encodeURIComponent(userInput), title: "Google" },
        { url: "https://www.bbc.com/search?q=" + encodeURIComponent(userInput), title: "BBC" },
        { url: "https://www.reuters.com/search/news?query=" + encodeURIComponent(userInput), title: "Reuters" },
      ],
    };

    // Keyword → topic detection
    const topicKeywords: Record<string, string[]> = {
      entertainment: ['movie', 'film', 'show', 'tv', 'series', 'actor', 'actress', 'netflix', 'comedy', 'comedian', 'stand-up', 'standup', 'joke', 'funny', 'humor', 'festival', 'concert', 'music', 'song', 'album', 'band', 'singer', 'rapper', 'hip hop', 'hiphop', 'rap', 'rock', 'pop', 'jazz', 'celebrity', 'hollywood', 'broadway', 'theater', 'theatre', 'anime', 'manga', 'video game', 'gaming', 'disney', 'marvel', 'dc comics', 'hulu', 'hbo', 'amazon prime', 'youtube', 'podcast', 'streaming'],
      science: ['science', 'physics', 'chemistry', 'biology', 'quantum', 'atom', 'molecule', 'dna', 'gene', 'evolution', 'space', 'planet', 'star', 'galaxy', 'nasa', 'experiment', 'theory', 'hypothesis', 'research', 'discovery', 'element', 'periodic', 'cell', 'organism', 'ecosystem', 'climate', 'environment', 'geology', 'astronomy', 'math', 'equation', 'formula'],
      history: ['history', 'war', 'battle', 'ancient', 'empire', 'civilization', 'revolution', 'century', 'medieval', 'renaissance', 'dynasty', 'pharaoh', 'rome', 'roman', 'greek', 'egypt', 'viking', 'colonial', 'independence', 'civil war', 'world war', 'wwi', 'wwii', 'cold war', 'president', 'king', 'queen', 'historical'],
      tech: ['tech', 'technology', 'software', 'hardware', 'computer', 'programming', 'code', 'coding', 'ai', 'artificial intelligence', 'machine learning', 'robot', 'internet', 'website', 'app', 'startup', 'silicon valley', 'apple', 'google', 'microsoft', 'tesla', 'elon musk', 'crypto', 'bitcoin', 'blockchain', 'cybersecurity', 'cloud', 'data', 'algorithm', 'python', 'javascript'],
      finance: ['stock', 'market', 'invest', 'investing', 'finance', 'financial', 'money', 'economy', 'economic', 'bank', 'banking', 'tax', 'budget', 'credit', 'debt', 'loan', 'mortgage', 'interest rate', 'inflation', 'gdp', 'recession', 'portfolio', 'dividend', 'bond', 'forex', 'trading', 'wall street', 'nasdaq', 'dow jones', 's&p'],
      health: ['health', 'medical', 'doctor', 'hospital', 'disease', 'symptom', 'treatment', 'medicine', 'drug', 'therapy', 'mental health', 'anxiety', 'depression', 'nutrition', 'diet', 'exercise', 'fitness', 'workout', 'vitamin', 'supplement', 'vaccine', 'virus', 'cancer', 'diabetes', 'heart', 'surgery', 'diagnosis'],
      sports: ['sport', 'sports', 'football', 'basketball', 'baseball', 'soccer', 'tennis', 'golf', 'nba', 'nfl', 'mlb', 'fifa', 'olympics', 'athlete', 'team', 'championship', 'tournament', 'playoff', 'super bowl', 'world cup', 'boxing', 'mma', 'ufc', 'wrestling', 'hockey', 'nhl', 'cricket'],
      food: ['recipe', 'cook', 'cooking', 'food', 'cuisine', 'restaurant', 'chef', 'bake', 'baking', 'ingredient', 'meal', 'dinner', 'lunch', 'breakfast', 'dessert', 'cake', 'pizza', 'pasta', 'sushi', 'vegan', 'vegetarian', 'nutrition', 'kitchen'],
      travel: ['travel', 'trip', 'vacation', 'hotel', 'flight', 'airline', 'destination', 'tourism', 'tourist', 'beach', 'mountain', 'country', 'city', 'visit', 'explore', 'backpack', 'cruise', 'resort', 'passport', 'visa'],
      news: ['news', 'breaking', 'headline', 'current events', 'politics', 'election', 'congress', 'senate', 'government', 'policy', 'legislation', 'protest', 'crisis'],
    };

    // Find best matching topic
    let bestTopic = 'general';
    let bestScore = 0;
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      let score = 0;
      for (const kw of keywords) {
        if (q.includes(kw)) score += kw.length; // longer matches = higher confidence
      }
      if (score > bestScore) { bestScore = score; bestTopic = topic; }
    }

    const pool = topicMap[bestTopic];
    // Always include Wikipedia as first pick, then shuffle the rest
    const wiki = pool.find(u => u.url.includes('wikipedia'));
    const rest = pool.filter(u => !u.url.includes('wikipedia')).sort(() => Math.random() - 0.5);
    return wiki ? [wiki, ...rest] : rest;
  }, []);
  const agentEyeDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const agentEyeResizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; origX: number; origY: number; edge: string } | null>(null);

  // Agent Eye Minimize state
  const [isAgentEyeMinimized, setIsAgentEyeMinimized] = useState(false);
  const [agentEyeMinRight, setAgentEyeMinRight] = useState(16);
  const agentEyeMinDragRef = useRef<{ startX: number; origRight: number } | null>(null);

  // Chat sidebar resizable state
  const [chatSidebarWidth, setChatSidebarWidth] = useState(300);
  const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
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
      const defaultW = window.innerWidth < 640 ? Math.min(window.innerWidth - 16, 380) : 780;
      const defaultH = window.innerWidth < 640 ? 400 : 620;
      setAgentEyeSize({ w: defaultW, h: defaultH });
      setAgentEyeExpanded(false);
    } else {
      const targetW = Math.min(window.innerWidth - 80, 1400);
      const targetH = Math.min(window.innerHeight - 80, 900);
      const x = Math.max(40, (window.innerWidth - targetW) / 2);
      const y = Math.max(40, (window.innerHeight - targetH) / 2);
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
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [sessionInstructions, setSessionInstructions] = useState("");
  const [isSystemInstructionsOpen, setIsSystemInstructionsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("llama-3.3-70b-versatile");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  const [tagFilterOpen, setTagFilterOpen] = useState(false);

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

  // P.A.C.T. — Personalized AI Conversation Training
  type PACTEntry = { id: string; question: string; answer: string; source: string; orgId: string; createdAt: number; updatedAt: number; markedForDeletion?: number; deletionReason?: string };
  const [pactEntries, setPactEntries] = useState<PACTEntry[]>([]);
  const [pactLoaded, setPactLoaded] = useState(false);

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
          updatedAt: item.updatedAt || Date.now(),
          markedForDeletion: item.markedForDeletion || undefined,
          deletionReason: item.deletionReason || undefined
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

  // Build PACT text for API injection — exclude soft-deleted entries and respect pactEnabled
  const pactText = pactEntries.length > 0 && pactEnabled
    ? pactEntries.filter(e => !e.markedForDeletion).map(e => `Q: ${e.question}\nA: ${e.answer}`).join("\n\n")
    : "";

  // Heartbeat — autonomous PACT cleanup
  const runHeartbeatCleanup = useCallback(async () => {
    if (heartbeatLockRef.current || !user?.uid || !firestore) return;
    heartbeatLockRef.current = true;
    setHeartbeatRunning(true);
    try {
      const { getDoc, doc, updateDoc } = await import("firebase/firestore");
      const userDocRef = doc(firestore, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      let currentEntries: any[] = userDocSnap.data()?.pact_entries_soltheory || [];

      // Phase 1: Auto-purge entries marked > 24 hours ago
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const beforePurge = currentEntries.length;
      currentEntries = currentEntries.filter((e: any) => {
        if (e.markedForDeletion && (now - e.markedForDeletion) > TWENTY_FOUR_HOURS) return false;
        return true;
      });
      if (currentEntries.length !== beforePurge) {
        await updateDoc(userDocRef, { pact_entries_soltheory: currentEntries });
      }

      // Phase 2: Evaluate active (non-marked) entries via LLM
      const activeEntries = currentEntries.filter((e: any) => !e.markedForDeletion);
      if (activeEntries.length === 0) {
        setLastHeartbeatRun(Date.now());
        setHeartbeatRunning(false);
        heartbeatLockRef.current = false;
        await fetchPACTEntries();
        return;
      }

      const res = await fetch("/api/pact-evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: activeEntries.map((e: any) => ({ question: e.question, answer: e.answer })),
          userName: user?.displayName || undefined
        })
      });
      const data = await res.json();
      const decisions: any[] = data.decisions || [];

      // Build a map of active entry indices that should be discarded
      const discardIndices = new Set<number>();
      const reasonMap = new Map<number, string>();
      decisions.forEach((d: any) => {
        if (!d.keep && typeof d.index === "number") {
          discardIndices.add(d.index);
          reasonMap.set(d.index, d.reason || "Low value");
        }
      });

      if (discardIndices.size > 0) {
        // Map active entry indices back to the full array
        let activeIdx = 0;
        const updated = currentEntries.map((e: any) => {
          if (!e.markedForDeletion) {
            if (discardIndices.has(activeIdx)) {
              const reason = reasonMap.get(activeIdx) || "Low value";
              activeIdx++;
              return { ...e, markedForDeletion: Date.now(), deletionReason: reason };
            }
            activeIdx++;
          }
          return e;
        });
        await updateDoc(userDocRef, { pact_entries_soltheory: updated });

        // Push notification to shared notification tray
        const existing = JSON.parse(localStorage.getItem('st_all_notifications') || '[]');
        const newNotif = {
          id: `heartbeat-${Date.now()}`,
          title: `Cleaned ${discardIndices.size} P.A.C.T. ${discardIndices.size === 1 ? 'entry' : 'entries'}`,
          desc: `Review flagged entries before they auto-delete in 24h.`,
          time: Date.now(),
          type: 'heartbeat',
          link: `/portal/dashboard/soltheory/ai-agents/${params.agentId}?tab=pact`
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
  }, [user?.uid, firestore, user?.displayName]);

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
      if (hasExpired && firestore && user?.uid) {
        const remaining = pactEntries.filter(e => !(e.markedForDeletion && (now - e.markedForDeletion) > TWENTY_FOUR_HOURS));
        setPactEntries(remaining);
        import("firebase/firestore").then(({ doc, updateDoc }) => {
          updateDoc(doc(firestore, "users", user.uid), { pact_entries_soltheory: remaining }).catch(console.error);
        });
      }
    }, 60000);
    return () => clearInterval(tickInterval);
  }, [pactEntries, firestore, user?.uid]);


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
      logActivity(firestore, 'ai_agent_config_changed', { email: user?.email || '', displayName: user?.displayName }, 'Updated org brain for soltheory');
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
      chatBg: "bg-[#fefcf6] border-slate-200 shadow-sm",
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

  // Load Platform-Wide Usage (all users)
  useEffect(() => {
    if (!firestore) return;
    import("firebase/firestore").then(({ collection, onSnapshot, query, orderBy }) => {
      const q = query(collection(firestore, "ai_usage"), orderBy("timestamp", "desc"));
      const unsub = onSnapshot(q, (snap) => {
        let totalTokens = 0;
        let totalChars = 0;
        snap.forEach((d) => {
          const data = d.data();
          if (data.provider === "groq") {
            totalTokens += data.totalTokens || 0;
          } else if (data.provider === "elevenlabs") {
            totalChars += data.characters || 0;
          }
        });
        setTotalGroqTokens(totalTokens);
        setTotalElevenLabsChars(totalChars);
      }, (err) => {
        console.error("[AI Usage] Failed to load platform usage:", err);
      });
      return () => unsub();
    });
  }, [firestore]);

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
      logActivity(firestore, 'item_deleted', { email: user?.email || '', displayName: user?.displayName }, `Deleted chat session: ${session?.title || id}`);
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

    // ── IMMEDIATE Jarvis View animation ──
    // Trigger proactively for most questions BEFORE API returns
    const lowerInput = inputValue.toLowerCase().trim();
    const SKIP_PATTERNS = [
      /^what(?:'s| is) (?:my|your) name/,
      /^who am i/,
      /^who are you/,
      /^what are you/,
      /^are you (?:a |an )?(?:ai|bot|human|real)/,
      /^(?:hi|hello|hey|yo|sup|what's up|howdy|greetings)\b[.!?]?$/,
      /^(?:thanks|thank you|thx|ty)[.!?]?$/,
      /^(?:ok|okay|sure|yes|no|yep|nope|yeah|nah)[.!?]?$/,
      /^(?:goodbye|bye|see ya|later|gn|good night)[.!?]?$/,
      /^(?:help|menu|commands)[.!?]?$/,
      /^(?:lol|lmao|haha|hehe)[.!?]?$/,
    ];
    const shouldSkipAnimation = SKIP_PATTERNS.some(p => p.test(lowerInput)) || lowerInput.length < 4;
    let didStartAnimation = false;

    if (!shouldSkipAnimation && agentEyeTab === 'jarvis-view' && isAgentEyeOpen && !isAgentEyeMinimized) {
      didStartAnimation = true;
      // Alternate between 1 and 2 mock URLs
      const navCount = jarvisNavCountRef.current % 2 === 0 ? 2 : 1;
      jarvisNavCountRef.current++;

      // Pick topic-relevant URLs based on the user's question
      const topicUrls = getTopicUrls(inputValue);
      const mockNavs = topicUrls.slice(0, navCount);

      // Push first URL immediately
      setJarvisNavQueue(prev => [...prev, mockNavs[0]]);

      // If 2 URLs, push the second after a delay
      if (navCount > 1) {
        setTimeout(() => {
          setJarvisNavQueue(prev => [...prev, mockNavs[1]]);
        }, 4500);
      }
    }

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

      // Capture email drafts for Gmail View
      if (data.executedTools && Array.isArray(data.executedTools)) {
        const emailTool = data.executedTools.find((t: any) => t.name === 'draft_outbound_email');
        if (emailTool?.args) {
          setLastDraftedEmail({
            to: emailTool.args.to || '',
            subject: emailTool.args.subject || '',
            body: (emailTool.args.body || '').replace(/\\n/g, '\n'),
            timestamp: Date.now(),
          });
          // Auto-switch to Gmail View in Agent Eye when an email is drafted
          if (isAgentEyeOpen || isAgentEyeMinimized) {
            setAgentEyeTab('gmail');
          }
        }
      }

      // If the server returned real enrichment URLs, push them to Jarvis View
      // These are REAL sites used for research — much more believable than mocks
      if (data.enrichmentUrls && Array.isArray(data.enrichmentUrls) && data.enrichmentUrls.length > 0
          && agentEyeTab === 'jarvis-view' && isAgentEyeOpen && !isAgentEyeMinimized) {
        // Push real URLs with staggered timing for natural feel
        data.enrichmentUrls.slice(0, 2).forEach((eu: { url: string; title: string }, idx: number) => {
          setTimeout(() => {
            setJarvisNavQueue(prev => [...prev, { url: eu.url, title: eu.title }]);
          }, idx * 3500);
        });
      }

      // Show response (animation is already running in parallel)
      setMessages(prev => [...prev, { id: uid(), text: data.response, isSelf: false }]);
      logActivity(firestore, 'ai_chat_sent', { email: user?.email || '', displayName: user?.displayName }, 'Sent AI chat message to ' + (agent?.name || params.agentId), { messagePreview: inputValue.substring(0, 200) });

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
      if (user?.uid && pactEnabled) {
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: retryMessages,
              agentId: `soltheory_${params.agentId}`,
              soul: agentConfig.soul,
              brain: agentConfig.brain,
              uid: user?.uid,
              pactText,
              userName: user?.displayName || undefined,
              model: selectedModel
            }),
          });
          const retryData = await retryRes.json();
          if (retryData.response && retryData.response.length > 5) {
            setMessages(prev => [...prev, { id: uid(), text: retryData.response, isSelf: false }]);
            setIsTyping(false);
            return;
          }
        } catch (retryErr) {
          console.error("[handleSendMessage] Retry also failed:", retryErr);
        }
      }

      setMessages(prev => [...prev, { id: uid(), text: friendlyError, isSelf: false }]);
    } finally {
      setIsTyping(false);
    }

    // Send any pending paste attachments
    if (pendingAttachments.length > 0) {
      const toProcess = [...pendingAttachments];
      setPendingAttachments([]);
      for (const att of toProcess) {
        if (att.preview) URL.revokeObjectURL(att.preview);
        processAgentFile(att.file);
      }
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
        headers: { "Content-Type": "application/json" },
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
    <div className="flex w-full flex-1 min-h-0 bg-[#faf6ed] text-slate-800 overflow-hidden font-sans selection:bg-fuchsia-500/30" style={{ height: '100%', maxHeight: '100dvh' }}>

      {/* Sessions Sidebar */}
      <div className="hidden md:flex flex-col bg-[#fefcf6]/90 backdrop-blur-3xl border-r border-slate-200 shrink-0 z-20 relative overflow-hidden" style={{ width: isChatSidebarCollapsed ? 0 : chatSidebarWidth, minWidth: isChatSidebarCollapsed ? 0 : 180, maxWidth: 500, transition: sidebarResizeRef.current ? 'none' : 'width 0.3s ease' }}>
        {/* Sidebar header unchanged for brevity (Using standard implementation) */}
        <div className="p-4 flex flex-col gap-3 border-b border-slate-200">
          {/* Model Selector */}
          <div className="relative" data-dropdown="model">
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="w-full text-left p-3 rounded-xl border border-slate-200 bg-[#faf6ed] hover:bg-slate-100 hover:border-slate-300 transition-all cursor-pointer flex items-center justify-between"
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
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#fefcf6] border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {[
                  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3', desc: 'Best all-around model', tag: 'Default', tagColor: 'bg-blue-50 text-blue-600' },
                  { id: 'openai/gpt-oss-120b', name: 'GPT 120B', desc: 'Most powerful reasoning', tag: 'Pro', tagColor: 'bg-purple-50 text-purple-600' },
                  { id: 'openai/gpt-oss-20b', name: 'GPT 20B', desc: 'Lightweight & fast', tag: 'Fast', tagColor: 'bg-emerald-50 text-emerald-600' },
                  { id: 'qwen/qwen3-32b', name: 'Qwen 3', desc: 'Advanced reasoning & math', tag: 'Smart', tagColor: 'bg-amber-50 text-amber-600' },
                ].map(model => (
                  <button
                    key={model.id}
                    onClick={() => { setSelectedModel(model.id); setIsModelDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-[#faf6ed] transition-colors ${selectedModel === model.id ? 'bg-[#faf6ed]' : ''}`}
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
            className="w-full text-left p-3 rounded-xl border border-slate-200 bg-[#faf6ed] hover:bg-slate-100 hover:border-slate-300 transition-all group cursor-pointer"
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
          <button onClick={() => startNewSession()} className="w-full text-left p-3 rounded-xl border border-dashed border-slate-300/50 bg-[#faf6ed] hover:bg-slate-100 transition-colors flex items-center gap-3 mb-4 group">
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
          className="hidden md:flex w-6 h-12 bg-[#fefcf6] border border-slate-200 shadow-sm rounded-r-lg items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all z-30 cursor-pointer shrink-0 my-auto"
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
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-[#fefcf6] shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 uppercase tracking-widest">Chat History</span>
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3">
              <button onClick={() => { startNewSession(); setIsMobileSidebarOpen(false); }} className="w-full text-left p-3 rounded-xl border border-dashed border-slate-300/50 bg-[#faf6ed] hover:bg-slate-100 transition-colors flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-100 transition-colors">
                  <SquarePen className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-slate-700">New Chat</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              {sessions.filter(s => s.messages.filter(m => m.isSelf).length > 0 || s.title !== "New Chat").length === 0 && (
                <div className="text-xs text-slate-400 px-1 py-4 text-center">No conversations yet.<br/>Start typing below to begin.</div>
              )}
              {sessions.filter(s => s.messages.filter(m => m.isSelf).length > 0 || s.title !== "New Chat").map(s => (
                <div
                  key={s.id}
                  onClick={() => { loadSession(s.id); setIsMobileSidebarOpen(false); }}
                  className={`group cursor-pointer flex items-center w-full px-3 mt-1 min-h-[44px] py-2.5 rounded-lg transition-all ${activeSessionId === s.id ? 'bg-slate-200/70 text-slate-900 border border-slate-200' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                >
                  <MessageSquare className="w-4 h-4 mr-3 shrink-0 opacity-70" />
                  <span className="text-sm font-medium flex-1 break-words leading-snug">{s.title}</span>
                  <button onClick={(e) => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all ml-1 p-1 rounded-md hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
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
        <div className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 border-b border-slate-200 shrink-0 z-20 bg-slate-100 backdrop-blur-xl">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Mobile hamburger menu */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 -ml-1 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
              title="Chat history"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="font-bold text-xs sm:text-sm tracking-wide text-slate-900 opacity-80 truncate">
              {(() => {
                if (!activeSessionId || messages.filter(m => m.isSelf).length === 0) return '';
                const title = sessions.find(s => s.id === activeSessionId)?.title || '';
                return title === 'New Chat' ? '' : title;
              })()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Token Count Pill */}
            <div className="relative">
              <button data-popup="cost" onClick={() => setShowCostBreakdown(!showCostBreakdown)} className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 h-8 sm:h-9 rounded-full bg-[#fefcf6] border border-slate-200 shadow-sm cursor-pointer hover:bg-[#faf6ed] transition-colors">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-slate-600 uppercase truncate">
                  <span className="hidden sm:inline">{totalGroqTokens.toLocaleString()} T <span className="opacity-30">|</span></span>
                  <span className="sm:hidden">{totalGroqTokens.toLocaleString()} T <span className="opacity-30">|</span></span>
                  {' '}≈ ${((totalGroqTokens * 0.00000006) + (totalElevenLabsChars * 0.000167)).toFixed(4)}
                </span>
              </button>
              {showCostBreakdown && (
                <div data-popup="cost" className="absolute top-full right-0 mt-2 z-[200] w-[320px] sm:w-[340px] bg-[#fefcf6] border border-slate-200 rounded-[6px] shadow-2xl p-4 sm:p-5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Platform Usage — All Users</h3>
                    <button onClick={() => setShowCostBreakdown(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-4">
                    <div className="p-3 bg-[#faf6ed] border border-slate-100 rounded-[4px]">
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
                    <div className="p-3 bg-[#faf6ed] border border-slate-100 rounded-[4px]">
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
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Platform Cost</span>
                        <span className="text-lg font-black text-white">${((totalGroqTokens * 0.00000006) + (totalElevenLabsChars * 0.000167)).toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsAgentEyeOpen(!isAgentEyeOpen)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 h-8 sm:h-9 rounded-full text-[10px] sm:text-xs font-bold tracking-wider uppercase transition-all border ${isAgentEyeOpen ? 'bg-amber-50 text-amber-600 border-amber-300' : 'bg-[#fefcf6] text-slate-500 border-slate-200 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50'}`}
              title="Agent Eye"
            >
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Agent Eye</span>
            </button>

            <button
              onClick={() => { setIsKnowledgeBaseOpen(!isKnowledgeBaseOpen); }}
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 h-8 sm:h-9 rounded-full text-[10px] sm:text-xs font-bold tracking-wider uppercase transition-all border ${isKnowledgeBaseOpen ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-[#fefcf6] text-slate-500 border-slate-200 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50'}`}
              title="Agent Studio"
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Agent Studio</span>
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

                {/* Clean Top Bar */}
                <div className="shrink-0 border-b border-slate-200 bg-white">
                  {/* Title + Close */}
                  <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Agent Studio</h2>
                    <Button variant="ghost" size="icon" onClick={() => setIsKnowledgeBaseOpen(false)} className="rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                      <X className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Tabs — full width, evenly spaced */}
                  <div className="flex items-stretch px-6 gap-0">
                    {[
                      { key: "identity", label: "Identity & Rules", onClick: () => setActiveSettingsTab("identity") },
                      { key: "data", label: "Knowledge Base", onClick: () => { setActiveSettingsTab("data"); fetchRAGDocs(); } },
                      { key: "pact", label: "P.A.C.T.", onClick: () => { setActiveSettingsTab("pact"); fetchPACTEntries(); }, badge: pactEntries.length > 0 ? pactEntries.length : null },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={tab.onClick}
                        className={`flex-1 pb-3 pt-1 text-xs font-bold tracking-widest uppercase border-b-2 transition-all flex items-center justify-center gap-2 ${
                          activeSettingsTab === tab.key
                            ? "border-slate-900 text-slate-900"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {activeSettingsTab === tab.key && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                        {tab.label}
                        {tab.badge && <span className="text-[9px] bg-slate-900 text-white px-1.5 py-0.5 rounded-full font-black ml-1">{tab.badge}</span>}
                      </button>
                    ))}
                  </div>

                  {/* Active tab description */}
                  <div className="px-6 py-3 bg-slate-50/50">
                    <p className="text-xs text-slate-500 text-center">
                      {activeSettingsTab === "identity" && `Define how ${agent.name.split(' ')[0]} communicates, its personality, and operational rules.`}
                      {activeSettingsTab === "data" && `Upload files and text for ${agent.name.split(' ')[0]} to reference. Org-wide knowledge is shared across all agents.`}
                      {activeSettingsTab === "pact" && `Facts ${agent.name.split(' ')[0]} has learned about you — automatically extracted from conversations.`}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-6 pb-56 max-w-7xl mx-auto w-full">
                  {activeSettingsTab === "identity" ? (
                    <div className="space-y-6 animate-in fade-in duration-300">

                      {/* Soul Section */}
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900 text-sm">Soul</h4>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Voice & Personality</p>
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold uppercase tracking-wider">Step 1</span>
                        </div>
                        <div className="p-6 pt-4">
                          <p className="text-xs text-slate-500 mb-3 leading-relaxed">Describe the tone, personality, and communication style the agent should adopt.</p>
                          <textarea
                            className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-300 leading-relaxed"
                            placeholder="e.g., You are extremely professional but maintain a warm, welcoming tone. Use clear, concise language."
                            value={agentConfig.soul}
                            onChange={e => setAgentConfig({ ...agentConfig, soul: e.target.value })}
                          />
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-slate-300 font-mono">{agentConfig.soul?.length || 0} characters</span>
                          </div>
                        </div>
                      </div>

                      {/* Brain Section */}
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
                              <Brain className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900 text-sm">Brain</h4>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Strict Wiring & Rules</p>
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold uppercase tracking-wider">Step 2</span>
                        </div>
                        <div className="p-6 pt-4">
                          <p className="text-xs text-slate-500 mb-3 leading-relaxed">Define strict operational directives, hard constraints, and non-negotiable rules.</p>
                          <textarea
                            className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-300 leading-relaxed"
                            placeholder="e.g., Never disclose PII. Do not share API keys. Always verify user identity before sensitive actions."
                            value={agentConfig.brain}
                            onChange={e => setAgentConfig({ ...agentConfig, brain: e.target.value })}
                          />
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-slate-300 font-mono">{agentConfig.brain?.length || 0} characters</span>
                          </div>
                        </div>
                      </div>

                      {/* Heartbeat Section */}
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center relative">
                              <Bot className="w-4 h-4 text-white" />
                              {heartbeatInterval !== "off" && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />}
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900 text-sm">Heartbeat</h4>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Autonomous Memory Cleanup</p>
                            </div>
                          </div>
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold uppercase tracking-wider">Step 3</span>
                        </div>
                        <div className="p-6 pt-4 space-y-4">
                          <p className="text-xs text-slate-500 leading-relaxed">Periodically evaluates P.A.C.T. entries and soft-deletes low-value facts. Marked entries auto-purge after 24 hours unless you cancel. The Heartbeat runs while you're in the chat — if you leave or close the browser, it'll finish one final sweep before stopping.</p>

                          {/* Interval Slider */}
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-2 block">Cleanup Interval</label>
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 gap-0">
                              {[
                                { value: "off", label: "Off" },
                                { value: "5m", label: "5m" },
                                { value: "10m", label: "10m" },
                                { value: "15m", label: "15m" },
                                { value: "30m", label: "30m" },
                                { value: "1h", label: "1h" },
                                { value: "2h", label: "2h" },
                                { value: "4h", label: "4h" },
                              ].map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => setHeartbeatInterval(opt.value)}
                                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${
                                    heartbeatInterval === opt.value
                                      ? "bg-slate-900 text-white shadow-sm"
                                      : "text-slate-500 hover:text-slate-700"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Status + Run Now */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${heartbeatInterval === "off" ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-600 border border-blue-200"}`}>
                                <div className={`w-2 h-2 rounded-full ${heartbeatInterval === "off" ? "bg-slate-400" : "bg-blue-500 animate-pulse"}`} />
                                {heartbeatInterval === "off" ? "Inactive" : "Active"}
                              </div>
                              {lastHeartbeatRun && (
                                <span className="text-[10px] text-slate-400">Last run: {new Date(lastHeartbeatRun).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={heartbeatRunning || !user?.uid}
                              onClick={() => runHeartbeatCleanup()}
                              className="text-xs font-bold text-slate-600 hover:text-slate-900 gap-1.5 h-8"
                            >
                              {heartbeatRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              {heartbeatRunning ? "Running..." : "Run Now"}
                            </Button>
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
                  ) : activeSettingsTab === "pact" ? (
                    <div className="space-y-5 animate-in fade-in duration-300">
                      <div className="border border-slate-200 rounded-2xl p-6 bg-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-base font-extrabold text-slate-900 mb-1.5 flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                                <BookOpen className="w-4 h-4 text-white" />
                              </div>
                              P.A.C.T. Memory
                            </h3>
                            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                              Facts {agent.name.split(' ')[0]} has learned about you. The Heartbeat periodically reviews and cleans up low-value entries.
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-6">
                            {/* Heartbeat spinning indicator */}
                            {heartbeatRunning && (
                              <div className="flex flex-col items-center gap-1 px-2">
                                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                                <span className="text-[8px] text-blue-500 uppercase tracking-widest font-bold">Heartbeat</span>
                              </div>
                            )}
                            {/* PACT toggle */}
                            <button onClick={() => setPactEnabled(!pactEnabled)} className={`border rounded-xl px-4 py-2 text-center transition-all cursor-pointer ${pactEnabled ? 'border-slate-200 hover:border-slate-300' : 'border-red-200 bg-red-50'}`} title={pactEnabled ? 'Click to disable P.A.C.T.' : 'Click to enable P.A.C.T.'}>
                              <div className={`text-xl font-black tabular-nums ${pactEnabled ? 'text-slate-900' : 'text-red-400'}`}>{pactEntries.filter(e => !e.markedForDeletion).length}</div>
                              <div className={`text-[9px] uppercase tracking-wider font-bold ${pactEnabled ? 'text-blue-500' : 'text-red-400'}`}>{pactEnabled ? 'Active' : 'Inactive'}</div>
                            </button>
                            {pactEntries.filter(e => e.markedForDeletion).length > 0 && (
                              <div className="border border-red-200 bg-red-50 rounded-xl px-4 py-2 text-center">
                                <div className="text-xl font-black text-red-500 tabular-nums">{pactEntries.filter(e => e.markedForDeletion).length}</div>
                                <div className="text-[9px] text-red-400 uppercase tracking-wider font-bold">Expiring</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {pactEntries.length === 0 ? (
                        <div className="h-48 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center bg-white gap-3 p-8">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-slate-300" />
                          </div>
                          <p className="text-sm text-slate-500 font-medium max-w-sm">No learned facts yet. As you chat with {agent.name.split(' ')[0]}, personal details you share will appear here.</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Try sharing your name, role, or preferences</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {[...pactEntries].sort((a, b) => {
                            // Active entries first, marked entries last
                            if (a.markedForDeletion && !b.markedForDeletion) return 1;
                            if (!a.markedForDeletion && b.markedForDeletion) return -1;
                            return 0;
                          }).map((entry, idx) => {
                            const isMarked = !!entry.markedForDeletion;
                            const msLeft = isMarked ? Math.max(0, 24 * 60 * 60 * 1000 - (pactTickNow - entry.markedForDeletion!)) : 0;
                            const hoursLeft = Math.ceil(msLeft / (60 * 60 * 1000));

                            return (
                            <div key={entry.id} className={`border rounded-xl px-5 py-4 transition-all group ${
                              isMarked
                                ? "border-red-200 bg-red-50/30"
                                : "border-slate-200 bg-white hover:bg-slate-50/50 hover:border-slate-300"
                            }`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`text-[10px] font-black w-5 h-5 rounded flex items-center justify-center shrink-0 ${isMarked ? "bg-red-500 text-white" : "bg-slate-900 text-white"}`}>{idx + 1}</span>
                                    <span className={`text-sm font-semibold leading-tight ${isMarked ? "line-through text-slate-400" : "text-slate-900"}`}>{entry.question}</span>
                                  </div>
                                  <p className={`text-sm pl-7 leading-relaxed ${isMarked ? "line-through text-slate-400" : "text-slate-600"}`}>{entry.answer}</p>
                                  <div className="flex items-center gap-2 mt-2 pl-7 flex-wrap">
                                    <span className="text-[10px] text-slate-400 font-medium">{entry.source === "voice" ? "Voice" : "Text"}</span>
                                    <span className="text-[10px] text-slate-300">·</span>
                                    <span className="text-[10px] text-slate-400 font-medium">{new Date(entry.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    {isMarked && (
                                      <>
                                        <span className="text-[10px] text-slate-300">·</span>
                                        <span className="text-[9px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">{entry.deletionReason || "Flagged"}</span>
                                        <span className="text-[10px] text-red-400 font-medium">Auto-deletes in {hoursLeft}h</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {isMarked ? (
                                  /* Cancel button — ⊘ restores entry */
                                  <Button variant="ghost" size="icon" className="text-red-400 hover:text-slate-900 hover:bg-slate-100 transition-all shrink-0 rounded-lg h-8 w-8" title="Cancel deletion — keep this fact" onClick={async () => {
                                    if (!user?.uid || !firestore) return;
                                    try {
                                      const { getDoc, doc, updateDoc } = await import("firebase/firestore");
                                      const userDocRef = doc(firestore, "users", user.uid);
                                      const userDocSnap = await getDoc(userDocRef);
                                      const currentEntries: any[] = userDocSnap.data()?.pact_entries_soltheory || [];
                                      const updated = currentEntries.map((e: any) =>
                                        (e.question === entry.question && e.answer === entry.answer)
                                          ? { ...e, markedForDeletion: undefined, deletionReason: undefined }
                                          : e
                                      );
                                      // Clean up undefined fields
                                      const cleaned = updated.map((e: any) => {
                                        const { markedForDeletion, deletionReason, ...rest } = e;
                                        if (markedForDeletion) return e;
                                        return rest;
                                      });
                                      await updateDoc(userDocRef, { pact_entries_soltheory: cleaned });
                                      setPactEntries(prev => prev.map(e => e.id === entry.id ? { ...e, markedForDeletion: undefined, deletionReason: undefined } : e));
                                    } catch (err) { console.error("Failed to restore PACT entry", err); }
                                  }}>
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                  </Button>
                                ) : (
                                  /* Delete button */
                                  <Button variant="ghost" size="icon" className="text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0 rounded-lg h-8 w-8" onClick={async () => {
                                    if (!user?.uid || !firestore) return;
                                    try {
                                      const { getDoc, doc, updateDoc } = await import("firebase/firestore");
                                      const userDocRef = doc(firestore, "users", user.uid);
                                      const userDocSnap = await getDoc(userDocRef);
                                      const currentEntries: any[] = userDocSnap.data()?.pact_entries_soltheory || [];
                                      const filtered = currentEntries.filter((e: any) => !(e.question === entry.question && e.answer === entry.answer));
                                      await updateDoc(userDocRef, { pact_entries_soltheory: filtered });
                                      logActivity(firestore, 'item_deleted', { email: user?.email || '', displayName: user?.displayName }, `Deleted PACT entry: ${entry.question}`);
                                      setPactEntries(prev => prev.filter(e => e.id !== entry.id));
                                    } catch (err) { console.error("Failed to delete PACT entry", err); }
                                  }}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in fade-in duration-300">

                      {/* Upload Section — PDF + Text */}
                      <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                            <Brain className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-900">Add Knowledge</h3>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Upload PDF or enter text</p>
                          </div>
                        </div>
                        <div className="p-6 space-y-5">
                          {/* PDF Upload */}
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-2 block">Upload PDF File</label>
                            <label className={`flex items-center justify-center gap-3 h-20 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${pdfUploading ? 'border-slate-300 bg-slate-50' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'}`}>
                              {pdfUploading ? (
                                <><Loader2 className="w-5 h-5 animate-spin text-slate-400" /><span className="text-sm text-slate-500 font-medium">Processing PDF...</span></>
                              ) : (
                                <><FileText className="w-5 h-5 text-slate-400" /><span className="text-sm text-slate-500">Click to upload a PDF</span></>
                              )}
                              <input type="file" accept=".pdf" className="hidden" disabled={pdfUploading} onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !user?.uid || !firestore) return;
                                e.target.value = "";
                                setPdfUploading(true);
                                try {
                                  const arrayBuffer = await file.arrayBuffer();
                                  const pdfjsLib = await import('pdfjs-dist');
                                  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
                                  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                                  let fullText = '';
                                  for (let i = 1; i <= pdf.numPages; i++) {
                                    const page = await pdf.getPage(i);
                                    const content = await page.getTextContent();
                                    const pageText = content.items.map((item: any) => item.str).join(' ');
                                    fullText += pageText + '\n\n';
                                  }
                                  fullText = fullText.trim();
                                  if (!fullText) { alert('Could not extract text from this PDF. It may be image-based.'); return; }
                                  const { collection, doc: fsDoc, setDoc } = await import("firebase/firestore");
                                  const docRef = fsDoc(collection(firestore, "users", user.uid, "agents", `soltheory_${params.agentId}`, "knowledge_docs"));
                                  await setDoc(docRef, { title: file.name.replace('.pdf', ''), type: 'pdf', size: fullText.length, content: fullText, fileUrl: '', createdAt: new Date().toISOString() });
                                  logActivity(firestore, 'file_uploaded', { email: user?.email || '', displayName: user?.displayName }, `Uploaded PDF: ${file.name}`);
                                  fetchRAGDocs();
                                } catch (err) { console.error('PDF upload error:', err); alert('Failed to process PDF.'); }
                                finally { setPdfUploading(false); }
                              }} />
                            </label>
                            <p className="text-[10px] text-slate-400 mt-1.5 pl-1">PDF text is extracted and stored as searchable knowledge.</p>
                          </div>

                          {/* Divider */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-slate-200" />
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">or enter text</span>
                            <div className="flex-1 h-px bg-slate-200" />
                          </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Document Title</label>
                          <input type="text" className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-slate-400 outline-none text-slate-900" value={ragTitle} onChange={e => setRagTitle(e.target.value)} placeholder="e.g. Company FAQ, SOPs, Product Info" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1">Text Content</label>
                          <textarea className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-1 focus:ring-slate-400 outline-none resize-none text-slate-900 h-48" value={ragTextContent} onChange={e => setRagTextContent(e.target.value)} placeholder="Paste any factual data, policies, or knowledge here..." />
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
                              logActivity(firestore, 'file_uploaded', { email: user?.email || '', displayName: user?.displayName }, `Uploaded knowledge doc: ${ragTitle}`);
                              setRagTitle(''); setRagTextContent(''); fetchRAGDocs();
                            } catch (err) { alert('Failed to save text.'); console.error(err); }
                            finally { setIsRAGUploading(false); }
                          }} disabled={isRAGUploading || !ragTitle || !ragTextContent} className="bg-slate-900 hover:bg-slate-800 text-white gap-2 border-0 shadow-lg px-6">
                            {isRAGUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save Entry
                          </Button>
                        </div>
                        </div>
                      </div>

                      {/* Active Data Sources */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-slate-900">Active Data Sources</h4>
                          {(isRAGUploading || pdfUploading) && <div className="text-xs font-bold text-slate-500 animate-pulse flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</div>}
                        </div>
                        {ragDocs.length === 0 ? (
                          <div className="h-24 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center text-sm text-slate-500 bg-white">
                            Knowledge base is currently empty. Upload a PDF or add text above.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {ragDocs.map((ragDoc, i) => (
                              <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between hover:border-slate-300 transition-all">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${ragDoc.type === 'pdf' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-600'}`}>
                                    {ragDoc.type === 'pdf' ? <FileText className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                                  </div>
                                  <div>
                                    <div className="font-bold text-sm text-slate-900">{ragDoc.title}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mt-0.5">{(ragDoc.size / 1024).toFixed(1)} KB • {ragDoc.type === 'pdf' ? 'PDF' : 'Text'} • Synced</div>
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
                                      logActivity(firestore!, 'file_deleted', { email: user?.email || '', displayName: user?.displayName }, `Deleted knowledge doc: ${ragDoc.title}`);
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

                      {/* Org Brain — always editable, auto-saves */}
                      <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center">
                              <Brain className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">Organization Brain</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {orgBrainSaving && <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium"><Loader2 className="w-3 h-3 animate-spin" />Saving...</div>}
                            <span className="text-[10px] text-slate-400 font-mono">{orgBrain.length.toLocaleString()} chars</span>
                          </div>
                        </div>
                        <div className="p-4">
                          <textarea
                            value={orgBrain}
                            onChange={(e) => handleOrgBrainChange(e.target.value)}
                            placeholder="Add shared organizational knowledge here. This is accessible to all agents and auto-saves as you type..."
                            className="w-full min-h-[200px] p-4 text-sm text-slate-700 font-sans leading-relaxed border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 resize-y bg-slate-50"
                          />
                          <p className="text-[10px] text-slate-400 mt-2 pl-1">Auto-saves as you type. All agents share this knowledge.</p>
                        </div>
                      </div>

                      {/* Read-only Default Knowledge */}
                      <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Default Knowledge (Built-in)</span>
                          <span className="text-[10px] text-slate-400 font-mono">{solTheoryKnowledge.length.toLocaleString()} chars</span>
                        </div>
                        <div className="p-6 max-h-[200px] overflow-y-auto scrollbar-thin">
                          <pre className="text-sm text-slate-500 whitespace-pre-wrap font-sans leading-relaxed">{solTheoryKnowledge}</pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Chat Screen
              <div className="flex-1 flex flex-col relative">
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 pt-4 sm:pt-6 pb-4 sm:pb-8">
                  <div className={`mx-auto space-y-8 ${messages.length === 0 && !selectedExploreItem && !activeSessionId ? 'max-w-6xl' : 'max-w-3xl'}`}>
                    {messages.length === 0 && !selectedExploreItem && !activeSessionId ? (
                      <div className="flex flex-col items-center justify-center pt-8 md:pt-32 lg:pt-40 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        
                        <div className="w-full">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4 w-full">
                             <h2 className="text-[24px] md:text-[40px] font-light text-slate-700 tracking-tight">
                               Explore INSiGHT {exploreTab === "models" ? "Models" : "Agents"}
                             </h2>
                             <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200/60 self-start md:self-auto">
                               <button onClick={() => setExploreTab("models")} className={`px-5 py-2 text-[13px] font-semibold rounded-full shadow-sm transition-all ${exploreTab === 'models' ? 'bg-[#fefcf6] text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 border border-transparent'}`}>Models</button>
                               <button onClick={() => setExploreTab("agents")} className={`px-5 py-2 text-[13px] font-semibold rounded-full shadow-sm transition-all ${exploreTab === 'agents' ? 'bg-[#fefcf6] text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 border border-transparent'}`}>Agents</button>
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
                                   <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-blue-500">
                                     <Mail className="w-4 h-4 md:w-5 md:h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[12px] md:text-[14px] text-slate-800 whitespace-nowrap">Email Agents</h3>
                                 </div>
                                 <p className="text-[11px] md:text-[13px] text-slate-500 leading-snug font-normal hidden md:block">Set up scheduled email campaigns!</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Social Media Agents")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-pink-50 group-hover:bg-pink-100 transition-colors flex items-center justify-center text-pink-500">
                                     <Users className="w-4 h-4 md:w-5 md:h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[12px] md:text-[14px] text-slate-800 whitespace-nowrap">Social Media Agents</h3>
                                 </div>
                                 <p className="text-[11px] md:text-[13px] text-slate-500 leading-snug font-normal hidden md:block">Set up scheduled social media posts.</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Message Agents")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors flex items-center justify-center text-emerald-500">
                                     <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[12px] md:text-[14px] text-slate-800 whitespace-nowrap">Message Agents</h3>
                                 </div>
                                 <p className="text-[11px] md:text-[13px] text-slate-500 leading-snug font-normal hidden md:block">Create messaging app integrations with AI.</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Advertising Agents")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-amber-50 group-hover:bg-amber-100 transition-colors flex items-center justify-center text-amber-500">
                                     <Presentation className="w-4 h-4 md:w-5 md:h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[12px] md:text-[14px] text-slate-800 whitespace-nowrap">Advertising Agents</h3>
                                 </div>
                                 <p className="text-[11px] md:text-[13px] text-slate-500 leading-snug font-normal hidden md:block">Build cron jobs for advertising campagins - Coming Soon.</p>
                               </div>

                               <div onClick={() => setIsAgentRequestModalOpen(true)} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 transition-colors flex items-center justify-center text-indigo-500">
                                     <Plus className="w-4 h-4 md:w-5 md:h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[12px] md:text-[14px] text-slate-800 whitespace-nowrap">Agent Request</h3>
                                 </div>
                                 <p className="text-[11px] md:text-[13px] text-slate-500 leading-snug font-normal hidden md:block">Submit a new agent request to the team.</p>
                               </div>

                               <div onClick={() => setSelectedExploreItem("Build your own Agent")} className="border border-slate-200/80 rounded-[16px] md:rounded-[20px] px-3 py-4 md:px-5 md:py-8 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer bg-white/50 group flex flex-col justify-start">
                                 <div className="flex items-center gap-3 mb-2">
                                   <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-slate-100 group-hover:bg-slate-200 transition-colors flex items-center justify-center text-slate-600">
                                     <Settings className="w-4 h-4 md:w-5 md:h-5" />
                                   </div>
                                   <h3 className="font-semibold text-[12px] md:text-[14px] text-slate-800 whitespace-nowrap">Build Agent</h3>
                                 </div>
                                 <p className="text-[11px] md:text-[13px] text-slate-500 leading-snug font-normal hidden md:block">Configure a custom agent with our drag & drop system - Coming Soon.</p>
                               </div>
                            </div>
                          )}
                        </div>

                        {/* Quick Chat + Voice */}
                        <div className="w-full max-w-2xl mx-auto mt-16 sm:mt-24 md:mt-32">
                          <p className="text-center text-[11px] sm:text-xs md:text-sm text-slate-400 mb-2 sm:mb-3">Ask Jarvis anything — he's a jack of all trades.</p>
                          <div className="flex items-center gap-2">
                            <form onSubmit={(e) => {
                              e.preventDefault();
                              if (!inputValue.trim()) return;
                              setSelectedExploreItem('Conversational AI');
                              // handleSendMessage will pick up inputValue and auto-create a session
                              setTimeout(() => handleSendMessage(), 50);
                            }} className="flex-1 flex items-center gap-2 bg-[#fefcf6] border border-slate-200 rounded-2xl shadow-sm px-3 sm:px-4 py-2.5 sm:py-3 hover:shadow-md transition-shadow min-w-0">
                              <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="What's on your mind?"
                                className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400 min-w-0"
                              />
                              <button type="submit" disabled={!inputValue.trim()} className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 text-white disabled:text-slate-400 flex items-center justify-center transition-colors shrink-0">
                                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                            </form>
                            <button
                              onClick={() => {
                                setSelectedExploreItem('Conversational AI');
                                openVoiceSession();
                              }}
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-slate-900/20 shrink-0 cursor-pointer"
                              title="Talk to Jarvis"
                            >
                              <div className="relative flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5">
                                <AudioLines className="w-4 h-4 sm:w-5 sm:h-5" />
                                <Sparkles className="w-2 h-2 sm:w-2.5 sm:h-2.5 absolute -top-1 -right-1 text-indigo-200" />
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                                                                  <>
                         <div className="flex justify-center mb-10 pt-10">
                          <div className="text-lg sm:text-2xl md:text-3xl font-black opacity-10 tracking-[0.15em] sm:tracking-[0.3em] uppercase text-center max-w-full truncate px-2 sm:px-4">{selectedExploreItem ? `${exploreItemsMeta[selectedExploreItem]?.name || ''} - ${selectedExploreItem}` : agent.name}</div>
                        </div>
                        {messages.map(msg => (
                      <div key={msg.id} className={`flex gap-2 sm:gap-4 ${msg.isSelf ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border border-slate-300 ${msg.isSelf ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-200/50'}`}>{msg.isSelf ? <User className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900" /> : <Bot className={`w-4 h-4 sm:w-5 sm:h-5 ${agent.accent}`} />}</div>
                        <div className={`flex-1 space-y-1 pt-1 min-w-0 ${msg.isSelf ? 'text-right' : ''}`}>
                          <div className={`text-slate-800 inline-block p-3 sm:p-4 rounded-2xl shadow-xl text-left backdrop-blur-md text-sm sm:text-base max-w-full break-words ${msg.isSelf ? 'bg-slate-300/50 rounded-tr-sm' : `${agent.chatBg} rounded-tl-sm [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>strong]:font-bold border`}`}>
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

                {(selectedExploreItem || activeSessionId || messages.length > 0) && (
                <div className="shrink-0 px-3 sm:px-4 pb-3 sm:pb-6 pt-1 sm:pt-2 z-20">
                  <div className="max-w-4xl mx-auto flex flex-col gap-2 relative">
                    {/* Interaction Buttons Overlay */}
                    <div className="flex justify-between items-center px-1 pointer-events-none mb-1">
                    </div>

                    <div className="flex items-center gap-2">
                    <div className="relative flex-1 border border-[#ede8da] rounded-xl sm:rounded-2xl overflow-hidden bg-[#fefcf6]/90 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.15)] focus-within:ring-1 focus-within:ring-fuchsia-500 backdrop-blur-2xl flex items-center">
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
                      {pendingAttachments.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#ede8da]/60 bg-[#faf6ed]/50">
                          {pendingAttachments.map((att, idx) => (
                            <div key={idx} className="relative shrink-0 group">
                              {att.preview ? (
                                <img src={att.preview} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#ede8da] shadow-sm" />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-[#faf6ed] border border-[#ede8da] flex items-center justify-center shadow-sm">
                                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                </div>
                              )}
                              <button
                                onClick={() => removePendingAttachment(idx)}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Input
                        placeholder="Instruct the agent..."
                        className="border-0 focus-visible:ring-0 shadow-none flex-1 pl-1 sm:pl-2 pr-12 sm:pr-14 min-h-[44px] sm:min-h-[64px] bg-transparent text-slate-900  placeholder:text-slate-500 text-sm sm:text-base focus-visible:ring-offset-0 focus-visible:outline-none focus:outline-none !border-l-0"
                        value={inputValue} onChange={e => setInputValue(e.target.value)} onPaste={handlePaste} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      />

                      <Button size="icon" onClick={handleSendMessage} disabled={!inputValue.trim() || isTyping} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#fefcf6] text-black hover:bg-slate-200 w-8 h-8 sm:w-10 sm:h-10 disabled:opacity-30">
                        {isTyping ? <Loader2 className="w-5 h-5 ml-0.5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                      </Button>
                    </div>

                    {/* Voice-to-Voice button — always outside the text box */}
                    <div className="relative shrink-0">
                    <button
                      onClick={openVoiceSession}
                      className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-slate-900/20 cursor-pointer"
                      title="Start Voice Session"
                    >
                      <div className="relative flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5">
                        <AudioLines className="w-4 h-4 sm:w-5 sm:h-5" />
                        <Sparkles className="w-2 h-2 sm:w-2.5 sm:h-2.5 absolute -top-1 -right-1 text-slate-400" />
                      </div>
                    </button>

                    {/* Heartbeat pulse indicator — absolutely positioned so it doesn't shift layout */}
                    {heartbeatPulseVisible && heartbeatInterval !== "off" && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0 animate-in fade-in zoom-in-95 duration-300 pointer-events-none">
                        <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                        <span className="text-[6px] text-blue-400 uppercase tracking-widest font-bold">Heartbeat</span>
                      </div>
                    )}
                    </div>
                  </div>
                </div>
                </div>
                )}
              </div>
            )}
          </div>




        </div>
      </div>

      {/* System Instructions Popup */}
      {isSystemInstructionsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsSystemInstructionsOpen(false)}>
          <div className="bg-[#fefcf6] rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
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
                className="w-full h-40 p-4 bg-[#faf6ed] border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-300 leading-relaxed"
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
          if (user?.uid && pactEnabled && userText.trim().length > 15) {
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
          <div className="bg-[#fefcf6] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-[#faf6ed]/50">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  className="w-full mt-1 bg-[#fefcf6] border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-slate-900 h-32" 
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-[#faf6ed]/50 flex justify-end gap-3">
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
              const wasDrag = agentEyeMinDragRef.current && Math.abs(e.clientX - agentEyeMinDragRef.current.startX) > 5;
              agentEyeMinDragRef.current = null;
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              // If it was a click (not a drag), restore and expand
              if (!wasDrag) {
                setIsAgentEyeMinimized(false);
                setIsAgentEyeOpen(true);
                const targetW = Math.min(window.innerWidth - 80, 1400);
                const targetH = Math.min(window.innerHeight - 80, 900);
                const x = Math.max(40, (window.innerWidth - targetW) / 2);
                const y = Math.max(40, (window.innerHeight - targetH) / 2);
                setAgentEyeSize({ w: targetW, h: targetH });
                setAgentEyePos({ x, y });
                setAgentEyeExpanded(true);
              }
            } : onAgentEyeDragEnd}
            onDoubleClick={isAgentEyeMinimized ? () => {
              // Single click on bar handles restore; double-click also works
              setIsAgentEyeMinimized(false);
              setIsAgentEyeOpen(true);
              const targetW = Math.min(window.innerWidth - 80, 1400);
              const targetH = Math.min(window.innerHeight - 80, 900);
              const x = Math.max(40, (window.innerWidth - targetW) / 2);
              const y = Math.max(40, (window.innerHeight - targetH) / 2);
              setAgentEyeSize({ w: targetW, h: targetH });
              setAgentEyePos({ x, y });
              setAgentEyeExpanded(true);
            } : onAgentEyeDoubleClick}
            className={`flex items-center justify-between h-11 px-4 shrink-0 select-none ${isAgentEyeMinimized ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
            style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)' }}
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-white/90" />
              <span className="text-xs font-bold uppercase tracking-widest text-white/95">Agent Eye</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Minimize to tray */}
              {!isAgentEyeMinimized && (
                <button
                  onClick={() => {
                    setIsAgentEyeMinimized(true);
                    setIsAgentEyeOpen(false);
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                  title="Minimize to tray"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14H5" /></svg>
                </button>
              )}
              {/* Expand / Restore toggle */}
              <button
                onClick={() => {
                  if (isAgentEyeMinimized) {
                    // Restore from minimized to near-fullscreen
                    setIsAgentEyeMinimized(false);
                    setIsAgentEyeOpen(true);
                    const targetW = Math.min(window.innerWidth - 80, 1400);
                    const targetH = Math.min(window.innerHeight - 80, 900);
                    const x = Math.max(40, (window.innerWidth - targetW) / 2);
                    const y = Math.max(40, (window.innerHeight - targetH) / 2);
                    setAgentEyeSize({ w: targetW, h: targetH });
                    setAgentEyePos({ x, y });
                    setAgentEyeExpanded(true);
                  } else if (agentEyeExpanded) {
                    // Shrink back to default
                    const defaultW = window.innerWidth < 640 ? Math.min(window.innerWidth - 16, 380) : 780;
                    const defaultH = window.innerWidth < 640 ? 400 : 620;
                    setAgentEyeSize({ w: defaultW, h: defaultH });
                    setAgentEyeExpanded(false);
                  } else {
                    // Expand to near-fullscreen
                    const targetW = Math.min(window.innerWidth - 80, 1400);
                    const targetH = Math.min(window.innerHeight - 80, 900);
                    const x = Math.max(40, (window.innerWidth - targetW) / 2);
                    const y = Math.max(40, (window.innerHeight - targetH) / 2);
                    setAgentEyeSize({ w: targetW, h: targetH });
                    setAgentEyePos({ x, y });
                    setAgentEyeExpanded(true);
                  }
                }}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                title={isAgentEyeMinimized ? 'Restore & Expand' : agentEyeExpanded ? 'Restore size' : 'Expand'}
              >
                {(isAgentEyeMinimized || !agentEyeExpanded) ? (
                  <Maximize2 className="w-3 h-3 text-white" />
                ) : (
                  <Minimize2 className="w-3 h-3 text-white" />
                )}
              </button>
              {/* Close button */}
              <button
                onClick={() => { setIsAgentEyeOpen(false); setIsAgentEyeMinimized(false); setAgentEyeExpanded(false); }}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          {!isAgentEyeMinimized && (<>
          {/* Observer Dropdown Selector */}
          <div className="relative shrink-0 border-b border-slate-200 bg-[#faf6ed]/80">
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
                  {agentEyeTab === 'gmail' && 'Gmail View'}
                  {agentEyeTab === 'outlook' && 'Outlook'}
                  {agentEyeTab === 'sms' && 'SMS'}
                  {agentEyeTab === 'jarvis-view' && 'Jarvis View'}
                </span>
                {agentEyeTab === 'gmail' && (() => {
                  const unreadCount = incomingEmails.filter(e => !readEmails.has(e.id)).length;
                  return unreadCount > 0 ? (
                    <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  ) : null;
                })()}
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${agentEyeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {agentEyeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAgentEyeDropdownOpen(false)} />
                <div className="absolute top-full left-0 right-0 z-50 bg-[#fefcf6] border border-slate-200 rounded-b-xl shadow-xl overflow-hidden">
                {[
                  { id: 'gmail' as const, label: 'Gmail View', icon: <Mail className="w-4 h-4 text-red-500" />, ready: true },
                  { id: 'outlook' as const, label: 'Outlook', icon: <Mail className="w-4 h-4 text-blue-500" />, ready: false },
                  { id: 'sms' as const, label: 'SMS', icon: <Smartphone className="w-4 h-4 text-purple-500" />, ready: true },
                  { id: 'jarvis-view' as const, label: 'Jarvis View', icon: <Monitor className="w-4 h-4 text-amber-500" />, ready: true },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setAgentEyeTab(item.id); setAgentEyeDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-[#faf6ed] transition-colors ${
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
              </>
            )}
          </div>

          {/* Observer Body */}
          <div className="flex-1 overflow-auto flex flex-col">

            {/* ──── Gmail View ──── */}
            {agentEyeTab === 'gmail' && (
              <div className="flex-1 flex flex-col h-full">
                {!lastDraftedEmail ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 flex items-center justify-center">
                      <Mail className="w-8 h-8 text-red-400" />
                    </div>
                    <div className="text-center max-w-xs">
                      <p className="text-sm font-semibold text-slate-700">No emails drafted yet</p>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Ask Jarvis to write or send an email to someone, and you&apos;ll see it composed here in real time.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {/* Compose Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#ede8da] bg-[#fefcf6] shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Drafted by Jarvis</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          {new Date(lastDraftedEmail.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={() => setLastDraftedEmail(null)}
                          className="text-[10px] text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Email Compose Area */}
                    <div className="flex-1 overflow-auto p-4">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-full">
                        {/* To Field */}
                        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100">
                          <span className="text-xs font-semibold text-slate-400 w-12 shrink-0">To</span>
                          <div className="flex items-center gap-1.5">
                            <div className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                              {lastDraftedEmail.to}
                            </div>
                          </div>
                        </div>

                        {/* Subject Field */}
                        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100">
                          <span className="text-xs font-semibold text-slate-400 w-12 shrink-0">Subject</span>
                          <span className="text-sm font-medium text-slate-800">{lastDraftedEmail.subject}</span>
                        </div>

                        {/* Email Body with typing effect */}
                        <div className="px-4 py-4 min-h-[200px]">
                          <GmailViewTypingBody text={lastDraftedEmail.body} key={lastDraftedEmail.timestamp} />
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                              <span className="text-[8px] font-bold text-white">J</span>
                            </div>
                            <span className="text-[10px] text-slate-400">Saved to Gmail Drafts</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-[10px] font-medium text-emerald-600">Draft Ready</span>
                          </div>
                        </div>
                      </div>
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
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-[#fefcf6] shrink-0">
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
                                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-[#faf6ed] transition-colors text-left">
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
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-[#fefcf6] shrink-0">
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
                              isMe ? 'bg-purple-500 text-white rounded-br-md' : 'bg-[#fefcf6] text-slate-800 border border-slate-200 rounded-bl-md'
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
                    <div className="border-t border-slate-200 p-2 bg-[#fefcf6] shrink-0">
                      <form onSubmit={(e) => { e.preventDefault(); sendSms(); }} className="flex gap-1.5">
                        <input
                          value={smsNewMessage}
                          onChange={e => setSmsNewMessage(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1 h-9 px-3 text-[12px] bg-[#faf6ed] border border-slate-200 rounded-full focus:outline-none focus:ring-1 focus:ring-purple-300 text-slate-800 placeholder:text-slate-400"
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
