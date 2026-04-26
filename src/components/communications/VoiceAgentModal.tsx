"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Pause, Play, MessageSquareText, X, Phone, Hand, Bot, User, Loader2, ChevronDown, Mail, Calendar, FileText, Presentation, Table, ClipboardList, Ticket, Youtube } from "lucide-react";

interface VoiceAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  agentId: string;
  orgPrefix: "soltheory" | "nxtchapter";
  onCallAI?: (messages: any[]) => Promise<any>;
  onUsageUpdate?: (groqTokens: number, elevenLabsChars: number) => void;
}

type Phase = "listening" | "processing" | "speaking";
type TranscriptLine = { text: string; isUser: boolean };

export function VoiceAgentModal({ isOpen, onClose, agentName, agentId, orgPrefix, onCallAI, onUsageUpdate }: VoiceAgentModalProps) {
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
  const isPausedRef = useRef(isPaused);
  const [responseDelay, setResponseDelay] = useState(1500);
  const responseDelayRef = useRef(1500);
  const [showTranscript, setShowTranscript] = useState(true);
  const [groqTokens, setGroqTokens] = useState(0);
  const [elevenLabsChars, setElevenLabsChars] = useState(0);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const finishUserTurnRef = useRef<() => Promise<void>>(async () => {});

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
      try { r.abort(); } catch {} // Use abort() to instantly kill without trailing onresult events
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
              // Rich AI speaking visualizer with layered sine waves
              const t = Date.now() / 1000;
              const center = barCount / 2;
              
              // Bell curve: center bars are taller
              const gaussian = Math.exp(-Math.pow(i - center, 2) / (2 * Math.pow(barCount / 3.5, 2)));
              
              // Multiple overlapping "syllable" waves at different frequencies
              const wave1 = Math.sin(t * 3.7 + i * 0.4) * 0.5 + 0.5; // slow roll
              const wave2 = Math.sin(t * 8.3 + i * 0.7) * 0.3 + 0.5; // mid pulse
              const wave3 = Math.sin(t * 14.1 - i * 0.9) * 0.2 + 0.5; // fast shimmer
              
              // Combine waves into a composite envelope (always positive, 0.2 to 1.0 range)
              const composite = (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2);
              
              // Per-bar jitter for organic feel
              const jitter = (Math.random() * 8) + (Math.sin(t * 20 + i * 2.5) * 6);
              
              const baseAmplitude = phaseRef.current === "processing" ? 25 : 70;
              binVal = (gaussian * baseAmplitude * composite) + jitter + 8;
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
      let usageNum = 0;
      if (onCallAI) {
        const payload: any = await onCallAI([...conversationRef.current]);
        reply = payload.response || "I couldn't process that.";
        usageNum = payload.usage || 0;
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
        usageNum = data.usage || 0;
      }
      
      setGroqTokens(p => p + usageNum);
      setElevenLabsChars(p => p + reply.length);
      
      if (onUsageUpdate) {
        onUsageUpdate(usageNum, reply.length);
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

    // Call AI
    const aiReply = await callVoiceAI(spokenText);

    // Show response
    setPhase("speaking");
    setTranscriptLines(prev => [...prev, { text: aiReply, isUser: false }]);

    try {
      const audioUrl = `/api/tts?text=${encodeURIComponent(aiReply)}`;
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

  // ── Action Preview Detection (parses USER's natural speech) ──
  type ActionType = "email" | "calendar" | "doc" | "slide" | "sheet" | "survey" | "ticket" | "youtube" | null;

  function detectAction(text: string): { type: ActionType; data: Record<string, string> } {
    const lower = text.toLowerCase();

    // Email detection
    if (lower.includes("email") || lower.includes("write a letter") || lower.includes("send a message to")) {
      let recipientName = "";
      const namePatterns = [
        /(?:his|her|their) name is ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
        /(?:named|name is) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
        /email (?:to|for) (?:my \w+[,.]?\s*(?:and )?)?(?:(?:his|her|their) name is )?([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
        /email (?:to|for) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
      ];
      for (const p of namePatterns) {
        const m = text.match(p);
        if (m?.[1]) { recipientName = m[1].trim(); break; }
      }
      const timeMatch = text.match(/(?:at|for|tomorrow at|today at) (\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)/i);
      const meetLinkMentioned = lower.includes("meet link") || lower.includes("google meet") || lower.includes("meeting link");

      return {
        type: "email",
        data: {
          to: recipientName,
          subject: meetLinkMentioned ? `Meeting with ${recipientName || "Participant"}` : "",
          greeting: recipientName ? `Hello ${recipientName.split(" ")[0]},` : "Hello,",
          body: meetLinkMentioned
            ? `I'd like to invite you to a meeting${timeMatch ? ` at ${timeMatch[1]}` : ""}. Please find the Google Meet link below.`
            : `Composing your email${recipientName ? ` to ${recipientName}` : ""}...`,
          closing: "Thanks,",
          senderName: "",
        }
      };
    }

    // Calendar / Schedule
    if (lower.includes("calendar") || lower.includes("schedule") || lower.includes("set up a meeting") || lower.includes("book a") || lower.includes("appointment")) {
      const timeMatch = text.match(/(?:at|for) (\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)/i);
      const dateMatch = text.match(/(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)/i);
      const withMatch = text.match(/(?:with|for) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i);
      return {
        type: "calendar",
        data: {
          title: withMatch ? `Meeting with ${withMatch[1]}` : "New Event",
          date: dateMatch?.[1] || "",
          time: timeMatch?.[1] || "",
        }
      };
    }

    // Google Meet
    if (lower.includes("google meet") || lower.includes("meet link") || lower.includes("video call")) {
      const withMatch = text.match(/(?:with|for|to) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i);
      return {
        type: "calendar",
        data: {
          title: withMatch ? `Video Call with ${withMatch[1]}` : "Video Call",
          date: "", time: "",
        }
      };
    }

    // Google Slides
    if (lower.includes("slide") || lower.includes("presentation") || lower.includes("deck")) {
      return { type: "slide", data: { title: "Presentation" } };
    }

    // Google Docs
    if (lower.includes("document") || lower.includes("google doc") || lower.includes("write a doc")) {
      return { type: "doc", data: { title: "Document" } };
    }

    // Google Sheets
    if (lower.includes("spreadsheet") || lower.includes("google sheet")) {
      return { type: "sheet", data: { title: "Spreadsheet" } };
    }

    // Survey
    if (lower.includes("survey")) {
      return { type: "survey", data: { title: "Survey" } };
    }

    // Support ticket
    if (lower.includes("ticket") || lower.includes("support request")) {
      return { type: "ticket", data: { title: "Support Ticket" } };
    }

    // YouTube
    if (lower.includes("youtube") || lower.includes("video draft")) {
      return { type: "youtube", data: { title: "YouTube Video" } };
    }

    return { type: null, data: {} };
  }


  // ── Typewriter text component ──
  function TypewriterText({ text, speed = 20 }: { text: string; speed?: number }) {
    const [displayed, setDisplayed] = useState("");
    const indexRef = useRef(0);

    useEffect(() => {
      setDisplayed("");
      indexRef.current = 0;
      const interval = setInterval(() => {
        if (indexRef.current < text.length) {
          setDisplayed(text.substring(0, indexRef.current + 1));
          indexRef.current++;
        } else {
          clearInterval(interval);
        }
      }, speed);
      return () => clearInterval(interval);
    }, [text, speed]);

    return <>{displayed}<span className="inline-block w-0.5 h-3.5 bg-slate-400 rounded-full ml-0.5 animate-pulse align-middle" /></>;
  }

  // ── Action Preview Card ──
  function ActionPreviewCard({ type, data }: { type: ActionType; data: Record<string, string> }) {
    if (!type) return null;

    const configs: Record<string, { icon: any; label: string; color: string; bg: string; border: string }> = {
      email:    { icon: Mail,          label: "Email Draft",      color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200" },
      calendar: { icon: Calendar,      label: "Calendar Event",   color: "text-emerald-600",bg: "bg-emerald-50",border: "border-emerald-200" },
      doc:      { icon: FileText,      label: "Google Doc",       color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
      slide:    { icon: Presentation,  label: "Google Slides",    color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200" },
      sheet:    { icon: Table,         label: "Google Sheets",    color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200" },
      survey:   { icon: ClipboardList, label: "Survey",           color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
      ticket:   { icon: Ticket,        label: "Support Ticket",   color: "text-rose-600",   bg: "bg-rose-50",   border: "border-rose-200" },
      youtube:  { icon: Youtube,       label: "YouTube Video",    color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200" },
    };

    const config = configs[type];
    if (!config) return null;
    const Icon = config.icon;

    return (
      <div className="flex justify-center my-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
        <div className={`w-full max-w-md rounded-2xl border-2 ${config.border} ${config.bg} overflow-hidden shadow-lg`}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-current/10">
            <Icon className={`w-4 h-4 ${config.color}`} />
            <span className={`text-xs font-black uppercase tracking-widest ${config.color}`}>{config.label}</span>
          </div>

          {/* Email Preview */}
          {type === "email" && (
            <div className="p-4 bg-white/80 space-y-3">
              {data.to && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase w-12 shrink-0">To</span>
                  <span className="text-sm font-medium text-slate-700 truncate">{data.to}</span>
                </div>
              )}
              {data.subject && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase w-12 shrink-0">Subject</span>
                  <span className="text-sm font-bold text-slate-900">{data.subject}</span>
                </div>
              )}
              <div className="h-px bg-slate-200" />
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line min-h-[60px]">
                {data.greeting && (
                  <p className="font-medium mb-2"><TypewriterText text={data.greeting} speed={15} /></p>
                )}
                {data.body && (
                  <p className="mb-2"><TypewriterText text={data.body} speed={10} /></p>
                )}
                {data.closing && (
                  <>
                    <p className="mt-3 font-medium"><TypewriterText text={data.closing} speed={15} /></p>
                    {data.senderName && <p className="font-bold text-slate-900"><TypewriterText text={data.senderName} speed={20} /></p>}
                  </>
                )}
                {!data.greeting && !data.body && !data.closing && (
                  <p className="text-slate-400 italic">Composing email...</p>
                )}
              </div>
            </div>
          )}

          {/* Calendar Preview */}
          {type === "calendar" && (
            <div className="p-4 bg-white/80 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase leading-none">Event</span>
                  <Calendar className="w-5 h-5 text-emerald-600 mt-0.5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900"><TypewriterText text={data.title || "New Event"} speed={20} /></p>
                  {data.date && <p className="text-xs text-slate-500 font-medium">{data.date} {data.time && `at ${data.time}`}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Generic Preview for doc/slide/sheet/survey/ticket/youtube */}
          {["doc", "slide", "sheet", "survey", "ticket", "youtube"].includes(type) && (
            <div className="p-4 bg-white/80 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${config.color}`} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900"><TypewriterText text={`Creating ${config.label}...`} speed={25} /></p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Generating content</p>
              </div>
              <div className="ml-auto">
                <Loader2 className={`w-5 h-5 animate-spin ${config.color} opacity-50`} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

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

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in duration-300">
      <div className={`h-1 w-full bg-gradient-to-r ${g.grad[ac]} shrink-0`} />

      {/* ─── TOP ─── */}
      <div className={`flex flex-col items-center pt-4 sm:pt-6 pb-4 px-4 sm:px-6 relative transition-all duration-500 ease-in-out ${showTranscript ? "shrink-0 border-b border-slate-100" : "flex-1 justify-center bg-slate-50"}`}>

        <button onClick={() => setShowCostBreakdown(!showCostBreakdown)} className="absolute top-3 sm:top-4 right-14 sm:right-16 px-2 sm:px-4 h-8 sm:h-10 rounded-[4px] bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 sm:gap-2 max-w-fit shadow-sm cursor-pointer transition-colors z-50">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>
          <span className="text-[11px] font-black tracking-wider text-slate-500 whitespace-nowrap">
            ${( (groqTokens * 0.00000006) + (elevenLabsChars * 0.000167) ).toFixed(4)}
          </span>
        </button>

        {showCostBreakdown && (
          <div className="absolute top-14 sm:top-16 right-4 sm:right-16 z-[200] w-[calc(100%-2rem)] sm:w-[340px] bg-white border border-slate-200 rounded-[6px] shadow-2xl p-4 sm:p-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Session Cost Breakdown</h3>
              <button onClick={() => setShowCostBreakdown(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-4">
              {/* Groq Section */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-[4px]">
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
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-[4px]">
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
              <div className="p-3 bg-slate-900 rounded-[4px]">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Session Cost</span>
                  <span className="text-lg font-black text-white">${((groqTokens * 0.00000006) + (elevenLabsChars * 0.000167)).toFixed(4)}</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">Groq pricing: blended avg of $0.05/M input + $0.08/M output tokens. ElevenLabs pricing: Starter plan ($5/mo for 30K credits), ~$0.167 per 1,000 characters. Costs are estimates for this session only.</p>
            </div>
          </div>
        )}

        <button onClick={onClose} className="absolute top-3 sm:top-4 right-3 sm:right-4 w-8 h-8 sm:w-10 sm:h-10 rounded-[4px] bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all hover:scale-105 active:scale-95">
          <X className="w-5 h-5" />
        </button>

        <div className={`inline-flex items-center gap-2 pl-3 pr-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-2 border ${g.badge[ac]} relative`}>
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
        <h2 className="text-xl font-black text-slate-900 tracking-tight">{agentName}</h2>
        <p className="text-slate-400 text-xs font-medium mt-0.5">{formatTime(elapsed)}</p>

        {/* Waveform */}
        <div className="w-full max-w-[280px] sm:max-w-lg mt-4 sm:mt-8 relative">
          <div className="relative h-20 sm:h-32 flex items-center justify-center">
            {/* Ambient Background Glow */}
            <div className={`absolute inset-0 rounded-full blur-[60px] transition-all duration-700 ease-in-out ${phase === "speaking" ? "opacity-60 scale-125" : "opacity-30 scale-100"} ${g.glow[ac]}`} />
            
            <div className="relative flex items-center justify-center gap-[3px] sm:gap-1.5 h-full w-full">
              {bars.map((h, i) => (
                <div key={i} className={`rounded-full transition-[height,background-color] duration-[120ms] ease-out bg-gradient-to-t shadow-sm ${g.bar[ac]}`}
                  style={{ 
                    width: "5px", 
                    height: `${Math.max(4, isMicMuted || isPaused ? 8 : h)}%`, 
                    opacity: isMicMuted || isPaused ? 0.3 : 0.8 + (h / 100) * 0.2 
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 mt-8">
            <span className={`text-[11px] font-black uppercase tracking-[0.25em] ${g.text[ac]} transition-colors duration-500`}>{statusLabel}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-4 sm:mt-8 px-4">
          <button 
            onClick={() => setShowTranscript(!showTranscript)} 
            className="h-9 sm:h-10 rounded-xl px-3 sm:px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 text-xs font-bold"
            title="Toggle Live Transcript"
          >
            <MessageSquareText className="w-4 h-4" /> {showTranscript ? "Hide Chat" : "Show Chat"}
          </button>

          <button onClick={() => setIsMicMuted(!isMicMuted)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${isMicMuted ? "bg-rose-100 text-rose-600 ring-2 ring-rose-200" : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"}`}
          >
            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button onClick={finishUserTurn} disabled={phase !== "listening" || isMicMuted || isPaused}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              phase === "listening" && !isMicMuted && !isPaused ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200" : "bg-slate-200 text-slate-400"
            }`}
          >
            {phase === "processing" ? <><Loader2 className="w-4 h-4 animate-spin" /> Thinking...</> : <><Hand className="w-4 h-4" /> <span className="hidden sm:inline">I&apos;m Done Speaking</span><span className="sm:hidden">Done</span></>}
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
      <div className={`flex flex-col bg-white transition-all duration-500 ease-in-out overflow-hidden ${showTranscript ? "flex-1 min-h-[200px] sm:min-h-[300px] opacity-100" : "h-0 min-h-0 opacity-0"}`}>
        <div className="px-4 sm:px-8 pt-4 pb-2 flex items-center gap-2 shrink-0">
          <MessageSquareText className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Transcript</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-6">
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
                {transcriptLines.map((line, i) => {
                  // For bot messages, check the PRECEDING user message to detect action type
                  let action: { type: ActionType; data: Record<string, string> } = { type: null, data: {} };
                  if (!line.isUser && i > 0) {
                    // Find the most recent user message before this bot message
                    for (let j = i - 1; j >= 0; j--) {
                      if (transcriptLines[j].isUser) {
                        action = detectAction(transcriptLines[j].text);
                        break;
                      }
                    }
                  }
                  return (
                    <React.Fragment key={i}>
                      <div className={`flex gap-3 ${line.isUser ? "justify-end" : "justify-start"}`}>
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
                      {!line.isUser && action.type && <ActionPreviewCard type={action.type} data={action.data} />}
                    </React.Fragment>
                  );
                })}
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
