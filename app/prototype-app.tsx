"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type Surface = "family" | "admin" | "kitchen";
type Language = "es" | "en";
type Category = "Todos" | "Desayunos" | "Almuerzos" | "Bebidas";
type KdsStage = "Nuevas" | "Preparando" | "Listas" | "Empacadas";

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
};

type Student = {
  id: string;
  name: string;
  detail: string;
  initials: string;
  color: string;
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
    detail: "3° B · Aula 12 · Miss Laura",
    initials: "SM",
    color: "#1f66d1",
  },
  {
    id: "mateo",
    name: "Mateo M.",
    detail: "Kinder A · Edificio Norte",
    initials: "MM",
    color: "#11a5a8",
  },
];

const dishes: Dish[] = [
  {
    id: "quesadilla",
    name: "Quesadilla de pollo",
    nameEn: "Chicken quesadilla",
    description: "Pollo, queso, frijoles y pico de gallo",
    descriptionEn: "Chicken, cheese, beans and pico de gallo",
    category: "Almuerzos",
    price: 11500,
    badge: "Favorito",
    emoji: "🌮",
    tone: "sunset",
  },
  {
    id: "bowl",
    name: "Bowl mexicano",
    nameEn: "Mexican bowl",
    description: "Arroz, pollo, maíz, frijoles y aguacate",
    descriptionEn: "Rice, chicken, corn, beans and avocado",
    category: "Almuerzos",
    price: 12500,
    badge: "Balanceado",
    emoji: "🥑",
    tone: "avocado",
  },
  {
    id: "tacos",
    name: "Taquitos suaves",
    nameEn: "Soft tacos",
    description: "Tres taquitos de pollo con arroz",
    descriptionEn: "Three chicken tacos with rice",
    category: "Almuerzos",
    price: 11000,
    badge: "Nuevo",
    emoji: "🌯",
    tone: "terracotta",
  },
  {
    id: "pancakes",
    name: "Mini pancakes",
    nameEn: "Mini pancakes",
    description: "Con banano, miel y yogurt natural",
    descriptionEn: "With banana, honey and plain yogurt",
    category: "Desayunos",
    price: 8500,
    badge: "Desayuno",
    emoji: "🥞",
    tone: "berry",
  },
  {
    id: "molletes",
    name: "Molletes escolares",
    nameEn: "School molletes",
    description: "Pan horneado, frijoles, queso y fruta",
    descriptionEn: "Baked bread, beans, cheese and fruit",
    category: "Desayunos",
    price: 9000,
    emoji: "🥖",
    tone: "gold",
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
    dish: "Quesadilla de pollo",
    time: "11:35",
    stage: "Nuevas",
  },
  {
    id: "L-1049",
    student: "Daniela R.",
    classroom: "2° A · Aula 7",
    dish: "Bowl mexicano",
    time: "11:35",
    stage: "Nuevas",
    allergy: "Sin lácteos",
  },
  {
    id: "L-1044",
    student: "Mateo M.",
    classroom: "Kinder A · Norte",
    dish: "Taquitos suaves",
    time: "11:20",
    stage: "Preparando",
  },
  {
    id: "L-1041",
    student: "Valentina P.",
    classroom: "4° C · Aula 18",
    dish: "Quesadilla de pollo",
    time: "11:20",
    stage: "Listas",
  },
  {
    id: "L-1038",
    student: "Lucas A.",
    classroom: "1° B · Aula 4",
    dish: "Bowl mexicano",
    time: "11:20",
    stage: "Empacadas",
  },
];

const dates = [
  { day: "LUN", date: "10" },
  { day: "MAR", date: "11" },
  { day: "MIÉ", date: "12" },
  { day: "JUE", date: "13" },
  { day: "VIE", date: "14" },
];

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
    school: "Escuela Bilingüe Los Pinos",
    period: "Almuerzo · 11:35 a. m.",
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
    school: "Los Pinos Bilingual School",
    period: "Lunch · 11:35 a.m.",
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

export function PrototypeApp() {
  const [surface, setSurface] = useState<Surface>("family");
  const [language, setLanguage] = useState<Language>("es");
  const [studentId, setStudentId] = useState(students[0].id);
  const [selectedDate, setSelectedDate] = useState("12");
  const [category, setCategory] = useState<Category>("Todos");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [kdsOrders, setKdsOrders] = useState(initialKdsOrders);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = ui[language];

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
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const cartTotal = Object.entries(cart).reduce((total, [id, quantity]) => {
    const dish = dishes.find((item) => item.id === id);
    return total + (dish?.price ?? 0) * quantity;
  }, 0);

  const addDish = (dish: Dish) => {
    setCart((current) => ({ ...current, [dish.id]: (current[dish.id] ?? 0) + 1 }));
    showToast(`${language === "es" ? "Agregado" : "Added"}: ${language === "es" ? dish.name : dish.nameEn}`);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((current) => {
      const quantity = Math.max(0, (current[id] ?? 0) + delta);
      const next = { ...current };
      if (quantity === 0) delete next[id];
      else next[id] = quantity;
      return next;
    });
  };

  const confirmOrder = () => {
    if (!cartCount) return;
    setCartOpen(false);
    setConfirmed(true);
  };

  const startAnotherOrder = () => {
    setCart({});
    setConfirmed(false);
    setCategory("Todos");
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
        <button className="brand" onClick={() => setSurface("family")} aria-label="Ir al inicio">
          <Image src="/logo-solo-mexico.png" alt="Solo México" width={600} height={299} unoptimized />
          <span>
            <strong>Lonchera</strong>
            <small>Solo México</small>
          </span>
        </button>

        <div className="surface-switch" aria-label={t.demo}>
          {(["family", "admin", "kitchen"] as Surface[]).map((item) => (
            <button
              key={item}
              className={surface === item ? "active" : ""}
              onClick={() => setSurface(item)}
              aria-pressed={surface === item}
            >
              {item === "family" ? t.family : item === "admin" ? t.admin : t.kitchen}
            </button>
          ))}
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
          studentId={studentId}
          setStudentId={setStudentId}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          category={category}
          setCategory={setCategory}
          visibleDishes={visibleDishes}
          cart={cart}
          addDish={addDish}
          updateQuantity={updateQuantity}
          cartCount={cartCount}
          cartTotal={cartTotal}
          openCart={() => setCartOpen(true)}
        />
      )}
      {surface === "admin" && <AdminView showToast={showToast} />}
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
  studentId: string;
  setStudentId: (id: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  category: Category;
  setCategory: (category: Category) => void;
  visibleDishes: Dish[];
  cart: Record<string, number>;
  addDish: (dish: Dish) => void;
  updateQuantity: (id: string, delta: number) => void;
  cartCount: number;
  cartTotal: number;
  openCart: () => void;
};

function FamilyView({
  t,
  language,
  currentStudent,
  studentId,
  setStudentId,
  selectedDate,
  setSelectedDate,
  category,
  setCategory,
  visibleDishes,
  cart,
  addDish,
  updateQuantity,
  cartCount,
  cartTotal,
  openCart,
}: FamilyViewProps) {
  return (
    <div className="family-page page-content">
      <section className="intro-row">
        <div>
          <p className="eyebrow">MIÉRCOLES, 12 DE AGOSTO</p>
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
              </span>
              <span className="selection-mark" aria-hidden="true">
                {studentId === student.id ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="schedule-card" aria-labelledby="schedule-title">
        <div className="schedule-icon" aria-hidden="true">🕐</div>
        <div>
          <p>{t.delivery}</p>
          <h2 id="schedule-title">{t.school}</h2>
          <span>{t.period} · {currentStudent.detail}</span>
        </div>
        <button>{language === "es" ? "Cambiar" : "Change"}</button>
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
          {dates.map((date) => (
            <button
              key={date.date}
              className={selectedDate === date.date ? "selected" : ""}
              onClick={() => setSelectedDate(date.date)}
              aria-pressed={selectedDate === date.date}
            >
              <small>{date.day}</small>
              <strong>{date.date}</strong>
              {date.date === "12" && <span>{language === "es" ? "HOY" : "TODAY"}</span>}
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
          {(["Todos", "Desayunos", "Almuerzos", "Bebidas"] as Category[]).map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
            >
              {language === "en"
                ? { Todos: "All", Desayunos: "Breakfast", Almuerzos: "Lunch", Bebidas: "Drinks" }[item]
                : item}
            </button>
          ))}
        </div>

        <div className="dish-grid">
          {visibleDishes.map((dish) => {
            const quantity = cart[dish.id] ?? 0;
            return (
              <article className="dish-card" key={dish.id}>
                <div className={`dish-visual ${dish.tone}`}>
                  <span className="food-emoji" aria-hidden="true">{dish.emoji}</span>
                  {dish.badge && <span className="dish-badge">{dish.badge}</span>}
                  <button className="favorite-button" aria-label={`Guardar ${dish.name}`}>♡</button>
                </div>
                <div className="dish-copy">
                  <div>
                    <h3>{language === "es" ? dish.name : dish.nameEn}</h3>
                    <p>{language === "es" ? dish.description : dish.descriptionEn}</p>
                  </div>
                  <div className="dish-footer">
                    <strong>{money.format(dish.price / 100)}</strong>
                    {quantity ? (
                      <div className="quantity-control" aria-label={`Cantidad de ${dish.name}`}>
                        <button onClick={() => updateQuantity(dish.id, -1)} aria-label="Reducir cantidad">−</button>
                        <span>{quantity}</span>
                        <button onClick={() => updateQuantity(dish.id, 1)} aria-label="Aumentar cantidad">+</button>
                      </div>
                    ) : (
                      <button className="add-button" onClick={() => addDish(dish)}>
                        + {t.add}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
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

function AdminView({ showToast }: { showToast: (message: string) => void }) {
  const [imported, setImported] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const runImport = () => {
    setImported(true);
    showToast("Archivo validado: 12 platillos listos para revisar");
  };

  return (
    <div className="ops-page page-content">
      <section className="ops-heading">
        <div>
          <p className="eyebrow">OPERACIÓN · MIÉRCOLES 12 DE AGOSTO</p>
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
            <p>{imported ? "12 nuevos · 4 cambios · 0 errores" : "CSV o XLSX de hasta 10 MB"}</p>
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
            <div><span className="panel-icon">▦</span><div><h2>Menú de hoy</h2><p>Escuela Bilingüe Los Pinos</p></div></div>
            <button className="text-button">Editar</button>
          </div>
          <div className="menu-summary-list">
            <MenuSummary emoji="🌮" name="Quesadilla de pollo" orders={18} capacity={24} />
            <MenuSummary emoji="🥑" name="Bowl mexicano" orders={14} capacity={20} />
            <MenuSummary emoji="🌯" name="Taquitos suaves" orders={10} capacity={16} />
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
          <p className="eyebrow">KDS · ESCUELA LOS PINOS</p>
          <h1>Servicio de almuerzo</h1>
          <span><i /> Conectado · actualización en vivo</span>
        </div>
        <div className="kds-stats">
          <div><small>Pendientes</small><strong>{count}</strong></div>
          <div><small>Hora de salida</small><strong>11:10</strong></div>
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

function CartDialog({
  t,
  language,
  cart,
  total,
  student,
  close,
  updateQuantity,
  confirm,
}: {
  t: (typeof ui)[Language];
  language: Language;
  cart: Record<string, number>;
  total: number;
  student: Student;
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
        <div className="cart-schedule"><span>▦</span><div><strong>Miércoles, 12 de agosto</strong><small>Almuerzo · 11:35 a. m.</small></div></div>
        <div className="cart-items">
          {Object.entries(cart).map(([id, quantity]) => {
            const dish = dishes.find((item) => item.id === id);
            if (!dish) return null;
            return (
              <div className="cart-item" key={id}>
                <span className={`mini-food ${dish.tone}`}>{dish.emoji}</span>
                <div><strong>{language === "es" ? dish.name : dish.nameEn}</strong><small>{money.format(dish.price / 100)}</small></div>
                <div className="quantity-control"><button onClick={() => updateQuantity(id, -1)}>−</button><span>{quantity}</span><button onClick={() => updateQuantity(id, 1)}>+</button></div>
              </div>
            );
          })}
        </div>
        <div className="cart-total"><span>Total</span><strong>{money.format(total / 100)}</strong></div>
        <div className="no-payment-note"><span>✓</span><p><strong>Prototipo sin cobro</strong><br />No se solicitará información de tarjeta.</p></div>
        <button className="confirm-button" onClick={confirm}>{t.confirm} <span>→</span></button>
      </section>
    </div>
  );
}

function ConfirmationDialog({ t, student, total, close }: { t: (typeof ui)[Language]; student: Student; total: number; close: () => void }) {
  return (
    <div className="modal-backdrop success-backdrop">
      <section className="success-dialog" role="dialog" aria-modal="true" aria-labelledby="success-title">
        <div className="success-mark"><span>✓</span></div>
        <p className="eyebrow">ORDEN L-1052</p>
        <h2 id="success-title">{t.confirmed}</h2>
        <p>{t.confirmedHelp}</p>
        <div className="success-ticket">
          <div><span>Para</span><strong>{student.name}</strong></div>
          <div><span>Entrega</span><strong>Mié 12 · 11:35 a. m.</strong></div>
          <div><span>Total de referencia</span><strong>{money.format(total / 100)}</strong></div>
          <div className="delivery-code"><span>Código de entrega</span><strong>28 51</strong></div>
        </div>
        <button className="confirm-button" onClick={close}>{t.done}</button>
      </section>
    </div>
  );
}
