/**
 * Deterministic faker utilities for USER_SCOPED_TEST_DATA_GENERATOR_V1.
 */
import { createHash } from "node:crypto";

import type { Prisma } from "../../../generated/prisma/client.js";

export const USER_SCOPED_SEED_VERSION = "v1";
export const USER_SCOPED_SEED_TAG = "user_scoped_seed_v1";

export type UserSeedCounts = {
  animals: number;
  appointments: number;
  notifications: number;
  conversations: number;
  messages: number;
  prescriptions: number;
  walletTransactions: number;
  mediaFiles: number;
};

export type SeedResult = {
  created: number;
  skipped: number;
};

export type UserSeedContext = {
  userId: string;
  customerProfileId: string;
  idPrefix: string;
  counts: UserSeedCounts;
  serviceCategoryId: string;
  emergencyCategoryId: string;
  doctorProfileIds: string[];
  animalIds: string[];
  serviceRequestIds: string[];
  dryRun: boolean;
};

export type SeedTx = Prisma.TransactionClient;

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

export const MEDICINES = [
  "Oxytetracycline",
  "Ivermectin",
  "Meloxicam",
  "Albendazole",
  "Multivitamin injection",
  "ORS powder",
  "Antibiotic spray",
];

export function userSeedIdPrefix(userId: string): string {
  const short = createHash("sha256").update(userId).digest("hex").slice(0, 8);
  return `usseed-${USER_SCOPED_SEED_VERSION}-${short}`;
}

export function resolveUserSeedCounts(countArg?: number): UserSeedCounts {
  if (countArg === undefined) {
    return {
      animals: 20,
      appointments: 15,
      notifications: 50,
      conversations: 10,
      messages: 200,
      prescriptions: 15,
      walletTransactions: 20,
      mediaFiles: 10,
    };
  }

  return {
    animals: countArg,
    appointments: Math.max(1, Math.round(countArg * 0.5)),
    notifications: countArg * 2,
    conversations: Math.max(1, Math.round(countArg * 0.4)),
    messages: countArg * 10,
    prescriptions: Math.max(1, Math.round(countArg * 0.75)),
    walletTransactions: countArg,
    mediaFiles: Math.max(3, Math.round(countArg * 0.5)),
  };
}

export function parseCliArgs(argv: string[]): {
  phone?: string;
  userId?: string;
  count?: number;
  dryRun: boolean;
  clear: boolean;
} {
  let phone: string | undefined;
  let userId: string | undefined;
  let count: number | undefined;
  let dryRun = false;
  let clear = false;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--clear") {
      clear = true;
      continue;
    }
    if (arg.startsWith("--phone=")) {
      phone = arg.slice("--phone=".length).trim();
      continue;
    }
    if (arg.startsWith("--userId=")) {
      userId = arg.slice("--userId=".length).trim();
      continue;
    }
    if (arg.startsWith("--count=")) {
      const n = Number.parseInt(arg.slice("--count=".length), 10);
      if (!Number.isFinite(n) || n < 1) {
        throw new Error(`Invalid --count value: ${arg}`);
      }
      count = n;
    }
  }

  return { phone, userId, count, dryRun, clear };
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

export function pickWeighted<T>(
  rng: () => number,
  items: readonly { value: T; weight: number }[],
): T {
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

export function stableId(prefix: string, kind: string, index: number, width = 4): string {
  return `${prefix}-${kind}-${padNum(index, width)}`;
}

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

export function walletSettingKey(userId: string): string {
  return `${USER_SCOPED_SEED_TAG}.wallet.${userId}`;
}

export function metaSettingKey(userId: string): string {
  return `${USER_SCOPED_SEED_TAG}.meta.${userId}`;
}
