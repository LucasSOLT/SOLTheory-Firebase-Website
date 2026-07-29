"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Play, Pause, RotateCcw, ChevronDown, X, Coffee, Zap, Clock, Volume2, VolumeX } from "lucide-react";

// ── Types ──
type TimerMode = "pomodoro" | "timer" | "stopwatch";
type PomodoroPhase = "work" | "shortBreak" | "longBreak";

interface ActionBoardTimerProps {
  isDarkMode: boolean;
  tasks?: Array<{ id: string; title: string; column: string }>;
  onTimerComplete?: (taskId: string | null, durationMinutes: number) => void;
}

// ── Preset Configs ──
const POMODORO_DEFAULTS = { work: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60, sessionsBeforeLong: 4 };
const TIMER_PRESETS = [
  { label: "5 min", seconds: 5 * 60 },
  { label: "15 min", seconds: 15 * 60 },
  { label: "25 min", seconds: 25 * 60 },
  { label: "30 min", seconds: 30 * 60 },
  { label: "45 min", seconds: 45 * 60 },
  { label: "60 min", seconds: 60 * 60 },
  { label: "90 min", seconds: 90 * 60 },
];

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function ActionBoardTimer({ isDarkMode, tasks = [], onTimerComplete }: ActionBoardTimerProps) {
  // ── State ──
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<TimerMode>("pomodoro");
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Pomodoro state
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>("work");
  const [pomodoroSession, setPomodoroSession] = useState(0);
  const [pomodoroTime, setPomodoroTime] = useState(POMODORO_DEFAULTS.work);

  // Regular timer state
  const [timerDuration, setTimerDuration] = useState(25 * 60);
  const [timerTime, setTimerTime] = useState(25 * 60);

  // Stopwatch state
  const [stopwatchTime, setStopwatchTime] = useState(0);

  // Task association
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);

  // Total focused time tracking
  const [totalFocusedSeconds, setTotalFocusedSeconds] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Audio ──
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Mi4x7bnB1foaEhH13dnl/g4KBfXl3eH2BgoJ+enl5fIGCg396eXl9gYODf3t5eXyBg4OAe3l5fIGDg4B7eXl9gYODgHt5eX2Bg4OAfHl5fIGDg4B7eXl9gYODgHt5eX2Bg4N/e3l6fYGDg397eXp9gYODf3t5en2Bg4N/e3l6fYGDg397eXp9gYKCf3t5en6Bg4N/e3l6fYGCgn97eXp+gYODf3t5en6BgoJ/e3l6foGCgn97eXp+gYKCf3t5en6BgoJ/e3p6foGCgn97enp+gYKCf3t6en6BgoJ/e3p6foGCgn97enp+gYKCf3t6en6BgoJ/e3p6foGCgn97enp+gYKCf3t6en6BgoJ/e3p6foGCgn97enp+gYKCf3t6en6BgoJ/e3p6fg==");
    }
  }, []);

  const playSound = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [soundEnabled]);

  // ── Timer Logic ──
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      if (mode === "pomodoro") {
        setPomodoroTime(prev => {
          if (prev <= 1) {
            playSound();
            // Track focused work time
            if (pomodoroPhase === "work") {
              setTotalFocusedSeconds(t => t + POMODORO_DEFAULTS.work);
            }
            // Transition phase
            if (pomodoroPhase === "work") {
              const completedSessions = pomodoroSession + 1;
              setPomodoroSession(completedSessions);
              if (completedSessions >= POMODORO_DEFAULTS.sessionsBeforeLong) {
                setPomodoroPhase("longBreak");
                return POMODORO_DEFAULTS.longBreak;
              } else {
                setPomodoroPhase("shortBreak");
                return POMODORO_DEFAULTS.shortBreak;
              }
            } else {
              // After a long break, reset session counter
              if (pomodoroPhase === "longBreak") {
                setPomodoroSession(0);
              }
              setPomodoroPhase("work");
              return POMODORO_DEFAULTS.work;
            }
          }
          return prev - 1;
        });
      } else if (mode === "timer") {
        setTimerTime(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            playSound();
            setTotalFocusedSeconds(t => t + timerDuration);
            if (onTimerComplete) onTimerComplete(linkedTaskId, Math.round(timerDuration / 60));
            return 0;
          }
          return prev - 1;
        });
      } else {
        setStopwatchTime(prev => prev + 1);
      }
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, mode, pomodoroPhase, pomodoroSession, playSound, timerDuration, linkedTaskId, onTimerComplete]);

  // ── Controls ──
  const resetTimer = () => {
    setIsRunning(false);
    if (mode === "pomodoro") {
      setPomodoroPhase("work");
      setPomodoroTime(POMODORO_DEFAULTS.work);
      setPomodoroSession(0);
    } else if (mode === "timer") {
      setTimerTime(timerDuration);
    } else {
      if (stopwatchTime > 0 && onTimerComplete) {
        onTimerComplete(linkedTaskId, Math.round(stopwatchTime / 60));
      }
      setStopwatchTime(0);
    }
  };

  const selectPreset = (seconds: number) => {
    setTimerDuration(seconds);
    setTimerTime(seconds);
    setIsRunning(false);
  };

  // ── Derived Values ──
  const currentTime = mode === "pomodoro" ? pomodoroTime : mode === "timer" ? timerTime : stopwatchTime;
  const totalTime = mode === "pomodoro"
    ? (pomodoroPhase === "work" ? POMODORO_DEFAULTS.work : pomodoroPhase === "shortBreak" ? POMODORO_DEFAULTS.shortBreak : POMODORO_DEFAULTS.longBreak)
    : mode === "timer" ? timerDuration : 0;
  const progress = mode === "stopwatch" ? 0 : totalTime > 0 ? ((totalTime - currentTime) / totalTime) * 100 : 0;

  const phaseLabel = mode === "pomodoro"
    ? pomodoroPhase === "work" ? "Focus" : pomodoroPhase === "shortBreak" ? "Short Break" : "Long Break"
    : mode === "timer" ? "Countdown" : "Stopwatch";

  const phaseColor = pomodoroPhase === "work" ? "text-red-500" : "text-emerald-500";
  const progressColor = mode === "pomodoro"
    ? (pomodoroPhase === "work" ? "stroke-red-500" : "stroke-emerald-500")
    : mode === "timer" ? "stroke-indigo-500" : "stroke-amber-500";

  const linkedTask = tasks.find(t => t.id === linkedTaskId);
  const activeTasks = tasks.filter(t => t.column !== "done");

  // ── Render ──
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300' : 'border-slate-200 bg-[#faf8f3] hover:bg-[#f2ece0] text-slate-600'} transition-colors text-sm font-medium cursor-pointer ${isRunning ? 'ring-2 ring-indigo-500/40 border-indigo-400' : ''}`}
      >
        <Timer className="w-4 h-4" />
        {isRunning ? (
          <span className="font-mono text-xs tabular-nums">{formatTime(currentTime)}</span>
        ) : (
          <span className="hidden sm:inline">Timer</span>
        )}
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-[100] w-80 rounded-2xl shadow-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} animate-in slide-in-from-bottom-4 fade-in duration-300`}>
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50/80'}`}>
        <div className="flex items-center gap-2">
          <Timer className={`w-4 h-4 ${isRunning ? 'text-indigo-500 animate-pulse' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Work Timer</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setSoundEnabled(!soundEnabled)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setIsOpen(false)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className={`flex gap-1 px-4 pt-3 pb-2`}>
        {([
          { id: "pomodoro" as TimerMode, label: "Pomodoro", icon: <Zap className="w-3 h-3" /> },
          { id: "timer" as TimerMode, label: "Timer", icon: <Clock className="w-3 h-3" /> },
          { id: "stopwatch" as TimerMode, label: "Stopwatch", icon: <Timer className="w-3 h-3" /> },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => { if (!isRunning) { setMode(tab.id); } }}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === tab.id
                ? isDarkMode ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-900 text-white shadow-md'
                : isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            } ${isRunning && mode !== tab.id ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Timer Display */}
      <div className="flex flex-col items-center py-6 px-4">
        {/* Circular Progress */}
        <div className="relative w-40 h-40 mb-3">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" strokeWidth="6" className={isDarkMode ? 'stroke-slate-700' : 'stroke-slate-100'} />
            {mode !== "stopwatch" && (
              <circle
                cx="60" cy="60" r="54" fill="none" strokeWidth="6"
                className={`${progressColor} transition-all duration-1000`}
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-mono font-bold tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {formatTime(currentTime)}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${
              mode === "pomodoro" ? phaseColor : isDarkMode ? 'text-slate-500' : 'text-slate-400'
            }`}>
              {phaseLabel}
            </span>
            {mode === "pomodoro" && (
              <div className="flex items-center gap-1 mt-2">
                {Array.from({ length: POMODORO_DEFAULTS.sessionsBeforeLong }).map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full transition-all ${
                    i < pomodoroSession
                      ? pomodoroPhase === "work" ? 'bg-red-500' : 'bg-emerald-500'
                      : isDarkMode ? 'bg-slate-700' : 'bg-slate-200'
                  }`} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={resetTimer} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg hover:shadow-xl active:scale-95 ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button
            onClick={() => {
              if (mode === "pomodoro" && pomodoroPhase === "work") {
                // Skip to break — count as completed session
                playSound();
                setTotalFocusedSeconds(t => t + (POMODORO_DEFAULTS.work - pomodoroTime));
                const completedSessions = pomodoroSession + 1;
                setPomodoroSession(completedSessions);
                if (completedSessions >= POMODORO_DEFAULTS.sessionsBeforeLong) {
                  setPomodoroPhase("longBreak");
                  setPomodoroTime(POMODORO_DEFAULTS.longBreak);
                } else {
                  setPomodoroPhase("shortBreak");
                  setPomodoroTime(POMODORO_DEFAULTS.shortBreak);
                }
                setIsRunning(false);
              } else if (mode === "pomodoro") {
                // Skip break, go to work — reset session counter after long break
                if (pomodoroPhase === "longBreak") {
                  setPomodoroSession(0);
                }
                setPomodoroPhase("work");
                setPomodoroTime(POMODORO_DEFAULTS.work);
                setIsRunning(false);
              }
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              mode === "pomodoro"
                ? isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            <Coffee className="w-4 h-4" />
          </button>
        </div>

        {/* Timer Presets (only in timer mode) */}
        {mode === "timer" && !isRunning && (
          <div className="flex flex-wrap gap-1.5 justify-center mb-3 w-full">
            {TIMER_PRESETS.map(p => (
              <button
                key={p.seconds}
                onClick={() => selectPreset(p.seconds)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  timerDuration === p.seconds
                    ? isDarkMode ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'
                    : isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Custom timer input (only in timer mode, not running) */}
        {mode === "timer" && !isRunning && (
          <div className="flex items-center gap-2 w-full px-2">
            <div className="flex-1 relative">
              <input
                type="number" min={1} max={999}
                value={Math.floor(timerDuration / 60)}
                onChange={e => {
                  const mins = Math.max(1, Math.min(999, parseInt(e.target.value) || 1));
                  selectPreset(mins * 60);
                }}
                className={`w-full px-3 py-2 rounded-lg border text-center text-sm font-mono ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white focus:bg-slate-800' : 'border-slate-200 bg-slate-50 text-slate-800'} focus:ring-2 focus:ring-indigo-500/20 outline-none`}
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>min</span>
            </div>
          </div>
        )}
      </div>

      {/* Task Link */}
      <div className={`px-4 pb-3 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} pt-3`}>
        <div className="relative">
          <button
            onClick={() => setIsTaskPickerOpen(!isTaskPickerOpen)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${
              linkedTaskId
                ? isDarkMode ? 'border-indigo-700 bg-indigo-950/50 text-indigo-300' : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <span className="truncate">{linkedTask ? `📌 ${linkedTask.title}` : "Link to a task (optional)"}</span>
            <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${isTaskPickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {isTaskPickerOpen && (
            <div className={`absolute bottom-full mb-1 left-0 right-0 max-h-40 overflow-y-auto rounded-xl border shadow-xl z-50 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <button
                onClick={() => { setLinkedTaskId(null); setIsTaskPickerOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs ${isDarkMode ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-50'} transition-colors`}
              >
                No task linked
              </button>
              {activeTasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setLinkedTaskId(t.id); setIsTaskPickerOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs truncate transition-colors ${
                    linkedTaskId === t.id
                      ? isDarkMode ? 'bg-indigo-950/80 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                      : isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t.title}
                </button>
              ))}
              {activeTasks.length === 0 && (
                <p className={`px-3 py-2 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>No active tasks</p>
              )}
            </div>
          )}
        </div>

        {/* Session Stats */}
        {totalFocusedSeconds > 0 && (
          <div className={`mt-2 flex items-center justify-center gap-1 text-[10px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            <Zap className="w-3 h-3" />
            Total focused: {formatTime(totalFocusedSeconds)}
          </div>
        )}
      </div>
    </div>
  );
}
