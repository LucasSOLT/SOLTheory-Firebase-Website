'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/api-auth-client';
import {
  COMPLIANCE_CATEGORY_LABELS,
  type ComplianceDocumentCategory,
} from '@/types/onboarding-templates';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  documentCategory: ComplianceDocumentCategory;
  taskId?: string;
  targetUserId?: string;
  isDarkMode: boolean;
  onUploadSuccess: (doc: any) => void;
}

export default function DocumentUploadModal({
  isOpen,
  onClose,
  orgId,
  documentCategory,
  taskId,
  targetUserId,
  isDarkMode,
  onUploadSuccess,
}: DocumentUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const categoryLabel = COMPLIANCE_CATEGORY_LABELS[documentCategory] || documentCategory;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orgId', orgId);
      formData.append('documentCategory', documentCategory);
      if (taskId) formData.append('taskId', taskId);
      if (targetUserId) formData.append('targetUserId', targetUserId);

      // Note: Do not set Content-Type header when sending FormData; fetch handles boundary automatically
      const res = await fetch('/api/onboarding/vault/upload', {
        method: 'POST',
        headers: {
          Authorization: headers.Authorization || '',
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload document');
      }

      onUploadSuccess(data);
      onClose();
    } catch (err: any) {
      console.error('[Document Upload] Error:', err);
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
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
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-slate-800 bg-slate-850' : 'border-slate-100 bg-slate-50/50'}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Upload Compliance Document</h3>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{categoryLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
              isDragOver
                ? (isDarkMode ? 'border-indigo-400 bg-indigo-950/20' : 'border-indigo-500 bg-indigo-50/40')
                : (isDarkMode ? 'border-slate-700 bg-slate-800/40 hover:border-slate-600' : 'border-slate-200 bg-slate-50/60 hover:border-slate-300')
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />

            {file ? (
              <div className="flex flex-col items-center text-center">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold max-w-xs truncate">{file.name}</span>
                <span className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </span>
                <span className="mt-2 text-[11px] font-medium text-indigo-500 underline">Click to choose a different file</span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold">Drop your signed file here, or browse</p>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Supports PDF, PNG, JPG, or DOCX (Max 50MB)
                </p>
              </div>
            )}
          </div>

          <p className={`text-[11px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            🔒 <strong>Secure Storage:</strong> This file is encrypted and saved directly to your organization&apos;s Compliance Vault. It will be reviewed by your supervisor for regulatory verification.
          </p>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${isDarkMode ? 'border-slate-800 bg-slate-850' : 'border-slate-100 bg-slate-50/50'}`}>
          <button
            onClick={onClose}
            disabled={isUploading}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-[0.98] ${
              !file || isUploading
                ? 'opacity-50 cursor-not-allowed bg-indigo-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Submit for Verification</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
