import {
  differenceInMonths,
  differenceInYears,
} from "date-fns";

import type {
  AnimalCategory,
  AnimalType,
  Gender,
  PregnancyStatus,
} from "@/generated/prisma/client";
import type { AnimalProfile } from "@/generated/prisma/client";

/** Display species label derived from `animalType` when storing required DB field `species`. */
export function speciesLabelFromAnimalType(type: AnimalType): string {
  const labels: Record<AnimalType, string> = {
    CATTLE: "Cattle",
    GOAT: "Goat",
    POULTRY: "Poultry",
    DOG: "Dog",
    CAT: "Cat",
    OTHER: "Other",
  };
  return labels[type];
}

export function categoryFromAnimalType(type: AnimalType): AnimalCategory {
  if (type === "DOG" || type === "CAT") return "PET";
  if (type === "CATTLE" || type === "GOAT" || type === "POULTRY") {
    return "LIVESTOCK";
  }
  return "OTHER";
}

export function approximateDobFromAgeYears(ageYears: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - ageYears);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeAgeParts(dob: Date): {
  ageYears: number;
  ageMonths: number;
} {
  const now = new Date();
  return {
    ageYears: differenceInYears(now, dob),
    ageMonths: differenceInMonths(now, dob) % 12,
  };
}

export type AnimalJsonDto = {
  id: string;
  customerId: string;
  name: string;
  species: string;
  category: AnimalCategory;
  animalType: AnimalType | null;
  breed: string | null;
  weightKg: string | null;
  dateOfBirth: string | null;
  ageYears: number | null;
  ageMonths: number | null;
  sex: string | null;
  gender: Gender | null;
  microchipOrTag: string | null;
  notes: string | null;
  photoUrl: string | null;
  pregnancyStatus: PregnancyStatus | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export function toAnimalJsonDto(row: AnimalProfile): AnimalJsonDto {
  const dob = row.dateOfBirth;
  let ageYears: number | null = null;
  let ageMonths: number | null = null;
  if (dob != null) {
    const parts = computeAgeParts(dob);
    ageYears = parts.ageYears;
    ageMonths = parts.ageMonths;
  }

  return {
    id: row.id,
    customerId: row.customerId,
    name: row.name,
    species: row.species,
    category: row.category,
    animalType: row.animalType,
    breed: row.breed ?? null,
    weightKg: row.weightKg != null ? row.weightKg.toString() : null,
    dateOfBirth: dob?.toISOString() ?? null,
    ageYears,
    ageMonths,
    sex: row.sex ?? null,
    gender: row.gender ?? null,
    microchipOrTag: row.microchipOrTag ?? null,
    notes: row.notes ?? null,
    photoUrl: row.photoUrl ?? null,
    pregnancyStatus: row.pregnancyStatus ?? null,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
