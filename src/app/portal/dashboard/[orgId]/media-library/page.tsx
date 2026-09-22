"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useUser, useFirestore, useStorage } from "@/firebase";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const DocumentEditor = dynamic(() => import("@/components/media-library/DocumentEditor"), { ssr: false });
import BrainProfileForm from "@/components/media-library/BrainProfileForm";
import { collection, getDoc, getDocs, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
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
  Brain,
  Building2,
  HardDrive,
  BookOpen,
  LayoutGrid,
  List,
} from "lucide-react";
import { useOrgId } from "@/contexts/OrgContext";
import MediaGridCard from "@/components/media-library/MediaGridCard";
import type { MediaCardItem } from "@/components/media-library/MediaGridCard";
import PactMemoryView from "@/components/media-library/PactMemoryView";
import { getAuthHeaders } from "@/lib/api-auth-client";
import { ADMIN_EMAILS } from "@/lib/admin";

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
  storagePath?: string;
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

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "tiff"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "avi", "mkv"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "flac", "aac"]);
const DOC_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "rtf", "md", "odt"]);
const SPREADSHEET_EXTENSIONS = new Set(["xls", "xlsx", "csv", "ods"]);
const PRESENTATION_EXTENSIONS = new Set(["ppt", "pptx", "odp"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2"]);
const CODE_EXTENSIONS = new Set(["js", "ts", "jsx", "tsx", "py", "html", "css", "json", "xml", "yaml", "yml", "sh", "sql"]);

function isImageFile(ext: string): boolean {
  return IMAGE_EXTENSIONS.has(ext.toLowerCase());
}

function isVideoFile(ext: string): boolean {
  return VIDEO_EXTENSIONS.has(ext.toLowerCase());
}

function isAudioFile(ext: string): boolean {
  return AUDIO_EXTENSIONS.has(ext.toLowerCase());
}

function isDocFile(ext: string): boolean {
  return DOC_EXTENSIONS.has(ext.toLowerCase());
}

function isMediaFile(ext: string): boolean {
  return isImageFile(ext) || isVideoFile(ext);
}

function isPreviewable(ext: string): boolean {
  return isImageFile(ext) || isVideoFile(ext) || isAudioFile(ext) || ext.toLowerCase() === 'pdf';
}

// Binary document formats that cannot be rendered in TipTap editor
// These should download instead of opening the editor with an empty document
const BINARY_DOC_EXTS = new Set(["doc", "docx", "odt", "rtf", "pages", "numbers", "key", "ppt", "pptx", "odp", "xls", "xlsx", "ods"]);

function isEditableInEditor(file: { extension: string; content?: string }): boolean {
  const ext = file.extension.toLowerCase();
  // Binary doc formats can never be edited in TipTap
  if (BINARY_DOC_EXTS.has(ext)) return false;
  // Text/code/md files can be viewed but not really TipTap documents
  // Only truly TipTap-created documents (type: "document") have HTML content
  return true;
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

  const orgId = useOrgId();

  // ─── Tab State: AI Brain / Org AI Brain / P.A.C.T. ───
  type MediaTab = "ai-brain" | "org-brain" | "pact";
  const [mediaTab, setMediaTab] = useState<MediaTab>("ai-brain");

  // ─── Sub-View State: Documents vs. Guided Profile within AI Brain / Org Brain ───
  type BrainSubView = "documents" | "profile";
  const [aiBrainSubView, setAiBrainSubView] = useState<BrainSubView>("documents");
  const [orgBrainSubView, setOrgBrainSubView] = useState<BrainSubView>("documents");

  // ─── View Mode: Grid / List ───
  type ViewMode = "grid" | "list";
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // ─── Toast State (hoisted before AI Brain for dependency ordering) ───
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // ─── AI Brain State ───
  interface AiBrainDoc {
    id: string;
    name: string;
    type: string;
    extension: string;
    size: string;
    sizeBytes: number;
    mimeType: string;
    downloadUrl: string;
    storagePath: string;
    plaintext: string;
    pageCount: number | null;
    uploadedBy: string;
    uploadedByEmail: string;
    createdAt: Date;
    status: "processing" | "ready" | "error";
    vectorChunkCount?: number;
  }
  const [aiBrainDocs, setAiBrainDocs] = useState<AiBrainDoc[]>([]);
  const [aiBrainLoaded, setAiBrainLoaded] = useState(false);
  const [aiBrainUploading, setAiBrainUploading] = useState(false);
  const [aiBrainUploadProgress, setAiBrainUploadProgress] = useState<string>("");
  const [aiBrainDragOver, setAiBrainDragOver] = useState(false);
  const [aiBrainPreview, setAiBrainPreview] = useState<AiBrainDoc | null>(null);
  const aiBrainFileRef = useRef<HTMLInputElement>(null);

  // ─── Load AI Brain Docs from Firestore ───
  useEffect(() => {
    if (!firestore || !user?.uid || mediaTab !== "ai-brain") return;
    const docsCol = collection(firestore, `users/${user.uid}/ai_brain_docs`);
    const unsub = onSnapshot(docsCol, (snap) => {
      const loaded: AiBrainDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "Untitled",
          type: data.type || "txt",
          extension: data.extension || "txt",
          size: data.size || "0 KB",
          sizeBytes: data.sizeBytes || 0,
          mimeType: data.mimeType || "",
          downloadUrl: data.downloadUrl || "",
          storagePath: data.storagePath || "",
          plaintext: data.plaintext || "",
          pageCount: data.pageCount ?? null,
          uploadedBy: data.uploadedBy || "",
          uploadedByEmail: data.uploadedByEmail || "",
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt || Date.now()),
          status: data.status || "ready",
          vectorChunkCount: data.vectorChunkCount ?? undefined,
        };
      });
      loaded.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setAiBrainDocs(loaded);
      setAiBrainLoaded(true);
    }, (err) => {
      console.error("[AI Brain] Failed to load personal AI brain docs:", err);
      setAiBrainLoaded(true); // Still mark as loaded so UI doesn't spin forever
    });
    return () => unsub();
  }, [firestore, user?.uid, mediaTab]);

  // ─── AI Brain Upload Handler ───
  const handleAiBrainUpload = useCallback(async (fileList: FileList | File[]) => {
    if (!user?.uid) {
      showToast("Not authenticated");
      return;
    }
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    for (const file of filesArray) {
      if (file.size > 50 * 1024 * 1024) {
        showToast(`File too large: ${file.name} (max 50MB)`);
        continue;
      }

      setAiBrainUploading(true);
      setAiBrainUploadProgress(`Uploading ${file.name}...`);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("scope", "personal");

        const headers = await getAuthHeaders();
        // Remove Content-Type — FormData sets its own boundary
        delete (headers as Record<string, string>)["Content-Type"];

        const res = await fetch("/api/ai-brain-upload", {
          method: "POST",
          headers,
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Upload failed" }));
          showToast(`Upload failed: ${errData.details || errData.error || res.statusText}`);
          continue;
        }

        const data = await res.json();
        showToast(`Uploaded "${file.name}" — ${data.chunksCreated} vector chunks created`);
        // Optimistic UI: immediately show the uploaded document
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const newDoc: AiBrainDoc = {
          id: data.docId,
          name: file.name,
          type: data.docType || ext,
          extension: ext,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
          downloadUrl: data.downloadUrl || "",
          storagePath: "",
          plaintext: "",
          pageCount: null,
          uploadedBy: user.uid,
          uploadedByEmail: user.email || "",
          createdAt: new Date(),
          status: "ready",
          vectorChunkCount: data.chunksCreated,
        };
        setAiBrainDocs(prev => [newDoc, ...prev.filter(d => d.id !== newDoc.id)]);
      } catch (err: any) {
        console.error("[AI Brain Upload]", err);
        showToast(`Upload error: ${err?.message || "Unknown"}`);
      }
    }

    setAiBrainUploading(false);
    setAiBrainUploadProgress("");
  }, [user?.uid, showToast]);

  // ─── AI Brain Delete Handler ───
  const handleAiBrainDelete = useCallback(async (docItem: AiBrainDoc) => {
    if (!firestore || !user?.uid) return;
    try {
      // Delete the metadata doc
      await deleteDoc(doc(firestore, `users/${user.uid}/ai_brain_docs`, docItem.id));

      // Delete vector chunks (best-effort)
      try {
        const vectorsCol = collection(firestore, `users/${user.uid}/ai_brain_vectors`);
        const vectorSnap = await getDocs(vectorsCol);
        const batch: Promise<void>[] = [];
        vectorSnap.docs.forEach((vDoc) => {
          if (vDoc.data().docId === docItem.id) {
            batch.push(deleteDoc(doc(firestore, `users/${user.uid}/ai_brain_vectors`, vDoc.id)));
          }
        });
        await Promise.all(batch);
      } catch (vecErr) {
        console.warn("[AI Brain] Vector cleanup failed (non-fatal):", vecErr);
      }

      // Delete from storage (best-effort)
      if (storage && docItem.storagePath) {
        try {
          const { deleteObject, ref } = await import("firebase/storage");
          await deleteObject(ref(storage, docItem.storagePath));
        } catch (storErr) {
          console.warn("[AI Brain] Storage cleanup failed (non-fatal):", storErr);
        }
      }

      showToast(`Deleted "${docItem.name}"`);
    } catch (err: any) {
      console.error("[AI Brain Delete]", err);
      showToast(`Delete failed: ${err?.message || "Unknown"}`);
    }
  }, [firestore, user?.uid, storage, showToast]);

  // ─── AI Brain Doc → MediaCardItem mapper ───
  const mapAiBrainToCard = useCallback((d: AiBrainDoc): MediaCardItem => ({
    id: d.id,
    name: d.name,
    type: d.type,
    extension: d.extension,
    size: d.size,
    sizeBytes: d.sizeBytes,
    modified: d.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    modifiedDate: d.createdAt,
    downloadUrl: d.downloadUrl,
    pageCount: d.pageCount ?? undefined,
    content: d.plaintext,
    status: d.status,
    uploadedBy: d.uploadedBy,
    uploadedByEmail: d.uploadedByEmail,
  }), []);

  // ─── Org AI Brain State ───
  const [orgBrainDocs, setOrgBrainDocs] = useState<AiBrainDoc[]>([]);
  const [orgBrainLoaded, setOrgBrainLoaded] = useState(false);
  const [orgBrainUploading, setOrgBrainUploading] = useState(false);
  const [orgBrainUploadProgress, setOrgBrainUploadProgress] = useState<string>("");
  const [orgBrainDragOver, setOrgBrainDragOver] = useState(false);
  const [orgBrainPreview, setOrgBrainPreview] = useState<AiBrainDoc | null>(null);
  const orgBrainFileRef = useRef<HTMLInputElement>(null);

  // ─── Admin Detection ───
  const [currentUserRole, setCurrentUserRole] = useState<string>("member");
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const fetchRole = async () => {
      try {
        const userDoc = await getDoc(doc(firestore, "users", user.uid));
        const data = userDoc.data();
        setCurrentUserRole(data?.role || "member");
      } catch { setCurrentUserRole("member"); }
    };
    fetchRole();
  }, [firestore, user?.uid]);
  const isOrgAdmin = currentUserRole === "admin" || ADMIN_EMAILS.includes(user?.email || "");

  // ─── Load Org AI Brain Docs from Firestore ───
  useEffect(() => {
    if (!firestore || !orgId || mediaTab !== "org-brain") return;
    const docsCol = collection(firestore, `orgs/${orgId}/org_brain_docs`);
    const unsub = onSnapshot(docsCol, (snap) => {
      const loaded: AiBrainDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || "Untitled",
          type: data.type || "txt",
          extension: data.extension || "txt",
          size: data.size || "0 KB",
          sizeBytes: data.sizeBytes || 0,
          mimeType: data.mimeType || "",
          downloadUrl: data.downloadUrl || "",
          storagePath: data.storagePath || "",
          plaintext: data.plaintext || "",
          pageCount: data.pageCount ?? null,
          uploadedBy: data.uploadedBy || "",
          uploadedByEmail: data.uploadedByEmail || "",
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt || Date.now()),
          status: data.status || "ready",
          vectorChunkCount: data.vectorChunkCount ?? undefined,
        };
      });
      loaded.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setOrgBrainDocs(loaded);
      setOrgBrainLoaded(true);
    }, (err) => {
      console.error("[AI Brain] Failed to load org AI brain docs:", err);
      setOrgBrainLoaded(true); // Still mark as loaded so UI doesn't spin forever
    });
    return () => unsub();
  }, [firestore, orgId, mediaTab]);

  // ─── Org AI Brain Upload Handler (admin only) ───
  const handleOrgBrainUpload = useCallback(async (fileList: FileList | File[]) => {
    if (!user?.uid || !orgId) {
      showToast("Not authenticated");
      return;
    }
    if (!isOrgAdmin) {
      showToast("Only admins can upload to the Organization AI Brain");
      return;
    }
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    for (const file of filesArray) {
      if (file.size > 50 * 1024 * 1024) {
        showToast(`File too large: ${file.name} (max 50MB)`);
        continue;
      }

      setOrgBrainUploading(true);
      setOrgBrainUploadProgress(`Uploading ${file.name}...`);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("scope", "org");
        formData.append("orgId", orgId);

        const headers = await getAuthHeaders();
        delete (headers as Record<string, string>)["Content-Type"];

        const res = await fetch("/api/ai-brain-upload", {
          method: "POST",
          headers,
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Upload failed" }));
          showToast(`Upload failed: ${errData.details || errData.error || res.statusText}`);
          continue;
        }

        const data = await res.json();
        showToast(`Uploaded "${file.name}" to Org Brain — ${data.chunksCreated} vector chunks created`);
        // Optimistic UI: immediately show the uploaded document
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const newDoc: AiBrainDoc = {
          id: data.docId,
          name: file.name,
          type: data.docType || ext,
          extension: ext,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
          downloadUrl: data.downloadUrl || "",
          storagePath: "",
          plaintext: "",
          pageCount: null,
          uploadedBy: user.uid,
          uploadedByEmail: user.email || "",
          createdAt: new Date(),
          status: "ready",
          vectorChunkCount: data.chunksCreated,
        };
        setOrgBrainDocs(prev => [newDoc, ...prev.filter(d => d.id !== newDoc.id)]);
      } catch (err: any) {
        console.error("[Org Brain Upload]", err);
        showToast(`Upload error: ${err?.message || "Unknown"}`);
      }
    }

    setOrgBrainUploading(false);
    setOrgBrainUploadProgress("");
  }, [user?.uid, orgId, isOrgAdmin, showToast]);

  // ─── Org AI Brain Delete Handler (admin only) ───
  const handleOrgBrainDelete = useCallback(async (docItem: AiBrainDoc) => {
    if (!firestore || !orgId) return;
    if (!isOrgAdmin) {
      showToast("Only admins can delete from the Organization AI Brain");
      return;
    }
    try {
      await deleteDoc(doc(firestore, `orgs/${orgId}/org_brain_docs`, docItem.id));

      // Delete vector chunks (best-effort)
      try {
        const vectorsCol = collection(firestore, `orgs/${orgId}/kb_vectors`);
        const vectorSnap = await getDocs(vectorsCol);
        const batch: Promise<void>[] = [];
        vectorSnap.docs.forEach((vDoc) => {
          if (vDoc.data().docId === docItem.id) {
            batch.push(deleteDoc(doc(firestore, `orgs/${orgId}/kb_vectors`, vDoc.id)));
          }
        });
        await Promise.all(batch);
      } catch (vecErr) {
        console.warn("[Org Brain] Vector cleanup failed (non-fatal):", vecErr);
      }

      // Delete from storage (best-effort)
      if (storage && docItem.storagePath) {
        try {
          const { deleteObject, ref } = await import("firebase/storage");
          await deleteObject(ref(storage, docItem.storagePath));
        } catch (storErr) {
          console.warn("[Org Brain] Storage cleanup failed (non-fatal):", storErr);
        }
      }

      showToast(`Deleted "${docItem.name}" from Org Brain`);
    } catch (err: any) {
      console.error("[Org Brain Delete]", err);
      showToast(`Delete failed: ${err?.message || "Unknown"}`);
    }
  }, [firestore, orgId, isOrgAdmin, storage, showToast]);

  // ─── Cross-Tab Move Dialog State ───
  type MoveSource = "ai-brain" | "org-brain";
  type MoveTarget = "ai-brain" | "org-brain";
  interface MoveDialogState {
    source: MoveSource;
    item: AiBrainDoc;
    x: number;
    y: number;
  }
  const [moveDialog, setMoveDialog] = useState<MoveDialogState | null>(null);
  const [moveInProgress, setMoveInProgress] = useState(false);

  // ─── Cross-Tab Move Handler (AI Brain ↔ Org Brain only) ───
  const handleCrossTabMove = useCallback(async (target: MoveTarget, sourceOverride?: MoveSource, itemOverride?: AiBrainDoc) => {
    const source = sourceOverride || moveDialog?.source;
    const item = itemOverride || moveDialog?.item;
    if (!source || !item || moveInProgress || !firestore || !user?.uid) return;

    setMoveInProgress(true);
    setMoveDialog(null);

    try {
      const sourceDoc = item as AiBrainDoc;

      if (target === "org-brain" && source === "ai-brain") {
        // ── AI Brain → Org Brain (admin only) ──
        if (!isOrgAdmin) { showToast("Only admins can move to Org Brain"); setMoveInProgress(false); return; }
        if (!sourceDoc.downloadUrl) { showToast("Document has no download URL"); setMoveInProgress(false); return; }

        showToast("Moving to Org Brain...");
        const response = await fetch(sourceDoc.downloadUrl);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append("file", blob, sourceDoc.name);
        formData.append("scope", "org");
        formData.append("orgId", orgId);

        const headers = await getAuthHeaders();
        delete (headers as Record<string, string>)["Content-Type"];

        const res = await fetch("/api/ai-brain-upload", { method: "POST", headers, body: formData });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Upload failed" }));
          showToast(`Move failed: ${errData.error || res.statusText}`);
          setMoveInProgress(false);
          return;
        }

        await handleAiBrainDelete(sourceDoc);
        showToast(`Moved "${sourceDoc.name}" to Org Brain`);

      } else if (target === "ai-brain" && source === "org-brain") {
        // ── Org Brain → AI Brain ──
        if (!sourceDoc.downloadUrl) { showToast("Document has no download URL"); setMoveInProgress(false); return; }

        showToast("Moving to AI Brain...");
        const response = await fetch(sourceDoc.downloadUrl);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append("file", blob, sourceDoc.name);
        formData.append("scope", "personal");

        const headers = await getAuthHeaders();
        delete (headers as Record<string, string>)["Content-Type"];

        const res = await fetch("/api/ai-brain-upload", { method: "POST", headers, body: formData });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Upload failed" }));
          showToast(`Move failed: ${errData.error || res.statusText}`);
          setMoveInProgress(false);
          return;
        }

        if (isOrgAdmin) {
          await handleOrgBrainDelete(sourceDoc);
        }
        showToast(`Moved "${sourceDoc.name}" to AI Brain`);
      }
    } catch (err: any) {
      console.error("[Cross-Tab Move Error]:", err);
      showToast(`Move failed: ${err?.message || "Unknown error"}`);
    } finally {
      setMoveInProgress(false);
    }
  }, [moveDialog, moveInProgress, firestore, user?.uid, storage, orgId, isOrgAdmin, showToast, handleAiBrainDelete, handleOrgBrainDelete]);

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

  // ─── Load folders from Firestore ───
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const foldersCol = collection(firestore, `users/${user.uid}/media_library_folders`);
    const unsub = onSnapshot(foldersCol, (snap) => {
      const loadedFolders: Record<string, FolderNode> = { ...INITIAL_FOLDERS };
      snap.docs.forEach((d) => {
        const data = d.data();
        loadedFolders[d.id] = {
          id: d.id,
          name: data.name || 'Untitled',
          parentId: data.parentId || 'my-files',
          children: data.children || [],
          itemCount: data.itemCount || 0,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt || Date.now()),
        };
      });
      // Rebuild children arrays from parentId relationships
      Object.values(loadedFolders).forEach((f) => {
        if (f.parentId && loadedFolders[f.parentId] && f.id !== 'my-files' && f.id !== 'shared' && f.id !== 'trash') {
          if (!loadedFolders[f.parentId].children.includes(f.id)) {
            loadedFolders[f.parentId] = {
              ...loadedFolders[f.parentId],
              children: [...loadedFolders[f.parentId].children, f.id],
            };
          }
        }
      });
      setFolders(loadedFolders);
    });
    return () => unsub();
  }, [firestore, user?.uid]);

  // ─── Helper: persist a folder to Firestore ───
  const persistFolder = useCallback(async (folder: FolderNode) => {
    if (!firestore || !user?.uid) return;
    try {
      await setDoc(doc(firestore, `users/${user.uid}/media_library_folders`, folder.id), {
        name: folder.name,
        parentId: folder.parentId,
        children: folder.children,
        itemCount: folder.itemCount,
        createdAt: folder.createdAt,
      });
    } catch (err) {
      console.error('Failed to persist folder:', err);
    }
  }, [firestore, user?.uid]);

  const deleteFolderFromFirestore = useCallback(async (folderId: string) => {
    if (!firestore || !user?.uid) return;
    try {
      await deleteDoc(doc(firestore, `users/${user.uid}/media_library_folders`, folderId));
    } catch (err) {
      console.error('Failed to delete folder from Firestore:', err);
    }
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

  // ─── Share Modal State ───
  const [shareModalFile, setShareModalFile] = useState<FileItem | null>(null);

  // ─── Editor State ───
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);

  // ─── Media Preview State ───
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // ─── Rename State ───
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  const renameFileRef = useRef<HTMLInputElement>(null);

  // ─── Editor Error State ───
  const [editorError, setEditorError] = useState<string | null>(null);

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
    } else {
      showToast(`${action}: ${folder?.name}`);
    }
    setContextMenu(null);
  };

  // ─── Move File Modal State ───
  const [moveFileId, setMoveFileId] = useState<string | null>(null);

  const handleMoveFile = (fileId: string, targetFolderId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    const updated = { ...file, folderId: targetFolderId };
    setFiles((prev) => prev.map((f) => f.id === fileId ? updated : f));
    persistFile(updated);
    showToast(`Moved to ${folders[targetFolderId]?.name || 'folder'}`);
    setMoveFileId(null);
  };

  const handleFileContextAction = (action: string) => {
    if (!contextMenu || contextMenu.targetType !== "file") return;
    const file = files.find((f) => f.id === contextMenu.targetId);
    if (!file) { setContextMenu(null); return; }

    if (action === "Open") {
      if (isPreviewable(file.extension) && file.downloadUrl) {
        setPreviewFile(file);
      } else if (file.extension === 'txt' || file.extension === 'md') {
        setEditingFile(file);
      } else if (file.downloadUrl) {
        window.open(file.downloadUrl, '_blank');
      }
    } else if (action === "Rename") {
      setRenamingFileId(file.id);
      setRenameValue(file.name);
    } else if (action === "Share") {
      setShareModalFile(file);
    } else if (action === "Move to...") {
      setMoveFileId(file.id);
    } else if (action === "Delete") {
      handleDeleteFile(file.id);
    } else if (action === "Download" && file.downloadUrl) {
      window.open(file.downloadUrl, '_blank');
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
    // Move files in this folder to my-files instead of deleting them
    setFiles((prev) => prev.map((f) => f.folderId === folderId ? { ...f, folderId: 'my-files' } : f));
    // Update files in Firestore
    files.filter(f => f.folderId === folderId).forEach(f => persistFile({ ...f, folderId: 'my-files' }));
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
    deleteFolderFromFirestore(folderId);
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
    persistFolder(newFolder);
    setNewFolderName("");
    setCreatingFolder(false);
    setCreatingFolderInContent(false);
    showToast(`Created folder: ${newFolder.name}`);
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
  }, [storage, firestore, user?.uid, selectedFolder, showToast, persistFile]);

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
    <div className={`mx-0 mb-0 md:-mx-10 md:-mb-10 flex flex-col h-full w-full ${bg} overflow-hidden rounded-xl border ${borderColor}`}>
      {/* ───── TAB SELECTOR BAR ───── */}
      <div className={`flex items-center gap-1.5 px-4 pt-3 pb-0 shrink-0 overflow-x-auto`}>
        {/* ── AI Intelligence Group (AI Brain, Org Brain, P.A.C.T.) ── */}
        {([
          { key: "ai-brain" as MediaTab, label: "AI Brain", icon: <Brain className="w-4 h-4" />, color: "indigo", desc: "Personal — Jarvis can read & quote" },
          { key: "org-brain" as MediaTab, label: "Org AI Brain", icon: <Building2 className="w-4 h-4" />, color: "blue", desc: "Shared — all users" },
          { key: "pact" as MediaTab, label: "P.A.C.T.", icon: <BookOpen className="w-4 h-4" />, color: "emerald", desc: "Learned memory from chats" },
        ]).map((tab) => {
          const isActive = mediaTab === tab.key;
          const activeStyles = {
            "indigo": isDark ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-300" : "bg-indigo-50 border-indigo-300 text-indigo-700",
            "blue": isDark ? "bg-blue-500/15 border-blue-500/40 text-blue-300" : "bg-blue-50 border-blue-300 text-blue-700",
            "emerald": isDark ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : "bg-emerald-50 border-emerald-300 text-emerald-700",
          }[tab.color];
          const inactiveStyles = isDark
            ? "bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
            : "bg-transparent border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50";
          return (
            <button
              key={tab.key}
              onClick={() => setMediaTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[13px] font-semibold border border-b-0 transition-all cursor-pointer ${
                isActive ? activeStyles : inactiveStyles
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {isActive && (
                <span className={`text-[10px] font-medium ml-1 hidden lg:inline ${isDark ? "opacity-60" : "opacity-50"}`}>
                  — {tab.desc}
                </span>
              )}
            </button>
          );
        })}

      </div>

      {/* ───── TAB CONTENT AREA ───── */}
      <div className={`flex flex-1 overflow-hidden border-t ${borderColor}`}>

        {/* ───── AI BRAIN TAB ───── */}
        {mediaTab === "ai-brain" && (
          <div
            className={`flex-1 flex flex-col overflow-hidden transition-colors ${
              aiBrainDragOver
                ? isDark ? "bg-indigo-950/30" : "bg-indigo-50/60"
                : ""
            }`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setAiBrainDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setAiBrainDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAiBrainDragOver(false);
              if (e.dataTransfer.files?.length) handleAiBrainUpload(e.dataTransfer.files);
            }}
          >
            {/* Sub-view toggle: Documents vs. Guided Profile */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              <button
                onClick={() => setAiBrainSubView("documents")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  aiBrainSubView === "documents"
                    ? isDark ? "bg-indigo-600 text-white shadow-sm" : "bg-indigo-600 text-white shadow-sm"
                    : isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-500 hover:text-slate-700"
                }`}
              >
                📄 Documents
              </button>
              <button
                onClick={() => setAiBrainSubView("profile")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  aiBrainSubView === "profile"
                    ? isDark ? "bg-indigo-600 text-white shadow-sm" : "bg-indigo-600 text-white shadow-sm"
                    : isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-500 hover:text-slate-700"
                }`}
              >
                🧠 Guided Profile
              </button>
            </div>

            {/* Guided Profile sub-view */}
            {aiBrainSubView === "profile" ? (
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <BrainProfileForm scope="personal" orgId={orgId} isDark={isDark} />
              </div>
            ) : (
            <>
            {/* Hidden file input */}
            <input
              ref={aiBrainFileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.yaml,.yml,.jpg,.jpeg,.png,.webp,.gif"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleAiBrainUpload(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Header bar */}
            <div className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? "bg-indigo-500/20" : "bg-indigo-50"}`}>
                  <Brain className={`w-4 h-4 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Personal AI Brain</h3>
                  <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {aiBrainDocs.length} document{aiBrainDocs.length !== 1 ? "s" : ""}
                    {aiBrainDocs.some((d) => d.status === "processing") && " · Processing..."}
                  </p>
                </div>
              </div>
              <button
                disabled={aiBrainUploading}
                onClick={() => aiBrainFileRef.current?.click()}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                  aiBrainUploading
                    ? isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-500"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {aiBrainUploading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Upload</>
                )}
              </button>
            </div>

            {/* Upload progress banner */}
            {aiBrainUploading && aiBrainUploadProgress && (
              <div className={`px-6 py-2.5 text-xs font-medium flex items-center gap-2 border-b ${
                isDark ? "bg-indigo-950/30 border-indigo-900/50 text-indigo-300" : "bg-indigo-50 border-indigo-100 text-indigo-700"
              }`}>
                <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                {aiBrainUploadProgress}
              </div>
            )}

            {/* Drag overlay */}
            {aiBrainDragOver && (
              <div className={`mx-6 mt-4 mb-2 p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center ${
                isDark ? "border-indigo-500 bg-indigo-950/40" : "border-indigo-400 bg-indigo-50"
              }`}>
                <Upload className={`w-8 h-8 mb-2 ${isDark ? "text-indigo-400" : "text-indigo-500"}`} />
                <p className={`text-sm font-semibold ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>Drop files to upload to AI Brain</p>
                <p className={`text-[11px] mt-1 ${isDark ? "text-indigo-400/70" : "text-indigo-500"}`}>PDF, DOCX, TXT, images, code files</p>
              </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {!aiBrainLoaded ? (
                <div className="flex items-center justify-center h-48">
                  <span className="w-6 h-6 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                </div>
              ) : aiBrainDocs.length === 0 && !aiBrainDragOver ? (
                /* Empty state */
                <div className="flex-1 flex flex-col items-center justify-center py-12 sm:py-20 px-4">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${isDark ? "bg-indigo-500/15" : "bg-indigo-50"}`}>
                    <Brain className={`w-10 h-10 ${isDark ? "text-indigo-400" : "text-indigo-500"}`} />
                  </div>
                  <h2 className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>Personal AI Brain</h2>
                  <p className={`text-sm text-center max-w-md mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    Upload documents, images, and files here for Jarvis to read, reference, and quote from.
                  </p>
                  <p className={`text-xs text-center max-w-md mb-6 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    Jarvis will search these documents when you ask questions and cite specific sources in responses.
                  </p>
                  <button
                    onClick={() => aiBrainFileRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Upload to AI Brain
                  </button>
                  <p className={`text-[11px] mt-3 ${isDark ? "text-slate-500" : "text-slate-400"}`}>Supports PDF, DOCX, TXT, JPG, PNG, WebP, and code files</p>
                </div>
              ) : (
                /* Document Grid */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {aiBrainDocs.map((brainDoc) => (
                    <MediaGridCard
                      key={brainDoc.id}
                      item={mapAiBrainToCard(brainDoc)}
                      isDark={isDark}
                      isSelected={selectedFileIds.has(brainDoc.id)}
                      onSelect={(id) => {
                        setSelectedFileIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        });
                      }}
                      onDoubleClick={(item) => {
                        if (isPreviewable(brainDoc.extension) && brainDoc.downloadUrl) {
                          setAiBrainPreview(brainDoc);
                        } else if (brainDoc.downloadUrl) {
                          window.open(brainDoc.downloadUrl, "_blank");
                        }
                      }}
                      onDelete={() => handleAiBrainDelete(brainDoc)}
                      onContextMenu={(item, e) => {
                        e.preventDefault();
                        setMoveDialog({ source: "ai-brain", item: brainDoc, x: e.clientX, y: e.clientY });
                      }}
                      onDownload={(item) => {
                        if (item.downloadUrl) {
                          const a = document.createElement("a");
                          a.href = item.downloadUrl;
                          a.download = item.name;
                          a.target = "_blank";
                          a.rel = "noopener noreferrer";
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }
                      }}
                      extraBadge={
                        brainDoc.status === "processing" ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <span className="w-2 h-2 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
                            Processing
                          </span>
                        ) : brainDoc.vectorChunkCount ? (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                            isDark ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}>
                            {brainDoc.vectorChunkCount} chunks
                          </span>
                        ) : null
                      }
                    />
                  ))}
                </div>
              )}
            </div>
            </>
            )}
          </div>
        )}

        {/* ───── AI BRAIN PREVIEW MODAL ───── */}
        {aiBrainPreview && aiBrainPreview.downloadUrl && (
          <>
            <div
              className="fixed inset-0 bg-black/80 z-[250] backdrop-blur-md cursor-pointer"
              onClick={() => setAiBrainPreview(null)}
            />
            <div className="fixed inset-0 z-[260] flex items-center justify-center p-8 pointer-events-none">
              <div className="relative max-w-[90vw] max-h-[90vh] w-full h-full flex flex-col items-center justify-center pointer-events-auto">
                {/* Top Bar */}
                <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? "bg-white/10" : "bg-black/10"}`}>
                      {isImageFile(aiBrainPreview.extension) ? <Image className="w-4 h-4 text-white" /> :
                       isVideoFile(aiBrainPreview.extension) ? <Video className="w-4 h-4 text-white" /> :
                       <FileText className="w-4 h-4 text-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-white truncate">{aiBrainPreview.name}</p>
                      <p className="text-[11px] text-white/60">{aiBrainPreview.size} · {aiBrainPreview.extension.toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={aiBrainPreview.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={aiBrainPreview.name}
                      className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                      title="Download"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-4 h-4 text-white" />
                    </a>
                    <button
                      onClick={() => setAiBrainPreview(null)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                      title="Close"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
                {/* Content */}
                <div className="flex items-center justify-center w-full h-full pt-16 pb-4">
                  {isVideoFile(aiBrainPreview.extension) ? (
                    <video src={aiBrainPreview.downloadUrl} controls autoPlay className="max-w-full max-h-full rounded-xl shadow-2xl" />
                  ) : isImageFile(aiBrainPreview.extension) ? (
                    <img src={aiBrainPreview.downloadUrl} alt={aiBrainPreview.name} className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" />
                  ) : aiBrainPreview.extension === "pdf" ? (
                    <iframe src={aiBrainPreview.downloadUrl} className="w-full h-full rounded-xl shadow-2xl bg-white" title={aiBrainPreview.name} />
                  ) : (
                    <div className={`max-w-2xl w-full max-h-full overflow-auto rounded-xl shadow-2xl p-8 ${isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}`}>
                      <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{aiBrainPreview.plaintext || "No text content extracted."}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ───── ORG AI BRAIN TAB ───── */}
        {mediaTab === "org-brain" && (
          <div
            className={`flex-1 flex flex-col overflow-hidden transition-colors ${
              orgBrainDragOver && isOrgAdmin
                ? isDark ? "bg-blue-950/30" : "bg-blue-50/60"
                : ""
            }`}
            onDragOver={(e) => { if (isOrgAdmin) { e.preventDefault(); e.stopPropagation(); setOrgBrainDragOver(true); } }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setOrgBrainDragOver(false); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOrgBrainDragOver(false);
              if (isOrgAdmin && e.dataTransfer.files?.length) handleOrgBrainUpload(e.dataTransfer.files);
            }}
          >
            {/* Sub-view toggle: Documents vs. Guided Profile */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              <button
                onClick={() => setOrgBrainSubView("documents")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  orgBrainSubView === "documents"
                    ? isDark ? "bg-blue-600 text-white shadow-sm" : "bg-blue-600 text-white shadow-sm"
                    : isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-500 hover:text-slate-700"
                }`}
              >
                📄 Documents
              </button>
              <button
                onClick={() => setOrgBrainSubView("profile")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  orgBrainSubView === "profile"
                    ? isDark ? "bg-blue-600 text-white shadow-sm" : "bg-blue-600 text-white shadow-sm"
                    : isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-100 text-slate-500 hover:text-slate-700"
                }`}
              >
                🏢 Guided Profile
              </button>
            </div>

            {/* Guided Profile sub-view */}
            {orgBrainSubView === "profile" ? (
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <BrainProfileForm scope="org" orgId={orgId} isDark={isDark} readOnly={!isOrgAdmin} />
              </div>
            ) : (
            <>
            {/* Hidden file input (admin only) */}
            {isOrgAdmin && (
              <input
                ref={orgBrainFileRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.yaml,.yml,.jpg,.jpeg,.png,.webp,.gif"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleOrgBrainUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            )}

            {/* Header bar */}
            <div className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? "bg-blue-500/20" : "bg-blue-50"}`}>
                  <Building2 className={`w-4 h-4 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Organization AI Brain</h3>
                  <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {orgBrainDocs.length} document{orgBrainDocs.length !== 1 ? "s" : ""} · Shared with all members
                    {orgBrainDocs.some((d) => d.status === "processing") && " · Processing..."}
                  </p>
                </div>
              </div>
              {isOrgAdmin && (
                <button
                  disabled={orgBrainUploading}
                  onClick={() => orgBrainFileRef.current?.click()}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                    orgBrainUploading
                      ? isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-500"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {orgBrainUploading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Upload</>
                  )}
                </button>
              )}
            </div>

            {/* Upload progress banner */}
            {orgBrainUploading && orgBrainUploadProgress && (
              <div className={`px-6 py-2.5 text-xs font-medium flex items-center gap-2 border-b ${
                isDark ? "bg-blue-950/30 border-blue-900/50 text-blue-300" : "bg-blue-50 border-blue-100 text-blue-700"
              }`}>
                <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                {orgBrainUploadProgress}
              </div>
            )}

            {/* Drag overlay (admin only) */}
            {orgBrainDragOver && isOrgAdmin && (
              <div className={`mx-6 mt-4 mb-2 p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center ${
                isDark ? "border-blue-500 bg-blue-950/40" : "border-blue-400 bg-blue-50"
              }`}>
                <Upload className={`w-8 h-8 mb-2 ${isDark ? "text-blue-400" : "text-blue-500"}`} />
                <p className={`text-sm font-semibold ${isDark ? "text-blue-300" : "text-blue-700"}`}>Drop files to upload to Org Brain</p>
                <p className={`text-[11px] mt-1 ${isDark ? "text-blue-400/70" : "text-blue-500"}`}>PDF, DOCX, TXT, images, code files</p>
              </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {!orgBrainLoaded ? (
                <div className="flex items-center justify-center h-48">
                  <span className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                </div>
              ) : orgBrainDocs.length === 0 && !orgBrainDragOver ? (
                /* Empty state */
                <div className="flex-1 flex flex-col items-center justify-center py-12 sm:py-20 px-4">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${isDark ? "bg-blue-500/15" : "bg-blue-50"}`}>
                    <Building2 className={`w-10 h-10 ${isDark ? "text-blue-400" : "text-blue-500"}`} />
                  </div>
                  <h2 className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>Organization AI Brain</h2>
                  <p className={`text-sm text-center max-w-md mb-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    Shared knowledge base for your organization. All team members&apos; Jarvis instances can read and reference these documents.
                  </p>
                  <p className={`text-xs text-center max-w-md mb-6 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    {isOrgAdmin ? "Upload documents that all org members can search." : "Admins can upload documents. All org members can view and search."}
                  </p>
                  {isOrgAdmin && (
                    <button
                      onClick={() => orgBrainFileRef.current?.click()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      Upload to Org Brain
                    </button>
                  )}
                  <p className={`text-[11px] mt-3 ${isDark ? "text-slate-500" : "text-slate-400"}`}>Supports PDF, DOCX, TXT, JPG, PNG, WebP, and code files</p>
                </div>
              ) : (
                /* Document Grid */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {orgBrainDocs.map((brainDoc) => (
                    <MediaGridCard
                      key={brainDoc.id}
                      item={mapAiBrainToCard(brainDoc)}
                      isDark={isDark}
                      isSelected={selectedFileIds.has(brainDoc.id)}
                      onSelect={(id) => {
                        setSelectedFileIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        });
                      }}
                      onDoubleClick={(item) => {
                        if (isPreviewable(brainDoc.extension) && brainDoc.downloadUrl) {
                          setOrgBrainPreview(brainDoc);
                        } else if (brainDoc.downloadUrl) {
                          window.open(brainDoc.downloadUrl, "_blank");
                        }
                      }}
                      onDelete={isOrgAdmin ? () => handleOrgBrainDelete(brainDoc) : undefined}
                      onContextMenu={(item, e) => {
                        e.preventDefault();
                        setMoveDialog({ source: "org-brain", item: brainDoc, x: e.clientX, y: e.clientY });
                      }}
                      onDownload={(item) => {
                        if (item.downloadUrl) {
                          const a = document.createElement("a");
                          a.href = item.downloadUrl;
                          a.download = item.name;
                          a.target = "_blank";
                          a.rel = "noopener noreferrer";
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }
                      }}
                      extraBadge={
                        brainDoc.status === "processing" ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <span className="w-2 h-2 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
                            Processing
                          </span>
                        ) : brainDoc.uploadedByEmail ? (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold truncate max-w-[120px] ${
                            isDark ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`} title={`Uploaded by ${brainDoc.uploadedByEmail}`}>
                            {brainDoc.uploadedByEmail.split("@")[0]}
                          </span>
                        ) : null
                      }
                    />
                  ))}
                </div>
              )}
            </div>
            </>
            )}
          </div>
        )}

        {/* ───── ORG BRAIN PREVIEW MODAL ───── */}
        {orgBrainPreview && orgBrainPreview.downloadUrl && (
          <>
            <div
              className="fixed inset-0 bg-black/80 z-[250] backdrop-blur-md cursor-pointer"
              onClick={() => setOrgBrainPreview(null)}
            />
            <div className="fixed inset-0 z-[260] flex items-center justify-center p-8 pointer-events-none">
              <div className="relative max-w-[90vw] max-h-[90vh] w-full h-full flex flex-col items-center justify-center pointer-events-auto">
                <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? "bg-white/10" : "bg-black/10"}`}>
                      {isImageFile(orgBrainPreview.extension) ? <Image className="w-4 h-4 text-white" /> :
                       isVideoFile(orgBrainPreview.extension) ? <Video className="w-4 h-4 text-white" /> :
                       <FileText className="w-4 h-4 text-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-white truncate">{orgBrainPreview.name}</p>
                      <p className="text-[11px] text-white/60">
                        {orgBrainPreview.size} · {orgBrainPreview.extension.toUpperCase()}
                        {orgBrainPreview.uploadedByEmail && ` · Uploaded by ${orgBrainPreview.uploadedByEmail}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={orgBrainPreview.downloadUrl} target="_blank" rel="noopener noreferrer" download={orgBrainPreview.name} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors cursor-pointer" title="Download" onClick={(e) => e.stopPropagation()}>
                      <Download className="w-4 h-4 text-white" />
                    </a>
                    <button onClick={() => setOrgBrainPreview(null)} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors cursor-pointer" title="Close">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-center w-full h-full pt-16 pb-4">
                  {isVideoFile(orgBrainPreview.extension) ? (
                    <video src={orgBrainPreview.downloadUrl} controls autoPlay className="max-w-full max-h-full rounded-xl shadow-2xl" />
                  ) : isImageFile(orgBrainPreview.extension) ? (
                    <img src={orgBrainPreview.downloadUrl} alt={orgBrainPreview.name} className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" />
                  ) : orgBrainPreview.extension === "pdf" ? (
                    <iframe src={orgBrainPreview.downloadUrl} className="w-full h-full rounded-xl shadow-2xl bg-white" title={orgBrainPreview.name} />
                  ) : (
                    <div className={`max-w-2xl w-full max-h-full overflow-auto rounded-xl shadow-2xl p-8 ${isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}`}>
                      <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{orgBrainPreview.plaintext || "No text content extracted."}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ───── P.A.C.T. MEMORY VIEW ───── */}
        {mediaTab === "pact" && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <PactMemoryView orgId={orgId} isDark={isDark} />
          </div>
        )}

      </div>

      {/* ───── CROSS-TAB MOVE DIALOG ───── */}
      {moveDialog && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setMoveDialog(null)} />
          <div
            className={`fixed z-[100] border rounded-xl shadow-xl py-1.5 min-w-[200px] ${contextBg}`}
            style={{ top: Math.min(moveDialog.y, window.innerHeight - 200), left: Math.min(moveDialog.x, window.innerWidth - 220) }}
          >
            <div className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
              Move to...
            </div>
            {moveDialog.source !== "ai-brain" && (
              <button
                onClick={() => handleCrossTabMove("ai-brain", moveDialog.source, moveDialog.item)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer ${isDark ? "text-indigo-400" : "text-indigo-600"} ${contextHover}`}
              >
                <Brain className="w-4 h-4" />
                Personal AI Brain
              </button>
            )}
            {moveDialog.source !== "org-brain" && isOrgAdmin && (
              <button
                onClick={() => handleCrossTabMove("org-brain", moveDialog.source, moveDialog.item)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer ${isDark ? "text-blue-400" : "text-blue-600"} ${contextHover}`}
              >
                <Building2 className="w-4 h-4" />
                Org AI Brain
              </button>
            )}
            <div className={`my-1 mx-3 border-t ${isDark ? "border-slate-600" : "border-slate-200"}`} />
            <button
              onClick={() => setMoveDialog(null)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer ${textMuted} ${contextHover}`}
            >
              Cancel
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
      {/* ── Move File Modal ── */}
      {moveFileId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setMoveFileId(null)}>
          <div className={`w-[340px] rounded-2xl shadow-2xl p-5 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`} onClick={(e) => e.stopPropagation()}>
            <h3 className={`text-[15px] font-bold mb-4 ${textPrimary}`}>Move to Folder</h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {Object.values(folders)
                .filter((f) => f.id !== 'shared' && f.id !== 'trash' && f.id !== files.find(fi => fi.id === moveFileId)?.folderId)
                .map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleMoveFile(moveFileId, folder.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-700'}`}
                  >
                    <Folder className="w-4 h-4 text-amber-500" />
                    <span className="text-[13px] font-medium">{folder.name}</span>
                  </button>
                ))}
            </div>
            <button onClick={() => setMoveFileId(null)} className={`mt-3 w-full py-2 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              Cancel
            </button>
          </div>
        </div>
      )}

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
