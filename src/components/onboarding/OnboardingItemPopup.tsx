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
} from 'lucide-react';

interface OnboardingItemPopupProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  task: {
    id: string;
    title: string;
    description?: string;
    column: string;
    metadata?: {
      phase?: number;
      onboardingInstanceId?: string;
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
    };
    attachments?: any[];
  };
  onComplete: (taskId: string) => void;
  onUploadClick: (taskId: string) => void;
}

export default function OnboardingItemPopup({
  isOpen,
  onClose,
  isDarkMode,
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

    return {
      disabled: false,
      text: 'Complete ✓',
      classes: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer active:scale-95 transition-all',
      tooltip: 'Mark this item as complete',
    };
  };

  const buttonState = getButtonState();

  const handleComplete = () => {
    if (!buttonState.disabled) {
      onComplete(task.id);
      onClose();
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
                {task.description}
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
                {meta.instructions}
              </div>
            </div>
          )}

          {/* Hyperlink */}
          {meta.hyperlink && (
            <div>
              <a
                href={meta.hyperlink}
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
                      href={meta.mediaUrl}
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
