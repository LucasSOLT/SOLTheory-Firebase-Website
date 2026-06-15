/**
 * gmail-api.ts — Client-side Gmail API wrapper for the Campaigning page.
 * Calls the existing backend API routes (which hold the Google OAuth credentials server-side).
 * The refresh token is read from Firestore and passed to each request.
 */

import { doc, getDoc } from "firebase/firestore";
import { initializeFirebase } from "@/firebase";

/* ─── Types ─── */

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  replyTo: string;
  date: string;
  internalDate: number;
  labelIds: string[];
  body: string;
  attachments: { filename: string; mimeType: string; size: number; attachmentId: string }[];
}

/* ─── Refresh Token Resolution ─── */

/**
 * Reads the user's Google OAuth refresh token from Firestore.
 * Checks multiple storage keys (same fallback chain used by AI Agents).
 */
export async function getRefreshToken(uid: string): Promise<string | null> {
  try {
    const { firestore } = initializeFirebase();
    const snap = await getDoc(doc(firestore, "users", uid));
    if (!snap.exists()) return null;
    const d = snap.data();

    // Check all known storage keys in priority order
    const keys = [
      "gmailOAuth_campaigning",
      "gmailOAuth_jarvis",
      "gmailOAuth_morpheus",
      "gmailOAuth_email",
      "gmailOAuth_inbound-email",
      "gmailOAuth",
    ];

    for (const key of keys) {
      const token = d?.[key]?.refreshToken;
      if (token) return token;
    }

    return null;
  } catch (err) {
    console.error("[gmail-api] Failed to read refresh token:", err);
    return null;
  }
}

/* ─── API Calls ─── */

/**
 * Fetch emails from a Gmail folder.
 * Uses the existing /api/webhooks/gmail/list for inbox,
 * and the new /api/webhooks/gmail/folders for other folders.
 */
export async function fetchEmails(
  uid: string,
  refreshToken: string,
  folder: string = "INBOX",
  maxResults: number = 50
): Promise<GmailMessage[]> {
  try {
    const res = await fetch("/api/webhooks/gmail/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, refreshToken, folder, maxResults }),
    });
    if (!res.ok) throw new Error(`Failed to fetch ${folder}: ${res.status}`);
    const data = await res.json();
    return data.emails || [];
  } catch (err) {
    console.error(`[gmail-api] fetchEmails(${folder}) error:`, err);
    return [];
  }
}

/**
 * Send an email via Gmail API.
 */
export async function sendEmail(
  uid: string,
  refreshToken: string,
  to: string,
  subject: string,
  body: string,
  options?: { cc?: string; threadId?: string; inReplyTo?: string; references?: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch("/api/webhooks/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid,
        refreshToken,
        to,
        cc: options?.cc,
        subject,
        body,
        threadId: options?.threadId,
        inReplyTo: options?.inReplyTo,
        references: options?.references,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || "Send failed" };
    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    console.error("[gmail-api] sendEmail error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete (trash) an email.
 */
export async function deleteGmailEmail(
  uid: string,
  refreshToken: string,
  messageId: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/webhooks/gmail/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, refreshToken }),
    });
    return res.ok;
  } catch (err) {
    console.error("[gmail-api] deleteEmail error:", err);
    return false;
  }
}

/**
 * Get AI assistance for email composition.
 */
export async function getAIAssist(
  action: "subject_lines" | "draft_body" | "rewrite" | "smart_reply" | "campaign_suggest",
  context: {
    emailBody?: string;
    emailSubject?: string;
    emailFrom?: string;
    userPrompt?: string;
    tone?: "formal" | "friendly" | "concise" | "detailed";
    campaignName?: string;
    previousSteps?: string[];
  }
): Promise<{ suggestions: string[]; error?: string }> {
  try {
    const res = await fetch("/api/campaigning/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, context }),
    });
    const data = await res.json();
    if (!res.ok) return { suggestions: [], error: data.error };
    return { suggestions: data.suggestions || [] };
  } catch (err: any) {
    console.error("[gmail-api] getAIAssist error:", err);
    return { suggestions: [], error: err.message };
  }
}

/**
 * Build the OAuth connect URL for users who haven't linked Gmail yet.
 */
export function getGmailConnectUrl(uid: string): string {
  return `/api/auth/google?uid=${uid}&agentId=campaigning&origin=soltheory&returnTo=agentic-campaigning`;
}
