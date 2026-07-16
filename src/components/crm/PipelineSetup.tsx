"use client";

import React, { useState, useCallback } from "react";
import { useTheme } from "@/components/ThemeProvider";
import {
  TrendingUp, Handshake, UserCheck, GraduationCap, FolderKanban,
  Plus, Trash2, GripVertical, X, Sparkles, Settings2, ChevronRight,
  Palette, Wand2,
} from "lucide-react";

/* ─────────────── TYPES ─────────────── */

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  probability: number;
}

export interface PipelineConfig {
  id: string;
  name: string;
  stages: PipelineStage[];
}

/* ─────────────── PRESETS ─────────────── */

export const PIPELINE_PRESETS: (PipelineConfig & { description: string; iconName: string })[] = [
  {
    id: "sales",
    name: "Sales Pipeline",
    description: "Classic lead-to-close sales funnel",
    iconName: "TrendingUp",
    stages: [
      { id: "cold_lead", name: "Cold Lead", color: "#3B82F6", probability: 10 },
      { id: "warm_lead", name: "Warm Lead", color: "#F97316", probability: 30 },
      { id: "interested", name: "Interested", color: "#8B5CF6", probability: 60 },
      { id: "sale_completed", name: "Sale Completed", color: "#10B981", probability: 100 },
    ],
  },
  {
    id: "deals",
    name: "Deal Pipeline",
    description: "Track deals from qualification to close",
    iconName: "Handshake",
    stages: [
      { id: "qualified", name: "Qualified", color: "#06B6D4", probability: 20 },
      { id: "proposal", name: "Proposal Sent", color: "#8B5CF6", probability: 40 },
      { id: "negotiation", name: "Negotiation", color: "#F59E0B", probability: 70 },
      { id: "closed_won", name: "Closed Won", color: "#10B981", probability: 100 },
      { id: "closed_lost", name: "Closed Lost", color: "#EF4444", probability: 0 },
    ],
  },
  {
    id: "onboarding",
    name: "Client Onboarding",
    description: "Guide new clients through setup",
    iconName: "UserCheck",
    stages: [
      { id: "new", name: "New Client", color: "#3B82F6", probability: 0 },
      { id: "in_review", name: "In Review", color: "#F97316", probability: 0 },
      { id: "onboarding", name: "Onboarding", color: "#8B5CF6", probability: 0 },
      { id: "active", name: "Active", color: "#10B981", probability: 0 },
    ],
  },
  {
    id: "recruitment",
    name: "Recruitment",
    description: "Hiring pipeline from application to offer",
    iconName: "GraduationCap",
    stages: [
      { id: "applied", name: "Applied", color: "#06B6D4", probability: 10 },
      { id: "screening", name: "Screening", color: "#F97316", probability: 30 },
      { id: "interview", name: "Interview", color: "#8B5CF6", probability: 50 },
      { id: "offer", name: "Offer Extended", color: "#10B981", probability: 80 },
      { id: "hired", name: "Hired", color: "#22C55E", probability: 100 },
    ],
  },
  {
    id: "project",
    name: "Project Tracker",
    description: "Move projects from backlog to done",
    iconName: "FolderKanban",
    stages: [
      { id: "backlog", name: "Backlog", color: "#94A3B8", probability: 0 },
      { id: "in_progress", name: "In Progress", color: "#3B82F6", probability: 0 },
      { id: "review", name: "In Review", color: "#F59E0B", probability: 0 },
      { id: "done", name: "Done", color: "#10B981", probability: 0 },
    ],
  },
];

const PRESET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp, Handshake, UserCheck, GraduationCap, FolderKanban,
};

const STAGE_COLORS = [
  "#3B82F6", "#F97316", "#8B5CF6", "#10B981", "#EF4444",
  "#06B6D4", "#F59E0B", "#EC4899", "#22C55E", "#94A3B8",
  "#6366F1", "#14B8A6", "#F43F5E", "#84CC16", "#A855F7",
];

/* ─────────────── COMPONENT ─────────────── */

interface PipelineSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (config: PipelineConfig) => void;
  currentConfig?: PipelineConfig | null;
}

export default function PipelineSetup({ isOpen, onClose, onApply, currentConfig }: PipelineSetupProps) {
  const { isDarkMode } = useTheme();
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [customName, setCustomName] = useState(currentConfig?.name || "My Pipeline");
  const [customStages, setCustomStages] = useState<PipelineStage[]>(
    currentConfig?.stages || [
      { id: `stage-${Date.now()}`, name: "Stage 1", color: STAGE_COLORS[0], probability: 0 },
    ]
  );
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handlePresetSelect = (preset: typeof PIPELINE_PRESETS[0]) => {
    onApply({ id: preset.id, name: preset.name, stages: preset.stages });
  };

  const addStage = () => {
    const colorIdx = customStages.length % STAGE_COLORS.length;
    setCustomStages([...customStages, {
      id: `stage-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: `Stage ${customStages.length + 1}`,
      color: STAGE_COLORS[colorIdx],
      probability: 0,
    }]);
  };

  const removeStage = (idx: number) => {
    if (customStages.length <= 1) return;
    setCustomStages(customStages.filter((_, i) => i !== idx));
  };

  const updateStage = (idx: number, updates: Partial<PipelineStage>) => {
    setCustomStages(customStages.map((s, i) => i === idx ? { ...s, ...updates } : s));
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const newStages = [...customStages];
    const [dragged] = newStages.splice(draggedIdx, 1);
    newStages.splice(idx, 0, dragged);
    setCustomStages(newStages);
    setDraggedIdx(idx);
  };

  const handleDragEnd = () => setDraggedIdx(null);

  const handleApplyCustom = () => {
    if (!customName.trim() || customStages.length === 0) return;
    onApply({
      id: "custom",
      name: customName.trim(),
      stages: customStages,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />

      {/* Content */}
      <div className={`relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-[#faf8f3] border-[#ede8da]'} animate-in zoom-in-95 fade-in duration-300`}>
        {/* Header */}
        <div className="p-6 pb-4 flex items-center justify-between">
          <div>
            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              <Settings2 className="w-5 h-5 inline mr-2 -mt-0.5" />
              Configure Your Pipeline
            </h2>
            <p className="text-xs text-slate-400 mt-1">Choose a preset or build your own custom pipeline stages</p>
          </div>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} text-slate-400 hover:text-slate-600 transition-colors cursor-pointer`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6">
          {/* Preset Cards */}
          {!showCustomBuilder && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {PIPELINE_PRESETS.map(preset => {
                  const PresetIcon = PRESET_ICONS[preset.iconName] || TrendingUp;
                  const isActive = currentConfig?.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className={`group relative p-5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                        isActive
                          ? (isDarkMode ? "bg-indigo-950/40 border-indigo-500/50 ring-1 ring-indigo-500/30" : "bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200")
                          : (isDarkMode ? "bg-slate-800 border-slate-700 hover:border-slate-600" : "bg-white border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30")
                      } hover:shadow-lg hover:scale-[1.02]`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isActive
                            ? "bg-indigo-500 text-white"
                            : isDarkMode ? "bg-slate-700 text-slate-300 group-hover:bg-indigo-500/20 group-hover:text-indigo-400" : "bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                        } transition-colors`}>
                          <PresetIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{preset.name}</h3>
                          <p className="text-[11px] text-slate-400">{preset.description}</p>
                        </div>
                      </div>
                      {/* Stage pills preview */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {preset.stages.map((stage, i) => (
                          <React.Fragment key={stage.id}>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{stage.name}</span>
                            </span>
                            {i < preset.stages.length - 1 && (
                              <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                      {isActive && (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-indigo-500 text-white text-[9px] font-bold uppercase tracking-wider">Active</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Divider + Custom Button */}
              <div className="flex items-center gap-4 mb-4">
                <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">or</span>
                <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
              </div>

              <button
                onClick={() => setShowCustomBuilder(true)}
                className={`w-full p-4 rounded-xl border-2 border-dashed text-center transition-all cursor-pointer group ${
                  isDarkMode
                    ? "border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-950/20"
                    : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30"
                }`}
              >
                <Wand2 className={`w-5 h-5 mx-auto mb-2 ${isDarkMode ? 'text-slate-500 group-hover:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-500'} transition-colors`} />
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300 group-hover:text-white' : 'text-slate-600 group-hover:text-indigo-700'} transition-colors`}>
                  Build Custom Pipeline
                </span>
                <p className="text-[11px] text-slate-400 mt-1">Create your own stages, colors, and probabilities</p>
              </button>
            </>
          )}

          {/* Custom Builder */}
          {showCustomBuilder && (
            <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
              <button
                onClick={() => setShowCustomBuilder(false)}
                className={`text-xs font-medium mb-4 flex items-center gap-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'} transition-colors cursor-pointer`}
              >
                &#8592; Back to presets
              </button>

              {/* Pipeline Name */}
              <div className="mb-5">
                <label className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1.5 block`}>Pipeline Name</label>
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className={`w-full text-sm font-semibold rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'} focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                  placeholder="My Custom Pipeline"
                />
              </div>

              {/* Stages */}
              <label className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-2 block`}>Stages</label>
              <div className="space-y-2 mb-4">
                {customStages.map((stage, idx) => (
                  <div
                    key={stage.id}
                    draggable
                    onDragStart={e => handleDragStart(e, idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      draggedIdx === idx ? 'opacity-50 scale-[0.98]' : ''
                    } ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                  >
                    <button className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                      <GripVertical className="w-4 h-4" />
                    </button>
                    <div className="relative">
                      <input
                        type="color"
                        value={stage.color}
                        onChange={e => updateStage(idx, { color: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                        style={{ backgroundColor: stage.color }}
                      />
                    </div>
                    <input
                      value={stage.name}
                      onChange={e => updateStage(idx, { name: e.target.value })}
                      className={`flex-1 text-sm font-medium rounded-lg border px-3 py-1.5 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                      placeholder="Stage name"
                    />
                    <div className="flex items-center gap-1.5 w-24 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={stage.probability}
                        onChange={e => updateStage(idx, { probability: parseInt(e.target.value) || 0 })}
                        className={`w-14 text-xs text-center font-semibold rounded-lg border px-2 py-1.5 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} focus:outline-none`}
                      />
                      <span className="text-[10px] text-slate-400 font-bold">%</span>
                    </div>
                    <button
                      onClick={() => removeStage(idx)}
                      disabled={customStages.length <= 1}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addStage}
                className={`w-full p-2.5 rounded-xl border-2 border-dashed text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  isDarkMode ? 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white' : 'border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Stage
              </button>

              {/* Preview */}
              <div className="mt-6 mb-4">
                <label className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-2 block`}>Preview</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {customStages.map((stage, i) => (
                    <React.Fragment key={stage.id}>
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ backgroundColor: stage.color + '15' }}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                        <span className="text-xs font-medium" style={{ color: stage.color }}>{stage.name}</span>
                      </span>
                      {i < customStages.length - 1 && (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Apply */}
              <div className={`flex items-center gap-3 pt-4 border-t ${isDarkMode ? 'border-slate-700/60' : 'border-slate-200/60'}`}>
                <button
                  onClick={() => setShowCustomBuilder(false)}
                  className={`px-4 py-2.5 rounded-lg text-xs font-semibold border ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'} transition-colors cursor-pointer`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyCustom}
                  disabled={!customName.trim() || customStages.length === 0}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-600/20 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
                  Apply Pipeline
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
