'use client';

// ============================================================================
// PdfUploadFallback — "this PDF can't be filled in online" → upload mode
//
// Phase 5, Step 5.1 (Onboarding Document System — APPROVED PLAN)
//
// A fillable-PDF item whose PDF has NO AcroForm fields (e.g. a scanned or
// flattened form) gives the employee nothing to type into. Instead of showing
// an empty form, we fall back to the existing, proven upload flow:
//   download → complete & sign by hand → upload the signed copy
// The file goes through /api/onboarding/vault/upload (attached to this task,
// status "pending_review"); an admin verifies it in the Vault, which completes
// the task — exactly like a normal Document Upload item.
// ============================================================================

import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, FileText, Loader2, Upload } from 'lucide-react';
import type { PdfFormContent } from '@/types/onboarding-templates';
import { getAuthHeaders } from '@/lib/api-auth-client';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';

interface PdfUploadFallbackProps {
  content: PdfFormContent;
  orgId: string;
  taskId: string;
  isDarkMode: boolean;
  disabled?: boolean;
}

export default function PdfUploadFallback({ content, orgId, taskId, isDarkMode, disabled }: PdfUploadFallbackProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const card = isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200';

  const handleFile = async (file: File | undefined) => {
    if (!file || busy || disabled) return;
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('That file is larger than 25 MB. Please upload a smaller scan.');
      return;
    }
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      const form = new FormData();
      form.append('file', file);
      form.append('orgId', orgId);
      form.append('documentCategory', content.documentCategory || 'other');
      form.append('taskId', taskId);
      // Do not set Content-Type: the browser adds the multipart boundary.
      const res = await fetch('/api/onboarding/vault/upload', {
        method: 'POST',
        headers: { Authorization: headers.Authorization || '' },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed. Please try again.');
      setUploadedName(file.name);
    } catch (err: any) {
      setError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${card}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate">{content.pdfTitle || 'PDF Form'}</h4>
            <p className={`text-xs ${muted}`}>This document can&apos;t be filled in online</p>
          </div>
        </div>
        {content.pdfDownloadUrl && (
          <a
            href={content.pdfDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" /> Download
          </a>
        )}
      </div>

      <ol className={`text-sm space-y-1.5 list-decimal pl-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
        <li>Download the document above.</li>
        <li>Print it, complete and sign it (or fill it in with any PDF app).</li>
        <li>Take a clear photo or scan and upload it here.</li>
      </ol>
      <p className={`text-xs ${muted}`}>An administrator will review your upload and mark this item complete.</p>

      {uploadedName ? (
        <div className={`p-3 rounded-xl border flex items-center gap-2 text-sm font-semibold ${isDarkMode ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Uploaded “{uploadedName}” — waiting for review. You can upload a replacement below if needed.
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => inputRef.current?.click()}
        className={`w-full p-6 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
          isDarkMode
            ? 'border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-indigo-950/20'
            : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/50'
        }`}
      >
        {busy ? <Loader2 className="w-7 h-7 mb-2 animate-spin text-indigo-500" /> : <Upload className={`w-7 h-7 mb-2 ${muted}`} />}
        <span className="text-sm font-bold">{busy ? 'Uploading…' : uploadedName ? 'Upload a replacement' : 'Upload your completed document'}</span>
        <span className={`text-xs mt-1 ${muted}`}>PDF, PNG or JPG · up to 25 MB</span>
      </button>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}
