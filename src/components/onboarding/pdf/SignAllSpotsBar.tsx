'use client';

// ============================================================================
// SignAllSpotsBar — Signature Suite, Phase B
//
// One button that puts the signer's signature in EVERY signature spot they own
// on the document. If they have a saved signature it's a single tap ("Apply my
// saved signature to all N spots"); otherwise "Sign all N spots" opens the
// signature pad once and fills every spot with the result.
//
// Shown when there are 2+ spots, or 1 spot and a saved signature exists.
// Purely a UI shortcut — every stamp is still validated by the server.
// ============================================================================

import React, { useState } from 'react';
import { CheckCircle2, Loader2, PenTool, Sparkles } from 'lucide-react';
import SignaturePadModal from './SignaturePadModal';
import { useSavedSignature } from './useSavedSignature';

interface SignAllSpotsBarProps {
  total: number;
  signed: number;
  /** Receives one PNG data URL; the parent writes it into every one of the signer's spots. */
  onApplyAll: (dataUrl: string) => void;
  isDarkMode: boolean;
  disabled?: boolean;
  /** Pre-fills the pad's "Type" tab. */
  defaultName?: string;
}

export default function SignAllSpotsBar({ total, signed, onApplyAll, isDarkMode, disabled, defaultName }: SignAllSpotsBarProps) {
  const [padOpen, setPadOpen] = useState(false);
  const { saved, loading } = useSavedSignature(!disabled && total > 0);

  if (disabled || total === 0 || (total < 2 && !saved)) return null;

  const allSigned = signed >= total;
  const plural = total === 1 ? 'spot' : 'spots';
  const shell = isDarkMode ? 'bg-indigo-950/40 border-indigo-800/50 text-indigo-100' : 'bg-indigo-50 border-indigo-200 text-indigo-900';
  const primary = 'bg-indigo-600 hover:bg-indigo-500 text-white';
  const secondary = isDarkMode
    ? 'border border-indigo-700 text-indigo-200 hover:bg-indigo-900/50'
    : 'border border-indigo-300 text-indigo-700 hover:bg-indigo-100';

  return (
    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 ${shell}`}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {allSigned ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" /> : <PenTool className="w-4 h-4 shrink-0" />}
        <span className="text-xs font-semibold">
          {allSigned
            ? `All ${total} signature ${plural} signed`
            : `${total} signature ${plural} on this document${signed ? ` · ${signed} signed` : ''}`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {saved && !allSigned && (
          <button
            type="button"
            onClick={() => onApplyAll(saved.imageData)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${primary}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Apply my saved signature to {total === 1 ? 'it' : `all ${total}`}
          </button>
        )}
        <button
          type="button"
          onClick={() => setPadOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${saved || allSigned ? secondary : primary}`}
        >
          {loading && !saved ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenTool className="w-3.5 h-3.5" />}
          {allSigned ? 'Change signature everywhere' : total === 1 ? 'Sign' : `Sign all ${total} ${plural}`}
        </button>
      </div>

      <SignaturePadModal
        open={padOpen}
        title={total === 1 ? 'Add your signature' : `Your signature goes in all ${total} spots`}
        isDarkMode={isDarkMode}
        defaultName={defaultName}
        onCancel={() => setPadOpen(false)}
        onApply={(dataUrl) => {
          onApplyAll(dataUrl);
          setPadOpen(false);
        }}
      />
    </div>
  );
}
