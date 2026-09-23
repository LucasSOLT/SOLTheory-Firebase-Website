'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { getAuthHeaders } from '@/lib/api-auth-client';
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
} from 'lucide-react';
import BlueprintEditor from '@/components/onboarding/BlueprintEditor';

export default function BlueprintsLibraryPage() {
  const { orgId: routeOrgId } = useParams<{ orgId: string }>();
  const orgId = routeOrgId;
  const router = useRouter();
  const { isDarkMode } = useTheme();

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
      <div className={`shrink-0 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200/80 bg-[#f5f1e8]'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => router.push(`/portal/dashboard/${orgId}/onboarding`)}
                className={`flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
                  isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Onboarding
              </button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3 tracking-tight">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`} onClick={() => router.push(`/portal/dashboard/${orgId}/onboarding`)}>
                <GraduationCap className="w-5 h-5" />
              </div>
              Role Blueprints
            </h1>
            <p className={`mt-1 text-sm ml-[52px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Manage standardized onboarding templates and tracks for your organization.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditorState({ isOpen: true, existingBlueprint: null })}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm active:scale-[0.98] cursor-pointer ${
                isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              Create New Blueprint
            </button>
          </div>
        </div>
      </div>

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
    </div>
  );
}
