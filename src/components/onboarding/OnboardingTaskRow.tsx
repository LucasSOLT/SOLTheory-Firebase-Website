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
  HelpCircle,
  ClipboardList,
  ListChecks,
  ShieldCheck,
  Globe,
  Mic,
  Video,
  BookOpen,
  ArrowRight,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface OnboardingTaskRowProps {
  task: {
    id: string;
    orgId?: string;
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
      itemType?: string;
      instructions?: string;
      hyperlink?: string | null;
      headerImageUrl?: string | null;
      backgroundColor?: string | null;
      mediaUrl?: string | null;
      mediaType?: string | null;
      completionGating?: string;
      interactiveContent?: any;
      userResponse?: any[];
      reviewStatus?: string;
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
  onTaskClick?: (task: any) => void;
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
  onTaskClick,
}: OnboardingTaskRowProps) {
  const isCompleted = task.column === 'done';
  const requiresUpload = task.metadata?.requiresDocumentUpload;
  const docCategory = task.metadata?.documentCategory;
  const sopUrl = task.metadata?.sopUrl;
  const urgency = !isCompleted ? getDueUrgency(task.dueDate) : null;
  const hasAttachments = task.attachments && task.attachments.length > 0;

  const itemType = task.metadata?.itemType;
  const isInteractive = ['quiz', 'short_answer', 'form', 'checklist', 'policy_acknowledgment', 'external_verification', 'recorded_response'].includes(itemType || '');
  const hasPopupContent = isInteractive || !!task.metadata?.instructions || !!task.metadata?.mediaUrl || !!task.metadata?.hyperlink;
  const reviewStatus = task.metadata?.reviewStatus;
  const userResponses = task.metadata?.userResponse || [];
  const latestResponse = userResponses[userResponses.length - 1];

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

  // Interactive item type badge
  const itemTypeBadge = (() => {
    switch (itemType) {
      case 'quiz':
        return (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            isDarkMode ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
          }`}>
            <HelpCircle className="w-3 h-3 text-indigo-400" /> Quiz
          </span>
        );
      case 'short_answer':
        return (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            isDarkMode ? 'bg-sky-950/60 text-sky-300 border-sky-800/60' : 'bg-sky-50 text-sky-700 border-sky-200'
          }`}>
            <MessageSquare className="w-3 h-3 text-sky-400" /> Short Answer
          </span>
        );
      case 'form':
        return (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            isDarkMode ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            <ClipboardList className="w-3 h-3 text-emerald-400" /> Form
          </span>
        );
      case 'checklist':
        return (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            isDarkMode ? 'bg-teal-950/60 text-teal-300 border-teal-800/60' : 'bg-teal-50 text-teal-700 border-teal-200'
          }`}>
            <ListChecks className="w-3 h-3 text-teal-400" /> Checklist
          </span>
        );
      case 'policy_acknowledgment':
        return (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            isDarkMode ? 'bg-purple-950/60 text-purple-300 border-purple-800/60' : 'bg-purple-50 text-purple-700 border-purple-200'
          }`}>
            <ShieldCheck className="w-3 h-3 text-purple-400" /> E-Signature
          </span>
        );
      case 'external_verification':
        return (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            isDarkMode ? 'bg-blue-950/60 text-blue-300 border-blue-800/60' : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            <Globe className="w-3 h-3 text-blue-400" /> External
          </span>
        );
      case 'recorded_response':
        return (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            isDarkMode ? 'bg-rose-950/60 text-rose-300 border-rose-800/60' : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            <Mic className="w-3 h-3 text-rose-400" /> Recording
          </span>
        );
      case 'video_watch':
        return (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            isDarkMode ? 'bg-violet-950/60 text-violet-300 border-violet-800/60' : 'bg-violet-50 text-violet-700 border-violet-200'
          }`}>
            <Video className="w-3 h-3 text-violet-400" /> Video
          </span>
        );
      case 'reading':
        return (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            isDarkMode ? 'bg-amber-950/60 text-amber-300 border-amber-800/60' : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <BookOpen className="w-3 h-3 text-amber-400" /> Reading
          </span>
        );
      default:
        return null;
    }
  })();

  // Review status badge
  const reviewBadge = reviewStatus === 'pending_review' ? (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
      isDarkMode ? 'bg-amber-950/60 text-amber-300 border-amber-800/60' : 'bg-amber-50 text-amber-700 border-amber-200'
    }`}>
      <Clock className="w-3 h-3 text-amber-400" /> Pending Review
    </span>
  ) : reviewStatus === 'rejected' ? (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
      isDarkMode ? 'bg-rose-950/60 text-rose-300 border-rose-800/60' : 'bg-rose-50 text-rose-700 border-rose-200'
    }`}>
      <AlertTriangle className="w-3 h-3 text-rose-400" /> Revision Requested
    </span>
  ) : null;

  // Quiz score badge if completed
  const scoreBadge = isCompleted && itemType === 'quiz' && latestResponse?.score !== undefined ? (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
      latestResponse.passed
        ? (isDarkMode ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
        : (isDarkMode ? 'bg-rose-950/50 text-rose-400 border-rose-800/60' : 'bg-rose-50 text-rose-700 border-rose-200')
    }`}>
      Score: {Math.round(latestResponse.score)}%
    </span>
  ) : null;

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
          <span
            onClick={() => onTaskClick?.(task)}
            className={`text-sm font-semibold transition-colors ${isCompleted ? 'line-through' : ''} ${isDarkMode ? 'text-white' : 'text-slate-900'} ${hasPopupContent && onTaskClick ? 'cursor-pointer hover:text-indigo-400' : ''}`}
          >
            {task.title}
          </span>

          {/* Interactive Item Type badge */}
          {itemTypeBadge}

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

          {/* Pending Review badge */}
          {reviewBadge}

          {/* Quiz Score badge */}
          {scoreBadge}

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
          {/* Interactive action button */}
          {onTaskClick && hasPopupContent && (
            <button
              onClick={() => onTaskClick(task)}
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                isCompleted
                  ? (isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                  : (isDarkMode ? 'bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 border border-indigo-500/40' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs')
              }`}
            >
              {itemType === 'quiz' ? (
                <>
                  <HelpCircle className="w-3 h-3" />
                  {isCompleted ? 'Review Quiz' : 'Take Quiz'}
                </>
              ) : itemType === 'form' ? (
                <>
                  <ClipboardList className="w-3 h-3" />
                  {isCompleted ? 'View Form' : 'Fill Form'}
                </>
              ) : itemType === 'policy_acknowledgment' ? (
                <>
                  <ShieldCheck className="w-3 h-3" />
                  {isCompleted ? 'View Signed Policy' : 'Review & Sign'}
                </>
              ) : itemType === 'checklist' ? (
                <>
                  <ListChecks className="w-3 h-3" />
                  {isCompleted ? 'View Checklist' : 'Checklist'}
                </>
              ) : itemType === 'short_answer' ? (
                <>
                  <MessageSquare className="w-3 h-3" />
                  {isCompleted ? 'View Response' : 'Enter Response'}
                </>
              ) : itemType === 'recorded_response' ? (
                <>
                  <Mic className="w-3 h-3" />
                  {isCompleted ? 'View Recording' : 'Record'}
                </>
              ) : itemType === 'video_watch' ? (
                <>
                  <Video className="w-3 h-3" />
                  {isCompleted ? 'Rewatch Video' : 'Watch Video'}
                </>
              ) : (
                <>
                  <span>Open Step</span>
                  <ArrowRight className="w-3 h-3" />
                </>
              )}
            </button>
          )}

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
