import type { InteractionBundle, DrugInteraction } from '../ai-prescription.types.js';
import {
  buildMedicineCitation,
  normalizeInteractionSeverity,
  parseMedicineStructured,
  severityToRiskLevel,
  type PublishedMedicineEntry,
} from './medicine-metadata.util.js';

function recommendationForSeverity(
  severity: DrugInteraction['severity'],
): DrugInteraction['recommendationTier'] {
  if (severity === 'CONTRAINDICATED') return 'CONTRAINDICATED';
  if (severity === 'SEVERE') return 'AVOID';
  return 'MONITOR';
}

export function analyzeDrugInteractions(entries: PublishedMedicineEntry[]): InteractionBundle {
  const slugSet = new Set(entries.map((e) => e.slug));
  const pairs: DrugInteraction[] = [];
  const unresolvedPairs: InteractionBundle['unresolvedPairs'] = [];
  const seen = new Set<string>();

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i]!;
      const b = entries[j]!;
      const pairKey = [a.slug, b.slug].sort().join('::');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const interaction = findPairInteraction(a, b, slugSet);
      if (interaction) {
        pairs.push(interaction);
      } else {
        unresolvedPairs.push({ drugA: a.slug, drugB: b.slug, reason: 'NO_EDGE' });
      }
    }
  }

  let overallRisk: InteractionBundle['overallRisk'] = 'LOW';
  for (const pair of pairs) {
    const risk = severityToRiskLevel(pair.severity);
    if (risk === 'CRITICAL') overallRisk = 'CRITICAL';
    else if (risk === 'HIGH' && overallRisk !== 'CRITICAL') overallRisk = 'HIGH';
    else if (risk === 'MODERATE' && overallRisk === 'LOW') overallRisk = 'MODERATE';
  }
  if (entries.length >= 3 && overallRisk === 'LOW' && pairs.length > 0) {
    overallRisk = 'MODERATE';
  }

  return { pairs, unresolvedPairs, overallRisk };
}

function findPairInteraction(
  a: PublishedMedicineEntry,
  b: PublishedMedicineEntry,
  slugSet: Set<string>,
): DrugInteraction | null {
  const structuredA = parseMedicineStructured(a.metadataJson);
  const structuredB = parseMedicineStructured(b.metadataJson);

  const fromA = (structuredA.interactsWith ?? []).find(
    (ix) => ix.targetSlug === b.slug || ix.slug === b.slug,
  );
  if (fromA) {
    const severity = normalizeInteractionSeverity(fromA.severity);
    return {
      drugA: a.slug,
      drugB: b.slug,
      severity,
      ...(fromA.mechanismBn !== undefined ? { mechanismBn: fromA.mechanismBn } : {}),
      ...(fromA.mechanismEn !== undefined ? { mechanismEn: fromA.mechanismEn } : {}),
      recommendationTier: recommendationForSeverity(severity),
      citations: [buildMedicineCitation(a), buildMedicineCitation(b)],
    };
  }

  const fromB = (structuredB.interactsWith ?? []).find(
    (ix) => ix.targetSlug === a.slug || ix.slug === a.slug,
  );
  if (fromB) {
    const severity = normalizeInteractionSeverity(fromB.severity);
    return {
      drugA: a.slug,
      drugB: b.slug,
      severity,
      ...(fromB.mechanismBn !== undefined ? { mechanismBn: fromB.mechanismBn } : {}),
      ...(fromB.mechanismEn !== undefined ? { mechanismEn: fromB.mechanismEn } : {}),
      recommendationTier: recommendationForSeverity(severity),
      citations: [buildMedicineCitation(a), buildMedicineCitation(b)],
    };
  }

  if (!slugSet.has(a.slug) || !slugSet.has(b.slug)) return null;
  return null;
}
