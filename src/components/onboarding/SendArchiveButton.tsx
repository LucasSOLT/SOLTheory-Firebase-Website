'use client';

// ============================================================================
// SendArchiveButton — Phase 4, Step 4.1 (Onboarding Document System)
//
// Manual "Send & Archive" for a fully signed document. Opens a confirm dialog
// that lists exactly who will receive the sealed PDF (the server decides the
// recipients — nothing here can add an address), then shows a per-recipient
// result and a "Resend to failed" action. Nothing is ever sent automatically.
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Mail, RefreshCw, X, XCircle } from 'lucide-react';
import { getAuthHeaders } from '@/lib/api-auth-client';

interface Recipient { email: string; name: string; role: string }
interface Delivery { email: string; name: string; role: string; status: 'sent' | 'failed'; error?: string; attempts?: number }
interface Preview {
  title: string;
  employeeName: string;
  kind: 'multi' | 'single';
  ready: boolean;
  archived: boolean;
  notReadyReason: string | null;
  archivedAt: string | null;
  recipients: Recipient[];
  deliveries: Delivery[];
}

interface Props {
  orgId: string;
  taskId: string;
  isDarkMode: boolean;
  /** Already archived? Shows "Archived" (with a Resend hint if some emails failed). */
  archivedAt?: string | null;
  failedCount?: number;
  /** Called after a successful send/resend so the parent can refresh its data. */
  onDone?: () => void;
  compact?: boolean;
}

const ROLE_LABEL: Record<string, string> = { employee: 'Employee', signer: 'Signer', supervisor: 'Supervisor' };

export default function SendArchiveButton({ orgId, taskId, isDarkMode, archivedAt, failedCount = 0, onDone, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<null | 'send' | 'resend_failed'>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Delivery[] | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/onboarding/send-archive?orgId=${encodeURIComponent(orgId)}&taskId=${encodeURIComponent(taskId)}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load this document.');
      setPreview(data as Preview);
    } catch (e: any) {
      setError(e?.message || 'Could not load this document.');
    } finally {
      setLoading(false);
    }
  }, [orgId, taskId]);

  useEffect(() => {
    if (open) {
      setResult(null);
      setDone(false);
      load();
    }
  }, [open, load]);

  const run = async (mode: 'send' | 'resend_failed') => {
    setBusy(mode);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/send-archive', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, taskId, mode }),
      });
      const data = await res.json();
      if (Array.isArray(data.deliveries)) setResult(data.deliveries as Delivery[]);
      if (!res.ok) {
        // 409 "already archived" is not a failure — refresh to show the final state.
        if (data.alreadyArchived) await load();
        throw new Error(data.error || 'Sending failed.');
      }
      setDone(true);
      await load();
      onDone?.();
    } catch (e: any) {
      setError(e?.message || 'Sending failed.');
    } finally {
      setBusy(null);
    }
  };

  const dark = isDarkMode;
  const panel = dark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900';
  const muted = dark ? 'text-slate-400' : 'text-slate-500';
  const deliveries = result || preview?.deliveries || [];
  const failed = deliveries.filter((d) => d.status === 'failed');
  const isArchived = !!(preview?.archived || archivedAt);

  const triggerClasses = archivedAt
    ? dark
      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-teal-600 hover:bg-teal-500 text-white border-teal-600';

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title={archivedAt ? (failedCount > 0 ? `${failedCount} email(s) failed — open to resend` : 'Archived — view delivery details') : 'Email the sealed PDF to everyone who signed and archive it'}
        className={`shrink-0 inline-flex items-center gap-1.5 font-bold rounded-md border cursor-pointer transition-colors ${compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1.5'} ${triggerClasses}`}
      >
        <Mail className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {archivedAt ? (failedCount > 0 ? `Archived · ${failedCount} failed` : 'Archived') : 'Send & Archive'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60"
          onClick={(e) => { e.stopPropagation(); if (!busy) setOpen(false); }}
        >
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl p-5 ${panel}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-bold">{isArchived ? 'Archived document' : 'Send & Archive'}</h3>
                {preview && <p className={`text-xs mt-0.5 ${muted}`}>{preview.title} · {preview.employeeName}</p>}
              </div>
              <button type="button" disabled={!!busy} onClick={() => setOpen(false)} className={`p-1 rounded-lg cursor-pointer ${dark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {loading && !preview && (
              <div className="flex items-center gap-2 py-6 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            )}

            {preview && !isArchived && !done && (
              <>
                {!preview.ready ? (
                  <div className="flex gap-2 text-sm p-3 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/30">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{preview.notReadyReason || 'This document is not ready to send yet.'}</span>
                  </div>
                ) : (
                  <>
                    <p className={`text-sm mb-3 ${muted}`}>
                      The final sealed PDF will be emailed to the {preview.recipients.length} {preview.recipients.length === 1 ? 'person' : 'people'} below.
                      The document is then <strong>locked</strong> and can no longer be sent back for changes.
                    </p>
                    <ul className={`rounded-xl border divide-y mb-4 ${dark ? 'border-slate-700 divide-slate-700' : 'border-slate-200 divide-slate-200'}`}>
                      {preview.recipients.map((r) => (
                        <li key={r.email} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <span className="min-w-0">
                            <span className="font-semibold block truncate">{r.name}</span>
                            <span className={`text-xs block truncate ${muted}`}>{r.email}</span>
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}>{ROLE_LABEL[r.role] || r.role}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}

            {(isArchived || done) && preview && (
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-500 mb-3">
                <CheckCircle2 className="w-4 h-4" />
                {preview.archivedAt ? `Archived ${new Date(preview.archivedAt).toLocaleString()}` : 'Archived'}
              </div>
            )}

            {(isArchived || done || (result && result.length > 0)) && deliveries.length > 0 && (
              <ul className={`rounded-xl border divide-y mb-3 ${dark ? 'border-slate-700 divide-slate-700' : 'border-slate-200 divide-slate-200'}`}>
                {deliveries.map((d) => (
                  <li key={d.email} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold block truncate">{d.name}</span>
                      <span className={`text-xs block truncate ${muted}`}>{d.email}</span>
                      {d.status === 'failed' && d.error && <span className="text-[11px] text-red-500 block">{d.error}</span>}
                    </span>
                    {d.status === 'sent'
                      ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /> Sent</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500 shrink-0"><XCircle className="w-3.5 h-3.5" /> Failed</span>}
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <div className="flex gap-2 text-sm p-3 rounded-lg bg-red-500/10 text-red-500 border border-red-500/30 mb-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <button type="button" disabled={!!busy} onClick={() => setOpen(false)} className={`px-3 py-2 text-sm font-semibold rounded-lg cursor-pointer ${dark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
                {isArchived || done ? 'Close' : 'Cancel'}
              </button>
              {preview && !isArchived && !done && preview.ready && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => run('send')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-60 cursor-pointer"
                >
                  {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {busy === 'send' ? 'Sending…' : 'Send & Archive'}
                </button>
              )}
              {(isArchived || done) && failed.length > 0 && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => run('resend_failed')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-60 cursor-pointer"
                >
                  {busy === 'resend_failed' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Resend to {failed.length} failed
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
