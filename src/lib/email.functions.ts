// Helper interne (server-only) pour l'envoi d'emails via Resend.
// N'est PAS exporté en createServerFn : on l'appelle depuis d'autres
// server functions (invite, reset, etc.).

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

export async function sendEmailServer(input: SendEmailInput): Promise<{ id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY non configurée");

  const from = input.from ?? process.env.RESEND_FROM ?? "Setup Stock <onboarding@resend.dev>";
  const replyTo = input.replyTo ?? process.env.RESEND_REPLY_TO ?? "smart@setup.paris";

  const resp = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: replyTo,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend ${resp.status}: ${body}`);
  }

  return (await resp.json()) as { id?: string };
}

export function getAppBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ??
    process.env.SITE_URL ??
    "https://event-stock-pro.lovable.app"
  ).replace(/\/$/, "");
}
