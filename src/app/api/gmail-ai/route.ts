import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { logAIUsage, calculateGroqCost } from "@/lib/log-ai-usage";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyRequest } from "@/lib/api-auth";

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
  action?: "confirm_action" | "batch_reply" | "mark_read" | "create_labels" | "apply_labels";
  actionPayload?: {
    type: "archive" | "delete" | "star" | "mark_read" | "move" | "apply_label";
    emailIds: string[];
    label?: string;
  };
  selectedEmails?: { id: string; from: string; subject: string; snippet: string }[];
  tagSetup?: { name: string; color: string; description: string; rules: string }[];
  labelAssignments?: { emailId: string; labelName: string }[];
  dashboardId?: string;
  knowledgeBaseText?: string;
  pactText?: string;
  orgBrainText?: string;
}

interface AIResponseShape {
  reply: string;
  intent: string;
  searchQuery: string | null;
  draft: { to: string; cc?: string; subject: string; body: string } | null;
  targetEmailIds: string[];
  actionType: string | null;
  tagSetup?: { name: string; color: string; description: string; rules: string }[];
  labelAssignments?: { emailId: string; labelName: string }[];
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

/* ─── NXT Chapter Client Knowledge Base ─── */
const NXT_CHAPTER_KNOWLEDGE = `
[CLIENT KNOWLEDGE BASE — NXT CHAPTER]
You are the dedicated dashboard assistant for NXT Chapter. You have been programmed with complete, permanent knowledge regarding this client.

CRITICAL PHONETIC AND TEXT MAPPING:
- Whenever a user says or types "next chapter", "the next chapter", "next-chapter", or any phonetic equivalent, ALWAYS resolve this to the Denver-based nonprofit "NXT Chapter".
- Do not ask for clarification. Proceed immediately with the understanding that they are referring to NXT Chapter.

CLIENT PROFILE:
- Legal Name: Next Chapter Foundation Inc. (branded as NXT Chapter / NxtChapter)
- Entity Type: 501(c)(3) Nonprofit Organization
- Founded: 2020, Denver, CO
- Mission: To accommodate ex-offenders (returning citizens) with essentials and reentry support upon release from incarceration, reducing the recidivism rate and ensuring a smooth transition back into society.
- Core Philosophy: Poor decisions should not warrant the dehumanization of an individual.

KEY PERSONNEL & GOVERNANCE:
- Josephine Burton: President & Executive Director. Developer of the S.E.E.D.™ curriculum.
- Marquell Burton: Co-Founder, Treasurer, and Chief Financial Officer (CFO).
- James Harris: Vice President.
- Zenya Packer: Secretary.
- Cornelius Williams: Board Member.
- Fiscal Sponsors (Historical/Current): CrossPurpose, Colorado Nonprofit Development Center (CNDC).

PROGRAM PORTFOLIO:
1. 3 Steps to Success:
   - Step 1 (Essentials): Provision of hygiene packs, clothing, and administrative assistance to obtain vital documents (State IDs, Birth Certificates, SSN Cards, and RTD transit cards).
   - Step 2 (Employment Support): Securing stable employment, providing transit fare, interview attire, and work-safety gear (safety vests, steel-toe boot resources, hard hats, safety glasses).
   - Step 3 (Reentry Support Net): Coordinating accountability structures between family, NXT Chapter mentors, halfway house case managers, and parole/probation officers.

2. The S.E.E.D.™ Program (Support, Empowerment, Education, & Development):
   - An 8-week mental health and cognitive development curriculum for returning citizens.
   - Core Pillars: (1) Setting Realistic Goals, (2) Cognitive Thinking, (3) Self-Esteem Building.
   - Integrates with W.R.A.P. (Wellness Recovery Action Plan) for substance use recovery, trauma, and mental wellness.

3. Youth Program (Ages 13–25):
   - Early intervention, character development, resume building, and educational mentorship for at-risk youth to disrupt systemic cycles.

4. Parole Support:
   - Simplifying complex reporting requirements from the criminal legal system into actionable, progressive tasks to guarantee parole compliance.

IMPACT & METRICS:
- Over its first three years, the program tracked a 99% success rate across more than 200 participants.
- Funding from private donations and local grants, including the Caring for Denver Foundation.

CONTACT & OPERATIONAL DATA:
- Aid Center (In-Person): 1370 Elati St, Denver, CO 80204 (Open Mon, Wed, Fri | 10:00 AM – 2:00 PM MDT)
- Mailing/Corporate Address: 1312 17th St #1325, Denver, CO 80202
- Primary Email: nxtchapterorg@gmail.com
- Primary Phone: (720) 301-5458 or (720) 397-7236
- Website: https://www.nxtchapter.org

TONE GUIDELINES:
- Maintain a highly professional, respectful, and objective tone.
- Do not exaggerate statistics or use overly emotive language.
- Use this knowledge base to answer questions about NXT Chapter's mission, leadership, addresses, programs, or contact info.
`;

function buildSystemPrompt(
  emailContext?: EmailContext[],
  contacts?: { name: string; email: string; aliases?: string }[],
  emailMemory?: EmailMemoryEntry[],
  existingTags?: { name: string; color: string; description: string; rules: string; gmailLabelId: string }[],
  dashboardId?: string,
  knowledgeBaseText?: string,
  pactText?: string,
  orgBrainText?: string
): string {
  let prompt = `You are a professional Gmail assistant AI. Your job is to help the user manage their email efficiently.

RULES:
- Be concise and helpful in your responses.
- Always return your response as a valid JSON object with the following fields:
  {
    "reply": "string — your text response to the user",
    "intent": "string — what the user wants: search, draft, delete, archive, summarize, organize, organize_tags, star, mark_read, move, general",
    "searchQuery": "string | null — a Gmail search query if the user wants to search",
    "draft": "{ to, cc, subject, body } | null — if the user wants to draft an email",
    "targetEmailIds": "string[] — IDs of emails to act on from the provided email context",
    "actionType": "string | null — one of: archive, delete, star, mark_read, move, apply_label — only if the user wants a bulk action",
    "tagSetup": "array | null — when setting up tags, return [{ name: string, color: string (hex like #4285f4), description: string, rules: string }]",
    "labelAssignments": "array | null — when auto-tagging, return [{ emailId: string, labelName: string }] to assign labels to emails"
  }
- FORMATTING RULES for the "reply" field:
  - Use **bold** (double asterisks) for: list numbers (e.g. **1.**), sender names, and email subject lines.
  - Any text that directly addresses the user (questions, follow-up prompts, calls to action) should be **bold**.
  - Descriptions of email content should NOT be bold — keep them in regular text.
  - Use blank lines (\\n\\n) between each numbered email summary for readability.
  - Keep the formatting clean and scannable.
  - NEVER include raw email IDs (like "19ed88fc8ba253e0") in the reply text.- For search queries, construct proper Gmail search syntax (e.g., "from:john@example.com subject:invoice newer_than:7d").
- For drafts, write professional, well-structured email content. Keep the tone warm, direct, and conversational but highly professional. Incorporate the user's details, business identity, and services from <user_knowledge_base> and <user_facts> (at the bottom) naturally, so the email is written from their actual perspective. Never start with cliché opening phrases like "Hope this email finds you well" or "I am writing to...". Get straight to the point. Include space for the user's name/signature at the end.
- USER PERSONA ALIGNMENT: Always review <user_knowledge_base> and <user_facts> (if provided) before writing reply text, answering questions, or drafting emails. Align your answers, voice, terminology, and recommendations to match the user's profession, identity, and organization.
- For batch operations, identify which emails from the provided context match the user's request.
- NEVER execute destructive actions (delete, archive) without asking the user to confirm first.
- CRITICAL: You must ONLY reference and summarize emails that appear in the [CURRENT EMAIL CONTEXT] section below. NEVER invent, fabricate, or hallucinate emails. If there are no unread emails in the context, say so. If there are fewer than 5 unread emails, summarize only the ones that exist. Every sender name and subject you mention MUST come directly from the provided context.
- SUMMARIZE UNREAD EMAILS RULE: When the user asks to summarize unread emails, find the emails marked "Status: Unread" in the [CURRENT EMAIL CONTEXT] and summarize up to 5 of them. For EACH email, write exactly 3-4 sentences using the REAL sender name, subject, and snippet from the context. Number each email with bold numbers. Bold the sender name and subject. Include the real email IDs in the targetEmailIds JSON array (but NEVER in the reply text). At the very end of your reply, after a blank line, ALWAYS add this follow-up in bold: "**Would you like me to look into some more unread emails, or would you like to respond to any of these?**"
- EMAIL MEMORY RULE: If the [EMAIL MEMORY] section below contains entries for a sender/topic, use them to add context. For example, if you see an email from Vercel about a deployment failure and the memory shows this sender has sent 5 similar emails before, say something like "Another deployment failure notification from Vercel — you've received several of these before." Be conversational and helpful about recognizing patterns, not robotic. If it's the first time seeing a sender/topic (not in memory), just describe it normally.
- If the user asks to summarize emails in general (not specifically unread), still provide a clear numbered summary with 3-4 sentences per email using ONLY data from the provided context.
- CONTACT LOOKUP RULE: When the user asks to draft or send an email to someone by name (e.g. "send an email to Dave"), look up the name in the [CONTACT BOOK] section if provided. If an exact match is found, use that email address. If MULTIPLE contacts match, ask which one. If not found, ask for the email address.
- ORGANIZE INBOX / TAG SETUP RULE: When the user clicks "Organize Inbox" or asks to organize/tag their inbox:
  A) If the [EXISTING TAGS] section below is EMPTY or does not exist, this is the first time. Suggest a tag system for the user. Propose 5-7 useful tag categories based on the emails you can see in their inbox (e.g., "Work", "Newsletters", "Receipts", "Social", "Notifications", "Personal", "Finance"). For each tag, suggest a color (hex code) and a brief description of what emails belong in it. Present them in a friendly numbered list. End with: "**Would you like me to create these tags, or would you like to customize them? You can add, remove, or rename any of these.**" Set intent to "organize_tags", set tagSetup to the array of proposed tags (each with name, color, description, and rules like "from:noreply@github.com" or "subject contains: invoice"), and set actionType to null.
  B) If the [EXISTING TAGS] section shows existing tags AND the user is asking to organize/tag (not just clean up), respond with TWO options: "**1.** Add more tags to your system" or "**2.** Start organizing — I'll sweep your inbox and tag emails using your current tags." Set intent to "organize_tags" and leave tagSetup and labelAssignments as null until the user chooses.
  C) If the user chose to add more tags, suggest additional ones following step A format.
  D) If the user chose to sweep/organize OR says "yes" to organizing, analyze every email in [CURRENT EMAIL CONTEXT] and match them to the existing tags using the tag rules. Return labelAssignments array with { emailId, labelName } for each match. In your reply, list how many emails were tagged per category. Set intent to "organize_tags" and actionType to "apply_label".
  E) If the user confirms the suggested tag setup from step A (says "yes", "create them", "looks good", etc.), return the SAME tagSetup array you proposed. Set intent to "organize_tags".
- CLEAN UP INBOX RULE: When the user asks to "clean up inbox", "clean up more", "delete junk", or similar cleanup requests (NOT "organize inbox" which is handled by the ORGANIZE INBOX rule above), analyze the [CURRENT EMAIL CONTEXT] and identify up to 10 emails that should be cleaned up. Look for: (1) Duplicate or near-duplicate emails (same sender + very similar subject), (2) Promotional/marketing emails (from noreply addresses, containing "unsubscribe", "sale", "promo", "offer"), (3) Old automated notifications (deployment alerts, CI/CD, social media notifications, newsletters), (4) Read emails older than a few days that appear to be low-priority. In your reply, list the emails you recommend cleaning up in a numbered list with sender and subject bolded. Group them by reason (duplicates, promotional, notifications). Set the intent to "organize", set actionType to "delete" (moves to trash), and include all their IDs in targetEmailIds. End with: "**Press 'Confirm' to move these emails to trash, or let me know if you'd like to keep any of them.**\n\n**Would you like to continue cleaning up your inbox?**" NEVER auto-delete without asking first.
- If you can't determine the intent, set intent to "general" and answer helpfully.
- IMPORTANT: Return ONLY the JSON object, no markdown code fences, no extra text.`;

  if (emailContext && emailContext.length > 0) {
    prompt += "\n\n[CURRENT EMAIL CONTEXT]\nThe user's inbox currently contains these emails:\n";
    for (const email of emailContext) {
      const statusStr = email.read !== undefined ? (email.read ? "Read" : "Unread") : "Unknown";
      prompt += `- ID: ${email.id} | From: ${email.from} | Subject: ${email.subject} | Snippet: ${email.snippet} | Status: ${statusStr}\n`;
    }
  } else {
    prompt += "\n\n[CURRENT EMAIL CONTEXT]\nNo emails are currently loaded. If the user asks to summarize, search, or reference emails, tell them that no emails were found in their inbox or that their Gmail connection may need to be refreshed. DO NOT invent or fabricate any emails. NEVER mention senders like 'John Doe', 'Jane Smith', or any placeholder names.";
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

  if (existingTags && existingTags.length > 0) {
    prompt += "\n\n[EXISTING TAGS]\nThe user has already set up these Gmail tags/labels:\n";
    for (const tag of existingTags) {
      prompt += `- Tag: \"${tag.name}\" | Color: ${tag.color} | Description: ${tag.description} | Rules: ${tag.rules} | Gmail Label ID: ${tag.gmailLabelId}\n`;
    }
  }
  // Inject client knowledge base for specific dashboards
  if (dashboardId === "nxtchapter") {
    prompt += "\n\n" + NXT_CHAPTER_KNOWLEDGE;
  }

  // Inject user-provided Knowledge Base, P.A.C.T., and Org Brain context
  if (knowledgeBaseText) {
    prompt += `\n\n<user_knowledge_base>\n${knowledgeBaseText.slice(0, 50000)}\n</user_knowledge_base>`;
  }
  if (pactText) {
    prompt += `\n\n<user_facts>\n${pactText.slice(0, 10000)}\n</user_facts>`;
  }
  if (orgBrainText) {
    prompt += `\n\n<organization_context>\n${orgBrainText.slice(0, 10000)}\n</organization_context>`;
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

/**
 * Server-side fallback: fetch real inbox emails when the frontend passes an empty context.
 * This prevents the AI from hallucinating fake emails.
 */
async function fetchInboxForContext(
  refreshToken: string,
  maxResults = 30
): Promise<EmailContext[]> {
  try {
    const oauth2Client = createOAuth2Client(refreshToken);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const listResponse = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
      maxResults,
    });

    const messageRefs = listResponse.data.messages || [];
    if (messageRefs.length === 0) return [];

    const results = await Promise.all(
      messageRefs.map(async (ref) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: ref.id as string,
          format: "metadata",
          metadataHeaders: ["From", "Subject"],
        });

        const headers = detail.data.payload?.headers || [];
        const from = headers.find((h) => h.name === "From")?.value || "Unknown";
        const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject";
        const labelIds = detail.data.labelIds || [];
        const isUnread = labelIds.includes("UNREAD");

        return {
          id: detail.data.id || ref.id || "",
          from,
          subject,
          snippet: detail.data.snippet || "",
          read: !isUnread,
        };
      })
    );

    return results;
  } catch (err: any) {
    console.error("[Gmail AI] Failed to fetch inbox for context:", err?.message);
    return [];
  }
}

async function executeConfirmedAction(
  refreshToken: string,
  actionPayload: {
    type: "archive" | "delete" | "star" | "mark_read" | "move" | "apply_label";
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

        case "apply_label":
          if (!label) {
            return { success: false, error: "No target label specified for apply_label action" };
          }
          await gmail.users.messages.modify({
            userId: "me",
            id: emailId,
            requestBody: {
              addLabelIds: [label],
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

/* ─── Gmail Label / Tag Management ─── */

interface TagConfig {
  name: string;
  color: string;
  description: string;
  rules: string;
  gmailLabelId: string;
}

async function getExistingTags(uid: string): Promise<TagConfig[]> {
  try {
    initAdmin();
    const db = getFirestore();
    const snap = await db.collection(`users/${uid}/gmail_tags`).get();
    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        name: d.name || "",
        color: d.color || "#4285f4",
        description: d.description || "",
        rules: d.rules || "",
        gmailLabelId: d.gmailLabelId || "",
      };
    });
  } catch (err: any) {
    console.error("[Gmail AI] Failed to fetch tags:", err?.message);
    return [];
  }
}

// Gmail label color map — hex to closest Gmail preset
const GMAIL_LABEL_COLORS: Record<string, { backgroundColor: string; textColor: string }> = {
  "#4285f4": { backgroundColor: "#4986e7", textColor: "#ffffff" },  // Blue
  "#ea4335": { backgroundColor: "#cc3a21", textColor: "#ffffff" },  // Red
  "#34a853": { backgroundColor: "#149e60", textColor: "#ffffff" },  // Green
  "#fbbc04": { backgroundColor: "#f2c960", textColor: "#000000" },  // Yellow
  "#ff6d01": { backgroundColor: "#e07798", textColor: "#ffffff" },  // Orange/Pink
  "#9c27b0": { backgroundColor: "#a479e2", textColor: "#ffffff" },  // Purple
  "#00bcd4": { backgroundColor: "#2da2bb", textColor: "#ffffff" },  // Teal
  "#795548": { backgroundColor: "#b99aff", textColor: "#ffffff" },  // Brown→Lavender
  "#607d8b": { backgroundColor: "#b3efd3", textColor: "#000000" },  // Gray→Mint
  "#e91e63": { backgroundColor: "#e07798", textColor: "#ffffff" },  // Pink
};

function getGmailLabelColor(hex: string): { backgroundColor: string; textColor: string } | undefined {
  const lower = hex.toLowerCase();
  if (GMAIL_LABEL_COLORS[lower]) return GMAIL_LABEL_COLORS[lower];
  // Default to a blue if no match
  return { backgroundColor: "#4986e7", textColor: "#ffffff" };
}

async function createGmailLabels(
  refreshToken: string,
  uid: string,
  tags: { name: string; color: string; description: string; rules: string }[]
): Promise<{ success: boolean; labels: TagConfig[]; error?: string }> {
  try {
    const oauth2Client = createOAuth2Client(refreshToken);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    initAdmin();
    const db = getFirestore();
    const created: TagConfig[] = [];

    // Get existing labels to avoid duplicates
    const existingLabels = await gmail.users.labels.list({ userId: "me" });
    const existingNames = new Set(
      (existingLabels.data.labels || []).map((l) => l.name?.toLowerCase())
    );

    for (const tag of tags) {
      // Skip if label already exists
      if (existingNames.has(tag.name.toLowerCase())) {
        // Find existing label ID
        const existing = (existingLabels.data.labels || []).find(
          (l) => l.name?.toLowerCase() === tag.name.toLowerCase()
        );
        if (existing?.id) {
          const tagConfig: TagConfig = {
            name: tag.name,
            color: tag.color,
            description: tag.description,
            rules: tag.rules,
            gmailLabelId: existing.id,
          };
          await db.collection(`users/${uid}/gmail_tags`).doc(tag.name.toLowerCase().replace(/\s+/g, '_')).set(tagConfig);
          created.push(tagConfig);
        }
        continue;
      }

      const labelColor = getGmailLabelColor(tag.color);
      const label = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name: tag.name,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
          color: labelColor,
        },
      });

      const tagConfig: TagConfig = {
        name: tag.name,
        color: tag.color,
        description: tag.description,
        rules: tag.rules,
        gmailLabelId: label.data.id || "",
      };

      // Store in Firestore
      await db.collection(`users/${uid}/gmail_tags`).doc(tag.name.toLowerCase().replace(/\s+/g, '_')).set(tagConfig);
      created.push(tagConfig);
    }

    return { success: true, labels: created };
  } catch (err: any) {
    console.error("[Gmail AI] Label creation error:", err?.message);
    return { success: false, labels: [], error: err?.message };
  }
}

async function applyLabelsToEmails(
  refreshToken: string,
  uid: string,
  assignments: { emailId: string; labelName: string }[]
): Promise<{ success: boolean; applied: number; error?: string }> {
  try {
    const oauth2Client = createOAuth2Client(refreshToken);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    
    // Get existing tags to resolve label names to Gmail label IDs
    const tags = await getExistingTags(uid);
    const tagMap = new Map(tags.map((t) => [t.name.toLowerCase(), t.gmailLabelId]));
    
    let applied = 0;
    for (const assignment of assignments) {
      const labelId = tagMap.get(assignment.labelName.toLowerCase());
      if (!labelId) {
        console.warn(`[Gmail AI] No label ID found for tag: ${assignment.labelName}`);
        continue;
      }
      
      try {
        await gmail.users.messages.modify({
          userId: "me",
          id: assignment.emailId,
          requestBody: {
            addLabelIds: [labelId],
          },
        });
        applied++;
      } catch (err: any) {
        console.warn(`[Gmail AI] Failed to apply label to ${assignment.emailId}:`, err?.message);
      }
    }
    
    return { success: true, applied };
  } catch (err: any) {
    console.error("[Gmail AI] Apply labels error:", err?.message);
    return { success: false, applied: 0, error: err?.message };
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
      tagSetup: Array.isArray(parsed.tagSetup) ? parsed.tagSetup : undefined,
      labelAssignments: Array.isArray(parsed.labelAssignments) ? parsed.labelAssignments : undefined,
    };
  } catch {
    // JSON.parse failed — try to extract fields with regex
    // This handles cases where special chars (emojis, unicode) break JSON.parse
    const replyMatch = cleaned.match(/"reply"\s*:\s*"((?:[^"\\]|\\[\s\S])*)"/);
    if (replyMatch) {
      let replyText: string;
      try {
        replyText = JSON.parse(`"${replyMatch[1]}"`);
      } catch {
        replyText = replyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
      }

      const intentMatch = cleaned.match(/"intent"\s*:\s*"([^"]*)"/);
      const searchMatch = cleaned.match(/"searchQuery"\s*:\s*"([^"]*)"/);
      const actionMatch = cleaned.match(/"actionType"\s*:\s*"([^"]*)"/);
      const idsMatch = cleaned.match(/"targetEmailIds"\s*:\s*\[([\s\S]*?)\]/);
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
        tagSetup: undefined,
        labelAssignments: undefined,
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
      tagSetup: undefined,
      labelAssignments: undefined,
    };
  }
}

export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;
  try {
    const body: RequestBody = await req.json();
    const { messages, uid, refreshToken, userEmail, emailContext, action, actionPayload } = body;
    const kbText = body.knowledgeBaseText || "";
    const pactTextVal = body.pactText || "";
    const orgBrainVal = body.orgBrainText || "";

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

    // ─── Mode: Create Gmail labels/tags ──────────────────────────
    if (action === "create_labels" && body.tagSetup) {
      const result = await createGmailLabels(refreshToken, uid, body.tagSetup);
      return NextResponse.json(result);
    }

    // ─── Mode: Apply labels to emails ───────────────────────────
    if (action === "apply_labels" && body.labelAssignments) {
      const result = await applyLabelsToEmails(refreshToken, uid, body.labelAssignments);
      return NextResponse.json(result);
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
${emailList}`
+ (kbText ? `\n\n<user_knowledge_base>\n${kbText.slice(0, 50000)}\n</user_knowledge_base>` : "")
+ (pactTextVal ? `\n\n<user_facts>\n${pactTextVal.slice(0, 10000)}\n</user_facts>` : "")
+ (orgBrainVal ? `\n\n<organization_context>\n${orgBrainVal.slice(0, 10000)}\n</organization_context>` : "");

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

    // If frontend passed empty/missing email context, fetch real emails server-side
    // This is the critical fix: prevents AI from hallucinating fake emails
    let resolvedEmailContext = emailContext;
    if (!resolvedEmailContext || resolvedEmailContext.length === 0) {
      console.log("[Gmail AI] Email context empty — fetching inbox server-side");
      resolvedEmailContext = await fetchInboxForContext(refreshToken);
      console.log(`[Gmail AI] Fetched ${resolvedEmailContext.length} emails from inbox`);
    }

    // Fetch email memory for contextual summaries
    const emailMemory = uid ? await getEmailMemory(uid) : [];
    const existingTags = uid ? await getExistingTags(uid) : [];
    const systemPrompt = buildSystemPrompt(resolvedEmailContext, body.contacts, emailMemory, existingTags, body.dashboardId, kbText, pactTextVal, orgBrainVal);

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

    // If the AI proposed a tag setup, include it in the response
    if (aiResponse.tagSetup && aiResponse.tagSetup.length > 0) {
      (responsePayload as any).tagSetup = aiResponse.tagSetup;
    }

    // If the AI produced label assignments, include them
    if (aiResponse.labelAssignments && aiResponse.labelAssignments.length > 0) {
      (responsePayload as any).labelAssignments = aiResponse.labelAssignments;
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
