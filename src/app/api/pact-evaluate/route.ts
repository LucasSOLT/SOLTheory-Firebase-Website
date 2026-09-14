import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";

/**
 * P.A.C.T. Review Memory Items — Gemini Flash Evaluation API
 *
 * Full-sweep evaluation: processes ALL active entries on every call.
 * Review history is injected into the prompt so the AI gets smarter each pass.
 * User-restored items are auto-kept server-side (never re-flagged).
 */

const SYSTEM_PROMPT = (userName: string) => `You are a ruthlessly strict memory quality evaluator. Your job is to decide which facts about "${userName}" are worth keeping in long-term memory.

REVIEW HISTORY CONTEXT:
Each entry may include a review history tag:
- [NEVER REVIEWED] — This is the first time seeing this entry. Evaluate with your default aggressive discard stance.
- [PREVIOUSLY KEPT: N times — "reason"] — A prior review kept this entry N times. Give it the benefit of the doubt. Only flag if it is CLEARLY redundant with another entry in this batch or OBJECTIVELY ephemeral (temporary state, AI command). The prior reason tells you why it was kept before.
- [USER PROTECTED] — The user manually restored this after it was flagged. Do NOT flag this entry. Always keep it.

DISCARD aggressively (especially for [NEVER REVIEWED] entries) if the fact is:
- A duplicate of another fact in the list (keep ONLY the single best entry, discard all duplicate variants with reason: "Duplicate entry")
- A contradiction with a newer/more specific fact (e.g. two conflicting names or locations — keep the newer one, discard the older one with reason: "Superceded by newer fact")
- About the conversation history or meta-interaction ("user told AI earlier", "user claims to have told the AI", "user is chatting with Jarvis")
- Weak inference from using a tool ("user uses SOL Theory AI assistant so user is affiliated with SOL Theory")
- About a momentary action ("user is sending an email", "user is checking inbox")
- A temporary emotional/physical state ("user is tired", "user is frustrated right now")
- A command or request to the AI ("user wants Jarvis to write…", "user asked the AI to…")
- About what tool or service the AI should use ("user expects AI to use Gmail")
- A yes/no answer with no real informational content ("user has a restaurant though name is not recorded")
- Something any person would obviously do ("user uses email", "user has had conversations")
- A fact that refers to "${userName}" as a third party when "${userName}" IS the user (e.g. "Who is ${userName} in relation to the user?" — this is the user themselves)

KEEP if the fact is:
- A core identity detail (full name, age, location, nationality, pronouns)
- A lasting preference (communication style, work habits, favorite tools, favorite restaurants)
- A meaningful relationship (specific people: spouse, boss, colleague BY NAME)
- A career/role detail (job title, company, industry, team)
- A concrete goal or project with specifics
- Contact information (email, phone, address)
- A personality trait or enduring interest

Respond with ONLY a JSON array. Each element:
{"index": <number>, "keep": <boolean>, "reason": "<3-8 words>"}

No markdown. No explanation. Just the raw JSON array.`;

export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { entries, userName } = await req.json();

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ decisions: [], model: "none", evaluatedCount: 0 });
    }

    // ── Auto-keep user-restored items server-side ──
    const autoKeptIndices = new Set<number>();
    entries.forEach((e: any, i: number) => {
      if (e.userRestored) autoKeptIndices.add(i);
    });

    // Filter out user-restored items from AI evaluation
    const entriesToEvaluate = entries.filter((_: any, i: number) => !autoKeptIndices.has(i));

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[PACT Evaluate] GEMINI_API_KEY not set");
      return NextResponse.json({
        decisions: entries.map((_: any, i: number) => ({ index: i, keep: true, reason: autoKeptIndices.has(i) ? "User protected" : "No API key — kept safely" })),
        model: "none",
        evaluatedCount: entries.length,
        error: "GEMINI_API_KEY not configured",
      });
    }

    const displayName = userName || "the user";
    const prompt = SYSTEM_PROMPT(displayName);

    // ── Build the entries list with review history context ──
    // Map the filtered entries back to their original indices
    const evalIndexMap: number[] = []; // evalIndexMap[evalIdx] = originalIdx
    let evalIdx = 0;
    entries.forEach((e: any, i: number) => {
      if (!autoKeptIndices.has(i)) {
        evalIndexMap[evalIdx] = i;
        evalIdx++;
      }
    });

    const entriesList = entriesToEvaluate
      .map((e: any, i: number) => {
        let historyTag = "[NEVER REVIEWED]";

        if (e.reviewCount && e.reviewCount > 0) {
          if (e.lastReviewResult === "kept") {
            historyTag = `[PREVIOUSLY KEPT: ${e.reviewCount} time${e.reviewCount > 1 ? "s" : ""} — "${e.lastReviewReason || "Deemed valuable"}"]`;
          } else if (e.lastReviewResult === "flagged") {
            // Flagged but not restored (still active) — user may have let the deletion expire and re-extracted
            historyTag = `[PREVIOUSLY FLAGGED — "${e.lastReviewReason || "Low value"}"]`;
          }
        }

        return `${i}. Q: ${e.question}\n   A: ${e.answer}\n   ${historyTag}`;
      })
      .join("\n\n");

    const userPrompt = `Evaluate these ${entriesToEvaluate.length} memory entries about "${displayName}". Remember: default to DISCARD for [NEVER REVIEWED] entries, but respect the review history for previously-reviewed entries.\n\n${entriesList}`;

    // ── Call Gemini Flash ──
    const models = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-latest"];
    let rawContent: string | null = null;
    let modelUsed = "unknown";

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: prompt + "\n\n" + userPrompt }] },
            ],
            generationConfig: {
              temperature: 0.05,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
            },
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.warn(`[PACT Evaluate] Gemini ${model} error ${res.status}:`, errBody.slice(0, 300));
          continue;
        }

        const data = await res.json();
        rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        modelUsed = model;

        if (rawContent) break;
      } catch (err: any) {
        console.warn(`[PACT Evaluate] Gemini ${model} exception:`, err?.message);
        continue;
      }
    }

    // ── Parse JSON decisions ──
    let aiDecisions: any[] = [];

    if (rawContent) {
      try {
        const cleaned = rawContent
          .replace(/```json\n?/gi, "")
          .replace(/```\n?/g, "")
          .trim();
        aiDecisions = JSON.parse(cleaned);
      } catch {
        try {
          const arrayMatch = rawContent.match(/\[[\s\S]*\]/);
          if (arrayMatch) {
            aiDecisions = JSON.parse(arrayMatch[0]);
          }
        } catch {
          console.error("[PACT Evaluate] All JSON parse attempts failed:", rawContent.substring(0, 500));
        }
      }
    }

    // ── Build final decisions array mapped back to original indices ──
    const aiDecisionsByEvalIndex = new Map(
      (Array.isArray(aiDecisions) ? aiDecisions : []).map((d: any) => [d.index, d])
    );

    const fullDecisions = entries.map((_: any, i: number) => {
      // User-restored items: always keep
      if (autoKeptIndices.has(i)) {
        return { index: i, keep: true, reason: "User protected" };
      }

      // Find this entry's eval index
      const evalI = evalIndexMap.indexOf(i);
      if (evalI === -1) {
        return { index: i, keep: true, reason: "No decision — kept safely" };
      }

      const aiDecision = aiDecisionsByEvalIndex.get(evalI);
      if (aiDecision && typeof aiDecision.keep === "boolean") {
        return { index: i, keep: aiDecision.keep, reason: aiDecision.reason || (aiDecision.keep ? "Deemed valuable" : "Low value") };
      }

      return { index: i, keep: true, reason: "No AI decision — kept safely" };
    });

    return NextResponse.json({
      decisions: fullDecisions,
      model: modelUsed,
      evaluatedCount: entries.length,
    });
  } catch (error: any) {
    console.error("[PACT Evaluate Error]", error?.message);
    return NextResponse.json(
      { decisions: [], error: error?.message, model: "error" },
      { status: 200 }
    );
  }
}
