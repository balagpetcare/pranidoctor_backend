import { evaluateVaccineMedicineConflicts } from '../../ai-prescription/engines/vaccine-interaction.engine.js';
import { loadMedicineBySlugs } from '../../ai-prescription/engines/medicine-lookup.engine.js';

import type { VaccineInteractionReport } from '../ai-vaccine.types.js';
import {
  buildVaccineCitation,
  parseVaccineStructured,
  type PublishedVaccineEntry,
} from './vaccine-metadata.util.js';

function overallRiskFromConflicts(
  vaccineSevere: boolean,
  medicineSevere: boolean,
  vaccineCount: number,
): VaccineInteractionReport['overallRisk'] {
  if (vaccineSevere || medicineSevere) return 'CRITICAL';
  if (vaccineCount > 0) return 'HIGH';
  return 'LOW';
}

export async function evaluateVaccineInteractions(params: {
  vaccineEntries: PublishedVaccineEntry[];
  vaccineSlugs: string[];
  medicineSlugs: string[];
}): Promise<VaccineInteractionReport> {
  const vaccineConflicts: VaccineInteractionReport['vaccineConflicts'] = [];

  for (let i = 0; i < params.vaccineEntries.length; i++) {
    for (let j = i + 1; j < params.vaccineEntries.length; j++) {
      const a = params.vaccineEntries[i]!;
      const b = params.vaccineEntries[j]!;
      const structA = parseVaccineStructured(a.metadataJson);
      const structB = parseVaccineStructured(b.metadataJson);
      for (const rule of structA.vaccineIntervals ?? []) {
        if (rule.targetSlug === b.slug && rule.minDaysBetween) {
          vaccineConflicts.push({
            vaccineA: a.slug,
            vaccineB: b.slug,
            minDaysBetween: rule.minDaysBetween,
            severity: rule.severity === 'SEVERE' ? 'SEVERE' : 'MODERATE',
            noteBn: rule.noteBn ?? 'দুই টিকার মধ্যে সময়ব্যবধান পশুচিকিৎসক নিশ্চিত করুন',
            noteEn: rule.noteEn ?? 'Confirm interval between vaccines with a veterinarian',
            citations: [buildVaccineCitation(a), buildVaccineCitation(b)],
          });
        }
      }
      if (
        structA.antigen &&
        structB.antigen &&
        structA.antigen !== structB.antigen &&
        (a.slug.includes('live') || b.slug.includes('live'))
      ) {
        const key = `${a.slug}::${b.slug}`;
        if (!vaccineConflicts.some((c) => `${c.vaccineA}::${c.vaccineB}` === key)) {
          vaccineConflicts.push({
            vaccineA: a.slug,
            vaccineB: b.slug,
            minDaysBetween: 14,
            severity: 'MODERATE',
            noteBn: 'একই সময়ে একাধিক জীব টিকা — ভেটের পরামর্শ নিন',
            noteEn: 'Multiple live vaccines — seek veterinary guidance',
            citations: [buildVaccineCitation(a), buildVaccineCitation(b)],
          });
        }
      }
    }
  }

  const medicineEntries = await loadMedicineBySlugs(params.medicineSlugs);
  const medicineConflictsRaw = await evaluateVaccineMedicineConflicts({
    medicineEntries,
    vaccineSlugs: params.vaccineSlugs,
  });

  const medicineConflicts = medicineConflictsRaw.map((c) => ({
    medicineSlug: c.medicineSlug,
    vaccineSlug: c.vaccineSlug,
    conflictType: c.conflictType,
    severity: c.severity,
    recommendedWindowBn: c.recommendedWindowBn,
    recommendedWindowEn: c.recommendedWindowEn,
    citations: c.citations,
  }));

  const vaccineSevere = vaccineConflicts.some((c) => c.severity === 'SEVERE');
  const medicineSevere = medicineConflicts.some((c) => c.severity === 'SEVERE');

  return {
    vaccineConflicts,
    medicineConflicts,
    overallRisk: overallRiskFromConflicts(
      vaccineSevere,
      medicineSevere,
      vaccineConflicts.length + medicineConflicts.length,
    ),
  };
}
