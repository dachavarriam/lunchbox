"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PipiroIcon, APP_TIME_ZONE } from "./pipiro-shared";
import type { KdsOrder, KdsStage } from "./pipiro-shared";

export function KitchenView({ orders, advanceOrder, queuePrint, deliverAllPacked, showToast }: {
  orders: KdsOrder[];
  advanceOrder: (id: string) => Promise<void>;
  queuePrint: (id: string, jobType: "kitchen_ticket" | "package_label") => Promise<void>;
  deliverAllPacked: () => Promise<void>;
  showToast: (message: string) => void;
}) {
  const stages: KdsStage[] = ["Nuevas", "Preparando", "Listas", "Empacadas"];
  const count = useMemo(() => orders.filter((order) => order.stage !== "Empacadas").length, [orders]);
  const [clockMs, setClockMs] = useState(0);
  useEffect(() => {
    const first = window.setTimeout(() => setClockMs(Date.now()), 0);
    const interval = window.setInterval(() => setClockMs(Date.now()), 15_000);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  }, []);
  const elapsedMinutes = (value?: string) => value && clockMs ? Math.max(0, Math.floor((clockMs - new Date(value).getTime()) / 60_000)) : 0;
  const delayed = orders.filter((order) => order.stage === "Preparando" && elapsedMinutes(order.stageStartedAt) > order.targetMinutes).length;
  const completedDurations = orders.flatMap((order) => order.kitchenStartedAt && order.readyAt
    ? [Math.max(0, Math.round((new Date(order.readyAt).getTime() - new Date(order.kitchenStartedAt).getTime()) / 60_000))]
    : []);
  const averagePrep = completedDurations.length ? Math.round(completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length) : 0;
  const queuedPrints = orders.reduce((sum, order) => sum + order.printJobsQueued, 0);
  const productionGroups = useMemo(() => {
    const grouped = new Map<string, { name: string; quantity: number; preparing: number }>();
    for (const order of orders.filter((item) => item.stage !== "Empacadas")) {
      const name = order.dish.split(" · ")[0];
      const current = grouped.get(name) ?? { name, quantity: 0, preparing: 0 };
      current.quantity += 1;
      if (order.stage === "Preparando") current.preparing += 1;
      grouped.set(name, current);
    }
    return [...grouped.values()].sort((first, second) => second.quantity - first.quantity).slice(0, 5);
  }, [orders]);

  return (
    <div className="kds-page">
      <section className="kds-toolbar">
        <div>
          <p className="eyebrow">KDS · EIS</p>
          <h1>Servicio de almuerzo</h1>
          <span><i /> Conectado · actualización en vivo</span>
        </div>
        <div className="kds-stats">
          <div><small>Pendientes</small><strong>{count}</strong></div>
          <div className={delayed ? "kds-stat-alert" : ""}><small>Atrasadas</small><strong>{delayed}</strong></div>
          <div><small>Promedio cocina</small><strong>{averagePrep || "—"}{averagePrep ? " min" : ""}</strong></div>
          <div><small>Cola impresión</small><strong>{queuedPrints}</strong></div>
          <button className="kds-deliver-all" disabled={!orders.some((order) => order.stage === "Empacadas")} onClick={() => void deliverAllPacked()}>Confirmar entregados</button>
          <button title="Resumen agrupado de cantidades por platillo y preparación" onClick={() => showToast("Resumen por platillo y preparación listo para conectar con la impresora")}>Resumen de producción</button>
        </div>
      </section>

      <section className="kds-production-strip" aria-label="Carga de producción por platillo">
        <div><small>Mayor carga</small><strong>{productionGroups[0]?.name ?? "Sin carga pendiente"}</strong></div>
        {productionGroups.map((group) => <article key={group.name}><strong>{group.quantity}</strong><span>{group.name}</span><small>{group.preparing} en cocina</small></article>)}
      </section>

      <div className="kds-board">
        {stages.map((stage) => {
          const stageOrders = orders.filter((order) => order.stage === stage);
          return (
            <section className={`kds-column ${stage.toLowerCase()}`} key={stage} aria-labelledby={`stage-${stage}`}>
              <header>
                <div><span /> <h2 id={`stage-${stage}`}>{stage}</h2></div>
                <b>{stageOrders.length}</b>
              </header>
              <div className="kds-order-list">
                {stageOrders.map((order) => (
                  <article className={`kds-ticket ${order.allergy ? "allergy" : ""} ${order.stage === "Preparando" && elapsedMinutes(order.stageStartedAt) > order.targetMinutes ? "is-delayed" : ""}`} key={order.id}>
                    <div className="ticket-head"><strong>{order.id}</strong><time>{order.time}</time></div>
                    <h3>{order.dish}</h3>
                    <p><strong>Entrega:</strong> {order.student}</p>
                    <p><strong>Aula:</strong> {order.classroom}</p>
                    <div className="kds-timing"><span>En etapa <strong>{elapsedMinutes(order.stageStartedAt)} min</strong></span><span>Meta cocina <strong>{order.targetMinutes} min</strong></span></div>
                    {order.stage === "Preparando" && order.stageStartedAt && <small className="kds-estimate">Lista estimada: {new Intl.DateTimeFormat("es-HN", { hour: "numeric", minute: "2-digit", timeZone: APP_TIME_ZONE }).format(new Date(new Date(order.stageStartedAt).getTime() + order.targetMinutes * 60_000))}</small>}
                    {order.stage === "Preparando" && <div className="kds-progress"><i style={{ width: `${Math.min(100, (elapsedMinutes(order.stageStartedAt) / order.targetMinutes) * 100)}%` }} /></div>}
                    {order.allergy && <div className="allergy-alert"><PipiroIcon name="alert" size={15} /> {order.allergy}</div>}
                    {stage !== "Empacadas" ? (
                      <button onClick={() => void advanceOrder(order.id)}>
                        {stage === "Nuevas" ? "Aceptar orden" : stage === "Preparando" ? "Marcar lista" : "Imprimir y empacar"}
                        <span>→</span>
                      </button>
                    ) : (
                      <div className="packed-state"><PipiroIcon name="check" size={15} /> Etiqueta en cola o impresa</div>
                    )}
                    <button className="kds-print-secondary" onClick={() => void queuePrint(order.id, stage === "Empacadas" || stage === "Listas" ? "package_label" : "kitchen_ticket")}>{stage === "Empacadas" || stage === "Listas" ? "Imprimir etiqueta" : "Imprimir comanda"}</button>
                  </article>
                ))}
                {!stageOrders.length && <div className="empty-stage">Sin órdenes en esta etapa</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function DeliveryView({ orders, confirmDelivery, showToast }: {
  orders: KdsOrder[];
  confirmDelivery: (id: string, photo: File) => Promise<void>;
  showToast: (message: string) => void;
}) {
  const pending = useMemo(() => orders.filter((order) => order.stage === "Empacadas"), [orders]);

  return (
    <div className="delivery-page">
      <section className="delivery-toolbar">
        <p className="eyebrow">ENTREGA · EIS</p>
        <h1>Confirmar entrega</h1>
        <span>{pending.length} pedido(s) empacados listos para el punto de recolección</span>
        <small>Toma una foto de cada pedido al entregarlo: le queda a su familia como comprobante y como referencia si hay algún imprevisto.</small>
      </section>

      <div className="delivery-order-list">
        {pending.map((order) => <DeliveryOrderCard key={order.id} order={order} confirmDelivery={confirmDelivery} showToast={showToast} />)}
        {!pending.length && <div className="empty-stage">No hay pedidos empacados pendientes de entrega</div>}
      </div>
    </div>
  );
}

function DeliveryOrderCard({ order, confirmDelivery, showToast }: {
  order: KdsOrder;
  confirmDelivery: (id: string, photo: File) => Promise<void>;
  showToast: (message: string) => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const pickPhoto = (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const confirm = async () => {
    if (!photo) { showToast("Toma o selecciona una foto de este pedido antes de confirmar"); return; }
    setConfirming(true);
    try {
      await confirmDelivery(order.id, photo);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <article className="delivery-ticket">
      <div className="delivery-ticket-info">
        <strong>{order.student}</strong>
        <span>{order.classroom}</span>
        <small>{order.dish}</small>
      </div>
      {previewUrl && <img className="delivery-photo-preview" src={previewUrl} alt="Vista previa de la evidencia de entrega" />}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        onChange={(event) => event.target.files?.[0] && pickPhoto(event.target.files[0])}
        className="visually-hidden"
      />
      <div className="delivery-ticket-actions">
        <button className="delivery-photo-button" onClick={() => fileInput.current?.click()}>{photo ? "Cambiar foto" : "Tomar foto"}</button>
        <button className="delivery-confirm-button" disabled={!photo || confirming} onClick={() => void confirm()}>
          {confirming ? "Confirmando…" : "Confirmar entrega"}
        </button>
      </div>
    </article>
  );
}
