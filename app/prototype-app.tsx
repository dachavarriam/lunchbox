"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";

type Surface = "family" | "admin" | "kitchen";
type Language = "es" | "en";
type Category = "Todos" | "Menú fijo" | "Menú del día";
type ServiceType = "breakfast" | "lunch";
type PaymentMethod = "bank_transfer" | "card";
type KdsStage = "Nuevas" | "Preparando" | "Listas" | "Empacadas";
type FamilyDataState = "loading" | "demo" | "live" | "error";
type PushState = "loading" | "available" | "active" | "denied" | "unsupported" | "unconfigured";

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

type OptionGroup = {
  id: string;
  name: string;
  nameEn: string;
  required?: boolean;
  options: Array<{ id: string; name: string; nameEn: string; priceDeltaCents?: number }>;
};

type CartItem = {
  key: string;
  studentId: string;
  dishId: string;
  quantity: number;
  selections: Record<string, string>;
  notes: string;
};

type Student = {
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

type KdsOrder = {
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

type DemoOrder = {
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

type CreatedOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: PaymentMethod;
  totalCents: number;
  orderIds?: string[];
  expiresAt?: string;
};

type BankTransferConfig = {
  id: string;
  label: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  accountType: string;
};

type Availability = {
  open: boolean;
  status: string;
  deliveryTime: string;
  cutoffTime: string;
  messageEs: string | null;
  messageEn: string | null;
};

type PaymentIssue = { id: string; checkout_number: string; expected_cents: number; received_cents: number; difference_cents: number; status: string };
type AppNotification = { id: string; order_id: string | null; template_key: string; status: string; created_at: string };
type AuthenticatedUser = { id: string; email: string; display_name: string; locale: string };
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
};

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isClientRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - value.length % 4) % 4);
  const binary = window.atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

type IconName = "meal" | "bank" | "card" | "clock" | "alert" | "check" | "calendar" | "bag" | "help" | "user" | "home" | "orders" | "logout";

function PipiroIcon({ name, size = 22 }: { name: IconName; size?: number }) {
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

const ORDER_DRAFT_KEY = "pipiro:order-draft:v1";

type SavedOrderDraft = {
  version: 1;
  requestKey: string;
  studentId: string;
  serviceType: ServiceType;
  serviceDate: string;
  orderNotes: string;
  paymentMethod: PaymentMethod;
  cart: CartItem[];
};

function createClientKey(prefix = "key"): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return `${prefix}_${cryptoApi.randomUUID()}`;
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

function parseSavedOrderDraft(raw: string): SavedOrderDraft | null {
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

function clientSlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-HN")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

const students: Student[] = [
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

const dishes: Dish[] = [
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

const initialKdsOrders: KdsOrder[] = [];

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

function cartItemUnitPrice(dish: Dish, item: CartItem): number {
  const optionDelta = (dish.optionGroups ?? []).reduce((sum, group) => {
    const option = group.options.find((candidate) => candidate.id === item.selections[group.id]);
    return sum + (option?.priceDeltaCents ?? 0);
  }, 0);
  return dish.price + optionDelta;
}

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
    showToast(unread.length ? `${unread.length} actualización${unread.length === 1 ? "" : "es"} de pedidos y pagos` : "No tienes notificaciones nuevas");
    if (unread.length) {
      await fetch("/api/demo/notifications/read-all", { method: "POST" });
      setNotifications((current) => current.map((item) => ({ ...item, status: "read" })));
    }
  };

  const logout = async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) { showToast("No se pudo cerrar la sesión"); return; }
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
      {supportOpen && <SupportDialog orders={demoOrders} close={() => setSupportOpen(false)} saved={async () => { setSupportOpen(false); await refreshDemoOrders(); showToast("Tu mensaje fue enviado"); }} />}
      {adminDish && (
        <AdminDishDialog
          dish={adminDish === "new" ? null : adminDish}
          close={() => setAdminDish(null)}
          saved={async () => {
            setAdminDish(null);
            await refreshDemoOrders();
            showToast("Catálogo actualizado");
          }}
        />
      )}
      {surface === "admin" && (
        <AdminView
          showToast={showToast}
          todayLabel={todayLabel}
          orders={demoOrders}
          refreshOrders={refreshDemoOrders}
          dishes={catalogDishes}
          editDish={setAdminDish}
          adminName={authenticatedUser?.display_name ?? "Administrador"}
        />
      )}
      {surface === "kitchen" && (
        <KitchenView orders={kdsOrders} advanceOrder={advanceOrder} queuePrint={queuePrint} deliverAllPacked={deliverAllPacked} showToast={showToast} />
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

function AdminView({
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
      const received = status === "amount_mismatch" ? window.prompt("Monto recibido en lempiras") : null;
      if (status === "amount_mismatch" && (received === null || !Number.isFinite(Number(received)))) return;
      const response = await fetch(`/api/demo/admin/payment-batches/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(received !== null ? { receivedCents: Math.round(Number(received) * 100) } : {}) }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo conciliar la transferencia");
      await refreshOrders();
      showToast(status === "approved" ? "Transferencia aprobada; orden enviada a cocina" : "Transferencia rechazada");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo conciliar la transferencia");
    } finally {
      setReviewingOrderId(null);
    }
  };

  const pendingTransfers = [...new Map(orders.filter((order) => order.payment_batch_id && ["pending", "under_review", "amount_mismatch"].includes(order.payment_status))
    .map((order) => [order.payment_batch_id, order])).values()];
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
        <SupportAdminPanel />
        <StaffAccessPanel showToast={showToast} />
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
            {pendingTransfers.map((order) => (
              <article className="transfer-row" key={order.id}>
                <div>
                  <strong>{order.checkout_number ?? order.order_number}</strong>
                  <span>Pago familiar · {order.service_date} · incluye órdenes separadas por estudiante</span>
                  <small>{order.dish}</small>
                  <small>{order.receipt_object_key ? `Comprobante: ${order.receipt_original_name ?? "imagen recibida"}` : "Esperando comprobante del cliente"}</small>
                </div>
                <b>{money.format(orders.filter((candidate) => candidate.payment_batch_id === order.payment_batch_id).reduce((sum, candidate) => sum + candidate.total_cents, 0) / 100)}</b>
                <div className="transfer-actions">
                  {order.receipt_object_key && <a href={`/api/demo/admin/payments/${order.payment_batch_id}/receipt`} target="_blank" rel="noreferrer">Ver comprobante</a>}
                  <button className="reject-transfer" disabled={reviewingOrderId === order.payment_batch_id} onClick={() => void reviewTransfer(order.payment_batch_id!, "rejected")}>Rechazar</button>
                  <button disabled={reviewingOrderId === order.payment_batch_id || !order.receipt_object_key} onClick={() => void reviewTransfer(order.payment_batch_id!, "amount_mismatch")}>Monto incorrecto</button>
                  <button disabled={reviewingOrderId === order.payment_batch_id || !order.receipt_object_key} onClick={() => void reviewTransfer(order.payment_batch_id!, "approved")}>Aprobar</button>
                </div>
              </article>
            ))}
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
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar");
      await load(); setValues(blank); showToast("Cuenta bancaria guardada");
    } catch (cause) { showToast(cause instanceof Error ? cause.message : "No se pudo guardar"); } finally { setBusy(false); }
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
      if (!response.ok) throw new Error(payload.error ?? "No se pudo crear la invitación");
      setDisplayName(""); setEmail(""); await loadStaff(); showToast("Acceso creado; se activará al ingresar con ese correo");
    } catch (cause) { showToast(cause instanceof Error ? cause.message : "No se pudo crear la invitación"); } finally { setBusy(false); }
  };
  return <section className="panel staff-access-panel wide-panel"><div className="panel-title"><div><span className="panel-icon"><PipiroIcon name="user" /></span><div><h2>Accesos del personal</h2><p>Solo las personas que invites reciben rol de Administración, Cocina o Entrega</p></div></div><span className="safe-chip">{staff.length} autorizados</span></div><div className="staff-list">{staff.map((person) => <article key={person.id}><div><strong>{person.display_name}</strong><span>{person.email}</span></div><em>{person.roles.split(",").join(" · ")}</em><small>{person.status === "active" ? "Activo" : "Invitado"}</small></article>)}</div><div className="admin-inline-form staff-invite-form"><label><span>Nombre</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label><span>Correo autorizado</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span>Rol</span><select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="kitchen">Cocina</option><option value="delivery">Entrega</option><option value="admin">Administrador</option></select></label><button disabled={busy || displayName.trim().length < 2 || !email.includes("@")} onClick={() => void invite()}>{busy ? "Creando…" : "Crear invitación"}</button></div><p className="panel-footnote">El acceso por PIN para dispositivos compartidos de cocina se configurará cuando definamos el equipo; no usaremos un PIN global compartido.</p></section>;
}

function SupportAdminPanel() {
  const [requests, setRequests] = useState<Array<{ id: string; category: string; subject: string; message: string; status: string; display_name: string; order_number: string | null }>>([]);
  useEffect(() => { void fetch("/api/demo/admin/support").then((response) => response.ok ? response.json() as Promise<{ requests: typeof requests }> : null).then((payload) => payload && setRequests(payload.requests)).catch(() => undefined); }, []);
  return <section className="panel support-admin-panel"><div className="panel-title"><div><span className="panel-icon"><PipiroIcon name="help" /></span><div><h2>Mensajes de clientes</h2><p>Comentarios, quejas y solicitudes</p></div></div><span className="safe-chip">{requests.filter((item) => item.status === "open").length} abiertos</span></div><div className="support-admin-list">{requests.slice(0, 6).map((item) => <article key={item.id}><div><strong>{item.subject}</strong><span>{item.display_name}{item.order_number ? ` · ${item.order_number}` : ""}</span></div><p>{item.message}</p><em>{item.category}</em></article>)}{!requests.length && <div className="empty-transfer">No hay mensajes pendientes.</div>}</div></section>;
}

function MetricCard({ icon, value, label, detail, tone }: { icon: string; value: string; label: string; detail: string; tone: string }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span className="metric-icon">{icon}</span>
      <div><strong>{value}</strong><h3>{label}</h3><p>{detail}</p></div>
    </article>
  );
}

function KitchenView({ orders, advanceOrder, queuePrint, deliverAllPacked, showToast }: {
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
          ? <div className="bank-choice"><label><span>Banco para la transferencia</span><select value={selectedBankAccountId} onChange={(event) => setSelectedBankAccountId(event.target.value)}>{bankAccounts.map((account) => <option value={account.id} key={account.id}>{account.label} · {account.accountType}</option>)}</select></label><p>Al crear el pedido verás los datos completos y podrás subir un solo comprobante. Cocina lo recibirá después de que Administración lo apruebe.</p></div>
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
        <p>Realiza la transferencia y envía el comprobante para que Administración pueda aprobarlo.</p>
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

type EditableOption = { key: string; nameEs: string; nameEn: string; priceHnl: string };
type EditableGroup = { key: string; nameEs: string; nameEn: string; required: boolean; options: EditableOption[] };

function AdminDishDialog({ dish, close, saved }: { dish: Dish | null; close: () => void; saved: () => Promise<void> }) {
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

function SupportDialog({ orders, close, saved }: { orders: DemoOrder[]; close: () => void; saved: () => Promise<void> }) {
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
  return <div className="modal-backdrop profile-backdrop" role="presentation" onMouseDown={close}><section className="profile-dialog support-dialog" role="dialog" aria-modal="true" aria-labelledby="support-title" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">AYUDA PIPIRO</p><h2 id="support-title">¿Cómo podemos ayudarte?</h2></div><button className="close-button" onClick={close} aria-label="Cerrar">×</button></header><div className="profile-form-grid"><label><span>Tipo</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="request">Solicitud</option><option value="comment">Comentario</option><option value="complaint">Queja</option><option value="payment">Pago</option><option value="other">Otro</option></select></label><label><span>Pedido relacionado (opcional)</span><select value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">Ninguno</option>{orders.map((order) => <option value={order.id} key={order.id}>{order.order_number} · {order.student_name}</option>)}</select></label><label className="full-field"><span>Asunto</span><input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} /></label><label className="full-field"><span>Mensaje</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} placeholder="Cuéntanos qué ocurrió o qué necesitas" /></label></div>{error && <p className="form-error">{error}</p>}<footer><button className="confirm-button" disabled={busy || subject.trim().length < 3 || message.trim().length < 10} onClick={() => void submit()}>{busy ? "Enviando…" : "Enviar mensaje"}</button></footer></section></div>;
}
