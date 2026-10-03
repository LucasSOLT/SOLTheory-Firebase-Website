// ============================================================================
// lib/onboarding-mailer.ts — Phase 4 transactional email (SERVER-ONLY)
//
// One place that builds + sends every onboarding-document email
// (Send & Archive, "awaiting your signature", re-request, ready-to-archive).
//
// Guarantees:
//   • EVERY dynamic value is HTML-escaped (names / notes are user-typed).
//   • Never throws — returns { ok, error } so a mail problem can never block
//     or roll back a signature, re-request, or archive.
//   • Subjects are stripped of CR/LF (header injection).
//   • ONBOARDING_EMAIL_SANDBOX=1 turns on SendGrid sandbox mode: the request is
//     fully validated by SendGrid but nothing is delivered (safe testing).
//   • Automatic emails honor an org kill switch (`onboardingEmailsEnabled`
//     === false on the org doc). The explicit "Send & Archive" click does not.
// ============================================================================

import sgMail from '@sendgrid/mail';
import type { Firestore } from 'firebase-admin/firestore';
import { getOrgConfig, getOrgLabel } from '@/lib/org-config';

const LOG_PREFIX = '[onboarding-mailer]';

/** Attachments above this size are replaced by a portal link (SendGrid caps a message at 30 MB). */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
export const isValidEmail = (e: unknown): e is string => typeof e === 'string' && e.length <= 254 && EMAIL_RE.test(e.trim());

/** Public base URL of the app (no trailing slash). */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.soltheory.com').replace(/\/+$/, '');
}

/** Absolute URL for an in-app path such as `/portal/dashboard/org/onboarding?sign=abc`. */
export function absoluteUrl(path: string): string {
  return `${appUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
}

export interface EmailDetailRow {
  label: string;
  value: string;
  /** Render value in a monospace face (hashes, ids). */
  mono?: boolean;
}

export interface EmailContent {
  heading: string;
  subheading?: string;
  /** Plain text paragraphs (escaped on render). */
  paragraphs: string[];
  details?: EmailDetailRow[];
  /** Highlighted quote box, e.g. a supervisor's re-request notes. */
  note?: { title: string; text: string };
  cta?: { label: string; url: string };
  footer?: string;
  /** Header accent color (hex). */
  accent?: string;
}

const safeAccent = (c?: string) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#4f46e5');
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : '#');

/** Pure renderer (exported so previews/tests can inspect the exact HTML). */
export function renderEmail(orgName: string, c: EmailContent): { html: string; text: string } {
  const accent = safeAccent(c.accent);
  const detailRows = (c.details || [])
    .map(
      (d) => `
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;width:34%;">${escapeHtml(d.label)}</td>
          <td style="padding:6px 0;color:#0f172a;font-size:13px;${d.mono ? "font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;word-break:break-all;" : ''}">${escapeHtml(d.value)}</td>
        </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:28px 14px;">
    <div style="background:${accent};border-radius:14px 14px 0 0;padding:28px 24px;">
      <h1 style="margin:0 0 4px 0;color:#ffffff;font-size:21px;font-weight:700;">${escapeHtml(c.heading)}</h1>
      ${c.subheading ? `<p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;">${escapeHtml(c.subheading)}</p>` : ''}
    </div>
    <div style="background:#ffffff;padding:26px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
      ${c.paragraphs.map((p) => `<p style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.6;">${escapeHtml(p)}</p>`).join('')}
      ${
        c.note
          ? `<div style="margin:0 0 18px 0;padding:14px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;">
               <div style="color:#92400e;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">${escapeHtml(c.note.title)}</div>
               <div style="color:#78350f;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(c.note.text)}</div>
             </div>`
          : ''
      }
      ${
        detailRows
          ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin:0 0 20px 0;">
               <table style="width:100%;border-collapse:collapse;">${detailRows}</table>
             </div>`
          : ''
      }
      ${
        c.cta
          ? `<p style="margin:0 0 6px 0;text-align:center;">
               <a href="${escapeHtml(safeUrl(c.cta.url))}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:10px;">${escapeHtml(c.cta.label)}</a>
             </p>`
          : ''
      }
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:16px 24px;text-align:center;">
      ${c.footer ? `<p style="margin:0 0 8px 0;color:#64748b;font-size:11px;line-height:1.5;">${escapeHtml(c.footer)}</p>` : ''}
      <p style="margin:0;color:#94a3b8;font-size:10px;">${escapeHtml(orgName)} &bull; Powered by SOLTheory</p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    c.heading,
    c.subheading || '',
    '',
    ...c.paragraphs,
    ...(c.note ? ['', `${c.note.title}:`, c.note.text] : []),
    ...((c.details || []).length ? ['', ...(c.details || []).map((d) => `${d.label}: ${d.value}`)] : []),
    ...(c.cta ? ['', `${c.cta.label}: ${c.cta.url}`] : []),
    ...(c.footer ? ['', c.footer] : []),
    '',
    `${orgName} - Powered by SOLTheory`,
  ]
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n');

  return { html, text };
}

export interface OnboardingEmailAttachment {
  filename: string;
  content: Buffer;
  type?: string;
}

export interface SendOnboardingEmailParams {
  orgId: string;
  to: string;
  subject: string;
  content: EmailContent;
  attachments?: OnboardingEmailAttachment[];
}

export interface MailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  /** True when SendGrid sandbox mode was on (validated but not delivered). */
  sandbox?: boolean;
}

/** Send one email. Never throws. */
export async function sendOnboardingEmail(p: SendOnboardingEmailParams): Promise<MailResult> {
  try {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) return { ok: false, error: 'Email service is not configured (missing SENDGRID_API_KEY).' };
    if (!isValidEmail(p.to)) return { ok: false, error: 'Invalid recipient email address.' };

    sgMail.setApiKey(apiKey);
    const orgName = getOrgLabel(p.orgId);
    const fromEmail = getOrgConfig(p.orgId)?.fromEmail || process.env.SENDGRID_FROM_EMAIL || 'noreply@soltheory.com';
    const sandbox = process.env.ONBOARDING_EMAIL_SANDBOX === '1';
    const { html, text } = renderEmail(orgName, p.content);

    const [res] = await sgMail.send({
      to: p.to.trim(),
      from: { email: fromEmail, name: orgName },
      subject: p.subject.replace(/[\r\n]+/g, ' ').slice(0, 200),
      html,
      text,
      ...(p.attachments?.length
        ? {
            attachments: p.attachments.map((a) => ({
              content: a.content.toString('base64'),
              filename: a.filename.replace(/[^\w.\- ]+/g, '_'),
              type: a.type || 'application/pdf',
              disposition: 'attachment' as const,
            })),
          }
        : {}),
      ...(sandbox ? { mailSettings: { sandboxMode: { enable: true } } } : {}),
    });
    const messageId = (res?.headers?.['x-message-id'] as string | undefined) || undefined;
    return { ok: true, messageId, sandbox };
  } catch (err: any) {
    const detail = err?.response?.body?.errors?.[0]?.message || err?.message || 'Unknown email error';
    console.warn(`${LOG_PREFIX} send to ${p.to} failed:`, detail);
    return { ok: false, error: String(detail).slice(0, 300) };
  }
}

/** Org kill switch for AUTOMATIC emails (defaults to enabled). Never throws. */
export async function automaticEmailsEnabled(db: Firestore, orgId: string): Promise<boolean> {
  try {
    const snap = await db.collection('orgs').doc(orgId).get();
    return snap.data()?.onboardingEmailsEnabled !== false;
  } catch {
    return true;
  }
}

/**
 * Exactly-once guard for automatic emails. Creates
 * `email_dispatch_log/{key}`; returns false if it already exists (skip).
 * Call `releaseDispatch` when the send FAILS so a retry can go through.
 */
export async function claimDispatch(db: Firestore, key: string): Promise<boolean> {
  try {
    await db
      .collection('email_dispatch_log')
      .doc(key.replace(/[\/\s]/g, '_').slice(0, 400))
      .create({ createdAt: Date.now() });
    return true;
  } catch (e: any) {
    if (e?.code === 6) return false; // ALREADY_EXISTS
    console.warn(`${LOG_PREFIX} claimDispatch(${key}) failed:`, e?.message || e);
    return false;
  }
}

export async function releaseDispatch(db: Firestore, key: string): Promise<void> {
  try {
    await db.collection('email_dispatch_log').doc(key.replace(/[\/\s]/g, '_').slice(0, 400)).delete();
  } catch { /* best-effort */ }
}
