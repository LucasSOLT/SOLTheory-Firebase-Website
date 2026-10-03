'use client';

// ============================================================================
// ReadyToArchivePanel — Phase 4, Step 4.1 (Onboarding Document System)
//
// Admin-facing list of signed PDF documents waiting for the manual
// "Send & Archive" click (plus archived ones where some emails failed and need
// a resend). Works for multi-party documents (fully executed) and completed
// single-signer PDF forms. Display only — the server re-checks everything.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { Mail } from 'lucide-react';
import SendArchiveButton from '@/components/onboarding/SendArchiveButton';
import type { TaskSigningMirror } from '@/types/onboarding-templates';

interface PanelTask {
  id: string;
  title: string;
  column: string;
  assignedToName?: string;
  assignedToEmail?: string;
  completedAt?: any;
  metadata?: {
    onboardingInstanceId?: string;
    interactiveContent?: { type?: string } | any;
    signing?: TaskSigningMirror;
    archivedAt?: string;
    archiveDeliveriesFailed?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

interface Props {
  tasks: PanelTask[];
  orgId: string;
  isDarkMode: boolean;
  onRefresh: () => void;
  /** Limit to one employee's tasks (admin employee drill-down). */
  employeeUid?: string;
}

const VISIBLE = 5;

function toMillis(v: any): number {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export default function ReadyToArchivePanel({ tasks, orgId, isDarkMode, onRefresh, employeeUid }: Props) {
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const out: { task: PanelTask; archivedAt: string | null; failed: number }[] = [];
    for (const t of tasks) {
      if (t.category && t.category !== 'onboarding') continue;
      if (employeeUid && t.assignedTo !== employeeUid) continue;
      const s = t.metadata?.signing;
      const isMulti = !!s && s.totalSigners >= 2;
      if (isMulti) {
        if (s!.status === 'fully_executed') out.push({ task: t, archivedAt: null, failed: 0 });
        else if (s!.status === 'archived' && (s!.deliveriesFailed || 0) > 0) {
          out.push({ task: t, archivedAt: s!.archivedAt || 'archived', failed: s!.deliveriesFailed || 0 });
        }
      } else if (t.column === 'done' && t.metadata?.interactiveContent?.type === 'pdf_form') {
        const archivedAt = t.metadata?.archivedAt || null;
        const failed = t.metadata?.archiveDeliveriesFailed || 0;
        if (!archivedAt || failed > 0) out.push({ task: t, archivedAt, failed });
      }
    }
    return out.sort((a, b) => toMillis(b.task.completedAt) - toMillis(a.task.completedAt));
  }, [tasks, employeeUid]);

  if (rows.length === 0) return null;
  const shown = showAll ? rows : rows.slice(0, VISIBLE);
  const dark = isDarkMode;

  return (
    <div className={`rounded-2xl border p-4 ${dark ? 'bg-teal-950/20 border-teal-800/40' : 'bg-teal-50/70 border-teal-200'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Mail className={`w-4 h-4 ${dark ? 'text-teal-300' : 'text-teal-600'}`} />
        <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>Signed documents ready to Send &amp; Archive</h3>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${dark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-100 text-teal-700'}`}>{rows.length}</span>
      </div>
      <ul className="space-y-2">
        {shown.map(({ task, archivedAt, failed }) => (
          <li key={task.id} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${dark ? 'bg-slate-900/50' : 'bg-white'}`}>
            <div className="min-w-0">
              <div className={`text-sm font-semibold truncate ${dark ? 'text-slate-100' : 'text-slate-800'}`}>{task.title}</div>
              <div className={`text-xs truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                {task.assignedToName || task.assignedToEmail || 'Employee'}
              </div>
            </div>
            <SendArchiveButton
              orgId={orgId}
              taskId={task.id}
              isDarkMode={isDarkMode}
              archivedAt={archivedAt}
              failedCount={failed}
              onDone={onRefresh}
            />
          </li>
        ))}
      </ul>
      {rows.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className={`mt-2 text-xs font-semibold cursor-pointer ${dark ? 'text-teal-300' : 'text-teal-700'}`}
        >
          {showAll ? 'Show fewer' : `Show ${rows.length - VISIBLE} more`}
        </button>
      )}
    </div>
  );
}
