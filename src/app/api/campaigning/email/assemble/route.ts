import { Groq } from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { SKELETON_REGISTRY, renderSkeleton } from "@/lib/email-skeletons";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

interface BrandSettings {
  primaryColor?: string;
  logoUrl?: string;
  senderName: string;
  orgName: string;
  phoneNumber?: string;
  email?: string;
  website?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AssembleRequest {
  action: "generate" | "iterate" | "chat";
  // For 'generate'
  skeletonId?: string;
  prompt: string;
  images: string[];
  subject?: string;
  brandSettings: BrandSettings;
  knowledgeBaseText?: string;
  pactText?: string;
  // For 'iterate'
  currentHtml?: string;
  currentSlotData?: Record<string, any>;
  currentSkeletonId?: string;
  editInstruction?: string;
  // For 'chat'
  conversationHistory?: ChatMessage[];
  hasEmailPreview?: boolean;
}

/**
 * Builds the skeleton catalog string for the AI system prompt.
 */
function buildSkeletonCatalog(): string {
  if (SKELETON_REGISTRY.length === 0) return "No skeletons available.";

  return SKELETON_REGISTRY
    .map((skeleton) => {
      const requiredSlots = skeleton.slots.map((s) => `    - "${s}" (required)`).join("\n");
      const optionalSlots = skeleton.optionalSlots.map((s) => `    - "${s}" (optional)`).join("\n");

      return `  Skeleton ID: "${skeleton.id}"\n  Name: ${skeleton.name}\n  Description: ${skeleton.description}\n  Required Slots:\n${requiredSlots}\n  Optional Slots:\n${optionalSlots}`;
    })
    .join("\n\n");
}

/**
 * Builds the conversational system prompt for the 'chat' action.
 * This is the main Jarvis prompt — handles brainstorming, generation, and iteration.
 */
function buildChatSystemPrompt(
  brand: BrandSettings,
  images: string[],
  hasEmailPreview: boolean,
  currentSkeletonId?: string,
  currentSlotData?: Record<string, any>,
): string {
  const catalog = buildSkeletonCatalog();

  return `You are Jarvis, an expert email strategist, copywriter, and designer working inside the SOL Theory platform. You help users craft professional marketing and outreach emails.

## YOUR PERSONALITY
- You are warm, sharp, and confident — like a senior creative director who genuinely cares about helping.
- You give strategic advice: audience targeting, tone, subject line optimization, CTA placement, timing.
- You are conversational and collaborative. You ask follow-up questions when the user is vague.
- You NEVER send emails yourself. You only help design them. Sending happens in a later step.

## INTENT DETECTION — THIS IS CRITICAL
Every response you give MUST be wrapped in a JSON object with an "intent" field. You must determine the user's intent:

### intent: "chat"
Use when the user is:
- Asking a question ("how should I...", "what do you think...", "can you help me...", "what tone...")
- Brainstorming ("give me ideas", "what are some options", "help me figure out")
- Discussing strategy ("I'm emailing 500 CEOs...", "my audience is...", "should I be formal or casual")
- Requesting copy options without wanting a full render ("write me 3 subject lines", "draft some headline ideas")
- Just chatting or giving you context about themselves or their campaign
- Saying something that doesn't clearly ask for an email to be built

### intent: "render"
Use when the user clearly wants you to BUILD or CREATE a new email:
- "Generate me an email about...", "Create an email for...", "Build it", "Make me an email", "Write the email", "Let's do it", "OK go ahead and build that", "Use the hero template and..."
- The user has been brainstorming and now says something like "OK that sounds good, let's build it" or "go ahead"

### intent: "iterate"
Use when ${hasEmailPreview ? "an email already exists in the preview AND" : ""} the user wants to MODIFY the existing email:
- "Change the headline to...", "Make the button blue", "Try a different image", "Shorten the body text"
- "Can you make it more formal", "Add a PS section", "Update the CTA"
${!hasEmailPreview ? "NOTE: No email has been rendered yet, so 'iterate' is not possible. If the user asks to change something, tell them to generate an email first." : ""}

**WHEN IN DOUBT, USE "chat". Never render unless the user clearly wants it.**

## RESPONSE FORMAT
You MUST respond with ONLY a valid JSON object. No markdown fences, no extra text outside the JSON.

For "chat" intent:
{
  "intent": "chat",
  "message": "Your conversational response here. You can use markdown formatting (bold, bullet points, etc.)."
}

For "render" intent:
{
  "intent": "render",
  "message": "A brief message about what you built, e.g., 'Here\\'s a polished email using the Hero CTA template! Take a look at the preview.'",
  "email": {
    "skeletonId": "<chosen skeleton ID from the catalog>",
    "subject": "<email subject line>",
    "slotData": {
      "<slotName>": "<value>",
      ...
    }
  }
}

For "iterate" intent:
{
  "intent": "iterate",
  "message": "A brief message about what you changed.",
  "email": {
    "skeletonId": "${currentSkeletonId || "<current skeleton ID>"}",
    "subject": "<updated subject line>",
    "slotData": {
      "<slotName>": "<value>",
      ...
    }
  }
}

## AVAILABLE EMAIL SKELETONS
${catalog}

## USER BRAND SETTINGS
- Sender Name: ${brand.senderName}
- Organization: ${brand.orgName}
${brand.primaryColor ? `- Brand Color: ${brand.primaryColor}` : ""}
${brand.logoUrl ? `- Logo URL: ${brand.logoUrl}` : ""}
${brand.phoneNumber ? `- Phone: ${brand.phoneNumber}` : ""}
${brand.email ? `- Email: ${brand.email}` : ""}
${brand.website ? `- Website: ${brand.website}` : ""}

## AVAILABLE IMAGES
${images.length > 0 ? images.map((url, i) => `  Image ${i + 1}: ${url}`).join("\n") : "No images uploaded yet."}

${currentSlotData && currentSkeletonId ? `## CURRENT EMAIL STATE
An email is currently rendered in the preview using skeleton "${currentSkeletonId}".
Current slot data:
${JSON.stringify(currentSlotData, null, 2)}` : "## CURRENT EMAIL STATE\nNo email has been rendered yet."}

## RULES FOR RENDERING
- When rendering, pick the best skeleton for the user's needs (or use the one they specify).
- Fill ALL required slots. Use the brand settings for sender info.
- If images are uploaded, assign them to the appropriate image slots (heroImage, etc.).
- Generate a compelling subject line.
- Use merge fields like {{first_name}}, {{org_name}} where appropriate for personalization.`;
}

/**
 * Builds the system prompt for the legacy 'generate' action.
 */
function buildGenerateSystemPrompt(brand: BrandSettings, images: string[]): string {
  const catalog = buildSkeletonCatalog();

  return `You are an expert email designer AI. Your job is to compose professional marketing emails.

## Available Email Skeletons
${catalog}

## User Brand Settings
- Sender Name: ${brand.senderName}
- Organization: ${brand.orgName}
${brand.primaryColor ? `- Brand Color: ${brand.primaryColor}` : ""}
${brand.logoUrl ? `- Logo URL: ${brand.logoUrl}` : ""}
${brand.phoneNumber ? `- Phone: ${brand.phoneNumber}` : ""}
${brand.email ? `- Email: ${brand.email}` : ""}
${brand.website ? `- Website: ${brand.website}` : ""}

## Available Images
${images.length > 0 ? images.map((url, i) => `  Image ${i + 1}: ${url}`).join("\n") : "No images provided."}

## Instructions
1. Pick the single best skeleton from the catalog above that fits the user's request (or use the skeleton ID they specify if given).
2. Generate the slot data (headlines, body text, button text, image URLs, etc.) to fill every slot in the chosen skeleton.
3. Also generate a compelling email subject line.
4. Use the brand settings to personalize the content.
5. If images are provided, assign them to appropriate image slots.

## Output Format
You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no extra text.
The JSON must have this exact structure:
{
  "skeletonId": "<chosen skeleton ID>",
  "subject": "<email subject line>",
  "slotData": {
    "<slotName>": "<value>",
    ...
  }
}`;
}

/**
 * Builds the system prompt for the legacy 'iterate' action.
 */
function buildIterateSystemPrompt(): string {
  return `You are an expert email designer AI. The user wants to modify an existing email.

You will receive:
- The current skeleton ID being used
- The current slot data (JSON)
- The user's edit instruction

## Instructions
1. Modify the slot data according to the user's instruction.
2. You may also update the subject line if the edit warrants it.
3. Do NOT change the skeleton ID unless the user explicitly asks for a different layout.

## Output Format
You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no extra text.
The JSON must have this exact structure:
{
  "skeletonId": "<skeleton ID (same as current unless user asks to change)>",
  "subject": "<updated email subject line>",
  "slotData": {
    "<slotName>": "<value>",
    ...
  }
}`;
}

/**
 * Attempts to parse an AI response as JSON, stripping any accidental markdown fences.
 */
function parseAIResponse(raw: string): { skeletonId: string; subject: string; slotData: Record<string, any> } {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);

    if (!parsed.skeletonId || !parsed.slotData || typeof parsed.slotData !== "object") {
      throw new Error("AI response missing required fields: skeletonId, slotData");
    }

    return {
      skeletonId: parsed.skeletonId,
      subject: parsed.subject || "No Subject",
      slotData: parsed.slotData,
    };
  } catch (err: any) {
    throw new Error(`Failed to parse AI response as JSON: ${err.message}\n\nRaw response:\n${raw.slice(0, 500)}`);
  }
}

/**
 * Parses the Jarvis chat response — expects a wrapper JSON with intent + message + optional email.
 */
function parseChatResponse(raw: string): {
  intent: "chat" | "render" | "iterate";
  message: string;
  email?: { skeletonId: string; subject: string; slotData: Record<string, any> };
} {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);

    if (!parsed.intent || !parsed.message) {
      throw new Error("Missing 'intent' or 'message' in AI response");
    }

    const validIntents = ["chat", "render", "iterate"];
    if (!validIntents.includes(parsed.intent)) {
      // Default to chat if the intent is unrecognized
      parsed.intent = "chat";
    }

    return {
      intent: parsed.intent,
      message: parsed.message,
      email: parsed.email || undefined,
    };
  } catch (err: any) {
    // If JSON parsing fails entirely, treat the raw text as a chat response
    // This handles cases where the AI forgets the JSON wrapper
    return {
      intent: "chat",
      message: raw.trim() || "I'm sorry, I had trouble processing that. Could you try again?",
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    // Auth check — same pattern as other campaign API routes
    const uid = req.headers.get("x-uid");
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized: missing x-uid header" }, { status: 401 });
    }

    const body = (await req.json()) as AssembleRequest;
    const { action } = body;

    if (!action || !["generate", "iterate", "chat"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be 'generate', 'iterate', or 'chat'." }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════════
    //  NEW: Conversational chat action (Jarvis)
    // ═══════════════════════════════════════════════════════════════
    if (action === "chat") {
      if (!body.brandSettings) {
        return NextResponse.json({ error: "Missing 'brandSettings' for chat action." }, { status: 400 });
      }

      const systemPrompt = buildChatSystemPrompt(
        body.brandSettings,
        body.images || [],
        body.hasEmailPreview || false,
        body.currentSkeletonId || undefined,
        body.currentSlotData || undefined,
      );

      // Inject knowledge base and PACT context
      let enrichedSystemPrompt = systemPrompt;
      const kbText = (body.knowledgeBaseText || "").slice(0, 20000);
      const pactText = (body.pactText || "").slice(0, 5000);
      if (kbText) enrichedSystemPrompt += `\n\nContext about the user and their business:\n${kbText}`;
      if (pactText) enrichedSystemPrompt += `\n\nKnown facts about the user:\n${pactText}`;

      // Build messages array: system prompt + full conversation history
      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: enrichedSystemPrompt },
      ];

      // Add conversation history (capped at last 20 messages to stay within context limits)
      const history = (body.conversationHistory || []).slice(-20);
      for (const msg of history) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }

      // Add the current user message if it's not already in the history
      // (The frontend adds it to history before sending, so we just use history as-is)

      const completion = await groq.chat.completions.create({
        messages,
        model: MODEL,
        temperature: 0.7,
        max_tokens: 2048,
      });

      const rawResponse = completion.choices[0]?.message?.content || "";
      const chatResult = parseChatResponse(rawResponse);

      // If the AI wants to render/iterate, actually build the HTML
      if ((chatResult.intent === "render" || chatResult.intent === "iterate") && chatResult.email) {
        const { skeletonId, subject, slotData } = chatResult.email;

        // Validate skeleton exists
        const matchedSkeleton = SKELETON_REGISTRY.find((s) => s.id === skeletonId);
        if (!matchedSkeleton) {
          return NextResponse.json({
            intent: "chat",
            message: chatResult.message + `\n\n⚠️ I tried to use template "${skeletonId}" but it doesn't exist. Let me try again with a valid template.`,
          });
        }

        const html = renderSkeleton(skeletonId, slotData);

        return NextResponse.json({
          intent: chatResult.intent,
          message: chatResult.message,
          html,
          subject,
          skeletonUsed: skeletonId,
          slotData,
        });
      }

      // Pure chat response — no email rendering
      return NextResponse.json({
        intent: "chat",
        message: chatResult.message,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    //  Legacy: generate / iterate actions (kept for backwards compat)
    // ═══════════════════════════════════════════════════════════════
    let systemPrompt: string;
    let userPrompt: string;

    if (action === "generate") {
      if (!body.prompt) {
        return NextResponse.json({ error: "Missing 'prompt' for generate action." }, { status: 400 });
      }
      if (!body.brandSettings) {
        return NextResponse.json({ error: "Missing 'brandSettings' for generate action." }, { status: 400 });
      }

      systemPrompt = buildGenerateSystemPrompt(body.brandSettings, body.images || []);

      // Inject knowledge base and PACT context
      const kbText = (body.knowledgeBaseText || "").slice(0, 20000);
      const pactText = (body.pactText || "").slice(0, 5000);
      if (kbText) systemPrompt += `\n\nContext about the user and their business:\n${kbText}`;
      if (pactText) systemPrompt += `\n\nKnown facts about the user:\n${pactText}`;

      userPrompt = body.prompt;
      if (body.skeletonId) {
        userPrompt += `\n\nIMPORTANT: Use the skeleton with ID "${body.skeletonId}".`;
      }
      if (body.subject) {
        userPrompt += `\n\nPreferred subject line: "${body.subject}"`;
      }
    } else {
      // action === 'iterate'
      if (!body.currentSkeletonId || !body.currentSlotData) {
        return NextResponse.json(
          { error: "Missing 'currentSkeletonId' or 'currentSlotData' for iterate action." },
          { status: 400 }
        );
      }
      if (!body.editInstruction) {
        return NextResponse.json({ error: "Missing 'editInstruction' for iterate action." }, { status: 400 });
      }

      systemPrompt = buildIterateSystemPrompt();

      userPrompt = `Current Skeleton ID: "${body.currentSkeletonId}"

Current Slot Data:
${JSON.stringify(body.currentSlotData, null, 2)}

Edit Instruction: ${body.editInstruction}`;
    }

    // Call Groq
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: MODEL,
      temperature: 0.7,
      max_tokens: 2048,
    });

    const rawResponse = completion.choices[0]?.message?.content || "";

    // Parse AI response as JSON
    const { skeletonId, subject, slotData } = parseAIResponse(rawResponse);

    // Validate skeleton exists
    const matchedSkeleton = SKELETON_REGISTRY.find((s) => s.id === skeletonId);
    if (!matchedSkeleton) {
      return NextResponse.json(
        { error: `AI selected unknown skeleton "${skeletonId}". Available: ${SKELETON_REGISTRY.map((s) => s.id).join(", ")}` },
        { status: 422 }
      );
    }

    // Render the skeleton with slot data
    const html = renderSkeleton(skeletonId, slotData);

    return NextResponse.json({
      status: "success",
      html,
      subject,
      skeletonUsed: skeletonId,
      slotData,
    });
  } catch (error: any) {
    console.error("Email Assemble Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
