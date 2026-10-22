"use client";

import type { ReactNode } from "react";

export type Surface = "family" | "admin" | "kitchen";
export type Language = "es" | "en";
export type Category = "Todos" | "Menú fijo" | "Menú del día";
export type ServiceType = "breakfast" | "lunch";
export type PaymentMethod = "bank_transfer" | "card";
export type KdsStage = "Nuevas" | "Preparando" | "Listas" | "Empacadas";
export type FamilyDataState = "loading" | "demo" | "live" | "error";
export type PushState = "loading" | "available" | "active" | "denied" | "unsupported" | "unconfigured";

export type ServiceDate = {
  id: string;
  day: string;
  date: string;
};

export type Dish = {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  category: Exclude<Category, "Todos">;
  price: number;
  prepTimeMinutes?: number;
  badge?: string;
  salesBadges?: string[];
  emoji: string;
  tone: string;
  imageUrl?: string;
  imageKey?: string | null;
  isActive?: boolean;
  categoryId?: string;
  optionGroups?: OptionGroup[];
  allergens?: string[];
  possibleAllergens?: string[];
  menuWeekday?: number;
};

export type OptionGroup = {
  id: string;
  name: string;
  nameEn: string;
  required?: boolean;
  options: Array<{ id: string; name: string; nameEn: string; priceDeltaCents?: number }>;
};

export type CartItem = {
  key: string;
  studentId: string;
  dishId: string;
  quantity: number;
  selections: Record<string, string>;
  notes: string;
};

export type Student = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  grade: string;
  section: string;
  classroomName: string;
  building: string;
  teacher: string;
  deliveryNotes: string;
  detail: string;
  initials: string;
  color: string;
  allergies: string[];
};

export type KdsOrder = {
  id: string;
  backendId?: string;
  student: string;
  classroom: string;
  dish: string;
  time: string;
  stage: KdsStage;
  allergy?: string;
  targetMinutes: number;
  stageStartedAt?: string;
  kitchenStartedAt?: string;
  readyAt?: string;
  printJobsQueued: number;
};

export type DemoOrder = {
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
  special_instructions: string | null;
  student_delivery_notes: string | null;
  guardian_name: string;
  guardian_email: string;
  payment_status: string;
  payment_method: string;
  customer_reference: string | null;
  receipt_object_key: string | null;
  receipt_original_name: string | null;
  receipt_submitted_at: string | null;
  payment_batch_id: string | null;
  checkout_number: string | null;
  payment_expires_at: string | null;
  bank_account_id: string | null;
  bank_label: string | null;
  bank_name: string | null;
  receipt_requested_at: string | null;
  receipt_request_count: number;
  last_reminder_at: string | null;
  payment_review_note: string | null;
  payment_cancellation_reason: string | null;
  created_at: string;
  prep_time_minutes: number;
  stage_started_at: string;
  kitchen_started_at: string | null;
  ready_at: string | null;
  packed_at: string | null;
  print_jobs_queued: number;
  has_delivery_photo: number;
};

export type CreatedOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: PaymentMethod;
  totalCents: number;
  orderIds?: string[];
  expiresAt?: string;
};

export type BankTransferConfig = {
  id: string;
  label: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  accountType: string;
};

export type Availability = {
  open: boolean;
  status: string;
  deliveryTime: string;
  cutoffTime: string;
  messageEs: string | null;
  messageEn: string | null;
};

export type PaymentIssue = { id: string; checkout_number: string; expected_cents: number; received_cents: number; difference_cents: number; status: string };
export type AppNotification = { id: string; order_id: string | null; template_key: string; status: string; created_at: string };
export type SupportRequest = { id: string; order_id: string | null; category: string; subject: string; message: string; status: string; admin_note: string | null; created_at: string; updated_at: string };
export type AuthenticatedUser = { id: string; email: string; display_name: string; locale: string };

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function isClientRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - value.length % 4) % 4);
  const binary = window.atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export type IconName = "meal" | "bank" | "card" | "clock" | "alert" | "check" | "calendar" | "bag" | "help" | "user" | "home" | "orders" | "logout";

export function PipiroIcon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    meal: <><path d="M5 3v7a3 3 0 0 0 3 3V3M5 7h3M8 13v8M15 3v18M15 3c3 1 4 4 4 7h-4" /></>,
    bank: <><path d="m3 9 9-6 9 6M5 10h14M6 10v7M10 10v7M14 10v7M18 10v7M4 21h16M3 17h18" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3" /></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" /></>,
    alert: <><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4M12 17h.01" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18" /></>,
    bag: <><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8a3 3 0 0 1 6 0" /></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 3.6 2.3c-.9.5-1.3 1-1.3 2M12 17h.01" /></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0" /></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-6h6v6" /></>,
    orders: <><path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4" /></>,
    logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" /></>,
  };
  return <svg className="pipiro-icon" aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export const ORDER_DRAFT_KEY = "pipiro:order-draft:v1";

export type SavedOrderDraft = {
  version: 1;
  requestKey: string;
  studentId: string;
  serviceType: ServiceType;
  serviceDate: string;
  orderNotes: string;
  paymentMethod: PaymentMethod;
  cart: CartItem[];
};

export function createClientKey(prefix = "key"): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return `${prefix}_${cryptoApi.randomUUID()}`;
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

export function parseSavedOrderDraft(raw: string): SavedOrderDraft | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isClientRecord(value) || value.version !== 1 || typeof value.requestKey !== "string" ||
        value.requestKey.length < 8 || typeof value.studentId !== "string" ||
        value.serviceType !== "lunch" ||
        typeof value.serviceDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.serviceDate) ||
        typeof value.orderNotes !== "string" || value.orderNotes.length > 300 ||
        (value.paymentMethod !== "bank_transfer" && value.paymentMethod !== "card") ||
        !Array.isArray(value.cart) || value.cart.length > 30) return null;
    const savedStudentId = value.studentId;
    const cart = value.cart.map((candidate): CartItem | null => {
      if (!isClientRecord(candidate) || typeof candidate.key !== "string" || typeof candidate.dishId !== "string" ||
          typeof candidate.quantity !== "number" || !Number.isInteger(candidate.quantity) ||
          candidate.quantity < 1 || candidate.quantity > 20 || !isClientRecord(candidate.selections) ||
          typeof candidate.notes !== "string" || candidate.notes.length > 180) return null;
      const selections: Record<string, string> = {};
      for (const [groupId, optionId] of Object.entries(candidate.selections)) {
        if (typeof optionId !== "string") return null;
        selections[groupId] = optionId;
      }
      return { key: candidate.key, studentId: typeof candidate.studentId === "string" ? candidate.studentId : savedStudentId,
        dishId: candidate.dishId, quantity: candidate.quantity, selections, notes: candidate.notes };
    });
    if (cart.some((item) => item === null)) return null;
    return {
      version: 1,
      requestKey: value.requestKey,
      studentId: value.studentId,
      serviceType: value.serviceType,
      serviceDate: value.serviceDate,
      orderNotes: value.orderNotes,
      paymentMethod: value.paymentMethod,
      cart: cart.filter((item): item is CartItem => item !== null),
    };
  } catch {
    return null;
  }
}

export function clientSlug(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es-HN")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export const students: Student[] = [
  {
    id: "student_demo_sofia",
    name: "Sofía M.",
    firstName: "Sofía",
    lastName: "M.",
    grade: "3°",
    section: "B",
    classroomName: "Aula 12",
    building: "Edificio Primaria",
    teacher: "Miss Laura",
    deliveryNotes: "Entregar en Aula 12",
    detail: "3° B · Aula 12 · Miss Laura · Edificio Primaria",
    initials: "SM",
    color: "#4b70b5",
    allergies: ["Maní", "Nueces"],
  },
  {
    id: "student_demo_mateo",
    name: "Mateo M.",
    firstName: "Mateo",
    lastName: "M.",
    grade: "Kinder",
    section: "A",
    classroomName: "Aula K-A",
    building: "Edificio Preescolar",
    teacher: "Miss Andrea",
    deliveryNotes: "Entregar en Aula K-A",
    detail: "Kinder A · Aula K-A · Miss Andrea · Edificio Preescolar",
    initials: "MM",
    color: "#4c8f94",
    allergies: [],
  },
];

export const dishes: Dish[] = [
  {
    id: "dish_p01", name: "Chilaquiles", nameEn: "Chilaquiles",
    description: "Chilaquiles con carne y salsa a elección; incluyen quesillo, crema y queso.",
    descriptionEn: "Chilaquiles with your choice of meat and salsa, topped with quesillo, cream and cheese.",
    category: "Menú fijo", price: 20600, emoji: "meal", tone: "avocado", allergens: ["Lácteos"], possibleAllergens: ["Gluten", "Huevo", "Soya"],
    optionGroups: [
      { id: "group_p01_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
        { id: "opt_p01_child", name: "Niño", nameEn: "Child", priceDeltaCents: 0 },
        { id: "opt_p01_adult", name: "Adulto", nameEn: "Adult", priceDeltaCents: 2900 },
      ] },
      { id: "group_p01_meat", name: "Elige la carne", nameEn: "Choose the meat", required: true, options: [
        { id: "opt_p01_chicken", name: "Pollo", nameEn: "Chicken" },
        { id: "opt_p01_pastor", name: "Pastor", nameEn: "Al pastor" },
      ] },
      { id: "group_p01_salsa", name: "Elige la salsa", nameEn: "Choose the salsa", required: true, options: [
        { id: "opt_p01_green", name: "Salsa verde", nameEn: "Green salsa" },
        { id: "opt_p01_red", name: "Salsa roja", nameEn: "Red salsa" },
      ] },
    ],
  },
  {
    id: "dish_p02", name: "Sopa teposteca", nameEn: "Teposteca soup",
    description: "Deliciosa sopa de tortilla con pollo acompañada de queso, aguacate y crema.",
    descriptionEn: "Tortilla soup with chicken, cheese, avocado and cream.",
    category: "Menú fijo", price: 19000, emoji: "meal", tone: "berry", allergens: ["Lácteos"], possibleAllergens: ["Gluten", "Soya"],
    optionGroups: [{ id: "group_p02_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
      { id: "opt_p02_child", name: "Niño", nameEn: "Child" },
      { id: "opt_p02_adult", name: "Adulto", nameEn: "Adult", priceDeltaCents: 3000 },
    ] }],
  },
  {
    id: "dish_p03", name: "Tacos de birria", nameEn: "Birria tacos",
    description: "Tres tacos acompañados con salsa de birria, cebolla y cilantro.",
    descriptionEn: "Three tacos served with birria sauce, onion and cilantro.",
    category: "Menú fijo", price: 19500, emoji: "meal", tone: "terracotta", possibleAllergens: ["Gluten", "Lácteos", "Soya"],
    optionGroups: [{ id: "group_p03_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
      { id: "opt_p03_child", name: "Niño", nameEn: "Child" },
      { id: "opt_p03_adult", name: "Adulto", nameEn: "Adult", priceDeltaCents: 3300 },
    ] }],
  },
  {
    id: "dish_p04", name: "Tacos de queso birria", nameEn: "Cheese birria tacos",
    description: "Tres tacos de birria con queso acompañados con salsa de birria, cebolla y cilantro.",
    descriptionEn: "Three cheese birria tacos served with birria sauce, onion and cilantro.",
    category: "Menú fijo", price: 21000, emoji: "meal", tone: "hibiscus", allergens: ["Lácteos"], possibleAllergens: ["Gluten", "Soya"],
    optionGroups: [{ id: "group_p04_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
      { id: "opt_p04_child", name: "Niño", nameEn: "Child" },
      { id: "opt_p04_adult", name: "Adulto", nameEn: "Adult", priceDeltaCents: 2500 },
    ] }],
  },
  {
    id: "dish_p05", name: "Tacos flautas", nameEn: "Flauta tacos",
    description: "Flautas de pollo con lechuga, salsa verde, queso y crema; tres para Niño y cuatro para Adulto.",
    descriptionEn: "Chicken flautas with lettuce, green salsa, cheese and cream; three child-size or four adult-size.",
    category: "Menú fijo", price: 19000, emoji: "meal", tone: "gold", allergens: ["Lácteos"], possibleAllergens: ["Gluten", "Soya"],
    optionGroups: [{ id: "group_p05_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
      { id: "opt_p05_child", name: "Niño · 3 tacos", nameEn: "Child · 3 tacos" },
      { id: "opt_p05_adult", name: "Adulto · 4 tacos", nameEn: "Adult · 4 tacos", priceDeltaCents: 3000 },
    ] }],
  },
  {
    id: "dish_p06", name: "Deditos de pollo", nameEn: "Chicken fingers",
    description: "Deditos de pollo con papas fritas.", descriptionEn: "Chicken fingers with french fries.",
    category: "Menú fijo", price: 19000, emoji: "meal", tone: "sunset", possibleAllergens: ["Gluten", "Huevo", "Lácteos", "Soya"],
    optionGroups: [{ id: "group_p06_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
      { id: "opt_p06_child", name: "Niño", nameEn: "Child" },
      { id: "opt_p06_adult", name: "Adulto", nameEn: "Adult", priceDeltaCents: 3000 },
    ] }],
  },
  {
    id: "dish_p07", name: "Sándwich a la parrilla", nameEn: "Grilled cheese sandwich",
    description: "Delicioso sándwich a la parrilla con queso cheddar y mozzarella.",
    descriptionEn: "Grilled sandwich with cheddar and mozzarella cheese.",
    category: "Menú fijo", price: 17000, emoji: "meal", tone: "avocado", allergens: ["Gluten", "Lácteos"], possibleAllergens: ["Huevo", "Soya"],
    optionGroups: [{ id: "group_p07_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
      { id: "opt_p07_child", name: "Niño", nameEn: "Child" },
      { id: "opt_p07_adult", name: "Adulto", nameEn: "Adult", priceDeltaCents: 2500 },
    ] }],
  },
  {
    id: "dish_p08", name: "Tacos mexicanos", nameEn: "Mexican tacos",
    description: "Tres tacos con carne a elección, cebolla, cilantro, limón, salsa de la casa y chismol.",
    descriptionEn: "Three tacos with your choice of meat, onion, cilantro, lime, house salsa and chismol.",
    category: "Menú fijo", price: 19000, emoji: "meal", tone: "terracotta", possibleAllergens: ["Gluten", "Lácteos", "Soya"],
    optionGroups: [
      { id: "group_p08_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
        { id: "opt_p08_child", name: "Niño · una tortilla", nameEn: "Child · single tortilla" },
        { id: "opt_p08_adult", name: "Adulto · doble tortilla", nameEn: "Adult · double tortilla", priceDeltaCents: 3500 },
      ] },
      { id: "group_p08_meat", name: "Elige la carne", nameEn: "Choose the meat", required: true, options: [
        { id: "opt_p08_pastor", name: "Pastor", nameEn: "Al pastor" },
        { id: "opt_p08_beef", name: "Res", nameEn: "Beef" },
        { id: "opt_p08_chilorio", name: "Chilorio de pollo", nameEn: "Chicken chilorio" },
        { id: "opt_p08_cochinita", name: "Cochinita pibil", nameEn: "Cochinita pibil" },
        { id: "opt_p08_chorizo", name: "Chorizo", nameEn: "Chorizo" },
        { id: "opt_p08_chicharron", name: "Chicharrón en salsa verde", nameEn: "Pork rind in green salsa" },
      ] },
    ],
  },
  {
    id: "dish_p09", name: "Gringas", nameEn: "Gringas",
    description: "Dos tortillas de harina rellenas de queso y carne a elección; acompañadas con guacamole.",
    descriptionEn: "Two flour tortillas filled with cheese and your choice of meat, served with guacamole.",
    category: "Menú fijo", price: 19000, emoji: "meal", tone: "hibiscus", allergens: ["Gluten", "Lácteos"], possibleAllergens: ["Soya", "Crustáceos al escoger camarón"],
    optionGroups: [
      { id: "group_p09_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
        { id: "opt_p09_child", name: "Niño", nameEn: "Child" },
        { id: "opt_p09_adult", name: "Adulto", nameEn: "Adult", priceDeltaCents: 2500 },
      ] },
      { id: "group_p09_meat", name: "Elige la carne", nameEn: "Choose the meat", required: true, options: [
        { id: "opt_p09_chicken", name: "Pollo", nameEn: "Chicken" },
        { id: "opt_p09_chorizo", name: "Chorizo", nameEn: "Chorizo" },
        { id: "opt_p09_pastor", name: "Pastor", nameEn: "Al pastor", priceDeltaCents: 3000 },
        { id: "opt_p09_beef", name: "Res", nameEn: "Beef", priceDeltaCents: 3000 },
        { id: "opt_p09_shrimp", name: "Camarón con chipotle", nameEn: "Chipotle shrimp", priceDeltaCents: 4500 },
      ] },
    ],
  },
  {
    id: "dish_p10", name: "Nachos", nameEn: "Nachos",
    description: "Totopos con frijoles refritos, pico de gallo, jalapeños, guacamole, quesillo y queso cheddar.",
    descriptionEn: "Tortilla chips with refried beans, pico de gallo, jalapeños, guacamole, quesillo and cheddar.",
    category: "Menú fijo", price: 19000, emoji: "meal", tone: "gold", allergens: ["Lácteos"], possibleAllergens: ["Gluten", "Soya"],
    optionGroups: [
      { id: "group_p10_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
        { id: "opt_p10_child", name: "Niño", nameEn: "Child" },
        { id: "opt_p10_adult", name: "Adulto", nameEn: "Adult", priceDeltaCents: 3000 },
      ] },
      { id: "group_p10_meat", name: "Elige la carne o preparación", nameEn: "Choose meat or preparation", required: true, options: [
        { id: "opt_p10_chicken", name: "Pollo", nameEn: "Chicken" },
        { id: "opt_p10_pastor", name: "Pastor", nameEn: "Al pastor" },
        { id: "opt_p10_vegetarian", name: "Vegetariano", nameEn: "Vegetarian" },
      ] },
    ],
  },
  {
    id: "dish_day_mon", name: "Milanesa", nameEn: "Milanesa", badge: "Lunes", menuWeekday: 1,
    description: "Cuadritos de milanesa con arroz, brócoli con queso mozzarella y fruta mixta.",
    descriptionEn: "Milanesa bites with rice, broccoli, mozzarella and mixed fruit.",
    category: "Menú del día", price: 19800, emoji: "meal", tone: "avocado", allergens: ["Lácteos"], possibleAllergens: ["Gluten", "Huevo", "Soya"],
    optionGroups: [{ id: "group_day_mon_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
      { id: "opt_day_mon_child", name: "Niño", nameEn: "Child" },
      { id: "opt_day_mon_adult", name: "Adulto", nameEn: "Adult", priceDeltaCents: 2200 },
    ] }],
  },
  {
    id: "dish_day_tue", name: "Farfalle con pollo", nameEn: "Chicken farfalle", badge: "Martes", menuWeekday: 2,
    description: "Pollo asado en cubitos con pasta farfalle en salsa, queso parmesano, maíz y postre de manzana con mantequilla de maní.",
    descriptionEn: "Grilled chicken with farfalle pasta, Parmesan, corn and an apple with peanut butter dessert.",
    category: "Menú del día", price: 19000, emoji: "meal", tone: "sunset", allergens: ["Gluten", "Lácteos", "Maní"], possibleAllergens: ["Huevo", "Soya"],
    optionGroups: [{ id: "group_day_tue_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
      { id: "opt_day_tue_child", name: "Niño", nameEn: "Child" },
      { id: "opt_day_tue_adult", name: "Adulto", nameEn: "Adult", priceDeltaCents: 3000 },
    ] }],
  },
  {
    id: "dish_day_thu", name: "Lomo de cerdo a la plancha", nameEn: "Grilled pork loin", badge: "Jueves", menuWeekday: 4,
    description: "Lomo de cerdo con papitas cambray salteadas, ketchup, aguacate, pepino y galleta.",
    descriptionEn: "Grilled pork loin with sautéed baby potatoes, ketchup, avocado, cucumber and a cookie.",
    category: "Menú del día", price: 19500, emoji: "meal", tone: "berry", possibleAllergens: ["Gluten", "Huevo", "Lácteos", "Soya"],
    optionGroups: [{ id: "group_day_thu_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
      { id: "opt_day_thu_child", name: "Niño", nameEn: "Child" },
      { id: "opt_day_thu_adult", name: "Adulto", nameEn: "Adult", priceDeltaCents: 3000 },
    ] }],
  },
  {
    id: "dish_day_fri", name: "Tacos mexicanos", nameEn: "Mexican tacos", badge: "Viernes", menuWeekday: 5,
    description: "Tres tacos con carne a elección, chismol y postre de gelatina.",
    descriptionEn: "Three tacos with your choice of meat, chismol and gelatin for dessert.",
    category: "Menú del día", price: 19800, emoji: "meal", tone: "terracotta", possibleAllergens: ["Gluten", "Lácteos", "Soya"],
    optionGroups: [
      { id: "group_day_fri_size", name: "Elige el tamaño", nameEn: "Choose a size", required: true, options: [
        { id: "opt_day_fri_child", name: "Niño", nameEn: "Child" },
        { id: "opt_day_fri_adult", name: "Adulto", nameEn: "Adult", priceDeltaCents: 2700 },
      ] },
      { id: "group_day_fri_meat", name: "Elige la carne", nameEn: "Choose the meat", required: true, options: [
        { id: "opt_day_fri_pastor", name: "Pastor", nameEn: "Al pastor" },
        { id: "opt_day_fri_chicken", name: "Pollo", nameEn: "Chicken" },
        { id: "opt_day_fri_beef", name: "Res", nameEn: "Beef" },
      ] },
    ],
  },
];

export const initialKdsOrders: KdsOrder[] = [];

export const APP_TIME_ZONE = "America/Tegucigalpa";

export function formatDateId(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function getServiceDates(now: Date): ServiceDate[] {
  const result: ServiceDate[] = [];

  for (let offset = 1; result.length < 5 && offset < 14; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 86_400_000);
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIME_ZONE,
      weekday: "short",
    }).format(candidate);
    if (weekday === "Wed" || weekday === "Sat" || weekday === "Sun") continue;

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

export function formatLongDate(date: Date, language: Language): string {
  const locale = language === "es" ? "es-HN" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date).toLocaleUpperCase(locale);
}

export function formatDateIdLabel(dateId: string, language: Language): string {
  const date = new Date(`${dateId}T12:00:00Z`);
  return new Intl.DateTimeFormat(language === "es" ? "es-HN" : "en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export const money = new Intl.NumberFormat("es-HN", {
  style: "currency",
  currency: "HNL",
  minimumFractionDigits: 2,
});

export function cartItemUnitPrice(dish: Dish, item: CartItem): number {
  const optionDelta = (dish.optionGroups ?? []).reduce((sum, group) => {
    const option = group.options.find((candidate) => candidate.id === item.selections[group.id]);
    return sum + (option?.priceDeltaCents ?? 0);
  }, 0);
  return dish.price + optionDelta;
}

export const ui = {
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
    menu: "Elige tu almuerzo",
    menuHelp: "Preparado fresco cada mañana",
    add: "Agregar",
    cart: "Ver pedido",
    emptyCart: "Agrega un platillo para comenzar",
    confirm: "Confirmar pedido",
    confirmed: "¡Pedido confirmado!",
    confirmedHelp: "Lo prepararemos y entregaremos directamente en su aula.",
    done: "Listo",
    install: "Instalar app",
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
    menu: "Choose your lunch",
    menuHelp: "Prepared fresh every morning",
    add: "Add",
    cart: "View order",
    emptyCart: "Add a meal to get started",
    confirm: "Confirm order",
    confirmed: "Order confirmed!",
    confirmedHelp: "We’ll prepare it and deliver it directly to the classroom.",
    done: "Done",
    install: "Install app",
  },
};
