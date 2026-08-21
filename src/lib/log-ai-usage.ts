import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";

// Groq + OpenRouter pricing per 1M tokens (verified Aug 2026)
// Keys must match MODEL_REGISTRY keys (what selectedModel contains)
const GROQ_PRICING: Record<string, { input: number; output: number }> = {
  // Budget (Groq)
  "openai/gpt-oss-120b":  { input: 0.59,   output: 0.79   },
  "qwen/qwen3.6-27b":       { input: 0.18,   output: 0.50   },
  "nemotron-3-ultra":         { input: 0,      output: 0      },
  // Premium (OpenRouter) — keyed by registry key, not provider model ID
  "claude-opus-5":            { input: 5.00,   output: 25.00  },
  "gpt-5.6-sol":              { input: 5.00,   output: 30.00  },
  "gemini-3.5-flash":         { input: 1.50,   output: 9.00   },
};

// ElevenLabs pricing per 1000 characters
const ELEVENLABS_COST_PER_1K_CHARS = 0.30; // approximate for Turbo v2.5

export interface AIUsageEntry {
  userId: string;
  userEmail?: string;
  orgId: string; // "soltheory" | "nxtchapter"
  model: string;
  provider: "groq" | "elevenlabs";
  endpoint: string; // which API route triggered this
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  characters?: number; // for ElevenLabs
  costUsd: number;
  timestamp: Date;
}

export function calculateGroqCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = GROQ_PRICING[model] || { input: 0.59, output: 0.79 }; // default to 70b pricing
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

export function calculateElevenLabsCost(characterCount: number): number {
  return (characterCount / 1000) * ELEVENLABS_COST_PER_1K_CHARS;
}

export async function logAIUsage(entry: AIUsageEntry) {
  // Skip logging if no admin credentials — avoids 10s+ blocking on Vercel
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return;
  try {
    await initAdmin();
    const db = getAdminFirestore();
    await db.collection("ai_usage").add({
      ...entry,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("[AI Usage Logger] Failed to log:", err);
    // Don't throw — logging should never break the main flow
  }
}
