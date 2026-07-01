"use client";

import React, { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Instagram,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { useInstagramStore } from "@/stores/instagramStore";
import OnboardingView from "./_components/OnboardingView";
import WorkspaceLayout from "./_components/WorkspaceLayout";
import CampaignLanding from "./_components/CampaignLanding";
import ErrorAlertHandler from "./_components/ErrorAlertHandler";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ORG_ID is now derived dynamically in the component from the URL path

// ---------------------------------------------------------------------------
// Suspense wrapper — required by Next.js 15 for useSearchParams()
// ---------------------------------------------------------------------------

export default function InstagramPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
        </div>
      }
    >
      <InstagramPageContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Page Content
// ---------------------------------------------------------------------------

function InstagramPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const orgPrefix = pathname.includes('/nxtchapter/') ? 'nxtchapter' : 'soltheory';
  const { user } = useUser();
  const firestore = useFirestore();

  // Connection state
  const [isLoading, setIsLoading] = useState(true);

  // View state: landing shows campaign list, workspace shows the editor
  const [view, setView] = useState<'landing' | 'workspace'>('landing');
  const [isConnected, setIsConnected] = useState(false);

  // Zustand store sync
  const setConnectionStatus = useInstagramStore((s) => s.setConnectionStatus);
  const connectedAccount = useInstagramStore((s) => s.connectedAccount);

  // OAuth callback flash message
  const connectionParam = searchParams.get("connection");
  const errorParam = searchParams.get("error");

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

  // ── Check Instagram connection status ─────────────────────────────────
  useEffect(() => {
    if (!firestore) return;

    async function checkConnection() {
      setIsLoading(true);
      try {
        const connDoc = await getDoc(
          doc(firestore, "instagram_connections", orgPrefix)
        );

        if (connDoc.exists()) {
          const data = connDoc.data();
          setIsConnected(true);
          setConnectionStatus(true, {
            username: data?.instagramUsername || "",
            profilePictureUrl: data?.instagramProfilePictureUrl || "",
          });
        } else {
          setIsConnected(false);
          setConnectionStatus(false);
        }
      } catch (err) {
        console.error("[InstagramPage] Connection check failed:", err);
        setIsConnected(false);
        setConnectionStatus(false);
      } finally {
        setIsLoading(false);
        // Clean up query params to prevent re-triggering on refresh
        if (connectionParam) {
          router.replace(window.location.pathname, { scroll: false });
        }
      }
    }

    checkConnection();
  }, [firestore, connectionParam, setConnectionStatus, router]);

  // ── Style tokens ──────────────────────────────────────────────────────
  const bgColor = isDark ? "bg-slate-950" : "bg-[#faf8f3]";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const headerBg = isDark
    ? "bg-slate-900/80 border-slate-800"
    : "bg-[#faf8f3]/90 border-[#ede8da]";

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${bgColor}`}>
      {/* ── Top Header Bar ──────────────────────────────────────────────── */}
      <div
        className={`sticky top-0 z-30 border-b backdrop-blur-xl ${headerBg}`}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/portal/dashboard/${orgPrefix}/agentic-campaigning`)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                isDark
                  ? "hover:bg-slate-800 text-slate-400 hover:text-white"
                  : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center">
                <Instagram className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h1
                  className={`text-sm font-semibold leading-none ${textPrimary}`}
                >
                  Instagram Creative Assistant
                </h1>
                <p className={`text-[11px] mt-0.5 ${textSecondary}`}>
                  Plan, create, and schedule posts
                </p>
              </div>
            </div>
          </div>

          {/* Right: Profile + Connection status */}
          <div className="flex items-center gap-3">
            {isConnected && (
              <>
                <a
                  href={`https://www.instagram.com/${connectedAccount?.username || ''}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    isDark
                      ? 'hover:bg-slate-800 text-slate-300 hover:text-white'
                      : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {connectedAccount?.profilePictureUrl ? (
                    <img
                      src={connectedAccount.profilePictureUrl}
                      alt="Profile"
                      className="w-6 h-6 rounded-full object-cover border-2 border-pink-500/40"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                      <Instagram className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <span className="text-xs font-semibold">
                    @{connectedAccount?.username || 'Unknown'}
                  </span>
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
                <Badge
                  className={`text-[10px] ${
                    isDark
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              </>
            )}
            <Badge className="bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 text-white border-0 text-[10px]">
              Beta
            </Badge>
          </div>
        </div>
      </div>

      {/* ── OAuth Callback Flash ────────────────────────────────────────── */}
      <AnimatePresence>
        {connectionParam && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4"
          >
            <div
              className={`rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium ${
                connectionParam === "success"
                  ? isDark
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : isDark
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {connectionParam === "success" ? (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Instagram account connected successfully! You can now
                    start creating campaigns.
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Connection failed
                    {errorParam ? `: ${decodeURIComponent(errorParam)}` : "."}
                    {" "}Please try again.
                  </span>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {isLoading ? (
          // Loading state
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-32 gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
            <p className={`text-sm ${textSecondary}`}>
              Checking connection status…
            </p>
          </motion.div>
        ) : isConnected ? (
          // Connected: show landing or workspace based on view state
          view === 'landing' ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CampaignLanding
                clientId={orgPrefix}
                onCreateNew={() => setView('workspace')}
                onBack={() => router.push(`/portal/dashboard/${orgPrefix}/agentic-campaigning`)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="workspace"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Back to campaigns button */}
              <div className="mb-4">
                <button
                  onClick={() => setView('landing')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Campaigns
                </button>
              </div>
              <ErrorAlertHandler clientId={orgPrefix} isDark={isDark} />
              <WorkspaceLayout orgId={orgPrefix} />
            </motion.div>
          )
        ) : (
          // Not connected: show onboarding
          <motion.div
            key="onboarding"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <OnboardingView orgId={orgPrefix} />
          </motion.div>
        )}
      </main>
    </div>
  );
}
