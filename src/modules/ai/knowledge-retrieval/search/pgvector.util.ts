import { getPrisma } from '../../../../shared/database/prisma.js';

let pgvectorColumnAvailable: boolean | null = null;

export function formatPgvectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

export async function isPgvectorColumnAvailable(): Promise<boolean> {
  if (pgvectorColumnAvailable !== null) return pgvectorColumnAvailable;
  try {
    const rows = await getPrisma().$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'AiKnowledgeEmbeddingChunk'
          AND column_name = 'embeddingVector'
      ) AS exists
    `;
    pgvectorColumnAvailable = Boolean(rows[0]?.exists);
  } catch {
    pgvectorColumnAvailable = false;
  }
  return pgvectorColumnAvailable;
}

export function resetPgvectorAvailabilityCacheForTests(): void {
  pgvectorColumnAvailable = null;
}

export async function upsertEmbeddingVector(params: {
  id: string;
  vector: number[];
}): Promise<void> {
  if (!(await isPgvectorColumnAvailable())) return;
  if (params.vector.length === 0) return;

  const literal = formatPgvectorLiteral(params.vector);
  await getPrisma().$executeRawUnsafe(
    `UPDATE "AiKnowledgeEmbeddingChunk"
     SET "embeddingVector" = $1::vector
     WHERE "id" = $2`,
    literal,
    params.id,
  );
}
