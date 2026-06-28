"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Instagram,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Save,
  Trash2,
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore, useAuth } from "@/firebase";
import {
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarIGPost {
  id: string;
  clientId: string;
  caption: string;
  mediaItemUrls: string[];
  scheduledTime: Date;
  status: "draft" | "scheduled" | "processing" | "published" | "failed";
}

interface CalendarPreviewModalProps {
  post: CalendarIGPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
  /** Called after any mutation so the parent can refresh its calendar data. */
  onRefresh?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label:
    i === 0
      ? "12:00 AM"
      : i < 12
        ? `${i}:00 AM`
        : i === 12
          ? "12:00 PM"
          : `${i - 12}:00 PM`,
}));

function statusColor(status: CalendarIGPost["status"]): string {
  switch (status) {
    case "scheduled":
      return "bg-blue-500";
    case "processing":
      return "bg-orange-500";
    case "published":
      return "bg-emerald-500";
    case "failed":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
}

function statusLabel(status: CalendarIGPost["status"]): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "processing":
      return "Processing";
    case "published":
      return "Published";
    case "failed":
      return "Failed";
    default:
      return "Draft";
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags from Tiptap output — Instagram expects plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalendarPreviewModal({
  post,
  open,
  onOpenChange,
  isDark,
  onRefresh,
}: CalendarPreviewModalProps) {
  const firestore = useFirestore();

  // ── Local editable state ───────────────────────────────────────────────
  const [caption, setCaption] = useState("");
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editHour, setEditHour] = useState("10");
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Media carousel
  const [carouselIdx, setCarouselIdx] = useState(0);

  // Action states
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ── Sync from prop to local state ──────────────────────────────────────
  useEffect(() => {
    if (!post) return;
    setCaption(stripHtml(post.caption));
    setEditDate(post.scheduledTime);
    setEditHour(String(post.scheduledTime.getHours()));
    setCarouselIdx(0);
    setConfirmDelete(false);
    setFeedback(null);
  }, [post?.id]);

  // Clear feedback after 4s
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const effectiveDate = useCallback(() => {
    if (!editDate) return null;
    const d = new Date(editDate);
    d.setHours(parseInt(editHour, 10), 0, 0, 0);
    return d;
  }, [editDate, editHour]);

  const close = useCallback(() => {
    onOpenChange(false);
    setConfirmDelete(false);
  }, [onOpenChange]);

  // ── Save Changes ───────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!post || !firestore) return;
    const newDate = effectiveDate();
    if (!newDate) return;

    setSaving(true);
    try {
      await updateDoc(
        doc(firestore, "scheduled_instagram_posts", post.id),
        {
          caption: stripHtml(caption),
          scheduledTime: Timestamp.fromDate(newDate),
          updatedAt: serverTimestamp(),
        }
      );
      setFeedback({ type: "success", message: "Changes saved!" });
      onRefresh?.();
    } catch (err) {
      console.error("[CalendarPreviewModal] Save error:", err);
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save.",
      });
    } finally {
      setSaving(false);
    }
  }, [post, firestore, caption, effectiveDate, onRefresh]);

  // ── Delete / Cancel Post ───────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!post || !firestore) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(firestore, "scheduled_instagram_posts", post.id));
      setFeedback({ type: "success", message: "Post deleted." });
      onRefresh?.();
      setTimeout(close, 800);
    } catch (err) {
      console.error("[CalendarPreviewModal] Delete error:", err);
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete.",
      });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [post, firestore, onRefresh, close]);

  // Auth for API calls
  const auth = useAuth();

  // ── Publish Now ────────────────────────────────────────────────────────
  const handlePublishNow = useCallback(async () => {
    if (!post) return;
    setPublishing(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated. Please refresh the page.");

      const res = await fetch("/api/campaigning/instagram/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId: post.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed.");
      setFeedback({ type: "success", message: "Published successfully! 🎉" });
      onRefresh?.();
    } catch (err) {
      console.error("[CalendarPreviewModal] Publish error:", err);
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Publish failed.",
      });
    } finally {
      setPublishing(false);
    }
  }, [post, onRefresh, auth]);

  // ── Style tokens ───────────────────────────────────────────────────────
  const bg = isDark ? "bg-slate-900" : "bg-white";
  const border = isDark ? "border-slate-700" : "border-slate-200";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const inputBg = isDark
    ? "bg-slate-800 border-slate-700 text-white"
    : "bg-slate-50 border-slate-200 text-slate-900";
  const btnSecondary = isDark
    ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
    : "bg-slate-100 text-slate-600 hover:bg-slate-200";

  if (!post) return null;

  const mediaUrls = post.mediaItemUrls;
  const hasMultipleMedia = mediaUrls.length > 1;
  const isEditable = post.status === "scheduled" || post.status === "draft";

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`p-0 gap-0 overflow-hidden max-w-md sm:max-w-lg ${bg} ${border} ${textPrimary} sm:rounded-2xl`}
      >
        {/* Accessible title for screen readers */}
        <DialogTitle className="sr-only">Instagram Post Preview</DialogTitle>

        {/* ── Media Carousel ──────────────────────────────────────────── */}
        <div className="relative w-full aspect-square max-h-72 bg-black overflow-hidden">
          {mediaUrls.length > 0 ? (
            <AnimatePresence mode="wait" initial={false}>
              {/\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(mediaUrls[carouselIdx]) ? (
                <motion.video
                  key={carouselIdx}
                  src={mediaUrls[carouselIdx]}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <motion.img
                  key={carouselIdx}
                  src={mediaUrls[carouselIdx]}
                  alt={`Media ${carouselIdx + 1}`}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full object-cover"
                />
              )}
            </AnimatePresence>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center">
              <Instagram className="w-12 h-12 text-white/60" />
            </div>
          )}

          {/* Carousel nav */}
          {hasMultipleMedia && (
            <>
              <button
                onClick={() =>
                  setCarouselIdx((p) =>
                    p === 0 ? mediaUrls.length - 1 : p - 1
                  )
                }
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/70 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setCarouselIdx((p) =>
                    p === mediaUrls.length - 1 ? 0 : p + 1
                  )
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/70 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Dots */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {mediaUrls.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCarouselIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                      i === carouselIdx
                        ? "bg-white w-3"
                        : "bg-white/50"
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Status badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm">
            <span
              className={`w-2 h-2 rounded-full ${statusColor(post.status)}`}
            />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">
              {statusLabel(post.status)}
            </span>
          </div>

          {/* Image count */}
          {hasMultipleMedia && (
            <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm">
              <span className="text-[10px] text-white font-medium">
                {carouselIdx + 1} / {mediaUrls.length}
              </span>
            </div>
          )}
        </div>

        {/* ── Form Body ───────────────────────────────────────────────── */}
        <ScrollArea className="max-h-[50vh]">
          <div className="p-5 space-y-4">
            {/* Caption */}
            <div className="space-y-1.5">
              <label
                className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}
              >
                Caption
              </label>
              {isEditable ? (
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  maxLength={2200}
                  className={`w-full rounded-xl border p-3 text-sm resize-none focus:ring-2 focus:ring-pink-500/40 outline-none transition-all ${inputBg}`}
                />
              ) : (
                <p className={`text-sm leading-relaxed ${textSecondary}`}>
                  {post.caption || "(no caption)"}
                </p>
              )}
              {isEditable && (
                <p className={`text-[10px] text-right ${textSecondary}`}>
                  {caption.length} / 2,200
                </p>
              )}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}
                >
                  Date
                </label>
                {isEditable ? (
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className={`w-full flex items-center gap-2 h-9 px-3 rounded-lg border text-sm text-left transition-all cursor-pointer ${inputBg}`}
                      >
                        <CalendarDays className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        <span className="truncate">
                          {editDate ? formatDate(editDate) : "Pick date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editDate}
                        onSelect={(d) => {
                          setEditDate(d);
                          setCalendarOpen(false);
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <p className={`text-sm ${textSecondary}`}>
                    {formatDate(post.scheduledTime)}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}
                >
                  Time
                </label>
                {isEditable ? (
                  <Select value={editHour} onValueChange={setEditHour}>
                    <SelectTrigger
                      className={`${inputBg} rounded-lg h-9`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-48">
                        {HOUR_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className={`text-sm ${textSecondary}`}>
                    {post.scheduledTime.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                )}
              </div>
            </div>

            {/* ── Feedback ──────────────────────────────────────────────── */}
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium ${
                    feedback.type === "success"
                      ? isDark
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : isDark
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-red-50 text-red-600 border border-red-200"
                  }`}
                >
                  {feedback.type === "success" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  {feedback.message}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Action Buttons ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-2 pt-1">
              {/* Primary row */}
              {isEditable && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 ${
                      isDark
                        ? "bg-pink-500/20 text-pink-400 hover:bg-pink-500/30"
                        : "bg-pink-50 text-pink-600 hover:bg-pink-100"
                    }`}
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Save Changes
                  </button>

                  <button
                    onClick={handlePublishNow}
                    disabled={publishing || post.status === "processing"}
                    className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 hover:brightness-110 transition-all cursor-pointer disabled:opacity-40"
                  >
                    {publishing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Publish Now
                  </button>
                </div>
              )}

              {/* Danger row */}
              <AnimatePresence mode="wait">
                {confirmDelete ? (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex gap-2 overflow-hidden"
                  >
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {deleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Yes, Delete Post
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${btnSecondary}`}
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="delete"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setConfirmDelete(true)}
                    className={`w-full flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      isDark
                        ? "text-red-400 hover:bg-red-500/10"
                        : "text-red-500 hover:bg-red-50"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Post
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
