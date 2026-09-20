'use client';

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MessageSquare,
  ClipboardList,
  ListChecks,
  ShieldCheck,
  Globe,
  Mic,
  Clock,
  ArrowLeft,
  Send,
  AlertTriangle,
  FileText,
  User,
  Hash,
  Calendar,
  Monitor,
  Video,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/api-auth-client';

// ── Types ───────────────────────────────────────────────────────────────────

interface AdminSubmissionViewerProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  orgId: string;
  task: {
    id: string;
    title: string;
    description?: string;
    column: string;
    assignedTo?: string;
    assignedToEmail?: string;
    metadata?: {
      phase?: number;
      itemType?: string;
      interactiveContent?: any;
      userResponse?: any[];
      reviewStatus?: string;
      reviewNotes?: string;
      reviewedByEmail?: string;
      reviewedAt?: any;
      onboardingInstanceId?: string;
    };
  };
  employeeName?: string;
  onReviewComplete: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(ts: any): string {
  if (!ts) return '—';
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch {
    return '—';
  }
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    quiz: 'Quiz',
    short_answer: 'Short Answer',
    form: 'Form Submission',
    checklist: 'Checklist',
    policy_acknowledgment: 'E-Signature / Policy',
    external_verification: 'External Verification',
    recorded_response: 'Recorded Response',
  };
  return labels[type] || type;
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'quiz': return <HelpCircle className="w-5 h-5" />;
    case 'short_answer': return <MessageSquare className="w-5 h-5" />;
    case 'form': return <ClipboardList className="w-5 h-5" />;
    case 'checklist': return <ListChecks className="w-5 h-5" />;
    case 'policy_acknowledgment': return <ShieldCheck className="w-5 h-5" />;
    case 'external_verification': return <Globe className="w-5 h-5" />;
    case 'recorded_response': return <Mic className="w-5 h-5" />;
    default: return <FileText className="w-5 h-5" />;
  }
}

function getTypeBadgeColor(type: string, isDarkMode: boolean): string {
  const colors: Record<string, string> = {
    quiz: isDarkMode ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60' : 'bg-indigo-50 text-indigo-700 border-indigo-200',
    short_answer: isDarkMode ? 'bg-sky-950/60 text-sky-300 border-sky-800/60' : 'bg-sky-50 text-sky-700 border-sky-200',
    form: isDarkMode ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    checklist: isDarkMode ? 'bg-teal-950/60 text-teal-300 border-teal-800/60' : 'bg-teal-50 text-teal-700 border-teal-200',
    policy_acknowledgment: isDarkMode ? 'bg-purple-950/60 text-purple-300 border-purple-800/60' : 'bg-purple-50 text-purple-700 border-purple-200',
    external_verification: isDarkMode ? 'bg-blue-950/60 text-blue-300 border-blue-800/60' : 'bg-blue-50 text-blue-700 border-blue-200',
    recorded_response: isDarkMode ? 'bg-rose-950/60 text-rose-300 border-rose-800/60' : 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return colors[type] || (isDarkMode ? 'bg-slate-700/50 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200');
}

// ── Sub-Viewers ─────────────────────────────────────────────────────────────

function QuizBreakdown({ response, content, isDarkMode }: { response: any; content: any; isDarkMode: boolean }) {
  const score = response.score ?? response.data?.score;
  const passed = response.passed ?? response.data?.passed;
  const gradedAnswers = response.gradedAnswers || response.data?.gradedAnswers || [];
  const attemptCount = response.data?.attemptCount || 1;
  const questions = content?.questions || [];

  return (
    <div className="space-y-4">
      {/* Score summary bar */}
      <div className={`flex items-center gap-4 p-4 rounded-xl border ${
        passed
          ? (isDarkMode ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200')
          : (isDarkMode ? 'bg-rose-950/30 border-rose-800/50' : 'bg-rose-50 border-rose-200')
      }`}>
        <div className={`text-3xl font-black ${passed ? 'text-emerald-500' : 'text-rose-500'}`}>
          {score !== undefined ? `${Math.round(score)}%` : '—'}
        </div>
        <div className="flex-1">
          <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {passed ? '✓ Passed' : '✗ Did Not Pass'}
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Passing threshold: {content?.passingScore || 80}% • Attempts: {attemptCount}
          </div>
        </div>
        {/* Score progress ring */}
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none" stroke={isDarkMode ? '#334155' : '#e2e8f0'} strokeWidth="3" />
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none" stroke={passed ? '#10b981' : '#f43f5e'}
              strokeWidth="3" strokeDasharray={`${score || 0}, 100`} strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Question-by-question breakdown */}
      {gradedAnswers.length > 0 && (
        <div className="space-y-2">
          <h4 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Question Breakdown
          </h4>
          {gradedAnswers.map((ga: any, idx: number) => {
            const question = questions.find((q: any) => q.id === ga.questionId);
            const correctOption = question?.options?.find((o: any) => o.isCorrect);
            const userOption = question?.options?.find((o: any) => o.id === ga.userAnswer || o.text === ga.userAnswer);

            return (
              <div key={ga.questionId || idx} className={`p-3 rounded-lg border ${
                ga.isCorrect
                  ? (isDarkMode ? 'border-emerald-800/40 bg-emerald-950/20' : 'border-emerald-200/60 bg-emerald-50/50')
                  : (isDarkMode ? 'border-rose-800/40 bg-rose-950/20' : 'border-rose-200/60 bg-rose-50/50')
              }`}>
                <div className="flex items-start gap-2">
                  {ga.isCorrect
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    : <XCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      Q{idx + 1}. {question?.text || `Question ${idx + 1}`}
                    </div>
                    <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      <span className="font-semibold">Their answer:</span>{' '}
                      {userOption?.text || (Array.isArray(ga.userAnswer) ? ga.userAnswer.join(', ') : ga.userAnswer) || '—'}
                    </div>
                    {!ga.isCorrect && correctOption && (
                      <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        <span className="font-semibold">Correct answer:</span> {correctOption.text}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShortAnswerViewer({ response, content, isDarkMode }: { response: any; content: any; isDarkMode: boolean }) {
  const answers = response.data?.answers || response.data || {};
  const prompts = content?.prompts || [];

  return (
    <div className="space-y-3">
      {prompts.map((prompt: any) => (
        <div key={prompt.id} className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`text-sm font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {prompt.question}
          </div>
          <div className={`text-sm whitespace-pre-wrap ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {answers[prompt.id] || <span className="italic opacity-50">No response</span>}
          </div>
        </div>
      ))}
      {/* Fallback if prompts are missing — just show raw data */}
      {prompts.length === 0 && Object.keys(answers).length > 0 && (
        Object.entries(answers).map(([key, val]) => (
          <div key={key} className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{key}</div>
            <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{String(val)}</div>
          </div>
        ))
      )}
    </div>
  );
}

function FormDataViewer({ response, content, isDarkMode }: { response: any; content: any; isDarkMode: boolean }) {
  const formData = response.data?.formData || response.data || {};
  const fields = content?.fields || [];

  return (
    <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200'}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className={isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}>
            <th className={`text-left px-4 py-2 font-bold text-xs uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Field</th>
            <th className={`text-left px-4 py-2 font-bold text-xs uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Response</th>
          </tr>
        </thead>
        <tbody>
          {fields.length > 0 ? (
            fields.map((field: any, idx: number) => (
              <tr key={field.id || idx} className={`border-t ${isDarkMode ? 'border-slate-700/40' : 'border-slate-200/60'}`}>
                <td className={`px-4 py-2.5 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{field.label}</td>
                <td className={`px-4 py-2.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  {field.fieldType === 'checkbox'
                    ? (formData[field.id] ? '✓ Yes' : '✗ No')
                    : (formData[field.id] || <span className="italic opacity-50">—</span>)
                  }
                </td>
              </tr>
            ))
          ) : (
            Object.entries(formData).map(([key, val]) => (
              <tr key={key} className={`border-t ${isDarkMode ? 'border-slate-700/40' : 'border-slate-200/60'}`}>
                <td className={`px-4 py-2.5 font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{key}</td>
                <td className={`px-4 py-2.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{String(val)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ChecklistViewer({ response, content, isDarkMode }: { response: any; content: any; isDarkMode: boolean }) {
  const checkedItems = response.data?.checkedItems || response.data || {};
  const items = content?.items || [];

  return (
    <div className="space-y-2">
      {items.map((item: any) => {
        const isChecked = !!checkedItems[item.id];
        return (
          <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border ${
            isChecked
              ? (isDarkMode ? 'border-emerald-800/40 bg-emerald-950/20' : 'border-emerald-200/50 bg-emerald-50/50')
              : (isDarkMode ? 'border-slate-700/40 bg-slate-800/30' : 'border-slate-200/50 bg-slate-50/50')
          }`}>
            {isChecked
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              : <XCircle className="w-5 h-5 text-slate-400 shrink-0" />
            }
            <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function SignatureCertificate({ response, content, isDarkMode }: { response: any; content: any; isDarkMode: boolean }) {
  const data = response.data || response;
  const signature = data.signature || data.signatureData;
  const typedName = data.typedName;
  const ipAddress = response.ipAddress || data.ipAddress;
  const userAgent = response.userAgent || data.userAgent;
  const policyHash = response.policyHash || data.policyHash;
  const submittedAt = response.submittedAt || data.timestamp;

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${isDarkMode ? 'border-purple-800/50 bg-slate-800/40' : 'border-purple-200 bg-purple-50/30'}`}>
      {/* Certificate header */}
      <div className={`px-6 py-4 border-b ${isDarkMode ? 'bg-purple-950/30 border-purple-800/40' : 'bg-purple-50 border-purple-200/60'}`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
          <h4 className={`text-sm font-bold ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
            E-Signature Certificate
          </h4>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Policy excerpt */}
        {content?.policyText && (
          <div>
            <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Policy Document
            </div>
            <div className={`text-sm max-h-32 overflow-y-auto rounded-lg p-3 border ${
              isDarkMode ? 'bg-slate-900/60 border-slate-700/50 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
            }`}>
              {content.policyText.length > 400 ? content.policyText.substring(0, 400) + '...' : content.policyText}
            </div>
          </div>
        )}

        {/* Signature image */}
        {signature && signature.startsWith('data:image') && (
          <div>
            <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Drawn Signature
            </div>
            <div className={`inline-block p-3 rounded-lg border ${isDarkMode ? 'bg-white border-slate-600' : 'bg-white border-slate-300'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signature} alt="Drawn signature" className="max-h-24 w-auto" />
            </div>
          </div>
        )}

        {/* Typed name */}
        {typedName && (
          <div className="flex items-center gap-2">
            <User className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            <div>
              <div className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Legal Name</div>
              <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{typedName}</div>
            </div>
          </div>
        )}

        {/* Audit trail details */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200'}`}>
          {submittedAt && (
            <div className="flex items-center gap-2">
              <Calendar className={`w-3.5 h-3.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <div>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Signed At</div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{formatTimestamp(submittedAt)}</div>
              </div>
            </div>
          )}
          {ipAddress && (
            <div className="flex items-center gap-2">
              <Globe className={`w-3.5 h-3.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <div>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>IP Address</div>
                <div className={`text-xs font-mono ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{ipAddress}</div>
              </div>
            </div>
          )}
          {userAgent && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <Monitor className={`w-3.5 h-3.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <div className="min-w-0">
                <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>User Agent</div>
                <div className={`text-xs truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{userAgent}</div>
              </div>
            </div>
          )}
          {policyHash && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <Hash className={`w-3.5 h-3.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <div className="min-w-0">
                <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Policy SHA-256</div>
                <div className={`text-xs font-mono truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{policyHash}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExternalVerificationViewer({ response, content, isDarkMode }: { response: any; content: any; isDarkMode: boolean }) {
  const data = response.data || {};
  return (
    <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
      {content?.externalUrl && (
        <div className="mb-3">
          <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>External URL</div>
          <a href={content.externalUrl} target="_blank" rel="noopener noreferrer"
            className={`text-sm underline ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
            {content.externalUrl}
          </a>
        </div>
      )}
      {content?.verificationMethod && (
        <div className="mb-3">
          <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Method</div>
          <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {content.verificationMethod === 'completion_code' ? 'Completion Code' :
             content.verificationMethod === 'admin_verify' ? 'Admin Verification' :
             content.verificationMethod === 'upload_certificate' ? 'Certificate Upload' :
             content.verificationMethod}
          </div>
        </div>
      )}
      {data.code && (
        <div>
          <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Code Entered</div>
          <div className={`text-sm font-mono px-3 py-1.5 rounded-lg inline-block ${isDarkMode ? 'bg-slate-700 text-emerald-400' : 'bg-slate-100 text-emerald-700'}`}>
            {data.code}
          </div>
        </div>
      )}
      {data.status === 'pending_admin_review' && (
        <div className={`flex items-center gap-2 text-sm font-semibold ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
          <Clock className="w-4 h-4" /> Awaiting admin verification
        </div>
      )}
    </div>
  );
}

function RecordedResponseViewer({ response, isDarkMode }: { response: any; isDarkMode: boolean }) {
  const data = response.data || {};
  const mediaUrl = data.mediaUrl;

  if (!mediaUrl) {
    return (
      <div className={`p-4 rounded-xl border text-sm ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
        No recording available — media may still be processing.
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
      {data.type === 'video' ? (
        <video src={mediaUrl} controls className="w-full rounded-lg max-h-80" />
      ) : (
        <audio src={mediaUrl} controls className="w-full" />
      )}
      {data.duration && (
        <div className={`text-xs mt-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Duration: {Math.round(data.duration)}s
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function AdminSubmissionViewer({
  isOpen,
  onClose,
  isDarkMode,
  orgId,
  task,
  employeeName,
  onReviewComplete,
}: AdminSubmissionViewerProps) {
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [certLoading, setCertLoading] = useState(false);
  const [certUrl, setCertUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const meta = task.metadata || {};
  const latestResponse = meta.userResponse?.[meta.userResponse.length - 1];
  const responseType = latestResponse?.type || meta.itemType || '';
  const isPendingReview = meta.reviewStatus === 'pending_review';
  const isAlreadyReviewed = meta.reviewStatus === 'approved' || meta.reviewStatus === 'rejected';

  const handleReview = async (action: 'approve' | 'reject') => {
    setIsReviewing(true);
    setReviewError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/review-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          orgId,
          taskId: task.id,
          action,
          notes: reviewNotes.trim() || undefined,
        }),
      });

      const result = await res.json();

      if (res.ok && result.status === 'ok') {
        onReviewComplete();
      } else {
        setReviewError(result.error || 'Review action failed. Please try again.');
      }
    } catch {
      setReviewError('Network error. Please try again.');
    } finally {
      setIsReviewing(false);
    }
  };

  // ── Render ──

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div
        className={`w-full max-w-3xl rounded-2xl shadow-2xl border overflow-hidden relative flex flex-col max-h-full animate-in zoom-in-95 duration-200 ${
          isDarkMode ? 'bg-slate-900 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* ── Header ── */}
        <div className={`px-6 py-4 border-b flex items-start justify-between gap-4 shrink-0 ${
          isDarkMode ? 'border-slate-700/60 bg-slate-800/40' : 'border-slate-200 bg-slate-50/80'
        }`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <button onClick={onClose} className={`p-1 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-200'}`}>
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Submission Review
              </span>
            </div>
            <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {task.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Type badge */}
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getTypeBadgeColor(responseType, isDarkMode)}`}>
                {getTypeIcon(responseType)}
                {getTypeLabel(responseType)}
              </span>
              {/* Employee */}
              {(employeeName || task.assignedToEmail) && (
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  by {employeeName || task.assignedToEmail}
                </span>
              )}
              {/* Submission time */}
              {latestResponse?.submittedAt && (
                <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  • {formatTimestamp(latestResponse.submittedAt)}
                </span>
              )}
            </div>
            {/* Review status indicator */}
            {isAlreadyReviewed && (
              <div className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg ${
                meta.reviewStatus === 'approved'
                  ? (isDarkMode ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')
                  : (isDarkMode ? 'bg-rose-950/40 text-rose-400 border border-rose-800/50' : 'bg-rose-50 text-rose-700 border border-rose-200')
              }`}>
                {meta.reviewStatus === 'approved'
                  ? <><CheckCircle2 className="w-3.5 h-3.5" /> Approved</>
                  : <><XCircle className="w-3.5 h-3.5" /> Rejected</>
                }
                {meta.reviewedByEmail && (
                  <span className="opacity-70">by {meta.reviewedByEmail}</span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl transition-colors shrink-0 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-200'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* No response yet */}
          {!latestResponse && (
            <div className={`text-center py-12 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold">No submission yet</p>
              <p className="text-xs mt-1">The employee hasn&apos;t completed this interactive item.</p>
            </div>
          )}

          {/* Submission content by type */}
          {latestResponse && responseType === 'quiz' && (
            <QuizBreakdown response={latestResponse} content={meta.interactiveContent} isDarkMode={isDarkMode} />
          )}
          {latestResponse && responseType === 'short_answer' && (
            <ShortAnswerViewer response={latestResponse} content={meta.interactiveContent} isDarkMode={isDarkMode} />
          )}
          {latestResponse && responseType === 'form' && (
            <FormDataViewer response={latestResponse} content={meta.interactiveContent} isDarkMode={isDarkMode} />
          )}
          {latestResponse && responseType === 'checklist' && (
            <ChecklistViewer response={latestResponse} content={meta.interactiveContent} isDarkMode={isDarkMode} />
          )}
          {latestResponse && responseType === 'policy_acknowledgment' && (
            <SignatureCertificate response={latestResponse} content={meta.interactiveContent} isDarkMode={isDarkMode} />
          )}
          {/* Download PDF certificate for e-signatures */}
          {latestResponse && responseType === 'policy_acknowledgment' && (task.column === 'done' || meta.reviewStatus === 'approved') && (
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${
              isDarkMode ? 'bg-slate-800/30 border-slate-700/40' : 'bg-slate-50/80 border-slate-200/60'
            }`}>
              <FileText className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Signed PDF Certificate
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {certUrl ? 'Certificate generated and saved to Compliance Vault' : 'Generate a formal ESIGN-compliant audit certificate'}
                </div>
              </div>
              {certUrl ? (
                <a
                  href={certUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    isDarkMode ? 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  View PDF
                </a>
              ) : (
                <button
                  disabled={certLoading}
                  onClick={async () => {
                    setCertLoading(true);
                    try {
                      const headers = await getAuthHeaders();
                      const res = await fetch('/api/onboarding/generate-certificate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...headers },
                        body: JSON.stringify({ orgId, taskId: task.id }),
                      });
                      const result = await res.json();
                      if (res.ok && result.downloadUrl) {
                        setCertUrl(result.downloadUrl);
                        window.open(result.downloadUrl, '_blank');
                      } else {
                        setReviewError(result.error || 'Failed to generate certificate');
                      }
                    } catch {
                      setReviewError('Network error generating certificate');
                    } finally {
                      setCertLoading(false);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    isDarkMode
                      ? 'bg-purple-900/40 text-purple-300 hover:bg-purple-900/60 disabled:opacity-50'
                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50'
                  }`}
                >
                  {certLoading ? (
                    <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Generating...</>
                  ) : (
                    <><FileText className="w-3.5 h-3.5" /> Download Certificate</>
                  )}
                </button>
              )}
            </div>
          )}
          {latestResponse && responseType === 'external_verification' && (
            <ExternalVerificationViewer response={latestResponse} content={meta.interactiveContent} isDarkMode={isDarkMode} />
          )}
          {latestResponse && responseType === 'recorded_response' && (
            <RecordedResponseViewer response={latestResponse} isDarkMode={isDarkMode} />
          )}

          {/* Previous review notes (if already reviewed) */}
          {isAlreadyReviewed && meta.reviewNotes && (
            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Review Notes
              </div>
              <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{meta.reviewNotes}</p>
            </div>
          )}

          {/* All submission history (if multiple attempts) */}
          {meta.userResponse && meta.userResponse.length > 1 && (
            <div>
              <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Submission History ({meta.userResponse.length} total)
              </h4>
              <div className="space-y-1">
                {meta.userResponse.map((resp: any, idx: number) => (
                  <div key={idx} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                    idx === meta.userResponse!.length - 1
                      ? (isDarkMode ? 'bg-indigo-950/30 border border-indigo-800/40' : 'bg-indigo-50 border border-indigo-200/60')
                      : (isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50/50')
                  }`}>
                    <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      #{idx + 1}
                    </span>
                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                      {formatTimestamp(resp.submittedAt)}
                    </span>
                    {resp.score !== undefined && (
                      <span className={`font-semibold ${resp.passed ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {Math.round(resp.score)}%
                      </span>
                    )}
                    {idx === meta.userResponse!.length - 1 && (
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-indigo-800/40 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
                        Latest
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Review Actions Footer (only for pending_review) ── */}
        {isPendingReview && latestResponse && (
          <div className={`px-6 py-4 border-t shrink-0 ${isDarkMode ? 'border-slate-700/60 bg-slate-800/40' : 'border-slate-200 bg-slate-50/80'}`}>
            {/* Review notes */}
            <div className="mb-3">
              <label className={`text-xs font-bold uppercase tracking-wider block mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Review Notes (optional)
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add feedback for the employee..."
                rows={2}
                className={`w-full px-3 py-2 rounded-lg border text-sm resize-none transition-colors ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-indigo-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-400'
                } focus:outline-none focus:ring-1 focus:ring-indigo-500/50`}
              />
            </div>

            {/* Error display */}
            {reviewError && (
              <div className={`mb-3 p-3 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                isDarkMode ? 'bg-rose-900/40 text-rose-300 border border-rose-700/50' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {reviewError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleReview('approve')}
                disabled={isReviewing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isReviewing ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={() => handleReview('reject')}
                disabled={isReviewing}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                  isDarkMode
                    ? 'bg-rose-900/40 border-rose-700/50 text-rose-300 hover:bg-rose-900/60'
                    : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <XCircle className="w-4 h-4" />
                {isReviewing ? 'Processing...' : 'Reject & Request Revision'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
