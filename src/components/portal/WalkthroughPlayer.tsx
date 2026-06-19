"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Maximize2, Minimize2, X, Volume2, VolumeX } from "lucide-react";
import { useWalkthroughPlayerStore, type Corner } from "@/stores/walkthrough-player-store";

/* ═══════════════════════════════════════════════════════════════
   Helper: format seconds → mm:ss
   ═══════════════════════════════════════════════════════════════ */
function fmt(s: number) {
  if (!isFinite(s) || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/* ═══════════════════════════════════════════════════════════════
   Corner positions (for PiP snapping)
   ═══════════════════════════════════════════════════════════════ */
const CORNER_POS: Record<Corner, { bottom?: number; top?: number; left?: number; right?: number }> = {
  br: { bottom: 16, right: 16 },
  bl: { bottom: 16, left: 16 },
  tr: { top: 16, right: 16 },
  tl: { top: 16, left: 16 },
};

function nearestCorner(x: number, y: number): Corner {
  const w = typeof window !== "undefined" ? window.innerWidth : 1920;
  const h = typeof window !== "undefined" ? window.innerHeight : 1080;
  const midX = w / 2;
  const midY = h / 2;
  if (x < midX) return y < midY ? "tl" : "bl";
  return y < midY ? "tr" : "br";
}

/* ═══════════════════════════════════════════════════════════════
   WALKTHROUGH PLAYER — Floating / PiP video player

   Architecture: A SINGLE <video> element is always rendered and
   never unmounted. The wrapper styling changes between full-size
   and PiP mode so playback is never interrupted.
   ═══════════════════════════════════════════════════════════════ */
export function WalkthroughPlayer() {
  const { video, isMinimized, corner, closeVideo, toggleMinimize, setCorner } =
    useWalkthroughPlayerStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; elX: number; elY: number } | null>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Detect if the video URL is a direct video file vs an embeddable URL (YouTube, Scribe, etc.)
  const isDirectVideo = video?.url
    ? /\.(mp4|webm|ogg|mov)(\?|$)/i.test(video.url) ||
      video.url.includes("firebasestorage.googleapis.com")
    : false;

  /* ── Auto-hide controls in full-size mode ── */
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (!isMinimized) setShowControls(false);
    }, 3000);
  }, [isMinimized]);

  useEffect(() => {
    if (!isMinimized) resetControlsTimer();
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, [isMinimized, resetControlsTimer]);

  /* ── Video element event tracking ── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onDur = () => setDuration(v.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onDur);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onDur);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [video?.url]);

  /* ── Play/pause toggle ── */
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); }
    else { v.pause(); }
  }, []);

  /* ── Volume ── */
  const handleVolumeChange = useCallback((val: number) => {
    setVolume(val);
    setIsMuted(val === 0);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isMuted) {
      const restored = volume > 0 ? volume : 0.5;
      v.muted = false;
      v.volume = restored;
      setIsMuted(false);
      setVolume(restored);
    } else {
      v.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  /* ── Seek ── */
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
  }, [duration]);

  /* ═══════════════════════════════════════════════════════════════
     DRAG LOGIC — for mini PiP mode
     ═══════════════════════════════════════════════════════════════ */
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    const el = dragRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      elX: rect.left,
      elY: rect.top,
    };
    setIsDragging(true);
  }, []);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!dragStartRef.current || !isDragging) return;
    const { startX, startY, elX, elY } = dragStartRef.current;
    setDragPos({
      x: elX + (clientX - startX),
      y: elY + (clientY - startY),
    });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragPos) {
      const pipW = 320;
      const pipH = 180;
      const centerX = dragPos.x + pipW / 2;
      const centerY = dragPos.y + pipH / 2;
      const c = nearestCorner(centerX, centerY);
      setCorner(c);
    }
    setDragPos(null);
    dragStartRef.current = null;
  }, [isDragging, dragPos, setCorner]);

  // Mouse drag events
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const onUp = () => handleDragEnd();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Touch drag events
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: TouchEvent) => {
      if (e.touches[0]) handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onEnd = () => handleDragEnd();
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  /* ── Reset play state ONLY when a new video URL loads ── */
  useEffect(() => {
    if (video) {
      setIsPlaying(true);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [video?.url]);

  if (!video) return null;

  /* ═══════════════════════════════════════════════════════════════
     RENDER — single element architecture
     The <video> element is always rendered once. The outer wrapper
     changes between full-screen and PiP styling.
     ═══════════════════════════════════════════════════════════════ */

  /* ── PiP wrapper style ── */
  const pipPos = CORNER_POS[corner];
  const pipStyle: React.CSSProperties = isDragging && dragPos
    ? { position: "fixed", left: dragPos.x, top: dragPos.y, zIndex: 99990, transition: "none" }
    : { position: "fixed", ...pipPos, zIndex: 99990, transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)" };

  /* ── The shared video / iframe element ── */
  const mediaElement = isDirectVideo ? (
    <video
      ref={videoRef}
      src={video.url}
      className={isMinimized ? "w-full h-full object-cover" : "w-full h-full object-contain cursor-pointer"}
      autoPlay
      playsInline
      muted={isMuted}
      onClick={isMinimized ? undefined : togglePlay}
    />
  ) : (
    <iframe
      src={video.url}
      className="w-full h-full border-0"
      allow="autoplay; fullscreen"
      allowFullScreen
    />
  );

  /* ═══════════════════════════════════════════════════════════════
     MINI (PiP) MODE
     ═══════════════════════════════════════════════════════════════ */
  if (isMinimized) {
    return (
      <div
        ref={dragRef}
        style={pipStyle}
        className="w-[320px] h-[180px] rounded-xl overflow-hidden shadow-2xl border border-slate-200/60 bg-black group select-none"
        onMouseDown={(e) => { e.preventDefault(); handleDragStart(e.clientX, e.clientY); }}
        onTouchStart={(e) => { if (e.touches[0]) handleDragStart(e.touches[0].clientX, e.touches[0].clientY); }}
      >
        {mediaElement}

        {/* Hover overlay controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between pointer-events-none">
          {/* Top bar */}
          <div className="flex items-center justify-between px-3 pt-2 pointer-events-auto">
            <p className="text-[10px] font-medium text-white/80 truncate max-w-[200px]">{video.title}</p>
            <button
              onClick={(e) => { e.stopPropagation(); closeVideo(); }}
              className="w-6 h-6 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-3 pb-2 pointer-events-auto">
            {/* Play/Pause — bottom left */}
            {isDirectVideo && (
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>
            )}

            {/* Time */}
            {isDirectVideo && (
              <span className="text-[10px] text-white/70 font-mono tabular-nums">
                {fmt(currentTime)}
              </span>
            )}

            {/* Maximize — bottom right */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}
              className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     FULL-SIZE (MAXIMIZED) MODE
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div
      className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && isDirectVideo) togglePlay();
      }}
      onMouseMove={resetControlsTimer}
    >
      {/* Video container */}
      <div className="relative w-full max-w-5xl mx-4 aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl">
        {mediaElement}

        {/* ── Control bar ── */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-10 pb-3 px-4 transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Seek bar */}
          {isDirectVideo && duration > 0 && (
            <div
              className="w-full h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer group/seek"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-white rounded-full relative transition-all group-hover/seek:h-2"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover/seek:opacity-100 transition-opacity" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            {/* Left: play/pause + time */}
            <div className="flex items-center gap-3">
              {isDirectVideo && (
                <button
                  onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                  className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
              )}
              {isDirectVideo && (
                <span className="text-xs text-white/70 font-mono tabular-nums">
                  {fmt(currentTime)} / {fmt(duration)}
                </span>
              )}
            </div>

            {/* Right: volume + minimize + close */}
            <div className="flex items-center gap-2">
              {/* Volume */}
              {isDirectVideo && (
                <div className="flex items-center gap-2 group/vol">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                    className="w-8 h-8 rounded-full hover:bg-white/15 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => { e.stopPropagation(); handleVolumeChange(parseFloat(e.target.value)); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-white h-1 cursor-pointer opacity-0 group-hover/vol:opacity-100"
                  />
                </div>
              )}

              {/* Minimize button */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleMinimize(); }}
                className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
                title="Minimize to picture-in-picture"
              >
                <Minimize2 className="w-4 h-4" />
              </button>

              {/* Close */}
              <button
                onClick={(e) => { e.stopPropagation(); closeVideo(); }}
                className="w-9 h-9 rounded-full bg-white/15 hover:bg-red-500/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors"
                title="Close video"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Title overlay (top) */}
        <div
          className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent pt-4 pb-8 px-4 transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <h3 className="text-sm font-medium text-white truncate">{video.title}</h3>
        </div>
      </div>
    </div>
  );
}
