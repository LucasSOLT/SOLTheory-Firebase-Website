import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { logAIUsage, calculateGroqCost } from "@/lib/log-ai-usage";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface EmailContext {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  read?: boolean;
}

interface RequestBody {
  messages: ChatMessage[];
  uid: string;
  refreshToken: string;
  userEmail: string;
  emailContext?: EmailContext[];
  contacts?: { name: string; email: string; aliases?: string }[];
  action?: "confirm_action" | "batch_reply" | "mark_read";
  actionPayload?: {
    type: "archive" | "delete" | "star" | "mark_read" | "move";
    emailIds: string[];
    label?: string;
  };
  selectedEmails?: { id: string; from: string; subject: string; snippet: string }[];
}

interface AIResponseShape {
  reply: string;
  intent: string;
  searchQuery: string | null;
  draft: { to: string; cc?: string; subject: string; body: string } | null;
  targetEmailIds: string[];
  actionType: string | null;
}

function buildSystemPrompt(emailContext?: EmailContext[], contacts?: { name: string; email: string; aliases?: string }[]): string {
  let prompt = `You are a professional Gmail assistant AI. Your job is to help the user manage their email efficiently.

RULES:
- Be concise and helpful in your responses.
- Always return your response as a valid JSON object with the following fields:
  {
    "reply": "string — your text response to the user",
    "intent": "string — what the user wants: search, draft, delete, archive, summarize, organize, star, mark_read, move, general",
    "searchQuery": "string | null — a Gmail search query if the user wants to search (use proper Gmail search syntax like from:, subject:, has:attachment, newer_than:, older_than:, is:unread, etc.)",
    "draft": "{ to, cc, subject, body } | null — if the user wants to draft an email",
    "targetEmailIds": "string[] — IDs of emails to act on from the provided email context",
    "actionType": "string | null — one of: archive, delete, star, mark_read, move — only if the user wants a bulk action"
  }
- FORMATTING RULES for the "reply" field:
  - Use **bold** (double asterisks) for: list numbers (e.g. **1.**), sender names, and email subject lines.
  - Any text that directly addresses the user (questions, follow-up prompts, calls to action) should be **bold**.
  - Descriptions of email content should NOT be bold — keep them in regular text.
  - Use blank lines (\n\n) between each numbered email summary for readability.
  - Keep the formatting clean and scannable.
- For search queries, construct proper Gmail search syntax (e.g., "from:john@example.com subject:invoice newer_than:7d").
- For drafts, write professional, well-structured email content.
- For batch operations, identify which emails from the provided context match the user's request.
- NEVER execute destructive actions (delete, archive) without asking the user to confirm first.
- SUMMARIZE UNREAD EMAILS RULE: When the user asks to summarize unread emails, provide a detailed summary of the TOP 5 UNREAD emails from the provided context. For EACH email, write exactly 3-4 sentences describing who sent it, what it's about, any action items or key details, and its urgency/importance. Number each email **1.** through **5.** with bold numbers. Bold the sender name and subject. At the very end of your reply, after a blank line, ALWAYS add this follow-up in bold: "**Would you like me to look into some more unread emails, or would you like to respond to any of these?**"
- If the user asks to summarize emails in general (not specifically unread), still provide a clear numbered summary with 3-4 sentences per email and include the bold follow-up prompt.
- If you can't determine the intent, set intent to "general" and answer helpfully.
- CONTACT LOOKUP RULE: When the user asks to email someone by name (e.g. "send an email to Dave"), look up the name in the [CONTACT BOOK] section below. If an exact match is found, use that email address to create the draft. If MULTIPLE contacts match the same first name, list all matching contacts and ask the user: "I found multiple contacts named [name]. Which one did you mean?" and list them with their full name and email. Encourage users to use full names (first + last) to avoid confusion.
- If a name is NOT found in the contact book, ask the user to provide the email address directly.
- IMPORTANT: Return ONLY the JSON object, no markdown code fences, no extra text.`;

  if (emailContext && emailContext.length > 0) {
    prompt += "\n\n[CURRENT EMAIL CONTEXT]\nThe user's inbox currently contains these emails:\n";
    for (const email of emailContext) {
      const statusStr = email.read !== undefined ? (email.read ? "Read" : "Unread") : "Unknown";
      prompt += `- ID: ${email.id} | From: ${email.from} | Subject: ${email.subject} | Snippet: ${email.snippet} | Status: ${statusStr}\n`;
    }
  }

  if (contacts && contacts.length > 0) {
    prompt += "\n\n[CONTACT BOOK]\nThe user's contacts/address book contains these people:\n";
    for (const c of contacts) {
      const aliasStr = c.aliases ? ` (also known as: ${c.aliases})` : "";
      prompt += `- ${c.name}${aliasStr} => ${c.email}\n`;
    }
  }

  return prompt;
}

function createOAuth2Client(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

async function executeGmailSearch(
  refreshToken: string,
  query: string
): Promise<{ id: string; from: string; subject: string; snippet: string; date: string }[]> {
  const oauth2Client = createOAuth2Client(refreshToken);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 20,
  });

  const messageRefs = listResponse.data.messages || [];
  if (messageRefs.length === 0) return [];

  const results = await Promise.all(
    messageRefs.map(async (ref) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: ref.id as string,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });

      const headers = detail.data.payload?.headers || [];
      const from = headers.find((h) => h.name === "From")?.value || "Unknown";
      const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject";
      const date = headers.find((h) => h.name === "Date")?.value || "";

      return {
        id: detail.data.id || ref.id || "",
        from,
        subject,
        snippet: detail.data.snippet || "",
        date,
      };
    })
  );

  return results;
}

async function executeConfirmedAction(
  refreshToken: string,
  actionPayload: {
    type: "archive" | "delete" | "star" | "mark_read" | "move";
    emailIds: string[];
    label?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const oauth2Client = createOAuth2Client(refreshToken);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const { type, emailIds, label } = actionPayload;

  if (!emailIds || emailIds.length === 0) {
    return { success: false, error: "No email IDs provided" };
  }

  try {
    for (const emailId of emailIds) {
      switch (type) {
        case "archive":
          await gmail.users.messages.modify({
            userId: "me",
            id: emailId,
            requestBody: {
              removeLabelIds: ["INBOX"],
            },
          });
          break;

        case "delete":
          await gmail.users.messages.trash({
            userId: "me",
            id: emailId,
          });
          break;

        case "star":
          await gmail.users.messages.modify({
            userId: "me",
            id: emailId,
            requestBody: {
              addLabelIds: ["STARRED"],
            },
          });
          break;

        case "mark_read":
          await gmail.users.messages.modify({
            userId: "me",
            id: emailId,
            requestBody: {
              removeLabelIds: ["UNREAD"],
            },
          });
          break;

        case "move":
          if (!label) {
            return { success: false, error: "No target label specified for move action" };
          }
          await gmail.users.messages.modify({
            userId: "me",
            id: emailId,
            requestBody: {
              addLabelIds: [label],
              removeLabelIds: ["INBOX"],
            },
          });
          break;

        default:
          return { success: false, error: `Unknown action type: ${type}` };
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("[Gmail AI] Action execution error:", err?.message);
    return { success: false, error: err?.message || "Failed to execute action" };
  }
}

function parseAIResponse(raw: string): AIResponseShape {
  // Strip markdown code fences if the model wraps the JSON
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      reply: parsed.reply || "I couldn't process that request.",
      intent: parsed.intent || "general",
      searchQuery: parsed.searchQuery || null,
      draft: parsed.draft || null,
      targetEmailIds: Array.isArray(parsed.targetEmailIds) ? parsed.targetEmailIds : [],
      actionType: parsed.actionType || null,
    };
  } catch {
    // JSON.parse failed — try to extract fields with regex
    // This handles cases where special chars (emojis, unicode) break JSON.parse
    const replyMatch = cleaned.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    if (replyMatch) {
      let replyText: string;
      try {
        replyText = JSON.parse(`"${replyMatch[1]}"`);
      } catch {
        replyText = replyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
      }

      const intentMatch = cleaned.match(/"intent"\s*:\s*"([^"]*)"/s);
      const searchMatch = cleaned.match(/"searchQuery"\s*:\s*"([^"]*)"/s);
      const actionMatch = cleaned.match(/"actionType"\s*:\s*"([^"]*)"/s);
      const idsMatch = cleaned.match(/"targetEmailIds"\s*:\s*\[([\s\S]*?)\]/s);
      let targetIds: string[] = [];
      if (idsMatch) {
        const idMatches = idsMatch[1].match(/"([^"]+)"/g);
        targetIds = idMatches ? idMatches.map((s: string) => s.replace(/"/g, "")) : [];
      }

      return {
        reply: replyText,
        intent: intentMatch?.[1] || "general",
        searchQuery: searchMatch?.[1] || null,
        draft: null,
        targetEmailIds: targetIds,
        actionType: actionMatch?.[1] || null,
      };
    }

    // Complete fallback — no JSON structure detected at all
    return {
      reply: raw,
      intent: "general",
      searchQuery: null,
      draft: null,
      targetEmailIds: [],
      actionType: null,
    };
  }
}

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json();
    const { messages, uid, refreshToken, userEmail, emailContext, action, actionPayload } = body;

    if (!uid || !refreshToken) {
      return NextResponse.json({ error: "Missing uid or refreshToken" }, { status: 400 });
    }

    // ─── Mode 2: Execute a confirmed action ───────────────────────
    if (action === "confirm_action" && actionPayload) {
      const result = await executeConfirmedAction(refreshToken, actionPayload);
      return NextResponse.json(result);
    }

    // ─── Mode 3: Mark emails as read ─────────────────────────────
    if (action === "mark_read" && body.selectedEmails) {
      const emailIds = body.selectedEmails.map((e) => e.id);
      const result = await executeConfirmedAction(refreshToken, {
        type: "mark_read",
        emailIds,
      });
      return NextResponse.json({ ...result, markedIds: emailIds });
    }

    // ─── Mode 4: Batch reply to selected emails ─────────────────
    if (action === "batch_reply" && body.selectedEmails && body.selectedEmails.length > 0) {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const model = "llama-3.3-70b-versatile";

      const emailList = body.selectedEmails
        .map((e) => `- EmailID: ${e.id} | From: ${e.from} | Subject: ${e.subject} | Snippet: ${e.snippet}`)
        .join("\n");

      const batchPrompt = `You are a professional email assistant. Draft short, professional, friendly replies for each of the following emails. Each reply should be 2-4 sentences.

Return ONLY a JSON array (no extra text, no code fences) where each object has:
- "emailId": the original email's ID
- "to": the sender's email address (extract from the From field)
- "subject": "Re: [original subject]"
- "body": your professional reply text

Emails to reply to:
${emailList}`;

      const completion = await groq.chat.completions.create({
        messages: [{ role: "system", content: batchPrompt }],
        model,
        temperature: 0.4,
        max_tokens: 4096,
      });

      const rawBatch = completion.choices[0]?.message?.content || "[]";
      let batchDrafts: { emailId: string; to: string; subject: string; body: string }[] = [];

      try {
        let cleanedBatch = rawBatch.trim();
        if (cleanedBatch.startsWith("```")) {
          cleanedBatch = cleanedBatch.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
        }
        batchDrafts = JSON.parse(cleanedBatch);
      } catch {
        // Try to extract array with regex
        const arrMatch = rawBatch.match(/\[([\s\S]*)\]/);
        if (arrMatch) {
          try {
            batchDrafts = JSON.parse(`[${arrMatch[1]}]`);
          } catch { /* empty */ }
        }
      }

      // Mark original emails as read
      const emailIds = body.selectedEmails.map((e) => e.id);
      try {
        await executeConfirmedAction(refreshToken, { type: "mark_read", emailIds });
      } catch { /* non-blocking */ }

      // Log AI usage
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      logAIUsage({
        userId: uid,
        userEmail: userEmail || undefined,
        orgId: "soltheory",
        model,
        provider: "groq",
        endpoint: "/api/gmail-ai (batch_reply)",
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd: calculateGroqCost(model, inputTokens, outputTokens),
        timestamp: new Date(),
      });

      return NextResponse.json({
        content: `**Replies drafted!** I\'ve crafted ${batchDrafts.length} professional replies for your selected emails. Press **\'Review Drafts\'** to preview and edit them, or press **\'Send All\'** to send them right away.`,
        reply: `Replies drafted! I've crafted ${batchDrafts.length} professional replies for your selected emails.`,
        batchDrafts,
        highlightEmailIds: emailIds,
        highlightIds: emailIds,
      });
    }

    // ─── Mode 1: AI Chat ──────────────────────────────────────────────
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const model = "llama-3.3-70b-versatile";
    const systemPrompt = buildSystemPrompt(emailContext, body.contacts);

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      model,
      temperature: 0.3,
      max_tokens: 2048,
    });

    const rawContent = completion.choices[0]?.message?.content || "";
    const aiResponse = parseAIResponse(rawContent);

    // Log AI usage
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = completion.usage?.total_tokens || 0;

    logAIUsage({
      userId: uid,
      userEmail: userEmail || undefined,
      orgId: "soltheory",
      model,
      provider: "groq",
      endpoint: "/api/gmail-ai",
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd: calculateGroqCost(model, inputTokens, outputTokens),
      timestamp: new Date(),
    });

    // Build the response object
    const responsePayload: {
      reply: string;
      content: string;
      highlightEmailIds: string[];
      highlightIds: string[];
      searchResults?: { id: string; from: string; subject: string; snippet: string; date: string }[];
      draft?: { to: string; cc?: string; subject: string; body: string };
      pendingAction?: {
        type: "archive" | "delete" | "star" | "mark_read" | "move";
        emailIds: string[];
        description: string;
      };
      actionCard?: {
        type: "archive" | "delete" | "star" | "mark_read" | "move";
        emailIds: string[];
        description: string;
      };
      summary?: string;
    } = {
      reply: aiResponse.reply,
      content: aiResponse.reply,
      highlightEmailIds: aiResponse.targetEmailIds,
      highlightIds: aiResponse.targetEmailIds,
    };

    // If the AI produced a search query, execute it
    if (aiResponse.searchQuery) {
      try {
        const searchResults = await executeGmailSearch(refreshToken, aiResponse.searchQuery);
        responsePayload.searchResults = searchResults;
      } catch (searchErr: any) {
        console.error("[Gmail AI] Search error:", searchErr?.message);
        responsePayload.reply += "\n\n(I tried to search your emails but encountered an error. Please try again.)";
        responsePayload.content = responsePayload.reply;
      }
    }

    // If the AI produced a draft, include it for review
    if (aiResponse.draft) {
      responsePayload.draft = aiResponse.draft;
    }

    // If the AI detected a destructive/bulk action, return it as pending (not auto-executed)
    if (aiResponse.actionType && aiResponse.targetEmailIds.length > 0) {
      const actionDescriptions: Record<string, string> = {
        archive: `Archive ${aiResponse.targetEmailIds.length} email(s)`,
        delete: `Delete ${aiResponse.targetEmailIds.length} email(s)`,
        star: `Star ${aiResponse.targetEmailIds.length} email(s)`,
        mark_read: `Mark ${aiResponse.targetEmailIds.length} email(s) as read`,
        move: `Move ${aiResponse.targetEmailIds.length} email(s)`,
      };

      const pendingAction = {
        type: aiResponse.actionType as "archive" | "delete" | "star" | "mark_read" | "move",
        emailIds: aiResponse.targetEmailIds,
        description: actionDescriptions[aiResponse.actionType] || `Perform ${aiResponse.actionType} on ${aiResponse.targetEmailIds.length} email(s)`,
      };

      responsePayload.pendingAction = pendingAction;
      responsePayload.actionCard = pendingAction;
    }

    // If the intent is summarize, put the reply into the summary field as well
    // and auto-mark the summarized emails as read
    if (aiResponse.intent === "summarize") {
      responsePayload.summary = aiResponse.reply;
      // Auto mark-as-read for summarized emails (non-blocking)
      if (aiResponse.targetEmailIds.length > 0) {
        executeConfirmedAction(refreshToken, {
          type: "mark_read",
          emailIds: aiResponse.targetEmailIds,
        }).catch(() => { /* non-blocking */ });
      }
    }

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("[Gmail AI Error]", error?.message, error?.status, JSON.stringify(error?.error || {}));

    const isAuthError =
      error?.status === 401 ||
      error?.message?.includes("auth") ||
      error?.message?.includes("API key");

    return NextResponse.json(
      {
        reply: isAuthError
          ? "Authentication error. Please re-connect your Google account."
          : "Something went wrong processing your request. Please try again.",
        error: error?.message,
        highlightEmailIds: [],
      },
      { status: 500 }
    );
  }
}
