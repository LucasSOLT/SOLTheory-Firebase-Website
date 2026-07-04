export interface NewsletterSection {
  image?: string;
  title: string;
  text: string;
  linkUrl?: string;
  linkText?: string;
}

export interface NewsletterData {
  logoImage?: string;
  headerTitle: string;
  sections: NewsletterSection[];
  brandColor?: string;
  preheaderText?: string;
  footerText?: string;
}

export function renderNewsletter(data: NewsletterData): string {
  const brand = data.brandColor || '#4F46E5';
  const preheader = data.preheaderText || '';
  const footer = data.footerText || '';
  const sections = data.sections.slice(0, 6);

  function renderSection(section: NewsletterSection, index: number): string {
    const isEven = index % 2 === 0;
    const hasImage = !!section.image;
    const linkHtml = section.linkUrl
      ? `<p style="margin: 16px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; line-height: 20px;">
           <a href="${section.linkUrl}" target="_blank" style="color: ${brand}; text-decoration: none;">${section.linkText || 'Read more'} &rarr;</a>
         </p>`
      : '';

    if (!hasImage) {
      return `<!-- Section ${index + 1}: Text Only -->
      <tr>
        <td style="padding: 32px 40px; background-color: #ffffff;">
          <h2 style="margin: 0 0 12px 0; font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: 700; line-height: 28px; color: #111827;">
            ${section.title}
          </h2>
          <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 400; line-height: 24px; color: #4b5563;">
            ${section.text}
          </p>
          ${linkHtml}
        </td>
      </tr>`;
    }

    const imageCell = `<td width="200" valign="top" style="padding: 0; background-color: #ffffff;">
      <img src="${section.image}" alt="${section.title}" width="200" style="display: block; width: 200px; height: auto; border: 0; border-radius: 6px;" />
    </td>`;

    const textCell = `<td valign="top" style="padding: ${hasImage ? '0 0 0 24px' : '0'}; background-color: #ffffff;">
      <h2 style="margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 700; line-height: 24px; color: #111827;">
        ${section.title}
      </h2>
      <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 400; line-height: 22px; color: #4b5563;">
        ${section.text}
      </p>
      ${linkHtml}
    </td>`;

    const firstCell = isEven ? imageCell : textCell;
    const secondCell = isEven ? textCell : imageCell;

    return `<!-- Section ${index + 1}: Image + Text -->
    <tr>
      <td style="padding: 32px 40px; background-color: #ffffff;">
        <!--[if mso]>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520">
        <tr>
        <![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            ${firstCell}
            ${secondCell}
          </tr>
        </table>
        <!--[if mso]>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>`;
  }

  function renderDivider(): string {
    return `<tr>
      <td style="padding: 0 40px; background-color: #ffffff;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="border-top: 1px solid #e5e7eb; font-size: 1px; line-height: 1px;">&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>`;
  }

  const sectionRows = sections
    .map((section, i) => {
      const sectionHtml = renderSection(section, i);
      const divider = i < sections.length - 1 ? renderDivider() : '';
      return sectionHtml + divider;
    })
    .join('\n');

  const logoHtml = data.logoImage
    ? `<img src="${data.logoImage}" alt="Logo" width="140" style="display: block; width: 140px; height: auto; border: 0; margin: 0 auto 16px auto;" />`
    : '';

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>${data.headerTitle}</title>
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

          <!-- Header bar -->
          <tr>
            <td style="background-color: ${brand}; padding: 28px 40px; text-align: center;">
              ${logoHtml}
              <h1 style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: 700; line-height: 32px; color: #ffffff; letter-spacing: -0.3px;">
                ${data.headerTitle}
              </h1>
            </td>
          </tr>

          <!-- Sections -->
          ${sectionRows}

          <!-- Footer divider -->
          <tr>
            <td style="padding: 0 40px; background-color: #ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid #e5e7eb; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 16px 40px; text-align: center; background-color: #ffffff;">
              <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 400; line-height: 20px; color: #9ca3af;">
                ${footer}
              </p>
            </td>
          </tr>

          <!-- SOLTheory credit -->
          <tr>
            <td style="padding: 0 40px 24px 40px; text-align: center; background-color: #ffffff;">
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
