"use client";

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ORDER_DRAFT_KEY, PipiroIcon, base64UrlToBytes, cartItemUnitPrice, createClientKey, dishes,
  formatDateId, formatDateIdLabel, formatLongDate, getServiceDates, initialKdsOrders, isClientRecord, money,
  parseSavedOrderDraft, students, ui,
} from "./pipiro-shared";
import type {
  AppNotification, Availability, BankTransferConfig, CartItem, Category, CreatedOrder, Dish, DemoOrder,
  AuthenticatedUser, FamilyDataState, InstallPromptEvent, KdsStage, Language, OptionGroup, PaymentIssue,
  PaymentMethod, PushState, SavedOrderDraft, ServiceDate, ServiceType, Student, Surface, SupportRequest,
} from "./pipiro-shared";

const LazyAdminView = lazy(() => import("./admin-view").then((module) => ({ default: module.AdminView })));
const LazyAdminDishDialog = lazy(() => import("./admin-view").then((module) => ({ default: module.AdminDishDialog })));
const LazyKitchenView = lazy(() => import("./kitchen-view").then((module) => ({ default: module.KitchenView })));

function SurfaceLoading() {
  return <div className="page-content" style={{ padding: "3rem", textAlign: "center" }}>Cargando…</div>;
}

export function PrototypeApp({ initialSurface = "family", nowIso }: { initialSurface?: Surface; nowIso: string }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const serviceDates = useMemo(() => getServiceDates(now), [now]);
  const [surface] = useState<Surface>(initialSurface);
  const [language, setLanguage] = useState<Language>("es");
  const [studentId, setStudentId] = useState(students[0].id);
  const [demoStudents, setDemoStudents] = useState<Student[]>(students);
  const [catalogDishes, setCatalogDishes] = useState<Dish[]>(dishes);
  const [selectedDate, setSelectedDate] = useState(() => serviceDates[0]?.id ?? formatDateId(now));
  const [category, setCategory] = useState<Category>("Todos");
  const [serviceType, setServiceType] = useState<ServiceType>("lunch");
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [requestKey, setRequestKey] = useState(() => createClientKey("order"));
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [createdRecipientIds, setCreatedRecipientIds] = useState<string[]>([]);
  const [demoOrders, setDemoOrders] = useState<DemoOrder[]>([]);
  const [profileStudent, setProfileStudent] = useState<Student | "new" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [adminDish, setAdminDish] = useState<Dish | "new" | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankTransferConfig[]>([{
    id: "bank_default",
    label: "BAC Credomatic",
    bankName: "BAC Credomatic",
    accountHolder: "CHM SA",
    accountNumber: "Pendiente de configurar",
    accountType: "Cuenta por configurar",
  }]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("bank_default");
  const [toast, setToast] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [kdsOrders, setKdsOrders] = useState(initialKdsOrders);
  const [creditBalanceCents, setCreditBalanceCents] = useState(0);
  const [paymentIssues, setPaymentIssues] = useState<PaymentIssue[]>([]);
  const [applyCredit, setApplyCredit] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthenticatedUser | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pushState, setPushState] = useState<PushState>("loading");
  const [familyDataState, setFamilyDataState] = useState<FamilyDataState>(surface === "family" ? "loading" : "demo");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftReady = useRef(false);
  const t = ui[language];
  const todayLabel = formatLongDate(now, language);
  const selectedDateLabel = formatDateIdLabel(selectedDate, language);
  const todayId = formatDateId(now);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);

  useEffect(() => {
    if (surface !== "family") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      const unsupportedTimer = window.setTimeout(() => setPushState("unsupported"), 0);
      return () => window.clearTimeout(unsupportedTimer);
    }
    const timer = window.setTimeout(() => void Promise.all([
      navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()),
      fetch("/api/demo/notifications/push-config", { headers: { Accept: "application/json" } }),
    ]).then(async ([subscription, response]) => {
      if (!response.ok) { setPushState("unconfigured"); return; }
      const config = await response.json() as { enabled?: boolean };
      if (!config.enabled) { setPushState("unconfigured"); return; }
      if (subscription) {
        const saved = await fetch("/api/demo/notifications/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
        setPushState(saved.ok ? "active" : "available");
        return;
      }
      setPushState(Notification.permission === "denied" ? "denied" : "available");
    }).catch(() => setPushState("unconfigured")), 0);
    return () => window.clearTimeout(timer);
  }, [surface]);

  useEffect(() => {
    document.documentElement.lang = language === "es" ? "es-HN" : "en-US";
  }, [language]);

  useEffect(() => {
    void fetch("/api/auth/session", { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() as Promise<{ authenticated: boolean; user?: AuthenticatedUser }> : null)
      .then((session) => setAuthenticatedUser(session?.authenticated && session.user ? session.user : null))
      .catch(() => setAuthenticatedUser(null));
  }, [surface]);

  useEffect(() => {
    if (surface !== "family") return;
    const restoreDraft = window.setTimeout(() => {
      const stored = window.localStorage.getItem(ORDER_DRAFT_KEY);
      const draft = stored ? parseSavedOrderDraft(stored) : null;
      if (draft && draft.cart.length > 0 && serviceDates.some((date) => date.id === draft.serviceDate)) {
        setRequestKey(draft.requestKey);
        setStudentId(draft.studentId);
        setServiceType(draft.serviceType);
        setSelectedDate(draft.serviceDate);
        setOrderNotes(draft.orderNotes);
        setPaymentMethod(draft.paymentMethod);
        setCart(draft.cart);
      } else if (stored) {
        window.localStorage.removeItem(ORDER_DRAFT_KEY);
      }
      draftReady.current = true;
    }, 0);
    return () => window.clearTimeout(restoreDraft);
  }, [serviceDates, surface]);

  useEffect(() => {
    if (surface !== "family" || !draftReady.current) return;
    if (!cart.length) {
      window.localStorage.removeItem(ORDER_DRAFT_KEY);
      return;
    }
    const draft: SavedOrderDraft = {
      version: 1,
      requestKey,
      studentId,
      serviceType,
      serviceDate: selectedDate,
      orderNotes,
      paymentMethod,
      cart,
    };
    window.localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(draft));
  }, [cart, orderNotes, paymentMethod, requestKey, selectedDate, serviceType, studentId, surface]);

  const refreshDemoOrders = useCallback(async () => {
    try {
      const endpoint = surface === "kitchen" ? "/api/demo/kds" : surface === "admin" ? "/api/demo/bootstrap?surface=admin" : "/api/demo/bootstrap";
      const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        if (surface === "family") setFamilyDataState("error");
        return;
      }
      const payload = await response.json() as {
        demo?: boolean;
        user?: AuthenticatedUser;
        orders?: DemoOrder[];
        creditBalanceCents?: number;
        paymentIssues?: PaymentIssue[];
        notifications?: AppNotification[];
        supportRequests?: SupportRequest[];
        students?: Array<{
          id: string; first_name: string; last_name: string; delivery_notes: string | null;
          grade: string; section: string; classroom_name: string | null; building: string | null;
          guide_teacher: string; allergies: string[];
        }>;
      };
      if (payload.user) setAuthenticatedUser(payload.user);
      const nextOrders = payload.orders ?? [];
      setDemoOrders(nextOrders);
      if (typeof payload.creditBalanceCents === "number") setCreditBalanceCents(payload.creditBalanceCents);
      if (payload.paymentIssues) setPaymentIssues(payload.paymentIssues);
      if (payload.notifications) setNotifications(payload.notifications);
      if (payload.supportRequests) setSupportRequests(payload.supportRequests);
      if (surface === "family") {
        const colors = ["#4b70b5", "#4c8f94", "#b63d3a", "#9a5f7d"];
        const mapped = (payload.students ?? []).map((student, index): Student => ({
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          firstName: student.first_name,
          lastName: student.last_name,
          grade: student.grade,
          section: student.section,
          classroomName: student.classroom_name ?? "Aula por confirmar",
          building: student.building ?? "Edificio por confirmar",
          teacher: student.guide_teacher,
          deliveryNotes: student.delivery_notes ?? "",
          detail: `${student.grade} ${student.section} · ${student.classroom_name ?? "Aula por confirmar"} · ${student.guide_teacher} · ${student.building ?? "Edificio por confirmar"}`,
          initials: `${student.first_name[0] ?? ""}${student.last_name[0] ?? ""}`.toLocaleUpperCase("es-HN"),
          color: colors[index % colors.length],
          allergies: student.allergies,
        }));
        const nextStudents = payload.demo && mapped.length === 0 ? students : mapped;
        setDemoStudents(nextStudents);
        setStudentId((current) => nextStudents.some((student) => student.id === current) ? current : (nextStudents[0]?.id ?? ""));
        setCart((current) => current.filter((item) => nextStudents.some((student) => student.id === item.studentId)));
        setFamilyDataState(payload.demo ? "demo" : "live");
      }
      if (surface !== "kitchen") {
        const dishUrl = surface === "family"
          ? `/api/public/dishes?date=${encodeURIComponent(selectedDate)}&service=${serviceType}`
          : `/api/demo/admin/cms?start=${encodeURIComponent(selectedDate)}`;
        const [dishResponse, availabilityResponse, configResponse] = await Promise.all([
          fetch(dishUrl, { headers: { Accept: "application/json" } }),
          surface === "family"
            ? fetch(`/api/public/availability?date=${encodeURIComponent(selectedDate)}&service=${serviceType}`, { headers: { Accept: "application/json" } })
            : Promise.resolve(null),
          surface === "family"
            ? fetch("/api/public/config", { headers: { Accept: "application/json" } })
            : Promise.resolve(null),
        ]);
        if (availabilityResponse?.ok) setAvailability(await availabilityResponse.json() as Availability);
        if (configResponse?.ok) {
          const config = await configResponse.json() as { payments?: { bankAccounts?: BankTransferConfig[]; bankTransfer?: BankTransferConfig } };
          const accounts = config.payments?.bankAccounts?.length
            ? config.payments.bankAccounts
            : config.payments?.bankTransfer ? [config.payments.bankTransfer] : [];
          if (accounts.length) {
            setBankAccounts(accounts);
            setSelectedBankAccountId((current) => accounts.some((account) => account.id === current) ? current : accounts[0].id);
          }
        }
        if (dishResponse.ok) {
          const dishPayload = await dishResponse.json() as { dishes?: unknown[] };
          const tones = ["avocado", "terracotta", "gold", "sunset", "berry", "hibiscus"];
          const mappedDishes = (dishPayload.dishes ?? []).map((candidate, index): Dish | null => {
            if (!isClientRecord(candidate) || typeof candidate.id !== "string" || typeof candidate.name_es !== "string" ||
                typeof candidate.name_en !== "string" || typeof candidate.description_es !== "string" ||
                typeof candidate.description_en !== "string" || typeof candidate.price_cents !== "number" ||
                typeof candidate.category_es !== "string") return null;
            const category: Dish["category"] = candidate.category_es === "Menú del día" ? "Menú del día" : "Menú fijo";
            const groups = Array.isArray(candidate.option_groups)
              ? candidate.option_groups.map((group): OptionGroup | null => {
                if (!isClientRecord(group) || typeof group.id !== "string" || typeof group.name_es !== "string" ||
                    typeof group.name_en !== "string" || !Array.isArray(group.options)) return null;
                const options = group.options.map((option) => isClientRecord(option) && typeof option.id === "string" &&
                    typeof option.name_es === "string" && typeof option.name_en === "string"
                  ? { id: option.id, name: option.name_es, nameEn: option.name_en, priceDeltaCents: typeof option.price_delta_cents === "number" ? option.price_delta_cents : 0 }
                  : null).filter((option): option is { id: string; name: string; nameEn: string; priceDeltaCents: number } => option !== null);
                return { id: group.id, name: group.name_es, nameEn: group.name_en, required: Number(group.min_select ?? 1) > 0, options };
              }).filter((group): group is OptionGroup => group !== null)
              : [];
            const imageKey = typeof candidate.image_key === "string" ? candidate.image_key : null;
            const localMetadata = dishes.find((dish) => dish.id === candidate.id);
            return {
              id: candidate.id,
              name: candidate.name_es,
              nameEn: candidate.name_en,
              description: candidate.description_es,
              descriptionEn: candidate.description_en,
              category,
              categoryId: typeof candidate.category_id === "string"
                ? candidate.category_id
                : typeof candidate.category_slug === "string"
                  ? { "menu-permanente": "cat_permanent", especiales: "cat_special" }[candidate.category_slug]
                  : undefined,
              price: candidate.price_cents,
              prepTimeMinutes: typeof candidate.prep_time_minutes === "number" ? candidate.prep_time_minutes : 15,
              emoji: typeof candidate.emoji === "string" ? candidate.emoji : "🍽️",
              badge: typeof candidate.badge_es === "string" ? candidate.badge_es : undefined,
              salesBadges: Array.isArray(candidate.sales_badges) ? candidate.sales_badges.filter((badge): badge is string => typeof badge === "string") : [],
              tone: tones[index % tones.length],
              imageKey,
              imageUrl: imageKey ? `/api/public/media/${imageKey}` : undefined,
              isActive: typeof candidate.is_active === "number" ? candidate.is_active === 1 : true,
              optionGroups: groups,
              allergens: localMetadata?.allergens,
              possibleAllergens: localMetadata?.possibleAllergens,
              menuWeekday: localMetadata?.menuWeekday,
            };
          }).filter((dish): dish is Dish => dish !== null && ["cat_permanent", "cat_special", undefined].includes(dish.categoryId));
          if (mappedDishes.length) setCatalogDishes(mappedDishes);
        }
      }
      if (surface === "kitchen") {
        const stageByStatus: Record<string, KdsStage> = {
          submitted: "Nuevas", confirmed: "Nuevas", preparing: "Preparando",
          ready: "Listas", packed: "Empacadas", out_for_delivery: "Empacadas",
        };
        setKdsOrders(nextOrders.map((order) => ({
          id: order.order_number,
          backendId: order.id,
          student: order.student_name,
          classroom: order.classroom,
          dish: order.dish,
          time: order.delivery_time,
          stage: stageByStatus[order.status] ?? "Nuevas",
          allergy: order.allergies ?? undefined,
          targetMinutes: order.prep_time_minutes ?? 15,
          stageStartedAt: order.stage_started_at,
          kitchenStartedAt: order.kitchen_started_at ?? undefined,
          readyAt: order.ready_at ?? undefined,
          printJobsQueued: order.print_jobs_queued ?? 0,
        })));
      }
    } catch {
      if (surface === "family") setFamilyDataState("error");
    }
  }, [selectedDate, serviceType, surface]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshDemoOrders(), 0);
    const interval = surface === "kitchen"
      ? window.setInterval(() => void refreshDemoOrders(), 8_000)
      : undefined;
    return () => {
      window.clearTimeout(initialRefresh);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [refreshDemoOrders, surface]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const currentStudent = demoStudents.find((student) => student.id === studentId) ?? demoStudents[0] ??
    (familyDataState === "demo" ? students[0] : undefined);
  const selectedWeekday = new Date(`${selectedDate}T12:00:00Z`).getUTCDay();
  const dishesForSelectedDay = catalogDishes.filter((dish) =>
    dish.category !== "Menú del día" || dish.menuWeekday === undefined || dish.menuWeekday === selectedWeekday);
  const visibleDishes = category === "Todos"
    ? [...dishesForSelectedDay].sort((left, right) => Number(right.category === "Menú del día") - Number(left.category === "Menú del día"))
    : dishesForSelectedDay.filter((dish) => dish.category === category);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => {
    const dish = catalogDishes.find((candidate) => candidate.id === item.dishId);
    return total + (dish ? cartItemUnitPrice(dish, item) : 0) * item.quantity;
  }, 0);

  const addConfiguredDish = (item: CartItem) => {
    const assignedItem = { ...item, key: `${studentId}:${item.key}`, studentId };
    setCart((current) => {
      const existing = current.find((candidate) => candidate.key === assignedItem.key);
      return existing
        ? current.map((candidate) => candidate.key === assignedItem.key
          ? { ...candidate, quantity: candidate.quantity + assignedItem.quantity }
          : candidate)
        : [...current, assignedItem];
    });
    const dish = catalogDishes.find((candidate) => candidate.id === item.dishId);
    setSelectedDish(null);
    showToast(`${language === "es" ? "Agregado" : "Added"}: ${language === "es" ? dish?.name : dish?.nameEn}`);
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart((current) => current
      .map((item) => item.key === key ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)
      .filter((item) => item.quantity > 0));
  };

  const confirmOrder = async () => {
    if (!cartCount) return;
    setSubmitting(true);
    try {
      const studentIds = [...new Set(cart.map((item) => item.studentId))];
      setCreatedRecipientIds(studentIds);
      const created: CreatedOrder[] = [];
      for (const recipientId of studentIds) {
        const response = await fetch("/api/demo/orders", {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ studentId: recipientId, serviceType, serviceDate: selectedDate, notes: orderNotes,
            requestKey: `${requestKey}_${recipientId}`, paymentMethod,
            items: cart.filter((item) => item.studentId === recipientId).map((item) => ({
              dishId: item.dishId, quantity: item.quantity, selections: item.selections, notes: item.notes,
            })) }),
        });
        const payload = await response.json() as { order?: CreatedOrder; error?: string };
        if (!response.ok || !payload.order) throw new Error(payload.error ?? "No se pudo crear uno de los pedidos");
        created.push(payload.order);
      }
      const creditCents = applyCredit ? Math.min(creditBalanceCents, cartTotal) : 0;
      const batchResponse = await fetch("/api/demo/payment-batches", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ orderIds: created.map((order) => order.id), requestKey, creditCents, bankAccountId: selectedBankAccountId }),
      });
      const batchPayload = await batchResponse.json() as { paymentBatch?: { id: string; checkoutNumber: string; status: string; amountDueCents: number; expiresAt: string }; error?: string };
      if (!batchResponse.ok || !batchPayload.paymentBatch) throw new Error(batchPayload.error ?? "No se pudo agrupar el pago");
      setCreatedOrder({ id: batchPayload.paymentBatch.id, orderNumber: batchPayload.paymentBatch.checkoutNumber,
        status: "submitted", paymentStatus: batchPayload.paymentBatch.status, paymentMethod,
        totalCents: batchPayload.paymentBatch.amountDueCents, orderIds: created.map((order) => order.id), expiresAt: batchPayload.paymentBatch.expiresAt });
      window.localStorage.removeItem(ORDER_DRAFT_KEY);
      setCart([]);
      setOrderNotes("");
      setRequestKey(createClientKey("order"));
      setCartOpen(false);
      setConfirmed(true);
      await refreshDemoOrders();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo crear el pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const startAnotherOrder = () => {
    setCart([]);
    setConfirmed(false);
    setCreatedOrder(null);
    setCreatedRecipientIds([]);
    setCategory("Todos");
    setOrderNotes("");
    setPaymentMethod("bank_transfer");
    setRequestKey(createClientKey("order"));
  };

  const requestInstall = async () => {
    if (!installPrompt) {
      showToast(
        language === "es"
          ? "En iPhone usa Compartir → Agregar a inicio"
          : "On iPhone use Share → Add to Home Screen",
      );
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const advanceOrder = async (id: string) => {
    const stages: KdsStage[] = ["Nuevas", "Preparando", "Listas", "Empacadas"];
    const order = kdsOrders.find((candidate) => candidate.id === id);
    if (order?.backendId) {
      const statusByStage: Record<KdsStage, string> = {
        Nuevas: "preparing", Preparando: "ready", Listas: "packed", Empacadas: "packed",
      };
      try {
        const response = await fetch(`/api/demo/orders/${order.backendId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: statusByStage[order.stage] }),
        });
        if (!response.ok) throw new Error("No se pudo actualizar la orden");
        await refreshDemoOrders();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "No se pudo actualizar la orden");
      }
      return;
    }
    setKdsOrders((orders) =>
      orders.map((order) => {
        if (order.id !== id) return order;
        const index = stages.indexOf(order.stage);
        return { ...order, stage: stages[Math.min(index + 1, stages.length - 1)] };
      }),
    );
    showToast(`Orden ${id} actualizada`);
  };

  const queuePrint = async (id: string, jobType: "kitchen_ticket" | "package_label") => {
    const order = kdsOrders.find((candidate) => candidate.id === id);
    if (!order?.backendId) { showToast("Trabajo de impresión agregado al demo"); return; }
    const response = await fetch(`/api/demo/orders/${order.backendId}/print`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobType }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { showToast(payload.error ?? "No se pudo crear el trabajo de impresión"); return; }
    await refreshDemoOrders();
    showToast(jobType === "package_label" ? "Etiqueta agregada a la cola" : "Comanda agregada a la cola");
  };

  const deliverAllPacked = async () => {
    if (!window.confirm("¿Confirmar como entregados todos los pedidos empacados? Se notificará a cada cliente.")) return;
    const response = await fetch("/api/demo/kds/deliver-all", { method: "POST" });
    const payload = await response.json() as { delivered?: number; error?: string };
    if (!response.ok) { showToast(payload.error ?? "No se pudo confirmar la entrega"); return; }
    await refreshDemoOrders();
    showToast(payload.delivered ? `${payload.delivered} pedidos marcados como entregados` : "No hay pedidos empacados pendientes");
  };

  const reviewNotifications = async () => {
    const unread = notifications.filter((item) => item.status !== "read");
    setNotificationsOpen(true);
    if (unread.length) {
      await fetch("/api/demo/notifications/read-all", { method: "POST" });
      setNotifications((current) => current.map((item) => ({ ...item, status: "read" })));
    }
  };

  const logout = async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) { showToast("No se pudo cerrar la sesión"); return; }
    if (typeof caches !== "undefined") {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch { /* El almacenamiento de caché no está disponible; continuar con el cierre de sesión. */ }
    }
    window.localStorage.removeItem(ORDER_DRAFT_KEY);
    window.location.assign("/login");
  };

  const activatePush = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setPushState("denied"); showToast("Debes permitir notificaciones en la configuración del dispositivo"); return; }
      const response = await fetch("/api/demo/notifications/push-config", { headers: { Accept: "application/json" } });
      const config = await response.json() as { publicKey?: string | null; error?: string };
      if (!response.ok || !config.publicKey) throw new Error(config.error ?? "Las notificaciones aún no están configuradas");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(config.publicKey) });
      const saved = await fetch("/api/demo/notifications/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
      const savedPayload = await saved.json() as { error?: string };
      if (!saved.ok) throw new Error(savedPayload.error ?? "No se pudo registrar este dispositivo");
      setPushState("active"); showToast("Notificaciones activadas en este dispositivo");
    } catch (error) { showToast(error instanceof Error ? error.message : "No se pudieron activar las notificaciones"); }
  };


  return (
    <main className={`app-shell ${surface === "family" ? "family-shell" : ""}`}>
      <header className={`topbar ${surface === "family" ? "family-topbar" : ""}`}>
        <a className="brand" href={surface === "family" ? "/" : surface === "admin" ? "/admin" : "/cocina"} aria-label="Ir al inicio">
          <Image src="/pipiro-logo.png" alt="Pipiro x Solo México" width={900} height={500} unoptimized />
        </a>

        {surface !== "family" && <div className="surface-label">{surface === "admin" ? t.admin : t.kitchen}</div>}

        <div className="top-actions">
          {surface === "family" && currentStudent && (
            <nav className="desktop-account-nav" aria-label={language === "es" ? "Cuenta y soporte" : "Account and support"}>
              <button className="notification-button" onClick={() => void reviewNotifications()}><PipiroIcon name="alert" size={16} />Notificaciones{notifications.some((item) => item.status !== "read") && <i>{notifications.filter((item) => item.status !== "read").length}</i>}</button>
              <button onClick={() => setHistoryOpen(true)}><PipiroIcon name="orders" size={16} />{language === "es" ? "Pedidos" : "Orders"}</button>
              <button onClick={() => setSupportOpen(true)}><PipiroIcon name="help" size={16} />{language === "es" ? "Ayuda" : "Help"}</button>
              <button onClick={() => setProfileStudent(currentStudent)}><PipiroIcon name="user" size={16} />{language === "es" ? "Perfil" : "Profile"}</button>
            </nav>
          )}
          {surface === "family" && currentStudent && <button className="mobile-notification notification-button" aria-label="Notificaciones" onClick={() => void reviewNotifications()}><PipiroIcon name="alert" size={17} />{notifications.some((item) => item.status !== "read") && <i>{notifications.filter((item) => item.status !== "read").length}</i>}</button>}
          <button className="language-button" onClick={() => setLanguage(language === "es" ? "en" : "es")}> 
            {language === "es" ? "EN" : "ES"}
          </button>
          <button className="install-button" onClick={requestInstall}>
            <span aria-hidden="true">↓</span> {t.install}
          </button>
          {surface === "family" && !authenticatedUser && <a className="login-button" href="/login">Ingresar</a>}
          {surface === "family" && authenticatedUser && <button className="logout-button" onClick={() => void logout()}><PipiroIcon name="logout" size={16} />Salir</button>}
          {surface !== "family" && <button className="avatar-button" aria-label={authenticatedUser ? `Cuenta de ${authenticatedUser.display_name}` : "Cuenta del personal"}>
            {authenticatedUser ? authenticatedUser.display_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("es-HN") : "DC"}
          </button>}
        </div>
      </header>

      {surface === "family" && familyDataState === "loading" && (
        <FamilyAccountState title="Cargando tu cuenta" description="Estamos preparando tus estudiantes, pedidos y menú." />
      )}
      {surface === "family" && familyDataState === "error" && (
        <FamilyAccountState title="No pudimos cargar tu cuenta" description="Actualiza la página para volver a intentarlo." actionLabel="Actualizar" action={() => window.location.reload()} />
      )}
      {surface === "family" && familyDataState === "live" && !currentStudent && (
        <FamilyAccountState title="Agrega tu primer estudiante" description="Necesitamos su nombre, grado, sección, maestra guía y alergias antes de crear un pedido." actionLabel="Crear perfil" action={() => setProfileStudent("new")} />
      )}
      {surface === "family" && currentStudent && familyDataState !== "loading" && familyDataState !== "error" && (
        <FamilyView
          t={t}
          language={language}
          currentStudent={currentStudent}
          students={demoStudents}
          todayLabel={todayLabel}
          todayId={todayId}
          serviceDates={serviceDates}
          studentId={studentId}
          setStudentId={setStudentId}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          category={category}
          setCategory={setCategory}
          visibleDishes={visibleDishes}
          cart={cart}
          openDish={setSelectedDish}
          cartCount={cartCount}
          cartTotal={cartTotal}
          openCart={() => setCartOpen(true)}
          openProfile={setProfileStudent}
          openHistory={() => setHistoryOpen(true)}
          openSupport={() => setSupportOpen(true)}
          availability={availability}
          pushState={pushState}
          activatePush={activatePush}
          guardianName={authenticatedUser?.display_name ?? ""}
        />
      )}

      {selectedDish && (
        <ProductDialog
          dish={selectedDish}
          language={language}
          close={() => setSelectedDish(null)}
          add={addConfiguredDish}
        />
      )}
      {profileStudent && (
        <ProfileDialog
          student={profileStudent === "new" ? null : profileStudent}
          close={() => setProfileStudent(null)}
          saved={async () => {
            setProfileStudent(null);
            await refreshDemoOrders();
            showToast("Perfil guardado");
          }}
          removed={async () => {
            setProfileStudent(null);
            await refreshDemoOrders();
            showToast("Perfil desactivado");
          }}
        />
      )}
      {historyOpen && <OrderHistoryDialog orders={demoOrders} issues={paymentIssues} close={() => setHistoryOpen(false)} refreshed={refreshDemoOrders} />}
      {notificationsOpen && <NotificationCenter notifications={notifications} close={() => setNotificationsOpen(false)} openOrders={() => { setNotificationsOpen(false); setHistoryOpen(true); }} openSupport={() => { setNotificationsOpen(false); setSupportOpen(true); }} />}
      {supportOpen && <SupportDialog orders={demoOrders} requests={supportRequests} close={() => setSupportOpen(false)} saved={async () => { await refreshDemoOrders(); showToast("Tu mensaje fue enviado"); }} />}
      {surface === "admin" && adminDish && (
        <Suspense fallback={null}>
          <LazyAdminDishDialog
            dish={adminDish === "new" ? null : adminDish}
            close={() => setAdminDish(null)}
            saved={async () => {
              setAdminDish(null);
              await refreshDemoOrders();
              showToast("Catálogo actualizado");
            }}
          />
        </Suspense>
      )}
      {surface === "admin" && (
        <Suspense fallback={<SurfaceLoading />}>
          <LazyAdminView
            showToast={showToast}
            todayLabel={todayLabel}
            orders={demoOrders}
            refreshOrders={refreshDemoOrders}
            dishes={catalogDishes}
            editDish={setAdminDish}
            adminName={authenticatedUser?.display_name ?? "Administrador"}
          />
        </Suspense>
      )}
      {surface === "kitchen" && (
        <Suspense fallback={<SurfaceLoading />}>
          <LazyKitchenView orders={kdsOrders} advanceOrder={advanceOrder} queuePrint={queuePrint} deliverAllPacked={deliverAllPacked} showToast={showToast} />
        </Suspense>
      )}

      {cartOpen && currentStudent && (
        <CartDialog
          t={t}
          language={language}
          cart={cart}
          dishCatalog={catalogDishes}
          total={cartTotal}
          student={currentStudent}
          students={demoStudents}
          selectedDateLabel={selectedDateLabel}
          orderNotes={orderNotes}
          setOrderNotes={setOrderNotes}
          close={() => setCartOpen(false)}
          updateQuantity={updateQuantity}
          confirm={confirmOrder}
          submitting={submitting}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          creditBalanceCents={creditBalanceCents}
          applyCredit={applyCredit}
          setApplyCredit={setApplyCredit}
          bankAccounts={bankAccounts}
          selectedBankAccountId={selectedBankAccountId}
          setSelectedBankAccountId={setSelectedBankAccountId}
        />
      )}

      {confirmed && (
        <ConfirmationDialog
          t={t}
          students={demoStudents.filter((student) => createdRecipientIds.includes(student.id))}
          total={cartTotal}
          selectedDateLabel={selectedDateLabel}
          order={createdOrder}
          bankTransfer={bankAccounts.find((account) => account.id === selectedBankAccountId) ?? bankAccounts[0]}
          uploaded={refreshDemoOrders}
          close={startAnotherOrder}
        />
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span> {toast}
        </div>
      )}
    </main>
  );
}

function FamilyAccountState({
  title,
  description,
  actionLabel,
  action,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  action?: () => void;
}) {
  return (
    <section className="family-account-state" aria-live="polite">
      <span aria-hidden="true"><PipiroIcon name="user" size={34} /></span>
      <h1>{title}</h1>
      <p>{description}</p>
      {actionLabel && action ? <button className="confirm-button" onClick={action}>{actionLabel}</button> : null}
    </section>
  );
}

type FamilyViewProps = {
  t: (typeof ui)[Language];
  language: Language;
  currentStudent: Student;
  students: Student[];
  todayLabel: string;
  todayId: string;
  serviceDates: ServiceDate[];
  studentId: string;
  setStudentId: (id: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  category: Category;
  setCategory: (category: Category) => void;
  visibleDishes: Dish[];
  cart: CartItem[];
  openDish: (dish: Dish) => void;
  cartCount: number;
  cartTotal: number;
  openCart: () => void;
  openProfile: (student: Student | "new") => void;
  openHistory: () => void;
  openSupport: () => void;
  availability: Availability | null;
  pushState: PushState;
  activatePush: () => Promise<void>;
  guardianName: string;
};

function FamilyView({
  t,
  language,
  currentStudent,
  students,
  todayLabel,
  todayId,
  serviceDates,
  studentId,
  setStudentId,
  selectedDate,
  setSelectedDate,
  category,
  setCategory,
  visibleDishes,
  cart,
  openDish,
  cartCount,
  cartTotal,
  openCart,
  openProfile,
  openHistory,
  openSupport,
  availability,
  pushState,
  activatePush,
  guardianName,
}: FamilyViewProps) {
  return (
    <div className="family-page page-content">
      <section className="intro-row">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>{guardianName ? `${language === "es" ? "¡Hola" : "Hi"}, ${guardianName.trim().split(/\s+/)[0]}!` : (language === "es" ? "¡Hola!" : "Hi!")}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="help-card">
          <span aria-hidden="true"><PipiroIcon name="help" /></span>
          <div>
            <strong>{language === "es" ? "¿Necesitas ayuda?" : "Need help?"}</strong>
            <small>{language === "es" ? "Escríbenos por soporte" : "Contact support"}</small>
          </div>
        </div>
      </section>

      <section aria-labelledby="student-title">
        <div className="section-heading compact">
          <div>
            <span className="step-number">1</span>
            <h2 id="student-title">{language === "es" ? "Elige a tu estudiante" : "Choose your student"}</h2>
          </div>
          <button className="text-button" onClick={() => openProfile("new")}>+ {language === "es" ? "Agregar perfil" : "Add profile"}</button>
        </div>
        <div className="student-list">
          {students.map((student) => (
            <button
              key={student.id}
              className={`student-card ${studentId === student.id ? "selected" : ""}`}
              onClick={() => setStudentId(student.id)}
              aria-pressed={studentId === student.id}
            >
              <span className="student-avatar" style={{ background: student.color }}>
                {student.initials}
              </span>
              <span className="student-copy">
                <strong>{student.name}</strong>
                <small>{student.detail}</small>
                {student.allergies.length > 0 && (
                  <em className="student-allergy"><PipiroIcon name="alert" size={14} /> {student.allergies.join(", ")}</em>
                )}
              </span>
              <span className="selection-mark" aria-hidden="true">
                {studentId === student.id ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={`allergy-profile ${currentStudent.allergies.length ? "has-allergies" : ""}`}>
        <span aria-hidden="true"><PipiroIcon name={currentStudent.allergies.length ? "alert" : "check"} /></span>
        <div>
          <strong>{language === "es" ? "Alergias del perfil" : "Profile allergies"}</strong>
          <p>
            {currentStudent.allergies.length
              ? currentStudent.allergies.join(", ")
              : language === "es" ? "No hay alergias registradas" : "No allergies registered"}
          </p>
          <small>
            {language === "es"
              ? "Se adjuntarán automáticamente a cada pedido."
              : "They will be attached automatically to every order."}
          </small>
        </div>
        <button onClick={() => openProfile(currentStudent)}>{language === "es" ? "Editar perfil" : "Edit profile"}</button>
      </section>

      <section className="schedule-card" aria-labelledby="schedule-title">
        <div className="schedule-icon" aria-hidden="true"><PipiroIcon name="clock" /></div>
        <div className="schedule-main">
          <p>{language === "es" ? "Entrega asignada por la institución" : "Delivery assigned by the school"}</p>
          <h2 id="schedule-title">{t.school}</h2>
          <div className="schedule-details">
            <span><strong>{language === "es" ? "Horario" : "Time"}</strong>{language === "es" ? "Almuerzo · 11:30 a. m." : "Lunch · 11:30 a.m."}</span>
            <span><strong>{language === "es" ? "Destinatario" : "Recipient"}</strong>{currentStudent.name} · {currentStudent.grade} {currentStudent.section}</span>
            <span><strong>{language === "es" ? "Ubicación" : "Location"}</strong>{currentStudent.classroomName} · {currentStudent.teacher}</span>
          </div>
          <small>{language === "es" ? "Pide hasta las 11:59 p. m. del día anterior." : "Order by 11:59 p.m. the previous day."}</small>
        </div>
      </section>

      {(pushState === "available" || pushState === "denied") && <section className="push-opt-in">
        <span aria-hidden="true"><PipiroIcon name="alert" /></span>
        <div><strong>Recibe avisos de tus pedidos</strong><p>{pushState === "denied" ? "Las notificaciones están bloqueadas en la configuración del dispositivo." : "Te avisaremos cuando aprobemos el pago y cuando el almuerzo sea entregado."}</p></div>
        {pushState === "available" ? <button onClick={() => void activatePush()}>Activar</button> : null}
      </section>}

      <section aria-labelledby="date-title">
        <div className="section-heading compact">
          <div>
            <span className="step-number">2</span>
            <h2 id="date-title">{language === "es" ? "Elige el día" : "Choose a day"}</h2>
          </div>
          <span className={`availability ${availability && !availability.open ? "closed" : ""}`}><i /> {availability && !availability.open ? (language === "es" ? "Pedidos cerrados" : "Orders closed") : (language === "es" ? "Pedidos abiertos" : "Orders open")}</span>
        </div>
        <div className="date-strip">
          {serviceDates.map((date) => (
            <button
              key={date.id}
              className={selectedDate === date.id ? "selected" : ""}
              onClick={() => setSelectedDate(date.id)}
              aria-pressed={selectedDate === date.id}
            >
              <small>{date.day}</small>
              <strong>{date.date}</strong>
              {date.id === todayId ? <span>{language === "es" ? "HOY" : "TODAY"}</span> : null}
            </button>
          ))}
        </div>
      </section>

      <section className="menu-section" aria-labelledby="menu-title">
        <div className="section-heading">
          <div>
            <span className="step-number">3</span>
            <div>
              <h2 id="menu-title">{t.menu}</h2>
              <p>{t.menuHelp}</p>
            </div>
          </div>
        </div>

        <div className="category-row" aria-label="Categorías de comida">
          {(["Todos", "Menú del día", "Menú fijo"] as Category[]).map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
            >
              {language === "en"
                ? { Todos: "All", "Menú fijo": "Fixed menu", "Menú del día": "Menu of the day" }[item]
                : item}
            </button>
          ))}
        </div>

        <div className="dish-grid">
          {visibleDishes.map((dish) => {
            const quantity = cart
              .filter((item) => item.dishId === dish.id && item.studentId === studentId)
              .reduce((total, item) => total + item.quantity, 0);
            return (
              <article className="dish-card" key={dish.id}>
                <button className="dish-open" disabled={availability ? !availability.open : false} onClick={() => openDish(dish)} aria-label={`${language === "es" ? "Ver y personalizar" : "View and customize"} ${language === "es" ? dish.name : dish.nameEn}`}>
                <div className={`dish-visual ${dish.tone}`}>
                  {dish.imageUrl
                    ? <Image className="dish-photo" src={dish.imageUrl} alt="" fill sizes="(max-width: 680px) 50vw, 25vw" unoptimized />
                    : <span className="food-emoji" aria-hidden="true"><PipiroIcon name="meal" size={48} /></span>}
                  {dish.badge && <span className="dish-badge">{dish.badge}</span>}
                  {dish.salesBadges?.map((badge, index) => <span className="dish-badge sales-badge" style={{ top: `${10 + index * 25}px` }} key={badge}>{badge}</span>)}
                  {quantity > 0 && <span className="dish-cart-count">{quantity}</span>}
                </div>
                <div className="dish-copy">
                  <div>
                    <h3>{language === "es" ? dish.name : dish.nameEn}</h3>
                    <p>{language === "es" ? dish.description : dish.descriptionEn}</p>
                  </div>
                  <div className="dish-footer">
                    <strong>{dish.optionGroups?.some((group) => group.name === "Elige el tamaño") && (language === "es" ? "Desde " : "From ")}{money.format(dish.price / 100)}</strong>
                    <span className="add-button">{dish.optionGroups?.length ? (language === "es" ? "Elegir" : "Choose") : `+ ${t.add}`}</span>
                  </div>
                </div>
                </button>
              </article>
            );
          })}
          {visibleDishes.length === 0 && (
            <div className="empty-menu">
              <span aria-hidden="true"><PipiroIcon name="meal" size={44} /></span>
              <h3>{language === "es" ? "No hay platillos disponibles para este día" : "No dishes are available for this day"}</h3>
              <p>{language === "es" ? "Administración puede publicarlos desde el calendario." : "Admin can publish them from the calendar."}</p>
            </div>
          )}
        </div>
        {availability && !availability.open && <p className="closed-menu-message">{language === "es" ? (availability.messageEs || "Los pedidos cierran a las 11:59 p. m. del día anterior. Elige otra fecha.") : (availability.messageEn || "Orders close at 11:59 p.m. the previous day. Choose another date.")}</p>}
      </section>

      <nav className="mobile-nav" aria-label="Navegación principal">
        <button className="active"><span><PipiroIcon name="home" /></span>{language === "es" ? "Inicio" : "Home"}</button>
        <button onClick={openHistory}><span><PipiroIcon name="orders" /></span>{language === "es" ? "Pedidos" : "Orders"}</button>
        <button onClick={openSupport}><span><PipiroIcon name="help" /></span>{language === "es" ? "Ayuda" : "Help"}</button>
        <button onClick={() => openProfile(currentStudent)}><span><PipiroIcon name="user" /></span>{language === "es" ? "Perfil" : "Profile"}</button>
      </nav>

      {cartCount > 0 && (
        <button className="floating-cart" onClick={openCart}>
          <span className="cart-count">{cartCount}</span>
          <span>{t.cart}</span>
          <strong>{money.format(cartTotal / 100)}</strong>
        </button>
      )}
    </div>
  );
}

function ProductDialog({
  dish,
  language,
  close,
  add,
}: {
  dish: Dish;
  language: Language;
  close: () => void;
  add: (item: CartItem) => void;
}) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const groups = dish.optionGroups ?? [];
  const complete = groups.every((group) => group.required === false || Boolean(selections[group.id]));
  const selectedOptionDelta = groups.reduce((sum, group) => {
    const option = group.options.find((candidate) => candidate.id === selections[group.id]);
    return sum + (option?.priceDeltaCents ?? 0);
  }, 0);

  const submit = () => {
    if (!complete) return;
    const selectionKey = groups.map((group) => `${group.id}:${selections[group.id]}`).join("|");
    const normalizedNotes = notes.trim();
    add({
      key: `${dish.id}|${selectionKey}|${normalizedNotes.toLocaleLowerCase("es-HN")}`,
      studentId: "",
      dishId: dish.id,
      quantity,
      selections,
      notes: normalizedNotes,
    });
  };

  return (
    <div className="modal-backdrop product-backdrop" role="presentation" onMouseDown={close}>
      <section className="product-sheet" role="dialog" aria-modal="true" aria-labelledby="product-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={`product-hero ${dish.tone}`}>
          {dish.imageUrl
            ? <Image className="product-photo" src={dish.imageUrl} alt="" fill sizes="610px" unoptimized />
            : <span className="product-emoji" aria-hidden="true"><PipiroIcon name="meal" size={68} /></span>}
          <button className="close-button product-close" onClick={close} aria-label={language === "es" ? "Cerrar producto" : "Close product"}>×</button>
        </div>
        <div className="product-content">
          <p className="product-kicker">{language === "es" ? dish.category : dish.category === "Menú del día" ? "Menu of the day" : "Fixed menu"}</p>
          <h2 id="product-title">{language === "es" ? dish.name : dish.nameEn}</h2>
          <p className="product-description">{language === "es" ? dish.description : dish.descriptionEn}</p>
          <strong className="product-price">{dish.optionGroups?.some((group) => group.name === "Elige el tamaño") && (language === "es" ? "Desde " : "From ")}{money.format(dish.price / 100)}</strong>

          {groups.map((group) => (
            <fieldset className="option-group" key={group.id}>
              <legend>
                <span>{language === "es" ? group.name : group.nameEn}</span>
                <em>{group.required === false ? (language === "es" ? "Opcional" : "Optional") : (language === "es" ? "Obligatorio" : "Required")}</em>
              </legend>
              <small>{group.required === false ? (language === "es" ? "Puedes seleccionar 1 opción" : "You may select 1 option") : (language === "es" ? "Selecciona 1 opción" : "Select 1 option")}</small>
              <div className="option-list">
                {group.options.map((option) => (
                  <label key={option.id} className={selections[group.id] === option.id ? "selected" : ""}>
                    <span>{language === "es" ? option.name : option.nameEn}{option.priceDeltaCents ? <small>+ {money.format(option.priceDeltaCents / 100)}</small> : null}</span>
                    <input
                      type="radio"
                      name={`${dish.id}-${group.id}`}
                      value={option.id}
                      checked={selections[group.id] === option.id}
                      onChange={() => setSelections((current) => ({ ...current, [group.id]: option.id }))}
                    />
                    <i aria-hidden="true" />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {!groups.length && (
            <div className="standard-preparation"><span>✓</span><div><strong>{language === "es" ? "Preparación tradicional" : "Traditional preparation"}</strong><small>{language === "es" ? "Este producto no necesita opciones adicionales." : "This item does not require additional choices."}</small></div></div>
          )}

          <label className="product-notes">
            <span>{language === "es" ? "¿Quieres solicitar un cambio?" : "Would you like to request a change?"}</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={180} placeholder={language === "es" ? "Ej.: sin crema o salsa aparte" : "E.g. no cream or salsa on the side"} />
            <small>{notes.length}/180 · {language === "es" ? "Todo cambio tiene recargo y será notificado a Administración. Las alergias se toman del perfil." : "Every change has a surcharge and will notify Admin. Allergies come from the profile."}</small>
          </label>
        </div>
        <footer className="product-footer">
          <div className="product-quantity" aria-label={language === "es" ? "Cantidad" : "Quantity"}>
            <button onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label={language === "es" ? "Reducir cantidad" : "Decrease quantity"}>−</button>
            <strong>{quantity}</strong>
            <button onClick={() => setQuantity((current) => current + 1)} aria-label={language === "es" ? "Aumentar cantidad" : "Increase quantity"}>+</button>
          </div>
          <button className="product-add" onClick={submit} disabled={!complete}>
            <span>{complete ? (language === "es" ? "Agregar a mi pedido" : "Add to my order") : (language === "es" ? "Completa las opciones" : "Complete the options")}</span>
            <strong>{money.format(((dish.price + selectedOptionDelta) * quantity) / 100)}</strong>
          </button>
        </footer>
      </section>
    </div>
  );
}

function CartDialog({
  t,
  language,
  cart,
  dishCatalog,
  total,
  student,
  students,
  selectedDateLabel,
  orderNotes,
  setOrderNotes,
  close,
  updateQuantity,
  confirm,
  submitting,
  paymentMethod,
  setPaymentMethod,
  creditBalanceCents,
  applyCredit,
  setApplyCredit,
  bankAccounts,
  selectedBankAccountId,
  setSelectedBankAccountId,
}: {
  t: (typeof ui)[Language];
  language: Language;
  cart: CartItem[];
  dishCatalog: Dish[];
  total: number;
  student: Student;
  students: Student[];
  selectedDateLabel: string;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  close: () => void;
  updateQuantity: (id: string, delta: number) => void;
  confirm: () => Promise<void>;
  submitting: boolean;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  creditBalanceCents: number;
  applyCredit: boolean;
  setApplyCredit: (value: boolean) => void;
  bankAccounts: BankTransferConfig[];
  selectedBankAccountId: string;
  setSelectedBankAccountId: (id: string) => void;
}) {
  const [allergiesConfirmed, setAllergiesConfirmed] = useState(false);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section className="cart-sheet" role="dialog" aria-modal="true" aria-labelledby="cart-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header>
          <div><p>RESUMEN DEL PEDIDO</p><h2 id="cart-title">{new Set(cart.map((item) => item.studentId)).size} {new Set(cart.map((item) => item.studentId)).size === 1 ? "destinatario" : "destinatarios"}</h2><span>Un solo pago, comandas separadas por estudiante</span></div>
          <button className="close-button" onClick={close} aria-label="Cerrar">×</button>
        </header>
        <div className="cart-schedule"><span>▦</span><div><strong>{selectedDateLabel} · EIS</strong><small>Almuerzo · 11:30 a. m.</small></div></div>
        <div className="cart-recipients">
          {[...new Set(cart.map((item) => item.studentId))].map((recipientId) => {
            const recipient = students.find((candidate) => candidate.id === recipientId) ?? student;
            return <div key={recipient.id}><span className="student-avatar" style={{ background: recipient.color }}>{recipient.initials}</span><p><strong>{recipient.name}</strong><small>{recipient.detail}</small>{recipient.allergies.length > 0 && <em>Alergias: {recipient.allergies.join(", ")}</em>}</p></div>;
          })}
        </div>
        <div className="cart-items">
          {cart.map((item) => {
            const dish = dishCatalog.find((candidate) => candidate.id === item.dishId);
            if (!dish) return null;
            const optionLabels = (dish.optionGroups ?? []).map((group) => {
              const selected = group.options.find((option) => option.id === item.selections[group.id]);
              return selected ? (language === "es" ? selected.name : selected.nameEn) : null;
            }).filter(Boolean);
            return (
              <div className="cart-item" key={item.key}>
                <span className={`mini-food ${dish.tone}`}><PipiroIcon name="meal" /></span>
                <div>
                  <strong>{language === "es" ? dish.name : dish.nameEn}</strong>
                  <small>Para {students.find((candidate) => candidate.id === item.studentId)?.name ?? student.name}</small>
                  {optionLabels.length > 0 && <small>{optionLabels.join(" · ")}</small>}
                  {item.notes && <small className="cart-item-notes">“{item.notes}”</small>}
                  <small>{money.format(cartItemUnitPrice(dish, item) / 100)}</small>
                </div>
                <div className="quantity-control"><button onClick={() => updateQuantity(item.key, -1)}>−</button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.key, 1)}>+</button></div>
              </div>
            );
          })}
        </div>
        <label className="order-notes">
          <span>Cambios o instrucciones para este pedido</span>
          <textarea
            value={orderNotes}
            onChange={(event) => setOrderNotes(event.target.value)}
            maxLength={300}
            placeholder="Ej.: queso aparte, sin salsa o entregar en recepción"
          />
          <small>{orderNotes.length}/300 · No reemplaza la información de alergias del perfil</small>
        </label>
        <div className="cart-total"><span>Total</span><strong>{money.format(total / 100)}</strong></div>
        {creditBalanceCents > 0 && <label className="credit-option"><input type="checkbox" checked={applyCredit} onChange={(event) => setApplyCredit(event.target.checked)} /><span><strong>Usar saldo Pipiro</strong><small>Disponible: {money.format(creditBalanceCents / 100)} · se aplicará primero al total</small></span></label>}
        <label className="allergy-confirmation">
          <input type="checkbox" checked={allergiesConfirmed} onChange={(event) => setAllergiesConfirmed(event.target.checked)} />
          <span>Confirmo que revisé las alergias e instrucciones de este destinatario.</span>
        </label>
        <fieldset className="payment-methods">
          <legend>¿Cómo quieres pagar?</legend>
          <button type="button" className={paymentMethod === "bank_transfer" ? "selected" : ""} onClick={() => setPaymentMethod("bank_transfer")}>
            <span><PipiroIcon name="bank" /></span><div><strong>Transferencia bancaria</strong><small>Un comprobante para todo el pedido</small></div><i />
          </button>
          <button type="button" className={paymentMethod === "card" ? "selected" : ""} onClick={() => setPaymentMethod("card")}>
            <span><PipiroIcon name="card" /></span><div><strong>Tarjeta de crédito o débito</strong><small>Disponible en una siguiente etapa</small></div><em>PRÓXIMAMENTE</em>
          </button>
        </fieldset>
        {paymentMethod === "bank_transfer"
          ? <><div className="bank-choice"><label><span>Banco para la transferencia</span><select value={selectedBankAccountId} onChange={(event) => setSelectedBankAccountId(event.target.value)}>{bankAccounts.map((account) => <option value={account.id} key={account.id}>{account.label} · {account.accountType}</option>)}</select></label><p>Al crear el pedido verás los datos completos y podrás subir un solo comprobante.</p></div><div className="payment-proof-warning" role="note"><PipiroIcon name="alert" /><div><strong>El comprobante es indispensable</strong><p>Tu orden quedará pendiente hasta que Administración confirme el pago. Sin el comprobante enviado a tiempo, el pedido no pasa a cocina y no podrá procesarse.</p></div></div></>
          : <div className="card-coming-note">La tarjeta se habilitará únicamente cuando exista una pasarela real y confirmación segura del pago.</div>}
        <button className="confirm-button" disabled={!allergiesConfirmed || submitting || paymentMethod === "card"} onClick={() => void confirm()}>
          {submitting ? "Creando pedido…" : paymentMethod === "card" ? "Tarjeta próximamente" : t.confirm} <span>→</span>
        </button>
      </section>
    </div>
  );
}

function ConfirmationDialog({ students, total, selectedDateLabel, order, bankTransfer, uploaded, close }: { t: (typeof ui)[Language]; students: Student[]; total: number; selectedDateLabel: string; order: CreatedOrder | null; bankTransfer: BankTransferConfig | undefined; uploaded: () => Promise<void>; close: () => void }) {
  const [receiptSubmitted, setReceiptSubmitted] = useState(false);
  return (
    <div className="modal-backdrop success-backdrop">
      <section className="success-dialog" role="dialog" aria-modal="true" aria-labelledby="success-title">
        <div className="success-mark"><span>✓</span></div>
        <p className="eyebrow">ORDEN {order?.orderNumber ?? "DEMO"}</p>
        <h2 id="success-title">Pedido creado</h2>
        <p>Realiza la transferencia y envía el comprobante a tiempo. La orden no podrá procesarse ni pasar a cocina hasta que Administración confirme el pago.</p>
        <div className="success-ticket">
          <div><span>Para</span><strong>{students.map((student) => student.name).join(" · ")}</strong></div>
          <div><span>Entrega</span><strong>{selectedDateLabel} · 11:30 a. m. · EIS</strong></div>
          <div><span>Total a transferir</span><strong>{money.format((order?.totalCents ?? total) / 100)}</strong></div>
          <div className="delivery-code"><span>Referencia Pipiro para escribir en el concepto</span><strong>{order?.orderNumber ?? "DEMO"}</strong></div>
        </div>
        {bankTransfer && <div className="bank-instructions">
          <div><span>Banco</span><strong>{bankTransfer.bankName}</strong></div>
          <div><span>Titular</span><strong>{bankTransfer.accountHolder}</strong></div>
          <div><span>Cuenta</span><strong>{bankTransfer.accountNumber}</strong></div>
          <div><span>Tipo</span><strong>{bankTransfer.accountType}</strong></div>
        </div>}
        {order && order.paymentStatus !== "approved" && <ReceiptUploader paymentId={order.id} batch onUploaded={async () => { setReceiptSubmitted(true); await uploaded(); }} />}
        <p className="transfer-help">{receiptSubmitted ? "Comprobante enviado. El pedido está en revisión administrativa." : "La referencia Pipiro identifica tu orden; no es el número de operación que genera el banco."}</p>
        <button className="confirm-button" onClick={close}>{receiptSubmitted ? "Listo" : "Subir después desde Mis pedidos"}</button>
      </section>
    </div>
  );
}

function ReceiptUploader({ orderId, paymentId, batch = false, onUploaded, compact = false }: { orderId?: string; paymentId?: string; batch?: boolean; onUploaded: () => Promise<void>; compact?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [bankReference, setBankReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("receipt", file);
      form.set("bankReference", bankReference);
      const targetId = paymentId ?? orderId;
      if (!targetId) throw new Error("Pago no encontrado");
      const response = await fetch(batch ? `/api/demo/payment-batches/${targetId}/receipt` : `/api/demo/payments/${targetId}/receipt`, { method: "POST", body: form });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo enviar el comprobante");
      setDone(true);
      await onUploaded();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar el comprobante");
    } finally {
      setBusy(false);
    }
  };

  if (done) return <div className="receipt-uploaded">✓ Comprobante recibido para revisión</div>;
  return (
    <div className={`receipt-uploader ${compact ? "compact" : ""}`}>
      <label><span>Número de operación del banco <small>(opcional)</small></span><input value={bankReference} onChange={(event) => setBankReference(event.target.value)} maxLength={80} placeholder="Ej.: 84729103" /></label>
      <label className="receipt-file"><span>{file ? file.name : "Imagen o captura del comprobante"}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button disabled={!file || busy} onClick={() => void submit()}>{busy ? "Enviando…" : "Enviar comprobante"}</button>
    </div>
  );
}

const gradeOptions = ["Nursery", "Prekinder", "Kinder", "1°", "2°", "3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°", "11°", "12°"];
const sectionOptions = ["A", "B", "C", "D", "E"];

function ProfileDialog({
  student,
  close,
  saved,
  removed,
}: {
  student: Student | null;
  close: () => void;
  saved: () => Promise<void>;
  removed: () => Promise<void>;
}) {
  const [firstName, setFirstName] = useState(student?.firstName ?? "");
  const [lastName, setLastName] = useState(student?.lastName ?? "");
  const [grade, setGrade] = useState(student?.grade ?? "Kinder");
  const [section, setSection] = useState(student?.section ?? "A");
  const [deliveryNotes, setDeliveryNotes] = useState(student?.deliveryNotes ?? "");
  const [allergies, setAllergies] = useState(student?.allergies.join(", ") ?? "");
  const [confirmedAllergies, setConfirmedAllergies] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!confirmedAllergies || !firstName.trim() || !lastName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(student ? `/api/demo/students/${student.id}` : "/api/demo/students", {
        method: student ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          grade,
          section,
          deliveryNotes,
          allergies: allergies.split(",").map((item) => item.trim()).filter(Boolean),
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar el perfil");
      await saved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el perfil");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!student || !window.confirm(`¿Desactivar el perfil de ${student.name}?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/demo/students/${student.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("No se pudo desactivar el perfil");
      await removed();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo desactivar el perfil");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop profile-backdrop" role="presentation" onMouseDown={close}>
      <section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><p className="eyebrow">EIS · PERFIL DE ENTREGA</p><h2 id="profile-dialog-title">{student ? "Editar destinatario" : "Agregar destinatario"}</h2></div>
          <button className="close-button" onClick={close} aria-label="Cerrar">×</button>
        </header>
        <div className="profile-form-grid">
          <label><span>Nombre</span><input value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={80} /></label>
          <label><span>Apellido</span><input value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={80} /></label>
          <label><span>Grado</span><select value={grade} onChange={(event) => setGrade(event.target.value)}>{gradeOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Sección</span><select value={section} onChange={(event) => setSection(event.target.value)}>{sectionOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="full-field"><span>Entrega asignada por la institución</span><input value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} maxLength={240} placeholder="Ej.: aula, edificio o punto indicado por la institución" /></label>
          <label className="full-field allergy-field"><span>Alergias</span><textarea value={allergies} onChange={(event) => setAllergies(event.target.value)} maxLength={400} placeholder="Separar con comas; dejar vacío si no tiene" /><small>Esta información se adjunta automáticamente a cada pedido.</small></label>
        </div>
        <label className="allergy-confirmation">
          <input type="checkbox" checked={confirmedAllergies} onChange={(event) => setConfirmedAllergies(event.target.checked)} />
          <span>Confirmo que revisé la información de alergias, incluyendo cuando no existen alergias conocidas.</span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer>
          {student && <button className="danger-button" disabled={busy} onClick={() => void remove()}>Desactivar</button>}
          <button className="confirm-button" disabled={busy || !confirmedAllergies || !firstName.trim() || !lastName.trim()} onClick={() => void submit()}>{busy ? "Guardando…" : "Guardar perfil"}</button>
        </footer>
      </section>
    </div>
  );
}

function OrderHistoryDialog({ orders, issues, close, refreshed }: { orders: DemoOrder[]; issues: PaymentIssue[]; close: () => void; refreshed: () => Promise<void> }) {
  const orderStatus: Record<string, string> = {
    submitted: "Esperando transferencia", confirmed: "Confirmado", preparing: "En preparación",
    ready: "Listo", packed: "Empacado", out_for_delivery: "En entrega", delivered: "Entregado", cancelled: "Cancelado",
  };
  const cancelOrder = async (order: DemoOrder) => {
    if (!window.confirm(`¿Cancelar ${order.order_number}? Si ya fue pagado, Administración revisará el crédito correspondiente.`)) return;
    const response = await fetch(`/api/demo/orders/${order.id}/cancel`, { method: "POST" });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { window.alert(payload.error ?? "No se pudo cancelar"); return; }
    await refreshed();
  };
  const answerIssue = async (issueId: string, choice: "refund" | "pay_difference") => {
    const response = await fetch(`/api/demo/payment-issues/${issueId}/choice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice }) });
    if (!response.ok) { window.alert("No se pudo guardar tu respuesta"); return; }
    await refreshed();
  };
  return (
    <div className="modal-backdrop history-backdrop" role="presentation" onMouseDown={close}>
      <section className="history-dialog" role="dialog" aria-modal="true" aria-labelledby="history-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p className="eyebrow">MI CUENTA</p><h2 id="history-title">Mis pedidos</h2></div><button className="close-button" onClick={close} aria-label="Cerrar">×</button></header>
        {issues.map((issue) => <section className="payment-issue" key={issue.id}><PipiroIcon name="alert" /><div><strong>Revisar monto de {issue.checkout_number}</strong><p>Esperado: {money.format(issue.expected_cents / 100)} · recibido: {money.format(issue.received_cents / 100)}</p><small>Confirma si deseas reembolso o si transferirás la diferencia.</small><span><button onClick={() => void answerIssue(issue.id, "refund")}>Solicitar reembolso</button><button onClick={() => void answerIssue(issue.id, "pay_difference")}>Transferir diferencia</button></span></div></section>)}
        <div className="history-list">
          {orders.map((order, index) => (
            <article key={order.id}>
              <div className="history-order-summary"><strong>{order.order_number}</strong><span>{order.student_name} · {order.service_date} · {order.delivery_time}</span><small>{order.dish}</small></div>
              <div className="history-order-meta"><b>{money.format(order.total_cents / 100)}</b><em className={`status-${order.status}`}>{orderStatus[order.status] ?? order.status}</em></div>
              {order.status !== "cancelled" && order.payment_method.includes("transfer") && ((order.payment_status === "pending" && !order.receipt_object_key) || order.payment_status === "rejected") &&
                (!order.payment_batch_id || orders.findIndex((candidate) => candidate.payment_batch_id === order.payment_batch_id && candidate.status !== "cancelled") === index) && (
                <ReceiptUploader orderId={order.id} paymentId={order.payment_batch_id ?? undefined} batch={Boolean(order.payment_batch_id)} compact onUploaded={refreshed} />
              )}
              {order.payment_status === "under_review" && <div className="history-payment-state">Comprobante enviado · en revisión</div>}
              {["submitted", "confirmed"].includes(order.status) && <button className="history-cancel" onClick={() => void cancelOrder(order)}>Cancelar pedido</button>}
            </article>
          ))}
          {!orders.length && <div className="empty-transfer">Todavía no hay pedidos guardados.</div>}
        </div>
      </section>
    </div>
  );
}

function NotificationCenter({ notifications, close, openOrders, openSupport }: { notifications: AppNotification[]; close: () => void; openOrders: () => void; openSupport: () => void }) {
  const copy: Record<string, { title: string; message: string; action: "orders" | "support" }> = {
    payment_approved: { title: "Pago confirmado", message: "Tu transferencia fue aprobada y el pedido ya pasó a cocina.", action: "orders" },
    payment_amount_mismatch: { title: "Revisa el monto transferido", message: "Encontramos una diferencia en el comprobante. Revisa tu pedido para indicar cómo deseas continuar.", action: "orders" },
    payment_receipt_requested: { title: "Comprobante requerido", message: "Necesitamos el comprobante de transferencia para confirmar tu pedido y enviarlo a cocina.", action: "orders" },
    payment_receipt_reminder: { title: "Tu pedido sigue pendiente", message: "Aún no recibimos el comprobante. Envíalo antes del cierre para que el pedido pueda procesarse.", action: "orders" },
    payment_rejected: { title: "Comprobante no aprobado", message: "No pudimos validar el comprobante. Revisa tu pedido y envía uno nuevo o comunícate con Pipiro.", action: "orders" },
    payment_cancelled: { title: "Pedido cancelado", message: "Administración canceló este pedido. Revisa Mis pedidos o comunícate con Pipiro si necesitas ayuda.", action: "orders" },
    order_delivered: { title: "Almuerzo entregado", message: "La institución confirmó que el almuerzo fue entregado.", action: "orders" },
    support_response: { title: "Pipiro respondió tu mensaje", message: "Ya puedes leer la respuesta en la sección de Ayuda.", action: "support" },
  };
  return <div className="modal-backdrop profile-backdrop" role="presentation" onMouseDown={close}><section className="profile-dialog notification-dialog" role="dialog" aria-modal="true" aria-labelledby="notifications-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">ACTUALIZACIONES</p><h2 id="notifications-title">Notificaciones</h2></div><button className="close-button" onClick={close} aria-label="Cerrar">×</button></header><div className="notification-list">{notifications.map((notification) => { const detail = copy[notification.template_key] ?? { title: "Actualización de tu pedido", message: "Hay nueva información disponible en Pipiro.", action: "orders" as const }; return <button key={notification.id} onClick={detail.action === "support" ? openSupport : openOrders}><span><PipiroIcon name={notification.template_key === "order_delivered" ? "check" : "alert"} /></span><div><strong>{detail.title}</strong><p>{detail.message}</p><small>{new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" }).format(new Date(`${notification.created_at.replace(" ", "T")}Z`))}</small></div></button>; })}{!notifications.length && <div className="empty-transfer">No tienes notificaciones todavía.</div>}</div></section></div>;
}

function SupportDialog({ orders, requests, close, saved }: { orders: DemoOrder[]; requests: SupportRequest[]; close: () => void; saved: () => Promise<void> }) {
  const [category, setCategory] = useState("request");
  const [orderId, setOrderId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/demo/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, orderId: orderId || null, subject, message }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo enviar");
      await saved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo enviar"); } finally { setBusy(false); }
  };
  return <div className="modal-backdrop profile-backdrop" role="presentation" onMouseDown={close}><section className="profile-dialog support-dialog" role="dialog" aria-modal="true" aria-labelledby="support-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">AYUDA PIPIRO</p><h2 id="support-title">¿Cómo podemos ayudarte?</h2></div><button className="close-button" onClick={close} aria-label="Cerrar">×</button></header>{requests.length > 0 && <div className="support-history"><h3>Mis mensajes</h3>{requests.map((request) => <article key={request.id}><header><strong>{request.subject}</strong><em>{({ open: "Abierto", in_progress: "En seguimiento", resolved: "Resuelto", closed: "Cerrado" } as Record<string, string>)[request.status] ?? request.status}</em></header><p>{request.message}</p>{request.admin_note && <div><strong>Respuesta de Pipiro</strong><p>{request.admin_note}</p></div>}</article>)}</div>}<div className="profile-form-grid"><label><span>Tipo</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="request">Solicitud</option><option value="comment">Comentario</option><option value="complaint">Queja</option><option value="payment">Pago</option><option value="other">Otro</option></select></label><label><span>Pedido relacionado (opcional)</span><select value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">Ninguno</option>{orders.map((order) => <option value={order.id} key={order.id}>{order.order_number} · {order.student_name}</option>)}</select></label><label className="full-field"><span>Asunto</span><input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} /></label><label className="full-field"><span>Mensaje</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} placeholder="Cuéntanos qué ocurrió o qué necesitas" /></label></div>{error && <p className="form-error">{error}</p>}<footer><button className="confirm-button" disabled={busy || subject.trim().length < 3 || message.trim().length < 10} onClick={() => void submit()}>{busy ? "Enviando…" : "Enviar mensaje"}</button></footer></section></div>;
}
