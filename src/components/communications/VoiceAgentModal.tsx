"use client";

import React, { useState, useEffect } from "react";
import { Mic, MicOff, Pause, Play, MessageSquareText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoiceAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
}

export function VoiceAgentModal({ isOpen, onClose, agentName }: VoiceAgentModalProps) {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAiPaused, setIsAiPaused] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  
  // Fake state to simulate audio reactivity
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    
    // Simulate audio reactivity when mic is not muted
    const interval = setInterval(() => {
      if (!isMicMuted && !isAiPaused) {
        setAudioLevel(prev => Math.max(0.1, Math.min(1, prev + (Math.random() - 0.5) * 0.4)));
      } else {
        setAudioLevel(0.1);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [isOpen, isMicMuted, isAiPaused]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-xl animate-in fade-in duration-300">
      
      {/* Top Bar for close button */}
      <div className="absolute top-6 right-6 z-50">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose} 
          className="h-10 w-10 text-slate-500 hover:text-slate-800 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className={`flex flex-col items-center justify-center w-full max-w-4xl px-6 transition-all duration-500`}>
        
        {/* Agent Info Header */}
        <div className="text-center mb-16 animate-in slide-in-from-top-4 duration-500 delay-100">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-semibold tracking-wide mb-4 shadow-sm">
            Live Voice Session
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">{agentName}</h2>
          <p className="text-slate-500 mt-2 font-medium">Ready when you are. Speak naturally.</p>
        </div>

        {/* Main Interface Wrapper */}
        <div className="relative w-full flex items-center justify-center min-h-[300px]">
          
          {/* Transcript Panel (Left Slide-in) */}
          {showTranscript && (
            <div className="absolute left-0 w-80 h-[400px] bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 flex flex-col animate-in slide-in-from-left-8 fade-in z-20">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <MessageSquareText className="w-4 h-4 text-indigo-500" />
                Live Transcript
              </h3>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
                {/* Mock Transcript Lines */}
                <div className="text-right">
                  <div className="inline-block bg-slate-100 rounded-2xl rounded-tr-sm px-4 py-2 text-sm text-slate-700 shadow-sm">
                    Hello, is the voice mode working?
                  </div>
                </div>
                <div className="text-left">
                  <div className="inline-block bg-indigo-50 rounded-2xl rounded-tl-sm px-4 py-2 text-sm text-indigo-900 shadow-sm">
                    Yes, I can hear you perfectly! How can I assist you today?
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Center Activity / Sound Wave Area */}
          <div className="flex flex-col items-center justify-center relative z-10 transition-all duration-300">
             
             {/* Dynamic Waveform Visualizer */}
             <div className="relative w-64 h-64 flex items-center justify-center">
                {/* Base pulsing glow */}
                <div className={`absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl transition-all duration-300 ${!isAiPaused && !isMicMuted ? 'animate-pulse' : 'opacity-0'}`} />
                
                {/* Visualizer Bars */}
                <div className="flex items-center justify-center gap-1.5 h-32">
                  {[...Array(11)].map((_, i) => {
                    // Create a bell curve effect mapping for heights
                    const centerFactor = 1 - Math.abs(i - 5) / 5;
                    const height = isAiPaused 
                      ? 10 
                      : (isMicMuted ? 4 : Math.max(4, audioLevel * centerFactor * 100));
                    
                    return (
                      <div 
                        key={i} 
                        className={`w-3 rounded-full transition-all duration-100 ease-out bg-gradient-to-t ${isMicMuted ? 'from-rose-400 to-rose-300' : (isAiPaused ? 'from-amber-400 to-amber-300' : 'from-indigo-600 to-indigo-400')}`}
                        style={{ height: `${height}%` }}
                      />
                    );
                  })}
                </div>
             </div>
             
             {/* Status Text under wave */}
             <div className="mt-8 h-6 text-sm font-bold uppercase tracking-widest text-slate-400">
               {isAiPaused ? 'Paused' : (isMicMuted ? 'Microphone Muted' : 'Listening...')}
             </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="mt-16 flex items-center gap-6 bg-white p-3 rounded-full shadow-lg border border-slate-200 animate-in slide-in-from-bottom-8 duration-500 delay-200">
           
           {/* Left: Toggle Transcript */}
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => setShowTranscript(!showTranscript)}
             className={`w-14 h-14 rounded-full transition-all ${showTranscript ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
             title="Toggle Live Transcript"
           >
             <MessageSquareText className="w-5 h-5" />
           </Button>

           {/* Center: Pause/Resume AI */}
           <Button 
             variant="solid" 
             size="icon" 
             onClick={() => setIsAiPaused(!isAiPaused)}
             className={`w-20 h-20 rounded-full shadow-xl transition-all hover:scale-105 active:scale-95 ${isAiPaused ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-900 hover:bg-slate-800'} text-white`}
             title={isAiPaused ? "Resume AI Speech" : "Pause AI Speech"}
           >
             {isAiPaused ? <Play className="w-8 h-8 ml-1" /> : <Pause className="w-8 h-8" />}
           </Button>

           {/* Right: Mute/Unmute Mic */}
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => setIsMicMuted(!isMicMuted)}
             className={`w-14 h-14 rounded-full transition-all ${isMicMuted ? 'bg-rose-100 text-rose-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
             title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
           >
             {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
           </Button>

        </div>
      </div>
    </div>
  );
}
