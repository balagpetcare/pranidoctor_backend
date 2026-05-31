import {
  AiKnowledgeEmbeddingStatus,
  AiKnowledgeStatus,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { upsertEmbeddingVector, isPgvectorColumnAvailable } from '../search/pgvector.util.js';
import { getKnowledgeEmbeddingPipelineService } from './embedding-pipeline.service.js';

export type EmbeddingRefreshResult = {
  scanned: number;
  indexed: number;
  failed: number;
  skipped: number;
};

export type EmbeddingVersionDriftResult = {
  scanned: number;
  requeued: number;
};

export type PgvectorBackfillResult = {
  scanned: number;
  backfilled: number;
  skipped: number;
};

/** Sweep PENDING/FAILED published entries (default max 200 per run). */
export async function runKnowledgeEmbeddingRefreshJob(
  maxEntries = 200,
): Promise<EmbeddingRefreshResult> {
  const stale = await getPrisma().aiKnowledgeEntry.findMany({
    where: {
      status: AiKnowledgeStatus.PUBLISHED,
      OR: [
        { embeddingStatus: AiKnowledgeEmbeddingStatus.PENDING },
        { embeddingStatus: AiKnowledgeEmbeddingStatus.FAILED },
      ],
    },
    select: { id: true },
    orderBy: { publishedAt: 'asc' },
    take: maxEntries,
  });

  const pipeline = getKnowledgeEmbeddingPipelineService();
  let indexed = 0;
  let failed = 0;
  let skipped = 0;

  for (const entry of stale) {
    const result = await pipeline.embedEntry(entry.id);
    indexed += result.indexed;
    failed += result.failed;
    if (result.indexed === 0 && result.failed === 0) skipped += 1;
  }

  return {
    scanned: stale.length,
    indexed,
    failed,
    skipped,
  };
}

/** Re-embed entries where active embedding row version != entry.version. */
export async function runEmbeddingVersionDriftJob(
  maxEntries = 100,
): Promise<EmbeddingVersionDriftResult> {
  const driftRows = await getPrisma().$queryRaw<Array<{ knowledgeEntryId: string }>>`
    SELECT DISTINCT e."knowledgeEntryId"
    FROM "AiKnowledgeEmbeddingChunk" e
    INNER JOIN "AiKnowledgeEntry" ke ON ke."id" = e."knowledgeEntryId"
    WHERE e."active" = true
      AND ke."status" = 'PUBLISHED'
      AND e."entryVersion" <> ke."version"
    LIMIT ${maxEntries}
  `;

  const pipeline = getKnowledgeEmbeddingPipelineService();
  let requeued = 0;

  for (const row of driftRows) {
    await getPrisma().aiKnowledgeEntry.update({
      where: { id: row.knowledgeEntryId },
      data: { embeddingStatus: AiKnowledgeEmbeddingStatus.PENDING },
    });
    pipeline.scheduleEmbedEntry(row.knowledgeEntryId);
    requeued += 1;
  }

  return { scanned: driftRows.length, requeued };
}

/** Copy vectorJson → embeddingVector for rows missing pgvector column value. */
export async function runPgvectorBackfillJob(maxRows = 500): Promise<PgvectorBackfillResult> {
  if (!(await isPgvectorColumnAvailable())) {
    return { scanned: 0, backfilled: 0, skipped: 0 };
  }

  const rows = await getPrisma().$queryRaw<Array<{ id: string; vectorJson: unknown }>>`
    SELECT e."id", e."vectorJson"
    FROM "AiKnowledgeEmbeddingChunk" e
    WHERE e."active" = true
      AND e."embeddingVector" IS NULL
    LIMIT ${maxRows}
  `;

  let backfilled = 0;
  let skipped = 0;

  for (const row of rows) {
    const raw = row.vectorJson;
    if (!Array.isArray(raw)) {
      skipped += 1;
      continue;
    }
    const vector = raw.filter((v): v is number => typeof v === 'number');
    if (vector.length === 0) {
      skipped += 1;
      continue;
    }
    await upsertEmbeddingVector({ id: row.id, vector });
    backfilled += 1;
  }

  return { scanned: rows.length, backfilled, skipped };
}

/** Full-corpus embed sweep for all published entries. */
export async function runFullCorpusEmbedJob(): Promise<EmbeddingRefreshResult> {
  const entries = await getPrisma().aiKnowledgeEntry.findMany({
    where: { status: AiKnowledgeStatus.PUBLISHED },
    select: { id: true },
  });

  const pipeline = getKnowledgeEmbeddingPipelineService();
  let indexed = 0;
  let failed = 0;

  for (const entry of entries) {
    const result = await pipeline.embedEntry(entry.id);
    indexed += result.indexed;
    failed += result.failed;
  }

  return {
    scanned: entries.length,
    indexed,
    failed,
    skipped: 0,
  };
}
