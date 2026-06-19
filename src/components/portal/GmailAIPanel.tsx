"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  X,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Archive,
  Trash2,
  Star,
  Mail,
  Clock,
  Undo2,
  Loader2,
  Search,
  Edit3,
  Check,
  AlertTriangle,
  Send,
  GripVertical,
} from "lucide-react";

/* ─── Types ─── */

interface EmailContext {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  read?: boolean;
}

interface ActionPayload {
  type: "archive" | "delete" | "star" | "label" | "mark_read" | "move";
  emailIds: string[];
  label?: string;
  description: string;
}

interface ActionCard {
  payload: ActionPayload;
  status: "pending" | "confirmed" | "cancelled" | "error";
}

interface DraftData {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
}

interface SearchResult {
  id: string;
  from: string;
  subject: string;
  snippet: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actionCard?: ActionCard;
  draft?: DraftData;
  searchResults?: SearchResult[];
}

interface ActionLogEntry {
  id: string;
  description: string;
  timestamp: Date;
  undoable: boolean;
}

interface GmailAIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  uid?: string;
  refreshToken?: string;
  userEmail?: string;
  emailContext: EmailContext[];
  onHighlightEmails: (ids: string[]) => void;
  onActionExecuted: () => void;
  onOpenCompose: (to: string, subject: string, body: string) => void;
  panelWidth: number;
  onWidthChange: (width: number) => void;
}

/* ─── Helpers ─── */

const ACTION_ICONS: Record<string, React.ElementType> = {
  archive: Archive,
  delete: Trash2,
  star: Star,
  label: Mail,
  mark_read: Check,
  move: Archive,
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Render text with **bold** markdown and paragraph spacing */
function renderFormattedContent(text: string): React.ReactNode {
  // Split on double newlines for paragraph spacing
  const paragraphs = text.split(/\n\n+/);

  return paragraphs.map((para, pIdx) => {
    // Split on single newlines within a paragraph
    const lines = para.split(/\n/);

    return (
      <div key={pIdx} className={pIdx > 0 ? "mt-3" : ""}>
        {lines.map((line, lIdx) => {
          // Parse **bold** segments
          const parts = line.split(/(\*\*[^*]+\*\*)/);
          return (
            <span key={lIdx}>
              {lIdx > 0 && <br />}
              {parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return (
                    <strong key={i} className="font-semibold">
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                return <span key={i}>{part}</span>;
              })}
            </span>
          );
        })}
      </div>
    );
  });
}

/* ─── Component ─── */

export function GmailAIPanel({
  isOpen,
  onClose,
  uid,
  refreshToken,
  userEmail,
  emailContext,
  onHighlightEmails,
  onActionExecuted,
  onOpenCompose,
  panelWidth,
  onWidthChange,
}: GmailAIPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [showActionLog, setShowActionLog] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Auto-scroll */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  /* Focus input on open */
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  /* Drag-resize handlers */
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartX.current = e.clientX;
      dragStartWidth.current = panelWidth;
    },
    [panelWidth]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartX.current - e.clientX;
      const newWidth = Math.min(Math.max(dragStartWidth.current + delta, 280), 800);
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    // Prevent text selection while dragging
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging, onWidthChange]);

  /* ─── API Communication ─── */

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/gmail-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            uid,
            refreshToken,
            userEmail,
            emailContext,
          }),
        });

        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }

        const data = await res.json();

        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: data.content || "I processed your request.",
          timestamp: new Date(),
        };

        if (data.actionCard) {
          assistantMessage.actionCard = {
            payload: data.actionCard,
            status: "pending",
          };
        }

        if (data.draft) {
          assistantMessage.draft = data.draft;
        }

        if (data.searchResults && data.searchResults.length > 0) {
          assistantMessage.searchResults = data.searchResults;
        }

        setMessages((prev) => [...prev, assistantMessage]);

        if (data.highlightIds && data.highlightIds.length > 0) {
          onHighlightEmails(data.highlightIds);
        }
      } catch (err: any) {
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: `Something went wrong: ${err.message || "Unable to reach the AI service."}. Please try again.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, uid, refreshToken, userEmail, emailContext, isLoading, onHighlightEmails]
  );

  /* ─── Action Handling ─── */

  const confirmAction = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg?.actionCard || msg.actionCard.status !== "pending") return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, actionCard: { ...m.actionCard!, status: "confirmed" as const } }
            : m
        )
      );

      try {
        const res = await fetch("/api/gmail-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm_action",
            payload: msg.actionCard.payload,
            uid,
            refreshToken,
          }),
        });

        if (!res.ok) throw new Error("Action failed");

        const logEntry: ActionLogEntry = {
          id: generateId(),
          description: msg.actionCard.payload.description,
          timestamp: new Date(),
          undoable: msg.actionCard.payload.type !== "delete",
        };
        setActionLog((prev) => [logEntry, ...prev]);
        onActionExecuted();
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, actionCard: { ...m.actionCard!, status: "error" as const } }
              : m
          )
        );
      }
    },
    [messages, uid, refreshToken, onActionExecuted]
  );

  const cancelAction = useCallback(
    (messageId: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, actionCard: { ...m.actionCard!, status: "cancelled" as const } }
            : m
        )
      );
    },
    []
  );

  /* ─── Draft Handling ─── */

  const updateDraft = useCallback(
    (messageId: string, field: keyof DraftData, value: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.draft
            ? { ...m, draft: { ...m.draft, [field]: value } }
            : m
        )
      );
    },
    []
  );

  const sendDraft = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg?.draft) return;

      setIsLoading(true);
      try {
        const res = await fetch("/api/webhooks/gmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid,
            refreshToken,
            to: msg.draft.to,
            subject: msg.draft.subject,
            body: msg.draft.body,
            threadId: msg.draft.threadId,
            inReplyTo: msg.draft.inReplyTo,
          }),
        });

        if (!res.ok) throw new Error("Failed to send email");

        const confirmMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: `Email sent successfully to ${msg.draft.to}.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, confirmMsg]);

        const logEntry: ActionLogEntry = {
          id: generateId(),
          description: `Sent email to ${msg.draft.to}: "${msg.draft.subject}"`,
          timestamp: new Date(),
          undoable: false,
        };
        setActionLog((prev) => [logEntry, ...prev]);
        onActionExecuted();
      } catch (err: any) {
        const errMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: `Failed to send email: ${err.message}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, uid, refreshToken, onActionExecuted]
  );

  const reviseDraft = useCallback(
    (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg?.draft) return;
      const reviseText = `Please revise this draft. Current draft:\nTo: ${msg.draft.to}\nSubject: ${msg.draft.subject}\nBody: ${msg.draft.body}`;
      sendMessage(reviseText);
    },
    [messages, sendMessage]
  );

  const discardDraft = useCallback(
    (messageId: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, draft: undefined } : m))
      );
    },
    []
  );

  const openDraftInCompose = useCallback(
    (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg?.draft) return;
      onOpenCompose(msg.draft.to, msg.draft.subject, msg.draft.body);
    },
    [messages, onOpenCompose]
  );

  /* ─── Undo ─── */

  const undoAction = useCallback(
    async (logId: string) => {
      const entry = actionLog.find((a) => a.id === logId);
      if (!entry || !entry.undoable) return;

      try {
        await fetch("/api/gmail-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "undo",
            logId,
            uid,
            refreshToken,
          }),
        });
        setActionLog((prev) =>
          prev.map((a) => (a.id === logId ? { ...a, undoable: false } : a))
        );
        onActionExecuted();
      } catch {
        /* silently fail */
      }
    },
    [actionLog, uid, refreshToken, onActionExecuted]
  );

  /* ─── Submit Handler ─── */

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(inputValue);
    },
    [inputValue, sendMessage]
  );

  const handleSuggestion = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  /* ─── Suggested Prompts ─── */

  const suggestions = [
    { label: "Summarize unread emails", icon: Mail },
    { label: "Draft a reply", icon: Edit3 },
    { label: "Find newsletters", icon: Search },
    { label: "Clean up inbox", icon: Archive },
  ];

  /* ─── Render ─── */

  return (
    <div
      className="h-full flex flex-col bg-white border-l border-slate-200 relative shrink-0"
      style={{ width: panelWidth }}
    >
      {/* ─── Drag Handle (left edge) ─── */}
      <div
        onMouseDown={handleDragStart}
        className={`absolute left-0 top-0 bottom-0 w-[6px] z-10 cursor-col-resize group flex items-center justify-center hover:bg-slate-200/60 transition-colors ${
          isDragging ? "bg-slate-300/60" : ""
        }`}
      >
        <div className={`w-[3px] h-8 rounded-full transition-colors ${
          isDragging ? "bg-slate-400" : "bg-slate-300 group-hover:bg-slate-400"
        }`} />
      </div>

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 leading-tight">
              AI Assistant
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Gmail &bull; Natural Language
            </p>
          </div>
        </div>
      </div>

      {/* ─── Chat Thread ─── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
      >
        {/* Empty state with suggestions */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-1">
              How can I help?
            </p>
            <p className="text-xs text-slate-400 mb-6 text-center max-w-[240px]">
              Ask me anything about your inbox. I can search, summarize, draft
              replies, and organize your email.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-[300px]">
              {suggestions.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.label}
                    onClick={() => handleSuggestion(s.label)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-left group"
                  >
                    <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
                    <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800 leading-tight">
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-200`}
          >
            <div
              className={`max-w-[85%] ${
                msg.role === "user" ? "order-1" : "order-0"
              }`}
            >
              {/* Message bubble */}
              <div
                className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white rounded-br-md whitespace-pre-wrap"
                    : "bg-slate-50 border border-slate-200 text-slate-700 rounded-bl-md"
                }`}
              >
                {msg.role === "assistant"
                  ? renderFormattedContent(msg.content)
                  : msg.content}
              </div>

              {/* Timestamp */}
              <p
                className={`text-[10px] text-slate-400 mt-1 px-1 ${
                  msg.role === "user" ? "text-right" : "text-left"
                }`}
              >
                {formatTime(msg.timestamp)}
              </p>

              {/* Action Card */}
              {msg.actionCard && (
                <ActionCardView
                  card={msg.actionCard}
                  onConfirm={() => confirmAction(msg.id)}
                  onCancel={() => cancelAction(msg.id)}
                />
              )}

              {/* Draft Preview */}
              {msg.draft && (
                <DraftPreview
                  draft={msg.draft}
                  messageId={msg.id}
                  isLoading={isLoading}
                  onUpdateField={(field, value) =>
                    updateDraft(msg.id, field, value)
                  }
                  onSend={() => sendDraft(msg.id)}
                  onRevise={() => reviseDraft(msg.id)}
                  onDiscard={() => discardDraft(msg.id)}
                  onOpenCompose={() => openDraftInCompose(msg.id)}
                />
              )}

              {/* Search Results */}
              {msg.searchResults && msg.searchResults.length > 0 && (
                <SearchResultsList
                  results={msg.searchResults}
                  onHighlight={onHighlightEmails}
                />
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start animate-in fade-in duration-200">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Action Log ─── */}
      {actionLog.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setShowActionLog(!showActionLog)}
            className="flex items-center justify-between w-full px-5 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span>Recent Actions ({actionLog.length})</span>
            </div>
            {showActionLog ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronUp className="w-3 h-3" />
            )}
          </button>
          {showActionLog && (
            <div className="max-h-36 overflow-y-auto px-5 pb-2 space-y-1 animate-in fade-in slide-in-from-bottom-1 duration-150">
              {actionLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-600 truncate">
                      {entry.description}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatTime(entry.timestamp)}
                    </p>
                  </div>
                  {entry.undoable && (
                    <button
                      onClick={() => undoAction(entry.id)}
                      className="ml-2 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                    >
                      <Undo2 className="w-3 h-3" />
                      Undo
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Input Area ─── */}
      <div className="border-t border-slate-100 px-4 py-3">
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask your AI assistant..."
            disabled={isLoading}
            className="w-full pl-4 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 disabled:opacity-60 transition-all"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center disabled:opacity-30 hover:bg-slate-800 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowUp className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
        <p className="text-[10px] text-slate-400 mt-1.5 text-center">
          Press Enter to send &bull;{" "}
          {emailContext.length > 0
            ? `${emailContext.length} emails in context`
            : "No emails loaded"}
        </p>
      </div>
    </div>
  );
}

/* ─── Sub-Components ─── */

function ActionCardView({
  card,
  onConfirm,
  onCancel,
}: {
  card: ActionCard;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const Icon = ACTION_ICONS[card.payload.type] || Mail;
  const isPending = card.status === "pending";

  return (
    <div className="mt-2 border border-slate-200 rounded-xl bg-white p-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-700 capitalize">
            {card.payload.type.replace("_", " ")}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
            {card.payload.description}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {card.payload.emailIds.length} email
            {card.payload.emailIds.length !== 1 ? "s" : ""} affected
          </p>
        </div>
      </div>

      {isPending && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Check className="w-3 h-3" />
            Confirm
          </button>
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {card.status === "confirmed" && (
        <div className="flex items-center gap-1.5 mt-3 text-emerald-600">
          <Check className="w-3 h-3" />
          <span className="text-[11px] font-medium">Action completed</span>
        </div>
      )}

      {card.status === "cancelled" && (
        <div className="flex items-center gap-1.5 mt-3 text-slate-400">
          <X className="w-3 h-3" />
          <span className="text-[11px] font-medium">Action cancelled</span>
        </div>
      )}

      {card.status === "error" && (
        <div className="flex items-center gap-1.5 mt-3 text-red-500">
          <AlertTriangle className="w-3 h-3" />
          <span className="text-[11px] font-medium">
            Action failed — please try again
          </span>
        </div>
      )}
    </div>
  );
}

function DraftPreview({
  draft,
  messageId,
  isLoading,
  onUpdateField,
  onSend,
  onRevise,
  onDiscard,
  onOpenCompose,
}: {
  draft: DraftData;
  messageId: string;
  isLoading: boolean;
  onUpdateField: (field: keyof DraftData, value: string) => void;
  onSend: () => void;
  onRevise: () => void;
  onDiscard: () => void;
  onOpenCompose: () => void;
}) {
  return (
    <div className="mt-2 border border-slate-200 rounded-xl bg-white p-3 space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="flex items-center gap-1.5 mb-1">
        <Edit3 className="w-3 h-3 text-slate-400" />
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Draft
        </span>
      </div>

      <div>
        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          To
        </label>
        <input
          type="text"
          value={draft.to}
          onChange={(e) => onUpdateField("to", e.target.value)}
          className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
        />
      </div>
      <div>
        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          Subject
        </label>
        <input
          type="text"
          value={draft.subject}
          onChange={(e) => onUpdateField("subject", e.target.value)}
          className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
        />
      </div>
      <div>
        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          Body
        </label>
        <textarea
          value={draft.body}
          onChange={(e) => onUpdateField("body", e.target.value)}
          rows={5}
          className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 resize-y focus:outline-none focus:ring-1 focus:ring-slate-300 leading-relaxed"
        />
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <button
          onClick={onSend}
          disabled={isLoading || !draft.to.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
        >
          <Send className="w-3 h-3" />
          Send
        </button>
        <button
          onClick={onOpenCompose}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Mail className="w-3 h-3" />
          Open in Compose
        </button>
        <button
          onClick={onRevise}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
          Revise
        </button>
        <button
          onClick={onDiscard}
          className="ml-auto text-[11px] text-slate-400 hover:text-red-500 transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

function SearchResultsList({
  results,
  onHighlight,
}: {
  results: SearchResult[];
  onHighlight: (ids: string[]) => void;
}) {
  return (
    <div className="mt-2 border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50">
        <Search className="w-3 h-3 text-slate-400" />
        <span className="text-[11px] font-semibold text-slate-500">
          {results.length} result{results.length !== 1 ? "s" : ""} found
        </span>
      </div>
      {results.map((r) => (
        <button
          key={r.id}
          onClick={() => onHighlight([r.id])}
          className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors"
        >
          <p className="text-xs font-medium text-slate-700 truncate">
            {r.subject}
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            {r.from} &mdash; {r.snippet}
          </p>
        </button>
      ))}
    </div>
  );
}
