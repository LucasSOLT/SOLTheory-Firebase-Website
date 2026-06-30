"use client";

import { useState, useCallback } from "react";
import { Sparkles, Wand2, RefreshCw, Check, X, ChevronDown } from "lucide-react";
import { getAIAssist } from "@/lib/gmail-api";
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';

interface AIComposeAssistProps {
  subject: string;
  body: string;
  onApplySubject: (subject: string) => void;
  onApplyBody: (body: string) => void;
  onRewriteBody: (body: string) => void;
}

export default function AIComposeAssist({ subject, body, onApplySubject, onApplyBody, onRewriteBody }: AIComposeAssistProps) {
  const { knowledgeBaseText, pactText } = useKnowledgeBase('soltheory');
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [toneMenu, setToneMenu] = useState(false);

  const handleSubjectLines = useCallback(async () => {
    setLoading(true);
    setActiveAction("subject");
    const res = await getAIAssist("subject_lines", { emailBody: body, emailSubject: subject }, knowledgeBaseText, pactText);
    setSuggestions(res.suggestions);
    setLoading(false);
  }, [body, subject]);

  const handleDraftBody = useCallback(async () => {
    if (!draftPrompt.trim()) { setShowPromptInput(true); return; }
    setLoading(true);
    setActiveAction("draft");
    setShowPromptInput(false);
    const res = await getAIAssist("draft_body", { userPrompt: draftPrompt, emailSubject: subject }, knowledgeBaseText, pactText);
    if (res.suggestions[0]) onApplyBody(res.suggestions[0]);
    setSuggestions([]);
    setLoading(false);
    setDraftPrompt("");
  }, [draftPrompt, subject, onApplyBody]);

  const handleRewrite = useCallback(async (tone: "formal" | "friendly" | "concise" | "detailed") => {
    setToneMenu(false);
    if (!body.trim()) return;
    setLoading(true);
    setActiveAction("rewrite");
    const res = await getAIAssist("rewrite", { selectedText: body, tone }, knowledgeBaseText, pactText);
    if (res.suggestions[0]) onRewriteBody(res.suggestions[0]);
    setSuggestions([]);
    setLoading(false);
  }, [body, onRewriteBody]);

  const clearSuggestions = () => {
    setSuggestions([]);
    setActiveAction(null);
    setShowPromptInput(false);
    setToneMenu(false);
  };

  return (
    <div className="border-t border-slate-100 px-3 py-2">
      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleSubjectLines}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          title="Generate subject lines"
        >
          <Sparkles className="w-3 h-3" /> Subject
        </button>

        <button
          onClick={() => showPromptInput ? handleDraftBody() : setShowPromptInput(true)}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          title="AI draft email body"
        >
          <Wand2 className="w-3 h-3" /> Draft
        </button>

        <div className="relative">
          <button
            onClick={() => setToneMenu(!toneMenu)}
            disabled={loading || !body.trim()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            title="Adjust tone"
          >
            <RefreshCw className="w-3 h-3" /> Tone <ChevronDown className="w-2.5 h-2.5" />
          </button>
          {toneMenu && (
            <>
              <div className="fixed inset-0 z-[200]" onClick={() => setToneMenu(false)} />
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-[210] min-w-[140px]">
                {([
                  { id: "formal" as const, label: "More Formal" },
                  { id: "friendly" as const, label: "More Friendly" },
                  { id: "concise" as const, label: "More Concise" },
                  { id: "detailed" as const, label: "More Detailed" },
                ]).map((t) => (
                  <button key={t.id} onClick={() => handleRewrite(t.id)}
                    className="w-full text-left px-3 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
            <span className="text-[10px] text-slate-400">Thinking...</span>
          </div>
        )}
      </div>

      {/* Draft prompt input */}
      {showPromptInput && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDraftBody()}
            placeholder="Describe what you want to write, e.g., 'follow up on Q3 grant proposal'"
            className="flex-1 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300"
            autoFocus
          />
          <button onClick={handleDraftBody} disabled={!draftPrompt.trim()}
            className="px-3 py-2 rounded-lg bg-slate-800 text-white text-[10px] font-semibold disabled:opacity-40 cursor-pointer hover:bg-slate-900">
            Generate
          </button>
          <button onClick={() => setShowPromptInput(false)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 cursor-pointer">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Subject line suggestions */}
      {activeAction === "subject" && suggestions.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Suggested Subject Lines</span>
            <button onClick={clearSuggestions} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </div>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => { onApplySubject(s); clearSuggestions(); }}
              className="w-full text-left px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 cursor-pointer transition-colors flex items-center gap-2">
              <Check className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
