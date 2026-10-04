'use client';

import BodyPortal, { MODAL_OVERLAY_CLASS, MODAL_OVERLAY_STYLE } from './BodyPortal';
import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  GraduationCap,
  Plus,
  Loader2,
  Calendar,
  User,
  Mail,
  Briefcase,
  Sparkles,
  AlertCircle,
  Check,
  Search,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/api-auth-client';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

interface BlueprintOption {
  id: string;
  roleName: string;
  steps?: any[];
  phases?: any[];
  isSystem?: boolean;
  isCustom?: boolean;
}

interface OrgMember {
  uid: string;
  email: string;
  displayName: string;
  role: string;
}

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  isDarkMode: boolean;
  currentUserId?: string;
  currentUserEmail?: string;
  currentUserName?: string;
  onSuccess: (result: any) => void;
}

export default function InviteMemberModal({
  isOpen,
  onClose,
  orgId,
  isDarkMode,
  currentUserId,
  currentUserEmail,
  currentUserName,
  onSuccess,
}: InviteMemberModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic blueprint loading
  const [blueprints, setBlueprints] = useState<BlueprintOption[]>([]);
  const [loadingBlueprints, setLoadingBlueprints] = useState(true);

  // ── Supervisor assignment (Phase 1, Step 1.1) ──
  const [supervisorUid, setSupervisorUid] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorSearch, setSupervisorSearch] = useState('');
  const [isSupervisorDropdownOpen, setIsSupervisorDropdownOpen] = useState(false);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Fetch org members for supervisor dropdown
  const firestore = useFirestore();
  useEffect(() => {
    if (!isOpen || !orgId || !firestore) return;
    setLoadingMembers(true);

    const membersRef = collection(firestore, `orgs/${orgId}/members`);
    const unsub = onSnapshot(
      query(membersRef),
      (snapshot) => {
        const members: OrgMember[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            email: data.email || '',
            displayName: data.displayName || '',
            role: (data.role as string) || 'user',
          };
        });
        setOrgMembers(members);
        setLoadingMembers(false);
      },
      (err) => {
        console.error('[InviteMemberModal] Members fetch error:', err);
        setLoadingMembers(false);
      }
    );

    return () => unsub();
  }, [isOpen, orgId, firestore]);

  // Filtered members for supervisor search (exclude the new hire being onboarded)
  const filteredMembers = useMemo(() => {
    const searchLower = supervisorSearch.toLowerCase().trim();
    return orgMembers
      .filter((m) => m.email.toLowerCase() !== email.toLowerCase()) // don't show the new hire
      .filter((m) => {
        if (!searchLower) return true;
        return (
          m.displayName.toLowerCase().includes(searchLower) ||
          m.email.toLowerCase().includes(searchLower)
        );
      });
  }, [orgMembers, supervisorSearch, email]);

  // Fetch all available blueprints (system + custom) from the API
  useEffect(() => {
    if (!isOpen || !orgId) return;

    const fetchBlueprints = async () => {
      setLoadingBlueprints(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/onboarding/blueprints?orgId=${orgId}`, { headers });
        if (res.ok) {
          const data = await res.json();
          const bps: BlueprintOption[] = data.blueprints || [];
          setBlueprints(bps);
          // Auto-select the first blueprint if none selected
          if (bps.length > 0 && selectedTemplateIds.length === 0) {
            setSelectedTemplateIds([bps[0].id]);
          }
        }
      } catch (err) {
        console.error('[InviteMemberModal] Failed to fetch blueprints:', err);
      } finally {
        setLoadingBlueprints(false);
      }
    };

    fetchBlueprints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orgId]);

  if (!isOpen) return null;

  const getStepCount = (bp: BlueprintOption): number => {
    if (bp.steps?.length) return bp.steps.length;
    if (bp.phases) return bp.phases.reduce((sum: number, p: any) => sum + (p.items?.length || 0), 0);
    return 0;
  };

  const toggleBlueprint = (bpId: string) => {
    setSelectedTemplateIds(prev => {
      if (prev.includes(bpId)) {
        // Don't allow deselecting the last one
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== bpId);
      }
      return [...prev, bpId];
    });
  };

  // Quick test fill helper
  const handleFillMyself = () => {
    if (currentUserEmail) setEmail(currentUserEmail);
    if (currentUserName) setFullName(currentUserName);
    else if (currentUserEmail) setFullName(currentUserEmail.split('@')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !startDate || selectedTemplateIds.length === 0) {
      setError('Please fill out all required fields and select at least one blueprint.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      // UID resolution happens server-side via admin.auth().getUserByEmail()
      // We only pass a hint if the admin is onboarding themselves
      const targetUid = (email.trim().toLowerCase() === currentUserEmail?.toLowerCase() && currentUserId)
        ? currentUserId
        : '';

      const res = await fetch('/api/onboarding/instantiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          orgId,
          targetUserId: targetUid || undefined,
          targetUserEmail: email.trim().toLowerCase(),
          targetUserName: fullName.trim(),
          templateIds: selectedTemplateIds,
          startDate,
          // Supervisor assignment — maps to mentorUid/mentorEmail in the backend
          ...(supervisorUid ? { mentorUid: supervisorUid, mentorEmail: supervisorEmail } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to instantiate onboarding track');
      }

      onSuccess(data);
      onClose();
    } catch (err: any) {
      console.error('[Invite Modal] Error:', err);
      setError(err.message || 'Failed to create onboarding track. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BodyPortal>
    <div className={MODAL_OVERLAY_CLASS} style={MODAL_OVERLAY_STYLE}>
      <div
        className={`my-auto w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-200 ${
          isDarkMode ? 'bg-slate-900 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDarkMode ? 'border-slate-800 bg-slate-850' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
            }`}>
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Start Onboarding Track</h3>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Instantiate a role-specific checklist on the Action Board
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Fill myself shortcut */}
          {currentUserEmail && (
            <div className="flex items-center justify-between pb-1">
              <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Testing this track?</span>
              <button
                type="button"
                onClick={handleFillMyself}
                className="text-xs font-semibold text-indigo-500 hover:text-indigo-400 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" /> Fill with my account ({currentUserEmail})
              </button>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold mb-1.5">New Hire Full Name *</label>
            <div className="relative">
              <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                required
                placeholder="e.g. Sarah Jenkins"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-xs font-medium border ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold mb-1.5">Email Address *</label>
            <div className="relative">
              <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="email"
                required
                placeholder="e.g. sjenkins@nxtchapter.org"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-xs font-medium border ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
              />
            </div>
          </div>

          {/* Blueprint Multi-Select */}
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              Role / Onboarding Blueprint{selectedTemplateIds.length > 1 ? 's' : ''} *
              {selectedTemplateIds.length > 1 && (
                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                }`}>
                  {selectedTemplateIds.length} selected
                </span>
              )}
            </label>
            {loadingBlueprints ? (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading blueprints...</span>
              </div>
            ) : blueprints.length === 0 ? (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  No blueprints found. Create one in the Blueprints Library first.
                </span>
              </div>
            ) : (
              <div className={`rounded-xl border overflow-hidden ${
                isDarkMode ? 'border-slate-700' : 'border-slate-200'
              }`}>
                <div className="max-h-[180px] overflow-y-auto">
                  {blueprints.map(bp => {
                    const isSelected = selectedTemplateIds.includes(bp.id);
                    const stepCount = getStepCount(bp);
                    return (
                      <button
                        key={bp.id}
                        type="button"
                        onClick={() => toggleBlueprint(bp.id)}
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
                        {/* Checkbox indicator */}
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600'
                            : isDarkMode
                              ? 'border-slate-600 bg-slate-800'
                              : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>

                        {/* Blueprint info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Briefcase className={`w-3.5 h-3.5 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                            <span className={`text-xs font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {bp.roleName}
                            </span>
                          </div>
                        </div>

                        {/* Step count + type badge */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {stepCount} steps
                          </span>
                          {bp.isSystem && (
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
                            }`}>
                              System
                            </span>
                          )}
                          {bp.isCustom && (
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                            }`}>
                              Custom
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <p className={`text-[10px] mt-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Select one or more blueprints to assign. Multiple blueprints will create separate tracks.
            </p>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-semibold mb-1.5">Start Date *</label>
            <div className="relative">
              <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="date"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-xs font-medium border ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
              />
            </div>
            <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Task due dates will be automatically scheduled relative to this date.
            </p>
          </div>

          {/* ── Supervisor Assignment (Phase 1, Step 1.1) ── */}
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              <div className="flex items-center gap-1.5">
                <Shield className={`w-3.5 h-3.5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500'}`} />
                Assign Supervisor
                <span className={`text-[10px] font-normal ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>(optional)</span>
              </div>
            </label>

            {supervisorUid ? (
              /* ── Selected Supervisor Display ── */
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                isDarkMode ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-indigo-50/80 border-indigo-200'
              }`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isDarkMode ? 'bg-indigo-800 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {supervisorName?.[0]?.toUpperCase() || supervisorEmail?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {supervisorName || 'Unknown'}
                  </p>
                  <p className={`text-[10px] truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {supervisorEmail}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSupervisorUid('');
                    setSupervisorEmail('');
                    setSupervisorName('');
                    setSupervisorSearch('');
                  }}
                  className={`p-1 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* ── Supervisor Search Combobox ── */
              <div className="relative">
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={supervisorSearch}
                    onChange={(e) => {
                      setSupervisorSearch(e.target.value);
                      setIsSupervisorDropdownOpen(true);
                    }}
                    onFocus={() => setIsSupervisorDropdownOpen(true)}
                    className={`w-full pl-9 pr-9 py-2.5 rounded-xl text-xs font-medium border ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                  />
                  <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-transform ${
                    isSupervisorDropdownOpen ? 'rotate-180' : ''
                  } ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                </div>

                {/* Dropdown list */}
                {isSupervisorDropdownOpen && (
                  <>
                    {/* Invisible backdrop to close dropdown */}
                    <div className="fixed inset-0 z-10" onClick={() => setIsSupervisorDropdownOpen(false)} />
                    <div className={`absolute z-20 w-full mt-1 rounded-xl border shadow-xl overflow-hidden ${
                      isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                    }`}>
                      <div className="max-h-[160px] overflow-y-auto">
                        {loadingMembers ? (
                          <div className={`flex items-center gap-2 px-4 py-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                            <span className="text-xs">Loading members...</span>
                          </div>
                        ) : filteredMembers.length === 0 ? (
                          <div className={`px-4 py-3 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {supervisorSearch ? 'No members match your search.' : 'No other members in this organization.'}
                          </div>
                        ) : (
                          filteredMembers.map((member) => (
                            <button
                              key={member.uid}
                              type="button"
                              onClick={() => {
                                setSupervisorUid(member.uid);
                                setSupervisorEmail(member.email);
                                setSupervisorName(member.displayName || member.email.split('@')[0]);
                                setSupervisorSearch('');
                                setIsSupervisorDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b last:border-b-0 cursor-pointer ${
                                isDarkMode
                                  ? 'hover:bg-slate-700 border-slate-700/50'
                                  : 'hover:bg-slate-50 border-slate-100'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {(member.displayName?.[0] || member.email[0])?.toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {member.displayName || member.email.split('@')[0]}
                                </p>
                                <p className={`text-[10px] truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {member.email}
                                </p>
                              </div>
                              {(member.role === 'admin' || member.role === 'oracle') && (
                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                  isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                                }`}>
                                  {member.role === 'oracle' ? 'Oracle' : 'Admin'}
                                </span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <p className={`text-[10px] mt-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              The supervisor can monitor progress, review submissions, countersign documents, and send items back for correction.
            </p>
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-end gap-3 pt-4 border-t ${
            isDarkMode ? 'border-slate-800' : 'border-slate-100'
          }`}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedTemplateIds.length === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-[0.98] ${
                isSubmitting || selectedTemplateIds.length === 0
                  ? 'opacity-50 cursor-not-allowed bg-indigo-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Track{selectedTemplateIds.length > 1 ? 's' : ''}...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    Start {selectedTemplateIds.length > 1
                      ? `${selectedTemplateIds.length} Onboarding Tracks`
                      : 'Onboarding Track'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    </BodyPortal>
  );
}
