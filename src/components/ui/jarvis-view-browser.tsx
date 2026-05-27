"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Mic, RefreshCw, Globe, Shield, Lock } from "lucide-react";

// ── 5 Fake website layout presets ──
const SITE_PRESETS = [
  // Preset 0: News / Article layout
  () => (
    <div className="flex flex-col gap-3 p-4 animate-in fade-in duration-500">
      {/* Hero image placeholder */}
      <div className="w-full h-28 bg-slate-200 rounded-lg" />
      {/* Title lines */}
      <div className="h-4 bg-slate-300 rounded w-[85%]" />
      <div className="h-3 bg-slate-200 rounded w-[60%]" />
      {/* Divider */}
      <div className="h-px bg-slate-200 my-1" />
      {/* Body lines */}
      <div className="flex flex-col gap-1.5">
        <div className="h-2.5 bg-slate-100 rounded w-full" />
        <div className="h-2.5 bg-slate-100 rounded w-[95%]" />
        <div className="h-2.5 bg-slate-100 rounded w-[88%]" />
        <div className="h-2.5 bg-slate-100 rounded w-full" />
        <div className="h-2.5 bg-slate-100 rounded w-[72%]" />
      </div>
      {/* Image + text side by side */}
      <div className="flex gap-3 mt-2">
        <div className="w-20 h-16 bg-slate-200 rounded shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="h-2.5 bg-slate-200 rounded w-[90%]" />
          <div className="h-2.5 bg-slate-100 rounded w-full" />
          <div className="h-2.5 bg-slate-100 rounded w-[65%]" />
        </div>
      </div>
    </div>
  ),
  // Preset 1: Search results layout
  () => (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-500">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="h-2 bg-blue-200 rounded w-[50%]" />
          <div className="h-3.5 bg-blue-400/30 rounded w-[75%]" />
          <div className="h-2 bg-slate-100 rounded w-full" />
          <div className="h-2 bg-slate-100 rounded w-[90%]" />
          <div className="h-2 bg-slate-100 rounded w-[60%]" />
        </div>
      ))}
    </div>
  ),
  // Preset 2: Dashboard / data layout
  () => (
    <div className="flex flex-col gap-3 p-4 animate-in fade-in duration-500">
      {/* Top stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-100 rounded-lg p-3 flex flex-col gap-1.5">
            <div className="h-2 bg-slate-200 rounded w-[60%]" />
            <div className="h-4 bg-slate-300 rounded w-[40%]" />
          </div>
        ))}
      </div>
      {/* Chart placeholder */}
      <div className="w-full h-24 bg-slate-100 rounded-lg flex items-end gap-1 p-3">
        {[40, 65, 35, 80, 55, 70, 45, 90, 60, 75].map((h, i) => (
          <div key={i} className="flex-1 bg-blue-200 rounded-t" style={{ height: `${h}%` }} />
        ))}
      </div>
      {/* Table rows */}
      <div className="flex flex-col gap-1">
        <div className="flex gap-2 py-1.5 border-b border-slate-100">
          <div className="h-2.5 bg-slate-200 rounded w-[25%]" />
          <div className="h-2.5 bg-slate-100 rounded w-[30%]" />
          <div className="h-2.5 bg-slate-100 rounded w-[20%]" />
          <div className="h-2.5 bg-slate-200 rounded w-[15%]" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2 py-1.5 border-b border-slate-50">
            <div className="h-2 bg-slate-100 rounded w-[25%]" />
            <div className="h-2 bg-slate-50 rounded w-[30%]" />
            <div className="h-2 bg-slate-50 rounded w-[20%]" />
            <div className="h-2 bg-slate-100 rounded w-[15%]" />
          </div>
        ))}
      </div>
    </div>
  ),
  // Preset 3: Wiki / documentation layout
  () => (
    <div className="flex flex-col gap-2 p-4 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex gap-1 items-center">
        <div className="h-2 bg-blue-200 rounded w-8" />
        <div className="h-2 bg-slate-300 rounded w-1" />
        <div className="h-2 bg-blue-200 rounded w-12" />
        <div className="h-2 bg-slate-300 rounded w-1" />
        <div className="h-2 bg-slate-300 rounded w-16" />
      </div>
      {/* Title */}
      <div className="h-5 bg-slate-800/10 rounded w-[70%] mt-1" />
      <div className="h-px bg-slate-200 my-1" />
      {/* Table of contents sidebar + content */}
      <div className="flex gap-3">
        <div className="w-[30%] flex flex-col gap-1.5 border-r border-slate-100 pr-3">
          <div className="h-2 bg-slate-200 rounded w-[80%]" />
          <div className="h-2 bg-blue-200 rounded w-[70%] ml-2" />
          <div className="h-2 bg-slate-100 rounded w-[60%] ml-2" />
          <div className="h-2 bg-slate-200 rounded w-[75%]" />
          <div className="h-2 bg-slate-100 rounded w-[65%] ml-2" />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="h-3 bg-slate-200 rounded w-[55%]" />
          <div className="h-2 bg-slate-100 rounded w-full" />
          <div className="h-2 bg-slate-100 rounded w-[95%]" />
          <div className="h-2 bg-slate-100 rounded w-[88%]" />
          <div className="h-2 bg-slate-100 rounded w-full" />
          <div className="h-20 bg-slate-100 rounded mt-2" />
          <div className="h-2 bg-slate-100 rounded w-[92%]" />
          <div className="h-2 bg-slate-100 rounded w-full" />
        </div>
      </div>
    </div>
  ),
  // Preset 4: E-commerce / product layout
  () => (
    <div className="flex flex-col gap-3 p-4 animate-in fade-in duration-500">
      {/* Nav categories */}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-2 bg-slate-200 rounded" style={{ width: `${40 + Math.random() * 30}px` }} />
        ))}
      </div>
      <div className="h-px bg-slate-100" />
      {/* Product grid */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex flex-col gap-1.5 p-2 border border-slate-100 rounded-lg">
            <div className="w-full aspect-square bg-slate-100 rounded" />
            <div className="h-2 bg-slate-200 rounded w-[80%]" />
            <div className="h-2 bg-slate-100 rounded w-[60%]" />
            <div className="h-2.5 bg-green-200 rounded w-[40%]" />
          </div>
        ))}
      </div>
    </div>
  ),
];

export interface JarvisViewNavigation {
  url: string;
  title?: string;
}

interface JarvisViewBrowserProps {
  /** Queue of URLs for the agent to "navigate" to. Push new entries to trigger animations. */
  navigationQueue: JarvisViewNavigation[];
  /** Called when a navigation animation completes */
  onNavigationComplete?: () => void;
}

export function JarvisViewBrowser({ navigationQueue, onNavigationComplete }: JarvisViewBrowserProps) {
  const [urlBarText, setUrlBarText] = useState("https://www.google.com");
  const [isTyping, setIsTyping] = useState(false);
  const [showCursor, setShowCursor] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 }); // percentage-based
  const [isLoading, setIsLoading] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<number | null>(null);
  const [showHomePage, setShowHomePage] = useState(true);
  const [processedCount, setProcessedCount] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<boolean>(false);

  // Process navigation queue
  useEffect(() => {
    if (navigationQueue.length > processedCount && !animationRef.current) {
      const nextNav = navigationQueue[processedCount];
      animationRef.current = true;
      runNavigationAnimation(nextNav.url).then(() => {
        setProcessedCount((prev) => prev + 1);
        animationRef.current = false;
        onNavigationComplete?.();
      });
    }
  }, [navigationQueue, processedCount]);

  const runNavigationAnimation = useCallback(async (targetUrl: string) => {
    // 1. Show cursor at center of viewport
    setShowCursor(true);
    setCursorPos({ x: 50, y: 50 });
    await sleep(400);

    // 2. Move cursor up to the URL bar area
    setCursorPos({ x: 35, y: 6 });
    await sleep(600);

    // 3. "Click" on URL bar — clear it and start typing
    setShowHomePage(false);
    setCurrentPreset(null);
    setIsTyping(true);
    setUrlBarText("");
    await sleep(200);

    // 4. Type URL letter by letter
    const displayUrl = targetUrl.length > 60 ? targetUrl.substring(0, 60) + "..." : targetUrl;
    for (let i = 0; i <= displayUrl.length; i++) {
      setUrlBarText(displayUrl.substring(0, i));
      // Variable speed: faster for common chars, slower for special chars
      const char = displayUrl[i];
      const delay = char === "/" || char === "." ? 50 : char === ":" ? 30 : 35 + Math.random() * 20;
      await sleep(delay);
    }

    // 5. "Press enter" — hide cursor, show loading
    setIsTyping(false);
    setShowCursor(false);
    setIsLoading(true);
    await sleep(800 + Math.random() * 400);

    // 6. Pick a random preset and display the "page"
    const presetIndex = Math.floor(Math.random() * SITE_PRESETS.length);
    setCurrentPreset(presetIndex);
    setIsLoading(false);
  }, []);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Blinking cursor for URL bar
  const [cursorBlink, setCursorBlink] = useState(true);
  useEffect(() => {
    if (!isTyping) return;
    const interval = setInterval(() => setCursorBlink((v) => !v), 530);
    return () => clearInterval(interval);
  }, [isTyping]);

  const PresetComponent = currentPreset !== null ? SITE_PRESETS[currentPreset] : null;

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
      {/* Animated cursor overlay */}
      {showCursor && (
        <div
          className="absolute z-50 pointer-events-none transition-all duration-500 ease-out"
          style={{
            left: `${cursorPos.x}%`,
            top: `${cursorPos.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Custom cursor SVG */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            className="drop-shadow-md"
          >
            <path
              d="M5 3L19 12L12 13L9 20L5 3Z"
              fill="#1a1a1a"
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {/* Chrome-style URL bar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-slate-200 bg-slate-100/80 shrink-0 relative z-10">
        <div className="flex items-center gap-0.5">
          <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 transition-colors">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-300 transition-colors">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 transition-colors">
            {isLoading ? (
              <div className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
          </button>
        </div>

        {/* URL bar */}
        <div
          className={`flex-1 flex items-center bg-white border rounded-full px-3 py-1 gap-2 shadow-inner transition-all duration-200 ${
            isTyping ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200"
          }`}
        >
          {!isTyping && !isLoading && urlBarText.startsWith("https://") && (
            <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
          )}
          {isLoading && <Globe className="w-3 h-3 text-blue-500 shrink-0 animate-pulse" />}
          <div className="flex-1 text-[11px] text-slate-600 font-mono truncate flex items-center">
            <span>{urlBarText}</span>
            {isTyping && (
              <span
                className="inline-block w-[1px] h-3 bg-blue-600 ml-[1px] transition-opacity"
                style={{ opacity: cursorBlink ? 1 : 0 }}
              />
            )}
          </div>
          <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-[10px] text-slate-400 font-medium">Loading...</span>
            </div>
          </div>
        )}

        {/* Google Home Screen (default) */}
        {showHomePage && !isLoading && currentPreset === null && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 pb-8 h-full">
            {/* Google Logo */}
            <div
              className="flex items-center select-none"
              style={{
                fontSize: "40px",
                fontFamily: "'Product Sans', Arial, sans-serif",
                fontWeight: 400,
                letterSpacing: "-1px",
              }}
            >
              <span style={{ color: "#4285F4" }}>G</span>
              <span style={{ color: "#EA4335" }}>o</span>
              <span style={{ color: "#FBBC05" }}>o</span>
              <span style={{ color: "#4285F4" }}>g</span>
              <span style={{ color: "#34A853" }}>l</span>
              <span style={{ color: "#EA4335" }}>e</span>
            </div>

            {/* Search Bar */}
            <div className="w-full max-w-[320px] flex items-center bg-white border border-slate-300 rounded-full px-4 py-2.5 gap-3 shadow-sm hover:shadow-md transition-shadow">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                className="flex-1 text-[13px] text-slate-700 bg-transparent outline-none placeholder:text-slate-400"
                placeholder="Search Google or type a URL"
                readOnly
              />
              <Mic className="w-4 h-4 text-blue-500 shrink-0" />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-1">
              <button className="px-4 py-2 text-[12px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-100 hover:border-slate-300 rounded-md transition-all hover:shadow-sm">
                Google Search
              </button>
              <button className="px-4 py-2 text-[12px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-100 hover:border-slate-300 rounded-md transition-all hover:shadow-sm">
                I&apos;m Feeling Lucky
              </button>
            </div>

            {/* Jarvis Agent Overlay Badge */}
            <div className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200/60">
              <div className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600">
                Jarvis Agent Active
              </span>
            </div>
          </div>
        )}

        {/* Rendered fake website preset */}
        {PresetComponent && !isLoading && <PresetComponent />}

        {/* Tab title bar at bottom when navigated */}
        {currentPreset !== null && !isLoading && (
          <div className="absolute bottom-0 left-0 right-0 border-t border-slate-100 bg-slate-50 px-3 py-1.5 flex items-center gap-2">
            <div className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600">
              Jarvis is reading this page...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
