'use client';

// ============================================================================
// AwaitingSignaturePanel — "Documents awaiting your signature"
//
// Phase 3, Step 3.4 (Onboarding Document System — APPROVED PLAN)
//
// Lists onboarding PDF documents where the signed-in user is the CURRENT
// signer (read from the display-only `metadata.signing` mirror on the parent
// task). Opening one shows the same item popup the employee uses; the
// multi-signer form inside it lets this person sign their portion.
//
// The employee's own documents are excluded — they already appear in their
// roadmap. The server (sign-step) is always the authority on whose turn it is.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Clock, PenTool } from 'lucide-react';
import { useFirestore } from '@/firebase';
import type { TaskSigningMirror } from '@/types/onboarding-templates';

export interface AwaitingSignatureTask {
  id: string;
  title: string;
  assignedTo: string;
  assignedToName?: string;
  assignedToEmail?: string;
  column: string;
  metadata?: { signing?: TaskSigningMirror; [key: string]: any };
  [key: string]: any;
}

interface Props {
  orgId: string;
  uid: string;
  isDarkMode: boolean;
  onOpen: (task: AwaitingSignatureTask) => void;
}

export default function AwaitingSignaturePanel({ orgId, uid, isDarkMode, onOpen }: Props) {
  const firestore = useFirestore();
  const [tasks, setTasks] = useState<AwaitingSignatureTask[]>([]);

  useEffect(() => {
    if (!firestore || !orgId || !uid) return;
    // Equality-only filters → no composite index needed.
    const q = query(
      collection(firestore, 'action_board_tasks'),
      where('orgId', '==', orgId),
      where('metadata.signing.currentSignerUid', '==', uid),
    );
    const unsub = onSnapshot(
      q,
      (snap) =>
        setTasks(
          snap.docs
            .map((d) => ({ ...d.data(), id: d.id }) as AwaitingSignatureTask)
            .filter((t) => t.assignedTo !== uid && t.category === 'onboarding' && !t.isArchived),
        ),
      (err) => console.warn('[AwaitingSignaturePanel] query failed:', err),
    );
    return () => unsub();
  }, [firestore, orgId, uid]);

  if (tasks.length === 0) return null;

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-amber-950/20 border-amber-800/40' : 'bg-amber-50/70 border-amber-200 shadow-sm'}`}>
      <div className={`px-5 py-3 border-b flex items-center gap-2 ${isDarkMode ? 'border-amber-800/40' : 'border-amber-200/80'}`}>
        <PenTool className={`w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
        <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Documents awaiting your signature</h3>
        <span className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${isDarkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
          {tasks.length}
        </span>
      </div>
      <div className="divide-y divide-amber-200/60 dark:divide-amber-800/30">
        {tasks.map((t) => {
          const s = t.metadata?.signing;
          return (
            <div key={t.id} className="flex items-center gap-3 px-5 py-3">
              <Clock className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.title}</div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  For {t.assignedToName || t.assignedToEmail || 'an employee'}
                  {s ? ` · signer ${s.currentSignerOrder} of ${s.totalSigners}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpen(t)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shrink-0"
              >
                <PenTool className="w-3.5 h-3.5" /> Open &amp; sign
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
