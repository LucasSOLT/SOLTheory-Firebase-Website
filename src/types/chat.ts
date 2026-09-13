/**
 * chat.ts — Shared Chat Type Definitions
 *
 * Used by the chat store, API routes, and the chat page UI.
 */

export type ChatScope = 'user' | 'org';

export type EmailPreviewData = {
  to: string;
  subject: string;
  body: string;
  intent: 'send' | 'draft' | 'ambiguous';
};

export type AgentEventType = import('@/lib/agent-events').AgentEvent;

export type Message = {
  id: string;
  text: string;
  isSelf: boolean;
  hiddenContext?: string;
  imageUrl?: string;
  citations?: { text: string; source: string; type: string }[];
  agentEvents?: AgentEventType[];
  sendTimestamp?: number;
  isPendingImage?: boolean;
  emailPreview?: EmailPreviewData;
};

export type Session = {
  id: string;
  title: string;
  updatedAt: number;
  scope?: ChatScope;
  messages: Message[];
  messageCount?: number;
  lastPreview?: string;
};

/** Shape returned by the sessions API */
export type SessionListItem = {
  id: string;
  title: string;
  updatedAt: number;
  scope: ChatScope;
  messageCount: number;
  lastPreview: string;
};
