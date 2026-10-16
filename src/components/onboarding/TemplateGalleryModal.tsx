import React, { useState } from 'react';
import { X, Search, FileText, Copy, Eye, LayoutTemplate } from 'lucide-react';
import BodyPortal, { MODAL_OVERLAY_CLASS, MODAL_OVERLAY_STYLE } from './BodyPortal';

interface TemplateGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemTemplates: any[];
  isDarkMode: boolean;
  onSelectTemplate: (template: any) => void;
  onPreviewTemplate: (template: any) => void;
}

export default function TemplateGalleryModal({
  isOpen,
  onClose,
  systemTemplates,
  isDarkMode,
  onSelectTemplate,
  onPreviewTemplate,
}: TemplateGalleryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filtered = systemTemplates.filter(bp =>
    bp.roleName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bp.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <BodyPortal>
      <div className={MODAL_OVERLAY_CLASS} style={MODAL_OVERLAY_STYLE}>
        <div
          className={`my-auto relative w-full max-w-5xl h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem)] sm:h-[85dvh] max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem)] overflow-hidden flex flex-col rounded-2xl shadow-2xl ${
            isDarkMode ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-[#f8f9fa] border border-slate-200 text-slate-900'
          }`}
        >
          {/* Header */}
          <div className={`shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  <LayoutTemplate className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold truncate">Template Gallery</h2>
                  <p className={`text-xs sm:text-sm truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Choose a blueprint to copy into your organization
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`sm:hidden p-2 rounded-xl transition-colors shrink-0 ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500/50'
                      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400/50'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                />
              </div>
              <button
                onClick={onClose}
                className={`hidden sm:inline-flex p-2 rounded-xl transition-colors ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Grid */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-6"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {filtered.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <LayoutTemplate className={`w-12 h-12 mb-3 ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`} />
                <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  No templates found matching "{searchQuery}"
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(bp => {
                  const phaseCount = bp.phases?.length || bp.phaseDefinitions?.length || (bp.steps ? new Set(bp.steps.map((s: any) => s.phase)).size : 0);
                  const stepCount = bp.phases?.reduce((acc: number, p: any) => acc + (p.items?.length || 0), 0) || bp.steps?.length || 0;

                  return (
                    <div
                      key={bp.id}
                      className={`flex flex-col rounded-2xl border transition-all ${
                        isDarkMode
                          ? 'bg-slate-800/80 border-slate-700/50 hover:bg-slate-800'
                          : 'bg-white border-slate-200/80 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className="p-5 flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            isDarkMode ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800/50' : 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
                          }`}>
                            Template
                          </span>
                        </div>
                        <h3 className={`text-lg font-bold mb-1 line-clamp-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {bp.roleName}
                        </h3>
                        <p className={`text-sm line-clamp-2 min-h-[40px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {bp.description || 'No description provided.'}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 mt-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg ${isDarkMode ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                            {phaseCount} phases
                          </span>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg ${isDarkMode ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                            {stepCount} steps
                          </span>
                        </div>
                      </div>

                      <div className={`flex flex-wrap items-center p-3 border-t gap-2 ${isDarkMode ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                        <button
                          onClick={() => onPreviewTemplate(bp)}
                          className={`flex-1 flex justify-center items-center gap-2 py-2 px-2 rounded-lg text-xs font-bold transition-colors ${
                            isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" /> Preview
                        </button>
                        <button
                          onClick={() => onSelectTemplate(bp)}
                          className={`flex-1 flex justify-center items-center gap-2 py-2 px-2 rounded-lg text-xs font-bold transition-colors ${
                            isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          <Copy className="w-3.5 h-3.5 shrink-0" /> Use Template
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
