"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  PipiroIcon, money, clientSlug, createClientKey, formatDateId, formatDateIdLabel, getServiceDates, isClientRecord,
} from "./pipiro-shared";
import type { Dish, DemoOrder, ServiceType, SupportRequest } from "./pipiro-shared";

type AdminSection = "overview" | "analytics" | "payments" | "menu" | "customers" | "support" | "settings";
type AdminCustomer = { id: string; display_name: string; email: string; status: string; credit_balance_cents: number };
type AdminAnalytics = {
  range: { startDate: string; endDate: string };
  summary: {
    payment_count: number; approved_payment_count: number; approved_order_count: number;
    sales_cents: number; cash_collected_cents: number; credit_used_cents: number; pending_cents: number;
  };
  topDishes: Array<{ label: string; quantity: number; revenue_cents: number }>;
  topGrades: Array<{ label: string | null; orders: number; revenue_cents: number }>;
  weekdays: Array<{ label: string; orders: number; revenue_cents: number; weekday_number: number }>;
  daily: Array<{ date: string; sales_cents: number; approved_payments: number }>;
  byBank: Array<{ id: string; label: string; bank_name: string; payment_count: number; amount_cents: number }>;
};

type CmsImportRow = {
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  categoryId: string;
  priceCents: number;
  emoji: string;
  isActive: boolean;
};

/** Thrown after kicking off a reauth redirect, so the caller's catch block can skip showing a toast. */
class ReauthRedirect extends Error {}

/** High-risk admin actions (grant admin/kitchen access, approve/cancel payments, change bank account) require a
 *  recently-created session; when the backend says so, send the admin to confirm their identity and come back. */
function throwIfReauthRequired(response: Response, payload: { error?: string }): void {
  if (response.status === 401 && payload.error === "reauth_required") {
    window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname)}&notice=reauth`;
    throw new ReauthRedirect();
  }
}

function parseCsvTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim()); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function AdminView({
  showToast,
  todayLabel,
  orders,
  refreshOrders,
  dishes,
  editDish,
  adminName,
}: {
  showToast: (message: string) => void;
  todayLabel: string;
  orders: DemoOrder[];
  refreshOrders: () => Promise<void>;
  dishes: Dish[];
  editDish: (dish: Dish | "new") => void;
  adminName: string;
}) {
  const [importRows, setImportRows] = useState<CmsImportRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [reviewingOrderId, setReviewingOrderId] = useState<string | null>(null);
  const [adminSection, setAdminSection] = useState<AdminSection>("overview");
  const fileInput = useRef<HTMLInputElement>(null);

  const previewImport = async (file: File) => {
    if (file.size > 1_000_000 || !file.name.toLocaleLowerCase("es-HN").endsWith(".csv")) {
      setImportRows([]);
      setImportErrors(["Usa un archivo CSV de hasta 1 MB."]);
      return;
    }
    const table = parseCsvTable(await file.text());
    const headers = (table[0] ?? []).map((header) => clientSlug(header).replaceAll("-", "_"));
    const required = ["nombre_es", "nombre_en", "descripcion_es", "descripcion_en", "categoria", "precio_hnl"];
    const missing = required.filter((header) => !headers.includes(header));
    if (missing.length) {
      setImportRows([]);
      setImportErrors([`Faltan columnas: ${missing.join(", ")}`]);
      return;
    }
    const valueAt = (row: string[], name: string) => row[headers.indexOf(name)]?.trim() ?? "";
    const errors: string[] = [];
    const parsed: CmsImportRow[] = [];
    table.slice(1, 201).forEach((row, index) => {
      const price = Number(valueAt(row, "precio_hnl"));
      const categoryValue = clientSlug(valueAt(row, "categoria"));
      const categoryId = categoryValue.includes("dia") ? "cat_special" : "cat_permanent";
      const values = required.map((header) => valueAt(row, header));
      if (values.some((value) => !value) || !Number.isFinite(price) || price < 0) {
        errors.push(`Fila ${index + 2}: revisa campos obligatorios y precio.`);
        return;
      }
      parsed.push({
        nameEs: valueAt(row, "nombre_es"), nameEn: valueAt(row, "nombre_en"),
        descriptionEs: valueAt(row, "descripcion_es"), descriptionEn: valueAt(row, "descripcion_en"),
        categoryId, priceCents: Math.round(price * 100), emoji: valueAt(row, "emoji") || "🍽️",
        isActive: !["no", "false", "0"].includes(valueAt(row, "activo").toLocaleLowerCase("es-HN")),
      });
    });
    setImportFileName(file.name);
    setImportRows(parsed);
    setImportErrors(errors.slice(0, 8));
    showToast(`Vista previa: ${parsed.length} filas válidas y ${errors.length} con error`);
  };

  const applyImport = async () => {
    if (!importRows.length || importErrors.length) return;
    setImporting(true);
    try {
      for (const row of importRows) {
        const existing = dishes.find((dish) => clientSlug(dish.name) === clientSlug(row.nameEs));
        const response = await fetch(existing ? `/api/demo/admin/dishes/${existing.id}` : "/api/demo/admin/dishes", {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: row.categoryId, slug: row.nameEs, nameEs: row.nameEs, nameEn: row.nameEn,
            descriptionEs: row.descriptionEs, descriptionEn: row.descriptionEn, priceCents: row.priceCents,
            prepTimeMinutes: existing?.prepTimeMinutes ?? 15,
            emoji: row.emoji, badgeEs: "", badgeEn: "", imageKey: existing?.imageKey ?? null,
            isActive: row.isActive, optionGroups: existing?.optionGroups?.map((group) => ({
              nameEs: group.name, nameEn: group.nameEn, required: group.required ?? true,
              options: group.options.map((option) => ({ nameEs: option.name, nameEn: option.nameEn, priceDeltaCents: option.priceDeltaCents ?? 0 })),
            })) ?? [],
          }),
        });
        if (!response.ok) throw new Error(`No se pudo importar ${row.nameEs}`);
      }
      await refreshOrders();
      showToast(`${importRows.length} platillos importados correctamente`);
      setImportRows([]);
      setImportFileName("");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "No se pudo aplicar la importación");
    } finally {
      setImporting(false);
    }
  };

  const reviewTransfer = async (paymentId: string, status: "approved" | "rejected" | "amount_mismatch") => {
    setReviewingOrderId(paymentId);
    try {
      const payment = orders.find((order) => order.payment_batch_id === paymentId);
      if (status === "approved" && !payment?.receipt_object_key &&
          !window.confirm("Esta orden no tiene comprobante. ¿Confirmas la aprobación manual y el envío a cocina?")) return;
      const received = status === "amount_mismatch" ? window.prompt("Monto recibido en lempiras") : null;
      if (status === "amount_mismatch" && (received === null || !Number.isFinite(Number(received)))) return;
      const reviewNote = status === "rejected"
        ? window.prompt("Motivo del rechazo (el cliente recibirá esta información)")
        : status === "amount_mismatch" ? "El monto recibido no coincide con el total del pedido" : "";
      if (status === "rejected" && (!reviewNote || reviewNote.trim().length < 5)) return;
      const response = await fetch(`/api/demo/admin/payment-batches/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote, ...(received !== null ? { receivedCents: Math.round(Number(received) * 100) } : {}) }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) { throwIfReauthRequired(response, payload); throw new Error(payload.error ?? "No se pudo conciliar la transferencia"); }
      await refreshOrders();
      showToast(status === "approved" ? "Transferencia aprobada; orden enviada a cocina" : "Transferencia rechazada");
    } catch (error) {
      if (error instanceof ReauthRedirect) return;
      showToast(error instanceof Error ? error.message : "No se pudo conciliar la transferencia");
    } finally {
      setReviewingOrderId(null);
    }
  };

  const paymentAction = async (paymentId: string, action: "request_receipt" | "remind_receipt" | "cancel") => {
    const reason = action === "cancel"
      ? window.prompt("Motivo de la cancelación (se notificará al cliente)")
      : null;
    if (action === "cancel" && (!reason || reason.trim().length < 5)) return;
    if (action === "cancel" && !window.confirm("Se cancelarán todas las órdenes incluidas en este pago. ¿Deseas continuar?")) return;
    setReviewingOrderId(paymentId);
    try {
      const response = await fetch(`/api/demo/admin/payment-batches/${paymentId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) { throwIfReauthRequired(response, payload); throw new Error(payload.error ?? "No se pudo completar la acción"); }
      await refreshOrders();
      showToast(action === "cancel" ? "Pedido cancelado y cliente notificado" : action === "request_receipt" ? "Solicitud de comprobante enviada" : "Recordatorio enviado");
    } catch (error) {
      if (error instanceof ReauthRedirect) return;
      showToast(error instanceof Error ? error.message : "No se pudo completar la acción");
    } finally {
      setReviewingOrderId(null);
    }
  };

  const transferGroupMap = new Map<string, DemoOrder[]>();
  for (const order of orders) {
    if (!order.payment_batch_id || !["pending", "under_review", "rejected", "amount_mismatch"].includes(order.payment_status)) continue;
    const group = transferGroupMap.get(order.payment_batch_id);
    if (group) group.push(order);
    else transferGroupMap.set(order.payment_batch_id, [order]);
  }
  const transferGroups = [...transferGroupMap.entries()];
  const pendingTransfers = transferGroups.map(([, batchOrders]) => batchOrders[0]);
  const confirmedCount = orders.filter((order) => order.payment_status === "approved").length;
  const firstName = adminName.trim().split(/\s+/)[0] || "Administrador";
  const flowRows = [
    ["Confirmados", orders.filter((order) => ["confirmed", "preparing", "ready", "packed", "out_for_delivery", "delivered"].includes(order.status)).length],
    ["En cocina", orders.filter((order) => ["preparing", "ready"].includes(order.status)).length],
    ["Empacados", orders.filter((order) => ["packed", "out_for_delivery", "delivered"].includes(order.status)).length],
    ["Entregados", orders.filter((order) => order.status === "delivered").length],
  ] as const;
  const flowBase = Math.max(1, flowRows[0][1]);

  return (
    <div className="ops-page page-content">
      <section className="ops-heading">
        <div>
          <p className="eyebrow">OPERACIÓN · {todayLabel}</p>
          <h1>Buenos días, {firstName}</h1>
          <p>Todo lo importante para la jornada de hoy.</p>
        </div>
        <button className="primary-action" onClick={() => editDish("new")}>+ Nuevo platillo</button>
      </section>

      <nav className="admin-section-nav" aria-label="Secciones de administración">
        {([
          ["overview", "Resumen"], ["analytics", "Ventas"], ["payments", "Pagos"], ["menu", "Menú y calendario"],
          ["customers", "Clientes"], ["support", "Mensajes"], ["settings", "Configuración"],
        ] as Array<[AdminSection, string]>).map(([id, label]) => (
          <button key={id} className={adminSection === id ? "active" : ""} onClick={() => setAdminSection(id)}>{label}</button>
        ))}
      </nav>

      {adminSection === "overview" && <div className="metric-grid">
        <MetricCard icon="▤" value={String(orders.length)} label="Pedidos reales" detail="Clientes registrados en Pipiro" tone="blue" />
        <MetricCard icon="✓" value={String(confirmedCount)} label="Pagos aprobados" detail="Disponibles para cocina" tone="green" />
        <MetricCard icon="○" value={String(orders.filter((order) => ["confirmed", "preparing", "ready"].includes(order.status)).length)} label="En operación" detail="Preparación y empaque" tone="gold" />
        <MetricCard icon="!" value={String(pendingTransfers.length)} label="Transferencias pendientes" detail="Revisar comprobantes" tone="red" />
      </div>}

      <div className="ops-grid" data-admin-section={adminSection}>
        <SalesAnalyticsPanel />
        <PaymentSettingsPanel showToast={showToast} />
        <CreditAdminPanel showToast={showToast} refresh={refreshOrders} />
        <SupportAdminPanel showToast={showToast} />
        <StaffAccessPanel showToast={showToast} />
        <DeliveryConfirmationsPanel />
        <section className="panel import-panel">
          <div className="panel-title">
            <div>
              <span className="panel-icon">⇧</span>
              <div><h2>Importación masiva</h2><p>Menús, precios y calendarios</p></div>
            </div>
            <span className="safe-chip">Vista previa segura</span>
          </div>
          <div className={`drop-zone ${importRows.length ? "has-file" : ""}`}>
            <span className="upload-orbit" aria-hidden="true">{importRows.length ? "✓" : "⇧"}</span>
            <h3>{importFileName || "Selecciona tu archivo de catálogo"}</h3>
            <p>{importFileName ? `${importRows.length} filas válidas · ${importErrors.length} errores` : "CSV de hasta 1 MB · máximo 200 filas"}</p>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => event.target.files?.[0] && void previewImport(event.target.files[0])}
              className="visually-hidden"
            />
            <button onClick={() => fileInput.current?.click()}>{importFileName ? "Cambiar archivo" : "Seleccionar archivo"}</button>
          </div>
          {importFileName && (
            <div className="import-result">
              <div><strong>{importRows.filter((row) => !dishes.some((dish) => clientSlug(dish.name) === clientSlug(row.nameEs))).length}</strong><span>Nuevos</span></div>
              <div><strong>{importRows.filter((row) => dishes.some((dish) => clientSlug(dish.name) === clientSlug(row.nameEs))).length}</strong><span>Cambios</span></div>
              <div><strong>{importErrors.length}</strong><span>Errores</span></div>
              <button disabled={importing || Boolean(importErrors.length)} onClick={() => void applyImport()}>{importing ? "Aplicando…" : "Aplicar importación"}</button>
            </div>
          )}
          {importErrors.length > 0 && <div className="import-errors">{importErrors.map((error) => <span key={error}>{error}</span>)}</div>}
        </section>

        <section className="panel today-panel catalog-panel">
          <div className="panel-title">
              <div><span className="panel-icon">▦</span><div><h2>Catálogo de platillos</h2><p>{dishes.filter((dish) => dish.isActive !== false).length} activos · {dishes.filter((dish) => dish.isActive === false).length} inactivos</p></div></div>
            <button className="text-button" onClick={() => editDish("new")}>Agregar</button>
          </div>
          <div className="catalog-admin-list">
            {dishes.map((dish) => (
              <button key={dish.id} className={dish.isActive === false ? "is-inactive" : ""} onClick={() => editDish(dish)}>
                <span>{dish.imageUrl ? <Image src={dish.imageUrl} alt="" width={44} height={44} unoptimized /> : <PipiroIcon name="meal" />}</span>
                <div><strong>{dish.name}</strong><small>{dish.category} · {money.format(dish.price / 100)}</small></div>
                <em>{dish.isActive === false ? "Inactivo" : "Editar"}</em>
              </button>
            ))}
          </div>
        </section>

        <CalendarManager dishes={dishes.filter((dish) => dish.isActive !== false)} showToast={showToast} />

        <section className="panel wide-panel flow-panel">
          <div className="panel-title">
            <div><span className="panel-icon">◎</span><div><h2>Flujo de entrega</h2><p>Seguimiento por etapa</p></div></div>
            <button className="text-button">Ver operación →</button>
          </div>
          <div className="flow-summary">
            {flowRows.map(([label, value], index) => (
              <div className="flow-item" key={label}>
                <span className="flow-number">{index + 1}</span>
                <div><strong>{label}</strong><span><i style={{ width: `${Math.round((value / flowBase) * 100)}%` }} /> </span></div>
                <b>{value}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="panel wide-panel transfer-panel">
          <div className="panel-title">
            <div><span className="panel-icon">L</span><div><h2>Conciliación de transferencias</h2><p>Comprobantes enviados por clientes</p></div></div>
            <span className="safe-chip">{pendingTransfers.length} pendientes</span>
          </div>
          <div className="transfer-list">
            {transferGroups.map(([paymentId, batchOrders]) => {
              const payment = batchOrders[0];
              const busy = reviewingOrderId === paymentId;
              const total = batchOrders.reduce((sum, candidate) => sum + candidate.total_cents, 0);
              const statusLabel = ({ pending: "Esperando comprobante", under_review: "Comprobante en revisión", rejected: "Comprobante rechazado", amount_mismatch: "Monto incorrecto" } as Record<string, string>)[payment.payment_status] ?? payment.payment_status;
              return (
                <article className="transfer-row transfer-detail-card" key={paymentId}>
                  <header className="transfer-summary">
                    <div><strong>{payment.checkout_number ?? payment.order_number}</strong><span className={`payment-state state-${payment.payment_status}`}>{statusLabel}</span></div>
                    <b>{money.format(total / 100)}</b>
                  </header>
                  <div className="transfer-customer">
                    <div><small>Comprador</small><strong>{payment.guardian_name}</strong><span>{payment.guardian_email}</span></div>
                    <div><small>Transferencia</small><strong>{payment.bank_label ?? payment.bank_name ?? "Banco sin asignar"}</strong><span>{payment.customer_reference ? `Referencia bancaria: ${payment.customer_reference}` : "Sin referencia bancaria"}</span></div>
                    <div><small>Entrega</small><strong>{payment.service_date} · {payment.delivery_time}</strong><span>{batchOrders.length} {batchOrders.length === 1 ? "orden" : "órdenes"} en este pago</span></div>
                  </div>
                  <div className="transfer-order-details">
                    {batchOrders.map((order) => (
                      <section key={order.id}>
                        <div><strong>{order.student_name}</strong><span>{order.order_number} · {order.classroom}</span></div>
                        <p>{order.dish}</p>
                        {order.allergies && <small><b>Alergias:</b> {order.allergies}</small>}
                        {order.special_instructions && <small><b>Instrucciones:</b> {order.special_instructions}</small>}
                        {order.student_delivery_notes && <small><b>Entrega:</b> {order.student_delivery_notes}</small>}
                        <em>{money.format(order.total_cents / 100)}</em>
                      </section>
                    ))}
                  </div>
                  <div className="transfer-proof">
                    <div><strong>{payment.receipt_object_key ? `Comprobante: ${payment.receipt_original_name ?? "imagen recibida"}` : "Comprobante pendiente"}</strong>
                      <span>{payment.receipt_submitted_at ? `Recibido: ${payment.receipt_submitted_at}` : payment.receipt_requested_at ? `Solicitado ${payment.receipt_request_count} ${payment.receipt_request_count === 1 ? "vez" : "veces"}` : "Aún no se ha solicitado desde Administración"}</span>
                    </div>
                    {payment.receipt_object_key && <a href={`/api/demo/admin/payments/${paymentId}/receipt`} target="_blank" rel="noreferrer">Ver comprobante</a>}
                  </div>
                  <div className="transfer-actions">
                    {!payment.receipt_object_key && <button className="secondary-transfer" disabled={busy} onClick={() => void paymentAction(paymentId, "request_receipt")}>Pedir comprobante</button>}
                    {!payment.receipt_object_key && <button className="secondary-transfer" disabled={busy} onClick={() => void paymentAction(paymentId, "remind_receipt")}>Enviar recordatorio</button>}
                    {!payment.receipt_object_key && <button disabled={busy} onClick={() => void reviewTransfer(paymentId, "approved")}>Aprobar manualmente</button>}
                    {payment.receipt_object_key && <button className="reject-transfer" disabled={busy} onClick={() => void reviewTransfer(paymentId, "rejected")}>Rechazar comprobante</button>}
                    {payment.receipt_object_key && <button className="secondary-transfer" disabled={busy} onClick={() => void reviewTransfer(paymentId, "amount_mismatch")}>Monto incorrecto</button>}
                    {payment.receipt_object_key && <button disabled={busy} onClick={() => void reviewTransfer(paymentId, "approved")}>Aprobar y enviar a cocina</button>}
                    <button className="cancel-transfer" disabled={busy} onClick={() => void paymentAction(paymentId, "cancel")}>Cancelar pedido</button>
                  </div>
                </article>
              );
            })}
            {!pendingTransfers.length && <div className="empty-transfer">No hay transferencias pendientes.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function SalesAnalyticsPanel() {
  const today = formatDateId(new Date());
  const [startDate, setStartDate] = useState(`${today.slice(0, 8)}01`);
  const [endDate, setEndDate] = useState(today);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/demo/admin/analytics?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`, {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json() as AdminAnalytics & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las métricas");
      setAnalytics(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las métricas");
    } finally {
      setBusy(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  const summary = analytics?.summary;
  const approvedPayments = Number(summary?.approved_payment_count ?? 0);
  const averageTicket = approvedPayments ? Number(summary?.sales_cents ?? 0) / approvedPayments : 0;
  const maxDish = Math.max(1, ...((analytics?.topDishes ?? []).map((item) => Number(item.quantity))));
  const maxGrade = Math.max(1, ...((analytics?.topGrades ?? []).map((item) => Number(item.orders))));
  const maxWeekday = Math.max(1, ...((analytics?.weekdays ?? []).map((item) => Number(item.orders))));

  const ranking = (
    title: string,
    subtitle: string,
    rows: Array<{ label: string; count: number; amount: number }>,
    maximum: number,
  ) => (
    <section className="analytics-ranking">
      <header><div><h3>{title}</h3><p>{subtitle}</p></div></header>
      <div className="analytics-bars">
        {rows.map((row) => <article key={row.label}>
          <div><strong>{row.label}</strong><span>{row.count} pedidos · {money.format(row.amount / 100)}</span></div>
          <i><b style={{ width: `${Math.max(4, Math.round((row.count / maximum) * 100))}%` }} /></i>
        </article>)}
        {!rows.length && <p className="analytics-empty">Sin ventas aprobadas en este período.</p>}
      </div>
    </section>
  );

  return <section className="panel wide-panel analytics-panel">
    <div className="panel-title analytics-heading">
      <div><span className="panel-icon"><PipiroIcon name="orders" /></span><div><h2>Ventas y pagos</h2><p>Información contable básica basada únicamente en pagos aprobados</p></div></div>
      <div className="analytics-filters">
        <label><span>Desde</span><input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label><span>Hasta</span><input type="date" value={endDate} min={startDate} max={today} onChange={(event) => setEndDate(event.target.value)} /></label>
        <button onClick={() => void load()} disabled={busy}>{busy ? "Actualizando…" : "Actualizar"}</button>
      </div>
    </div>
    {error && <p className="form-error">{error}</p>}
    <div className="metric-grid analytics-metrics">
      <MetricCard icon="L" value={money.format(Number(summary?.sales_cents ?? 0) / 100)} label="Ventas aprobadas" detail={`${Number(summary?.approved_order_count ?? 0)} pedidos · ticket ${money.format(averageTicket / 100)}`} tone="blue" />
      <MetricCard icon="✓" value={money.format(Number(summary?.cash_collected_cents ?? 0) / 100)} label="Cobrado" detail={`${approvedPayments} pagos conciliados`} tone="green" />
      <MetricCard icon="C" value={money.format(Number(summary?.credit_used_cents ?? 0) / 100)} label="Crédito utilizado" detail="Saldo aplicado por clientes" tone="gold" />
      <MetricCard icon="!" value={money.format(Number(summary?.pending_cents ?? 0) / 100)} label="Por conciliar" detail="Pendiente, en revisión o con diferencia" tone="red" />
    </div>
    <p className="accounting-note">“Ventas aprobadas” representa ingresos por pedidos conciliados; todavía no descuenta costos de ingredientes, personal, impuestos ni otros gastos, por lo que no equivale a utilidad.</p>
    <div className="analytics-ranking-grid">
      {ranking("Platillos más vendidos", "Unidades e ingresos", (analytics?.topDishes ?? []).map((item) => ({ label: item.label, count: Number(item.quantity), amount: Number(item.revenue_cents) })), maxDish)}
      {ranking("Grados con más pedidos", "Pedidos e ingresos", (analytics?.topGrades ?? []).map((item) => ({ label: item.label || "Sin grado", count: Number(item.orders), amount: Number(item.revenue_cents) })), maxGrade)}
      {ranking("Días con más ventas", "Según fecha de entrega", (analytics?.weekdays ?? []).map((item) => ({ label: item.label, count: Number(item.orders), amount: Number(item.revenue_cents) })), maxWeekday)}
    </div>
    <section className="bank-sales-summary">
      <header><div><h3>Transferencias por banco</h3><p>Totales aprobados según la cuenta seleccionada por el cliente</p></div></header>
      <div>{(analytics?.byBank ?? []).map((bank) => <article key={bank.id}><span><strong>{bank.label}</strong><small>{bank.bank_name} · {Number(bank.payment_count)} pagos</small></span><b>{money.format(Number(bank.amount_cents) / 100)}</b></article>)}</div>
      {!analytics?.byBank?.length && <p className="analytics-empty">No hay transferencias aprobadas en este período.</p>}
    </section>
  </section>;
}

function PaymentSettingsPanel({ showToast }: { showToast: (message: string) => void }) {
  type AdminBank = { id?: string; label: string; bankName: string; accountHolder: string; accountNumber: string; accountType: string; instructions: string; isActive: boolean };
  const blank: AdminBank = { label: "", bankName: "", accountHolder: "CHM SA", accountNumber: "", accountType: "", instructions: "", isActive: true };
  const [accounts, setAccounts] = useState<AdminBank[]>([]);
  const [values, setValues] = useState<AdminBank>(blank);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const response = await fetch("/api/demo/admin/payment-settings"); if (!response.ok) return; const payload = await response.json() as { accounts?: Array<{ id: string; label: string; bank_name: string; account_holder: string; account_number: string; account_type: string; instructions: string | null; is_active: number }> }; setAccounts((payload.accounts ?? []).map((account) => ({ id: account.id, label: account.label, bankName: account.bank_name, accountHolder: account.account_holder, accountNumber: account.account_number, accountType: account.account_type, instructions: account.instructions ?? "", isActive: Boolean(account.is_active) }))); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const save = async () => {
    setBusy(true);
    try {
      const response = await fetch(values.id ? `/api/demo/admin/payment-settings/${values.id}` : "/api/demo/admin/payment-settings", { method: values.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) { throwIfReauthRequired(response, payload); throw new Error(payload.error ?? "No se pudo guardar"); }
      await load(); setValues(blank); showToast("Cuenta bancaria guardada");
    } catch (cause) { if (cause instanceof ReauthRedirect) return; showToast(cause instanceof Error ? cause.message : "No se pudo guardar"); } finally { setBusy(false); }
  };
  return <section className="panel payment-settings-panel"><div className="panel-title"><div><span className="panel-icon"><PipiroIcon name="bank" /></span><div><h2>Bancos para transferencias</h2><p>El cliente escoge una cuenta y esa selección queda vinculada al pago</p></div></div><button className="secondary-action" onClick={() => setValues(blank)}>Agregar banco</button></div><div className="bank-admin-list">{accounts.map((account) => <button key={account.id} className={!account.isActive ? "inactive" : ""} onClick={() => setValues(account)}><strong>{account.label}</strong><span>{account.bankName} · {account.accountType} · {account.accountNumber}</span><em>{account.isActive ? "Activo" : "Oculto"}</em></button>)}</div><div className="admin-inline-form">
    {[['label','Nombre visible'],['bankName','Banco'],['accountHolder','Titular'],['accountNumber','Número de cuenta'],['accountType','Tipo de cuenta'],['instructions','Instrucciones opcionales']].map(([key,label]) => <label key={key}><span>{label}</span><input value={String(values[key as keyof AdminBank] ?? "")} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
    {values.id && <label className="admin-checkbox"><input type="checkbox" checked={values.isActive} onChange={(event) => setValues((current) => ({ ...current, isActive: event.target.checked }))} /><span>Cuenta disponible para clientes</span></label>}
    <button disabled={busy || !values.label || !values.bankName || !values.accountNumber || !values.accountType} onClick={() => void save()}>{busy ? "Guardando…" : values.id ? "Actualizar cuenta" : "Agregar cuenta"}</button></div></section>;
}

function CreditAdminPanel({ showToast, refresh }: { showToast: (message: string) => void; refresh: () => Promise<void> }) {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const loadCustomers = useCallback(async () => {
    const response = await fetch("/api/demo/admin/customers", { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const payload = await response.json() as { customers?: AdminCustomer[] };
    const next = payload.customers ?? [];
    setCustomers(next);
    setUserId((current) => next.some((customer) => customer.id === current) ? current : next[0]?.id ?? "");
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/demo/admin/customers", { headers: { Accept: "application/json" }, signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ customers?: AdminCustomer[] }> : null)
      .then((payload) => {
        const next = payload?.customers ?? [];
        setCustomers(next);
        setUserId(next[0]?.id ?? "");
      }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const grant = async () => {
    const amountCents = Math.round(Number(amount) * 100);
    const response = await fetch("/api/demo/admin/credits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, amountCents, reason }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { showToast(payload.error ?? "No se pudo crear el crédito"); return; }
    setAmount(""); setReason(""); await Promise.all([refresh(), loadCustomers()]); showToast("Crédito agregado al cliente seleccionado");
  };
  const selected = customers.find((customer) => customer.id === userId);
  return <section className="panel credit-panel wide-panel"><div className="panel-title"><div><span className="panel-icon">L</span><div><h2>Crédito de cliente</h2><p>Selecciona exactamente quién recibirá el saldo</p></div></div>{selected && <span className="safe-chip">Saldo {money.format(selected.credit_balance_cents / 100)}</span>}</div><div className="admin-inline-form"><label className="credit-recipient"><span>Cliente</span><select value={userId} onChange={(event) => setUserId(event.target.value)}>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.display_name} · {customer.email}</option>)}</select></label><label><span>Monto HNL</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="150.00" /></label><label><span>Motivo</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Cancelación o ajuste" /></label><button disabled={!userId || !amount || reason.trim().length < 3} onClick={() => void grant()}>Crear crédito</button></div></section>;
}

function StaffAccessPanel({ showToast }: { showToast: (message: string) => void }) {
  const [staff, setStaff] = useState<Array<{ id: string; display_name: string; email: string; status: string; roles: string }>>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "kitchen" | "delivery">("kitchen");
  const [busy, setBusy] = useState(false);
  const loadStaff = useCallback(async () => {
    const response = await fetch("/api/demo/admin/staff", { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const payload = await response.json() as { staff?: typeof staff };
    setStaff(payload.staff ?? []);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/demo/admin/staff", { headers: { Accept: "application/json" }, signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ staff?: typeof staff }> : null)
      .then((payload) => setStaff(payload?.staff ?? [])).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const invite = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/demo/admin/staff-invitations", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, email, role }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) { throwIfReauthRequired(response, payload); throw new Error(payload.error ?? "No se pudo crear la invitación"); }
      setDisplayName(""); setEmail(""); await loadStaff(); showToast("Acceso creado; se activará al ingresar con ese correo");
    } catch (cause) { if (cause instanceof ReauthRedirect) return; showToast(cause instanceof Error ? cause.message : "No se pudo crear la invitación"); } finally { setBusy(false); }
  };
  return <section className="panel staff-access-panel wide-panel"><div className="panel-title"><div><span className="panel-icon"><PipiroIcon name="user" /></span><div><h2>Accesos del personal</h2><p>Solo las personas que invites reciben rol de Administración, Cocina o Entrega</p></div></div><span className="safe-chip">{staff.length} autorizados</span></div><div className="staff-list">{staff.map((person) => <article key={person.id}><div><strong>{person.display_name}</strong><span>{person.email}</span></div><em>{person.roles.split(",").join(" · ")}</em><small>{person.status === "active" ? "Activo" : "Invitado"}</small></article>)}</div><div className="admin-inline-form staff-invite-form"><label><span>Nombre</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label><span>Correo autorizado</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span>Rol</span><select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="kitchen">Cocina</option><option value="delivery">Entrega</option><option value="admin">Administrador</option></select></label><button disabled={busy || displayName.trim().length < 2 || !email.includes("@")} onClick={() => void invite()}>{busy ? "Creando…" : "Crear invitación"}</button></div><p className="panel-footnote">El acceso por PIN para dispositivos compartidos de cocina se configurará cuando definamos el equipo; no usaremos un PIN global compartido.</p></section>;
}

function DeliveryConfirmationsPanel() {
  type DeliveryConfirmation = { id: string; order_count: number; created_at: string; delivered_by: string };
  const [confirmations, setConfirmations] = useState<DeliveryConfirmation[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/demo/admin/delivery-confirmations", { headers: { Accept: "application/json" }, signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ confirmations?: DeliveryConfirmation[] }> : null)
      .then((payload) => setConfirmations(payload?.confirmations ?? [])).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const dateFormat = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short" });
  return <section className="panel delivery-confirmations-panel wide-panel"><div className="panel-title"><div><span className="panel-icon"><PipiroIcon name="check" /></span><div><h2>Evidencia de entregas</h2><p>Fotos confirmando la entrega en el punto de recolección</p></div></div><span className="safe-chip">{confirmations.length} registradas</span></div><div className="delivery-confirmations-list">{confirmations.map((confirmation) => <article key={confirmation.id}><div><strong>{confirmation.order_count} pedido(s)</strong><span>{confirmation.delivered_by} · {dateFormat.format(new Date(confirmation.created_at))}</span></div><a href={`/api/demo/admin/delivery-confirmations/${confirmation.id}/photo`} target="_blank" rel="noreferrer">Ver foto</a></article>)}{!confirmations.length && <div className="empty-transfer">Aún no hay entregas confirmadas con foto.</div>}</div></section>;
}

type AdminSupportRequest = SupportRequest & { display_name: string; order_number: string | null };

function SupportAdminPanel({ showToast }: { showToast: (message: string) => void }) {
  const [requests, setRequests] = useState<AdminSupportRequest[]>([]);
  const load = useCallback(async () => {
    const response = await fetch("/api/demo/admin/support");
    if (!response.ok) return;
    const payload = await response.json() as { requests: AdminSupportRequest[] };
    setRequests(payload.requests);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  return <section className="panel support-admin-panel"><div className="panel-title"><div><span className="panel-icon"><PipiroIcon name="help" /></span><div><h2>Mensajes de clientes</h2><p>Responde, da seguimiento y cierra solicitudes</p></div></div><span className="safe-chip">{requests.filter((item) => ["open", "in_progress"].includes(item.status)).length} pendientes</span></div><div className="support-admin-list">{requests.map((item) => <SupportAdminItem key={item.id} item={item} saved={async () => { await load(); showToast("Mensaje actualizado"); }} showToast={showToast} />)}{!requests.length && <div className="empty-transfer">No hay mensajes pendientes.</div>}</div></section>;
}

function SupportAdminItem({ item, saved, showToast }: { item: AdminSupportRequest; saved: () => Promise<void>; showToast: (message: string) => void }) {
  const [note, setNote] = useState(item.admin_note ?? "");
  const [status, setStatus] = useState(item.status);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/demo/admin/support/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adminNote: note, status }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo actualizar el mensaje");
      await saved();
    } catch (cause) { showToast(cause instanceof Error ? cause.message : "No se pudo actualizar el mensaje"); } finally { setBusy(false); }
  };
  return <article><header><div><strong>{item.subject}</strong><span>{item.display_name}{item.order_number ? ` · ${item.order_number}` : ""}</span></div><em>{item.category}</em></header><p>{item.message}</p><label><span>Respuesta para el cliente</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="Escribe la respuesta que verá el cliente" /></label><footer><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">Abierto</option><option value="in_progress">En seguimiento</option><option value="resolved">Resuelto</option><option value="closed">Cerrado</option></select><button disabled={busy} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar respuesta"}</button></footer></article>;
}

function MetricCard({ icon, value, label, detail, tone }: { icon: string; value: string; label: string; detail: string; tone: string }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span className="metric-icon">{icon}</span>
      <div><strong>{value}</strong><h3>{label}</h3><p>{detail}</p></div>
    </article>
  );
}

type EditableOption = { key: string; nameEs: string; nameEn: string; priceHnl: string };
type EditableGroup = { key: string; nameEs: string; nameEn: string; required: boolean; options: EditableOption[] };

export function AdminDishDialog({ dish, close, saved }: { dish: Dish | null; close: () => void; saved: () => Promise<void> }) {
  const [nameEs, setNameEs] = useState(dish?.name ?? "");
  const [nameEn, setNameEn] = useState(dish?.nameEn ?? "");
  const [descriptionEs, setDescriptionEs] = useState(dish?.description ?? "");
  const [descriptionEn, setDescriptionEn] = useState(dish?.descriptionEn ?? "");
  const [categoryId, setCategoryId] = useState(dish?.categoryId ?? (dish?.category === "Menú fijo" ? "cat_permanent" : "cat_special"));
  const [priceHnl, setPriceHnl] = useState(dish ? String(dish.price / 100) : "");
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(String(dish?.prepTimeMinutes ?? 15));
  const emoji = dish?.emoji ?? "meal";
  const [badgeEs, setBadgeEs] = useState(dish?.badge ?? "");
  const [badgeEn, setBadgeEn] = useState("");
  const [imageKey, setImageKey] = useState<string | null>(dish?.imageKey ?? null);
  const [imageUrl, setImageUrl] = useState<string | undefined>(dish?.imageUrl);
  const [isActive, setIsActive] = useState(dish?.isActive ?? true);
  const [groups, setGroups] = useState<EditableGroup[]>(() => (dish?.optionGroups ?? []).map((group) => ({
    key: group.id,
    nameEs: group.name,
    nameEn: group.nameEn,
    required: group.required ?? true,
    options: group.options.map((option) => ({
      key: option.id, nameEs: option.name, nameEn: option.nameEn,
      priceHnl: String((option.priceDeltaCents ?? 0) / 100),
    })),
  })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addGroup = () => setGroups((current) => [...current, {
    key: createClientKey("group"), nameEs: "", nameEn: "", required: true,
    options: [{ key: createClientKey("option"), nameEs: "", nameEn: "", priceHnl: "0" }],
  }]);
  const updateGroup = (key: string, patch: Partial<EditableGroup>) => setGroups((current) =>
    current.map((group) => group.key === key ? { ...group, ...patch } : group));
  const addOption = (groupKey: string) => setGroups((current) => current.map((group) => group.key === groupKey
    ? { ...group, options: [...group.options, { key: createClientKey("option"), nameEs: "", nameEn: "", priceHnl: "0" }] }
    : group));
  const updateOption = (groupKey: string, optionKey: string, patch: Partial<EditableOption>) => setGroups((current) =>
    current.map((group) => group.key === groupKey ? {
      ...group, options: group.options.map((option) => option.key === optionKey ? { ...option, ...patch } : option),
    } : group));

  const uploadImage = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/demo/admin/media", { method: "POST", body: form });
      const payload = await response.json() as { objectKey?: string; url?: string; error?: string };
      if (!response.ok || !payload.objectKey || !payload.url) throw new Error(payload.error ?? "No se pudo subir la imagen");
      setImageKey(payload.objectKey);
      setImageUrl(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo subir la imagen");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const parsedPrice = Number(priceHnl);
    const parsedPrepTime = Number(prepTimeMinutes);
    if (!nameEs.trim() || !nameEn.trim() || !descriptionEs.trim() || !descriptionEn.trim() || !Number.isFinite(parsedPrice) ||
        !Number.isInteger(parsedPrepTime) || parsedPrepTime < 1 || parsedPrepTime > 180) {
      setError("Completa nombres, descripciones, precio y un tiempo de cocina válido.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(dish ? `/api/demo/admin/dishes/${dish.id}` : "/api/demo/admin/dishes", {
        method: dish ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          slug: nameEs,
          nameEs,
          nameEn,
          descriptionEs,
          descriptionEn,
          priceCents: Math.round(parsedPrice * 100),
          prepTimeMinutes: parsedPrepTime,
          emoji,
          badgeEs,
          badgeEn,
          imageKey,
          isActive,
          optionGroups: groups.map((group) => ({
            nameEs: group.nameEs,
            nameEn: group.nameEn,
            required: group.required,
            options: group.options.map((option) => ({
              nameEs: option.nameEs,
              nameEn: option.nameEn,
              priceDeltaCents: Math.round((Number(option.priceHnl) || 0) * 100),
            })),
          })),
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar el platillo");
      await saved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el platillo");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    if (!dish || !window.confirm(`¿Desactivar ${dish.name}?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/demo/admin/dishes/${dish.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("No se pudo desactivar el platillo");
      await saved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo desactivar el platillo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop cms-backdrop" role="presentation" onMouseDown={close}>
      <section className="cms-dialog" role="dialog" aria-modal="true" aria-labelledby="cms-dish-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p className="eyebrow">CMS · CATÁLOGO</p><h2 id="cms-dish-title">{dish ? "Editar platillo" : "Nuevo platillo"}</h2></div><button className="close-button" onClick={close} aria-label="Cerrar">×</button></header>
        <div className="cms-dish-layout">
          <div className="cms-image-column">
            <div className="cms-image-preview">
              {imageUrl ? <Image src={imageUrl} alt="Vista previa del platillo" fill sizes="220px" unoptimized /> : <span><PipiroIcon name="meal" size={54} /></span>}
            </div>
            <label className="cms-upload-button">Subir imagen<input className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => event.target.files?.[0] && void uploadImage(event.target.files[0])} /></label>
            <small>JPG, PNG, WebP o AVIF · máximo 5 MB</small>
          </div>
          <div className="cms-basic-fields">
            <label><span>Nombre en español</span><input value={nameEs} onChange={(event) => setNameEs(event.target.value)} /></label>
            <label><span>Nombre en inglés</span><input value={nameEn} onChange={(event) => setNameEn(event.target.value)} /></label>
            <label><span>Categoría</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="cat_permanent">Menú fijo</option><option value="cat_special">Menú del día</option></select></label>
            <label><span>Precio en lempiras</span><input inputMode="decimal" value={priceHnl} onChange={(event) => setPriceHnl(event.target.value)} /></label>
            <label><span>Tiempo de cocina</span><div className="input-with-suffix"><input type="number" min="1" max="180" value={prepTimeMinutes} onChange={(event) => setPrepTimeMinutes(event.target.value)} /><small>min</small></div></label>
            <label><span>Etiqueta</span><input value={badgeEs} onChange={(event) => setBadgeEs(event.target.value)} placeholder="Ej.: Nuevo" /></label>
            <label><span>Etiqueta en inglés</span><input value={badgeEn} onChange={(event) => setBadgeEn(event.target.value)} placeholder="E.g. New" /></label>
            <label className="full-field"><span>Descripción en español</span><textarea value={descriptionEs} onChange={(event) => setDescriptionEs(event.target.value)} /></label>
            <label className="full-field"><span>Descripción en inglés</span><textarea value={descriptionEn} onChange={(event) => setDescriptionEn(event.target.value)} /></label>
            <label className="cms-active-toggle"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /><span>Producto visible en el catálogo</span></label>
          </div>
        </div>
        <section className="cms-options-editor">
          <div className="cms-section-head"><div><h3>Opciones de preparación</h3><p>El cliente deberá completar cada grupo obligatorio.</p></div><button onClick={addGroup}>+ Agregar grupo</button></div>
          {groups.map((group) => (
            <div className="cms-option-group" key={group.key}>
              <div className="cms-group-fields">
                <input value={group.nameEs} onChange={(event) => updateGroup(group.key, { nameEs: event.target.value })} placeholder="Nombre en español" />
                <input value={group.nameEn} onChange={(event) => updateGroup(group.key, { nameEn: event.target.value })} placeholder="Name in English" />
                <label><input type="checkbox" checked={group.required} onChange={(event) => updateGroup(group.key, { required: event.target.checked })} /> Obligatorio</label>
                <button className="cms-remove" onClick={() => setGroups((current) => current.filter((item) => item.key !== group.key))}>Quitar</button>
              </div>
              {group.options.map((option) => (
                <div className="cms-option-row" key={option.key}>
                  <input value={option.nameEs} onChange={(event) => updateOption(group.key, option.key, { nameEs: event.target.value })} placeholder="Opción en español" />
                  <input value={option.nameEn} onChange={(event) => updateOption(group.key, option.key, { nameEn: event.target.value })} placeholder="Option in English" />
                  <input value={option.priceHnl} onChange={(event) => updateOption(group.key, option.key, { priceHnl: event.target.value })} inputMode="decimal" aria-label="Precio adicional" />
                  <button className="cms-remove" onClick={() => updateGroup(group.key, { options: group.options.filter((item) => item.key !== option.key) })}>×</button>
                </div>
              ))}
              <button className="cms-add-option" onClick={() => addOption(group.key)}>+ Agregar opción</button>
            </div>
          ))}
          {!groups.length && <div className="cms-empty-options">Este producto se vende sin opciones adicionales.</div>}
        </section>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer>{dish && <button className="danger-button" disabled={busy} onClick={() => void deactivate()}>Desactivar</button>}<button className="confirm-button" disabled={busy} onClick={() => void submit()}>{busy ? "Guardando…" : "Guardar platillo"}</button></footer>
      </section>
    </div>
  );
}

function CalendarManager({ dishes, showToast }: { dishes: Dish[]; showToast: (message: string) => void }) {
  const availableDates = useMemo(() => getServiceDates(new Date()), []);
  const [serviceDate, setServiceDate] = useState(availableDates[0]?.id ?? formatDateId(new Date()));
  const serviceType: ServiceType = "lunch";
  const [status, setStatus] = useState("published");
  const [deliveryTime, setDeliveryTime] = useState("11:30");
  const cutoffTime = "23:59";
  const [capacity, setCapacity] = useState("50");
  const [messageEs, setMessageEs] = useState("");
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>(() => dishes.map((dish) => dish.id));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/demo/admin/cms?start=${encodeURIComponent(serviceDate)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("No se pudo consultar el calendario");
      return response.json() as Promise<{ calendar?: unknown[] }>;
    }).then((payload) => {
      const day = (payload.calendar ?? []).find((candidate) => isClientRecord(candidate) &&
        candidate.service_date === serviceDate && candidate.service_type === serviceType);
      if (!isClientRecord(day)) {
        setStatus("draft");
        setDeliveryTime("11:30");
        setCapacity("50");
        setMessageEs("");
        setSelectedDishIds(dishes.map((dish) => dish.id));
        return;
      }
      setStatus(typeof day.status === "string" ? day.status : "draft");
      setDeliveryTime(typeof day.delivery_time === "string" ? day.delivery_time : "11:30");
      setCapacity(String(typeof day.capacity === "number" ? day.capacity : 50));
      setMessageEs(typeof day.message_es === "string" ? day.message_es : "");
      setSelectedDishIds(Array.isArray(day.dish_ids) ? day.dish_ids.filter((id): id is string => typeof id === "string") : []);
    }).catch((cause) => {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      showToast(cause instanceof Error ? cause.message : "No se pudo consultar el calendario");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [dishes, serviceDate, serviceType, showToast]);

  const saveCalendar = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/demo/admin/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceDate, serviceType, status, deliveryTime, cutoffTime,
          capacity: Number(capacity), messageEs, messageEn: "", dishIds: selectedDishIds,
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar el calendario");
      showToast(status === "published" ? "Menú publicado para la fecha seleccionada" : "Calendario actualizado");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "No se pudo guardar el calendario");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel wide-panel calendar-manager">
      <div className="panel-title"><div><span className="panel-icon">▦</span><div><h2>Calendario y ventanas de pedido</h2><p>Publica platillos, cupos y horarios por servicio</p></div></div><span className="safe-chip">Hora de Honduras</span></div>
      <div className="calendar-controls">
        <label><span>Fecha</span><select value={serviceDate} onChange={(event) => { setLoading(true); setServiceDate(event.target.value); }}>{availableDates.map((date) => <option value={date.id} key={date.id}>{formatDateIdLabel(date.id, "es")}</option>)}</select></label>
        <label><span>Servicio</span><input value="Almuerzo" readOnly /></label>
        <label><span>Estado</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">Borrador</option><option value="published">Publicado / abierto</option><option value="closed">Cerrado</option><option value="cancelled">Cancelado</option></select></label>
        <label><span>Entrega</span><input type="time" value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)} /></label>
        <label><span>Cierre</span><input value="Día anterior · 11:59 p. m." readOnly /></label>
        <label><span>Cupos por platillo</span><input type="number" min="0" max="10000" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label>
      </div>
      <label className="calendar-message"><span>Mensaje para clientes</span><input value={messageEs} onChange={(event) => setMessageEs(event.target.value)} placeholder="Ej.: No hay clases o menú especial de viernes" /></label>
      <div className="calendar-dish-picker">
        {dishes.map((dish) => (
          <label key={dish.id} className={selectedDishIds.includes(dish.id) ? "selected" : ""}>
            <input type="checkbox" checked={selectedDishIds.includes(dish.id)} onChange={() => setSelectedDishIds((current) => current.includes(dish.id) ? current.filter((id) => id !== dish.id) : [...current, dish.id])} />
            <span><PipiroIcon name="meal" /></span><div><strong>{dish.name}</strong><small>{dish.category}</small></div>
          </label>
        ))}
      </div>
      <div className="calendar-footer"><span>{loading ? "Cargando configuración…" : `${selectedDishIds.length} platillos seleccionados`}</span><button className="primary-action" disabled={busy || loading} onClick={() => void saveCalendar()}>{busy ? "Guardando…" : "Guardar y aplicar"}</button></div>
    </section>
  );
}
