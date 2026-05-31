import { buildWave5OutbreakCatalog, WAVE5_RISK_FACTORS } from './data/wave5-outbreak-catalog.js';
import type { WaveLinkStats } from './uvkg-link-writer.js';
import { writeUvkgLink } from './uvkg-link-writer.js';

export async function runWave5OutbreakExpansion(): Promise<WaveLinkStats> {
  const stats: WaveLinkStats = { written: 0, skipped: 0, errors: [] };
  const outbreaks = buildWave5OutbreakCatalog();

  for (const ob of outbreaks) {
    await writeUvkgLink(
      {
        edgeType: 'OUTBREAK_IN',
        edgeClass: 'CLINICAL',
        fromRefType: 'DISEASE',
        fromRefId: ob.disease,
        toRefType: 'OUTBREAK',
        toRefId: ob.outbreakId,
        sourceSystem: 'IMPORT',
        sourceEdgeId: `w5:ob:${ob.outbreakId}`,
        weight: ob.riskLevel === 'CRITICAL' ? 0.95 : 0.7,
        regionScope: [ob.region, 'BD'],
        metadata: { division: ob.division, riskLevel: ob.riskLevel },
      },
      stats,
    );

    await writeUvkgLink(
      {
        edgeType: 'PREVALENT_IN',
        edgeClass: 'CLINICAL',
        fromRefType: 'DISEASE',
        fromRefId: ob.disease,
        toRefType: 'REGION',
        toRefId: ob.region,
        sourceSystem: 'IMPORT',
        sourceEdgeId: `w5:rg:${ob.disease}:${ob.region}`,
        weight: 0.75,
        regionScope: [ob.region],
        metadata: { season: ob.season },
      },
      stats,
    );

    await writeUvkgLink(
      {
        edgeType: 'AGGRAVATED_BY',
        edgeClass: 'CLINICAL',
        fromRefType: 'DISEASE',
        fromRefId: ob.disease,
        toRefType: 'RISK_FACTOR',
        toRefId: `season-${ob.season}`,
        sourceSystem: 'IMPORT',
        sourceEdgeId: `w5:sn:${ob.disease}:${ob.season}`,
        weight: 0.65,
        regionScope: ['BD'],
        metadata: { season: ob.season },
      },
      stats,
    );

    for (const rf of WAVE5_RISK_FACTORS.slice(0, 2)) {
      await writeUvkgLink(
        {
          edgeType: 'AGGRAVATED_BY',
          edgeClass: 'CLINICAL',
          fromRefType: 'DISEASE',
          fromRefId: ob.disease,
          toRefType: 'RISK_FACTOR',
          toRefId: rf,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w5:rk:${ob.outbreakId}:${rf}`,
          weight: 0.6,
          regionScope: [ob.region],
        },
        stats,
      );
    }
  }

  return stats;
}
