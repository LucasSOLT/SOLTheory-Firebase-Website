'use client';

// ============================================================================
// StuckDocumentsPanel — Phase 6.5 (Onboarding Document System, APPROVED PLAN)
//
// Admin-only. Lists every multi-signer document that is waiting on someone,
// worst first, with how long it has waited and what the automatic reminders
// have done. Two actions: "Nudge now" (remind the signer immediately) and
// "Change who signs" (hand their step to someone else — same panel used inside
// the document itself). Renders nothing when nothing is waiting.
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BellRing, ChevronDown, ChevronRight, Hourglass, Loader2, UserCog } from 'lucide-react';
import { getAuthHeaders } from '@/lib/api-auth-client';
import ReassignSignerPanel from '@/components/onboarding/ReassignSignerPanel';
import type { StuckDocument, StuckLevel } from '@/lib/onboarding-stuck';

interface Props {
  orgId: string;
  isDarkMode: boolean;
  /** Bump to force a reload (e.g. after the page refreshes its data). */
  refreshKey?: number;
}

interface Policy {
  firstReminderDays: number;
  repeatDays: number;
  maxReminders: number;
  escalateDays: number;
}

const LEVEL_LABEL: Record<StuckLevel, string> = {
  signer_left: 'Signer left',
  stuck: 'Stuck',
  waiting: 'Waiting',
  on_track: 'On track',
};

function ago(ms: number): string {
  if (!ms) return 'never';
  const d = Math.floor((Date.now() - ms) / 86_400_000);
  if (d <= 0) return 'today';
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export default function StuckDocumentsPanel({ orgId, isDarkMode, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<StuckDocument[] | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [open, setOpen] = useState(true);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [reassignTask, setReassignTask] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('onboarding_stuck_docs_panel_open');
      if (stored !== null) setOpen(stored === 'true');
    } catch {
      // ignore
    }
  }, []);

  const toggleOpen = () => {
    setOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('onboarding_stuck_docs_panel_open', String(next));
      } catch {}
      return next;
    });
  };

  const load = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/onboarding/stuck-documents?orgId=${encodeURIComponent(orgId)}`, { headers });
      if (!res.ok) {
        setItems([]); // non-admins / errors: stay quiet rather than break the page
        return;
      }
      const data = await res.json();
      setItems(data.items || []);
      setPolicy(data.policy || null);
    } catch {
      setItems([]);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const nudge = async (d: StuckDocument) => {
    setBusyTask(d.taskId);
    setNote(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/stuck-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ orgId, taskId: d.taskId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send the nudge');
      setNote({
        ok: !!data.ok,
        text: data.ok
          ? `Nudge sent to ${data.signerName || d.waitingOn.name}.`
          : `The nudge could not be delivered to ${d.waitingOn.name}. Try again in a moment.`,
      });
      await load();
    } catch (e: any) {
      setNote({ ok: false, text: e.message || 'Could not send the nudge' });
    } finally {
      setBusyTask(null);
    }
  };

  if (!items || items.length === 0) return null;

  const stuckCount = items.filter((i) => i.level === 'stuck' || i.level === 'signer_left').length;
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const shell = isDarkMode ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/80 border-slate-200/80 shadow-sm';
  const badge = (l: StuckLevel) => {
    if (l === 'signer_left' || l === 'stuck')
      return isDarkMode ? 'bg-rose-950/50 text-rose-300 border-rose-800/60' : 'bg-rose-50 text-rose-700 border-rose-200';
    if (l === 'waiting')
      return isDarkMode ? 'bg-amber-950/40 text-amber-300 border-amber-800/50' : 'bg-amber-50 text-amber-700 border-amber-200';
    return isDarkMode ? 'bg-slate-700/40 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div className={`rounded-2xl border ${shell}`}>
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full px-5 py-3.5 flex items-center gap-3 text-left cursor-pointer"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stuckCount ? (isDarkMode ? 'bg-rose-900/40 text-rose-300' : 'bg-rose-100 text-rose-600') : (isDarkMode ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-100 text-amber-600')}`}>
          {stuckCount ? <AlertTriangle className="w-4 h-4" /> : <Hourglass className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">Documents waiting on a signature ({items.length})</div>
          <div className={`text-xs ${muted}`}>
            {stuckCount ? `${stuckCount} need${stuckCount === 1 ? 's' : ''} your attention. ` : ''}
            {policy
              ? `Signers are reminded after ${policy.firstReminderDays} days, then every ${policy.repeatDays} days (up to ${policy.maxReminders}); supervisors are told at ${policy.escalateDays} days.`
              : ''}
          </div>
        </div>
        {open ? <ChevronDown className={`w-5 h-5 ${muted}`} /> : <ChevronRight className={`w-5 h-5 ${muted}`} />}
      </button>

      {open && (
        <div className={`border-t px-5 py-3 space-y-2.5 ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200/70'}`}>
          {note && (
            <div
              className={`text-xs font-semibold rounded-lg px-3 py-2 ${
                note.ok
                  ? isDarkMode ? 'bg-emerald-950/40 text-emerald-300' : 'bg-emerald-50 text-emerald-800'
                  : isDarkMode ? 'bg-rose-950/40 text-rose-300' : 'bg-rose-50 text-rose-800'
              }`}
            >
              {note.text}
            </div>
          )}

          {items.map((d) => (
            <div key={d.taskId} className={`rounded-xl border p-3 space-y-2 ${isDarkMode ? 'border-slate-700/60' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-start gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badge(d.level)}`}>
                  {LEVEL_LABEL[d.level]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{d.title}</div>
                  <div className={`text-xs ${muted}`}>
                    {d.employeeName} · {d.signedCount} of {d.totalSigners} signed
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={!d.canNudge || busyTask === d.taskId}
                    onClick={() => nudge(d)}
                    title={d.canNudge ? 'Remind the signer right now' : 'This person is no longer in the organization'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
                  >
                    {busyTask === d.taskId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
                    Nudge now
                  </button>
                  {d.signers.some((s) => !s.completed && s.kind !== 'employee') && (
                    <button
                      type="button"
                      onClick={() => setReassignTask(reassignTask === d.taskId ? null : d.taskId)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${isDarkMode ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-300 hover:bg-slate-100'}`}
                    >
                      <UserCog className="w-3.5 h-3.5" />
                      Change who signs
                    </button>
                  )}
                </div>
              </div>

              <div className={`text-xs ${muted}`}>
                Waiting on <span className="font-semibold">{d.waitingOn.name}</span>
                {d.waitingOn.label ? ` (${d.waitingOn.label})` : ''} for{' '}
                <span className="font-semibold">{d.waitedDays} day{d.waitedDays === 1 ? '' : 's'}</span>
                {!d.waitingOn.inOrg && <span className="ml-1 font-bold text-rose-500"> — no longer in this organization</span>}
                <br />
                Auto-reminders sent: {d.remindersSent}
                {policy ? ` of ${policy.maxReminders}` : ''} · last {ago(d.lastReminderAt)}
                {d.lastNudgeAt ? ` · last manual nudge ${ago(d.lastNudgeAt)}` : ''}
                {d.escalatedAt ? ' · supervisor notified' : ''}
              </div>

              {reassignTask === d.taskId && (
                <ReassignSignerPanel
                  orgId={orgId}
                  taskId={d.taskId}
                  employeeUid={d.employeeUid}
                  signers={d.signers}
                  isDarkMode={isDarkMode}
                  onDone={(message) => {
                    setReassignTask(null);
                    setNote({ ok: true, text: message });
                    void load();
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
