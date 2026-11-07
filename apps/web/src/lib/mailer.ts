import { env } from "@judeu/env/server";

// ---------------------------------------------------------------------------
// Envio de e-mail. Com RESEND_API_KEY + MAIL_FROM, envia pela API do Resend;
// sem eles (dev), só escreve no log do servidor, como antes.
// ---------------------------------------------------------------------------

export type EmailPayload = {
  to: string;
  subject: string;
  body: string;
};

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    if (env.NODE_ENV === "production") {
      console.warn("[mailer] RESEND_API_KEY/MAIL_FROM ausentes: e-mail NÃO enviado");
    }
    console.log(`[mailer] para=${payload.to} assunto="${payload.subject}"\n${payload.body}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [payload.to],
      subject: payload.subject,
      text: payload.body,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
  }
}
