"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Image as ImageIcon,
  Video,
  LayoutGrid,
  CheckCircle2,
  Upload,
  X,
  Loader2,
  ImagePlus,
  Film,
  Sparkles,
  MousePointerClick,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, initializeFirebase } from "@/firebase";
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useInstagramStore, type MediaItem } from "@/stores/instagramStore";
import CaptionEditor from "./CaptionEditor";
import CampaignPlanner from "./CampaignPlanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MediaFilter = "all" | "images" | "videos";
type MediaSource = "all" | "library" | "uploads";

/** Shape of a media asset document in Firestore. */
interface MediaAsset {
  id: string;
  name: string;
  url: string;
  type: "image" | "video";
  storagePath: string;
  sizeBytes: number;
  createdAt: Date;
  /** Where this asset came from — "library" = dashboard Media Library, "upload" = Instagram direct upload */
  source: "library" | "upload";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CAROUSEL_ITEMS = 10;

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "avi", "webm"]);
const ALL_MEDIA_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);

function getMediaType(filename: string): "image" | "video" {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "image";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WorkspaceLayoutProps {
  orgId: string;
}

export default function WorkspaceLayout({ orgId }: WorkspaceLayoutProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  // Dark mode
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("insight_theme");
    if (saved === "dark") setIsDark(true);
    const handler = (e: StorageEvent) => {
      if (e.key === "insight_theme") setIsDark(e.newValue === "dark");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Zustand store
  const selectedMedia = useInstagramStore((s) => s.selectedMedia);
  const toggleMediaSelection = useInstagramStore((s) => s.toggleMediaSelection);
  const clearSelectedMedia = useInstagramStore((s) => s.clearSelectedMedia);

  // Local state
  const [igAssets, setIgAssets] = useState<MediaAsset[]>([]);
  const [libraryAssets, setLibraryAssets] = useState<MediaAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [mediaSource, setMediaSource] = useState<MediaSource>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // Firestore: load Instagram direct uploads
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!firestore || !user?.uid) return;
    setAssetsLoading(true);

    const colRef = collection(firestore, `users/${user.uid}/instagram_media`);
    const unsub = onSnapshot(colRef, (snap) => {
      const loaded: MediaAsset[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: `ig_${d.id}`,
          name: data.name || "Untitled",
          url: data.url || "",
          type: data.type || "image",
          storagePath: data.storagePath || "",
          sizeBytes: data.sizeBytes || 0,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          source: "upload" as const,
        };
      });
      loaded.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setIgAssets(loaded);
      setAssetsLoading(false);
    });

    return () => unsub();
  }, [firestore, user?.uid]);

  // ---------------------------------------------------------------------------
  // Firestore: load from dashboard Media Library (images & videos only)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const colRef = collection(firestore, `users/${user.uid}/media_library_files`);
    const unsub = onSnapshot(colRef, (snap) => {
      const loaded: MediaAsset[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        const ext = (data.extension || "").toLowerCase();

        // Only include image and video files
        if (!ALL_MEDIA_EXTENSIONS.has(ext)) continue;

        // The Media Library may store a content URL or a Storage URL
        // Use whatever URL-like field is available
        const url = data.url || data.downloadUrl || data.storageUrl || data.content || "";

        loaded.push({
          id: `lib_${d.id}`,
          name: data.name || "Untitled",
          url,
          type: VIDEO_EXTENSIONS.has(ext) ? "video" : "image",
          storagePath: data.storagePath || "",
          sizeBytes: data.sizeBytes || 0,
          createdAt: data.modifiedDate?.toDate?.() || new Date(data.modifiedDate || Date.now()),
          source: "library" as const,
        });
      }
      loaded.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setLibraryAssets(loaded);
    });

    return () => unsub();
  }, [firestore, user?.uid]);

  // ---------------------------------------------------------------------------
  // Merged + filtered assets
  // ---------------------------------------------------------------------------

  const allAssets = useMemo(() => {
    const merged = [...igAssets, ...libraryAssets];
    merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return merged;
  }, [igAssets, libraryAssets]);

  const filteredAssets = useMemo(() => {
    let result = allAssets;

    // Source filter
    if (mediaSource === "library") result = result.filter((a) => a.source === "library");
    if (mediaSource === "uploads") result = result.filter((a) => a.source === "upload");

    // Type filter
    if (filter === "images") result = result.filter((a) => a.type === "image");
    if (filter === "videos") result = result.filter((a) => a.type === "video");

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q));
    }

    return result;
  }, [allAssets, filter, mediaSource, searchQuery]);

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  const isSelected = useCallback(
    (assetId: string) => selectedMedia.some((m) => m.id === assetId),
    [selectedMedia]
  );

  const selectionIndex = useCallback(
    (assetId: string) => selectedMedia.findIndex((m) => m.id === assetId),
    [selectedMedia]
  );

  const handleToggle = (asset: MediaAsset) => {
    if (!isSelected(asset.id) && selectedMedia.length >= MAX_CAROUSEL_ITEMS) return;
    const item: MediaItem = { id: asset.id, url: asset.url, type: asset.type };
    toggleMediaSelection(item);
  };

  // ---------------------------------------------------------------------------
  // Upload handler
  // ---------------------------------------------------------------------------

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user?.uid || !firestore) return;

    const { storage } = initializeFirebase();
    if (!storage) return;

    for (const file of Array.from(files)) {
      try {
        const mediaType = getMediaType(file.name);
        const path = `instagram_media/${user.uid}/${Date.now()}_${file.name}`;
        const sRef = storageRef(storage, path);
        const uploadTask = uploadBytesResumable(sRef, file);

        setUploadProgress(0);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const pct = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              setUploadProgress(pct);
            },
            (error) => {
              console.error("[Instagram Media Upload] Error:", error);
              setUploadProgress(null);
              reject(error);
            },
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              await addDoc(
                collection(firestore, `users/${user.uid}/instagram_media`),
                {
                  name: file.name,
                  url,
                  type: mediaType,
                  storagePath: path,
                  sizeBytes: file.size,
                  createdAt: serverTimestamp(),
                }
              );
              setUploadProgress(null);
              resolve();
            }
          );
        });
      } catch (err) {
        console.error(`[Instagram Media Upload] Skipping failed file "${file.name}":`, err);
        setUploadProgress(null);
        continue;
      }
    }

    // Reset input
    e.target.value = "";
  };

  // ---------------------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------------------

  const handleDeleteAsset = async (e: React.MouseEvent, asset: MediaAsset) => {
    e.stopPropagation(); // Don't trigger selection
    if (!firestore || !user?.uid) return;

    try {
      if (asset.source === 'upload') {
        // Delete from instagram_media collection
        const realId = asset.id.replace(/^ig_/, '');
        await deleteDoc(doc(firestore, `users/${user.uid}/instagram_media`, realId));
      }
      // Also deselect if selected
      if (isSelected(asset.id)) {
        const item: MediaItem = { id: asset.id, url: asset.url, type: asset.type };
        toggleMediaSelection(item);
      }
    } catch (err) {
      console.error('[Instagram Media] Delete failed:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Style helpers
  // ---------------------------------------------------------------------------

  const bg = isDark ? "bg-slate-950" : "bg-slate-50/50";
  const cardBg = isDark ? "bg-slate-900" : "bg-white";
  const border = isDark ? "border-slate-800" : "border-slate-200";
  const headerBorder = isDark ? "border-slate-800" : "border-slate-100";
  const textPrimary = isDark ? "text-slate-200" : "text-slate-800";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const textMuted = isDark ? "text-slate-600" : "text-slate-400";
  const inputBg = isDark
    ? "bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
    : "bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400";

  // ---------------------------------------------------------------------------
  // Filter tabs
  // ---------------------------------------------------------------------------

  const filters: { id: MediaFilter; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: "All", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { id: "images", label: "Images", icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { id: "videos", label: "Videos", icon: <Video className="w-3.5 h-3.5" /> },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={`w-full h-full flex flex-col lg:flex-row ${bg}`}>
      {/* ════════════════════════════════════════════════════════════════
         LEFT COLUMN — Media Library Selector (1/3 – 2/5)
         ════════════════════════════════════════════════════════════════ */}
      <div
        className={`w-full lg:w-[30%] xl:w-[28%] flex flex-col border-b lg:border-b-0 lg:border-r ${border} max-h-[50vh] lg:max-h-full`}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className={`shrink-0 px-4 py-3.5 border-b ${headerBorder}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ImagePlus className={`w-4 h-4 ${isDark ? "text-pink-400" : "text-pink-500"}`} />
              <h2 className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>
                Media Library
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {selectedMedia.length > 0 && (
                <button
                  onClick={clearSelectedMedia}
                  className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                    isDark ? "text-slate-400 hover:bg-slate-800" : "text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
              <label
                className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  isDark
                    ? "text-pink-400 bg-pink-500/10 hover:bg-pink-500/20"
                    : "text-pink-600 bg-pink-50 hover:bg-pink-100"
                }`}
              >
                <Upload className="w-3 h-3" />
                Upload
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${textMuted}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search media…"
              className={`w-full pl-9 pr-3 py-2 text-xs rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-pink-300/40 focus:border-pink-400 ${inputBg}`}
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  filter === f.id
                    ? isDark
                      ? "bg-pink-500/20 text-pink-400"
                      : "bg-pink-50 text-pink-600 shadow-sm"
                    : isDark
                    ? "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
            {selectedMedia.length > 0 && (
              <Badge className="ml-auto bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0 text-[10px]">
                {selectedMedia.length}/{MAX_CAROUSEL_ITEMS}
              </Badge>
            )}
          </div>

          {/* Source tabs */}
          <div className="flex gap-1 mt-2">
            {([
              { id: "all" as MediaSource, label: "All Sources", icon: <LayoutGrid className="w-3 h-3" /> },
              { id: "library" as MediaSource, label: "Library", icon: <FolderOpen className="w-3 h-3" /> },
              { id: "uploads" as MediaSource, label: "Uploads", icon: <Upload className="w-3 h-3" /> },
            ]).map((s) => (
              <button
                key={s.id}
                onClick={() => setMediaSource(s.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  mediaSource === s.id
                    ? isDark
                      ? "bg-indigo-500/20 text-indigo-400"
                      : "bg-indigo-50 text-indigo-600 shadow-sm"
                    : isDark
                    ? "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Upload progress bar ─────────────────────────────────── */}
        <AnimatePresence>
          {uploadProgress !== null && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`shrink-0 px-4 py-2 border-b ${headerBorder}`}
            >
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-pink-500 animate-spin" />
                <span className={`text-[11px] font-medium ${textSecondary}`}>
                  Uploading… {uploadProgress}%
                </span>
              </div>
              <div className={`mt-1.5 h-1 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Media Grid ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-3">
          {assetsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className={`w-5 h-5 animate-spin ${textMuted}`} />
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <ImageIcon className={`w-8 h-8 mb-2 ${textMuted}`} />
              <p className={`text-xs font-medium ${textSecondary}`}>
                {searchQuery ? "No media matches your search." : "No media found."}
              </p>
              <p className={`text-[11px] mt-1 ${textMuted}`}>
                Upload images/videos or add them to your Media Library.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
              {filteredAssets.map((asset) => {
                const selected = isSelected(asset.id);
                const idx = selectionIndex(asset.id);
                const atLimit = selectedMedia.length >= MAX_CAROUSEL_ITEMS && !selected;

                return (
                  <motion.button
                    key={asset.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={!atLimit ? { scale: 1.03 } : {}}
                    whileTap={!atLimit ? { scale: 0.97 } : {}}
                    onClick={() => handleToggle(asset)}
                    disabled={atLimit}
                    className={`
                      group relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-150 cursor-pointer
                      ${selected
                        ? "border-pink-500 shadow-lg shadow-pink-500/20 ring-2 ring-pink-500/30"
                        : atLimit
                        ? `${isDark ? "border-slate-800 opacity-40" : "border-slate-100 opacity-40"} cursor-not-allowed`
                        : isDark
                        ? "border-slate-800 hover:border-slate-600"
                        : "border-slate-200 hover:border-slate-300"
                      }
                    `}
                  >
                    {/* Thumbnail */}
                    {asset.type === "image" ? (
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                        <Film className={`w-8 h-8 ${isDark ? "text-slate-600" : "text-slate-300"}`} />
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div
                      className={`absolute inset-0 transition-opacity ${
                        selected
                          ? "bg-pink-500/10"
                          : "bg-black/0 group-hover:bg-black/20"
                      }`}
                    />

                    {/* Delete button on hover (uploads only, not when selected) */}
                    {asset.source === "upload" && !selected && (
                      <button
                        onClick={(e) => handleDeleteAsset(e, asset)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    )}

                    {/* Selection badge */}
                    {selected && (
                      <div className="absolute top-1.5 right-1.5">
                        <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center shadow-md">
                          {selectedMedia.length > 1 ? (
                            <span className="text-[10px] font-bold text-white">
                              {idx + 1}
                            </span>
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Type badge for videos */}
                    {asset.type === "video" && !selected && (
                      <div className="absolute top-1.5 left-1.5">
                        <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${isDark ? "bg-slate-900/80 text-slate-300" : "bg-white/80 text-slate-600"}`}>
                          Video
                        </div>
                      </div>
                    )}

                    {/* File name on hover */}
                    <div className="absolute bottom-0 inset-x-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className={`px-2 py-1.5 flex items-center justify-between ${isDark ? "bg-slate-900/90 text-slate-300" : "bg-white/90 text-slate-700"}`}>
                        <span className="text-[10px] font-medium truncate">{asset.name}</span>
                        {asset.source === "library" && (
                          <span className={`shrink-0 ml-1 text-[7px] font-bold uppercase px-1 py-0.5 rounded ${isDark ? "bg-indigo-500/30 text-indigo-300" : "bg-indigo-100 text-indigo-600"}`}>
                            Library
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
         RIGHT COLUMN — Editor Workspace (2/3 – 3/5)
         ════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {selectedMedia.length === 0 ? (
          /* ── Empty state ──────────────────────────────────────────── */
          <div className="flex-1 flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center max-w-sm"
            >
              <div
                className={`w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center ${
                  isDark ? "bg-slate-800" : "bg-slate-100"
                }`}
              >
                <MousePointerClick className={`w-7 h-7 ${isDark ? "text-slate-600" : "text-slate-300"}`} />
              </div>
              <h3 className={`text-lg font-bold mb-2 ${textPrimary}`}>
                Select Media to Begin
              </h3>
              <p className={`text-sm leading-relaxed ${textSecondary}`}>
                Please select images or videos from your library on the left to
                start building your campaign post.
              </p>
              <div className={`mt-6 flex items-center justify-center gap-4 text-[11px] ${textMuted}`}>
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Images</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5" />
                  <span>Videos</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <span>Up to {MAX_CAROUSEL_ITEMS} items</span>
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          /* ── Active workspace ─────────────────────────────────────── */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col"
          >
            {/* Workspace header */}
            <div className={`shrink-0 px-6 py-4 border-b ${headerBorder} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <Sparkles className={`w-4 h-4 ${isDark ? "text-pink-400" : "text-pink-500"}`} />
                <h2 className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>
                  Creative Editor
                </h2>
                <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0 text-[10px]">
                  {selectedMedia.length} {selectedMedia.length === 1 ? "item" : "items"} selected
                </Badge>
              </div>
            </div>

            {/* Selected media preview strip */}
            <div className={`shrink-0 px-6 py-3 border-b ${headerBorder}`}>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedMedia.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-pink-500/50 group`}
                  >
                    {item.type === "image" ? (
                      <img
                        src={item.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                        <Film className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    {/* Order badge */}
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-pink-500 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-white">{idx + 1}</span>
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={() => toggleMediaSelection(item)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Editor & schedule components */}
            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
              {/* AI Caption Editor */}
              <CaptionEditor isDark={isDark} />

              {/* Campaign Scheduler */}
              <CampaignPlanner isDark={isDark} clientId={orgId} />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
