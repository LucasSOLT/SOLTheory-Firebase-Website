'use client';

import React, { useState } from 'react';
import {
  X,
  FileText,
  Video,
  BookOpen,
  Users,
  CheckSquare,
  PenTool,
  ExternalLink,
  Upload,
  CheckCircle2,
  FileIcon,
  HelpCircle,
  MessageSquare,
  ClipboardList,
  ListChecks,
  ShieldCheck,
  Globe,
  Mic,
  AlertTriangle,
} from 'lucide-react';
import { InteractiveContentRenderer } from './InteractiveRenderers';
import { getAuthHeaders } from '@/lib/api-auth-client';
import { safeExternalUrl } from '@/lib/utils';

interface OnboardingItemPopupProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  orgId?: string;
  task: {
    id: string;
    orgId?: string;
    title: string;
    description?: string;
    column: string;
    metadata?: {
      phase?: number;
      onboardingInstanceId?: string;
      orgId?: string;
      requiresDocumentUpload?: boolean;
      documentCategory?: string;
      itemType?: string;
      instructions?: string;
      hyperlink?: string | null;
      headerImageUrl?: string | null;
      backgroundColor?: string | null;
      mediaUrl?: string | null;
      mediaType?: string | null;
      completionGating?: string;
      interactiveContent?: any;
      userResponse?: any[];
      reviewStatus?: string;
      reviewNotes?: string;
    };
    attachments?: any[];
  };
  onComplete: (taskId: string) => void;
  onUploadClick: (taskId: string) => void;
}

/** Render text with clickable external links */
function renderTextWithLinks(text?: string | null) {
  if (!text) return null;
  const tokens = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g);
  return tokens.map((part, i) => {
    if (/^(https?:\/\/|www\.)/i.test(part)) {
      const cleanHref = safeExternalUrl(part);
      return (
        <a
          key={i}
          href={cleanHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-500 hover:text-indigo-600 underline font-medium inline-flex items-center gap-0.5 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
          <ExternalLink className="w-3 h-3 inline shrink-0" />
        </a>
      );
    }
    return part;
  });
}

export default function OnboardingItemPopup({
  isOpen,
  onClose,
  isDarkMode,
  orgId,
  task,
  onComplete,
  onUploadClick,
}: OnboardingItemPopupProps) {
  const [videoStarted, setVideoStarted] = useState(false);

  if (!isOpen) return null;

  const isCompleted = task.column === 'done';
  const meta = task.metadata || {};

  // Icons based on itemType
  const getTypeIcon = () => {
    switch (meta.itemType) {
      case 'document_upload':
        return <FileText className="w-5 h-5" />;
      case 'video_watch':
        return <Video className="w-5 h-5" />;
      case 'reading':
        return <BookOpen className="w-5 h-5" />;
      case 'shadowing_session':
        return <Users className="w-5 h-5" />;
      case 'action_item':
        return <CheckSquare className="w-5 h-5" />;
      case 'form_sign':
        return <PenTool className="w-5 h-5" />;
      case 'quiz':
        return <HelpCircle className="w-5 h-5" />;
      case 'short_answer':
        return <MessageSquare className="w-5 h-5" />;
      case 'form':
        return <ClipboardList className="w-5 h-5" />;
      case 'checklist':
        return <ListChecks className="w-5 h-5" />;
      case 'policy_acknowledgment':
        return <ShieldCheck className="w-5 h-5" />;
      case 'external_verification':
        return <Globe className="w-5 h-5" />;
      case 'recorded_response':
        return <Mic className="w-5 h-5" />;
      default:
        return <CheckSquare className="w-5 h-5" />;
    }
  };

  const getButtonState = () => {
    if (isCompleted) {
      return {
        disabled: true,
        text: 'Completed ✓',
        classes: isDarkMode
          ? 'bg-emerald-900/50 text-emerald-400 border-emerald-700/50'
          : 'bg-emerald-100 text-emerald-600 border-emerald-200',
        tooltip: 'This item is already completed',
      };
    }

    // Pending admin review state
    if (meta.reviewStatus === 'pending_review') {
      return {
        disabled: true,
        text: 'Pending Review',
        classes: isDarkMode
          ? 'bg-amber-900/50 text-amber-400 border-amber-700/50'
          : 'bg-amber-100 text-amber-600 border-amber-200',
        tooltip: 'Your response is awaiting admin review',
      };
    }

    // Rejected — allow resubmission
    if (meta.reviewStatus === 'rejected') {
      return {
        disabled: true,
        text: 'Revision Requested',
        classes: isDarkMode
          ? 'bg-rose-900/50 text-rose-400 border-rose-700/50'
          : 'bg-rose-100 text-rose-600 border-rose-200',
        tooltip: 'Your submission was returned for revision — see feedback below',
      };
    }

    if (meta.completionGating === 'upload_required' || meta.requiresDocumentUpload) {
      if (!task.attachments || task.attachments.length === 0) {
        return {
          disabled: true,
          text: 'Complete ✓',
          classes: isDarkMode
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed',
          tooltip: 'Upload a document first',
        };
      }
    }

    if (meta.completionGating === 'video_started' && meta.mediaType === 'video' && meta.mediaUrl) {
      if (!videoStarted) {
        return {
          disabled: true,
          text: 'Complete ✓',
          classes: isDarkMode
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed',
          tooltip: 'Start watching the video first',
        };
      }
    }

    // Interactive types: hide the standard Complete button — the renderer handles submission
    const interactiveGating = ['quiz_passed', 'response_required', 'response_reviewed', 'form_submitted', 'checklist_complete', 'acknowledgment_signed', 'external_verified'];
    if (meta.completionGating && interactiveGating.includes(meta.completionGating) && meta.interactiveContent) {
      return {
        disabled: true,
        text: 'Complete via form below',
        classes: isDarkMode
          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
          : 'bg-slate-200 text-slate-400 cursor-not-allowed',
        tooltip: 'Complete the interactive content below to mark this item done',
      };
    }

    return {
      disabled: false,
      text: 'Complete ✓',
      classes: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer active:scale-95 transition-all',
      tooltip: 'Mark this item as complete',
    };
  };

  const buttonState = getButtonState();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ passed: boolean; score?: number; message: string } | null>(null);

  const handleComplete = () => {
    if (!buttonState.disabled) {
      onComplete(task.id);
      onClose();
    }
  };

  /** Submit an interactive response (quiz, form, checklist, etc.) to the API. */
  const handleInteractiveSubmit = async (responseData: any) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const headers = await getAuthHeaders();
      const effectiveOrgId = orgId || task.orgId || meta.orgId || '';
      const res = await fetch('/api/onboarding/submit-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          orgId: effectiveOrgId,
          taskId: task.id,
          responseType: meta.itemType,
          responseData,
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setSubmitResult({ passed: result.passed, score: result.score, message: result.message });
        if (result.passed) {
          // Auto-close after a brief success animation
          setTimeout(() => {
            onComplete(task.id);
            onClose();
          }, 1500);
        }
      } else {
        setSubmitResult({ passed: false, message: result.error || 'Submission failed. Please try again.' });
      }
    } catch (err) {
      setSubmitResult({ passed: false, message: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div
        className={`w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden relative flex flex-col max-h-full animate-in zoom-in-95 duration-200 ${
          isDarkMode ? 'bg-slate-900 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header area (Background color + Image) */}
        <div
          className="relative shrink-0 w-full"
          style={{
            backgroundColor: meta.backgroundColor || undefined,
            minHeight: meta.headerImageUrl || meta.backgroundColor ? '140px' : '0px',
          }}
        >
          {meta.headerImageUrl && (
            <div className="w-full h-40">
              <img
                src={meta.headerImageUrl}
                alt="Header"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Action Buttons Top Right (Absolute or sticky depending on design, we'll put it in a flex container below or absolute if needed) */}
        <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
          <button
            onClick={handleComplete}
            disabled={buttonState.disabled}
            title={buttonState.tooltip}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-transparent ${buttonState.classes}`}
          >
            {buttonState.text}
          </button>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors backdrop-blur-md ${
              isDarkMode ? 'bg-slate-800/80 hover:bg-slate-700 text-white' : 'bg-white/80 hover:bg-slate-100 text-slate-900 shadow-sm'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
          
          {/* Title Section */}
          <div>
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4 ${
              isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
            }`}>
              {getTypeIcon()}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {task.title}
            </h2>
            {task.description && (
              <p className={`mt-2 text-sm sm:text-base ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {renderTextWithLinks(task.description)}
              </p>
            )}
          </div>

          {/* Instructions */}
          {meta.instructions && (
            <div className={`p-5 rounded-xl border ${
              isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200/60'
            }`}>
              <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Instructions
              </h4>
              <div className={`text-sm whitespace-pre-wrap leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                {renderTextWithLinks(meta.instructions)}
              </div>
            </div>
          )}

          {/* Hyperlink */}
          {meta.hyperlink && (
            <div>
              <a
                href={safeExternalUrl(meta.hyperlink)}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${
                  isDarkMode
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                <ExternalLink className="w-4 h-4" />
                Open External Link
              </a>
            </div>
          )}

          {/* Media Preview */}
          {meta.mediaUrl && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2">
                {meta.mediaType === 'video' && <Video className="w-4 h-4" />}
                {meta.mediaType === 'image' && <FileIcon className="w-4 h-4" />}
                {meta.mediaType === 'pdf' && <FileText className="w-4 h-4" />}
                Media Content
              </h4>
              
              <div className={`rounded-xl overflow-hidden border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                {meta.mediaType === 'video' ? (
                  <div className="aspect-video w-full bg-black relative">
                    {/* Basic video tag, can detect youtube/vimeo if needed, for now standard video */}
                    {meta.mediaUrl.includes('youtube.com') || meta.mediaUrl.includes('youtu.be') ? (
                      <iframe
                        className="w-full h-full"
                        src={meta.mediaUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        onLoad={() => setVideoStarted(true)}
                      />
                    ) : (
                      <video
                        controls
                        className="w-full h-full object-contain"
                        onPlay={() => setVideoStarted(true)}
                      >
                        <source src={meta.mediaUrl} />
                        Your browser does not support the video tag.
                      </video>
                    )}
                  </div>
                ) : meta.mediaType === 'image' ? (
                  <div className="w-full bg-slate-100 dark:bg-slate-800 flex justify-center">
                    <img src={meta.mediaUrl} alt="Media" className="max-h-96 object-contain" />
                  </div>
                ) : meta.mediaType === 'pdf' ? (
                  <div className={`p-8 flex flex-col items-center justify-center text-center ${
                    isDarkMode ? 'bg-slate-800' : 'bg-slate-50'
                  }`}>
                    <FileText className={`w-12 h-12 mb-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    <a
                      href={safeExternalUrl(meta.mediaUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                        isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      Open PDF
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Interactive Content Renderer */}
          {meta.interactiveContent && (
            <div className="space-y-3">
              {/* Rejection feedback banner — shown when admin rejects a submission */}
              {meta.reviewStatus === 'rejected' && (
                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-rose-950/30 border-rose-800/50' : 'bg-rose-50 border-rose-200'}`}>
                  <div className={`text-sm font-bold mb-1 flex items-center gap-2 ${isDarkMode ? 'text-rose-300' : 'text-rose-700'}`}>
                    <AlertTriangle className="w-4 h-4" />
                    Revision Requested
                  </div>
                  {meta.reviewNotes ? (
                    <p className={`text-sm ${isDarkMode ? 'text-rose-300/80' : 'text-rose-600'}`}>
                      <span className="font-semibold">Admin feedback:</span> {meta.reviewNotes}
                    </p>
                  ) : (
                    <p className={`text-sm ${isDarkMode ? 'text-rose-300/80' : 'text-rose-600'}`}>
                      Your previous submission was returned for revision. Please review and resubmit below.
                    </p>
                  )}
                </div>
              )}
              <InteractiveContentRenderer
                content={meta.interactiveContent}
                onSubmit={handleInteractiveSubmit}
                isDarkMode={isDarkMode}
                disabled={isCompleted || isSubmitting || meta.reviewStatus === 'pending_review'}
                existingResponse={meta.userResponse?.[meta.userResponse.length - 1]}
              />
              {isSubmitting && (
                <div className={`text-center py-3 text-sm font-semibold animate-pulse ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  Submitting response...
                </div>
              )}
              {submitResult && (
                <div className={`p-4 rounded-xl text-sm font-semibold text-center ${
                  submitResult.passed
                    ? (isDarkMode ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')
                    : (isDarkMode ? 'bg-rose-900/40 text-rose-300 border border-rose-700/50' : 'bg-rose-50 text-rose-700 border border-rose-200')
                }`}>
                  {submitResult.score !== undefined && (
                    <div className="text-lg mb-1">Score: {submitResult.score}%</div>
                  )}
                  {submitResult.message}
                </div>
              )}
            </div>
          )}

          {/* Download certificate link for completed e-signatures */}
          {isCompleted && meta.itemType === 'policy_acknowledgment' && meta.interactiveContent?.type === 'policy_acknowledgment' && (
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${
              isDarkMode ? 'bg-purple-950/20 border-purple-800/30' : 'bg-purple-50/50 border-purple-200/60'
            }`}>
              <ShieldCheck className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  E-Signature Complete
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Your signed acknowledgment is on file. You can download a PDF copy for your records.
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    const headers = await getAuthHeaders();
                    const res = await fetch('/api/onboarding/generate-certificate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...headers },
                      body: JSON.stringify({ orgId: orgId || task.orgId || meta.orgId, taskId: task.id }),
                    });
                    const result = await res.json();
                    if (res.ok && result.downloadUrl) {
                      window.open(result.downloadUrl, '_blank');
                    }
                  } catch { /* silent */ }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shrink-0 ${
                  isDarkMode
                    ? 'bg-purple-900/40 text-purple-300 hover:bg-purple-900/60'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>
          )}

          {/* Upload Zone */}
          {meta.requiresDocumentUpload && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Required Document
              </h4>
              <div 
                onClick={() => {
                  onUploadClick(task.id);
                  onClose();
                }}
                className={`p-6 sm:p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                  isDarkMode
                    ? 'border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-indigo-950/20'
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/50'
                }`}
              >
                <Upload className={`w-8 h-8 mb-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {task.attachments && task.attachments.length > 0 ? 'Upload a replacement document' : 'Click to upload document'}
                </span>
                <span className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {task.attachments && task.attachments.length > 0 
                    ? `Current file: ${task.attachments[0].name}`
                    : `Category: ${meta.documentCategory || 'General'}`}
                </span>
                {task.attachments && task.attachments.length > 0 && (
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                    Document uploaded
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
