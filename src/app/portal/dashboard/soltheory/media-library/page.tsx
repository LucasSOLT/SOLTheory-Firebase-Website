"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useUser, useFirestore, useStorage } from "@/firebase";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const DocumentEditor = dynamic(() => import("@/components/media-library/DocumentEditor"), { ssr: false });
import { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Table,
  Clock,
  Plus,
  ChevronRight,
  ChevronDown,

  Share2,
  Trash2,
  Edit3,
  Info,
  Search,
  Upload,
  X,
  FolderPlus,
  FilePlus,
  Check,
  Users,
  Link2,
  Play,
  Eye,
  Download,
  Maximize2,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  children: string[];
  itemCount: number;
  createdAt: Date;
}

interface ShareEntry {
  uid?: string;
  email: string;
  displayName: string;
  photoURL?: string;
  initials: string;
}

interface FileItem {
  id: string;
  name: string;
  type: string;
  extension: string;
  size: string;
  sizeBytes: number;
  modified: string;
  modifiedDate: Date;
  folderId: string;
  sharedWith: ShareEntry[];
  lastAccessed: Date;
  content: string;
  downloadUrl?: string;
  mimeType?: string;
}

interface RecentItem {
  id: string;
  name: string;
  type: "folder" | "file";
  extension?: string;
  accessedAt: Date;
}

interface OrgMember {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role?: string;
}

type SortKey = "name" | "type" | "size" | "modified";
type SortDir = "asc" | "desc";

interface ContextMenuState {
  x: number;
  y: number;
  targetType: "folder" | "file";
  targetId: string;
}

interface SidebarPopupState {
  x: number;
  y: number;
  folderId: string;
}

/* ═══════════════════════════════════════════════════════════════
   INITIAL DATA — EMPTY
   ═══════════════════════════════════════════════════════════════ */

const INITIAL_FOLDERS: Record<string, FolderNode> = {
  "my-files": { id: "my-files", name: "My Files", parentId: null, children: [], itemCount: 0, createdAt: new Date() },
  shared: { id: "shared", name: "Shared with Me", parentId: null, children: [], itemCount: 0, createdAt: new Date() },
  trash: { id: "trash", name: "Trash", parentId: null, children: [], itemCount: 0, createdAt: new Date() },
};

/* ═══════════════════════════════════════════════════════════════
   MEDIA TYPE HELPERS
   ═══════════════════════════════════════════════════════════════ */

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov"]);
const ACCEPTED_MEDIA_TYPES = "image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,video/quicktime";
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.svg,.gif,.mp4,.webm,.mov";

function isImageFile(ext: string): boolean {
  return IMAGE_EXTENSIONS.has(ext.toLowerCase());
}

function isVideoFile(ext: string): boolean {
  return VIDEO_EXTENSIONS.has(ext.toLowerCase());
}

function isMediaFile(ext: string): boolean {
  return isImageFile(ext) || isVideoFile(ext);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function getFileIcon(ext: string, size: number, dark: boolean) {
  const cls = `w-${size} h-${size}`;
  const baseColor = dark ? "text-slate-400" : "text-slate-500";
  switch (ext) {
    case "pdf": return <FileText className={`${cls} text-red-500`} />;
    case "docx": return <FileText className={`${cls} text-blue-500`} />;
    case "xlsx": case "csv": return <Table className={`${cls} text-emerald-500`} />;
    case "png": case "jpg": case "jpeg": case "gif": case "webp": case "svg": return <Image className={`${cls} text-purple-500`} />;
    case "mp4": case "mov": case "webm": return <Video className={`${cls} text-orange-500`} />;
    case "mp3": case "wav": case "aac": return <Music className={`${cls} text-pink-500`} />;
    case "zip": case "rar": case "7z": return <Archive className={`${cls} text-amber-600`} />;
    case "txt": return <FileText className={`${cls} text-slate-500`} />;
    default: return <File className={`${cls} ${baseColor}`} />;
  }
}

function getTypeBadgeColor(ext: string): string {
  switch (ext) {
    case "pdf": return "bg-red-50 text-red-700 border-red-200";
    case "docx": return "bg-blue-50 text-blue-700 border-blue-200";
    case "xlsx": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "csv": return "bg-teal-50 text-teal-700 border-teal-200";
    case "png": case "jpg": case "jpeg": case "gif": case "webp": case "svg": return "bg-purple-50 text-purple-700 border-purple-200";
    case "mp4": case "webm": case "mov": return "bg-orange-50 text-orange-700 border-orange-200";
    case "zip": return "bg-amber-50 text-amber-700 border-amber-200";
    case "txt": return "bg-slate-50 text-slate-700 border-slate-200";
    default: return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

/* ═══════════════════════════════════════════════════════════════
   SHARE MODAL COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function ShareModal({
  isDark,
  file,
  orgMembers,
  allSiteUsers,
  previouslySharedUsers,
  onClose,
  onShare,
}: {
  isDark: boolean;
  file: FileItem;
  orgMembers: OrgMember[];
  allSiteUsers: OrgMember[];
  previouslySharedUsers: ShareEntry[];
  onClose: () => void;
  onShare: (fileId: string, entries: ShareEntry[]) => void;
}) {
  const [emailInput, setEmailInput] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<ShareEntry[]>([...file.sharedWith]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Combine org members + previously shared users into one list, deduped
  const knownPeople = useMemo(() => {
    const map = new Map<string, ShareEntry>();
    orgMembers.forEach((m) => {
      map.set(m.email.toLowerCase(), {
        uid: m.uid,
        email: m.email,
        displayName: m.displayName || "",
        photoURL: m.photoURL,
        initials: getInitials(m.displayName || "", m.email),
      });
    });
    previouslySharedUsers.forEach((p) => {
      const key = p.email.toLowerCase();
      if (!map.has(key)) map.set(key, p);
    });
    return Array.from(map.values());
  }, [orgMembers, previouslySharedUsers]);

  // Suggestions based on input — search org + all site users
  const suggestions = useMemo(() => {
    const q = emailInput.toLowerCase().trim();
    if (!q) return [];

    const selectedEmails = new Set(selectedEntries.map((e) => e.email.toLowerCase()));

    // Search org members first
    const orgResults = knownPeople.filter(
      (p) =>
        !selectedEmails.has(p.email.toLowerCase()) &&
        (p.email.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q))
    );

    // Then search all site users not already in org results
    const orgEmails = new Set(orgResults.map((r) => r.email.toLowerCase()));
    const siteResults = allSiteUsers
      .filter(
        (u) =>
          !selectedEmails.has(u.email.toLowerCase()) &&
          !orgEmails.has(u.email.toLowerCase()) &&
          (u.email.toLowerCase().includes(q) || (u.displayName || "").toLowerCase().includes(q))
      )
      .map((u) => ({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName || "",
        photoURL: u.photoURL,
        initials: getInitials(u.displayName || "", u.email),
      }));

    return [...orgResults, ...siteResults].slice(0, 8);
  }, [emailInput, knownPeople, allSiteUsers, selectedEntries]);

  const addEntry = (entry: ShareEntry) => {
    setSelectedEntries((prev) => {
      if (prev.some((e) => e.email.toLowerCase() === entry.email.toLowerCase())) return prev;
      return [...prev, entry];
    });
    setEmailInput("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeEntry = (email: string) => {
    setSelectedEntries((prev) => prev.filter((e) => e.email.toLowerCase() !== email.toLowerCase()));
  };

  const handleSubmitEmail = () => {
    const trimmed = emailInput.trim();
    if (!trimmed || !trimmed.includes("@")) return;

    // Check if it matches a known user
    const match =
      knownPeople.find((p) => p.email.toLowerCase() === trimmed.toLowerCase()) ||
      allSiteUsers
        .map((u) => ({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName || "",
          photoURL: u.photoURL,
          initials: getInitials(u.displayName || "", u.email),
        }))
        .find((u) => u.email.toLowerCase() === trimmed.toLowerCase());

    if (match) {
      addEntry(match);
    } else {
      // External email
      addEntry({
        email: trimmed,
        displayName: trimmed.split("@")[0],
        initials: getInitials("", trimmed),
      });
    }
  };

  const handleSave = () => {
    onShare(file.id, selectedEntries);
    onClose();
  };

  // Theme
  const modalBg = isDark ? "bg-slate-900" : "bg-white";
  const modalBorder = isDark ? "border-slate-700" : "border-slate-200";
  const textP = isDark ? "text-slate-200" : "text-slate-800";
  const textS = isDark ? "text-slate-400" : "text-slate-500";
  const textM = isDark ? "text-slate-500" : "text-slate-400";
  const inputBgCls = isDark ? "bg-slate-800 border-slate-600 text-slate-200" : "bg-white border-slate-200 text-slate-700";
  const sugBg = isDark ? "bg-slate-800 border-slate-600" : "bg-white border-slate-200";
  const sugHover = isDark ? "hover:bg-slate-700" : "hover:bg-slate-50";
  const chipBg = isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[300] backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[310] w-full max-w-[480px] rounded-2xl border shadow-2xl ${modalBg} ${modalBorder}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${modalBorder}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? "bg-indigo-500/20" : "bg-indigo-50"}`}>
              <Share2 className={`w-4 h-4 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
            </div>
            <div>
              <h3 className={`text-[15px] font-bold ${textP}`}>Share</h3>
              <p className={`text-[11px] ${textS} truncate max-w-[280px]`}>{file.name}</p>
            </div>
          </div>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"} transition-colors cursor-pointer`}>
            <X className={`w-4 h-4 ${textM}`} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Email Input */}
          <div>
            <label className={`text-[11px] font-bold uppercase tracking-wider mb-1.5 block ${textS}`}>
              Add people
            </label>
            <div className="relative">
              <div className={`flex flex-wrap items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl border transition-all focus-within:ring-2 focus-within:ring-indigo-200 focus-within:border-indigo-400 ${inputBgCls}`}>
                {/* Chips for selected people */}
                {selectedEntries.map((entry) => (
                  <span
                    key={entry.email}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold ${chipBg}`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold ${isDark ? "bg-indigo-500/30 text-indigo-300" : "bg-indigo-100 text-indigo-700"}`}>
                      {entry.initials}
                    </span>
                    {entry.displayName || entry.email}
                    <button
                      onClick={() => removeEntry(entry.email)}
                      className="ml-0.5 cursor-pointer hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  ref={inputRef}
                  type="text"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (suggestions.length > 0) {
                        addEntry(suggestions[0]);
                      } else {
                        handleSubmitEmail();
                      }
                    }
                    if (e.key === "Escape") setShowSuggestions(false);
                    if (e.key === "Backspace" && !emailInput && selectedEntries.length > 0) {
                      removeEntry(selectedEntries[selectedEntries.length - 1].email);
                    }
                  }}
                  placeholder={selectedEntries.length > 0 ? "Add more..." : "Enter name or email..."}
                  className="flex-1 min-w-[120px] bg-transparent outline-none text-[13px]"
                />
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className={`absolute left-0 right-0 top-full mt-1 rounded-xl border shadow-xl z-[320] max-h-[200px] overflow-y-auto ${sugBg}`}>
                  {suggestions.map((sug) => (
                    <button
                      key={sug.email}
                      onClick={() => addEntry(sug)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${sugHover}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-100 text-indigo-700"}`}>
                        {sug.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-semibold truncate ${textP}`}>{sug.displayName || sug.email.split("@")[0]}</p>
                        <p className={`text-[11px] truncate ${textS}`}>{sug.email}</p>
                      </div>
                      {knownPeople.some((k) => k.email.toLowerCase() === sug.email.toLowerCase()) && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
                          Org
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Org Members List */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Users className={`w-3.5 h-3.5 ${textM}`} />
              <span className={`text-[11px] font-bold uppercase tracking-wider ${textS}`}>Organization Members</span>
            </div>
            <div className={`rounded-xl border max-h-[180px] overflow-y-auto ${modalBorder}`}>
              {knownPeople.length === 0 ? (
                <p className={`px-4 py-6 text-center text-[12px] ${textM}`}>No members found</p>
              ) : (
                knownPeople.map((person) => {
                  const isSelected = selectedEntries.some((e) => e.email.toLowerCase() === person.email.toLowerCase());
                  return (
                    <button
                      key={person.email}
                      onClick={() => (isSelected ? removeEntry(person.email) : addEntry(person))}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer border-b last:border-b-0 ${modalBorder} ${sugHover}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? "bg-slate-700 text-slate-300" : "bg-indigo-100 text-indigo-700"}`}>
                        {person.initials}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`text-[13px] font-semibold truncate ${textP}`}>{person.displayName || person.email.split("@")[0]}</p>
                        <p className={`text-[11px] truncate ${textS}`}>{person.email}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-600"
                          : isDark
                          ? "border-slate-600"
                          : "border-slate-300"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${modalBorder}`}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/shared/${file.id}`);
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer ${
              isDark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            {copiedLink ? "Copied!" : "Copy link"}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer ${
                isDark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-[12px] font-semibold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
            >
              Share
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DOCUMENT EDITOR WRAPPER — Error Boundary
   Catches runtime errors from TipTap to prevent full page crash
   ═══════════════════════════════════════════════════════════════ */

class EditorErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (err: string) => void; fallback?: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || "Unknown error" };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error.message || "Unknown editor error");
  }
  render() {
    if (this.state.hasError) return this.props.fallback || null;
    return this.props.children;
  }
}

function DocumentEditorWrapper({
  editingFile,
  isDark,
  onSave,
  onClose,
  onRename,
  onError,
}: {
  editingFile: FileItem;
  isDark: boolean;
  onSave: (content: string) => void;
  onClose: () => void;
  onRename: (newName: string) => void;
  onError: (err: string) => void;
}) {
  return (
    <EditorErrorBoundary onError={onError}>
      <DocumentEditor
        fileId={editingFile.id}
        fileName={editingFile.name}
        initialContent={editingFile.content}
        isDark={isDark}
        onSave={onSave}
        onClose={onClose}
        onRename={onRename}
      />
    </EditorErrorBoundary>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function MediaLibraryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();


  // ─── Dark Mode ───
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const theme = localStorage.getItem("insight_theme");
    setIsDark(theme === "dark");
    const handler = () => setIsDark(localStorage.getItem("insight_theme") === "dark");
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // ─── Org Members & All Site Users ───
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [allSiteUsers, setAllSiteUsers] = useState<OrgMember[]>([]);
  const [previouslySharedUsers, setPreviouslySharedUsers] = useState<ShareEntry[]>([]);

  useEffect(() => {
    if (!firestore) return;
    const fetchMembers = async () => {
      try {
        const usersSnap = await getDocs(collection(firestore, "users"));
        const members: OrgMember[] = [];
        usersSnap.docs.forEach((d) => {
          const data = d.data();
          const email = data.email || data.profile?.email || "";
          if (email) {
            members.push({
              uid: d.id,
              email,
              displayName: data.displayName || data.profile?.displayName || data.name || "",
              photoURL: data.photoURL || data.profile?.photoURL || "",
              role: data.role || "member",
            });
          }
        });
        // For now, treat all users as both org members and site users
        setOrgMembers(members);
        setAllSiteUsers(members);
      } catch (err) {
        console.warn("[MediaLibrary] Failed to fetch org members:", err);
      }
    };
    fetchMembers();
  }, [firestore]);

  // ─── Folder State ───
  const [folders, setFolders] = useState<Record<string, FolderNode>>(INITIAL_FOLDERS);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["my-files"]));
  const [selectedFolder, setSelectedFolder] = useState("my-files");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [sidebarPopup, setSidebarPopup] = useState<SidebarPopupState | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingFolderInContent, setCreatingFolderInContent] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderRef = useRef<HTMLInputElement>(null);
  const newFolderContentRef = useRef<HTMLInputElement>(null);

  // ─── File State ───
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("modified");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ─── Upload State ───
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Load files from Firestore on mount ───
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const filesCol = collection(firestore, `users/${user.uid}/media_library_files`);
    const unsub = onSnapshot(filesCol, (snap) => {
      const loaded: FileItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "Untitled",
          type: data.type || "TXT",
          extension: data.extension || "txt",
          size: data.size || "0 KB",
          sizeBytes: data.sizeBytes || 0,
          modified: data.modified || "",
          modifiedDate: data.modifiedDate?.toDate?.() || new Date(data.modifiedDate || Date.now()),
          folderId: data.folderId || "my-files",
          sharedWith: data.sharedWith || [],
          lastAccessed: data.lastAccessed?.toDate?.() || new Date(data.lastAccessed || Date.now()),
          content: data.content || "<p></p>",
          downloadUrl: data.downloadUrl || undefined,
          mimeType: data.mimeType || undefined,
        };
      });
      setFiles(loaded);
      setFilesLoaded(true);
    });
    return () => unsub();
  }, [firestore, user?.uid]);

  // ─── Helper: persist a file to Firestore ───
  const persistFile = useCallback(async (file: FileItem) => {
    if (!firestore || !user?.uid) return;
    try {
      const docData: Record<string, any> = {
        name: file.name,
        type: file.type,
        extension: file.extension,
        size: file.size,
        sizeBytes: file.sizeBytes,
        modified: file.modified,
        modifiedDate: file.modifiedDate,
        folderId: file.folderId,
        sharedWith: file.sharedWith,
        lastAccessed: file.lastAccessed,
        content: file.content,
      };
      if (file.downloadUrl) docData.downloadUrl = file.downloadUrl;
      if (file.mimeType) docData.mimeType = file.mimeType;
      await setDoc(doc(firestore, `users/${user.uid}/media_library_files`, file.id), docData);
    } catch (err) {
      console.error("Failed to persist file:", err);
    }
  }, [firestore, user?.uid]);

  const deleteFileFromFirestore = useCallback(async (fileId: string) => {
    if (!firestore || !user?.uid) return;
    try {
      await deleteDoc(doc(firestore, `users/${user.uid}/media_library_files`, fileId));
    } catch (err) {
      console.error("Failed to delete file from Firestore:", err);
    }
  }, [firestore, user?.uid]);

  // ─── Recently Accessed State ───
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  // ─── Share Modal State ───
  const [shareModalFile, setShareModalFile] = useState<FileItem | null>(null);

  // ─── Editor State ───
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);

  // ─── Media Preview State ───
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // ─── Toast State ───
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Rename State ───
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  const renameFileRef = useRef<HTMLInputElement>(null);

  // ─── Editor Error State ───
  const [editorError, setEditorError] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // ─── Track recently accessed items ───
  const trackAccess = useCallback((item: { id: string; name: string; type: "folder" | "file"; extension?: string }) => {
    setRecentItems((prev) => {
      const filtered = prev.filter((r) => r.id !== item.id);
      return [{ ...item, accessedAt: new Date() }, ...filtered].slice(0, 8);
    });
  }, []);

  // ─── Close context menu & sidebar popup on click outside ───
  useEffect(() => {
    const handler = () => {
      setContextMenu(null);
      setSidebarPopup(null);
    };
    if (contextMenu || sidebarPopup) {
      window.addEventListener("click", handler);
      return () => window.removeEventListener("click", handler);
    }
  }, [contextMenu, sidebarPopup]);

  // ─── Auto-focus inputs ───
  useEffect(() => {
    if (creatingFolder && newFolderRef.current) newFolderRef.current.focus();
  }, [creatingFolder]);
  useEffect(() => {
    if (creatingFolderInContent && newFolderContentRef.current) newFolderContentRef.current.focus();
  }, [creatingFolderInContent]);

  useEffect(() => {
    if (renamingFolderId && renameRef.current) renameRef.current.focus();
  }, [renamingFolderId]);
  useEffect(() => {
    if (renamingFileId && renameFileRef.current) {
      renameFileRef.current.focus();
      // Select only the file name, not the extension
      const dotIndex = renameValue.lastIndexOf('.');
      if (dotIndex > 0) renameFileRef.current.setSelectionRange(0, dotIndex);
      else renameFileRef.current.select();
    }
  }, [renamingFileId]);

  // ─── Folder Helpers ───
  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, targetType: "folder" | "file", targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, targetType, targetId });
  };

  const handleSidebarPopup = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSidebarPopup({ x: e.clientX, y: e.clientY, folderId });
  };

  const handleFolderContextAction = (action: string) => {
    if (!contextMenu || contextMenu.targetType !== "folder") return;
    const folder = folders[contextMenu.targetId];
    if (action === "Rename" && folder && folder.id !== "my-files" && folder.id !== "shared" && folder.id !== "trash") {
      setRenamingFolderId(folder.id);
      setRenameValue(folder.name);
    } else if (action === "Delete" && folder && folder.id !== "my-files" && folder.id !== "shared" && folder.id !== "trash") {
      handleDeleteFolder(folder.id);
    } else if (action === "Open") {
      setSelectedFolder(contextMenu.targetId);
      trackAccess({ id: contextMenu.targetId, name: folder?.name || "", type: "folder" });
    } else {
      showToast(`${action}: ${folder?.name}`);
    }
    setContextMenu(null);
  };

  const handleFileContextAction = (action: string) => {
    if (!contextMenu || contextMenu.targetType !== "file") return;
    const file = files.find((f) => f.id === contextMenu.targetId);
    if (!file) { setContextMenu(null); return; }

    if (action === "Open") {
      if (isMediaFile(file.extension) && file.downloadUrl) {
        setPreviewFile(file);
      } else {
        setEditingFile(file);
      }
    } else if (action === "Rename") {
      setRenamingFileId(file.id);
      setRenameValue(file.name);
    } else if (action === "Share") {
      setShareModalFile(file);
    } else if (action === "Delete") {
      handleDeleteFile(file.id);
    } else {
      showToast(`${action}: ${file.name}`);
    }
    setContextMenu(null);
  };

  const handleFileRename = () => {
    if (!renamingFileId || !renameValue.trim()) {
      setRenamingFileId(null);
      setRenameValue("");
      return;
    }
    const newName = renameValue.trim();
    const existingFile = files.find(f => f.id === renamingFileId);
    setFiles((prev) =>
      prev.map((f) =>
        f.id === renamingFileId
          ? { ...f, name: newName, extension: newName.split(".").pop()?.toLowerCase() || f.extension }
          : f
      )
    );
    if (existingFile) {
      persistFile({ ...existingFile, name: newName, extension: newName.split(".").pop()?.toLowerCase() || existingFile.extension });
    }
    showToast(`Renamed to: ${newName}`);
    setRenamingFileId(null);
    setRenameValue("");
  };

  const handleDeleteFolder = (folderId: string) => {
    const folder = folders[folderId];
    if (!folder) return;
    setFiles((prev) => prev.filter((f) => f.folderId !== folderId));
    setFolders((prev) => {
      const next = { ...prev };
      if (folder.parentId && next[folder.parentId]) {
        next[folder.parentId] = {
          ...next[folder.parentId],
          children: next[folder.parentId].children.filter((c) => c !== folderId),
          itemCount: Math.max(0, next[folder.parentId].itemCount - 1),
        };
      }
      delete next[folderId];
      return next;
    });
    if (selectedFolder === folderId) setSelectedFolder("my-files");
    showToast(`Deleted: ${folder.name}`);
  };

  const handleDeleteFile = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setFolders((prev) => {
      if (prev[file.folderId]) {
        return {
          ...prev,
          [file.folderId]: {
            ...prev[file.folderId],
            itemCount: Math.max(0, prev[file.folderId].itemCount - 1),
          },
        };
      }
      return prev;
    });
    showToast(`Deleted: ${file.name}`);
    deleteFileFromFirestore(fileId);
  };

  const handleCreateFolder = (parentId: string = "my-files") => {
    if (!newFolderName.trim()) { setCreatingFolder(false); setCreatingFolderInContent(false); return; }
    const id = `folder-${Date.now()}`;
    const newFolder: FolderNode = {
      id,
      name: newFolderName.trim(),
      parentId,
      children: [],
      itemCount: 0,
      createdAt: new Date(),
    };
    setFolders((prev) => ({
      ...prev,
      [id]: newFolder,
      [parentId]: {
        ...prev[parentId],
        children: [...prev[parentId].children, id],
        itemCount: prev[parentId].itemCount + 1,
      },
    }));
    setNewFolderName("");
    setCreatingFolder(false);
    setCreatingFolderInContent(false);
    showToast(`Created folder: ${newFolder.name}`);
    trackAccess({ id, name: newFolder.name, type: "folder" });
  };

  const handleCreateDocument = () => {
    // Find the lowest available "Document N" number
    const docPattern = /^Document\s+(\d+)$/i;
    const usedNumbers = new Set<number>();
    files.forEach((f) => {
      // Match against name without extension
      const baseName = f.name.replace(/\.[^.]+$/, "");
      const match = baseName.match(docPattern);
      if (match) usedNumbers.add(parseInt(match[1], 10));
    });
    let num = 1;
    while (usedNumbers.has(num)) num++;
    const finalName = `Document ${num}.txt`;

    const id = `file-${Date.now()}`;
    const now = new Date();
    const targetFolderId =
      selectedFolder !== "shared" && selectedFolder !== "trash" ? selectedFolder : "my-files";
    const newFile: FileItem = {
      id,
      name: finalName,
      type: "TXT",
      extension: "txt",
      size: "0 KB",
      sizeBytes: 0,
      modified: formatDate(now),
      modifiedDate: now,
      folderId: targetFolderId,
      sharedWith: [],
      lastAccessed: now,
      content: "<p></p>",
    };
    setFiles((prev) => [newFile, ...prev]);
    persistFile(newFile);
    setFolders((prev) => {
      if (prev[targetFolderId]) {
        return {
          ...prev,
          [targetFolderId]: {
            ...prev[targetFolderId],
            itemCount: prev[targetFolderId].itemCount + 1,
          },
        };
      }
      return prev;
    });
    showToast(`Created: ${finalName}`);
    trackAccess({ id, name: finalName, type: "file", extension: "txt" });
  };

  // ─── File Upload Handler ───
  const handleFileUpload = useCallback(async (fileList: FileList | File[]) => {
    if (!storage || !firestore || !user?.uid) {
      showToast("Storage not available");
      return;
    }
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    const targetFolderId =
      selectedFolder !== "shared" && selectedFolder !== "trash" ? selectedFolder : "my-files";

    for (const file of filesArray) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!isMediaFile(ext)) {
        showToast(`Unsupported file type: .${ext}`);
        continue;
      }

      // Max 100MB per file
      if (file.size > 100 * 1024 * 1024) {
        showToast(`File too large: ${file.name} (max 100MB)`);
        continue;
      }

      const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const storagePath = `media_library/${user.uid}/${fileId}/${file.name}`;
      const sRef = storageRef(storage, storagePath);

      const now = new Date();
      const typeLabel = isVideoFile(ext) ? ext.toUpperCase() : ext.toUpperCase();

      // Create placeholder file entry immediately
      const placeholderFile: FileItem = {
        id: fileId,
        name: file.name,
        type: typeLabel,
        extension: ext,
        size: formatFileSize(file.size),
        sizeBytes: file.size,
        modified: formatDate(now),
        modifiedDate: now,
        folderId: targetFolderId,
        sharedWith: [],
        lastAccessed: now,
        content: "",
        mimeType: file.type,
      };

      setFiles((prev) => [placeholderFile, ...prev]);
      setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

      // Upload with progress
      const uploadTask = uploadBytesResumable(sRef, file);
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress((prev) => ({ ...prev, [fileId]: pct }));
        },
        (error) => {
          console.error("Upload error:", error);
          showToast(`Upload failed: ${file.name}`);
          setFiles((prev) => prev.filter((f) => f.id !== fileId));
          setUploadProgress((prev) => {
            const next = { ...prev };
            delete next[fileId];
            return next;
          });
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            const completedFile: FileItem = {
              ...placeholderFile,
              downloadUrl,
            };
            setFiles((prev) =>
              prev.map((f) => (f.id === fileId ? completedFile : f))
            );
            await persistFile(completedFile);
            showToast(`Uploaded: ${file.name}`);
            trackAccess({ id: fileId, name: file.name, type: "file", extension: ext });
          } catch (err) {
            console.error("Failed to get download URL:", err);
            showToast(`Upload failed: ${file.name}`);
          } finally {
            setUploadProgress((prev) => {
              const next = { ...prev };
              delete next[fileId];
              return next;
            });
          }
        }
      );
    }
  }, [storage, firestore, user?.uid, selectedFolder, showToast, persistFile, trackAccess]);

  // ─── Drag and Drop Handlers ───
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  const handleRenameFolder = () => {
    if (!renamingFolderId || !renameValue.trim()) {
      setRenamingFolderId(null);
      return;
    }
    setFolders((prev) => ({
      ...prev,
      [renamingFolderId]: { ...prev[renamingFolderId], name: renameValue.trim() },
    }));
    showToast(`Renamed to: ${renameValue.trim()}`);
    setRenamingFolderId(null);
    setRenameValue("");
  };

  // ─── Share handler ───
  const handleShare = useCallback((fileId: string, entries: ShareEntry[]) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, sharedWith: entries } : f))
    );
    // Remember these people for future share popups
    setPreviouslySharedUsers((prev) => {
      const map = new Map<string, ShareEntry>();
      prev.forEach((p) => map.set(p.email.toLowerCase(), p));
      entries.forEach((e) => map.set(e.email.toLowerCase(), e));
      return Array.from(map.values());
    });
    showToast(`Shared with ${entries.length} ${entries.length === 1 ? "person" : "people"}`);
  }, [showToast]);

  // ─── Compute display count ───
  const getFolderDisplayCount = useCallback((folderId: string): number => {
    const folder = folders[folderId];
    if (!folder) return 0;
    const fileCount = files.filter((f) => f.folderId === folderId).length;
    return fileCount + folder.children.length;
  }, [folders, files]);

  // ─── Files in current folder ───
  const filesInFolder = useMemo(() => {
    const selected = selectedFolder;
    const childFolderIds = folders[selected]?.children || [];
    const allFolderIds = [selected, ...childFolderIds];
    return files.filter((f) => allFolderIds.includes(f.folderId));
  }, [files, selectedFolder, folders]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return filesInFolder;
    const q = searchQuery.toLowerCase();
    return filesInFolder.filter(
      (f) => f.name.toLowerCase().includes(q) || f.type.toLowerCase().includes(q)
    );
  }, [filesInFolder, searchQuery]);

  const sortedFiles = useMemo(() => {
    const list = [...filteredFiles];
    list.sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (sortKey) {
        case "name": va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case "type": va = a.type; vb = b.type; break;
        case "size": va = a.sizeBytes; vb = b.sizeBytes; break;
        case "modified": va = a.modifiedDate.getTime(); vb = b.modifiedDate.getTime(); break;
      }
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return list;
  }, [filteredFiles, sortKey, sortDir]);

  const childFolders = useMemo(() => {
    const folder = folders[selectedFolder];
    if (!folder) return [];
    return folder.children.map((id) => folders[id]).filter(Boolean);
  }, [folders, selectedFolder]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  // ─── Theme Classes ───
  const bg = isDark ? "bg-slate-950" : "bg-[#fefdfb]";
  const bgSidebar = isDark ? "bg-slate-900" : "bg-[#f8f6f0]";
  const borderColor = isDark ? "border-slate-700" : "border-[#ede8da]";
  const textPrimary = isDark ? "text-slate-200" : "text-slate-800";
  const textSecondary = isDark ? "text-slate-300" : "text-slate-700";
  const textTertiary = isDark ? "text-slate-400" : "text-slate-500";
  const textMuted = isDark ? "text-slate-500" : "text-slate-400";
  const hoverBg = isDark ? "hover:bg-slate-800" : "hover:bg-stone-100";
  const activeBg = isDark ? "bg-slate-800" : "bg-stone-200/60";
  const cardBg = isDark ? "bg-slate-900" : "bg-white";
  const cardBorder = isDark ? "border-slate-700" : "border-[#ede8da]";
  const rowHover = isDark ? "hover:bg-slate-800/60" : "hover:bg-stone-50";
  const tableHeaderBg = isDark ? "bg-slate-800" : "bg-[#f5f1e8]";
  const contextBg = isDark ? "bg-slate-800 border-slate-600" : "bg-white border-slate-200";
  const contextHover = isDark ? "hover:bg-slate-700" : "hover:bg-slate-50";
  const inputBg = isDark ? "bg-slate-800 border-slate-600 text-slate-200" : "bg-white border-slate-200 text-slate-700";
  const thumbnailBg = isDark ? "bg-slate-800" : "bg-slate-100";

  const isCurrentFolderEmpty = childFolders.length === 0 && sortedFiles.length === 0 && !searchQuery;

  /* ═══════════════════════════════════════════════════════════════
     RENDER — FOLDER TREE
     ═══════════════════════════════════════════════════════════════ */

  const renderFolderNode = (folderId: string, depth: number = 0) => {
    const folder = folders[folderId];
    if (!folder) return null;
    const isExpanded = expandedFolders.has(folderId);
    const isSelected = selectedFolder === folderId;
    const hasChildren = folder.children.length > 0;
    const count = getFolderDisplayCount(folderId);

    return (
      <div key={folderId}>
        <div className="flex items-center group/row">
          <button
            onClick={() => {
              setSelectedFolder(folderId);
              trackAccess({ id: folderId, name: folder.name, type: "folder" });
              if (hasChildren) toggleFolder(folderId);
            }}
            onContextMenu={(e) => handleContextMenu(e, "folder", folderId)}
            className={`flex-1 flex items-center gap-2 px-3 py-[7px] text-[13px] font-medium transition-all rounded-md cursor-pointer ${
              isSelected
                ? `${activeBg} ${textPrimary} font-semibold`
                : `${textSecondary} ${hoverBg}`
            }`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            {hasChildren ? (
              <span className={`shrink-0 ${textMuted}`}>
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}

            {isExpanded && hasChildren ? (
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            ) : folderId === "trash" ? (
              <Trash2 className="w-4 h-4 text-slate-400 shrink-0" />
            ) : folderId === "shared" ? (
              <Share2 className="w-4 h-4 text-indigo-400 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            )}

            {renamingFolderId === folderId ? (
              <input
                ref={renameRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameFolder();
                  if (e.key === "Escape") { setRenamingFolderId(null); setRenameValue(""); }
                }}
                onBlur={handleRenameFolder}
                className={`flex-1 px-1.5 py-0.5 text-[12px] rounded border outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 ${inputBg}`}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate flex-1 text-left">{folder.name}</span>
            )}
            <span className={`text-[10px] font-semibold tabular-nums shrink-0 ${textMuted}`}>
              {count > 0 ? count : ""}
            </span>
          </button>

          {folderId === "my-files" && (
            <button
              onClick={(e) => handleSidebarPopup(e, folderId)}
              className={`w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity mr-1 ${hoverBg} ${textMuted} hover:text-slate-600 cursor-pointer`}
              title="Add new..."
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>

        {isExpanded && hasChildren && (
          <div>
            {folder.children.map((childId) => renderFolderNode(childId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER — SORT ICON
     ═══════════════════════════════════════════════════════════════ */

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? (
        <ChevronDown className="w-3 h-3 inline ml-0.5 rotate-180" />
      ) : (
        <ChevronDown className="w-3 h-3 inline ml-0.5" />
      )
    ) : null;

  /* ═══════════════════════════════════════════════════════════════
     RENDER — MAIN
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className={`-mx-4 -mb-4 md:-mx-10 md:-mb-10 flex h-full w-full ${bg} overflow-hidden rounded-xl border ${borderColor}`}>
      {/* ───── LEFT PANEL: FOLDER TREE ───── */}
      <aside className={`w-[240px] shrink-0 flex flex-col ${bgSidebar} border-r ${borderColor}`}>
        <div className={`h-14 flex items-center justify-between px-4 border-b ${borderColor}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? "bg-slate-700" : "bg-slate-800"}`}>
              <Folder className="w-3.5 h-3.5 text-white" />
            </div>
            <span className={`text-[14px] font-bold tracking-tight ${textPrimary}`}>Media Library</span>
          </div>
          <button
            onClick={() => { setCreatingFolder(true); setExpandedFolders((p) => new Set([...p, "my-files"])); }}
            title="New Folder"
            className={`w-7 h-7 rounded-md flex items-center justify-center ${hoverBg} ${textMuted} hover:text-slate-600 transition-colors cursor-pointer`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {renderFolderNode("my-files")}

          {creatingFolder && (
            <div className="flex items-center gap-2 px-3 py-1.5" style={{ paddingLeft: "44px" }}>
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
              <input
                ref={newFolderRef}
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
                }}
                onBlur={() => handleCreateFolder()}
                placeholder="Folder name..."
                className={`flex-1 px-2 py-1 text-[12px] rounded border outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 ${inputBg}`}
              />
            </div>
          )}

          <div className={`my-3 mx-3 border-t ${borderColor}`} />
          {renderFolderNode("shared")}
          {renderFolderNode("trash")}
        </nav>

        <div className={`px-4 py-3 border-t ${borderColor}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>Storage Used</span>
            <span className={`text-[10px] font-bold ${textTertiary}`}>0 KB / 15 GB</span>
          </div>
          <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
            <div className="h-full rounded-full bg-indigo-500" style={{ width: "0%" }} />
          </div>
        </div>
      </aside>

      {/* ───── RIGHT PANEL ───── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className={`h-14 flex items-center justify-between px-6 border-b ${borderColor} shrink-0`}>
          <div className="flex items-center gap-2">
            <h2 className={`text-[15px] font-bold ${textPrimary}`}>
              {folders[selectedFolder]?.name || "All Files"}
            </h2>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isDark ? "bg-slate-800 text-slate-400" : "bg-stone-200/80 text-slate-500"}`}>
              {filteredFiles.length + childFolders.length} items
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${textMuted}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className={`pl-8 pr-7 py-[7px] rounded-lg text-xs font-medium outline-none w-48 transition-all border focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 ${inputBg}`}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className={`absolute right-2 top-1/2 -translate-y-1/2 ${textMuted} hover:text-slate-600 cursor-pointer`}>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => setCreatingFolderInContent(true)}
              className={`flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer border ${
                isDark ? "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Add Folder
            </button>

            <button
              onClick={handleCreateDocument}
              className={`flex items-center gap-1.5 px-3 py-[7px] rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer border ${
                isDark ? "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FilePlus className="w-3.5 h-3.5" />
              Add Document
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFileUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          className={`flex-1 overflow-y-auto px-6 py-5 space-y-6 transition-colors ${isDragOver ? (isDark ? 'bg-indigo-950/30 ring-2 ring-inset ring-indigo-500/50' : 'bg-indigo-50/50 ring-2 ring-inset ring-indigo-300') : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* ── DRAG OVERLAY ── */}
          {isDragOver && (
            <div className="flex flex-col items-center justify-center py-12 text-center pointer-events-none">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                <Upload className={`w-8 h-8 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
              </div>
              <p className={`text-lg font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>Drop files to upload</p>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Images (JPG, PNG, WebP, SVG, GIF) and Videos (MP4, WebM, MOV)</p>
            </div>
          )}

          {/* ── UPLOAD PROGRESS BARS ── */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="space-y-2">
              {Object.entries(uploadProgress).map(([fileId, pct]) => {
                const uploadingFile = files.find(f => f.id === fileId);
                return (
                  <div key={fileId} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${cardBorder} ${cardBg}`}>
                    <Upload className={`w-4 h-4 shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-600'} animate-pulse`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] font-semibold truncate ${textPrimary}`}>{uploadingFile?.name || 'Uploading...'}</p>
                      <div className={`h-1.5 mt-1 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                        <div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold tabular-nums shrink-0 ${textMuted}`}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── RECENTLY ACCESSED ── */}
          {selectedFolder === "my-files" && recentItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock className={`w-4 h-4 ${textMuted}`} />
                <h3 className={`text-[13px] font-bold uppercase tracking-wider ${textTertiary}`}>Recently Accessed</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {recentItems.map((item) => (
                  <div
                    key={`recent-${item.id}`}
                    onClick={() => {
                      if (item.type === "folder" && folders[item.id]) {
                        setSelectedFolder(item.id);
                        setExpandedFolders((p) => new Set([...p, "my-files", item.id]));
                      }
                      trackAccess(item);
                    }}
                    onDoubleClick={() => {
                      if (item.type === "file") {
                        const file = files.find((f) => f.id === item.id);
                        if (file) {
                          if (isMediaFile(file.extension) && file.downloadUrl) {
                            setPreviewFile(file);
                          } else {
                            setEditingFile(file);
                          }
                        }
                      } else if (item.type === "folder" && folders[item.id]) {
                        setSelectedFolder(item.id);
                        setExpandedFolders((p) => new Set([...p, "my-files", item.id]));
                      }
                    }}
                    onContextMenu={(e) => {
                      if (item.type === "file") {
                        handleContextMenu(e, "file", item.id);
                      } else if (item.type === "folder") {
                        handleContextMenu(e, "folder", item.id);
                      }
                    }}
                    className={`group rounded-xl border overflow-hidden transition-all hover:shadow-md cursor-pointer ${cardBg} ${cardBorder} hover:border-indigo-300`}
                  >
                    <div className={`h-[84px] flex items-center justify-center overflow-hidden ${thumbnailBg}`}>
                      {item.type === "folder" ? (
                        <Folder className="w-8 h-8 text-amber-500" />
                      ) : (() => {
                        const matchedFile = files.find(f => f.id === item.id);
                        const ext = (item.extension || "").toLowerCase();
                        if (matchedFile?.downloadUrl && isImageFile(ext)) {
                          return <img src={matchedFile.downloadUrl} alt={item.name} className="w-full h-full object-cover" />;
                        }
                        if (matchedFile?.downloadUrl && isVideoFile(ext)) {
                          return (
                            <div className="relative w-full h-full">
                              <video src={matchedFile.downloadUrl} muted preload="metadata" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                                  <Play className="w-3 h-3 text-white fill-white" />
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return getFileIcon(ext, 8, isDark);
                      })()}
                    </div>
                    <div className="px-2.5 py-2">
                      <p className={`text-[11px] font-semibold truncate leading-tight ${textPrimary}`}>{item.name}</p>
                      <p className={`text-[9px] mt-0.5 ${textMuted}`}>{getRelativeTime(item.accessedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── NEW FOLDER INPUT (content area) ── */}
          {creatingFolderInContent && (
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${cardBorder} ${cardBg}`}>
              <FolderPlus className="w-5 h-5 text-amber-500 shrink-0" />
              <input
                ref={newFolderContentRef}
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateFolder(selectedFolder !== "shared" && selectedFolder !== "trash" ? selectedFolder : "my-files");
                    setCreatingFolderInContent(false);
                  }
                  if (e.key === "Escape") { setCreatingFolderInContent(false); setNewFolderName(""); }
                }}
                onBlur={() => {
                  if (newFolderName.trim()) {
                    handleCreateFolder(selectedFolder !== "shared" && selectedFolder !== "trash" ? selectedFolder : "my-files");
                  }
                  setCreatingFolderInContent(false);
                }}
                placeholder="Enter folder name..."
                className={`flex-1 px-3 py-1.5 text-[13px] rounded-lg border outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 ${inputBg}`}
              />
              <button onClick={() => { setCreatingFolderInContent(false); setNewFolderName(""); }} className={`${textMuted} hover:text-slate-600 cursor-pointer`}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}



          {/* ── CHILD FOLDERS GRID ── */}
          {childFolders.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Folder className={`w-4 h-4 ${textMuted}`} />
                <h3 className={`text-[13px] font-bold uppercase tracking-wider ${textTertiary}`}>Folders</h3>
                <span className={`text-[11px] font-semibold ${textMuted}`}>({childFolders.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {childFolders.map((folder) => (
                  <div
                    key={folder.id}
                    onClick={() => {
                      setSelectedFolder(folder.id);
                      setExpandedFolders((p) => new Set([...p, folder.id]));
                      trackAccess({ id: folder.id, name: folder.name, type: "folder" });
                    }}
                    onContextMenu={(e) => handleContextMenu(e, "folder", folder.id)}
                    className={`group rounded-xl border overflow-hidden transition-all hover:shadow-md cursor-pointer ${cardBg} ${cardBorder} hover:border-amber-300`}
                  >
                    <div className={`h-[72px] flex items-center justify-center ${thumbnailBg}`}>
                      <Folder className="w-8 h-8 text-amber-500 group-hover:text-amber-600 transition-colors" />
                    </div>
                    <div className="px-3 py-2.5">
                      <p className={`text-[12px] font-semibold truncate leading-tight ${textPrimary}`}>{folder.name}</p>
                      <p className={`text-[10px] mt-0.5 ${textMuted}`}>
                        {getFolderDisplayCount(folder.id)} items · {formatDate(folder.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── ALL FILES TABLE ── */}
          {sortedFiles.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <File className={`w-4 h-4 ${textMuted}`} />
                  <h3 className={`text-[13px] font-bold uppercase tracking-wider ${textTertiary}`}>All Files</h3>
                  <span className={`text-[11px] font-semibold ${textMuted}`}>({sortedFiles.length})</span>
                </div>
              </div>

              <div className={`border rounded-xl overflow-hidden ${cardBorder}`}>
                {/* Table Header */}
                <div className={`grid grid-cols-[1fr_80px_90px_120px_100px_40px] ${tableHeaderBg} text-[11px] font-bold uppercase tracking-wider ${textTertiary}`}>
                  <button onClick={() => toggleSort("name")} className={`px-4 py-3 text-left ${contextHover} transition-colors cursor-pointer flex items-center`}>
                    Name <SortIcon k="name" />
                  </button>
                  <button onClick={() => toggleSort("type")} className={`px-3 py-3 text-left ${contextHover} transition-colors cursor-pointer flex items-center`}>
                    Type <SortIcon k="type" />
                  </button>
                  <button onClick={() => toggleSort("size")} className={`px-3 py-3 text-left ${contextHover} transition-colors cursor-pointer flex items-center`}>
                    Size <SortIcon k="size" />
                  </button>
                  <button onClick={() => toggleSort("modified")} className={`px-3 py-3 text-left ${contextHover} transition-colors cursor-pointer flex items-center`}>
                    Modified <SortIcon k="modified" />
                  </button>
                  <div className="px-3 py-3 text-left">Shared</div>
                  <div className="px-1 py-3" />
                </div>

                {/* Table Body */}
                {sortedFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => {
                      trackAccess({ id: file.id, name: file.name, type: "file", extension: file.extension });
                    }}
                    onDoubleClick={() => {
                      if (isMediaFile(file.extension) && file.downloadUrl) {
                        setPreviewFile(file);
                      } else {
                        setEditingFile(file);
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, "file", file.id)}
                    className={`grid grid-cols-[1fr_80px_90px_120px_100px_40px] text-[13px] border-t ${borderColor} ${rowHover} transition-colors cursor-pointer group`}
                  >
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      {file.downloadUrl && isImageFile(file.extension) ? (
                        <div className={`w-8 h-8 rounded-md overflow-hidden shrink-0 ${thumbnailBg}`}>
                          <img src={file.downloadUrl} alt={file.name} className="w-full h-full object-cover" />
                        </div>
                      ) : file.downloadUrl && isVideoFile(file.extension) ? (
                        <div className={`w-8 h-8 rounded-md overflow-hidden shrink-0 ${thumbnailBg} relative`}>
                          <video src={file.downloadUrl} muted className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="w-3 h-3 border-l-[5px] border-t-[3px] border-b-[3px] border-l-white border-t-transparent border-b-transparent" />
                          </div>
                        </div>
                      ) : (
                        getFileIcon(file.extension, 4, isDark)
                      )}
                      {renamingFileId === file.id ? (
                        <input
                          ref={renameFileRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleFileRename();
                            if (e.key === "Escape") { setRenamingFileId(null); setRenameValue(""); }
                          }}
                          onBlur={handleFileRename}
                          onClick={(e) => e.stopPropagation()}
                          className={`font-semibold text-[13px] px-1.5 py-0.5 rounded border outline-none focus:ring-2 focus:ring-indigo-300 w-full ${inputBg}`}
                        />
                      ) : (
                        <span className={`font-semibold truncate ${textPrimary}`}>{file.name}</span>
                      )}
                    </div>

                    <div className="flex items-center px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${
                        isDark ? "bg-slate-800 text-slate-300 border-slate-600" : getTypeBadgeColor(file.extension)
                      }`}>
                        {file.type}
                      </span>
                    </div>

                    <div className={`flex items-center px-3 text-[12px] ${textTertiary} tabular-nums`}>{file.size}</div>
                    <div className={`flex items-center px-3 text-[12px] ${textTertiary}`}>{file.modified}</div>

                    {/* Shared avatars */}
                    <div className="flex items-center px-3">
                      {file.sharedWith.length > 0 ? (
                        <div className="flex -space-x-1.5">
                          {file.sharedWith.slice(0, 3).map((entry, i) => (
                            <div
                              key={i}
                              title={`${entry.displayName || entry.email}`}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 ${
                                isDark ? "bg-slate-700 text-slate-300 border-slate-900" : "bg-indigo-100 text-indigo-700 border-white"
                              }`}
                            >
                              {entry.initials}
                            </div>
                          ))}
                          {file.sharedWith.length > 3 && (
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 ${
                              isDark ? "bg-slate-600 text-slate-400 border-slate-900" : "bg-slate-200 text-slate-500 border-white"
                            }`}>
                              +{file.sharedWith.length - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className={`text-[12px] ${textMuted}`}>—</span>
                      )}
                    </div>

                    {/* Share action */}
                    <div className="flex items-center justify-center px-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShareModalFile(file);
                        }}
                        title="Share"
                        className={`w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer ${
                          isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-100 text-slate-400"
                        }`}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── EMPTY STATE ── */}
          {isCurrentFolderEmpty && !creatingFolderInContent && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 ${isDark ? "bg-slate-800" : "bg-stone-100"}`}>
                <FolderPlus className={`w-10 h-10 ${isDark ? "text-slate-600" : "text-slate-300"}`} />
              </div>
              <h3 className={`text-lg font-bold mb-2 ${textPrimary}`}>
                {selectedFolder === "my-files" ? "Your library is empty" : "This folder is empty"}
              </h3>
              <p className={`text-sm max-w-sm mb-6 ${textTertiary}`}>
                {selectedFolder === "my-files"
                  ? "Get started by uploading media, creating a folder, or adding a document."
                  : "Upload files or create folders to get started."}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCreatingFolderInContent(true)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer border ${
                    isDark ? "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <FolderPlus className="w-4 h-4" />
                  Add Folder
                </button>
                <button
                  onClick={handleCreateDocument}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer border ${
                    isDark ? "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <FilePlus className="w-4 h-4" />
                  Add Document
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Upload Media
                </button>
              </div>
            </div>
          )}

          {searchQuery && filteredFiles.length === 0 && childFolders.length === 0 && (
            <div className={`px-6 py-12 text-center ${textMuted} text-sm`}>
              No files match your search.
            </div>
          )}
        </div>
      </main>

      {/* ───── SIDEBAR POPUP ───── */}
      {sidebarPopup && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setSidebarPopup(null)} />
          <div
            className={`fixed z-[100] border rounded-xl shadow-xl py-1.5 min-w-[180px] ${contextBg}`}
            style={{ top: sidebarPopup.y, left: sidebarPopup.x }}
          >
            <button
              onClick={() => {
                setSidebarPopup(null);
                setCreatingFolder(true);
                setExpandedFolders((p) => new Set([...p, "my-files"]));
              }}
              className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer ${textSecondary} ${contextHover}`}
            >
              <FolderPlus className={`w-4 h-4 ${textMuted}`} />
              Add New Folder
            </button>
            <button
              onClick={() => {
                setSidebarPopup(null);
                setSelectedFolder(sidebarPopup.folderId);
                handleCreateDocument();
              }}
              className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer ${textSecondary} ${contextHover}`}
            >
              <FilePlus className={`w-4 h-4 ${textMuted}`} />
              Add New File
            </button>
          </div>
        </>
      )}

      {/* ───── CONTEXT MENU (Folder) ───── */}
      {contextMenu && contextMenu.targetType === "folder" && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setContextMenu(null)} />
          <div
            className={`fixed z-[100] border rounded-xl shadow-xl py-1.5 min-w-[180px] ${contextBg}`}
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {[
              { label: "Open", icon: FolderOpen, action: "Open" },
              { label: "Rename", icon: Edit3, action: "Rename" },
              { label: "Share", icon: Share2, action: "Share" },
              { label: "Properties", icon: Info, action: "Properties" },
            ].map(({ label, icon: Icon, action }) => (
              <button
                key={action}
                onClick={() => handleFolderContextAction(action)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer ${textSecondary} ${contextHover}`}
              >
                <Icon className={`w-4 h-4 ${textMuted}`} />
                {label}
              </button>
            ))}
            <div className={`my-1 mx-3 border-t ${isDark ? "border-slate-600" : "border-slate-200"}`} />
            <button
              onClick={() => handleFolderContextAction("Delete")}
              className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer text-red-500 ${contextHover}`}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}

      {/* ───── CONTEXT MENU (File) ───── */}
      {contextMenu && contextMenu.targetType === "file" && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setContextMenu(null)} />
          <div
            className={`fixed z-[100] border rounded-xl shadow-xl py-1.5 min-w-[180px] ${contextBg}`}
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {[
              { label: "Open", icon: FileText, action: "Open" },
              { label: "Rename", icon: Edit3, action: "Rename" },
              { label: "Share", icon: Share2, action: "Share" },
              { label: "Properties", icon: Info, action: "Properties" },
            ].map(({ label, icon: Icon, action }) => (
              <button
                key={action}
                onClick={() => handleFileContextAction(action)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer ${textSecondary} ${contextHover}`}
              >
                <Icon className={`w-4 h-4 ${textMuted}`} />
                {label}
              </button>
            ))}
            <div className={`my-1 mx-3 border-t ${isDark ? "border-slate-600" : "border-slate-200"}`} />
            <button
              onClick={() => handleFileContextAction("Delete")}
              className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer text-red-500 ${contextHover}`}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}

      {/* ───── MEDIA PREVIEW MODAL ───── */}
      {previewFile && previewFile.downloadUrl && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 z-[250] backdrop-blur-md cursor-pointer"
            onClick={() => setPreviewFile(null)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[260] flex items-center justify-center p-8 pointer-events-none">
            <div className={`relative max-w-[90vw] max-h-[90vh] w-full h-full flex flex-col items-center justify-center pointer-events-auto`}>
              {/* Top Bar */}
              <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                    {isVideoFile(previewFile.extension)
                      ? <Video className="w-4 h-4 text-white" />
                      : <Image className="w-4 h-4 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-white truncate">{previewFile.name}</p>
                    <p className="text-[11px] text-white/60">{previewFile.size} · {previewFile.extension.toUpperCase()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {previewFile.downloadUrl && (
                    <a
                      href={previewFile.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={previewFile.name}
                      className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                      title="Download"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-4 h-4 text-white" />
                    </a>
                  )}
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex items-center justify-center w-full h-full pt-16 pb-4">
                {isVideoFile(previewFile.extension) ? (
                  <video
                    src={previewFile.downloadUrl}
                    controls
                    autoPlay
                    className="max-w-full max-h-full rounded-xl shadow-2xl"
                    style={{ maxHeight: 'calc(90vh - 80px)' }}
                  />
                ) : (
                  <img
                    src={previewFile.downloadUrl}
                    alt={previewFile.name}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                    style={{ maxHeight: 'calc(90vh - 80px)' }}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ───── SHARE MODAL ───── */}
      {shareModalFile && (
        <ShareModal
          isDark={isDark}
          file={shareModalFile}
          orgMembers={orgMembers}
          allSiteUsers={allSiteUsers}
          previouslySharedUsers={previouslySharedUsers}
          onClose={() => setShareModalFile(null)}
          onShare={handleShare}
        />
      )}

      {/* ───── TOAST ───── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] animate-in fade-in slide-in-from-bottom-4">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-[13px] font-semibold ${
            isDark ? "bg-slate-800 border-slate-600 text-slate-200" : "bg-white border-slate-200 text-slate-700"
          }`}>
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ───── DOCUMENT EDITOR ───── */}
      {editingFile && !editorError && (
        <DocumentEditorWrapper
          key={editingFile.id}
          editingFile={editingFile}
          isDark={isDark}
          onSave={(content: string) => {
            const updatedFile = { ...editingFile, content, modified: formatDate(new Date()), modifiedDate: new Date(), size: `${Math.round(new Blob([content]).size / 1024)} KB`, sizeBytes: new Blob([content]).size };
            setFiles((prev) =>
              prev.map((f) =>
                f.id === editingFile.id ? updatedFile : f
              )
            );
            setEditingFile(updatedFile);
            persistFile(updatedFile);
          }}
          onClose={() => {
            // Persist the latest state of the file before closing
            const latestFile = files.find(f => f.id === editingFile.id);
            if (latestFile) persistFile(latestFile);
            setEditingFile(null); setEditorError(null);
          }}
          onRename={(newName: string) => {
            const updatedFile = { ...editingFile, name: newName, extension: newName.split(".").pop()?.toLowerCase() || "txt" };
            setFiles((prev) =>
              prev.map((f) =>
                f.id === editingFile.id ? updatedFile : f
              )
            );
            setEditingFile(updatedFile);
            persistFile(updatedFile);
            showToast(`Renamed to: ${newName}`);
          }}
          onError={(err: string) => {
            setEditorError(err);
            showToast("Editor failed to load. Try again.");
          }}
        />
      )}
      {editingFile && editorError && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl ${isDark ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-800'}`}>
            <h3 className="text-lg font-bold mb-2">Editor Failed to Load</h3>
            <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>The document editor encountered an error. This may be a temporary issue.</p>
            <p className={`text-xs font-mono p-3 rounded-lg mb-4 ${isDark ? 'bg-slate-800 text-red-400' : 'bg-red-50 text-red-600'}`}>{editorError}</p>
            <div className="flex gap-3">
              <button onClick={() => { setEditorError(null); }} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors cursor-pointer">Try Again</button>
              <button onClick={() => { setEditingFile(null); setEditorError(null); }} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
