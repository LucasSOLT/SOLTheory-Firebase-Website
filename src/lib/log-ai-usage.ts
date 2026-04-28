import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";

// Groq pricing per 1M tokens (as of 2024-2025)
const GROQ_PRICING: Record<string, { input: number; output: number }> = {
  "llama-3.3-70b-versatile":  { input: 0.59,  output: 0.79  },
  "llama-3.1-70b-versatile":  { input: 0.59,  output: 0.79  },
  "llama-3.1-8b-instant":     { input: 0.05,  output: 0.08  },
  "llama3-70b-8192":          { input: 0.59,  output: 0.79  },
  "llama3-8b-8192":           { input: 0.05,  output: 0.08  },
  "mixtral-8x7b-32768":       { input: 0.24,  output: 0.24  },
  "gemma2-9b-it":             { input: 0.20,  output: 0.20  },
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
