import type { LivestockSpecies } from '../../../../generated/prisma/index.js';

import type { DrugReferenceCard } from '../ai-prescription.types.js';
import {
  buildMedicineCitation,
  parseMedicineStructured,
  type PublishedMedicineEntry,
} from './medicine-metadata.util.js';

export type SpeciesEligibility = 'ELIGIBLE' | 'OFF_LABEL' | 'UNKNOWN' | 'CONTRAINDICATED';

export function evaluateSpeciesEligibility(
  entry: PublishedMedicineEntry,
  species: LivestockSpecies,
): SpeciesEligibility {
  if (entry.species.length > 0 && !entry.species.includes(species)) {
    return 'OFF_LABEL';
  }

  const structured = parseMedicineStructured(entry.metadataJson);
  const matrix = structured.speciesDoseMatrix ?? [];
  if (matrix.length === 0) {
    return entry.species.includes(species) ? 'ELIGIBLE' : 'UNKNOWN';
  }

  const row = matrix.find((r) => r.species === species || r.species === undefined);
  return row ? 'ELIGIBLE' : 'OFF_LABEL';
}

export function evaluateAgeEligibility(
  entry: PublishedMedicineEntry,
  species: LivestockSpecies,
  ageDays?: number,
): { eligible: boolean; reason?: 'TOO_YOUNG' | 'TOO_OLD' | 'NO_ROW' } {
  const structured = parseMedicineStructured(entry.metadataJson);
  const matrix = (structured.speciesDoseMatrix ?? []).filter(
    (r) => !r.species || r.species === species,
  );
  if (matrix.length === 0) return { eligible: true };
  if (ageDays === undefined) return { eligible: false, reason: 'NO_ROW' };

  const match = matrix.find((row) => {
    const minOk = row.ageMinDays === undefined || ageDays >= row.ageMinDays;
    const maxOk = row.ageMaxDays === undefined || ageDays <= row.ageMaxDays;
    return minOk && maxOk;
  });

  if (!match) {
    const tooYoung = matrix.some((r) => r.ageMinDays !== undefined && ageDays < r.ageMinDays);
    return { eligible: false, reason: tooYoung ? 'TOO_YOUNG' : 'TOO_OLD' };
  }
  return { eligible: true };
}

export function buildDrugReferenceCard(
  entry: PublishedMedicineEntry,
): DrugReferenceCard {
  const structured = parseMedicineStructured(entry.metadataJson);
  return {
    slug: entry.slug,
    genericName: structured.genericName ?? entry.titleEn,
    ...(structured.drugClass !== undefined ? { drugClass: structured.drugClass } : {}),
    brandNamesBd: structured.brandNamesBd ?? [],
    prescriptionRequired: structured.prescriptionRequired ?? true,
    routes: structured.routes ?? [],
    species: entry.species,
    summaryBn: entry.bodyBn.slice(0, 400),
    summaryEn: entry.bodyEn.slice(0, 400),
    citations: [buildMedicineCitation(entry)],
  };
}
