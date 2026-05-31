import type { KnowledgeContextPack, StructuredFact } from '../knowledge-retrieval.types.js';
import { detectMedicalIntent } from '../grounding/medical-safety.service.js';
import { resolveVreConfig } from '../config/vre-config.js';
import { containsAutonomousPrescriptionLanguage } from '../../ai-prescription/engines/prescription-output.guard.js';

export type PostLlmValidationFailure = {
  code: string;
  detail: string;
  severity: 'warn' | 'block';
};

export type PostLlmValidationResult = {
  passed: boolean;
  tier: 'T0' | 'T1' | 'T2' | 'T3';
  failures: PostLlmValidationFailure[];
  sanitizedOutput?: string;
  action: 'PASS' | 'SANITIZE' | 'BLOCK' | 'ESCALATE';
};

const DOSE_PATTERN =
  /(\d+(?:\.\d+)?)\s*(mg\s*\/\s*kg|mg\/kg|ml\s*\/\s*kg|ml\/kg|mg|ml)\b/gi;

function extractDoseClaims(text: string): Array<{ value: number; unit: string; raw: string }> {
  const claims: Array<{ value: number; unit: string; raw: string }> = [];
  for (const match of text.matchAll(DOSE_PATTERN)) {
    const value = Number(match[1]);
    const unit = (match[2] ?? '').toLowerCase().replace(/\s/g, '');
    if (Number.isFinite(value)) {
      claims.push({ value, unit, raw: match[0] ?? '' });
    }
  }
  return claims;
}

function findMatchingDoseFact(
  claim: { value: number; unit: string },
  facts: StructuredFact[],
): StructuredFact | undefined {
  return facts.find((fact) => {
    if (fact.factType !== 'DOSE_MG_KG' && fact.factType !== 'DOSE_ML_KG') return false;
    if (typeof fact.value !== 'number') return false;
    const claimIsMg = claim.unit.includes('mg');
    const claimIsMl = claim.unit.includes('ml');
    const factIsMg = fact.factType === 'DOSE_MG_KG';
    const factIsMl = fact.factType === 'DOSE_ML_KG';
    if (claimIsMg && !factIsMg) return false;
    if (claimIsMl && !factIsMl) return false;
    const tolerance = Math.max(fact.value * 0.12, 0.5);
    return Math.abs(claim.value - fact.value) <= tolerance;
  });
}

export function validateLlmOutput(params: {
  llmOutput: string;
  pack: KnowledgeContextPack;
  taskType: string;
}): PostLlmValidationResult {
  const config = resolveVreConfig();
  if (!config.postLlmValidationEnabled) {
    return { passed: true, tier: 'T0', failures: [], action: 'PASS' };
  }

  const failures: PostLlmValidationFailure[] = [];
  const medicalIntent = detectMedicalIntent(params.pack.query);
  const isPrescription = params.taskType === 'PRESCRIPTION_ANALYSIS';

  const doseClaims = extractDoseClaims(params.llmOutput);
  if (doseClaims.length > 0 && (medicalIntent || isPrescription)) {
    if (params.pack.structuredFacts.length === 0) {
      failures.push({
        code: 'uncited_dose',
        detail: 'LLM output contains dosage without structured facts in pack',
        severity: 'block',
      });
    } else {
      for (const claim of doseClaims) {
        const fact = findMatchingDoseFact(claim, params.pack.structuredFacts);
        if (!fact) {
          failures.push({
            code: 'dose_mismatch',
            detail: `Dosage claim "${claim.raw}" not grounded in structured facts`,
            severity: isPrescription ? 'block' : 'warn',
          });
        }
      }
    }
  }

  if (params.pack.routingDecision.action === 'PROCEED_DEGRADED') {
    const overconfident = /\b(definitely|guaranteed|certain cure|100%)\b/i.test(params.llmOutput);
    if (overconfident) {
      failures.push({
        code: 'overconfident_degraded',
        detail: 'Overconfident language in degraded retrieval mode',
        severity: 'warn',
      });
    }
  }

  if (isPrescription && containsAutonomousPrescriptionLanguage(params.llmOutput)) {
    failures.push({
      code: 'autonomous_prescription',
      detail: 'LLM output contains autonomous prescription language (PX-01)',
      severity: 'block',
    });
  }

  const hasBlock = failures.some((f) => f.severity === 'block');
  if (hasBlock) {
    return { passed: false, tier: 'T1', failures, action: 'BLOCK' };
  }

  const hasWarn = failures.some((f) => f.severity === 'warn');
  if (hasWarn) {
    const caution =
      params.pack.locale === 'bn'
        ? '\n\n[সতর্কতা: এই তথ্য সীমিত আস্থার ভিত্তিতে প্রদান করা হয়েছে।]'
        : '\n\n[Caution: This information was provided with limited retrieval confidence.]';
    return {
      passed: false,
      tier: 'T0',
      failures,
      sanitizedOutput: params.llmOutput + caution,
      action: 'SANITIZE',
    };
  }

  return { passed: true, tier: 'T0', failures: [], action: 'PASS' };
}

export class PostLlmValidatorService {
  readonly name = 'PostLlmValidatorService';
  validate = validateLlmOutput;
}

let service: PostLlmValidatorService | null = null;

export function getPostLlmValidatorService(): PostLlmValidatorService {
  if (!service) service = new PostLlmValidatorService();
  return service;
}

export function resetPostLlmValidatorForTests(): void {
  service = null;
}
