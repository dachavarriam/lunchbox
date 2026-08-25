import webpush from "web-push";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushOutboxRow = {
  id: string;
  user_id: string;
  order_id: string | null;
  template_key: string;
  payload_json: string | null;
};

const pushCopy: Record<string, { title: string; body: string }> = {
  payment_approved: { title: "Pago confirmado", body: "Tu pago fue aprobado y el pedido pasó a cocina." },
  order_delivered: { title: "Almuerzo entregado", body: "La institución confirmó la entrega del almuerzo." },
  support_request_created: { title: "Nueva solicitud de ayuda", body: "Hay un nuevo mensaje de un cliente en Administración." },
  support_response: { title: "Respuesta de Pipiro", body: "Respondimos tu solicitud de ayuda. Puedes revisarla en la aplicación." },
};

function allowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLocaleLowerCase("en-US");
    return host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" ||
      host === "web.push.apple.com" || host.endsWith(".push.apple.com") || host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

export function validPushSubscription(value: unknown): value is {
  endpoint: string; expirationTime: number | null; keys: { p256dh: string; auth: string };
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = candidate.keys;
  return typeof candidate.endpoint === "string" && candidate.endpoint.length <= 2048 && allowedPushEndpoint(candidate.endpoint) &&
    (candidate.expirationTime === undefined || candidate.expirationTime === null ||
      (typeof candidate.expirationTime === "number" && Number.isFinite(candidate.expirationTime))) &&
    Boolean(keys && typeof keys === "object" && !Array.isArray(keys) &&
      typeof (keys as Record<string, unknown>).p256dh === "string" && String((keys as Record<string, unknown>).p256dh).length <= 256 &&
      typeof (keys as Record<string, unknown>).auth === "string" && String((keys as Record<string, unknown>).auth).length <= 128);
}

export async function processPushOutbox(env: Env): Promise<void> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT) return;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const outbox = await env.DB.prepare(
    `SELECT id, user_id, order_id, template_key, payload_json FROM notification_outbox
     WHERE channel = 'push' AND status = 'queued' AND available_at <= CURRENT_TIMESTAMP
     ORDER BY created_at LIMIT 50`,
  ).all<PushOutboxRow>();

  for (const message of outbox.results) {
    const claimed = await env.DB.prepare("UPDATE notification_outbox SET status = 'sending', attempts = attempts + 1 WHERE id = ? AND status = 'queued'")
      .bind(message.id).run();
    if (!claimed.meta.changes) continue;
    const subscriptions = await env.DB.prepare(
      "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ? AND is_active = 1",
    ).bind(message.user_id).all<PushSubscriptionRow>();
    const copy = pushCopy[message.template_key] ?? { title: "Pipiro", body: "Tienes una actualización de tu pedido." };
    const payload = JSON.stringify({ ...copy, url: "/?view=orders", tag: `${message.template_key}-${message.order_id ?? message.id}` });
    let delivered = 0;
    let lastError = subscriptions.results.length ? "No se pudo entregar a ningún dispositivo" : "El usuario no tiene dispositivos suscritos";
    for (const subscription of subscriptions.results) {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 3600 });
        delivered += 1;
        await env.DB.prepare("UPDATE push_subscriptions SET last_success_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(subscription.id).run();
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        lastError = error instanceof Error ? error.message.slice(0, 400) : "Error Web Push";
        await env.DB.prepare(
          `UPDATE push_subscriptions SET is_active = CASE WHEN ? IN (404, 410) THEN 0 ELSE is_active END,
           last_failure_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ).bind(statusCode, subscription.id).run();
      }
    }
    if (delivered) {
      await env.DB.prepare("UPDATE notification_outbox SET status = 'sent', sent_at = CURRENT_TIMESTAMP, last_error = NULL WHERE id = ?")
        .bind(message.id).run();
    } else {
      await env.DB.prepare(
        `UPDATE notification_outbox SET status = CASE WHEN attempts < 3 AND ? > 0 THEN 'queued' ELSE 'failed' END,
         available_at = CASE WHEN attempts < 3 AND ? > 0 THEN datetime('now', '+1 minute') ELSE available_at END,
         last_error = ? WHERE id = ?`,
      ).bind(subscriptions.results.length, subscriptions.results.length, lastError, message.id).run();
    }
  }
}
