"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FolderArchive } from "lucide-react";
import type { GrantAgentConfig } from "./GrantAgentConfigModal";

/* â”€â”€â”€ Animation Phases â”€â”€â”€ */
type Phase =
  | "waiting"       // idle countdown until next scan
  | "cursor_move"
  | "typing"
  | "loading"
  | "found"
  | "minimizing"
  | "stored"
  | "resetting";

import { GRANT_DATABASE } from "@/data/grantDatabase";

/* â”€â”€â”€ Pull real URLs and names from the grant database â”€â”€â”€ */
const SEARCH_URLS = GRANT_DATABASE.slice(0, 20).map((g) =>
  g.url.replace(/^https?:\/\//, "").replace(/\/$/, "")
);

const GRANT_NAMES = GRANT_DATABASE.slice(0, 20).map((g) => g.title);

/* â”€â”€â”€ Convert config interval to milliseconds â”€â”€â”€ */
function intervalToMs(value: number, unit: string): number {
  const multipliers: Record<string, number> = {
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
    weeks: 604_800_000,
  };
  return value * (multipliers[unit] || 60_000);
}

/* â”€â”€â”€ Format remaining time for display â”€â”€â”€ */
function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const hrs = Math.floor(totalSec / 3600);
  const remMins = Math.floor((totalSec % 3600) / 60);
  const remSecs = totalSec % 60;
  if (hrs > 0) return `${hrs}h ${remMins}m ${remSecs}s`;
  if (remMins > 0) return `${remMins}m ${remSecs}s`;
  return `${remSecs}s`;
}

/* â”€â”€â”€ Animation phase total duration (approx) â”€â”€â”€ */
const SCAN_ANIMATION_DURATION_MS = 7_200; // sum of all phase durations

/* â”€â”€â”€ Component â”€â”€â”€ */
export function GrantAgentBrowserSim({
  config,
  colorTheme,
}: {
  config: GrantAgentConfig;
  colorTheme: { dot: string; label: string };
}) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [typedChars, setTypedChars] = useState(0);
  const [storedCount, setStoredCount] = useState(0);
  const [displayUrlIndex, setDisplayUrlIndex] = useState(0);
  const [countdown, setCountdown] = useState("");
  const [lastScanFoundGrant, setLastScanFoundGrant] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlIndexRef = useRef(0);
  const scanEndTimeRef = useRef<number>(0);

  const currentUrl = SEARCH_URLS[displayUrlIndex % SEARCH_URLS.length];
  const currentGrant = GRANT_NAMES[displayUrlIndex % GRANT_NAMES.length];

  // Use the FULL configured interval (no animation subtraction)
  const configIntervalMs = intervalToMs(config.intervalValue, config.intervalUnit);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (typingRef.current) { clearInterval(typingRef.current); typingRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  // Phase orchestrator
  useEffect(() => {
    clearTimers();

    switch (phase) {
      case "waiting": {
        // Use a SHARED target time so both preview and full-display stay in sync
        const win = typeof window !== "undefined" ? window as any : null;
        let targetTime = win?.__grantNextScanTime as number | undefined;

        if (!targetTime || targetTime <= Date.now()) {
          // No shared time exists or it expired â€” set a new one
          targetTime = Date.now() + configIntervalMs;
          if (win) win.__grantNextScanTime = targetTime;
        }

        scanEndTimeRef.current = targetTime;

        // Immediately show initial countdown
        setCountdown(formatCountdown(targetTime - Date.now()));

        // Tick every second
        countdownRef.current = setInterval(() => {
          const remaining = scanEndTimeRef.current - Date.now();
          if (remaining <= 0) {
            setCountdown("now");
          } else {
            setCountdown(formatCountdown(remaining));
          }
        }, 1_000);

        // Wait the full countdown, then start the scan animation
        const waitMs = Math.max(targetTime - Date.now(), 500);
        timerRef.current = setTimeout(() => {
          if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
          setPhase("cursor_move");
        }, waitMs);
        break;
      }

      case "cursor_move":
        timerRef.current = setTimeout(() => {
          setTypedChars(0);
          setPhase("typing");
        }, 1000);
        break;

      case "typing": {
        const targetLen = SEARCH_URLS[urlIndexRef.current % SEARCH_URLS.length].length;
        typingRef.current = setInterval(() => {
          setTypedChars((prev) => {
            if (prev >= targetLen) {
              if (typingRef.current) { clearInterval(typingRef.current); typingRef.current = null; }
              timerRef.current = setTimeout(() => setPhase("loading"), 300);
              return prev;
            }
            return prev + 1;
          });
        }, 35);
        break;
      }

      case "loading":
        timerRef.current = setTimeout(() => setPhase("found"), 1800);
        break;

      case "found":
        // Check if the real worker found a grant or came up empty
        if (typeof window !== "undefined") {
          const status = window.__lastGrantScanStatus;
          setLastScanFoundGrant(status === "found" || status === undefined);
        }
        if (lastScanFoundGrant) {
          timerRef.current = setTimeout(() => setPhase("minimizing"), 2000);
        } else {
          // No grant found â€” skip minimizing, go straight to resetting
          timerRef.current = setTimeout(() => setPhase("resetting"), 2500);
        }
        break;

      case "minimizing":
        timerRef.current = setTimeout(() => {
          setStoredCount((prev) => prev + 1);
          setPhase("stored");
        }, 1200);
        break;

      case "stored":
        timerRef.current = setTimeout(() => setPhase("resetting"), 600);
        break;

      case "resetting":
        // Advance to next URL
        urlIndexRef.current += 1;
        setDisplayUrlIndex(urlIndexRef.current);
        setTypedChars(0);
        // Go back to waiting for the next interval
        timerRef.current = setTimeout(() => setPhase("waiting"), 400);
        break;
    }

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [clearTimers]);

  const isMinimizing = phase === "minimizing";
  const isStored = phase === "stored";
  const isWaiting = phase === "waiting";
  const isScanning = !isWaiting;

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none">
      {/* â•â•â• Mini Browser Window â•â•â• */}
      <div
        className={`flex-1 flex flex-col rounded-lg border border-slate-200/80 bg-[#fefcf6] shadow-sm overflow-hidden transition-all origin-bottom-right ${
          isMinimizing
            ? "scale-[0.08] opacity-0 translate-x-[60%] translate-y-[60%]"
            : isStored
            ? "scale-0 opacity-0"
            : isWaiting
            ? "scale-100 opacity-100"
            : "scale-100 opacity-100"
        }`}
        style={{
          transitionDuration: isMinimizing ? "1100ms" : "300ms",
          transitionTimingFunction: isMinimizing ? "cubic-bezier(0.4, 0, 0.2, 1)" : "ease",
        }}
      >
        {/* Browser Chrome Header */}
        <div className="shrink-0 bg-slate-100 border-b border-slate-200/60 px-2 py-1.5 flex items-center gap-1.5">
          {/* Traffic lights */}
          <div className="flex items-center gap-1 mr-1.5">
            <div className="w-[7px] h-[7px] rounded-full bg-red-400" />
            <div className="w-[7px] h-[7px] rounded-full bg-amber-400" />
            <div className="w-[7px] h-[7px] rounded-full bg-emerald-400" />
          </div>
          {/* Tab */}
          <div className="bg-[#fefcf6] rounded-t-md px-2 py-0.5 text-[7px] font-semibold text-slate-500 border border-b-0 border-slate-200/60 max-w-[80px] truncate">
            Grant Search
          </div>
        </div>

        {/* URL Bar */}
        <div className="shrink-0 px-2 py-1 bg-[#faf6ed]/80 border-b border-slate-100 flex items-center gap-1.5">
          {/* Nav buttons */}
          <div className="flex items-center gap-0.5">
            <div className="w-3.5 h-3.5 rounded flex items-center justify-center text-slate-400">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </div>
            <div className="w-3.5 h-3.5 rounded flex items-center justify-center text-slate-300">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </div>
            {/* Refresh */}
            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-slate-400 ${phase === "loading" ? "animate-spin" : ""}`}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
            </div>
          </div>
          {/* Address bar */}
          <div className={`flex-1 bg-[#fefcf6] rounded-md px-2 py-0.5 text-[7px] font-mono border transition-colors overflow-hidden whitespace-nowrap ${
            phase === "cursor_move" || phase === "typing"
              ? "border-indigo-300 ring-1 ring-indigo-200"
              : "border-slate-200"
          }`}>
            <span className="text-slate-400">https://</span>
            <span className="text-slate-700">
              {phase === "typing" || phase === "loading" || phase === "found" || phase === "minimizing"
                ? currentUrl.slice(0, typedChars)
                : ""}
            </span>
            {phase === "typing" && (
              <span className="inline-block w-[1px] h-[8px] bg-indigo-500 ml-[1px] animate-pulse" />
            )}
          </div>
        </div>

        {/* Browser Viewport */}
        <div className="flex-1 relative min-h-[50px] overflow-hidden bg-[#fefcf6]">
          {/* Waiting: show countdown */}
          {isWaiting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <div className="text-[7px] text-slate-300 font-medium">Next scan in</div>
              <div className={`text-[10px] font-bold tabular-nums ${colorTheme.label}`}>{countdown}</div>
            </div>
          )}

          {/* cursor_move: blank page */}
          {phase === "cursor_move" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-[8px] text-slate-300 font-medium">Initiating scan...</div>
            </div>
          )}

          {/* Typing: show faint page lines */}
          {phase === "typing" && (
            <div className="absolute inset-0 flex items-center p-2">
              <div className="w-full space-y-1.5">
                <div className="h-1.5 bg-slate-100 rounded-full w-3/4 animate-pulse" />
                <div className="h-1.5 bg-slate-100 rounded-full w-1/2 animate-pulse" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 bg-slate-100 rounded-full w-5/6 animate-pulse" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {/* Loading: spinner */}
          {phase === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
              <span className="text-[7px] font-semibold text-slate-400">Scanning results...</span>
            </div>
          )}

          {/* Found: grant result or no-new-grants message */}
          {(phase === "found" || phase === "minimizing") && (
            <div className="absolute inset-0 flex items-center p-2">
              <div className="w-full">
                {/* Fake search results */}
                <div className="space-y-1.5 mb-2">
                  <div className="h-1.5 bg-slate-100 rounded-full w-full" />
                  <div className="h-1.5 bg-slate-100 rounded-full w-2/3" />
                </div>
                {lastScanFoundGrant ? (
                  /* â”€â”€ Grant found toast â”€â”€ */
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5 animate-in slide-in-from-bottom-2 fade-in duration-300">
                    <div className="flex items-center gap-1 mb-0.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      </div>
                      <span className="text-[7px] font-extrabold text-emerald-700 uppercase tracking-wider">
                        Grant Found!
                      </span>
                    </div>
                    <p className="text-[6px] text-emerald-600 font-semibold truncate pl-3.5">{currentGrant}</p>
                  </div>
                ) : (
                  /* â”€â”€ No new grants toast â”€â”€ */
                  <div className="bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 animate-in slide-in-from-bottom-2 fade-in duration-300">
                    <div className="flex items-center gap-1 mb-0.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 flex items-center justify-center">
                        <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      </div>
                      <span className="text-[7px] font-extrabold text-amber-700 uppercase tracking-wider">
                        No New Grants
                      </span>
                    </div>
                    <p className="text-[6px] text-amber-600 font-semibold pl-3.5">Continuing the search...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stored: empty, browser gone */}
          {(phase === "stored" || phase === "resetting") && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-[7px] text-slate-300 font-medium">Preparing next scan...</div>
            </div>
          )}
        </div>
      </div>

      {/* â•â•â• Animated SVG Cursor â•â•â• */}
      {(phase === "cursor_move" || phase === "typing") && (
        <div
          className={`absolute pointer-events-none z-20 transition-all ${
            phase === "cursor_move"
              ? "top-[22px] left-[55%] opacity-100"
              : "top-[22px] left-[40%] opacity-100"
          }`}
          style={{
            transitionDuration: phase === "cursor_move" ? "900ms" : "0ms",
            transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <svg width="14" height="18" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L1 13.5L4.5 10L8.5 17L10.5 16L6.5 9L11.5 9L1 1Z" fill="#1e293b" stroke="white" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      {/* â•â•â• Storage Folder (bottom-right) â•â•â• */}
      <div className="absolute bottom-1 right-1 flex items-center gap-1 z-10">
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-all ${
            isMinimizing || isStored
              ? "bg-indigo-50 border border-indigo-200 scale-110"
              : "bg-[#faf6ed]/80 border border-slate-200/60 scale-100"
          }`}
          style={{ transitionDuration: "300ms" }}
        >
          <FolderArchive className={`w-3 h-3 transition-colors ${
            isMinimizing || isStored ? "text-indigo-500" : "text-slate-400"
          }`} />
          <span className={`text-[7px] font-bold tabular-nums transition-colors ${
            isMinimizing || isStored ? "text-indigo-600" : "text-slate-400"
          }`}>
            {storedCount}
          </span>
        </div>
      </div>
    </div>
  );
}
