/**
 * UVKG knowledge wave — direct VkKnowledgeLink population only (no sync layer changes).
 */
import type { UvkgLinkUpsertInput } from '../../../src/modules/ai/uvkg/uvkg.types.js';
import { getKnowledgeLinkRepository } from '../../../src/modules/ai/uvkg/repositories/knowledge-link.repository.js';
import { normalizeSourceEdgeId } from '../../../src/modules/ai/uvkg/uvkg.util.js';

export type WaveLinkStats = { written: number; skipped: number; errors: string[] };

export async function writeUvkgLink(
  input: UvkgLinkUpsertInput,
  stats: WaveLinkStats,
): Promise<void> {
  try {
    await getKnowledgeLinkRepository().upsertFromDualWrite({
      ...input,
      sourceEdgeId:
        input.sourceEdgeId != null
          ? normalizeSourceEdgeId(input.sourceEdgeId)
          : normalizeSourceEdgeId(
              `import:${input.edgeType}:${input.fromRefId}:${input.toRefId}`,
            ),
      status: input.status ?? 'DRAFT',
      sourceSystem: input.sourceSystem ?? 'IMPORT',
    });
    stats.written += 1;
  } catch (e) {
    stats.skipped += 1;
    if (stats.errors.length < 50) {
      stats.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
}

export function emptyWaveStats(): WaveLinkStats {
  return { written: 0, skipped: 0, errors: [] };
}

export function mergeStats(...parts: WaveLinkStats[]): WaveLinkStats {
  return parts.reduce(
    (acc, p) => ({
      written: acc.written + p.written,
      skipped: acc.skipped + p.skipped,
      errors: [...acc.errors, ...p.errors].slice(0, 100),
    }),
    emptyWaveStats(),
  );
}
