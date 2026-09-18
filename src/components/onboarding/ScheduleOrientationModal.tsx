'use client';

import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  Video,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/api-auth-client';

interface ScheduleOrientationModalProps {
  isOpen: boolean;
  onClose: () => void;
  instance: {
    id: string;
    userName: string;
    roleName: string;
    userEmail: string;
    mentorEmail?: string;
    startedAt?: any;
    hasCalendarScheduled?: boolean;
  };
  orgId: string;
  isDarkMode: boolean;
  onSuccess?: () => void;
}

export default function ScheduleOrientationModal({
  isOpen,
  onClose,
  instance,
  orgId,
  isDarkMode,
  onSuccess,
}: ScheduleOrientationModalProps) {
  const [startDate, setStartDate] = useState(() => {
    if (instance.startedAt) {
      try {
        const d = typeof instance.startedAt.toDate === 'function' ? instance.startedAt.toDate() : new Date(instance.startedAt);
        return d.toISOString().split('T')[0];
      } catch {
        return new Date().toISOString().split('T')[0];
      }
    }
    return new Date().toISOString().split('T')[0];
  });

  const [addGoogleMeet, setAddGoogleMeet] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdEvents, setCreatedEvents] = useState<any[] | null>(null);

  if (!isOpen) return null;

  const handleSchedule = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/calendar/schedule-orientation', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId,
          instanceId: instance.id,
          startDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to schedule calendar events');
      }

      setCreatedEvents(data.createdEvents || []);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred while scheduling meetings');
    } finally {
      setLoading(false);
    }
  };

  const cardBg = isDarkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50/80 border-slate-200/80';
  const textMuted = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ${
          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-slate-800 bg-slate-800/40' : 'border-slate-100 bg-slate-50/50'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-amber-950/50 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                Schedule Orientation Milestones
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-semibold">Bobby Engine</span>
              </h3>
              <p className={`text-xs ${textMuted}`}>Auto-schedule meetings on Google Calendar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Scheduling Error</p>
                <p className="text-xs mt-0.5 opacity-90">{error}</p>
              </div>
            </div>
          )}

          {createdEvents ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold">Orientation Meetings Scheduled!</h4>
                <p className={`text-xs mt-1 ${textMuted}`}>
                  Google Calendar invites have been created and sent to {instance.userName}.
                </p>
              </div>

              <div className="space-y-2 text-left pt-2">
                {createdEvents.map((ev, idx) => (
                  <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between ${cardBg}`}>
                    <div>
                      <p className="text-xs font-bold">{ev.title}</p>
                      <p className={`text-[11px] ${textMuted}`}>
                        {new Date(ev.start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {ev.hangoutLink && (
                        <a
                          href={ev.hangoutLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-indigo-500 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Video className="w-3.5 h-3.5" /> Meet
                        </a>
                      )}
                      {ev.htmlLink && (
                        <a
                          href={ev.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Employee card */}
              <div className={`p-4 rounded-xl border ${cardBg}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold">{instance.userName}</span>
                    <span className={`block text-xs ${textMuted}`}>{instance.roleName} • {instance.userEmail}</span>
                  </div>
                  {instance.mentorEmail && (
                    <span className="text-[11px] px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-500 font-medium">
                      Mentor: {instance.mentorEmail}
                    </span>
                  )}
                </div>
              </div>

              {/* Start date configuration */}
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>
                  Target Start / Orientation Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              {/* Preview of meetings */}
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>
                  Planned Milestone Meetings
                </label>
                <div className="space-y-2">
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${cardBg}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">👋</span>
                      <div>
                        <p className="text-xs font-bold">Day 1 Orientation</p>
                        <p className={`text-[11px] ${textMuted}`}>9:00 AM - 10:30 AM • Introductions & Systems</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-500">Day 1</span>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-center justify-between ${cardBg}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📊</span>
                      <div>
                        <p className="text-xs font-bold">Week 1 Milestone Review</p>
                        <p className={`text-[11px] ${textMuted}`}>10:00 AM - 10:45 AM • Phase 1 Review & Roadblocks</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-indigo-500">Day 7</span>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-center justify-between ${cardBg}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🏁</span>
                      <div>
                        <p className="text-xs font-bold">30-Day Check-in</p>
                        <p className={`text-[11px] ${textMuted}`}>2:00 PM - 3:00 PM • Roadmap Review & Feedback</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-violet-500">Day 30</span>
                  </div>
                </div>
              </div>

              {/* Google Meet Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="meetToggle"
                  checked={addGoogleMeet}
                  onChange={(e) => setAddGoogleMeet(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="meetToggle" className={`text-xs font-medium cursor-pointer ${textMuted}`}>
                  Automatically generate Google Meet links for all sessions
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scheduling Meetings...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Schedule 3 Milestone Meetings
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
