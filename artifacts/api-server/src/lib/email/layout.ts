import { readEnv } from "./env";

export const BRAND_NAME = "ResumeSensei";
export const APP_URL = readEnv("APP_URL") || "https://resumesensei.com";
export const SUPPORT_EMAIL = "support@resumesensei.com";

/** Billing / subscription transactional sender — must be set in production. */
export function getBillingFromEmail(): string | undefined {
  return readEnv("BILLING_FROM_EMAIL");
}

/** Resumesensei primary indigo — matches app theme (hsl 231 84% 56%). */
const BRAND_PRIMARY = "#3558e6";
const BRAND_PRIMARY_DARK = "#2b47c9";
const BRAND_GRADIENT_END = "#6366f1";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailLayoutOptions = {
  preheader: string;
  headline: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
  footerNote?: string;
};

export function renderEmailLayout(options: EmailLayoutOptions): string {
  const preheader = escapeHtml(options.preheader);
  const headline = escapeHtml(options.headline);
  const footerNote = options.footerNote
    ? escapeHtml(options.footerNote)
    : `Questions? Reply to this email or contact us at ${SUPPORT_EMAIL}.`;

  const ctaBlock = options.cta
    ? `
      <tr>
        <td align="center" style="padding:8px 0 28px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" style="border-radius:10px;background:${BRAND_PRIMARY};">
                <a href="${escapeHtml(options.cta.href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background:${BRAND_PRIMARY};border:1px solid ${BRAND_PRIMARY_DARK};">
                  ${escapeHtml(options.cta.label)}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>${headline}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    html, body { margin:0 !important; padding:0 !important; height:100% !important; width:100% !important; }
    * { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    a { text-decoration:none; }
    @media only screen and (max-width:620px) {
      .email-container { width:100% !important; max-width:100% !important; }
      .email-padding { padding-left:20px !important; padding-right:20px !important; }
      .email-headline { font-size:24px !important; line-height:32px !important; }
      .detail-label { display:block !important; width:100% !important; padding-bottom:4px !important; }
      .detail-value { display:block !important; width:100% !important; text-align:left !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${preheader}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef2f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="border-radius:16px 16px 0 0;background:linear-gradient(135deg,${BRAND_PRIMARY} 0%,${BRAND_GRADIENT_END} 100%);background-color:${BRAND_PRIMARY};padding:28px 32px;" class="email-padding">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.85);">
                      ${BRAND_NAME}
                    </p>
                    <p style="margin:10px 0 0 0;font-size:14px;line-height:22px;color:rgba(255,255,255,0.92);">
                      AI Resume Builder &amp; ATS Resume Checker
                    </p>
                  </td>
                  <td align="right" valign="top" style="width:56px;">
                    <div style="display:inline-block;width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,0.18);text-align:center;line-height:44px;font-size:20px;color:#ffffff;font-weight:700;">
                      R
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:36px 32px 12px 32px;" class="email-padding">
              <h1 class="email-headline" style="margin:0 0 16px 0;font-size:28px;line-height:36px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">
                ${headline}
              </h1>
              ${options.bodyHtml}
            </td>
          </tr>
          ${ctaBlock}
          <tr>
            <td style="background-color:#ffffff;padding:0 32px 36px 32px;border-radius:0 0 16px 16px;" class="email-padding">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-top:1px solid #e2e8f0;padding-top:24px;">
                    <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;color:#64748b;">
                      ${footerNote}
                    </p>
                    <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">
                      &copy; ${new Date().getFullYear()} ${BRAND_NAME} &middot;
                      <a href="${APP_URL}" style="color:${BRAND_PRIMARY};">resumesensei.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderDetailsCard(rows: { label: string; value: string }[]): string {
  const rowHtml = rows
    .map(
      (row) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td class="detail-label" valign="top" style="width:42%;font-size:13px;line-height:20px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">
                  ${escapeHtml(row.label)}
                </td>
                <td class="detail-value" align="right" valign="top" style="width:58%;font-size:15px;line-height:22px;font-weight:600;color:#0f172a;">
                  ${escapeHtml(row.value)}
                </td>
              </tr>
            </table>
          </td>
        </tr>`,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
      <tr>
        <td style="padding:4px 20px 8px 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${rowHtml}
          </table>
        </td>
      </tr>
    </table>`;
}

export function renderParagraph(text: string): string {
  return `<p style="margin:0 0 16px 0;font-size:16px;line-height:26px;color:#334155;">${escapeHtml(text)}</p>`;
}

export function renderFeatureList(items: string[]): string {
  const lis = items
    .map(
      (item) =>
        `<li style="margin:0 0 10px 0;font-size:15px;line-height:24px;color:#334155;">${escapeHtml(item)}</li>`,
    )
    .join("");
  return `<ul style="margin:0 0 20px 0;padding:0 0 0 20px;">${lis}</ul>`;
}

export function formatPlanLabel(planType?: string): string {
  if (planType === "yearly") return "Pro Yearly";
  return "Pro Monthly";
}

export function formatPlanPrice(planType?: string): string {
  if (planType === "yearly") return "₹999 / year";
  return "₹99 / month";
}

export function formatUnixDate(unixSec?: number): string | undefined {
  if (!unixSec || !Number.isFinite(unixSec)) return undefined;
  return new Date(unixSec * 1000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
