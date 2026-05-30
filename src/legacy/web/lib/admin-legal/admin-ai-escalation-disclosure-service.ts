import { prisma } from '@/lib/prisma';

import {
  aiEscalationDisclosureConfigToSettingJson,
  DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG,
  parseAiEscalationDisclosureConfigJson,
  type AiEscalationDisclosureConfig,
  type AiEscalationDisclosureLocaleText,
  type AiEscalationDisclosureTriggerKey,
} from '../ai-escalation-disclosure/ai-escalation-disclosure-defaults.js';
import {
  AI_ESCALATION_DISCLOSURE_SETTING_KEY,
  loadAiEscalationDisclosureConfig,
} from '../ai-escalation-disclosure/ai-escalation-disclosure-config.js';
import { assertAiEscalationDisclosureMessaging } from './messaging-compliance-admin.js';
import type { AdminAiEscalationDisclosurePutBody } from '../ai-escalation-disclosure/schemas.js';

export type AdminAiEscalationDisclosureDto = AiEscalationDisclosureConfig & {
  updatedAt: string | null;
};

function mergeLocaleText(
  current: AiEscalationDisclosureLocaleText,
  patch?: Partial<AiEscalationDisclosureLocaleText>,
): AiEscalationDisclosureLocaleText {
  return {
    en: patch?.en?.trim() || current.en,
    bn: patch?.bn?.trim() || current.bn,
  };
}

const TRIGGER_KEYS: AiEscalationDisclosureTriggerKey[] = [
  'emergency',
  'high',
  'lowConfidence',
  'policyRefusal',
  'supportVsVet',
  'humanReview',
  'escalationRecorded',
  'keywordLimitation',
];

export async function getAdminAiEscalationDisclosureSettings(): Promise<AdminAiEscalationDisclosureDto> {
  const row = await prisma.setting.findUnique({
    where: { key: AI_ESCALATION_DISCLOSURE_SETTING_KEY },
    select: { valueJson: true, updatedAt: true },
  });
  const config =
    row?.valueJson != null
      ? parseAiEscalationDisclosureConfigJson(row.valueJson)
      : { ...DEFAULT_AI_ESCALATION_DISCLOSURE_CONFIG };

  return {
    ...config,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  };
}

export async function updateAdminAiEscalationDisclosureSettings(
  body: AdminAiEscalationDisclosurePutBody,
): Promise<AdminAiEscalationDisclosureDto> {
  const current = await loadAiEscalationDisclosureConfig();

  const contextual = { ...current.contextual };
  if (body.contextual) {
    for (const key of TRIGGER_KEYS) {
      const patch = body.contextual[key];
      if (patch) {
        contextual[key] = mergeLocaleText(contextual[key], patch);
      }
    }
  }

  const next: AiEscalationDisclosureConfig = {
    contentVersion: body.contentVersion?.trim() || current.contentVersion,
    banner: mergeLocaleText(current.banner, body.banner),
    full: mergeLocaleText(current.full, body.full),
    contextual,
  };

  assertAiEscalationDisclosureMessaging(next);

  const row = await prisma.setting.upsert({
    where: { key: AI_ESCALATION_DISCLOSURE_SETTING_KEY },
    create: {
      key: AI_ESCALATION_DISCLOSURE_SETTING_KEY,
      valueJson: aiEscalationDisclosureConfigToSettingJson(next),
    },
    update: {
      valueJson: aiEscalationDisclosureConfigToSettingJson(next),
    },
    select: { updatedAt: true },
  });

  return {
    ...next,
    updatedAt: row.updatedAt.toISOString(),
  };
}
