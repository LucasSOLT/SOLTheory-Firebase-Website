/**
 * llm-router.ts — Unified LLM Routing Layer
 * 
 * Routes requests to the optimal provider (Groq or OpenRouter) based on model ID.
 * OpenRouter provides access to Claude, GPT-4o, Gemini, and other frontier models.
 * 
 * Architecture:
 * - Groq models (llama-*, qwen/*) → Groq SDK (fastest, cheapest)
 * - Premium models (claude-*, gpt-4o) → OpenRouter API (smartest)
 * - "auto" mode → Smart routing based on query complexity
 */

import { Groq } from "groq-sdk";

// ── Model Registry ──
// Maps user-facing model IDs to provider-specific configs
export interface ModelConfig {
  provider: "groq" | "openrouter";
  modelId: string;           // The actual model ID to send to the provider
  displayName: string;
  description: string;
  tier: "fast" | "smart" | "premium";
  inputCostPer1M: number;   // USD per 1M input tokens
  outputCostPer1M: number;  // USD per 1M output tokens
  maxTokens: number;
  supportsTools: boolean;
}

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // ── Groq Models (Fast + Cheap) ──
  "llama-3.1-8b-instant": {
    provider: "groq",
    modelId: "llama-3.1-8b-instant",
    displayName: "Llama 3.1 8B",
    description: "Fastest responses",
    tier: "fast",
    inputCostPer1M: 0.05,
    outputCostPer1M: 0.08,
    maxTokens: 4096,
    supportsTools: true,
  },
  "llama-3.3-70b-versatile": {
    provider: "groq",
    modelId: "llama-3.3-70b-versatile",
    displayName: "Llama 3.3 70B",
    description: "Best all-around model",
    tier: "smart",
    inputCostPer1M: 0.59,
    outputCostPer1M: 0.79,
    maxTokens: 4096,
    supportsTools: true,
  },
  "openai/gpt-oss-120b": {
    provider: "groq",
    modelId: "openai/gpt-oss-120b",
    displayName: "GPT 120B",
    description: "Most powerful open model",
    tier: "premium",
    inputCostPer1M: 0.90,
    outputCostPer1M: 0.90,
    maxTokens: 4096,
    supportsTools: true,
  },
  "openai/gpt-oss-20b": {
    provider: "groq",
    modelId: "openai/gpt-oss-20b",
    displayName: "GPT 20B",
    description: "Lightweight & fast",
    tier: "fast",
    inputCostPer1M: 0.20,
    outputCostPer1M: 0.20,
    maxTokens: 4096,
    supportsTools: true,
  },
  "qwen/qwen3.6-27b": {
    provider: "groq",
    modelId: "qwen/qwen3.6-27b",
    displayName: "Qwen 3",
    description: "Advanced reasoning & math",
    tier: "smart",
    inputCostPer1M: 0.30,
    outputCostPer1M: 0.30,
    maxTokens: 4096,
    supportsTools: true,
  },

  // ── OpenRouter Models (Premium Intelligence) ──
  "claude-sonnet": {
    provider: "openrouter",
    modelId: "anthropic/claude-sonnet-4-20250514",
    displayName: "Claude Sonnet 4",
    description: "Most intelligent — deep reasoning",
    tier: "premium",
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    maxTokens: 8192,
    supportsTools: true,
  },
  "claude-haiku": {
    provider: "openrouter",
    modelId: "anthropic/claude-3.5-haiku-20241022",
    displayName: "Claude Haiku",
    description: "Smart & fast — best value",
    tier: "smart",
    inputCostPer1M: 0.80,
    outputCostPer1M: 4.00,
    maxTokens: 8192,
    supportsTools: true,
  },
  "gpt-4o": {
    provider: "openrouter",
    modelId: "openai/gpt-4o",
    displayName: "GPT-4o",
    description: "OpenAI flagship multimodal",
    tier: "premium",
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
    maxTokens: 4096,
    supportsTools: true,
  },
  "gpt-4o-mini": {
    provider: "openrouter",
    modelId: "openai/gpt-4o-mini",
    displayName: "GPT-4o Mini",
    description: "Fast & affordable OpenAI",
    tier: "fast",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    maxTokens: 4096,
    supportsTools: true,
  },
};

// ── Provider Clients ──

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

// ── Smart Auto-Routing ──
// Analyzes query complexity and picks the best model

export function autoSelectModel(userMessage: string, hasTools: boolean): string {
  const msg = userMessage.toLowerCase().trim();
  const len = msg.length;

  // If no OpenRouter key, always use Groq
  if (!process.env.OPENROUTER_API_KEY) {
    return "llama-3.3-70b-versatile";
  }

  // Tool-heavy queries → Groq 70B (fast tool calling, still smart)
  if (hasTools) {
    return "llama-3.3-70b-versatile";
  }

  // Complex analytical/creative/strategy queries → Claude
  const complexPatterns = /\b(analyze|strategy|plan|compare|design|architect|explain why|deep dive|write me a|draft a|create a comprehensive|pros and cons|business plan|marketing strategy|investment|financial|legal|policy|research|thesis|essay|report)\b/i;
  if (complexPatterns.test(msg) && len > 80) {
    return "claude-sonnet";
  }

  // Medium complexity → Claude Haiku (smart but cheaper)
  const mediumPatterns = /\b(summarize|explain|help me|what do you think|how should|advice|recommend|suggest|opinion|evaluate|review)\b/i;
  if (mediumPatterns.test(msg) && len > 40) {
    return "claude-haiku";
  }

  // Simple queries → Groq 70B (fast + good enough)
  return "llama-3.3-70b-versatile";
}

// ── Unified Completion (Non-Streaming) ──

export interface CompletionOptions {
  messages: any[];
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  tools?: any[];
  toolChoice?: string;
}

export interface CompletionResult {
  content: string | null;
  toolCalls: any[] | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
  provider: "groq" | "openrouter";
}

export async function createCompletion(options: CompletionOptions): Promise<CompletionResult> {
  const config = MODEL_REGISTRY[options.model];
  if (!config) {
    // Fallback to Groq 70B if unknown model
    console.warn(`[LLM Router] Unknown model "${options.model}", falling back to llama-3.3-70b-versatile`);
    return createCompletion({ ...options, model: "llama-3.3-70b-versatile" });
  }

  if (config.provider === "groq") {
    return createGroqCompletion(config, options);
  } else {
    return createOpenRouterCompletion(config, options);
  }
}

async function createGroqCompletion(config: ModelConfig, options: CompletionOptions): Promise<CompletionResult> {
  const groq = getGroqClient();
  const params: any = {
    messages: options.messages,
    model: config.modelId,
    temperature: options.temperature ?? 0.7,
    top_p: options.topP ?? 0.9,
    max_tokens: options.maxTokens ?? config.maxTokens,
  };
  if (options.tools) {
    params.tools = options.tools;
    params.tool_choice = options.toolChoice || "auto";
  }
  const response = await groq.chat.completions.create(params);

  const message = response.choices[0]?.message;
  return {
    content: message?.content || null,
    toolCalls: message?.tool_calls || null,
    usage: {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    },
    model: config.modelId,
    provider: "groq",
  };
}

async function createOpenRouterCompletion(config: ModelConfig, options: CompletionOptions): Promise<CompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[LLM Router] No OPENROUTER_API_KEY set, falling back to Groq");
    return createCompletion({ ...options, model: "llama-3.3-70b-versatile" });
  }

  const body: any = {
    model: config.modelId,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    top_p: options.topP ?? 0.9,
    max_tokens: options.maxTokens ?? config.maxTokens,
  };

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice || "auto";
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://soltheory.com",
      "X-Title": "SOL Theory Jarvis",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LLM Router] OpenRouter error ${response.status}:`, errorText);
    // Fallback to Groq on OpenRouter failure
    console.warn("[LLM Router] Falling back to Groq due to OpenRouter error");
    return createCompletion({ ...options, model: "llama-3.3-70b-versatile" });
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;

  return {
    content: message?.content || null,
    toolCalls: message?.tool_calls || null,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    model: config.modelId,
    provider: "openrouter",
  };
}

// ── Unified Streaming ──

export async function* createStreamingCompletion(options: CompletionOptions): AsyncGenerator<{ token?: string; done?: boolean; usage?: number }> {
  const config = MODEL_REGISTRY[options.model];
  if (!config) {
    console.warn(`[LLM Router] Unknown model "${options.model}", falling back to llama-3.3-70b-versatile`);
    yield* createStreamingCompletion({ ...options, model: "llama-3.3-70b-versatile" });
    return;
  }

  if (config.provider === "groq") {
    yield* streamFromGroq(config, options);
  } else {
    yield* streamFromOpenRouter(config, options);
  }
}

async function* streamFromGroq(config: ModelConfig, options: CompletionOptions): AsyncGenerator<{ token?: string; done?: boolean; usage?: number }> {
  const groq = getGroqClient();
  const stream = await groq.chat.completions.create({
    messages: options.messages,
    model: config.modelId,
    temperature: options.temperature ?? 0.7,
    top_p: options.topP ?? 0.9,
    max_tokens: options.maxTokens ?? config.maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) {
      yield { token: delta };
    }
  }
  yield { done: true, usage: 0 };
}

async function* streamFromOpenRouter(config: ModelConfig, options: CompletionOptions): AsyncGenerator<{ token?: string; done?: boolean; usage?: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[LLM Router] No OPENROUTER_API_KEY, falling back to Groq streaming");
    yield* createStreamingCompletion({ ...options, model: "llama-3.3-70b-versatile" });
    return;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://soltheory.com",
      "X-Title": "SOL Theory Jarvis",
    },
    body: JSON.stringify({
      model: config.modelId,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.9,
      max_tokens: options.maxTokens ?? config.maxTokens,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    console.error(`[LLM Router] OpenRouter streaming error: ${response.status}`);
    // Fallback to Groq
    yield* createStreamingCompletion({ ...options, model: "llama-3.3-70b-versatile" });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") {
        yield { done: true, usage: 0 };
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content || "";
        if (delta) {
          yield { token: delta };
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }
  yield { done: true, usage: 0 };
}

// ── Cost Calculation ──

export function calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const config = MODEL_REGISTRY[modelId];
  if (!config) return 0;
  return (inputTokens / 1_000_000) * config.inputCostPer1M + (outputTokens / 1_000_000) * config.outputCostPer1M;
}

export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_REGISTRY[modelId];
}

export function isOpenRouterAvailable(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}
