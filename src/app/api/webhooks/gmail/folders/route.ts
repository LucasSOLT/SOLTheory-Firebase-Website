import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { google } from "googleapis";

// Recursively find parts in MIME tree (reused from list route)
function findParts(payload: any, mimeType: string): any[] {
  const results: any[] = [];
  if (payload.mimeType === mimeType && payload.body?.data) {
    results.push(payload);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      results.push(...findParts(part, mimeType));
    }
  }
  return results;
}

function getAttachments(payload: any): { filename: string; mimeType: string; size: number; attachmentId: string }[] {
  const attachments: { filename: string; mimeType: string; size: number; attachmentId: string }[] = [];
  function walk(part: any) {
    if (part.filename && part.filename.length > 0 && part.body) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId || "",
      });
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);
  return attachments;
}

/**
 * Decode RFC 2047 encoded words and HTML entities in email text.
 * Fixes corrupted characters like "ÃâÃâ¢" and HTML entities like "&#39;"
 */
function decodeText(text: string): string {
  if (!text) return text;
  let decoded = text;

  // Decode RFC 2047 encoded words (=?charset?encoding?text?=)
  decoded = decoded.replace(
    /=\?([^?]+)\?(B|Q)\?([^?]*)\?=/gi,
    (_match, _charset, encoding, encoded) => {
      try {
        if (encoding.toUpperCase() === "B") {
          return Buffer.from(encoded, "base64").toString("utf-8");
        } else if (encoding.toUpperCase() === "Q") {
          // Quoted-printable: underscores = spaces, =XX = hex bytes
          const qp = encoded
            .replace(/_/g, " ")
            .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) =>
              String.fromCharCode(parseInt(hex, 16))
            );
          return Buffer.from(qp, "binary").toString("utf-8");
        }
      } catch { /* fallback to original */ }
      return encoded;
    }
  );

  // Decode common HTML entities
  decoded = decoded
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Clean up mojibake patterns (UTF-8 bytes misinterpreted as Latin-1)
  try {
    // If string contains typical mojibake patterns, try to re-encode
    if (/[\xC2-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}/.test(decoded)) {
      const buf = Buffer.from(decoded, "latin1");
      const reDec = buf.toString("utf-8");
      // Only use re-decoded if it looks cleaner (fewer replacement chars)
      if (!reDec.includes("\uFFFD") && reDec.length <= decoded.length) {
        decoded = reDec;
      }
    }
  } catch { /* keep original */ }

  return decoded;
}

// Map folder names to Gmail search queries
const FOLDER_QUERIES: Record<string, string> = {
  INBOX: "in:inbox",
  SENT: "in:sent",
  DRAFT: "is:draft",
  TRASH: "in:trash",
  STARRED: "is:starred",
  SPAM: "in:spam",
  ALL: "",
  ARCHIVE: "-in:inbox -in:sent -in:draft -in:trash -in:spam",
};

export async function POST(req: NextRequest) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { uid, refreshToken, folder = "INBOX", maxResults = 50 } = await req.json();

    if (!uid || !refreshToken) {
      return NextResponse.json({ error: "Missing uid or refresh token" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const query = FOLDER_QUERIES[folder.toUpperCase()] ?? `in:${folder.toLowerCase()}`;

    const response = await gmail.users.messages.list({
      userId: "me",
      q: query || undefined,
      maxResults: Math.min(maxResults, 100),
    });

    const messages = response.data.messages || [];

    if (messages.length === 0) {
      return NextResponse.json({ status: "success", emails: [], folder });
    }

    // Fetch full details for each message (parallel, max 50)
    const batch = messages.slice(0, 50);
    const emailDetails = await Promise.all(
      batch.map(async (msg) => {
        try {
          const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id as string,
            format: "full",
          });

          const headers = detail.data.payload?.headers || [];
          const subject = decodeText(headers.find((h) => h.name === "Subject")?.value || "No Subject");
          const from = headers.find((h) => h.name === "From")?.value || "Unknown Sender";
          const to = headers.find((h) => h.name === "To")?.value || "";
          const cc = headers.find((h) => h.name === "Cc")?.value || "";
          const replyTo = headers.find((h) => h.name === "Reply-To")?.value || "";
          const date = headers.find((h) => h.name === "Date")?.value || "";
          const messageIdHeader = headers.find((h) => h.name === "Message-ID")?.value || "";
          const internalDate = detail.data.internalDate ? parseInt(detail.data.internalDate, 10) : 0;
          const labelIds = detail.data.labelIds || [];

          // Extract body — prefer HTML, fallback to plain text
          let body = "";
          const payload = detail.data.payload;
          if (payload) {
            const htmlParts = findParts(payload, "text/html");
            const textParts = findParts(payload, "text/plain");

            if (htmlParts.length > 0 && htmlParts[0].body?.data) {
              body = Buffer.from(htmlParts[0].body.data, "base64url").toString("utf-8");
            } else if (textParts.length > 0 && textParts[0].body?.data) {
              const plainText = Buffer.from(textParts[0].body.data, "base64url").toString("utf-8");
              body = `<div style="white-space:pre-wrap;font-family:sans-serif;font-size:14px;line-height:1.6">${plainText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
            } else if (payload.body?.data) {
              body = Buffer.from(payload.body.data, "base64url").toString("utf-8");
            }
          }

          const attachments = payload ? getAttachments(payload) : [];

          return {
            id: detail.data.id,
            threadId: detail.data.threadId,
            snippet: decodeText(detail.data.snippet || ""),
            subject,
            from,
            to,
            cc,
            replyTo,
            date,
            messageId: messageIdHeader,
            internalDate,
            labelIds,
            body,
            attachments,
          };
        } catch (err) {
          console.warn(`[gmail-folders] Failed to fetch message ${msg.id}:`, err);
          return null;
        }
      })
    );

    // Filter out nulls and sort newest first
    const validEmails = emailDetails.filter(Boolean);
    validEmails.sort((a: any, b: any) => b.internalDate - a.internalDate);

    return NextResponse.json({ status: "success", emails: validEmails, folder });
  } catch (error: any) {
    console.error("Gmail Folders Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
