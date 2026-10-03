// ============================================================================
// lib/send-signed-copy.ts
//
// Server-side utility that emails a finalized signed PDF copy to the signer.
// This satisfies ESIGN Act § 7001(c)(1)(C)(i) — mandatory copy delivery.
//
// Uses SendGrid to dispatch a branded transactional email with the PDF
// attached as a base64-encoded file.
// ============================================================================

import sgMail from '@sendgrid/mail';
import { escapeHtml } from '@/lib/onboarding-mailer';

export interface SendSignedCopyInput {
  /** Signer's email address */
  recipientEmail: string;
  /** Signer's display name */
  recipientName: string;
  /** Title of the signed document (e.g., "HIPAA Confidentiality Agreement") */
  documentTitle: string;
  /** The PDF buffer to attach */
  pdfBuffer: Buffer;
  /** File name for the attachment (e.g., "HIPAA_Agreement.pdf") */
  fileName: string;
  /** Document Version ID for reference */
  documentVersionId: string;
  /** ISO timestamp when the document was signed */
  signedAt: string;
  /** Organization name for branding */
  orgName: string;
  /** From email (falls back to env default) */
  fromEmail?: string;
  /** From name (falls back to env default) */
  fromName?: string;
}

/**
 * Sends a copy of the signed PDF to the signer via SendGrid.
 * This is a legal requirement under the ESIGN Act.
 *
 * Returns true on success, false on failure (best-effort — should not
 * block the signing flow).
 */
export async function sendSignedCopy(input: SendSignedCopyInput): Promise<boolean> {
  try {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.error('[sendSignedCopy] SENDGRID_API_KEY not configured — cannot send signed copy email');
      return false;
    }

    sgMail.setApiKey(apiKey);

    const fromEmail = input.fromEmail || process.env.SENDGRID_FROM_EMAIL || 'noreply@soltheory.com';
    const fromName = input.fromName || process.env.SENDGRID_FROM_NAME || input.orgName;

    const signedDate = new Date(input.signedAt).toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    });

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 12px 12px 0 0; padding: 32px 24px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 8px 0;">
        Your Signed Document
      </h1>
      <p style="color: #94a3b8; font-size: 14px; margin: 0;">
        Electronic Signature Confirmation
      </p>
    </div>

    <!-- Body -->
    <div style="background: #ffffff; padding: 32px 24px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
      <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        Hi ${escapeHtml(input.recipientName)},
      </p>
      <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        This email confirms that you electronically signed the following document. A copy of the signed document is attached to this email as a PDF for your records.
      </p>

      <!-- Document details card -->
      <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; border: 1px solid #e2e8f0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-size: 13px; font-weight: 600;">Document:</td>
            <td style="padding: 4px 0; color: #1e293b; font-size: 13px; font-weight: 700;">${escapeHtml(input.documentTitle)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-size: 13px; font-weight: 600;">Signed At:</td>
            <td style="padding: 4px 0; color: #1e293b; font-size: 13px;">${signedDate}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-size: 13px; font-weight: 600;">Version ID:</td>
            <td style="padding: 4px 0; color: #1e293b; font-size: 12px; font-family: monospace;">${escapeHtml(input.documentVersionId)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-size: 13px; font-weight: 600;">Organization:</td>
            <td style="padding: 4px 0; color: #1e293b; font-size: 13px;">${escapeHtml(input.orgName)}</td>
          </tr>
        </table>
      </div>

      <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">
        📎 <strong>Your signed copy is attached as a PDF.</strong>
      </p>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 24px 0;">
        Please save this email and the attached PDF for your personal records. You can also view your signed documents at any time from your onboarding dashboard.
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; border-radius: 0 0 12px 12px; padding: 20px 24px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
      <p style="color: #94a3b8; font-size: 11px; line-height: 1.5; margin: 0;">
        This electronic signature was provided in accordance with the ESIGN Act (15 U.S.C. § 7001 et seq.)
        and carries the same legal weight as a handwritten signature.
      </p>
      <p style="color: #cbd5e1; font-size: 10px; margin: 8px 0 0 0;">
        ${escapeHtml(input.orgName)} • Powered by SOLTheory
      </p>
    </div>
  </div>
</body>
</html>`;

    await sgMail.send({
      to: input.recipientEmail,
      from: { email: fromEmail, name: fromName },
      subject: `Your Signed Copy — ${input.documentTitle}`,
      html: htmlBody,
      attachments: [
        {
          content: input.pdfBuffer.toString('base64'),
          filename: input.fileName,
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    });

    console.log(`[sendSignedCopy] Signed copy emailed to ${input.recipientEmail} for "${input.documentTitle}"`);
    return true;
  } catch (err: any) {
    console.error('[sendSignedCopy] Failed to email signed copy:', err.message || err);
    return false;
  }
}
