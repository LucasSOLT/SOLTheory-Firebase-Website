"use client";

import React from "react";

interface BetaDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  isDarkMode: boolean;
}

export function BetaDisclaimerModal({ isOpen, onClose, featureName, isDarkMode }: BetaDisclaimerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl border p-6 animate-in zoom-in-95 fade-in duration-200 ${
        isDarkMode 
          ? 'bg-slate-900 border-slate-700 text-white' 
          : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Beta Badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
            isDarkMode 
              ? 'bg-violet-500/15 text-violet-400 border border-violet-500/25' 
              : 'bg-violet-500/10 text-violet-600 border border-violet-500/20'
          }`}>Beta</span>
          <h2 className="text-lg font-bold">{featureName}</h2>
        </div>

        {/* Message */}
        <p className={`text-sm leading-relaxed mb-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
          Thanks for checking out <strong>{featureName}</strong>! This feature is currently in beta &mdash; 
          we&apos;re actively working on improving it and plan to bring it fully into Insight soon. 
          Feel free to explore and use it, but please note that some functionality may be limited or 
          change as we continue development.
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              isDarkMode
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            Got it, continue
          </button>
        </div>
      </div>
    </div>
  );
}
