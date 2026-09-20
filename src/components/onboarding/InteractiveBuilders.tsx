'use client';

import React from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { 
  InteractiveContent, 
  QuizContent, QuizQuestion, QuizOption,
  ShortAnswerContent, ShortAnswerPrompt,
  FormContent, FormField,
  ChecklistContent, ChecklistItem,
  PolicyAcknowledgmentContent,
  ExternalVerificationContent,
  RecordedResponseContent
} from '@/types/onboarding-templates';

const inputClass = (isDarkMode: boolean) =>
  `w-full p-2 flex-1 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
  }`;

const checkboxClass = "w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500";

const cardClass = (isDarkMode: boolean) =>
  `p-4 rounded-lg border mb-4 ${
    isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
  }`;

const btnClass = "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded text-white bg-blue-600 hover:bg-blue-700 transition-colors";

interface BuilderProps<T> {
  content: T;
  onChange: (content: T) => void;
  isDarkMode: boolean;
}

// ── 1. Quiz Builder ──────────────────────────────────────────────────────────

export function QuizBuilder({ content, onChange, isDarkMode }: BuilderProps<QuizContent>) {
  const addQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: crypto.randomUUID(),
      text: '',
      questionType: 'multiple_choice',
      options: [
        { id: crypto.randomUUID(), text: 'Option 1', isCorrect: true },
        { id: crypto.randomUUID(), text: 'Option 2', isCorrect: false }
      ]
    };
    onChange({ ...content, questions: [...content.questions, newQuestion] });
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    const newQuestions = [...content.questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    onChange({ ...content, questions: newQuestions });
  };

  const removeQuestion = (index: number) => {
    const newQuestions = [...content.questions];
    newQuestions.splice(index, 1);
    onChange({ ...content, questions: newQuestions });
  };

  const addOption = (qIndex: number) => {
    const q = content.questions[qIndex];
    updateQuestion(qIndex, {
      options: [...q.options, { id: crypto.randomUUID(), text: '', isCorrect: false }]
    });
  };

  const updateOption = (qIndex: number, oIndex: number, updates: Partial<QuizOption>) => {
    const q = content.questions[qIndex];
    const newOptions = [...q.options];
    newOptions[oIndex] = { ...newOptions[oIndex], ...updates };
    updateQuestion(qIndex, { options: newOptions });
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    const q = content.questions[qIndex];
    const newOptions = [...q.options];
    newOptions.splice(oIndex, 1);
    updateQuestion(qIndex, { options: newOptions });
  };

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
        <h4 className="font-medium mb-4">Quiz Settings</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Passing Score (%)</label>
            <input 
              type="number" min="0" max="100" 
              value={content.passingScore} 
              onChange={e => onChange({ ...content, passingScore: Number(e.target.value) })}
              className={inputClass(isDarkMode)} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Attempts (0 = unlimited)</label>
            <input 
              type="number" min="0" 
              value={content.maxAttempts} 
              onChange={e => onChange({ ...content, maxAttempts: Number(e.target.value) })}
              className={inputClass(isDarkMode)} 
            />
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={content.shuffleQuestions} 
              onChange={e => onChange({ ...content, shuffleQuestions: e.target.checked })}
              className={checkboxClass}
            />
            <label className="text-sm">Shuffle Questions</label>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={content.shuffleAnswers} 
              onChange={e => onChange({ ...content, shuffleAnswers: e.target.checked })}
              className={checkboxClass}
            />
            <label className="text-sm">Shuffle Answers</label>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={content.showCorrectAnswers} 
              onChange={e => onChange({ ...content, showCorrectAnswers: e.target.checked })}
              className={checkboxClass}
            />
            <label className="text-sm">Show Correct Answers</label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {content.questions.map((q, qIndex) => (
          <div key={q.id} className={cardClass(isDarkMode)}>
            <div className="flex items-start gap-4 mb-4">
              <GripVertical className="mt-2 text-slate-400 cursor-move" size={20} />
              <div className="flex-1 space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={q.text}
                    onChange={e => updateQuestion(qIndex, { text: e.target.value })}
                    placeholder="Question text"
                    className={inputClass(isDarkMode)}
                  />
                  <select
                    value={q.questionType}
                    onChange={e => updateQuestion(qIndex, { questionType: e.target.value as any })}
                    className={inputClass(isDarkMode)}
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="select_all">Select All</option>
                    <option value="true_false">True/False</option>
                  </select>
                  <button onClick={() => removeQuestion(qIndex)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 size={20} />
                  </button>
                </div>
                
                <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-2">
                  {q.options.map((opt, oIndex) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input
                        type={q.questionType === 'multiple_choice' || q.questionType === 'true_false' ? 'radio' : 'checkbox'}
                        name={`q-${q.id}`}
                        checked={opt.isCorrect}
                        onChange={e => {
                          if (q.questionType === 'multiple_choice' || q.questionType === 'true_false') {
                            const newOptions = q.options.map((o, idx) => ({ ...o, isCorrect: idx === oIndex }));
                            updateQuestion(qIndex, { options: newOptions });
                          } else {
                            updateOption(qIndex, oIndex, { isCorrect: e.target.checked });
                          }
                        }}
                        className={checkboxClass}
                      />
                      <input
                        type="text"
                        value={opt.text}
                        onChange={e => updateOption(qIndex, oIndex, { text: e.target.value })}
                        placeholder="Option text"
                        className={`${inputClass(isDarkMode)} py-1 text-sm`}
                      />
                      <button onClick={() => removeOption(qIndex, oIndex)} className="text-slate-400 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {q.questionType !== 'true_false' && (
                    <button onClick={() => addOption(qIndex)} className="text-sm text-blue-500 hover:underline flex items-center gap-1">
                      <Plus size={14} /> Add Option
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addQuestion} className={btnClass}>
        <Plus size={16} /> Add Question
      </button>
    </div>
  );
}

// ── 2. Short Answer Builder ──────────────────────────────────────────────────

export function ShortAnswerBuilder({ content, onChange, isDarkMode }: BuilderProps<ShortAnswerContent>) {
  const addPrompt = () => {
    onChange({
      ...content,
      prompts: [...content.prompts, { id: crypto.randomUUID(), question: '', required: true }]
    });
  };

  const updatePrompt = (index: number, updates: Partial<ShortAnswerPrompt>) => {
    const newPrompts = [...content.prompts];
    newPrompts[index] = { ...newPrompts[index], ...updates };
    onChange({ ...content, prompts: newPrompts });
  };

  const removePrompt = (index: number) => {
    const newPrompts = [...content.prompts];
    newPrompts.splice(index, 1);
    onChange({ ...content, prompts: newPrompts });
  };

  return (
    <div className="space-y-6">
      <div className={`p-4 rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
        <h4 className="font-medium mb-4">Settings</h4>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" checked={content.reviewMode === 'auto_complete'} onChange={() => onChange({ ...content, reviewMode: 'auto_complete' })} className={checkboxClass} />
            <span className="text-sm">Auto-Complete (No review)</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={content.reviewMode === 'admin_review'} onChange={() => onChange({ ...content, reviewMode: 'admin_review' })} className={checkboxClass} />
            <span className="text-sm">Requires Admin Review</span>
          </label>
        </div>
      </div>

      <div className="space-y-4">
        {content.prompts.map((p, i) => (
          <div key={p.id} className={cardClass(isDarkMode)}>
            <div className="flex gap-4">
              <GripVertical className="mt-2 text-slate-400 cursor-move" size={20} />
              <div className="flex-1 space-y-4">
                <input
                  type="text" value={p.question} onChange={e => updatePrompt(i, { question: e.target.value })}
                  placeholder="Prompt/Question text" className={inputClass(isDarkMode)}
                />
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={p.required} onChange={e => updatePrompt(i, { required: e.target.checked })} className={checkboxClass} />
                    Required
                  </label>
                  <label className="flex items-center gap-2">
                    Min Length:
                    <input type="number" min="0" value={p.minLength || ''} onChange={e => updatePrompt(i, { minLength: e.target.value ? Number(e.target.value) : undefined })} className={`${inputClass(isDarkMode)} w-20 py-1`} />
                  </label>
                  <label className="flex items-center gap-2">
                    Max Length:
                    <input type="number" min="0" value={p.maxLength || ''} onChange={e => updatePrompt(i, { maxLength: e.target.value ? Number(e.target.value) : undefined })} className={`${inputClass(isDarkMode)} w-20 py-1`} />
                  </label>
                </div>
              </div>
              <button onClick={() => removePrompt(i)} className="text-red-500 hover:bg-red-50 p-2 rounded self-start">
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={addPrompt} className={btnClass}>
        <Plus size={16} /> Add Prompt
      </button>
    </div>
  );
}

// ── 3. Form Builder ──────────────────────────────────────────────────────────

export function FormBuilder({ content, onChange, isDarkMode }: BuilderProps<FormContent>) {
  const addField = () => {
    onChange({
      ...content,
      fields: [...content.fields, { id: crypto.randomUUID(), label: '', fieldType: 'text', required: false }]
    });
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const newFields = [...content.fields];
    newFields[index] = { ...newFields[index], ...updates };
    onChange({ ...content, fields: newFields });
  };

  const removeField = (index: number) => {
    const newFields = [...content.fields];
    newFields.splice(index, 1);
    onChange({ ...content, fields: newFields });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Form Title</label>
          <input type="text" value={content.title} onChange={e => onChange({ ...content, title: e.target.value })} className={inputClass(isDarkMode)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description (Optional)</label>
          <textarea value={content.description || ''} onChange={e => onChange({ ...content, description: e.target.value })} className={inputClass(isDarkMode)} rows={2} />
        </div>
      </div>

      <div className="space-y-4">
        {content.fields.map((f, i) => (
          <div key={f.id} className={cardClass(isDarkMode)}>
            <div className="flex gap-4">
              <GripVertical className="mt-2 text-slate-400 cursor-move" size={20} />
              <div className="flex-1 space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text" value={f.label} onChange={e => updateField(i, { label: e.target.value })}
                    placeholder="Field Label" className={inputClass(isDarkMode)}
                  />
                  <select
                    value={f.fieldType} onChange={e => updateField(i, { fieldType: e.target.value as any })}
                    className={inputClass(isDarkMode)}
                  >
                    <option value="text">Short Text</option>
                    <option value="textarea">Long Text</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="dropdown">Dropdown</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                  <button onClick={() => removeField(i)} className="text-red-500 hover:bg-red-50 p-2 rounded">
                    <Trash2 size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={f.required} onChange={e => updateField(i, { required: e.target.checked })} className={checkboxClass} />
                    Required
                  </label>
                  <input
                    type="text" value={f.placeholder || ''} onChange={e => updateField(i, { placeholder: e.target.value })}
                    placeholder="Placeholder (optional)" className={`${inputClass(isDarkMode)} py-1 max-w-xs`}
                  />
                </div>
                {f.fieldType === 'dropdown' && (
                  <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                    <label className="block text-xs font-medium mb-2 text-slate-500">Dropdown Options (one per line)</label>
                    <textarea 
                      value={(f.options || []).join('\n')}
                      onChange={e => updateField(i, { options: e.target.value.split('\n').filter(s => s.trim()) })}
                      className={inputClass(isDarkMode)} rows={3} placeholder="Option 1&#10;Option 2"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={addField} className={btnClass}>
        <Plus size={16} /> Add Field
      </button>
    </div>
  );
}

// ── 4. Checklist Builder ─────────────────────────────────────────────────────

export function ChecklistBuilder({ content, onChange, isDarkMode }: BuilderProps<ChecklistContent>) {
  const addItem = () => {
    onChange({
      ...content,
      items: [...content.items, { id: crypto.randomUUID(), text: '', required: true }]
    });
  };

  const updateItem = (index: number, updates: Partial<ChecklistItem>) => {
    const newItems = [...content.items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange({ ...content, items: newItems });
  };

  const removeItem = (index: number) => {
    const newItems = [...content.items];
    newItems.splice(index, 1);
    onChange({ ...content, items: newItems });
  };

  return (
    <div className="space-y-4">
      {content.items.map((item, i) => (
        <div key={item.id} className={cardClass(isDarkMode)}>
          <div className="flex gap-4 items-start">
            <GripVertical className="mt-2 text-slate-400 cursor-move" size={20} />
            <div className="flex-1 space-y-2">
              <input
                type="text" value={item.text} onChange={e => updateItem(i, { text: e.target.value })}
                placeholder="Checklist item text" className={inputClass(isDarkMode)}
              />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={item.required} onChange={e => updateItem(i, { required: e.target.checked })} className={checkboxClass} />
                  Required
                </label>
                <input
                  type="text" value={item.linkUrl || ''} onChange={e => updateItem(i, { linkUrl: e.target.value })}
                  placeholder="Reference URL (optional)" className={`${inputClass(isDarkMode)} py-1 text-sm`}
                />
              </div>
            </div>
            <button onClick={() => removeItem(i)} className="text-red-500 hover:bg-red-50 p-2 rounded">
              <Trash2 size={20} />
            </button>
          </div>
        </div>
      ))}
      <button onClick={addItem} className={btnClass}>
        <Plus size={16} /> Add Item
      </button>
    </div>
  );
}

// ── 5. Policy Builder ────────────────────────────────────────────────────────

export function PolicyBuilder({ content, onChange, isDarkMode }: BuilderProps<PolicyAcknowledgmentContent>) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">Policy Text (Markdown supported)</label>
        <textarea 
          value={content.policyText} 
          onChange={e => onChange({ ...content, policyText: e.target.value })}
          className={inputClass(isDarkMode)} rows={10} 
        />
      </div>

      <div className={`p-4 rounded-lg border space-y-4 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
        <h4 className="font-medium">Requirements</h4>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={content.requireScrollToBottom} onChange={e => onChange({ ...content, requireScrollToBottom: e.target.checked })} className={checkboxClass} />
          <span className="text-sm">Require user to scroll to bottom</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={content.requireTypedName} onChange={e => onChange({ ...content, requireTypedName: e.target.checked })} className={checkboxClass} />
          <span className="text-sm">Require typed full name</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={content.requireDrawnSignature} onChange={e => onChange({ ...content, requireDrawnSignature: e.target.checked })} className={checkboxClass} />
          <span className="text-sm">Require drawn signature</span>
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Acknowledgment Checkbox Text</label>
          <input 
            type="text" value={content.acknowledgmentText} 
            onChange={e => onChange({ ...content, acknowledgmentText: e.target.value })}
            className={inputClass(isDarkMode)} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Consent Disclosure (ESIGN Act)</label>
          <textarea 
            value={content.consentDisclosure} 
            onChange={e => onChange({ ...content, consentDisclosure: e.target.value })}
            className={inputClass(isDarkMode)} rows={3} 
          />
        </div>
      </div>
    </div>
  );
}

// ── 6. External Verification Builder ─────────────────────────────────────────

export function ExternalVerificationBuilder({ content, onChange, isDarkMode }: BuilderProps<ExternalVerificationContent>) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">External Resource URL</label>
        <input 
          type="url" value={content.externalUrl} 
          onChange={e => onChange({ ...content, externalUrl: e.target.value })}
          className={inputClass(isDarkMode)} placeholder="https://"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Instructions for User</label>
        <textarea 
          value={content.instructions || ''} 
          onChange={e => onChange({ ...content, instructions: e.target.value })}
          className={inputClass(isDarkMode)} rows={3} 
        />
      </div>

      <div className={`p-4 rounded-lg border space-y-4 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
        <h4 className="font-medium">Verification Method</h4>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="radio" checked={content.verificationMethod === 'upload_certificate'} onChange={() => onChange({ ...content, verificationMethod: 'upload_certificate' })} className={checkboxClass} />
            <span className="text-sm">User uploads completion certificate</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={content.verificationMethod === 'admin_verify'} onChange={() => onChange({ ...content, verificationMethod: 'admin_verify' })} className={checkboxClass} />
            <span className="text-sm">Admin verifies manually (No user action required to complete)</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={content.verificationMethod === 'completion_code'} onChange={() => onChange({ ...content, verificationMethod: 'completion_code' })} className={checkboxClass} />
            <span className="text-sm">User enters a completion code</span>
          </label>
        </div>

        {content.verificationMethod === 'completion_code' && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <label className="block text-sm font-medium mb-1">Valid Codes (one per line)</label>
            <textarea 
              value={(content.validCodes || []).join('\n')}
              onChange={e => onChange({ ...content, validCodes: e.target.value.split('\n').filter(s => s.trim()) })}
              className={inputClass(isDarkMode)} rows={3} placeholder="CODE123&#10;PASS456"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── 7. Recorded Response Builder ─────────────────────────────────────────────

export function RecordedResponseBuilder({ content, onChange, isDarkMode }: BuilderProps<RecordedResponseContent>) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">Prompt / Question</label>
        <textarea 
          value={content.prompt} 
          onChange={e => onChange({ ...content, prompt: e.target.value })}
          className={inputClass(isDarkMode)} rows={3} 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`p-4 rounded-lg border space-y-4 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
          <h4 className="font-medium text-sm">Media Type</h4>
          <label className="flex items-center gap-2">
            <input type="radio" checked={content.mediaType === 'video'} onChange={() => onChange({ ...content, mediaType: 'video' })} className={checkboxClass} />
            <span className="text-sm">Video Only</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={content.mediaType === 'audio'} onChange={() => onChange({ ...content, mediaType: 'audio' })} className={checkboxClass} />
            <span className="text-sm">Audio Only</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={content.mediaType === 'either'} onChange={() => onChange({ ...content, mediaType: 'either' })} className={checkboxClass} />
            <span className="text-sm">Video or Audio</span>
          </label>
        </div>

        <div className={`p-4 rounded-lg border space-y-4 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
          <h4 className="font-medium text-sm">Review Mode</h4>
          <label className="flex items-center gap-2">
            <input type="radio" checked={content.reviewMode === 'auto_complete'} onChange={() => onChange({ ...content, reviewMode: 'auto_complete' })} className={checkboxClass} />
            <span className="text-sm">Auto-Complete</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={content.reviewMode === 'admin_review'} onChange={() => onChange({ ...content, reviewMode: 'admin_review' })} className={checkboxClass} />
            <span className="text-sm">Requires Admin Review</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Max Duration (seconds)</label>
        <input 
          type="number" min="10" 
          value={content.maxDurationSeconds} 
          onChange={e => onChange({ ...content, maxDurationSeconds: Number(e.target.value) })}
          className={`${inputClass(isDarkMode)} max-w-xs`} 
        />
      </div>
    </div>
  );
}

// ── Wrapper ──────────────────────────────────────────────────────────────────

export function InteractiveContentBuilder({ itemType, content, onChange, isDarkMode }: {
  itemType: string;
  content: InteractiveContent | undefined;
  onChange: (content: InteractiveContent) => void;
  isDarkMode: boolean;
}) {
  // Auto-initialize content based on type if undefined
  React.useEffect(() => {
    if (!content || content.type !== itemType) {
      let defaultContent: InteractiveContent | undefined;
      
      switch (itemType) {
        case 'quiz':
          defaultContent = {
            type: 'quiz',
            questions: [],
            passingScore: 80,
            maxAttempts: 0,
            shuffleQuestions: false,
            shuffleAnswers: false,
            showCorrectAnswers: true
          };
          break;
        case 'short_answer':
          defaultContent = {
            type: 'short_answer',
            prompts: [],
            reviewMode: 'auto_complete'
          };
          break;
        case 'form':
          defaultContent = {
            type: 'form',
            title: '',
            fields: []
          };
          break;
        case 'checklist':
          defaultContent = {
            type: 'checklist',
            items: []
          };
          break;
        case 'policy_acknowledgment':
          defaultContent = {
            type: 'policy_acknowledgment',
            policyText: '',
            requireScrollToBottom: true,
            requireTypedName: true,
            requireDrawnSignature: true,
            acknowledgmentText: 'I have read and agree to the above policy',
            consentDisclosure: 'By signing, you agree that your electronic signature is the legally binding equivalent to your handwritten signature.'
          };
          break;
        case 'external_verification':
          defaultContent = {
            type: 'external_verification',
            externalUrl: '',
            verificationMethod: 'upload_certificate'
          };
          break;
        case 'recorded_response':
          defaultContent = {
            type: 'recorded_response',
            prompt: '',
            maxDurationSeconds: 120,
            mediaType: 'either',
            reviewMode: 'auto_complete'
          };
          break;
      }
      
      if (defaultContent) {
        onChange(defaultContent);
      }
    }
  }, [itemType, content, onChange]);

  if (!content || content.type !== itemType) return null;

  switch (content.type) {
    case 'quiz':
      return <QuizBuilder content={content} onChange={onChange as any} isDarkMode={isDarkMode} />;
    case 'short_answer':
      return <ShortAnswerBuilder content={content} onChange={onChange as any} isDarkMode={isDarkMode} />;
    case 'form':
      return <FormBuilder content={content} onChange={onChange as any} isDarkMode={isDarkMode} />;
    case 'checklist':
      return <ChecklistBuilder content={content} onChange={onChange as any} isDarkMode={isDarkMode} />;
    case 'policy_acknowledgment':
      return <PolicyBuilder content={content} onChange={onChange as any} isDarkMode={isDarkMode} />;
    case 'external_verification':
      return <ExternalVerificationBuilder content={content} onChange={onChange as any} isDarkMode={isDarkMode} />;
    case 'recorded_response':
      return <RecordedResponseBuilder content={content} onChange={onChange as any} isDarkMode={isDarkMode} />;
    default:
      return null;
  }
}
