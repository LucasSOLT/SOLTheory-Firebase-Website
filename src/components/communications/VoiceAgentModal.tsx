"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Pause, Play, MessageSquareText, X, Phone, Hand, Bot, User, Loader2, ChevronDown, Maximize2, Minimize2 } from "lucide-react";

interface VoiceAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  agentId: string;
  orgPrefix: "soltheory" | "nxtchapter";
  onCallAI?: (messages: any[]) => Promise<any>;
  onUsageUpdate?: (groqTokens: number, elevenLabsChars: number) => void;
  existingMessages?: { role: string; content: string }[];
  onTranscriptUpdate?: (userText: string, aiReply: string, pactFacts?: any[]) => void;
  systemInstructions?: string;
  knowledgeBaseText?: string;
  pactText?: string;
}

type Phase = "listening" | "processing" | "speaking";
type TranscriptLine = { text: string; isUser: boolean };

export function VoiceAgentModal({ isOpen, onClose, agentName, agentId, orgPrefix, onCallAI, onUsageUpdate, existingMessages, onTranscriptUpdate, systemInstructions, knowledgeBaseText, pactText }: VoiceAgentModalProps) {
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
  const interruptFrameCount = useRef(0);
  const lastTimerTextRef = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Persistent audio element for mobile compatibility - created once, reused
  const persistentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPausedRef = useRef(isPaused);
  const [responseDelay, setResponseDelay] = useState(1500);
  const responseDelayRef = useRef(1500);
  const [showTranscript, setShowTranscript] = useState(true);
  const [groqTokens, setGroqTokens] = useState(0);
  const [elevenLabsChars, setElevenLabsChars] = useState(0);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const finishUserTurnRef = useRef<() => Promise<void>>(async () => { });

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    isPausedRef.current = isPaused;

    // Relay pause/play immediately to active AI audio stream
    if (audioRef.current) {
      if (isPaused) {
        audioRef.current.pause();
      } else if (phase === "speaking") {
        audioRef.current.play().catch(e => console.warn(e));
      }
    }
  }, [isPaused, phase]);
  useEffect(() => { responseDelayRef.current = responseDelay; }, [responseDelay]);

  // Auto-scroll
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLines, liveText]);

  // ── Recognition helpers ──
  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null; // prevent auto-restart in onend
      try { r.abort(); } catch { } // Use abort() to instantly kill without trailing onresult events
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
      if (phaseRef.current !== "listening") return; // Completely ignore late audio buffers

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

      const newText = (accumulatedTextRef.current + (interim ? " " + interim : "")).trim();

      // Voice Auto-Submit Logic
      // Only reset the silence timer if actual new text was registered
      if (newText !== lastTimerTextRef.current) {
        lastTimerTextRef.current = newText;
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

        silenceTimeoutRef.current = setTimeout(() => {
          if (phaseRef.current === "listening" && !isPausedRef.current) {
            const currentText = newText;
            if (currentText && currentText.length > 2) {
              finishUserTurnRef.current();
            }
          }
        }, responseDelayRef.current); // Use customizable delay
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.error("Speech recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      // Only auto-restart if reference is still held (not manually stopped)
      if (recognitionRef.current === recognition && !cancelledRef.current) {
        try { recognition.start(); } catch { }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch { }
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

  // ── Pause: fully stop/start recognition + pause audio ──
  useEffect(() => {
    if (!isOpen) return;
    if (isPaused) {
      stopRecognition();
      setLiveText("");
      accumulatedTextRef.current = "";
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      if (phaseRef.current === "listening" && !isMicMuted) {
        startRecognition();
      } else if (phaseRef.current === "speaking" && audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(console.error);
      }
    }
  }, [isPaused, isOpen, isMicMuted, startRecognition, stopRecognition]);

  // Seed conversation with existing chat messages for context
  useEffect(() => {
    if (isOpen && existingMessages && existingMessages.length > 0 && conversationRef.current.length === 0) {
      conversationRef.current = [...existingMessages];
    }
  }, [isOpen, existingMessages]);

  // ── Start mic + waveform on open ──
  useEffect(() => {
    if (!isOpen) return;
    cancelledRef.current = false;

    const initMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        if (cancelledRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        // --- Play welcoming "Gemini-style" startup chime ---
        try {
          const frequencies = [329.63, 440.00, 523.25, 659.25]; // E4, A4, C5, E5 (E minor / A minor feel)
          const masterGain = ctx.createGain();
          masterGain.connect(ctx.destination);
          masterGain.gain.setValueAtTime(0, ctx.currentTime);
          masterGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05); // quick attack
          masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0); // long fade

          frequencies.forEach((freq, index) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const panner = ctx.createStereoPanner();
            panner.pan.value = (index / (frequencies.length - 1)) * 1.5 - 0.75; // spread stereo

            osc.connect(panner);
            panner.connect(masterGain);

            osc.start(ctx.currentTime + index * 0.05); // slight stagger/arpeggiation
            osc.stop(ctx.currentTime + 2.5);
          });
        } catch (e) {
          console.warn("Could not play startup chime", e);
        }

        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.4;
        src.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelledRef.current) return;
          const barCount = 32;
          const newBars: number[] = [];

          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);

            // INTERRUPT LOGIC — require sustained loud input, not just a spike from laughter
            if (phaseRef.current === "speaking" && !isPausedRef.current) {
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              let avg = sum / dataArray.length;

              if (avg > 120) { // HIGH threshold: only clear, sustained speech
                if (!interruptFrameCount.current) interruptFrameCount.current = 0;
                interruptFrameCount.current++;
                if (interruptFrameCount.current >= 4) { // Must be loud for 4+ consecutive frames
                  interruptFrameCount.current = 0;
                  if (speakingTimeoutRef.current) {
                    clearTimeout(speakingTimeoutRef.current);
                    speakingTimeoutRef.current = null;
                  }
                  if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.src = "";
                    audioRef.current = null;
                  }
                  phaseRef.current = "listening";
                  setPhase("listening");
                  startRecognition();
                }
              } else {
                interruptFrameCount.current = 0; // Reset if signal drops
              }
            }
          }

          const binStep = Math.floor(dataArray.length / barCount);

          for (let i = 0; i < barCount; i++) {
            let binVal = 0;
            if (phaseRef.current === "speaking" || phaseRef.current === "processing") {
              // Rich AI speaking visualizer with dynamic jumping
              const t = Date.now() / 1000;
              const center = barCount / 2;

              // Bell curve: center bars are taller
              const gaussian = Math.exp(-Math.pow(i - center, 2) / (2 * Math.pow(barCount / 4.5, 2)));

              // Dynamic jumping and speaking simulation
              const speed = phaseRef.current === "processing" ? 3 : 15; // Faster when speaking

              // Create a chaotic bounce that looks like speech modulation
              const bounce = Math.abs(Math.sin(t * speed + i * 0.4)) * 0.5 +
                Math.abs(Math.sin(t * speed * 1.5 - i * 0.2)) * 0.5;

              // Random high spikes mimicking syllables when speaking
              const isSpeaking = phaseRef.current === "speaking";
              const randomSpike = isSpeaking && Math.random() > 0.85 ? Math.random() * 0.8 : 0;

              const baseAmplitude = isSpeaking ? 90 : 30; // Taller when speaking
              binVal = (gaussian * baseAmplitude * (bounce * 0.7 + 0.3 + randomSpike)) + 12;
            } else {
              // Real Mic Input
              for (let j = 0; j < binStep; j++) binVal += dataArray[i * binStep + j] || 0;
              binVal = binVal / binStep;
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

        // MOBILE FIX: "Unlock" a persistent audio element during this user-gesture-triggered flow.
        // Mobile browsers (iOS Safari, Chrome Android) block Audio.play() unless
        // the audio element was first played inside a direct user gesture.
        if (!persistentAudioRef.current) {
          const a = document.createElement('audio');
          a.setAttribute('playsinline', 'true');
          a.setAttribute('webkit-playsinline', 'true');
          // Play a tiny silent audio to unlock the element
          a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
          a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
          persistentAudioRef.current = a;
        }
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

  // Reset on close — FULL cleanup
  useEffect(() => {
    if (!isOpen) {
      // Kill speech recognition immediately
      cancelledRef.current = true;
      stopRecognition();

      // Kill mic stream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => { t.stop(); t.enabled = false; });
        streamRef.current = null;
      }

      // Kill audio context
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => { });
        audioCtxRef.current = null;
      }
      analyserRef.current = null;

      // Kill animation frame
      cancelAnimationFrame(animFrameRef.current);

      // Kill any pending audio playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }

      // Clear all timers
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      if (speakingTimeoutRef.current) {
        clearTimeout(speakingTimeoutRef.current);
        speakingTimeoutRef.current = null;
      }

      // Reset UI state
      setPhase("listening");
      setIsMicMuted(false);
      setIsPaused(false);
      setTranscriptLines([]);
      setLiveText("");
      setBars(Array(32).fill(4));
      accumulatedTextRef.current = "";
      conversationRef.current = [];
      interruptFrameCount.current = 0;
      lastTimerTextRef.current = "";
    }
  }, [isOpen, stopRecognition]);

  // ── Call fast voice endpoint ──
  const callVoiceAI = async (userText: string) => {
    conversationRef.current.push({ role: "user", content: userText });
    try {
      let reply = "";
      let pactFacts: any[] = [];
      let usageNum = 0;
      if (onCallAI) {
        const payload: any = await onCallAI([...conversationRef.current]);
        reply = payload.response || "I couldn't process that.";
        usageNum = payload.usage || 0;
        if (payload.pactFacts) pactFacts = payload.pactFacts;
      } else {
        const res = await fetch("/api/voice-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: conversationRef.current,
            agentId: `${orgPrefix}_${agentId}`,
            systemInstructions,
            knowledgeBaseText,
            pactText,
          }),
        });
        const data = await res.json();
        reply = data.response || "I couldn't process that.";
        usageNum = data.usage || 0;
        if (data.pactFacts) pactFacts = data.pactFacts;
      }

      setGroqTokens(p => p + usageNum);
      setElevenLabsChars(p => p + reply.length);

      if (onUsageUpdate) {
        onUsageUpdate(usageNum, reply.length);
      }

      conversationRef.current.push({ role: "assistant", content: reply });
      return { reply, pactFacts };
    } catch (err) {
      console.error("Voice AI Call Error:", err);
      return { reply: "Connection issue. Try again.", pactFacts: [] };
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
      setPhase("listening");
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

    // Actually call AI
    const { reply: aiReplyText, pactFacts } = await callVoiceAI(spokenText);
    const cleanedReply = (aiReplyText || "").replace(/<[^>]*>/g, ""); // Strip any XML/HTML if leaked

    if (cancelledRef.current) return;

    // SPEED OPTIMIZATION: Start preloading TTS audio IMMEDIATELY, before updating UI
    const audioUrl = `/api/tts?text=${encodeURIComponent(cleanedReply)}`;

    // MOBILE FIX: Reuse the persistent unlocked audio element instead of new Audio()
    const audio = persistentAudioRef.current || document.createElement('audio');
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.preload = "auto";
    audio.src = audioUrl;
    audio.load(); // Force reload on mobile

    // Kill any existing audio to prevent overlap
    if (audioRef.current && audioRef.current !== audio) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    audioRef.current = audio;

    // Update parent component and transcript in parallel with audio loading
    if (onTranscriptUpdate) {
      onTranscriptUpdate(spokenText, cleanedReply, pactFacts);
    }
    setTranscriptLines(prev => [...prev, { text: cleanedReply, isUser: false }]);
    setPhase("speaking");

    try {
      audio.onended = () => {
        setPhase("listening");
        audioRef.current = null;
        if (!isMicMuted && !isPaused) startRecognition();
      };

      // Play as soon as enough audio is buffered (don't wait for full download)
      await new Promise<void>((resolve, reject) => {
        const tryPlay = () => {
          audio.play().then(resolve).catch((e) => {
            // Mobile fallback: retry once after a short delay
            console.warn('Audio play blocked, retrying:', e.message);
            setTimeout(() => {
              audio.play().then(resolve).catch(reject);
            }, 100);
          });
        };
        audio.oncanplay = () => tryPlay();
        audio.onerror = () => reject(new Error("Audio load failed"));
        // Safety: if canplay already fired (cached), play immediately
        if (audio.readyState >= 3) tryPlay();
      });
    } catch (err) {
      console.error(err);
      // Fallback: text-based delay
      const delay = Math.max(1500, Math.min(cleanedReply.length * 35, 6000));
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
    grad: { rose: "from-rose-400 via-rose-500 to-pink-500", indigo: "from-purple-400 via-fuchsia-500 to-pink-500", amber: "from-indigo-400 via-blue-500 to-cyan-400", emerald: "from-blue-400 via-cyan-500 to-teal-400", slate: "from-slate-300 via-slate-400 to-slate-500" },
    bar: { rose: "from-rose-500 to-rose-300", indigo: "from-purple-500 to-pink-400", amber: "from-indigo-500 to-cyan-400", emerald: "from-blue-500 to-cyan-300", slate: "from-slate-400 to-slate-200" },
    badge: { rose: "bg-rose-50 text-rose-600 border-rose-200", indigo: "bg-purple-50 text-purple-600 border-purple-200", amber: "bg-indigo-50 text-indigo-600 border-indigo-200", emerald: "bg-blue-50 text-blue-600 border-blue-200", slate: "bg-slate-100 text-slate-500 border-slate-200" },
    dot: { rose: "bg-rose-400", indigo: "bg-purple-400", amber: "bg-indigo-400", emerald: "bg-blue-400", slate: "bg-slate-400" },
    dotS: { rose: "bg-rose-500", indigo: "bg-purple-500", amber: "bg-indigo-500", emerald: "bg-blue-500", slate: "bg-slate-500" },
    text: { rose: "text-rose-500", indigo: "text-purple-600", amber: "text-indigo-500", emerald: "text-blue-500", slate: "text-slate-400" },
    glow: { rose: "bg-rose-400", indigo: "bg-purple-500", amber: "bg-indigo-400", emerald: "bg-cyan-400", slate: "bg-slate-300" },
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[100] w-80 bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 border border-slate-200">
        <div className={`h-1 w-full bg-gradient-to-r ${g.grad[ac]} shrink-0`} />
        
        <div className="p-4 relative">
          <button onClick={() => setIsMinimized(false)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all z-10">
            <Maximize2 className="w-4 h-4" />
          </button>
          
          <div className="flex flex-col items-center">
            <div className={`inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-1 border ${g.badge[ac]}`}>
              <span className="relative flex h-1.5 w-1.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${g.dot[ac]}`} />
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${g.dotS[ac]}`} />
              </span>
              <span className="pr-0.5">{statusLabel.split('—')[0]}</span>
            </div>
            
            <h2 className="text-base font-black text-slate-900 tracking-tight">{agentName}</h2>
            <p className="text-slate-400 text-[10px] font-medium mt-0.5">{formatTime(elapsed)}</p>

            {/* Waveform */}
            <div className="w-full max-w-[200px] mt-4 relative">
              <div className="relative h-16 flex items-center justify-center">
                <div className={`absolute inset-0 rounded-full blur-[40px] transition-all duration-700 ease-in-out ${phase === "speaking" ? "opacity-60 scale-125" : "opacity-30 scale-100"} ${g.glow[ac]}`} />
                <div className="relative flex items-center justify-center gap-1 h-full w-full">
                  {bars.slice(0, 24).map((h, i) => (
                    <div key={i} className={`rounded-full transition-[height,background-color] duration-[120ms] ease-out bg-gradient-to-t shadow-sm ${g.bar[ac]}`}
                      style={{
                        width: "4px",
                        height: `${Math.max(4, isMicMuted || isPaused ? 8 : h)}%`,
                        opacity: isMicMuted || isPaused ? 0.3 : 0.8 + (h / 100) * 0.2
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2 mt-4 w-full">
              <button onClick={() => setIsMicMuted(!isMicMuted)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isMicMuted ? "bg-rose-100 text-rose-600 ring-2 ring-rose-200" : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"}`}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button onClick={finishUserTurn} disabled={phase !== "listening" || isMicMuted || isPaused}
                className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${phase === "listening" && !isMicMuted && !isPaused ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200" : "bg-slate-200 text-slate-400"
                  }`}
              >
                {phase === "processing" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> ...</> : <><Hand className="w-3.5 h-3.5" /> Done</>}
              </button>

              <button onClick={() => setIsPaused(!isPaused)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isPaused ? "bg-amber-100 text-amber-600 ring-2 ring-amber-200" : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"}`}
              >
                {isPaused ? <Play className="w-4 h-4 ml-0.5" /> : <Pause className="w-4 h-4" />}
              </button>

              <button onClick={onClose} className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95 border border-rose-100">
                <Phone className="w-4 h-4 rotate-[135deg]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in duration-300">
      <div className={`h-1 w-full bg-gradient-to-r ${g.grad[ac]} shrink-0`} />

      <div className="flex flex-col items-center flex-1 justify-center relative bg-slate-50 p-6">
        
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between pointer-events-none">
          {/* Top Left: Cost */}
          <button onClick={() => setShowCostBreakdown(!showCostBreakdown)} className="pointer-events-auto px-4 h-10 rounded-full bg-white border border-slate-200 flex items-center gap-2 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors z-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" /></svg>
            <span className="text-[11px] font-black tracking-wider text-slate-600 whitespace-nowrap">
              ${((groqTokens * 0.00000006) + (elevenLabsChars * 0.000167)).toFixed(4)}
            </span>
          </button>
          
          {/* Top Right: Minimize & Close */}
          <div className="flex items-center gap-2 pointer-events-auto z-[101]">
            <button onClick={() => setIsMinimized(true)} className="w-10 h-10 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm" title="Minimize">
              <Minimize2 className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm" title="End Call">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showCostBreakdown && (
          <div className="absolute top-20 left-6 z-[200] w-[340px] bg-white border border-slate-200 rounded-[12px] shadow-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Session Cost Breakdown</h3>
              <button onClick={() => setShowCostBreakdown(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-4">
              {/* Groq Section */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-[8px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Groq — LLM Inference</span>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between"><span>Model</span><span className="font-bold text-slate-700">Llama 3.1 8B Instant</span></div>
                  <div className="flex justify-between"><span>Tokens Used</span><span className="font-bold text-slate-700">{groqTokens.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Rate</span><span className="font-bold text-slate-700">~$0.06 / 1M tokens</span></div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="flex justify-between text-slate-900 font-black"><span>Subtotal</span><span>${(groqTokens * 0.00000006).toFixed(6)}</span></div>
                </div>
              </div>

              {/* ElevenLabs Section */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-[8px]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">ElevenLabs — Text-to-Speech</span>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between"><span>Model</span><span className="font-bold text-slate-700">Turbo v2.5</span></div>
                  <div className="flex justify-between"><span>Characters Synthesized</span><span className="font-bold text-slate-700">{elevenLabsChars.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Rate (Starter Tier)</span><span className="font-bold text-slate-700">~$0.167 / 1K chars</span></div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="flex justify-between text-slate-900 font-black"><span>Subtotal</span><span>${(elevenLabsChars * 0.000167).toFixed(6)}</span></div>
                </div>
              </div>

              {/* Total */}
              <div className="p-3 bg-slate-900 rounded-[8px]">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Session Cost</span>
                  <span className="text-lg font-black text-white">${((groqTokens * 0.00000006) + (elevenLabsChars * 0.000167)).toFixed(4)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`inline-flex items-center gap-2 pl-3 pr-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 border ${g.badge[ac]} relative`}>
          <span className="relative flex h-1.5 w-1.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${g.dot[ac]}`} />
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${g.dotS[ac]}`} />
          </span>
          {isPaused ? (
            <span className="pr-1">Paused</span>
          ) : (
            <select
              value={responseDelay}
              onChange={(e) => setResponseDelay(Number(e.target.value))}
              className="appearance-none bg-transparent outline-none cursor-pointer hover:opacity-80 transition-opacity font-bold tracking-widest"
              title="Adjust how long Jarvis waits before responding"
            >
              <option value={500} className="text-slate-900">Fast (0.5s pause)</option>
              <option value={1500} className="text-slate-900">Normal (1.5s pause)</option>
              <option value={3000} className="text-slate-900">Relaxed (3.0s pause)</option>
              <option value={5000} className="text-slate-900">Very Slow (5.0s pause)</option>
            </select>
          )}
          {!isPaused && <ChevronDown className="w-3 h-3 opacity-50 -ml-1 pointer-events-none" />}
        </div>
        
        <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-2">{agentName}</h2>
        <p className="text-slate-400 text-sm font-medium">{formatTime(elapsed)}</p>

        {/* Waveform */}
        <div className="w-full max-w-[280px] sm:max-w-2xl mt-12 mb-12 relative">
          <div className="relative h-32 sm:h-48 flex items-center justify-center">
            {/* Ambient Background Glow */}
            <div className={`absolute inset-0 rounded-full blur-[80px] transition-all duration-700 ease-in-out ${phase === "speaking" ? "opacity-60 scale-125" : "opacity-30 scale-100"} ${g.glow[ac]}`} />

            <div className="relative flex items-center justify-center gap-[3px] sm:gap-2 h-full w-full">
              {bars.map((h, i) => (
                <div key={i} className={`rounded-full transition-[height,background-color] duration-[120ms] ease-out bg-gradient-to-t shadow-sm ${g.bar[ac]}`}
                  style={{
                    width: "8px",
                    height: `${Math.max(4, isMicMuted || isPaused ? 8 : h)}%`,
                    opacity: isMicMuted || isPaused ? 0.3 : 0.8 + (h / 100) * 0.2
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 mb-12">
          <span className={`text-sm font-black uppercase tracking-[0.25em] ${g.text[ac]} transition-colors duration-500`}>{statusLabel}</span>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 px-4">
          <button onClick={() => setIsMicMuted(!isMicMuted)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm ${isMicMuted ? "bg-rose-100 text-rose-600 ring-4 ring-rose-200" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
          >
            {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button onClick={finishUserTurn} disabled={phase !== "listening" || isMicMuted || isPaused}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold transition-all hover:scale-105 active:scale-95 shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${phase === "listening" && !isMicMuted && !isPaused ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200" : "bg-slate-200 text-slate-400"
              }`}
          >
            {phase === "processing" ? <><Loader2 className="w-5 h-5 animate-spin" /> Thinking...</> : <><Hand className="w-5 h-5" /> <span>I&apos;m Done Speaking</span></>}
          </button>

          <button onClick={() => setIsPaused(!isPaused)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm ${isPaused ? "bg-amber-100 text-amber-600 ring-4 ring-amber-200" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
          >
            {isPaused ? <Play className="w-6 h-6 ml-1" /> : <Pause className="w-6 h-6" />}
          </button>

          <button onClick={onClose} className="w-14 h-14 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-all hover:scale-105 active:scale-95 border border-rose-200 shadow-sm">
            <Phone className="w-6 h-6 rotate-[135deg]" />
          </button>
        </div>
      </div>
    </div>
  );
}
