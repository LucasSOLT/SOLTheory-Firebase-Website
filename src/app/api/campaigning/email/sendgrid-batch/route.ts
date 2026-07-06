import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { verifyRequest } from "@/lib/api-auth";

// ---------------------------------------------------------------------------
// Client-side SendGrid Batch Sender (AUTHENTICATED)
// ---------------------------------------------------------------------------
// Called by the client-side campaign poller for large recipient lists.
// Requires a valid Firebase ID token in the Authorization header.
// Accepts pre-resolved messages (subject + html already merged per recipient).
// Sends in chunks of 100 with 200ms delay between chunks.
// ---------------------------------------------------------------------------

export const maxDuration = 300; // Vercel Pro: 5 minutes

const BATCH_CHUNK_SIZE = 100;
const BATCH_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  // ── Auth: verify Firebase ID token ──
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { messages, fromEmail, fromName } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "SendGrid not configured" }, { status: 500 });
    }

    sgMail.setApiKey(apiKey);

    const senderEmail = fromEmail || process.env.SENDGRID_FROM_EMAIL || "";
    const senderName = fromName || process.env.SENDGRID_FROM_NAME || "";

    let sentCount = 0;
    const errors: string[] = [];

    // Process in chunks
    for (let i = 0; i < messages.length; i += BATCH_CHUNK_SIZE) {
      const chunk = messages.slice(i, i + BATCH_CHUNK_SIZE);

      const sgMessages = chunk.map((msg: { to: string; subject: string; html: string }) => ({
        to: msg.to,
        from: { email: senderEmail, name: senderName || undefined },
        subject: msg.subject,
        html: msg.html,
      }));

      try {
        await sgMail.send(sgMessages);
        sentCount += chunk.length;
      } catch (batchErr: any) {
        // Fallback: try individually
        console.error(`[SendGrid Batch] Chunk failed, trying individually:`, batchErr?.message);
        for (const msg of sgMessages) {
          try {
            await sgMail.send(msg);
            sentCount++;
          } catch (indErr: any) {
            console.error(`[SendGrid Batch] Failed: ${msg.to}:`, indErr?.message);
            errors.push(`${msg.to}: ${indErr?.message}`);
          }
        }
      }

      // Rate-limit delay between chunks
      if (i + BATCH_CHUNK_SIZE < messages.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: errors.length,
      total: messages.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[SendGrid Batch] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
