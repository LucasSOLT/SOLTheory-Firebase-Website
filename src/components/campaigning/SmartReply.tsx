"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Zap } from "lucide-react";
import { getAIAssist } from "@/lib/gmail-api";
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';

interface SmartReplyProps {
  emailBody: string;
  emailSubject: string;
  emailFrom: string;
  onSelectReply: (reply: string) => void;
}

export default function SmartReply({ emailBody, emailSubject, emailFrom, onSelectReply }: SmartReplyProps) {
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const { knowledgeBaseText, pactText } = useKnowledgeBase('soltheory');

  const generateReplies = useCallback(async () => {
    if (loading || !emailBody) return;
    setLoading(true);
    const res = await getAIAssist("smart_reply", { emailBody, emailSubject, emailFrom }, knowledgeBaseText, pactText);
    setReplies(res.suggestions.filter((s) => s.length > 0));
    setLoading(false);
    setHasGenerated(true);
  }, [emailBody, emailSubject, emailFrom, loading]);

  // Auto-generate on mount if email body is present
  useEffect(() => {
    if (emailBody && !hasGenerated && emailFrom !== "You" && !emailFrom.includes("Draft")) {
      const timer = setTimeout(generateReplies, 600); // Small delay to feel natural
      return () => clearTimeout(timer);
    }
  }, [emailBody, hasGenerated, emailFrom, generateReplies]);

  if (!emailBody || emailFrom === "You" || emailFrom.includes("Draft")) return null;

  return (
    <div className="mt-4 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3 h-3 text-amber-500" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Smart Reply</span>
        {!hasGenerated && !loading && (
          <button onClick={generateReplies} className="text-[10px] text-slate-400 hover:text-slate-600 ml-auto cursor-pointer">
            Generate
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-2">
          <div className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
          <span className="text-[10px] text-slate-400">Generating suggestions...</span>
        </div>
      )}

      {replies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {replies.map((reply, i) => (
            <button
              key={i}
              onClick={() => onSelectReply(reply)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 cursor-pointer transition-colors leading-snug text-left max-w-[280px]"
            >
              {reply.length > 80 ? reply.slice(0, 80) + "…" : reply}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
