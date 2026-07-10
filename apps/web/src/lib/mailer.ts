// ---------------------------------------------------------------------------
// Envio de e-mail: sem provedor real configurado ainda (mesma situação de
// Storage/Railway/EAS — handoff de infra pendente). Por ora só loga no console
// do servidor, o suficiente pra testar o fluxo de recuperação de senha em dev.
// Trocar por um provedor real (Resend, SES etc.) é só reescrever sendEmail.
// ---------------------------------------------------------------------------

export type EmailPayload = {
  to: string;
  subject: string;
  body: string;
};

export async function sendEmail(payload: EmailPayload): Promise<void> {
  console.log(`[mailer] para=${payload.to} assunto="${payload.subject}"\n${payload.body}`);
}
