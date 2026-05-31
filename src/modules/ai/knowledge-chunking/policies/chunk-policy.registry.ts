import type { VkKnowledgeDomain } from '../../../../generated/prisma/index.js';
import type { ChunkPolicyId } from '../knowledge-chunking.types.js';

const DEFAULT_POLICY: ChunkPolicyId = 'GENERIC_BY_PARAGRAPH';

const DOMAIN_POLICY: Partial<Record<VkKnowledgeDomain, ChunkPolicyId>> = {
  DISEASE: 'DISEASE_BY_HEADING',
  MEDICINE: 'MEDICINE_BY_SECTION',
  CLINICAL_PROTOCOL: 'PROTOCOL_BY_STEP',
  EMERGENCY: 'EMERGENCY_BY_ACTION',
  VACCINE: 'VACCINE_BY_SCHEDULE_ROW',
  FEED: 'FEED_BY_NUTRIENT_BLOCK',
  BREED: 'GENERIC_BY_PARAGRAPH',
  REPRODUCTION: 'GENERIC_BY_PARAGRAPH',
  FARM_MGMT: 'FARM_MGMT_BY_SECTION',
  REGULATORY_BD: 'REGULATORY_BY_RECORD',
};

export function isChunkPolicyId(value: string): value is ChunkPolicyId {
  return [
    'DISEASE_BY_HEADING',
    'MEDICINE_BY_SECTION',
    'PROTOCOL_BY_STEP',
    'EMERGENCY_BY_ACTION',
    'VACCINE_BY_SCHEDULE_ROW',
    'FEED_BY_NUTRIENT_BLOCK',
    'FARM_MGMT_BY_SECTION',
    'REGULATORY_BY_RECORD',
    'STRUCTURED_BY_KEY',
    'GENERIC_BY_PARAGRAPH',
  ].includes(value);
}

export function resolveChunkPolicyForDomain(
  domain: VkKnowledgeDomain,
  override?: string | null,
): ChunkPolicyId {
  if (override && isChunkPolicyId(override)) return override;
  return DOMAIN_POLICY[domain] ?? DEFAULT_POLICY;
}

export function policyAllowsOverlap(policyId: ChunkPolicyId): boolean {
  return policyId === 'DISEASE_BY_HEADING' || policyId === 'FARM_MGMT_BY_SECTION';
}

export function policyOverlapTokens(policyId: ChunkPolicyId): number {
  return policyAllowsOverlap(policyId) ? 50 : 0;
}
