import { createHash } from 'node:crypto';

import type { VkKnowledgeLinkSourceSystem } from '../../../generated/prisma/index.js';

export function buildUvkgLinkKey(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

export function buildSourceLinkKey(
  sourceSystem: VkKnowledgeLinkSourceSystem,
  sourceEdgeId: string,
): string {
  return buildUvkgLinkKey([sourceSystem, sourceEdgeId]);
}

export function buildSemanticLinkKey(
  edgeType: string,
  fromRefType: string,
  fromRefId: string,
  toRefType: string,
  toRefId: string,
): string {
  return buildUvkgLinkKey([edgeType, fromRefType, fromRefId, toRefType, toRefId]);
}

const MAX_REF_ID_LEN = 128;
const MAX_SOURCE_EDGE_ID_LEN = 64;

/** Prisma column limits — hash when legacy IDs exceed varchar bounds. */
export function normalizeRefId(refId: string): string {
  if (refId.length <= MAX_REF_ID_LEN) return refId;
  return buildUvkgLinkKey(['ref', refId]);
}

export function normalizeSourceEdgeId(sourceEdgeId: string): string {
  if (sourceEdgeId.length <= MAX_SOURCE_EDGE_ID_LEN) return sourceEdgeId;
  return buildUvkgLinkKey(['src', sourceEdgeId]);
}
