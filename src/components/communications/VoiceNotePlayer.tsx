"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2 } from "lucide-react";

interface VoiceNotePlayerProps {
  audioUrl: string;
  duration?: number;
  isMe?: boolean;
  isDarkMode?: boolean;
}

export function VoiceNotePlayer({
  audioUrl,
  duration = 0,
  isMe = false,
  isDarkMode = false,
}: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => console.warn(e));
    }
  };

  const handleSpeedToggle = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const progressPercent = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;

  // Waveform bars simulation (WhatsApp style)
  const barHeights = [20, 45, 75, 30, 90, 60, 40, 85, 55, 35, 70, 95, 40, 65, 30, 80, 50, 90, 35, 60, 40];

  return (
    <div className={`flex items-center gap-2.5 py-1.5 px-1 min-w-[220px] max-w-[280px] select-none ${isMe ? "text-white" : isDarkMode ? "text-slate-100" : "text-slate-800"}`}>
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-sm ${
          isMe
            ? "bg-white text-emerald-600 hover:bg-emerald-50"
            : "bg-emerald-500 text-white hover:bg-emerald-600"
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      {/* Waveform & Scrubber */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div
          className="h-6 flex items-center gap-0.5 cursor-pointer relative"
          onClick={(e) => {
            if (!audioRef.current || !totalDuration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            audioRef.current.currentTime = clickPos * totalDuration;
          }}
        >
          {barHeights.map((h, i) => {
            const barPercent = (i / barHeights.length) * 100;
            const isPlayed = barPercent <= progressPercent;
            return (
              <span
                key={i}
                className="w-1 rounded-full transition-colors"
                style={{
                  height: `${h}%`,
                  backgroundColor: isPlayed
                    ? isMe
                      ? "#ffffff"
                      : "#10b981"
                    : isMe
                    ? "rgba(255, 255, 255, 0.35)"
                    : isDarkMode
                    ? "rgba(148, 163, 184, 0.4)"
                    : "rgba(148, 163, 184, 0.6)",
                }}
              />
            );
          })}
        </div>

        {/* Timestamp & Speed Control */}
        <div className="flex items-center justify-between text-[10px] font-semibold opacity-85">
          <span>{isPlaying ? formatSeconds(currentTime) : formatSeconds(totalDuration || 0)}</span>
          <button
            type="button"
            onClick={handleSpeedToggle}
            className={`px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wider transition-colors ${
              isMe
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-slate-200/60 hover:bg-slate-200 text-slate-700"
            }`}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
}
