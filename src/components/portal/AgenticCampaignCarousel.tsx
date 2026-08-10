"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser, useFirestore } from "@/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

/* ─────────────────────────────────────────────────────────────
   AgenticCampaignCarousel
   ────────────────────────────────────────────────────────────
   Sliding panel showing active Agentic Campaigning tools.
   Max 3 slides, ordered by priority:
     P1 Active  → currently executing (pinned for 5 min)
     P2 Scheduled → awaiting trigger, soonest first
     P3 Completed → fills remaining slots with recent finishes
   ───────────────────────────────────────────────────────────── */

interface CampaignSlide {
  id: string;
  tool: "instagram" | "gmail" | "youtube";
  toolName: string;
  status: "active" | "scheduled" | "completed";
  payload: string;
  timestamp: number;
  priority: 1 | 2 | 3;
  activeSince?: number;
  imageUrl?: string;
}

interface AgenticCampaignCarouselProps {
  orgId: string;
  isDarkMode: boolean;
}

/* ── Tool icons (inline SVG to avoid extra imports) ── */
const ToolIcon = ({ tool, className }: { tool: string; className?: string }) => {
  const cls = className || "w-4 h-4";
  if (tool === "instagram") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    );
  }
  if (tool === "youtube") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  // gmail / default
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20m0-2H4c-1.11 0-2 .89-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2z" />
    </svg>
  );
};

/* ── Status pill colours ── */
const statusConfig: Record<string, { label: string; bg: string; text: string; pulse?: boolean }> = {
  active: { label: "Active", bg: "bg-emerald-500/15", text: "text-emerald-500", pulse: true },
  scheduled: { label: "Scheduled", bg: "bg-amber-500/15", text: "text-amber-500" },
  completed: { label: "Completed", bg: "bg-slate-500/15", text: "text-slate-400" },
};

/* ── Helpers ── */
function tsToMs(ts: any): number {
  if (!ts) return 0;
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === "number") return ts < 1e12 ? ts * 1000 : ts;
  if (typeof ts === "string") return new Date(ts).getTime() || 0;
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
}

function formatRelativeTime(ms: number): string {
  if (!ms) return "";
  const now = Date.now();
  const diff = ms - now;
  const absDiff = Math.abs(diff);
  const mins = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  if (diff > 0) {
    if (mins < 1) return "in < 1m";
    if (mins < 60) return `in ${mins}m`;
    if (hours < 24) return `in ${hours}h ${mins % 60}m`;
    return `in ${days}d`;
  }
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

/* ── Tool accent colours ── */
const toolAccent: Record<string, { icon: string }> = {
  instagram: { icon: "text-pink-500" },
  gmail: { icon: "text-blue-500" },
  youtube: { icon: "text-red-500" },
};

const FIVE_MINUTES = 5 * 60 * 1000;
const ROTATION_INTERVAL = 8000;
const MAX_SLIDES = 3;

export default function AgenticCampaignCarousel({ orgId, isDarkMode }: AgenticCampaignCarouselProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  const [slides, setSlides] = useState<CampaignSlide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Raw data from Firestore ── */
  const [igPosts, setIgPosts] = useState<any[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<any[]>([]);
  const [ytDrafts, setYtDrafts] = useState<any[]>([]);

  /* ── Subscribe to Instagram posts ── */
  useEffect(() => {
    if (!firestore || !orgId) return;
    // Track the active unsubscribe so we always clean up — even the fallback
    let activeSub: (() => void) | null = null;

    const primaryQuery = query(
      collection(firestore, "scheduled_instagram_posts"),
      where("clientId", "==", orgId),
      orderBy("updatedAt", "desc"),
      limit(10)
    );
    activeSub = onSnapshot(primaryQuery, (snap) => {
      const posts: any[] = [];
      snap.forEach((d) => posts.push({ id: d.id, ...d.data() }));
      setIgPosts(posts);
    }, () => {
      // Fallback: simpler query if composite index is missing
      const fallbackQuery = query(
        collection(firestore, "scheduled_instagram_posts"),
        where("clientId", "==", orgId),
        limit(10)
      );
      activeSub = onSnapshot(fallbackQuery, (snap) => {
        const posts: any[] = [];
        snap.forEach((d) => posts.push({ id: d.id, ...d.data() }));
        setIgPosts(posts);
      }, () => {});
    });
    return () => { if (activeSub) activeSub(); };
  }, [firestore, orgId]);

  /* ── Subscribe to Gmail campaigns ── */
  useEffect(() => {
    if (!firestore || !orgId) return;
    const q = query(collection(firestore, `orgs/${orgId}/campaigns`), limit(10));
    const unsub = onSnapshot(q, (snap) => {
      const campaigns: any[] = [];
      snap.forEach((d) => campaigns.push({ id: d.id, ...d.data() }));
      setEmailCampaigns(campaigns);
    }, () => {});
    return () => unsub();
  }, [firestore, orgId]);

  /* ── Subscribe to YouTube drafts ── */
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const q = query(collection(firestore, `users/${user.uid}/youtube_drafts`), limit(10));
    const unsub = onSnapshot(q, (snap) => {
      const drafts: any[] = [];
      snap.forEach((d) => drafts.push({ id: d.id, ...d.data() }));
      setYtDrafts(drafts);
    }, () => {});
    return () => unsub();
  }, [firestore, user?.uid]);

  /* ── Build prioritised slides ── */
  useEffect(() => {
    const active: CampaignSlide[] = [];
    const scheduled: CampaignSlide[] = [];
    const completed: CampaignSlide[] = [];
    const now = Date.now();

    // ── Instagram ──
    for (const p of igPosts) {
      const imageCount = p.mediaItemUrls?.length || 0;
      const payloadHint = imageCount > 1 ? `Carousel post \u2014 ${imageCount} images` : truncate(p.caption || "Instagram post", 40);
      const thumb = p.mediaItemUrls?.[0] || p.imageUrl || "";
      if (p.status === "processing") {
        active.push({ id: `ig-${p.id}`, tool: "instagram", toolName: "Auto Instagram", status: "active", payload: payloadHint, timestamp: tsToMs(p.updatedAt), priority: 1, activeSince: tsToMs(p.updatedAt), imageUrl: thumb });
      } else if (p.status === "scheduled") {
        scheduled.push({ id: `ig-${p.id}`, tool: "instagram", toolName: "Auto Instagram", status: "scheduled", payload: payloadHint, timestamp: tsToMs(p.scheduledTime), priority: 2, imageUrl: thumb });
      } else if (p.status === "published") {
        completed.push({ id: `ig-${p.id}`, tool: "instagram", toolName: "Auto Instagram", status: "completed", payload: payloadHint, timestamp: tsToMs(p.updatedAt), priority: 3, imageUrl: thumb });
      }
    }

    // ── Gmail ──
    for (const c of emailCampaigns) {
      const recipCount = c.recipients?.length || 0;
      const payloadHint = truncate(c.name || c.subject || "Email campaign", 30) + (recipCount ? ` \u2014 ${recipCount} recipient${recipCount > 1 ? "s" : ""}` : "");
      if (c.status === "active" || c.status === "processing") {
        active.push({ id: `gm-${c.id}`, tool: "gmail", toolName: "Auto Gmail", status: "active", payload: payloadHint, timestamp: tsToMs(c.triggerAt) || now, priority: 1, activeSince: tsToMs(c.triggerAt) || now });
      } else if (c.status === "draft" && c.triggerAt && tsToMs(c.triggerAt) > now) {
        scheduled.push({ id: `gm-${c.id}`, tool: "gmail", toolName: "Auto Gmail", status: "scheduled", payload: payloadHint, timestamp: tsToMs(c.triggerAt), priority: 2 });
      } else if (c.status === "completed") {
        completed.push({ id: `gm-${c.id}`, tool: "gmail", toolName: "Auto Gmail", status: "completed", payload: payloadHint, timestamp: tsToMs(c.triggerAt) || tsToMs(c.createdAt), priority: 3 });
      }
    }

    // ── YouTube ──
    for (const d of ytDrafts) {
      const payloadHint = truncate(d.title || "YouTube draft", 40);
      if (d.status === "Uploaded to YouTube") {
        completed.push({ id: `yt-${d.id}`, tool: "youtube", toolName: "Auto YouTube", status: "completed", payload: payloadHint, timestamp: tsToMs(d.createdAt), priority: 3 });
      } else {
        scheduled.push({ id: `yt-${d.id}`, tool: "youtube", toolName: "Auto YouTube", status: "scheduled", payload: payloadHint, timestamp: tsToMs(d.createdAt), priority: 2 });
      }
    }

    // Sort each bucket
    scheduled.sort((a, b) => a.timestamp - b.timestamp);
    completed.sort((a, b) => b.timestamp - a.timestamp);

    // Allocate slots: Active first, then Scheduled, then fill with Completed
    const result: CampaignSlide[] = [];
    for (const s of active) { if (result.length >= MAX_SLIDES) break; result.push(s); }
    for (const s of scheduled) { if (result.length >= MAX_SLIDES) break; result.push(s); }
    for (const s of completed) { if (result.length >= MAX_SLIDES) break; result.push(s); }

    setSlides(result);
    setActiveIndex((prev) => (prev >= result.length ? 0 : prev));
  }, [igPosts, emailCampaigns, ytDrafts]);

  /* ── Carousel rotation ── */
  // Use a ref so the interval callback always sees the latest slides/index
  // without re-creating the interval on every tick.
  const slidesRef = useRef(slides);
  const activeIndexRef = useRef(activeIndex);
  slidesRef.current = slides;
  activeIndexRef.current = activeIndex;

  useEffect(() => {
    if (slides.length <= 1) return;
    if (rotationRef.current) clearInterval(rotationRef.current);

    rotationRef.current = setInterval(() => {
      const currentSlides = slidesRef.current;
      const currentIdx = activeIndexRef.current;
      const current = currentSlides[currentIdx];

      // Pin active agents for 5 minutes
      if (current && current.status === "active" && current.activeSince) {
        if (Date.now() - current.activeSince < FIVE_MINUTES) return;
      }

      setActiveIndex((prev) => (prev + 1) % currentSlides.length);
    }, ROTATION_INTERVAL);

    return () => { if (rotationRef.current) clearInterval(rotationRef.current); };
  }, [slides.length]); // Only re-create when the number of slides changes

  /* ── Empty state ── */
  if (slides.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
          <svg className={`w-5 h-5 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="text-center">
          <p className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>No active campaigns</p>
          <p className={`text-[10px] mt-0.5 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Launch one from Agentic Campaigning</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-300" : "text-slate-400"}`}>
          Agentic Campaigns
        </span>
        <div className={`text-[9px] font-medium tabular-nums ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          {slides.length} active tool{slides.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Carousel viewport */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {slides.map((slide) => {
            const sc = statusConfig[slide.status];
            const accent = toolAccent[slide.tool];
            return (
              <div key={slide.id} className="w-full shrink-0 h-full flex flex-col justify-between px-0.5">
                <div className={`flex-1 rounded-xl border p-4 flex flex-col justify-between ${isDarkMode ? "bg-slate-800/50 border-slate-700/50" : "bg-white/60 border-slate-200/80"}`}>
                  {/* Top: tool + status */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDarkMode ? "bg-slate-700/80" : "bg-slate-100"} ${accent.icon}`}>
                          <ToolIcon tool={slide.tool} className="w-3.5 h-3.5" />
                        </div>
                        <span className={`text-xs font-semibold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
                          {slide.toolName}
                        </span>
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${sc.bg} ${sc.text}`}>
                        {sc.pulse && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                        )}
                        {sc.label}
                      </div>
                    </div>
                    <p className={`text-sm leading-snug ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                      {slide.payload}
                    </p>
                  </div>

                  {/* Post thumbnail */}
                  {slide.imageUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden flex-1 min-h-0">
                      <img
                        src={slide.imageUrl}
                        alt=""
                        className="w-full h-full object-cover rounded-lg"
                        referrerPolicy="no-referrer"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}

                  {/* Bottom: timestamp */}
                  <div className={`mt-3 pt-2 border-t ${isDarkMode ? "border-slate-700/50" : "border-slate-200/60"}`}>
                    <span className={`text-[10px] font-medium tabular-nums ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                      {slide.status === "active" && "Started "}
                      {slide.status === "scheduled" && "Triggers "}
                      {slide.status === "completed" && "Finished "}
                      {formatRelativeTime(slide.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3 shrink-0">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`rounded-full transition-all duration-300 cursor-pointer ${
                i === activeIndex
                  ? `w-5 h-1.5 ${isDarkMode ? "bg-indigo-400" : "bg-indigo-500"}`
                  : `w-1.5 h-1.5 ${isDarkMode ? "bg-slate-600 hover:bg-slate-500" : "bg-slate-300 hover:bg-slate-400"}`
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
