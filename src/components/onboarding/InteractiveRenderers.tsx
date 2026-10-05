'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Check, 
  ExternalLink, 
  Info,
  Mic,
  Square,
  Play,
  RotateCcw,
  CheckSquare,
  Square as SquareOutline,
  FileText,
  Loader2,
  ShieldCheck,
  PenTool,
  AlertCircle,
} from 'lucide-react';
import {
  InteractiveContent,
  QuizContent,
  ShortAnswerContent,
  FormContent,
  ChecklistContent,
  PolicyAcknowledgmentContent,
  ExternalVerificationContent,
  RecordedResponseContent,
  PdfFormContent,
} from '@/types/onboarding-templates';
import { safeExternalUrl } from '@/lib/utils';
import { getAuthHeaders } from '@/lib/api-auth-client';
import PdfFormVisualRenderer from './pdf/PdfFormVisualRenderer';
import { usePdfFormSource } from './pdf/usePdfFormSource';
import PdfUploadFallback from './pdf/PdfUploadFallback';
import MultiSignerPdfForm from './pdf/MultiSignerPdfForm';
import SignaturePadModal from './pdf/SignaturePadModal';
import { isMultiSignerWorkflow } from '@/lib/signing-workflow';
import { signatureSpotsOf } from '@/lib/signature-spots';

// ----------------------------------------------------------------------
// 1. QuizRenderer
// ----------------------------------------------------------------------
export function QuizRenderer({ 
  content, 
  onSubmit, 
  isDarkMode, 
  disabled,
  existingResponse
}: { 
  content: QuizContent; 
  onSubmit: (data: any) => void; 
  isDarkMode: boolean; 
  disabled?: boolean;
  existingResponse?: any;
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>(existingResponse?.answers || {});
  const [attemptCount, setAttemptCount] = useState(existingResponse?.attemptCount || 0);
  const [isSubmitted, setIsSubmitted] = useState(!!existingResponse?.submitted);
  const [score, setScore] = useState<number | null>(existingResponse?.score || null);

  const handleSelect = (questionId: string, optionId: string, type: 'multiple_choice' | 'true_false' | 'select_all') => {
    if (disabled || isSubmitted) return;
    
    setAnswers(prev => {
      const current = prev[questionId] || [];
      if (type === 'select_all') {
        if (current.includes(optionId)) {
          return { ...prev, [questionId]: current.filter(id => id !== optionId) };
        } else {
          return { ...prev, [questionId]: [...current, optionId] };
        }
      } else {
        return { ...prev, [questionId]: [optionId] };
      }
    });
  };

  const handleSubmit = () => {
    let correctCount = 0;
    content.questions.forEach(q => {
      const selected = answers[q.id] || [];
      const correctOptions = q.options.filter(o => o.isCorrect).map(o => o.id);
      
      const isCorrect = 
        selected.length === correctOptions.length && 
        selected.every(id => correctOptions.includes(id));
      
      if (isCorrect) correctCount++;
    });

    const calculatedScore = (correctCount / content.questions.length) * 100;
    const passed = calculatedScore >= content.passingScore;
    
    setScore(calculatedScore);
    setIsSubmitted(true);
    setAttemptCount((prev: number) => prev + 1);
    
    onSubmit({
      answers,
      score: calculatedScore,
      passed,
      attemptCount: attemptCount + 1,
      submitted: true
    });
  };

  const handleRetry = () => {
    setAnswers({});
    setIsSubmitted(false);
    setScore(null);
  };

  const hasRemainingAttempts = content.maxAttempts === 0 || attemptCount < content.maxAttempts;
  const passed = score !== null && score >= content.passingScore;

  return (
    <div className={`space-y-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      {content.questions.map((q, i) => (
        <div key={q.id} className={`p-4 rounded-lg border ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
          <p className="font-medium mb-3">{i + 1}. {q.text}</p>
          {q.imageUrl && (
            <img src={q.imageUrl} alt="Question" className="mb-4 max-h-48 rounded-md object-contain" />
          )}
          <div className="space-y-2">
            {q.options.map(o => {
              const isSelected = (answers[q.id] || []).includes(o.id);
              const showCorrectness = isSubmitted && content.showCorrectAnswers;
              let optionClass = isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50';
              let icon = null;
              
              if (isSelected) {
                optionClass = isDarkMode ? 'border-blue-500 bg-blue-900/30' : 'border-blue-500 bg-blue-50';
              }

              if (showCorrectness) {
                if (o.isCorrect) {
                  optionClass = isDarkMode ? 'border-green-500 bg-green-900/30' : 'border-green-500 bg-green-50';
                  icon = <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />;
                } else if (isSelected && !o.isCorrect) {
                  optionClass = isDarkMode ? 'border-red-500 bg-red-900/30' : 'border-red-500 bg-red-50';
                  icon = <XCircle className="w-5 h-5 text-red-500 ml-auto" />;
                }
              }

              return (
                <div 
                  key={o.id}
                  onClick={() => handleSelect(q.id, o.id, q.questionType)}
                  className={`flex items-center p-3 rounded-md border cursor-pointer transition-colors ${optionClass} ${disabled || isSubmitted ? 'opacity-80 cursor-not-allowed' : ''}`}
                >
                  <div className={`w-5 h-5 mr-3 flex items-center justify-center border ${q.questionType === 'select_all' ? 'rounded' : 'rounded-full'} ${isSelected ? 'bg-blue-600 border-blue-600' : (isDarkMode ? 'border-gray-500' : 'border-gray-400')}`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span>{o.text}</span>
                  {icon}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      
      {isSubmitted && score !== null && (
        <div className={`p-4 rounded-lg text-center ${passed ? (isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-800') : (isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-800')}`}>
          <h3 className="text-xl font-bold mb-1">{passed ? 'Passed!' : 'Did not pass'}</h3>
          <p>Score: {score.toFixed(0)}% (Required: {content.passingScore}%)</p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        {isSubmitted && !passed && hasRemainingAttempts && !disabled && (
          <button 
            onClick={handleRetry}
            className={`px-4 py-2 rounded-md font-medium ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
          >
            Try Again (Attempts: {attemptCount}/{content.maxAttempts || 'Unlimited'})
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={disabled || isSubmitted || Object.keys(answers).length < content.questions.length}
          className={`px-6 py-2 rounded-md font-medium text-white transition-colors ${(disabled || isSubmitted || Object.keys(answers).length < content.questions.length) ? 'bg-blue-400 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isSubmitted ? 'Submitted' : 'Submit Quiz'}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. ShortAnswerRenderer
// ----------------------------------------------------------------------
export function ShortAnswerRenderer({ 
  content, 
  onSubmit, 
  isDarkMode, 
  disabled,
  existingResponse
}: { 
  content: ShortAnswerContent; 
  onSubmit: (data: any) => void; 
  isDarkMode: boolean; 
  disabled?: boolean;
  existingResponse?: any;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(existingResponse?.answers || {});

  const isValid = content.prompts.every(p => {
    if (!p.required) return true;
    const ans = answers[p.id] || '';
    if (ans.trim() === '') return false;
    if (p.minLength && ans.length < p.minLength) return false;
    if (p.maxLength && ans.length > p.maxLength) return false;
    return true;
  });

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({ answers });
  };

  return (
    <div className={`space-y-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      {content.prompts.map(p => {
        const val = answers[p.id] || '';
        const isError = p.required && (
          (val.trim() === '' && val !== '') || 
          (p.minLength && val.length > 0 && val.length < p.minLength) || 
          (p.maxLength && val.length > p.maxLength)
        );

        return (
          <div key={p.id} className="space-y-2">
            <label className="block font-medium">
              {p.question} {p.required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              disabled={disabled}
              value={val}
              onChange={e => setAnswers({ ...answers, [p.id]: e.target.value })}
              placeholder={p.placeholder}
              rows={4}
              className={`w-full p-3 rounded-md border focus:ring-2 focus:ring-blue-500 outline-none transition-colors
                ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}
                ${isError ? 'border-red-500' : ''}
              `}
            />
            <div className="flex justify-end text-xs text-gray-500">
              {p.minLength && val.length > 0 && val.length < p.minLength && (
                <span className="text-red-500 mr-2">Min {p.minLength} chars required.</span>
              )}
              {p.maxLength && (
                <span className={val.length > p.maxLength ? 'text-red-500' : ''}>
                  {val.length} / {p.maxLength}
                </span>
              )}
            </div>
          </div>
        );
      })}
      
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={disabled || !isValid}
          className={`px-6 py-2 rounded-md font-medium text-white transition-colors ${(disabled || !isValid) ? 'bg-blue-400 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          Submit Responses
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 3. FormRenderer
// ----------------------------------------------------------------------
export function FormRenderer({ 
  content, 
  onSubmit, 
  isDarkMode, 
  disabled,
  existingResponse
}: { 
  content: FormContent; 
  onSubmit: (data: any) => void; 
  isDarkMode: boolean; 
  disabled?: boolean;
  existingResponse?: any;
}) {
  const [formData, setFormData] = useState<Record<string, any>>(existingResponse?.formData || {});

  const isValid = content.fields.every(f => {
    if (!f.required) return true;
    const val = formData[f.id];
    if (f.fieldType === 'checkbox') return val === true;
    if (val === undefined || val === null || val === '') return false;
    if (f.validationPattern && typeof val === 'string') {
      try {
        return new RegExp(f.validationPattern).test(val);
      } catch (e) {
        return false;
      }
    }
    return true;
  });

  const inputClass = `w-full p-2 rounded-md border focus:ring-2 focus:ring-blue-500 outline-none transition-colors
    ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}
  `;

  return (
    <div className={`space-y-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      <div className="mb-6">
        <h3 className="text-xl font-bold mb-2">{content.title}</h3>
        {content.description && <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{content.description}</p>}
      </div>

      <div className="space-y-4">
        {content.fields.map(f => (
          <div key={f.id}>
            <label className="block font-medium mb-1">
              {f.label} {f.required && <span className="text-red-500">*</span>}
            </label>
            
            {f.fieldType === 'textarea' ? (
              <textarea
                disabled={disabled}
                value={formData[f.id] || ''}
                onChange={e => setFormData({ ...formData, [f.id]: e.target.value })}
                placeholder={f.placeholder}
                rows={3}
                className={inputClass}
              />
            ) : f.fieldType === 'dropdown' ? (
              <select
                disabled={disabled}
                value={formData[f.id] || ''}
                onChange={e => setFormData({ ...formData, [f.id]: e.target.value })}
                className={inputClass}
              >
                <option value="" disabled>Select an option</option>
                {f.options?.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : f.fieldType === 'checkbox' ? (
              <label className="flex items-center space-x-2 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={!!formData[f.id]}
                  onChange={e => setFormData({ ...formData, [f.id]: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{f.placeholder || 'Yes'}</span>
              </label>
            ) : (
              <input
                type={f.fieldType}
                disabled={disabled}
                value={formData[f.id] || ''}
                onChange={e => setFormData({ ...formData, [f.id]: e.target.value })}
                placeholder={f.placeholder}
                className={inputClass}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={() => isValid && onSubmit({ formData })}
          disabled={disabled || !isValid}
          className={`px-6 py-2 rounded-md font-medium text-white transition-colors ${(disabled || !isValid) ? 'bg-blue-400 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          Submit Form
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 4. ChecklistRenderer
// ----------------------------------------------------------------------
export function ChecklistRenderer({ 
  content, 
  onSubmit, 
  isDarkMode, 
  disabled,
  existingResponse
}: { 
  content: ChecklistContent; 
  onSubmit: (data: any) => void; 
  isDarkMode: boolean; 
  disabled?: boolean;
  existingResponse?: any;
}) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(existingResponse?.checkedItems || {});

  const toggleItem = (id: string) => {
    if (disabled) return;
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const requiredItems = content.items.filter(i => i.required);
  const checkedRequiredCount = requiredItems.filter(i => checkedItems[i.id]).length;
  const isComplete = requiredItems.length === 0 || checkedRequiredCount === requiredItems.length;
  
  const totalItems = content.items.length;
  const totalChecked = content.items.filter(i => checkedItems[i.id]).length;
  const progressPercent = totalItems > 0 ? (totalChecked / totalItems) * 100 : 0;

  return (
    <div className={`space-y-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>Progress</span>
          <span>{totalChecked} of {totalItems} completed</span>
        </div>
        <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div 
            className="h-full bg-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {content.items.map(item => {
          const isChecked = !!checkedItems[item.id];
          return (
            <div 
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`flex items-start p-3 rounded-md border transition-colors cursor-pointer
                ${isChecked ? (isDarkMode ? 'border-blue-500 bg-blue-900/20' : 'border-blue-500 bg-blue-50/50') : (isDarkMode ? 'border-gray-700 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300')}
                ${disabled ? 'opacity-70 cursor-not-allowed' : ''}
              `}
            >
              <div className="mt-0.5 mr-3 flex-shrink-0">
                {isChecked ? (
                  <CheckSquare className="w-5 h-5 text-blue-500" />
                ) : (
                  <SquareOutline className={`w-5 h-5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                )}
              </div>
              <div className="flex-1">
                <span className={`${isChecked ? (isDarkMode ? 'text-gray-300 line-through' : 'text-gray-500 line-through') : ''}`}>
                  {item.text} {item.required && <span className="text-red-500 no-underline">*</span>}
                </span>
                {item.linkUrl && (
                  <a 
                    href={safeExternalUrl(item.linkUrl)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className={`inline-flex items-center ml-2 text-sm text-blue-500 hover:underline ${isChecked ? 'opacity-50' : ''}`}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Resource
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={() => isComplete && onSubmit({ checkedItems, completed: true })}
          disabled={disabled || !isComplete}
          className={`px-6 py-2 rounded-md font-medium text-white transition-colors ${(disabled || !isComplete) ? 'bg-blue-400 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          Mark as Complete
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 5. PolicyRenderer
// ----------------------------------------------------------------------
export function PolicyRenderer({ 
  content, 
  onSubmit, 
  isDarkMode, 
  disabled,
  existingResponse
}: { 
  content: PolicyAcknowledgmentContent; 
  onSubmit: (data: any) => void; 
  isDarkMode: boolean; 
  disabled?: boolean;
  existingResponse?: any;
}) {
  const [hasScrolled, setHasScrolled] = useState(!content.requireScrollToBottom || !!existingResponse);
  const [acknowledged, setAcknowledged] = useState(!!existingResponse?.acknowledged);
  const [esignConsent, setEsignConsent] = useState(!!existingResponse?.esignConsent);
  const [typedName, setTypedName] = useState(existingResponse?.typedName || '');
  const [signatureData, setSignatureData] = useState(existingResponse?.signatureData || '');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !content.requireScrollToBottom || hasScrolled) return;

    const handleScroll = () => {
      if (el.scrollHeight - el.scrollTop <= el.clientHeight + 10) {
        setHasScrolled(true);
      }
    };
    el.addEventListener('scroll', handleScroll);
    handleScroll(); // Check if already at bottom initially
    
    return () => el.removeEventListener('scroll', handleScroll);
  }, [content.requireScrollToBottom, hasScrolled]);

  useEffect(() => {
    // Redraw signature if it exists
    if (signatureData && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      const img = new Image();
      img.onload = () => {
        if (ctx) ctx.drawImage(img, 0, 0);
      };
      img.src = signatureData;
    }
  }, [signatureData]);

  // Simple canvas drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let x, y;
    if ('touches' in e) {
      const rect = canvas.getBoundingClientRect();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.nativeEvent.offsetX;
      y = e.nativeEvent.offsetY;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = isDarkMode ? '#fff' : '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let x, y;
    if ('touches' in e) {
      const rect = canvas.getBoundingClientRect();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.nativeEvent.offsetX;
      y = e.nativeEvent.offsetY;
    }
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    if (disabled) return;
    setSignatureData('');
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const isValid = 
    hasScrolled && 
    acknowledged && 
    esignConsent &&
    (!content.requireTypedName || typedName.trim().length > 0) &&
    (!content.requireDrawnSignature || signatureData.length > 0);

  return (
    <div className={`space-y-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      <div 
        ref={scrollRef}
        className={`h-64 overflow-y-auto p-4 rounded-md border whitespace-pre-wrap font-mono text-sm
          ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-300'}
        `}
      >
        {content.policyText}
      </div>

      <div className="space-y-4 pt-2">
        <label className={`flex items-start space-x-3 cursor-pointer ${!hasScrolled ? 'opacity-50' : ''}`}>
          <input
            type="checkbox"
            disabled={disabled || !hasScrolled}
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
            className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium">
            {content.acknowledgmentText}
            {content.requireScrollToBottom && !hasScrolled && (
              <span className="block text-sm text-red-500 font-normal mt-1">
                Please scroll to the end of the document to acknowledge.
              </span>
            )}
          </span>
        </label>

        {content.consentDisclosure && (
          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {content.consentDisclosure}
          </p>
        )}

        <label className={`flex items-start space-x-3 cursor-pointer ${!hasScrolled ? 'opacity-50' : ''}`}>
          <input
            type="checkbox"
            disabled={disabled || !hasScrolled}
            checked={esignConsent}
            onChange={e => setEsignConsent(e.target.checked)}
            className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium">
            {content.esignConsentText || "I agree to conduct business electronically and understand that my digital signature is legally binding under the ESIGN Act (15 U.S.C. § 7001 et seq.)."}
          </span>
        </label>

        {content.requireTypedName && (
          <div className="pt-2">
            <label className="block font-medium mb-1">Electronic Signature (Type Full Name) <span className="text-red-500">*</span></label>
            <input
              type="text"
              disabled={disabled}
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder="e.g. Jane Doe"
              className={`w-full max-w-md p-2 rounded-md border focus:ring-2 focus:ring-blue-500 outline-none
                ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}
              `}
            />
          </div>
        )}

        {content.requireDrawnSignature && (
          <div className="pt-2">
            <div className="flex justify-between items-center mb-1 max-w-md">
              <label className="block font-medium">Draw Signature <span className="text-red-500">*</span></label>
              {!disabled && (
                <button type="button" onClick={clearSignature} className="text-xs text-blue-500 hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className={`border rounded-md max-w-md bg-white ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                className={`w-full h-full ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-crosshair'}`}
                style={{ touchAction: 'none' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => isValid && onSubmit({ 
            acknowledged, 
            typedName, 
            signatureData, 
            timestamp: new Date().toISOString(),
            esignConsent: true,
            esignConsentTimestamp: new Date().toISOString(),
          })}
          disabled={disabled || !isValid}
          className={`px-6 py-2 rounded-md font-medium text-white transition-colors ${(disabled || !isValid) ? 'bg-blue-400 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          Sign & Accept
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 6. ExternalVerificationRenderer
// ----------------------------------------------------------------------
export function ExternalVerificationRenderer({ 
  content, 
  onSubmit, 
  isDarkMode, 
  disabled,
  existingResponse
}: { 
  content: ExternalVerificationContent; 
  onSubmit: (data: any) => void; 
  isDarkMode: boolean; 
  disabled?: boolean;
  existingResponse?: any;
}) {
  const [code, setCode] = useState(existingResponse?.code || '');
  const [codeError, setCodeError] = useState(false);

  const handleOpenExternal = () => {
    window.open(safeExternalUrl(content.externalUrl), '_blank', 'noopener,noreferrer');
  };

  const handleSubmitCode = () => {
    if (disabled) return;
    if (content.validCodes && content.validCodes.length > 0) {
      if (content.validCodes.includes(code.trim())) {
        setCodeError(false);
        onSubmit({ code: code.trim(), verified: true });
      } else {
        setCodeError(true);
      }
    } else {
      // Any code accepted if none provided in config
      onSubmit({ code: code.trim(), verified: true });
    }
  };

  return (
    <div className={`space-y-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      {content.instructions && (
        <p className={`p-4 rounded-md ${isDarkMode ? 'bg-blue-900/20 text-blue-200' : 'bg-blue-50 text-blue-800'}`}>
          {content.instructions}
        </p>
      )}

      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg border-gray-300 dark:border-gray-700">
        <ExternalLink className={`w-12 h-12 mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
        <button
          onClick={handleOpenExternal}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center shadow-sm transition-colors"
        >
          Open External Resource
          <ExternalLink className="w-4 h-4 ml-2" />
        </button>
        <p className="mt-3 text-sm text-gray-500">Opens in a new tab</p>
      </div>

      {content.verificationMethod === 'completion_code' && (
        <div className="pt-4 max-w-md mx-auto">
          <label className="block font-medium mb-2 text-center">Enter Completion Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              disabled={disabled}
              value={code}
              onChange={e => { setCode(e.target.value); setCodeError(false); }}
              placeholder="e.g. CERT-123"
              className={`flex-1 p-2 rounded-md border focus:ring-2 focus:ring-blue-500 outline-none
                ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}
                ${codeError ? 'border-red-500' : ''}
              `}
            />
            <button
              onClick={handleSubmitCode}
              disabled={disabled || !code.trim()}
              className={`px-4 py-2 rounded-md font-medium text-white transition-colors ${(disabled || !code.trim()) ? 'bg-blue-400 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              Verify
            </button>
          </div>
          {codeError && <p className="text-red-500 text-sm mt-1 text-center">Invalid completion code. Please try again.</p>}
        </div>
      )}

      {content.verificationMethod === 'admin_verify' && (
        <div className={`p-4 rounded-md flex items-start ${isDarkMode ? 'bg-yellow-900/20 text-yellow-200' : 'bg-yellow-50 text-yellow-800'}`}>
          <Info className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Admin Verification Required</p>
            <p className="text-sm mt-1">Once you complete the external resource, click the button below. A manager will verify your completion.</p>
          </div>
        </div>
      )}

      {content.verificationMethod === 'upload_certificate' && (
        <div className={`p-4 rounded-md flex items-start ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <Info className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm">Please use the document upload feature on this task to submit your certificate of completion.</p>
        </div>
      )}

      {content.verificationMethod === 'admin_verify' && (
        <div className="flex justify-end pt-4">
          <button
            onClick={() => onSubmit({ status: 'pending_admin_review' })}
            disabled={disabled}
            className={`px-6 py-2 rounded-md font-medium text-white transition-colors ${disabled ? 'bg-blue-400 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Mark as Completed
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// 7. RecordedResponseRenderer
// ----------------------------------------------------------------------
export function RecordedResponseRenderer({ 
  content, 
  onSubmit, 
  isDarkMode, 
  disabled,
  existingResponse
}: { 
  content: RecordedResponseContent; 
  onSubmit: (data: any) => void; 
  isDarkMode: boolean; 
  disabled?: boolean;
  existingResponse?: any;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string>(existingResponse?.mediaUrl || '');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= content.maxDurationSeconds) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, content.maxDurationSeconds]);

  const startRecording = async () => {
    try {
      const isVideo = content.mediaType === 'video' || content.mediaType === 'either';
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: isVideo 
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: isVideo ? 'video/webm' : 'audio/webm' });
        setMediaBlob(blob);
        setMediaUrl(URL.createObjectURL(blob));
        // Stop all tracks to turn off camera/mic light
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      setMediaBlob(null);
      setMediaUrl('');
    } catch (err) {
      console.error('Error accessing media devices:', err);
      alert('Could not access microphone/camera. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const resetRecording = () => {
    setMediaBlob(null);
    setMediaUrl('');
    setDuration(0);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Simulated upload for client-side representation, usually handled in parent
  const handleSubmit = () => {
    if (mediaBlob) {
      onSubmit({ 
        mediaBlob, 
        duration, 
        type: mediaBlob.type.includes('video') ? 'video' : 'audio' 
      });
    } else if (mediaUrl && existingResponse) {
      onSubmit({ mediaUrl, existingResponse: true });
    }
  };

  const hasMedia = !!mediaUrl;

  return (
    <div className={`space-y-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      <div className={`p-4 rounded-md font-medium text-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        "{content.prompt}"
      </div>

      <div className="flex flex-col items-center justify-center p-6 border rounded-lg bg-black/5 dark:bg-black/20">
        {!hasMedia && !isRecording && (
          <div className="text-center">
            <div className="mb-4 text-gray-500">
              <Mic className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Ready to record</p>
              <p className="text-sm">Max duration: {formatTime(content.maxDurationSeconds)}</p>
            </div>
            <button
              onClick={startRecording}
              disabled={disabled}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium flex items-center shadow-sm transition-colors"
            >
              <div className="w-3 h-3 rounded-full bg-white mr-2 animate-pulse" />
              Start Recording
            </button>
          </div>
        )}

        {isRecording && (
          <div className="text-center">
            <div className="mb-4 text-red-500 font-mono text-2xl font-bold flex items-center justify-center animate-pulse">
              <div className="w-4 h-4 rounded-full bg-red-500 mr-3" />
              {formatTime(duration)} / {formatTime(content.maxDurationSeconds)}
            </div>
            <button
              onClick={stopRecording}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-full font-medium flex items-center shadow-sm transition-colors"
            >
              <Square className="w-4 h-4 mr-2" fill="currentColor" />
              Stop Recording
            </button>
          </div>
        )}

        {hasMedia && !isRecording && (
          <div className="w-full max-w-md space-y-4">
            {mediaUrl.includes('video') || content.mediaType === 'video' || content.mediaType === 'either' ? (
              <video ref={videoRef} src={mediaUrl} controls className="w-full rounded-md bg-black" />
            ) : (
              <audio ref={audioRef} src={mediaUrl} controls className="w-full" />
            )}
            
            <div className="flex justify-center pt-2">
              <button
                onClick={resetRecording}
                disabled={disabled}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSubmit}
          disabled={disabled || !hasMedia}
          className={`px-6 py-2 rounded-md font-medium text-white transition-colors ${(disabled || !hasMedia) ? 'bg-blue-400 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          Submit Recording
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 8. PdfFormRenderer
// ----------------------------------------------------------------------
export function PdfFormRenderer({
  content,
  onSubmit,
  isDarkMode,
  disabled,
  existingResponse,
  orgId,
  taskId,
}: {
  content: PdfFormContent;
  onSubmit: (data: any) => void;
  isDarkMode: boolean;
  disabled?: boolean;
  existingResponse?: any;
  orgId?: string;
  taskId?: string;
}) {
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>(() => {
    if (existingResponse?.fieldValues) return existingResponse.fieldValues;
    const initial: Record<string, string | boolean> = {};
    if (content.detectedFields) {
      for (const f of content.detectedFields) {
        if (f.currentValue !== undefined) {
          initial[f.name] = f.currentValue;
        } else if (f.type === 'checkbox') {
          initial[f.name] = false;
        } else {
          initial[f.name] = '';
        }
      }
    }
    return initial;
  });

  const [typedName, setTypedName] = useState(existingResponse?.typedName || '');
  const [signatureData, setSignatureData] = useState(existingResponse?.signatureData || '');
  const [esignConsent, setEsignConsent] = useState(existingResponse?.esignConsent ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processResult, setProcessResult] = useState<{
    downloadUrl?: string;
    sha256Hash?: string;
    fieldsFilled?: number;
  } | null>(existingResponse ? { downloadUrl: existingResponse.downloadUrl, sha256Hash: existingResponse.sha256Hash } : null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  // Signature Suite Phase A: the full pad (Draw / Type / Upload / saved) as an alternative to the inline pad.
  const [isPadOpen, setIsPadOpen] = useState(false);

  // Redraw existing signature if present
  useEffect(() => {
    if (signatureData && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, 400, 150);
          // Fit inside the pad (typed/uploaded signatures aren't drawn at pad size).
          const scale = Math.min(1, 400 / img.width, 150 / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (400 - w) / 2, (150 - h) / 2, w, h);
        };
        img.src = signatureData;
      }
    }
  }, [signatureData]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled || isSubmitting) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled || isSubmitting) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    setSignatureData('');
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const updateField = (name: string, value: string | boolean) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  };

  const isFormValid = useMemo(() => {
    if (content.requireEsignConsent && !esignConsent) return false;
    if (content.requireSignature && (!signatureData || !typedName.trim())) return false;
    return true;
  }, [content, esignConsent, signatureData, typedName]);

  const handleSubmit = async () => {
    if (!isFormValid || disabled || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let finalResult = null;

      // If orgId and taskId are provided, call process API directly
      if (orgId && taskId) {
        const headers = await getAuthHeaders();
        // Signature Suite Phase B: one signature, stamped at every configured spot.
        const spots = signatureSpotsOf(content);
        const signatures = signatureData && spots.length
          ? spots.map((s) => ({ imageData: signatureData, ...s }))
          : undefined;

        const res = await fetch('/api/onboarding/pdf-form/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            orgId,
            taskId,
            pdfSourceStoragePath: content.pdfStoragePath,
            pdfSourceUrl: content.pdfDownloadUrl,
            fields: fieldValues,
            signatures,
            signerName: typedName || 'Signer',
            documentCategory: content.documentCategory || 'fillable_pdf',
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to process PDF form');
        }
        finalResult = data;
        setProcessResult(data);
      }

      onSubmit({
        type: 'pdf_form_fill',
        fieldValues,
        typedName,
        signatureData,
        esignConsent,
        submittedAt: new Date().toISOString(),
        downloadUrl: finalResult?.downloadUrl,
        sha256Hash: finalResult?.sha256Hash,
      });
    } catch (err: any) {
      console.error('[PdfFormRenderer] Submit error:', err);
      setErrorMsg(err.message || 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Phase 2 Step 2.4 — fill directly on the PDF when field geometry is available;
  // otherwise (or if loading fails) keep the standard form grid below.
  const visualSource = usePdfFormSource({ content, taskId, orgId });
  if (visualSource.status === 'loading') {
    return (
      <div className={`flex items-center justify-center gap-2 py-16 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        <Loader2 className="w-5 h-5 animate-spin" /> Loading document…
      </div>
    );
  }
  if (visualSource.status === 'ready') {
    return (
      <PdfFormVisualRenderer
        content={content}
        fields={visualSource.fields}
        pdfBytes={visualSource.pdfBytes}
        fileUrl={visualSource.fileUrl}
        onSubmit={onSubmit}
        isDarkMode={isDarkMode}
        disabled={disabled}
        existingResponse={existingResponse}
        orgId={orgId}
        taskId={taskId}
      />
    );
  }

  const fields = content.detectedFields || [];

  // Phase 5 Step 5.1 — a PDF with no AcroForm fields (scanned / flattened) has nothing to type into.
  // Unless the admin set up an on-page signature, use the proven upload flow instead of an empty form.
  const signsOnPage = !!content.requireSignature && signatureSpotsOf(content).length > 0;
  if (fields.length === 0 && !signsOnPage && orgId && taskId && !processResult?.downloadUrl) {
    return (
      <PdfUploadFallback content={content} orgId={orgId} taskId={taskId} isDarkMode={isDarkMode} disabled={disabled} />
    );
  }

  return (
    <div className="space-y-6">
      {/* Form Header */}
      <div className={`p-4 rounded-xl border flex items-center justify-between ${
        isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
          }`}>
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm">{content.pdfTitle || 'Fillable PDF Form'}</h4>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {fields.length} field{fields.length !== 1 ? 's' : ''} to complete
              {content.pageCount ? ` • ${content.pageCount} page${content.pageCount !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
        </div>
        {content.pdfDownloadUrl && (
          <a
            href={content.pdfDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" /> View Original
          </a>
        )}
      </div>

      {/* Processed / Signed Result Banner */}
      {processResult?.downloadUrl && (
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          isDarkMode ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <div className="font-bold text-sm">PDF Form Flattened & Sealed ✓</div>
              {processResult.sha256Hash && (
                <div className="text-[11px] opacity-80 font-mono truncate max-w-md">
                  SHA-256: {processResult.sha256Hash}
                </div>
              )}
            </div>
          </div>
          <a
            href={processResult.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Download Sealed PDF
          </a>
        </div>
      )}

      {/* AcroForm Fields Grid */}
      {fields.length > 0 && (
        <div className="space-y-4">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Form Inputs</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => {
              const val = fieldValues[field.name];

              if (field.type === 'checkbox') {
                return (
                  <label
                    key={field.name}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isDarkMode ? 'bg-slate-800/40 border-slate-700 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={disabled || isSubmitting}
                      checked={!!val}
                      onChange={(e) => updateField(field.name, e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium">{field.name}</span>
                  </label>
                );
              }

              if (field.type === 'dropdown' && field.options) {
                return (
                  <div key={field.name} className="space-y-1">
                    <label className="block text-xs font-semibold">{field.name}</label>
                    <select
                      disabled={disabled || isSubmitting}
                      value={String(val || '')}
                      onChange={(e) => updateField(field.name, e.target.value)}
                      className={`w-full p-2 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">-- Select option --</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                );
              }

              return (
                <div key={field.name} className="space-y-1">
                  <label className="block text-xs font-semibold">{field.name}</label>
                  <input
                    type="text"
                    disabled={disabled || isSubmitting}
                    value={String(val || '')}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    placeholder={`Enter ${field.name}`}
                    className={`w-full p-2 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ESIGN Act Consent Checkbox */}
      {content.requireEsignConsent && (
        <div className={`p-4 rounded-xl border ${
          isDarkMode ? 'bg-indigo-950/30 border-indigo-800/40' : 'bg-indigo-50/70 border-indigo-200/80'
        }`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              disabled={disabled || isSubmitting}
              checked={esignConsent}
              onChange={(e) => setEsignConsent(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className={`text-xs font-medium ${isDarkMode ? 'text-indigo-200' : 'text-indigo-900'}`}>
              I agree to conduct business electronically and understand that my digital signature is legally binding under the ESIGN Act (15 U.S.C. § 7001 et seq.).
            </span>
          </label>
        </div>
      )}

      {/* Signature & Typed Name Section */}
      {content.requireSignature && (
        <div className="space-y-4 pt-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Electronic Signature</h5>

          <div className="space-y-1">
            <label className="block text-xs font-semibold">
              Type Full Legal Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              disabled={disabled || isSubmitting}
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="e.g. Jane Doe"
              className={`w-full max-w-md p-2 text-sm rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between max-w-md">
              <label className="block text-xs font-semibold">
                Draw Signature <span className="text-rose-500">*</span>
              </label>
              {!disabled && !isSubmitting && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPadOpen(true)}
                    className="text-xs text-indigo-500 hover:underline"
                  >
                    Type, upload or use saved
                  </button>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-xs text-indigo-500 hover:underline"
                  >
                    Clear Pad
                  </button>
                </div>
              )}
            </div>
            <div className={`border rounded-lg max-w-md bg-white overflow-hidden ${
              isDarkMode ? 'border-slate-700' : 'border-slate-300'
            }`}>
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                className={`w-full h-[150px] ${disabled || isSubmitting ? 'cursor-not-allowed opacity-70' : 'cursor-crosshair'}`}
                style={{ touchAction: 'none' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
          </div>
          <SignaturePadModal
            open={isPadOpen}
            isDarkMode={isDarkMode}
            defaultName={typedName}
            onCancel={() => setIsPadOpen(false)}
            onApply={(dataUrl) => {
              setSignatureData(dataUrl);
              setIsPadOpen(false);
            }}
          />
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={handleSubmit}
          disabled={disabled || isSubmitting || !isFormValid}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white transition-all shadow-sm ${
            disabled || isSubmitting || !isFormValid
              ? 'bg-indigo-400 opacity-50 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Flattening & Sealing PDF...
            </>
          ) : (
            <>
              <PenTool className="w-4 h-4" />
              Submit & Sign PDF Form
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Dispatcher
// ----------------------------------------------------------------------
export function InteractiveContentRenderer({ 
  content, 
  onSubmit, 
  isDarkMode, 
  disabled,
  existingResponse,
  orgId,
  taskId,
}: {
  content: InteractiveContent;
  onSubmit: (responseData: any) => void;
  isDarkMode: boolean;
  disabled?: boolean;
  existingResponse?: any;
  orgId?: string;
  taskId?: string;
}) {
  switch (content.type) {
    case 'quiz':
      return <QuizRenderer content={content} onSubmit={onSubmit} isDarkMode={isDarkMode} disabled={disabled} existingResponse={existingResponse} />;
    case 'short_answer':
      return <ShortAnswerRenderer content={content} onSubmit={onSubmit} isDarkMode={isDarkMode} disabled={disabled} existingResponse={existingResponse} />;
    case 'form':
      return <FormRenderer content={content} onSubmit={onSubmit} isDarkMode={isDarkMode} disabled={disabled} existingResponse={existingResponse} />;
    case 'checklist':
      return <ChecklistRenderer content={content} onSubmit={onSubmit} isDarkMode={isDarkMode} disabled={disabled} existingResponse={existingResponse} />;
    case 'policy_acknowledgment':
      return <PolicyRenderer content={content} onSubmit={onSubmit} isDarkMode={isDarkMode} disabled={disabled} existingResponse={existingResponse} />;
    case 'external_verification':
      return <ExternalVerificationRenderer content={content} onSubmit={onSubmit} isDarkMode={isDarkMode} disabled={disabled} existingResponse={existingResponse} />;
    case 'recorded_response':
      return <RecordedResponseRenderer content={content} onSubmit={onSubmit} isDarkMode={isDarkMode} disabled={disabled} existingResponse={existingResponse} />;
    case 'pdf_form': {
      // Signature Suite D6: Blueprint Preview uses fake `preview_…` task ids. There is no real
      // task or signing session behind them, so render the document in preview mode instead of
      // asking the server for a session (which failed with "does not use multiple signers").
      const isPreview = !!taskId && taskId.startsWith('preview_');
      const realTaskId = isPreview ? undefined : taskId;
      // Phase 3: multi-signer documents (inside a real task) use the signing workflow UI.
      if (realTaskId && isMultiSignerWorkflow(content)) {
        return <MultiSignerPdfForm content={content} taskId={realTaskId} orgId={orgId} isDarkMode={isDarkMode} />;
      }
      return (
        <div className="space-y-3">
          {isPreview && isMultiSignerWorkflow(content) && (
            <div className={`p-3 rounded-xl border text-xs ${isDarkMode ? 'bg-sky-950/30 border-sky-800/50 text-sky-200' : 'bg-sky-50 border-sky-200 text-sky-900'}`}>
              <div className="font-bold mb-1">Preview: signing order</div>
              <div>
                {[...((content as PdfFormContent).signingWorkflow?.signers || [])]
                  .sort((a, b) => a.order - b.order)
                  .map((s, i) => `${i + 1}. ${s.label || (s.kind === 'employee' ? 'Employee' : s.kind === 'supervisor' ? 'Supervisor' : s.memberName || 'Signer')}`)
                  .join('  →  ')}
              </div>
              <div className="mt-1 opacity-80">Signing starts for real once this blueprint is assigned to someone.</div>
            </div>
          )}
          <PdfFormRenderer content={content} onSubmit={onSubmit} isDarkMode={isDarkMode} disabled={disabled} existingResponse={existingResponse} orgId={orgId} taskId={realTaskId} />
        </div>
      );
    }
    default:
      return (
        <div className={`p-4 border rounded-md text-center ${isDarkMode ? 'border-red-800 bg-red-900/20 text-red-400' : 'border-red-200 bg-red-50 text-red-600'}`}>
          Unsupported content type.
        </div>
      );
  }
}

