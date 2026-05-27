"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { StarBackground } from "@/components/ui/star-background";
import {
  BarChart3,
  GraduationCap,
  Sparkles,
  ChevronDown,
  LogIn,
  UserPlus,
  Zap,
  Bot,
  LineChart,
  BookOpen,
  Mic,
  StickyNote,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type PlatformId = "insight" | "drive";

interface Platform {
  id: PlatformId;
  name: string;
  nameJsx: React.ReactNode;
  tagline: string;
  description: string;
  features: { icon: React.ReactNode; label: string }[];
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
  accentGlow: string;
  icon: React.ReactNode;
  loginHref: string;
}

const platforms: Platform[] = [
  {
    id: "insight",
    name: "INSiGHT",
    nameJsx: (
      <>
        INS<span className="lowercase">i</span>GHT
      </>
    ),
    tagline: "Enterprise Intelligence Platform",
    description:
      "Your unified command center for CRM, real-time analytics, AI-powered agents, and business intelligence. Designed for organizations that need powerful automation and data-driven decision making.",
    features: [
      { icon: <LineChart className="w-3.5 h-3.5" />, label: "CRM & Pipeline Analytics" },
      { icon: <Bot className="w-3.5 h-3.5" />, label: "AI Agent Manager" },
      { icon: <Zap className="w-3.5 h-3.5" />, label: "Agentic Automation" },
    ],
    accentColor: "indigo",
    accentBg: "bg-indigo-500/10",
    accentBorder: "border-indigo-500/20",
    accentText: "text-indigo-400",
    accentGlow: "from-indigo-500/20 via-transparent to-purple-500/10",
    icon: <BarChart3 className="w-6 h-6 text-indigo-400" />,
    loginHref: "/portal/login/insight",
  },
  {
    id: "drive",
    name: "DRiVE",
    nameJsx: (
      <>
        DR<span className="lowercase">i</span>VE
      </>
    ),
    tagline: "Interactive Learning System",
    description:
      "An immersive learning management platform with multimedia courses, AI voice narration, smart note cleanup, and community collaboration. Built for growth-focused education.",
    features: [
      { icon: <BookOpen className="w-3.5 h-3.5" />, label: "Interactive Slide Courses" },
      { icon: <Mic className="w-3.5 h-3.5" />, label: "AI Voice Narration" },
      { icon: <StickyNote className="w-3.5 h-3.5" />, label: "Smart Notes with AI" },
    ],
    accentColor: "orange",
    accentBg: "bg-orange-500/10",
    accentBorder: "border-orange-500/20",
    accentText: "text-orange-400",
    accentGlow: "from-orange-500/20 via-transparent to-amber-500/10",
    icon: <GraduationCap className="w-6 h-6 text-orange-400" />,
    loginHref: "/portal/login/drive",
  },
];

export default function PortalChooserPage() {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<PlatformId | null>(null);

  // Force dark mode on this page
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  const toggleExpand = (id: PlatformId) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 relative overflow-hidden">
      <Header />

      {/* Subtle star background — reduced opacity for professionalism */}
      <div className="opacity-15">
        <StarBackground />
      </div>

      <main className="flex-grow flex items-center justify-center px-4 pt-24 pb-16 relative z-10">
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-6 duration-700">
          {/* Title */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
              SOL Theory Network
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-3">
              Choose Your Platform
            </h1>
            <p className="text-slate-400 text-base max-w-md mx-auto leading-relaxed">
              Select the workspace you&apos;d like to access.
            </p>
          </div>

          {/* Accordion List */}
          <div className="flex flex-col gap-3">
            {platforms.map((platform) => {
              const isExpanded = expandedId === platform.id;

              return (
                <div key={platform.id} className="relative group">
                  {/* Hover glow — visible on hover or when expanded */}
                  <div
                    className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${platform.accentGlow} transition-opacity duration-500 pointer-events-none ${
                      isExpanded ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                    }`}
                  />

                  <div
                    className={`relative rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                      isExpanded
                        ? `border-white/15 bg-white/[0.04] backdrop-blur-md`
                        : "border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.035]"
                    }`}
                  >
                    {/* Collapsed Header Row */}
                    <button
                      onClick={() => toggleExpand(platform.id)}
                      className="w-full flex items-center gap-4 px-5 py-4 md:px-6 md:py-5 text-left focus:outline-none"
                    >
                      {/* Logo Placeholder */}
                      <div
                        className={`w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-xl ${platform.accentBg} border ${platform.accentBorder} flex items-center justify-center backdrop-blur-sm transition-colors duration-300`}
                      >
                        {platform.icon}
                      </div>

                      {/* Title & Tagline */}
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg md:text-xl font-black text-white tracking-tight">
                          {platform.nameJsx}
                        </h2>
                        <p className="text-xs md:text-sm text-slate-400 font-medium truncate">
                          {platform.tagline}
                        </p>
                      </div>

                      {/* Chevron */}
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="shrink-0"
                      >
                        <ChevronDown
                          className={`w-5 h-5 transition-colors duration-300 ${
                            isExpanded ? platform.accentText : "text-slate-500"
                          }`}
                        />
                      </motion.div>
                    </button>

                    {/* Expanded Content */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key={`expanded-${platform.id}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 md:px-6 md:pb-6">
                            {/* Divider */}
                            <div className="h-px bg-white/8 mb-5" />

                            {/* Description */}
                            <p className="text-sm text-slate-300 leading-relaxed mb-5">
                              {platform.description}
                            </p>

                            {/* Features */}
                            <div className="flex flex-wrap gap-2 mb-6">
                              {platform.features.map((feat, i) => (
                                <div
                                  key={i}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${platform.accentBg} border ${platform.accentBorder} text-xs font-medium ${platform.accentText}`}
                                >
                                  {feat.icon}
                                  {feat.label}
                                </div>
                              ))}
                            </div>

                            {/* Actions — Bottom Right */}
                            <div className="flex items-center justify-end gap-3">
                              <Link
                                href="/contact"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-slate-300 hover:bg-white/[0.06] hover:border-white/15 hover:text-white transition-all duration-200"
                              >
                                <UserPlus className="w-4 h-4" />
                                Sign Up
                              </Link>
                              <Link
                                href={platform.loginHref}
                                onClick={(e) => e.stopPropagation()}
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 shadow-lg ${
                                  platform.id === "insight"
                                    ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"
                                    : "bg-orange-600 hover:bg-orange-700 shadow-orange-500/20"
                                }`}
                              >
                                <LogIn className="w-4 h-4" />
                                Log In
                              </Link>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer text */}
          <p className="text-center text-xs text-slate-600 mt-10 font-medium">
            Both platforms use the same secure single sign-on. Your credentials
            work across all SOL Theory services.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
