"use client";

import React, { useState } from "react";
import type { Customer } from "@/stores/crm-store";
import type { PipelineConfig, PipelineStage } from "@/components/crm/PipelineSetup";
import { useTranslation } from "@/lib/i18n";
import { useTheme } from "@/components/ThemeProvider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building2, DollarSign, GripVertical, Settings2 } from "lucide-react";

interface PipelineBoardProps {
  customers: Customer[];
  onUpdateStatus: (id: string, status: string) => void;
  onOpenContact: (customer: Customer) => void;
  pipelineConfig: PipelineConfig | null;
  onConfigureClick: () => void;
}

function PipelineBoard({ customers, onUpdateStatus, onOpenContact, pipelineConfig, onConfigureClick }: PipelineBoardProps) {
  const { lang } = useTranslation();
  const { isDarkMode } = useTheme();
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Use pipeline config stages or fallback to the original hardcoded ones
  const stages: PipelineStage[] = pipelineConfig?.stages || [
    { id: "Cold Lead", name: "Cold Lead", color: "#3B82F6", probability: 10 },
    { id: "Warm Lead", name: "Warm Lead", color: "#F97316", probability: 30 },
    { id: "Interested", name: "Interested", color: "#8B5CF6", probability: 60 },
    { id: "Sale Completed", name: "Sale Completed", color: "#10B981", probability: 100 },
  ];

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, stageName: string) => {
    e.preventDefault();
    if (!draggedId) return;
    const customer = customers.find(c => c.id === draggedId);
    if (customer && customer.leadStatus !== stageName) {
      onUpdateStatus(draggedId, stageName);
    }
    setDraggedId(null);
  };

  return (
    <div className="flex-1 overflow-x-auto h-full p-6">
      {/* Configure button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {pipelineConfig && (
            <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {pipelineConfig.name}
            </span>
          )}
        </div>
        <button
          onClick={onConfigureClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
            isDarkMode
              ? 'border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600'
              : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-white hover:border-slate-300'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Configure
        </button>
      </div>

      <div className="flex gap-4 h-[calc(100%-44px)] pb-4 overflow-x-auto">
        {stages.map(stage => {
          // Match contacts: check leadStatus against stage name OR stage id
          const stageCustomers = customers.filter(c => {
            const status = c.leadStatus || "Cold Lead";
            return status === stage.name || status === stage.id;
          });
          const stageTotal = stageCustomers.reduce((acc, c) => acc + (c.totalRevenue || 0), 0);

          return (
            <div
              key={stage.id}
              className={`flex flex-col flex-1 min-w-[260px] max-w-[340px] rounded-xl border overflow-hidden shadow-sm ${
                isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/50 border-slate-200/60'
              }`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.name)}
            >
              <div className={`p-4 border-b sticky top-0 z-10 flex flex-col gap-1.5 ${
                isDarkMode ? 'border-slate-800 bg-slate-900/80 backdrop-blur-sm' : 'border-slate-200/60 bg-white/50 backdrop-blur-sm'
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border"
                      style={{
                        backgroundColor: stage.color + '15',
                        color: stage.color,
                        borderColor: stage.color + '40',
                      }}
                    >
                      {stage.name}
                    </span>
                  </h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                    {stageCustomers.length}
                  </span>
                </div>
                <div className={`text-xs font-medium pl-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  ${stageTotal.toLocaleString()} total pipeline
                </div>
                {stage.probability > 0 && (
                  <div className="w-full h-1 rounded-full bg-slate-200/60 dark:bg-slate-800 overflow-hidden mt-1">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${stage.probability}%`, backgroundColor: stage.color }} />
                  </div>
                )}
              </div>

              <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto min-h-[200px]">
                {stageCustomers.map(c => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, c.id)}
                    onClick={() => onOpenContact(c)}
                    className={`p-3.5 rounded-lg border shadow-sm cursor-pointer transition-all group ${
                      isDarkMode
                        ? `bg-slate-800 border-slate-700 hover:border-indigo-500/50 hover:shadow-md ${draggedId === c.id ? 'opacity-50 ring-2 ring-indigo-500/50' : 'opacity-100'}`
                        : `bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md ${draggedId === c.id ? 'opacity-50 ring-2 ring-indigo-500/50' : 'opacity-100'}`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9 shrink-0 rounded-md ring-1 ring-slate-100 dark:ring-slate-700">
                          <AvatarFallback className={`text-xs font-bold rounded-md ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                            {c.firstName?.[0]}{c.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className={`text-sm font-semibold leading-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                            {c.firstName} {c.lastName}
                          </h4>
                          {c.company && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                              <Building2 className="w-3 h-3" />
                              <span className="truncate max-w-[130px]">{c.company}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-1">
                        <GripVertical className="w-4 h-4" />
                      </button>
                    </div>

                    {(c.totalRevenue > 0 || c.tags?.length > 0) && (
                      <div className={`flex items-center gap-2 mt-3 pt-3 border-t ${isDarkMode ? 'border-slate-700/80' : 'border-slate-100/80'}`}>
                        {c.totalRevenue > 0 && (
                          <div className="flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-md flex-shrink-0 border border-emerald-100 dark:border-emerald-800">
                            <DollarSign className="w-3 h-3 mr-0.5" />
                            {c.totalRevenue.toLocaleString()}
                          </div>
                        )}
                        {c.tags && c.tags.length > 0 && (
                          <div className="flex gap-1 overflow-hidden flex-wrap">
                            {c.tags.slice(0, 2).map(tag => (
                              <span key={tag} className={`text-[10px] font-medium px-2 py-0.5 rounded-md border truncate max-w-[80px] ${isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {tag}
                              </span>
                            ))}
                            {c.tags.length > 2 && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${isDarkMode ? 'bg-slate-700 text-slate-500 border-slate-600' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                +{c.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                {stageCustomers.length === 0 && (
                  <div className={`h-full flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl ${isDarkMode ? 'border-slate-700/60 text-slate-500' : 'border-slate-200/60 text-slate-400'}`}>
                    <span className="text-xs font-medium">Drop contacts here</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(PipelineBoard);
