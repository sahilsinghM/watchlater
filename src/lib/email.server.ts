import { Resend } from "resend";
import { parseServerEnv } from "./serverEnv";

function getResend(): Resend | null {
  const { resendApiKey } = parseServerEnv(process.env as Record<string, string | undefined>);
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
</head>
<body style="margin:0;padding:0;background:#faf9f6;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;">
              <span style="font-family:'Georgia',serif;font-size:20px;font-weight:800;color:#1a1a1a;letter-spacing:-0.02em;">WatchLater</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border:3px solid #1a1a1a;border-radius:24px;padding:36px 40px;box-shadow:4px 4px 0 #1a1a1a;">

              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#1a1a1a;">
                You just turned a YouTube video into a 5-minute lesson. That's the whole idea behind WatchLater — we're glad it worked for you.
              </p>

              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#1a1a1a;">
                We're still in early access, and you're on the list. We'll reach out when we open up more broadly.
              </p>

              <p style="margin:0 0 32px;font-size:16px;line-height:1.6;color:#1a1a1a;">
                In the meantime, you can keep using WatchLater anytime — just paste a YouTube URL and go.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#2563eb;border:3px solid #1a1a1a;border-radius:16px;box-shadow:3px 3px 0 #1a1a1a;">
                    <a href="https://watchlater.watch" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                      Open WatchLater →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:32px 0 0;font-size:16px;line-height:1.6;color:#1a1a1a;">
                — Sahil
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#6b7280;font-family:'JetBrains Mono',monospace;">
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
