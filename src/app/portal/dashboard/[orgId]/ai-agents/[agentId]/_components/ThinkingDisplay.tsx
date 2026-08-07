'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, ChevronRight, Loader2, Zap, CheckCircle2 } from 'lucide-react';
import type { AgentEvent } from '@/lib/agent-events';

interface ThinkingDisplayProps {
  events: AgentEvent[];
  isDarkMode: boolean;
  sendTimestamp?: number;
}

export default function ThinkingDisplay({ events, isDarkMode, sendTimestamp }: ThinkingDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Start a live timer — use the send timestamp (when user pressed send) if available,
  // otherwise fall back to when events first arrive.
  // We track whether the timer is running via state so the interval effect re-fires.
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    if (startTimeRef.current === 0 && sendTimestamp && sendTimestamp > 0) {
      startTimeRef.current = sendTimestamp;
      setTimerRunning(true);
    }
  }, [sendTimestamp]);

  useEffect(() => {
    if (events.length > 0 && startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
      setTimerRunning(true);
    }
  }, [events.length]);

  // Categorize events
  const toolCalls = events.filter(e => e.type === 'tool_call') as Extract<AgentEvent, { type: 'tool_call' }>[];
  const stepCompletes = events.filter(e => e.type === 'step_complete') as Extract<AgentEvent, { type: 'step_complete' }>[];
  const stepStarts = events.filter(e => e.type === 'step_start') as Extract<AgentEvent, { type: 'step_start' }>[];
  const planEvent = events.find(e => e.type === 'plan') as Extract<AgentEvent, { type: 'plan' }> | undefined;
  const hasToolsOrSteps = stepCompletes.length > 0 || toolCalls.length > 0;

  // Get routing domain
  const routingEvent = events.find(e => e.type === 'routing') as Extract<AgentEvent, { type: 'routing' }> | undefined;
  const isMulti = routingEvent?.domain === 'MULTI';

  // Determine completion: for MULTI, all plan steps must be complete OR a 'done' event arrived
  const hasDoneEvent = events.some(e => e.type === 'done');
  const allStepsComplete = isMulti && planEvent
    ? planEvent.steps.every((s: any) => stepCompletes.some(sc => sc.step === s.step))
    : false;

  // 'done' event is the definitive completion signal.
  // For multi-agent: also complete if all plan steps finished.
  // The timer runs until the stream is fully done — no early force-complete.
  const isComplete = hasDoneEvent || (isMulti && allStepsComplete);

  // Live timer that ticks every 100ms while not complete
  useEffect(() => {
    if (timerRunning && startTimeRef.current > 0 && !isComplete) {
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 100);
    }
    if (isComplete && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      // Final elapsed snap
      if (startTimeRef.current > 0) {
        setElapsedMs(Date.now() - startTimeRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isComplete, timerRunning]);

  const elapsedStr = (elapsedMs / 1000).toFixed(1);

  // Parse thinking event (single-agent routes)
  const parsed = useMemo(() => {
    let intent = '';
    let deliverables: string[] = [];
    const thinking = events.find(e => e.type === 'thinking') as Extract<AgentEvent, { type: 'thinking' }> | undefined;
    if (thinking?.content) {
      const intentMatch = thinking.content.match(/INTENT:\s*([^\n]+)/i);
      if (intentMatch) intent = intentMatch[1].trim();
      const delivSplit = thinking.content.split(/DELIVERABLES:/i);
      if (delivSplit.length > 1) {
        deliverables = delivSplit[1].split('\n')
          .map(l => l.trim())
          .filter(l => l.match(/^\d+\./))
          .map(l => l.replace(/^\d+\.\s*/, '').trim());
      } else if (!intentMatch && thinking.content.trim()) {
        intent = thinking.content.trim();
      }
    }
    return { intent, deliverables };
  }, [events]);

  // Auto-collapse after completion
  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => setIsExpanded(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  // If no events yet but we have a sendTimestamp, show a minimal "Thinking..." with timer
  if (events.length === 0) {
    if (!sendTimestamp || sendTimestamp <= 0) return null;
    const muted = isDarkMode ? 'text-slate-500' : 'text-slate-400';
    return (
      <div className={`flex items-center gap-1.5 mb-2 select-none ${muted}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span className="text-xs">
          Thinking{elapsedMs > 0 ? `... ${elapsedStr}s` : '...'}
        </span>
      </div>
    );
  }

  const muted = isDarkMode ? 'text-slate-500' : 'text-slate-400';
  const subtle = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const accent = isDarkMode ? 'text-indigo-400' : 'text-indigo-600';
  const accentBg = isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50';
  const stepDoneBg = isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50';
  const stepDoneText = isDarkMode ? 'text-emerald-400' : 'text-emerald-600';
  const stepRunningBg = isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50/80';
  const borderSubtle = isDarkMode ? 'border-slate-700/50' : 'border-slate-200/80';

  // ── Collapsed: single line ──
  if (!isExpanded) {
    return (
      <div
        className={`flex items-center gap-1.5 cursor-pointer mb-2 select-none group ${muted}`}
        onClick={() => setIsExpanded(true)}
      >
        {isMulti && <Zap className="w-3 h-3" />}
        <span className="text-xs">
          {isMulti ? `Orchestrated in ${elapsedStr}s` : `Thought for ${elapsedStr}s`}
        </span>
        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </div>
    );
  }

  // ── Expanded ──
  return (
    <div className="mb-3 animate-in fade-in duration-300">
      {/* Header */}
      <div
        className={`flex items-center gap-1.5 cursor-pointer select-none group mb-2 ${muted}`}
        onClick={() => setIsExpanded(false)}
      >
        {isComplete ? (
          <span className="text-xs flex items-center gap-1">
            {isMulti && <Zap className="w-3 h-3" />}
            {isMulti ? `Orchestrated in ${elapsedStr}s` : `Thought for ${elapsedStr}s`}
          </span>
        ) : (
          <span className="text-xs flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            {isMulti ? `Orchestrating... ${elapsedStr}s` : `Thinking... ${elapsedStr}s`}
          </span>
        )}
        <ChevronDown className="w-3 h-3" />
      </div>

      {/* ── Multi-agent orchestrator view ── */}
      {isMulti && planEvent ? (
        <div className={`space-y-1.5 animate-in fade-in duration-500 rounded-lg px-3 py-2 border ${borderSubtle} ${isDarkMode ? 'bg-slate-800/40' : 'bg-slate-50/60'}`}>
          {/* Plan summary with agent count */}
          <div className={`text-[11px] font-medium ${subtle} flex items-center gap-1.5 pb-1 border-b ${borderSubtle}`}>
            <Zap className={`w-3 h-3 ${accent}`} />
            <span>{planEvent.summary}</span>
            <span className={`ml-auto text-[10px] ${muted}`}>{planEvent.steps.length} agents</span>
          </div>

          {/* Orchestrator steps */}
          {planEvent.steps.map((planStep: any, idx: number) => {
            const completed = stepCompletes.find(s => s.step === planStep.step);
            const started = stepStarts.find(s => s.step === planStep.step);
            const stepTools = toolCalls.filter(t => t.step === planStep.step);
            const isStepDone = !!completed;
            const isStepRunning = !!started && !completed;

            return (
              <div
                key={idx}
                className={`rounded-md px-2 py-1.5 transition-all duration-300 ${
                  isStepDone ? stepDoneBg : isStepRunning ? stepRunningBg : ''
                }`}
              >
                <div className={`text-[11px] flex items-center gap-2 ${isStepDone ? stepDoneText : isStepRunning ? accent : subtle}`}>
                  {/* Status icon */}
                  <span className="shrink-0 w-4 flex justify-center">
                    {isStepDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : isStepRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span className="w-2 h-2 rounded-full border border-current opacity-40" />
                    )}
                  </span>

                  {/* Domain badge */}
                  <span className={`shrink-0 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded ${
                    isStepDone
                      ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                      : isStepRunning
                        ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700')
                        : (isDarkMode ? 'bg-slate-700/50 text-slate-500' : 'bg-slate-200/80 text-slate-500')
                  }`}>
                    {planStep.domain}
                  </span>

                  {/* Task text */}
                  <span className="flex-1 truncate">{planStep.task}</span>

                  {/* Duration */}
                  {isStepDone && completed && (
                    <span className={`shrink-0 text-[10px] ${muted}`}>
                      {(completed.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                {/* Tools used in this step */}
                {stepTools.length > 0 && (
                  <div className={`mt-0.5 pl-6 flex flex-wrap gap-1`}>
                    {stepTools.map((tool, tIdx) => (
                      <span key={tIdx} className={`text-[9px] ${muted} px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-700/30' : 'bg-slate-100'}`}>
                        {tool.tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Completion status */}
          {isComplete && (
            <div className={`text-[10px] ${stepDoneText} flex items-center gap-1 pt-1 border-t ${borderSubtle}`}>
              <CheckCircle2 className="w-3 h-3" />
              All agents completed — synthesizing response
            </div>
          )}
        </div>
      ) : isMulti && !planEvent ? (
        /* ── Multi-agent plan pending — show loading state ── */
        <div className={`space-y-1.5 animate-in fade-in duration-500 rounded-lg px-3 py-2 border ${borderSubtle} ${isDarkMode ? 'bg-slate-800/40' : 'bg-slate-50/60'}`}>
          <div className={`text-[11px] font-medium ${subtle} flex items-center gap-1.5`}>
            <Loader2 className={`w-3 h-3 animate-spin ${accent}`} />
            <span>Planning multi-step task...</span>
          </div>
          <div className={`text-[10px] ${muted} pl-5`}>
            Analyzing your request and breaking it into sub-tasks
          </div>
        </div>
      ) : (
        <>
          {/* ── Single-agent thinking view ── */}
          {parsed.intent && (
            <div className={`text-xs ${subtle} mb-1.5 animate-in fade-in duration-500`}>
              {parsed.intent}
            </div>
          )}
          {parsed.deliverables.length > 0 && (
            <div className="mb-2 animate-in fade-in duration-500" style={{ animationDelay: '100ms' }}>
              {parsed.deliverables.map((deliv, idx) => {
                const isDone = idx < stepCompletes.length || idx < toolCalls.length;
                return (
                  <div key={idx} className={`text-xs flex items-start gap-1.5 py-0.5 ${isDone ? muted : subtle}`}>
                    <span className="shrink-0 w-3 text-right">{idx + 1}.</span>
                    <span className="flex-1">{deliv}</span>
                    <span className="shrink-0">{isDone ? '✓' : (isComplete ? '✓' : '·')}</span>
                  </div>
                );
              })}
            </div>
          )}
          {routingEvent && (
            <div className={`text-xs ${muted} animate-in fade-in duration-300`} style={{ animationDelay: '200ms' }}>
              Routed to {routingEvent.domain} Agent
            </div>
          )}
          {toolCalls.map((tool, idx) => (
            <div key={idx} className={`text-xs ${muted} animate-in fade-in duration-300`} style={{ animationDelay: `${300 + idx * 100}ms` }}>
              Used {tool.tool}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
