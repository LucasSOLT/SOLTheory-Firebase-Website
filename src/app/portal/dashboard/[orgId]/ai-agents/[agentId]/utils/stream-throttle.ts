/**
 * Stream Throttle Utility
 * 
 * Batches SSE token updates into ~30fps frame-aligned React state updates.
 * Without throttling, each SSE token fires setMessages() — potentially 100+
 * times per second — causing React to re-render the entire message list on
 * every token.  This throttle accumulates changes in a plain object and
 * flushes them to React state at most once per animation frame (~33ms).
 *
 * Usage:
 *   const throttle = createStreamThrottle(setMessages, botMsgId);
 *   // In the SSE loop:
 *   throttle.appendText(token);
 *   throttle.addEvent(agentEvent);
 *   throttle.setCitations(citations);
 *   // After the loop ends:
 *   throttle.flush();     // synchronously flush any pending updates
 *   throttle.dispose();   // cancel any scheduled rAF
 */

import type { AgentEvent } from '@/lib/agent-events';

type Message = {
  id: string;
  text: string;
  isSelf: boolean;
  agentEvents?: AgentEvent[];
  citations?: { text: string; source: string; type: string }[];
  [key: string]: any;
};

type SetMessages = (updater: (prev: Message[]) => Message[]) => void;

interface StreamThrottle {
  /** Append a text token to the bot message */
  appendText: (token: string) => void;
  /** Add an agent event (routing, plan, tool_call, etc.) */
  addEvent: (event: AgentEvent) => void;
  /** Append a thinking chunk to the existing thinking event */
  appendThinking: (token: string) => void;
  /** Set citations on the bot message */
  setCitations: (citations: { text: string; source: string; type: string }[]) => void;
  /** Mark an error occurred */
  appendError: (errorText: string) => void;
  /** Synchronously flush all pending updates to React state */
  flush: () => void;
  /** Cancel any scheduled animation frame */
  dispose: () => void;
  /** Get current accumulated full text (for data.response assignment) */
  getFullText: () => string;
}

export function createStreamThrottle(
  setMessages: SetMessages,
  botMsgId: string,
): StreamThrottle {
  // Accumulated state between flushes
  let pendingText = '';           // Full accumulated text so far
  let pendingEvents: AgentEvent[] = [];
  let pendingThinkingChunks = ''; // Thinking tokens accumulated since last flush
  let pendingCitations: { text: string; source: string; type: string }[] | null = null;
  let dirty = false;              // Whether there are unflushed changes
  let rafId: number | null = null;

  function scheduleFlush() {
    if (rafId !== null) return; // Already scheduled
    rafId = requestAnimationFrame(() => {
      rafId = null;
      doFlush();
    });
  }

  /** Internal flush — applies all accumulated changes to React state in one setMessages call */
  function doFlush() {
    if (!dirty) return;
    dirty = false;

    // Capture current pending state for the closure
    const text = pendingText;
    const events = pendingEvents.length > 0 ? [...pendingEvents] : null;
    const thinkingChunk = pendingThinkingChunks;
    const citations = pendingCitations;

    // Reset accumulators (text is NOT reset — it's cumulative)
    pendingEvents = [];
    pendingThinkingChunks = '';
    pendingCitations = null;

    setMessages(prev => prev.map(m => {
      if (m.id !== botMsgId) return m;

      const updated: Message = { ...m };

      // Apply text update
      if (text) {
        updated.text = text;
      }

      // Apply agent events
      if (events) {
        updated.agentEvents = [...(updated.agentEvents || []), ...events];
      }

      // Apply thinking chunk
      if (thinkingChunk) {
        const agentEvents = [...(updated.agentEvents || [])];
        const thinkIdx = agentEvents.findIndex(e => e.type === 'thinking');
        if (thinkIdx >= 0) {
          const existing = agentEvents[thinkIdx] as { type: 'thinking'; content: string; timestamp: number };
          agentEvents[thinkIdx] = {
            type: 'thinking' as const,
            content: (existing.content || '') + thinkingChunk,
            timestamp: existing.timestamp,
          };
        } else {
          agentEvents.push({
            type: 'thinking' as const,
            content: thinkingChunk,
            timestamp: Date.now(),
          });
        }
        updated.agentEvents = agentEvents;
      }

      // Apply citations
      if (citations) {
        updated.citations = citations;
      }

      return updated;
    }));
  }

  return {
    appendText(token: string) {
      pendingText += token;
      dirty = true;
      scheduleFlush();
    },

    addEvent(event: AgentEvent) {
      pendingEvents.push(event);
      dirty = true;
      scheduleFlush();
    },

    appendThinking(token: string) {
      pendingThinkingChunks += token;
      dirty = true;
      scheduleFlush();
    },

    setCitations(citations) {
      pendingCitations = citations;
      dirty = true;
      scheduleFlush();
    },

    appendError(errorText: string) {
      pendingText += errorText;
      dirty = true;
      scheduleFlush();
    },

    flush() {
      // Cancel any pending rAF first, then flush synchronously
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      doFlush();
    },

    dispose() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },

    getFullText() {
      return pendingText;
    },
  };
}
