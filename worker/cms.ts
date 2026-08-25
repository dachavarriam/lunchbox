const cmsJsonHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

type CmsOptionInput = {
  nameEs: string;
  nameEn: string;
  priceDeltaCents: number;
};

type CmsOptionGroupInput = {
  nameEs: string;
  nameEn: string;
  required: boolean;
  options: CmsOptionInput[];
};

type CmsDishInput = {
  categoryId: string;
  slug: string;
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  priceCents: number;
  prepTimeMinutes: number;
  emoji: string;
  badgeEs: string;
  badgeEn: string;
  imageKey: string | null;
  isActive: boolean;
  optionGroups: CmsOptionGroupInput[];
};

type CmsDishRow = Record<string, string | number | null> & { id: string };
type CmsGroupRow = Record<string, string | number | null> & { id: string; dish_id: string };
type CmsOptionRow = Record<string, string | number | null> & { id: string; group_id: string };

function cmsJson(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, { ...init, headers: { ...cmsJsonHeaders, ...init?.headers } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : null;
}

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized.length <= max ? normalized : null;
}

function normalizeSlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-HN")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function parseCmsDish(value: unknown): CmsDishInput | null {
  if (!isRecord(value)) return null;
  const nameEs = requiredText(value.nameEs, 120);
  const nameEn = requiredText(value.nameEn, 120);
  const descriptionEs = requiredText(value.descriptionEs, 600);
  const descriptionEn = requiredText(value.descriptionEn, 600);
  const categoryId = requiredText(value.categoryId, 80);
  const emoji = optionalText(value.emoji, 12);
  const badgeEs = optionalText(value.badgeEs, 80);
  const badgeEn = optionalText(value.badgeEn, 80);
  const requestedSlug = typeof value.slug === "string" ? value.slug : nameEs ?? "";
  const slug = normalizeSlug(requestedSlug);
  if (!nameEs || !nameEn || !descriptionEs || !descriptionEn || !categoryId || emoji === null ||
      badgeEs === null || badgeEn === null || !slug || typeof value.priceCents !== "number" ||
      !Number.isInteger(value.priceCents) || value.priceCents < 0 || value.priceCents > 1_000_000 ||
      typeof value.prepTimeMinutes !== "number" || !Number.isInteger(value.prepTimeMinutes) ||
      value.prepTimeMinutes < 1 || value.prepTimeMinutes > 180 ||
      typeof value.isActive !== "boolean" || !Array.isArray(value.optionGroups) || value.optionGroups.length > 10 ||
      (value.imageKey !== null && typeof value.imageKey !== "string")) return null;

  const optionGroups: CmsOptionGroupInput[] = [];
  for (const candidate of value.optionGroups) {
    if (!isRecord(candidate) || typeof candidate.required !== "boolean" || !Array.isArray(candidate.options) ||
        candidate.options.length < 1 || candidate.options.length > 20) return null;
    const groupNameEs = requiredText(candidate.nameEs, 100);
    const groupNameEn = requiredText(candidate.nameEn, 100);
    if (!groupNameEs || !groupNameEn) return null;
    const options: CmsOptionInput[] = [];
    for (const option of candidate.options) {
      if (!isRecord(option)) return null;
      const optionNameEs = requiredText(option.nameEs, 100);
      const optionNameEn = requiredText(option.nameEn, 100);
      if (!optionNameEs || !optionNameEn || typeof option.priceDeltaCents !== "number" ||
          !Number.isInteger(option.priceDeltaCents) || option.priceDeltaCents < 0 || option.priceDeltaCents > 100_000) return null;
      options.push({ nameEs: optionNameEs, nameEn: optionNameEn, priceDeltaCents: option.priceDeltaCents });
    }
    optionGroups.push({ nameEs: groupNameEs, nameEn: groupNameEn, required: candidate.required, options });
  }

  return {
    categoryId, slug, nameEs, nameEn, descriptionEs, descriptionEn, priceCents: value.priceCents,
    prepTimeMinutes: value.prepTimeMinutes,
    emoji: emoji || "🍽️", badgeEs, badgeEn,
    imageKey: typeof value.imageKey === "string" && value.imageKey ? value.imageKey : null,
    isActive: value.isActive, optionGroups,
  };
}

async function boundedJson(request: Request): Promise<unknown> {
  const size = Number(request.headers.get("content-length") ?? "0");
  if (size > 512_000) throw new Error("request_too_large");
  return request.json<unknown>();
}

async function loadCms(env: Env, startDate: string): Promise<Record<string, unknown>> {
  const [categories, dishResult, groupResult, optionResult, windows, calendar] = await Promise.all([
    env.DB.prepare("SELECT id, slug, name_es, name_en, sort_order, is_active FROM categories ORDER BY sort_order, name_es").all(),
    env.DB.prepare(
      `SELECT d.id, d.category_id, d.slug, d.name_es, d.name_en, d.description_es, d.description_en,
              d.price_cents, d.prep_time_minutes, d.image_key, d.emoji, d.badge_es, d.badge_en, d.is_active,
              c.name_es AS category_es, c.name_en AS category_en
       FROM dishes d JOIN categories c ON c.id = d.category_id
       ORDER BY c.sort_order, d.name_es`,
    ).all<CmsDishRow>(),
    env.DB.prepare(
      `SELECT id, dish_id, name_es, name_en, min_select, max_select, sort_order, is_active
       FROM dish_option_groups ORDER BY dish_id, sort_order`,
    ).all<CmsGroupRow>(),
    env.DB.prepare(
      `SELECT id, group_id, name_es, name_en, price_delta_cents, sort_order, is_active
       FROM dish_options ORDER BY group_id, sort_order`,
    ).all<CmsOptionRow>(),
    env.DB.prepare(
      `SELECT id, service_type, label_es, label_en, delivery_time, cutoff_time, is_active
       FROM service_windows WHERE school_id = 'school_eis' ORDER BY delivery_time`,
    ).all(),
    env.DB.prepare(
      `SELECT md.id, md.service_date, md.status, sw.service_type,
              COALESCE(swe.delivery_time, sw.delivery_time) AS delivery_time,
              COALESCE(swe.cutoff_time, sw.cutoff_time) AS cutoff_time,
              swe.capacity, swe.message_es, swe.message_en,
              GROUP_CONCAT(mi.dish_id, '||') AS dish_ids
       FROM menu_days md
       JOIN service_windows sw ON sw.id = md.service_window_id
       LEFT JOIN service_window_exceptions swe ON swe.service_window_id = sw.id AND swe.service_date = md.service_date
       LEFT JOIN menu_items mi ON mi.menu_day_id = md.id
       WHERE md.school_id = 'school_eis' AND md.service_date >= ?
       GROUP BY md.id ORDER BY md.service_date, sw.delivery_time LIMIT 90`,
    ).bind(startDate).all(),
  ]);

  const optionsByGroup = Map.groupBy(optionResult.results, (option) => String(option.group_id));
  const groupsByDish = Map.groupBy(groupResult.results.map((group) => ({
    ...group,
    options: optionsByGroup.get(String(group.id)) ?? [],
  })), (group) => String(group.dish_id));

  return {
    categories: categories.results,
    dishes: dishResult.results.map((dish) => ({ ...dish, option_groups: groupsByDish.get(String(dish.id)) ?? [] })),
    serviceWindows: windows.results,
    calendar: calendar.results.map((day) => ({
      ...day,
      dish_ids: typeof day.dish_ids === "string" && day.dish_ids ? day.dish_ids.split("||") : [],
    })),
  };
}

async function writeDish(env: Env, actorUserId: string, dishId: string, input: CmsDishInput, isNew: boolean): Promise<void> {
  const category = await env.DB.prepare("SELECT id FROM categories WHERE id = ? LIMIT 1").bind(input.categoryId).first();
  if (!category) throw new Error("category_not_found");
  const statements: D1PreparedStatement[] = [];
  if (isNew) {
    statements.push(env.DB.prepare(
      `INSERT INTO dishes (id, category_id, slug, name_es, name_en, description_es, description_en,
        price_cents, prep_time_minutes, image_key, emoji, badge_es, badge_en, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(dishId, input.categoryId, input.slug, input.nameEs, input.nameEn, input.descriptionEs,
      input.descriptionEn, input.priceCents, input.prepTimeMinutes, input.imageKey, input.emoji, input.badgeEs || null,
      input.badgeEn || null, input.isActive ? 1 : 0));
  } else {
    statements.push(env.DB.prepare(
      `UPDATE dishes SET category_id = ?, slug = ?, name_es = ?, name_en = ?, description_es = ?,
       description_en = ?, price_cents = ?, prep_time_minutes = ?, image_key = ?, emoji = ?, badge_es = ?, badge_en = ?,
       is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(input.categoryId, input.slug, input.nameEs, input.nameEn, input.descriptionEs,
      input.descriptionEn, input.priceCents, input.prepTimeMinutes, input.imageKey, input.emoji, input.badgeEs || null,
      input.badgeEn || null, input.isActive ? 1 : 0, dishId));
    statements.push(env.DB.prepare("DELETE FROM dish_option_groups WHERE dish_id = ?").bind(dishId));
  }

  input.optionGroups.forEach((group, groupIndex) => {
    const groupId = crypto.randomUUID();
    statements.push(env.DB.prepare(
      `INSERT INTO dish_option_groups (id, dish_id, name_es, name_en, min_select, max_select, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, 1, ?, 1)`,
    ).bind(groupId, dishId, group.nameEs, group.nameEn, group.required ? 1 : 0, (groupIndex + 1) * 10));
    group.options.forEach((option, optionIndex) => {
      statements.push(env.DB.prepare(
        `INSERT INTO dish_options (id, group_id, name_es, name_en, price_delta_cents, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
      ).bind(crypto.randomUUID(), groupId, option.nameEs, option.nameEn, option.priceDeltaCents, (optionIndex + 1) * 10));
    });
  });
  statements.push(env.DB.prepare(
    "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'dish', ?)",
  ).bind(crypto.randomUUID(), actorUserId, isNew ? "dish.created" : "dish.updated", dishId));
  await env.DB.batch(statements);
}

export async function handleCmsApi(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/demo/admin/")) return null;
  if (env.DEMO_MODE !== "true") return cmsJson({ error: "Demo mode disabled" }, { status: 404 });
  const authorization = await authorizeRequest(request, env, url, ["admin"], "user_admin_dachavarriam");
  if (authorization.response || !authorization.actor) return authorization.response;
  const actorUserId = authorization.actor.userId;

  if (request.method === "GET" && url.pathname === "/api/demo/admin/cms") {
    const start = url.searchParams.get("start") ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return cmsJson({ error: "Invalid start date" }, { status: 400 });
    return cmsJson(await loadCms(env, start));
  }

  const receiptMatch = url.pathname.match(/^\/api\/demo\/admin\/payments\/([^/]+)\/receipt$/);
  if (request.method === "GET" && receiptMatch) {
    const payment = await env.DB.prepare(
      `SELECT receipt_object_key, receipt_original_name, receipt_content_type FROM payment_batches WHERE id = ? AND receipt_object_key IS NOT NULL
       UNION ALL
       SELECT pb.receipt_object_key, pb.receipt_original_name, pb.receipt_content_type
       FROM payment_batch_orders pbo JOIN payment_batches pb ON pb.id = pbo.payment_batch_id
       WHERE pbo.order_id = ? AND pb.receipt_object_key IS NOT NULL
       UNION ALL
       SELECT receipt_object_key, receipt_original_name, receipt_content_type
       FROM payment_transfers WHERE order_id = ? AND receipt_object_key IS NOT NULL LIMIT 1`,
    ).bind(receiptMatch[1], receiptMatch[1], receiptMatch[1]).first<{
      receipt_object_key: string;
      receipt_original_name: string | null;
      receipt_content_type: string | null;
    }>();
    if (!payment) return cmsJson({ error: "Comprobante no encontrado" }, { status: 404 });
    const object = await env.PAYMENT_RECEIPTS.get(payment.receipt_object_key);
    if (!object) return cmsJson({ error: "Comprobante no encontrado" }, { status: 404 });
    const safeName = (payment.receipt_original_name ?? "comprobante").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120);
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Content-Type": payment.receipt_content_type ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    return new Response(object.body, { headers });
  }

  if (request.method === "GET" && url.pathname === "/api/demo/admin/payment-settings") {
    const settings = await env.DB.prepare(
      "SELECT bank_name, account_holder, account_number, account_type, updated_at FROM payment_settings WHERE id = 'default'",
    ).first();
    return cmsJson({ settings });
  }

  if (request.method === "PUT" && url.pathname === "/api/demo/admin/payment-settings") {
    const body = await boundedJson(request);
    if (!isRecord(body)) return cmsJson({ error: "Configuración inválida" }, { status: 400 });
    const bankName = requiredText(body.bankName, 100);
    const accountHolder = requiredText(body.accountHolder, 120);
    const accountNumber = requiredText(body.accountNumber, 100);
    const accountType = requiredText(body.accountType, 100);
    if (!bankName || !accountHolder || !accountNumber || !accountType) return cmsJson({ error: "Completa todos los campos bancarios" }, { status: 400 });
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE payment_settings SET bank_name = ?, account_holder = ?, account_number = ?, account_type = ?,
         updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'default'`,
      ).bind(bankName, accountHolder, accountNumber, accountType, actorUserId),
      env.DB.prepare(
        "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, 'payment_settings.updated', 'payment_settings', 'default')",
      ).bind(crypto.randomUUID(), actorUserId),
    ]);
    return cmsJson({ ok: true });
  }

  if (request.method === "GET" && url.pathname === "/api/demo/admin/customers") {
    const customers = await env.DB.prepare(
      `SELECT u.id, u.display_name, u.email, u.status, COALESCE(SUM(cl.amount_cents), 0) AS credit_balance_cents
       FROM app_users u
       JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'customer'
       LEFT JOIN credit_ledger cl ON cl.user_id = u.id
       GROUP BY u.id
       ORDER BY u.display_name COLLATE NOCASE, u.email COLLATE NOCASE
       LIMIT 250`,
    ).all();
    return cmsJson({ customers: customers.results });
  }

  if (request.method === "GET" && url.pathname === "/api/demo/admin/staff") {
    const staff = await env.DB.prepare(
      `SELECT u.id, u.display_name, u.email, u.status, GROUP_CONCAT(ur.role, ',') AS roles
       FROM app_users u JOIN user_roles ur ON ur.user_id = u.id
       WHERE ur.role IN ('admin', 'kitchen', 'delivery')
       GROUP BY u.id ORDER BY u.display_name COLLATE NOCASE`,
    ).all();
    return cmsJson({ staff: staff.results });
  }

  if (request.method === "POST" && url.pathname === "/api/demo/admin/staff-invitations") {
    const body = await boundedJson(request);
    if (!isRecord(body) || typeof body.email !== "string" || typeof body.displayName !== "string" ||
        !["admin", "kitchen", "delivery"].includes(String(body.role))) {
      return cmsJson({ error: "Invitación inválida" }, { status: 400 });
    }
    const email = body.email.trim().toLocaleLowerCase("en-US");
    const displayName = body.displayName.trim();
    const role = String(body.role);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || displayName.length < 2 || displayName.length > 120) {
      return cmsJson({ error: "Completa un nombre y correo válidos" }, { status: 400 });
    }
    const existing = await env.DB.prepare("SELECT id FROM app_users WHERE email = ? COLLATE NOCASE LIMIT 1")
      .bind(email).first<{ id: string }>();
    const staffUserId = existing?.id ?? crypto.randomUUID();
    const invitationId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [];
    if (!existing) statements.push(env.DB.prepare(
      "INSERT INTO app_users (id, email, display_name, locale, status) VALUES (?, ?, ?, 'es-HN', 'invited')",
    ).bind(staffUserId, email, displayName));
    statements.push(
      env.DB.prepare("INSERT OR IGNORE INTO user_roles (user_id, role, school_id) VALUES (?, ?, 'school_eis')")
        .bind(staffUserId, role),
      env.DB.prepare(
        `INSERT INTO staff_invitations (id, email, role, school_id, invited_by_user_id, expires_at)
         VALUES (?, ?, ?, 'school_eis', ?, datetime('now', '+14 days'))
         ON CONFLICT(email, role, school_id) DO UPDATE SET status = 'pending', invited_by_user_id = excluded.invited_by_user_id,
         expires_at = excluded.expires_at, accepted_by_user_id = NULL, accepted_at = NULL`,
      ).bind(invitationId, email, role, actorUserId),
      env.DB.prepare(
        "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, metadata_json) VALUES (?, ?, 'staff.invited', 'app_user', ?, ?)",
      ).bind(crypto.randomUUID(), actorUserId, staffUserId, JSON.stringify({ email, role })),
    );
    await env.DB.batch(statements);
    return cmsJson({ id: invitationId, userId: staffUserId, status: "pending" }, { status: 201 });
  }

  if (request.method === "POST" && url.pathname === "/api/demo/admin/credits") {
    const body = await boundedJson(request);
    if (!isRecord(body) || typeof body.amountCents !== "number" || !Number.isInteger(body.amountCents) ||
        body.amountCents < 1 || body.amountCents > 5_000_000 || typeof body.reason !== "string" ||
        body.reason.trim().length < 3 || body.reason.length > 240 || typeof body.userId !== "string") {
      return cmsJson({ error: "Monto o motivo inválido" }, { status: 400 });
    }
    const customer = await env.DB.prepare(
      "SELECT u.id FROM app_users u JOIN user_roles ur ON ur.user_id = u.id WHERE u.id = ? AND ur.role = 'customer' LIMIT 1",
    ).bind(body.userId).first<{ id: string }>();
    if (!customer) return cmsJson({ error: "Cliente no encontrado" }, { status: 404 });
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO credit_ledger (id, user_id, amount_cents, entry_type, reason, created_by_user_id)
       VALUES (?, ?, ?, 'admin_grant', ?, ?)`,
    ).bind(id, customer.id, body.amountCents, body.reason.trim(), actorUserId).run();
    return cmsJson({ id }, { status: 201 });
  }

  const batchReviewMatch = url.pathname.match(/^\/api\/demo\/admin\/payment-batches\/([^/]+)$/);
  if (request.method === "PATCH" && batchReviewMatch) {
    const body = await boundedJson(request);
    if (!isRecord(body) || !["approved", "rejected", "amount_mismatch"].includes(String(body.status))) {
      return cmsJson({ error: "Estado inválido" }, { status: 400 });
    }
    const payment = await env.DB.prepare(
      "SELECT id, guardian_user_id, status, amount_due_cents, receipt_object_key FROM payment_batches WHERE id = ? LIMIT 1",
    ).bind(batchReviewMatch[1]).first<{ id: string; guardian_user_id: string; status: string; amount_due_cents: number; receipt_object_key: string | null }>();
    if (!payment) return cmsJson({ error: "Pago no encontrado" }, { status: 404 });
    if (!payment.receipt_object_key) return cmsJson({ error: "No hay comprobante para revisar" }, { status: 409 });
    if (body.status === "amount_mismatch") {
      if (typeof body.receivedCents !== "number" || !Number.isInteger(body.receivedCents) || body.receivedCents < 0 || body.receivedCents === payment.amount_due_cents) {
        return cmsJson({ error: "Indica el monto recibido correcto" }, { status: 400 });
      }
      await env.DB.batch([
        env.DB.prepare("UPDATE payment_batches SET status = 'amount_mismatch', reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(payment.id),
        env.DB.prepare(
          `INSERT INTO payment_issues (id, payment_batch_id, expected_cents, received_cents, difference_cents)
           VALUES (?, ?, ?, ?, ?)`,
        ).bind(crypto.randomUUID(), payment.id, payment.amount_due_cents, body.receivedCents, payment.amount_due_cents - body.receivedCents),
        env.DB.prepare(
          `INSERT INTO notifications (id, user_id, channel, template_key)
           VALUES (?, ?, 'in_app', 'payment_amount_mismatch')`,
        ).bind(crypto.randomUUID(), payment.guardian_user_id),
      ]);
      return cmsJson({ ok: true, status: "amount_mismatch" });
    }
    const statements: D1PreparedStatement[] = [env.DB.prepare(
      "UPDATE payment_batches SET status = ?, reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).bind(body.status, actorUserId, payment.id)];
    if (body.status === "approved") statements.push(env.DB.prepare(
      `UPDATE orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
       WHERE id IN (SELECT order_id FROM payment_batch_orders WHERE payment_batch_id = ?) AND status = 'submitted'`,
    ).bind(payment.id));
    await env.DB.batch(statements);
    return cmsJson({ ok: true, status: body.status });
  }

  if (request.method === "GET" && url.pathname === "/api/demo/admin/support") {
    const requests = await env.DB.prepare(
      `SELECT sr.*, u.display_name, o.order_number FROM support_requests sr JOIN app_users u ON u.id = sr.user_id
       LEFT JOIN orders o ON o.id = sr.order_id ORDER BY CASE sr.status WHEN 'open' THEN 0 ELSE 1 END, sr.created_at DESC LIMIT 100`,
    ).all();
    return cmsJson({ requests: requests.results });
  }

  if (request.method === "POST" && url.pathname === "/api/demo/admin/dishes") {
    const input = parseCmsDish(await boundedJson(request));
    if (!input) return cmsJson({ error: "Datos del platillo inválidos" }, { status: 400 });
    const dishId = crypto.randomUUID();
    await writeDish(env, actorUserId, dishId, input, true);
    return cmsJson({ dishId }, { status: 201 });
  }

  const dishMatch = url.pathname.match(/^\/api\/demo\/admin\/dishes\/([^/]+)$/);
  if (request.method === "PATCH" && dishMatch) {
    const input = parseCmsDish(await boundedJson(request));
    if (!input) return cmsJson({ error: "Datos del platillo inválidos" }, { status: 400 });
    const exists = await env.DB.prepare("SELECT id FROM dishes WHERE id = ? LIMIT 1").bind(dishMatch[1]).first();
    if (!exists) return cmsJson({ error: "Platillo no encontrado" }, { status: 404 });
    await writeDish(env, actorUserId, dishMatch[1], input, false);
    return cmsJson({ ok: true, dishId: dishMatch[1] });
  }

  if (request.method === "DELETE" && dishMatch) {
    const result = await env.DB.prepare("UPDATE dishes SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(dishMatch[1]).run();
    if (!result.meta.changes) return cmsJson({ error: "Platillo no encontrado" }, { status: 404 });
    await env.DB.prepare(
      "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, 'dish.deactivated', 'dish', ?)",
    ).bind(crypto.randomUUID(), actorUserId, dishMatch[1]).run();
    return cmsJson({ ok: true });
  }

  if (request.method === "POST" && url.pathname === "/api/demo/admin/media") {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 6_000_000) return cmsJson({ error: "La imagen debe pesar menos de 6 MB" }, { status: 413 });
    const form = await request.formData();
    const entry = form.get("file");
    if (!(entry instanceof File)) return cmsJson({ error: "Falta la imagen" }, { status: 400 });
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif",
    };
    const extension = extensions[entry.type];
    if (!extension || entry.size < 1 || entry.size > 5_000_000) {
      return cmsJson({ error: "Formato o tamaño de imagen no permitido" }, { status: 415 });
    }
    const objectKey = `catalog/${crypto.randomUUID()}.${extension}`;
    await env.MEDIA.put(objectKey, entry.stream(), {
      httpMetadata: { contentType: entry.type, cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { originalName: entry.name.slice(0, 180), purpose: "catalog" },
    });
    await env.DB.prepare(
      `INSERT INTO cms_media (id, object_key, original_name, content_type, size_bytes, uploaded_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), objectKey, entry.name.slice(0, 180), entry.type, entry.size, actorUserId).run();
    return cmsJson({ objectKey, url: `/api/public/media/${objectKey}` }, { status: 201 });
  }

  if (request.method === "PUT" && url.pathname === "/api/demo/admin/calendar") {
    const body = await boundedJson(request);
    if (!isRecord(body) || typeof body.serviceDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.serviceDate) ||
        body.serviceType !== "lunch" ||
        !["draft", "published", "closed", "cancelled"].includes(String(body.status)) ||
        typeof body.deliveryTime !== "string" || !/^\d{2}:\d{2}$/.test(body.deliveryTime) ||
        typeof body.cutoffTime !== "string" || !/^\d{2}:\d{2}$/.test(body.cutoffTime) ||
        typeof body.capacity !== "number" || !Number.isInteger(body.capacity) || body.capacity < 0 || body.capacity > 10_000 ||
        !Array.isArray(body.dishIds) || body.dishIds.some((id) => typeof id !== "string")) {
      return cmsJson({ error: "Configuración de calendario inválida" }, { status: 400 });
    }
    const window = await env.DB.prepare("SELECT id FROM service_windows WHERE school_id = 'school_eis' AND service_type = ? LIMIT 1")
      .bind(body.serviceType).first<{ id: string }>();
    if (!window) return cmsJson({ error: "Servicio no encontrado" }, { status: 404 });
    const uniqueDishIds = [...new Set(body.dishIds as string[])];
    if (uniqueDishIds.length) {
      const available = await env.DB.prepare(`SELECT COUNT(*) AS count FROM dishes WHERE is_active = 1 AND id IN (${uniqueDishIds.map(() => "?").join(",")})`)
        .bind(...uniqueDishIds).first<{ count: number }>();
      if (Number(available?.count ?? 0) !== uniqueDishIds.length) return cmsJson({ error: "Un platillo ya no está disponible" }, { status: 409 });
    }
    const exceptionStatus = body.status === "cancelled" ? "cancelled" : body.status === "closed" ? "closed" : "open";
    await env.DB.prepare(
      `INSERT INTO service_window_exceptions (id, service_window_id, service_date, status, delivery_time, cutoff_time, capacity, message_es, message_en, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(service_window_id, service_date) DO UPDATE SET status = excluded.status,
       delivery_time = excluded.delivery_time, cutoff_time = excluded.cutoff_time, capacity = excluded.capacity,
       message_es = excluded.message_es, message_en = excluded.message_en,
       updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP`,
    ).bind(crypto.randomUUID(), window.id, body.serviceDate, exceptionStatus, body.deliveryTime, body.cutoffTime,
      body.capacity, typeof body.messageEs === "string" ? body.messageEs.slice(0, 240) : null,
      typeof body.messageEn === "string" ? body.messageEn.slice(0, 240) : null, actorUserId).run();
    await env.DB.prepare(
      `INSERT INTO menu_days (id, school_id, service_window_id, service_date, status, published_at)
       VALUES (?, 'school_eis', ?, ?, ?, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END)
       ON CONFLICT(school_id, service_window_id, service_date) DO UPDATE SET status = excluded.status,
       published_at = CASE WHEN excluded.status = 'published' THEN CURRENT_TIMESTAMP ELSE menu_days.published_at END`,
    ).bind(crypto.randomUUID(), window.id, body.serviceDate, body.status, body.status).run();
    const menuDay = await env.DB.prepare("SELECT id FROM menu_days WHERE school_id = 'school_eis' AND service_window_id = ? AND service_date = ? LIMIT 1")
      .bind(window.id, body.serviceDate).first<{ id: string }>();
    if (!menuDay) throw new Error("menu_day_not_created");
    await env.DB.batch([
      env.DB.prepare("DELETE FROM menu_items WHERE menu_day_id = ?").bind(menuDay.id),
      ...uniqueDishIds.map((dishId, index) => env.DB.prepare(
        "INSERT INTO menu_items (menu_day_id, dish_id, capacity, remaining, sort_order) VALUES (?, ?, ?, ?, ?)",
      ).bind(menuDay.id, dishId, body.capacity, body.capacity, (index + 1) * 10)),
      env.DB.prepare(
        "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, 'calendar.updated', 'menu_day', ?)",
      ).bind(crypto.randomUUID(), actorUserId, menuDay.id),
    ]);
    return cmsJson({ ok: true, menuDayId: menuDay.id });
  }

  return cmsJson({ error: "Not found" }, { status: 404 });
}

export async function handlePublicMedia(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (request.method !== "GET" || !url.pathname.startsWith("/api/public/media/catalog/")) return null;
  const objectKey = url.pathname.slice("/api/public/media/".length);
  if (!/^catalog\/[a-f0-9-]+\.(jpg|png|webp|avif)$/.test(objectKey)) return cmsJson({ error: "Not found" }, { status: 404 });
  const object = await env.MEDIA.get(objectKey);
  if (!object) return cmsJson({ error: "Not found" }, { status: 404 });
  const headers = new Headers({ "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
}
import { authorizeRequest } from "./auth";
