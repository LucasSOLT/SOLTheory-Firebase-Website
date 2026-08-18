import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/firebase/admin";
import { getFirestore } from "firebase-admin/firestore";
import sendgrid from "@sendgrid/mail";

// ---------------------------------------------------------------------------
// In-memory IP-based rate limiter — 5 submissions per IP per 15 minutes
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5;

const ipHits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);

  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Periodic cleanup to prevent unbounded memory growth (runs at most once per cycle)
let lastCleanup = Date.now();
function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < RATE_LIMIT_WINDOW_MS) return;
  lastCleanup = now;
  for (const [ip, entry] of ipHits) {
    if (now > entry.resetAt) ipHits.delete(ip);
  }
}

export async function POST(req: NextRequest) {
  try {
    // --- Rate limiting ---
    cleanupStaleEntries();
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { name, email, subject, message } = body || {};

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    const trimmedName = String(name).trim();
    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedSubject = String(subject || "General Inquiry").trim();
    const trimmedMessage = String(message).trim();

    // 1. Save to Firestore
    await initAdmin();
    const db = getFirestore();
    const docRef = await db.collection("contact_submissions").add({
      name: trimmedName,
      email: trimmedEmail,
      subject: trimmedSubject,
      message: trimmedMessage,
      createdAt: new Date().toISOString(),
      status: "Unread",
      source: "soltheory.com/contact"
    });

    // 2. Send notification email via SendGrid if configured
    const sendGridKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@soltheory.com";
    if (sendGridKey) {
      try {
        sendgrid.setApiKey(sendGridKey);
        await sendgrid.send({
          to: ["lucas@soltheory.com", "team@soltheory.com"],
          from: fromEmail,
          replyTo: trimmedEmail,
          subject: `[SOL Theory Contact] ${trimmedSubject} - from ${trimmedName}`,
          text: `New contact submission received from soltheory.com:\n\nName: ${trimmedName}\nEmail: ${trimmedEmail}\nSubject: ${trimmedSubject}\n\nMessage:\n${trimmedMessage}\n\nSubmission ID: ${docRef.id}`,
          html: `<div style="font-family: sans-serif; padding: 20px;">
            <h2>New Contact Submission</h2>
            <p><strong>Name:</strong> ${trimmedName}</p>
            <p><strong>Email:</strong> <a href="mailto:${trimmedEmail}">${trimmedEmail}</a></p>
            <p><strong>Subject:</strong> ${trimmedSubject}</p>
            <hr />
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap; background: #f4f4f5; padding: 12px; rounded: 8px;">${trimmedMessage}</p>
          </div>`
        });
      } catch (sgError) {
        console.warn("[API/Contact] Failed to send email via SendGrid:", sgError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Message received successfully. We will get back to you soon!",
      submissionId: docRef.id
    });
  } catch (error: any) {
    console.error("[API/Contact] Error processing contact submission:", error);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}
