import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prisma } from '@/lib/prisma.js';

import { FEED_RECOMMENDATION_RULES_SETTING_KEY } from '../feed-recommendation.constants.js';
import { coerceLegacyRules } from './rules-coerce.js';
import type { IntelligenceRules } from './rules-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V2_FILE = join(__dirname, '..', 'rules', 'bd-v2-default.json');
const V1_FILE = join(__dirname, '..', 'rules', 'bd-default.json');

const CACHE_TTL_MS = 60_000;

type CachedRules = {
  rules: IntelligenceRules;
  source: 'setting' | 'file';
  loadedAt: number;
};

let cache: CachedRules | undefined;

function readFileRules(path: string): IntelligenceRules {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return coerceLegacyRules(raw);
}

export function invalidateRulesCache(): void {
  cache = undefined;
}

export async function loadIntelligenceRules(): Promise<{
  rules: IntelligenceRules;
  source: 'setting' | 'file';
}> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) {
    return { rules: cache.rules, source: cache.source };
  }

  const setting = await prisma.setting.findUnique({
    where: { key: FEED_RECOMMENDATION_RULES_SETTING_KEY },
    select: { valueJson: true },
  });

  if (setting?.valueJson) {
    try {
      const rules = coerceLegacyRules(setting.valueJson);
      cache = { rules, source: 'setting', loadedAt: now };
      return { rules, source: 'setting' };
    } catch {
      // fall through to file defaults if admin JSON invalid
    }
  }

  try {
    const rules = readFileRules(V2_FILE);
    cache = { rules, source: 'file', loadedAt: now };
    return { rules, source: 'file' };
  } catch {
    const rules = readFileRules(V1_FILE);
    cache = { rules, source: 'file', loadedAt: now };
    return { rules, source: 'file' };
  }
}

/** Sync loader for tests and legacy sync callers. */
export function loadIntelligenceRulesSync(): IntelligenceRules {
  if (cache) return cache.rules;
  return readFileRules(V2_FILE);
}
