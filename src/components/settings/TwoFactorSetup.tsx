"use client";

/**
 * @file TwoFactorSetup.tsx
 * @description 2FA setup wizard that guides users through email-based two-factor authentication.
 * Steps: 1) Send OTP → 2) Enter OTP → 3) Success
 */

import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useUser, useAuth } from "@/firebase";
import { getAuthHeaders } from "@/lib/api-auth-client";
import { Shield, Mail, Loader2, Check, X, ArrowLeft, AlertTriangle } from "lucide-react";

interface TwoFactorSetupProps {
  onClose: () => void;
  onEnabled: () => void;
}

type Step = "intro" | "sending" | "verify" | "success" | "error";

export default function TwoFactorSetup({ onClose, onEnabled }: TwoFactorSetupProps) {
  const { isDarkMode } = useTheme();
  const { user } = useUser();
  const [step, setStep] = useState<Step>("intro");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on verify step
  useEffect(() => {
    if (step === "verify" && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  const handleSendOtp = async () => {
    setStep("sending");
    setErrorMessage("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/auth/send-otp", { method: "POST", headers });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to send code.");
        setStep("error");
        return;
      }
      setStep("verify");
    } catch (err: any) {
      setErrorMessage(err.message || "Network error.");
      setStep("error");
    }
  };

  const handleOtpInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1); // Only last digit
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newDigits.every(d => d.length === 1)) {
      handleVerifyOtp(newDigits.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const digits = pasted.split("");
      setOtpDigits(digits);
      handleVerifyOtp(pasted);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setIsVerifying(true);
    setErrorMessage("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Verification failed.");
        setOtpDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setIsVerifying(false);
        return;
      }
      setStep("success");
      onEnabled();
    } catch (err: any) {
      setErrorMessage(err.message || "Network error.");
      setOtpDigits(["", "", "", "", "", ""]);
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden`}>

        {/* ── Intro Step ── */}
        {step === "intro" && (
          <div className="p-8 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
              <Shield className={`w-8 h-8 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </div>
            <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              Enable Two-Factor Authentication
            </h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              We&apos;ll send a 6-digit verification code to <span className="font-semibold">{user?.email}</span>. You&apos;ll need to enter this code to complete setup.
            </p>
            <div className={`flex items-center gap-3 p-3 rounded-xl mb-6 text-left ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} border`}>
              <Mail className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              <div>
                <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Email Verification</div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>A code will be sent to your email each time you sign in.</div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={onClose} className={`px-4 py-2 text-sm font-medium rounded-lg ${isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                Cancel
              </button>
              <button onClick={handleSendOtp} className="px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors">
                Send Code
              </button>
            </div>
          </div>
        )}

        {/* ── Sending Step ── */}
        {step === "sending" && (
          <div className="p-8 text-center">
            <Loader2 className={`w-10 h-10 animate-spin mx-auto mb-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
            <h3 className={`text-base font-semibold mb-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              Sending verification code...
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Check your inbox at <span className="font-medium">{user?.email}</span>
            </p>
          </div>
        )}

        {/* ── Verify Step ── */}
        {step === "verify" && (
          <div className="p-8 text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
              <Mail className={`w-7 h-7 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </div>
            <h3 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              Enter Verification Code
            </h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              We sent a 6-digit code to <span className="font-medium">{user?.email}</span>
            </p>

            {/* OTP Input Boxes */}
            <div className="flex justify-center gap-2.5 mb-4" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpInput(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  disabled={isVerifying}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50'
                      : 'bg-white border-slate-200 text-slate-900 disabled:opacity-50'
                  } ${errorMessage ? (isDarkMode ? 'border-red-500/50' : 'border-red-300') : ''}`}
                />
              ))}
            </div>

            {errorMessage && (
              <p className="text-xs text-red-500 font-medium mb-3">{errorMessage}</p>
            )}

            {isVerifying && (
              <div className="flex items-center justify-center gap-2 mb-3">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Verifying...</span>
              </div>
            )}

            <div className="flex gap-3 justify-between items-center mt-4">
              <button onClick={onClose} className={`text-xs font-medium ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                Cancel
              </button>
              <button onClick={handleSendOtp} className={`text-xs font-medium ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}>
                Resend Code
              </button>
            </div>
          </div>
        )}

        {/* ── Success Step ── */}
        {step === "success" && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-emerald-500/10">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              2FA Enabled! 🎉
            </h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Two-factor authentication is now active on your account. You&apos;ll receive a verification code via email each time you sign in.
            </p>
            <button onClick={onClose} className="px-6 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors">
              Done
            </button>
          </div>
        )}

        {/* ── Error Step ── */}
        {step === "error" && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-red-500/10">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              Something went wrong
            </h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {errorMessage || "Unable to send verification code. Please try again."}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={onClose} className={`px-4 py-2 text-sm font-medium rounded-lg ${isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                Cancel
              </button>
              <button onClick={handleSendOtp} className="px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors">
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
