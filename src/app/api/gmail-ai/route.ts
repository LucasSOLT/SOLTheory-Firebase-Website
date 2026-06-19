import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { logAIUsage, calculateGroqCost } from "@/lib/log-ai-usage";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

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

interface EmailMemoryEntry {
  sender: string;
  senderName: string;
  subjectPattern: string;
  category: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  aiNote: string;
}

function buildSystemPrompt(
  emailContext?: EmailContext[],
  contacts?: { name: string; email: string; aliases?: string }[],
  emailMemory?: EmailMemoryEntry[]
): string {
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
  - Use blank lines (\\n\\n) between each numbered email summary for readability.
  - Keep the formatting clean and scannable.
  - NEVER include raw email IDs (like "19ed88fc8ba253e0") in the reply text. IDs go ONLY in the targetEmailIds array.
- For search queries, construct proper Gmail search syntax (e.g., "from:john@example.com subject:invoice newer_than:7d").
- For drafts, write professional, well-structured email content.
- For batch operations, identify which emails from the provided context match the user's request.
- NEVER execute destructive actions (delete, archive) without asking the user to confirm first.
- CRITICAL: You must ONLY reference and summarize emails that appear in the [CURRENT EMAIL CONTEXT] section below. NEVER invent, fabricate, or hallucinate emails. If there are no unread emails in the context, say so. If there are fewer than 5 unread emails, summarize only the ones that exist. Every sender name and subject you mention MUST come directly from the provided context.
- SUMMARIZE UNREAD EMAILS RULE: When the user asks to summarize unread emails, find the emails marked "Status: Unread" in the [CURRENT EMAIL CONTEXT] and summarize up to 5 of them. For EACH email, write exactly 3-4 sentences using the REAL sender name, subject, and snippet from the context. Number each email with bold numbers. Bold the sender name and subject. Include the real email IDs in the targetEmailIds JSON array (but NEVER in the reply text). At the very end of your reply, after a blank line, ALWAYS add this follow-up in bold: "**Would you like me to look into some more unread emails, or would you like to respond to any of these?**"
- EMAIL MEMORY RULE: If the [EMAIL MEMORY] section below contains entries for a sender/topic, use them to add context. For example, if you see an email from Vercel about a deployment failure and the memory shows this sender has sent 5 similar emails before, say something like "Another deployment failure notification from Vercel — you've received several of these before." Be conversational and helpful about recognizing patterns, not robotic. If it's the first time seeing a sender/topic (not in memory), just describe it normally.
- If the user asks to summarize emails in general (not specifically unread), still provide a clear numbered summary with 3-4 sentences per email using ONLY data from the provided context.
- CONTACT LOOKUP RULE: When the user asks to draft or send an email to someone by name (e.g. "send an email to Dave"), look up the name in the [CONTACT BOOK] section if provided. If an exact match is found, use that email address. If MULTIPLE contacts match, ask which one. If not found, ask for the email address.
- CLEAN UP INBOX RULE: When the user asks to "clean up inbox", "organize inbox", "clean up more", or similar, analyze the [CURRENT EMAIL CONTEXT] and identify up to 10 emails that should be cleaned up. Look for: (1) Duplicate or near-duplicate emails (same sender + very similar subject), (2) Promotional/marketing emails (from noreply addresses, containing "unsubscribe", "sale", "promo", "offer"), (3) Old automated notifications (deployment alerts, CI/CD, social media notifications, newsletters), (4) Read emails older than a few days that appear to be low-priority. In your reply, list the emails you recommend cleaning up in a numbered list with sender and subject bolded. Group them by reason (duplicates, promotional, notifications). Set the intent to "organize", set actionType to "delete" (moves to trash), and include all their IDs in targetEmailIds. End with: "**Press 'Confirm' to move these emails to trash, or let me know if you'd like to keep any of them.**\\n\\n**Would you like to continue cleaning up your inbox?**" NEVER auto-delete without asking first.
- If you can't determine the intent, set intent to "general" and answer helpfully.
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

  if (emailMemory && emailMemory.length > 0) {
    prompt += "\n\n[EMAIL MEMORY]\nHere are recurring email patterns the user has received before. Use these to provide contextual, conversational summaries:\n";
    for (const mem of emailMemory) {
      const daysSinceFirst = Math.round((Date.now() - mem.firstSeen.getTime()) / (1000 * 60 * 60 * 24));
      prompt += `- From: ${mem.senderName} (${mem.sender}) | Topic: "${mem.subjectPattern}" | Seen ${mem.count} time(s) over ${daysSinceFirst} days | Category: ${mem.category}${mem.aiNote ? " | Note: " + mem.aiNote : ""}\n`;
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

/* ─── Email Memory: Learn sender + subject patterns over time ─── */

async function getEmailMemory(uid: string): Promise<EmailMemoryEntry[]> {
  try {
    initAdmin();
    const db = getFirestore();
    const snap = await db.collection(`users/${uid}/email_memory`)
      .orderBy("count", "desc")
      .limit(30)
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        sender: d.sender || "",
        senderName: d.senderName || "",
        subjectPattern: d.subjectPattern || "",
        category: d.category || "unknown",
        count: d.count || 1,
        firstSeen: d.firstSeen?.toDate?.() || new Date(),
        lastSeen: d.lastSeen?.toDate?.() || new Date(),
        aiNote: d.aiNote || "",
      };
    });
  } catch (err: any) {
    console.error("[Gmail AI] Failed to fetch email memory:", err?.message);
    return [];
  }
}

function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw):\s*/gi, "")
    .replace(/\[.*?\]/g, "")
    .trim()
    .toLowerCase()
    .slice(0, 80);
}

function extractSenderEmail(from: string): string {
  const match = from.match(/<(.+?)>/);
  return (match ? match[1] : from).toLowerCase().trim();
}

function extractSenderName(from: string): string {
  const match = from.match(/^(.*?)\s*<.*?>$/);
  return match ? match[1].replace(/"/g, "").trim() : from.split("@")[0];
}

function categorizeEmail(from: string, subject: string): string {
  const lowerFrom = from.toLowerCase();
  const lowerSubject = subject.toLowerCase();

  if (/noreply|no-reply|notifications?@|notify@|alert@/.test(lowerFrom)) {
    if (/deploy|build|ci|pipeline|test|fail|error/.test(lowerSubject)) return "ci-cd";
    if (/security|password|login|2fa|verification/.test(lowerSubject)) return "security";
    if (/invoice|payment|receipt|billing|charge/.test(lowerSubject)) return "billing";
    return "notification";
  }
  if (/newsletter|digest|weekly|daily|update/.test(lowerSubject)) return "newsletter";
  if (/linkedin|facebook|twitter|instagram|social/.test(lowerFrom)) return "social";
  if (/promo|sale|discount|offer|deal|unsubscribe/.test(lowerSubject)) return "promotional";
  return "personal";
}

async function upsertEmailMemory(uid: string, emails: EmailContext[]): Promise<void> {
  try {
    initAdmin();
    const db = getFirestore();
    const memCollection = db.collection(`users/${uid}/email_memory`);

    for (const email of emails) {
      const senderEmail = extractSenderEmail(email.from);
      const senderName = extractSenderName(email.from);
      const subjectNorm = normalizeSubject(email.subject);
      const category = categorizeEmail(email.from, email.subject);

      // Check for existing pattern from same sender
      const existing = await memCollection
        .where("sender", "==", senderEmail)
        .limit(10)
        .get();

      let matched = false;
      for (const doc of existing.docs) {
        const data = doc.data();
        const existingPattern = data.subjectPattern || "";
        // Match if subjects share significant overlap
        if (
          existingPattern === subjectNorm ||
          (subjectNorm.length > 5 && existingPattern.includes(subjectNorm.slice(0, 20))) ||
          (existingPattern.length > 5 && subjectNorm.includes(existingPattern.slice(0, 20)))
        ) {
          await doc.ref.update({
            count: FieldValue.increment(1),
            lastSeen: FieldValue.serverTimestamp(),
            senderName: senderName,
          });
          matched = true;
          break;
        }
      }

      if (!matched) {
        await memCollection.add({
          sender: senderEmail,
          senderName: senderName,
          subjectPattern: subjectNorm,
          category: category,
          count: 1,
          firstSeen: FieldValue.serverTimestamp(),
          lastSeen: FieldValue.serverTimestamp(),
          aiNote: "",
        });
      }
    }
  } catch (err: any) {
    console.error("[Gmail AI] Email memory upsert error:", err?.message);
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

    // Fetch email memory for contextual summaries
    const emailMemory = uid ? await getEmailMemory(uid) : [];
    const systemPrompt = buildSystemPrompt(emailContext, body.contacts, emailMemory);

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      model,
      temperature: 0.3,
      max_tokens: 4096,
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
    // and auto-mark the summarized emails as read + learn email patterns
    if (aiResponse.intent === "summarize") {
      responsePayload.summary = aiResponse.reply;
      // Auto mark-as-read for summarized emails (non-blocking)
      if (aiResponse.targetEmailIds.length > 0) {
        executeConfirmedAction(refreshToken, {
          type: "mark_read",
          emailIds: aiResponse.targetEmailIds,
        }).catch(() => { /* non-blocking */ });
      }
      // Learn email patterns from summarized emails (non-blocking)
      if (emailContext && emailContext.length > 0 && uid) {
        const summarizedEmails = aiResponse.targetEmailIds.length > 0
          ? emailContext.filter((e) => aiResponse.targetEmailIds.includes(e.id))
          : emailContext.filter((e) => !e.read).slice(0, 5);
        upsertEmailMemory(uid, summarizedEmails).catch((err) => {
          console.error("[Gmail AI] Email memory upsert error:", err?.message);
        });
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
