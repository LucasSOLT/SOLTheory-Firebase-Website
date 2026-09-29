import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { google } from "googleapis";
import { initAdmin } from "@/firebase/admin";
import { getFirestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Helper: Recursively find parts in MIME tree by mimeType
// (copied from gmail/folders route)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Helper: Extract attachment metadata from a MIME payload
// (copied from gmail/folders route)
// ---------------------------------------------------------------------------
function getAttachments(
  payload: any
): { filename: string; mimeType: string; size: number }[] {
  const attachments: { filename: string; mimeType: string; size: number }[] =
    [];
  function walk(part: any) {
    if (part.filename && part.filename.length > 0 && part.body) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
      });
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);
  return attachments;
}

// ---------------------------------------------------------------------------
// Helper: Decode RFC 2047 encoded words and HTML entities in email text.
// Fixes corrupted characters like "ÃâÃâ¢" and HTML entities like "&#39;"
// (copied from gmail/folders route)
// ---------------------------------------------------------------------------
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
      } catch {
        /* fallback to original */
      }
      return encoded;
    }
  );

  // Decode common HTML entities
  decoded = decoded
    .replace(/&#(\d+);/g, (_m, code) =>
      String.fromCharCode(parseInt(code, 10))
    )
    .replace(/&#x([0-9A-Fa-f]+);/g, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Clean up mojibake patterns (UTF-8 bytes misinterpreted as Latin-1)
  try {
    if (/[\xC2-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}/.test(decoded)) {
      const buf = Buffer.from(decoded, "latin1");
      const reDec = buf.toString("utf-8");
      if (!reDec.includes("\uFFFD") && reDec.length <= decoded.length) {
        decoded = reDec;
      }
    }
  } catch {
    /* keep original */
  }

  return decoded;
}

// ---------------------------------------------------------------------------
// OAuth key variants to search (in priority order)
// ---------------------------------------------------------------------------
const OAUTH_KEYS = [
  "gmailOAuth_campaigning",
  "gmailOAuth_jarvis",
  "gmailOAuth_morpheus",
  "gmailOAuth_email",
  "gmailOAuth_inbound-email",
  "gmailOAuth",
] as const;

// ---------------------------------------------------------------------------
// EmailResult shape returned per email
// ---------------------------------------------------------------------------
interface EmailResult {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  internalDate: number;
  labelIds: string[];
  body: string;
  attachments: { filename: string; mimeType: string; size: number }[];
}

// ---------------------------------------------------------------------------
// POST /api/crm/contact-emails
// Fetch Gmail emails involving a specific CRM contact's email address.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { contactEmail, sort, maxResults } = await req.json();

    // Validate required fields
    if (!contactEmail || typeof contactEmail !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid contactEmail" },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // Resolve the Gmail refresh token from the user's Firestore document
    // -----------------------------------------------------------------------
    initAdmin();
    const db = getFirestore();
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const data = userDoc.data();

    let refreshToken: string | null = null;
    for (const key of OAUTH_KEYS) {
      const token = data?.[key]?.refreshToken;
      if (token) {
        refreshToken = token;
        break;
      }
    }

    // No connected Gmail account — return gracefully
    if (!refreshToken) {
      return NextResponse.json({ connected: false, emails: [] });
    }

    // -----------------------------------------------------------------------
    // Build OAuth2 client & Gmail API instance
    // -----------------------------------------------------------------------
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // -----------------------------------------------------------------------
    // Search for messages involving this contact email
    // -----------------------------------------------------------------------
    const effectiveMax = Math.min(maxResults || 30, 50);

    const response = await gmail.users.messages.list({
      userId: "me",
      q: contactEmail,
      maxResults: effectiveMax,
    });

    const messages = response.data.messages || [];

    if (messages.length === 0) {
      return NextResponse.json({
        connected: true,
        emails: [],
        total: 0,
      });
    }

    // -----------------------------------------------------------------------
    // Fetch full details for each message in parallel
    // -----------------------------------------------------------------------
    const emailDetails = await Promise.all(
      messages.map(async (msg) => {
        try {
          const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id as string,
            format: "full",
          });

          const headers = detail.data.payload?.headers || [];
          const subject = decodeText(
            headers.find((h) => h.name === "Subject")?.value || "No Subject"
          );
          const from =
            headers.find((h) => h.name === "From")?.value || "Unknown Sender";
          const to = headers.find((h) => h.name === "To")?.value || "";
          const cc = headers.find((h) => h.name === "Cc")?.value || "";
          const date = headers.find((h) => h.name === "Date")?.value || "";
          const internalDate = detail.data.internalDate
            ? parseInt(detail.data.internalDate, 10)
            : 0;
          const labelIds = detail.data.labelIds || [];

          // Extract body — prefer HTML, fallback to plain text
          let body = "";
          const payload = detail.data.payload;
          if (payload) {
            const htmlParts = findParts(payload, "text/html");
            const textParts = findParts(payload, "text/plain");

            if (htmlParts.length > 0 && htmlParts[0].body?.data) {
              body = Buffer.from(htmlParts[0].body.data, "base64url").toString(
                "utf-8"
              );
            } else if (textParts.length > 0 && textParts[0].body?.data) {
              const plainText = Buffer.from(
                textParts[0].body.data,
                "base64url"
              ).toString("utf-8");
              body = `<div style="white-space:pre-wrap;font-family:sans-serif;font-size:14px;line-height:1.6">${plainText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
            } else if (payload.body?.data) {
              body = Buffer.from(payload.body.data, "base64url").toString(
                "utf-8"
              );
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
            date,
            internalDate,
            labelIds,
            body,
            attachments,
          } as EmailResult;
        } catch (err) {
          console.warn(
            `[contact-emails] Failed to fetch message ${msg.id}:`,
            err
          );
          return null;
        }
      })
    );

    // Filter out failed fetches
    const validEmails = emailDetails.filter(Boolean) as EmailResult[];

    // Sort by internalDate — ascending if sort==='asc', descending otherwise
    if (sort === "asc") {
      validEmails.sort((a, b) => a.internalDate - b.internalDate);
    } else {
      validEmails.sort((a, b) => b.internalDate - a.internalDate);
    }

    return NextResponse.json({
      connected: true,
      emails: validEmails,
      total: validEmails.length,
    });
  } catch (error: any) {
    console.error("[contact-emails]", error);

    // Handle expired / revoked Google OAuth token
    if (
      error?.code === 401 ||
      error?.message?.includes("invalid_grant") ||
      error?.message?.includes("Token has been expired or revoked")
    ) {
      return NextResponse.json({
        connected: false,
        tokenExpired: true,
        emails: [],
      });
    }

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
