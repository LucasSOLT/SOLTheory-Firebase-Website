"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";
import { Eye, EyeOff, Lock, Mail, ArrowRight, BarChart3, Loader2, ChevronLeft } from "lucide-react";
import { useAuth, useFirestore } from "@/firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { logActivity } from '@/lib/activity-logger';
import { getDefaultAccessLevel } from '@/lib/rbac';
import Link from "next/link";

export default function InsightLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginCube, setShowLoginCube] = useState(false);
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();

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
      const cred = await signInWithEmailAndPassword(auth, email, password);
      logActivity(firestore, 'login', { email, displayName: cred.user?.displayName });

      // Show loading cube immediately
      setShowLoginCube(true);

      // Upsert user profile in Firestore
      try {
        const uid = cred.user.uid;
        const userRef = doc(firestore, 'users', uid);
        const userSnap = await getDoc(userRef);
        const displayName = cred.user.displayName || '';
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        if (userSnap.exists()) {
          // Update last login and display info
          await setDoc(userRef, {
            email: email.toLowerCase(),
            displayName,
            firstName,
            lastName,
            lastLogin: serverTimestamp(),
          }, { merge: true });
        } else {
          // First login — create full profile (include `id` field required by Firestore rules)
          await setDoc(userRef, {
            id: uid,
            email: email.toLowerCase(),
            displayName,
            firstName,
            lastName,
            accessLevel: getDefaultAccessLevel(email.toLowerCase()),
            lastLogin: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
        }
      } catch (profileErr) {
        console.warn('[Login] Failed to upsert user profile:', profileErr);
      }

      const emailLower = email.toLowerCase();
      if (emailLower.endsWith("@soltheory.com")) {
        router.push("/portal/dashboard/soltheory");
      } else if (emailLower.endsWith("@nxtchapter.org")) {
        router.push("/portal/dashboard/nxtchapter");
      } else {
        // Check Firestore for org mapping (for Gmail and other external users)
        try {
          const uid = cred.user.uid;
          const userRef = doc(firestore, 'users', uid);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : null;
          const mappedOrg = userData?.organization;

          if (mappedOrg === "soltheory") {
            router.push("/portal/dashboard/soltheory");
          } else if (mappedOrg === "nxtchapter") {
            router.push("/portal/dashboard/nxtchapter");
          } else {
            console.error("[Login] No org mapping found for user:", uid, "data:", userData);
            await signOut(auth);
            throw new Error("Unauthorized organization");
          }
        } catch (orgErr: any) {
          if (orgErr.message === "Unauthorized organization") throw orgErr;
          console.error("Error checking org mapping:", orgErr);
          await signOut(auth);
          throw new Error("Unauthorized organization");
        }
      }
    } catch (err: any) {
      console.error("[Login] Full error:", err?.code, err?.message);
      if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password" || err?.code === "auth/user-not-found") {
        setError("Invalid email or password.");
      } else if (err?.message === "Unauthorized organization") {
        setError("Your account is not linked to an organization. Contact an admin.");
      } else {
        setError("Invalid credentials or unauthorized organization.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      {/* ── Fullscreen Loading Cube (shown immediately on successful auth) ── */}
      {showLoginCube && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
          }}
        >
          <p
            style={{
              fontSize: "13px",
              fontWeight: 500,
              letterSpacing: "0.15em",
              textTransform: "uppercase" as const,
              marginBottom: "28px",
              color: "rgba(165, 180, 252, 0.8)",
              animation: "loginTextPulse 2s ease-in-out infinite",
            }}
          >
            Loading
          </p>
          <div className="login-cube-scene">
            <div className="login-cube">
              <div className="login-cube-face login-cf-front" />
              <div className="login-cube-face login-cf-back" />
              <div className="login-cube-face login-cf-right" />
              <div className="login-cube-face login-cf-left" />
              <div className="login-cube-face login-cf-top" />
              <div className="login-cube-face login-cf-bottom" />
            </div>
          </div>
          <div
            style={{
              marginTop: "32px",
              width: "200px",
              height: "3px",
              borderRadius: "2px",
              overflow: "hidden",
              background: "rgba(99, 102, 241, 0.15)",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: "2px",
                background: "linear-gradient(90deg, #6366f1, #818cf8, #a78bfa)",
                animation: "loginProgressFill 5s linear forwards",
                width: "0%",
              }}
            />
          </div>
          <style>{`
            @keyframes loginTextPulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
            @keyframes loginProgressFill { 0% { width: 0%; } 100% { width: 100%; } }
            .login-cube-scene { width: 64px; height: 64px; perspective: 400px; }
            .login-cube {
              width: 100%; height: 100%; position: relative;
              transform-style: preserve-3d;
              animation: loginCubeRotate 6s ease-in-out infinite;
            }
            .login-cube-face {
              position: absolute; width: 64px; height: 64px; border-radius: 10px;
              border: 1.5px solid rgba(129, 140, 248, 0.25);
              background: linear-gradient(135deg, rgba(99,102,241,0.35) 0%, rgba(129,140,248,0.2) 50%, rgba(167,139,250,0.35) 100%);
              backdrop-filter: blur(4px);
              box-shadow: inset 0 0 20px rgba(99,102,241,0.1), 0 0 15px rgba(99,102,241,0.08);
            }
            .login-cf-front  { transform: translateZ(32px); }
            .login-cf-back   { transform: rotateY(180deg) translateZ(32px); }
            .login-cf-right  { transform: rotateY(90deg) translateZ(32px); }
            .login-cf-left   { transform: rotateY(-90deg) translateZ(32px); }
            .login-cf-top    { transform: rotateX(90deg) translateZ(32px); }
            .login-cf-bottom { transform: rotateX(-90deg) translateZ(32px); }
            @keyframes loginCubeRotate {
              0%, 10%   { transform: rotateX(-25deg) rotateY(0deg); }
              15%, 25%  { transform: rotateX(-25deg) rotateY(90deg); }
              30%, 40%  { transform: rotateX(-25deg) rotateY(180deg); }
              45%, 55%  { transform: rotateX(-25deg) rotateY(270deg); }
              60%, 70%  { transform: rotateX(-25deg) rotateY(360deg) rotateZ(5deg); }
              75%, 85%  { transform: rotateX(-25deg) rotateY(450deg) rotateZ(0deg); }
              90%, 100% { transform: rotateX(-25deg) rotateY(540deg); }
            }
          `}</style>
        </div>
      )}
      <Header />
      <main className="flex-grow flex items-stretch pt-24">
        <div className="w-full lg:grid lg:grid-cols-2">

          {/* Left Column - Branding */}
          <div className="hidden lg:flex flex-col justify-between bg-zinc-950 p-12 text-white relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-transparent blur-3xl rounded-full z-0 pointer-events-none" />

            <div className="z-10 relative space-y-6 max-w-lg mt-12">
              <Link href="/portal" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-4">
                <ChevronLeft className="w-4 h-4" />
                Back to portal
              </Link>

              <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-indigo-500/20 mb-8 shadow-2xl">
                <BarChart3 className="w-8 h-8 text-indigo-400" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight leading-tight">
                SOL <span className="text-indigo-400">INS<span className="lowercase">i</span>GHT</span>
              </h1>
              <p className="text-zinc-400 text-lg leading-relaxed">
                Your enterprise command center. Access CRM, real-time analytics, AI agents, and business intelligence tools — all from a single, unified workspace.
              </p>
              <div className="pt-8 flex flex-col gap-4">
                <div className="flex items-center gap-4 text-sm text-zinc-300 font-medium">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-inner"><ArrowRight className="w-5 h-5 text-indigo-400" /></div>
                  CRM & Pipeline Management
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-300 font-medium">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-inner"><ArrowRight className="w-5 h-5 text-indigo-400" /></div>
                  AI Agent Manager
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-300 font-medium">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-inner"><ArrowRight className="w-5 h-5 text-indigo-400" /></div>
                  Business Intelligence & Analytics
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
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center lg:hidden">
                    <BarChart3 className="w-5 h-5 text-indigo-400" />
                  </div>
                  <span className="text-sm font-bold text-indigo-400 uppercase tracking-widest lg:hidden">INSiGHT</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-white">Welcome back</h2>
                <p className="text-slate-400">Sign in to your INSiGHT workspace.</p>
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
                        className="pl-11 h-12 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500 rounded-xl transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Password</label>
                      <a href="#" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">Forgot password?</a>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                        className="pl-11 pr-11 h-12 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500 rounded-xl transition-all"
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

                <Button type="submit" disabled={isLoading} className="w-full h-12 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/25 transition-all">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign in to INSiGHT"}
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
