"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { Eye, EyeOff, Lock, Mail, ArrowRight, GraduationCap, Loader2, ChevronLeft } from "lucide-react";
import { useAuth } from "@/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import Link from "next/link";

export default function DriveLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const auth = useAuth();

  // Force dark mode on this page
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => { document.documentElement.classList.remove("dark"); };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setError("Please fill in all fields.");
    if (!auth) return setError("Authentication is still loading. Please try again.");
    setIsLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);

      const emailLower = email.toLowerCase();
      if (emailLower.endsWith("@soltheory.com") || emailLower.endsWith("@nxtchapter.org")) {
        // For now, DRiVE redirects to a placeholder — will be replaced with actual DRiVE app route
        router.push("/portal/dashboard/soltheory");
      } else {
        await signOut(auth);
        throw new Error("Unauthorized organization");
      }
    } catch (err: any) {
      console.error(err);
      setError("Invalid credentials or unauthorized organization.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header />
      <main className="flex-grow flex items-stretch pt-24">
        <div className="w-full lg:grid lg:grid-cols-2">

          {/* Left Column - Branding */}
          <div className="hidden lg:flex flex-col justify-between bg-zinc-950 p-12 text-white relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-br from-orange-500/20 via-amber-500/15 to-transparent blur-3xl rounded-full z-0 pointer-events-none" />

            <div className="z-10 relative space-y-6 max-w-lg mt-12">
              <Link href="/portal" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-4">
                <ChevronLeft className="w-4 h-4" />
                Back to portal
              </Link>

              <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-orange-500/20 mb-8 shadow-2xl">
                <GraduationCap className="w-8 h-8 text-orange-400" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight leading-tight">
                SOL <span className="text-orange-400">DR<span className="lowercase">i</span>VE</span>
              </h1>
              <p className="text-zinc-400 text-lg leading-relaxed">
                Your interactive learning experience. Access multimedia courses with voice narration, AI-powered note cleanup, and community collaboration tools.
              </p>
              <div className="pt-8 flex flex-col gap-4">
                <div className="flex items-center gap-4 text-sm text-zinc-300 font-medium">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-inner"><ArrowRight className="w-5 h-5 text-orange-400" /></div>
                  Interactive Slide Courses
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-300 font-medium">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-inner"><ArrowRight className="w-5 h-5 text-orange-400" /></div>
                  AI Voice Narration & Highlighting
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-300 font-medium">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-inner"><ArrowRight className="w-5 h-5 text-orange-400" /></div>
                  Smart Notes with AI Cleanup
                </div>
              </div>
            </div>

            <div className="z-10 relative mt-auto text-sm text-zinc-600 font-medium">
              &copy; {new Date().getFullYear()} SOL Theory. All rights reserved.
            </div>
          </div>

          {/* Right Column - Login Form */}
          <div className="flex items-center justify-center p-8 lg:p-12 xl:p-24 bg-slate-950">
            <div className="w-full max-w-[420px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="space-y-2 text-center lg:text-left">
                <div className="flex items-center gap-3 mb-4 justify-center lg:justify-start">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center lg:hidden">
                    <GraduationCap className="w-5 h-5 text-orange-400" />
                  </div>
                  <span className="text-sm font-bold text-orange-400 uppercase tracking-widest lg:hidden">DRiVE</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-white">Welcome back</h2>
                <p className="text-slate-400">Sign in to your DRiVE workspace.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6 mt-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Organization Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <Input
                        type="email"
                        placeholder="name@organization.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(""); }}
                        className="pl-11 h-12 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-orange-500 rounded-xl transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Password</label>
                      <a href="#" className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors">Forgot password?</a>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                        className="pl-11 pr-11 h-12 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-orange-500 rounded-xl transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 font-medium animate-in slide-in-from-top-1">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={isLoading} className="w-full h-12 text-base font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-500/25 transition-all">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign in to DRiVE"}
                </Button>
              </form>

              <div className="text-center">
                <Link href="/portal" className="text-sm text-slate-500 hover:text-slate-300 transition-colors font-medium">
                  ← Back to platform selection
                </Link>
              </div>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
