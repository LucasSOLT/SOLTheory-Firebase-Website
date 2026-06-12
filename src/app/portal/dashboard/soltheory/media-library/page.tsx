"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  MoreHorizontal,
  Share2,
  Trash2,
  Edit3,
  Info,
  Search,
  Grid,
  List,
  Upload,
  X,
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
  sharedWith: string[];
  lastAccessed: Date;
}

type SortKey = "name" | "type" | "size" | "modified";
type SortDir = "asc" | "desc";

interface ContextMenuState {
  x: number;
  y: number;
  folderId: string;
}

/* ═══════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════ */

const INITIAL_FOLDERS: Record<string, FolderNode> = {
  "my-files": { id: "my-files", name: "My Files", parentId: null, children: ["documents", "images", "videos", "audio"], itemCount: 12 },
  documents: { id: "documents", name: "Documents", parentId: "my-files", children: [], itemCount: 5 },
  images: { id: "images", name: "Images", parentId: "my-files", children: [], itemCount: 3 },
  videos: { id: "videos", name: "Videos", parentId: "my-files", children: [], itemCount: 2 },
  audio: { id: "audio", name: "Audio", parentId: "my-files", children: [], itemCount: 0 },
  shared: { id: "shared", name: "Shared with Me", parentId: null, children: [], itemCount: 2 },
  trash: { id: "trash", name: "Trash", parentId: null, children: [], itemCount: 0 },
};

const MOCK_FILES: FileItem[] = [
  {
    id: "f1", name: "Grant Application Draft.pdf", type: "PDF", extension: "pdf",
    size: "2.4 MB", sizeBytes: 2516582, modified: "Jun 10, 2025",
    modifiedDate: new Date(2025, 5, 10), folderId: "documents",
    sharedWith: ["MR", "JL"], lastAccessed: new Date(Date.now() - 2 * 3600000),
  },
  {
    id: "f2", name: "Q2 Impact Report.docx", type: "DOCX", extension: "docx",
    size: "1.8 MB", sizeBytes: 1887436, modified: "Jun 8, 2025",
    modifiedDate: new Date(2025, 5, 8), folderId: "documents",
    sharedWith: ["AS"], lastAccessed: new Date(Date.now() - 5 * 3600000),
  },
  {
    id: "f3", name: "NXT Chapter Promo Video.mp4", type: "MP4", extension: "mp4",
    size: "148.6 MB", sizeBytes: 155819622, modified: "Jun 5, 2025",
    modifiedDate: new Date(2025, 5, 5), folderId: "videos",
    sharedWith: ["MR", "AS", "KT"], lastAccessed: new Date(Date.now() - 1 * 3600000),
  },
  {
    id: "f4", name: "Team Headshots.zip", type: "ZIP", extension: "zip",
    size: "34.2 MB", sizeBytes: 35862938, modified: "May 28, 2025",
    modifiedDate: new Date(2025, 4, 28), folderId: "images",
    sharedWith: [], lastAccessed: new Date(Date.now() - 48 * 3600000),
  },
  {
    id: "f5", name: "SOLTheory Logo.png", type: "PNG", extension: "png",
    size: "856 KB", sizeBytes: 876544, modified: "May 20, 2025",
    modifiedDate: new Date(2025, 4, 20), folderId: "images",
    sharedWith: ["MR"], lastAccessed: new Date(Date.now() - 3 * 3600000),
  },
  {
    id: "f6", name: "Budget Spreadsheet 2025.xlsx", type: "XLSX", extension: "xlsx",
    size: "524 KB", sizeBytes: 536576, modified: "Jun 9, 2025",
    modifiedDate: new Date(2025, 5, 9), folderId: "documents",
    sharedWith: ["JL", "KT"], lastAccessed: new Date(Date.now() - 0.5 * 3600000),
  },
  {
    id: "f7", name: "Shelter Partnership MOU.pdf", type: "PDF", extension: "pdf",
    size: "1.1 MB", sizeBytes: 1153434, modified: "Jun 3, 2025",
    modifiedDate: new Date(2025, 5, 3), folderId: "documents",
    sharedWith: ["AS", "MR"], lastAccessed: new Date(Date.now() - 24 * 3600000),
  },
  {
    id: "f8", name: "Community Fair Flyer.png", type: "PNG", extension: "png",
    size: "3.2 MB", sizeBytes: 3355443, modified: "Jun 1, 2025",
    modifiedDate: new Date(2025, 5, 1), folderId: "images",
    sharedWith: [], lastAccessed: new Date(Date.now() - 72 * 3600000),
  },
  {
    id: "f9", name: "Training Module Recording.mp4", type: "MP4", extension: "mp4",
    size: "210.4 MB", sizeBytes: 220596838, modified: "May 25, 2025",
    modifiedDate: new Date(2025, 4, 25), folderId: "videos",
    sharedWith: ["JL"], lastAccessed: new Date(Date.now() - 96 * 3600000),
  },
  {
    id: "f10", name: "Donor Thank You Letter.docx", type: "DOCX", extension: "docx",
    size: "412 KB", sizeBytes: 421888, modified: "Jun 7, 2025",
    modifiedDate: new Date(2025, 5, 7), folderId: "shared",
    sharedWith: ["MR", "AS", "JL"], lastAccessed: new Date(Date.now() - 8 * 3600000),
  },
  {
    id: "f11", name: "Website Analytics Export.csv", type: "CSV", extension: "csv",
    size: "198 KB", sizeBytes: 202752, modified: "Jun 11, 2025",
    modifiedDate: new Date(2025, 5, 11), folderId: "documents",
    sharedWith: [], lastAccessed: new Date(Date.now() - 4 * 3600000),
  },
  {
    id: "f12", name: "Board Meeting Minutes.pdf", type: "PDF", extension: "pdf",
    size: "680 KB", sizeBytes: 696320, modified: "Jun 6, 2025",
    modifiedDate: new Date(2025, 5, 6), folderId: "shared",
    sharedWith: ["KT", "AS"], lastAccessed: new Date(Date.now() - 12 * 3600000),
  },
];

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
    case "png": case "jpg": case "jpeg": case "gif": case "webp": return <Image className={`${cls} text-purple-500`} />;
    case "mp4": case "mov": case "avi": return <Video className={`${cls} text-orange-500`} />;
    case "mp3": case "wav": case "aac": return <Music className={`${cls} text-pink-500`} />;
    case "zip": case "rar": case "7z": return <Archive className={`${cls} text-amber-600`} />;
    default: return <File className={`${cls} ${baseColor}`} />;
  }
}

function getTypeBadgeColor(ext: string): string {
  switch (ext) {
    case "pdf": return "bg-red-50 text-red-700 border-red-200";
    case "docx": return "bg-blue-50 text-blue-700 border-blue-200";
    case "xlsx": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "csv": return "bg-teal-50 text-teal-700 border-teal-200";
    case "png": case "jpg": return "bg-purple-50 text-purple-700 border-purple-200";
    case "mp4": return "bg-orange-50 text-orange-700 border-orange-200";
    case "zip": return "bg-amber-50 text-amber-700 border-amber-200";
    default: return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `Opened ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Opened ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Opened ${days}d ago`;
  return `Opened ${days}d ago`;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function MediaLibraryPage() {
  // ─── Dark Mode ───
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const theme = localStorage.getItem("insight_theme");
    setIsDark(theme === "dark");
    const handler = () => setIsDark(localStorage.getItem("insight_theme") === "dark");
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // ─── Folder State ───
  const [folders, setFolders] = useState<Record<string, FolderNode>>(INITIAL_FOLDERS);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["my-files"]));
  const [selectedFolder, setSelectedFolder] = useState("my-files");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderRef = useRef<HTMLInputElement>(null);

  // ─── File State ───
  const [files] = useState<FileItem[]>(MOCK_FILES);
  const [sortKey, setSortKey] = useState<SortKey>("modified");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Toast State ───
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // ─── Close context menu on click outside ───
  useEffect(() => {
    const handler = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener("click", handler);
      return () => window.removeEventListener("click", handler);
    }
  }, [contextMenu]);

  // ─── Auto-focus new folder input ───
  useEffect(() => {
    if (creatingFolder && newFolderRef.current) newFolderRef.current.focus();
  }, [creatingFolder]);

  // ─── Folder Helpers ───
  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, folderId });
  };

  const handleContextAction = (action: string) => {
    if (!contextMenu) return;
    const folder = folders[contextMenu.folderId];
    console.log(`[MediaLibrary] ${action} → ${folder?.name}`);
    showToast(`${action}: ${folder?.name}`);
    setContextMenu(null);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) { setCreatingFolder(false); return; }
    const id = `folder-${Date.now()}`;
    const newFolder: FolderNode = {
      id,
      name: newFolderName.trim(),
      parentId: "my-files",
      children: [],
      itemCount: 0,
    };
    setFolders((prev) => ({
      ...prev,
      [id]: newFolder,
      "my-files": { ...prev["my-files"], children: [...prev["my-files"].children, id] },
    }));
    setNewFolderName("");
    setCreatingFolder(false);
    showToast(`Created folder: ${newFolder.name}`);
  };

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

  const recentFiles = useMemo(() => {
    return [...files].sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime()).slice(0, 6);
  }, [files]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  // ─── Theme Classes ───
  const bg = isDark ? "bg-slate-950" : "bg-[#fefcf6]";
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

  /* ═══════════════════════════════════════════════════════════════
     RENDER — FOLDER TREE (LEFT PANEL)
     ═══════════════════════════════════════════════════════════════ */

  const renderFolderNode = (folderId: string, depth: number = 0) => {
    const folder = folders[folderId];
    if (!folder) return null;
    const isExpanded = expandedFolders.has(folderId);
    const isSelected = selectedFolder === folderId;
    const hasChildren = folder.children.length > 0;

    return (
      <div key={folderId}>
        <button
          onClick={() => { setSelectedFolder(folderId); if (hasChildren) toggleFolder(folderId); }}
          onContextMenu={(e) => handleContextMenu(e, folderId)}
          className={`w-full flex items-center gap-2 px-3 py-[7px] text-[13px] font-medium transition-all rounded-md cursor-pointer group ${
            isSelected
              ? `${activeBg} ${textPrimary} font-semibold`
              : `${textSecondary} ${hoverBg}`
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {/* Expand/Collapse Chevron */}
          {hasChildren ? (
            <span className={`shrink-0 ${textMuted}`}>
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}

          {/* Folder Icon */}
          {isExpanded && hasChildren ? (
            <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
          ) : folderId === "trash" ? (
            <Trash2 className="w-4 h-4 text-slate-400 shrink-0" />
          ) : folderId === "shared" ? (
            <Share2 className="w-4 h-4 text-indigo-400 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
          )}

          {/* Name + Count */}
          <span className="truncate flex-1 text-left">{folder.name}</span>
          <span className={`text-[10px] font-semibold tabular-nums shrink-0 ${textMuted}`}>
            {folder.itemCount > 0 ? folder.itemCount : ""}
          </span>
        </button>

        {/* Children */}
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
    <div className={`flex h-full w-full ${bg} overflow-hidden rounded-xl border ${borderColor}`}>
      {/* ───── LEFT PANEL: FOLDER TREE ───── */}
      <aside className={`w-[240px] shrink-0 flex flex-col ${bgSidebar} border-r ${borderColor}`}>
        {/* Sidebar Header */}
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

        {/* Folder Tree */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {/* Root-level folders */}
          {renderFolderNode("my-files")}

          {/* New folder inline input */}
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
                onBlur={handleCreateFolder}
                placeholder="Folder name..."
                className={`flex-1 px-2 py-1 text-[12px] rounded border outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 ${inputBg}`}
              />
            </div>
          )}

          <div className={`my-3 mx-3 border-t ${borderColor}`} />
          {renderFolderNode("shared")}
          {renderFolderNode("trash")}
        </nav>

        {/* Storage Indicator */}
        <div className={`px-4 py-3 border-t ${borderColor}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>Storage Used</span>
            <span className={`text-[10px] font-bold ${textTertiary}`}>2.4 GB / 15 GB</span>
          </div>
          <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
            <div className="h-full rounded-full bg-indigo-500" style={{ width: "16%" }} />
          </div>
        </div>
      </aside>

      {/* ───── RIGHT PANEL: MAIN CONTENT ───── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className={`h-14 flex items-center justify-between px-6 border-b ${borderColor} shrink-0`}>
          <div className="flex items-center gap-2">
            <h2 className={`text-[15px] font-bold ${textPrimary}`}>
              {folders[selectedFolder]?.name || "All Files"}
            </h2>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isDark ? "bg-slate-800 text-slate-400" : "bg-stone-200/80 text-slate-500"}`}>
              {filteredFiles.length} items
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
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

            {/* Upload Button */}
            <button
              onClick={() => showToast("Upload functionality coming soon")}
              className="flex items-center gap-1.5 px-3 py-[7px] rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── RECENTLY ACCESSED ── */}
          {selectedFolder === "my-files" && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock className={`w-4 h-4 ${textMuted}`} />
                <h3 className={`text-[13px] font-bold uppercase tracking-wider ${textTertiary}`}>Recently Accessed</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {recentFiles.map((file) => (
                  <div
                    key={file.id}
                    className={`group rounded-xl border overflow-hidden transition-all hover:shadow-md cursor-pointer ${cardBg} ${cardBorder} hover:border-indigo-300`}
                  >
                    {/* Thumbnail */}
                    <div className={`h-[84px] flex items-center justify-center ${thumbnailBg}`}>
                      {getFileIcon(file.extension, 8, isDark)}
                    </div>
                    {/* Info */}
                    <div className="px-2.5 py-2">
                      <p className={`text-[11px] font-semibold truncate leading-tight ${textPrimary}`}>{file.name}</p>
                      <p className={`text-[9px] mt-0.5 ${textMuted}`}>{getRelativeTime(file.lastAccessed)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── ALL FILES TABLE ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <File className={`w-4 h-4 ${textMuted}`} />
                <h3 className={`text-[13px] font-bold uppercase tracking-wider ${textTertiary}`}>
                  All Files
                </h3>
                <span className={`text-[11px] font-semibold ${textMuted}`}>
                  ({sortedFiles.length})
                </span>
              </div>
            </div>

            <div className={`border rounded-xl overflow-hidden ${cardBorder}`}>
              {/* Table Header */}
              <div className={`grid grid-cols-[1fr_80px_90px_120px_100px] ${tableHeaderBg} text-[11px] font-bold uppercase tracking-wider ${textTertiary}`}>
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
              </div>

              {/* Table Body */}
              {sortedFiles.length === 0 ? (
                <div className={`px-6 py-12 text-center ${textMuted} text-sm`}>
                  {searchQuery ? "No files match your search." : "This folder is empty."}
                </div>
              ) : (
                sortedFiles.map((file, idx) => (
                  <div
                    key={file.id}
                    className={`grid grid-cols-[1fr_80px_90px_120px_100px] text-[13px] border-t ${borderColor} ${rowHover} transition-colors cursor-pointer group`}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      {getFileIcon(file.extension, 4, isDark)}
                      <span className={`font-semibold truncate ${textPrimary}`}>{file.name}</span>
                    </div>

                    {/* Type Badge */}
                    <div className="flex items-center px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${
                        isDark
                          ? "bg-slate-800 text-slate-300 border-slate-600"
                          : getTypeBadgeColor(file.extension)
                      }`}>
                        {file.type}
                      </span>
                    </div>

                    {/* Size */}
                    <div className={`flex items-center px-3 text-[12px] ${textTertiary} tabular-nums`}>
                      {file.size}
                    </div>

                    {/* Modified */}
                    <div className={`flex items-center px-3 text-[12px] ${textTertiary}`}>
                      {file.modified}
                    </div>

                    {/* Shared */}
                    <div className="flex items-center px-3">
                      {file.sharedWith.length > 0 ? (
                        <div className="flex -space-x-1.5">
                          {file.sharedWith.slice(0, 3).map((initials, i) => (
                            <div
                              key={i}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 ${
                                isDark
                                  ? "bg-slate-700 text-slate-300 border-slate-900"
                                  : "bg-indigo-100 text-indigo-700 border-white"
                              }`}
                            >
                              {initials}
                            </div>
                          ))}
                          {file.sharedWith.length > 3 && (
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 ${
                              isDark
                                ? "bg-slate-600 text-slate-400 border-slate-900"
                                : "bg-slate-200 text-slate-500 border-white"
                            }`}>
                              +{file.sharedWith.length - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className={`text-[12px] ${textMuted}`}>—</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {/* ───── CONTEXT MENU ───── */}
      {contextMenu && (
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
                onClick={() => handleContextAction(action)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer ${textSecondary} ${contextHover}`}
              >
                <Icon className={`w-4 h-4 ${textMuted}`} />
                {label}
              </button>
            ))}
            <div className={`my-1 mx-3 border-t ${isDark ? "border-slate-600" : "border-slate-200"}`} />
            <button
              onClick={() => handleContextAction("Delete")}
              className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer text-red-500 ${contextHover}`}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}

      {/* ───── TOAST ───── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] animate-in fade-in slide-in-from-bottom-4">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-[13px] font-semibold ${
            isDark
              ? "bg-slate-800 border-slate-600 text-slate-200"
              : "bg-white border-slate-200 text-slate-700"
          }`}>
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
