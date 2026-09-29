"use client";

import React, { useState, useEffect } from "react";
import { Bell, BellOff, BellRing, Check, Loader2, X } from "lucide-react";
import {
  isPushNotificationSupported,
  getPushPermissionState,
  enablePushNotifications,
  disablePushNotifications,
  type PushPermissionState,
} from "@/lib/push-notifications";

interface PushPromptProps {
  variant?: "banner" | "button" | "card";
  onEnabled?: () => void;
  className?: string;
}

export function PushNotificationPrompt({
  variant = "banner",
  onEnabled,
  className = "",
}: PushPromptProps) {
  const [supported, setSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<PushPermissionState>("unsupported");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const isSupp = isPushNotificationSupported();
    setSupported(isSupp);
    if (isSupp) {
      setPermission(getPushPermissionState());
      const wasDismissed = localStorage.getItem("sol_push_prompt_dismissed") === "true";
      setDismissed(wasDismissed);
    }
  }, []);

  if (!supported) return null;
  if (permission === "granted" && variant === "banner") return null;
  if (dismissed && variant === "banner") return null;

  const handleEnable = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await enablePushNotifications();
      if (res.success) {
        setPermission("granted");
        setStatusMessage("Notifications activated!");
        if (onEnabled) onEnabled();
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage(res.error || "Failed to enable notifications");
      }
    } catch (err: any) {
      setStatusMessage(err?.message || "Error enabling push notifications");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("sol_push_prompt_dismissed", "true");
  };

  const handleToggle = async () => {
    if (permission === "granted") {
      setIsLoading(true);
      await disablePushNotifications();
      setPermission("default");
      setIsLoading(false);
    } else {
      await handleEnable();
    }
  };

  // Button variant for Settings or Top Nav
  if (variant === "button") {
    const isGranted = permission === "granted";
    return (
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
          isGranted
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
            : "bg-indigo-600 hover:bg-indigo-500 text-white border-transparent shadow-sm"
        } ${className}`}
        title={isGranted ? "Push notifications are active" : "Enable push notifications"}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isGranted ? (
          <>
            <BellRing className="w-3.5 h-3.5 text-emerald-400" />
            <span>Push Active</span>
          </>
        ) : (
          <>
            <Bell className="w-3.5 h-3.5" />
            <span>Enable Push</span>
          </>
        )}
      </button>
    );
  }

  // Card variant
  if (variant === "card") {
    return (
      <div className={`p-4 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 to-purple-950/30 backdrop-blur-md ${className}`}>
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-slate-100">Live Push Notifications</h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Get instant alerts on your phone and computer whenever you receive an SMS, direct message, or channel update.
            </p>
            {statusMessage && (
              <p className="text-xs mt-2 font-medium text-emerald-400">{statusMessage}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleEnable}
                disabled={isLoading || permission === "granted"}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : permission === "granted" ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Enabled</span>
                  </>
                ) : (
                  <span>Turn On Notifications</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default banner variant (dismissible bar)
  return (
    <div className={`relative px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-900/90 via-purple-900/85 to-indigo-950/90 border border-indigo-500/30 text-white shadow-xl shadow-indigo-950/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-xl bg-indigo-500/25 text-indigo-200 shrink-0">
          <BellRing className="w-4 h-4 animate-pulse" />
        </div>
        <div>
          <p className="text-xs font-semibold text-white tracking-wide">
            Never miss a message
          </p>
          <p className="text-[11px] text-indigo-200/80">
            Enable instant background push notifications on phone & computer.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleEnable}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-indigo-950 hover:bg-indigo-50 transition-all shadow-sm active:scale-95"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-950" />
          ) : (
            <span>Enable</span>
          )}
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg text-indigo-300 hover:text-white hover:bg-white/10 transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
