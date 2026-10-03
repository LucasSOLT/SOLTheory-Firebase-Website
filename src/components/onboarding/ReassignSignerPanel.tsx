'use client';

// ============================================================================
// ReassignSignerPanel — admin-only: hand an unsigned signing step to someone else
//
// Phase 5, Step 5.1 (Onboarding Document System — APPROVED PLAN)
//
// Shown inside the multi-party signing view to org admins. Lists the signers who
// have NOT signed yet (the employee's own step and signed steps can't move),
// flags anyone who is no longer in the organization, and lets the admin choose
// a current org member to take over. The server re-validates everything.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { AlertTriangle, Loader2, UserCog } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { getAuthHeaders } from '@/lib/api-auth-client';

export interface ReassignableSigner {
  order: number;
  label: string;
  name: string;
  uid: string;
  kind: 'employee' | 'supervisor' | 'member';
  completed: boolean;
  inOrg: boolean;
}

interface Props {
  orgId: string;
  taskId: string;
  employeeUid: string;
  signers: ReassignableSigner[];
  isDarkMode: boolean;
  onDone: (message: string) => void;
}

interface OrgMember {
  uid: string;
  email: string;
  displayName: string;
}

export default function ReassignSignerPanel({ orgId, taskId, employeeUid, signers, isDarkMode, onDone }: Props) {
  const firestore = useFirestore();
  const movable = signers.filter((s) => !s.completed && s.kind !== 'employee' && s.uid !== employeeUid);
  const [openOrder, setOpenOrder] = useState<number | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load org members only while a picker is open.
  useEffect(() => {
    if (openOrder === null || !firestore || !orgId) return;
    const unsub = onSnapshot(
      query(collection(firestore, `orgs/${orgId}/members`)),
      (snap) =>
        setMembers(
          snap.docs
            .map((d) => {
              const data = d.data();
              return { uid: d.id, email: String(data.email || ''), displayName: String(data.displayName || '') };
            })
            .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email)),
        ),
      (err) => console.error('[ReassignSignerPanel] Members fetch error:', err),
    );
    return () => unsub();
  }, [openOrder, firestore, orgId]);

  if (movable.length === 0) return null;

  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const card = isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200';
  const selectCls = `w-full p-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500 ${
    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
  }`;
  const hasProblem = movable.some((s) => !s.inOrg);

  const submit = async (order: number) => {
    if (!choice || busy) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/pdf-form/reassign-signer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ orgId, taskId, order, memberUid: choice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reassign the signer');
      setOpenOrder(null);
      setChoice('');
      onDone(
        data.isCurrent
          ? `Reassigned to ${data.signer?.name || 'the new signer'} — they've been notified that it's their turn.`
          : `Reassigned to ${data.signer?.name || 'the new signer'}.`,
      );
    } catch (err: any) {
      setError(err?.message || 'Could not reassign the signer');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`p-3 rounded-xl border space-y-2 ${hasProblem ? (isDarkMode ? 'bg-amber-950/20 border-amber-700/50' : 'bg-amber-50 border-amber-200') : card}`}>
      <div className="flex items-center gap-2 text-xs font-bold">
        <UserCog className="w-4 h-4 text-indigo-500" /> Change who signs <span className={`font-normal ${muted}`}>(admins only)</span>
      </div>
      {movable.map((s) => (
        <div key={s.order} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <span className="font-semibold">Step {s.order}: {s.label}</span>
              <span className={muted}> · {s.name}</span>
              {!s.inOrg && (
                <span className="ml-2 inline-flex items-center gap-1 font-bold text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" /> no longer in this organization
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setOpenOrder(openOrder === s.order ? null : s.order);
                setChoice('');
                setError(null);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold border ${isDarkMode ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-300 hover:bg-slate-100'}`}
            >
              {openOrder === s.order ? 'Cancel' : 'Reassign'}
            </button>
          </div>
          {openOrder === s.order && (
            <div className="space-y-2">
              <select value={choice} onChange={(e) => setChoice(e.target.value)} className={selectCls} aria-label="New signer">
                <option value="">Choose a current member…</option>
                {members
                  .filter((m) => m.uid !== s.uid && m.uid !== employeeUid)
                  .map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.displayName ? `${m.displayName} (${m.email})` : m.email}
                    </option>
                  ))}
              </select>
              <div className="flex items-center justify-end gap-2">
                {error && <span className="text-xs font-semibold text-rose-600 mr-auto">{error}</span>}
                <button
                  type="button"
                  onClick={() => submit(s.order)}
                  disabled={!choice || busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirm reassignment
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
