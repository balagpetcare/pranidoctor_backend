/** UVKG feature flags (Phases 1–5). Legacy graphs remain authoritative for production reads until rollout. */
export type UvkgConfig = {
  dualWriteEnabled: boolean;
  syncEnabled: boolean;
  readEnabled: boolean;
  legacyFallbackEnabled: boolean;
  /** Phase 5A — run UVKG reads in parallel with legacy; production response stays legacy. */
  shadowReadEnabled: boolean;
  /** Phase 5E — canary % of traffic that uses UVKG when readEnabled (0–100). */
  readPercent: number;
  /** Shadow reads include DRAFT links (wave population) for parity validation. */
  shadowIncludeDraft: boolean;
};

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return raw === '1' || raw.toLowerCase() === 'true';
}

function envPercent(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return defaultValue;
  return Math.min(100, Math.max(0, n));
}

export function getUvkgConfig(): UvkgConfig {
  return {
    dualWriteEnabled: envFlag('UVKG_DUAL_WRITE_ENABLED', true),
    syncEnabled: envFlag('UVKG_SYNC_ENABLED', true),
    readEnabled: envFlag('UVKG_READ_ENABLED', false),
    legacyFallbackEnabled: envFlag('UVKG_LEGACY_FALLBACK', true),
    shadowReadEnabled: envFlag('UVKG_SHADOW_READ_ENABLED', false),
    readPercent: envPercent('UVKG_READ_PERCENT', 0),
    shadowIncludeDraft: envFlag('UVKG_SHADOW_INCLUDE_DRAFT', true),
  };
}

/** Deterministic canary bucket for a stable request key (0–99). */
export function uvkgReadCanaryBucket(requestKey: string): number {
  let hash = 0;
  for (let i = 0; i < requestKey.length; i++) {
    hash = (hash * 31 + requestKey.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

export function shouldRouteToUvkgRead(requestKey: string, config: UvkgConfig): boolean {
  if (!config.readEnabled) return false;
  if (config.readPercent >= 100) return true;
  if (config.readPercent <= 0) return false;
  return uvkgReadCanaryBucket(requestKey) < config.readPercent;
}

let testOverride: Partial<UvkgConfig> | null = null;

export function setUvkgConfigForTests(override: Partial<UvkgConfig> | null): void {
  testOverride = override;
}

export function resolveUvkgConfig(): UvkgConfig {
  const base = getUvkgConfig();
  if (!testOverride) return base;
  return { ...base, ...testOverride };
}
