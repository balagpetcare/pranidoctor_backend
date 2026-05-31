/**
 * UVKG Wave 1 — disease knowledge expansion (links only).
 */
import type { WaveLinkStats } from './uvkg-link-writer.js';
import { writeUvkgLink } from './uvkg-link-writer.js';
import { WAVE1_DISEASE_CATALOG } from './data/wave1-disease-catalog.js';

export async function runWave1DiseaseExpansion(): Promise<WaveLinkStats> {
  const stats: WaveLinkStats = { written: 0, skipped: 0, errors: [] };

  for (const disease of WAVE1_DISEASE_CATALOG) {
    for (const symptom of disease.symptoms) {
      await writeUvkgLink(
        {
          edgeType: 'HAS_SYMPTOM',
          edgeClass: 'CLINICAL',
          fromRefType: 'DISEASE',
          fromRefId: disease.slug,
          toRefType: 'SYMPTOM',
          toRefId: symptom,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w1:ds:${disease.slug}:sym:${symptom}`,
          weight: disease.severity === 'CRITICAL' ? 0.9 : 0.7,
          species: disease.species,
          regionScope: disease.regions,
          labelEn: disease.labelEn,
          metadata: { severity: disease.severity, speciesGroup: disease.speciesGroup },
        },
        stats,
      );
    }

    for (const species of disease.species) {
      await writeUvkgLink(
        {
          edgeType: 'PREVALENT_IN',
          edgeClass: 'CLINICAL',
          fromRefType: 'DISEASE',
          fromRefId: disease.slug,
          toRefType: 'SPECIES',
          toRefId: species,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w1:ds:${disease.slug}:sp:${species}`,
          weight: 0.75,
          species: [species],
          regionScope: disease.regions,
        },
        stats,
      );
    }

    for (const risk of disease.riskFactors) {
      await writeUvkgLink(
        {
          edgeType: 'AGGRAVATED_BY',
          edgeClass: 'CLINICAL',
          fromRefType: 'DISEASE',
          fromRefId: disease.slug,
          toRefType: 'RISK_FACTOR',
          toRefId: risk,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w1:ds:${disease.slug}:rk:${risk}`,
          weight: 0.6,
          regionScope: disease.regions,
        },
        stats,
      );
    }

    for (const prev of disease.prevention) {
      await writeUvkgLink(
        {
          edgeType: 'PREVENTS',
          edgeClass: 'CLINICAL',
          fromRefType: 'CONDITION',
          fromRefId: prev,
          toRefType: 'DISEASE',
          toRefId: disease.slug,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w1:ds:${disease.slug}:pr:${prev}`,
          weight: 0.65,
          regionScope: disease.regions,
        },
        stats,
      );
    }

    for (const ref of disease.references) {
      await writeUvkgLink(
        {
          edgeType: 'SUPPORTED_BY',
          edgeClass: 'METADATA',
          fromRefType: 'DISEASE',
          fromRefId: disease.slug,
          toRefType: 'KNOWLEDGE_ENTITY',
          toRefId: ref,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w1:ds:${disease.slug}:ref:${ref}`,
          weight: 0.5,
          regionScope: disease.regions,
        },
        stats,
      );
    }

    for (const region of disease.regions) {
      await writeUvkgLink(
        {
          edgeType: 'PREVALENT_IN',
          edgeClass: 'CLINICAL',
          fromRefType: 'DISEASE',
          fromRefId: disease.slug,
          toRefType: 'REGION',
          toRefId: region,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w1:ds:${disease.slug}:rg:${region}`,
          weight: 0.8,
          regionScope: [region],
        },
        stats,
      );
    }
  }

  return stats;
}
