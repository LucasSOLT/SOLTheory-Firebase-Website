'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/api-auth-client';
import { SYSTEM_TEMPLATES } from '@/lib/onboarding-templates-registry';

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
  const [templateId, setTemplateId] = useState('nxtchapter_peer_recovery_coach');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const availableTemplates = SYSTEM_TEMPLATES.filter(t => t.orgId === orgId || t.orgId === 'nxtchapter');

  // Quick test fill helper
  const handleFillMyself = () => {
    if (currentUserEmail) setEmail(currentUserEmail);
    if (currentUserName) setFullName(currentUserName);
    else if (currentUserEmail) setFullName(currentUserEmail.split('@')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !startDate) {
      setError('Please fill out all required fields.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const targetUid = (email.trim().toLowerCase() === currentUserEmail?.toLowerCase() && currentUserId)
        ? currentUserId
        : `user_${Date.now()}`;

      const res = await fetch('/api/onboarding/instantiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          orgId,
          targetUserId: targetUid,
          targetUserEmail: email.trim().toLowerCase(),
          targetUserName: fullName.trim(),
          templateId,
          startDate,
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-200 ${
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          {/* Template Selector */}
          <div>
            <label className="block text-xs font-semibold mb-1.5">Role / Onboarding Blueprint *</label>
            <div className="relative">
              <Briefcase className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <select
                value={templateId}
                onChange={e => setTemplateId(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-xs font-medium border appearance-none ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
              >
                {availableTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.roleName} ({t.steps.length} steps)
                  </option>
                ))}
              </select>
            </div>
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
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-[0.98] ${
                isSubmitting
                  ? 'opacity-50 cursor-not-allowed bg-indigo-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Track...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start Onboarding Track</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
