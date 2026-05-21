import type { SttAdapterInput, SttAdapterOutput } from '../voice-assistant.types.js';
import { evaluateConfidence, isShortUtterance, normalizeBanglaUtterance } from './bangla-normalizer.js';

export interface SttAdapter {
  readonly name: string;
  transcribe(input: SttAdapterInput): SttAdapterOutput;
}

export class BanglaSttAdapter implements SttAdapter {
  readonly name = 'bangla-normalizer-v1';

  transcribe(input: SttAdapterInput): SttAdapterOutput {
    const normalizedText = normalizeBanglaUtterance(input.transcript, input.locale);
    const confidenceEval = evaluateConfidence(input.confidence);

    let retrySuggested = confidenceEval.retrySuggested;
    let fallbackHint = confidenceEval.fallbackHint;

    if (isShortUtterance(normalizedText) && input.confidence < 0.8) {
      retrySuggested = true;
      fallbackHint = fallbackHint ?? 'আরও স্পষ্ট করে বলুন';
    }

    return {
      normalizedText,
      confidence: input.confidence,
      retrySuggested,
      fallbackHint,
    };
  }
}

let adapter: SttAdapter | null = null;

export function getSttAdapter(): SttAdapter {
  if (!adapter) adapter = new BanglaSttAdapter();
  return adapter;
}
