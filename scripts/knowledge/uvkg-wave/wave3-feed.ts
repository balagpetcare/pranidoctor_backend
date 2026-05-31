import { buildWave3FeedCatalog, buildWave3Formulas } from './data/wave3-feed-catalog.js';
import type { WaveLinkStats } from './uvkg-link-writer.js';
import { writeUvkgLink } from './uvkg-link-writer.js';

export async function runWave3FeedExpansion(): Promise<WaveLinkStats> {
  const stats: WaveLinkStats = { written: 0, skipped: 0, errors: [] };
  const ingredients = buildWave3FeedCatalog();
  const formulas = buildWave3Formulas(80);

  for (const ing of ingredients) {
    for (const nutrient of ing.nutrients) {
      await writeUvkgLink(
        {
          edgeType: 'NUTRIENT_FOR',
          edgeClass: 'CLINICAL',
          fromRefType: 'FEED_INGREDIENT',
          fromRefId: ing.code,
          toRefType: 'NUTRIENT',
          toRefId: nutrient,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w3:fn:${ing.code}:${nutrient}`,
          weight: 0.75,
        },
        stats,
      );
    }

    for (const sp of ing.species) {
      await writeUvkgLink(
        {
          edgeType: 'SAFE_FOR',
          edgeClass: 'CLINICAL',
          fromRefType: 'FEED_INGREDIENT',
          fromRefId: ing.code,
          toRefType: 'SPECIES',
          toRefId: sp,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w3:fs:${ing.code}:${sp}`,
          weight: 0.7,
          species: [sp as never],
        },
        stats,
      );
    }

    for (const disease of ing.toxicDiseases) {
      await writeUvkgLink(
        {
          edgeType: 'TOXIC_TO',
          edgeClass: 'CLINICAL',
          fromRefType: 'FEED_INGREDIENT',
          fromRefId: ing.code,
          toRefType: 'DISEASE',
          toRefId: disease,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w3:tx:${ing.code}:${disease}`,
          weight: 0.9,
        },
        stats,
      );
      await writeUvkgLink(
        {
          edgeType: 'CONTRAINDICATES_FEED',
          edgeClass: 'CLINICAL',
          fromRefType: 'DISEASE',
          fromRefId: disease,
          toRefType: 'FEED_INGREDIENT',
          toRefId: ing.code,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w3:cf:${disease}:${ing.code}`,
          weight: 0.85,
        },
        stats,
      );
    }
  }

  for (const formula of formulas) {
    for (const ingCode of formula.ingredients) {
      await writeUvkgLink(
        {
          edgeType: 'CONTAINS',
          edgeClass: 'METADATA',
          fromRefType: 'FEED_FORMULA',
          fromRefId: formula.code,
          toRefType: 'FEED_INGREDIENT',
          toRefId: ingCode,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w3:fc:${formula.code}:${ingCode}`,
          weight: 1,
        },
        stats,
      );
    }
    for (const sp of formula.species) {
      await writeUvkgLink(
        {
          edgeType: 'SAFE_FOR',
          edgeClass: 'CLINICAL',
          fromRefType: 'FEED_FORMULA',
          fromRefId: formula.code,
          toRefType: 'SPECIES',
          toRefId: sp,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w3:ff:${formula.code}:${sp}`,
          weight: 0.8,
          species: [sp as never],
        },
        stats,
      );
    }
  }

  return stats;
}
