"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Pause, Play, MessageSquareText, X, Phone, Hand, Bot, User, Loader2, ChevronDown, Maximize2, Minimize2 } from "lucide-react";
import { getAuthHeaders } from "@/lib/api-auth-client";

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
  voiceId?: string;
}

type Phase = "listening" | "processing" | "speaking";
type TranscriptLine = { text: string; isUser: boolean; citations?: { text: string; source: string; type: string }[] };

export function VoiceAgentModal({ isOpen, onClose, agentName, agentId, orgPrefix, onCallAI, onUsageUpdate, existingMessages, onTranscriptUpdate, systemInstructions, knowledgeBaseText, pactText, voiceId }: VoiceAgentModalProps) {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [phase, setPhase] = useState<Phase>("listening");
  const [bars, setBars] = useState<number[]>(Array(32).fill(0));
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
  const noInputTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasReceivedInputRef = useRef(false);
  const interruptFrameCount = useRef(0);
  const lastTimerTextRef = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Persistent audio element for mobile compatibility - created once, reused
  const persistentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPausedRef = useRef(isPaused);
  const [responseDelay, setResponseDelay] = useState(1000);
  const responseDelayRef = useRef(1000);
  const [showTranscript, setShowTranscript] = useState(true);
  const [groqTokens, setGroqTokens] = useState(0);
  const [elevenLabsChars, setElevenLabsChars] = useState(0);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const finishUserTurnRef = useRef<() => Promise<void>>(async () => { });
  // Speculative pre-fetch: start LLM call while user is still in silence countdown
  const speculativeRef = useRef<{ text: string; promise: Promise<{ reply: string; pactFacts: any[]; usage: number; audioBase64?: string | null }> | null }>({ text: '', promise: null });
  const speculativeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Whisper Fallback (for PWAs/mobile where SpeechRecognition fails) ──
  const useWhisperFallback = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechDetectedButNoResult = useRef(false);
  const whisperCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [usingWhisper, setUsingWhisper] = useState(false);

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
  useEffect(() => {
    responseDelayRef.current = responseDelay;
    // If currently listening and there's an active silence timer, reset it with the new delay
    if (phaseRef.current === "listening" && silenceTimeoutRef.current && !isPausedRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      const currentText = accumulatedTextRef.current.trim();
      if (currentText && currentText.length > 2) {
        silenceTimeoutRef.current = setTimeout(() => {
          if (phaseRef.current === "listening" && !isPausedRef.current) {
            finishUserTurnRef.current();
          }
        }, responseDelay);
      }
    }
  }, [responseDelay]);

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
    // On mobile Android Chrome, continuous mode can silently stop working.
    // Keep continuous on desktop, but use shorter sessions on mobile with auto-restart.
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      if (phaseRef.current !== "listening") return; // Completely ignore late audio buffers

      // Clear the no-input timeout on first speech detected
      hasReceivedInputRef.current = true;
      if (noInputTimeoutRef.current) { clearTimeout(noInputTimeoutRef.current); noInputTimeoutRef.current = null; }

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

        // Cancel any in-flight speculative call since text changed
        if (speculativeTimerRef.current) clearTimeout(speculativeTimerRef.current);
        speculativeRef.current = { text: '', promise: null };

        silenceTimeoutRef.current = setTimeout(() => {
          if (phaseRef.current === "listening" && !isPausedRef.current) {
            const currentText = newText;
            if (currentText && currentText.length > 2) {
              finishUserTurnRef.current();
            }
          }
        }, responseDelayRef.current);

        // Speculative pre-fetch: start LLM call early (400ms into silence)
        // so the response is already being computed while the silence timer counts down
        const specDelay = Math.min(150, Math.floor(responseDelayRef.current * 0.15));
        if (newText.length > 3) {
          speculativeTimerRef.current = setTimeout(() => {
            if (phaseRef.current === "listening" && !isPausedRef.current) {
              const specText = accumulatedTextRef.current.trim();
              if (specText && specText.length > 3 && !speculativeRef.current.promise) {
                speculativeRef.current = {
                  text: specText,
                  promise: fetchAIReplyRef.current(specText),
                };
              }
            }
          }, specDelay);
        }
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

  // ── Whisper Fallback: MediaRecorder-based recording ──
  const startWhisperRecording = useCallback(() => {
    if (!streamRef.current || cancelledRef.current) return;
    try {
      // Stop any existing recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : 'audio/mp4';
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(250); // Collect chunks every 250ms
      mediaRecorderRef.current = recorder;
      setLiveText("");
    } catch (err) {
      console.error('MediaRecorder fallback failed:', err);
    }
  }, []);

  const stopWhisperRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve('');
        return;
      }
      recorder.onstop = async () => {
        const chunks = audioChunksRef.current;
        if (chunks.length === 0) { resolve(''); return; }
        const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        // Send to server for Whisper transcription
        try {
          const ext = (recorder.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
          const formData = new FormData();
          formData.append('audio', audioBlob, `recording.${ext}`);
          // Include auth headers — without these, /api/transcribe returns 401
          const authHeaders = await getAuthHeaders().catch(() => ({}));
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData, headers: authHeaders });
          if (res.ok) {
            const data = await res.json();
            resolve(data.text || '');
          } else {
            console.error('Transcribe API error:', res.status, await res.text().catch(() => ''));
            resolve('');
          }
        } catch (err) {
          console.error('Whisper transcription error:', err);
          resolve('');
        }
      };
      recorder.stop();
    });
  }, []);

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
    hasReceivedInputRef.current = false;

    // Window gesture handler to resume/unlock on first user tap/click inside the modal
    const unlockOnGesture = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
      if (persistentAudioRef.current) {
        const a = persistentAudioRef.current;
        if (a.src && a.src.startsWith("data:")) {
          a.play().then(() => {
            a.pause();
            a.currentTime = 0;
          }).catch(() => {});
        }
      }
    };
    window.addEventListener("click", unlockOnGesture, { capture: true, passive: true });
    window.addEventListener("touchstart", unlockOnGesture, { capture: true, passive: true });

    const initMic = async () => {
      try {
        // Check if Speech Recognition is supported
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
          const warnMsg = "Speech recognition is not supported on this browser. For voice features, please use a modern browser like Google Chrome (on Desktop/Android) or Apple Safari (on iOS/macOS).";
          setTranscriptLines(prev => [...prev, { text: warnMsg, isUser: false }]);
        }

        // --- WebKit/iOS audioSession override to ensure loudspeaker instead of quiet earpiece ---
        if (typeof navigator !== "undefined" && (navigator as any).audioSession) {
          try {
            (navigator as any).audioSession.category = "auto";
          } catch (e) {
            console.warn("Failed to set audioSession to auto:", e);
          }
        }

        // Try with ideal constraints first, fall back to basic if device doesn't support them
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
        } catch {
          // Fallback: some devices/browsers don't support constraints
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        if (typeof navigator !== "undefined" && (navigator as any).audioSession) {
          try {
            (navigator as any).audioSession.category = "play-and-record";
            (navigator as any).audioSession.mode = "spoken-audio";
          } catch (e) {
            console.warn("Failed to set audioSession to play-and-record:", e);
          }
        }

        if (cancelledRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;

        // Cross-browser AudioContext (Safari uses webkitAudioContext)
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        const globalCtx = (window as any).jarvisAudioContext;
        const ctx = (globalCtx && globalCtx.state !== "closed") ? globalCtx : new AudioCtx();
        (window as any).jarvisAudioContext = ctx;

        // iOS/Safari requires resume() after user gesture
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }
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

            if (ctx.createStereoPanner) {
              const panner = ctx.createStereoPanner();
              panner.pan.value = (index / (frequencies.length - 1)) * 1.5 - 0.75; // spread stereo
              osc.connect(panner);
              panner.connect(masterGain);
            } else {
              osc.connect(masterGain);
            }

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
        const timeDataArray = new Uint8Array(analyser.fftSize);

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

          for (let i = 0; i < barCount; i++) {
            if (phaseRef.current === "speaking" || phaseRef.current === "processing") {
              // Rich AI speaking visualizer with dynamic jumping
              const t = Date.now() / 1000;
              const center = barCount / 2;
              const gaussian = Math.exp(-Math.pow(i - center, 2) / (2 * Math.pow(barCount / 4.5, 2)));
              const speed = phaseRef.current === "processing" ? 3 : 15;
              const wave = Math.sin(t * speed + i * 0.4) * 0.5 +
                Math.sin(t * speed * 1.5 - i * 0.2) * 0.5;
              const isSpeaking = phaseRef.current === "speaking";
              const randomSpike = isSpeaking && Math.random() > 0.85 ? (Math.random() - 0.5) * 1.6 : 0;
              const baseAmplitude = isSpeaking ? 90 : 30;
              // Signed value: oscillates above and below center
              newBars.push(gaussian * baseAmplitude * (wave * 0.7 + randomSpike) * 0.01);
            } else {
              // Real Mic Input — use time-domain waveform data for true oscilloscope visualization
              if (analyserRef.current) {
                analyserRef.current.getByteTimeDomainData(timeDataArray);
                // Sample evenly across the waveform buffer — use PEAK for dramatic movement
                const samplesPerBar = Math.floor(timeDataArray.length / barCount);
                let peak = 0;
                for (let j = 0; j < samplesPerBar; j++) {
                  const idx = i * samplesPerBar + j;
                  // 128 is the center (silence). Displacement from center gives waveform shape.
                  const val = (timeDataArray[idx] || 128) - 128;
                  if (Math.abs(val) > Math.abs(peak)) peak = val;
                }
                // Amplify significantly — voice typically only deviates ±20 from center
                // 6x amplification makes the waveform visually responsive
                const amplified = (peak / 128) * 6;
                const clamped = Math.max(-95, Math.min(95, amplified * 95));
                newBars.push(clamped);
              } else {
                newBars.push(0);
              }
            }
          }
          setBars(newBars);
          animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick);

        // Start recognition immediately
        startRecognition();

        // ── Whisper Fallback Detection ──
        // If SpeechRecognition is available but doesn't produce results
        // (common in PWAs on Android, some Samsung browsers, Edge, Firefox),
        // auto-switch to Whisper after a short delay.
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        whisperCheckTimerRef.current = setTimeout(() => {
          // Check: waveform was active (mic works) but no recognition results
          if (!hasReceivedInputRef.current && !cancelledRef.current && phaseRef.current === 'listening') {
            // The mic is working (we got here), but SpeechRecognition gave us nothing.
            // Switch to Whisper fallback.
            console.log('SpeechRecognition not producing results — switching to Whisper fallback');
            useWhisperFallback.current = true;
            setUsingWhisper(true);
            stopRecognition(); // Stop the broken recognition
            // Cancel the no-input timeout since we're switching modes, not actually lacking input
            if (noInputTimeoutRef.current) { clearTimeout(noInputTimeoutRef.current); noInputTimeoutRef.current = null; }
            startWhisperRecording(); // Start recording audio for Whisper
            // Whisper mode active — no intrusive transcript message needed
          }
        }, 3000); // 3s on all platforms — fast enough to not annoy, slow enough to let SpeechRecognition try

        // 10-second no-input timeout: if user hasn't spoken, prompt them
        noInputTimeoutRef.current = setTimeout(async () => {
          if (!hasReceivedInputRef.current && !cancelledRef.current && phaseRef.current === "listening") {
            const noInputMsg = "I'm not hearing anything from your end \u2014 how can I help you today?";
            setTranscriptLines(prev => [...prev, { text: noInputMsg, isUser: false }]);
            setPhase("speaking");
            // Play TTS
            try {
              const audioUrl = `/api/tts?text=${encodeURIComponent(noInputMsg)}${voiceId ? `&voice=${encodeURIComponent(voiceId)}` : ''}`;
              const audio = persistentAudioRef.current || document.createElement('audio');
              audio.setAttribute('playsinline', 'true');
              audio.setAttribute('webkit-playsinline', 'true');
              const ttsHeaders = await getAuthHeaders().catch(() => ({}));
              const ttsRes = await fetch(audioUrl, { headers: ttsHeaders });
              if (ttsRes.ok) {
                const blob = await ttsRes.blob();
                const blobUrl = URL.createObjectURL(blob);
                audio.src = blobUrl;
                audio.volume = 1.0;
                audio.load();
                if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume().catch(() => {});
                audio.onended = () => {
                  setPhase("listening");
                  if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
                  if (!isMicMuted && !isPaused) { useWhisperFallback.current ? startWhisperRecording() : startRecognition(); }
                };
                audio.play().catch(() => {});
              } else {
                setTimeout(() => setPhase("listening"), 2000);
              }
            } catch {
              setTimeout(() => setPhase("listening"), 2000);
            }
          }
        }, 10000);

        // MOBILE FIX: "Unlock" a persistent audio element during this user-gesture-triggered flow.
        // Mobile browsers (iOS Safari, Chrome Android) block Audio.play() unless
        // the audio element was first played inside a direct user gesture.
        let a = (window as any).jarvisAudio;
        if (!a) {
          a = document.createElement('audio');
          a.setAttribute('playsinline', 'true');
          a.setAttribute('webkit-playsinline', 'true');
          // Play a tiny silent audio to unlock the element
          a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
          a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
          (window as any).jarvisAudio = a;
        }
        persistentAudioRef.current = a;

        // MOBILE PLAYBACK STABILITY: We bypass connecting the <audio> element to AudioContext.
        // On iOS Safari, routing audio element output through createMediaElementSource often causes it
        // to be completely muted, crackly, or forced to the low-volume earpiece. Playing it directly is 100% stable.
      } catch (err: any) {
        console.error("Microphone access denied:", err);
        const errorMsg = err?.name === 'NotAllowedError' 
          ? "Microphone permission was denied. Please allow microphone access in your browser settings and try again."
          : err?.name === 'NotFoundError'
          ? "No microphone was found on your device. Please connect a microphone and try again."
          : "Unable to access your microphone. Please check your device settings and try again.";
        setTranscriptLines(prev => [...prev, { text: errorMsg, isUser: false }]);
      }
    };

    initMic();

    return () => {
      cancelledRef.current = true;
      if (noInputTimeoutRef.current) { clearTimeout(noInputTimeoutRef.current); noInputTimeoutRef.current = null; }
      if (whisperCheckTimerRef.current) { clearTimeout(whisperCheckTimerRef.current); whisperCheckTimerRef.current = null; }
      cancelAnimationFrame(animFrameRef.current);
      stopRecognition();
      // Stop MediaRecorder if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      window.removeEventListener("click", unlockOnGesture, { capture: true });
      window.removeEventListener("touchstart", unlockOnGesture, { capture: true });
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      // Suspend audio context instead of closing it, to persist the connected audio source nodes safely
      if (audioCtxRef.current) {
        audioCtxRef.current.suspend().catch(() => {});
      }
      analyserRef.current = null;

      // Reset audio session category on exit
      if (typeof navigator !== "undefined" && (navigator as any).audioSession) {
        try {
          (navigator as any).audioSession.category = "playback";
          (navigator as any).audioSession.mode = "default";
          setTimeout(() => {
            try {
              (navigator as any).audioSession.category = "auto";
            } catch {}
          }, 300);
        } catch {}
      }
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

      // Suspend audio context instead of closing it, to persist the connected audio source nodes safely
      if (audioCtxRef.current) {
        audioCtxRef.current.suspend().catch(() => { });
      }
      analyserRef.current = null;

      // Kill animation frame
      cancelAnimationFrame(animFrameRef.current);

      // Kill MediaRecorder if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
        mediaRecorderRef.current = null;
      }
      audioChunksRef.current = [];

      // Kill any pending audio playback — both audioRef AND persistentAudioRef
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (persistentAudioRef.current) {
        persistentAudioRef.current.pause();
        persistentAudioRef.current.src = "";
        persistentAudioRef.current.currentTime = 0;
      }
      // Also kill the global window.jarvisAudio if it exists
      if (typeof window !== 'undefined' && (window as any).jarvisAudio) {
        (window as any).jarvisAudio.pause();
        (window as any).jarvisAudio.src = "";
        (window as any).jarvisAudio.currentTime = 0;
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
      setBars(Array(32).fill(0));
      accumulatedTextRef.current = "";
      conversationRef.current = [];
      interruptFrameCount.current = 0;
      lastTimerTextRef.current = "";
      useWhisperFallback.current = false;
      setUsingWhisper(false);
      if (whisperCheckTimerRef.current) { clearTimeout(whisperCheckTimerRef.current); whisperCheckTimerRef.current = null; }
    }
  }, [isOpen, stopRecognition]);

  // ── Pure API call (no conversation side-effects) — used for speculative pre-fetch ──
  // Now calls the COMBINED LLM+TTS endpoint so audio comes back in the same response
  const fetchAIReply = useCallback(async (userText: string): Promise<{ reply: string; pactFacts: any[]; usage: number; audioBase64?: string | null; citations?: { text: string; source: string; type: string }[] }> => {
    const messagesForCall = [...conversationRef.current, { role: "user", content: userText }];
    try {
      if (onCallAI) {
        // When using parent-provided callback (e.g. from the main chat page), no combined endpoint
        const payload: any = await onCallAI(messagesForCall);
        return { reply: payload.response || "I couldn't process that.", usage: payload.usage || 0, pactFacts: payload.pactFacts || [], audioBase64: null, citations: payload.citations || [] };
      } else {
        // Use combined LLM+TTS endpoint — one round-trip for text + audio
        const res = await fetch("/api/voice-chat-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesForCall,
            agentId: `${orgPrefix}_${agentId}`,
            systemInstructions,
            knowledgeBaseText,
            pactText,
            voiceId: voiceId || undefined,
          }),
        });
        const data = await res.json();
        return {
          reply: data.response || "I couldn't process that.",
          usage: data.usage || 0,
          pactFacts: data.pactFacts || [],
          audioBase64: data.audioBase64 || null,
          citations: data.citations || [],
        };
      }
    } catch (err: any) {
      console.error("Voice AI Call Error:", err?.message || err);
      const msg = err?.message?.includes("fetch") || err?.message?.includes("network") || err?.message?.includes("Failed")
        ? "Network connection issue. Check your internet and try again."
        : "Connection issue. Try again.";
      return { reply: msg, pactFacts: [], usage: 0, audioBase64: null };
    }
  }, [onCallAI, orgPrefix, agentId, systemInstructions, knowledgeBaseText, pactText, voiceId]);

  const fetchAIReplyRef = useRef(fetchAIReply);
  useEffect(() => { fetchAIReplyRef.current = fetchAIReply; }, [fetchAIReply]);

  // ── Call voice endpoint (with conversation management) ──
  const callVoiceAI = async (userText: string) => {
    // Check for speculative pre-fetch match first
    let result: { reply: string; pactFacts: any[]; usage: number; audioBase64?: string | null; citations?: { text: string; source: string; type: string }[] };
    if (speculativeRef.current.promise && speculativeRef.current.text === userText) {
      // Speculative call matches — reuse it (saves 0.5-2s!)
      result = await speculativeRef.current.promise;
    } else {
      // Discard mismatched speculative result, make fresh call
      speculativeRef.current = { text: '', promise: null };
      result = await fetchAIReply(userText);
    }
    speculativeRef.current = { text: '', promise: null };

    // Now commit to conversation history
    conversationRef.current.push({ role: "user", content: userText });
    conversationRef.current.push({ role: "assistant", content: result.reply });

    setGroqTokens(p => p + result.usage);
    setElevenLabsChars(p => p + result.reply.length);
    if (onUsageUpdate) onUsageUpdate(result.usage, result.reply.length);

    return { reply: result.reply, pactFacts: result.pactFacts, audioBase64: result.audioBase64, citations: result.citations };
  };

  // ── "I'm Done" handler ──
  const finishUserTurn = async () => {
    if (phaseRef.current !== "listening") return;
    // Instantly lock phaseRef to prevent double-firing from rapid clicks or debounce overlaps
    phaseRef.current = "processing";

    let spokenText = '';

    if (useWhisperFallback.current) {
      // ── Whisper Fallback Mode: Stop recording and transcribe via API ──
      setLiveText("⏳ Transcribing...");
      setPhase("processing");
      spokenText = await stopWhisperRecording();
      setLiveText('');
    } else {
      // ── Normal SpeechRecognition Mode ──
      // MOBILE FIX: On Android Chrome, SpeechRecognition sometimes doesn't mark results
      // as isFinal, so accumulatedTextRef stays empty while liveText has the interim text.
      spokenText = accumulatedTextRef.current.trim();
      if (!spokenText) {
        spokenText = liveText.trim();
      }
    }

    if (!spokenText) {
      phaseRef.current = "listening"; // unlock if empty
      setPhase("listening");
      // Restart recording in Whisper mode
      if (useWhisperFallback.current) startWhisperRecording();
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

    // Actually call AI — combined endpoint returns text + audio in one round-trip
    const { reply: aiReplyText, pactFacts, audioBase64, citations } = await callVoiceAI(spokenText);
    const cleanedReply = (aiReplyText || "").replace(/<[^>]*>/g, ""); // Strip any XML/HTML if leaked

    if (cancelledRef.current) return;

    // MOBILE FIX: Reuse the persistent unlocked audio element instead of new Audio()
    const audio = persistentAudioRef.current || document.createElement('audio');
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');

    // Kill any existing audio to prevent overlap
    if (audioRef.current && audioRef.current !== audio) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    audioRef.current = audio;

    // Update parent component and transcript
    if (onTranscriptUpdate) {
      onTranscriptUpdate(spokenText, cleanedReply, pactFacts);
    }
    setTranscriptLines(prev => [...prev, { text: cleanedReply, isUser: false, citations: citations && citations.length > 0 ? citations : undefined }]);
    setPhase("speaking");

    try {
      audio.onended = () => {
        setPhase("listening");
        if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
        audioRef.current = null;
        if (!isMicMuted && !isPaused) {
          if (useWhisperFallback.current) { startWhisperRecording(); }
          else { startRecognition(); }
        }
      };

      let blobUrl: string;

      if (audioBase64) {
        // FAST PATH: Audio came from the combined endpoint — no extra network call needed!
        const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
        const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });
        blobUrl = URL.createObjectURL(audioBlob);
      } else {
        // FALLBACK: Audio not in response (onCallAI mode) — fetch TTS separately
        const audioUrl = `/api/tts?text=${encodeURIComponent(cleanedReply)}${voiceId ? `&voice=${encodeURIComponent(voiceId)}` : ''}`;
        const ttsHeaders = await getAuthHeaders().catch(() => ({}));
        const ttsResponse = await fetch(audioUrl, { headers: ttsHeaders });
        if (!ttsResponse.ok) throw new Error(`TTS fetch failed: ${ttsResponse.status}`);
        const audioBlob = await ttsResponse.blob();
        blobUrl = URL.createObjectURL(audioBlob);
      }

      if (cancelledRef.current) { URL.revokeObjectURL(blobUrl); return; }

      audio.src = blobUrl;
      audio.volume = 1.0;
      audio.muted = false;
      audio.load();

      // Ensure AudioContext is active before playing (iOS requirement)
      if (audioCtxRef.current?.state === 'suspended') {
        await audioCtxRef.current.resume().catch(() => {});
      }

      await new Promise<void>((resolve, reject) => {
        let played = false;
        const tryPlay = () => {
          if (played) return;
          played = true;
          audio.play().then(resolve).catch((e) => {
            console.warn('Audio play blocked, retrying:', e.message);
            setTimeout(() => {
              if (audioCtxRef.current?.state === 'suspended') {
                audioCtxRef.current.resume().catch(() => {});
              }
              audio.play().then(resolve).catch(reject);
            }, 250);
          });
        };
        audio.oncanplay = () => tryPlay();
        audio.oncanplaythrough = () => tryPlay();
        audio.onerror = () => reject(new Error("Audio load failed"));
        if (audio.readyState >= 3) tryPlay();
        setTimeout(() => { if (!played) tryPlay(); }, 100);
      });
    } catch (err) {
      console.error(err);
      const delay = Math.max(1500, Math.min(cleanedReply.length * 35, 6000));
      speakingTimeoutRef.current = setTimeout(() => {
        setPhase("listening");
        if (!isMicMuted && !isPaused) { useWhisperFallback.current ? startWhisperRecording() : startRecognition(); }
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
      <div className="fixed bottom-6 right-6 z-[200] w-80 bg-[#fefdfb] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 border border-slate-200">
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
            
            <h2 className="text-base font-light text-slate-500 tracking-[0.06em]" style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}>{agentName}</h2>
            <p className="text-slate-400 text-[10px] font-medium mt-0.5">{formatTime(elapsed)}</p>

            {/* Waveform */}
            <div className="w-full max-w-[200px] mt-4 relative">
              <div className="relative h-16 flex items-center justify-center">
                <div className={`absolute inset-0 rounded-full blur-[40px] transition-all duration-700 ease-in-out ${phase === "speaking" ? "opacity-60 scale-125" : "opacity-30 scale-100"} ${g.glow[ac]}`} />
                <div className="relative flex items-center justify-center h-full w-full" style={{ gap: '1px' }}>
                  {bars.slice(0, 24).map((val, i) => {
                    const displacement = isMicMuted || isPaused ? 0 : val;
                    const absHeight = Math.abs(displacement);
                    const barHeight = Math.max(1.5, absHeight);
                    const translateY = displacement * -0.5;
                    return (
                      <div
                        key={i}
                        className={`rounded-full bg-gradient-to-t ${g.bar[ac]}`}
                        style={{
                          width: '3px',
                          height: `${barHeight}%`,
                          transform: `translateY(${translateY}%)`,
                          opacity: isMicMuted || isPaused ? 0.3 : 0.6 + (absHeight / 100) * 0.4,
                          transition: 'height 80ms ease-out, transform 80ms ease-out, opacity 200ms ease',
                        }}
                      />
                    );
                  })}
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

              <button onClick={(e) => {
                  e.preventDefault();
                  if (phase === "speaking") {
                    if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current.src = "";
                      audioRef.current = null;
                    }
                    if (speakingTimeoutRef.current) {
                      clearTimeout(speakingTimeoutRef.current);
                      speakingTimeoutRef.current = null;
                    }
                    setPhase("listening");
                    phaseRef.current = "listening";
                    if (!isMicMuted && !isPaused) { useWhisperFallback.current ? startWhisperRecording() : startRecognition(); }
                  } else {
                    finishUserTurn();
                  }
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  if ((phase !== "listening" && phase !== "speaking") || isMicMuted || isPaused) return;
                  if (phase === "speaking") {
                    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; }
                    if (speakingTimeoutRef.current) { clearTimeout(speakingTimeoutRef.current); speakingTimeoutRef.current = null; }
                    setPhase("listening"); phaseRef.current = "listening";
                    if (!isMicMuted && !isPaused) { useWhisperFallback.current ? startWhisperRecording() : startRecognition(); }
                  } else { finishUserTurn(); }
                }}
                disabled={(phase !== "listening" && phase !== "speaking") || isMicMuted || isPaused}
                className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${phase === "speaking" ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-200" : phase === "listening" && !isMicMuted && !isPaused ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200" : "bg-slate-200 text-slate-400"
                  }`}
              >
                {phase === "processing" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> ...</> : phase === "speaking" ? <><Play className="w-3.5 h-3.5" /> Resume</> : <><Hand className="w-3.5 h-3.5" /> Done</>}
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

  const speedOptions = [
    { value: 500, label: 'Fast' },
    { value: 1000, label: 'Normal' },
    { value: 3000, label: 'Relaxed' },
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-slate-50 flex flex-col animate-in fade-in duration-300">
      <div className={`h-1 w-full bg-gradient-to-r ${g.grad[ac]} shrink-0`} />

      <div className="flex flex-col flex-1 relative bg-gradient-to-b from-slate-50 to-white overflow-hidden">
        
        <div className="absolute top-6 left-4 right-4 sm:left-8 sm:right-8 flex items-center justify-between pointer-events-none z-[100]">
          {/* Top Left: Cost */}
          <button onClick={() => setShowCostBreakdown(!showCostBreakdown)} className="pointer-events-auto px-4 h-9 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200/80 flex items-center gap-2 shadow-sm cursor-pointer hover:bg-white transition-colors z-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" /></svg>
            <span className="text-[11px] font-semibold tracking-wider text-slate-500 whitespace-nowrap">
              ${((groqTokens * 0.00000006) + (elevenLabsChars * 0.000167)).toFixed(4)}
            </span>
          </button>
          
          {/* Top Right: Minimize & Close */}
          <div className="flex items-center gap-2 pointer-events-auto z-[101]">
            <button onClick={() => setIsMinimized(true)} className="w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200/80 hover:bg-white text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm" title="Minimize">
              <Minimize2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200/80 hover:bg-white text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm" title="End Call">
              <X className="w-4 h-4" />
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

              <div className="p-3 bg-slate-900 rounded-[8px]">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Session Cost</span>
                  <span className="text-lg font-black text-white">${((groqTokens * 0.00000006) + (elevenLabsChars * 0.000167)).toFixed(4)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Upper Section: Agent identity, waveform, controls ── */}
        <div className="flex flex-col items-center pt-32 sm:pt-28 pb-6 shrink-0">

          {/* Speed Selector — fixed neutral design, never changes with phase */}
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-full p-1 shadow-sm mb-8">
            {speedOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setResponseDelay(opt.value)}
                className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
                  responseDelay === opt.value
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Agent Name + Brain Diagram */}
          <div className="relative w-full max-w-4xl px-6" style={{ minHeight: '220px', paddingTop: '50px', paddingBottom: '50px' }}>
            {/* Faint animated cloud behind JARVIS text for mystique */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
              <div className="absolute w-[340px] h-[160px] rounded-full opacity-[0.08]" style={{ background: 'radial-gradient(ellipse, #c7d2fe 0%, transparent 70%)', animation: 'jarvisCloud1 12s ease-in-out infinite' }} />
              <div className="absolute w-[260px] h-[120px] rounded-full opacity-[0.10]" style={{ background: 'radial-gradient(ellipse, #e0e7ff 0%, transparent 70%)', animation: 'jarvisCloud2 16s ease-in-out infinite', animationDelay: '-4s' }} />
              <div className="absolute w-[400px] h-[140px] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(ellipse, #ddd6fe 0%, transparent 70%)', animation: 'jarvisCloud3 20s ease-in-out infinite', animationDelay: '-8s' }} />
            </div>
            <style>{`
              @keyframes jarvisCloud1 { 0%, 100% { transform: translate(-15px, -5px) scale(1); } 33% { transform: translate(20px, 8px) scale(1.1); } 66% { transform: translate(-8px, -12px) scale(0.95); } }
              @keyframes jarvisCloud2 { 0%, 100% { transform: translate(10px, 5px) scale(1); } 50% { transform: translate(-18px, -8px) scale(1.15); } }
              @keyframes jarvisCloud3 { 0%, 100% { transform: translate(5px, 10px) scale(1.05); } 40% { transform: translate(-12px, -6px) scale(0.9); } 70% { transform: translate(15px, 3px) scale(1.1); } }
            `}</style>
            {/* Decorative brain/tools diagram — dotted lines from JARVIS to its inputs */}
            {/* viewBox height=220: top boxes at y=10, text center ~y=110, bottom boxes at y=200 */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 220" preserveAspectRatio="xMidYMid meet" overflow="visible">
              {/* ═══ LEFT SIDE ═══ */}
              {/* Line 1: Qwen 3 (LLM) — top left: 45° up from center, then horizontal left */}
              <path d="M 500,85 L 410,10 L 130,10" fill="none" stroke="#cbd5e1" strokeWidth="1.4" strokeDasharray="6 4" />
              <rect x="15" y="-6" width="115" height="32" rx="10" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.3" />
              <text x="72" y="16" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#94a3b8" fontFamily="'Inter', system-ui, sans-serif">Qwen 3</text>
              <circle cx="130" cy="10" r="3.5" fill="#cbd5e1" />

              {/* Line 2: Knowledge Base — bottom left: 45° down from center, then horizontal left */}
              <path d="M 500,135 L 410,210 L 140,210" fill="none" stroke="#cbd5e1" strokeWidth="1.4" strokeDasharray="6 4" />
              <rect x="15" y="194" width="125" height="32" rx="10" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.3" />
              <text x="77" y="216" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#94a3b8" fontFamily="'Inter', system-ui, sans-serif">Knowledge</text>
              <circle cx="140" cy="210" r="3.5" fill="#cbd5e1" />

              {/* ═══ RIGHT SIDE ═══ */}
              {/* Line 3: ElevenLabs (Voice) — top right: 45° up from center, then horizontal right */}
              <path d="M 500,85 L 590,10 L 855,10" fill="none" stroke="#cbd5e1" strokeWidth="1.4" strokeDasharray="6 4" />
              <rect x="855" y="-6" width="130" height="32" rx="10" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.3" />
              <text x="920" y="16" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#94a3b8" fontFamily="'Inter', system-ui, sans-serif">ElevenLabs</text>
              <circle cx="855" cy="10" r="3.5" fill="#cbd5e1" />

              {/* Line 4: Internet — bottom right: 45° down from center, then horizontal right */}
              <path d="M 500,135 L 590,210 L 865,210" fill="none" stroke="#cbd5e1" strokeWidth="1.4" strokeDasharray="6 4" />
              <rect x="865" y="194" width="115" height="32" rx="10" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.3" />
              <text x="922" y="216" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#94a3b8" fontFamily="'Inter', system-ui, sans-serif">Internet</text>
              <circle cx="865" cy="210" r="3.5" fill="#cbd5e1" />

              {/* Center connection dots where 45° lines originate */}
              <circle cx="500" cy="85" r="3.5" fill="#94a3b8" opacity="0.5" />
              <circle cx="500" cy="135" r="3.5" fill="#94a3b8" opacity="0.5" />
            </svg>
            <h2 className="text-5xl sm:text-6xl font-light text-slate-500 tracking-[0.12em] text-center relative z-10" style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}>{agentName}</h2>
          </div>
          <p className="text-slate-400 text-sm font-medium tabular-nums mt-2">{formatTime(elapsed)}</p>

          {/* Waveform */}
          <div className="w-full max-w-[300px] sm:max-w-2xl mt-10 mb-8 relative">
            <div className="relative h-28 sm:h-36 flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full blur-[60px] transition-all duration-700 ease-in-out ${phase === "speaking" ? "opacity-50 scale-110" : "opacity-20 scale-100"} ${g.glow[ac]}`} />
              <div className="relative flex items-center justify-center h-full w-full" style={{ gap: 'clamp(2px, 0.5vw, 6px)' }}>
                {bars.map((val, i) => {
                  const displacement = isMicMuted || isPaused ? 0 : val;
                  const absHeight = Math.abs(displacement);
                  const barHeight = Math.max(1.5, absHeight);
                  const translateY = displacement * -0.5;
                  return (
                    <div
                      key={i}
                      className={`rounded-full bg-gradient-to-t ${g.bar[ac]}`}
                      style={{
                        width: 'clamp(3px, 0.6vw, 8px)',
                        height: `${barHeight}%`,
                        transform: `translateY(${translateY}%)`,
                        opacity: isMicMuted || isPaused ? 0.3 : 0.6 + (absHeight / 100) * 0.4,
                        transition: 'height 80ms ease-out, transform 80ms ease-out, opacity 200ms ease',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <span className={`text-sm font-bold uppercase tracking-[0.2em] ${g.text[ac]} transition-colors duration-500 mb-6`}>{statusLabel}</span>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 sm:gap-5 px-4">
            <button onClick={() => setIsMicMuted(!isMicMuted)}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm ${isMicMuted ? "bg-rose-100 text-rose-600 ring-2 ring-rose-200" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
            >
              {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button
              onClick={(e) => {
                e.preventDefault();
                if (phase === "speaking") {
                  if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; }
                  if (speakingTimeoutRef.current) { clearTimeout(speakingTimeoutRef.current); speakingTimeoutRef.current = null; }
                  setPhase("listening"); phaseRef.current = "listening";
                  if (!isMicMuted && !isPaused) { useWhisperFallback.current ? startWhisperRecording() : startRecognition(); }
                } else { finishUserTurn(); }
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                if ((phase !== "listening" && phase !== "speaking") || isMicMuted || isPaused) return;
                if (phase === "speaking") {
                  if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; }
                  if (speakingTimeoutRef.current) { clearTimeout(speakingTimeoutRef.current); speakingTimeoutRef.current = null; }
                  setPhase("listening"); phaseRef.current = "listening";
                  if (!isMicMuted && !isPaused) { useWhisperFallback.current ? startWhisperRecording() : startRecognition(); }
                } else { finishUserTurn(); }
              }}
              disabled={(phase !== "listening" && phase !== "speaking") || isMicMuted || isPaused}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold transition-all hover:scale-105 active:scale-95 shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
                phase === "speaking" ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-200/50" :
                phase === "listening" && !isMicMuted && !isPaused ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200/50" :
                "bg-slate-200 text-slate-400"
              }`}
            >
              {phase === "processing" ? <><Loader2 className="w-5 h-5 animate-spin" /> Thinking...</> : phase === "speaking" ? <><Play className="w-5 h-5" /> Resume</> : <><Hand className="w-5 h-5" /> Done Speaking</>}
            </button>

            <button onClick={() => setIsPaused(!isPaused)}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm ${isPaused ? "bg-amber-100 text-amber-600 ring-2 ring-amber-200" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
            >
              {isPaused ? <Play className="w-6 h-6 ml-0.5" /> : <Pause className="w-6 h-6" />}
            </button>

            <button onClick={onClose} className="w-14 h-14 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95 border border-rose-200 shadow-sm">
              <Phone className="w-6 h-6 rotate-[135deg]" />
            </button>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="mx-auto w-full max-w-2xl px-8">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200/70" />
            <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest">Transcript</span>
            <div className="flex-1 h-px bg-slate-200/70" />
          </div>
        </div>

        {/* ── Lower Section: Chat Bubble Transcript ── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          <div className="max-w-2xl mx-auto space-y-3">

            {/* Welcome hint — always shown as the first bubble */}
            {transcriptLines.length === 0 && !liveText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl rounded-bl-md bg-white border border-slate-200 text-slate-500 text-[14px] leading-relaxed shadow-sm">
                  Start speaking, and you&apos;ll see your words transcribed here in real time. When {agentName} responds, the reply will appear below.
                </div>
              </div>
            )}

            {transcriptLines.map((line, idx) => (
              <div key={idx} className={`flex ${line.isUser ? 'justify-end' : 'justify-start'}`}>
                {/* Citation bubbles — to the left of AI messages */}
                {!line.isUser && line.citations && line.citations.length > 0 && (
                  <div className="flex flex-col gap-1 items-end justify-end max-w-[140px] shrink-0 mr-1.5 animate-in fade-in slide-in-from-left-2 duration-500">
                    {line.citations.slice(0, 3).map((cite, ci) => (
                      <div key={ci} className="border border-dashed border-slate-200 rounded-lg px-2 py-1 text-[9px] leading-tight text-slate-400 bg-white/50 backdrop-blur-sm max-w-full">
                        <div className="font-bold text-[8px] uppercase tracking-wider text-slate-300 mb-0.5">{cite.source}</div>
                        <div className="line-clamp-2">{cite.text}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className={`max-w-[80%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed ${
                  line.isUser
                    ? 'bg-slate-800 text-white rounded-br-md'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                }`}>
                  {line.text}
                </div>
              </div>
            ))}

            {/* Live transcription bubble — shows user's words appearing in real time */}
            {liveText && phase === "listening" && (
              <div className="flex justify-end">
                <div className="max-w-[80%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl rounded-br-md bg-slate-700 text-white/90 text-[14px] leading-relaxed">
                  {liveText}
                  <span className="inline-block w-0.5 h-4 bg-white/50 ml-0.5 animate-pulse align-text-bottom" />
                </div>
              </div>
            )}

            {/* AI thinking indicator — animated dots */}
            {phase === "processing" && (
              <div className="flex justify-start">
                <div className="px-5 py-3 rounded-2xl rounded-bl-md bg-white border border-slate-200 shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.2s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.2s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.2s' }} />
                </div>
              </div>
            )}

            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
