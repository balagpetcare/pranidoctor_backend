import type { VaccineMedicineConflict } from '../ai-prescription.types.js';
import {
  buildMedicineCitation,
  isAntimicrobialClass,
  parseMedicineStructured,
  type PublishedMedicineEntry,
} from './medicine-metadata.util.js';

export async function evaluateVaccineMedicineConflicts(params: {
  medicineEntries: PublishedMedicineEntry[];
  vaccineSlugs: string[];
}): Promise<VaccineMedicineConflict[]> {
  const conflicts: VaccineMedicineConflict[] = [];
  if (params.vaccineSlugs.length === 0) return conflicts;

  for (const med of params.medicineEntries) {
    const structured = parseMedicineStructured(med.metadataJson);
    const medCitation = buildMedicineCitation(med);

    for (const rule of structured.vaccineInteractions ?? []) {
      if (!rule.vaccineSlug) continue;
      conflicts.push({
        medicineSlug: med.slug,
        vaccineSlug: rule.vaccineSlug,
        conflictType: (rule.conflictType as VaccineMedicineConflict['conflictType']) ?? 'TIMING_WINDOW',
        severity: rule.severity === 'SEVERE' ? 'SEVERE' : 'MODERATE',
        recommendedWindowBn: rule.windowBn ?? 'টিকা ও ওষুধের মধ্যে সময়ব্যবধান পশুচিকিত্সক নিশ্চিত করুন',
        recommendedWindowEn: rule.windowEn ?? 'Confirm timing window with a veterinarian',
        citations: [medCitation],
      });
    }

    if (isAntimicrobialClass(structured.drugClass, structured.antimicrobialClass)) {
      for (const vacSlug of params.vaccineSlugs) {
        const key = `${med.slug}::${vacSlug}`;
        if (conflicts.some((c) => `${c.medicineSlug}::${c.vaccineSlug}` === key)) continue;
        conflicts.push({
          medicineSlug: med.slug,
          vaccineSlug: vacSlug,
          conflictType: 'LIVE_VACCINE_ANTIBIOTIC',
          severity: 'SEVERE',
          recommendedWindowBn: 'জীব টিকার আগে/পরে অ্যান্টিবায়োটিক — পশুচিকিত্সকের পরামর্শ নিন',
          recommendedWindowEn: 'Antibiotic timing around live vaccines requires veterinary guidance',
          citations: [medCitation],
        });
      }
    }
  }

  return conflicts;
}
