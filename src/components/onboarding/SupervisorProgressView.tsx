'use client';

// ============================================================================
// SupervisorProgressView — Phase 1, Step 1.2
//
// Displays a supervisor's assigned employees' onboarding blueprints with
// real-time progress tracking. Supervisors can:
//   - See all employees assigned to them (mentorUid matches their UID)
//   - View phase-by-phase progress breakdowns
//   - Drill into any item to see what the employee submitted (Step 1.3)
//   - Re-Request / redo any completed item (Step 1.4)
//
// Per the approved build plan: supervisors see their assigned employees'
// blueprint progress in real-time (page refresh) and can drill into any
// item to see uploads, form responses, quiz answers, signatures, PDFs.
// ============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import {
  Users,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  RotateCcw,
  FileText,
  Video,
  HelpCircle,
  ClipboardCheck,
  Upload,
  BookOpen,
  Shield,
  Loader2,
  AlertCircle,
  MessageSquare,
  ExternalLink,
  X,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { getAuthHeaders } from '@/lib/api-auth-client';
import type { TaskSigningMirror } from '@/types/onboarding-templates';
import SendArchiveButton from '@/components/onboarding/SendArchiveButton';

// ── Types ───────────────────────────────────────────────────────────────────

interface OnboardingInstanceDoc {
  id: string;
  orgId: string;
  userId: string;
  userEmail: string;
  userName: string;
  templateId: string;
  roleName: string;
  status: 'in_progress' | 'completed';
  startedAt: any;
  completedAt: any;
  overallProgress: number;
  totalSteps: number;
  completedSteps: number;
  taskIds: string[];
  mentorUid?: string;
  mentorEmail?: string;
  initiatedBy: string;
  initiatedByEmail: string;
}

interface TaskDoc {
  id: string;
  title: string;
  description?: string;
  priority: 'High' | 'Medium' | 'Low';
  column: 'todo' | 'doing' | 'done';
  dueDate?: any;
  completedAt?: any;
  isLate?: boolean;
  assignedTo: string;
  assignedToEmail: string;
  category?: string;
  metadata?: {
    onboardingInstanceId?: string;
    phase?: number;
    stepId?: string;
    requiresDocumentUpload?: boolean;
    documentCategory?: string;
    sopUrl?: string;
    itemType?: string;
    completionGating?: string;
    instructions?: string;
    interactiveContent?: any;
    userResponse?: any[];
    reviewStatus?: string;
    reviewNotes?: string;
    reviewedBy?: string;
    reviewedByEmail?: string;
    reviewedAt?: any;
    hyperlink?: string | null;
    headerImageUrl?: string | null;
    backgroundColor?: string | null;
    mediaUrl?: string | null;
    mediaType?: string | null;
    orgId?: string;
    /** Phase 3: display-only multi-signer mirror. */
    signing?: TaskSigningMirror;
    /** Phase 4: set on single-signer PDF tasks once sent & archived. */
    archivedAt?: string;
    archiveDeliveriesFailed?: number;
  };
  attachments?: { url: string; name: string; type: string }[];
}

interface SupervisorProgressViewProps {
  supervisorUid: string;
  instances: OnboardingInstanceDoc[];
  tasks: TaskDoc[];
  orgId: string;
  isDarkMode: boolean;
  onTaskClick: (task: TaskDoc) => void;
  onRefresh: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: any): string {
  if (!ts) return '—';
  try {
    const d = ts?.toDate?.() || new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

const ITEM_TYPE_ICONS: Record<string, React.ReactNode> = {
  quiz: <HelpCircle className="w-3.5 h-3.5" />,
  form: <ClipboardCheck className="w-3.5 h-3.5" />,
  short_answer: <MessageSquare className="w-3.5 h-3.5" />,
  policy_acknowledgment: <Shield className="w-3.5 h-3.5" />,
  pdf_form: <FileText className="w-3.5 h-3.5" />,
  video_watch: <Video className="w-3.5 h-3.5" />,
  document_upload: <Upload className="w-3.5 h-3.5" />,
  reading: <BookOpen className="w-3.5 h-3.5" />,
  checklist: <ClipboardCheck className="w-3.5 h-3.5" />,
  external_verification: <ExternalLink className="w-3.5 h-3.5" />,
  recorded_response: <Video className="w-3.5 h-3.5" />,
};

// ── Component ───────────────────────────────────────────────────────────────

export default function SupervisorProgressView({
  supervisorUid,
  instances,
  tasks,
  orgId,
  isDarkMode,
  onTaskClick,
  onRefresh,
}: SupervisorProgressViewProps) {
  const [expandedInstanceId, setExpandedInstanceId] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
  const [reRequestingTaskId, setReRequestingTaskId] = useState<string | null>(null);
  const [reRequestNotes, setReRequestNotes] = useState('');
  const [isSubmittingReRequest, setIsSubmittingReRequest] = useState(false);
  const [inspectingTask, setInspectingTask] = useState<TaskDoc | null>(null);

  // Filter instances where this user is the assigned supervisor (mentorUid)
  const supervisorInstances = useMemo(() => {
    return instances.filter(i => i.mentorUid === supervisorUid);
  }, [instances, supervisorUid]);

  // Calculate progress per instance
  const instanceProgress = useMemo(() => {
    const map: Record<string, { completed: number; total: number; percent: number }> = {};
    for (const inst of supervisorInstances) {
      const instTasks = tasks.filter(t => t.metadata?.onboardingInstanceId === inst.id);
      const completed = instTasks.filter(t => t.column === 'done').length;
      const total = instTasks.length || inst.totalSteps;
      map[inst.id] = {
        completed,
        total,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }
    return map;
  }, [supervisorInstances, tasks]);

  // Tasks grouped by phase for a specific instance
  const getTasksByPhase = useCallback(
    (instanceId: string) => {
      const grouped: Record<number, TaskDoc[]> = {};
      for (const task of tasks) {
        if (task.metadata?.onboardingInstanceId === instanceId && task.metadata?.phase) {
          const phase = task.metadata.phase;
          if (!grouped[phase]) grouped[phase] = [];
          grouped[phase].push(task);
        }
      }
      return grouped;
    },
    [tasks],
  );

  const togglePhase = (key: string) => {
    setExpandedPhases(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Re-Request Handler (Phase 1, Step 1.4) ──
  const handleReRequest = async (taskId: string) => {
    if (!reRequestNotes.trim()) return;
    setIsSubmittingReRequest(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/re-request', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          taskId,
          notes: reRequestNotes.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to re-request');
      }

      setReRequestingTaskId(null);
      setReRequestNotes('');
      onRefresh();
    } catch (err: any) {
      console.error('[SupervisorProgressView] Re-request error:', err);
    } finally {
      setIsSubmittingReRequest(false);
    }
  };

  if (supervisorInstances.length === 0) {
    return null; // Don't render anything if this user has no supervisor assignments
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className={`rounded-2xl px-5 py-4 ${isDarkMode ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white/70 border border-slate-200/80 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-purple-900/40 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
            <Shield className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Supervisor Dashboard
            </h2>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              You are supervising {supervisorInstances.length} employee{supervisorInstances.length !== 1 ? 's' : ''}&apos; onboarding
            </p>
          </div>
        </div>
      </div>

      {/* Employee Cards */}
      {supervisorInstances.map(inst => {
        const progress = instanceProgress[inst.id] || { completed: 0, total: 0, percent: 0 };
        const isExpanded = expandedInstanceId === inst.id;
        const tasksByPhase = isExpanded ? getTasksByPhase(inst.id) : {};
        const phaseNumbers = Object.keys(tasksByPhase).map(Number).sort((a, b) => a - b);

        return (
          <div
            key={inst.id}
            className={`rounded-2xl overflow-hidden border transition-all ${
              isDarkMode
                ? 'bg-slate-800/40 border-slate-700/50'
                : 'bg-white/70 border-slate-200/80 shadow-sm'
            }`}
          >
            {/* Employee Header (Clickable to Expand) */}
            <button
              type="button"
              onClick={() => setExpandedInstanceId(isExpanded ? null : inst.id)}
              className={`w-full px-5 py-4 flex items-center gap-4 text-left transition-colors cursor-pointer ${
                isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50/80'
              }`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-black uppercase ${
                isDarkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-600'
              }`}>
                {inst.userName.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {inst.userName}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                    inst.status === 'completed'
                      ? (isDarkMode ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60' : 'bg-emerald-50 text-emerald-600 border-emerald-200/60')
                      : (isDarkMode ? 'bg-indigo-950/50 text-indigo-400 border-indigo-800/60' : 'bg-indigo-50 text-indigo-600 border-indigo-200/60')
                  }`}>
                    {inst.status === 'completed' ? 'Complete' : 'In Progress'}
                  </span>
                </div>
                <div className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {inst.roleName} • {inst.userEmail} • Started {formatDate(inst.startedAt)}
                </div>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className={`text-lg font-extrabold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                    {progress.percent}%
                  </div>
                  <div className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {progress.completed}/{progress.total}
                  </div>
                </div>
                <div className="w-20">
                  <Progress value={progress.percent} className="h-2" />
                </div>
                {isExpanded ? (
                  <ChevronDown className={`w-5 h-5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                ) : (
                  <ChevronRight className={`w-5 h-5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                )}
              </div>
            </button>

            {/* Expanded Phase Breakdown */}
            {isExpanded && (
              <div className={`border-t ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/60'}`}>
                {phaseNumbers.length === 0 ? (
                  <div className={`px-5 py-6 text-center text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    No tasks found for this onboarding track.
                  </div>
                ) : (
                  phaseNumbers.map(phase => {
                    const phaseTasks = tasksByPhase[phase] || [];
                    const phaseKey = `${inst.id}-${phase}`;
                    const isPhaseOpen = expandedPhases[phaseKey] !== false; // Default open
                    const phaseCompleted = phaseTasks.filter(t => t.column === 'done').length;
                    const phaseTotal = phaseTasks.length;
                    const phasePercent = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;
                    const allDone = phaseCompleted === phaseTotal && phaseTotal > 0;

                    return (
                      <div key={phase} className={`border-b last:border-b-0 ${isDarkMode ? 'border-slate-700/30' : 'border-slate-200/40'}`}>
                        {/* Phase Header */}
                        <button
                          type="button"
                          onClick={() => togglePhase(phaseKey)}
                          className={`w-full px-5 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                            isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/50'
                          }`}
                        >
                          {isPhaseOpen ? (
                            <ChevronDown className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                          ) : (
                            <ChevronRight className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                          )}
                          <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Phase {phase}
                          </span>
                          <div className="flex-1" />
                          {allDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <span className={`text-[10px] font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              {phaseCompleted}/{phaseTotal} • {phasePercent}%
                            </span>
                          )}
                        </button>

                        {/* Phase Tasks */}
                        {isPhaseOpen && (
                          <div className={`px-5 pb-3 space-y-1.5`}>
                            {phaseTasks.map(task => {
                              const isDone = task.column === 'done';
                              const itemType = task.metadata?.itemType || 'action_item';
                              const hasResponse = task.metadata?.userResponse && task.metadata.userResponse.length > 0;
                              const isReRequesting = reRequestingTaskId === task.id;

                              return (
                                <div key={task.id}>
                                  <div
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                                      isDarkMode
                                        ? 'hover:bg-slate-700/30'
                                        : 'hover:bg-slate-100/60'
                                    }`}
                                  >
                                    {/* Status Icon */}
                                    {isDone ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                    ) : task.column === 'doing' ? (
                                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                                    ) : (
                                      <Circle className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                                    )}

                                    {/* Item Type Icon */}
                                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>
                                      {ITEM_TYPE_ICONS[itemType] || <Circle className="w-3.5 h-3.5" />}
                                    </span>

                                    {/* Title */}
                                    <span className={`flex-1 text-xs font-medium truncate ${
                                      isDone
                                        ? (isDarkMode ? 'text-slate-500 line-through' : 'text-slate-400 line-through')
                                        : (isDarkMode ? 'text-slate-300' : 'text-slate-700')
                                    }`}>
                                      {task.title}
                                    </span>

                                    {/* Phase 3: multi-signer progress */}
                                    {task.metadata?.signing && task.metadata.signing.totalSigners >= 2 && (() => {
                                      const s = task.metadata.signing;
                                      if (s.status === 'fully_executed' || s.status === 'archived') {
                                        // Phase 4: live manual "Send & Archive"
                                        return (
                                          <SendArchiveButton
                                            compact
                                            orgId={orgId}
                                            taskId={task.id}
                                            isDarkMode={isDarkMode}
                                            archivedAt={s.status === 'archived' ? s.archivedAt || 'archived' : null}
                                            failedCount={s.deliveriesFailed || 0}
                                            onDone={onRefresh}
                                          />
                                        );
                                      }
                                      return (
                                        <span
                                          title={`${s.completedOrders.length} of ${s.totalSigners} signed`}
                                          className={`shrink-0 hidden sm:inline text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                                            isDarkMode ? 'bg-amber-950/30 text-amber-300 border-amber-800/40' : 'bg-amber-50 text-amber-700 border-amber-200'
                                          }`}
                                        >
                                          {s.completedOrders.length > 0 ? `${s.completedOrders.length}/${s.totalSigners} signed ✓ · ` : ''}
                                          ⏳ Awaiting {s.currentSignerName || 'next signer'} ({s.currentSignerOrder} of {s.totalSigners})
                                        </span>
                                      );
                                    })()}

                                    {/* Phase 4: single-signer PDF form that is complete — manual Send & Archive */}
                                    {isDone &&
                                      task.metadata?.interactiveContent?.type === 'pdf_form' &&
                                      !(task.metadata?.signing && task.metadata.signing.totalSigners >= 2) && (
                                        <SendArchiveButton
                                          compact
                                          orgId={orgId}
                                          taskId={task.id}
                                          isDarkMode={isDarkMode}
                                          archivedAt={task.metadata?.archivedAt || null}
                                          failedCount={task.metadata?.archiveDeliveriesFailed || 0}
                                          onDone={onRefresh}
                                        />
                                      )}

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {/* Drill-in: View submission details (Phase 1, Step 1.3) */}
                                      {isDone && hasResponse && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onTaskClick(task);
                                          }}
                                          title="View employee's submission"
                                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                            isDarkMode
                                              ? 'hover:bg-slate-700 text-indigo-400'
                                              : 'hover:bg-indigo-50 text-indigo-500'
                                          }`}
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                        </button>
                                      )}

                                      {/* Re-Request button (Phase 1, Step 1.4) */}
                                      {isDone && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (isReRequesting) {
                                              setReRequestingTaskId(null);
                                              setReRequestNotes('');
                                            } else {
                                              setReRequestingTaskId(task.id);
                                              setReRequestNotes('');
                                            }
                                          }}
                                          title="Re-Request — send back for correction"
                                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                            isReRequesting
                                              ? (isDarkMode ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-50 text-rose-500')
                                              : (isDarkMode ? 'hover:bg-slate-700 text-amber-400' : 'hover:bg-amber-50 text-amber-500')
                                          }`}
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                        </button>
                                      )}

                                      {/* Click to view for non-completed interactive items */}
                                      {!isDone && task.metadata?.interactiveContent && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onTaskClick(task);
                                          }}
                                          title="View item details"
                                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                            isDarkMode
                                              ? 'hover:bg-slate-700 text-slate-500'
                                              : 'hover:bg-slate-100 text-slate-400'
                                          }`}
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Re-Request Notes Panel (inline, below the task) */}
                                  {isReRequesting && (
                                    <div className={`ml-10 mt-1 mb-2 p-3 rounded-xl border ${
                                      isDarkMode ? 'bg-slate-800/60 border-rose-800/40' : 'bg-rose-50/80 border-rose-200'
                                    }`}>
                                      <p className={`text-[11px] font-semibold mb-2 ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>
                                        Re-Request — Tell the employee what needs to be corrected:
                                      </p>
                                      <textarea
                                        value={reRequestNotes}
                                        onChange={(e) => setReRequestNotes(e.target.value)}
                                        placeholder="e.g. Please re-enter your SSN on the W-4 form — it was missing a digit."
                                        rows={2}
                                        className={`w-full px-3 py-2 rounded-lg text-xs border resize-none ${
                                          isDarkMode
                                            ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-600'
                                            : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                                        } focus:outline-none focus:ring-2 focus:ring-rose-500/20`}
                                      />
                                      <div className="flex items-center justify-end gap-2 mt-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setReRequestingTaskId(null);
                                            setReRequestNotes('');
                                          }}
                                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                                            isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
                                          }`}
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleReRequest(task.id)}
                                          disabled={!reRequestNotes.trim() || isSubmittingReRequest}
                                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                            !reRequestNotes.trim() || isSubmittingReRequest
                                              ? 'opacity-50 cursor-not-allowed'
                                              : ''
                                          } ${
                                            isDarkMode
                                              ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                              : 'bg-rose-600 hover:bg-rose-500 text-white'
                                          }`}
                                        >
                                          {isSubmittingReRequest ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <RotateCcw className="w-3 h-3" />
                                          )}
                                          Send Re-Request
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
