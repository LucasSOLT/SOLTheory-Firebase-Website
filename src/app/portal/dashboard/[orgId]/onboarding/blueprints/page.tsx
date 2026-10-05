'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useOrgRole } from '@/hooks/useOrgRole';
import { getAuthHeaders } from '@/lib/api-auth-client';
import { getAllOrgIds, getOrgLabel } from '@/lib/org-config';
import {
  GraduationCap,
  Loader2,
  Plus,
  Search,
  Copy,
  Edit2,
  Trash2,
  FileText,
  ArrowLeft,
  Send,
  Check,
  AlertCircle,
  X,
  Eye,
} from 'lucide-react';
import BlueprintEditor from '@/components/onboarding/BlueprintEditor';
import BlueprintPreview from '@/components/onboarding/BlueprintPreview';
import BodyPortal, { MODAL_OVERLAY_CLASS, MODAL_OVERLAY_STYLE } from '@/components/onboarding/BodyPortal';
import OnboardingHeader from '@/components/onboarding/OnboardingHeader';

export default function BlueprintsLibraryPage() {
  const { orgId: routeOrgId } = useParams<{ orgId: string }>();
  const orgId = routeOrgId;
  const router = useRouter();
  const { isDarkMode } = useTheme();

  const { role } = useOrgRole(orgId);
  const isAdmin = role === 'admin' || role === 'oracle';

  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    existingBlueprint: any;
  }>({
    isOpen: false,
    existingBlueprint: null,
  });

  const [previewBlueprint, setPreviewBlueprint] = useState<any>(null);

  const [pushModalState, setPushModalState] = useState<{
    isOpen: boolean;
    blueprint: any;
    targetOrgId: string;
    roleName: string;
    isPushing: boolean;
    successMessage?: string | null;
    errorMessage?: string | null;
  }>({
    isOpen: false,
    blueprint: null,
    targetOrgId: '',
    roleName: '',
    isPushing: false,
    successMessage: null,
    errorMessage: null,
  });

  const handlePushBlueprint = async () => {
    if (!pushModalState.blueprint || !pushModalState.targetOrgId) return;
    setPushModalState(prev => ({ ...prev, isPushing: true, errorMessage: null, successMessage: null }));
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/blueprints/clone', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceOrgId: orgId,
          targetOrgId: pushModalState.targetOrgId,
          sourceTemplateId: pushModalState.blueprint.id,
          newRoleName: pushModalState.roleName || pushModalState.blueprint.roleName,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const targetLabel = getOrgLabel(pushModalState.targetOrgId);
        setPushModalState(prev => ({
          ...prev,
          isPushing: false,
          successMessage: `Successfully deployed to ${targetLabel}!`,
        }));
        if (pushModalState.targetOrgId === orgId) {
          fetchBlueprints();
        }
        setTimeout(() => {
          setPushModalState({
            isOpen: false,
            blueprint: null,
            targetOrgId: '',
            roleName: '',
            isPushing: false,
            successMessage: null,
            errorMessage: null,
          });
        }, 1500);
      } else {
        setPushModalState(prev => ({
          ...prev,
          isPushing: false,
          errorMessage: data.error || 'Failed to push blueprint',
        }));
      }
    } catch (err: any) {
      setPushModalState(prev => ({
        ...prev,
        isPushing: false,
        errorMessage: err.message || 'An unexpected error occurred.',
      }));
    }
  };

  const fetchBlueprints = useCallback(async () => {
    if (!orgId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/onboarding/blueprints?orgId=${orgId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBlueprints(data.blueprints || []);
      }
    } catch (err) {
      console.error('Failed to fetch blueprints:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchBlueprints();
  }, [fetchBlueprints]);

  const handleSaveBlueprint = async (blueprintData: any) => {
    try {
      const headers = await getAuthHeaders();
      const isUpdate = !!blueprintData.id;
      
      // Ensure orgId is always in the payload
      const payload = isUpdate
        ? {
            orgId,
            templateId: blueprintData.id,
            updates: {
              roleName: blueprintData.roleName,
              description: blueprintData.description,
              steps: blueprintData.steps,
              phaseDefinitions: blueprintData.phaseDefinitions,
            },
            applyToActive: blueprintData.applyToActive,
          }
        : { ...blueprintData, orgId };

      const res = await fetch(`/api/onboarding/blueprints?orgId=${orgId}`, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        fetchBlueprints();
        setEditorState({ isOpen: false, existingBlueprint: null });
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save blueprint');
      }
    } catch (err) {
      console.error('Failed to save blueprint:', err);
      alert('An error occurred while saving the blueprint.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blueprint?')) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/onboarding/blueprints?orgId=${orgId}&templateId=${id}&id=${id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        fetchBlueprints();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete blueprint');
      }
    } catch (err: any) {
      console.error('Failed to delete blueprint:', err);
      alert(err.message || 'An error occurred while deleting the blueprint.');
    }
  };

  const filteredBlueprints = blueprints.filter(bp =>
    bp.roleName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bp.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Loading blueprints...
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full -mx-4 -mb-4 md:-mx-10 md:-mb-10 ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-[#f5f1e8] text-slate-900'} font-sans overflow-hidden`}>
      {/* Header */}
      <OnboardingHeader
        orgId={orgId as string}
        isDarkMode={isDarkMode}
        isAdmin={isAdmin}
        activeTab="blueprints"
        actions={
          <button
            onClick={() => setEditorState({ isOpen: true, existingBlueprint: null })}
            className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all shadow-sm active:scale-[0.98] cursor-pointer ${
              isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Create New Blueprint
          </button>
        }
      />

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
        
        {/* Search */}
        <div className="relative max-w-md">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type="text"
            placeholder="Search blueprints..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              isDarkMode
                ? 'bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-indigo-500/50'
                : 'bg-white/70 border-slate-200/80 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400/50'
            } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
          />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBlueprints.map(bp => {
            const phaseCount = bp.phases?.length || bp.phaseDefinitions?.length || (bp.steps ? new Set(bp.steps.map((s: any) => s.phase)).size : 0);
            const stepCount = bp.phases?.reduce((acc: number, p: any) => acc + (p.items?.length || 0), 0) || bp.steps?.length || 0;
            const isSystem = bp.isSystem;

            return (
              <div
                key={bp.id}
                className={`flex flex-col rounded-2xl border transition-all ${
                  isDarkMode
                    ? 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-800/80'
                    : 'bg-white/70 border-slate-200/80 shadow-sm hover:shadow-md'
                }`}
              >
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    {isSystem && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                        isDarkMode ? 'bg-slate-700/50 text-slate-400 border-slate-600/50' : 'bg-slate-100 text-slate-500 border-slate-200/60'
                      }`}>
                        System
                      </span>
                    )}
                  </div>
                  <h3 className={`text-lg font-bold mb-1 line-clamp-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {bp.roleName}
                  </h3>
                  <p className={`text-sm line-clamp-2 min-h-[40px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {bp.description || 'No description provided.'}
                  </p>

                  <div className="flex items-center gap-3 mt-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg ${isDarkMode ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {phaseCount} phases
                    </span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg ${isDarkMode ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {stepCount} steps
                    </span>
                  </div>
                </div>

                <div className={`flex items-center p-3 border-t gap-2 ${isDarkMode ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
                  <button
                    onClick={() => setEditorState({ isOpen: true, existingBlueprint: bp })}
                    className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors ${
                      isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      const cloned = { ...bp, id: undefined, roleName: `${bp.roleName} (Copy)`, isSystem: false };
                      setEditorState({ isOpen: true, existingBlueprint: cloned });
                    }}
                    className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors ${
                      isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" /> Clone
                  </button>
                  <button
                    onClick={() => setPreviewBlueprint(bp)}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      isDarkMode ? 'hover:bg-slate-700 text-emerald-400' : 'hover:bg-slate-200 text-emerald-600'
                    }`}
                    title="Preview as Employee"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const allOrgs = getAllOrgIds();
                      const defaultTarget = allOrgs.find(o => o !== orgId) || orgId;
                      setPushModalState({
                        isOpen: true,
                        blueprint: bp,
                        targetOrgId: defaultTarget,
                        roleName: bp.roleName,
                        isPushing: false,
                        successMessage: null,
                        errorMessage: null,
                      });
                    }}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      isDarkMode ? 'hover:bg-slate-700 text-indigo-400' : 'hover:bg-slate-200 text-indigo-600'
                    }`}
                    title="Push / Copy to another organization"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  {!isSystem && (
                    <button
                      onClick={() => handleDelete(bp.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        isDarkMode ? 'hover:bg-rose-900/30 text-rose-400' : 'hover:bg-rose-50 text-rose-600'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor Modal */}
      {editorState.isOpen && (
        <BlueprintEditor
          isOpen={editorState.isOpen}
          onClose={() => setEditorState({ isOpen: false, existingBlueprint: null })}
          onSave={handleSaveBlueprint}
          isDarkMode={isDarkMode}
          orgId={orgId as string}
          existingBlueprint={editorState.existingBlueprint}
        />
      )}

      {/* Push Blueprint to Org Modal */}
      {pushModalState.isOpen && pushModalState.blueprint && (
        <BodyPortal>
        <div className={MODAL_OVERLAY_CLASS} style={MODAL_OVERLAY_STYLE}>
          <div
            className={`my-auto w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
              isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Push Blueprint</h3>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Copy track to another organization
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPushModalState(prev => ({ ...prev, isOpen: false }))}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pushModalState.successMessage ? (
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                  <Check className="w-6 h-6" />
                </div>
                <p className="font-semibold text-base text-emerald-500">{pushModalState.successMessage}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pushModalState.errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{pushModalState.errorMessage}</span>
                  </div>
                )}

                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Source Blueprint
                  </label>
                  <p className="text-sm font-semibold">{pushModalState.blueprint.roleName}</p>
                </div>

                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Target Organization
                  </label>
                  <select
                    value={pushModalState.targetOrgId}
                    onChange={e => setPushModalState(prev => ({ ...prev, targetOrgId: e.target.value }))}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-600'
                    }`}
                  >
                    {getAllOrgIds().map(targetId => (
                      <option key={targetId} value={targetId}>
                        {getOrgLabel(targetId)} {targetId === orgId ? '(Current Org)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Role Name in Target Org
                  </label>
                  <input
                    type="text"
                    value={pushModalState.roleName}
                    onChange={e => setPushModalState(prev => ({ ...prev, roleName: e.target.value }))}
                    placeholder="Enter role name"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-600'
                    }`}
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPushModalState(prev => ({ ...prev, isOpen: false }))}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pushModalState.isPushing || !pushModalState.targetOrgId}
                    onClick={handlePushBlueprint}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 ${
                      isDarkMode
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {pushModalState.isPushing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Pushing...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Push Blueprint
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </BodyPortal>
      )}

      {/* Blueprint Preview Modal */}
      {previewBlueprint && (
        <BlueprintPreview
          isOpen={!!previewBlueprint}
          onClose={() => setPreviewBlueprint(null)}
          isDarkMode={isDarkMode}
          orgId={orgId as string}
          roleName={previewBlueprint.roleName || 'Untitled'}
          description={previewBlueprint.description}
          steps={previewBlueprint.steps || []}
          phaseDefinitions={previewBlueprint.phaseDefinitions}
        />
      )}
    </div>
  );
}
