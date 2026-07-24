"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Instagram,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  Target,
  Send,
} from "lucide-react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useInstagramStore, type ScheduledPostStatus } from "@/stores/instagramStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FirestorePost {
  id: string;
  clientId: string;
  mediaItemUrls: string[];
  caption: string;
  scheduledTime: { toDate: () => Date } | null;
  status: ScheduledPostStatus;
  campaignGoal?: string;
  tone?: string;
  errorMessage: string | null;
  createdAt: { toDate: () => Date } | null;
  updatedAt: { toDate: () => Date } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ScheduledPostStatus,
  { label: string; bg: string; text: string; dot: string; icon: React.ReactNode }
> = {
  draft: {
    label: "Draft",
    bg: "bg-slate-100",
    text: "text-slate-600",
    dot: "bg-slate-400",
    icon: <Clock className="w-3 h-3" />,
  },
  scheduled: {
    label: "Scheduled",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-400",
    icon: <Calendar className="w-3 h-3" />,
  },
  processing: {
    label: "Processing",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-400",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  published: {
    label: "Published",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-400",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  failed: {
    label: "Failed",
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-400",
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

function formatScheduledTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const absDiff = Math.abs(diff);

  // If within 24 hours, show relative
  if (absDiff < 86400000) {
    const hours = Math.floor(absDiff / 3600000);
    const minutes = Math.floor((absDiff % 3600000) / 60000);
    if (diff > 0) {
      if (hours > 0) return `in ${hours}h ${minutes}m`;
      return `in ${minutes}m`;
    }
    if (hours > 0) return `${hours}h ${minutes}m ago`;
    return `${minutes}m ago`;
  }

  // Otherwise show formatted date
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncateCaption(caption: string, maxLen = 100): string {
  if (caption.length <= maxLen) return caption;
  return caption.slice(0, maxLen).trimEnd() + "…";
}

import { stripHtml } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CampaignLandingProps {
  clientId: string;
  onCreateNew: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CampaignLanding({
  clientId,
  onCreateNew,
  onBack,
}: CampaignLandingProps) {
  const firestore = useFirestore();
  const connectedAccount = useInstagramStore((s) => s.connectedAccount);

  const [posts, setPosts] = useState<FirestorePost[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Realtime listener ────────────────────────────────────────────────
  useEffect(() => {
    if (!firestore) return;

    const q = query(
      collection(firestore, "scheduled_instagram_posts"),
      where("clientId", "==", clientId),
      orderBy("scheduledTime", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const loaded: FirestorePost[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as FirestorePost[];
        setPosts(loaded);
        setLoading(false);
      },
      (err) => {
        console.error("[CampaignLanding] Snapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, clientId]);

  // ── Status counts ────────────────────────────────────────────────────
  const statusCounts = posts.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="-mx-4 -mt-6 -mb-4 md:-mx-6 md:-mb-6 min-h-[calc(100vh-3.5rem)] bg-[#faf8f3]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#faf8f3] border-b border-[#e8e2d4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="w-9 h-9 rounded-xl bg-[#fefdfb] border border-[#e8e2d4] flex items-center justify-center transition-all hover:bg-white hover:shadow-sm hover:border-[#d4cfc3] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-[#8b7e6a]" />
              </button>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center shadow-md shadow-pink-500/15">
                  <Instagram className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-[#2c2416] leading-tight">
                    Instagram Campaigns
                  </h1>
                  <p className="text-[11px] text-[#8b7e6a] mt-0.5">
                    {posts.length} {posts.length === 1 ? "post" : "posts"}
                    {Object.keys(statusCounts).length > 0 && (
                      <span className="ml-1.5">
                        •{" "}
                        {Object.entries(statusCounts)
                          .map(([status, count]) => `${count} ${status}`)
                          .join(", ")}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Account + Create */}
            <div className="flex items-center gap-3">
              {/* Connected account badge */}
              {connectedAccount && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#fefdfb] border border-[#e8e2d4]">
                  {connectedAccount.profilePictureUrl ? (
                    <img
                      src={connectedAccount.profilePictureUrl}
                      alt="Profile"
                      className="w-6 h-6 rounded-full object-cover border-2 border-pink-400/30"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                      <Instagram className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <span className="text-xs font-semibold text-[#4a3f2f]">
                    @{connectedAccount.username}
                  </span>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                </div>
              )}

              {/* Create New Post button */}
              <button
                onClick={onCreateNew}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30 transition-all cursor-pointer active:scale-[0.97]"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create New Post</span>
                <span className="sm:hidden">New</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          /* Loading state */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-32 gap-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#fefdfb] border border-[#e8e2d4] flex items-center justify-center shadow-sm">
              <Loader2 className="w-5 h-5 text-[#8b7e6a] animate-spin" />
            </div>
            <p className="text-sm text-[#8b7e6a]">Loading campaigns…</p>
          </motion.div>
        ) : posts.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-[#fefdfb] border-2 border-dashed border-[#d4cfc3] flex items-center justify-center mb-6">
              <ImageIcon className="w-8 h-8 text-[#b5a998]" />
            </div>
            <h3 className="text-xl font-bold text-[#2c2416] mb-2">
              No posts yet
            </h3>
            <p className="text-sm text-[#8b7e6a] max-w-sm mb-8 leading-relaxed">
              Create your first Instagram post to start building your campaign
              calendar. Plan, schedule, and track everything in one place.
            </p>
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-600/30 transition-all cursor-pointer active:scale-[0.97]"
            >
              <Plus className="w-4.5 h-4.5" />
              Create your first post
            </button>
            <div className="mt-8 flex items-center gap-6 text-[11px] text-[#b5a998]">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule ahead</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                <span>Set goals</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                <span>Auto-publish</span>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Post grid */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {posts.map((post, idx) => {
                const status = STATUS_CONFIG[post.status] || STATUS_CONFIG.draft;
                const scheduledDate = post.scheduledTime?.toDate?.();
                const thumbnail = post.mediaItemUrls?.[0] || null;
                const mediaCount = post.mediaItemUrls?.length || 0;

                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: idx * 0.04 }}
                    className="group bg-[#fefdfb] rounded-2xl border border-[#e8e2d4] overflow-hidden shadow-sm hover:shadow-md hover:border-[#d4cfc3] transition-all duration-200"
                  >
                    {/* Thumbnail area */}
                    <div className="relative aspect-[4/3] bg-[#f5f1e8] overflow-hidden">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt="Post thumbnail"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-10 h-10 text-[#d4cfc3]" />
                        </div>
                      )}

                      {/* Media count badge */}
                      {mediaCount > 1 && (
                        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          {mediaCount}
                        </div>
                      )}

                      {/* Status badge (top right) */}
                      <div className="absolute top-3 right-3">
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm ${status.bg} ${status.text}`}
                        >
                          {status.icon}
                          {status.label}
                        </div>
                      </div>

                      {/* Gradient overlay at bottom */}
                      <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
                    </div>

                      {/* Card body */}
                      <div className="p-4">
                        {/* Caption */}
                        <p className="text-sm text-[#2c2416] leading-relaxed min-h-[2.5rem]">
                          {post.caption
                            ? truncateCaption(stripHtml(post.caption))
                            : (
                              <span className="text-[#b5a998] italic">
                                No caption
                              </span>
                            )}
                        </p>

                      {/* Meta row */}
                      <div className="mt-3 flex items-center justify-between">
                        {/* Scheduled time */}
                        <div className="flex items-center gap-1.5 text-[11px] text-[#8b7e6a]">
                          <Clock className="w-3 h-3" />
                          <span>
                            {scheduledDate
                              ? formatScheduledTime(scheduledDate)
                              : "Not scheduled"}
                          </span>
                        </div>

                        {/* Campaign goal */}
                        {post.campaignGoal && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#f5f1e8] text-[10px] font-medium text-[#8b7e6a]">
                            <Target className="w-2.5 h-2.5" />
                            <span className="max-w-[80px] truncate">
                              {post.campaignGoal}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Error message for failed posts */}
                      {post.status === "failed" && post.errorMessage && (
                        <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100">
                          <p className="text-[10px] text-red-600 leading-relaxed line-clamp-2">
                            {post.errorMessage}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
