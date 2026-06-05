'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TileSettingsPopupProps {
  tileId: string;
  tileName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TileSettingsPopup({
  tileId,
  tileName,
  isOpen,
  onClose,
}: TileSettingsPopupProps) {
  /* Close on Escape */
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        /* ─── Backdrop ─── */
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          {/* ─── Card ─── */}
          <motion.div
            className="relative flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xl"
            style={{
              width: 500,
              height: 400,
              minWidth: 340,
              minHeight: 280,
              maxWidth: '95vw',
              maxHeight: '90vh',
              resize: 'both',
              overflow: 'auto',
            }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-wide leading-tight">
                  {tileName}
                </h2>
                <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
                  {tileId}
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ─── Body ─── */}
            <div className="flex-1 flex items-center justify-center px-6 py-8">
              <p className="text-sm text-slate-400 font-medium select-none">
                Tile settings coming soon
              </p>
            </div>

            {/* ─── Footer ─── */}
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-center">
              <p className="text-[10px] text-slate-300 font-semibold tracking-wider uppercase">
                Content Manager · Admin
              </p>
            </div>

            {/* ─── Resize handle visual hint ─── */}
            <div className="absolute bottom-1 right-1 w-3 h-3 pointer-events-none opacity-30">
              <svg viewBox="0 0 12 12" className="text-slate-400">
                <path
                  d="M11 1v10H1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M11 5v6H5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
