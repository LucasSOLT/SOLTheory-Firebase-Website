"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Send, Loader2 } from "lucide-react";

interface VoiceNoteRecorderProps {
  onRecorded: (audioBlob: Blob, durationSeconds: number) => Promise<void>;
  onCancel: () => void;
  isDarkMode?: boolean;
}

export function VoiceNoteRecorder({
  onRecorded,
  onCancel,
  isDarkMode = false,
}: VoiceNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("[VoiceRecorder] Microphone access error:", err);
      alert("Microphone permission denied or not supported.");
      onCancel();
    }
  };

  const handleStopAndSend = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;

    setIsUploading(true);
    const recordedDuration = seconds;
    cleanup();

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      try {
        await onRecorded(audioBlob, recordedDuration);
      } finally {
        setIsUploading(false);
      }
    };

    mediaRecorderRef.current.stop();
  };

  const handleDiscard = () => {
    cleanup();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    onCancel();
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-full border shadow-md animate-in fade-in slide-in-from-bottom-2 duration-150 ${
        isDarkMode
          ? "bg-slate-800 border-emerald-500/40 text-white"
          : "bg-emerald-50 border-emerald-300 text-slate-900"
      }`}
    >
      {/* Live recording indicator */}
      <div className="flex items-center gap-2.5">
        <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse shadow-sm shadow-rose-500/50" />
        <span className="text-xs font-mono font-bold tracking-wider text-rose-500">
          {formatTimer(seconds)}
        </span>
        <span className="text-xs font-medium text-slate-500">Recording voice message...</span>
      </div>

      {/* Action controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleDiscard}
          disabled={isUploading}
          className="p-2 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
          title="Discard recording"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleStopAndSend}
          disabled={isUploading || seconds < 1}
          className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
