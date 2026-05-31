import { buildWave2BrandCatalog, buildWave2MedicineCatalog } from './data/wave2-medicine-catalog.js';
import type { WaveLinkStats } from './uvkg-link-writer.js';
import { writeUvkgLink } from './uvkg-link-writer.js';

export async function runWave2MedicineExpansion(): Promise<WaveLinkStats> {
  const stats: WaveLinkStats = { written: 0, skipped: 0, errors: [] };
  const generics = buildWave2MedicineCatalog();
  const brands = buildWave2BrandCatalog(generics);

  for (const g of generics) {
    for (const diseaseSlug of g.contraindicatedDiseases) {
      await writeUvkgLink(
        {
          edgeType: 'CONTRAINDICATES',
          edgeClass: 'CLINICAL',
          fromRefType: 'DISEASE',
          fromRefId: diseaseSlug,
          toRefType: 'MEDICINE_GENERIC',
          toRefId: g.genericCode,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w2:ci:${g.genericCode}:${diseaseSlug}`,
          weight: 0.85,
          metadata: { drugClass: g.drugClass },
        },
        stats,
      );

      await writeUvkgLink(
        {
          edgeType: 'TREATED_WITH',
          edgeClass: 'CLINICAL',
          fromRefType: 'DISEASE',
          fromRefId: diseaseSlug,
          toRefType: 'MEDICINE_GENERIC',
          toRefId: g.genericCode,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w2:tw:${diseaseSlug}:${g.genericCode}`,
          weight: 0.55,
          metadata: { drugClass: g.drugClass },
        },
        stats,
      );
    }

    for (const sp of g.species) {
      await writeUvkgLink(
        {
          edgeType: 'SAFE_FOR',
          edgeClass: 'CLINICAL',
          fromRefType: 'MEDICINE_GENERIC',
          fromRefId: g.genericCode,
          toRefType: 'SPECIES',
          toRefId: sp,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w2:sf:${g.genericCode}:${sp}`,
          weight: 0.7,
          species: [sp as never],
        },
        stats,
      );
    }

    await writeUvkgLink(
      {
        edgeType: 'WITHDRAWAL_FOR',
        edgeClass: 'REGULATORY',
        fromRefType: 'MEDICINE_GENERIC',
        fromRefId: g.genericCode,
        toRefType: 'REGION',
        toRefId: 'BD',
        sourceSystem: 'IMPORT',
        sourceEdgeId: `w2:wd:${g.genericCode}`,
        weight: 0.9,
        metadata: { meatDays: g.withdrawalMeatDays, milkDays: g.withdrawalMilkDays },
      },
      stats,
    );
  }

  for (let i = 0; i < generics.length - 1; i += 3) {
    const a = generics[i]!;
    const b = generics[i + 1]!;
    if (a.drugClass === b.drugClass) {
      await writeUvkgLink(
        {
          edgeType: 'INTERACTS_WITH',
          edgeClass: 'CLINICAL',
          fromRefType: 'MEDICINE_GENERIC',
          fromRefId: a.genericCode,
          toRefType: 'MEDICINE_GENERIC',
          toRefId: b.genericCode,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w2:ix:${a.genericCode}:${b.genericCode}`,
          weight: 0.65,
          metadata: { drugClass: a.drugClass },
        },
        stats,
      );
    }
  }

  for (const b of brands) {
    await writeUvkgLink(
      {
        edgeType: 'BRAND_OF',
        edgeClass: 'METADATA',
        fromRefType: 'MEDICINE_BRAND',
        fromRefId: b.brandCode,
        toRefType: 'MEDICINE_GENERIC',
        toRefId: b.genericCode,
        sourceSystem: 'IMPORT',
        sourceEdgeId: `w2:bo:${b.brandCode}`,
        weight: 1,
      },
      stats,
    );
    await writeUvkgLink(
      {
        edgeType: 'MANUFACTURED_BY',
        edgeClass: 'METADATA',
        fromRefType: 'MEDICINE_BRAND',
        fromRefId: b.brandCode,
        toRefType: 'KNOWLEDGE_ENTITY',
        toRefId: b.companyCode,
        sourceSystem: 'IMPORT',
        sourceEdgeId: `w2:mb:${b.brandCode}`,
        weight: 0.8,
      },
      stats,
    );
  }

  return stats;
}
