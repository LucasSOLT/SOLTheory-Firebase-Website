'use client';

// ============================================================================
// MySignatureCard — Signature Suite, Phase F1
//
// "My Signature & Initials" card at the top of the onboarding home screen.
// Lets any user (new hire, supervisor, admin) create / replace / delete the
// reusable signature and initials that the blue "Sign" / "Initial" buttons
// on documents drop in with one tap. Draw, Type or Upload — the same pad as
// in documents. Stored only at users/{uid}/private/* via the server API.
// ============================================================================

import React, { useState } from 'react';
import { CaseUpper, ChevronDown, Loader2, PenTool, Trash2 } from 'lucide-react';
import SignaturePadModal from '@/components/onboarding/pdf/SignaturePadModal';
import { useSavedSignature, type SavedKind } from '@/components/onboarding/pdf/useSavedSignature';

interface Props {
  isDarkMode: boolean;
  /** Full name used to pre-fill the "Type" tab (initials are derived from it). */
  defaultName?: string;
}

interface TileProps {
  kind: SavedKind;
  isDarkMode: boolean;
  onEdit: () => void;
  saved: ReturnType<typeof useSavedSignature>['saved'];
  loading: boolean;
  onRemove: () => void;
  busy: boolean;
}

function Tile({ kind, isDarkMode, onEdit, saved, loading, onRemove, busy }: TileProps) {
  const label = kind === 'initials' ? 'Initials' : 'Signature';
  const Icon = kind === 'initials' ? CaseUpper : PenTool;
  const border = isDarkMode ? 'border-slate-700' : 'border-slate-200';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  return (
    <div className={`rounded-xl border p-3 ${border} ${isDarkMode ? 'bg-slate-900/40' : 'bg-white'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
        <span className="text-sm font-semibold">{label}</span>
        {saved && <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-emerald-500">Saved</span>}
      </div>
      <div className="h-16 rounded-lg bg-white border border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
        {loading && !saved ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        ) : saved ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={saved.imageData} alt={`Your saved ${label.toLowerCase()}`} className="max-h-14 max-w-[90%] object-contain" draggable={false} />
        ) : (
          <span className="text-xs text-slate-400">Not set up yet</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="flex-1 min-h-[40px] rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-3 disabled:opacity-50"
        >
          {saved ? 'Replace' : `Add ${label.toLowerCase()}`}
        </button>
        {saved && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            aria-label={`Delete saved ${label.toLowerCase()}`}
            className={`min-h-[40px] min-w-[40px] rounded-lg border flex items-center justify-center ${border} ${muted} hover:text-rose-500 disabled:opacity-50`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function MySignatureCard({ isDarkMode, defaultName }: Props) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<SavedKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sig = useSavedSignature(true, 'signature');
  const ini = useSavedSignature(true, 'initials');

  const hookFor = (k: SavedKind) => (k === 'initials' ? ini : sig);

  const handleSave = async (dataUrl: string, method: Parameters<typeof sig.save>[1]) => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const ok = await hookFor(editing).save(dataUrl, method);
    setBusy(false);
    if (ok) setEditing(null);
    else setError('Could not save right now — please try again.');
  };

  const handleRemove = async (k: SavedKind) => {
    if (!window.confirm(`Delete your saved ${k}? You can add it again any time.`)) return;
    setBusy(true);
    setError(null);
    const ok = await hookFor(k).remove();
    setBusy(false);
    if (!ok) setError('Could not delete right now — please try again.');
  };

  const card = isDarkMode ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/70 border-slate-200/80 shadow-sm';
  const both = !!sig.saved && !!ini.saved;

  return (
    <div className={`rounded-2xl border ${card}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <PenTool className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">My Signature &amp; Initials</div>
          <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {both ? 'Ready — tap “Sign” or “Initial” on any document.' : 'Set these up once and sign any document with one tap.'}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Tile
              kind="signature"
              isDarkMode={isDarkMode}
              saved={sig.saved}
              loading={sig.loading}
              busy={busy}
              onEdit={() => setEditing('signature')}
              onRemove={() => void handleRemove('signature')}
            />
            <Tile
              kind="initials"
              isDarkMode={isDarkMode}
              saved={ini.saved}
              loading={ini.loading}
              busy={busy}
              onEdit={() => setEditing('initials')}
              onRemove={() => void handleRemove('initials')}
            />
          </div>
          {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
          <p className={`mt-2 text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Stored privately for your account only. It is added to a document only when you tap a field.
          </p>
        </div>
      )}

      <SignaturePadModal
        open={editing !== null}
        kind={editing ?? 'signature'}
        saveOnly
        title={editing === 'initials' ? 'My initials' : 'My signature'}
        isDarkMode={isDarkMode}
        defaultName={defaultName}
        onCancel={() => setEditing(null)}
        onApply={(dataUrl, method) => void handleSave(dataUrl, method)}
      />
    </div>
  );
}
