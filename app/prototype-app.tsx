"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type Surface = "family" | "admin" | "kitchen";
type Language = "es" | "en";
type Category = "Todos" | "Menú permanente" | "Bebidas" | "Especialidades";
type ServiceType = "breakfast" | "lunch";
type KdsStage = "Nuevas" | "Preparando" | "Listas" | "Empacadas";

type ServiceDate = {
  id: string;
  day: string;
  date: string;
};

type Dish = {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  category: Exclude<Category, "Todos">;
  price: number;
  badge?: string;
  emoji: string;
  tone: string;
  optionGroups?: OptionGroup[];
};

type OptionGroup = {
  id: string;
  name: string;
  nameEn: string;
  options: Array<{ id: string; name: string; nameEn: string }>;
};

type CartItem = {
  key: string;
  dishId: string;
  quantity: number;
  selections: Record<string, string>;
  notes: string;
};

type Student = {
  id: string;
  name: string;
  detail: string;
  initials: string;
  color: string;
  allergies: string[];
};

type KdsOrder = {
  id: string;
  student: string;
  classroom: string;
  dish: string;
  time: string;
  stage: KdsStage;
  allergy?: string;
};

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const students: Student[] = [
  {
    id: "sofia",
    name: "Sofía M.",
    detail: "3° B · Aula 12 · Miss Laura · Edificio Primaria",
    initials: "SM",
    color: "#1f66d1",
    allergies: ["Maní", "Nueces"],
  },
  {
    id: "mateo",
    name: "Mateo M.",
    detail: "Kinder A · Aula K-A · Miss Andrea · Edificio Preescolar",
    initials: "MM",
    color: "#11a5a8",
    allergies: [],
  },
];

const meatOptions = (items: Array<[string, string, string]>) => [{
  id: "protein",
  name: "Elige la preparación",
  nameEn: "Choose the filling",
  options: items.map(([id, name, nameEn]) => ({ id, name, nameEn })),
}];

const dishes: Dish[] = [
  {
    id: "chilaquiles", name: "Chilaquiles", nameEn: "Chilaquiles",
    description: "Totopos bañados en salsa, crema, queso y la preparación que elijas.",
    descriptionEn: "Tortilla chips with salsa, cream, cheese and your chosen topping.",
    category: "Menú permanente", price: 14500, badge: "Siempre disponible", emoji: "🍳", tone: "avocado",
    optionGroups: [
      { id: "salsa", name: "Elige tu salsa", nameEn: "Choose your salsa", options: [
        { id: "verde", name: "Salsa verde", nameEn: "Green salsa" },
        { id: "roja", name: "Salsa roja", nameEn: "Red salsa" },
      ] },
      ...meatOptions([
        ["pollo", "Pollo", "Chicken"], ["pastor", "Pastor", "Al pastor"],
        ["huevo", "Huevo", "Egg"], ["res", "Res", "Beef"],
      ]),
    ],
  },
  {
    id: "tacos", name: "Tacos", nameEn: "Tacos",
    description: "Tacos preparados al momento con la carne que prefieras.",
    descriptionEn: "Freshly prepared tacos with your choice of filling.",
    category: "Menú permanente", price: 13500, badge: "Favorito", emoji: "🌮", tone: "terracotta",
    optionGroups: meatOptions([
      ["pastor", "Pastor", "Al pastor"], ["chilorio-pollo", "Chilorio de pollo", "Chicken chilorio"],
      ["chorizo", "Chorizo", "Chorizo"], ["res", "Res", "Beef"],
      ["cochinita-pibil", "Cochinita pibil", "Cochinita pibil"],
    ]),
  },
  {
    id: "nachos", name: "Nachos", nameEn: "Nachos",
    description: "Totopos crujientes con frijoles, queso y tu carne favorita.",
    descriptionEn: "Crispy tortilla chips with beans, cheese and your favorite meat.",
    category: "Menú permanente", price: 13000, emoji: "🧀", tone: "gold",
    optionGroups: meatOptions([["pollo", "Pollo", "Chicken"], ["pastor", "Pastor", "Al pastor"], ["res", "Res", "Beef"]]),
  },
  {
    id: "enchiladas", name: "Enchiladas", nameEn: "Enchiladas",
    description: "Enchiladas mexicanas con crema, queso y salsa a elección.",
    descriptionEn: "Mexican enchiladas with cream, cheese and your choice of salsa.",
    category: "Menú permanente", price: 12500, emoji: "🫔", tone: "sunset",
    optionGroups: [{ id: "salsa", name: "Elige tu salsa", nameEn: "Choose your salsa", options: [
      { id: "verde", name: "Salsa verde", nameEn: "Green salsa" },
      { id: "roja", name: "Salsa roja", nameEn: "Red salsa" },
    ] }],
  },
  {
    id: "sopa-tesposteca", name: "Sopa Tesposteca", nameEn: "Tesposteca soup",
    description: "Sopa tradicional mexicana servida caliente.",
    descriptionEn: "Traditional Mexican soup served warm.",
    category: "Menú permanente", price: 15500, emoji: "🍲", tone: "berry",
  },
  {
    id: "tacos-birria", name: "Tacos Birria", nameEn: "Birria tacos",
    description: "Tacos de birria con su consomé y opción de queso.",
    descriptionEn: "Birria tacos with consommé and an optional cheese preparation.",
    category: "Menú permanente", price: 17500, badge: "Especial de la casa", emoji: "🌮", tone: "hibiscus",
    optionGroups: [{ id: "queso", name: "Elige la preparación", nameEn: "Choose the preparation", options: [
      { id: "con-queso", name: "Con queso", nameEn: "With cheese" },
      { id: "sin-queso", name: "Sin queso", nameEn: "Without cheese" },
    ] }],
  },
  {
    id: "gringas", name: "Gringas", nameEn: "Gringas",
    description: "Tortilla de harina con queso y la carne que elijas.",
    descriptionEn: "Flour tortilla with cheese and your choice of meat.",
    category: "Menú permanente", price: 15000, emoji: "🌯", tone: "avocado",
    optionGroups: meatOptions([["pollo", "Pollo", "Chicken"], ["pastor", "Pastor", "Al pastor"], ["res", "Res", "Beef"]]),
  },
  {
    id: "tacos-flautas", name: "Tacos Flautas", nameEn: "Flauta tacos",
    description: "Flautas doradas y crujientes con la carne que prefieras.",
    descriptionEn: "Golden crispy flautas with your choice of meat.",
    category: "Menú permanente", price: 14000, emoji: "🌯", tone: "gold",
    optionGroups: meatOptions([["pollo", "Pollo", "Chicken"], ["pastor", "Pastor", "Al pastor"], ["res", "Res", "Beef"]]),
  },
  {
    id: "agua",
    name: "Agua purificada",
    nameEn: "Purified water",
    description: "Botella individual de 12 oz",
    descriptionEn: "Individual 12 oz bottle",
    category: "Bebidas",
    price: 2500,
    emoji: "💧",
    tone: "avocado",
  },
  {
    id: "limonada",
    name: "Limonada natural",
    nameEn: "Fresh lemonade",
    description: "Limón fresco y poca azúcar · 12 oz",
    descriptionEn: "Fresh lime and light sugar · 12 oz",
    category: "Bebidas",
    price: 3500,
    emoji: "🍋",
    tone: "gold",
  },
  {
    id: "naranja",
    name: "Jugo de naranja",
    nameEn: "Orange juice",
    description: "Jugo de naranja · 10 oz",
    descriptionEn: "Orange juice · 10 oz",
    category: "Bebidas",
    price: 4000,
    emoji: "🍊",
    tone: "sunset",
  },
  {
    id: "leche-chocolate",
    name: "Leche con chocolate",
    nameEn: "Chocolate milk",
    description: "Leche fría con cacao · 8 oz",
    descriptionEn: "Cold cocoa milk · 8 oz",
    category: "Bebidas",
    price: 4000,
    emoji: "🥛",
    tone: "berry",
  },
  {
    id: "jamaica",
    name: "Agua de jamaica",
    nameEn: "Hibiscus water",
    description: "Natural, ligeramente endulzada · 12 oz",
    descriptionEn: "Natural, lightly sweetened · 12 oz",
    category: "Bebidas",
    price: 3000,
    emoji: "🥤",
    tone: "hibiscus",
  },
];

const initialKdsOrders: KdsOrder[] = [
  {
    id: "L-1048",
    student: "Sofía M.",
    classroom: "3° B · Aula 12",
    dish: "Chilaquiles · Salsa verde · Pollo",
    time: "11:30",
    stage: "Nuevas",
  },
  {
    id: "L-1049",
    student: "Daniela R.",
    classroom: "2° A · Aula 7",
    dish: "Tacos · Cochinita pibil",
    time: "11:30",
    stage: "Nuevas",
    allergy: "Sin lácteos",
  },
  {
    id: "L-1044",
    student: "Mateo M.",
    classroom: "Kinder A · Norte",
    dish: "Gringas · Pollo",
    time: "11:30",
    stage: "Preparando",
  },
  {
    id: "L-1041",
    student: "Valentina P.",
    classroom: "4° C · Aula 18",
    dish: "Tacos Birria · Con queso",
    time: "11:30",
    stage: "Listas",
  },
  {
    id: "L-1038",
    student: "Lucas A.",
    classroom: "1° B · Aula 4",
    dish: "Nachos · Res",
    time: "11:30",
    stage: "Empacadas",
  },
];

const APP_TIME_ZONE = "America/Tegucigalpa";

function formatDateId(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function getServiceDates(now: Date): ServiceDate[] {
  const result: ServiceDate[] = [];

  for (let offset = 0; result.length < 5 && offset < 14; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 86_400_000);
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIME_ZONE,
      weekday: "short",
    }).format(candidate);
    if (weekday === "Sat" || weekday === "Sun") continue;

    result.push({
      id: formatDateId(candidate),
      day: new Intl.DateTimeFormat("es-HN", {
        timeZone: APP_TIME_ZONE,
        weekday: "short",
      }).format(candidate).replace(".", "").toLocaleUpperCase("es-HN"),
      date: new Intl.DateTimeFormat("es-HN", {
        timeZone: APP_TIME_ZONE,
        day: "numeric",
      }).format(candidate),
    });
  }

  return result;
}

function formatLongDate(date: Date, language: Language): string {
  const locale = language === "es" ? "es-HN" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date).toLocaleUpperCase(locale);
}

function formatDateIdLabel(dateId: string, language: Language): string {
  const date = new Date(`${dateId}T12:00:00Z`);
  return new Intl.DateTimeFormat(language === "es" ? "es-HN" : "en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

const money = new Intl.NumberFormat("es-HN", {
  style: "currency",
  currency: "HNL",
  minimumFractionDigits: 2,
});

const ui = {
  es: {
    family: "Familias",
    admin: "Administración",
    kitchen: "Cocina",
    demo: "Vista de prototipo",
    greeting: "¡Hola, Daniela!",
    subtitle: "¿Para quién preparamos algo rico?",
    delivery: "Entrega programada",
    school: "Escuela Internacional Sampedrana (EIS)",
    period: "Almuerzo · 11:30 a. m.",
    menu: "Menú de la semana",
    menuHelp: "Preparado fresco cada mañana",
    add: "Agregar",
    cart: "Ver pedido",
    emptyCart: "Agrega un platillo para comenzar",
    confirm: "Confirmar pedido",
    confirmed: "¡Pedido confirmado!",
    confirmedHelp: "Lo prepararemos y entregaremos directamente en su aula.",
    done: "Listo",
    install: "Instalar app",
    prototype: "Datos de demostración · Sin cobros",
  },
  en: {
    family: "Families",
    admin: "Admin",
    kitchen: "Kitchen",
    demo: "Prototype view",
    greeting: "Hi, Daniela!",
    subtitle: "Who are we cooking something delicious for?",
    delivery: "Scheduled delivery",
    school: "Escuela Internacional Sampedrana (EIS)",
    period: "Lunch · 11:30 a.m.",
    menu: "This week’s menu",
    menuHelp: "Prepared fresh every morning",
    add: "Add",
    cart: "View order",
    emptyCart: "Add a meal to get started",
    confirm: "Confirm order",
    confirmed: "Order confirmed!",
    confirmedHelp: "We’ll prepare it and deliver it directly to the classroom.",
    done: "Done",
    install: "Install app",
    prototype: "Demo data · No payments",
  },
};

export function PrototypeApp({ initialSurface = "family", nowIso }: { initialSurface?: Surface; nowIso: string }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const serviceDates = useMemo(() => getServiceDates(now), [now]);
  const [surface] = useState<Surface>(initialSurface);
  const [language, setLanguage] = useState<Language>("es");
  const [studentId, setStudentId] = useState(students[0].id);
  const [selectedDate, setSelectedDate] = useState(() => serviceDates[0]?.id ?? formatDateId(now));
  const [category, setCategory] = useState<Category>("Todos");
  const [serviceType, setServiceType] = useState<ServiceType>("lunch");
  const [orderNotes, setOrderNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [kdsOrders, setKdsOrders] = useState(initialKdsOrders);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    document.documentElement.lang = language === "es" ? "es-HN" : "en-US";
  }, [language]);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const currentStudent = students.find((student) => student.id === studentId) ?? students[0];
  const visibleDishes =
    category === "Todos" ? dishes : dishes.filter((dish) => dish.category === category);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => {
    const dish = dishes.find((candidate) => candidate.id === item.dishId);
    return total + (dish?.price ?? 0) * item.quantity;
  }, 0);

  const addConfiguredDish = (item: CartItem) => {
    setCart((current) => {
      const existing = current.find((candidate) => candidate.key === item.key);
      return existing
        ? current.map((candidate) => candidate.key === item.key
          ? { ...candidate, quantity: candidate.quantity + item.quantity }
          : candidate)
        : [...current, item];
    });
    const dish = dishes.find((candidate) => candidate.id === item.dishId);
    setSelectedDish(null);
    showToast(`${language === "es" ? "Agregado" : "Added"}: ${language === "es" ? dish?.name : dish?.nameEn}`);
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart((current) => current
      .map((item) => item.key === key ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)
      .filter((item) => item.quantity > 0));
  };

  const confirmOrder = () => {
    if (!cartCount) return;
    setCartOpen(false);
    setConfirmed(true);
  };

  const startAnotherOrder = () => {
    setCart([]);
    setConfirmed(false);
    setCategory("Todos");
    setOrderNotes("");
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

  const advanceOrder = (id: string) => {
    const stages: KdsStage[] = ["Nuevas", "Preparando", "Listas", "Empacadas"];
    setKdsOrders((orders) =>
      orders.map((order) => {
        if (order.id !== id) return order;
        const index = stages.indexOf(order.stage);
        return { ...order, stage: stages[Math.min(index + 1, stages.length - 1)] };
      }),
    );
    showToast(`Orden ${id} actualizada`);
  };

  return (
    <main className="app-shell">
      <PrototypeBanner label={t.prototype} />
      <header className="topbar">
        <a className="brand" href={surface === "family" ? "/" : surface === "admin" ? "/admin" : "/cocina"} aria-label="Ir al inicio">
          <Image src="/logo-solo-mexico.png" alt="Solo México" width={600} height={299} unoptimized />
          <span>
            <strong>Pipiro</strong>
            <small>by Solo México</small>
          </span>
        </a>

        <div className="surface-label">
          {surface === "admin" ? t.admin : surface === "kitchen" ? t.kitchen : "EIS"}
        </div>

        <div className="top-actions">
          <button className="language-button" onClick={() => setLanguage(language === "es" ? "en" : "es")}> 
            {language === "es" ? "EN" : "ES"}
          </button>
          <button className="install-button" onClick={requestInstall}>
            <span aria-hidden="true">↓</span> {t.install}
          </button>
          <button className="avatar-button" aria-label="Perfil de Daniela">
            DC
          </button>
        </div>
      </header>

      {surface === "family" && (
        <FamilyView
          t={t}
          language={language}
          currentStudent={currentStudent}
          todayLabel={todayLabel}
          todayId={todayId}
          serviceDates={serviceDates}
          serviceType={serviceType}
          setServiceType={setServiceType}
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
      {surface === "admin" && <AdminView showToast={showToast} todayLabel={todayLabel} />}
      {surface === "kitchen" && (
        <KitchenView orders={kdsOrders} advanceOrder={advanceOrder} showToast={showToast} />
      )}

      {cartOpen && (
        <CartDialog
          t={t}
          language={language}
          cart={cart}
          total={cartTotal}
          student={currentStudent}
          selectedDateLabel={selectedDateLabel}
          serviceType={serviceType}
          orderNotes={orderNotes}
          setOrderNotes={setOrderNotes}
          close={() => setCartOpen(false)}
          updateQuantity={updateQuantity}
          confirm={confirmOrder}
        />
      )}

      {confirmed && (
        <ConfirmationDialog
          t={t}
          student={currentStudent}
          total={cartTotal}
          selectedDateLabel={selectedDateLabel}
          serviceType={serviceType}
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

function PrototypeBanner({ label }: { label: string }) {
  return (
    <div className="prototype-banner">
      <span className="pulse-dot" aria-hidden="true" />
      {label}
    </div>
  );
}

type FamilyViewProps = {
  t: (typeof ui)[Language];
  language: Language;
  currentStudent: Student;
  todayLabel: string;
  todayId: string;
  serviceDates: ServiceDate[];
  serviceType: ServiceType;
  setServiceType: (service: ServiceType) => void;
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
};

function FamilyView({
  t,
  language,
  currentStudent,
  todayLabel,
  todayId,
  serviceDates,
  serviceType,
  setServiceType,
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
}: FamilyViewProps) {
  return (
    <div className="family-page page-content">
      <section className="intro-row">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>{t.greeting}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="help-card">
          <span aria-hidden="true">💬</span>
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
          <button className="text-button">+ {language === "es" ? "Agregar perfil" : "Add profile"}</button>
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
                  <em className="student-allergy">⚠ {student.allergies.join(", ")}</em>
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
        <span aria-hidden="true">{currentStudent.allergies.length ? "⚠" : "✓"}</span>
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
        <button>{language === "es" ? "Editar perfil" : "Edit profile"}</button>
      </section>

      <section className="schedule-card" aria-labelledby="schedule-title">
        <div className="schedule-icon" aria-hidden="true">🕐</div>
        <div>
          <p>{t.delivery}</p>
          <h2 id="schedule-title">{t.school}</h2>
          <span>
            {serviceType === "breakfast"
              ? language === "es" ? "Desayuno · 9:00 a. m. · Cierra 8:15 a. m." : "Breakfast · 9:00 a.m. · Closes 8:15 a.m."
              : language === "es" ? "Almuerzo · 11:30 a. m. · Cierra 10:00 a. m." : "Lunch · 11:30 a.m. · Closes 10:00 a.m."}
            {` · ${currentStudent.detail}`}
          </span>
        </div>
        <div className="service-toggle" aria-label={language === "es" ? "Tiempo de comida" : "Meal period"}>
          <button className={serviceType === "breakfast" ? "active" : ""} onClick={() => setServiceType("breakfast")}>9:00</button>
          <button className={serviceType === "lunch" ? "active" : ""} onClick={() => setServiceType("lunch")}>11:30</button>
        </div>
      </section>

      <section aria-labelledby="date-title">
        <div className="section-heading compact">
          <div>
            <span className="step-number">2</span>
            <h2 id="date-title">{language === "es" ? "Elige el día" : "Choose a day"}</h2>
          </div>
          <span className="availability"><i /> {language === "es" ? "Pedidos abiertos" : "Orders open"}</span>
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
          {(["Todos", "Menú permanente", "Bebidas", "Especialidades"] as Category[]).map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
            >
              {language === "en"
                ? { Todos: "All", "Menú permanente": "Always available", Bebidas: "Drinks", Especialidades: "Specials" }[item]
                : item}
            </button>
          ))}
        </div>

        <div className="dish-grid">
          {visibleDishes.map((dish) => {
            const quantity = cart
              .filter((item) => item.dishId === dish.id)
              .reduce((total, item) => total + item.quantity, 0);
            return (
              <article className="dish-card" key={dish.id}>
                <button className="dish-open" onClick={() => openDish(dish)} aria-label={`${language === "es" ? "Ver y personalizar" : "View and customize"} ${language === "es" ? dish.name : dish.nameEn}`}>
                <div className={`dish-visual ${dish.tone}`}>
                  <span className="food-emoji" aria-hidden="true">{dish.emoji}</span>
                  {dish.badge && <span className="dish-badge">{dish.badge}</span>}
                  {quantity > 0 && <span className="dish-cart-count">{quantity}</span>}
                </div>
                <div className="dish-copy">
                  <div>
                    <h3>{language === "es" ? dish.name : dish.nameEn}</h3>
                    <p>{language === "es" ? dish.description : dish.descriptionEn}</p>
                  </div>
                  <div className="dish-footer">
                    <strong>{money.format(dish.price / 100)}</strong>
                    <span className="add-button">{dish.optionGroups?.length ? (language === "es" ? "Elegir" : "Choose") : `+ ${t.add}`}</span>
                  </div>
                </div>
                </button>
              </article>
            );
          })}
          {visibleDishes.length === 0 && (
            <div className="empty-menu">
              <span aria-hidden="true">👨‍🍳</span>
              <h3>{language === "es" ? "Próximamente habrá especialidades" : "Specials are coming soon"}</h3>
              <p>{language === "es" ? "Los platillos de temporada se publicarán desde Administración." : "Seasonal dishes will be published from Administration."}</p>
            </div>
          )}
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Navegación principal">
        <button className="active"><span>⌂</span>{language === "es" ? "Inicio" : "Home"}</button>
        <button><span>▦</span>{language === "es" ? "Calendario" : "Calendar"}</button>
        <button><span>▤</span>{language === "es" ? "Pedidos" : "Orders"}</button>
        <button><span>○</span>{language === "es" ? "Perfil" : "Profile"}</button>
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

function AdminView({ showToast, todayLabel }: { showToast: (message: string) => void; todayLabel: string }) {
  const [imported, setImported] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const runImport = () => {
    setImported(true);
    showToast("Archivo validado: 8 platillos listos para revisar");
  };

  return (
    <div className="ops-page page-content">
      <section className="ops-heading">
        <div>
          <p className="eyebrow">OPERACIÓN · {todayLabel}</p>
          <h1>Buenos días, Daniela</h1>
          <p>Todo lo importante para la jornada de hoy.</p>
        </div>
        <button className="primary-action" onClick={() => showToast("Nuevo platillo: formulario abierto")}>+ Nuevo platillo</button>
      </section>

      <div className="metric-grid">
        <MetricCard icon="▤" value="48" label="Pedidos de hoy" detail="6 más que ayer" tone="blue" />
        <MetricCard icon="✓" value="32" label="Confirmados" detail="67% del total" tone="green" />
        <MetricCard icon="🕐" value="16" label="Por preparar" detail="Cierre en 1 h 24 min" tone="gold" />
        <MetricCard icon="!" value="2" label="Requieren atención" detail="Revisar ahora" tone="red" />
      </div>

      <div className="ops-grid">
        <section className="panel import-panel">
          <div className="panel-title">
            <div>
              <span className="panel-icon">⇧</span>
              <div><h2>Importación masiva</h2><p>Menús, precios y calendarios</p></div>
            </div>
            <span className="safe-chip">Vista previa segura</span>
          </div>
          <div className={`drop-zone ${imported ? "has-file" : ""}`}>
            <span className="upload-orbit" aria-hidden="true">{imported ? "✓" : "⇧"}</span>
            <h3>{imported ? "menú-agosto.xlsx validado" : "Arrastra tu archivo aquí"}</h3>
            <p>{imported ? "8 nuevos · 4 cambios · 0 errores" : "CSV o XLSX de hasta 10 MB"}</p>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx"
              onChange={runImport}
              className="visually-hidden"
            />
            <button onClick={() => fileInput.current?.click()}>{imported ? "Cambiar archivo" : "Seleccionar archivo"}</button>
          </div>
          {imported && (
            <div className="import-result">
              <div><strong>12</strong><span>Nuevos</span></div>
              <div><strong>4</strong><span>Cambios</span></div>
              <div><strong>0</strong><span>Errores</span></div>
              <button onClick={() => showToast("Vista previa preparada; nada se ha publicado")}>Revisar antes de publicar</button>
            </div>
          )}
        </section>

        <section className="panel today-panel">
          <div className="panel-title">
              <div><span className="panel-icon">▦</span><div><h2>Menú de hoy</h2><p>Escuela Internacional Sampedrana (EIS)</p></div></div>
            <button className="text-button">Editar</button>
          </div>
          <div className="menu-summary-list">
            <MenuSummary emoji="🍳" name="Chilaquiles" orders={18} capacity={24} />
            <MenuSummary emoji="🌮" name="Tacos" orders={14} capacity={20} />
            <MenuSummary emoji="🧀" name="Nachos" orders={10} capacity={16} />
            <MenuSummary emoji="🥞" name="Mini pancakes" orders={6} capacity={12} />
          </div>
        </section>

        <section className="panel wide-panel">
          <div className="panel-title">
            <div><span className="panel-icon">◎</span><div><h2>Flujo de entrega</h2><p>Seguimiento por etapa</p></div></div>
            <button className="text-button">Ver operación →</button>
          </div>
          <div className="flow-summary">
            {[
              ["Confirmados", "48", "100%"],
              ["En cocina", "32", "67%"],
              ["Empacados", "21", "44%"],
              ["Entregados", "8", "17%"],
            ].map(([label, value, width], index) => (
              <div className="flow-item" key={label}>
                <span className="flow-number">{index + 1}</span>
                <div><strong>{label}</strong><span><i style={{ width }} /> </span></div>
                <b>{value}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ icon, value, label, detail, tone }: { icon: string; value: string; label: string; detail: string; tone: string }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span className="metric-icon">{icon}</span>
      <div><strong>{value}</strong><h3>{label}</h3><p>{detail}</p></div>
    </article>
  );
}

function MenuSummary({ emoji, name, orders, capacity }: { emoji: string; name: string; orders: number; capacity: number }) {
  const percent = `${Math.round((orders / capacity) * 100)}%`;
  return (
    <div className="menu-summary">
      <span>{emoji}</span>
      <div><strong>{name}</strong><small>{orders} pedidos de {capacity}</small><i><b style={{ width: percent }} /></i></div>
      <em>{capacity - orders} cupos</em>
    </div>
  );
}

function KitchenView({ orders, advanceOrder, showToast }: { orders: KdsOrder[]; advanceOrder: (id: string) => void; showToast: (message: string) => void }) {
  const stages: KdsStage[] = ["Nuevas", "Preparando", "Listas", "Empacadas"];
  const count = useMemo(() => orders.filter((order) => order.stage !== "Empacadas").length, [orders]);

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
          <div><small>Hora de entrega</small><strong>11:30</strong></div>
          <button onClick={() => showToast("Hoja de producción preparada")}>▤ Hoja de producción</button>
        </div>
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
                  <article className={`kds-ticket ${order.allergy ? "allergy" : ""}`} key={order.id}>
                    <div className="ticket-head"><strong>{order.id}</strong><time>{order.time}</time></div>
                    <h3>{order.dish}</h3>
                    <p><span aria-hidden="true">◉</span> {order.student}</p>
                    <p><span aria-hidden="true">⌂</span> {order.classroom}</p>
                    {order.allergy && <div className="allergy-alert">⚠ {order.allergy}</div>}
                    {stage !== "Empacadas" ? (
                      <button onClick={() => advanceOrder(order.id)}>
                        {stage === "Nuevas" ? "Aceptar orden" : stage === "Preparando" ? "Marcar lista" : "Imprimir y empacar"}
                        <span>→</span>
                      </button>
                    ) : (
                      <div className="packed-state">✓ Etiqueta SM-28 impresa</div>
                    )}
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
  const complete = groups.every((group) => Boolean(selections[group.id]));

  const submit = () => {
    if (!complete) return;
    const selectionKey = groups.map((group) => `${group.id}:${selections[group.id]}`).join("|");
    const normalizedNotes = notes.trim();
    add({
      key: `${dish.id}|${selectionKey}|${normalizedNotes.toLocaleLowerCase("es-HN")}`,
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
          <span className="product-emoji" aria-hidden="true">{dish.emoji}</span>
          <button className="close-button product-close" onClick={close} aria-label={language === "es" ? "Cerrar producto" : "Close product"}>×</button>
        </div>
        <div className="product-content">
          <p className="product-kicker">{language === "es" ? dish.category : dish.category === "Bebidas" ? "Drinks" : "Always available"}</p>
          <h2 id="product-title">{language === "es" ? dish.name : dish.nameEn}</h2>
          <p className="product-description">{language === "es" ? dish.description : dish.descriptionEn}</p>
          <strong className="product-price">{money.format(dish.price / 100)}</strong>

          {groups.map((group) => (
            <fieldset className="option-group" key={group.id}>
              <legend>
                <span>{language === "es" ? group.name : group.nameEn}</span>
                <em>{language === "es" ? "Obligatorio" : "Required"}</em>
              </legend>
              <small>{language === "es" ? "Selecciona 1 opción" : "Select 1 option"}</small>
              <div className="option-list">
                {group.options.map((option) => (
                  <label key={option.id} className={selections[group.id] === option.id ? "selected" : ""}>
                    <span>{language === "es" ? option.name : option.nameEn}</span>
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
            <span>{language === "es" ? "¿Alguna instrucción para este producto?" : "Any instructions for this item?"}</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={180} placeholder={language === "es" ? "Ej.: salsa aparte" : "E.g. salsa on the side"} />
            <small>{notes.length}/180 · {language === "es" ? "Las alergias se toman del perfil" : "Allergies come from the profile"}</small>
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
            <strong>{money.format((dish.price * quantity) / 100)}</strong>
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
  total,
  student,
  selectedDateLabel,
  serviceType,
  orderNotes,
  setOrderNotes,
  close,
  updateQuantity,
  confirm,
}: {
  t: (typeof ui)[Language];
  language: Language;
  cart: CartItem[];
  total: number;
  student: Student;
  selectedDateLabel: string;
  serviceType: ServiceType;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  close: () => void;
  updateQuantity: (id: string, delta: number) => void;
  confirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section className="cart-sheet" role="dialog" aria-modal="true" aria-labelledby="cart-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <header>
          <div><p>PEDIDO PARA</p><h2 id="cart-title">{student.name}</h2><span>{student.detail}</span></div>
          <button className="close-button" onClick={close} aria-label="Cerrar">×</button>
        </header>
        <div className="cart-schedule"><span>▦</span><div><strong>{selectedDateLabel} · EIS</strong><small>{serviceType === "breakfast" ? "Desayuno · 9:00 a. m." : "Almuerzo · 11:30 a. m."}</small></div></div>
        <div className={`cart-allergies ${student.allergies.length ? "warning" : ""}`}>
          <strong>{student.allergies.length ? "⚠ Alergias del perfil" : "✓ Sin alergias registradas"}</strong>
          {student.allergies.length > 0 && <span>{student.allergies.join(", ")}</span>}
        </div>
        <div className="cart-items">
          {cart.map((item) => {
            const dish = dishes.find((candidate) => candidate.id === item.dishId);
            if (!dish) return null;
            const optionLabels = (dish.optionGroups ?? []).map((group) => {
              const selected = group.options.find((option) => option.id === item.selections[group.id]);
              return selected ? (language === "es" ? selected.name : selected.nameEn) : null;
            }).filter(Boolean);
            return (
              <div className="cart-item" key={item.key}>
                <span className={`mini-food ${dish.tone}`}>{dish.emoji}</span>
                <div>
                  <strong>{language === "es" ? dish.name : dish.nameEn}</strong>
                  {optionLabels.length > 0 && <small>{optionLabels.join(" · ")}</small>}
                  {item.notes && <small className="cart-item-notes">“{item.notes}”</small>}
                  <small>{money.format(dish.price / 100)}</small>
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
        <div className="no-payment-note"><span>✓</span><p><strong>Prototipo sin cobro</strong><br />No se solicitará información de tarjeta.</p></div>
        <button className="confirm-button" onClick={confirm}>{t.confirm} <span>→</span></button>
      </section>
    </div>
  );
}

function ConfirmationDialog({ t, student, total, selectedDateLabel, serviceType, close }: { t: (typeof ui)[Language]; student: Student; total: number; selectedDateLabel: string; serviceType: ServiceType; close: () => void }) {
  return (
    <div className="modal-backdrop success-backdrop">
      <section className="success-dialog" role="dialog" aria-modal="true" aria-labelledby="success-title">
        <div className="success-mark"><span>✓</span></div>
        <p className="eyebrow">ORDEN L-1052</p>
        <h2 id="success-title">{t.confirmed}</h2>
        <p>{t.confirmedHelp}</p>
        <div className="success-ticket">
          <div><span>Para</span><strong>{student.name}</strong></div>
          <div><span>Entrega</span><strong>{selectedDateLabel} · {serviceType === "breakfast" ? "9:00 a. m." : "11:30 a. m."} · EIS</strong></div>
          <div><span>Total de referencia</span><strong>{money.format(total / 100)}</strong></div>
          <div className="delivery-code"><span>Código de entrega</span><strong>28 51</strong></div>
        </div>
        <button className="confirm-button" onClick={close}>{t.done}</button>
      </section>
    </div>
  );
}
