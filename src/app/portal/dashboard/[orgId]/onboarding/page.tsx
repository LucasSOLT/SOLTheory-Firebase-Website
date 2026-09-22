'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { useOrgId } from '@/contexts/OrgContext';
import { useTheme } from '@/components/ThemeProvider';
import { useOrgRole } from '@/hooks/useOrgRole';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  GraduationCap,
  Loader2,
  Users,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Filter,
  ShieldCheck,
  Calendar,
  Bell,
  Sparkles,
  Send,
  ClipboardCheck,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import OnboardingPhaseCard from '@/components/onboarding/OnboardingPhaseCard';
import DocumentUploadModal from '@/components/onboarding/DocumentUploadModal';
import InviteMemberModal from '@/components/onboarding/InviteMemberModal';
import OnboardingItemPopup from '@/components/onboarding/OnboardingItemPopup';
import AdminSubmissionViewer from '@/components/onboarding/AdminSubmissionViewer';
import ScheduleOrientationModal from '@/components/onboarding/ScheduleOrientationModal';
import ManageUserBlueprintsModal from '@/components/onboarding/ManageUserBlueprintsModal';
import { getAuthHeaders } from '@/lib/api-auth-client';
import type { ComplianceDocumentCategory } from '@/types/onboarding-templates';
import { logActivity } from '@/lib/activity-logger';

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
  hasCalendarScheduled?: boolean;
  calendarEvents?: any[];
  lastNudgeSentAt?: any;
  nudgeCount?: number;
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
  };
  attachments?: { url: string; name: string; type: string }[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: any): string {
  if (!ts) return '—';
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { orgId: routeOrgId } = useParams<{ orgId: string }>();
  const contextOrgId = useOrgId();
  const orgId = routeOrgId || contextOrgId;
  const router = useRouter();

  const { user } = useUser();
  const firestore = useFirestore();
  const { isDarkMode } = useTheme();
  const { role, isLoading: isRoleLoading } = useOrgRole(orgId);

  // ── State ─────────────────────────────────────────────────────────────────
  const [instances, setInstances] = useState<OnboardingInstanceDoc[]>([]);
  const [tasks, setTasks] = useState<TaskDoc[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'completed'>('all');

  const [uploadModalState, setUploadModalState] = useState<{
    isOpen: boolean;
    taskId?: string;
    documentCategory: ComplianceDocumentCategory;
  }>({
    isOpen: false,
    documentCategory: 'w4',
  });

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'roadmaps' | 'blueprints' | 'vault' | 'reviews'>('roadmaps');
  const [selectedTaskForPopup, setSelectedTaskForPopup] = useState<TaskDoc | null>(null);
  const [selectedInstanceForCalendar, setSelectedInstanceForCalendar] = useState<OnboardingInstanceDoc | null>(null);
  const [selectedAdminInstance, setSelectedAdminInstance] = useState<OnboardingInstanceDoc | null>(null);
  const [adminReviewTask, setAdminReviewTask] = useState<TaskDoc | null>(null);
  const [nudgeLoadingMap, setNudgeLoadingMap] = useState<Record<string, boolean>>({});
  const [nudgeStatusMap, setNudgeStatusMap] = useState<Record<string, string>>({});
  const [isGlobalNudging, setIsGlobalNudging] = useState(false);
  const [globalNudgeMessage, setGlobalNudgeMessage] = useState<string | null>(null);
  const [manageBlueprintsInstance, setManageBlueprintsInstance] = useState<OnboardingInstanceDoc | null>(null);
  const isAdmin = role === 'admin' || role === 'oracle';

  const handleTriggerSingleNudge = async (instanceId: string) => {
    setNudgeLoadingMap(prev => ({ ...prev, [instanceId]: true }));
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/cron/nudges', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, instanceId, force: true }),
      });
      const data = await res.json();
      if (res.ok && data.sentCount > 0) {
        setNudgeStatusMap(prev => ({ ...prev, [instanceId]: 'Sent! ✓' }));
      } else if (res.ok) {
        setNudgeStatusMap(prev => ({ ...prev, [instanceId]: 'No items due' }));
      } else {
        setNudgeStatusMap(prev => ({ ...prev, [instanceId]: data.error || 'Failed' }));
      }
    } catch {
      setNudgeStatusMap(prev => ({ ...prev, [instanceId]: 'Error' }));
    } finally {
      setNudgeLoadingMap(prev => ({ ...prev, [instanceId]: false }));
      setTimeout(() => {
        setNudgeStatusMap(prev => {
          const next = { ...prev };
          delete next[instanceId];
          return next;
        });
      }, 4000);
    }
  };

  const handleRunGlobalNudges = async () => {
    setIsGlobalNudging(true);
    setGlobalNudgeMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/cron/nudges', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      const data = await res.json();
      if (res.ok) {
        setGlobalNudgeMessage(`Bobby dispatched ${data.sentCount || 0} reminder email(s)!`);
      } else {
        setGlobalNudgeMessage(data.error || 'Failed to dispatch nudges');
      }
    } catch (err: any) {
      setGlobalNudgeMessage(err.message || 'Error triggering nudges');
    } finally {
      setIsGlobalNudging(false);
      setTimeout(() => setGlobalNudgeMessage(null), 5000);
    }
  };

  // ── Data Loading: Server-Side Reliable Fallback ───────────────────────────
  const fetchServerData = useCallback(async () => {
    if (!orgId) return;
    try {
      const headers = await getAuthHeaders();
      const [instRes, docsRes] = await Promise.all([
        fetch(`/api/onboarding/instances?orgId=${orgId}`, { headers }),
        fetch(`/api/onboarding/vault/list?orgId=${orgId}`, { headers }),
      ]);

      if (instRes.ok) {
        const instData = await instRes.json();
        if (instData.instances) setInstances(instData.instances);
      }
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        if (docsData.documents) setComplianceDocs(docsData.documents);
      }
    } catch (err) {
      console.warn('[Onboarding] Server fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchServerData();
  }, [fetchServerData]);

  // ── Real-Time Firestore Listeners ─────────────────────────────────────────

  // Load onboarding instances
  useEffect(() => {
    if (!firestore || !orgId || !user?.uid) return;

    const instancesRef = collection(firestore, 'onboarding_instances');
    const q = isAdmin
      ? query(instancesRef, where('orgId', '==', orgId))
      : query(instancesRef, where('orgId', '==', orgId), where('userId', '==', user.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as OnboardingInstanceDoc));
        setInstances(items);
        setLoading(false);
      },
      (err) => {
        // Permissions fallback — server API already fetched
        fetchServerData();
      },
    );

    return () => unsub();
  }, [firestore, orgId, user?.uid, isAdmin, fetchServerData]);

  // Load onboarding tasks
  useEffect(() => {
    if (!firestore || !orgId || !user?.uid) return;

    const tasksRef = collection(firestore, 'action_board_tasks');
    const q = isAdmin
      ? query(tasksRef, where('orgId', '==', orgId), where('category', '==', 'onboarding'))
      : query(tasksRef, where('orgId', '==', orgId), where('category', '==', 'onboarding'), where('assignedTo', '==', user.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskDoc)));
      },
      (err) => {
        console.error('[Onboarding] Tasks query error:', err);
      },
    );

    return () => unsub();
  }, [firestore, orgId, user?.uid, isAdmin]);

  // Load compliance documents
  useEffect(() => {
    if (!firestore || !orgId || !user?.uid) return;

    const docsRef = collection(firestore, `orgs/${orgId}/compliance_documents`);
    const q = isAdmin
      ? query(docsRef)
      : query(docsRef, where('userId', '==', user.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setComplianceDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        // Permissions fallback — server API already fetched
        fetchServerData();
      },
    );

    return () => unsub();
  }, [firestore, orgId, user?.uid, isAdmin, fetchServerData]);

  // Map of taskId → status from compliance vault
  const verificationMap = useMemo(() => {
    const map: Record<string, 'pending_review' | 'verified' | 'rejected' | null> = {};
    for (const cDoc of complianceDocs) {
      if (cDoc.taskId) {
        map[cDoc.taskId] = cDoc.status;
      }
    }
    return map;
  }, [complianceDocs]);

  // ── Derived Data ──────────────────────────────────────────────────────────

  // The current user's active onboarding instance (if they are a new hire)
  const myInstance = useMemo(
    () => instances.find(i => i.userId === user?.uid && i.status === 'in_progress'),
    [instances, user?.uid],
  );

  // Tasks for the user's own instance, grouped by phase (dynamic — supports any number of phases)
  const myTasksByPhase = useMemo(() => {
    if (!myInstance) return {} as Record<number, TaskDoc[]>;
    const grouped: Record<number, TaskDoc[]> = {};
    for (const task of tasks) {
      if (task.metadata?.onboardingInstanceId === myInstance.id && task.metadata?.phase) {
        const phase = task.metadata.phase;
        if (!grouped[phase]) grouped[phase] = [];
        grouped[phase].push(task);
      }
    }
    return grouped;
  }, [tasks, myInstance]);

  // Recalculate progress for the user's instance
  const myProgress = useMemo(() => {
    if (!myInstance) return { completed: 0, total: 0, percent: 0 };
    const instanceTasks = tasks.filter(t => t.metadata?.onboardingInstanceId === myInstance.id);
    const completed = instanceTasks.filter(t => t.column === 'done').length;
    const total = instanceTasks.length;
    return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [tasks, myInstance]);

  // Admin view: instances with computed progress
  const adminInstances = useMemo(() => {
    if (!isAdmin) return [];
    return instances
      .filter(inst => {
        if (filterStatus !== 'all' && inst.status !== filterStatus) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            inst.userName.toLowerCase().includes(q) ||
            inst.userEmail.toLowerCase().includes(q) ||
            inst.roleName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .map(inst => {
        const instTasks = tasks.filter(t => t.metadata?.onboardingInstanceId === inst.id);
        const completedCount = instTasks.filter(t => t.column === 'done').length;
        const totalCount = instTasks.length || inst.totalSteps;
        const now = Date.now();
        const overdueDocs = instTasks.filter(
          t => t.metadata?.requiresDocumentUpload && t.column !== 'done' && (!t.attachments || t.attachments.length === 0)
            && t.dueDate && (typeof t.dueDate === 'number' ? t.dueDate : t.dueDate?.toDate?.()?.getTime?.() || Infinity) < now,
        );
        const pendingDocs = instTasks.filter(
          t => t.metadata?.requiresDocumentUpload && t.column !== 'done' && (!t.attachments || t.attachments.length === 0)
            && (!t.dueDate || (typeof t.dueDate === 'number' ? t.dueDate : t.dueDate?.toDate?.()?.getTime?.() || Infinity) >= now),
        );
        return {
          ...inst,
          computedProgress: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
          computedCompleted: completedCount,
          computedTotal: totalCount,
          overdueDocuments: overdueDocs.length,
          pendingDocuments: pendingDocs.length,
        };
      })
      .sort((a, b) => {
        // Sort: in_progress first, then by progress ascending (least complete first)
        if (a.status !== b.status) return a.status === 'in_progress' ? -1 : 1;
        return a.computedProgress - b.computedProgress;
      });
  }, [instances, tasks, isAdmin, filterStatus, searchQuery]);

  // Count of new hires with OVERDUE compliance docs (past due date, nothing uploaded)
  const overdueDocsCount = useMemo(
    () => adminInstances.filter(i => i.overdueDocuments > 0 && i.status === 'in_progress').length,
    [adminInstances],
  );

  // Count of new hires with pending (not yet due) compliance uploads
  const pendingDocsCount = useMemo(
    () => adminInstances.filter(i => i.pendingDocuments > 0 && i.status === 'in_progress').length,
    [adminInstances],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggleComplete = useCallback(
    async (taskId: string, currentColumn: string) => {
      if (!firestore) return;
      const taskRef = doc(firestore, 'action_board_tasks', taskId);
      const newColumn = currentColumn === 'done' ? 'todo' : 'done';
      try {
        await updateDoc(taskRef, {
          column: newColumn,
          updatedAt: serverTimestamp(),
          ...(newColumn === 'done' ? { completedAt: serverTimestamp() } : { completedAt: null }),
        });

        // Log activity
        if (user?.email) {
          await logActivity(
            firestore,
            newColumn === 'done' ? 'action_board_completed' : 'action_board_updated',
            { email: user.email, displayName: user.displayName },
            undefined,
            { taskId, source: 'onboarding' },
          );
        }
      } catch (err) {
        console.error('[Onboarding] Failed to toggle task:', err);
      }
    },
    [firestore, user],
  );

  const handleUploadDocument = useCallback(
    (taskId: string, documentCategory: string) => {
      setUploadModalState({
        isOpen: true,
        taskId,
        documentCategory: documentCategory as ComplianceDocumentCategory,
      });
    },
    [],
  );

  const handleAskJarvis = useCallback(
    (question: string) => {
      // Navigate to Jarvis chat with pre-filled context
      const encoded = encodeURIComponent(question);
      router.push(`/portal/dashboard/${orgId}/ai-agents/jarvis?prompt=${encoded}`);
    },
    [router, orgId],
  );

  // ── Loading State ─────────────────────────────────────────────────────────

  if (loading || isRoleLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Loading onboarding data...
        </p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col h-full -mx-4 -mb-4 md:-mx-10 md:-mb-10 ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-[#f5f1e8] text-slate-900'} font-sans overflow-hidden`}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className={`shrink-0 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200/80 bg-[#f5f1e8]'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3 tracking-tight">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                <GraduationCap className="w-5 h-5" />
              </div>
              Onboarding
            </h1>
            <p className={`mt-1 text-sm ml-[52px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {isAdmin
                ? 'Track and manage new hire onboarding across your organization.'
                : 'Complete your onboarding steps and get up to speed with your new role.'}
            </p>
          </div>

          {/* Admin buttons */}
          {isAdmin && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleRunGlobalNudges}
                disabled={isGlobalNudging}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm active:scale-[0.98] cursor-pointer border ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/30'
                    : 'bg-white hover:bg-amber-50 text-amber-700 border-amber-200'
                }`}
                title="Bobby scans for approaching and overdue tasks to send friendly Gmail reminders"
              >
                {isGlobalNudging ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4 text-amber-500" />
                )}
                <span>Run Bobby Nudges</span>
              </button>

              <button
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm active:scale-[0.98] cursor-pointer ${
                  isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
                onClick={() => setIsInviteModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                Onboard New Hire
              </button>
            </div>
          )}
        </div>

        {/* Bobby Nudges Feedback Pill */}
        {globalNudgeMessage && (
          <div className="mt-3 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{globalNudgeMessage}</span>
          </div>
        )}

        {/* ── Tab Bar (Admin Only) ─────────────────────────────────────── */}
        {isAdmin && (() => {
          const pendingReviewCount = tasks.filter(t => t.metadata?.reviewStatus === 'pending_review').length;
          return (
          <div className={`flex items-center gap-1 mt-4 px-1 py-1 rounded-xl ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-100/80'}`}>
            {([
              { key: 'roadmaps' as const, label: 'Active Roadmaps', icon: <Users className="w-4 h-4" /> },
              { key: 'blueprints' as const, label: 'Role Blueprints', icon: <GraduationCap className="w-4 h-4" /> },
              { key: 'vault' as const, label: 'Compliance Vault', icon: <ShieldCheck className="w-4 h-4" /> },
              { key: 'reviews' as const, label: 'Review Queue', icon: <ClipboardCheck className="w-4 h-4" /> },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  if (tab.key === 'blueprints') {
                    router.push(`/portal/dashboard/${orgId}/onboarding/blueprints`);
                  } else if (tab.key === 'vault') {
                    router.push(`/portal/dashboard/${orgId}/onboarding/vault`);
                  } else {
                    setActiveTab(tab.key);
                    if (tab.key !== 'roadmaps') setSelectedAdminInstance(null);
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? (isDarkMode ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm')
                    : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50')
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                {/* Pending count badge for Review Queue */}
                {tab.key === 'reviews' && pendingReviewCount > 0 && (
                  <span className={`ml-0.5 min-w-[20px] h-5 flex items-center justify-center text-[10px] font-black rounded-full px-1.5 ${
                    activeTab === 'reviews'
                      ? 'bg-amber-500 text-white'
                      : (isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')
                  }`}>
                    {pendingReviewCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          );
        })()}
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* NEW HIRE VIEW — 4-Phase Onboarding Roadmap                     */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {myInstance && (
          <div className="space-y-6">
            {/* Welcome banner */}
            <div className={`rounded-2xl px-5 py-5 ${isDarkMode ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white/70 border border-slate-200/80 shadow-sm'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Welcome, {myInstance.userName.split(' ')[0]}! 👋
                  </h2>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    You&apos;re onboarding as a <strong>{myInstance.roleName}</strong>. Complete the phases below to get fully set up. Ask JARVIS anytime you have a question!
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <div className={`text-2xl font-extrabold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                      {myProgress.percent}%
                    </div>
                    <div className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {myProgress.completed}/{myProgress.total} steps
                    </div>
                  </div>
                  <div className="w-24">
                    <Progress value={myProgress.percent} className="h-2" />
                  </div>
                </div>
              </div>
            </div>

            {/* Phase cards — dynamically extracted from task phases */}
            {(() => {
              const phaseNumbers = Array.from(new Set(
                Object.keys(myTasksByPhase).map(Number).filter(n => !isNaN(n))
              )).sort((a, b) => a - b);
              // Fallback to [1,2,3,4] if no phases detected
              const phases = phaseNumbers.length > 0 ? phaseNumbers : [1, 2, 3, 4];

              return phases.map(phase => {
                const phaseTasks = myTasksByPhase[phase] || [];
                // Phase is locked if any previous phase has incomplete tasks
                const previousPhasesComplete = phases
                  .filter(p => p < phase)
                  .every(p => {
                    const prevTasks = myTasksByPhase[p] || [];
                    return prevTasks.length > 0 && prevTasks.every(t => t.column === 'done');
                  });
                const isLocked = phase !== phases[0] && !previousPhasesComplete;

                return (
                  <OnboardingPhaseCard
                    key={phase}
                    phase={phase}
                    tasks={phaseTasks}
                    isDarkMode={isDarkMode}
                    orgId={orgId}
                    isAssignee={true}
                    verificationMap={verificationMap}
                    isLocked={isLocked}
                    defaultOpen={phase === phases[0] || (previousPhasesComplete && phaseTasks.some(t => t.column !== 'done'))}
                    onToggleComplete={handleToggleComplete}
                    onUploadDocument={handleUploadDocument}
                    onAskJarvis={handleAskJarvis}
                    onTaskClick={(task) => setSelectedTaskForPopup(task as any)}
                  />
                );
              });
            })()}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ADMIN / MANAGER VIEW — Organization Onboarding Overview        */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {isAdmin && activeTab === 'roadmaps' && !selectedAdminInstance && (
          <div className="space-y-6">

            {/* Overdue documents alert — only shown when documents are actually past due */}
            {overdueDocsCount > 0 && (
              <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${
                isDarkMode ? 'bg-amber-950/30 border-amber-800/50 text-amber-300' : 'bg-amber-50 border-amber-200/80 text-amber-700'
              }`}>
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">
                  {overdueDocsCount} new hire{overdueDocsCount > 1 ? 's' : ''} ha{overdueDocsCount > 1 ? 've' : 's'} overdue compliance documents requiring attention.
                </span>
              </div>
            )}

            {/* Summary stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {[
                {
                  label: 'Active Tracks',
                  value: instances.filter(i => i.status === 'in_progress').length,
                  icon: <Users className="w-4 h-4" />,
                  accent: isDarkMode ? 'text-indigo-400 bg-indigo-900/40' : 'text-indigo-600 bg-indigo-50',
                },
                {
                  label: 'Completed',
                  value: instances.filter(i => i.status === 'completed').length,
                  icon: <CheckCircle2 className="w-4 h-4" />,
                  accent: isDarkMode ? 'text-emerald-400 bg-emerald-900/40' : 'text-emerald-600 bg-emerald-50',
                },
                {
                  label: overdueDocsCount > 0 ? 'Overdue Docs' : 'Pending Uploads',
                  value: overdueDocsCount > 0 ? overdueDocsCount : pendingDocsCount,
                  icon: <AlertTriangle className="w-4 h-4" />,
                  accent: overdueDocsCount > 0
                    ? (isDarkMode ? 'text-rose-400 bg-rose-900/40' : 'text-rose-600 bg-rose-50')
                    : (isDarkMode ? 'text-amber-400 bg-amber-900/40' : 'text-amber-600 bg-amber-50'),
                },
                {
                  label: 'Avg. Progress',
                  value: adminInstances.length > 0
                    ? `${Math.round(adminInstances.reduce((sum, i) => sum + i.computedProgress, 0) / adminInstances.length)}%`
                    : '—',
                  icon: <BarChart3 className="w-4 h-4" />,
                  accent: isDarkMode ? 'text-violet-400 bg-violet-900/40' : 'text-violet-600 bg-violet-50',
                },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl px-4 py-3 ${isDarkMode ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white/70 border border-slate-200/80 shadow-sm'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${stat.accent}`}>
                      {stat.icon}
                    </div>
                    <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {stat.label}
                    </span>
                  </div>
                  <div className={`text-xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="text"
                  placeholder="Search by name, email, or role..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    isDarkMode
                      ? 'bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-indigo-500/50'
                      : 'bg-white/70 border-slate-200/80 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400/50'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Filter className={`w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                {(['all', 'in_progress', 'completed'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                      filterStatus === status
                        ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white')
                        : (isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white/80 text-slate-500 hover:bg-slate-100 border border-slate-200/60')
                    }`}
                  >
                    {status === 'all' ? 'All' : status === 'in_progress' ? 'Active' : 'Completed'}
                  </button>
                ))}
              </div>
            </div>

            {/* Instance roster */}
            {adminInstances.length === 0 ? (
              <div className={`rounded-2xl border-2 border-dashed px-6 py-12 text-center ${
                isDarkMode ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-200/60 bg-white/30'
              }`}>
                <GraduationCap className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                <h3 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  No onboarding tracks yet
                </h3>
                <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Click &quot;Onboard New Hire&quot; to get started with your first onboarding track.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {adminInstances.map(inst => (
                  <div
                    key={inst.id}
                    onClick={() => setSelectedAdminInstance(inst)}
                    className={`rounded-xl px-5 py-4 transition-all cursor-pointer ${
                      isDarkMode
                        ? 'bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600/60'
                        : 'bg-white/70 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-black uppercase ${
                        isDarkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-600'
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
                          {inst.overdueDocuments > 0 && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              isDarkMode ? 'bg-rose-950/50 text-rose-400 border-rose-800/60' : 'bg-rose-50 text-rose-600 border-rose-200/60'
                            }`}>
                              <AlertTriangle className="w-3 h-3" />
                              {inst.overdueDocuments} overdue doc{inst.overdueDocuments > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {(() => {
                            // Show all role names for this user
                            const userInstances = instances.filter(i => i.userId === inst.userId);
                            const roleNames = [...new Set(userInstances.map(i => i.roleName))];
                            return roleNames.join(' + ');
                          })()} • Started {formatDate(inst.startedAt)} • {inst.userEmail}
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className={`text-lg font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {inst.computedProgress}%
                          </div>
                          <div className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {inst.computedCompleted}/{inst.computedTotal}
                          </div>
                        </div>
                        <div className="w-20">
                          <Progress value={inst.computedProgress} className="h-2" />
                        </div>
                      </div>

                      {/* Action buttons (Calendar & Bobby Nudge) */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInstanceForCalendar(inst);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            inst.hasCalendarScheduled
                              ? (isDarkMode ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/40' : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100')
                              : (isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50')
                          }`}
                          title="Schedule Orientation & Milestones on Google Calendar"
                        >
                          <Calendar className="w-3.5 h-3.5 text-amber-500" />
                          <span className="hidden md:inline">{inst.hasCalendarScheduled ? 'Calendar ✓' : 'Calendar'}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTriggerSingleNudge(inst.id);
                          }}
                          disabled={nudgeLoadingMap[inst.id]}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            nudgeStatusMap[inst.id] === 'Sent! ✓'
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500'
                              : isDarkMode
                              ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                          title="Trigger a friendly Bobby reminder email for approaching/overdue items"
                        >
                          {nudgeLoadingMap[inst.id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                          ) : (
                            <Bell className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span>{nudgeStatusMap[inst.id] || 'Nudge'}</span>
                        </button>
                      </div>

                      <ArrowRight className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ADMIN DRILL-DOWN — View an employee's tasks after clicking     */}
        {/* their instance card in the roster above                        */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {isAdmin && activeTab === 'roadmaps' && selectedAdminInstance && (
          <div className="space-y-4">
            {/* Back bar */}
            <button
              onClick={() => setSelectedAdminInstance(null)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-700'
                  : 'bg-white/70 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Back to All Tracks
            </button>

            {/* Employee header */}
            <div className={`rounded-xl px-5 py-4 ${
              isDarkMode ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white/70 border border-slate-200/80 shadow-sm'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black uppercase ${
                  isDarkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-600'
                }`}>
                  {selectedAdminInstance.userName.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {selectedAdminInstance.userName}
                  </div>
                  <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {selectedAdminInstance.userEmail}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {(() => {
                      // Calculate progress across ALL instances for this user
                      const userInstances = instances.filter(i => i.userId === selectedAdminInstance.userId);
                      const allTaskIds = userInstances.flatMap(i => i.taskIds || []);
                      const userTasks = tasks.filter(t => allTaskIds.includes(t.id) || userInstances.some(ui => t.metadata?.onboardingInstanceId === ui.id));
                      const done = userTasks.filter(t => t.column === 'done').length;
                      const total = userTasks.length;
                      return total > 0 ? `${Math.round((done / total) * 100)}%` : '0%';
                    })()}
                  </div>
                  <div className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Overall Progress</div>
                </div>
              </div>
            </div>

            {/* Blueprint management bar */}
            {(() => {
              const userInstances = instances.filter(i => i.userId === selectedAdminInstance.userId);
              return (
                <div className={`rounded-xl px-5 py-3 ${
                  isDarkMode ? 'bg-slate-800/40 border border-slate-700/50' : 'bg-slate-50/70 border border-slate-200/60'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Assigned Blueprints ({userInstances.length})
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setManageBlueprintsInstance(selectedAdminInstance);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        isDarkMode
                          ? 'bg-slate-800/80 border-slate-700 text-indigo-400 hover:bg-slate-700 hover:text-indigo-300'
                          : 'bg-white border-slate-200 text-indigo-600 hover:bg-indigo-50'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      Manage Blueprints
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {userInstances.map(ui => {
                      const instTasks = tasks.filter(t => t.metadata?.onboardingInstanceId === ui.id);
                      const done = instTasks.filter(t => t.column === 'done').length;
                      const total = instTasks.length;
                      return (
                        <div
                          key={ui.id}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                            isDarkMode
                              ? 'bg-slate-700/50 border-slate-600/50 text-slate-200'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <GraduationCap className={`w-3.5 h-3.5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                          <span>{ui.roleName}</span>
                          <span className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {done}/{total}
                          </span>
                          {ui.status === 'completed' && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Employee tasks by phase — across ALL instances for this user */}
            {(() => {
              const userInstances = instances.filter(i => i.userId === selectedAdminInstance.userId);
              const instanceTasks = tasks.filter(t =>
                userInstances.some(ui => t.metadata?.onboardingInstanceId === ui.id)
              );

              // Dynamically extract phase numbers from all tasks
              const phaseNumbers = Array.from(new Set(
                instanceTasks.map(t => t.metadata?.phase).filter(Boolean)
              )).sort((a, b) => (a as number) - (b as number)) as number[];
              const phases = phaseNumbers.length > 0 ? phaseNumbers : [1, 2, 3, 4];

              if (instanceTasks.length === 0) {
                return (
                  <div className={`text-center py-8 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    <p className="text-sm font-semibold">No tasks found for this employee.</p>
                  </div>
                );
              }

              return phases.map(phase => {
                const phaseTasks = instanceTasks.filter(t => t.metadata?.phase === phase);
                if (phaseTasks.length === 0) return null;
                return (
                  <OnboardingPhaseCard
                    key={phase}
                    phase={phase}
                    tasks={phaseTasks}
                    isDarkMode={isDarkMode}
                    orgId={orgId}
                    isAssignee={false}
                    verificationMap={{}}
                    isLocked={false}
                    defaultOpen={true}
                    onToggleComplete={handleToggleComplete}
                    onUploadDocument={handleUploadDocument}
                    onAskJarvis={handleAskJarvis}
                    onTaskClick={(task) => setAdminReviewTask(task as any)}
                  />
                );
              });
            })()}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* ADMIN REVIEW QUEUE — Consolidated pending approvals inbox     */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {isAdmin && activeTab === 'reviews' && (() => {
          const pendingTasks = tasks.filter(t => t.metadata?.reviewStatus === 'pending_review');
          const recentlyReviewedTasks = tasks.filter(t =>
            t.metadata?.reviewStatus === 'approved' || t.metadata?.reviewStatus === 'rejected'
          ).sort((a, b) => {
            const aTime = a.metadata?.reviewedAt?.toDate?.() || new Date(a.metadata?.reviewedAt || 0);
            const bTime = b.metadata?.reviewedAt?.toDate?.() || new Date(b.metadata?.reviewedAt || 0);
            return bTime.getTime() - aTime.getTime();
          }).slice(0, 10);

          // Helper to find instance info for a task
          const getInstanceForTask = (task: TaskDoc) => {
            return instances.find(inst => inst.id === task.metadata?.onboardingInstanceId);
          };

          const typeLabels: Record<string, string> = {
            quiz: 'Quiz', short_answer: 'Short Answer', form: 'Form', checklist: 'Checklist',
            policy_acknowledgment: 'E-Signature', external_verification: 'External', recorded_response: 'Recording',
          };

          const typeBadgeColors: Record<string, string> = {
            quiz: isDarkMode ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60' : 'bg-indigo-50 text-indigo-700 border-indigo-200',
            short_answer: isDarkMode ? 'bg-sky-950/60 text-sky-300 border-sky-800/60' : 'bg-sky-50 text-sky-700 border-sky-200',
            form: isDarkMode ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
            policy_acknowledgment: isDarkMode ? 'bg-purple-950/60 text-purple-300 border-purple-800/60' : 'bg-purple-50 text-purple-700 border-purple-200',
            external_verification: isDarkMode ? 'bg-blue-950/60 text-blue-300 border-blue-800/60' : 'bg-blue-50 text-blue-700 border-blue-200',
            recorded_response: isDarkMode ? 'bg-rose-950/60 text-rose-300 border-rose-800/60' : 'bg-rose-50 text-rose-700 border-rose-200',
          };

          return (
            <div className="space-y-6">
              {/* Pending review section */}
              <div>
                <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <ClipboardCheck className="w-4 h-4 text-amber-500" />
                  Awaiting Your Review
                  {pendingTasks.length > 0 && (
                    <span className={`ml-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {pendingTasks.length}
                    </span>
                  )}
                </h3>

                {pendingTasks.length === 0 ? (
                  <div className={`rounded-2xl border-2 border-dashed px-6 py-12 text-center ${
                    isDarkMode ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-200/60 bg-white/30'
                  }`}>
                    <CheckCircle2 className={`w-10 h-10 mx-auto mb-3 ${isDarkMode ? 'text-emerald-500/40' : 'text-emerald-400/60'}`} />
                    <h4 className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      All caught up!
                    </h4>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      No submissions are pending review right now.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingTasks.map(task => {
                      const inst = getInstanceForTask(task);
                      const itemType = task.metadata?.itemType || '';
                      const latestResponse = task.metadata?.userResponse?.[task.metadata.userResponse.length - 1];
                      return (
                        <div
                          key={task.id}
                          onClick={() => setAdminReviewTask(task)}
                          className={`flex items-center gap-4 px-5 py-4 rounded-xl border cursor-pointer transition-all ${
                            isDarkMode
                              ? 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-800/80 hover:border-amber-800/40'
                              : 'bg-white/70 border-slate-200/80 shadow-sm hover:shadow-md hover:border-amber-300'
                          }`}
                        >
                          {/* Avatar */}
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black uppercase shrink-0 ${
                            isDarkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-600'
                          }`}>
                            {(inst?.userName || task.assignedToEmail || '?').charAt(0)}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {task.title}
                            </div>
                            <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              {inst?.userName || task.assignedToEmail?.split('@')[0] || 'Unknown'}
                              {inst?.roleName && <span> • {inst.roleName}</span>}
                              {latestResponse?.submittedAt && (
                                <span> • Submitted {formatDate(latestResponse.submittedAt)}</span>
                              )}
                            </div>
                          </div>

                          {/* Type badge */}
                          <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${
                            typeBadgeColors[itemType] || (isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200')
                          }`}>
                            {typeLabels[itemType] || itemType}
                          </span>

                          {/* Review arrow */}
                          <ArrowRight className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-amber-500/60' : 'text-amber-400'}`} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recently reviewed section */}
              {recentlyReviewedTasks.length > 0 && (
                <div>
                  <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Recently Reviewed
                  </h3>
                  <div className="space-y-1.5">
                    {recentlyReviewedTasks.map(task => {
                      const inst = getInstanceForTask(task);
                      const itemType = task.metadata?.itemType || '';
                      const isApproved = task.metadata?.reviewStatus === 'approved';
                      return (
                        <div
                          key={task.id}
                          onClick={() => setAdminReviewTask(task)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                            isDarkMode
                              ? 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/50'
                              : 'bg-slate-50/50 border-slate-200/50 hover:bg-white/80'
                          }`}
                        >
                          {/* Status icon */}
                          {isApproved
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            : <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                          }

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-semibold truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              {task.title}
                            </div>
                            <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              {inst?.userName || task.assignedToEmail?.split('@')[0]} •{' '}
                              {isApproved ? 'Approved' : 'Rejected'}
                              {task.metadata?.reviewedByEmail && ` by ${task.metadata.reviewedByEmail.split('@')[0]}`}
                            </div>
                          </div>

                          {/* Type badge */}
                          <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${
                            typeBadgeColors[itemType] || (isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200')
                          }`}>
                            {typeLabels[itemType] || itemType}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* NO ACTIVE INSTANCE — New hire with no track, or non-admin       */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {!myInstance && !isAdmin && (
          <div className={`rounded-2xl border-2 border-dashed px-6 py-16 text-center ${
            isDarkMode ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-200/60 bg-white/30'
          }`}>
            <GraduationCap className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
            <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              No Active Onboarding Track
            </h3>
            <p className={`text-sm max-w-md mx-auto ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Your administrator hasn&apos;t started an onboarding track for you yet. Contact your supervisor or ask JARVIS for help.
            </p>
          </div>
        )}
      </div>

      {/* ── Document Upload Modal ────────────────────────────────────────── */}
      {uploadModalState.isOpen && (
        <DocumentUploadModal
          isOpen={uploadModalState.isOpen}
          onClose={() => setUploadModalState(prev => ({ ...prev, isOpen: false }))}
          orgId={orgId}
          documentCategory={uploadModalState.documentCategory}
          taskId={uploadModalState.taskId}
          isDarkMode={isDarkMode}
          onUploadSuccess={() => {
            fetchServerData();
          }}
        />
      )}

      {/* ── Invite / Start Onboarding Modal ─────────────────────────────── */}
      {isInviteModalOpen && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          orgId={orgId}
          isDarkMode={isDarkMode}
          currentUserId={user?.uid}
          currentUserEmail={user?.email || undefined}
          currentUserName={user?.displayName || undefined}
          onSuccess={() => {
            fetchServerData();
          }}
        />
      )}

      {/* ── Onboarding Item Detail Popup ──────────────────────────────── */}
      {selectedTaskForPopup && (
        <OnboardingItemPopup
          isOpen={!!selectedTaskForPopup}
          onClose={() => setSelectedTaskForPopup(null)}
          isDarkMode={isDarkMode}
          orgId={orgId}
          task={selectedTaskForPopup}
          onComplete={(taskId) => {
            handleToggleComplete(taskId, selectedTaskForPopup.column);
            setSelectedTaskForPopup(null);
          }}
          onUploadClick={(taskId) => {
            const meta = selectedTaskForPopup.metadata;
            setUploadModalState({
              isOpen: true,
              taskId,
              documentCategory: (meta?.documentCategory as ComplianceDocumentCategory) || 'other',
            });
            setSelectedTaskForPopup(null);
          }}
        />
      )}

      {/* ── Schedule Orientation Modal (Bobby Engine) ──────────────────── */}
      {selectedInstanceForCalendar && (
        <ScheduleOrientationModal
          isOpen={!!selectedInstanceForCalendar}
          onClose={() => setSelectedInstanceForCalendar(null)}
          instance={selectedInstanceForCalendar}
          orgId={orgId}
          isDarkMode={isDarkMode}
          onSuccess={() => {
            fetchServerData();
          }}
        />
      )}

      {/* ── Admin Submission Review Viewer ──────────────────────────────── */}
      {adminReviewTask && (
        <AdminSubmissionViewer
          isOpen={!!adminReviewTask}
          onClose={() => setAdminReviewTask(null)}
          isDarkMode={isDarkMode}
          orgId={orgId}
          task={adminReviewTask}
          employeeName={
            selectedAdminInstance?.userName ||
            adminReviewTask.assignedToEmail?.split('@')[0]
          }
          onReviewComplete={() => {
            setAdminReviewTask(null);
            fetchServerData();
          }}
        />
      )}

      {/* ── Manage User Blueprints Modal ────────────────────────────────── */}
      {manageBlueprintsInstance && (
        <ManageUserBlueprintsModal
          isOpen={!!manageBlueprintsInstance}
          onClose={() => setManageBlueprintsInstance(null)}
          orgId={orgId}
          isDarkMode={isDarkMode}
          userId={manageBlueprintsInstance.userId}
          userName={manageBlueprintsInstance.userName}
          userEmail={manageBlueprintsInstance.userEmail}
          userInstances={instances
            .filter(i => i.userId === manageBlueprintsInstance.userId)
            .map(i => {
              const instTasks = tasks.filter(t => t.metadata?.onboardingInstanceId === i.id);
              const done = instTasks.filter(t => t.column === 'done').length;
              return {
                id: i.id,
                templateId: i.templateId,
                roleName: i.roleName,
                status: i.status,
                computedProgress: instTasks.length > 0 ? Math.round((done / instTasks.length) * 100) : 0,
                computedCompleted: done,
                computedTotal: instTasks.length,
              };
            })
          }
          onSuccess={() => {
            fetchServerData();
          }}
        />
      )}
    </div>
  );
}
