/**
 * llm-router.ts — Unified LLM Routing Layer
 * 
 * Routes requests to the optimal provider based on model ID, with automatic
 * multi-tier failover: Gemini Direct → OpenRouter → Groq.
 * 
 * Architecture:
 * - Google Gemini Direct (gemini-2.5-flash) → Primary driver (cheapest, 1M context, reliable)
 * - OpenRouter (Claude, GPT-5.6, Gemini 3.5 Flash) → Premium frontier intelligence
 * - Groq (GPT OSS 120B, Qwen) → Fast fallback & Whisper audio
 * - "auto" mode → Smart routing based on query complexity
 * 
 * Failover Cascade:
 * If the selected provider fails (429 / 5xx / timeout), the router automatically
 * cascades through remaining providers until one succeeds. A 45-second circuit
 * breaker prevents hammering a degraded provider.
 */

import { Groq } from "groq-sdk";
import { GoogleGenerativeAI, type GenerateContentResult, type Content, type Part } from "@google/generative-ai";

// ── Model Registry ──
// Maps user-facing model IDs to provider-specific configs
export interface ModelConfig {
  provider: "groq" | "openrouter" | "gemini";
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
  // ── Primary Default (Google Gemini Direct — cheapest, 1M context) ──
  "gemini-2.5-flash": {
    provider: "gemini",
    modelId: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    description: "Google Direct — ultra-cheap, 1M context, reliable",
    tier: "fast",
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
    maxTokens: 8192,
    supportsTools: true,
  },

  // ── Budget Models (Groq — fast & cheap) ──
  "openai/gpt-oss-120b": {
    provider: "groq",
    modelId: "openai/gpt-oss-120b",
    displayName: "GPT OSS 120B",
    description: "Best all-around open model — 500 t/s",
    tier: "smart",
    inputCostPer1M: 0.59,
    outputCostPer1M: 0.79,
    maxTokens: 4096,
    supportsTools: true,
  },
  "qwen/qwen3.6-27b": {
    provider: "groq",
    modelId: "qwen/qwen3.6-27b",
    displayName: "Qwen 3.6 27B",
    description: "Strong reasoning — mid-size model",
    tier: "smart",
    inputCostPer1M: 0.18,
    outputCostPer1M: 0.50,
    maxTokens: 4096,
    supportsTools: true,
  },
  "nemotron-3-ultra": {
    provider: "openrouter",
    modelId: "nvidia/nemotron-3-ultra-550b-a55b:free",
    displayName: "Nemotron 3 Ultra",
    description: "NVIDIA 550B MoE — free frontier model",
    tier: "smart",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    maxTokens: 8192,
    supportsTools: true,
  },

  // ── Premium Models (OpenRouter — frontier intelligence) ──
  "claude-opus-5": {
    provider: "openrouter",
    modelId: "anthropic/claude-opus-5",
    displayName: "Claude Opus 5",
    description: "Anthropic flagship — deepest reasoning",
    tier: "premium",
    inputCostPer1M: 5.00,
    outputCostPer1M: 25.00,
    maxTokens: 8192,
    supportsTools: true,
  },
  "gpt-5.6-sol": {
    provider: "openrouter",
    modelId: "openai/gpt-5.6-sol",
    displayName: "GPT-5.6 Sol",
    description: "OpenAI flagship — strongest overall",
    tier: "premium",
    inputCostPer1M: 5.00,
    outputCostPer1M: 30.00,
    maxTokens: 8192,
    supportsTools: true,
  },
  "gemini-3.5-flash": {
    provider: "openrouter",
    modelId: "google/gemini-3.5-flash",
    displayName: "Gemini 3.5 Flash",
    description: "Google — fast & smart, 1M context",
    tier: "smart",
    inputCostPer1M: 1.50,
    outputCostPer1M: 9.00,
    maxTokens: 8192,
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

let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  }
  return geminiClient;
}

// ── Circuit Breaker ──
// Tracks providers that recently failed so we skip them for 45 seconds
const circuitBreaker: Record<string, number> = {};
const CIRCUIT_BREAKER_DURATION_MS = 45_000; // 45 seconds

function isProviderDegraded(provider: string): boolean {
  const failedAt = circuitBreaker[provider];
  if (!failedAt) return false;
  if (Date.now() - failedAt > CIRCUIT_BREAKER_DURATION_MS) {
    delete circuitBreaker[provider];
    return false;
  }
  return true;
}

function tripCircuitBreaker(provider: string): void {
  circuitBreaker[provider] = Date.now();
  console.warn(`[LLM Router] ⚡ Circuit breaker tripped for "${provider}" — will skip for 45s`);
}

/** Get ordered fallback providers for the cascade, skipping degraded ones */
function getFallbackCascade(startProvider: "gemini" | "openrouter" | "groq"): Array<"gemini" | "openrouter" | "groq"> {
  // Default ordering: gemini → openrouter → groq
  const fullOrder: Array<"gemini" | "openrouter" | "groq"> = ["gemini", "openrouter", "groq"];
  // Move the starting provider to the front
  const startIdx = fullOrder.indexOf(startProvider);
  const reordered = [fullOrder[startIdx], ...fullOrder.filter((_, i) => i !== startIdx)];
  // Filter out degraded providers (but always keep at least one)
  const healthy = reordered.filter(p => !isProviderDegraded(p));
  return healthy.length > 0 ? healthy : [reordered[reordered.length - 1]];
}

// ── Smart Auto-Routing ──
// Analyzes query complexity and picks the best model

export function autoSelectModel(userMessage: string, _hasTools: boolean): string {
  const msg = userMessage.toLowerCase().trim();
  const len = msg.length;

  // If OpenRouter is available, use premium models for complex queries
  if (process.env.OPENROUTER_API_KEY) {
    // Complex analytical/creative/strategy queries → GPT-5.6 Sol
    const complexPatterns = /\b(analyze|strategy|plan|compare|design|architect|explain why|deep dive|write me a|draft a|create a comprehensive|pros and cons|business plan|marketing strategy|investment|financial|legal|policy|research|thesis|essay|report)\b/i;
    if (complexPatterns.test(msg) && len > 80) {
      return "gpt-5.6-sol";
    }

    // Medium complexity → Gemini Flash (smart but cheaper)
    const mediumPatterns = /\b(summarize|explain|help me|what do you think|how should|advice|recommend|suggest|opinion|evaluate|review)\b/i;
    if (mediumPatterns.test(msg) && len > 40) {
      return "gemini-3.5-flash";
    }
  }

  // Default → Gemini 2.5 Flash (cheapest, 1M context, reliable)
  return "gemini-2.5-flash";
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
  provider: "groq" | "openrouter" | "gemini";
  /** The model the user originally requested (may differ from `model` if fallback occurred) */
  requestedModel?: string;
  /** True if the response was generated by a fallback model, not the one the user selected */
  wasModelFallback?: boolean;
}

/**
 * Non-streaming completion with automatic multi-tier failover.
 * If the selected provider fails (429 / 5xx / timeout), cascades through
 * remaining providers until one succeeds.
 */
export async function createCompletion(options: CompletionOptions & { _originalModel?: string }): Promise<CompletionResult> {
  const originalRequestedModel = options._originalModel || options.model;
  const config = MODEL_REGISTRY[options.model];
  if (!config) {
    // Unknown model → try Gemini 2.5 Flash as fallback
    console.warn(`[LLM Router] ⚠️ FALLBACK: Unknown model "${options.model}", falling back to gemini-2.5-flash`);
    const result = await createCompletion({ ...options, model: "gemini-2.5-flash", _originalModel: originalRequestedModel });
    result.requestedModel = originalRequestedModel;
    result.wasModelFallback = true;
    return result;
  }

  // Build the fallback cascade starting from the configured provider
  const cascade = getFallbackCascade(config.provider);

  // Attempt each provider in the cascade until one succeeds
  let lastError: Error | null = null;
  for (const provider of cascade) {
    try {
      let result: CompletionResult;
      if (provider === config.provider) {
        // Primary: use user's exact model
        if (config.provider === "gemini") result = await createGeminiCompletion(config, options);
        else if (config.provider === "openrouter") result = await createOpenRouterCompletion(config, options);
        else result = await createGroqCompletion(config, options);
      } else {
        // Fallback: use best model for that provider
        if (provider === "gemini") {
          result = await createGeminiCompletion(MODEL_REGISTRY["gemini-2.5-flash"], { ...options, model: "gemini-2.5-flash" });
        } else if (provider === "openrouter") {
          result = await createOpenRouterCompletion(MODEL_REGISTRY["nemotron-3-ultra"], { ...options, model: "nemotron-3-ultra" });
        } else {
          result = await createGroqCompletion(MODEL_REGISTRY["openai/gpt-oss-120b"], { ...options, model: "openai/gpt-oss-120b" });
        }
        result.requestedModel = originalRequestedModel;
        result.wasModelFallback = true;
      }
      return result;
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.statusCode || "unknown";
      console.error(`[LLM Router] ❌ ${provider} failed (status=${status}): ${String(err?.message || err).substring(0, 200)}`);
      tripCircuitBreaker(provider);
      // Continue to next provider in cascade
    }
  }

  // All providers failed — throw the last error
  throw lastError || new Error("[LLM Router] All providers failed");
}

// ── Gemini Direct Completion ──

/** Convert OpenAI-format messages to Gemini SDK Content array */
function convertMessagesToGeminiFormat(messages: any[]): { systemInstruction?: string; contents: Content[] } {
  let systemInstruction: string | undefined;
  const contents: Content[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      // Gemini uses systemInstruction, not a system message in contents
      systemInstruction = (systemInstruction ? systemInstruction + "\n\n" : "") + msg.content;
      continue;
    }

    const role = msg.role === "assistant" ? "model" : "user";
    const parts: Part[] = [];

    if (typeof msg.content === "string" && msg.content) {
      parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      // Handle multimodal content arrays (text + vision)
      for (const part of msg.content) {
        if (part.type === "text") {
          parts.push({ text: part.text });
        } else if (part.type === "image_url" && part.image_url?.url) {
          // Convert base64 data URL to Gemini's inlineData format
          const url = part.image_url.url;
          if (url.startsWith("data:")) {
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              parts.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2],
                },
              } as any);
            }
          }
        }
      }
    }

    // Handle tool calls from assistant
    if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        parts.push({
          functionCall: {
            name: tc.function.name,
            args: typeof tc.function.arguments === "string"
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments,
          },
        } as any);
      }
    }

    // Handle tool results
    if (msg.role === "tool") {
      contents.push({
        role: "function" as any,
        parts: [{
          functionResponse: {
            name: msg.name || "tool_result",
            response: { result: msg.content },
          },
        } as any],
      });
      continue;
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  return { systemInstruction, contents };
}

/** Convert OpenAI-format tools to Gemini function declarations */
function convertToolsToGeminiFormat(tools?: any[]): any[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools
    .filter((t: any) => t.type === "function" && t.function)
    .map((t: any) => ({
      name: t.function.name,
      description: t.function.description || "",
      parameters: t.function.parameters || { type: "object", properties: {} },
    }));
}

async function createGeminiCompletion(config: ModelConfig, options: CompletionOptions): Promise<CompletionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("[LLM Router] No GEMINI_API_KEY set");
  }

  const client = getGeminiClient();
  const { systemInstruction, contents } = convertMessagesToGeminiFormat(options.messages);

  const modelOptions: any = { model: config.modelId };
  if (systemInstruction) {
    modelOptions.systemInstruction = systemInstruction;
  }

  const geminiModel = client.getGenerativeModel(modelOptions);

  const requestParams: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      topP: options.topP ?? 0.9,
      maxOutputTokens: options.maxTokens ?? config.maxTokens,
    },
  };

  // Add tools if provided
  const geminiTools = convertToolsToGeminiFormat(options.tools);
  if (geminiTools && geminiTools.length > 0) {
    requestParams.tools = [{ functionDeclarations: geminiTools }];
  }

  const result: GenerateContentResult = await geminiModel.generateContent(requestParams);
  const response = result.response;
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  // Extract text content
  const content = parts
    .filter((p: any) => p.text)
    .map((p: any) => p.text)
    .join("") || null;

  // Extract function calls (tool calls)
  const functionCalls = parts.filter((p: any) => p.functionCall);
  let toolCalls: any[] | null = null;
  if (functionCalls.length > 0) {
    toolCalls = functionCalls.map((p: any, i: number) => ({
      id: `call_gemini_${Date.now()}_${i}`,
      type: "function",
      function: {
        name: p.functionCall.name,
        arguments: JSON.stringify(p.functionCall.args || {}),
      },
    }));
  }

  // Extract usage
  const usageMetadata = response.usageMetadata;

  return {
    content,
    toolCalls,
    usage: {
      promptTokens: usageMetadata?.promptTokenCount || 0,
      completionTokens: usageMetadata?.candidatesTokenCount || 0,
      totalTokens: usageMetadata?.totalTokenCount || 0,
    },
    model: config.modelId,
    provider: "gemini",
  };
}

// ── Groq Completion ──

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

// ── OpenRouter Completion ──

async function createOpenRouterCompletion(config: ModelConfig, options: CompletionOptions): Promise<CompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("[LLM Router] No OPENROUTER_API_KEY set");
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
    throw new Error(`OpenRouter error ${response.status}: ${errorText.substring(0, 300)}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;

  // Fix for reasoning models (Gemini 3.5 Flash): if content is null but reasoning exists, use reasoning
  const content = message?.content || message?.reasoning || message?.reasoning_content || null;

  return {
    content,
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

export type StreamChunk = {
  token?: string;
  reasoning?: string;
  done?: boolean;
  usage?: number;
  modelFallback?: { requested: string; actual: string };
};

/**
 * Streaming completion with automatic multi-tier failover.
 * If the selected provider fails, cascades to the next provider.
 */
export async function* createStreamingCompletion(options: CompletionOptions): AsyncGenerator<StreamChunk> {
  const config = MODEL_REGISTRY[options.model];
  if (!config) {
    console.warn(`[LLM Router] Unknown model "${options.model}", falling back to gemini-2.5-flash`);
    yield { modelFallback: { requested: options.model, actual: "gemini-2.5-flash" } };
    yield* createStreamingCompletion({ ...options, model: "gemini-2.5-flash" });
    return;
  }

  // Build the fallback cascade
  const cascade = getFallbackCascade(config.provider);

  for (let i = 0; i < cascade.length; i++) {
    const provider = cascade[i];
    try {
      if (provider === config.provider) {
        // Primary: use the user's exact model
        if (config.provider === "gemini") { yield* streamFromGemini(config, options); return; }
        if (config.provider === "groq") { yield* streamFromGroq(config, options); return; }
        if (config.provider === "openrouter") { yield* streamFromOpenRouter(config, options); return; }
      } else {
        // Fallback: use best model for that provider
        const fallbackModel = provider === "gemini" ? "gemini-2.5-flash"
          : provider === "groq" ? "openai/gpt-oss-120b"
          : "nemotron-3-ultra";
        const fallbackConfig = MODEL_REGISTRY[fallbackModel];
        if (!fallbackConfig) continue;

        yield { modelFallback: { requested: options.model, actual: fallbackModel } };
        if (provider === "gemini") { yield* streamFromGemini(fallbackConfig, { ...options, model: fallbackModel }); return; }
        if (provider === "groq") { yield* streamFromGroq(fallbackConfig, { ...options, model: fallbackModel }); return; }
        if (provider === "openrouter") { yield* streamFromOpenRouter(fallbackConfig, { ...options, model: fallbackModel }); return; }
      }
    } catch (err: any) {
      const status = err?.status || err?.statusCode || "unknown";
      console.error(`[LLM Router] ❌ Stream ${provider} failed (status=${status}): ${String(err?.message || err).substring(0, 200)}`);
      tripCircuitBreaker(provider);
      // Continue to next provider in cascade
    }
  }

  // All providers failed
  yield { token: "\n\n⚠️ All AI providers are temporarily unavailable. Please try again in a moment." };
  yield { done: true, usage: 0 };
}

// ── Gemini Streaming ──

async function* streamFromGemini(config: ModelConfig, options: CompletionOptions): AsyncGenerator<StreamChunk> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("[LLM Router] No GEMINI_API_KEY set");
  }

  const client = getGeminiClient();
  const { systemInstruction, contents } = convertMessagesToGeminiFormat(options.messages);

  const modelOptions: any = { model: config.modelId };
  if (systemInstruction) {
    modelOptions.systemInstruction = systemInstruction;
  }

  const geminiModel = client.getGenerativeModel(modelOptions);

  const requestParams: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      topP: options.topP ?? 0.9,
      maxOutputTokens: options.maxTokens ?? config.maxTokens,
    },
  };

  const result = await geminiModel.generateContentStream(requestParams);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield { token: text };
    }
  }
  yield { done: true, usage: 0 };
}

// ── Groq Streaming ──

async function* streamFromGroq(config: ModelConfig, options: CompletionOptions): AsyncGenerator<StreamChunk> {
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
    const delta = chunk.choices[0]?.delta as any;
    // Capture reasoning tokens from reasoning models (Qwen, DeepSeek, etc.)
    const reasoning = delta?.reasoning || delta?.reasoning_content || "";
    if (reasoning) {
      yield { reasoning };
    }
    const content = delta?.content || "";
    if (content) {
      yield { token: content };
    }
  }
  yield { done: true, usage: 0 };
}

// ── OpenRouter Streaming ──

async function* streamFromOpenRouter(config: ModelConfig, options: CompletionOptions): AsyncGenerator<StreamChunk> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("[LLM Router] No OPENROUTER_API_KEY set");
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
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch { errorBody = 'Could not read error body'; }
    throw new Error(`OpenRouter stream error ${response.status}: ${errorBody.substring(0, 300)}`);
  }

  console.log(`[LLM Router] OpenRouter streaming SUCCESS — model=${config.modelId} status=${response.status}`);

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
        const delta = parsed.choices?.[0]?.delta;
        // Fix: Capture reasoning tokens from reasoning models (Gemini 3.5 Flash, etc.)
        // These models return content: null with all tokens in delta.reasoning
        const reasoning = delta?.reasoning || delta?.reasoning_content || "";
        if (reasoning) {
          yield { reasoning };
        }
        const content = delta?.content || "";
        if (content) {
          yield { token: content };
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

export function isGeminiAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
