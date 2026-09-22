'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Loader2,
  GraduationCap,
  AlertTriangle,
  Briefcase,
  Calendar,
  Check,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/api-auth-client';

interface BlueprintOption {
  id: string;
  roleName: string;
  steps?: any[];
  phases?: any[];
  isSystem?: boolean;
  isCustom?: boolean;
}

interface InstanceInfo {
  id: string;
  templateId: string;
  roleName: string;
  status: string;
  computedProgress?: number;
  computedCompleted?: number;
  computedTotal?: number;
}

interface ManageUserBlueprintsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  isDarkMode: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  /** Currently assigned onboarding instances for this user */
  userInstances: InstanceInfo[];
  onSuccess: () => void;
}

export default function ManageUserBlueprintsModal({
  isOpen,
  onClose,
  orgId,
  isDarkMode,
  userId,
  userName,
  userEmail,
  userInstances,
  onSuccess,
}: ManageUserBlueprintsModalProps) {
  const [availableBlueprints, setAvailableBlueprints] = useState<BlueprintOption[]>([]);
  const [loadingBlueprints, setLoadingBlueprints] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isRemovingAll, setIsRemovingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add-mode state
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedNewIds, setSelectedNewIds] = useState<string[]>([]);
  const [addStartDate, setAddStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Fetch available blueprints
  useEffect(() => {
    if (!isOpen || !orgId) return;
    const fetchBlueprints = async () => {
      setLoadingBlueprints(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/onboarding/blueprints?orgId=${orgId}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setAvailableBlueprints(data.blueprints || []);
        }
      } catch (err) {
        console.error('[ManageUserBlueprintsModal] Failed to fetch:', err);
      } finally {
        setLoadingBlueprints(false);
      }
    };
    fetchBlueprints();
  }, [isOpen, orgId]);

  if (!isOpen) return null;

  // Get blueprints not already assigned to this user
  const assignedTemplateIds = new Set(userInstances.map(i => i.templateId));
  const unassignedBlueprints = availableBlueprints.filter(bp => !assignedTemplateIds.has(bp.id));

  const getStepCount = (bp: BlueprintOption): number => {
    if (bp.steps?.length) return bp.steps.length;
    if (bp.phases) return bp.phases.reduce((sum: number, p: any) => sum + (p.items?.length || 0), 0);
    return 0;
  };

  const toggleNewBlueprint = (bpId: string) => {
    setSelectedNewIds(prev =>
      prev.includes(bpId)
        ? prev.filter(id => id !== bpId)
        : [...prev, bpId]
    );
  };

  const handleAddBlueprints = async () => {
    if (selectedNewIds.length === 0) return;
    setIsAdding(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/instantiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          orgId,
          targetUserId: userId,
          targetUserEmail: userEmail,
          targetUserName: userName,
          templateIds: selectedNewIds,
          startDate: addStartDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add blueprints');

      setSuccessMsg(`Added ${selectedNewIds.length} blueprint(s) successfully.`);
      setSelectedNewIds([]);
      setShowAddPanel(false);
      setTimeout(() => setSuccessMsg(null), 3000);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to add blueprints.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveInstance = async (instanceId: string, roleName: string) => {
    if (!confirm(`Remove the "${roleName}" blueprint and all its tasks from ${userName}?`)) return;
    setRemovingId(instanceId);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/instances', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ orgId, instanceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove blueprint');

      setSuccessMsg(`Removed "${roleName}" and ${data.deletedTasks} task(s).`);
      setTimeout(() => setSuccessMsg(null), 3000);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to remove blueprint.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleRemoveAll = async () => {
    if (!confirm(`⚠️ This will remove ALL onboarding blueprints and tasks for ${userName}. This cannot be undone. Continue?`)) return;
    setIsRemovingAll(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/instances', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ orgId, userId, removeAll: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove all blueprints');

      setSuccessMsg(`Removed all blueprints (${data.deletedInstances} instance(s), ${data.deletedTasks} task(s)).`);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 2000);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to remove all blueprints.');
    } finally {
      setIsRemovingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-200 ${
          isDarkMode ? 'bg-slate-900 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDarkMode ? 'border-slate-800' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
            }`}>
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Manage Blueprints</h3>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {userName} — {userEmail}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Error / Success messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className={`flex items-center gap-2 p-3 text-xs font-medium rounded-xl ${
              isDarkMode
                ? 'text-emerald-400 bg-emerald-950/30 border border-emerald-800/50'
                : 'text-emerald-600 bg-emerald-50 border border-emerald-200'
            }`}>
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Currently Assigned Blueprints */}
          <div>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Assigned Blueprints ({userInstances.length})
            </h4>
            {userInstances.length === 0 ? (
              <div className={`text-center py-6 rounded-xl border-2 border-dashed ${
                isDarkMode ? 'border-slate-700/50 text-slate-500' : 'border-slate-200 text-slate-400'
              }`}>
                <p className="text-xs font-medium">No blueprints assigned.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userInstances.map(inst => (
                  <div
                    key={inst.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                      isDarkMode ? 'bg-slate-800/60 border-slate-700/50' : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <Briefcase className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {inst.roleName}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {inst.computedCompleted ?? '?'}/{inst.computedTotal ?? '?'} steps complete
                        {inst.status === 'completed' && ' ✓'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveInstance(inst.id, inst.roleName)}
                      disabled={removingId === inst.id || isRemovingAll}
                      className={`p-2 rounded-lg transition-colors cursor-pointer ${
                        removingId === inst.id
                          ? 'opacity-50'
                          : isDarkMode
                            ? 'hover:bg-rose-900/30 text-rose-400'
                            : 'hover:bg-rose-50 text-rose-500'
                      }`}
                      title={`Remove "${inst.roleName}" blueprint`}
                    >
                      {removingId === inst.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Blueprint Panel */}
          {showAddPanel ? (
            <div className={`rounded-xl border p-4 space-y-3 ${
              isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-indigo-50/30 border-indigo-200/60'
            }`}>
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Add Blueprint(s)
              </h4>

              {loadingBlueprints ? (
                <div className="flex items-center gap-2 py-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading...</span>
                </div>
              ) : unassignedBlueprints.length === 0 ? (
                <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  All available blueprints are already assigned.
                </p>
              ) : (
                <>
                  <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <div className="max-h-[150px] overflow-y-auto">
                      {unassignedBlueprints.map(bp => {
                        const isSelected = selectedNewIds.includes(bp.id);
                        return (
                          <button
                            key={bp.id}
                            type="button"
                            onClick={() => toggleNewBlueprint(bp.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b last:border-b-0 cursor-pointer ${
                              isSelected
                                ? isDarkMode
                                  ? 'bg-indigo-900/30 border-slate-700/50'
                                  : 'bg-indigo-50/80 border-indigo-100'
                                : isDarkMode
                                  ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/50'
                                  : 'bg-white hover:bg-slate-50 border-slate-100'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600'
                                : isDarkMode
                                  ? 'border-slate-600 bg-slate-800'
                                  : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={`text-xs font-semibold truncate flex-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {bp.roleName}
                            </span>
                            <span className={`text-[10px] font-medium shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              {getStepCount(bp)} steps
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Start date for new blueprints */}
                  <div>
                    <label className={`block text-[10px] font-semibold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Start Date
                    </label>
                    <div className="relative">
                      <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <input
                        type="date"
                        value={addStartDate}
                        onChange={e => setAddStartDate(e.target.value)}
                        className={`w-full pl-8 pr-3 py-2 rounded-lg text-xs font-medium border ${
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                        } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddBlueprints}
                      disabled={selectedNewIds.length === 0 || isAdding}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                        selectedNewIds.length === 0 || isAdding
                          ? 'opacity-50 cursor-not-allowed bg-indigo-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                      }`}
                    >
                      {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Add {selectedNewIds.length > 0 ? selectedNewIds.length : ''} Blueprint{selectedNewIds.length !== 1 ? 's' : ''}
                    </button>
                    <button
                      onClick={() => { setShowAddPanel(false); setSelectedNewIds([]); }}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAddPanel(true)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border-2 border-dashed transition-colors cursor-pointer ${
                isDarkMode
                  ? 'border-slate-700 text-slate-400 hover:border-indigo-600 hover:text-indigo-400'
                  : 'border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <Plus className="w-4 h-4" />
              Add Blueprint
            </button>
          )}

          {/* Remove All — only show if there are instances */}
          {userInstances.length > 1 && (
            <div className={`pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <button
                onClick={handleRemoveAll}
                disabled={isRemovingAll}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  isRemovingAll
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                } ${
                  isDarkMode
                    ? 'bg-rose-950/30 border border-rose-800/50 text-rose-400 hover:bg-rose-900/40'
                    : 'bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100'
                }`}
              >
                {isRemovingAll
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
                Remove All Blueprints ({userInstances.length})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
