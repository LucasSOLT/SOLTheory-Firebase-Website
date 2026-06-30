"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smile,
  Hash,
  Wand2,
  Loader2,
  Check,
  AlertTriangle,
  Save,
  MessageSquareText,
  X,
  ImageIcon,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useInstagramStore } from "@/stores/instagramStore";
import { useAuth } from "@/firebase";
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHARS = 2200;
const MAX_HASHTAGS = 30;

/** Common emoji grid for quick insertion. */
const EMOJI_GRID = [
  ["😀", "😂", "🥰", "😍", "🤩", "😎", "🥳", "🤗"],
  ["🔥", "✨", "💫", "⭐", "🌟", "💥", "🎉", "🎯"],
  ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍"],
  ["👏", "🙌", "💪", "✌️", "🤝", "👋", "🫶", "👍"],
  ["📸", "🎬", "🎨", "🎵", "📱", "💡", "🚀", "🌈"],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count hashtags in a plain-text string. */
function countHashtags(text: string): number {
  const matches = text.match(/#[a-zA-Z0-9_\u00C0-\u024F]+/g);
  return matches ? matches.length : 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CaptionEditorProps {
  isDark: boolean;
}

export default function CaptionEditor({ isDark }: CaptionEditorProps) {
  // Zustand store
  const campaignDraft = useInstagramStore((s) => s.campaignDraft);
  const updateDraft = useInstagramStore((s) => s.updateDraft);
  const selectedMedia = useInstagramStore((s) => s.selectedMedia);

  // Auth for API calls
  const auth = useAuth();
  const { knowledgeBaseText, pactText } = useKnowledgeBase('soltheory');
  const getAuthHeaders = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [auth]);

  // Local state
  const [aiLoading, setAiLoading] = useState<"cleanup" | "describe" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [plainText, setPlainText] = useState("");

  // ---------------------------------------------------------------------------
  // Tiptap Editor
  // ---------------------------------------------------------------------------

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Instagram captions are plain text — disable rich formatting blocks
        heading: false,
        codeBlock: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: "Write your caption here… ✍️",
      }),
      CharacterCount.configure({
        limit: MAX_CHARS,
      }),
    ],
    // Prevent SSR hydration mismatch — render editor only on the client
    immediatelyRender: false,
    content: campaignDraft.caption || "",
    editorProps: {
      attributes: {
        class: [
          "outline-none min-h-[180px] max-h-[320px] overflow-y-auto px-4 py-3 text-sm leading-relaxed",
          isDark ? "text-slate-200" : "text-slate-800",
        ].join(" "),
      },
    },
    onUpdate: ({ editor: e }) => {
      // Keep plainText in sync for counters
      setPlainText(e.getText());
      updateDraft({ caption: e.getHTML() });
    },
  });

  // Sync store → editor on external caption changes
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (campaignDraft.caption && campaignDraft.caption !== current) {
      editor.commands.setContent(campaignDraft.caption, { emitUpdate: false });
    }
  }, [campaignDraft.caption, editor]);



  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const charCount = plainText.length;
  const hashtagCount = countHashtags(plainText);
  const isOverCharLimit = charCount > MAX_CHARS;
  const isOverHashtagLimit = hashtagCount > MAX_HASHTAGS;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const insertEmoji = (emoji: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(emoji).run();
  };

  const saveDraft = useCallback(() => {
    if (!editor) return;
    updateDraft({ caption: editor.getHTML() });
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 2000);
  }, [editor, updateDraft]);

  /** AI Cleanup: takes existing caption text and cleans up grammar/tone/formatting. */
  const callAICleanup = useCallback(
    async () => {
      if (!editor) return;
      const currentText = editor.getText().trim();
      if (!currentText) {
        setAiError("Write some text first, then clean it up with AI.");
        return;
      }
      setAiLoading("cleanup");
      setAiError(null);

      try {
        const res = await fetch("/api/campaigning/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rewrite",
            context: {
              selectedText: currentText,
              tone: "professional",
              userPrompt: `Clean up and polish this Instagram caption. Fix grammar, spelling, punctuation, and improve clarity while keeping the author's original voice and intent. Keep it natural and engaging. Preserve any existing hashtags. Return ONLY the cleaned-up caption text, nothing else.\n\nOriginal caption:\n${currentText}`,
            },
            knowledgeBaseText,
            pactText,
          }),
        });
        if (!res.ok) throw new Error(`AI request failed (${res.status})`);
        const data = await res.json();
        if (data.suggestions?.[0]) {
          editor.commands.setContent(
            `<p>${data.suggestions[0].replace(/\n/g, "<br>")}</p>`
          );
          setPlainText(editor.getText());
        }
      } catch (err) {
        console.error("[CaptionEditor] AI Cleanup failed:", err);
        setAiError(err instanceof Error ? err.message : "AI cleanup failed. Please try again.");
      } finally {
        setAiLoading(null);
      }
    },
    [editor]
  );

  /** AI Descriptor: analyzes attached photo + knowledge base to write a full caption. */
  const callAIDescriptor = useCallback(
    async () => {
      if (!editor) return;
      const mediaUrls = selectedMedia.map((m) => m.url);
      if (mediaUrls.length === 0) {
        setAiError("Select at least one image to generate a description.");
        return;
      }
      setAiLoading("describe");
      setAiError(null);

      try {
        const res = await fetch("/api/campaigning/instagram-ai", {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            action: "describe",
            mediaUrls,
            campaignGoal: campaignDraft.campaignGoal || "Build Brand Awareness",
            tone: "Professional",
            additionalContext: editor.getText().trim() || undefined,
            knowledgeBaseText,
            pactText,
          }),
        });
        if (!res.ok) throw new Error(`AI request failed (${res.status})`);
        const data = await res.json();
        if (data.captions?.optionA) {
          const captionWithHashtags = data.hashtags?.length > 0
            ? `${data.captions.optionA}\n\n${data.hashtags.join(" ")}`
            : data.captions.optionA;
          editor.commands.setContent(
            `<p>${captionWithHashtags.replace(/\n/g, "<br>")}</p>`
          );
          setPlainText(editor.getText());
        }
      } catch (err) {
        console.error("[CaptionEditor] AI Descriptor failed:", err);
        setAiError(err instanceof Error ? err.message : "AI description failed. Please try again.");
      } finally {
        setAiLoading(null);
      }
    },
    [editor, selectedMedia, campaignDraft.campaignGoal, getAuthHeaders]
  );

  // ---------------------------------------------------------------------------
  // Style tokens
  // ---------------------------------------------------------------------------

  const border = isDark ? "border-slate-800" : "border-slate-200";
  const headerBorder = isDark ? "border-slate-800" : "border-slate-100";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const textMuted = isDark ? "text-slate-600" : "text-slate-400";
  const surfaceBg = isDark ? "bg-slate-900" : "bg-white";
  const panelBg = isDark ? "bg-slate-800" : "bg-slate-50";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={`rounded-xl border overflow-hidden ${border} ${surfaceBg}`}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${headerBorder}`}>
        <div className="flex items-center gap-2">
          <MessageSquareText className={`w-4 h-4 ${isDark ? "text-pink-400" : "text-pink-500"}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${textSecondary}`}>
            Caption
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Emoji Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
                }`}
                title="Insert Emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className={`w-auto p-2 ${isDark ? "bg-slate-800 border-slate-700 text-slate-200" : ""}`}
            >
              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 px-1 ${textMuted}`}>
                Quick Emoji
              </p>
              <div className="space-y-1">
                {EMOJI_GRID.map((row, ri) => (
                  <div key={ri} className="flex gap-0.5">
                    {row.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className={`w-8 h-8 rounded-md flex items-center justify-center text-lg transition-colors cursor-pointer ${
                          isDark ? "hover:bg-slate-700" : "hover:bg-slate-100"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* AI Cleanup Button */}
          <button
            onClick={callAICleanup}
            disabled={!!aiLoading || charCount === 0}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? "text-violet-400 bg-violet-500/10 hover:bg-violet-500/20"
                : "text-violet-600 bg-violet-50 hover:bg-violet-100"
            }`}
          >
            {aiLoading === "cleanup" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            AI Cleanup
          </button>

          {/* AI Descriptor Button */}
          <button
            onClick={callAIDescriptor}
            disabled={!!aiLoading || selectedMedia.length === 0}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? "text-pink-400 bg-pink-500/10 hover:bg-pink-500/20"
                : "text-pink-600 bg-pink-50 hover:bg-pink-100"
            }`}
            title={selectedMedia.length === 0 ? "Select media first" : "Generate AI description from image"}
          >
            {aiLoading === "describe" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
            AI Descriptor
          </button>
        </div>
      </div>

      {/* ── Main area ────────────────────────────────────────────── */}
      <div className="flex">
        {/* Editor column */}
        <div className="flex-1 flex flex-col">
          {/* Tiptap canvas */}
          <div
            className={`flex-1 ${
              isDark
                ? "[&_.tiptap_p.is-editor-empty:first-child::before]:text-slate-600"
                : "[&_.tiptap_p.is-editor-empty:first-child::before]:text-slate-300"
            }`}
          >
            <EditorContent editor={editor} />
          </div>

          {/* ── AI Error Banner ────────────────────────────────── */}
          <AnimatePresence>
            {aiError && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-t border-red-500/20"
              >
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-xs text-red-500 flex-1">{aiError}</span>
                <button
                  onClick={() => setAiError(null)}
                  className="text-red-500 hover:text-red-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {/* ── Footer: counters + save ──────────────────────────── */}
          <div className={`flex items-center justify-between px-4 py-2.5 border-t ${headerBorder}`}>
            <div className="flex items-center gap-4">
              {/* Character counter */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    isOverCharLimit
                      ? "text-red-500"
                      : charCount > MAX_CHARS * 0.9
                      ? isDark
                        ? "text-amber-400"
                        : "text-amber-500"
                      : textMuted
                  }`}
                >
                  {charCount.toLocaleString()}/{MAX_CHARS.toLocaleString()}
                </span>
                {isOverCharLimit && (
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                )}
              </div>

              {/* Hashtag counter */}
              <div className="flex items-center gap-1.5">
                <Hash className={`w-3 h-3 ${textMuted}`} />
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    isOverHashtagLimit
                      ? "text-red-500"
                      : hashtagCount > MAX_HASHTAGS * 0.8
                      ? isDark
                        ? "text-amber-400"
                        : "text-amber-500"
                      : textMuted
                  }`}
                >
                  {hashtagCount}/{MAX_HASHTAGS}
                </span>
                {isOverHashtagLimit && (
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                )}
              </div>
            </div>

            {/* Save draft */}
            <button
              onClick={saveDraft}
              disabled={isOverCharLimit}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                savedIndicator
                  ? "bg-emerald-500/20 text-emerald-500"
                  : isOverCharLimit
                  ? "opacity-40 cursor-not-allowed text-slate-400"
                  : isDark
                  ? "text-slate-300 hover:bg-slate-800"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {savedIndicator ? (
                <>
                  <Check className="w-3 h-3" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" />
                  Save Draft
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
