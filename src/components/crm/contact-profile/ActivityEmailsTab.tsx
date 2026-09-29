"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Loader2, ArrowUpDown, ChevronDown, ChevronUp, Paperclip, ExternalLink, Send, Inbox } from 'lucide-react';
import { format, isToday, isThisYear } from 'date-fns';
import { getAuthHeaders } from '@/lib/api-auth-client';
import { getGmailConnectUrl } from '@/lib/gmail-api';
import { useUser } from '@/firebase';
import { useOrgId } from '@/contexts/OrgContext';

// ── Types ────────────────────────────────────────────────────────────────────

interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
}

interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  from: string;
  to: string;
  cc?: string;
  date: string;
  body: string;
  labelIds: string[];
  attachments?: EmailAttachment[];
}

interface EmailsApiResponse {
  connected: boolean;
  emails: EmailMessage[];
  error?: string;
}

interface ActivityEmailsTabProps {
  contactEmail: string;
  isDarkMode: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format a date string for the email list: time if today, "MMM d" if this year, else "MMM d, yyyy". */
function formatEmailDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'h:mm a');
    if (isThisYear(date)) return format(date, 'MMM d');
    return format(date, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

/** Format full date for the expanded view. */
function formatFullDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'MMM d, yyyy \'at\' h:mm a');
  } catch {
    return dateStr;
  }
}

/** Human-readable file size. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Determine whether the email was sent by the user (vs. received). */
function isSentEmail(email: EmailMessage): boolean {
  return email.labelIds?.includes('SENT') ?? false;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ActivityEmailsTab({
  contactEmail,
  isDarkMode,
}: ActivityEmailsTabProps) {
  const { user } = useUser();
  const orgId = useOrgId();
  const uid = user?.uid || '';

  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch emails ─────────────────────────────────────────────────────────

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/crm/contact-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          contactEmail,
          sort: sortOrder,
          maxResults: 30,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch emails (${res.status})`);
      }

      const data: EmailsApiResponse = await res.json();

      setConnected(data.connected);
      setEmails(data.emails ?? []);

      if (data.error) setError(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [contactEmail, sortOrder]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // ── Toggle helpers ───────────────────────────────────────────────────────

  const toggleSort = () =>
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));

  const toggleExpanded = (id: string) =>
    setExpandedEmailId((prev) => (prev === id ? null : id));

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2
          className={`h-6 w-6 animate-spin ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        />
        <p
          className={`text-sm ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          Loading emails...
        </p>
      </div>
    );
  }

  // ── Gmail not connected ──────────────────────────────────────────────────

  if (!connected) {
    const connectUrl = getGmailConnectUrl(uid, orgId);

    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div
          className={`rounded-full p-3 ${
            isDarkMode ? 'bg-slate-800/60' : 'bg-slate-100'
          }`}
        >
          <Mail
            className={`h-6 w-6 ${
              isDarkMode ? 'text-slate-500' : 'text-slate-400'
            }`}
          />
        </div>
        <div className="text-center space-y-1">
          <p
            className={`text-sm font-medium ${
              isDarkMode ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            Gmail not connected
          </p>
          <p
            className={`text-xs ${
              isDarkMode ? 'text-slate-500' : 'text-slate-500'
            }`}
          >
            Connect your Gmail account to view email history with this contact.
          </p>
        </div>
        <a
          href={connectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`
            inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors
            ${
              isDarkMode
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }
          `}
        >
          Connect Gmail
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p
          className={`text-sm ${
            isDarkMode ? 'text-red-400' : 'text-red-600'
          }`}
        >
          {error}
        </p>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div
          className={`rounded-full p-3 ${
            isDarkMode ? 'bg-slate-800/60' : 'bg-slate-100'
          }`}
        >
          <Mail
            className={`h-6 w-6 ${
              isDarkMode ? 'text-slate-500' : 'text-slate-400'
            }`}
          />
        </div>
        <div className="text-center space-y-1">
          <p
            className={`text-sm font-medium ${
              isDarkMode ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            No emails found
          </p>
          <p
            className={`text-xs ${
              isDarkMode ? 'text-slate-500' : 'text-slate-500'
            }`}
          >
            No email conversations found with {contactEmail}
          </p>
        </div>
      </div>
    );
  }

  // ── Email list ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* Sort toggle */}
      <div className="flex items-center justify-end mb-1">
        <button
          onClick={toggleSort}
          className={`
            inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors
            ${
              isDarkMode
                ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/60'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }
          `}
        >
          <ArrowUpDown className="h-3 w-3" />
          {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
        </button>
      </div>

      {/* Email items */}
      {emails.map((email) => {
        const sent = isSentEmail(email);
        const isExpanded = expandedEmailId === email.id;

        // Card color — sent emails get a blue tint
        const cardClasses = sent
          ? isDarkMode
            ? 'bg-blue-950/20 border-blue-800/50'
            : 'bg-blue-50/30 border-blue-200'
          : isDarkMode
            ? 'bg-slate-800/50 border-slate-700/60'
            : 'bg-white border-slate-100';

        return (
          <div
            key={email.id}
            className={`rounded-xl border p-3.5 transition-shadow hover:shadow-sm ${cardClasses}`}
          >
            {/* ── Collapsed row ────────────────────────────────────── */}
            <button
              type="button"
              onClick={() => toggleExpanded(email.id)}
              className="w-full text-left flex items-start gap-3"
            >
              {/* Icon */}
              <div className="pt-0.5 shrink-0">
                {sent ? (
                  <Send
                    className={`h-4 w-4 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-500'
                    }`}
                  />
                ) : (
                  <Inbox
                    className={`h-4 w-4 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* Direction badge */}
                  <span
                    className={`
                      shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none
                      ${
                        sent
                          ? isDarkMode
                            ? 'bg-blue-900/40 text-blue-300'
                            : 'bg-blue-100 text-blue-700'
                          : isDarkMode
                            ? 'bg-slate-700/60 text-slate-300'
                            : 'bg-slate-100 text-slate-600'
                      }
                    `}
                  >
                    {sent ? 'Sent' : 'Received'}
                  </span>

                  {/* Subject */}
                  <span
                    className={`text-sm font-semibold truncate ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    {email.subject || '(no subject)'}
                  </span>
                </div>

                {/* Snippet */}
                <p
                  className={`text-xs truncate mt-0.5 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {email.snippet}
                </p>
              </div>

              {/* Date + expand chevron */}
              <div className="shrink-0 flex items-center gap-1.5">
                <span
                  className={`text-[10px] whitespace-nowrap ${
                    isDarkMode ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  {formatEmailDate(email.date)}
                </span>
                {isExpanded ? (
                  <ChevronUp
                    className={`h-3.5 w-3.5 ${
                      isDarkMode ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  />
                ) : (
                  <ChevronDown
                    className={`h-3.5 w-3.5 ${
                      isDarkMode ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  />
                )}
              </div>
            </button>

            {/* ── Expanded details ─────────────────────────────────── */}
            {isExpanded && (
              <div className="mt-3 space-y-3">
                {/* Headers */}
                <div
                  className={`space-y-1 text-xs ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <p>
                    <span className="font-medium">From:</span> {email.from}
                  </p>
                  <p>
                    <span className="font-medium">To:</span> {email.to}
                  </p>
                  {email.cc && (
                    <p>
                      <span className="font-medium">Cc:</span> {email.cc}
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Date:</span>{' '}
                    {formatFullDate(email.date)}
                  </p>
                </div>

                {/* Body */}
                <div
                  className={`
                    max-h-[400px] overflow-y-auto rounded-lg p-3 text-sm leading-relaxed
                    ${
                      isDarkMode
                        ? 'bg-slate-900/60 text-slate-300'
                        : 'bg-slate-50 text-slate-700'
                    }
                  `}
                  dangerouslySetInnerHTML={{ __html: email.body }}
                />

                {/* Attachments */}
                {email.attachments && email.attachments.length > 0 && (
                  <div className="space-y-1.5">
                    <p
                      className={`text-[10px] font-medium uppercase tracking-wide ${
                        isDarkMode ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      Attachments
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {email.attachments.map((att, idx) => (
                        <div
                          key={`${email.id}-att-${idx}`}
                          className={`
                            inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs
                            ${
                              isDarkMode
                                ? 'bg-slate-700/50 text-slate-300'
                                : 'bg-slate-100 text-slate-600'
                            }
                          `}
                        >
                          <Paperclip className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[180px]">
                            {att.filename}
                          </span>
                          <span
                            className={`${
                              isDarkMode ? 'text-slate-500' : 'text-slate-400'
                            }`}
                          >
                            ({formatFileSize(att.size)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Collapse button */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(email.id)}
                  className={`
                    inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors
                    ${
                      isDarkMode
                        ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }
                  `}
                >
                  <ChevronUp className="h-3 w-3" />
                  Collapse
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
