export interface ProductItem {
  image: string;
  name: string;
  price?: string;
  description: string;
  url?: string;
}

export interface ProductShowcaseData {
  headerText: string;
  products: ProductItem[];
  brandColor?: string;
  preheaderText?: string;
  footerText?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export function renderProductShowcase(data: ProductShowcaseData): string {
  const brand = data.brandColor || '#4F46E5';
  const preheader = data.preheaderText || '';
  const footer = data.footerText || '';
  const products = data.products.slice(0, 4);

  function renderProduct(product: ProductItem, width: number): string {
    const priceHtml = product.price
      ? `<p style="margin: 4px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 700; line-height: 24px; color: ${brand};">
           ${product.price}
         </p>`
      : '';
    const linkHtml = product.url
      ? `<p style="margin: 12px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; line-height: 20px;">
           <a href="${product.url}" target="_blank" style="color: ${brand}; text-decoration: none;">View details &rarr;</a>
         </p>`
      : '';

    return `<td width="${width}" valign="top" style="padding: 12px; background-color: #ffffff;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="padding: 0; background-color: #f9fafb;">
            <img src="${product.image}" alt="${product.name}" width="${width - 26}" style="display: block; width: 100%; height: auto; border: 0;" />
          </td>
        </tr>
        <tr>
          <td style="padding: 16px; background-color: #ffffff;">
            <h3 style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 700; line-height: 22px; color: #111827;">
              ${product.name}
            </h3>
            ${priceHtml}
            <p style="margin: 8px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 400; line-height: 20px; color: #6b7280;">
              ${product.description}
            </p>
            ${linkHtml}
          </td>
        </tr>
      </table>
    </td>`;
  }

  function renderProductGrid(): string {
    if (products.length === 1) {
      return `<tr>
        <td style="padding: 8px 28px; background-color: #ffffff;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              ${renderProduct(products[0], 520)}
            </tr>
          </table>
        </td>
      </tr>`;
    }

    const rows: string[] = [];
    for (let i = 0; i < products.length; i += 2) {
      const hasSecond = i + 1 < products.length;
      rows.push(`<tr>
        <td style="padding: 8px 28px; background-color: #ffffff;">
          <!--[if mso]>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520">
          <tr>
          <![endif]-->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              ${renderProduct(products[i], 248)}
              ${hasSecond ? renderProduct(products[i + 1], 248) : `<td width="248" style="padding: 12px; background-color: #ffffff;">&nbsp;</td>`}
            </tr>
          </table>
          <!--[if mso]>
          </tr>
          </table>
          <![endif]-->
        </td>
      </tr>`);
    }
    return rows.join('\n');
  }

  const ctaHtml = data.ctaText && data.ctaUrl
    ? `<!-- CTA Button -->
      <tr>
        <td align="center" style="padding: 16px 40px 40px 40px; background-color: #ffffff;">
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

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>${data.headerText}</title>
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

          <!-- Brand accent bar -->
          <tr>
            <td style="background-color: ${brand}; height: 4px; font-size: 1px; line-height: 1px;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 24px 40px; text-align: center; background-color: #ffffff;">
              <h1 style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 26px; font-weight: 700; line-height: 34px; color: #111827; letter-spacing: -0.3px;">
                ${data.headerText}
              </h1>
            </td>
          </tr>

          <!-- Product Grid -->
          ${renderProductGrid()}

          ${ctaHtml}

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
