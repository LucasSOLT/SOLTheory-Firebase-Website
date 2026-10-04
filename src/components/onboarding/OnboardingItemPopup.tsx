'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
import BodyPortal from './BodyPortal';
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
  // Signature Suite D5 — tap an image to see it full-screen.
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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
    const interactiveGating = ['quiz_passed', 'response_required', 'response_reviewed', 'form_submitted', 'checklist_complete', 'acknowledgment_signed', 'external_verified', 'pdf_form_submitted'];
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
    // Signature Suite D6 — Blueprint Preview items aren't real tasks: nothing is saved.
    if (task.id.startsWith('preview_')) {
      setSubmitResult({ passed: true, message: 'Preview only: this is what employees will see. Nothing was saved.' });
      return;
    }
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
    <BodyPortal>
    {/* Signature Suite D4: portaled above the site header, and the overlay itself is the ONLY
        scroll container with content starting at the top on phones. (Previously a vertically-
        centred flex box with max-h-full pushed the top of tall items off-screen where it could
        not be scrolled to, and the mobile header covered it.) */}
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto overscroll-contain"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div
        className="min-h-full flex items-start sm:items-center justify-center px-2 sm:p-6"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        }}
      >
      <div
        className={`w-full max-w-2xl rounded-2xl shadow-2xl border relative flex flex-col animate-in zoom-in-95 duration-200 ${
          isDarkMode ? 'bg-slate-900 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* D4: sticky action bar — Close and Complete stay reachable while scrolling a long item */}
        <div
          className={`sticky top-0 z-20 flex items-center justify-end gap-2 px-3 py-2 rounded-t-2xl border-b backdrop-blur-md ${
            isDarkMode ? 'bg-slate-900/90 border-slate-700/60' : 'bg-white/90 border-slate-200/80'
          }`}
        >
          <button
            onClick={handleComplete}
            disabled={buttonState.disabled}
            title={buttonState.tooltip}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border-transparent ${buttonState.classes}`}
          >
            {buttonState.text}
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className={`p-2 rounded-xl transition-colors ${
              isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Header area (Background color + Image). D5: the whole image is shown (no cropping); tap to enlarge. */}
        {(meta.headerImageUrl || meta.backgroundColor) && (
          <div
            className="relative shrink-0 w-full overflow-hidden"
            style={{
              backgroundColor: meta.backgroundColor || (isDarkMode ? '#0f172a' : '#f1f5f9'),
              minHeight: !meta.headerImageUrl && meta.backgroundColor ? '96px' : undefined,
            }}
          >
            {meta.headerImageUrl && (
              <button
                type="button"
                onClick={() => setLightboxUrl(meta.headerImageUrl || null)}
                className="block w-full"
                aria-label="Enlarge header image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={meta.headerImageUrl}
                  alt="Header"
                  className="block w-full h-auto max-h-56 sm:max-h-72 object-contain mx-auto"
                />
              </button>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
          
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
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(meta.mediaUrl || null)}
                    className={`block w-full p-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}
                    aria-label="Enlarge image"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={meta.mediaUrl} alt="Media" className="block mx-auto w-auto max-w-full h-auto max-h-[55vh] object-contain rounded-lg" />
                    <span className={`block mt-1.5 text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tap to enlarge</span>
                  </button>
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
                orgId={orgId}
                taskId={task.id}
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

      {/* D5 — image lightbox (portaled: the overlay's backdrop-blur would otherwise trap a fixed child) */}
      {lightboxUrl && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-2"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="Enlarged" className="max-w-full max-h-full object-contain" />
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close image"
            className="absolute left-3 w-11 h-11 rounded-full flex items-center justify-center bg-white/15 text-white"
            style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>,
        document.body,
      )}
    </div>
    </BodyPortal>
  );
}
