"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Brain, Building2, MessageSquare, Wrench, Target, 
  Shield, Check, Loader2, Save, Lock, ChevronRight, User 
} from 'lucide-react';
import { useUser } from '@/firebase';
import { getAuthHeaders } from '@/lib/api-auth-client';
import { 
  PERSONAL_BRAIN_QUESTIONS, 
  ORG_BRAIN_QUESTIONS, 
  getCategories, 
  countAnswered,
  type BrainQuestion, 
  type BrainProfileAnswers 
} from '@/lib/brain-questions';

interface BrainProfileFormProps {
  scope: 'personal' | 'org';
  orgId: string;
  isDark?: boolean;
  readOnly?: boolean;
}

export default function BrainProfileForm({ scope, orgId, isDark, readOnly }: BrainProfileFormProps) {
  const { user } = useUser();
  const [answers, setAnswers] = useState<BrainProfileAnswers>({});
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  const questions = scope === 'personal' ? PERSONAL_BRAIN_QUESTIONS : ORG_BRAIN_QUESTIONS;
  const categories = getCategories(questions);
  const [activeCategory, setActiveCategory] = useState<string>(categories[0] || '');
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/brain-profile?scope=${scope}&orgId=${orgId}`, {
          headers
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.answers) {
            setAnswers(data.answers);
          }
        }
      } catch (err) {
        console.error("Failed to load brain profile", err);
      } finally {
        setIsLoading(false);
      }
    }
    if (user) {
      loadData();
    }
  }, [scope, orgId, user]);

  const autoSave = useCallback(async (newAnswers: BrainProfileAnswers) => {
    if (readOnly) return;
    setSaveStatus('saving');
    try {
      const headers = await getAuthHeaders();
      headers['Content-Type'] = 'application/json';
      
      const res = await fetch(`/api/brain-profile`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          scope,
          orgId,
          answers: newAnswers,
          entityName: user?.displayName || 'User'
        })
      });
      
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error("Save error", err);
      setSaveStatus('error');
    }
  }, [scope, orgId, user, readOnly]);

  const handleChange = (questionId: string, value: string | string[]) => {
    if (readOnly) return;
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      autoSave(newAnswers);
    }, 2000);
  };

  const getCategoryIcon = (category: string) => {
    if (category.includes('Identity')) return scope === 'personal' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />;
    if (category.includes('Communication') || category.includes('Brand Voice')) return <MessageSquare className="w-4 h-4" />;
    if (category.includes('Habits') || category.includes('Products')) return <Wrench className="w-4 h-4" />;
    if (category.includes('Goals') || category.includes('Team')) return <Target className="w-4 h-4" />;
    if (category.includes('Boundaries') || category.includes('Tech Stack')) return <Shield className="w-4 h-4" />;
    return <Brain className="w-4 h-4" />;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 w-full h-64">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
        <p className={`mt-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading brain profile...</p>
      </div>
    );
  }

  const answeredCount = countAnswered(questions, answers);
  const progressPercent = Math.round((answeredCount / questions.length) * 100) || 0;
  
  const isPersonal = scope === 'personal';
  const progressColorClass = isPersonal ? 'bg-indigo-500' : 'bg-blue-500';
  const iconColorClass = isPersonal ? 'text-indigo-500' : 'text-blue-500';

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {readOnly && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium
          ${isDark ? 'bg-amber-900/30 text-amber-200 border border-amber-800/50' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
          <Lock className="w-4 h-4" />
          <span>View-Only Mode — Only organization admins can edit this profile.</span>
        </div>
      )}

      {/* Progress & Status */}
      <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <Brain className={`w-5 h-5 ${iconColorClass}`} />
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Profile Completeness
            </h3>
          </div>
          <div className="text-sm font-medium text-slate-500">
            {answeredCount} of {questions.length} answered ({progressPercent}%)
          </div>
        </div>
        <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <div 
            className={`h-full ${progressColorClass} transition-all duration-500 ease-out`} 
            style={{ width: `${progressPercent}%` }} 
          />
        </div>
        
        {/* Status Indicator */}
        <div className="mt-3 flex items-center h-5">
          {saveStatus === 'saving' && (
            <span className="flex items-center text-xs text-slate-500 gap-1.5 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving changes...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className={`flex items-center text-xs gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              <Check className="w-3 h-3" /> All changes saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className={`flex items-center text-xs gap-1.5 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
              Error saving changes. Please try again.
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          
          let tabClass = '';
          if (isActive) {
            tabClass = isPersonal ? 'bg-indigo-500 text-white shadow-sm' : 'bg-blue-500 text-white shadow-sm';
          } else {
            tabClass = isDark
              ? 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
              : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900';
          }

          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${tabClass}`}
            >
              {getCategoryIcon(cat)}
              {cat}
            </button>
          );
        })}
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions
          .filter((q) => q.category === activeCategory)
          .map((q) => {
            const val = answers[q.key];
            
            return (
              <div 
                key={q.key} 
                className={`p-5 rounded-xl border transition-all
                  ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}
                  ${!readOnly && 'hover:border-slate-300 dark:hover:border-slate-700'}
                `}
              >
                <div className="mb-4">
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {q.label}
                  </label>
                  {q.hint && (
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {q.hint}
                    </p>
                  )}
                </div>

                {q.type === 'text' && (
                  <input
                    type="text"
                    disabled={readOnly}
                    value={(val as string) || ''}
                    onChange={(e) => handleChange(q.key, e.target.value)}
                    placeholder={q.placeholder || "Your answer..."}
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:outline-none transition-colors
                      ${readOnly ? 'opacity-75 cursor-not-allowed' : ''}
                      ${isDark 
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-slate-600 focus:ring-slate-700' 
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:ring-slate-200'}
                    `}
                  />
                )}

                {q.type === 'textarea' && (
                  <textarea
                    disabled={readOnly}
                    value={(val as string) || ''}
                    onChange={(e) => handleChange(q.key, e.target.value)}
                    placeholder={q.placeholder || "Your answer..."}
                    rows={3}
                    className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:outline-none transition-colors resize-y
                      ${readOnly ? 'opacity-75 cursor-not-allowed' : ''}
                      ${isDark 
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-slate-600 focus:ring-slate-700' 
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:ring-slate-200'}
                    `}
                  />
                )}

                {(q.type === 'single-select' || q.type === 'multi-select') && (
                  <div className="flex flex-wrap gap-2">
                    {q.options?.map((opt) => {
                      const isSelected = q.type === 'single-select' 
                        ? val === opt
                        : Array.isArray(val) && val.includes(opt);

                      let pillClass = '';
                      if (isSelected) {
                        pillClass = isPersonal
                          ? `bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800`
                          : `bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800`;
                      } else {
                        pillClass = isDark
                          ? 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300';
                      }

                      return (
                        <button
                          key={opt}
                          disabled={readOnly}
                          onClick={() => {
                            if (q.type === 'single-select') {
                              handleChange(q.key, isSelected ? '' : opt);
                            } else {
                              const curr = Array.isArray(val) ? val : [];
                              handleChange(q.key, isSelected 
                                ? curr.filter(x => x !== opt) 
                                : [...curr, opt]
                              );
                            }
                          }}
                          className={`
                            flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all
                            ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer'}
                            ${pillClass}
                          `}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
