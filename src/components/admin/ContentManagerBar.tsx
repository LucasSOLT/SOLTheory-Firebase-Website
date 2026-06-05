'use client';

import React from 'react';
import { ALL_ORGS, OrgId } from '@/lib/admin';
import { Shield, X, Check, Building2 } from 'lucide-react';

interface ContentManagerBarProps {
  selectedOrgs: OrgId[];
  onToggleOrg: (orgId: OrgId) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExit: () => void;
}

export function ContentManagerBar({
  selectedOrgs,
  onToggleOrg,
  onSelectAll,
  onDeselectAll,
  onExit,
}: ContentManagerBarProps) {
  const allSelected = selectedOrgs.length === ALL_ORGS.length;
  const noneSelected = selectedOrgs.length === 0;

  return (
    <div className="w-full bg-white border border-slate-200/80 shadow-sm rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between gap-4">
        {/* Left — Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-wide leading-tight">
              Content Manager
            </h2>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">
              Editing dashboard layout
            </p>
          </div>
        </div>

        {/* Center — Org Selector */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest
              border transition-all duration-200 cursor-pointer
              ${allSelected
                ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
              }
            `}
          >
            <Building2 className="w-3 h-3" />
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />

          {ALL_ORGS.map((org) => {
            const isSelected = selectedOrgs.includes(org.id);
            return (
              <button
                key={org.id}
                onClick={() => onToggleOrg(org.id)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                  border transition-all duration-200 cursor-pointer
                  ${isSelected
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                  }
                `}
              >
                <div
                  className={`
                    w-3.5 h-3.5 rounded border flex items-center justify-center transition-all duration-200
                    ${isSelected
                      ? 'bg-white border-white/30'
                      : 'border-slate-300 bg-white'
                    }
                  `}
                >
                  {isSelected && <Check className="w-2.5 h-2.5 text-slate-900" />}
                </div>
                <span className="hidden sm:inline">{org.name}</span>
                <span className="sm:hidden">{org.icon}</span>
              </button>
            );
          })}
        </div>

        {/* Right — Exit */}
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold
            bg-white border border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600
            transition-all duration-200 cursor-pointer shrink-0"
        >
          <X className="w-3 h-3" />
          <span className="hidden sm:inline">Exit</span>
        </button>
      </div>

      {/* Selection summary */}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-slate-100" />
        <p className="text-[9px] text-slate-400 font-medium tracking-wider uppercase shrink-0">
          {noneSelected
            ? 'No organizations selected'
            : allSelected
            ? 'All organizations — changes apply globally'
            : `${selectedOrgs.length} org${selectedOrgs.length > 1 ? 's' : ''} selected`
          }
        </p>
        <div className="h-px flex-1 bg-slate-100" />
      </div>
    </div>
  );
}
