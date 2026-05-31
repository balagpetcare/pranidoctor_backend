import type { AiSettingsCategory } from '../../../generated/prisma/index.js';

export type AiRoutingSettings = {
  preferredProvider?: string;
  honorDbRoutes?: boolean;
  fallbackToRules?: boolean;
};

export type AiBudgetSettings = {
  dailyBudgetUsd?: number | null;
  monthlyBudgetUsd?: number | null;
  emergencyBypassBudget?: boolean;
};

export type AiGovernanceSettings = {
  llmEnabled?: boolean;
  requireAiConsent?: boolean;
};

export type AiEncryptionSettings = {
  apiKeyStorage?: string;
  defaultEncryptionKeyId?: string;
  algorithm?: string;
};

export type AiSettingsSnapshot = {
  scopeKey: string;
  resolvedFrom: string;
  routing: AiRoutingSettings;
  budget: AiBudgetSettings;
  governance: AiGovernanceSettings;
  encryption: AiEncryptionSettings;
  loadedAt: string;
};

export type AiSettingsView = {
  id: string;
  scopeKey: string;
  settingsKey: string;
  category: AiSettingsCategory;
  settingsJson: Record<string, unknown>;
  hasEncryptedPayload: boolean;
  version: number;
  updatedAt: string;
};

export const KNOWN_SETTINGS_KEYS = [
  'routing.default',
  'budget.global',
  'security.encryption',
  'governance.features',
] as const;

export type KnownSettingsKey = (typeof KNOWN_SETTINGS_KEYS)[number];
