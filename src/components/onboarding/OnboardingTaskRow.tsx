'use client';

import React from 'react';
import {
  CheckCircle2,
  Circle,
  Upload,
  FileCheck,
  Clock,
  AlertTriangle,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface OnboardingTaskRowProps {
  task: {
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
  };
  isDarkMode: boolean;
  orgId: string;
  /** Whether the current user can check off / interact with this task (the assignee). */
  isAssignee: boolean;
  /** Compliance verification status from the vault (if applicable). */
  verificationStatus?: 'pending_review' | 'verified' | 'rejected' | null;
  onToggleComplete: (taskId: string, currentColumn: string) => void;
  onUploadDocument: (taskId: string, documentCategory: string) => void;
  onAskJarvis: (question: string) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDueDate(ts: any): string {
  if (!ts) return '';
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function getDueUrgency(ts: any): 'overdue' | 'today' | 'soon' | 'normal' | null {
  if (!ts) return null;
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return 'overdue';
    if (diffDays < 1) return 'today';
    if (diffDays < 3) return 'soon';
    return 'normal';
  } catch {
    return null;
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function OnboardingTaskRow({
  task,
  isDarkMode,
  orgId,
  isAssignee,
  verificationStatus,
  onToggleComplete,
  onUploadDocument,
  onAskJarvis,
}: OnboardingTaskRowProps) {
  const isCompleted = task.column === 'done';
  const requiresUpload = task.metadata?.requiresDocumentUpload;
  const docCategory = task.metadata?.documentCategory;
  const sopUrl = task.metadata?.sopUrl;
  const urgency = !isCompleted ? getDueUrgency(task.dueDate) : null;
  const hasAttachments = task.attachments && task.attachments.length > 0;

  // Priority pill colors
  const priorityColors: Record<string, { light: string; dark: string }> = {
    High: {
      light: 'bg-rose-50 text-rose-600 border-rose-200/60',
      dark: 'bg-rose-950/50 text-rose-400 border-rose-800/60',
    },
    Medium: {
      light: 'bg-amber-50 text-amber-600 border-amber-200/60',
      dark: 'bg-amber-950/50 text-amber-400 border-amber-800/60',
    },
    Low: {
      light: 'bg-sky-50 text-sky-600 border-sky-200/60',
      dark: 'bg-sky-950/50 text-sky-400 border-sky-800/60',
    },
  };
  const prio = priorityColors[task.priority] || priorityColors.Medium;

  // Urgency pill colors
  const urgencyConfig: Record<string, { icon: React.ReactNode; label: string; light: string; dark: string }> = {
    overdue: {
      icon: <AlertTriangle className="w-3 h-3" />,
      label: 'Overdue',
      light: 'bg-red-50 text-red-600 border-red-200',
      dark: 'bg-red-950/60 text-red-400 border-red-800/60',
    },
    today: {
      icon: <Clock className="w-3 h-3" />,
      label: 'Due Today',
      light: 'bg-orange-50 text-orange-600 border-orange-200',
      dark: 'bg-orange-950/60 text-orange-400 border-orange-800/60',
    },
    soon: {
      icon: <Clock className="w-3 h-3" />,
      label: 'Due Soon',
      light: 'bg-amber-50 text-amber-600 border-amber-200',
      dark: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
    },
  };

  // Verification badge
  const verificationBadge = requiresUpload && docCategory ? (
    verificationStatus === 'verified' ? (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
        isDarkMode ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60' : 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
      }`}>
        <FileCheck className="w-3 h-3" /> Verified
      </span>
    ) : verificationStatus === 'rejected' ? (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
        isDarkMode ? 'bg-red-950/50 text-red-400 border-red-800/60' : 'bg-red-50 text-red-600 border-red-200/60'
      }`}>
        <AlertTriangle className="w-3 h-3" /> Rejected
      </span>
    ) : (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
        isDarkMode ? 'bg-slate-700/50 text-slate-400 border-slate-600/60' : 'bg-slate-100 text-slate-500 border-slate-200/60'
      }`}>
        <Upload className="w-3 h-3" /> {hasAttachments ? 'Pending Review' : 'Upload Required'}
      </span>
    )
  ) : null;

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3 rounded-xl transition-all ${
        isCompleted
          ? (isDarkMode ? 'bg-slate-800/30 opacity-60' : 'bg-slate-50/50 opacity-60')
          : (isDarkMode ? 'bg-slate-800/50 hover:bg-slate-800/70' : 'bg-white/60 hover:bg-white/80')
      } ${isDarkMode ? 'border border-slate-700/40' : 'border border-slate-200/60'}`}
    >
      {/* Checkbox */}
      <button
        onClick={() => isAssignee && onToggleComplete(task.id, task.column)}
        disabled={!isAssignee}
        className={`mt-0.5 shrink-0 transition-all ${isAssignee ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
        title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {isCompleted ? (
          <CheckCircle2 className={`w-5 h-5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`} />
        ) : (
          <Circle className={`w-5 h-5 ${isDarkMode ? 'text-slate-500 group-hover:text-slate-300' : 'text-slate-300 group-hover:text-slate-500'}`} />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${isCompleted ? 'line-through' : ''} ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {task.title}
          </span>

          {/* Priority pill */}
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${isDarkMode ? prio.dark : prio.light}`}>
            {task.priority}
          </span>

          {/* Urgency pill */}
          {urgency && urgencyConfig[urgency] && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${isDarkMode ? urgencyConfig[urgency].dark : urgencyConfig[urgency].light}`}>
              {urgencyConfig[urgency].icon} {urgencyConfig[urgency].label}
            </span>
          )}

          {/* Verification badge */}
          {verificationBadge}
        </div>

        {/* Description */}
        {task.description && (
          <p className={`mt-1 text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {task.description}
          </p>
        )}

        {/* Action buttons row */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Due date */}
          {task.dueDate && (
            <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Due {formatDueDate(task.dueDate)}
            </span>
          )}

          {/* Upload button */}
          {requiresUpload && docCategory && !isCompleted && isAssignee && verificationStatus !== 'verified' && (
            <button
              onClick={() => onUploadDocument(task.id, docCategory)}
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-indigo-900/40 text-indigo-300 hover:bg-indigo-900/60 border border-indigo-700/40'
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200/60'
              }`}
            >
              <Upload className="w-3 h-3" />
              Upload Document
            </button>
          )}

          {/* SOP link */}
          {sopUrl && (
            <a
              href={sopUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700/80 border border-slate-600/40'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
              }`}
            >
              <ExternalLink className="w-3 h-3" />
              View SOP
            </a>
          )}

          {/* Ask JARVIS button */}
          {!isCompleted && (
            <button
              onClick={() => onAskJarvis(`Tell me about: ${task.title}`)}
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700/80 border border-slate-600/40'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              Ask JARVIS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
