"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { useDemoGating } from "@/hooks/useDemoGating";
import { getOrgLabel } from "@/lib/org-config";
import Link from "next/link";
import { 
  ShoppingBag, Sparkles, Check, ArrowRight, ShieldCheck, 
  Bot, Brain, Users, BarChart3, Mail, FileText, Lock, 
  Building2, Key, HelpCircle, AlertCircle
} from "lucide-react";

export default function StorePage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "personal";
  const { isDarkMode } = useTheme();
  const { isDemo } = useDemoGating();

  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [inviteError, setInviteError] = useState("");

  const handleRedeemInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteCodeInput.trim();
    if (!trimmed) {
      setInviteError("Please enter an invite link or token.");
      return;
    }

    // Support full URLs or raw tokens
    let token = trimmed;
    if (trimmed.includes("invite=")) {
      const match = trimmed.match(/[?&]invite=([^&#]+)/);
      if (match && match[1]) token = match[1];
    } else if (trimmed.includes("/")) {
      token = trimmed.split("/").pop() || trimmed;
    }

    setInviteError("");
    router.push(`/portal/signup?invite=${encodeURIComponent(token)}`);
  };

  return (
    <div className={`min-h-full p-4 sm:p-8 transition-colors ${isDarkMode ? "bg-slate-900 text-slate-100" : "bg-[#faf8f5] text-slate-900"}`}>
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header Hero */}
        <div className="space-y-4 text-center max-w-3xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-500/10 to-fuchsia-500/10 border border-indigo-500/20 text-indigo-400">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
            <span>Private Beta Preview</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            INSiGHT Marketplace & Store
          </h1>

          <p className={`text-sm sm:text-base leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            We are currently in <strong className="font-semibold text-indigo-400">private beta</strong>. Organization invitations from verified administrators are currently the primary way to unlock full INSiGHT capabilities, premium AI models, and enterprise tool suites.
          </p>
        </div>

        {/* Quick Redeem Invite Box (Visible to everyone, especially helpful for Demo users) */}
        <div className={`rounded-2xl p-6 sm:p-8 border shadow-xl ${isDarkMode ? "bg-slate-800/80 border-slate-700/80 shadow-slate-950/40" : "bg-white border-[#ede8da] shadow-[#ede8da]/50"}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2 text-indigo-500 font-semibold text-sm">
                <Key className="w-4 h-4" />
                <span>Have an Organization Invite?</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold">
                Redeem your invite link or access token
              </h2>
              <p className={`text-xs sm:text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                If an administrator from your organization provided you with an invite link or token, paste it here to immediately upgrade your account.
              </p>
            </div>

            <form onSubmit={handleRedeemInvite} className="w-full md:w-auto flex-1 max-w-md space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste invite link or token..."
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value)}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                    isDarkMode 
                      ? "bg-slate-900/90 border-slate-700 text-white placeholder-slate-500" 
                      : "bg-[#faf8f5] border-[#e2dcd0] text-slate-900 placeholder-slate-400"
                  }`}
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/25 shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Redeem</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {inviteError && (
                <div className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{inviteError}</span>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Upcoming Packages / Tool Tiers Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Upcoming Tool Packages & Plans</h3>
            <span className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Self-serve billing arriving soon</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Core Workspace */}
            <div className={`rounded-2xl p-6 border flex flex-col justify-between transition-all hover:border-indigo-500/50 ${
              isDarkMode ? "bg-slate-800/60 border-slate-700/70" : "bg-white border-[#ede8da]"
            }`}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Core Workspace
                  </span>
                  <span className="text-xs text-slate-500">Per-Seat</span>
                </div>

                <div>
                  <h4 className="text-xl font-bold">AI Copilot & Agents</h4>
                  <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                    Personal AI assistance with real-time memory and smart tools.
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Claude Opus 5, GPT-5.6, Gemini 3.5 Flash</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>P.A.C.T. Learned Conversational Memory</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Personal AI Brain Guided Profile</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Action Board & Timesheet Tracker</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-700/40">
                {isDemo ? (
                  <button 
                    onClick={() => {
                      const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                      input?.focus();
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                  >
                    Requires Org Invite
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-400 py-2">
                    <Check className="w-4 h-4" /> Active on your organization
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Operations & Intelligence */}
            <div className={`rounded-2xl p-6 border flex flex-col justify-between relative transition-all ring-2 ring-indigo-500/40 shadow-lg ${
              isDarkMode ? "bg-slate-800 border-indigo-500/40 shadow-indigo-950/30" : "bg-white border-indigo-400 shadow-indigo-100"
            }`}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white">
                    Flagship Suite
                  </span>
                  <span className="text-xs text-indigo-400 font-semibold">Team Edition</span>
                </div>

                <div>
                  <h4 className="text-xl font-bold">Intelligence & CRM</h4>
                  <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                    Full commercial relationship tracking, analytics, and marketing.
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>CRM Contact Database & AI Chat</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Business Intelligence & Revenue Forecasts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Smart Email & Calendar Dispatch</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Agentic Campaigning (Instagram / Ads)</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-700/40">
                {isDemo ? (
                  <button 
                    onClick={() => {
                      const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                      input?.focus();
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    Upgrade via Org Invite
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-400 py-2">
                    <Check className="w-4 h-4" /> Active on your organization
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Enterprise Solutions */}
            <div className={`rounded-2xl p-6 border flex flex-col justify-between transition-all hover:border-indigo-500/50 ${
              isDarkMode ? "bg-slate-800/60 border-slate-700/70" : "bg-white border-[#ede8da]"
            }`}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Enterprise
                  </span>
                  <span className="text-xs text-slate-500">Custom</span>
                </div>

                <div>
                  <h4 className="text-xl font-bold">Enterprise Operations</h4>
                  <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                    Tailored governance, native PDF forms, and custom blueprints.
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Shared Org AI Brain & Document Ingestion</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>AcroForm PDF Auto-Fill & Legal Signatures</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Custom Onboarding Role Suppression</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Dedicated SLA & White-Label Customization</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-700/40">
                <a 
                  href="mailto:lucas@soltheory.com?subject=Enterprise%20INSiGHT%20Inquiry"
                  className="w-full py-2.5 rounded-xl text-xs font-semibold border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Contact Sales</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

          </div>
        </div>

        {/* Enterprise Support Banner */}
        <div className={`rounded-2xl p-6 border flex flex-col sm:flex-row items-center justify-between gap-4 ${
          isDarkMode ? "bg-slate-800/40 border-slate-700/60" : "bg-[#f2efe8] border-[#e0ddd4]"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h5 className="font-semibold text-sm">Need organization seats for your nonprofit or company?</h5>
              <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                We work directly with founders and executive directors to provision dedicated instances and custom blueprints.
              </p>
            </div>
          </div>

          <a 
            href="mailto:lucas@soltheory.com?subject=Organization%20Onboarding%20Request"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shrink-0 whitespace-nowrap"
          >
            Request Org Provisioning
          </a>
        </div>

      </div>
    </div>
  );
}
