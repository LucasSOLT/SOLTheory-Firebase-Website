'use client';

import BodyPortal, { MODAL_OVERLAY_CLASS, MODAL_OVERLAY_STYLE } from './BodyPortal';
import React, { useState, useMemo } from 'react';
import {
  X,
  Eye,
  User,
  AlertTriangle,
  CheckCircle2,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import OnboardingPhaseCard from '@/components/onboarding/OnboardingPhaseCard';
import OnboardingItemPopup from '@/components/onboarding/OnboardingItemPopup';
import {
  ONBOARDING_PHASE_LABELS,
  type OnboardingPhaseNumber,
} from '@/types/onboarding-templates';

// ── Types ───────────────────────────────────────────────────────────────────

interface PreviewStep {
  id: string;
  phase: number;
  title: string;
  description?: string;
  priority: 'High' | 'Medium' | 'Low';
  openDayOffset?: number;
  openTime?: string;
  dayOffset: number;
  dueTime?: string;
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
  suppressForTags?: string[];
}

interface PreviewPhaseDefinition {
  phaseNumber: number;
  name: string;
  dayRangeStart?: number;
  dayRangeEnd?: number;
}

interface BlueprintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  orgId: string;
  roleName: string;
  description?: string;
  steps: PreviewStep[];
  phaseDefinitions?: PreviewPhaseDefinition[];
}

// ── Mock Task Generator ─────────────────────────────────────────────────────
// Transforms blueprint steps into the TaskItem shape that OnboardingPhaseCard
// expects, using a simulated start date of "today" and all tasks in 'todo'.

function stepsToMockTasks(
  steps: PreviewStep[],
  startDate: Date,
): any[] {
  const MS_PER_DAY = 86_400_000;
  return steps.map((step) => {
    const [openHour, openMin] = (step.openTime || '09:00').split(':').map(Number);
    const itemStartDate = new Date(startDate.getTime() + (step.openDayOffset ?? 0) * MS_PER_DAY);
    itemStartDate.setHours(openHour, openMin, 0, 0);

    const [dueHour, dueMin] = (step.dueTime || '17:00').split(':').map(Number);
    const dueDate = new Date(startDate.getTime() + (step.dayOffset ?? 0) * MS_PER_DAY);
    dueDate.setHours(dueHour, dueMin, 0, 0);

    return {
      id: `preview_${step.id}`,
      title: step.title,
      description: step.description || step.instructions || '',
      priority: step.priority || 'Medium',
      column: 'todo' as const,
      startDate: itemStartDate,
      dueDate: dueDate,
      completedAt: null,
      isLate: false,
      metadata: {
      phase: step.phase,
      stepId: step.id,
      requiresDocumentUpload: step.requiresDocumentUpload || false,
      documentCategory: step.documentCategory || '',
      sopUrl: step.sopUrl || '',
      itemType: step.itemType || 'action_item',
      completionGating: step.completionGating || 'self',
      instructions: step.instructions || step.description || '',
      interactiveContent: step.interactiveContent || null,
      hyperlink: step.hyperlink || null,
      headerImageUrl: step.headerImageUrl || null,
      backgroundColor: step.backgroundColor || null,
      mediaUrl: step.mediaUrl || null,
      mediaType: step.mediaType || null,
      orgId: '',
    },
    attachments: [],
  };
  });
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BlueprintPreview({
  isOpen,
  onClose,
  isDarkMode,
  orgId,
  roleName,
  description,
  steps,
  phaseDefinitions,
}: BlueprintPreviewProps) {
  // Mock user role tags for suppression preview
  const [mockRoleTags, setMockRoleTags] = useState('');
  const [showSuppression, setShowSuppression] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Parse the mock role tags into a set
  const mockTagSet = useMemo(() => {
    if (!mockRoleTags.trim()) return new Set<string>();
    const tags = new Set<string>();
    for (const raw of mockRoleTags.split(',')) {
      const lower = raw.trim().toLowerCase();
      if (lower) {
        tags.add(lower);
        // Also split words for partial matching (same logic as server)
        for (const word of lower.split(/\s+/)) {
          if (word.length > 1) tags.add(word);
        }
      }
    }
    return tags;
  }, [mockRoleTags]);

  // Compute filtered vs suppressed steps
  const { filteredSteps, suppressedSteps } = useMemo(() => {
    if (mockTagSet.size === 0) {
      return { filteredSteps: steps, suppressedSteps: [] as PreviewStep[] };
    }
    const filtered: PreviewStep[] = [];
    const suppressed: PreviewStep[] = [];
    for (const step of steps) {
      if (
        step.suppressForTags &&
        step.suppressForTags.length > 0 &&
        step.suppressForTags.some((tag) => mockTagSet.has(tag.trim().toLowerCase()))
      ) {
        suppressed.push(step);
      } else {
        filtered.push(step);
      }
    }
    return { filteredSteps: filtered, suppressedSteps: suppressed };
  }, [steps, mockTagSet]);

  // Generate mock tasks from filtered steps
  const startDate = useMemo(() => new Date(), []);
  const mockTasks = useMemo(
    () => stepsToMockTasks(filteredSteps, startDate),
    [filteredSteps, startDate],
  );

  // Group tasks by phase
  const tasksByPhase = useMemo(() => {
    const grouped: Record<number, any[]> = {};
    for (const task of mockTasks) {
      const phase = task.metadata?.phase || 1;
      if (!grouped[phase]) grouped[phase] = [];
      grouped[phase].push(task);
    }
    return grouped;
  }, [mockTasks]);

  // Phase numbers sorted
  const phaseNumbers = useMemo(() => {
    return Array.from(new Set(Object.keys(tasksByPhase).map(Number).filter((n) => !isNaN(n)))).sort(
      (a, b) => a - b,
    );
  }, [tasksByPhase]);

  // Phase name lookup from definitions
  const phaseNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (phaseDefinitions) {
      for (const pd of phaseDefinitions) {
        map[pd.phaseNumber] = pd.name;
      }
    }
    return map;
  }, [phaseDefinitions]);

  // No-op handlers for preview mode
  const handlePreviewToggle = (_taskId: string, _col: string) => {
    setToastMsg('👁️ Preview Mode — task completion is disabled');
    setTimeout(() => setToastMsg(null), 2000);
  };
  const handlePreviewUpload = (_taskId: string, _cat: string) => {
    setToastMsg('👁️ Preview Mode — document uploads are disabled');
    setTimeout(() => setToastMsg(null), 2000);
  };
  const handlePreviewAskJarvis = (_question: string) => {
    setToastMsg('👁️ Preview Mode — JARVIS is not available in preview');
    setTimeout(() => setToastMsg(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <BodyPortal>
    <div className={MODAL_OVERLAY_CLASS} style={MODAL_OVERLAY_STYLE}>
      <div
        className={`my-auto w-full max-w-4xl h-[calc(100dvh-1rem)] sm:h-[90vh] rounded-2xl shadow-2xl border flex flex-col animate-in zoom-in-95 duration-200 ${
          isDarkMode
            ? 'bg-slate-900 border-slate-700/80 text-white'
            : 'bg-[#f5f1e8] border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`shrink-0 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b ${
            isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 mr-2">
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
              }`}
            >
              <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold truncate">Employee Preview</h2>
              <p className={`text-[11px] sm:text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Previewing &ldquo;{roleName}&rdquo;
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 sm:p-2 rounded-xl transition-colors shrink-0 ${
              isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Suppression Simulator */}
        <div
          className={`shrink-0 px-3 sm:px-6 py-2.5 sm:py-3 border-b ${
            isDarkMode ? 'border-slate-800 bg-slate-800/30' : 'border-slate-200/80 bg-slate-50'
          }`}
        >
          <button
            onClick={() => setShowSuppression(!showSuppression)}
            className={`flex items-center gap-2 text-xs font-bold transition-colors ${
              isDarkMode ? 'text-amber-400 hover:text-amber-300' : 'text-amber-600 hover:text-amber-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Role Suppression Simulator
            {showSuppression ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {showSuppression && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={mockRoleTags}
                  onChange={(e) => setMockRoleTags(e.target.value)}
                  placeholder="e.g. 1099, Peer Recovery Coach, Part-Time"
                  className={`flex-1 px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500'
                      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
              {suppressedSteps.length > 0 && (
                <div
                  className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                    isDarkMode ? 'bg-amber-950/30 text-amber-300' : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>{suppressedSteps.length} step{suppressedSteps.length > 1 ? 's' : ''} suppressed</strong>
                    {' — '}
                    {suppressedSteps.map((s) => s.title).join(', ')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Employee View */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Welcome Banner (Mock) */}
          <div
            className={`rounded-2xl px-5 py-5 ${
              isDarkMode
                ? 'bg-slate-800/60 border border-slate-700/50'
                : 'bg-white/70 border border-slate-200/80 shadow-sm'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <h2
                  className={`text-lg font-bold ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Welcome, Jane! 👋
                </h2>
                <p
                  className={`text-sm mt-1 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  You&apos;re onboarding as a <strong>{roleName}</strong>. Complete the
                  phases below to get fully set up.
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-center">
                  <div
                    className={`text-2xl font-extrabold ${
                      isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
                    }`}
                  >
                    0%
                  </div>
                  <div
                    className={`text-[11px] font-medium ${
                      isDarkMode ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    0/{filteredSteps.length} steps
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Disclaimer */}
          <div
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold ${
              isDarkMode
                ? 'bg-indigo-950/30 text-indigo-300 border border-indigo-800/40'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
            }`}
          >
            <Eye className="w-4 h-4 shrink-0" />
            This is a read-only preview. No tasks, documents, or instances are created.
          </div>

          {/* Phase Cards */}
          {phaseNumbers.length === 0 ? (
            <div
              className={`text-center py-12 text-sm ${
                isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              No steps to preview. Add steps to the blueprint to see the employee view.
            </div>
          ) : (
            phaseNumbers.map((phase, idx) => {
              const phaseTasks = tasksByPhase[phase] || [];
              // In preview, only the first phase is unlocked
              const isLocked = idx > 0;

              return (
                <OnboardingPhaseCard
                  key={phase}
                  phase={phase as OnboardingPhaseNumber}
                  tasks={phaseTasks}
                  isDarkMode={isDarkMode}
                  orgId={orgId}
                  isAssignee={true}
                  verificationMap={{}}
                  isLocked={isLocked}
                  defaultOpen={idx === 0}
                  phaseName={phaseNameMap[phase]}
                  onToggleComplete={handlePreviewToggle}
                  onUploadDocument={handlePreviewUpload}
                  onAskJarvis={handlePreviewAskJarvis}
                  onTaskClick={(task) => setSelectedTask(task)}
                />
              );
            })
          )}
        </div>

        {/* Toast */}
        {toastMsg && (
          <div
            className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm font-semibold shadow-lg animate-in slide-in-from-bottom-4 duration-200 ${
              isDarkMode
                ? 'bg-slate-700 text-white border border-slate-600'
                : 'bg-white text-slate-900 border border-slate-200 shadow-xl'
            }`}
          >
            {toastMsg}
          </div>
        )}
      </div>

      {/* Item Popup (for interactive content preview) */}
      {selectedTask && (
        <OnboardingItemPopup
          isOpen={!!selectedTask}
          task={selectedTask}
          isDarkMode={isDarkMode}
          orgId={orgId}
          onClose={() => setSelectedTask(null)}
          onComplete={() => {
            setToastMsg('👁️ Preview Mode — task completion is disabled');
            setTimeout(() => setToastMsg(null), 2000);
          }}
          onUploadClick={() => {
            setToastMsg('👁️ Preview Mode — uploads are disabled');
            setTimeout(() => setToastMsg(null), 2000);
          }}
        />
      )}
    </div>
    </BodyPortal>
  );
}
