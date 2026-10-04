'use client';

// ============================================================================
// MultiSignerPdfForm — one document, several signers, in a configured order
//
// Phase 3, Step 3.4 (Onboarding Document System — APPROVED PLAN)
//
// Everyone who opens the document sees the same picture:
//   • the signing chain ("Employee ✓ → HR Director ⏳ → Supervisor")
//   • the current working copy, with earlier signers' answers and signatures
//     shown read-only
//   • when it's THEIR turn, only their own fields are editable
//
// Submitting calls /api/onboarding/pdf-form/sign-step, which re-checks the
// turn, the field ownership, and the signature boxes on the server. The PDF is
// only flattened + sealed after the LAST signer (locked rule).
//
// Unlike the single-signer renderer, this component does NOT call the popup's
// onSubmit — the server already recorded everything, and countersigners
// aren't the task's assignee.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  PenTool,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import type { PdfFieldWidget, PdfFormContent, PdfFormField } from '@/types/onboarding-templates';
import { getAuthHeaders } from '@/lib/api-auth-client';
import { isSignerSignatureField, signerSignatureFieldName } from '@/lib/signing-workflow';
import PdfCanvasViewer from './PdfCanvasViewer';
import PdfFieldOverlay from './PdfFieldOverlay';
import SignaturePadModal from './SignaturePadModal';
import { getMissingRequiredFields, type PdfFieldValues } from './overlayLayout';
import { buildFillFields, buildSignatureStamps, isSignatureImage, loadImageSize, signableFields } from './pdfSubmission';
import SendArchiveButton from '@/components/onboarding/SendArchiveButton';
import ReassignSignerPanel from '@/components/onboarding/ReassignSignerPanel';

interface SessionSigner {
  order: number;
  label: string;
  kind: 'employee' | 'supervisor' | 'member';
  uid: string;
  name: string;
  fieldNames: string[];
  requireSignature: boolean;
  signatureBoxes: { fieldName: string; pageIndex: number; x: number; y: number; width: number; height: number }[];
  completed: boolean;
  signedAt: string | null;
  inOrg: boolean;
}

interface SessionView {
  taskId: string;
  title: string;
  employee: { uid: string; name: string; email: string };
  content: { pdfTitle?: string; pageCount?: number; requireEsignConsent: boolean };
  status: 'draft' | 'partially_signed' | 'fully_executed' | 'archived';
  round: number;
  currentSignerOrder: number;
  signers: SessionSigner[];
  me: { order: number | null; isMyTurn: boolean; /** Phase 6.2 — server-computed read-only previews. */ autoFill?: Record<string, string> };
  priorSignatures: { order: number; imageDataUrl: string | null }[];
  lastReRequest: { notes: string; resetAt: string } | null;
  finalDocument: { downloadUrl: string; sha256Hash: string; executedAt: string } | null;
  orgId: string;
  canReassign: boolean;
  canSendArchive: boolean;
  archivedAt: string | null;
  deliveriesFailed: number;
}

interface MultiSignerPdfFormProps {
  content: PdfFormContent;
  taskId: string;
  orgId?: string;
  isDarkMode: boolean;
}

/** Key for the pad shown below the document when the signer has no on-page signature box. */
const SEPARATE_SIGNATURE_KEY = '__soltheory_separate_signature__';

export default function MultiSignerPdfForm({ content, taskId, orgId, isDarkMode }: MultiSignerPdfFormProps) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [detected, setDetected] = useState<PdfFormField[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [values, setValues] = useState<PdfFieldValues>({});
  const [typedName, setTypedName] = useState('');
  const [esignConsent, setEsignConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [isPadOpen, setIsPadOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackNotes, setSendBackNotes] = useState('');
  const [isSendingBack, setIsSendingBack] = useState(false);

  // ── Load session + working PDF + its fields ──
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const q = `taskId=${encodeURIComponent(taskId)}`;
        const [sRes, pRes, fRes] = await Promise.all([
          fetch(`/api/onboarding/pdf-form/signing-session?${q}`, { headers, cache: 'no-store' }),
          fetch(`/api/onboarding/pdf-form/task-template?${q}`, { headers, cache: 'no-store' }),
          fetch(`/api/onboarding/pdf-form/task-template?${q}&fields=1`, { headers, cache: 'no-store' }),
        ]);
        const sJson = await sRes.json();
        if (!sRes.ok) throw new Error(sJson.error || 'Could not load signing status');
        if (!pRes.ok) throw new Error('Could not load the document');
        if (!fRes.ok) throw new Error('Could not load the document fields');
        const bytes = new Uint8Array(await pRes.arrayBuffer());
        const fJson = await fRes.json();
        if (cancelled) return;
        setSession(sJson as SessionView);
        setPdfBytes(bytes);
        setDetected((fJson.fields as PdfFormField[]) || []);
        setValues({});
        setShowMissing(false);
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message || 'Could not load this document');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taskId, reloadKey]);

  // ── Derived signing state ──
  const finished = session?.status === 'fully_executed' || session?.status === 'archived';
  const isMyTurn = !!session?.me.isMyTurn && !finished;
  const mySigner = session?.signers.find((s) => s.order === session.me.order) || null;
  const currentSigner = session?.signers.find((s) => s.order === session.currentSignerOrder) || null;
  const total = session?.signers.length || 0;

  // Virtual per-signer signature boxes (from each signer's signaturePosition).
  const virtualFields = useMemo<PdfFormField[]>(() => {
    if (!session) return [];
    const out: PdfFormField[] = [];
    for (const s of session.signers) {
      for (const b of s.signatureBoxes) {
        if (!isSignerSignatureField(b.fieldName)) continue;
        const widget: PdfFieldWidget = {
          pageIndex: b.pageIndex,
          rect: [b.x, b.y, b.x + b.width, b.y + b.height],
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
        };
        out.push({ name: b.fieldName, type: 'signature', readOnly: false, required: true, tooltip: `Signature — ${s.label}`, widgets: [widget] });
      }
    }
    return out;
  }, [session]);

  const overlayFields = useMemo(() => [...detected, ...virtualFields], [detected, virtualFields]);

  const myFieldNames = useMemo(() => {
    const set = new Set<string>();
    if (!isMyTurn || !mySigner) return set;
    mySigner.fieldNames.forEach((n) => set.add(n));
    set.add(signerSignatureFieldName(mySigner.order));
    return set;
  }, [isMyTurn, mySigner]);

  // Phase 6.2 — fields the server fills automatically (date / name / email): shown, not editable.
  const autoValues = useMemo<Record<string, string>>(
    () => (isMyTurn ? session?.me.autoFill || {} : {}),
    [isMyTurn, session],
  );

  const isFieldEditable = useCallback(
    (f: PdfFormField) => myFieldNames.has(f.name) && !(f.name in autoValues),
    [myFieldNames, autoValues],
  );

  // Earlier signers' signature images, shown in their boxes.
  const priorValues = useMemo<PdfFieldValues>(() => {
    const out: PdfFieldValues = {};
    if (!session) return out;
    for (const ps of session.priorSignatures) {
      if (!ps.imageDataUrl) continue;
      const signer = session.signers.find((s) => s.order === ps.order);
      for (const b of signer?.signatureBoxes || []) out[b.fieldName] = ps.imageDataUrl;
    }
    return out;
  }, [session]);

  const displayValues = useMemo(() => ({ ...priorValues, ...values, ...autoValues }), [priorValues, values, autoValues]);

  const mySignatureFields = useMemo(
    () => signableFields(overlayFields).filter((f) => myFieldNames.has(f.name)),
    [overlayFields, myFieldNames],
  );
  const needsSeparateSignature = isMyTurn && !!mySigner?.requireSignature && mySignatureFields.length === 0;

  const setValue = useCallback(
    (name: string, value: string | boolean) => {
      setValues((prev) => {
        // One signature per signer: signing any of my boxes fills all of them.
        if (isSignatureImage(value) && mySignatureFields.some((f) => f.name === name)) {
          const next = { ...prev };
          for (const f of mySignatureFields) next[f.name] = value;
          return next;
        }
        return { ...prev, [name]: value };
      });
      setErrorMsg(null);
    },
    [mySignatureFields],
  );

  // ── Validation (only this signer's fields) ──
  const missing = useMemo(
    () => getMissingRequiredFields(overlayFields, values, (f) => !f.readOnly && isFieldEditable(f)),
    [overlayFields, values, isFieldEditable],
  );
  const problems: string[] = [];
  if (isMyTurn && mySigner) {
    const missingNonSig = missing.filter((f) => f.type !== 'signature').length;
    if (missingNonSig) problems.push(`${missingNonSig} required field${missingNonSig === 1 ? '' : 's'} (outlined in red)`);
    if (mySigner.requireSignature) {
      const signed = needsSeparateSignature
        ? isSignatureImage(values[SEPARATE_SIGNATURE_KEY])
        : mySignatureFields.length > 0 && mySignatureFields.every((f) => isSignatureImage(values[f.name]));
      if (!signed) problems.push('your signature');
      if (!typedName.trim()) problems.push('your typed legal name');
    }
    if (session?.content.requireEsignConsent && !esignConsent) problems.push('the electronic signature consent');
  }

  // ── Submit my portion ──
  const handleSubmit = async () => {
    if (!session || !mySigner || !isMyTurn || isSubmitting) return;
    if (problems.length) {
      setShowMissing(true);
      setErrorMsg(`Please complete ${problems.join(', ')}.`);
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const sizes: Record<string, { width: number; height: number }> = {};
      for (const f of mySignatureFields) {
        const img = values[f.name];
        if (isSignatureImage(img)) sizes[f.name] = await loadImageSize(img);
      }
      const stamps = buildSignatureStamps(mySignatureFields, values, sizes).map(({ pageIndex, x, y, width, height }) => ({
        pageIndex,
        x,
        y,
        width,
        height,
      }));
      const imageData =
        mySignatureFields.map((f) => values[f.name]).find(isSignatureImage) ??
        (isSignatureImage(values[SEPARATE_SIGNATURE_KEY]) ? values[SEPARATE_SIGNATURE_KEY] : '');

      const editableDetected = detected.filter((f) => myFieldNames.has(f.name));
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/pdf-form/sign-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          taskId,
          round: session.round,
          fields: buildFillFields(editableDetected, values),
          signature: imageData ? { imageData, stamps } : undefined,
          typedName,
          esignConsent,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save your signature');

      setSuccessMsg(
        result.finalDocument
          ? 'All signatures collected — the document is fully executed and sealed.'
          : result.nextSigner
            ? `Signed ✓ — sent to ${result.nextSigner.name} (${result.nextSigner.label}) for the next signature.`
            : 'Signed ✓',
      );
      setTypedName('');
      setEsignConsent(false);
      setReloadKey((k) => k + 1);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save your signature');
      // A changed round / turn means our view is stale — refresh it.
      if (/reload/i.test(err?.message || '')) setReloadKey((k) => k + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Countersigner sends it back for changes (re-request) ──
  const handleSendBack = async () => {
    if (!sendBackNotes.trim() || isSendingBack) return;
    setIsSendingBack(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/re-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ orgId, taskId, notes: sendBackNotes.trim() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not send the document back');
      setSendBackOpen(false);
      setSendBackNotes('');
      setSuccessMsg('Sent back for changes. The first signer has been notified.');
      setReloadKey((k) => k + 1);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not send the document back');
    } finally {
      setIsSendingBack(false);
    }
  };

  // ── Styles ──
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const card = isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200';
  const inputCls = `w-full max-w-md p-2 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none ${
    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
  }`;

  if (loadError) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertCircle className="w-4 h-4 shrink-0" /> {loadError}
      </div>
    );
  }
  if (!session || !pdfBytes) {
    return (
      <div className={`flex items-center justify-center gap-2 py-16 text-sm ${muted}`}>
        <Loader2 className="w-5 h-5 animate-spin" /> Loading document…
      </div>
    );
  }

  const statusLine = finished
    ? 'Fully executed'
    : isMyTurn
      ? `Your turn to sign (${session.currentSignerOrder} of ${total})`
      : `Awaiting ${currentSigner?.name || 'next signer'}${currentSigner?.label ? ` (${currentSigner.label})` : ''} · ${session.currentSignerOrder} of ${total}`;
  const canSendBack = isMyTurn && !!mySigner && mySigner.uid !== session.employee.uid;
  const separateSignature = values[SEPARATE_SIGNATURE_KEY];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={`p-4 rounded-xl border flex items-center gap-3 ${card}`}>
        <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
          <FileText className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-sm truncate">{session.content.pdfTitle || content.pdfTitle || session.title}</h4>
          <p className={`text-xs ${muted}`}>
            {statusLine}
            {session.employee.name ? ` · for ${session.employee.name}` : ''}
          </p>
        </div>
      </div>

      {/* Signing chain */}
      <ol className="flex flex-wrap items-center gap-2" aria-label="Signing order">
        {session.signers.map((s, i) => {
          const isCurrent = !finished && s.order === session.currentSignerOrder;
          const tone = s.completed
            ? isDarkMode ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : isCurrent
              ? isDarkMode ? 'bg-amber-950/30 border-amber-700/50 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
              : isDarkMode ? 'bg-slate-800/60 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500';
          return (
            <li key={s.order} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${tone}`}>
                {s.completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : isCurrent ? <Clock className="w-3.5 h-3.5" /> : <span className="w-3.5 text-center">{s.order}</span>}
                <span>
                  {s.label}
                  {s.name && s.name !== s.label ? <span className="font-normal opacity-80"> · {s.name}</span> : null}
                </span>
              </div>
              {i < session.signers.length - 1 && <span className={muted}>→</span>}
            </li>
          );
        })}
      </ol>

      {/* Phase 5: admins can hand an unsigned step to someone else (e.g. the signer left) */}
      {session.canReassign && !finished && (
        <ReassignSignerPanel
          orgId={session.orgId}
          taskId={taskId}
          employeeUid={session.employee.uid}
          signers={session.signers}
          isDarkMode={isDarkMode}
          onDone={(message) => {
            setSuccessMsg(message);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {/* Sent-back notes (latest round) */}
      {session.lastReRequest && !finished && session.status === 'draft' && (
        <div className={`p-3 rounded-xl border text-xs ${isDarkMode ? 'bg-rose-950/30 border-rose-800/50 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          <span className="font-bold">Sent back for changes:</span> {session.lastReRequest.notes}
        </div>
      )}

      {successMsg && (
        <div className={`p-3 rounded-xl border flex items-center gap-2 text-sm font-semibold ${isDarkMode ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {successMsg}
        </div>
      )}

      {/* Fully executed */}
      {session.finalDocument && (
        <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${isDarkMode ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-sm">Fully Executed &amp; Sealed ✓</div>
              <div className="text-[11px] opacity-80 font-mono truncate">SHA-256: {session.finalDocument.sha256Hash}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {session.canSendArchive ? (
              <SendArchiveButton
                orgId={session.orgId}
                taskId={taskId}
                isDarkMode={isDarkMode}
                archivedAt={session.status === 'archived' ? session.archivedAt || 'archived' : null}
                failedCount={session.deliveriesFailed}
                onDone={() => setReloadKey((k) => k + 1)}
              />
            ) : (
              <span
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${isDarkMode ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500'}`}
              >
                {session.status === 'archived' ? 'Sent & archived' : 'Waiting for an admin to send & archive'}
              </span>
            )}
            <a
              href={session.finalDocument.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Download
            </a>
          </div>
        </div>
      )}

      {/* The document */}
      <PdfCanvasViewer
        pdfBytes={pdfBytes}
        isDarkMode={isDarkMode}
        mode="continuous"
        hideFormWidgets
        showDownload={false}
        maxHeight="70vh"
        renderPageOverlay={(metrics) => (
          <PdfFieldOverlay
            metrics={metrics}
            fields={overlayFields}
            values={displayValues}
            onChange={setValue}
            disabled={!isMyTurn || isSubmitting}
            isFieldEditable={isFieldEditable}
            highlightMissing={showMissing}
            isDarkMode={isDarkMode}
          />
        )}
      />

      {isMyTurn && mySigner && (
        <>
          {needsSeparateSignature && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Electronic Signature</h5>
              <button
                type="button"
                onClick={() => setIsPadOpen(true)}
                disabled={isSubmitting}
                className={`w-full max-w-md h-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-white overflow-hidden disabled:cursor-not-allowed ${
                  showMissing && !isSignatureImage(separateSignature) ? 'border-red-500/70' : 'border-slate-300'
                }`}
              >
                {isSignatureImage(separateSignature) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={separateSignature} alt="Your signature" className="max-h-20 max-w-full object-contain" />
                ) : (
                  <span className="flex items-center gap-2 text-sm font-semibold text-blue-700"><PenTool className="w-4 h-4" /> Tap to sign</span>
                )}
              </button>
              <SignaturePadModal
                open={isPadOpen}
                isDarkMode={isDarkMode}
                defaultName={typedName}
                onCancel={() => setIsPadOpen(false)}
                onApply={(dataUrl) => {
                  setValue(SEPARATE_SIGNATURE_KEY, dataUrl);
                  setIsPadOpen(false);
                }}
              />
            </div>
          )}

          {mySigner.requireSignature && (
            <div className="space-y-1">
              <label className="block text-xs font-semibold">
                Type Full Legal Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isSubmitting}
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className={`${inputCls} ${showMissing && !typedName.trim() ? '!border-red-500' : ''}`}
              />
            </div>
          )}

          {session.content.requireEsignConsent && (
            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-indigo-950/30 border-indigo-800/40' : 'bg-indigo-50/70 border-indigo-200/80'} ${showMissing && !esignConsent ? '!border-red-500' : ''}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isSubmitting}
                  checked={esignConsent}
                  onChange={(e) => setEsignConsent(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className={`text-xs font-medium ${isDarkMode ? 'text-indigo-200' : 'text-indigo-900'}`}>
                  I agree to conduct business electronically and understand that my digital signature is legally binding under the ESIGN Act (15 U.S.C. § 7001 et seq.).
                </span>
              </label>
            </div>
          )}
        </>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Send back (countersigners only) */}
      {canSendBack && sendBackOpen && (
        <div className={`p-4 rounded-xl border space-y-2 ${card}`}>
          <label className="block text-xs font-semibold">What needs to change?</label>
          <textarea
            value={sendBackNotes}
            onChange={(e) => setSendBackNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Please correct the address in Step 1."
            className={`${inputCls} max-w-none resize-none`}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setSendBackOpen(false)} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${muted}`}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSendBack}
              disabled={!sendBackNotes.trim() || isSendingBack}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
            >
              {isSendingBack ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Send back
            </button>
          </div>
        </div>
      )}

      {/* Action bar */}
      {isMyTurn && mySigner && (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
          {canSendBack && !sendBackOpen ? (
            <button
              type="button"
              onClick={() => setSendBackOpen(true)}
              className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
            >
              <RotateCcw className="w-4 h-4" /> Send back for changes
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-3 sm:py-2.5 rounded-xl font-bold text-white transition-all shadow-sm ${
              isSubmitting ? 'bg-indigo-400 opacity-50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving your signature…
              </>
            ) : (
              <>
                <PenTool className="w-4 h-4" />
                {session.currentSignerOrder === total ? 'Sign & Finalize Document' : 'Sign & Send to Next Signer'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
