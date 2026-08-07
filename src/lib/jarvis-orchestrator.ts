/**
 * jarvis-orchestrator.ts — Multi-Step Task Orchestrator
 * 
 * Handles complex requests that span 2+ domains by:
 * 1. Decomposing the request into ordered sub-tasks (via LLM planner)
 * 2. Executing each sub-task with domain-filtered tools
 * 3. Passing context between steps (results from step 1 feed step 2)
 * 4. Synthesizing a unified natural-language response
 * 
 * Used by chat/route.ts when the router classifies intent as MULTI.
 */

import { Groq } from "groq-sdk";
import { filterToolsForDomain, getDomainPrompt } from "./jarvis-agents";
import type { JarvisDomain } from "./jarvis-router";
import type { AgentEventEmitter } from "@/lib/agent-events";

// ── Types ──

export interface OrchestratorStep {
  stepNumber: number;
  domain: JarvisDomain;
  task: string;
  dependsOn: number[];
}

export interface OrchestratorPlan {
  summary: string;
  steps: OrchestratorStep[];
}

export interface StepResult {
  stepNumber: number;
  domain: JarvisDomain;
  task: string;
  result: string;
  toolsExecuted: string[];
  success: boolean;
}

export interface OrchestratorResult {
  plan: OrchestratorPlan;
  stepResults: StepResult[];
  finalResponse: string;
}

/**
 * Callback type for tool execution.
 * Provided by chat/route.ts — wraps the existing tool execution switch statement.
 * Returns the string result of executing the tool.
 */
export type ToolExecutor = (
  toolName: string,
  args: Record<string, unknown>
) => Promise<string>;

// ── Constants ──

// Models that the Groq SDK can execute (orchestrator always uses Groq for tool support)
const GROQ_COMPATIBLE_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "groq/compound",
]);

/** Ensure the model is Groq-compatible; fall back to the 70B versatile model if not. */
function ensureGroqModel(model: string): string {
  if (GROQ_COMPATIBLE_MODELS.has(model)) return model;
  console.warn(`[ORCHESTRATOR] Model "${model}" is not Groq-compatible, falling back to llama-3.3-70b-versatile`);
  return "llama-3.3-70b-versatile";
}

// ── Plan Decomposition ──

const PLANNER_PROMPT = `You are a task planner for an AI assistant. Decompose the user's request into sequential sub-tasks.

Available domains and their capabilities:
- EMAIL: Search emails, draft/send emails, delete emails, block senders, create folders
- CALENDAR: List/create/update/delete calendar events, check availability, create Google Meet links
- CRM: Create/update/delete/search contacts, analytics, batch updates, evaluate contacts, resolve names to emails/phones
- COMMS: Send/read iMessages/SMS, search message threads, summarize conversations
- WORKSPACE: Create Google Docs/Slides/Sheets, search Drive, draft YouTube videos, create surveys
- GRANTS: Manage grant prospecting agents (spawn, list, delete)
- GENERAL: Web search, recall past conversations

Rules:
1. Each step must specify exactly ONE domain
2. Order steps by dependency — if step 2 needs data from step 1, list step 1 first
3. Keep steps atomic — one logical action per step
4. Use the "dependsOn" array to indicate which prior steps feed data into this step
5. Maximum 6 steps total
6. If a step needs to look up a contact's email/phone before emailing/texting, add a CRM step first

Respond with ONLY valid JSON (no markdown, no explanation):
{"summary": "Brief plan description", "steps": [{"stepNumber": 1, "domain": "CRM", "task": "Search for...", "dependsOn": []}, {"stepNumber": 2, "domain": "EMAIL", "task": "Draft email to...", "dependsOn": [1]}]}`;

/**
 * Decompose a multi-step user request into an ordered plan.
 */
async function decomposePlan(
  userMessage: string,
  groqClient: Groq,
  groqModel: string,
  conversationContext?: string
): Promise<OrchestratorPlan> {
  const userContent = conversationContext
    ? `Recent conversation context:\n${conversationContext}\n\nUser request: ${userMessage}`
    : `User request: ${userMessage}`;

  const response = await groqClient.chat.completions.create({
    model: groqModel,
    messages: [
      { role: "system", content: PLANNER_PROMPT },
      { role: "user", content: userContent },
    ],
    max_tokens: 600,
    temperature: 0.1,
  });

  const raw = response.choices[0]?.message?.content || "";
  console.log(`[ORCHESTRATOR] Planner raw response: ${raw.substring(0, 500)}`);

  // Use lazy regex to avoid over-matching if LLM appends extra text
  const jsonMatch = raw.match(/\{[\s\S]*?\}(?=[^}]*$)/) || raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[ORCHESTRATOR] Failed to parse plan JSON");
    // Fallback: single GENERAL step with the full request
    return {
      summary: "Executing as single task",
      steps: [{ stepNumber: 1, domain: "GENERAL", task: userMessage, dependsOn: [] }],
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as OrchestratorPlan;

    // Validate that steps is actually an array with required fields
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      console.error("[ORCHESTRATOR] Parsed plan has no valid steps array");
      return {
        summary: "Executing as single task",
        steps: [{ stepNumber: 1, domain: "GENERAL", task: userMessage, dependsOn: [] }],
      };
    }

    // Validate and sanitize each step
    const validDomains: JarvisDomain[] = ["EMAIL", "CALENDAR", "CRM", "COMMS", "WORKSPACE", "GRANTS", "GENERAL"];
    for (let i = 0; i < parsed.steps.length; i++) {
      const step = parsed.steps[i];
      // Ensure required fields exist
      if (!step.task || typeof step.task !== "string") step.task = userMessage;
      if (!step.stepNumber || typeof step.stepNumber !== "number") step.stepNumber = i + 1;
      if (!Array.isArray(step.dependsOn)) step.dependsOn = [];
      if (!validDomains.includes(step.domain)) step.domain = "GENERAL";
    }

    // Cap at 6 steps
    if (parsed.steps.length > 6) {
      parsed.steps = parsed.steps.slice(0, 6);
    }

    console.log(`[ORCHESTRATOR] Plan: ${parsed.summary} (${parsed.steps.length} steps)`);
    parsed.steps.forEach((s) =>
      console.log(`  Step ${s.stepNumber}: [${s.domain}] ${s.task} (depends: ${s.dependsOn.join(",") || "none"})`)
    );

    return parsed;
  } catch (parseErr) {
    console.error("[ORCHESTRATOR] JSON parse error:", parseErr);
    return {
      summary: "Executing as single task",
      steps: [{ stepNumber: 1, domain: "GENERAL", task: userMessage, dependsOn: [] }],
    };
  }
}

// ── Step Execution ──

/**
 * Execute a single step in the orchestration plan.
 * Uses the domain's filtered tools and the provided toolExecutor callback.
 */
async function executeStep(
  step: OrchestratorStep,
  priorResults: StepResult[],
  baseSystemPrompt: string,
  masterTools: any[],
  toolExecutor: ToolExecutor,
  groqClient: Groq,
  groqModel: string,
  onEvent?: AgentEventEmitter
): Promise<StepResult> {
  const domainTools = filterToolsForDomain(masterTools, step.domain);
  const domainPrompt = getDomainPrompt(step.domain);

  // Build context from prior step results that this step depends on
  let priorContext = "";
  if (step.dependsOn.length > 0) {
    const relevant = priorResults.filter((r) => step.dependsOn.includes(r.stepNumber));
    priorContext = relevant
      .map((r) => `[Result from step ${r.stepNumber} (${r.domain})]: ${r.result}`)
      .join("\n");
  }

  // Construct step-specific messages
  const stepSystemPrompt = [
    baseSystemPrompt,
    domainPrompt,
    `\n\nYou are executing step ${step.stepNumber} of a multi-step plan. Focus ONLY on this specific task. Be concise in your response — state what you did and what the result was.`,
    priorContext ? `\n\nContext from prior steps:\n${priorContext}` : "",
  ].join("");

  const stepMessages: any[] = [
    { role: "system", content: stepSystemPrompt },
    { role: "user", content: step.task },
  ];

  const toolsExecuted: string[] = [];
  let finalResult = "";
  let loopCount = 0;
  const MAX_STEP_LOOPS = 3;

  let hadToolFailure = false;

  while (loopCount < MAX_STEP_LOOPS) {
    loopCount++;

    const completion = await groqClient.chat.completions.create({
      model: groqModel,
      messages: stepMessages,
      temperature: 0.3,
      max_tokens: 2048,
      ...(domainTools.length > 0 ? { tools: domainTools, tool_choice: "auto" } : {}),
    });

    const msg = completion.choices[0]?.message;
    if (!msg) break;

    // Add assistant message to step context
    stepMessages.push(msg);

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // Execute each tool call via the provided callback
      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name;
        let toolArgs: Record<string, unknown> = {};
        try {
          toolArgs = JSON.parse(tc.function.arguments || "{}");
        } catch {
          toolArgs = {};
        }

        console.log(`[ORCHESTRATOR] Step ${step.stepNumber} tool call: ${toolName}`);
        toolsExecuted.push(toolName);
        await onEvent?.({ type: 'tool_call', step: step.stepNumber, tool: toolName, timestamp: Date.now() });

        let toolResult: string;
        try {
          toolResult = await toolExecutor(toolName, toolArgs);
          // Check if tool returned an error result
          if (toolResult.includes('"error"')) hadToolFailure = true;
        } catch (execErr: any) {
          toolResult = JSON.stringify({ error: execErr?.message || "Tool execution failed" });
          hadToolFailure = true;
        }

        stepMessages.push({
          tool_call_id: tc.id,
          role: "tool",
          name: toolName,
          content: toolResult,
        });
      }
      // Continue loop — the model will process tool results and may call more tools or produce final text
    } else {
      // No tool calls — model produced a text response
      finalResult = msg.content || "";
      break;
    }
  }

  // If we exhausted the loop without a text response, get one
  if (!finalResult && loopCount >= MAX_STEP_LOOPS) {
    const lastMsg = stepMessages[stepMessages.length - 1];
    if (lastMsg?.content) {
      finalResult = lastMsg.content;
    } else {
      // Force a synthesis
      stepMessages.push({ role: "user", content: "Summarize what was accomplished in this step." });
      const synthCompletion = await groqClient.chat.completions.create({
        model: groqModel,
        messages: stepMessages,
        temperature: 0.3,
        max_tokens: 512,
      });
      finalResult = synthCompletion.choices[0]?.message?.content || "Step completed.";
    }
  }

  return {
    stepNumber: step.stepNumber,
    domain: step.domain,
    task: step.task,
    result: finalResult,
    toolsExecuted,
    success: !hadToolFailure,
  };
}

// ── Main Orchestration ──

/**
 * Orchestrate a multi-step task.
 * 
 * Called by chat/route.ts when the router classifies the request as MULTI.
 * 
 * @param userMessage - The original user request
 * @param baseSystemPrompt - The full system prompt (role + knowledge + CRM context)
 * @param masterTools - The complete tools array from chat/route.ts
 * @param toolExecutor - Callback that executes a tool by name (wraps the route's switch statement)
 * @param groqModel - The model to use for step execution (e.g., 'llama-3.3-70b-versatile')
 * @param conversationContext - Optional recent conversation context for the planner
 * @returns OrchestratorResult with plan, step results, and final synthesized response
 */
export async function orchestrateMultiStep(
  userMessage: string,
  baseSystemPrompt: string,
  masterTools: any[],
  toolExecutor: ToolExecutor,
  groqModel: string = "llama-3.3-70b-versatile",
  conversationContext?: string,
  onEvent?: AgentEventEmitter
): Promise<OrchestratorResult> {
  const t0 = Date.now();
  console.log(`[ORCHESTRATOR] Starting multi-step orchestration for: "${userMessage.substring(0, 100)}..."`);

  // Validate GROQ_API_KEY early
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set — orchestrator cannot function");
  }

  // Ensure we use a Groq-compatible model (non-Groq models like Claude/GPT crash the SDK)
  const safeModel = ensureGroqModel(groqModel);
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // 1. Decompose into a plan
  let plan: OrchestratorPlan;
  try {
    plan = await decomposePlan(userMessage, groq, safeModel, conversationContext);
  } catch (planErr) {
    console.error("[ORCHESTRATOR] Planning failed:", planErr);
    plan = {
      summary: "Executing as single task (planning failed)",
      steps: [{ stepNumber: 1, domain: "GENERAL", task: userMessage, dependsOn: [] }],
    };
  }

  await onEvent?.({ type: 'plan', summary: plan.summary, steps: plan.steps.map(s => ({ step: s.stepNumber, domain: s.domain, task: s.task })), timestamp: Date.now() });

  // 2. Execute steps sequentially
  const stepResults: StepResult[] = [];

  // Track which step numbers failed (for dependency skipping)
  const failedSteps = new Set<number>();

  for (const step of plan.steps) {
    // Skip steps whose dependencies failed — they'd get garbage context
    const hasBrokenDependency = step.dependsOn.some((depNum) => failedSteps.has(depNum));
    if (hasBrokenDependency) {
      console.log(`[ORCHESTRATOR] Skipping step ${step.stepNumber} — dependency failed (depends on: ${step.dependsOn.join(", ")})`);
      stepResults.push({
        stepNumber: step.stepNumber,
        domain: step.domain,
        task: step.task,
        result: `Skipped: dependency step(s) ${step.dependsOn.filter((d) => failedSteps.has(d)).join(", ")} failed`,
        toolsExecuted: [],
        success: false,
      });
      failedSteps.add(step.stepNumber);
      continue;
    }

    console.log(`[ORCHESTRATOR] Executing step ${step.stepNumber}/${plan.steps.length}: [${step.domain}] ${step.task}`);
    const stepT0 = Date.now();
    await onEvent?.({ type: 'step_start', step: step.stepNumber, domain: step.domain, task: step.task, timestamp: Date.now() });

    try {
      const result = await executeStep(
        step,
        stepResults,
        baseSystemPrompt,
        masterTools,
        toolExecutor,
        groq,
        safeModel,
        onEvent
      );
      stepResults.push(result);
      if (!result.success) failedSteps.add(step.stepNumber);
      console.log(
        `[ORCHESTRATOR] Step ${step.stepNumber} completed in ${Date.now() - stepT0}ms | ` +
        `Tools: ${result.toolsExecuted.join(", ") || "none"} | ` +
        `Result: ${result.result.substring(0, 150)}...`
      );
      await onEvent?.({ type: 'step_complete', step: step.stepNumber, result: result.result.substring(0, 200), success: result.success, toolsUsed: result.toolsExecuted, durationMs: Date.now() - stepT0, timestamp: Date.now() });
    } catch (stepErr: any) {
      console.error(`[ORCHESTRATOR] Step ${step.stepNumber} failed:`, stepErr?.message);
      stepResults.push({
        stepNumber: step.stepNumber,
        domain: step.domain,
        task: step.task,
        result: `Error: ${stepErr?.message || "Step execution failed"}`,
        toolsExecuted: [],
        success: false,
      });
      await onEvent?.({ type: 'step_complete', step: step.stepNumber, result: `Error: ${stepErr?.message || "Step execution failed"}`, success: false, toolsUsed: [], durationMs: Date.now() - stepT0, timestamp: Date.now() });
      // Continue to next step — some steps may not depend on the failed one
    }
  }

  // 3. Synthesize final response
  let finalResponse: string;
  try {
    const stepSummaries = stepResults
      .map(
        (r) =>
          `Step ${r.stepNumber} [${r.domain}]: ${r.task}\n` +
          `→ ${r.success ? "✅" : "❌"} ${r.result}\n` +
          `   Tools used: ${r.toolsExecuted.join(", ") || "none"}`
      )
      .join("\n\n");

    const synthesisResponse = await groq.chat.completions.create({
      model: safeModel,
      messages: [
        {
          role: "system",
          content:
            "You are Jarvis, a helpful AI assistant. Summarize the results of a completed multi-step task. " +
            "Be conversational, warm, and concise. Use **bold** for key details. " +
            "Don't list step numbers — speak naturally about what was accomplished. " +
            "If any step failed, mention it briefly and suggest next steps. " +
            "NEVER output JSON or code.",
        },
        {
          role: "user",
          content: `Original request: "${userMessage}"\n\nCompleted steps:\n${stepSummaries}`,
        },
      ],
      max_tokens: 1024,
      temperature: 0.5,
    });

    finalResponse =
      synthesisResponse.choices[0]?.message?.content ||
      stepResults.map((r) => `${r.task}: ${r.result}`).join("\n");
  } catch (synthErr) {
    console.error("[ORCHESTRATOR] Synthesis failed:", synthErr);
    // Fallback: concatenate step results
    finalResponse = stepResults
      .map((r) => `${r.success ? "✅" : "❌"} ${r.task}: ${r.result}`)
      .join("\n\n");
  }

  const totalTime = Date.now() - t0;
  console.log(
    `[ORCHESTRATOR] Orchestration complete in ${totalTime}ms | ` +
    `${plan.steps.length} steps | ` +
    `${stepResults.filter((r) => r.success).length}/${stepResults.length} succeeded`
  );

  return { plan, stepResults, finalResponse };
}
