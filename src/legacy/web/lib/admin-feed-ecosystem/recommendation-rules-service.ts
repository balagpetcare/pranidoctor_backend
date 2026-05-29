import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { prisma } from '@/lib/prisma.js';

import { FEED_RECOMMENDATION_RULES_SETTING_KEY, RULE_VERSION } from '../../../../modules/feed-recommendation/feed-recommendation.constants.js';
import { invalidateRulesCache } from '../../../../modules/feed-recommendation/engine/rules-loader.js';

const DEFAULT_RULES_PATH = join(
  import.meta.dirname,
  '../../../../modules/feed-recommendation/rules/bd-v2-default.json',
);

export type RecommendationRulesPayload = {
  version: string;
  source: 'setting' | 'file';
  rules: unknown;
  updatedAt: string | null;
};

export async function adminGetRecommendationRules(): Promise<RecommendationRulesPayload> {
  const setting = await prisma.setting.findUnique({
    where: { key: FEED_RECOMMENDATION_RULES_SETTING_KEY },
  });

  if (setting?.valueJson) {
    return {
      version: RULE_VERSION,
      source: 'setting',
      rules: setting.valueJson,
      updatedAt: setting.updatedAt.toISOString(),
    };
  }

  const raw = await readFile(DEFAULT_RULES_PATH, 'utf8');
  return {
    version: RULE_VERSION,
    source: 'file',
    rules: JSON.parse(raw) as unknown,
    updatedAt: null,
  };
}

export async function adminSaveRecommendationRules(rules: unknown): Promise<RecommendationRulesPayload> {
  const row = await prisma.setting.upsert({
    where: { key: FEED_RECOMMENDATION_RULES_SETTING_KEY },
    create: { key: FEED_RECOMMENDATION_RULES_SETTING_KEY, valueJson: rules as object },
    update: { valueJson: rules as object },
  });

  invalidateRulesCache();

  return {
    version: RULE_VERSION,
    source: 'setting',
    rules: row.valueJson,
    updatedAt: row.updatedAt.toISOString(),
  };
}
