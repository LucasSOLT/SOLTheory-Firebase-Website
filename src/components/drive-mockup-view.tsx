"use client";

import { getAuthHeaders } from "@/lib/api-auth-client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Presentation,
  Table,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  Loader2,
  Search,
  Settings,
  Menu,
  Plus,
  X,
  Send,
  Sparkles,
  SlidersHorizontal,
  ChevronUp,
  Type,
  AlignJustify,
  Hash,
} from "lucide-react";
import { useUser, useFirestore } from "@/firebase";
import { usePathname } from "next/navigation";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';

let _msgCounter = 0;
const uid = () => `msg-${Date.now()}-${++_msgCounter}-${Math.random().toString(36).substring(2, 7)}`;

type DriveFileType = "docs" | "slides" | "sheets" | "drive";

interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
  iconLink?: string;
  thumbnailLink?: string;
  createdTime: string;
  modifiedTime: string;
}

const CONFIG: Record<DriveFileType, { title: string; mimeType: string; icon: typeof FileText; color: string; bgColor: string; borderColor: string; headerBg: string }> = {
  docs: {
    title: "Google Docs",
    mimeType: "application/vnd.google-apps.document",
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-600",
    borderColor: "border-blue-200",
    headerBg: "bg-blue-50",
  },
  slides: {
    title: "Google Slides",
    mimeType: "application/vnd.google-apps.presentation",
    icon: Presentation,
    color: "text-amber-600",
    bgColor: "bg-amber-500",
    borderColor: "border-amber-200",
    headerBg: "bg-amber-50",
  },
  sheets: {
    title: "Google Sheets",
    mimeType: "application/vnd.google-apps.spreadsheet",
    icon: Table,
    color: "text-green-600",
    bgColor: "bg-green-600",
    borderColor: "border-green-200",
    headerBg: "bg-green-50",
  },
  drive: {
    title: "Google Drive",
    mimeType: "", // empty means fetch all
    icon: FolderOpen,
    color: "text-purple-600",
    bgColor: "bg-purple-600",
    borderColor: "border-purple-200",
    headerBg: "bg-purple-50",
  },
};

export function DriveMockupView({ type }: { type: DriveFileType }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const pathname = usePathname();
  const { knowledgeBaseText, pactText, orgBrainText } = useKnowledgeBase('soltheory');

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isFetched, setIsFetched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [fetchAll, setFetchAll] = useState(type === "drive");

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<{id: string, text: string, isSelf: boolean}[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Document settings
  const [showDocSettings, setShowDocSettings] = useState(false);
  const [docWordCount, setDocWordCount] = useState(1000);
  const [docFont, setDocFont] = useState("Arial");
  const [docSpacing, setDocSpacing] = useState<"single" | "double">("double");

  const GOOGLE_DOCS_FONTS = [
    "Arial", "Times New Roman", "Georgia", "Verdana", "Trebuchet MS",
    "Courier New", "Comic Sans MS", "Garamond", "Palatino Linotype",
    "Roboto", "Open Sans", "Lato"
  ];
  const chatBottomRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [messages, isTyping, isChatOpen]);

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
        rToken = (docData?.gmailOAuth_jarvis?.refreshToken || docData?.gmailOAuth_morpheus?.refreshToken) || docData?.gmailOAuth?.refreshToken || null;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ 
          messages: [...messages, userMsg].map(m => ({
            role: m.isSelf ? "user" : "assistant",
            content: m.text
          })), 
          agentId: `nxtchapter_drive_assistant`,
          soul: `You are the Google Drive Assistant for this dashboard. You have the ability to draft Google Docs natively using your function tools. If the user asks you to draft a document, draft a presentation, or draft a spreadsheet, USE YOUR \`create_google_document\`, \`create_google_slide_deck\`, or \`create_google_sheet\` functions respectively. Do not pretend, actually use your tools to make the drive files! Keep your direct conversational replies short since you live in a sidebar window.

[DOCUMENT QUALITY DIRECTIVES]:
When creating Google Docs, you MUST follow these rules:
- Target word count: approximately ${docWordCount} words. This is CRITICAL. Write substantially — do NOT produce short, skeletal documents.
- Structure the document into clear sections with headings.
- Write 2-3 full paragraphs per page (approximately every 250-300 words).
- Each paragraph should be 4-6 sentences minimum.
- Use professional, well-researched prose. Include specific details, examples, data points, and actionable insights.
- Break the document into logical sections with clear section headings (use headings like "## Section Title").
- Separate paragraphs with blank lines for readability.
- Do NOT use bullet points excessively — prefer flowing prose paragraphs.
- The user wants font: ${docFont}, spacing: ${docSpacing}-spaced.
- Pass font="${docFont}" and lineSpacing="${docSpacing}" in your create_google_document call.
- IMPORTANT: Write the FULL document body in a single create_google_document call. Do not truncate or summarize.`,
          brain: "",
          uid: user?.uid,
          refreshToken: rToken,
          contacts: [],
          knowledgeBaseText,
          pactText,
          orgBrainText
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get response");
      
      setMessages(prev => [...prev, { id: uid(), text: data.response || "No response generated.", isSelf: false }]);
      handleRefresh(); // Try to auto-refresh the files list in case a new one was created!
    } catch (error: any) {
       setMessages(prev => [...prev, { id: uid(), text: `Error: ${error.message}`, isSelf: false }]);
    } finally {
      setIsTyping(false);
    }
  };

  const origin = pathname.includes("/nxtchapter") ? "nxtchapter" : "soltheory";
  const config = CONFIG[type];
  const Icon = config.icon;

  // Helper: read refresh token from Firestore (matches calendar-view pattern)
  const getRefreshToken = async (uid: string): Promise<string | null> => {
    if (!firestore) return null;
    const docSnap = await getDoc(doc(firestore, "users", uid));
    const data = docSnap.data();
    return (
      (data?.gmailOAuth_jarvis?.refreshToken || data?.gmailOAuth_morpheus?.refreshToken) ||
      data?.gmailOAuth_email?.refreshToken ||
      data?.["gmailOAuth_inbound-email"]?.refreshToken ||
      data?.gmailOAuth?.refreshToken ||
      null
    );
  };

  const fetchFiles = async (refreshToken: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/drive/files", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ refreshToken, mimeTypePrefix: config.mimeType, fetchAll }),
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
        setIsConnected(true);
      }
    } catch (err) {
      console.error("Drive fetch error:", err);
    } finally {
      setIsFetched(true);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.uid || !firestore) return;
    getRefreshToken(user.uid).then((token) => {
      if (token) {
        fetchFiles(token);
      } else {
        setIsFetched(true);
      }
    });
  }, [user, firestore, fetchAll]);

  const handleRefresh = () => {
    if (!user?.uid || !firestore) return;
    getRefreshToken(user.uid).then((token) => {
      if (token) fetchFiles(token);
    });
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mr-4">
            <div className={`w-8 h-8 ${config.bgColor} rounded-md flex items-center justify-center shadow-sm`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-medium text-slate-700 tracking-tight">
              {config.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search AI documents..."
              className="pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white hover:bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all w-64"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-[280px] bg-white border-r border-slate-200 flex flex-col hidden lg:flex shrink-0">
          <div className="p-4">
            <button className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:bg-slate-50 transition-all font-medium text-slate-700">
              <Plus className="w-5 h-5 text-slate-500" />
              New (via Jarvis)
            </button>
          </div>

          <div className="px-4 py-2 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-3">
              AI Created Files
            </div>
            <div 
              onClick={() => setFetchAll(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer font-medium text-sm transition-colors ${!fetchAll ? config.headerBg + ' ' + config.color : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Jarvis Documents</span>
            </div>
            <div 
              onClick={() => setFetchAll(true)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer font-medium text-sm transition-colors ${fetchAll ? config.headerBg + ' ' + config.color : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <FolderOpen className="w-4 h-4" />
              <span>All Files</span>
            </div>
          </div>

          <div className="px-6 mt-auto pb-6">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Pro Tip
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ask Jarvis to create documents for you! Try: &ldquo;Create a Google Doc called Meeting Notes with a summary of today&rsquo;s agenda.&rdquo;
              </p>
            </div>
          </div>
        </aside>

        {/* Main Grid */}
        <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden relative">
          {/* Auth Alert */}
          {!isConnected && isFetched && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-50 border border-amber-200 text-amber-800 px-6 py-3 rounded-xl shadow-lg flex items-center gap-4 text-sm font-medium animate-in slide-in-from-top-4">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <span>Connect your Google Account to view AI-created {config.title.replace("Google ", "")} files.</span>
              </div>
              <button
                onClick={() => {
                  window.location.href = `/api/auth/google?uid=${user?.uid || ""}&agentId=jarvis&origin=${origin}&returnTo=settings`;
                }}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap shadow-sm"
              >
                Connect Google
              </button>
            </div>
          )}

          {/* Grid Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>AI-Created Documents</span>
              {isConnected && (
                <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {files.length}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400">
              {isConnected ? "Sorted by creation date" : ""}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading && !isFetched ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : !isConnected && isFetched ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <div className={`w-20 h-20 ${config.headerBg} rounded-2xl flex items-center justify-center`}>
                  <Icon className={`w-10 h-10 ${config.color} opacity-60`} />
                </div>
                <h3 className="text-lg font-semibold text-slate-700">
                  Connect Google to Get Started
                </h3>
                <p className="text-sm text-slate-400 max-w-md">
                  Link your Google account through Settings to view documents created by your AI agent Jarvis.
                </p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <div className={`w-20 h-20 ${config.headerBg} rounded-2xl flex items-center justify-center`}>
                  <FolderOpen className={`w-10 h-10 ${config.color} opacity-40`} />
                </div>
                <h3 className="text-lg font-semibold text-slate-700">
                  {searchQuery ? "No matching documents" : "No AI documents yet"}
                </h3>
                <p className="text-sm text-slate-400 max-w-md">
                  {searchQuery
                    ? "Try a different search term."
                    : `Ask Jarvis to create a ${config.title.replace("Google ", "")} document in the AI Agent chat and it will appear here.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filteredFiles.map((file) => (
                  <a
                    key={file.id}
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
                  >
                    {/* Card Thumbnail */}
                    <div className={`h-36 ${config.headerBg} flex items-center justify-center relative overflow-hidden`}>
                      {file.thumbnailLink ? (
                        <img
                          src={file.thumbnailLink}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <Icon className={`w-16 h-16 ${config.color} opacity-20 group-hover:opacity-30 group-hover:scale-110 transition-all duration-500`} />
                      )}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-white/90 backdrop-blur-sm p-1.5 rounded-lg shadow-sm">
                          <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                        </div>
                      </div>
                      <div className="absolute bottom-2 left-2">
                        <div className="flex items-center gap-1 bg-indigo-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          <Sparkles className="w-2.5 h-2.5" />
                          AI
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex-1 flex flex-col">
                      <h4 className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                        {file.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                        <span>Created {formatDate(file.createdTime)}</span>
                        <span>·</span>
                        <span>{formatTime(file.createdTime)}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* ══════ AI COPILOT TOGGLE ══════ */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`fixed bottom-6 right-6 z-[90] w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all cursor-pointer ${isChatOpen ? "bg-slate-700 hover:bg-slate-800" : `${config.bgColor} hover:opacity-90`} text-white`}
      >
        {isChatOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>

      {/* ══════ AI COPILOT SIDEBAR ══════ */}
      <div className={`fixed top-0 right-0 h-full z-[80] transition-transform duration-300 ease-in-out ${isChatOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="w-[380px] h-full bg-white border-l border-[#E5E7EB] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-[#E5E7EB] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center`}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 leading-tight">Drive Assistant</h3>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Online</span>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
            {/* Welcome message */}
            <div className="flex justify-start">
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap bg-slate-100 text-slate-700 rounded-bl-md border border-slate-200">
                Hey there! I&apos;m integrated directly into your {config.title}. Would you like me to draft a new document or presentation for you?
              </div>
            </div>

            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.isSelf ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                  msg.isSelf
                    ? "bg-indigo-600 text-white rounded-br-md"
                    : "bg-slate-100 text-slate-700 rounded-bl-md border border-slate-200"
                }`}>
                  {msg.isSelf ? msg.text : (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({node, ...props}) => <a {...props} className="text-blue-600 hover:text-blue-800 hover:underline font-medium break-all" target="_blank" rel="noopener noreferrer" />,
                        p: ({node, ...props}) => <p {...props} className="mb-2 last:mb-0" />
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed bg-slate-100 text-slate-700 rounded-bl-md border border-slate-200 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  <span>Writing...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input + Doc Settings */}
          <div className="border-t border-[#E5E7EB] shrink-0 bg-white relative">
            {/* Dropup Settings Panel */}
            {showDocSettings && (
              <div className="absolute bottom-full left-0 right-0 bg-white border-t border-[#E5E7EB] shadow-lg rounded-t-xl z-10 animate-in slide-in-from-bottom-2 duration-200">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                    Document Settings
                  </h4>
                  <button onClick={() => setShowDocSettings(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="px-4 py-3 space-y-4">
                  {/* Word Count */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Hash className="w-3 h-3" /> Word Count
                      <span className="ml-auto text-indigo-600 font-bold text-xs normal-case">{docWordCount.toLocaleString()} words</span>
                    </label>
                    <input
                      type="range"
                      min={250}
                      max={5000}
                      step={250}
                      value={docWordCount}
                      onChange={(e) => setDocWordCount(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                      <span>250</span>
                      <span>2,500</span>
                      <span>5,000</span>
                    </div>
                  </div>

                  {/* Font */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Type className="w-3 h-3" /> Font Family
                    </label>
                    <select
                      value={docFont}
                      onChange={(e) => setDocFont(e.target.value)}
                      className="w-full h-9 px-3 text-sm rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 cursor-pointer"
                    >
                      {GOOGLE_DOCS_FONTS.map(f => (
                        <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                      ))}
                    </select>
                  </div>

                  {/* Spacing */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <AlignJustify className="w-3 h-3" /> Line Spacing
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDocSpacing("single")}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                          docSpacing === "single"
                            ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                            : "bg-[#F9FAFB] border-[#E5E7EB] text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        Single
                      </button>
                      <button
                        onClick={() => setDocSpacing("double")}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                          docSpacing === "double"
                            ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                            : "bg-[#F9FAFB] border-[#E5E7EB] text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        Double
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Settings toggle bar */}
            <div className="px-4 pt-2">
              <button
                onClick={() => setShowDocSettings(!showDocSettings)}
                className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  showDocSettings
                    ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent"
                }`}
              >
                <ChevronUp className={`w-3 h-3 transition-transform ${showDocSettings ? "rotate-180" : ""}`} />
                {docFont} · {docWordCount.toLocaleString()} words · {docSpacing === "double" ? "Double" : "Single"}-spaced
              </button>
            </div>

            {/* Input row */}
            <div className="px-4 py-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                  placeholder="Ask the Assistant..."
                  className="flex-1 h-10 px-3.5 text-sm rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim() || isTyping}
                  className="w-10 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 text-center">Try &quot;Write a 2000-word research paper on AI&quot;</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
