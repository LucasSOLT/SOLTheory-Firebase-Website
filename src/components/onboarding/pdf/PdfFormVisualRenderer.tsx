'use client';

// ============================================================================
// PdfFormVisualRenderer — employee fills a PDF directly on the document
//
// Phase 2, Step 2.4 (Onboarding Document System — APPROVED PLAN, Option A)
//
// Replaces the HTML form grid when the PDF has field geometry. Rendering:
// PdfCanvasViewer (2.1) + field geometry (2.2) + PdfFieldOverlay (2.3).
// Submission goes through the existing /api/onboarding/pdf-form/process route
// (fill → stamp signatures → flatten → SHA-256 seal → vault) unchanged.
// ============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, FileText, Loader2, PenTool, ShieldCheck } from 'lucide-react';
import type { PdfFormContent, PdfFormField } from '@/types/onboarding-templates';
import { getAuthHeaders } from '@/lib/api-auth-client';
import PdfCanvasViewer from './PdfCanvasViewer';
import PdfFieldOverlay from './PdfFieldOverlay';
import SignaturePadModal from './SignaturePadModal';
import { getMissingRequiredFields, type PdfFieldValues } from './overlayLayout';
import {
  VIRTUAL_SIGNATURE_FIELD,
  buildFillFields,
  buildOverlayFields,
  buildSignatureStamps,
  isSignatureImage,
  loadImageSize,
  signableFields,
} from './pdfSubmission';

interface PdfFormVisualRendererProps {
  content: PdfFormContent;
  /** Fields with widget geometry (saved on the task, or re-detected by the server). */
  fields: PdfFormField[];
  pdfBytes?: Uint8Array;
  fileUrl?: string;
  onSubmit: (data: any) => void;
  isDarkMode: boolean;
  disabled?: boolean;
  existingResponse?: any;
  orgId?: string;
  taskId?: string;
}

export default function PdfFormVisualRenderer({
  content,
  fields,
  pdfBytes,
  fileUrl,
  onSubmit,
  isDarkMode,
  disabled,
  existingResponse,
  orgId,
  taskId,
}: PdfFormVisualRendererProps) {
  const [values, setValues] = useState<PdfFieldValues>(() => existingResponse?.fieldValues || {});
  const [typedName, setTypedName] = useState<string>(existingResponse?.typedName || '');
  const [esignConsent, setEsignConsent] = useState<boolean>(existingResponse?.esignConsent ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [isPadOpen, setIsPadOpen] = useState(false);
  const [processResult, setProcessResult] = useState<{ downloadUrl?: string; sha256Hash?: string } | null>(
    existingResponse?.downloadUrl ? { downloadUrl: existingResponse.downloadUrl, sha256Hash: existingResponse.sha256Hash } : null,
  );

  const overlayFields = useMemo(() => buildOverlayFields(content, fields), [content, fields]);
  const signatureFields = useMemo(() => signableFields(overlayFields), [overlayFields]);
  // No on-page place to sign (no signature field, no admin-set position): keep a pad below the document.
  const needsSeparateSignature = !!content.requireSignature && signatureFields.length === 0;

  const locked = !!disabled || isSubmitting || !!processResult?.downloadUrl;
  const pageCount = content.pageCount || 0;

  const setValue = useCallback((name: string, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrorMsg(null);
  }, []);

  // ── Validation ──
  const missingFields = useMemo(() => getMissingRequiredFields(overlayFields, values), [overlayFields, values]);
  const unsignedCount = useMemo(() => {
    if (!content.requireSignature) return 0;
    if (needsSeparateSignature) return isSignatureImage(values[VIRTUAL_SIGNATURE_FIELD]) ? 0 : 1;
    return signatureFields.filter((f) => !isSignatureImage(values[f.name])).length;
  }, [content.requireSignature, needsSeparateSignature, signatureFields, values]);

  const problems: string[] = [];
  const missingNonSignature = missingFields.filter((f) => f.type !== 'signature').length;
  if (missingNonSignature) problems.push(`${missingNonSignature} required field${missingNonSignature === 1 ? '' : 's'} (outlined in red)`);
  if (unsignedCount) problems.push(unsignedCount === 1 ? 'your signature' : `${unsignedCount} signatures`);
  if (content.requireSignature && !typedName.trim()) problems.push('your typed legal name');
  if (content.requireEsignConsent && !esignConsent) problems.push('the electronic signature consent');

  // ── Submit ──
  const handleSubmit = async () => {
    if (locked) return;
    if (problems.length) {
      setShowMissing(true);
      setErrorMsg(`Please complete ${problems.join(', ')}.`);
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Signature image sizes are needed to fit each stamp inside its box without distortion.
      const imageSizes: Record<string, { width: number; height: number }> = {};
      for (const f of signatureFields) {
        const img = values[f.name];
        if (isSignatureImage(img)) imageSizes[f.name] = await loadImageSize(img);
      }
      const signatures = buildSignatureStamps(overlayFields, values, imageSizes);
      const signatureData = signatureFields.map((f) => values[f.name]).find(isSignatureImage)
        ?? (isSignatureImage(values[VIRTUAL_SIGNATURE_FIELD]) ? values[VIRTUAL_SIGNATURE_FIELD] : '');

      let result: any = null;
      if (orgId && taskId) {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/onboarding/pdf-form/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            orgId,
            taskId,
            pdfSourceStoragePath: content.pdfStoragePath,
            pdfSourceUrl: content.pdfDownloadUrl,
            fields: buildFillFields(fields, values),
            signatures: signatures.length ? signatures : undefined,
            signerName: typedName || 'Signer',
            documentCategory: content.documentCategory || 'fillable_pdf',
          }),
        });
        result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to process PDF form');
        setProcessResult(result);
      }

      onSubmit({
        type: 'pdf_form_fill',
        fieldValues: values,
        typedName,
        signatureData,
        esignConsent,
        submittedAt: new Date().toISOString(),
        downloadUrl: result?.downloadUrl,
        sha256Hash: result?.sha256Hash,
        renderMode: 'visual',
      });
    } catch (err: any) {
      console.error('[PdfFormVisualRenderer] Submit error:', err);
      setErrorMsg(err?.message || 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Styles (matches the existing PdfFormRenderer look) ──
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const inputCls = `w-full max-w-md p-2 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none ${
    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
  }`;
  const separateSignature = values[VIRTUAL_SIGNATURE_FIELD];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate">{content.pdfTitle || 'Fillable PDF Form'}</h4>
            <p className={`text-xs ${muted}`}>
              {locked && processResult?.downloadUrl ? 'Submitted' : 'Fill in the highlighted boxes directly on the document'}
              {pageCount ? ` • ${pageCount} page${pageCount !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Sealed result */}
      {processResult?.downloadUrl && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${isDarkMode ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-sm">PDF Form Flattened &amp; Sealed ✓</div>
              {processResult.sha256Hash && (
                <div className="text-[11px] opacity-80 font-mono truncate">SHA-256: {processResult.sha256Hash}</div>
              )}
            </div>
          </div>
          <a
            href={processResult.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Download
          </a>
        </div>
      )}

      {/* The document */}
      <PdfCanvasViewer
        pdfBytes={pdfBytes}
        fileUrl={pdfBytes ? undefined : fileUrl}
        isDarkMode={isDarkMode}
        mode="continuous"
        hideFormWidgets
        showDownload={false}
        maxHeight="70vh"
        renderPageOverlay={(metrics) => (
          <PdfFieldOverlay
            metrics={metrics}
            fields={overlayFields}
            values={values}
            onChange={setValue}
            disabled={locked}
            highlightMissing={showMissing}
            isDarkMode={isDarkMode}
          />
        )}
      />

      {/* Fallback signature (only when the PDF has no on-page place to sign) */}
      {needsSeparateSignature && (
        <div className="space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Electronic Signature</h5>
          <button
            type="button"
            onClick={() => setIsPadOpen(true)}
            disabled={locked}
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
            onCancel={() => setIsPadOpen(false)}
            onApply={(dataUrl) => {
              setValue(VIRTUAL_SIGNATURE_FIELD, dataUrl);
              setIsPadOpen(false);
            }}
          />
        </div>
      )}

      {/* Typed legal name */}
      {content.requireSignature && (
        <div className="space-y-1">
          <label className="block text-xs font-semibold">
            Type Full Legal Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            disabled={locked}
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="e.g. Jane Doe"
            className={`${inputCls} ${showMissing && !typedName.trim() ? '!border-red-500' : ''}`}
          />
        </div>
      )}

      {/* ESIGN Act consent */}
      {content.requireEsignConsent && (
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-indigo-950/30 border-indigo-800/40' : 'bg-indigo-50/70 border-indigo-200/80'} ${showMissing && !esignConsent ? '!border-red-500' : ''}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              disabled={locked}
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

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Action bar */}
      {!processResult?.downloadUrl && (
        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleSubmit}
            disabled={locked}
            className={`w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-3 sm:py-2.5 rounded-xl font-bold text-white transition-all shadow-sm ${
              locked ? 'bg-indigo-400 opacity-50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Flattening &amp; Sealing PDF...
              </>
            ) : (
              <>
                <PenTool className="w-4 h-4" /> Submit &amp; Sign PDF Form
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
