import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";

/**
 * POST /api/grants/validate-eligibility
 *
 * Uses an LLM to semantically validate whether a grant opportunity
 * is actually eligible for the user's organization type.
 *
 * This prevents false positives from simple keyword matching — e.g.
 * a search for "501(c)(3) grants" returning grants that mention 501(c)(3)
 * but actually EXCLUDE those organizations.
 */

interface ValidateRequest {
  grantTitle: string;
  grantDescription: string;
  grantAgency?: string;
  companyDescription: string;
  welfareKeywords: string[];
  grantTypes: string[];
}

interface ValidationResult {
  eligible: boolean;
  confidence: number;
  eligibilityText: string;
  reasoning: string;
}

export async function POST(request: Request) {
  try {
    const body: ValidateRequest = await request.json();

    if (!body.grantTitle || !body.companyDescription) {
      return NextResponse.json(
        { eligible: true, confidence: 0, eligibilityText: "Unknown", reasoning: "Insufficient data to validate" },
        { status: 200 }
      );
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Build a clear description of what the user's organization is
    const orgTypeDescription = [
      body.companyDescription,
      body.welfareKeywords?.length > 0 ? `Organization filters: ${body.welfareKeywords.join(", ")}` : "",
      body.grantTypes?.length > 0 ? `Grant categories: ${body.grantTypes.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `You are a grant eligibility analyst. Your job is to determine if a specific grant opportunity is ELIGIBLE for a particular organization.

ORGANIZATION PROFILE:
${orgTypeDescription}

GRANT OPPORTUNITY:
Title: ${body.grantTitle}
Description: ${body.grantDescription}
Agency: ${body.grantAgency || "Unknown"}

ANALYSIS RULES:
1. If the organization describes itself as a nonprofit/501(c)(3) and the grant is specifically for nonprofits or 501(c)(3) organizations, return eligible=true
2. If the grant explicitly states it does NOT accept the organization's type (e.g., "does not accept 501(c)(3)" when org is a nonprofit), return eligible=false
3. If the grant is only for for-profit companies, government agencies, or educational institutions and the organization is none of those, return eligible=false  
4. If the grant's subject matter is completely unrelated to the organization's mission/keywords, return eligible=false with lower confidence
5. If the eligibility is unclear or the grant could potentially be applicable, return eligible=true with moderate confidence (50-70)
6. Focus on ELIGIBILITY (who can apply), not just topic relevance

You MUST respond with ONLY valid JSON in this exact format, nothing else:
{"eligible": true, "confidence": 85, "eligibility": "Nonprofits with 501(c)(3) status, state governments, tribal organizations", "reasoning": "The grant explicitly lists 501(c)(3) nonprofits as eligible applicants and the organization's mission aligns with the grant's focus area."}`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a precise JSON-only responder. Output ONLY valid JSON with no markdown, no explanation, no code blocks." },
        { role: "user", content: prompt }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 512,
    });

    const rawResponse = completion.choices[0]?.message?.content || "";
    console.log(`[GrantValidation] Raw LLM response: ${rawResponse.substring(0, 300)}`);

    // Parse the JSON response
    let result: ValidationResult;
    try {
      // Try to extract JSON from the response (handle cases where LLM wraps in markdown)
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawResponse;
      const parsed = JSON.parse(jsonStr);
      result = {
        eligible: Boolean(parsed.eligible),
        confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
        eligibilityText: String(parsed.eligibility || "Unknown"),
        reasoning: String(parsed.reasoning || parsed.reason || "No reasoning provided"),
      };
    } catch (parseErr) {
      console.error("[GrantValidation] Failed to parse LLM response:", parseErr);
      // Fail open — if we can't parse, assume eligible with low confidence
      result = {
        eligible: true,
        confidence: 30,
        eligibilityText: "Unable to determine",
        reasoning: "AI validation response could not be parsed — grant passed with low confidence",
      };
    }

    console.log(`[GrantValidation] Result: eligible=${result.eligible} confidence=${result.confidence} for "${body.grantTitle.substring(0, 60)}"`);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[GrantValidation] Route error:", err);
    // Fail open on error — don't block grants due to validation failures
    return NextResponse.json({
      eligible: true,
      confidence: 0,
      eligibilityText: "Validation unavailable",
      reasoning: `Validation error: ${err.message}`,
    });
  }
}
