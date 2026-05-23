/**
 * Deterministic helpers for USER_APP_TEST_SEED_V1 (no location rows created).
 */
import { createHash } from "node:crypto";

export const USER_APP_SEED_VERSION = "v1";
export const USER_APP_SEED_TAG = "user_app_seed_v1";
export const USER_APP_SEED_EMAIL_DOMAIN = "userapp.seed.pranidoctor.test";
export const USER_APP_SEED_ID_PREFIX = `uaseed-${USER_APP_SEED_VERSION}`;

export type SeedScale = "small" | "medium" | "large";

const SCALE_MULTIPLIER: Record<SeedScale, number> = {
  small: 0.2,
  medium: 1,
  large: 1.5,
};

export type SeedCounts = {
  customers: number;
  doctors: number;
  admins: number;
  animals: number;
  farms: number;
  appointments: number;
  prescriptions: number;
  notifications: number;
  conversations: number;
  messages: number;
  walletCustomers: number;
  mediaFiles: number;
};

const BASE_COUNTS: SeedCounts = {
  customers: 100,
  doctors: 20,
  admins: 10,
  animals: 300,
  farms: 120,
  appointments: 500,
  prescriptions: 250,
  notifications: 1000,
  conversations: 300,
  messages: 5000,
  walletCustomers: 80,
  mediaFiles: 150,
};

export function parseSeedScale(argv: string[]): SeedScale {
  if (argv.includes("--small")) return "small";
  if (argv.includes("--large")) return "large";
  return "medium";
}

export function scaleCounts(scale: SeedScale): SeedCounts {
  const m = SCALE_MULTIPLIER[scale];
  const scaled = {} as SeedCounts;
  for (const [key, value] of Object.entries(BASE_COUNTS) as [keyof SeedCounts, number][]) {
    scaled[key] = Math.max(1, Math.round(value * m));
  }
  if (scale === "small") {
    scaled.messages = Math.max(50, scaled.messages);
    scaled.notifications = Math.max(20, scaled.notifications);
  }
  return scaled;
}

/** Mulberry32 — deterministic PRNG from integer seed. */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts: string[]): number {
  const hex = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 8);
  return Number.parseInt(hex, 16);
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function pickWeighted<T>(rng: () => number, items: readonly { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1]!.value;
}

export function padNum(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function stableId(kind: string, index: number, width = 4): string {
  return `${USER_APP_SEED_ID_PREFIX}-${kind}-${padNum(index, width)}`;
}

export function customerEmail(index: number): string {
  return `customer-${padNum(index, 3)}@${USER_APP_SEED_EMAIL_DOMAIN}`;
}

export function doctorEmail(index: number): string {
  return `doctor-${padNum(index, 3)}@${USER_APP_SEED_EMAIL_DOMAIN}`;
}

export function adminEmail(index: number): string {
  return `admin-${padNum(index, 3)}@${USER_APP_SEED_EMAIL_DOMAIN}`;
}

export function customerPhone(index: number): string {
  return `017${padNum(1000000 + index, 7)}`;
}

export function doctorPhone(index: number): string {
  return `018${padNum(2000000 + index, 7)}`;
}

export function logStep(section: string, message: string): void {
  console.info(`[seed:user][${section}] ${message}`);
}

export function logSkip(section: string, label: string, n = 1): void {
  if (n === 1) {
    console.info(`[seed:user][${section}] skip existing: ${label}`);
    return;
  }
  console.info(`[seed:user][${section}] skip existing: ${label} (${n})`);
}

export function logProgress(section: string, done: number, total: number): void {
  if (done === total || done % Math.max(1, Math.floor(total / 10)) === 0) {
    console.info(`[seed:user][${section}] progress ${done}/${total}`);
  }
}

const BN_FIRST = ["রহিম", "করিম", "সালমা", "ফাতেমা", "জামাল", "নাসির", "পারভীন", "মোহাম্মদ"];
const BN_LAST = ["আহমেদ", "হাসান", "বেগম", "উদ্দিন", "ইসলাম", "হোসেন", "আলী"];
const EN_FIRST = ["Rahim", "Salma", "Jamal", "Nasir", "Parvin", "Karim"];
const EN_LAST = ["Ahmed", "Hassan", "Begum", "Islam", "Hossain"];

const ANIMAL_NAMES: Record<string, string[]> = {
  CATTLE: ["লালী", "গোবর", "ময়ূর", "বেলা"],
  GOAT: ["ছোট্টু", "কালু", "সাদা"],
  POULTRY: ["মুরগি-১", "হাঁস-২"],
  DOG: ["রক্সি", "বিল্লু"],
  CAT: ["মিউ", "পুচু"],
};

const MEDICINES = [
  "Oxytetracycline",
  "Ivermectin",
  "Meloxicam",
  "Albendazole",
  "Multivitamin injection",
  "ORS powder",
  "Antibiotic spray",
];

export function displayName(rng: () => number, index: number): string {
  const useBn = rng() > 0.35;
  if (useBn) {
    return `${pick(rng, BN_FIRST)} ${pick(rng, BN_LAST)} ${padNum(index, 3)}`;
  }
  return `${pick(rng, EN_FIRST)} ${pick(rng, EN_LAST)}`;
}

export function animalName(rng: () => number, animalType: string): string {
  const pool = ANIMAL_NAMES[animalType] ?? ["পশু"];
  return pick(rng, pool);
}

export function placeholderAvatarUrl(seedKey: string): string {
  return `https://placehold.co/128x128/e8f5e9/2e7d32?text=${encodeURIComponent(seedKey.slice(-8))}`;
}

export function placeholderAnimalPhotoUrl(animalId: string): string {
  return `/api/mobile/uploads/${animalId}-photo-ref`;
}

export function placeholderFarmCoverUrl(farmId: string): string {
  return `/api/mobile/uploads/${farmId}-cover-ref`;
}

export function pickMedicines(rng: () => number, count: number): string[] {
  const out = new Set<string>();
  while (out.size < count) {
    out.add(pick(rng, MEDICINES));
  }
  return [...out];
}

export function daysAgo(rng: () => number, maxDays: number): Date {
  const days = Math.floor(rng() * maxDays);
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(8 + Math.floor(rng() * 10), Math.floor(rng() * 60), 0, 0);
  return d;
}

export function dateOfBirthFromAgeYears(rng: () => number, ageYears: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - ageYears);
  d.setMonth(Math.floor(rng() * 12));
  d.setDate(1 + Math.floor(rng() * 28));
  return d;
}
