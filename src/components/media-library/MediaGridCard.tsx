"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  Archive,
  Table,
  File,
  Play,
  Check,
  MoreVertical,
  Code2,
  Presentation,
  AlertTriangle,
  X,
} from "lucide-react";

export interface MediaCardItem {
  id: string;
  name: string;
  type: string;
  extension: string;
  size: string;
  sizeBytes?: number;
  modified?: string;
  modifiedDate?: Date;
  downloadUrl?: string;
  thumbnailUrl?: string;
  dimensions?: string;
  pageCount?: number;
  content?: string;
  status?: "processing" | "ready" | "error";
  uploadedBy?: string;
  uploadedByEmail?: string;
  sharedWith?: Array<{ uid?: string; email: string; displayName: string; initials: string }>;
}

interface MediaGridCardProps {
  item: MediaCardItem;
  isSelected?: boolean;
  onSelect?: (id: string, e: React.MouseEvent) => void;
  onClick?: (item: MediaCardItem) => void;
  onDoubleClick?: (item: MediaCardItem) => void;
  onContextMenu?: (item: MediaCardItem, e: React.MouseEvent) => void;
  onDelete?: (item: MediaCardItem) => void;
  onDownload?: (item: MediaCardItem) => void;
  onShare?: (item: MediaCardItem) => void;
  onCancelUpload?: (item: MediaCardItem) => void;
  isDark?: boolean;
  extraBadge?: React.ReactNode;
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "tiff"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "avi", "mkv"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "m4a", "flac", "aac"]);
const DOC_EXTS = new Set(["pdf", "doc", "docx", "txt", "rtf", "md", "odt"]);
const CODE_EXTS = new Set([
  "py", "js", "jsx", "ts", "tsx", "java", "c", "cpp", "h", "cs", "go", "rs",
  "rb", "php", "swift", "kt", "sh", "bat", "ps1", "sql", "r", "lua", "pl",
  "html", "css", "scss", "less", "json", "xml", "yaml", "yml", "toml", "ini",
  "env", "log", "conf", "cfg",
]);
const TABLE_EXTS = new Set(["xls", "xlsx", "csv", "ods"]);
const ARCHIVE_EXTS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2"]);
const PRES_EXTS = new Set(["ppt", "pptx", "odp"]);
// Proprietary formats we cannot parse/preview
const UNSUPPORTED_EXTS = new Set(["pages", "numbers", "key"]);

export default function MediaGridCard({
  item,
  isSelected = false,
  onSelect,
  onClick,
  onDoubleClick,
  onContextMenu,
  onDelete,
  onDownload,
  onShare,
  onCancelUpload,
  isDark = false,
  extraBadge,
}: MediaGridCardProps) {
  const ext = (item.extension || item.name.split(".").pop() || "txt").toLowerCase();
  const isImage = IMAGE_EXTS.has(ext);
  const isVideo = VIDEO_EXTS.has(ext);
  const isAudio = AUDIO_EXTS.has(ext);
  const isDoc = DOC_EXTS.has(ext);
  const isCode = CODE_EXTS.has(ext);
  const isTable = TABLE_EXTS.has(ext);
  const isArchive = ARCHIVE_EXTS.has(ext);
  const isPres = PRES_EXTS.has(ext);
  const isUnsupported = UNSUPPORTED_EXTS.has(ext);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [detectedDimensions, setDetectedDimensions] = useState<string | null>(item.dimensions || null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Handle Video Hover Auto-play
  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    if (isHovered) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlayingVideo(true))
          .catch(() => {
            // Auto-play was prevented by browser policy
            setIsPlayingVideo(false);
          });
      }
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlayingVideo(false);
    }
  }, [isHovered, isVideo]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageLoaded(true);
    // Only detect dimensions from the full-size image, not from a scaled thumbnail
    if (!detectedDimensions && img.naturalWidth && img.naturalHeight && !item.thumbnailUrl) {
      setDetectedDimensions(`${img.naturalWidth} × ${img.naturalHeight}`);
    }
  };

  const getSubtext = () => {
    if (detectedDimensions) return detectedDimensions;
    if (item.pageCount) return `${item.pageCount} ${item.pageCount === 1 ? "page" : "pages"}`;
    if (item.modified) return item.modified;
    return null;
  };

  const getTypeIcon = (size = "w-3.5 h-3.5") => {
    const cls = size;
    if (isImage) return <ImageIcon className={`${cls} text-purple-500`} />;
    if (isVideo) return <VideoIcon className={`${cls} text-orange-500`} />;
    if (isDoc && ext === "pdf") return <FileText className={`${cls} text-red-500`} />;
    if (isDoc && ext === "docx") return <FileText className={`${cls} text-blue-500`} />;
    if (isDoc) return <FileText className={`${cls} text-indigo-500`} />;
    if (isCode) return <Code2 className={`${cls} text-cyan-500`} />;
    if (isTable) return <Table className={`${cls} text-emerald-500`} />;
    if (isAudio) return <Music className={`${cls} text-pink-500`} />;
    if (isArchive) return <Archive className={`${cls} text-amber-600`} />;
    if (isPres) return <Presentation className={`${cls} text-orange-500`} />;
    if (isUnsupported) return <AlertTriangle className={`${cls} text-yellow-500`} />;
    return <File className={`${cls} text-slate-400`} />;
  };

  const cardBorder = isSelected
    ? "ring-2 ring-orange-500 border-orange-500 shadow-md shadow-orange-500/10"
    : isDark
    ? "border-slate-800 hover:border-slate-600 hover:shadow-lg hover:shadow-black/40"
    : "border-[#ede8da] hover:border-indigo-300 hover:shadow-md hover:shadow-slate-200/60";

  const cardBg = isDark ? "bg-slate-900" : "bg-white";
  const previewBg = isDark ? "bg-slate-950/60" : "bg-slate-100/70";
  const textTitle = isDark ? "text-slate-200" : "text-slate-800";
  const textMeta = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div
      onClick={() => onClick?.(item)}
      onDoubleClick={() => onDoubleClick?.(item)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(item, e);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex flex-col rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer select-none ${cardBg} ${cardBorder}`}
    >
      {/* ───── PREVIEW CONTAINER (Top Aspect Ratio Area) ───── */}
      <div className={`relative w-full aspect-[16/10] sm:aspect-[4/3] overflow-hidden flex items-center justify-center ${previewBg}`}>
        {/* ── Selection Circle (Top Left) ── */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(item.id, e);
          }}
          className={`absolute top-2.5 left-2.5 z-20 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
            isSelected
              ? `bg-orange-500 text-white shadow-sm ring-2 ${isDark ? "ring-slate-900" : "ring-white/90"}`
              : `border-2 ${isDark ? "border-slate-400" : "border-white/90"} bg-black/25 backdrop-blur-sm opacity-75 group-hover:opacity-100 hover:scale-110 hover:border-white hover:bg-black/50`
          }`}
          title={isSelected ? "Deselect" : "Select"}
        >
          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
        </button>

        {/* ── Optional Status Badge (Top Right) ── */}
        {item.status === "processing" && (
          <div className="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/90 text-white backdrop-blur-sm animate-pulse flex items-center gap-1 shadow-sm">
            <span>Processing...</span>
          </div>
        )}

        {extraBadge && (
          <div className="absolute top-2.5 right-2.5 z-20">
            {extraBadge}
          </div>
        )}

        {/* ── Cancel Upload Overlay Button ── */}
        {onCancelUpload && (
          <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-3 animate-in fade-in duration-200">
            <span className="w-5 h-5 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin mb-2" />
            <span className="text-[11px] font-semibold text-white/90 mb-2 tracking-tight text-center truncate max-w-full">
              Uploading...
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelUpload(item);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Cancel this upload"
            >
              <X className="w-3.5 h-3.5" />
              Cancel upload
            </button>
          </div>
        )}

        {/* ── Image Preview ── */}
        {isImage && item.downloadUrl && !imageError && (
          <img
            src={item.thumbnailUrl || item.downloadUrl}
            alt={item.name}
            loading="lazy"
            onLoad={handleImageLoad}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}

        {/* ── Video Preview with Hover Auto-play ── */}
        {isVideo && item.downloadUrl && (
          <>
            <video
              ref={videoRef}
              src={item.downloadUrl}
              muted
              loop
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
            {/* Centered Play Button Overlay */}
            <div
              className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
                isPlayingVideo ? "opacity-0" : "opacity-100"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white shadow-lg transform transition-transform group-hover:scale-110">
                <Play className="w-4 h-4 fill-white translate-x-0.5" />
              </div>
            </div>
          </>
        )}

        {/* ── Document / Text Preview (Realistic Paper Sheet Mockup) ── */}
        {isDoc && (
          <div className="w-full h-full p-4 flex items-center justify-center">
            <div
              className={`w-3/4 h-[85%] rounded-md shadow-sm border p-3 flex flex-col justify-between transition-transform duration-300 group-hover:-translate-y-1 ${
                isDark
                  ? "bg-slate-800/90 border-slate-700 shadow-black/40"
                  : "bg-white border-slate-200 shadow-slate-200"
              }`}
            >
              <div className="space-y-1.5 overflow-hidden">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className={`w-3.5 h-3.5 shrink-0 ${ext === "pdf" ? "text-red-500" : "text-blue-500"}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${textMeta}`}>
                    {ext}
                  </span>
                </div>
                {item.content ? (
                  <p className={`text-[9px] line-clamp-4 leading-relaxed font-serif ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    {item.content.replace(/<[^>]*>/g, "").substring(0, 140)}
                  </p>
                ) : (
                  <>
                    <div className={`h-1.5 w-5/6 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
                    <div className={`h-1.5 w-full rounded-full ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
                    <div className={`h-1.5 w-4/6 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
                    <div className={`h-1.5 w-3/4 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
                  </>
                )}
              </div>
              <div className={`text-[9px] font-medium pt-1 border-t ${isDark ? "border-slate-700 text-slate-500" : "border-slate-100 text-slate-400"}`}>
                {item.size || "Document"}
              </div>
            </div>
          </div>
        )}
        {/* ── Code / Script Preview (styled like a code editor) ── */}
        {isCode && (
          <div className="w-full h-full p-3 flex items-center justify-center">
            <div
              className={`w-full h-full rounded-lg border overflow-hidden flex flex-col transition-transform duration-300 group-hover:-translate-y-1 ${
                isDark
                  ? "bg-slate-950 border-slate-700 shadow-black/40"
                  : "bg-slate-900 border-slate-700 shadow-slate-400/30"
              } shadow-sm`}
            >
              {/* Mini title bar */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-slate-700/60">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400/80" />
                  <div className="w-2 h-2 rounded-full bg-yellow-400/80" />
                  <div className="w-2 h-2 rounded-full bg-green-400/80" />
                </div>
                <span className="text-[9px] text-slate-500 font-mono truncate ml-1">{item.name}</span>
              </div>
              {/* Code content */}
              <div className="flex-1 px-2.5 py-1.5 overflow-hidden">
                {item.content ? (
                  <pre className="text-[8px] leading-relaxed font-mono text-cyan-300/80 whitespace-pre-wrap break-all">
                    {item.content.replace(/<[^>]*>/g, "").substring(0, 200)}
                  </pre>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    <div className="h-1.5 w-4/6 rounded bg-cyan-500/20" />
                    <div className="h-1.5 w-full rounded bg-slate-700/60" />
                    <div className="h-1.5 w-5/6 rounded bg-purple-500/15" />
                    <div className="h-1.5 w-3/5 rounded bg-slate-700/60" />
                    <div className="h-1.5 w-4/5 rounded bg-green-500/15" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Unsupported / Proprietary Format Preview ── */}
        {isUnsupported && (
          <div className="flex flex-col items-center justify-center gap-2">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-yellow-500/15 text-yellow-400" : "bg-yellow-50 text-yellow-600"}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${textMeta}`}>{ext}</span>
            <span className={`text-[8px] ${textMeta}`}>Preview not available</span>
          </div>
        )}

        {/* ── Presentation Preview ── */}
        {isPres && (
          <div className="flex flex-col items-center justify-center gap-2">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-orange-500/15 text-orange-400" : "bg-orange-50 text-orange-500"}`}>
              <Presentation className="w-6 h-6" />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${textMeta}`}>{ext}</span>
          </div>
        )}

        {/* ── Audio Preview ── */}
        {isAudio && (
          <div className="flex flex-col items-center justify-center gap-2">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-pink-500/20 text-pink-400" : "bg-pink-50 text-pink-500"}`}>
              <Music className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-0.5 h-4">
              {[40, 75, 55, 90, 65, 80, 45, 70, 85, 60, 50].map((h, i) => (
                <div
                  key={i}
                  className={`w-0.5 rounded-full ${isDark ? "bg-pink-400/60" : "bg-pink-400"}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Fallback Icon (for unknown or unloaded items) ── */}
        {!isDoc && !isAudio && !isCode && !isUnsupported && !isPres && ((!isImage && !isVideo) || (isImage && (imageError || !item.downloadUrl)) || (isVideo && !item.downloadUrl)) && (
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-200/80 text-slate-500"}`}>
              {getTypeIcon("w-6 h-6")}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${textMeta}`}>
              {ext}
            </span>
          </div>
        )}
      </div>

      {/* ───── METADATA FOOTER (Bottom Info Area) ───── */}
      <div className={`px-3 py-2.5 flex flex-col gap-1 border-t transition-colors ${isDark ? "border-slate-800/80 bg-slate-900" : "border-slate-100 bg-white"}`}>
        {/* Row 1: File Name */}
        <div className="flex items-center justify-between gap-1.5">
          <span
            className={`text-[12px] font-semibold truncate tracking-tight ${textTitle}`}
            title={item.name}
          >
            {item.name}
          </span>

          {/* Quick Context Trigger */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu?.(item, e);
            }}
            className={`opacity-80 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-0.5 rounded transition-opacity ${
              isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            }`}
            title="Options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Row 2: Type badge, Size, Dimensions/Subtext */}
        <div className={`flex items-center justify-between text-[10px] font-medium ${textMeta}`}>
          <div className="flex items-center gap-1.5">
            {getTypeIcon()}
            <span className="uppercase font-bold tracking-wider">{ext}</span>
            <span>•</span>
            <span>{item.size || "0 KB"}</span>
          </div>

          {getSubtext() && (
            <span className="truncate max-w-[110px] sm:max-w-[130px] text-right">
              {getSubtext()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
