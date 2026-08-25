/** Cloudflare Worker entry point for Pipiro by Solo México. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleCmsApi, handlePublicMedia } from "./cms";
import { authorizeRequest, authorizeSurface, handleAuthApi, requestSurface } from "./auth";
import { processPushOutbox, validPushSubscription } from "./push";

const jsonHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

type DishRow = Record<string, string | number | null> & { id: string };
type OptionGroupRow = Record<string, string | number | null> & { id: string; dish_id: string };
type OptionRow = Record<string, string | number | null> & { id: string; group_id: string };
type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  delivery_notes: string | null;
  grade: string;
  section: string;
  classroom_name: string | null;
  building: string | null;
  guide_teacher: string;
  allergies: string | null;
};
type DemoOrderRow = {
  id: string;
  order_number: string;
  status: string;
  total_cents: number;
  service_date: string;
  service_type: string;
  delivery_time: string;
  student_name: string;
  classroom: string;
  dish: string;
  allergies: string | null;
  payment_status: string;
  payment_method: string;
  customer_reference: string | null;
  receipt_object_key: string | null;
  receipt_original_name: string | null;
  receipt_submitted_at: string | null;
  payment_batch_id: string | null;
  checkout_number: string | null;
  payment_expires_at: string | null;
  created_at: string;
  prep_time_minutes: number;
  stage_started_at: string;
  kitchen_started_at: string | null;
  ready_at: string | null;
  packed_at: string | null;
  print_jobs_queued: number;
};

type OrderItemInput = {
  dishId: string;
  quantity: number;
  selections: Record<string, string>;
  notes: string;
};

type CreateOrderInput = {
  studentId: string;
  serviceType: "breakfast" | "lunch";
  serviceDate: string;
  notes: string;
  requestKey: string;
  paymentMethod: "bank_transfer" | "card";
  items: OrderItemInput[];
};

type StudentInput = {
  firstName: string;
  lastName: string;
  grade: string;
  section: string;
  deliveryNotes: string;
  allergies: string[];
};

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: { ...jsonHeaders, ...init?.headers },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOrderItem(value: unknown): OrderItemInput | null {
  if (!isRecord(value) || typeof value.dishId !== "string" ||
      typeof value.quantity !== "number" || !Number.isInteger(value.quantity) ||
      value.quantity < 1 || value.quantity > 20 || !isRecord(value.selections) ||
      typeof value.notes !== "string" || value.notes.length > 180) return null;

  const selections: Record<string, string> = {};
  for (const [groupId, optionId] of Object.entries(value.selections)) {
    if (typeof optionId !== "string") return null;
    selections[groupId] = optionId;
  }
  return { dishId: value.dishId, quantity: value.quantity, selections, notes: value.notes.trim() };
}

function parseCreateOrder(value: unknown): CreateOrderInput | null {
  if (!isRecord(value) || typeof value.studentId !== "string" ||
      value.serviceType !== "lunch" ||
      typeof value.serviceDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.serviceDate) ||
      (value.paymentMethod !== "bank_transfer" && value.paymentMethod !== "card") ||
      typeof value.notes !== "string" || value.notes.length > 300 ||
      typeof value.requestKey !== "string" || value.requestKey.length < 8 || value.requestKey.length > 100 ||
      !Array.isArray(value.items) || value.items.length < 1 || value.items.length > 30) return null;
  const items = value.items.map(parseOrderItem);
  if (items.some((item) => item === null)) return null;
  return {
    studentId: value.studentId,
    serviceType: value.serviceType,
    serviceDate: value.serviceDate,
    notes: value.notes.trim(),
    requestKey: value.requestKey,
    paymentMethod: value.paymentMethod,
    items: items.filter((item): item is OrderItemInput => item !== null),
  };
}

function parseStudent(value: unknown): StudentInput | null {
  if (!isRecord(value) || typeof value.firstName !== "string" || typeof value.lastName !== "string" ||
      typeof value.grade !== "string" || typeof value.section !== "string" ||
      typeof value.deliveryNotes !== "string" || !Array.isArray(value.allergies)) return null;
  const firstName = value.firstName.trim();
  const lastName = value.lastName.trim();
  const deliveryNotes = value.deliveryNotes.trim();
  const allowedGrades = new Set(["Nursery", "Prekinder", "Kinder", "1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°", "11°", "12°"]);
  if (firstName.length < 1 || firstName.length > 80 || lastName.length < 1 || lastName.length > 80 ||
      !allowedGrades.has(value.grade) || !["A", "B", "C", "D", "E"].includes(value.section) ||
      deliveryNotes.length > 240 || value.allergies.length > 10) return null;
  const allergies = value.allergies.map((allergy) => typeof allergy === "string" ? allergy.trim() : "")
    .filter(Boolean);
  if (allergies.some((allergy) => allergy.length > 80)) return null;
  return { firstName, lastName, grade: value.grade, section: value.section, deliveryNotes, allergies };
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 64_000) throw new Error("request_too_large");
  return request.json<unknown>();
}

async function validReceiptSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (file.type === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  if (file.type === "image/heic" || file.type === "image/heif") {
    const brand = String.fromCharCode(...bytes.slice(4, 12));
    return brand.startsWith("ftyp") && ["heic", "heix", "hevc", "hevx", "mif1"].includes(brand.slice(4));
  }
  return false;
}

function assertDemoMode(env: Env): Response | null {
  return env.DEMO_MODE === "true" ? null : json({ error: "Demo mode disabled" }, { status: 404 });
}

function hondurasDateId(timestamp = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function previousDateId(dateId: string): string {
  const date = new Date(`${dateId}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function advanceOrderCutoff(dateId: string): Date {
  return new Date(`${previousDateId(dateId)}T23:59:59-06:00`);
}

function cancellationCutoff(dateId: string): Date {
  return new Date(`${previousDateId(dateId)}T20:00:00-06:00`);
}

function serviceWeekday(dateId: string): number {
  return new Date(`${dateId}T12:00:00Z`).getUTCDay();
}

function isSchoolLunchDay(dateId: string): boolean {
  return [1, 2, 4, 5].includes(serviceWeekday(dateId));
}

function defaultMenuOfDayDishId(dateId: string): string | null {
  return ({ 1: "dish_day_mon", 2: "dish_day_tue", 4: "dish_day_thu", 5: "dish_day_fri" } as Record<number, string>)[serviceWeekday(dateId)] ?? null;
}

async function expireUnpaidBatches(env: Env): Promise<void> {
  const expired = await env.DB.prepare(
    `SELECT id FROM payment_batches
     WHERE status = 'pending' AND receipt_object_key IS NULL AND datetime(expires_at) <= datetime('now')`,
  ).all<{ id: string }>();
  for (const batch of expired.results) {
    await env.DB.batch([
      env.DB.prepare("UPDATE payment_batches SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(batch.id),
      env.DB.prepare(
        `UPDATE menu_items SET remaining = remaining + COALESCE((
           SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id
           JOIN payment_batch_orders pbo ON pbo.order_id = o.id
           WHERE pbo.payment_batch_id = ? AND o.menu_day_id = menu_items.menu_day_id AND oi.dish_id = menu_items.dish_id
             AND o.status = 'submitted'
         ), 0)
         WHERE remaining IS NOT NULL AND EXISTS (
           SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN payment_batch_orders pbo ON pbo.order_id = o.id
           WHERE pbo.payment_batch_id = ? AND o.menu_day_id = menu_items.menu_day_id AND oi.dish_id = menu_items.dish_id
             AND o.status = 'submitted'
         )`,
      ).bind(batch.id, batch.id),
      env.DB.prepare(
        `UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE id IN (SELECT order_id FROM payment_batch_orders WHERE payment_batch_id = ?)
           AND status = 'submitted'`,
      ).bind(batch.id),
    ]);
  }
}

async function loadDemoOrders(env: Env, actorUserId: string | null, excludeDemoActor = false): Promise<DemoOrderRow[]> {
  await expireUnpaidBatches(env);
  const result = await env.DB.prepare(
    `SELECT o.id, o.order_number, o.status, o.total_cents, o.created_at,
            md.service_date, sw.service_type, sw.delivery_time,
            s.first_name || ' ' || s.last_name AS student_name,
            c.grade || ' ' || c.section || ' · ' || COALESCE(c.classroom_name, '') AS classroom,
            o.allergy_snapshot AS allergies,
            GROUP_CONCAT(oi.dish_name_snapshot || ' ×' || oi.quantity ||
              CASE WHEN TRIM(COALESCE(oi.item_notes, '')) <> '' THEN ' · CAMBIO: ' || TRIM(oi.item_notes) ELSE '' END, ' · ') AS dish,
            MAX(COALESCE(d.prep_time_minutes, 15)) AS prep_time_minutes,
            COALESCE((SELECT MAX(ose.created_at) FROM order_status_events ose WHERE ose.order_id = o.id AND ose.to_status = o.status), o.updated_at, o.created_at) AS stage_started_at,
            (SELECT MIN(ose.created_at) FROM order_status_events ose WHERE ose.order_id = o.id AND ose.to_status = 'preparing') AS kitchen_started_at,
            (SELECT MIN(ose.created_at) FROM order_status_events ose WHERE ose.order_id = o.id AND ose.to_status = 'ready') AS ready_at,
            (SELECT MIN(ose.created_at) FROM order_status_events ose WHERE ose.order_id = o.id AND ose.to_status = 'packed') AS packed_at,
            (SELECT COUNT(*) FROM print_jobs pj WHERE pj.order_id = o.id AND pj.status IN ('queued', 'printing', 'printed')) AS print_jobs_queued,
            COALESCE(pb.status, pt.status, 'pending') AS payment_status,
            COALESCE(pb.payment_method, pt.payment_method, 'bank_transfer') AS payment_method,
            COALESCE(pb.customer_reference, pt.customer_reference) AS customer_reference,
            COALESCE(pb.receipt_object_key, pt.receipt_object_key) AS receipt_object_key,
            COALESCE(pb.receipt_original_name, pt.receipt_original_name) AS receipt_original_name,
            COALESCE(pb.receipt_submitted_at, pt.receipt_submitted_at) AS receipt_submitted_at,
            pb.id AS payment_batch_id, pb.checkout_number, pb.expires_at AS payment_expires_at
     FROM orders o
     JOIN students s ON s.id = o.student_id
     LEFT JOIN classrooms c ON c.id = s.classroom_id
     JOIN menu_days md ON md.id = o.menu_day_id
     JOIN service_windows sw ON sw.id = md.service_window_id
     JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN dishes d ON d.id = oi.dish_id
     LEFT JOIN payment_transfers pt ON pt.order_id = o.id
     LEFT JOIN payment_batch_orders pbo ON pbo.order_id = o.id
     LEFT JOIN payment_batches pb ON pb.id = pbo.payment_batch_id
     WHERE (? IS NULL OR o.guardian_user_id = ?)
       AND (? = 0 OR o.guardian_user_id != 'user_demo_family')
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT 100`,
  ).bind(actorUserId, actorUserId, excludeDemoActor ? 1 : 0).all<DemoOrderRow>();
  return result.results;
}

async function handleDemoApi(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/demo/")) return null;
  const disabled = assertDemoMode(env);
  if (disabled) return disabled;

  const kitchenRequest = url.pathname === "/api/demo/kds" || url.pathname === "/api/demo/kds/deliver-all" || /^\/api\/demo\/orders\/[^/]+\/(status|print)$/.test(url.pathname);
  const adminBootstrapRequest = url.pathname === "/api/demo/bootstrap" &&
    (requestSurface(url, env) === "admin" || (requestSurface(url, env) === null && url.searchParams.get("surface") === "admin"));
  const authorization = await authorizeRequest(
    request,
    env,
    url,
    kitchenRequest ? ["admin", "kitchen"] : adminBootstrapRequest ? ["admin"] : ["customer"],
    kitchenRequest || adminBootstrapRequest ? "user_admin_dachavarriam" : "user_demo_family",
  );
  if (authorization.response || !authorization.actor) return authorization.response;
  const actorUserId = authorization.actor.userId;

  if (request.method === "GET" && url.pathname === "/api/demo/bootstrap") {
    const [user, studentResult, orders, credit, issues, support, notifications] = await Promise.all([
      env.DB.prepare("SELECT id, display_name, email, locale FROM app_users WHERE id = ? LIMIT 1")
        .bind(actorUserId).first(),
      env.DB.prepare(
        `SELECT s.id, s.first_name, s.last_name, s.delivery_notes,
                c.grade, c.section, c.classroom_name, c.building, c.guide_teacher,
                GROUP_CONCAT(sa.allergen, '||') AS allergies
         FROM students s
         JOIN classrooms c ON c.id = s.classroom_id
         LEFT JOIN student_allergies sa ON sa.student_id = s.id AND sa.is_active = 1
         WHERE s.guardian_user_id = ? AND s.is_active = 1
         GROUP BY s.id
         ORDER BY s.created_at`,
      ).bind(actorUserId).all<StudentRow>(),
      loadDemoOrders(env, adminBootstrapRequest ? null : actorUserId, adminBootstrapRequest),
      env.DB.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS balance_cents FROM credit_ledger WHERE user_id = ?")
        .bind(actorUserId).first<{ balance_cents: number }>(),
      env.DB.prepare(
        `SELECT pi.*, pb.checkout_number FROM payment_issues pi JOIN payment_batches pb ON pb.id = pi.payment_batch_id
         WHERE pb.guardian_user_id = ? AND pi.status != 'resolved' ORDER BY pi.created_at DESC`,
      ).bind(actorUserId).all(),
      env.DB.prepare(
        "SELECT id, order_id, category, subject, message, status, created_at FROM support_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
      ).bind(actorUserId).all(),
      env.DB.prepare("SELECT id, order_id, template_key, status, created_at FROM notifications WHERE user_id = ? AND channel = 'in_app' ORDER BY created_at DESC LIMIT 30")
        .bind(actorUserId).all(),
    ]);
    return json({
      demo: authorization.actor.demo,
      user,
      students: studentResult.results.map((student) => ({
        ...student,
        allergies: student.allergies ? student.allergies.split("||") : [],
      })),
      orders,
      creditBalanceCents: credit?.balance_cents ?? 0,
      paymentIssues: issues.results,
      supportRequests: support.results,
      notifications: notifications.results,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/demo/notifications/read-all") {
    await env.DB.prepare("UPDATE notifications SET status = 'read' WHERE user_id = ? AND channel = 'in_app' AND status != 'read'")
      .bind(actorUserId).run();
    return json({ ok: true });
  }

  if (request.method === "GET" && url.pathname === "/api/demo/notifications/push-config") {
    const active = await env.DB.prepare("SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id = ? AND is_active = 1")
      .bind(actorUserId).first<{ count: number }>();
    return json({ enabled: Boolean(env.VAPID_PUBLIC_KEY), publicKey: env.VAPID_PUBLIC_KEY || null, activeDevices: Number(active?.count ?? 0) });
  }

  if (request.method === "POST" && url.pathname === "/api/demo/notifications/subscribe") {
    const body = await readBoundedJson(request);
    if (!validPushSubscription(body)) return json({ error: "Suscripción push inválida" }, { status: 400 });
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, expiration_time, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth,
       expiration_time = excluded.expiration_time, user_agent = excluded.user_agent, is_active = 1, updated_at = CURRENT_TIMESTAMP`,
    ).bind(id, actorUserId, body.endpoint, body.keys.p256dh, body.keys.auth, body.expirationTime,
      (request.headers.get("user-agent") ?? "").slice(0, 300) || null).run();
    return json({ ok: true }, { status: 201 });
  }

  if (request.method === "DELETE" && url.pathname === "/api/demo/notifications/subscribe") {
    const body = await readBoundedJson(request);
    if (!isRecord(body) || typeof body.endpoint !== "string") return json({ error: "Suscripción inválida" }, { status: 400 });
    await env.DB.prepare("UPDATE push_subscriptions SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND endpoint = ?")
      .bind(actorUserId, body.endpoint).run();
    return json({ ok: true });
  }

  if (request.method === "POST" && url.pathname === "/api/demo/notifications/test") {
    await env.DB.prepare(
      "INSERT INTO notification_outbox (id, user_id, channel, template_key) VALUES (?, ?, 'push', 'push_test')",
    ).bind(crypto.randomUUID(), actorUserId).run();
    return json({ ok: true, message: "La notificación de prueba se enviará en menos de un minuto" }, { status: 202 });
  }

  if (request.method === "POST" && url.pathname === "/api/demo/payment-batches") {
    const body = await readBoundedJson(request);
    if (!isRecord(body) || !Array.isArray(body.orderIds) || body.orderIds.length < 1 || body.orderIds.length > 10 ||
        body.orderIds.some((id) => typeof id !== "string") || typeof body.requestKey !== "string" || body.requestKey.length < 8 ||
        typeof body.bankAccountId !== "string" ||
        typeof body.creditCents !== "number" || !Number.isInteger(body.creditCents) || body.creditCents < 0) {
      return json({ error: "Checkout inválido" }, { status: 400 });
    }
    const priorBatch = await env.DB.prepare(
      `SELECT pb.id, pb.checkout_number, pb.status, pb.subtotal_cents, pb.credit_applied_cents, pb.amount_due_cents, pb.expires_at
       FROM payment_batch_request_keys prk JOIN payment_batches pb ON pb.id = prk.payment_batch_id
       WHERE prk.request_key = ? AND prk.actor_user_id = ? LIMIT 1`,
    ).bind(body.requestKey, actorUserId).first<{
      id: string; checkout_number: string; status: string; subtotal_cents: number; credit_applied_cents: number; amount_due_cents: number; expires_at: string;
    }>();
    if (priorBatch) return json({ paymentBatch: { id: priorBatch.id, checkoutNumber: priorBatch.checkout_number, status: priorBatch.status,
      subtotalCents: priorBatch.subtotal_cents, creditAppliedCents: priorBatch.credit_applied_cents,
      amountDueCents: priorBatch.amount_due_cents, expiresAt: priorBatch.expires_at }, duplicate: true });
    const uniqueOrderIds = [...new Set(body.orderIds as string[])];
    if (uniqueOrderIds.length !== body.orderIds.length) return json({ error: "Hay pedidos duplicados" }, { status: 400 });
    const placeholders = uniqueOrderIds.map(() => "?").join(",");
    const orderResult = await env.DB.prepare(
      `SELECT o.id, o.total_cents, o.status, md.service_date FROM orders o JOIN menu_days md ON md.id = o.menu_day_id
       WHERE o.guardian_user_id = ? AND o.id IN (${placeholders})`,
    ).bind(actorUserId, ...uniqueOrderIds).all<{ id: string; total_cents: number; status: string; service_date: string }>();
    if (orderResult.results.length !== uniqueOrderIds.length || orderResult.results.some((order) => order.status !== "submitted")) {
      return json({ error: "Uno de los pedidos no está disponible" }, { status: 409 });
    }
    const existingLinks = await env.DB.prepare(
      `SELECT order_id FROM payment_batch_orders WHERE order_id IN (${placeholders})`,
    ).bind(...uniqueOrderIds).all();
    if (existingLinks.results.length) return json({ error: "Uno de los pedidos ya pertenece a otro pago" }, { status: 409 });
    const subtotal = orderResult.results.reduce((sum, order) => sum + order.total_cents, 0);
    const bankAccount = await env.DB.prepare("SELECT id FROM bank_accounts WHERE id = ? AND is_active = 1 LIMIT 1")
      .bind(body.bankAccountId).first<{ id: string }>();
    if (!bankAccount) return json({ error: "Selecciona una cuenta bancaria disponible" }, { status: 409 });
    const balance = await env.DB.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS value FROM credit_ledger WHERE user_id = ?")
      .bind(actorUserId).first<{ value: number }>();
    const creditApplied = Math.min(body.creditCents, balance?.value ?? 0, subtotal);
    const amountDue = subtotal - creditApplied;
    const firstDeliveryDate = orderResult.results.map((order) => order.service_date).sort()[0];
    const expiresAt = advanceOrderCutoff(firstDeliveryDate).toISOString();
    if (Date.now() >= new Date(expiresAt).getTime()) return json({ error: "El pago ya venció" }, { status: 409 });
    const batchId = crypto.randomUUID();
    const checkoutNumber = `C-${firstDeliveryDate.replaceAll("-", "").slice(2)}-${batchId.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
    const status = amountDue === 0 ? "approved" : "pending";
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO payment_batches (id, checkout_number, guardian_user_id, payment_method, status, subtotal_cents,
          credit_applied_cents, amount_due_cents, expires_at, bank_account_id, reviewed_at, review_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
          CASE WHEN ? = 'approved' THEN 'Pagado con crédito Pipiro' ELSE NULL END)`,
      ).bind(batchId, checkoutNumber, actorUserId, amountDue === 0 ? "credit" : creditApplied ? "credit_transfer" : "bank_transfer",
        status, subtotal, creditApplied, amountDue, expiresAt, bankAccount.id, status, status),
      ...uniqueOrderIds.map((orderId) => env.DB.prepare(
        "INSERT INTO payment_batch_orders (payment_batch_id, order_id) VALUES (?, ?)",
      ).bind(batchId, orderId)),
      env.DB.prepare("INSERT INTO payment_batch_request_keys (request_key, actor_user_id, payment_batch_id) VALUES (?, ?, ?)")
        .bind(body.requestKey, actorUserId, batchId),
      ...(creditApplied ? [env.DB.prepare(
        `INSERT INTO credit_ledger (id, user_id, amount_cents, entry_type, reason, payment_batch_id, created_by_user_id)
         VALUES (?, ?, ?, 'checkout_debit', 'Crédito aplicado al checkout', ?, ?)`,
      ).bind(crypto.randomUUID(), actorUserId, -creditApplied, batchId, actorUserId)] : []),
      ...(status === "approved" ? uniqueOrderIds.map((orderId) => env.DB.prepare(
        "UPDATE orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).bind(orderId)) : []),
    ]);
    return json({ paymentBatch: { id: batchId, checkoutNumber, status, subtotalCents: subtotal, creditAppliedCents: creditApplied, amountDueCents: amountDue, expiresAt }, orderIds: uniqueOrderIds }, { status: 201 });
  }

  if (request.method === "POST" && url.pathname === "/api/demo/orders") {
    const input = parseCreateOrder(await readBoundedJson(request));
    if (!input) return json({ error: "Invalid order" }, { status: 400 });
    if (input.paymentMethod === "card") {
      return json({ error: "El pago con tarjeta estará disponible próximamente. Selecciona transferencia para continuar." }, { status: 409 });
    }

    const prior = await env.DB.prepare(
      `SELECT o.id, o.order_number, o.status, o.total_cents
       FROM demo_request_keys rk JOIN orders o ON o.id = rk.order_id
       WHERE rk.request_key = ? AND rk.actor_user_id = ? LIMIT 1`,
    ).bind(input.requestKey, actorUserId).first();
    if (prior) return json({ order: prior, duplicate: true });

    const student = await env.DB.prepare(
      `SELECT s.id, GROUP_CONCAT(sa.allergen, ', ') AS allergies
       FROM students s LEFT JOIN student_allergies sa ON sa.student_id = s.id AND sa.is_active = 1
       WHERE s.id = ? AND s.guardian_user_id = ? AND s.is_active = 1 GROUP BY s.id`,
    ).bind(input.studentId, actorUserId).first<{ id: string; allergies: string | null }>();
    if (!student) return json({ error: "Student not found" }, { status: 404 });

    const serviceWindow = await env.DB.prepare(
      `SELECT id, delivery_time, cutoff_time FROM service_windows
       WHERE school_id = (SELECT id FROM schools WHERE slug = ?) AND service_type = ? AND is_active = 1 LIMIT 1`,
    ).bind(env.DEFAULT_SCHOOL_SLUG, input.serviceType).first<{ id: string; delivery_time: string; cutoff_time: string }>();
    if (!serviceWindow) return json({ error: "Service unavailable" }, { status: 409 });

    const exception = await env.DB.prepare(
      `SELECT status, COALESCE(cutoff_time, ?) AS cutoff_time
       FROM service_window_exceptions WHERE service_window_id = ? AND service_date = ? LIMIT 1`,
    ).bind(serviceWindow.cutoff_time, serviceWindow.id, input.serviceDate)
      .first<{ status: string; cutoff_time: string }>();
    if (exception && exception.status !== "open") return json({ error: "Los pedidos están cerrados para esta fecha" }, { status: 409 });
    if (input.serviceDate <= hondurasDateId()) {
      return json({ error: "Los almuerzos deben pedirse con al menos un día de anticipación" }, { status: 409 });
    }
    if (!isSchoolLunchDay(input.serviceDate)) {
      return json({ error: "No hay servicio de almuerzo escolar los miércoles ni fines de semana" }, { status: 409 });
    }
    const cutoff = advanceOrderCutoff(input.serviceDate);
    if (!Number.isFinite(cutoff.getTime()) || Date.now() >= cutoff.getTime()) {
      return json({ error: "El pedido cerró a las 11:59 p. m. del día anterior" }, { status: 409 });
    }

    const existingMenuDay = await env.DB.prepare(
      "SELECT id, status FROM menu_days WHERE school_id = 'school_eis' AND service_window_id = ? AND service_date = ? LIMIT 1",
    ).bind(serviceWindow.id, input.serviceDate).first<{ id: string; status: string }>();
    if (existingMenuDay && existingMenuDay.status !== "published") {
      return json({ error: "Menu is not published for this date" }, { status: 409 });
    }

    const dishIds = [...new Set(input.items.map((item) => item.dishId))];
    const placeholders = dishIds.map(() => "?").join(",");
    const dishResult = await env.DB.prepare(
      `SELECT d.id, d.name_es, d.price_cents, c.slug AS category_slug
       FROM dishes d JOIN categories c ON c.id = d.category_id
       WHERE d.is_active = 1 AND d.id IN (${placeholders})`,
    ).bind(...dishIds).all<{ id: string; name_es: string; price_cents: number; category_slug: string }>();
    const dishMap = new Map(dishResult.results.map((dish) => [dish.id, dish]));
    if (dishMap.size !== dishIds.length) return json({ error: "A dish is unavailable" }, { status: 409 });
    if (existingMenuDay) {
      const scheduled = await env.DB.prepare("SELECT dish_id, remaining FROM menu_items WHERE menu_day_id = ?")
        .bind(existingMenuDay.id).all<{ dish_id: string; remaining: number | null }>();
      const scheduledMap = new Map(scheduled.results.map((row) => [row.dish_id, row.remaining]));
      for (const item of input.items) {
        const dish = dishMap.get(item.dishId)!;
        if (dish.category_slug === "especiales" && !scheduledMap.has(item.dishId)) {
          return json({ error: "Special dish is not scheduled for this date" }, { status: 409 });
        }
        const remaining = scheduledMap.get(item.dishId);
        if (remaining !== undefined && remaining !== null && remaining < item.quantity) {
          return json({ error: "Dish capacity is no longer available" }, { status: 409 });
        }
      }
    } else {
      const defaultDailyDishId = defaultMenuOfDayDishId(input.serviceDate);
      for (const item of input.items) {
        const dish = dishMap.get(item.dishId)!;
        if (dish.category_slug === "especiales" && item.dishId !== defaultDailyDishId) {
          return json({ error: "El Menú del día no corresponde a la fecha seleccionada" }, { status: 409 });
        }
      }
    }

    const optionDeltas = new Map<OrderItemInput, number>();
    for (const item of input.items) {
      let optionDelta = 0;
      const groupResult = await env.DB.prepare(
        "SELECT id FROM dish_option_groups WHERE dish_id = ? AND is_active = 1 AND min_select > 0",
      ).bind(item.dishId).all<{ id: string }>();
      if (groupResult.results.some((group) => !item.selections[group.id])) {
        return json({ error: "Required dish option missing" }, { status: 400 });
      }
      for (const [groupId, optionId] of Object.entries(item.selections)) {
        const valid = await env.DB.prepare(
          `SELECT o.id, o.price_delta_cents FROM dish_options o JOIN dish_option_groups g ON g.id = o.group_id
           WHERE o.id = ? AND o.group_id = ? AND g.dish_id = ? AND o.is_active = 1 AND g.is_active = 1 LIMIT 1`,
        ).bind(optionId, groupId, item.dishId).first<{ id: string; price_delta_cents: number }>();
        if (!valid) return json({ error: "Invalid dish option" }, { status: 400 });
        optionDelta += valid.price_delta_cents;
      }
      optionDeltas.set(item, optionDelta);
    }

    const total = input.items.reduce((sum, item) =>
      sum + ((dishMap.get(item.dishId)?.price_cents ?? 0) + (optionDeltas.get(item) ?? 0)) * item.quantity, 0);
    const orderId = crypto.randomUUID();
    const suffix = orderId.replaceAll("-", "").slice(0, 6).toUpperCase();
    const orderNumber = `P-${input.serviceDate.replaceAll("-", "").slice(2)}-${suffix}`;
    const menuDayId = existingMenuDay?.id ?? `demo_${input.serviceDate}_${input.serviceType}`;
    const eventId = crypto.randomUUID();
    const transferId = crypto.randomUUID();

    const statements = [
      env.DB.prepare(
        `INSERT INTO menu_days (id, school_id, service_window_id, service_date, status, published_at)
         VALUES (?, 'school_eis', ?, ?, 'published', CURRENT_TIMESTAMP)
         ON CONFLICT(school_id, service_window_id, service_date) DO NOTHING`,
      ).bind(menuDayId, serviceWindow.id, input.serviceDate),
      env.DB.prepare(
        `INSERT INTO orders (id, order_number, guardian_user_id, student_id, menu_day_id, status,
          subtotal_cents, total_cents, allergy_snapshot, special_instructions, submitted_at)
         VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      ).bind(orderId, orderNumber, actorUserId, input.studentId, menuDayId, total, total, student.allergies, input.notes),
      ...input.items.map((item) => {
        const dish = dishMap.get(item.dishId)!;
        return env.DB.prepare(
          `INSERT INTO order_items (id, order_id, dish_id, dish_name_snapshot, unit_price_cents, quantity, item_notes, options_snapshot_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(crypto.randomUUID(), orderId, item.dishId, dish.name_es, dish.price_cents + (optionDeltas.get(item) ?? 0), item.quantity, item.notes, JSON.stringify(item.selections));
      }),
      env.DB.prepare(
        "INSERT INTO order_status_events (id, order_id, from_status, to_status, actor_user_id, note) VALUES (?, ?, NULL, 'submitted', ?, 'Pedido demo creado')",
      ).bind(eventId, orderId, actorUserId),
      env.DB.prepare(
        "INSERT INTO payment_transfers (id, order_id, payment_method, status) VALUES (?, ?, 'bank_transfer', 'pending')",
      ).bind(transferId, orderId),
      env.DB.prepare(
        "INSERT INTO demo_request_keys (request_key, actor_user_id, order_id) VALUES (?, ?, ?)",
      ).bind(input.requestKey, actorUserId, orderId),
      ...(existingMenuDay ? input.items.map((item) => env.DB.prepare(
        `UPDATE menu_items SET remaining = CASE WHEN remaining IS NULL THEN NULL ELSE remaining - ? END
         WHERE menu_day_id = ? AND dish_id = ? AND (remaining IS NULL OR remaining >= ?)`,
      ).bind(item.quantity, menuDayId, item.dishId, item.quantity)) : []),
    ];
    await env.DB.batch(statements);

    return json({
      order: { id: orderId, orderNumber, status: "submitted", paymentStatus: "pending", paymentMethod: "bank_transfer", totalCents: total },
      duplicate: false,
    }, { status: 201 });
  }

  if (request.method === "POST" && url.pathname === "/api/demo/students") {
    const input = parseStudent(await readBoundedJson(request));
    if (!input) return json({ error: "Invalid student profile" }, { status: 400 });
    const classroom = await env.DB.prepare(
      "SELECT id FROM classrooms WHERE school_id = 'school_eis' AND grade = ? AND section = ? AND is_active = 1 LIMIT 1",
    ).bind(input.grade, input.section).first<{ id: string }>();
    if (!classroom) return json({ error: "Classroom not found" }, { status: 409 });
    const studentId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO students (id, guardian_user_id, school_id, classroom_id, first_name, last_name, delivery_notes)
         VALUES (?, ?, 'school_eis', ?, ?, ?, ?)`,
      ).bind(studentId, actorUserId, classroom.id, input.firstName, input.lastName, input.deliveryNotes),
      ...input.allergies.map((allergen) => env.DB.prepare(
        "INSERT INTO student_allergies (id, student_id, allergen) VALUES (?, ?, ?)",
      ).bind(crypto.randomUUID(), studentId, allergen)),
      env.DB.prepare(
        "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, 'student.created', 'student', ?)",
      ).bind(crypto.randomUUID(), actorUserId, studentId),
    ]);
    return json({ studentId }, { status: 201 });
  }

  const studentMatch = url.pathname.match(/^\/api\/demo\/students\/([^/]+)$/);
  if (request.method === "PATCH" && studentMatch) {
    const input = parseStudent(await readBoundedJson(request));
    if (!input) return json({ error: "Invalid student profile" }, { status: 400 });
    const [owned, classroom] = await Promise.all([
      env.DB.prepare("SELECT id FROM students WHERE id = ? AND guardian_user_id = ? AND is_active = 1 LIMIT 1")
        .bind(studentMatch[1], actorUserId).first(),
      env.DB.prepare("SELECT id FROM classrooms WHERE school_id = 'school_eis' AND grade = ? AND section = ? AND is_active = 1 LIMIT 1")
        .bind(input.grade, input.section).first<{ id: string }>(),
    ]);
    if (!owned) return json({ error: "Student not found" }, { status: 404 });
    if (!classroom) return json({ error: "Classroom not found" }, { status: 409 });
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE students SET classroom_id = ?, first_name = ?, last_name = ?, delivery_notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND guardian_user_id = ?`,
      ).bind(classroom.id, input.firstName, input.lastName, input.deliveryNotes, studentMatch[1], actorUserId),
      env.DB.prepare("DELETE FROM student_allergies WHERE student_id = ?").bind(studentMatch[1]),
      ...input.allergies.map((allergen) => env.DB.prepare(
        "INSERT INTO student_allergies (id, student_id, allergen) VALUES (?, ?, ?)",
      ).bind(crypto.randomUUID(), studentMatch[1], allergen)),
      env.DB.prepare(
        "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, 'student.updated', 'student', ?)",
      ).bind(crypto.randomUUID(), actorUserId, studentMatch[1]),
    ]);
    return json({ ok: true, studentId: studentMatch[1] });
  }

  if (request.method === "DELETE" && studentMatch) {
    const result = await env.DB.prepare(
      "UPDATE students SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND guardian_user_id = ? AND is_active = 1",
    ).bind(studentMatch[1], actorUserId).run();
    if (!result.meta.changes) return json({ error: "Student not found" }, { status: 404 });
    await env.DB.prepare(
      "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, 'student.deactivated', 'student', ?)",
    ).bind(crypto.randomUUID(), actorUserId, studentMatch[1]).run();
    return json({ ok: true });
  }

  const statusMatch = url.pathname.match(/^\/api\/demo\/orders\/([^/]+)\/status$/);
  if (request.method === "PATCH" && statusMatch) {
    const body = await readBoundedJson(request);
    if (!isRecord(body) || typeof body.status !== "string") return json({ error: "Invalid status" }, { status: 400 });
    const transitions: Record<string, string[]> = {
      submitted: ["confirmed", "cancelled"], confirmed: ["preparing", "cancelled"],
      preparing: ["ready"], ready: ["packed"], packed: ["out_for_delivery"],
      out_for_delivery: ["delivered"], delivered: [], cancelled: [], draft: ["submitted"],
    };
    const order = await env.DB.prepare("SELECT id, status FROM orders WHERE id = ? LIMIT 1")
      .bind(statusMatch[1]).first<{ id: string; status: string }>();
    if (!order) return json({ error: "Order not found" }, { status: 404 });
    if (!transitions[order.status]?.includes(body.status)) return json({ error: "Invalid transition" }, { status: 409 });
    const printType = body.status === "preparing" ? "kitchen_ticket" : body.status === "packed" ? "package_label" : null;
    const statements: D1PreparedStatement[] = [
      env.DB.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(body.status, order.id),
      env.DB.prepare(
        "INSERT INTO order_status_events (id, order_id, from_status, to_status, actor_user_id, note) VALUES (?, ?, ?, ?, ?, 'Actualización desde KDS')",
      ).bind(crypto.randomUUID(), order.id, order.status, body.status, actorUserId),
    ];
    if (printType) statements.push(env.DB.prepare(
      `INSERT INTO print_jobs (id, order_id, job_type, requested_by_user_id)
       SELECT ?, ?, ?, ? WHERE NOT EXISTS (
         SELECT 1 FROM print_jobs WHERE order_id = ? AND job_type = ? AND status IN ('queued', 'printing', 'printed')
       )`,
    ).bind(crypto.randomUUID(), order.id, printType, actorUserId, order.id, printType));
    await env.DB.batch(statements);
    return json({ ok: true, orderId: order.id, status: body.status });
  }

  const printMatch = url.pathname.match(/^\/api\/demo\/orders\/([^/]+)\/print$/);
  if (request.method === "POST" && printMatch) {
    const body = await readBoundedJson(request);
    if (!isRecord(body) || !["kitchen_ticket", "package_label"].includes(String(body.jobType))) {
      return json({ error: "Tipo de impresión inválido" }, { status: 400 });
    }
    const order = await env.DB.prepare("SELECT id FROM orders WHERE id = ? AND status NOT IN ('cancelled', 'delivered') LIMIT 1")
      .bind(printMatch[1]).first<{ id: string }>();
    if (!order) return json({ error: "Pedido no encontrado" }, { status: 404 });
    const jobId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO print_jobs (id, order_id, job_type, requested_by_user_id) VALUES (?, ?, ?, ?)",
    ).bind(jobId, order.id, body.jobType, actorUserId).run();
    return json({ id: jobId, status: "queued" }, { status: 201 });
  }

  const cancelMatch = url.pathname.match(/^\/api\/demo\/orders\/([^/]+)\/cancel$/);
  if (request.method === "POST" && cancelMatch) {
    const order = await env.DB.prepare(
      `SELECT o.id, o.status, o.total_cents, md.service_date, pbo.payment_batch_id, pb.status AS payment_status
       FROM orders o JOIN menu_days md ON md.id = o.menu_day_id
       LEFT JOIN payment_batch_orders pbo ON pbo.order_id = o.id
       LEFT JOIN payment_batches pb ON pb.id = pbo.payment_batch_id
       WHERE o.id = ? AND o.guardian_user_id = ? LIMIT 1`,
    ).bind(cancelMatch[1], actorUserId).first<{
      id: string; status: string; total_cents: number; service_date: string; payment_batch_id: string | null; payment_status: string | null;
    }>();
    if (!order) return json({ error: "Pedido no encontrado" }, { status: 404 });
    if (Date.now() >= cancellationCutoff(order.service_date).getTime()) {
      return json({ error: "La cancelación cerró a las 8:00 p. m. del día anterior" }, { status: 409 });
    }
    if (!["submitted", "confirmed"].includes(order.status)) return json({ error: "Este pedido ya no se puede cancelar" }, { status: 409 });
    const statements: D1PreparedStatement[] = [
      env.DB.prepare(
        `UPDATE menu_items SET remaining = remaining + COALESCE((SELECT SUM(quantity) FROM order_items WHERE order_id = ? AND dish_id = menu_items.dish_id), 0)
         WHERE menu_day_id = (SELECT menu_day_id FROM orders WHERE id = ?) AND remaining IS NOT NULL`,
      ).bind(order.id, order.id),
      env.DB.prepare("UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(order.id),
      env.DB.prepare(
        "INSERT INTO order_status_events (id, order_id, from_status, to_status, actor_user_id, note) VALUES (?, ?, ?, 'cancelled', ?, 'Cancelado por cliente antes del límite')",
      ).bind(crypto.randomUUID(), order.id, order.status, actorUserId),
    ];
    if (order.payment_status === "approved") {
      statements.push(
        env.DB.prepare(
          `INSERT INTO support_requests (id, user_id, order_id, category, subject, message)
           VALUES (?, ?, ?, 'payment', 'Crédito pendiente por cancelación', ?)`,
        ).bind(crypto.randomUUID(), actorUserId, order.id,
          `Revisar y crear desde Admin un crédito de L ${(order.total_cents / 100).toFixed(2)} por la cancelación ${order.id}.`),
      );
    }
    await env.DB.batch(statements);
    return json({ ok: true, orderId: order.id, creditPendingCents: order.payment_status === "approved" ? order.total_cents : 0 });
  }

  if (request.method === "POST" && url.pathname === "/api/demo/support") {
    const body = await readBoundedJson(request);
    if (!isRecord(body) || !["comment", "complaint", "request", "payment", "other"].includes(String(body.category)) ||
        typeof body.subject !== "string" || body.subject.trim().length < 3 || body.subject.length > 120 ||
        typeof body.message !== "string" || body.message.trim().length < 10 || body.message.length > 2000 ||
        (body.orderId !== null && body.orderId !== undefined && typeof body.orderId !== "string")) {
      return json({ error: "Completa el asunto y el mensaje" }, { status: 400 });
    }
    if (typeof body.orderId === "string") {
      const owned = await env.DB.prepare("SELECT id FROM orders WHERE id = ? AND guardian_user_id = ? LIMIT 1")
        .bind(body.orderId, actorUserId).first();
      if (!owned) return json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO support_requests (id, user_id, order_id, category, subject, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(id, actorUserId, body.orderId ?? null, body.category, body.subject.trim(), body.message.trim()).run();
    const admins = await env.DB.prepare(
      `SELECT DISTINCT u.id, u.email FROM app_users u JOIN user_roles ur ON ur.user_id = u.id
       WHERE ur.role = 'admin' AND u.status = 'active'`,
    ).all<{ id: string; email: string }>();
    if (admins.results.length) await env.DB.batch(admins.results.flatMap((admin) => [
      env.DB.prepare("INSERT INTO notifications (id, user_id, order_id, channel, template_key) VALUES (?, ?, ?, 'in_app', 'support_request_created')")
        .bind(crypto.randomUUID(), admin.id, body.orderId ?? null),
      env.DB.prepare("INSERT INTO notification_outbox (id, user_id, order_id, recipient_email, channel, template_key, payload_json) VALUES (?, ?, ?, ?, 'email', 'support_request_created', ?)")
        .bind(crypto.randomUUID(), admin.id, body.orderId ?? null, admin.email, JSON.stringify({ supportRequestId: id, subject: body.subject.trim() })),
    ]));
    return json({ id, status: "open" }, { status: 201 });
  }

  const issueChoiceMatch = url.pathname.match(/^\/api\/demo\/payment-issues\/([^/]+)\/choice$/);
  if (request.method === "POST" && issueChoiceMatch) {
    const body = await readBoundedJson(request);
    if (!isRecord(body) || (body.choice !== "refund" && body.choice !== "pay_difference")) {
      return json({ error: "Opción inválida" }, { status: 400 });
    }
    const issue = await env.DB.prepare(
      `SELECT pi.id FROM payment_issues pi JOIN payment_batches pb ON pb.id = pi.payment_batch_id
       WHERE pi.id = ? AND pb.guardian_user_id = ? AND pi.status = 'awaiting_customer' LIMIT 1`,
    ).bind(issueChoiceMatch[1], actorUserId).first<{ id: string }>();
    if (!issue) return json({ error: "Incidencia no encontrada" }, { status: 404 });
    await env.DB.prepare(
      `UPDATE payment_issues SET customer_choice = ?, status = ?, customer_responded_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(body.choice, body.choice === "refund" ? "refund_requested" : "balance_pending", issue.id).run();
    return json({ ok: true });
  }

  const batchReceiptMatch = url.pathname.match(/^\/api\/demo\/payment-batches\/([^/]+)\/receipt$/);
  if (request.method === "POST" && batchReceiptMatch) {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 6_000_000) return json({ error: "El comprobante debe pesar menos de 5 MB" }, { status: 413 });
    const payment = await env.DB.prepare(
      `SELECT id, status, receipt_object_key, expires_at FROM payment_batches
       WHERE id = ? AND guardian_user_id = ? LIMIT 1`,
    ).bind(batchReceiptMatch[1], actorUserId).first<{ id: string; status: string; receipt_object_key: string | null; expires_at: string }>();
    if (!payment) return json({ error: "Pago no encontrado" }, { status: 404 });
    if (Date.now() >= new Date(payment.expires_at).getTime() && !payment.receipt_object_key) {
      await expireUnpaidBatches(env);
      return json({ error: "El plazo para enviar el comprobante venció a las 11:59 p. m." }, { status: 409 });
    }
    if (!["pending", "under_review", "rejected", "amount_mismatch"].includes(payment.status)) return json({ error: "Este pago ya no admite cambios" }, { status: 409 });
    const form = await request.formData();
    const receipt = form.get("receipt");
    const bankReferenceValue = form.get("bankReference");
    const bankReference = typeof bankReferenceValue === "string" ? bankReferenceValue.trim().slice(0, 80) : "";
    if (!(receipt instanceof File) || receipt.size < 1 || receipt.size > 5_000_000 || !(await validReceiptSignature(receipt))) {
      return json({ error: "Usa una imagen JPEG, PNG, WebP, HEIC o HEIF de hasta 5 MB" }, { status: 415 });
    }
    const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
    const objectKey = `payment-receipts/family-checkouts/${payment.id}/${crypto.randomUUID()}.${extensions[receipt.type]}`;
    await env.PAYMENT_RECEIPTS.put(objectKey, receipt.stream(), {
      httpMetadata: { contentType: receipt.type }, customMetadata: { paymentBatchId: payment.id, purpose: "payment-receipt" },
    });
    await env.DB.prepare(
      `UPDATE payment_batches SET customer_reference = ?, receipt_object_key = ?, receipt_original_name = ?, receipt_content_type = ?,
       receipt_size_bytes = ?, receipt_submitted_at = CURRENT_TIMESTAMP, status = 'under_review', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(bankReference || null, objectKey, receipt.name.slice(0, 180), receipt.type, receipt.size, payment.id).run();
    if (payment.receipt_object_key && payment.receipt_object_key !== objectKey) await env.PAYMENT_RECEIPTS.delete(payment.receipt_object_key);
    return json({ ok: true, paymentBatchId: payment.id, paymentStatus: "under_review" }, { status: 201 });
  }

  const receiptMatch = url.pathname.match(/^\/api\/demo\/payments\/([^/]+)\/receipt$/);
  if (request.method === "POST" && receiptMatch) {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 6_000_000) return json({ error: "El comprobante debe pesar menos de 5 MB" }, { status: 413 });
    const payment = await env.DB.prepare(
      `SELECT pt.id, pt.status, pt.payment_method, pt.receipt_object_key
       FROM payment_transfers pt JOIN orders o ON o.id = pt.order_id
       WHERE o.id = ? AND o.guardian_user_id = ? LIMIT 1`,
    ).bind(receiptMatch[1], actorUserId)
      .first<{ id: string; status: string; payment_method: string; receipt_object_key: string | null }>();
    if (!payment || payment.payment_method !== "bank_transfer") {
      return json({ error: "Transferencia no encontrada" }, { status: 404 });
    }
    if (!["pending", "under_review", "rejected"].includes(payment.status)) {
      return json({ error: "Este pago ya no admite cambios" }, { status: 409 });
    }
    const form = await request.formData();
    const receipt = form.get("receipt");
    const bankReferenceValue = form.get("bankReference");
    const bankReference = typeof bankReferenceValue === "string" ? bankReferenceValue.trim().slice(0, 80) : "";
    if (!(receipt instanceof File) || receipt.size < 1 || receipt.size > 5_000_000 || !(await validReceiptSignature(receipt))) {
      return json({ error: "Usa una imagen JPEG, PNG, WebP, HEIC o HEIF de hasta 5 MB" }, { status: 415 });
    }
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif",
    };
    const objectKey = `payment-receipts/${receiptMatch[1]}/${crypto.randomUUID()}.${extensions[receipt.type]}`;
    await env.PAYMENT_RECEIPTS.put(objectKey, receipt.stream(), {
      httpMetadata: { contentType: receipt.type },
      customMetadata: { orderId: receiptMatch[1], purpose: "payment-receipt" },
    });
    await env.DB.prepare(
      `UPDATE payment_transfers SET customer_reference = ?, receipt_object_key = ?, receipt_original_name = ?,
       receipt_content_type = ?, receipt_size_bytes = ?, receipt_submitted_at = CURRENT_TIMESTAMP,
       status = 'under_review', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(bankReference || null, objectKey, receipt.name.slice(0, 180), receipt.type, receipt.size, payment.id).run();
    if (payment.receipt_object_key && payment.receipt_object_key !== objectKey) {
      await env.PAYMENT_RECEIPTS.delete(payment.receipt_object_key);
    }
    return json({ ok: true, orderId: receiptMatch[1], paymentStatus: "under_review" }, { status: 201 });
  }

  const paymentMatch = url.pathname.match(/^\/api\/demo\/payments\/([^/]+)$/);
  if (request.method === "PATCH" && paymentMatch) {
    return json({ error: "La conciliación de pagos solo está disponible en Administración" }, { status: 403 });
  }

  if (request.method === "GET" && url.pathname === "/api/demo/kds") {
    const orders = await loadDemoOrders(env, null, true);
    return json({
      orders: orders.filter((order) => order.payment_status === "approved" && !["cancelled", "delivered"].includes(order.status)),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/demo/kds/deliver-all") {
    const rows = await env.DB.prepare(
      `SELECT o.id, o.guardian_user_id FROM orders o JOIN menu_days md ON md.id = o.menu_day_id
       JOIN payment_batch_orders pbo ON pbo.order_id = o.id JOIN payment_batches pb ON pb.id = pbo.payment_batch_id
       WHERE pb.status = 'approved' AND o.status = 'packed' AND md.service_date = (
         SELECT MIN(md2.service_date) FROM orders o2 JOIN menu_days md2 ON md2.id = o2.menu_day_id
         JOIN payment_batch_orders pbo2 ON pbo2.order_id = o2.id JOIN payment_batches pb2 ON pb2.id = pbo2.payment_batch_id
         WHERE pb2.status = 'approved' AND o2.status = 'packed'
       )`,
    ).all<{ id: string; guardian_user_id: string }>();
    if (!rows.results.length) return json({ ok: true, delivered: 0 });
    await env.DB.batch(rows.results.flatMap((order) => [
      env.DB.prepare("UPDATE orders SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'packed'").bind(order.id),
      env.DB.prepare("INSERT INTO order_status_events (id, order_id, from_status, to_status, actor_user_id, note) VALUES (?, ?, 'packed', 'delivered', ?, 'Entrega masiva confirmada por KDS')").bind(crypto.randomUUID(), order.id, actorUserId),
      env.DB.prepare("INSERT INTO notifications (id, user_id, order_id, channel, template_key) VALUES (?, ?, ?, 'in_app', 'order_delivered')").bind(crypto.randomUUID(), order.guardian_user_id, order.id),
      env.DB.prepare("INSERT INTO notification_outbox (id, user_id, order_id, channel, template_key, payload_json) VALUES (?, ?, ?, 'email', 'order_delivered', ?)").bind(crypto.randomUUID(), order.guardian_user_id, order.id, JSON.stringify({ orderId: order.id })),
      env.DB.prepare("INSERT INTO notification_outbox (id, user_id, order_id, channel, template_key, payload_json) VALUES (?, ?, ?, 'push', 'order_delivered', ?)").bind(crypto.randomUUID(), order.guardian_user_id, order.id, JSON.stringify({ orderId: order.id })),
    ]));
    return json({ ok: true, delivered: rows.results.length });
  }

  return json({ error: "Not found" }, { status: 404 });
}

async function handlePublicApi(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (request.method !== "GET") return null;

  if (url.pathname === "/api/health") {
    await env.DB.prepare("SELECT 1").first();
    return json({ ok: true, service: "pipiro", environment: "cloudflare" });
  }

  if (url.pathname === "/api/public/config") {
    const [school, windows, paymentSettings, bankAccounts] = await Promise.all([
      env.DB.prepare(
        "SELECT slug, name, short_name, timezone, locale, currency FROM schools WHERE slug = ? AND is_active = 1 LIMIT 1",
      ).bind(env.DEFAULT_SCHOOL_SLUG).first(),
      env.DB.prepare(
        "SELECT service_type, label_es, label_en, delivery_time, cutoff_time FROM service_windows WHERE school_id = (SELECT id FROM schools WHERE slug = ?) AND service_type = 'lunch' AND is_active = 1 ORDER BY delivery_time",
      ).bind(env.DEFAULT_SCHOOL_SLUG).all(),
      env.DB.prepare("SELECT bank_name, account_holder, account_number, account_type FROM payment_settings WHERE id = 'default' LIMIT 1")
        .first<{ bank_name: string; account_holder: string; account_number: string; account_type: string }>(),
      env.DB.prepare("SELECT id, label, bank_name, account_holder, account_number, account_type, instructions FROM bank_accounts WHERE is_active = 1 ORDER BY sort_order, bank_name").all<{
        id: string; label: string; bank_name: string; account_holder: string; account_number: string; account_type: string; instructions: string | null;
      }>(),
    ]);

    if (!school) return json({ error: "School configuration not found" }, { status: 404 });
    return json({
      school,
      serviceWindows: windows.results.map((window) => ({ ...window, cutoff_time: "23:59", cutoff_rule: "previous_day" })),
      payments: {
        cardEnabled: false,
        bankAccounts: bankAccounts.results.map((account) => ({ id: account.id, label: account.label, bankName: account.bank_name,
          accountHolder: account.account_holder, accountNumber: account.account_number, accountType: account.account_type,
          instructions: account.instructions })),
        bankTransfer: {
          id: bankAccounts.results[0]?.id ?? "bank_default",
          label: bankAccounts.results[0]?.label ?? paymentSettings?.bank_name ?? env.BANK_NAME,
          bankName: bankAccounts.results[0]?.bank_name ?? paymentSettings?.bank_name ?? env.BANK_NAME,
          accountHolder: bankAccounts.results[0]?.account_holder ?? paymentSettings?.account_holder ?? env.BANK_ACCOUNT_HOLDER,
          accountNumber: bankAccounts.results[0]?.account_number ?? paymentSettings?.account_number ?? env.BANK_ACCOUNT_NUMBER,
          accountType: bankAccounts.results[0]?.account_type ?? paymentSettings?.account_type ?? env.BANK_ACCOUNT_TYPE,
        },
      },
    });
  }

  if (url.pathname === "/api/public/dishes") {
    const [dishResult, groupResult, optionResult] = await Promise.all([
      env.DB.prepare(
        `SELECT d.id, d.slug, d.name_es, d.name_en, d.description_es, d.description_en,
                d.price_cents, d.prep_time_minutes, d.image_key, d.emoji, d.badge_es, d.badge_en,
                c.slug AS category_slug, c.name_es AS category_es, c.name_en AS category_en
         FROM dishes d
         JOIN categories c ON c.id = d.category_id
         WHERE d.is_active = 1 AND c.is_active = 1
         ORDER BY c.sort_order, d.name_es`,
      ).all<DishRow>(),
      env.DB.prepare(
        `SELECT g.id, g.dish_id, g.name_es, g.name_en, g.min_select, g.max_select
         FROM dish_option_groups g
         JOIN dishes d ON d.id = g.dish_id
         WHERE g.is_active = 1 AND d.is_active = 1
         ORDER BY g.dish_id, g.sort_order`,
      ).all<OptionGroupRow>(),
      env.DB.prepare(
        `SELECT o.id, o.group_id, o.name_es, o.name_en, o.price_delta_cents
         FROM dish_options o
         JOIN dish_option_groups g ON g.id = o.group_id
         JOIN dishes d ON d.id = g.dish_id
         WHERE o.is_active = 1 AND g.is_active = 1 AND d.is_active = 1
         ORDER BY o.group_id, o.sort_order`,
      ).all<OptionRow>(),
    ]);

    const optionsByGroup = Map.groupBy(optionResult.results, (option) => String(option.group_id));
    const groupsByDish = Map.groupBy(groupResult.results.map((group) => ({
      ...group,
      options: optionsByGroup.get(String(group.id)) ?? [],
    })), (group) => String(group.dish_id));
    let scheduledDishIds: Set<string> | null = null;
    const serviceDate = url.searchParams.get("date");
    const serviceType = url.searchParams.get("service");
    if (serviceDate && /^\d{4}-\d{2}-\d{2}$/.test(serviceDate) && (serviceType === "breakfast" || serviceType === "lunch")) {
      const scheduled = await env.DB.prepare(
        `SELECT mi.dish_id FROM menu_items mi
         JOIN menu_days md ON md.id = mi.menu_day_id
         JOIN service_windows sw ON sw.id = md.service_window_id
         WHERE md.school_id = 'school_eis' AND md.service_date = ? AND sw.service_type = ? AND md.status = 'published'`,
      ).bind(serviceDate, serviceType).all<{ dish_id: string }>();
      scheduledDishIds = new Set(scheduled.results.map((row) => row.dish_id));
      if (scheduledDishIds.size === 0) {
        const defaultDailyDishId = defaultMenuOfDayDishId(serviceDate);
        if (defaultDailyDishId) scheduledDishIds.add(defaultDailyDishId);
      }
    }
    const visibleRows = scheduledDishIds === null ? dishResult.results : dishResult.results.filter((dish) =>
      dish.category_slug === "menu-permanente" || scheduledDishIds.has(String(dish.id)));
    let dailyFavoriteId: string | null = null;
    let monthlyFavoriteId: string | null = null;
    if (serviceDate && /^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      const [dailyFavorite, monthlyFavorite] = await Promise.all([
        env.DB.prepare(
          `SELECT oi.dish_id FROM order_items oi JOIN orders o ON o.id = oi.order_id
           JOIN menu_days md ON md.id = o.menu_day_id JOIN payment_batch_orders pbo ON pbo.order_id = o.id
           JOIN payment_batches pb ON pb.id = pbo.payment_batch_id
           WHERE md.service_date = ? AND pb.status = 'approved' AND o.status != 'cancelled'
           GROUP BY oi.dish_id HAVING SUM(oi.quantity) >= 10 ORDER BY MIN(o.created_at), oi.dish_id LIMIT 1`,
        ).bind(serviceDate).first<{ dish_id: string }>(),
        env.DB.prepare(
          `SELECT oi.dish_id FROM order_items oi JOIN orders o ON o.id = oi.order_id
           JOIN menu_days md ON md.id = o.menu_day_id JOIN payment_batch_orders pbo ON pbo.order_id = o.id
           JOIN payment_batches pb ON pb.id = pbo.payment_batch_id
           WHERE substr(md.service_date, 1, 7) = substr(?, 1, 7) AND pb.status = 'approved' AND o.status != 'cancelled'
           GROUP BY oi.dish_id HAVING SUM(oi.quantity) >= 50 ORDER BY MIN(o.created_at), oi.dish_id LIMIT 1`,
        ).bind(serviceDate).first<{ dish_id: string }>(),
      ]);
      dailyFavoriteId = dailyFavorite?.dish_id ?? null;
      monthlyFavoriteId = monthlyFavorite?.dish_id ?? null;
    }
    const dishes = visibleRows.map((dish) => ({
      ...dish,
      sales_badges: [String(dish.id) === dailyFavoriteId ? "Favorito del día" : null,
        String(dish.id) === monthlyFavoriteId ? "Favorito del mes" : null].filter(Boolean),
      option_groups: groupsByDish.get(String(dish.id)) ?? [],
    }));

    return json({ dishes, mediaBaseUrl: env.PUBLIC_MEDIA_BASE_URL });
  }

  if (url.pathname === "/api/public/availability") {
    const serviceDate = url.searchParams.get("date");
    const serviceType = url.searchParams.get("service");
    if (!serviceDate || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) || serviceType !== "lunch") {
      return json({ error: "Invalid availability query" }, { status: 400 });
    }
    const window = await env.DB.prepare(
      `SELECT sw.id, sw.delivery_time, sw.cutoff_time,
              COALESCE(swe.status, 'open') AS exception_status,
              COALESCE(swe.delivery_time, sw.delivery_time) AS effective_delivery_time,
              COALESCE(swe.cutoff_time, sw.cutoff_time) AS effective_cutoff_time,
              swe.capacity, swe.message_es, swe.message_en,
              COALESCE(md.status, 'published') AS menu_status
       FROM service_windows sw
       LEFT JOIN service_window_exceptions swe ON swe.service_window_id = sw.id AND swe.service_date = ?
       LEFT JOIN menu_days md ON md.service_window_id = sw.id AND md.service_date = ? AND md.school_id = 'school_eis'
       WHERE sw.school_id = 'school_eis' AND sw.service_type = ? AND sw.is_active = 1 LIMIT 1`,
    ).bind(serviceDate, serviceDate, serviceType).first<Record<string, string | number | null>>();
    if (!window) return json({ error: "Service unavailable" }, { status: 404 });
    const cutoffTime = "23:59";
    const cutoff = advanceOrderCutoff(serviceDate);
    const hasAdvanceNotice = serviceDate > hondurasDateId();
    const timeOpen = hasAdvanceNotice && Number.isFinite(cutoff.getTime()) && Date.now() < cutoff.getTime();
    const serviceDayOpen = isSchoolLunchDay(serviceDate);
    const open = serviceDayOpen && timeOpen && window.exception_status === "open" && window.menu_status === "published";
    return json({
      open,
      serviceDate,
      serviceType,
      deliveryTime: window.effective_delivery_time,
      cutoffTime,
      cutoffDate: previousDateId(serviceDate),
      capacity: window.capacity,
      status: !serviceDayOpen ? "no_school_lunch" : !hasAdvanceNotice ? "advance_notice_required" : !timeOpen ? "cutoff_passed" : window.exception_status !== "open" ? window.exception_status : window.menu_status,
      messageEs: window.message_es,
      messageEn: window.message_en,
    });
  }

  return null;
}

function redirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path, "Cache-Control": "no-store" } });
}

function notFound(): Response {
  return new Response("Página no encontrada.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function securePageResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Strict-Transport-Security", "max-age=31536000");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const surface = requestSurface(url, env);

    try {
      if (surface === "admin" && url.pathname === "/") return redirect("/admin");
      if (surface === "kitchen" && url.pathname === "/") return redirect("/cocina");
      if (surface === "family" && (url.pathname === "/admin" || url.pathname.startsWith("/admin/") ||
          url.pathname === "/cocina" || url.pathname.startsWith("/cocina/"))) return notFound();
      if (surface === "admin" && (url.pathname === "/cocina" || url.pathname.startsWith("/cocina/"))) return notFound();
      if (surface === "kitchen" && (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))) return notFound();
      const authResponse = await handleAuthApi(request, env, url);
      if (authResponse) return authResponse;
      if ((request.method === "GET" || request.method === "HEAD") && surface === "family" && url.pathname === "/") {
        const access = await authorizeSurface(request, env, url, ["customer"]);
        if (access) return access;
      }
      if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))) {
        const access = await authorizeSurface(request, env, url, ["admin"]);
        if (access) return access;
      }
      if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/cocina" || url.pathname.startsWith("/cocina/"))) {
        const access = await authorizeSurface(request, env, url, ["admin", "kitchen"]);
        if (access) return access;
      }
      const cmsResponse = await handleCmsApi(request, env, url);
      if (cmsResponse) return cmsResponse;
      const mediaResponse = await handlePublicMedia(request, env, url);
      if (mediaResponse) return mediaResponse;
      const demoResponse = await handleDemoApi(request, env, url);
      if (demoResponse) return demoResponse;
      const apiResponse = await handlePublicApi(request, env, url);
      if (apiResponse) return apiResponse;
    } catch (error) {
      console.error(JSON.stringify({
        message: "public_api_failed",
        path: url.pathname,
        error: error instanceof Error ? error.message : "unknown_error",
      }));
      return json({ error: "Internal server error" }, { status: 500 });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const outputFormat = format === "image/png" || format === "image/jpeg" || format === "image/avif"
            ? format
            : "image/webp";
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format: outputFormat, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return securePageResponse(await handler.fetch(request, env, ctx));
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processPushOutbox(env));
  },
};

export default worker satisfies ExportedHandler<Env>;
