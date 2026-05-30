import {
  assertLegalSafeMessagingConfig,
  collectLocaleTextFields,
  type LocaleTextPair,
} from '../../../../shared/compliance/messaging-compliance.js';
import type { AiDisclaimerConfig } from '../ai-disclaimer/ai-disclaimer-defaults.js';
import type { AiEscalationDisclosureConfig } from '../ai-escalation-disclosure/ai-escalation-disclosure-defaults.js';
import type { EmergencyLimitationConfig } from '../emergency-limitation/emergency-limitation-defaults.js';
import type { VetDisclaimerConfig } from '../vet-disclaimer/vet-disclaimer-defaults.js';

function pushPair(
  fields: Array<{ field: string; text: string }>,
  prefix: string,
  pair: LocaleTextPair,
): void {
  fields.push(...collectLocaleTextFields(prefix, pair));
}

export function assertEmergencyLimitationMessaging(config: EmergencyLimitationConfig): void {
  const fields: Array<{ field: string; text: string }> = [];
  pushPair(fields, 'banner', config.banner);
  pushPair(fields, 'urgent', config.urgent);
  pushPair(fields, 'full', config.full);
  for (const [key, pair] of Object.entries(config.contextual)) {
    pushPair(fields, `contextual.${key}`, pair);
  }
  assertLegalSafeMessagingConfig(fields);
}

export function assertVetDisclaimerMessaging(config: VetDisclaimerConfig): void {
  const fields: Array<{ field: string; text: string }> = [];
  pushPair(fields, 'banner', config.banner);
  pushPair(fields, 'emergency', config.emergency);
  pushPair(fields, 'full', config.full);
  for (const [key, pair] of Object.entries(config.contextual)) {
    pushPair(fields, `contextual.${key}`, pair);
  }
  assertLegalSafeMessagingConfig(fields);
}

export function assertAiDisclaimerMessaging(config: AiDisclaimerConfig): void {
  const fields: Array<{ field: string; text: string }> = [];
  pushPair(fields, 'banner', config.banner);
  for (const [key, pair] of Object.entries(config.contextual)) {
    pushPair(fields, `contextual.${key}`, pair);
  }
  assertLegalSafeMessagingConfig(fields);
}

export function assertAiEscalationDisclosureMessaging(
  config: AiEscalationDisclosureConfig,
): void {
  const fields: Array<{ field: string; text: string }> = [];
  pushPair(fields, 'banner', config.banner);
  pushPair(fields, 'full', config.full);
  for (const [key, pair] of Object.entries(config.contextual)) {
    pushPair(fields, `contextual.${key}`, pair);
  }
  assertLegalSafeMessagingConfig(fields);
}

export function assertLegalConsentTextFields(
  fields: Array<{ field: string; text: string }>,
): void {
  assertLegalSafeMessagingConfig(fields);
}
