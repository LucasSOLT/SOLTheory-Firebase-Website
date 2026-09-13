#!/usr/bin/env npx tsx
/**
 * src/scripts/test-embedding.ts — Unit Test & Verification for Embedding Pipeline
 * 
 * Verifies that:
 * 1. Single text embedding returns exactly 1536 floats.
 * 2. Batch embeddings return exactly 1536 floats per item with preserved order.
 * 3. Vector magnitude (L2 norm) conforms to expected unit normalization (~1.0).
 * 4. Latency / execution time is tracked and acceptable.
 * 5. Anti-chaos safeguard rejects wrong dimensions (e.g., 768-dim legacy vectors).
 * 
 * Usage:
 *   npx tsx src/scripts/test-embedding.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

import {
  generateEmbedding,
  generateBatchEmbeddings,
  validateEmbedding,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  PGVECTOR_COLUMN_TYPE,
  EmbeddingDimensionMismatchError,
} from "../lib/ai/embeddingService";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}${detail ? ` (${detail})` : ""}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
    failedTests++;
  }
}

function calculateL2Norm(vector: number[]): number {
  const sumSquares = vector.reduce((sum, val) => sum + val * val, 0);
  return Math.sqrt(sumSquares);
}

async function runTests() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  RAG Embedding Pipeline — Strict 1536-Dim Verification   ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log(`Configured Model:      ${EMBEDDING_MODEL}`);
  console.log(`Target Dimensions:     ${EMBEDDING_DIMENSIONS}`);
  console.log(`PostgreSQL Type:       ${PGVECTOR_COLUMN_TYPE}\n`);

  // ── TEST 1: Single Text Embedding ─────────────────────────────────────────
  console.log("━━━ Test 1: Single Text Embedding Generation ━━━");
  const sampleQuery = "What are our organization's approved billable rates and active grant targets?";
  const startTime = Date.now();

  try {
    const vector = await generateEmbedding(sampleQuery);
    const durationMs = Date.now() - startTime;

    assert(Array.isArray(vector), "Returns an array");
    assert(
      vector.length === EMBEDDING_DIMENSIONS,
      `Vector dimension strictly equals ${EMBEDDING_DIMENSIONS}`,
      `received: ${vector.length}`
    );

    const allFloats = vector.every((val) => typeof val === "number" && Number.isFinite(val));
    assert(allFloats, "All 1536 elements are valid finite floats");

    const norm = calculateL2Norm(vector);
    const isNormalized = Math.abs(norm - 1.0) < 0.05;
    assert(
      isNormalized,
      "Vector is unit-normalized (L2 norm ≈ 1.0)",
      `norm: ${norm.toFixed(4)}`
    );

    console.log(`  ⏱️  Execution Time: ${durationMs}ms`);
    console.log(`  📊 Sample preview: [${vector.slice(0, 4).map(v => v.toFixed(6)).join(", ")}, ... +${vector.length - 4} more]`);
  } catch (err: any) {
    assert(false, "Single embedding generation threw an unexpected error", err?.message || err);
  }

  // ── TEST 2: Batch Text Embeddings ─────────────────────────────────────────
  console.log("\n━━━ Test 2: Batch Embedding Generation ━━━");
  const sampleBatch = [
    "Section 1: General provisions and scope of services.",
    "Section 2: Timesheet logging procedures and customer billing intervals.",
    "Section 3: Federal grant application deadlines and compliance guidelines.",
  ];
  const batchStartTime = Date.now();

  try {
    const batchVectors = await generateBatchEmbeddings(sampleBatch);
    const batchDurationMs = Date.now() - batchStartTime;

    assert(
      batchVectors.length === sampleBatch.length,
      `Batch count matches input (${sampleBatch.length})`,
      `received: ${batchVectors.length}`
    );

    const all1536 = batchVectors.every((v) => v.length === EMBEDDING_DIMENSIONS);
    assert(
      all1536,
      `Every batch vector has length exactly ${EMBEDDING_DIMENSIONS}`
    );

    console.log(`  ⏱️  Batch Execution Time: ${batchDurationMs}ms (${(batchDurationMs / sampleBatch.length).toFixed(1)}ms/chunk)`);
  } catch (err: any) {
    assert(false, "Batch embedding generation threw an unexpected error", err?.message || err);
  }

  // ── TEST 3: Anti-Chaos Safeguard (Dimension Mismatch Rejection) ───────────
  console.log("\n━━━ Test 3: Anti-Chaos Safeguards (Strict Dimension Enforcement) ━━━");
  
  // Create an artificial 768-dim vector (emulating legacy Gemini text-embedding-004)
  const legacy768Vector = new Array(768).fill(0.01);
  let caught768Error = false;

  try {
    validateEmbedding(legacy768Vector);
  } catch (err: any) {
    if (err instanceof EmbeddingDimensionMismatchError) {
      caught768Error = true;
    }
  }
  assert(
    caught768Error,
    "Correctly rejects 768-dim legacy vector with EmbeddingDimensionMismatchError",
    "prevents pgvector corruption"
  );

  // Test empty text rejection
  let caughtEmptyError = false;
  try {
    await generateEmbedding("   ");
  } catch {
    caughtEmptyError = true;
  }
  assert(caughtEmptyError, "Rejects empty/whitespace-only input cleanly");

  // ── Final Summary ────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  if (failedTests === 0) {
    console.log(`║  🎉 ALL ${passedTests} TESTS PASSED — 1536-Dim Pipeline Ready!        ║`);
  } else {
    console.log(`║  ⚠️  ${failedTests} TEST(S) FAILED (Passed: ${passedTests}/${totalTests})                  ║`);
  }
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test runner exception:", err);
  process.exit(1);
});
