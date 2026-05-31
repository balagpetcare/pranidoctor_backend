import { buildWave4VaccineCatalog } from './data/wave4-vaccine-catalog.js';
import type { WaveLinkStats } from './uvkg-link-writer.js';
import { writeUvkgLink } from './uvkg-link-writer.js';

export async function runWave4VaccineExpansion(): Promise<WaveLinkStats> {
  const stats: WaveLinkStats = { written: 0, skipped: 0, errors: [] };
  const vaccines = buildWave4VaccineCatalog();

  for (const vac of vaccines) {
    for (const disease of vac.diseases) {
      await writeUvkgLink(
        {
          edgeType: 'REQUIRES_VACCINE',
          edgeClass: 'CLINICAL',
          fromRefType: 'DISEASE',
          fromRefId: disease,
          toRefType: 'VACCINE',
          toRefId: vac.vaccineCode,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w4:rv:${disease}:${vac.vaccineCode}`,
          weight: 0.85,
          labelEn: vac.labelEn,
        },
        stats,
      );
      await writeUvkgLink(
        {
          edgeType: 'PREVENTS',
          edgeClass: 'CLINICAL',
          fromRefType: 'VACCINE',
          fromRefId: vac.vaccineCode,
          toRefType: 'DISEASE',
          toRefId: disease,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w4:pv:${vac.vaccineCode}:${disease}`,
          weight: 0.8,
        },
        stats,
      );
    }

    for (const sp of vac.species) {
      await writeUvkgLink(
        {
          edgeType: 'SAFE_FOR',
          edgeClass: 'CLINICAL',
          fromRefType: 'VACCINE',
          fromRefId: vac.vaccineCode,
          toRefType: 'SPECIES',
          toRefId: sp,
          sourceSystem: 'IMPORT',
          sourceEdgeId: `w4:vs:${vac.vaccineCode}:${sp}`,
          weight: 0.9,
          species: [sp as never],
        },
        stats,
      );
    }

    await writeUvkgLink(
      {
        edgeType: 'SUPPORTED_BY',
        edgeClass: 'METADATA',
        fromRefType: 'VACCINE',
        fromRefId: vac.vaccineCode,
        toRefType: 'PROTOCOL',
        toRefId: vac.scheduleKey,
        sourceSystem: 'IMPORT',
        sourceEdgeId: `w4:sc:${vac.vaccineCode}`,
        weight: 0.7,
        metadata: { doses: vac.doses, intervalWeeks: vac.intervalWeeks },
      },
      stats,
    );
  }

  return stats;
}
