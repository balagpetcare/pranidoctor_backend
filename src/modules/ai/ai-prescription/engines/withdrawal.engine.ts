import type { LivestockSpecies } from '../../../../generated/prisma/index.js';

import type { WithdrawalSummary, WithdrawalPeriod } from '../ai-prescription.types.js';
import {
  buildMedicineCitation,
  parseMedicineStructured,
  type PublishedMedicineEntry,
} from './medicine-metadata.util.js';

export function resolveWithdrawalForDrug(
  entry: PublishedMedicineEntry,
  species: LivestockSpecies,
): WithdrawalSummary {
  const structured = parseMedicineStructured(entry.metadataJson);
  const citation = buildMedicineCitation(entry);
  const periods: WithdrawalPeriod[] = [];

  const matrixRows = (structured.speciesDoseMatrix ?? []).filter(
    (r) => !r.species || r.species === species,
  );

  for (const row of matrixRows) {
    if (typeof row.withdrawalMeatDays === 'number') {
      periods.push({
        productType: 'MEAT',
        withdrawalDays: row.withdrawalMeatDays,
        citations: [citation],
      });
    }
    if (typeof row.withdrawalMilkDays === 'number') {
      periods.push({
        productType: 'MILK',
        withdrawalDays: row.withdrawalMilkDays,
        citations: [citation],
      });
    }
    if (typeof row.withdrawalDays === 'number') {
      periods.push({
        productType: 'MEAT',
        withdrawalDays: row.withdrawalDays,
        citations: [citation],
      });
    }
  }

  if (typeof structured.withdrawalMeatDays === 'number') {
    periods.push({ productType: 'MEAT', withdrawalDays: structured.withdrawalMeatDays, citations: [citation] });
  }
  if (typeof structured.withdrawalMilkDays === 'number') {
    periods.push({ productType: 'MILK', withdrawalDays: structured.withdrawalMilkDays, citations: [citation] });
  }
  if (typeof structured.withdrawalDays === 'number') {
    periods.push({ productType: 'MEAT', withdrawalDays: structured.withdrawalDays, citations: [citation] });
  }

  const deduped = dedupePeriods(periods);

  return {
    drugSlug: entry.slug,
    species,
    periods: deduped,
    confidenceScore: entry.confidenceScore,
  };
}

function dedupePeriods(periods: WithdrawalPeriod[]): WithdrawalPeriod[] {
  const map = new Map<string, WithdrawalPeriod>();
  for (const p of periods) {
    const key = p.productType;
    const existing = map.get(key);
    if (!existing || p.withdrawalDays > existing.withdrawalDays) {
      map.set(key, p);
    }
  }
  return [...map.values()];
}

export function resolveWithdrawalSummaries(
  entries: PublishedMedicineEntry[],
  species: LivestockSpecies,
): WithdrawalSummary[] {
  return entries.map((entry) => resolveWithdrawalForDrug(entry, species));
}
