"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronUp,
  Instagram,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  writeBatch,
  doc,
} from "firebase/firestore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FailedPost {
  id: string;
  caption: string;
  mediaItemUrls: string[];
  scheduledTime: Date;
  errorMessage: string;
  status: string;
}

interface ErrorAlertHandlerProps {
  clientId: string;
  isDark: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if an error message indicates an OAuth / token expiration issue. */
function isOAuthError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes("190") ||
    lower.includes("expired") ||
    lower.includes("oauthexception") ||
    lower.includes("access token") ||
    lower.includes("re-authorize") ||
    lower.includes("invalid token") ||
    lower.includes("session has expired") ||
    lower.includes("not authorized")
  );
}

/** Build the Facebook OAuth URL for re-authorization. */
function buildReAuthUrl(userId: string, orgId: string): string {
  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";

  const state = btoa(JSON.stringify({ uid: userId, origin: orgId }));
  const redirectUri = `${appUrl}/api/auth/instagram/callback`;

  return (
    `https://www.facebook.com/v20.0/dialog/oauth?` +
    new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_META_APP_ID || "1037738182104775",
      redirect_uri: redirectUri,
      state,
      config_id: "1000741799470765",
      response_type: "code",
    }).toString()
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ErrorAlertHandler({
  clientId,
  isDark,
}: ErrorAlertHandlerProps) {
  const firestore = useFirestore();
  const { user } = useUser();

  const [failedPosts, setFailedPosts] = useState<FailedPost[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // ── Real-time listener for failed posts ────────────────────────────────
  useEffect(() => {
    if (!firestore) return;

    const q = query(
      collection(firestore, "scheduled_instagram_posts"),
      where("clientId", "==", clientId),
      where("status", "==", "failed")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const posts: FailedPost[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        posts.push({
          id: d.id,
          caption: data.caption || "",
          mediaItemUrls: data.mediaItemUrls || [],
          scheduledTime:
            data.scheduledTime?.toDate?.() || new Date(data.scheduledTime?.seconds ? data.scheduledTime.seconds * 1000 : data.scheduledTime),
          errorMessage: data.errorMessage || "Unknown error",
          status: data.status,
        });
      });
      setFailedPosts(posts);
      // If new failures come in, un-dismiss
      if (posts.length > 0) setDismissed(false);
    });

    return () => unsub();
  }, [firestore, clientId]);

  // Auto-clear feedback with proper cleanup
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [feedback]);

  // ── Clear all failures → reset to 'draft' ─────────────────────────────
  const handleClearAll = useCallback(async () => {
    if (!firestore || failedPosts.length === 0) return;
    setClearing(true);
    try {
      const batch = writeBatch(firestore);
      for (const post of failedPosts) {
        batch.update(doc(firestore, "scheduled_instagram_posts", post.id), {
          status: "draft",
          errorMessage: "",
        });
      }
      await batch.commit();
      setFeedback(`${failedPosts.length} post(s) moved to draft.`);
    } catch (err) {
      console.error("[ErrorAlertHandler] Clear failed:", err);
      setFeedback("Failed to clear errors. Try again.");
    } finally {
      setClearing(false);
    }
  }, [firestore, failedPosts]);

  // ── Re-authorize ───────────────────────────────────────────────────────
  const handleReAuth = useCallback(() => {
    if (!user?.uid) return;
    window.location.href = buildReAuthUrl(user.uid, clientId);
  }, [user?.uid, clientId]);

  // ── Nothing to show ────────────────────────────────────────────────────
  if (failedPosts.length === 0 || dismissed) return null;

  // Determine if any failure is OAuth-related
  const hasOAuthError = failedPosts.some((p) => isOAuthError(p.errorMessage));
  const oAuthPosts = failedPosts.filter((p) => isOAuthError(p.errorMessage));
  const otherPosts = failedPosts.filter((p) => !isOAuthError(p.errorMessage));

  // ── Style tokens ───────────────────────────────────────────────────────
  const cardBg = isDark
    ? hasOAuthError
      ? "bg-red-950/40 border-red-500/30"
      : "bg-amber-950/30 border-amber-500/30"
    : hasOAuthError
      ? "bg-red-50 border-red-200"
      : "bg-amber-50 border-amber-200";

  const iconColor = hasOAuthError
    ? isDark
      ? "text-red-400"
      : "text-red-500"
    : isDark
      ? "text-amber-400"
      : "text-amber-500";

  const headingColor = hasOAuthError
    ? isDark
      ? "text-red-300"
      : "text-red-700"
    : isDark
      ? "text-amber-300"
      : "text-amber-700";

  const textMuted = isDark ? "text-slate-400" : "text-slate-500";
  const thumbBorder = isDark ? "border-slate-700" : "border-slate-200";

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-2xl border p-4 mb-4 ${cardBg}`}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            hasOAuthError
              ? isDark
                ? "bg-red-500/20"
                : "bg-red-100"
              : isDark
                ? "bg-amber-500/20"
                : "bg-amber-100"
          }`}
        >
          {hasOAuthError ? (
            <ShieldAlert className={`w-4.5 h-4.5 ${iconColor}`} />
          ) : (
            <AlertTriangle className={`w-4.5 h-4.5 ${iconColor}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold ${headingColor}`}>
            {hasOAuthError
              ? "Authorization Expired"
              : `${failedPosts.length} Failed Post${failedPosts.length > 1 ? "s" : ""}`}
          </h3>
          <p className={`text-xs mt-0.5 leading-relaxed ${textMuted}`}>
            {hasOAuthError
              ? "Your Instagram authorization has expired. Please re-authenticate to prevent further scheduled posts from failing."
              : `${failedPosts.length} scheduled post${failedPosts.length > 1 ? "s" : ""} could not be published. Review the errors below.`}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
            isDark ? "hover:bg-slate-800 text-slate-500" : "hover:bg-slate-100 text-slate-400"
          }`}
          title="Dismiss banner"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* ── OAuth Re-auth CTA ──────────────────────────────────────────── */}
      {hasOAuthError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <button
            onClick={handleReAuth}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 hover:brightness-110 transition-all cursor-pointer shadow-sm shadow-pink-500/20"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-authorize Connection
          </button>
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              isDark
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            {clearing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Move All to Draft
          </button>
        </motion.div>
      )}

      {/* ── Expandable Details ─────────────────────────────────────────── */}
      <div className="mt-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className={`flex items-center gap-1.5 text-[11px] font-medium cursor-pointer transition-colors ${
            isDark
              ? "text-slate-400 hover:text-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {expanded ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
          {expanded ? "Hide details" : `View ${failedPosts.length} failed post${failedPosts.length > 1 ? "s" : ""}`}
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                {failedPosts.map((post) => {
                  const isOAuth = isOAuthError(post.errorMessage);
                  return (
                    <div
                      key={post.id}
                      className={`flex items-start gap-3 rounded-xl p-3 ${
                        isDark
                          ? "bg-slate-800/50 border border-slate-700/50"
                          : "bg-white border border-slate-100"
                      }`}
                    >
                      {/* Thumbnail */}
                      {post.mediaItemUrls[0] ? (
                        <img
                          src={post.mediaItemUrls[0]}
                          alt=""
                          className={`w-10 h-10 rounded-lg object-cover shrink-0 border ${thumbBorder}`}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center shrink-0">
                          <Instagram className="w-4 h-4 text-white/70" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-medium truncate ${
                            isDark ? "text-slate-200" : "text-slate-700"
                          }`}
                        >
                          {post.caption.slice(0, 60) || "Untitled post"}
                          {post.caption.length > 60 ? "…" : ""}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${textMuted}`}>
                          Scheduled for{" "}
                          {post.scheduledTime.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                        {/* Error reason */}
                        <div
                          className={`mt-1.5 flex items-center gap-1.5 text-[10px] font-medium ${
                            isOAuth
                              ? isDark
                                ? "text-red-400"
                                : "text-red-500"
                              : isDark
                                ? "text-amber-400"
                                : "text-amber-600"
                          }`}
                        >
                          {isOAuth ? (
                            <ShieldAlert className="w-3 h-3 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                          )}
                          <span className="truncate">
                            {isOAuth ? "Expired Credentials (Code 190)" : post.errorMessage}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Bottom action bar ─────────────────────────────────────── */}
              {!hasOAuthError && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleClearAll}
                    disabled={clearing}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      isDark
                        ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                    }`}
                  >
                    {clearing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    Move All to Draft
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Feedback toast ────────────────────────────────────────────── */}
      <AnimatePresence>
        {feedback && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`text-[10px] mt-2 font-medium ${
              isDark ? "text-emerald-400" : "text-emerald-600"
            }`}
          >
            {feedback}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
