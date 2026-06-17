import { Resend } from "resend";
import { getServerConfig } from "./config.server";

function getResend(): Resend | null {
  const { resendApiKey } = getServerConfig();
  if (!resendApiKey) return null;
  return new Resend(resendApiKey);
}

export async function sendWelcomeEmail(to: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping welcome email");
    return;
  }

  await resend.emails.send({
    from: "Sahil from WatchLater <sahil@watchlater.watch>",
    to,
    subject: "You just got smarter in 5 minutes",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @media only screen and (max-width: 600px) {
      .wrapper  { padding: 20px 12px !important; }
      .inner    { width: 100% !important; }
      .card     { padding: 24px 20px !important; border-radius: 16px !important; }
      .cta-cell { width: 100% !important; text-align: center !important; display: block !important; }
      .cta-a    { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#faf9f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td class="wrapper" style="background:#faf9f6;padding:40px 16px;">
        <table class="inner" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;margin:0 auto;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;">
              <span style="font-family:Georgia,serif;font-size:20px;font-weight:800;color:#1a1a1a;letter-spacing:-0.02em;">WatchLater</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="card" style="background:#ffffff;border:3px solid #1a1a1a;border-radius:24px;padding:36px 40px;">

              <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#1a1a1a;">
                You just turned a YouTube video into a 5-minute lesson. That's the whole idea behind WatchLater — we're glad it worked for you.
              </p>

              <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#1a1a1a;">
                We're still in early access, and you're on the list. We'll reach out when we open up more broadly.
              </p>

              <p style="margin:0 0 32px;font-size:16px;line-height:1.7;color:#1a1a1a;">
                In the meantime, you can keep using WatchLater anytime — just paste a YouTube URL and go.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td class="cta-cell" style="background:#2563eb;border:3px solid #1a1a1a;border-radius:14px;">
                    <a class="cta-a" href="https://watchlater.watch" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;line-height:1;">
                      Open WatchLater →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:32px 0 0;font-size:16px;line-height:1.7;color:#1a1a1a;">
                — Sahil
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;font-family:monospace;letter-spacing:0.05em;">
                YOU'RE RECEIVING THIS BECAUSE YOU SIGNED UP AT WATCHLATER.WATCH
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
}
