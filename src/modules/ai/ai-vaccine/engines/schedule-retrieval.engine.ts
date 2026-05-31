import type { LivestockSpecies } from '../../../../generated/prisma/index.js';

import type { ScheduleRow } from '../ai-vaccine.types.js';
import {
  buildVaccineCitation,
  parseVaccineStructured,
  type PublishedVaccineEntry,
} from './vaccine-metadata.util.js';
import { loadVaccineBySlugs, searchVaccines } from './vaccine-lookup.engine.js';

function entryToScheduleRow(entry: PublishedVaccineEntry): ScheduleRow {
  const structured = parseVaccineStructured(entry.metadataJson);
  return {
    slug: entry.slug,
    titleBn: entry.titleBn,
    titleEn: entry.titleEn,
    ...(structured.antigen !== undefined ? { antigen: structured.antigen } : {}),
    ...(structured.ageWindow !== undefined ? { ageWindow: structured.ageWindow } : {}),
    ...(structured.boosterIntervalDays !== undefined
      ? { boosterIntervalDays: structured.boosterIntervalDays }
      : {}),
    ...(structured.route !== undefined ? { route: structured.route } : {}),
    citations: [buildVaccineCitation(entry)],
    confidenceScore: entry.confidenceScore,
  };
}

export async function retrieveSpeciesSchedules(params: {
  species: LivestockSpecies;
  antigen?: string;
}): Promise<ScheduleRow[]> {
  const query = params.antigen
    ? `${params.antigen} vaccination schedule`
    : 'vaccination schedule';
  const matches = await searchVaccines({
    query,
    species: params.species,
    entityType: 'VaccinationSchedule',
    limit: 20,
  });

  const slugs = matches.map((m) => m.slug);
  const entries = await loadVaccineBySlugs(slugs);
  const schedules = entries
    .filter((e) => e.entityType === 'VaccinationSchedule' || e.slug.includes('-schedule'))
    .map(entryToScheduleRow);

  if (schedules.length > 0) return schedules;

  const fallback = await searchVaccines({
    query: 'টিকা সূচি',
    species: params.species,
    limit: 20,
  });
  const fallbackEntries = await loadVaccineBySlugs(fallback.map((m) => m.slug));
  return fallbackEntries
    .filter((e) => e.entityType === 'VaccinationSchedule' || e.slug.includes('-schedule'))
    .map(entryToScheduleRow);
}

export async function retrieveSchedulesBySlugs(slugs: string[]): Promise<ScheduleRow[]> {
  const entries = await loadVaccineBySlugs(slugs);
  return entries.map(entryToScheduleRow);
}
