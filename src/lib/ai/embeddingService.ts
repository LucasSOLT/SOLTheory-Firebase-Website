/**
 * src/lib/ai/embeddingService.ts — Strict RAG Embedding Pipeline
 * 
 * Standardized strictly on OpenAI's `text-embedding-3-small` (1536 dimensions).
 * 
 * ⚠️ ARCHITECTURAL SAFEGUARD / ANTI-CHAOS RULE:
 * Dynamic model fallback is STRICTLY DISABLED in this service.
 * NEVER catch an error and switch to another provider (e.g., Gemini text-embedding-004 @ 768 dims).
 * Switching models causes fatal vector dimension mismatch exceptions in Supabase pgvector (`vector(1536)`).
 */

import OpenAI from "openai";

// ── Strict Hardcoded Dimension & Model Configuration ────────────────────────
export const EMBEDDING_MODEL = "text-embedding-3-small" as const;
export const OPENROUTER_MODEL = "openai/text-embedding-3-small" as const;
export const EMBEDDING_DIMENSIONS = 1536 as const;
export const PGVECTOR_COLUMN_TYPE = "vector(1536)" as const;

/**
 * Supabase / PostgreSQL DDL template locking dimensions strictly to 1536.
 */
export const PGVECTOR_DDL = `
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Document embeddings table locked strictly to vector(1536)
CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  user_id TEXT,
  document_id TEXT,
  document_title TEXT,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. High-performance HNSW index for cosine distance
CREATE INDEX IF NOT EXISTS idx_document_embeddings_hnsw
ON document_embeddings
USING hnsw (embedding vector_cosine_ops);

-- 4. Supabase RPC function for cosine similarity matching
CREATE OR REPLACE FUNCTION match_document_embeddings(
  query_embedding vector(${EMBEDDING_DIMENSIONS}),
  match_threshold float,
  match_count int,
  filter_org_id text
)
RETURNS TABLE (
  id uuid,
  document_id text,
  document_title text,
  chunk_index int,
  chunk_text text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.document_id,
    de.document_title,
    de.chunk_index,
    de.chunk_text,
    1 - (de.embedding <=> query_embedding) AS similarity,
    de.metadata
  FROM document_embeddings de
  WHERE de.org_id = filter_org_id
    AND (1 - (de.embedding <=> query_embedding)) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
`.trim();

// ── Custom Error Classes ───────────────────────────────────────────────────

export class EmbeddingConfigurationError extends Error {
  constructor(message: string) {
    super(`[EmbeddingService:ConfigError] ${message}`);
    this.name = "EmbeddingConfigurationError";
  }
}

export class EmbeddingDimensionMismatchError extends Error {
  constructor(expected: number, received: number) {
    super(
      `[EmbeddingService:DimensionMismatch] FATAL: Expected vector of dimension ${expected}, but received ${received}. ` +
      `Supabase pgvector column is locked to vector(${expected}). Operation aborted to prevent database corruption.`
    );
    this.name = "EmbeddingDimensionMismatchError";
  }
}

export class EmbeddingGenerationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(`[EmbeddingService:GenerationError] ${message}`);
    this.name = "EmbeddingGenerationError";
  }
}

// ── Client Factory ─────────────────────────────────────────────────────────

interface EmbeddingClientConfig {
  client: OpenAI;
  model: string;
  provider: "openai" | "openrouter";
}

function getEmbeddingClient(): EmbeddingClientConfig {
  const openAiKey = process.env.OPENAI_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (openAiKey) {
    return {
      client: new OpenAI({ apiKey: openAiKey }),
      model: EMBEDDING_MODEL,
      provider: "openai",
    };
  }

  if (openRouterKey) {
    return {
      client: new OpenAI({
        apiKey: openRouterKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://soltheory.com",
          "X-Title": "SOLTheory RAG Pipeline",
        },
      }),
      model: OPENROUTER_MODEL,
      provider: "openrouter",
    };
  }

  throw new EmbeddingConfigurationError(
    "Missing embedding API credentials. Please set OPENAI_API_KEY or OPENROUTER_API_KEY in .env.local."
  );
}

// ── Vector Validation ──────────────────────────────────────────────────────

/**
 * Asserts that the vector is valid, non-empty, and matches exactly 1536 floats.
 * Throws EmbeddingDimensionMismatchError or EmbeddingGenerationError on invalid inputs.
 */
export function validateEmbedding(vector: unknown): asserts vector is number[] {
  if (!Array.isArray(vector)) {
    throw new EmbeddingGenerationError("Output embedding is not an array.");
  }

  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new EmbeddingDimensionMismatchError(EMBEDDING_DIMENSIONS, vector.length);
  }

  for (let i = 0; i < vector.length; i++) {
    const val = vector[i];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new EmbeddingGenerationError(
        `Vector contains invalid float at index ${i}: ${val}`
      );
    }
  }
}

// ── Core Service Functions ─────────────────────────────────────────────────

/**
 * Generates an embedding vector for a single text string using text-embedding-3-small.
 * Output is guaranteed to be a 1536-dimensional float array.
 * 
 * ⚠️ Strictly NO fallback to other models. Fails fast if API call fails.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new EmbeddingGenerationError("Cannot generate embedding for empty or whitespace-only text.");
  }

  const { client, model, provider } = getEmbeddingClient();

  let response: OpenAI.Embeddings.CreateEmbeddingResponse;
  try {
    response = await client.embeddings.create({
      model,
      input: normalizedText,
      dimensions: EMBEDDING_DIMENSIONS,
    });
  } catch (err: any) {
    // ANTI-CHAOS: Do NOT switch to Gemini/Cohere/etc. Throw immediately.
    throw new EmbeddingGenerationError(
      `Failed to generate embedding via ${provider} (${model}): ${err?.message || err}`,
      err
    );
  }

  const embedding = response?.data?.[0]?.embedding;
  validateEmbedding(embedding);

  return embedding;
}

/**
 * Generates embeddings for an array of text chunks.
 * Processes in batches to respect rate limits and payload boundaries.
 * Output preserves the input order and guarantees 1536 dimensions for each chunk.
 * 
 * ⚠️ Strictly NO fallback to other models.
 */
export async function generateBatchEmbeddings(
  texts: string[],
  batchSize: number = 50
): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  const { client, model, provider } = getEmbeddingClient();
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map((t) => t.trim());
    
    // Replace any empty string in the batch with a placeholder to keep index alignment
    const sanitizedBatch = batch.map((t) => (t.length > 0 ? t : " "));

    let response: OpenAI.Embeddings.CreateEmbeddingResponse;
    try {
      response = await client.embeddings.create({
        model,
        input: sanitizedBatch,
        dimensions: EMBEDDING_DIMENSIONS,
      });
    } catch (err: any) {
      // ANTI-CHAOS: Fail immediately. Do not attempt model degradation.
      throw new EmbeddingGenerationError(
        `Failed to generate batch embedding (index ${i}-${i + batch.length}) via ${provider} (${model}): ${err?.message || err}`,
        err
      );
    }

    const embeddings = response?.data
      ?.sort((a, b) => a.index - b.index)
      ?.map((item) => item.embedding);

    if (!embeddings || embeddings.length !== batch.length) {
      throw new EmbeddingGenerationError(
        `Batch embedding count mismatch: expected ${batch.length}, received ${embeddings?.length || 0}`
      );
    }

    for (const emb of embeddings) {
      validateEmbedding(emb);
      allEmbeddings.push(emb);
    }
  }

  return allEmbeddings;
}
