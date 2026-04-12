"use client";

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
  Sparkles,
} from "lucide-react";
import { useUser, useFirestore } from "@/firebase";
import { usePathname } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";

type DriveFileType = "docs" | "slides" | "sheets";

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
};

export function DriveMockupView({ type }: { type: DriveFileType }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const pathname = usePathname();

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isFetched, setIsFetched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const origin = pathname.includes("/nxtchapter") ? "nxtchapter" : "soltheory";
  const config = CONFIG[type];
  const Icon = config.icon;

  // Helper: read refresh token from Firestore (matches calendar-view pattern)
  const getRefreshToken = async (uid: string): Promise<string | null> => {
    if (!firestore) return null;
    const docSnap = await getDoc(doc(firestore, "users", uid));
    const data = docSnap.data();
    return (
      data?.gmailOAuth_morpheus?.refreshToken ||
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken, mimeTypePrefix: config.mimeType }),
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
  }, [user, firestore]);

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
              New (via Morpheus)
            </button>
          </div>

          <div className="px-4 py-2 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-3">
              AI Created Files
            </div>
            <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${config.headerBg} ${config.color} font-medium text-sm`}>
              <Sparkles className="w-4 h-4" />
              <span>Morpheus Documents</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 text-sm hover:bg-slate-50 cursor-pointer transition-colors">
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
                Ask Morpheus to create documents for you! Try: &ldquo;Create a Google Doc called Meeting Notes with a summary of today&rsquo;s agenda.&rdquo;
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
                  window.location.href = `/api/auth/google?uid=${user?.uid || ""}&agentId=morpheus&origin=${origin}&returnTo=settings`;
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
                  Link your Google account through Settings to view documents created by your AI agent Morpheus.
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
                    : `Ask Morpheus to create a ${config.title.replace("Google ", "")} document in the AI Agent chat and it will appear here.`}
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
    </div>
  );
}
