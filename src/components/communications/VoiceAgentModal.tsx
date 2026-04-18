"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Pause, Play, MessageSquareText, X, Phone, Hand, Bot, User, Loader2 } from "lucide-react";

interface VoiceAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  agentId: string;
  orgPrefix: "soltheory" | "nxtchapter";
  onCallAI?: (messages: any[]) => Promise<string>;
}

type Phase = "listening" | "processing" | "speaking";
type TranscriptLine = { text: string; isUser: boolean };

export function VoiceAgentModal({ isOpen, onClose, agentName, agentId, orgPrefix, onCallAI }: VoiceAgentModalProps) {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [phase, setPhase] = useState<Phase>("listening");
  const [bars, setBars] = useState<number[]>(Array(32).fill(4));
  const [elapsed, setElapsed] = useState(0);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [liveText, setLiveText] = useState("");

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const phaseRef = useRef<Phase>("listening");
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const accumulatedTextRef = useRef("");
  const conversationRef = useRef<{ role: string; content: string }[]>([]);
  const cancelledRef = useRef(false);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPausedRef = useRef(isPaused);
  const finishUserTurnRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // Auto-scroll
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLines, liveText]);

  // ── Recognition helpers ──
  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null; // prevent auto-restart in onend
      try { r.stop(); } catch {}
    }
  }, []);

  const startRecognition = useCallback(() => {
    // Don't start if cancelled or already running
    if (cancelledRef.current) return;
    stopRecognition();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) {
        accumulatedTextRef.current += (accumulatedTextRef.current ? " " : "") + final;
        setLiveText(accumulatedTextRef.current);
      } else if (interim) {
        setLiveText(accumulatedTextRef.current + (accumulatedTextRef.current ? " " : "") + interim);
      }

      // Voice Auto-Submit Logic
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      silenceTimeoutRef.current = setTimeout(() => {
        if (phaseRef.current === "listening" && !isPausedRef.current) {
          const currentText = accumulatedTextRef.current.trim() || interim.trim();
          if (currentText && currentText.length > 2) {
             finishUserTurnRef.current();
          }
        }
      }, 1000); // Reduced to 1000ms as requested
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.error("Speech recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      // Only auto-restart if reference is still held (not manually stopped)
      if (recognitionRef.current === recognition && !cancelledRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {}
  }, [stopRecognition]);

  // ── Mute: fully stop/start recognition + mic track ──
  useEffect(() => {
    if (!isOpen) return;
    if (isMicMuted) {
      stopRecognition();
      setLiveText("");
      accumulatedTextRef.current = "";
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(t => { t.enabled = false; });
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(t => { t.enabled = true; });
      }
      if (phaseRef.current === "listening" && !isPaused) {
        startRecognition();
      }
    }
  }, [isMicMuted, isOpen, isPaused, startRecognition, stopRecognition]);

  // ── Pause: fully stop/start recognition ──
  useEffect(() => {
    if (!isOpen) return;
    if (isPaused) {
      stopRecognition();
      setLiveText("");
      accumulatedTextRef.current = "";
    } else {
      if (phaseRef.current === "listening" && !isMicMuted) {
        startRecognition();
      }
    }
  }, [isPaused, isOpen, isMicMuted, startRecognition, stopRecognition]);

  // ── Start mic + waveform on open ──
  useEffect(() => {
    if (!isOpen) return;
    cancelledRef.current = false;

    const initMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelledRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.4;
        src.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelledRef.current) return;
          analyser.getByteFrequencyData(dataArray);

          // INTERRUPT LOGIC
          if (phaseRef.current === "speaking" && !isPausedRef.current) {
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            let avg = sum / dataArray.length;

            if (avg > 40) { // STRONG SIGNAL THRESHOLD
              if (speakingTimeoutRef.current) {
                clearTimeout(speakingTimeoutRef.current);
                speakingTimeoutRef.current = null;
              }
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
                audioRef.current = null;
              }
              setPhase("listening");
              startRecognition();
            }
          }

          const barCount = 32;
          const newBars: number[] = [];
          const binStep = Math.floor(dataArray.length / barCount);

          for (let i = 0; i < barCount; i++) {
            let binVal = 0;
            for (let j = 0; j < binStep; j++) binVal += dataArray[i * binStep + j] || 0;
            binVal = binVal / binStep;

            if (phaseRef.current === "speaking" || phaseRef.current === "processing") {
              const center = barCount / 2;
              const dist = 1 - Math.abs(i - center) / center;
              binVal = dist * 65 * (0.4 + Math.random() * 0.8);
            } else {
              binVal = (binVal / 255) * 95;
            }
            newBars.push(Math.max(3, binVal));
          }
          setBars(newBars);
          animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick);

        // Start recognition immediately
        startRecognition();
      } catch (err) {
        console.error("Microphone access denied:", err);
      }
    };

    initMic();

    return () => {
      cancelledRef.current = true;
      cancelAnimationFrame(animFrameRef.current);
      stopRecognition();
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      analyserRef.current = null;
    };
  }, [isOpen, startRecognition, stopRecognition]);

  // Timer
  useEffect(() => {
    if (!isOpen) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setPhase("listening");
      setIsMicMuted(false);
      setIsPaused(false);
      setTranscriptLines([]);
      setLiveText("");
      setBars(Array(32).fill(4));
      accumulatedTextRef.current = "";
      conversationRef.current = [];
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    }
  }, [isOpen]);

  // ── Call fast voice endpoint ──
  const callVoiceAI = async (userText: string) => {
    conversationRef.current.push({ role: "user", content: userText });
    try {
      let reply = "";
      if (onCallAI) {
        reply = await onCallAI([...conversationRef.current]);
      } else {
        const res = await fetch("/api/voice-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: conversationRef.current,
            agentId: `${orgPrefix}_${agentId}`,
          }),
        });
        const data = await res.json();
        reply = data.response || "I couldn't process that.";
      }
      conversationRef.current.push({ role: "assistant", content: reply });
      return reply;
    } catch {
      return "Connection issue. Try again.";
    }
  };

  // ── "I'm Done" handler ──
  const finishUserTurn = async () => {
    if (phaseRef.current !== "listening") return;
    // Instantly lock phaseRef to prevent double-firing from rapid clicks or debounce overlaps
    phaseRef.current = "processing";

    const spokenText = accumulatedTextRef.current.trim() || liveText.trim();
    if (!spokenText) {
      phaseRef.current = "listening"; // unlock if empty
      return;
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    // Stop recognition during AI turn
    stopRecognition();

    // Commit user text
    setTranscriptLines(prev => [...prev, { text: spokenText, isUser: true }]);
    setLiveText("");
    accumulatedTextRef.current = "";
    setPhase("processing");

    // Call AI
    const aiReply = await callVoiceAI(spokenText);

    // Show response
    setPhase("speaking");
    setTranscriptLines(prev => [...prev, { text: aiReply, isUser: false }]);

    try {
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiReply })
      });

      if (ttsRes.ok) {
        const audioBlob = await ttsRes.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Ensure absolutely no overlap if multiple processes resolved simultaneously
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        
        audioRef.current = audio;
        
        audio.onended = () => {
          setPhase("listening");
          audioRef.current = null;
          if (!isMicMuted && !isPaused) startRecognition();
        };
        
        await audio.play();
      } else {
        throw new Error("TTS stream failed");
      }
    } catch(err) {
      console.error(err);
      // Fallback
      const delay = Math.max(1500, Math.min(aiReply.length * 35, 6000));
      speakingTimeoutRef.current = setTimeout(() => {
        setPhase("listening");
        if (!isMicMuted && !isPaused) startRecognition();
      }, delay);
    }
  };

  useEffect(() => {
    finishUserTurnRef.current = finishUserTurn;
  }, [finishUserTurn]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  const ac =
    isMicMuted ? "rose" :
    isPaused ? "slate" :
    phase === "speaking" ? "indigo" :
    phase === "processing" ? "amber" :
    "emerald";

  const statusLabel =
    isMicMuted ? "Microphone Off" :
    isPaused ? "Session Paused" :
    phase === "speaking" ? `${agentName.split(" ")[0]} is speaking...` :
    phase === "processing" ? "Thinking..." :
    "Listening — speak naturally";

  const g: Record<string, Record<string, string>> = {
    grad: { rose: "from-rose-400 via-rose-500 to-pink-500", indigo: "from-indigo-400 via-indigo-500 to-violet-500", amber: "from-amber-400 via-amber-500 to-orange-500", emerald: "from-emerald-400 via-emerald-500 to-teal-500", slate: "from-slate-300 via-slate-400 to-slate-500" },
    bar: { rose: "from-rose-500 to-rose-300", indigo: "from-indigo-600 to-indigo-300", amber: "from-amber-500 to-amber-300", emerald: "from-emerald-500 to-emerald-300", slate: "from-slate-400 to-slate-200" },
    badge: { rose: "bg-rose-50 text-rose-600 border-rose-200", indigo: "bg-indigo-50 text-indigo-600 border-indigo-200", amber: "bg-amber-50 text-amber-600 border-amber-200", emerald: "bg-emerald-50 text-emerald-600 border-emerald-200", slate: "bg-slate-100 text-slate-500 border-slate-200" },
    dot: { rose: "bg-rose-400", indigo: "bg-indigo-400", amber: "bg-amber-400", emerald: "bg-emerald-400", slate: "bg-slate-400" },
    dotS: { rose: "bg-rose-500", indigo: "bg-indigo-500", amber: "bg-amber-500", emerald: "bg-emerald-500", slate: "bg-slate-500" },
    text: { rose: "text-rose-500", indigo: "text-indigo-500", amber: "text-amber-500", emerald: "text-emerald-500", slate: "text-slate-400" },
    glow: { rose: "bg-rose-300", indigo: "bg-indigo-300", amber: "bg-amber-300", emerald: "bg-emerald-300", slate: "bg-slate-200" },
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in duration-300">
      <div className={`h-1 w-full bg-gradient-to-r ${g.grad[ac]} shrink-0`} />

      {/* ─── TOP ─── */}
      <div className="shrink-0 flex flex-col items-center pt-6 pb-4 px-6 border-b border-slate-100 relative">
        <button onClick={onClose} className="absolute top-4 right-6 w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all hover:scale-105 active:scale-95">
          <X className="w-5 h-5" />
        </button>

        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-2 border ${g.badge[ac]}`}>
          <span className="relative flex h-1.5 w-1.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${g.dot[ac]}`} />
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${g.dotS[ac]}`} />
          </span>
          {isPaused ? "Paused" : "Live Voice Session"}
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">{agentName}</h2>
        <p className="text-slate-400 text-xs font-medium mt-0.5">{formatTime(elapsed)}</p>

        {/* Waveform */}
        <div className="w-full max-w-md mt-5 relative">
          <div className="relative h-20 flex items-center justify-center">
            <div className={`absolute inset-0 rounded-3xl blur-3xl opacity-15 transition-colors duration-500 ${g.glow[ac]}`} />
            <div className="relative flex items-center justify-center gap-[3px] h-full w-full">
              {bars.map((h, i) => (
                <div key={i} className={`rounded-full transition-[height] duration-75 ease-out bg-gradient-to-t ${g.bar[ac]}`}
                  style={{ width: "3.5px", height: `${Math.max(3, isMicMuted || isPaused ? 4 : h)}%`, opacity: isMicMuted || isPaused ? 0.3 : 0.5 + (h / 100) * 0.5 }}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 mt-3">
            <span className={`text-[11px] font-bold uppercase tracking-[0.2em] ${g.text[ac]}`}>{statusLabel}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mt-4">
          <button onClick={() => setIsMicMuted(!isMicMuted)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isMicMuted ? "bg-rose-100 text-rose-600 ring-2 ring-rose-200" : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"}`}
          >
            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button onClick={finishUserTurn} disabled={phase !== "listening" || isMicMuted || isPaused}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              phase === "listening" && !isMicMuted && !isPaused ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200" : "bg-slate-200 text-slate-400"
            }`}
          >
            {phase === "processing" ? <><Loader2 className="w-4 h-4 animate-spin" /> Thinking...</> : <><Hand className="w-4 h-4" /> I&apos;m Done Speaking</>}
          </button>

          <button onClick={() => setIsPaused(!isPaused)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isPaused ? "bg-amber-100 text-amber-600 ring-2 ring-amber-200" : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"}`}
          >
            {isPaused ? <Play className="w-4 h-4 ml-0.5" /> : <Pause className="w-4 h-4" />}
          </button>

          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95 border border-rose-100">
            <Phone className="w-4 h-4 rotate-[135deg]" />
          </button>
        </div>
      </div>

      {/* ─── BOTTOM: Transcript ─── */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
        <div className="px-8 pt-4 pb-2 flex items-center gap-2 shrink-0">
          <MessageSquareText className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Transcript</span>
        </div>
        <div className="flex-1 overflow-y-auto px-8 pb-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {transcriptLines.length === 0 && !liveText ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                  <Mic className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400 font-medium">Start speaking — your words will appear here in real time.</p>
                <p className="text-xs text-slate-300 mt-1">Press &quot;I&apos;m Done Speaking&quot; when you&apos;re finished.</p>
              </div>
            ) : (
              <>
                {transcriptLines.map((line, i) => (
                  <div key={i} className={`flex gap-3 ${line.isUser ? "justify-end" : "justify-start"}`}>
                    {!line.isUser && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-sm mt-1">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className={`rounded-2xl px-4 py-3 text-sm max-w-[75%] leading-relaxed shadow-sm ${
                      line.isUser ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm"
                    }`}>
                      {line.text}
                    </div>
                    {line.isUser && (
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 mt-1">
                        <User className="w-4 h-4 text-slate-500" />
                      </div>
                    )}
                  </div>
                ))}
                {liveText && !isMicMuted && !isPaused && (
                  <div className="flex gap-3 justify-end">
                    <div className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-[75%] leading-relaxed bg-indigo-100 border border-indigo-200 text-indigo-800 shadow-sm">
                      {liveText}
                      <span className="inline-block w-0.5 h-4 bg-indigo-500 rounded-full ml-1 animate-pulse align-middle" />
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                )}
                {phase === "processing" && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-sm mt-1">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-white border border-slate-200 text-slate-400 shadow-sm flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> <span className="italic">Thinking...</span>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
