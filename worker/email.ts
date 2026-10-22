/**
 * Processes the `email` channel of notification_outbox via Resend.
 * Needs the RESEND_API_KEY secret; until it's configured this is a no-op, so
 * nothing breaks, it just means the queued emails won't be sent yet.
 */

type EmailEnv = Env & { RESEND_API_KEY?: string };

type EmailOutboxRow = {
  id: string;
  recipient_email: string | null;
  template_key: string;
};

const emailCopy: Record<string, { subject: string; body: string }> = {
  payment_approved: { subject: "Tu pago fue aprobado", body: "Tu pago fue aprobado y el pedido pasó a cocina." },
  payment_amount_mismatch: { subject: "Revisa el monto de tu pago", body: "El monto recibido no coincide con el total de tu pedido. Entra a Pipiro para resolverlo." },
  payment_receipt_requested: { subject: "Necesitamos tu comprobante", body: "Envía el comprobante de tu transferencia para que podamos confirmar tu pedido." },
  payment_receipt_reminder: { subject: "Tu pedido sigue pendiente", body: "Aún necesitamos tu comprobante para procesar el pedido." },
  payment_rejected: { subject: "No pudimos aprobar tu comprobante", body: "Revisa tu pedido y envía un nuevo comprobante." },
  payment_cancelled: { subject: "Tu pedido fue cancelado", body: "Administración canceló tu pedido. Revisa los detalles en Pipiro." },
  order_delivered: { subject: "Tu almuerzo fue entregado", body: "La institución confirmó la entrega del almuerzo." },
  support_request_created: { subject: "Nueva solicitud de ayuda", body: "Hay un nuevo mensaje de un cliente en Administración." },
  support_response: { subject: "Respondimos tu solicitud", body: "Respondimos tu solicitud de ayuda. Puedes revisarla en Pipiro." },
};

function emailHtml(subject: string, body: string, appUrl: string): string {
  return `<!doctype html><html><body style="font-family:-apple-system,Arial,sans-serif;color:#26344d;max-width:480px;margin:0 auto;padding:24px;">
<h1 style="font-size:20px;margin:0 0 12px;">${subject}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 20px;">${body}</p>
<p><a href="${appUrl}" style="display:inline-block;background:#2c3a57;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;">Abrir Pipiro</a></p>
</body></html>`;
}

export async function processEmailOutbox(env: Env): Promise<void> {
  const emailEnv: EmailEnv = env;
  if (!emailEnv.RESEND_API_KEY || !env.EMAIL_FROM) return;
  const appUrl = `${env.APP_ORIGIN ?? ""}/?view=orders`;

  const outbox = await env.DB.prepare(
    `SELECT o.id, COALESCE(o.recipient_email, u.email) AS recipient_email, o.template_key
     FROM notification_outbox o LEFT JOIN app_users u ON u.id = o.user_id
     WHERE o.channel = 'email' AND o.status = 'queued' AND o.available_at <= CURRENT_TIMESTAMP
     ORDER BY o.created_at LIMIT 25`,
  ).all<EmailOutboxRow>();

  for (const message of outbox.results) {
    const claimed = await env.DB.prepare(
      "UPDATE notification_outbox SET status = 'sending', attempts = attempts + 1 WHERE id = ? AND status = 'queued'",
    ).bind(message.id).run();
    if (!claimed.meta.changes) continue;

    if (!message.recipient_email) {
      await env.DB.prepare("UPDATE notification_outbox SET status = 'failed', last_error = ? WHERE id = ?")
        .bind("No hay correo del destinatario registrado", message.id).run();
      continue;
    }

    const copy = emailCopy[message.template_key] ?? { subject: "Pipiro", body: "Tienes una actualización de tu pedido." };
    let lastError: string | null = null;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${emailEnv.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: message.recipient_email,
          subject: copy.subject,
          html: emailHtml(copy.subject, copy.body, appUrl),
          text: `${copy.body}\n\n${appUrl}`,
        }),
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`Resend respondió ${response.status}: ${errorBody.slice(0, 300)}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message.slice(0, 400) : "No se pudo enviar el correo";
    }

    if (!lastError) {
      await env.DB.prepare("UPDATE notification_outbox SET status = 'sent', sent_at = CURRENT_TIMESTAMP, last_error = NULL WHERE id = ?")
        .bind(message.id).run();
    } else {
      await env.DB.prepare(
        `UPDATE notification_outbox SET status = CASE WHEN attempts < 3 THEN 'queued' ELSE 'failed' END,
         available_at = CASE WHEN attempts < 3 THEN datetime('now', '+2 minutes') ELSE available_at END,
         last_error = ? WHERE id = ?`,
      ).bind(lastError, message.id).run();
    }
  }
}
