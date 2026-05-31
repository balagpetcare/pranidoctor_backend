import type { LivestockSpecies } from '../../../../generated/prisma/index.js';

import type { ContraindicationWarning, PrescriptionLocale } from '../ai-prescription.types.js';
import {
  buildMedicineCitation,
  parseMedicineStructured,
  type PublishedMedicineEntry,
} from './medicine-metadata.util.js';

function mapContraSeverity(raw?: string): ContraindicationWarning['severity'] {
  const s = (raw ?? 'CAUTION').toUpperCase();
  if (s.includes('ABSOLUTE') || s === 'X') return 'ABSOLUTE';
  if (s.includes('RELATIVE')) return 'RELATIVE';
  return 'CAUTION';
}

export function evaluateContraindications(params: {
  entries: PublishedMedicineEntry[];
  species: LivestockSpecies;
  pregnancy: boolean;
  lactating: boolean;
  locale: PrescriptionLocale;
}): ContraindicationWarning[] {
  const warnings: ContraindicationWarning[] = [];

  for (const entry of params.entries) {
    const structured = parseMedicineStructured(entry.metadataJson);
    const citation = buildMedicineCitation(entry);

    for (const item of structured.contraindications ?? []) {
      if (typeof item === 'string') {
        warnings.push({
          severity: 'RELATIVE',
          condition: item,
          descriptionBn: `${entry.titleBn}: ${item}`,
          descriptionEn: `${entry.titleEn}: ${item}`,
          citations: [citation],
          source: 'structured',
        });
        continue;
      }
      warnings.push({
        severity: mapContraSeverity(item.severity),
        condition: item.condition ?? 'unknown',
        descriptionBn: item.descriptionBn ?? item.condition ?? entry.titleBn,
        descriptionEn: item.descriptionEn ?? item.condition ?? entry.titleEn,
        citations: [citation],
        source: 'structured',
      });
    }

    if (params.pregnancy) {
      warnings.push({
        severity: 'ABSOLUTE',
        condition: 'pregnancy',
        descriptionBn: `${entry.titleBn}: গর্ভাবস্থায় ওষুধ প্রয়োগে পশুচিকিত্সকের পরামর্শ বাধ্যতামূলক`,
        descriptionEn: `${entry.titleEn}: veterinary consultation required during pregnancy`,
        citations: [citation],
        source: 'structured',
      });
    }

    if (params.lactating) {
      warnings.push({
        severity: 'CAUTION',
        condition: 'lactation',
        descriptionBn: `${entry.titleBn}: দুধ উৎপাদনকারী পশুতে ওষুধ প্রয়োগে সতর্কতা`,
        descriptionEn: `${entry.titleEn}: use caution in lactating animals`,
        citations: [citation],
        source: 'structured',
      });
    }
  }

  return warnings;
}
