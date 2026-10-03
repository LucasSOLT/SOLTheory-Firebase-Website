'use client';

// ============================================================================
// DocumentLibraryPicker — Phase 6.3 (Onboarding Document System, APPROVED PLAN)
//
// Lets a blueprint admin upload a template PDF ONCE to the org's Document
// Library and reuse it in any blueprint. Picking a template COPIES its path and
// detected fields into this blueprint item (copy-on-use) — documents already
// out for signature are never affected by later library changes.
// ============================================================================

import React from 'react';
import { Archive, ArchiveRestore, Check, FileText, Library, Loader2, Upload } from 'lucide-react';
import { getAuthHeaders } from '@/lib/api-auth-client';
import type { PdfFormContent } from '@/types/onboarding-templates';
import { templateToPdfContent, type LibraryTemplate } from '@/lib/document-library';

interface Props {
  orgId: string;
  content: PdfFormContent;
  onChange: (c: PdfFormContent) => void;
  isDarkMode: boolean;
}

/** Apply a library template to a blueprint item; field-name-keyed settings are reset if the PDF changes. */
export function applyTemplateToContent(content: PdfFormContent, t: LibraryTemplate): PdfFormContent {
  const next: PdfFormContent = { ...content, ...templateToPdfContent(t) } as PdfFormContent;
  if (content.pdfStoragePath !== t.pdfStoragePath) {
    delete next.autoFill;
    if (next.signingWorkflow) {
      next.signingWorkflow = {
        ...next.signingWorkflow,
        signers: next.signingWorkflow.signers.map((s) => ({ ...s, fieldNames: [] })),
      };
    }
  }
  return next;
}

export default function DocumentLibraryPicker({ orgId, content, onChange, isDarkMode }: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [templates, setTemplates] = React.useState<LibraryTemplate[]>([]);
  const [canManage, setCanManage] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/onboarding/document-library?orgId=${encodeURIComponent(orgId)}${showArchived ? '&includeArchived=1' : ''}`,
        { headers },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load the library');
      setTemplates(data.templates || []);
      setCanManage(!!data.canManage);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Could not load the library' });
    } finally {
      setLoading(false);
    }
  }, [orgId, showArchived]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const use = (t: LibraryTemplate) => {
    onChange(applyTemplateToContent(content, t));
    setMsg({ ok: true, text: `✓ Using "${t.name}" (${t.pageCount} page${t.pageCount === 1 ? '' : 's'}, ${t.fillableFieldCount} fillable fields).` });
    setOpen(false);
  };

  const upload = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const headers = await getAuthHeaders();
      const fd = new FormData();
      fd.append('orgId', orgId);
      fd.append('file', file);
      if (content.documentCategory) fd.append('documentCategory', content.documentCategory);
      const res = await fetch('/api/onboarding/document-library', { method: 'POST', headers, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const t: LibraryTemplate = data.template;
      onChange(applyTemplateToContent(content, t));
      setMsg({
        ok: true,
        text: data.duplicate
          ? `✓ That file is already in the library as "${t.name}" — using it.`
          : `✓ Uploaded "${t.name}" and detected ${t.fillableFieldCount} fillable fields across ${t.pageCount} page(s).`,
      });
      setOpen(false);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Upload failed' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const setArchived = async (t: LibraryTemplate, archived: boolean) => {
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/document-library', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ orgId, id: t.id, archived }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update');
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Could not update' });
    } finally {
      setBusy(false);
    }
  };

  const box = isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const row = isDarkMode ? 'border-slate-700' : 'border-slate-200';
  const current = templates.find((t) => t.pdfStoragePath === content.pdfStoragePath);

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${box}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <Library className="w-4 h-4 text-indigo-500" /> Document Library
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto px-3 py-1.5 text-xs font-bold rounded text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
        >
          {open ? 'Close' : 'Choose from library'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border transition-colors disabled:opacity-50 ${
            isDarkMode ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-50'
          }`}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Upload a PDF
        </button>
      </div>
      <p className={`text-[11px] ${muted}`}>
        Upload a PDF once and reuse it in any blueprint. Its fillable fields are detected automatically.
        {content.pdfStoragePath && current ? ` Currently using: ${current.name}.` : ''}
      </p>

      {msg && (
        <div
          className={`p-2 rounded text-xs font-semibold flex items-center gap-2 ${
            msg.ok
              ? isDarkMode ? 'bg-emerald-950/40 text-emerald-300' : 'bg-emerald-50 text-emerald-800'
              : isDarkMode ? 'bg-rose-950/40 text-rose-300' : 'bg-rose-50 text-rose-800'
          }`}
        >
          {msg.ok && <Check className="w-3.5 h-3.5 shrink-0" />}
          {msg.text}
        </div>
      )}

      {open && (
        <div className="space-y-2 pt-1">
          {canManage && (
            <label className={`flex items-center gap-2 text-[11px] cursor-pointer ${muted}`}>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>
          )}
          {loading ? (
            <div className={`flex items-center gap-2 text-xs ${muted}`}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          ) : templates.length === 0 ? (
            <div className={`text-xs ${muted}`}>No documents yet. Use “Upload a PDF” to add your first one.</div>
          ) : (
            <ul className="max-h-64 overflow-y-auto space-y-1.5">
              {templates.map((t) => (
                <li key={t.id} className={`flex items-center gap-2 rounded-md border px-2.5 py-2 ${row} ${t.archived ? 'opacity-60' : ''}`}>
                  <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{t.name}</div>
                    <div className={`text-[11px] ${muted}`}>
                      {t.pageCount} page{t.pageCount === 1 ? '' : 's'} · {t.fillableFieldCount} fillable fields
                      {t.archived ? ' · archived' : ''}
                    </div>
                  </div>
                  {!t.archived && (
                    <button
                      type="button"
                      onClick={() => use(t)}
                      className="px-2.5 py-1 text-[11px] font-bold rounded text-white bg-emerald-600 hover:bg-emerald-500"
                    >
                      Use
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      disabled={busy}
                      title={t.archived ? 'Restore' : 'Archive (hide from the list; existing documents are unaffected)'}
                      onClick={() => setArchived(t, !t.archived)}
                      className={`p-1.5 rounded border disabled:opacity-50 ${isDarkMode ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-50'}`}
                    >
                      {t.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
