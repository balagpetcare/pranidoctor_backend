import {
  buildEscalationDisclosureFields,
  type EscalationDisclosureFields,
} from '../../legacy/web/lib/ai-escalation-disclosure/ai-escalation-disclosure.service.js';
import type {
  AiEscalationDisclosureLocale,
  AiEscalationDisclosureTriggerKey,
} from '../../legacy/web/lib/ai-escalation-disclosure/ai-escalation-disclosure-defaults.js';

export async function resolveEscalationDisclosure(
  trigger: AiEscalationDisclosureTriggerKey,
  locale: AiEscalationDisclosureLocale,
): Promise<EscalationDisclosureFields> {
  return buildEscalationDisclosureFields(trigger, locale);
}

export async function resolveOptionalEscalationDisclosure(
  trigger: AiEscalationDisclosureTriggerKey | null,
  locale: AiEscalationDisclosureLocale,
): Promise<Partial<EscalationDisclosureFields>> {
  if (!trigger) return {};
  return buildEscalationDisclosureFields(trigger, locale);
}
