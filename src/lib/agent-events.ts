/**
 * AgentEvent — Streaming event protocol for Agentic Thinking UI (Phase 3)
 * 
 * These events are streamed via SSE alongside text tokens to show users
 * Jarvis's thought process: routing decisions, orchestrator plans, tool calls,
 * and step-by-step progress.
 */

// ── Event Types ──────────────────────────────────────────────────

export type AgentEvent =
  | RoutingEvent
  | PlanEvent
  | StepStartEvent
  | StepCompleteEvent
  | ToolCallEvent
  | ThinkingEvent;

/** Emitted when the router classifies the user's intent into a domain */
export interface RoutingEvent {
  type: 'routing';
  domain: string;
  timestamp: number;
}

/** Emitted when the orchestrator creates a multi-step plan */
export interface PlanEvent {
  type: 'plan';
  summary: string;
  steps: { step: number; domain: string; task: string }[];
  timestamp: number;
}

/** Emitted when an orchestrator step begins execution */
export interface StepStartEvent {
  type: 'step_start';
  step: number;
  domain: string;
  task: string;
  timestamp: number;
}

/** Emitted when an orchestrator step finishes */
export interface StepCompleteEvent {
  type: 'step_complete';
  step: number;
  result: string;
  success: boolean;
  toolsUsed: string[];
  durationMs: number;
  timestamp: number;
}

/** Emitted when a tool is called (single-agent or orchestrator) */
export interface ToolCallEvent {
  type: 'tool_call';
  step?: number;
  tool: string;
  timestamp: number;
}

/** Emitted for intermediate thinking/reasoning text */
export interface ThinkingEvent {
  type: 'thinking';
  content: string;
  timestamp: number;
}

// ── Callback type for emitting events ────────────────────────────

export type AgentEventEmitter = (event: AgentEvent) => void | Promise<void>;
