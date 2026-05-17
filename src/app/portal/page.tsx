"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { StarBackground } from "@/components/ui/star-background";
import { ArrowRight, BarChart3, GraduationCap, Sparkles } from "lucide-react";

export default function PortalChooserPage() {
  const router = useRouter();

  // Force dark mode on this page
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => { document.documentElement.classList.remove("dark"); };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 relative overflow-hidden">
      <Header />
      <StarBackground />

      <main className="flex-grow flex items-center justify-center px-4 pt-24 pb-16 relative z-10">
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-6 duration-700">

          {/* Title */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Client Portal
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-3">
              Choose Your Platform
            </h1>
            <p className="text-slate-400 text-lg max-w-md mx-auto">
              Select the workspace you&apos;d like to access.
            </p>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-2 gap-6">

            {/* INSiGHT Card */}
            <Link
              href="/portal/login/insight"
              className="group relative flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-8 transition-all duration-300 hover:border-indigo-500/40 hover:bg-indigo-500/[0.06] hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 cursor-pointer"
            >
              {/* Glow */}
              <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-indigo-500/20 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <div className="relative z-10 flex flex-col h-full">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 group-hover:bg-indigo-500/20 transition-colors">
                  <BarChart3 className="w-7 h-7 text-indigo-400" />
                </div>

                <h2 className="text-2xl font-black text-white tracking-tight mb-1">
                  INS<span className="lowercase">i</span>GHT
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-8 flex-1">
                  Enterprise dashboard with CRM, analytics, AI agents, and business intelligence tools.
                </p>

                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-400 group-hover:text-indigo-300 transition-colors">
                  Sign in to INSiGHT
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* DRiVE Card */}
            <Link
              href="/portal/login/drive"
              className="group relative flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-8 transition-all duration-300 hover:border-orange-500/40 hover:bg-orange-500/[0.06] hover:shadow-2xl hover:shadow-orange-500/10 hover:-translate-y-1 cursor-pointer"
            >
              {/* Glow */}
              <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-orange-500/20 via-transparent to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <div className="relative z-10 flex flex-col h-full">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6 group-hover:bg-orange-500/20 transition-colors">
                  <GraduationCap className="w-7 h-7 text-orange-400" />
                </div>

                <h2 className="text-2xl font-black text-white tracking-tight mb-1">
                  DR<span className="lowercase">i</span>VE
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-8 flex-1">
                  Interactive learning management system with multimedia courses, voice narration, and AI-powered notes.
                </p>

                <div className="flex items-center gap-2 text-sm font-semibold text-orange-400 group-hover:text-orange-300 transition-colors">
                  Sign in to DRiVE
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

          </div>

          {/* Footer text */}
          <p className="text-center text-xs text-slate-600 mt-10 font-medium">
            Both platforms use the same secure single sign-on. Your credentials work across all SOL Theory services.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
