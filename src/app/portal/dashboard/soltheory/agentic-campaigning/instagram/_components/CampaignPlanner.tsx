"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Clock,
  Repeat,
  Send,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  LayoutList,
  CalendarPlus,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { stripHtml } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore } from "@/firebase";
import {
  collection,
  addDoc,
  writeBatch,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { useInstagramStore } from "@/stores/instagramStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScheduleType = "single" | "campaign";
type Frequency = "daily" | "weekly" | "biweekly" | "monthly";

interface ScheduledEntry {
  index: number;
  mediaUrl: string;
  mediaType: "image" | "video";
  scheduledDate: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREQUENCY_OPTIONS: { value: Frequency; label: string; days: number }[] = [
  { value: "daily", label: "Daily", days: 1 },
  { value: "weekly", label: "Weekly", days: 7 },
  { value: "biweekly", label: "Bi-weekly", days: 14 },
  { value: "monthly", label: "Monthly", days: 30 },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CampaignPlannerProps {
  isDark: boolean;
  clientId: string;
}

export default function CampaignPlanner({
  isDark,
  clientId,
}: CampaignPlannerProps) {
  const firestore = useFirestore();
  const selectedMedia = useInstagramStore((s) => s.selectedMedia);
  const campaignDraft = useInstagramStore((s) => s.campaignDraft);

  // ── Local state ────────────────────────────────────────────────────────
  const [scheduleType, setScheduleType] = useState<ScheduleType>("single");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startHour, setStartHour] = useState(10);
  const [startMinute, setStartMinute] = useState(0);
  const [sequenceLength, setSequenceLength] = useState(4);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Per-post time overrides for campaign sequences: Map<postIndex, {hour, minute}>
  const [postTimeOverrides, setPostTimeOverrides] = useState<Map<number, { hour: number; minute: number }>>(new Map());
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Reset result after 5s
  useEffect(() => {
    if (!submitResult) return;
    const timer = setTimeout(() => setSubmitResult(null), 5000);
    return () => clearTimeout(timer);
  }, [submitResult]);

  // ── Computed: effective start date with time ───────────────────────────
  const effectiveStart = useMemo(() => {
    if (!startDate) return null;
    const d = new Date(startDate);
    d.setHours(startHour, startMinute, 0, 0);
    return d;
  }, [startDate, startHour, startMinute]);

  // ── Computed: preview schedule ─────────────────────────────────────────
  const previewEntries: ScheduledEntry[] = useMemo(() => {
    if (!effectiveStart || selectedMedia.length === 0) return [];

    const freqDays =
      FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.days ?? 7;

    if (scheduleType === "single") {
      return [
        {
          index: 0,
          mediaUrl: selectedMedia[0].url,
          mediaType: selectedMedia[0].type,
          scheduledDate: effectiveStart,
        },
      ];
    }

    // Campaign sequence: cycle through selected media
    const count = Math.max(1, Math.min(sequenceLength, 52)); // cap at 52
    const entries: ScheduledEntry[] = [];

    for (let i = 0; i < count; i++) {
      const mediaIdx = i % selectedMedia.length;
      const postDate = addDays(effectiveStart, i * freqDays);

      // Apply per-post time override if set
      const override = postTimeOverrides.get(i);
      if (override) {
        postDate.setHours(override.hour, override.minute, 0, 0);
      }

      entries.push({
        index: i,
        mediaUrl: selectedMedia[mediaIdx].url,
        mediaType: selectedMedia[mediaIdx].type,
        scheduledDate: postDate,
      });
    }

    return entries;
  }, [effectiveStart, selectedMedia, frequency, scheduleType, sequenceLength, postTimeOverrides]);

  // ── Validation ─────────────────────────────────────────────────────────
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (selectedMedia.length === 0) errors.push("Select at least one media asset.");
    if (!startDate) errors.push("Choose a start date.");
    if (effectiveStart && effectiveStart < new Date()) {
      errors.push("Start date/time must be in the future.");
    }
    if (scheduleType === "campaign" && sequenceLength < 1) {
      errors.push("Sequence length must be at least 1.");
    }
    if (!campaignDraft.caption?.trim()) {
      errors.push("Write a caption before scheduling.");
    }
    return errors;
  }, [selectedMedia, startDate, effectiveStart, scheduleType, sequenceLength, campaignDraft.caption]);

  const isValid = validationErrors.length === 0;

  // ── Submit handler ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const postsRef = collection(firestore, "scheduled_instagram_posts");
      const batch = writeBatch(firestore);



      const plainCaption = stripHtml(campaignDraft.caption || "");

      for (const entry of previewEntries) {
        const postDoc = doc(postsRef);
        batch.set(postDoc, {
          clientId,
          mediaItemUrls: [entry.mediaUrl],
          caption: plainCaption,
          scheduledTime: Timestamp.fromDate(entry.scheduledDate),
          status: "scheduled",
          metaContainerId: null,
          metaMediaId: null,
          errorMessage: null,
          campaignGoal: campaignDraft.campaignGoal || "",
          tone: campaignDraft.tone || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      setSubmitResult({
        success: true,
        message: `${previewEntries.length} post${previewEntries.length > 1 ? "s" : ""} scheduled successfully!`,
      });
    } catch (err) {
      console.error("[CampaignPlanner] Batch write error:", err);
      setSubmitResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to schedule posts.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isValid, isSubmitting, previewEntries, firestore, clientId, campaignDraft]);

  // ── Style tokens ───────────────────────────────────────────────────────
  const cardBg = isDark ? "bg-slate-900" : "bg-white";
  const cardBorder = isDark ? "border-slate-800" : "border-slate-200";
  const headerBorder = isDark ? "border-slate-800" : "border-slate-100";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const inputBg = isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200";
  const hoverBg = isDark ? "hover:bg-slate-800" : "hover:bg-slate-50";
  const activeBg = isDark ? "bg-pink-500/10 border-pink-500/30" : "bg-pink-50 border-pink-200";
  const activeText = isDark ? "text-pink-400" : "text-pink-600";

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={`rounded-2xl border overflow-hidden ${cardBg} ${cardBorder}`}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className={`px-5 py-4 border-b flex items-center justify-between ${headerBorder}`}
      >
        <div className="flex items-center gap-2">
          <CalendarPlus
            className={`w-4 h-4 ${isDark ? "text-pink-400" : "text-pink-500"}`}
          />
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}
          >
            Schedule
          </span>
        </div>
        <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0 text-[10px]">
          {scheduleType === "single" ? "Single Post" : "Campaign"}
        </Badge>
      </div>

      <div className="p-5 space-y-5">
        {/* ── Schedule Type Toggle ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              {
                type: "single" as ScheduleType,
                icon: <CalendarDays className="w-4 h-4" />,
                label: "Single Post",
              },
              {
                type: "campaign" as ScheduleType,
                icon: <Repeat className="w-4 h-4" />,
                label: "Campaign Sequence",
              },
            ] as const
          ).map(({ type, icon, label }) => (
            <motion.button
              key={type}
              onClick={() => setScheduleType(type)}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                scheduleType === type
                  ? `${activeBg} ${activeText}`
                  : `${cardBorder} ${textSecondary} ${hoverBg}`
              }`}
            >
              {icon}
              {label}
            </motion.button>
          ))}
        </div>

        {/* ── Campaign Sequence Settings ────────────────────────────────── */}
        <AnimatePresence>
          {scheduleType === "campaign" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 pt-1">
                {/* Frequency */}
                <div className="space-y-1.5">
                  <label
                    className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}
                  >
                    Post Frequency
                  </label>
                  <Select
                    value={frequency}
                    onValueChange={(val) => setFrequency(val as Frequency)}
                  >
                    <SelectTrigger
                      className={`${inputBg} ${textPrimary} rounded-lg h-9`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sequence length */}
                <div className="space-y-1.5">
                  <label
                    className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}
                  >
                    Number of Posts
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={sequenceLength}
                      onChange={(e) =>
                        setSequenceLength(
                          Math.max(1, Math.min(52, parseInt(e.target.value) || 1))
                        )
                      }
                      className={`w-20 h-9 px-3 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-pink-500/40 transition-all ${inputBg} ${textPrimary}`}
                    />
                    <span className={`text-sm ${textSecondary}`}>
                      posts over{" "}
                      <strong className={textPrimary}>
                        {sequenceLength *
                          (FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.days ?? 7)}{" "}
                        days
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Start Date & Time ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Date picker */}
          <div className="space-y-1.5">
            <label
              className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}
            >
              {scheduleType === "single" ? "Post Date" : "Start Date"}
            </label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  className={`w-full flex items-center gap-2 h-9 px-3 rounded-lg border text-sm text-left transition-all cursor-pointer ${inputBg} ${
                    startDate ? textPrimary : textSecondary
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                  {startDate ? formatDate(startDate) : "Pick a date"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    setStartDate(date);
                    setCalendarOpen(false);
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time picker — hour and minute */}
          <div className="space-y-1.5">
            <label
              className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}
            >
              Time
            </label>
            <div className="flex items-center gap-1.5">
              <Select value={String(startHour)} onValueChange={(v) => setStartHour(parseInt(v, 10))}>
                <SelectTrigger
                  className={`${inputBg} ${textPrimary} rounded-lg h-9 w-[52%]`}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-48">
                    {HOUR_OPTIONS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
              <span className={`text-sm font-bold ${textSecondary}`}>:</span>
              <Select value={String(startMinute)} onValueChange={(v) => setStartMinute(parseInt(v, 10))}>
                <SelectTrigger
                  className={`${inputBg} ${textPrimary} rounded-lg h-9 w-[44%]`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MINUTE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      :{String(m).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Preview Timeline ──────────────────────────────────────────── */}
        {previewEntries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${textSecondary}`}
              >
                <LayoutList className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                Schedule Preview
              </span>
              <span className={`text-xs ${textSecondary}`}>
                {previewEntries.length} post{previewEntries.length > 1 ? "s" : ""}
              </span>
            </div>

            <ScrollArea
              className={`rounded-xl border ${cardBorder} ${
                isDark ? "bg-slate-800/50" : "bg-slate-50/50"
              }`}
              style={{ maxHeight: 240 }}
            >
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewEntries.map((entry, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`flex items-center gap-3 px-3 py-2.5 ${hoverBg} transition-colors`}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-700">
                      {entry.mediaType === "video" ? (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                          <ImageIcon className="w-4 h-4 text-white" />
                        </div>
                      ) : (
                        <img
                          src={entry.mediaUrl}
                          alt={`Post ${entry.index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {/* Post number badge */}
                      <div className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {entry.index + 1}
                      </div>
                    </div>

                    {/* Date info + editable time for campaigns */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${textPrimary}`}>
                        Post {entry.index + 1}
                      </p>
                      <p className={`text-xs ${textSecondary}`}>
                        {formatDate(entry.scheduledDate)} at{" "}
                        {formatTime(entry.scheduledDate)}
                      </p>
                    </div>

                    {/* Per-post time override for campaign sequences */}
                    {scheduleType === "campaign" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <select
                          value={postTimeOverrides.get(entry.index)?.hour ?? entry.scheduledDate.getHours()}
                          onChange={(e) => {
                            const newMap = new Map(postTimeOverrides);
                            const existing = newMap.get(entry.index);
                            newMap.set(entry.index, {
                              hour: parseInt(e.target.value, 10),
                              minute: existing?.minute ?? entry.scheduledDate.getMinutes(),
                            });
                            setPostTimeOverrides(newMap);
                          }}
                          className={`text-[10px] h-6 rounded border px-1 cursor-pointer ${inputBg} ${textPrimary}`}
                        >
                          {HOUR_OPTIONS.map((h) => (
                            <option key={h} value={h}>
                              {h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h - 12}PM`}
                            </option>
                          ))}
                        </select>
                        <span className={`text-[10px] ${textSecondary}`}>:</span>
                        <select
                          value={postTimeOverrides.get(entry.index)?.minute ?? entry.scheduledDate.getMinutes()}
                          onChange={(e) => {
                            const newMap = new Map(postTimeOverrides);
                            const existing = newMap.get(entry.index);
                            newMap.set(entry.index, {
                              hour: existing?.hour ?? entry.scheduledDate.getHours(),
                              minute: parseInt(e.target.value, 10),
                            });
                            setPostTimeOverrides(newMap);
                          }}
                          className={`text-[10px] h-6 rounded border px-1 cursor-pointer ${inputBg} ${textPrimary}`}
                        >
                          {MINUTE_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              :{String(m).padStart(2, "0")}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        )}

        {/* ── Validation Errors ─────────────────────────────────────────── */}
        <AnimatePresence>
          {validationErrors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className={`rounded-lg px-3 py-2.5 space-y-1 text-xs ${
                  isDark
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : "bg-red-50 text-red-600 border border-red-200"
                }`}
              >
                {validationErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Submit Result ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {submitResult && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
            >
              <div
                className={`rounded-lg px-3 py-2.5 flex items-center gap-2 text-xs font-medium ${
                  submitResult.success
                    ? isDark
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : isDark
                      ? "bg-red-500/10 text-red-400 border border-red-500/20"
                      : "bg-red-50 text-red-600 border border-red-200"
                }`}
              >
                {submitResult.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                {submitResult.message}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Submit Button ─────────────────────────────────────────────── */}
        <motion.button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          whileTap={{ scale: 0.97 }}
          className={`
            group relative w-full flex items-center justify-center gap-2
            px-4 py-3 rounded-xl text-sm font-semibold text-white
            bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400
            shadow-lg shadow-pink-500/20
            hover:shadow-xl hover:shadow-pink-500/30
            hover:brightness-110
            active:scale-[0.98]
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-lg
            transition-all duration-200 cursor-pointer
          `}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scheduling…
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              {scheduleType === "single"
                ? "Schedule Post"
                : `Schedule ${previewEntries.length} Post${previewEntries.length !== 1 ? "s" : ""}`}
              <Sparkles className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
