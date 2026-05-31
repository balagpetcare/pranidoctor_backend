import type { AiDbTaskType } from '../../routing/ai-task.types.js';
import type { RetrievalLocale } from '../knowledge-retrieval.types.js';

export type GroundingStrictness = 'strict' | 'moderate' | 'light';

export function resolveGroundingStrictness(params: {
  profileStrictness?: GroundingStrictness;
  taskType: AiDbTaskType;
}): GroundingStrictness {
  if (params.profileStrictness) return params.profileStrictness;
  if (params.taskType === 'PRESCRIPTION_ANALYSIS') return 'strict';
  if (params.taskType === 'EMERGENCY_CONSULTATION') return 'strict';
  if (params.taskType === 'DISEASE_ANALYSIS' || params.taskType === 'FEED_FORMULATION') {
    return 'moderate';
  }
  return 'light';
}

export function buildGroundingInstruction(params: {
  locale: RetrievalLocale;
  citationBlock: string;
  evidenceBlock: string;
  confidenceBlock: string;
  structuredFactsJson: string;
  strictness: GroundingStrictness;
  taskType: AiDbTaskType;
}): string {
  const strictness = resolveGroundingStrictness({
    profileStrictness: params.strictness,
    taskType: params.taskType,
  });

  const rulesBnStrict = `গুরুত্বপূর্ণ নিয়ম:
1. নিচের Reference, Evidence, Confidence এবং Structured Facts ছাড়া clinical, ওষুধের মাত্রা বা চিকিৎসার তথ্য দেবেন না।
2. Reference-এ পর্যাপ্ত তথ্য না থাকলে বলুন আপনি নিশ্চিত নন এবং লাইসেন্সপ্রাপ্ত পশু চিকিৎসকের পরামর্শ নিন।
3. ওষুধের নাম, মাত্রা, withdrawal period কল্পনা করবেন না।
4. Reference থেকে তথ্য বলার সময় inline citation token যেমন আছে তেমনি ব্যবহার করুন।
5. Structured Facts (JSON) prose-এর চেয়ে বেশি authoritative — conflict হলে JSON অনুসরণ করুন।
6. Evidence level L2-এর নিচে থাকা তথ্য dosage/prescription-এ ব্যবহার করবেন না।`;

  const rulesEnStrict = `CRITICAL GROUNDING RULES:
1. Use ONLY the Reference, Evidence, Confidence, and Structured Facts sections below for clinical, dosage, and treatment facts.
2. If sections lack sufficient information, say you cannot advise and recommend a licensed veterinarian.
3. Do NOT invent drug names, doses, withdrawal periods, or diagnoses.
4. When stating a Reference fact, include its inline citation token exactly as shown.
5. Structured Facts (JSON) override prose when they conflict.
6. Do not use evidence below L2 for dosage or prescription guidance.`;

  const rulesBnModerate = `নির্দেশনা:
1. Clinical ও dosage তথ্যের জন্য নিচের Reference ব্যবহার করুন।
2. Reference-এ না থাকলে সাধারণ পশুপালন পরামর্শ দিতে পারেন, কিন্তু clinical claim-এ citation দিন।
3. ওষুধের মাত্রা কল্পনা করবেন না।`;

  const rulesEnModerate = `GUIDANCE:
1. Use the Reference below for clinical and dosage facts.
2. You may give general husbandry advice without Reference, but cite Reference for clinical claims.
3. Do NOT invent dosages.`;

  const rulesBnLight = `নির্দেশনা:
1. Reference থাকলে clinical তথ্যের জন্য তা ব্যবহার করুন।
2. Reference-এ না থাকলে সতর্কভাবে সাধারণ পরামর্শ দিন এবং পশু চিকিৎসকের পরামর্শ নিতে বলুন।`;

  const rulesEnLight = `GUIDANCE:
1. When Reference is provided, use it for clinical facts.
2. Without Reference, give cautious general guidance and recommend a veterinarian for treatment decisions.`;

  const rules =
    params.locale === 'bn'
      ? strictness === 'strict'
        ? rulesBnStrict
        : strictness === 'moderate'
          ? rulesBnModerate
          : rulesBnLight
      : strictness === 'strict'
        ? rulesEnStrict
        : strictness === 'moderate'
          ? rulesEnModerate
          : rulesEnLight;

  const sections = [rules];
  if (params.structuredFactsJson) {
    sections.push(
      params.locale === 'bn' ? 'Structured Facts (JSON):' : 'Structured Facts (JSON):',
      params.structuredFactsJson,
    );
  }
  if (params.evidenceBlock) sections.push(params.evidenceBlock);
  if (params.confidenceBlock) sections.push(params.confidenceBlock);
  if (params.citationBlock) {
    sections.push(params.locale === 'bn' ? 'Reference:' : 'Reference:', params.citationBlock);
  }

  return sections.join('\n\n');
}

export function buildEnrichedPromptContext(pack: {
  groundingInstruction: string;
  routingDecision: { action: string; disclaimerLevel: string };
  locale: RetrievalLocale;
}): string {
  if (!pack.groundingInstruction.trim()) return '';

  if (pack.routingDecision.action === 'PROCEED_DEGRADED') {
    const prefix =
      pack.locale === 'bn'
        ? 'সতর্কতা: সীমিত বা আংশিক যাচাইকৃত তথ্য — সাধারণ নির্দেশনা মাত্র; ওষুধ/চিকিৎসা সংক্রান্ত সিদ্ধান্তের জন্য পশু চিকিৎসকের পরামর্শ নিন।\n\n'
        : 'Caution: Limited or partially verified knowledge — general guidance only; consult a veterinarian for treatment decisions.\n\n';
    return prefix + pack.groundingInstruction;
  }

  return pack.groundingInstruction;
}
