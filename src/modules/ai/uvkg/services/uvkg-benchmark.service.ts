import { getKnowledgeLinkRepository } from '../repositories/knowledge-link.repository.js';
import { UVKG_BENCHMARK_TARGET_MS, UVKG_TRAVERSAL_PUBLISHED_STATUSES } from '../uvkg-phase4.constants.js';
import type { UvkgBenchmarkOp, UvkgBenchmarkReport } from '../uvkg.types.js';

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

async function timeSamples(fn: () => Promise<void>, samples: number): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  return times;
}

/** DB-level benchmarks (independent of UVKG_READ_ENABLED). */
export class UvkgBenchmarkService {
  readonly name = 'UvkgBenchmarkService';

  async runBenchmarks(samples = 20): Promise<UvkgBenchmarkReport> {
    const repo = getKnowledgeLinkRepository();
    const slug =
      (await repo.findSamplePublishedDiseaseSlug()) ??
      (await repo.getTopConnectedEndpoints(1))[0]?.refId ??
      'mastitis';

    const operations: UvkgBenchmarkOp[] = [];

    const neighborTimes = await timeSamples(
      () =>
        repo.neighborsForBenchmark({
          refType: 'DISEASE',
          refId: slug,
          statuses: [...UVKG_TRAVERSAL_PUBLISHED_STATUSES],
          limit: 50,
        }).then(() => undefined),
      samples,
    );
    operations.push(this.toOp('neighbor_lookup', samples, neighborTimes));

    const pathTimes = await timeSamples(async () => {
      const hop1 = await repo.listNeighbors({
        refType: 'DISEASE',
        refId: slug,
        statuses: [...UVKG_TRAVERSAL_PUBLISHED_STATUSES],
        limit: 10,
      });
      if (hop1[0]) {
        await repo.listNeighbors({
          refType: hop1[0].toRefType,
          refId: hop1[0].toRefId,
          statuses: [...UVKG_TRAVERSAL_PUBLISHED_STATUSES],
          limit: 10,
        });
      }
    }, samples);
    operations.push(this.toOp('path_lookup_2hop', samples, pathTimes));

    const crossTimes = await timeSamples(async () => {
      await Promise.all([
        repo.countByEdgeTypes(['HAS_SYMPTOM', 'CONTRAINDICATES', 'TOXIC_TO']),
        repo.countByEdgeTypes(['INTERACTS_WITH', 'NUTRIENT_FOR']),
        repo.countByEdgeTypes(['OUTBREAK_IN', 'PREVALENT_IN']),
      ]);
    }, samples);
    operations.push(this.toOp('cross_domain_traversal', samples, crossTimes));

    return {
      generatedAt: new Date().toISOString(),
      operations,
      allMet: operations.every((o) => o.met),
    };
  }

  private toOp(operation: string, samples: number, times: number[]): UvkgBenchmarkOp {
    const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
    return {
      operation,
      samples,
      avgMs: Math.round(avgMs * 100) / 100,
      p95Ms: Math.round(percentile(times, 95) * 100) / 100,
      maxMs: Math.round(Math.max(...times) * 100) / 100,
      targetMs: UVKG_BENCHMARK_TARGET_MS,
      met: avgMs < UVKG_BENCHMARK_TARGET_MS,
    };
  }
}

let benchmark: UvkgBenchmarkService | undefined;

export function getUvkgBenchmarkService(): UvkgBenchmarkService {
  benchmark ??= new UvkgBenchmarkService();
  return benchmark;
}

export function resetUvkgBenchmarkServiceForTests(): void {
  benchmark = undefined;
}
