export interface ImageForwardData {
  heroImage: string;
  bodyText?: string;
  ctaText?: string;
  ctaUrl?: string;
  brandColor?: string;
  preheaderText?: string;
  footerText?: string;
  senderName?: string;
  senderEmail?: string;
}

export function renderImageForward(data: ImageForwardData): string {
  const brand = data.brandColor || '#4F46E5';
  const preheader = data.preheaderText || '';
  const footer = data.footerText || '';

  const bodyHtml = data.bodyText
    ? `<!-- Body Text -->
      <tr>
        <td style="padding: 28px 40px 8px 40px; text-align: center; background-color: #ffffff;">
          <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 400; line-height: 26px; color: #4b5563;">
            ${data.bodyText}
          </p>
        </td>
      </tr>`
    : '';

  const ctaHtml = data.ctaText && data.ctaUrl
    ? `<!-- CTA Button -->
      <tr>
        <td align="center" style="padding: 24px 40px 8px 40px; background-color: #ffffff;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="border-radius: 8px; background-color: ${brand};">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${data.ctaUrl}" style="height:52px;v-text-anchor:middle;width:220px;" arcsize="15%" strokecolor="${brand}" fillcolor="${brand}">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;">
                  ${data.ctaText}
                </center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${data.ctaUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; background-color: ${brand}; text-align: center;">
                  ${data.ctaText}
                </a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';

  // Sender line
  const senderParts: string[] = [];
  if (data.senderName) senderParts.push(data.senderName);
  if (data.senderEmail) senderParts.push(`<a href="mailto:${data.senderEmail}" style="color: #9ca3af; text-decoration: none;">${data.senderEmail}</a>`);
  const senderHtml = senderParts.length > 0
    ? `<p style="margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 400; line-height: 20px; color: #9ca3af;">
        ${senderParts.join(' &middot; ')}
      </p>`
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

          <!-- Hero Image — the star of the email -->
          <tr>
            <td style="padding: 0; text-align: center; background-color: #ffffff;">
              ${data.ctaUrl
                ? `<a href="${data.ctaUrl}" target="_blank" style="text-decoration: none;">
                    <img src="${data.heroImage}" alt="" width="600" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; outline: none; text-decoration: none;" />
                  </a>`
                : `<img src="${data.heroImage}" alt="" width="600" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; outline: none; text-decoration: none;" />`
              }
            </td>
          </tr>

          ${bodyHtml}

          ${ctaHtml}

          <!-- Footer spacer -->
          <tr>
            <td style="padding: 24px 40px 0 40px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid #e5e7eb; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 12px 40px; text-align: center; background-color: #ffffff;">
              ${senderHtml}
              <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 400; line-height: 20px; color: #9ca3af;">
                ${footer}
              </p>
            </td>
          </tr>

          <!-- SOLTheory credit -->
          <tr>
            <td style="padding: 0 40px 20px 40px; text-align: center; background-color: #ffffff;">
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
