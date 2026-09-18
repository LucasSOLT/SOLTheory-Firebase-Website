'use client';

import React, { useState } from 'react';
import { ChevronDown, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  ONBOARDING_PHASE_LABELS,
  ONBOARDING_PHASE_TIMELINES,
  type OnboardingPhaseNumber,
} from '@/types/onboarding-templates';
import OnboardingTaskRow from '@/components/onboarding/OnboardingTaskRow';

// ── Types ───────────────────────────────────────────────────────────────────

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  priority: 'High' | 'Medium' | 'Low';
  column: 'todo' | 'doing' | 'done';
  dueDate?: any;
  completedAt?: any;
  isLate?: boolean;
  metadata?: {
    phase?: number;
    stepId?: string;
    requiresDocumentUpload?: boolean;
    documentCategory?: string;
    sopUrl?: string;
  };
  attachments?: { url: string; name: string; type: string }[];
}

interface OnboardingPhaseCardProps {
  phase: OnboardingPhaseNumber;
  tasks: TaskItem[];
  isDarkMode: boolean;
  orgId: string;
  isAssignee: boolean;
  /** Map of taskId → verification status from the compliance vault. */
  verificationMap: Record<string, 'pending_review' | 'verified' | 'rejected' | null>;
  /** Whether this phase is locked (previous phase not yet complete). */
  isLocked: boolean;
  /** Whether this card should start expanded. */
  defaultOpen?: boolean;
  /** Optional custom phase name (overrides default label for dynamic blueprints). */
  phaseName?: string;
  /** Optional custom phase timeline (overrides default timeline for dynamic blueprints). */
  phaseTimeline?: string;
  onToggleComplete: (taskId: string, currentColumn: string) => void;
  onUploadDocument: (taskId: string, documentCategory: string) => void;
  onAskJarvis: (question: string) => void;
  /** Optional callback when a task row is clicked (opens item popup). */
  onTaskClick?: (task: TaskItem) => void;
}

// ── Phase Icons ─────────────────────────────────────────────────────────────

const PHASE_ICONS: Record<OnboardingPhaseNumber, string> = {
  1: '📋',
  2: '🛡️',
  3: '📚',
  4: '🏁',
};

const PHASE_COLORS: Record<OnboardingPhaseNumber, { light: string; dark: string; accent: string }> = {
  1: {
    light: 'bg-blue-50 border-blue-200/60',
    dark: 'bg-blue-950/30 border-blue-800/40',
    accent: 'text-blue-600',
  },
  2: {
    light: 'bg-amber-50 border-amber-200/60',
    dark: 'bg-amber-950/30 border-amber-800/40',
    accent: 'text-amber-600',
  },
  3: {
    light: 'bg-violet-50 border-violet-200/60',
    dark: 'bg-violet-950/30 border-violet-800/40',
    accent: 'text-violet-600',
  },
  4: {
    light: 'bg-emerald-50 border-emerald-200/60',
    dark: 'bg-emerald-950/30 border-emerald-800/40',
    accent: 'text-emerald-600',
  },
};

// ── Component ───────────────────────────────────────────────────────────────

export default function OnboardingPhaseCard({
  phase,
  tasks,
  isDarkMode,
  orgId,
  isAssignee,
  verificationMap,
  isLocked,
  defaultOpen = false,
  phaseName,
  phaseTimeline: customTimeline,
  onToggleComplete,
  onUploadDocument,
  onAskJarvis,
  onTaskClick,
}: OnboardingPhaseCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const completedCount = tasks.filter(t => t.column === 'done').length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isComplete = completedCount === totalCount && totalCount > 0;
  const isInProgress = completedCount > 0 && !isComplete;

  const phaseLabel = phaseName || ONBOARDING_PHASE_LABELS[phase as keyof typeof ONBOARDING_PHASE_LABELS] || `Phase ${phase}`;
  const phaseTimeline = customTimeline || ONBOARDING_PHASE_TIMELINES[phase as keyof typeof ONBOARDING_PHASE_TIMELINES] || '';
  const phaseIcon = PHASE_ICONS[phase as keyof typeof PHASE_ICONS] || '📌';
  const colors = PHASE_COLORS[phase as keyof typeof PHASE_COLORS] || PHASE_COLORS[1];

  // Status badge
  const statusBadge = isLocked ? (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
      isDarkMode ? 'bg-slate-700/50 text-slate-500 border-slate-600/50' : 'bg-slate-100 text-slate-400 border-slate-200/60'
    }`}>
      <Lock className="w-3 h-3" /> Locked
    </span>
  ) : isComplete ? (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
      isDarkMode ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60' : 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
    }`}>
      <CheckCircle2 className="w-3 h-3" /> Complete
    </span>
  ) : isInProgress ? (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
      isDarkMode ? 'bg-indigo-950/50 text-indigo-400 border-indigo-800/60' : 'bg-indigo-50 text-indigo-600 border-indigo-200/60'
    }`}>
      <Loader2 className="w-3 h-3" /> In Progress
    </span>
  ) : (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
      isDarkMode ? 'bg-slate-700/50 text-slate-400 border-slate-600/50' : 'bg-slate-100 text-slate-500 border-slate-200/60'
    }`}>
      Not Started
    </span>
  );

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden ${
        isDarkMode ? colors.dark : colors.light
      } ${isLocked ? 'opacity-50' : ''}`}
    >
      {/* Collapsible Header */}
      <button
        onClick={() => !isLocked && setIsOpen(!isOpen)}
        disabled={isLocked}
        className={`w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 text-left transition-colors ${
          !isLocked ? 'cursor-pointer' : 'cursor-not-allowed'
        } ${!isLocked && !isDarkMode ? 'hover:bg-white/40' : ''} ${!isLocked && isDarkMode ? 'hover:bg-slate-800/30' : ''}`}
      >
        {/* Phase number badge */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
          isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'
        }`}>
          {phaseIcon}
        </div>

        {/* Title and meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm sm:text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Phase {phase}: {phaseLabel}
            </span>
            {statusBadge}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {phaseTimeline}
            </span>
            <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {completedCount} of {totalCount} complete
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 max-w-xs">
            <Progress value={progressPercent} className="h-1.5" />
          </div>
        </div>

        {/* Expand chevron */}
        {!isLocked && (
          <ChevronDown className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          } ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
        )}
      </button>

      {/* Expanded Task List */}
      {isOpen && !isLocked && (
        <div className={`px-4 sm:px-5 pb-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
          isDarkMode ? 'border-t border-slate-700/30' : 'border-t border-slate-200/40'
        }`}>
          <div className="pt-3 space-y-2">
            {tasks
              .sort((a, b) => {
                // Sort: incomplete first, then by due date
                if (a.column === 'done' && b.column !== 'done') return 1;
                if (a.column !== 'done' && b.column === 'done') return -1;
                const aMs = a.dueDate?.toMillis?.() ?? (a.dueDate ? new Date(a.dueDate).getTime() : 0);
                const bMs = b.dueDate?.toMillis?.() ?? (b.dueDate ? new Date(b.dueDate).getTime() : 0);
                return aMs - bMs;
              })
              .map(task => (
                <OnboardingTaskRow
                  key={task.id}
                  task={task}
                  isDarkMode={isDarkMode}
                  orgId={orgId}
                  isAssignee={isAssignee}
                  verificationStatus={verificationMap[task.id] ?? null}
                  onToggleComplete={onToggleComplete}
                  onUploadDocument={onUploadDocument}
                  onAskJarvis={onAskJarvis}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
