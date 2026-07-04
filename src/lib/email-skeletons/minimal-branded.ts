export interface MinimalBrandedData {
  logoImage?: string;
  bodyHtml: string;
  brandColor?: string;
  preheaderText?: string;
  senderName?: string;
  senderTitle?: string;
  senderEmail?: string;
  senderPhone?: string;
  companyWebsite?: string;
}

export function renderMinimalBranded(data: MinimalBrandedData): string {
  const brand = data.brandColor || '#4F46E5';
  const preheader = data.preheaderText || '';

  const logoHtml = data.logoImage
    ? `<!-- Logo -->
      <tr>
        <td align="center" style="padding: 20px 40px; background-color: ${brand};">
          <img src="${data.logoImage}" alt="Logo" width="120" style="display: block; width: 120px; height: auto; border: 0;" />
        </td>
      </tr>`
    : `<!-- Brand bar (no logo) -->
      <tr>
        <td style="background-color: ${brand}; height: 6px; font-size: 1px; line-height: 1px;">&nbsp;</td>
      </tr>`;

  // Build sender info lines
  const senderLines: string[] = [];
  if (data.senderName) {
    const titlePart = data.senderTitle ? ` &middot; ${data.senderTitle}` : '';
    senderLines.push(
      `<p style="margin: 0 0 4px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; line-height: 20px; color: #374151;">
        ${data.senderName}${titlePart}
      </p>`
    );
  }
  if (data.senderEmail) {
    senderLines.push(
      `<p style="margin: 0 0 2px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 400; line-height: 20px; color: #6b7280;">
        <a href="mailto:${data.senderEmail}" style="color: #6b7280; text-decoration: none;">${data.senderEmail}</a>
      </p>`
    );
  }
  if (data.senderPhone) {
    senderLines.push(
      `<p style="margin: 0 0 2px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 400; line-height: 20px; color: #6b7280;">
        ${data.senderPhone}
      </p>`
    );
  }
  if (data.companyWebsite) {
    senderLines.push(
      `<p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 400; line-height: 20px;">
        <a href="${data.companyWebsite}" target="_blank" style="color: ${brand}; text-decoration: none;">${data.companyWebsite.replace(/^https?:\/\//, '')}</a>
      </p>`
    );
  }

  const senderInfoHtml = senderLines.length > 0
    ? `<!-- Sender Info -->
      <tr>
        <td style="padding: 24px 40px; background-color: #f9fafb;">
          ${senderLines.join('\n          ')}
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>Email</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f4f4f5;">
  <!-- Preheader -->
  <span style="display: none; font-size: 1px; color: #f4f4f5; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader}${'&#847; &zwnj; &nbsp; '.repeat(30)}
  </span>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0; padding: 0; background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 24px 0;">

        <!--[if mso]>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" align="center">
        <tr>
        <td>
        <![endif]-->

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">

          ${logoHtml}

          <!-- Freeform Body Content -->
          <tr>
            <td style="padding: 36px 40px; background-color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 26px; color: #374151;">
              ${data.bodyHtml}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid #e5e7eb; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          ${senderInfoHtml}

          <!-- Bottom brand bar -->
          <tr>
            <td style="padding: 0 40px; background-color: ${senderLines.length > 0 ? '#f9fafb' : '#ffffff'};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="border-top: 2px solid ${brand}; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SOLTheory credit -->
          <tr>
            <td style="padding: 16px 40px 20px 40px; text-align: center; background-color: ${senderLines.length > 0 ? '#f9fafb' : '#ffffff'};">
              <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 400; line-height: 16px; color: #d1d5db;">
                Sent via SOLTheory
              </p>
            </td>
          </tr>

        </table>

        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->

      </td>
    </tr>
  </table>
</body>
</html>`;
}
