'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  Upload,
  Loader2,
  Image as ImageIcon,
  Video,
  Link2,
} from 'lucide-react';
import { InteractiveContentBuilder } from './InteractiveBuilders';
import { ITEM_TYPE_DEFAULT_GATING } from '@/types/onboarding-templates';
import { useStorage } from '@/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { safeExternalUrl } from '@/lib/utils';

interface BlueprintItem {
  id: string;
  title: string;
  itemType: string;
  priority: string;
  dayOffset: number;
  instructions: string;
  hyperlink: string;
  headerImageUrl: string;
  backgroundColor: string;
  mediaUrl: string;
  mediaType: string;
  requiresDocumentUpload: boolean;
  documentCategory: string;
  interactiveContent?: any;
  isExpanded?: boolean;
}

interface BlueprintPhase {
  id: string;
  phaseNumber: number;
  name: string;
  startDay: number;
  endDay: number;
  items: BlueprintItem[];
  isExpanded?: boolean;
}

interface BlueprintEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (blueprint: any) => void;
  isDarkMode: boolean;
  orgId: string;
  existingBlueprint?: any;
}

export default function BlueprintEditor({
  isOpen,
  onClose,
  onSave,
  isDarkMode,
  orgId,
  existingBlueprint,
}: BlueprintEditorProps) {
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [phases, setPhases] = useState<BlueprintPhase[]>([]);
  const [applyToActive, setApplyToActive] = useState(false);

  // ── Media Upload State ──
  const storage = useStorage();
  const [uploadingField, setUploadingField] = useState<string | null>(null); // "media_{itemId}" or "header_{itemId}"
  const [uploadProgress, setUploadProgress] = useState(0);
  const mediaInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /** Upload a file to Firebase Storage and return the download URL. */
  const uploadMedia = async (
    file: File,
    itemId: string,
    fieldType: 'media' | 'header',
    phaseId: string,
  ) => {
    if (!storage) return;
    const uploadKey = `${fieldType}_${itemId}`;
    setUploadingField(uploadKey);
    setUploadProgress(0);

    try {
      const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const path = `onboarding_media/${orgId}/${itemId}/${fileId}_${file.name}`;
      const sRef = storageRef(storage, path);
      const uploadTask = uploadBytesResumable(sRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress(pct);
          },
          (error) => reject(error),
          async () => {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

            // Determine media type from file
            let mediaType = '';
            if (file.type.startsWith('video/')) mediaType = 'video';
            else if (file.type.startsWith('image/')) mediaType = 'image';
            else if (file.type === 'application/pdf') mediaType = 'pdf';

            if (fieldType === 'media') {
              handleUpdateItem(phaseId, itemId, { mediaUrl: downloadUrl, mediaType });
            } else {
              handleUpdateItem(phaseId, itemId, { headerImageUrl: downloadUrl });
            }
            resolve();
          },
        );
      });
    } catch (err) {
      console.error('[BlueprintEditor] Upload failed:', err);
      alert('Upload failed. Please try again.');
    } finally {
      setUploadingField(null);
      setUploadProgress(0);
    }
  };

  useEffect(() => {
    if (existingBlueprint) {
      setRoleName(existingBlueprint.roleName || '');
      setDescription(existingBlueprint.description || '');
      if (existingBlueprint.phases && existingBlueprint.phases.length > 0) {
        setPhases(existingBlueprint.phases);
      } else if (existingBlueprint.steps && existingBlueprint.steps.length > 0) {
        const phaseDefs: any[] = existingBlueprint.phaseDefinitions || [];
        const phaseNumbersFromSteps = existingBlueprint.steps.map((s: any) => s.phase);
        const phaseNumbersFromDefs = phaseDefs.map((d: any) => d.phaseNumber);
        const uniquePhaseNumbers = Array.from(new Set([...phaseNumbersFromDefs, ...phaseNumbersFromSteps])) as number[];
        uniquePhaseNumbers.sort((a, b) => a - b);

        const reconstructed: BlueprintPhase[] = uniquePhaseNumbers.map((pNum) => {
          const def = phaseDefs.find((d: any) => d.phaseNumber === pNum);
          const phaseSteps = existingBlueprint.steps.filter((s: any) => s.phase === pNum);
          return {
            id: crypto.randomUUID(),
            phaseNumber: pNum,
            name: def?.name || `Phase ${pNum}`,
            startDay: def?.dayRangeStart ?? (phaseSteps[0]?.dayOffset || 0),
            endDay: def?.dayRangeEnd ?? (phaseSteps[phaseSteps.length - 1]?.dayOffset || 7),
            isExpanded: true,
            items: phaseSteps.map((step: any) => ({
              id: step.id || crypto.randomUUID(),
              title: step.title || '',
              itemType: step.itemType || 'action_item',
              priority: step.priority || 'Medium',
              dayOffset: step.dayOffset ?? 0,
              instructions: step.instructions || step.description || '',
              hyperlink: step.hyperlink || step.sopUrl || '',
              headerImageUrl: step.headerImageUrl || '',
              backgroundColor: step.backgroundColor || '#ffffff',
              mediaUrl: step.mediaUrl || '',
              mediaType: step.mediaType || '',
              requiresDocumentUpload: step.requiresDocumentUpload || false,
              documentCategory: step.documentCategory || '',
              interactiveContent: step.interactiveContent || undefined,
              isExpanded: false,
            })),
          };
        });
        setPhases(reconstructed);
      } else {
        setPhases([]);
      }
    } else {
      setRoleName('');
      setDescription('');
      setPhases([
        {
          id: crypto.randomUUID(),
          phaseNumber: 1,
          name: 'Pre-boarding',
          startDay: -7,
          endDay: 0,
          isExpanded: true,
          items: [],
        },
      ]);
    }
  }, [existingBlueprint]);

  if (!isOpen) return null;

  const handleAddPhase = () => {
    const newPhaseNumber = phases.length + 1;
    setPhases([
      ...phases,
      {
        id: crypto.randomUUID(),
        phaseNumber: newPhaseNumber,
        name: `Phase ${newPhaseNumber}`,
        startDay: 0,
        endDay: 7,
        isExpanded: true,
        items: [],
      },
    ]);
  };

  const handleUpdatePhase = (phaseId: string, updates: Partial<BlueprintPhase>) => {
    setPhases(phases.map(p => p.id === phaseId ? { ...p, ...updates } : p));
  };

  const handleDeletePhase = (phaseId: string) => {
    if (confirm('Are you sure you want to delete this phase and all its items?')) {
      setPhases(phases.filter(p => p.id !== phaseId).map((p, idx) => ({ ...p, phaseNumber: idx + 1 })));
    }
  };

  const handleAddItem = (phaseId: string) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          items: [
            ...p.items,
            {
              id: crypto.randomUUID(),
              title: 'New Item',
              itemType: 'action_item',
              priority: 'Medium',
              dayOffset: p.startDay,
              instructions: '',
              hyperlink: '',
              headerImageUrl: '',
              backgroundColor: '#ffffff',
              mediaUrl: '',
              mediaType: '',
              requiresDocumentUpload: false,
              documentCategory: '',
              isExpanded: true,
            },
          ],
        };
      }
      return p;
    }));
  };

  const handleUpdateItem = (phaseId: string, itemId: string, updates: Partial<BlueprintItem>) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          items: p.items.map(item => item.id === itemId ? { ...item, ...updates } : item),
        };
      }
      return p;
    }));
  };

  const handleDeleteItem = (phaseId: string, itemId: string) => {
    setPhases(phases.map(p => {
      if (p.id === phaseId) {
        return {
          ...p,
          items: p.items.filter(item => item.id !== itemId),
        };
      }
      return p;
    }));
  };

  // Validation errors — tracks which fields are invalid for red-border highlighting
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  const handleSave = () => {
    const errors: Record<string, boolean> = {};

    // Validate role name
    if (!roleName.trim()) {
      errors['roleName'] = true;
    }

    // Validate each phase has a name and at least one item
    phases.forEach((phase) => {
      if (!phase.name.trim()) {
        errors[`phase_${phase.id}_name`] = true;
      }
      phase.items.forEach((item) => {
        if (!item.title.trim() || item.title === 'New Item') {
          errors[`item_${item.id}_title`] = true;
        }
      });
    });

    // If any errors, highlight them and stop
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Clear validation errors
    setValidationErrors({});

    // Transform phases → flat steps[] + phaseDefinitions[] for the API
    const steps = phases.flatMap((phase) =>
      phase.items.map(({ isExpanded, ...item }) => ({
        id: item.id,
        phase: phase.phaseNumber,
        title: item.title,
        description: item.instructions || '',
        priority: item.priority || 'Medium',
        dayOffset: item.dayOffset || 0,
        requiresDocumentUpload: item.requiresDocumentUpload || false,
        ...(item.documentCategory ? { documentCategory: item.documentCategory } : {}),
        ...(item.hyperlink ? { sopUrl: item.hyperlink, hyperlink: item.hyperlink } : {}),
        ...(item.itemType ? { itemType: item.itemType } : {}),
        ...(item.instructions ? { instructions: item.instructions } : {}),
        ...(item.headerImageUrl ? { headerImageUrl: item.headerImageUrl } : {}),
        ...(item.backgroundColor && item.backgroundColor !== '#ffffff' ? { backgroundColor: item.backgroundColor } : {}),
        ...(item.mediaUrl ? { mediaUrl: item.mediaUrl } : {}),
        ...(item.mediaType ? { mediaType: item.mediaType } : {}),
        ...(item.interactiveContent ? { interactiveContent: item.interactiveContent } : {}),
        completionGating: item.requiresDocumentUpload
          ? 'upload_required'
          : (item.itemType && ITEM_TYPE_DEFAULT_GATING[item.itemType])
            ? ITEM_TYPE_DEFAULT_GATING[item.itemType]
            : 'self',
      }))
    );

    const phaseDefinitions = phases.map(({ isExpanded, items, ...p }) => ({
      phaseNumber: p.phaseNumber,
      name: p.name,
      dayRangeStart: p.startDay,
      dayRangeEnd: p.endDay,
    }));

    onSave({
      id: existingBlueprint?.id,
      orgId,
      roleName,
      description,
      steps,
      phaseDefinitions,
      applyToActive,
    });
  };

  const inputClass = (errorKey?: string) => `w-full px-3 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors ${
    errorKey && validationErrors[errorKey]
      ? 'border-red-500 ring-2 ring-red-500/30 bg-red-50/10'
      : isDarkMode 
        ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' 
        : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl border flex flex-col animate-in zoom-in-95 duration-200 ${
          isDarkMode ? 'bg-slate-900 border-slate-700/80 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`shrink-0 flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <h2 className="text-xl font-bold">
            {existingBlueprint ? `Edit Blueprint: ${existingBlueprint.roleName}` : 'Create New Blueprint'}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Blueprint
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Basic Info */}
          <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200/80'}`}>
            <h3 className="text-lg font-bold mb-4">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${validationErrors['roleName'] ? 'text-red-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Role Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={roleName}
                  onChange={(e) => { setRoleName(e.target.value); setValidationErrors(prev => ({ ...prev, roleName: false })); }}
                  placeholder="e.g. Sales Representative"
                  className={inputClass('roleName')}
                />
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Overview of this onboarding track..."
                  className={`${inputClass()} min-h-[80px] resize-y`}
                />
              </div>
            </div>
          </div>

          {/* Phases */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Phases & Items</h3>
              <button
                onClick={handleAddPhase}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-white border hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Plus className="w-4 h-4" /> Add Phase
              </button>
            </div>

            {phases.map((phase) => (
              <div key={phase.id} className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-slate-800/30 border-slate-700/50' : 'bg-white border-slate-200/80 shadow-sm'}`}>
                {/* Phase Header */}
                <div className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 border-b ${isDarkMode ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200/50 bg-slate-50/50'}`}>
                  <button
                    onClick={() => handleUpdatePhase(phase.id, { isExpanded: !phase.isExpanded })}
                    className="p-1"
                  >
                    {phase.isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 flex flex-wrap items-center gap-3">
                    <span className="font-bold whitespace-nowrap">Phase {phase.phaseNumber}</span>
                    <input
                      type="text"
                      value={phase.name}
                      onChange={(e) => { handleUpdatePhase(phase.id, { name: e.target.value }); setValidationErrors(prev => ({ ...prev, [`phase_${phase.id}_name`]: false })); }}
                      className={`${inputClass(`phase_${phase.id}_name`)} max-w-[200px]`}
                      placeholder="Phase Name *"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs">Day</span>
                      <input
                        type="number"
                        value={phase.startDay}
                        onChange={(e) => handleUpdatePhase(phase.id, { startDay: parseInt(e.target.value) || 0 })}
                        className={`${inputClass()} w-20 text-center`}
                      />
                      <span className="text-xs">to</span>
                      <input
                        type="number"
                        value={phase.endDay}
                        onChange={(e) => handleUpdatePhase(phase.id, { endDay: parseInt(e.target.value) || 0 })}
                        className={`${inputClass()} w-20 text-center`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAddItem(phase.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" /> Item
                    </button>
                    <button
                      onClick={() => handleDeletePhase(phase.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Phase Items */}
                {phase.isExpanded && (
                  <div className="p-4 space-y-4">
                    {phase.items.length === 0 ? (
                      <div className={`text-center py-6 text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        No items in this phase yet.
                      </div>
                    ) : (
                      phase.items.map((item) => (
                        <div key={item.id} className={`rounded-lg border p-4 ${isDarkMode ? 'border-slate-700/60 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
                          
                          {/* Item Top Row */}
                          <div className="flex flex-wrap gap-3 items-center mb-4">
                            <button
                              onClick={() => handleUpdateItem(phase.id, item.id, { isExpanded: !item.isExpanded })}
                              className="p-1"
                            >
                              {item.isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => { handleUpdateItem(phase.id, item.id, { title: e.target.value }); setValidationErrors(prev => ({ ...prev, [`item_${item.id}_title`]: false })); }}
                              placeholder="Item Title *"
                              className={`${inputClass(`item_${item.id}_title`)} flex-1 min-w-[200px]`}
                            />
                            <select
                              value={item.itemType}
                              onChange={(e) => {
                                const newType = e.target.value;
                                const updates: Partial<BlueprintItem> = { itemType: newType };
                                // Clear interactiveContent when switching types
                                if (newType !== item.itemType) {
                                  updates.interactiveContent = undefined;
                                }
                                handleUpdateItem(phase.id, item.id, updates);
                              }}
                              className={inputClass() + ' w-auto'}
                            >
                              <optgroup label="Standard">
                                <option value="action_item">Action Item</option>
                                <option value="document_upload">Document Upload</option>
                                <option value="video_watch">Video</option>
                                <option value="reading">Reading / SOP</option>
                                <option value="shadowing_session">Shadowing</option>
                                <option value="form_sign">Form to Sign</option>
                              </optgroup>
                              <optgroup label="Interactive">
                                <option value="quiz">Quiz / Knowledge Check</option>
                                <option value="short_answer">Short Answer Response</option>
                                <option value="form">Form / Data Collection</option>
                                <option value="checklist">Checklist (Multi-step)</option>
                                <option value="policy_acknowledgment">Policy / E-Signature</option>
                                <option value="external_verification">External Verification</option>
                                <option value="recorded_response">Recorded Response</option>
                              </optgroup>
                            </select>
                            <select
                              value={item.priority}
                              onChange={(e) => handleUpdateItem(phase.id, item.id, { priority: e.target.value })}
                              className={inputClass() + ' w-auto'}
                            >
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                              <option value="Critical">Critical</option>
                            </select>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold">Day Offset</span>
                              <input
                                type="number"
                                value={item.dayOffset}
                                onChange={(e) => handleUpdateItem(phase.id, item.id, { dayOffset: parseInt(e.target.value) || 0 })}
                                className={`${inputClass()} w-20 text-center`}
                              />
                            </div>
                            <button
                              onClick={() => handleDeleteItem(phase.id, item.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors ml-auto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Item Details (Expanded) */}
                          {item.isExpanded && (
                            <div className="pl-8 space-y-4 pt-2 border-t border-dashed border-slate-300 dark:border-slate-700">
                              <div>
                                <label className="block text-xs font-bold mb-1">Instructions</label>
                                <textarea
                                  value={item.instructions}
                                  onChange={(e) => handleUpdateItem(phase.id, item.id, { instructions: e.target.value })}
                                  className={`${inputClass()} min-h-[60px] text-sm`}
                                  placeholder="Detailed instructions for the user..."
                                />
                              </div>

                              <div className="space-y-4">
                                {/* Hyperlink */}
                                <div>
                                  <label className="block text-xs font-bold mb-1 flex items-center gap-1.5">
                                    <Link2 className="w-3.5 h-3.5" /> Hyperlink (external URL)
                                  </label>
                                  <input
                                    type="url"
                                    value={item.hyperlink}
                                    onChange={(e) => handleUpdateItem(phase.id, item.id, { hyperlink: e.target.value })}
                                    onBlur={(e) => {
                                      if (e.target.value.trim()) {
                                        handleUpdateItem(phase.id, item.id, { hyperlink: safeExternalUrl(e.target.value) });
                                      }
                                    }}
                                    className={inputClass()}
                                    placeholder="https://... (training portal, Google Doc, SOP link)"
                                  />
                                </div>

                                {/* Header Image — Upload or URL */}
                                <div>
                                  <label className="block text-xs font-bold mb-1 flex items-center gap-1.5">
                                    <ImageIcon className="w-3.5 h-3.5" /> Header Image
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="url"
                                      value={item.headerImageUrl}
                                      onChange={(e) => handleUpdateItem(phase.id, item.id, { headerImageUrl: e.target.value })}
                                      className={`${inputClass()} flex-1`}
                                      placeholder="Paste image URL or upload from device..."
                                    />
                                    <input
                                      ref={el => { mediaInputRefs.current[`header_${item.id}`] = el; }}
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) uploadMedia(file, item.id, 'header', phase.id);
                                        e.target.value = '';
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => mediaInputRefs.current[`header_${item.id}`]?.click()}
                                      disabled={uploadingField === `header_${item.id}`}
                                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                                        uploadingField === `header_${item.id}`
                                          ? 'opacity-50 cursor-not-allowed'
                                          : isDarkMode
                                            ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
                                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                      }`}
                                    >
                                      {uploadingField === `header_${item.id}` ? (
                                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {uploadProgress}%</>
                                      ) : (
                                        <><Upload className="w-3.5 h-3.5" /> Upload</>
                                      )}
                                    </button>
                                  </div>
                                  {/* Preview */}
                                  {item.headerImageUrl && (
                                    <div className="mt-2 flex items-center gap-3">
                                      <img
                                        src={item.headerImageUrl}
                                        alt="Header preview"
                                        className={`h-16 rounded-lg object-cover border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateItem(phase.id, item.id, { headerImageUrl: '' })}
                                        className="text-xs text-rose-500 hover:underline"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Media Content — Upload or URL */}
                                <div>
                                  <label className="block text-xs font-bold mb-1 flex items-center gap-1.5">
                                    <Video className="w-3.5 h-3.5" /> Media Content (Video, Image, or PDF)
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="url"
                                      value={item.mediaUrl}
                                      onChange={(e) => handleUpdateItem(phase.id, item.id, { mediaUrl: e.target.value })}
                                      className={`${inputClass()} flex-1`}
                                      placeholder="Paste URL (YouTube, video link, image URL) or upload..."
                                    />
                                    <input
                                      ref={el => { mediaInputRefs.current[`media_${item.id}`] = el; }}
                                      type="file"
                                      accept="video/*,image/*,application/pdf"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) uploadMedia(file, item.id, 'media', phase.id);
                                        e.target.value = '';
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => mediaInputRefs.current[`media_${item.id}`]?.click()}
                                      disabled={uploadingField === `media_${item.id}`}
                                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                                        uploadingField === `media_${item.id}`
                                          ? 'opacity-50 cursor-not-allowed'
                                          : isDarkMode
                                            ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
                                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                      }`}
                                    >
                                      {uploadingField === `media_${item.id}` ? (
                                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {uploadProgress}%</>
                                      ) : (
                                        <><Upload className="w-3.5 h-3.5" /> Upload</>
                                      )}
                                    </button>
                                  </div>
                                  {/* Upload progress bar */}
                                  {uploadingField === `media_${item.id}` && (
                                    <div className={`mt-2 h-2 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                      <div
                                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                      />
                                    </div>
                                  )}
                                  {/* Media preview */}
                                  {item.mediaUrl && (
                                    <div className="mt-2">
                                      {item.mediaType === 'image' || (!item.mediaType && /\.(jpg|jpeg|png|gif|webp|svg)/i.test(item.mediaUrl)) ? (
                                        <div className="flex items-center gap-3">
                                          <img
                                            src={item.mediaUrl}
                                            alt="Media preview"
                                            className={`h-20 rounded-lg object-cover border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateItem(phase.id, item.id, { mediaUrl: '', mediaType: '' })}
                                            className="text-xs text-rose-500 hover:underline"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      ) : (
                                        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                                          isDarkMode ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {item.mediaType === 'video' ? <Video className="w-4 h-4 text-indigo-500" /> : <ImageIcon className="w-4 h-4 text-indigo-500" />}
                                          <span className="truncate flex-1">{item.mediaUrl.split('/').pop()?.split('?')[0] || item.mediaUrl}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateItem(phase.id, item.id, { mediaUrl: '', mediaType: '' })}
                                            className="text-rose-500 hover:underline shrink-0"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Media Type + Bg Color row */}
                                <div className="flex gap-4">
                                  <div className="flex-1">
                                    <label className="block text-xs font-bold mb-1">Media Type</label>
                                    <select
                                      value={item.mediaType}
                                      onChange={(e) => handleUpdateItem(phase.id, item.id, { mediaType: e.target.value })}
                                      className={inputClass()}
                                    >
                                      <option value="">None</option>
                                      <option value="video">Video</option>
                                      <option value="image">Image</option>
                                      <option value="pdf">PDF</option>
                                    </select>
                                    <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                      Auto-set when uploading. Set manually for pasted URLs.
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold mb-1">Bg Color</label>
                                    <input
                                      type="color"
                                      value={item.backgroundColor || '#ffffff'}
                                      onChange={(e) => handleUpdateItem(phase.id, item.id, { backgroundColor: e.target.value })}
                                      className="h-10 w-16 p-1 rounded cursor-pointer border-slate-200 dark:border-slate-700 bg-transparent"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Interactive Content Builder (for quiz, form, checklist, etc.) */}
                              {['quiz', 'short_answer', 'form', 'checklist', 'policy_acknowledgment', 'external_verification', 'recorded_response'].includes(item.itemType) && (
                                <div className={`p-4 rounded-lg border-2 border-dashed ${isDarkMode ? 'border-indigo-500/30 bg-indigo-950/20' : 'border-indigo-300/50 bg-indigo-50/30'}`}>
                                  <h4 className={`text-sm font-bold mb-3 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                                    ✨ Interactive Content Configuration
                                  </h4>
                                  <InteractiveContentBuilder
                                    itemType={item.itemType}
                                    content={item.interactiveContent}
                                    onChange={(content) => handleUpdateItem(phase.id, item.id, { interactiveContent: content })}
                                    isDarkMode={isDarkMode}
                                  />
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-6 p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={item.requiresDocumentUpload}
                                    onChange={(e) => handleUpdateItem(phase.id, item.id, { requiresDocumentUpload: e.target.checked })}
                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                  />
                                  <span className="text-sm font-semibold">Requires Document Upload</span>
                                </label>
                                
                                {item.requiresDocumentUpload && (
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="text-xs font-bold">Category:</span>
                                    <select
                                      value={item.documentCategory}
                                      onChange={(e) => handleUpdateItem(phase.id, item.id, { documentCategory: e.target.value })}
                                      className={`${inputClass()} max-w-xs`}
                                    >
                                      <option value="">Select Category...</option>
                                      <option value="w4">W-4 Form</option>
                                      <option value="i9">I-9 Form</option>
                                      <option value="id_photo">ID / Passport</option>
                                      <option value="direct_deposit">Direct Deposit</option>
                                      <option value="offer_letter">Offer Letter</option>
                                      <option value="nda">NDA</option>
                                      <option value="other">Other</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className={`shrink-0 flex items-center justify-between px-6 py-4 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <div>
            {existingBlueprint && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToActive}
                  onChange={(e) => setApplyToActive(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                <span className="text-sm font-semibold">Apply changes to currently active new hires</span>
              </label>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm"
            >
              Save Blueprint
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
