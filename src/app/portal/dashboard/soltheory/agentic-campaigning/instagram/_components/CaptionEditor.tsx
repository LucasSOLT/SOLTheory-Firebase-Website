"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smile,
  Sparkles,
  Hash,
  Wand2,
  Loader2,
  Check,
  ChevronRight,
  AlertTriangle,
  Save,
  RotateCcw,
  Megaphone,
  Lightbulb,
  MessageSquareText,
  Zap,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useInstagramStore } from "@/stores/instagramStore";
import { useAuth } from "@/firebase";

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

/** Tone presets for AI enhancement. */
const TONE_OPTIONS = [
  { id: "professional", label: "Professional", icon: <Megaphone className="w-3.5 h-3.5" />, desc: "Polished & brand-safe" },
  { id: "enthusiastic", label: "Enthusiastic", icon: <Zap className="w-3.5 h-3.5" />, desc: "Energetic & exciting" },
  { id: "concise", label: "Concise", icon: <MessageSquareText className="w-3.5 h-3.5" />, desc: "Short & punchy" },
  { id: "storytelling", label: "Storytelling", icon: <Lightbulb className="w-3.5 h-3.5" />, desc: "Narrative & engaging" },
] as const;

type ToneId = (typeof TONE_OPTIONS)[number]["id"];

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
  const getAuthHeaders = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [auth]);

  // Local state
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [selectedTone, setSelectedTone] = useState<ToneId>("professional");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState<string | null>(null);
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

  // Update tone in zustand when it changes
  useEffect(() => {
    updateDraft({ tone: selectedTone });
  }, [selectedTone, updateDraft]);

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

  /** Call our Instagram AI endpoint (Gemini multimodal). */
  const callAI = useCallback(
    async (action: "enhance" | "hashtags") => {
      if (!editor) return;
      setAiLoading(true);
      setAiAction(action);

      const currentText = editor.getText();
      const mediaUrls = selectedMedia.map((m) => m.url);

      try {
        if (action === "enhance" && mediaUrls.length > 0) {
          // Use new Gemini multimodal endpoint for visual-aware captions
          const res = await fetch("/api/campaigning/instagram-ai", {
            method: "POST",
            headers: await getAuthHeaders(),
            body: JSON.stringify({
              mediaUrls,
              campaignGoal: campaignDraft.campaignGoal || "Build Brand Awareness",
              tone: selectedTone.charAt(0).toUpperCase() + selectedTone.slice(1),
              additionalContext: currentText || undefined,
            }),
          });
          if (!res.ok) throw new Error(`AI request failed (${res.status})`);
          const data = await res.json();
          if (data.captions?.optionA) {
            // Insert caption Option A (user can switch to B via AI sidebar later)
            editor.commands.setContent(
              `<p>${data.captions.optionA.replace(/\n/g, "<br>")}</p>`
            );
            setPlainText(editor.getText());
          }
        } else if (action === "enhance") {
          // Fallback: no media selected, use Groq text rewrite
          const toneMap: Record<string, string> = {
            professional: "formal",
            enthusiastic: "friendly",
            concise: "concise",
            storytelling: "detailed",
          };
          const res = await fetch("/api/campaigning/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "rewrite",
              context: {
                selectedText: currentText,
                tone: toneMap[selectedTone] || "formal",
                userPrompt: `Rewrite this Instagram caption in a ${selectedTone} tone. Keep it under 2200 characters. Preserve any existing hashtags. Return ONLY the rewritten caption.`,
              },
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
        } else if (action === "hashtags") {
          if (mediaUrls.length > 0) {
            // Use Gemini multimodal for visual-aware hashtags
            const res = await fetch("/api/campaigning/instagram-ai", {
              method: "POST",
              headers: await getAuthHeaders(),
              body: JSON.stringify({
                mediaUrls,
                campaignGoal: campaignDraft.campaignGoal || "Build Brand Awareness",
                tone: selectedTone.charAt(0).toUpperCase() + selectedTone.slice(1),
                additionalContext: currentText
                  ? `Current caption: ${currentText}\n\nGenerate hashtags that complement this caption.`
                  : undefined,
              }),
            });
            if (!res.ok) throw new Error(`AI request failed (${res.status})`);
            const data = await res.json();
            if (data.hashtags?.length > 0) {
              const hashtagStr = data.hashtags.join(" ");
              editor.commands.insertContent(`<p><br>${hashtagStr}</p>`);
              setPlainText(editor.getText());
            }
          } else {
            // Fallback: text-only hashtag generation via Groq
            const res = await fetch("/api/campaigning/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "draft_body",
                context: {
                  userPrompt: `Based on this Instagram caption, suggest 10-15 relevant, high-engagement hashtags. Mix popular and niche hashtags. Return ONLY the hashtags separated by spaces, nothing else.\n\nCaption:\n${currentText}`,
                },
              }),
            });
            if (!res.ok) throw new Error(`AI request failed (${res.status})`);
            const data = await res.json();
            if (data.suggestions?.[0]) {
              const hashtags = data.suggestions[0].trim();
              editor.commands.insertContent(`<p><br>${hashtags}</p>`);
              setPlainText(editor.getText());
            }
          }
        }
      } catch (err) {
        console.error("[CaptionEditor] AI call failed:", err);
        setAiError(err instanceof Error ? err.message : "AI generation failed. Please try again.");
      } finally {
        setAiLoading(false);
        setAiAction(null);
      }
    },
    [editor, selectedTone, selectedMedia, campaignDraft.campaignGoal, getAuthHeaders]
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

          {/* AI Panel Toggle */}
          <button
            onClick={() => setAiPanelOpen(!aiPanelOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              aiPanelOpen
                ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm"
                : isDark
                ? "text-pink-400 bg-pink-500/10 hover:bg-pink-500/20"
                : "text-pink-600 bg-pink-50 hover:bg-pink-100"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Assist
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

        {/* ── AI Sidebar ─────────────────────────────────────────── */}
        <AnimatePresence>
          {aiPanelOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className={`shrink-0 border-l overflow-hidden flex flex-col ${headerBorder} ${panelBg}`}
            >
              <div className="w-[240px] flex flex-col h-full">
                {/* Panel header */}
                <div className={`flex items-center justify-between px-3.5 py-3 border-b ${headerBorder}`}>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className={`w-3.5 h-3.5 ${isDark ? "text-pink-400" : "text-pink-500"}`} />
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${textSecondary}`}>
                      AI Helper
                    </span>
                  </div>
                  <button
                    onClick={() => setAiPanelOpen(false)}
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      isDark ? "hover:bg-slate-700 text-slate-500" : "hover:bg-slate-200 text-slate-400"
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                  {/* Tone selector */}
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textMuted}`}>
                      Caption Tone
                    </p>
                    <div className="space-y-1">
                      {TONE_OPTIONS.map((tone) => (
                        <button
                          key={tone.id}
                          onClick={() => setSelectedTone(tone.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all cursor-pointer ${
                            selectedTone === tone.id
                              ? isDark
                                ? "bg-pink-500/15 text-pink-400 border border-pink-500/30"
                                : "bg-pink-50 text-pink-700 border border-pink-200"
                              : isDark
                              ? "text-slate-400 hover:bg-slate-700/50 border border-transparent"
                              : "text-slate-500 hover:bg-white border border-transparent"
                          }`}
                        >
                          <span className={selectedTone === tone.id ? "" : "opacity-50"}>
                            {tone.icon}
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold">{tone.label}</p>
                            <p className={`text-[9px] ${selectedTone === tone.id ? "opacity-70" : "opacity-40"}`}>
                              {tone.desc}
                            </p>
                          </div>
                          {selectedTone === tone.id && (
                            <Check className="w-3 h-3 ml-auto shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI action buttons */}
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textMuted}`}>
                      Actions
                    </p>
                    <div className="space-y-1.5">
                      <button
                        onClick={() => callAI("enhance")}
                        disabled={aiLoading || charCount === 0}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          isDark
                            ? "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                            : "bg-white text-slate-700 hover:bg-slate-50 shadow-sm border border-slate-200"
                        }`}
                      >
                        {aiLoading && aiAction === "enhance" ? (
                          <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
                        ) : (
                          <Wand2 className={`w-4 h-4 ${isDark ? "text-purple-400" : "text-purple-500"}`} />
                        )}
                        <div className="flex-1">
                          <p className="text-[11px] font-semibold">Enhance with AI</p>
                          <p className={`text-[9px] ${textMuted}`}>
                            Rewrite in selected tone
                          </p>
                        </div>
                        <ChevronRight className={`w-3 h-3 ${textMuted}`} />
                      </button>

                      <button
                        onClick={() => callAI("hashtags")}
                        disabled={aiLoading || charCount === 0}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          isDark
                            ? "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                            : "bg-white text-slate-700 hover:bg-slate-50 shadow-sm border border-slate-200"
                        }`}
                      >
                        {aiLoading && aiAction === "hashtags" ? (
                          <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
                        ) : (
                          <Hash className={`w-4 h-4 ${isDark ? "text-emerald-400" : "text-emerald-500"}`} />
                        )}
                        <div className="flex-1">
                          <p className="text-[11px] font-semibold">Suggest Hashtags</p>
                          <p className={`text-[9px] ${textMuted}`}>
                            Auto-generate relevant tags
                          </p>
                        </div>
                        <ChevronRight className={`w-3 h-3 ${textMuted}`} />
                      </button>
                    </div>
                  </div>

                  {/* Usage hint */}
                  <div
                    className={`rounded-lg p-3 text-[10px] leading-relaxed ${
                      isDark
                        ? "bg-slate-700/30 text-slate-500"
                        : "bg-slate-100/80 text-slate-400"
                    }`}
                  >
                    <p className="font-semibold mb-1">💡 Tips</p>
                    <ul className="space-y-0.5 list-disc list-inside">
                      <li>Write your draft first, then enhance</li>
                      <li>Mix popular + niche hashtags</li>
                      <li>Keep captions under 125 chars for full preview in feed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
