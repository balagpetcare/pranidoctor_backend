import { detectMedicalIntent } from '../../knowledge-retrieval/grounding/medical-safety.service.js';
import { isTreatmentIntentQuery } from '../../ai-doctor/engines/differential-diagnosis.engine.js';
import {
  DIE_DEFAULT_SAFETY_POLICY_VERSION,
  DIE_DISCLAIMER_BN,
  DIE_DISCLAIMER_EN,
} from '../disease-intelligence.constants.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { getDiseaseIntelligenceRepository } from '../disease-intelligence.repository.js';
import { getDiseaseRegistryService } from '../registry/disease-registry.service.js';
import { getDiseaseAnalyticsService } from '../analytics/disease-analytics.service.js';
import type { SafetyDecision } from '../disease-intelligence.types.js';
import type { DiSafetyDecisionAction } from '../../../../generated/prisma/index.js';

type SafetyEvaluateInput = {
  queryText: string;
  locale: 'bn' | 'en';
  caseId?: string;
  diseaseSlugs?: string[];
  routingBlocked?: boolean;
  postLlm?: boolean;
  llmOutput?: string;
};

export class ClinicalSafetyEngine {
  readonly name = 'ClinicalSafetyEngine';

  async evaluate(input: SafetyEvaluateInput): Promise<SafetyDecision> {
    const policy = await getDiseaseIntelligenceRepository().getActiveSafetyPolicy();
    const rules = (policy?.rulesJson ?? {}) as Record<string, boolean>;
    const reasonCodes: string[] = [];

    if (rules.blockAutonomousPrescription !== false && isTreatmentIntentQuery(input.queryText)) {
      reasonCodes.push('TREATMENT_INTENT');
      return this.finish(input, 'BLOCK', reasonCodes, true, true);
    }

    if (rules.prescriptionIntentBlock && detectMedicalIntent(input.queryText) && isTreatmentIntentQuery(input.queryText)) {
      reasonCodes.push('PRESCRIPTION_INTENT');
      return this.finish(input, 'BLOCK', reasonCodes, true, true);
    }

    if (input.routingBlocked) {
      reasonCodes.push('ROUTING_BLOCK');
      return this.finish(input, 'BLOCK', reasonCodes, true, false);
    }

    if (input.postLlm && input.llmOutput) {
      const diagnosisPatterns = [
        /\byour (animal|cow|goat) has\b/i,
        /\bনিশ্চিতভাবে\b/,
        /\bdefinitely has\b/i,
        /\bdiagnosed with\b/i,
      ];
      if (rules.blockAutonomousDiagnosis !== false) {
        for (const p of diagnosisPatterns) {
          if (p.test(input.llmOutput)) {
            reasonCodes.push('AUTONOMOUS_DIAGNOSIS_LANGUAGE');
            return this.finish(input, 'BLOCK', reasonCodes, true, false);
          }
        }
      }
      const treatmentPatterns = [/\bprescribe\b/i, /\bদিন\s*:\s*\d+/];
      if (rules.blockAutonomousTreatmentPlan !== false) {
        for (const p of treatmentPatterns) {
          if (p.test(input.llmOutput)) {
            reasonCodes.push('AUTONOMOUS_TREATMENT_PLAN');
            return this.finish(input, 'BLOCK', reasonCodes, true, true);
          }
        }
      }
    }

    if (input.diseaseSlugs?.length) {
      for (const slug of input.diseaseSlugs) {
        try {
          const disease = await getDiseaseRegistryService().search({ q: slug, take: 1 });
          const match = disease.find((d) => d.slug === slug);
          if (match?.zoonoticRisk && rules.zoonoticWarn) {
            reasonCodes.push('ZOONOTIC_WARNING');
          }
          if (match?.notifiableClass !== 'NONE' && rules.notifiablePrompt) {
            reasonCodes.push('NOTIFIABLE_DISEASE');
          }
        } catch {
          // ignore lookup failures
        }
      }
    }

    if (reasonCodes.includes('ZOONOTIC_WARNING') || reasonCodes.includes('NOTIFIABLE_DISEASE')) {
      return this.finish(input, 'ESCALATE', reasonCodes, false, true);
    }

    return this.finish(input, 'PROCEED', reasonCodes, false, false);
  }

  private async finish(
    input: SafetyEvaluateInput,
    action: DiSafetyDecisionAction,
    reasonCodes: string[],
    blockLlm: boolean,
    requireEscalation: boolean,
  ): Promise<SafetyDecision> {
    await getDiseaseIntelligenceRepository().logSafetyEvaluation(
      omitUndefined({
        caseId: input.caseId,
        policyVersion: DIE_DEFAULT_SAFETY_POLICY_VERSION,
        action,
        reasonCodes,
      }),
    );

    if (action === 'BLOCK') {
      void getDiseaseAnalyticsService().track(
        'SAFETY_BLOCK',
        omitUndefined({
          caseId: input.caseId,
          metadata: { reasonCodes },
        }),
      );
    }

    const zoonotic = reasonCodes.includes('ZOONOTIC_WARNING');
    const notifiable = reasonCodes.includes('NOTIFIABLE_DISEASE');

    return {
      action,
      reasonCodes,
      blockLlm,
      requireEscalation,
      messages: {
        bn:
          action === 'BLOCK'
            ? 'নিরাপত্তাজনিত কারণে এই অনুরোধ প্রক্রিয়া করা যায়নি। লাইসেন্সপ্রাপ্ত পশু চিকিৎসকের সাথে যোগাযোগ করুন।'
            : zoonotic
              ? 'সম্ভাব্য জুনোটিক রোগ — সতর্কতা অবলম্বন করুন এবং চিকিৎসকের পরামর্শ নিন।'
              : notifiable
                ? 'এটি বিজ্ঞপ্তিযোগ্য রোগ হতে পারে — স্থানীয় কর্তৃপক্ষকে জানানো প্রয়োজন হতে পারে।'
                : DIE_DISCLAIMER_BN,
        en:
          action === 'BLOCK'
            ? 'This request was blocked for safety reasons. Contact a licensed veterinarian.'
            : zoonotic
              ? 'Possible zoonotic disease — take precautions and consult a veterinarian.'
              : notifiable
                ? 'This may be a notifiable disease — reporting to authorities may be required.'
                : DIE_DISCLAIMER_EN,
      },
    };
  }
}

let engine: ClinicalSafetyEngine | undefined;

export function getClinicalSafetyEngine(): ClinicalSafetyEngine {
  engine ??= new ClinicalSafetyEngine();
  return engine;
}
