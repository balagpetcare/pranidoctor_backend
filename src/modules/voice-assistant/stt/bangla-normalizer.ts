import type { VoiceLocale } from '../voice-assistant.types.js';
import {
  VOICE_CONFIDENCE_CONFIRM,
  VOICE_CONFIDENCE_RETRY,
} from '../voice-assistant.types.js';

const BANGLISH_MAP: Record<string, string> = {
  goru: 'গরু',
  goro: 'গরু',
  gorur: 'গরুর',
  jor: 'জ্বর',
  fever: 'জ্বর',
  dudh: 'দুধ',
  'dudh kom': 'দুধ কম',
  khao: 'খাও',
  khay: 'খায়',
  help: 'সাহায্য',
  case: 'কেস',
  kholo: 'খুল',
  pichon: 'পিছনে',
  abar: 'আবার',
  cancel: 'বাতিল',
};

export function normalizeBanglaUtterance(raw: string, locale: VoiceLocale): string {
  let text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return text;

  if (locale === 'bn' || looksBanglish(text)) {
    const tokens = text.toLowerCase().split(' ');
    const mapped = tokens.map((t) => BANGLISH_MAP[t] ?? t);
    text = mapped.join(' ');
  }

  return text;
}

function looksBanglish(text: string): boolean {
  return /[a-z]/i.test(text) && !/[\u0980-\u09FF]/.test(text);
}

export function evaluateConfidence(confidence: number): {
  retrySuggested: boolean;
  fallbackHint: string | null;
} {
  if (confidence < VOICE_CONFIDENCE_RETRY) {
    return {
      retrySuggested: true,
      fallbackHint: 'কথাটি আবার বলুন বা ট্যাপ করে টাইপ করুন',
    };
  }
  if (confidence < VOICE_CONFIDENCE_CONFIRM) {
    return {
      retrySuggested: false,
      fallbackHint: 'ঠিক আছে কি? নিশ্চিত করতে আবার বলুন',
    };
  }
  return { retrySuggested: false, fallbackHint: null };
}

export function isShortUtterance(text: string): boolean {
  return text.trim().split(/\s+/).length < 2 && text.trim().length < 8;
}
