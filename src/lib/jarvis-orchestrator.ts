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
import { createCompletion } from "./llm-router";
import { filterToolsForDomain, getDomainPrompt } from "./jarvis-agents";
import type { JarvisDomain } from "./jarvis-router";
import type { AgentEventEmitter } from "@/lib/agent-events";

// ── Types ──

export interface OrchestratorStep {
  stepNumber: number;
  domain: JarvisDomain;
  task: string;
  dependsOn: number[];
  complexity?: 'simple' | 'creative';
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
  toolsWithArgs: { name: string; args: any }[];
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

// Models that the Groq SDK can execute (used for planner + mechanical steps)
const GROQ_COMPATIBLE_MODELS = new Set([
  "openai/gpt-oss-120b",
  "qwen/qwen3.6-27b",
]);

/** Ensure the model is Groq-compatible for the planner step only. */
function ensureGroqModel(model: string): string {
  if (GROQ_COMPATIBLE_MODELS.has(model)) return model;
  return "openai/gpt-oss-120b";
}

// Domains that require creative intelligence → use the user's premium model
const PREMIUM_DOMAINS = new Set(["WORKSPACE", "EMAIL"]);
// Domains that are mechanical lookups → always use fast cheap Groq
const FAST_DOMAINS = new Set(["CRM", "CALENDAR", "GENERAL"]);

/** Pick the right model for a step based on its complexity: premium model for creative work, fast Groq for simple tasks. */
function pickModelForStep(step: OrchestratorStep, userSelectedModel: string): string {
  if (step.complexity === "simple") {
    // Mechanical steps — use fast Groq to save cost
    return "openai/gpt-oss-120b";
  }
  // Creative/content steps — use the user's selected premium model
  return userSelectedModel;
}

// ── Plan Decomposition ──

const PLANNER_PROMPT = `You are a task planner for an AI assistant. Decompose the user's request into sequential sub-tasks.

Available domains and their capabilities:
- EMAIL: Search emails, draft/send emails, delete emails, block senders, create folders
- CALENDAR: List/create/update/delete calendar events, check availability, create Google Meet links
- CRM: Create/update/delete/search contacts, analytics, batch updates, evaluate contacts, resolve names to emails/phones
- WORKSPACE: Create Google Docs/Slides/Sheets, search Drive, draft YouTube videos, create surveys
- GENERAL: Web search, recall past conversations

Rules:
1. Each step must specify exactly ONE domain
2. Order steps by dependency — if step 2 needs data from step 1, list step 1 first
3. Keep steps atomic — one logical action per step
4. Use the "dependsOn" array to indicate which prior steps feed data into this step
5. Maximum 6 steps total
6. If a step needs to look up a contact's email/phone before emailing/texting, add a CRM step first
7. For each step, output a "complexity" field with value "simple" or "creative":
   - "simple": Lookups, searches, creating empty resources, scheduling, sending brief messages
   - "creative": Writing essays, drafting professional emails, creating detailed content, analysis, research synthesis
8. For document creation tasks: ALWAYS gather/research content BEFORE creating the document. Then use create_google_document with the FULL body content in a single step, OR create the doc first (simple) then update it with update_google_document (creative) in a later step. NEVER create a document with placeholder content.
9. When the user asks about "JARVIS" or "who are you", they are asking about THIS AI assistant — do NOT search the web for "JARVIS". Use search_past_conversations or internal knowledge instead.

Respond with ONLY valid JSON (no markdown, no explanation):
{"summary": "Brief plan description", "steps": [{"stepNumber": 1, "domain": "CRM", "task": "Search for...", "dependsOn": [], "complexity": "simple"}, {"stepNumber": 2, "domain": "EMAIL", "task": "Draft email to...", "dependsOn": [1], "complexity": "creative"}]}`;

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
    const validDomains: JarvisDomain[] = ["EMAIL", "CALENDAR", "CRM", "WORKSPACE", "GENERAL"];
    for (let i = 0; i < parsed.steps.length; i++) {
      const step = parsed.steps[i];
      // Ensure required fields exist
      if (!step.task || typeof step.task !== "string") step.task = userMessage;
      if (!step.stepNumber || typeof step.stepNumber !== "number") step.stepNumber = i + 1;
      if (!Array.isArray(step.dependsOn)) step.dependsOn = [];
      if (!validDomains.includes(step.domain)) step.domain = "GENERAL";
      if (step.complexity !== "creative") step.complexity = "simple";
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
  selectedModel: string,
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
  const toolsWithArgs: { name: string; args: any }[] = [];
  let finalResult = "";
  let loopCount = 0;
  const MAX_STEP_LOOPS = 3;

  let hadToolFailure = false;

  while (loopCount < MAX_STEP_LOOPS) {
    loopCount++;

    // Use unified llm-router so the user's selected model (including OpenRouter) is respected
    const completion = await createCompletion({
      messages: stepMessages,
      model: selectedModel,
      temperature: 0.3,
      maxTokens: 8192, // Large to prevent truncating tool call JSON (doc/slide bodies can be 3000+ tokens)
      ...(domainTools.length > 0 ? { tools: domainTools, toolChoice: "auto" } : {}),
    });

    const msg = {
      role: 'assistant' as const,
      content: completion.content,
      tool_calls: completion.toolCalls,
    };
    if (!completion.content && !completion.toolCalls) break;

    // Add assistant message to step context
    stepMessages.push(msg);

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // Execute each tool call via the provided callback
      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name;
        let toolArgs: Record<string, unknown> = {};
        try {
          toolArgs = JSON.parse(tc.function.arguments || "{}");
        } catch (parseErr) {
          console.error(`[ORCHESTRATOR] Failed to parse tool args for ${toolName}:`, tc.function.arguments?.substring(0, 500));
          // Try to salvage by fixing common JSON issues (truncated strings, trailing commas)
          try {
            let fixedArgs = (tc.function.arguments || "{}").trim();
            // If truncated mid-string, try to close it
            if (!fixedArgs.endsWith('}')) {
              fixedArgs = fixedArgs.replace(/,?\s*"[^"]*$/, '') + '}';
            }
            // Remove trailing commas before closing braces
            fixedArgs = fixedArgs.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            toolArgs = JSON.parse(fixedArgs);
            console.log(`[ORCHESTRATOR] Salvaged tool args after JSON fix for ${toolName}`);
          } catch {
            toolArgs = {};
            console.error(`[ORCHESTRATOR] Could not salvage tool args — using empty args`);
          }
        }

        console.log(`[ORCHESTRATOR] Step ${step.stepNumber} tool call: ${toolName}`);
        toolsExecuted.push(toolName);
        toolsWithArgs.push({ name: toolName, args: toolArgs });
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
      // Force a synthesis using the selected model
      stepMessages.push({ role: "user", content: "Summarize what was accomplished in this step." });
      const synthResult = await createCompletion({
        messages: stepMessages,
        model: selectedModel,
        temperature: 0.3,
        maxTokens: 512,
      });
      finalResult = synthResult.content || "Step completed.";
    }
  }

  return {
    stepNumber: step.stepNumber,
    domain: step.domain,
    task: step.task,
    result: finalResult,
    toolsExecuted,
    toolsWithArgs,
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
 * @param groqModel - The model to use for step execution (e.g., 'openai/gpt-oss-120b')
 * @param conversationContext - Optional recent conversation context for the planner
 * @returns OrchestratorResult with plan, step results, and final synthesized response
 */
export async function orchestrateMultiStep(
  userMessage: string,
  baseSystemPrompt: string,
  masterTools: any[],
  toolExecutor: ToolExecutor,
  groqModel: string = "openai/gpt-oss-120b",
  conversationContext?: string,
  onEvent?: AgentEventEmitter
): Promise<OrchestratorResult> {
  const t0 = Date.now();
  console.log(`[ORCHESTRATOR] Starting multi-step orchestration for: "${userMessage.substring(0, 100)}..."`);

  // Validate GROQ_API_KEY early
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set — orchestrator cannot function");
  }

  // Planner always uses fast Groq model for speed (planning is simple JSON generation)
  const plannerModel = ensureGroqModel(groqModel);
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  // Step execution uses the user's actual selected model via llm-router
  console.log(`[ORCHESTRATOR] Planner model: ${plannerModel} | Step execution model: ${groqModel}`);

  // 1. Decompose into a plan
  let plan: OrchestratorPlan;
  try {
    plan = await decomposePlan(userMessage, groq, plannerModel, conversationContext);
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
        toolsWithArgs: [],
        success: false,
      });
      failedSteps.add(step.stepNumber);
      continue;
    }

    console.log(`[ORCHESTRATOR] Executing step ${step.stepNumber}/${plan.steps.length}: [${step.domain}] ${step.task}`);
    const stepT0 = Date.now();
    
    // Smart model routing: premium model for creative work, fast Groq for mechanical tasks
    const stepModel = pickModelForStep(step, groqModel);
    const isPremiumStep = stepModel !== "openai/gpt-oss-120b";
    console.log(`[ORCHESTRATOR] Step ${step.stepNumber} model: ${stepModel} (${isPremiumStep ? 'PREMIUM' : 'FAST'})`);
    
    await onEvent?.({ type: 'step_start', step: step.stepNumber, domain: step.domain, task: step.task, timestamp: Date.now() });

    try {
      const result = await executeStep(
        step,
        stepResults,
        baseSystemPrompt,
        masterTools,
        toolExecutor,
        stepModel, // Smart model per step — not always the premium model
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
        toolsWithArgs: [],
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

    const synthesisResult = await createCompletion({
      messages: [
        {
          role: "system",
          content:
            `You are JARVIS. Summarize what you just accomplished for the user. Speak in first person — never say "Jarvis" when you mean "I." Be conversational, warm, and concise. Use **bold** for key details. Do not list step numbers — speak naturally about what was done. If any step failed, mention it briefly and suggest next steps. Include links to created documents/emails. NEVER output JSON or code.`,
        },
        {
          role: "user",
          content: `Original request: "${userMessage}"\n\nCompleted steps:\n${stepSummaries}`,
        },
      ],
      model: "openai/gpt-oss-120b", // Synthesis uses fast Groq to save cost
      temperature: 0.5,
      maxTokens: 2048,
    });

    finalResponse =
      synthesisResult.content ||
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
