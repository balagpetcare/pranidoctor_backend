/** Phase 6C.13 feature flags and tuning knobs (env-driven). */
export type VreConfig = {
  pgvectorAnnEnabled: boolean;
  colloquialExpansionEnabled: boolean;
  crossEncoderRerankEnabled: boolean;
  postLlmValidationEnabled: boolean;
  retrievalMetadataLoggingEnabled: boolean;
  evalLexicalOnly: boolean;
  deterministicEmbedFallback: boolean;
  crossEncoderMaxPairs: number;
  crossEncoderTimeoutMs: number;
};

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return raw === '1' || raw.toLowerCase() === 'true';
}

export function getVreConfig(): VreConfig {
  return {
    pgvectorAnnEnabled: envFlag('VRE_PGVECTOR_ANN', true),
    colloquialExpansionEnabled: envFlag('VRE_COLLOQUIAL_EXPANSION', true),
    crossEncoderRerankEnabled: envFlag('VRE_CROSS_ENCODER_RERANK', true),
    postLlmValidationEnabled: envFlag('VRE_POST_LLM_VALIDATION', true),
    retrievalMetadataLoggingEnabled: envFlag('VRE_RETRIEVAL_METADATA_LOG', true),
    evalLexicalOnly: envFlag('VRE_EVAL_LEXICAL_ONLY', false),
    deterministicEmbedFallback: envFlag('VRE_DETERMINISTIC_EMBED_FALLBACK', false),
    crossEncoderMaxPairs: Number(process.env.VRE_CROSS_ENCODER_MAX_PAIRS ?? 20),
    crossEncoderTimeoutMs: Number(process.env.VRE_CROSS_ENCODER_TIMEOUT_MS ?? 800),
  };
}

let testOverride: Partial<VreConfig> | null = null;

export function setVreConfigForTests(override: Partial<VreConfig> | null): void {
  testOverride = override;
}

export function resolveVreConfig(): VreConfig {
  const base = getVreConfig();
  if (!testOverride) return base;
  return { ...base, ...testOverride };
}
