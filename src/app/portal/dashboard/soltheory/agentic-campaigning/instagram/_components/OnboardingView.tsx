"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Instagram,
  UserCog,
  Link2,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/firebase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnboardingViewProps {
  /** Organization slug used to build the OAuth state, e.g. "soltheory" */
  orgId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingView({ orgId }: OnboardingViewProps) {
  const { user } = useUser();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Sync dark mode from localStorage (matches dashboard convention)
  useEffect(() => {
    const saved = localStorage.getItem("insight_theme");
    if (saved === "dark") setIsDarkMode(true);
    const handler = (e: StorageEvent) => {
      if (e.key === "insight_theme") setIsDarkMode(e.newValue === "dark");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Build the OAuth redirect URL
  const handleAuthorize = () => {
    if (!user?.uid) return;
    setIsRedirecting(true);

    const appUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";

    const state = btoa(
      JSON.stringify({ uid: user.uid, origin: orgId })
    );

    const redirectUri = `${appUrl}/api/auth/instagram/callback`;

    // Redirect to Facebook OAuth Dialog (Facebook Login for Business)
    const fbOAuthUrl =
      `https://www.facebook.com/v20.0/dialog/oauth?` +
      new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_META_APP_ID || "",
        redirect_uri: redirectUri,
        state,
        config_id: "1000741799470765",
        response_type: "code",
      }).toString();

    window.location.href = fbOAuthUrl;

    // Fallback: re-enable button if redirect didn't happen (popup blocker, etc.)
    setTimeout(() => setIsRedirecting(false), 5000);
  };

  // ---------------------------------------------------------------------------
  // Onboarding Steps
  // ---------------------------------------------------------------------------

  const steps = [
    {
      id: "professional-account",
      number: 1,
      icon: <UserCog className="w-5 h-5" />,
      title: "Switch to a Professional Account",
      content: (
        <div className="space-y-3">
          <p className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            Instagram requires a <strong>Business</strong> or <strong>Creator</strong> account
            to access publishing APIs. A personal account won't work.
          </p>
          <ol className={`text-sm space-y-2 list-decimal list-inside ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            <li>Open the <strong>Instagram</strong> app on your phone.</li>
            <li>
              Go to <strong>Settings</strong> →{" "}
              <strong>Account type and tools</strong> →{" "}
              <strong>Switch to Professional Account</strong>.
            </li>
            <li>
              Choose <strong>Business</strong> (recommended for brands) or{" "}
              <strong>Creator</strong>.
            </li>
            <li>Follow the prompts and select a category for your page.</li>
          </ol>
          <a
            href="https://help.instagram.com/502981923235522"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-pink-500 hover:text-pink-400 transition-colors mt-1"
          >
            <ExternalLink className="w-3 h-3" />
            Instagram Help Center
          </a>
        </div>
      ),
    },
    {
      id: "facebook-page",
      number: 2,
      icon: <Link2 className="w-5 h-5" />,
      title: "Connect to a Facebook Page",
      content: (
        <div className="space-y-3">
          <p className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            Instagram's publishing API works through a linked Facebook Page.
            Your Instagram Business Account must be connected to a Page you
            manage.
          </p>
          <ol className={`text-sm space-y-2 list-decimal list-inside ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            <li>
              Open <strong>Facebook</strong> and navigate to the Page you want
              to link.
            </li>
            <li>
              Go to <strong>Page Settings</strong> →{" "}
              <strong>Linked Accounts</strong> (or{" "}
              <strong>Instagram</strong> in the left sidebar).
            </li>
            <li>
              Click <strong>Connect Account</strong> and log in with the
              Instagram credentials you used in Step 1.
            </li>
            <li>
              Confirm the connection. Your Instagram profile will now appear
              under the Page's linked accounts.
            </li>
          </ol>
          <a
            href="https://www.facebook.com/business/help/connect-instagram-to-page"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-pink-500 hover:text-pink-400 transition-colors mt-1"
          >
            <ExternalLink className="w-3 h-3" />
            Facebook Business Help
          </a>
        </div>
      ),
    },
    {
      id: "permissions",
      number: 3,
      icon: <ShieldCheck className="w-5 h-5" />,
      title: "Verify Meta Permissions",
      content: (
        <div className="space-y-3">
          <p className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            The person authorizing the connection must have{" "}
            <strong>Admin</strong> or <strong>Editor</strong> permissions on the
            linked Facebook Page. Without these permissions, the OAuth flow
            will fail to retrieve the required page tokens.
          </p>
          <ol className={`text-sm space-y-2 list-decimal list-inside ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            <li>
              Open your Facebook Page and go to{" "}
              <strong>Settings</strong> → <strong>Page Roles</strong>.
            </li>
            <li>
              Verify your account is listed as an <strong>Admin</strong> or{" "}
              <strong>Editor</strong>.
            </li>
            <li>
              If you don't have the right role, ask the current Page Admin to
              update your permissions.
            </li>
          </ol>
          <div
            className={`flex items-start gap-2 mt-3 p-3 rounded-lg text-xs leading-relaxed ${
              isDarkMode
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Tip:</strong> If your organization manages multiple
              Pages, only the Page linked to your Instagram Business Account
              will be used for publishing.
            </span>
          </div>
        </div>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className={`w-full min-h-full flex flex-col items-center px-4 py-10 sm:py-16 ${
        isDarkMode ? "bg-slate-950" : "bg-slate-50/50"
      }`}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-xl"
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* Gradient icon badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center text-white shadow-lg shadow-pink-500/20 mb-5"
          >
            <Instagram className="w-8 h-8" />
          </motion.div>

          <h1
            className={`text-2xl font-bold tracking-tight mb-2 ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            Link Your Instagram Account
          </h1>
          <p
            className={`text-sm leading-relaxed max-w-md ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Complete the steps below to connect your Instagram Business Account
            through Meta's secure authorization flow.
          </p>
        </div>

        {/* ── Checklist Card ─────────────────────────────────────────── */}
        <div
          className={`rounded-2xl border overflow-hidden ${
            isDarkMode
              ? "bg-slate-900 border-slate-800"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          {/* Card header */}
          <div
            className={`px-6 py-4 border-b flex items-center justify-between ${
              isDarkMode ? "border-slate-800" : "border-slate-100"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles
                className={`w-4 h-4 ${
                  isDarkMode ? "text-pink-400" : "text-pink-500"
                }`}
              />
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Setup Checklist
              </span>
            </div>
            <Badge className="bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 text-white border-0 text-[10px]">
              3 Steps
            </Badge>
          </div>

          {/* Accordion steps */}
          <Accordion type="single" collapsible defaultValue="professional-account">
            {steps.map((step, index) => (
              <AccordionItem
                key={step.id}
                value={step.id}
                className={`border-b last:border-b-0 ${
                  isDarkMode ? "border-slate-800" : "border-slate-100"
                }`}
              >
                <AccordionTrigger
                  className={`px-6 py-4 hover:no-underline group ${
                    isDarkMode
                      ? "text-slate-200 hover:text-white"
                      : "text-slate-800 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Step number circle */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isDarkMode
                          ? "bg-slate-800 text-slate-400 group-hover:bg-pink-500/20 group-hover:text-pink-400"
                          : "bg-slate-100 text-slate-500 group-hover:bg-pink-50 group-hover:text-pink-600"
                      }`}
                    >
                      {step.number}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`${
                          isDarkMode ? "text-slate-500" : "text-slate-400"
                        } group-hover:text-pink-500 transition-colors`}
                      >
                        {step.icon}
                      </span>
                      <span className="text-sm font-semibold">{step.title}</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pl-[4.25rem]">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {step.content}
                  </motion.div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* ── CTA Button ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mt-6"
        >
          <button
            onClick={handleAuthorize}
            disabled={isRedirecting || !user}
            className={`
              group relative w-full flex items-center justify-center gap-2.5
              px-6 py-3.5 rounded-xl text-sm font-semibold text-white
              bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400
              shadow-lg shadow-pink-500/20
              hover:shadow-xl hover:shadow-pink-500/30
              hover:brightness-110
              active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg
              transition-all duration-200
            `}
          >
            {isRedirecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting to Meta…
              </>
            ) : (
              <>
                <Instagram className="w-4 h-4" />
                Authorize Account Connection
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>

          <p
            className={`text-center text-[11px] mt-3 ${
              isDarkMode ? "text-slate-600" : "text-slate-400"
            }`}
          >
            You will be redirected to Meta to grant permissions. We only request
            the access needed for scheduling posts.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
