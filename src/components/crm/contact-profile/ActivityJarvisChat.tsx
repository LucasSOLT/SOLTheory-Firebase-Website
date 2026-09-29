"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader2, X, Sparkles } from 'lucide-react';
import { getAuthHeaders } from '@/lib/api-auth-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ActivityJarvisChatProps {
  emailContent: string;
  emailSubject: string;
  contactId: string;
  orgId: string;
  isDarkMode: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ActivityJarvisChat({
  emailContent,
  emailSubject,
  contactId,
  orgId,
  isDarkMode,
}: ActivityJarvisChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsStreaming(true);

    // Placeholder for assistant message
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/crm/activity-chat', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage,
          emailContent,
          emailSubject,
          contactId,
          orgId,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch response');
      }

      if (!res.body) {
        throw new Error('No readable stream');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantContent = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'token') {
                  assistantContent += data.content;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      role: 'assistant',
                      content: assistantContent,
                    };
                    return newMessages;
                  });
                } else if (data.type === 'done') {
                  done = true;
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
        if (readerDone) {
          done = true;
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: 'assistant',
          content: 'Sorry, I encountered an error while processing your request.',
        };
        return newMessages;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          isDarkMode
            ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Ask JARVIS about this email
      </button>
    );
  }

  return (
    <div
      className={`mt-4 rounded-lg border overflow-hidden flex flex-col ${
        isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
      }`}
    >
      <div
        className={`flex items-center justify-between px-3 py-2 border-b ${
          isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles
            className={`w-4 h-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}
          />
          <span
            className={`text-xs font-semibold ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            JARVIS
          </span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className={`p-1 rounded-md transition-colors ${
            isDarkMode
              ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200'
              : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 max-h-[200px] overflow-y-auto flex flex-col gap-3">
        {messages.length === 0 ? (
          <div
            className={`text-center py-4 text-xs ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Ask me anything about this email...
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : isDarkMode
                    ? 'bg-slate-700 text-slate-200 rounded-bl-none'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <div className="prose prose-sm prose-p:my-1 prose-ul:my-1 prose-ol:my-1 max-w-none break-words">
                    {msg.content === '' && isStreaming && idx === messages.length - 1 ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin my-1" />
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        className={`p-2 border-t ${
          isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
        }`}
      >
        <form
          onSubmit={handleSubmit}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md border ${
            isDarkMode
              ? 'bg-slate-900 border-slate-600 focus-within:border-indigo-500'
              : 'bg-slate-50 border-slate-300 focus-within:border-indigo-500'
          }`}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this email..."
            disabled={isStreaming}
            className={`flex-1 bg-transparent border-none outline-none text-xs ${
              isDarkMode
                ? 'text-slate-200 placeholder:text-slate-500'
                : 'text-slate-800 placeholder:text-slate-400'
            }`}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className={`p-1 rounded-md transition-colors ${
              !input.trim() || isStreaming
                ? isDarkMode
                  ? 'text-slate-600'
                  : 'text-slate-400'
                : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'
            }`}
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
