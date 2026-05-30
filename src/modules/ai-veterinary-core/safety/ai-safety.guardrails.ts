const DIAGNOSIS_PATTERNS = [
  /\bdiagnos(is|e|ed)\b/i,
  /\byou have\b/i,
  /\bit is (likely|probably|certainly)\b/i,
  /\bprescri(be|ption)\b/i,
  /\btake this (medicine|antibiotic|drug)\b/i,
  /\bআপনার .* রোগ\b/u,
  /\bনির্ণয়\b/u,
  /\bওষুধ\s*লিখ/iu,
];

const EMERGENCY_SYMPTOMS = [
  'not breathing',
  'cannot stand',
  'severe bleeding',
  'unconscious',
  'convulsion',
  'seizure',
  'bloat',
  'শ্বাস\s*নেই',
  'রক্ত\s*পড়',
  'অচেতন',
];

const HIGH_SYMPTOMS = ['high fever', 'bloody', 'collapse', 'জ্বর\s*অত্যন্ত/u', 'পড়\s*যাচ্ছে'];

export const AI_CONFIDENCE_ESCALATION_THRESHOLD = 0.55;

export function containsDiagnosisLanguage(text: string): boolean {
  return DIAGNOSIS_PATTERNS.some((p) => p.test(text));
}

const ETA_OUTPUT_PATTERNS = [
  /\btypical\s+response[^.!?]*[.!?]?/gi,
  /\bwithin\s+\d+\s*(?:min|minute|hour)s?[^.!?]*[.!?]?/gi,
  /\bunder\s+\d+\s*(?:min|minute)s?[^.!?]*[.!?]?/gi,
  /\b\d+\s*[-–]\s*\d+\s*(?:min|minute)s?[^.!?]*[.!?]?/gi,
  /\bwill\s+(?:arrive|respond)\s+within\s+\d+[^.!?]*[.!?]?/gi,
];

export function stripProhibitedEtaPhrases(text: string): string {
  let out = text;
  for (const pattern of ETA_OUTPUT_PATTERNS) {
    out = out.replace(pattern, ' ');
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

export function sanitizeAssistantOutput(text: string): string {
  let out = stripProhibitedEtaPhrases(text);
  for (const pattern of DIAGNOSIS_PATTERNS) {
    out = out.replace(pattern, '[consult a veterinarian]');
  }
  return out;
}

export function assessSymptomRisk(symptoms: string[]): {
  bucket: 'LOW' | 'MEDIUM' | 'HIGH';
  urgencyLevel: number;
  emergency: boolean;
} {
  const joined = symptoms.join(' ').toLowerCase();

  if (EMERGENCY_SYMPTOMS.some((s) => new RegExp(s, 'iu').test(joined))) {
    return { bucket: 'HIGH', urgencyLevel: 10, emergency: true };
  }
  if (HIGH_SYMPTOMS.some((s) => new RegExp(s, 'iu').test(joined))) {
    return { bucket: 'HIGH', urgencyLevel: 8, emergency: false };
  }
  if (symptoms.length >= 3) {
    return { bucket: 'MEDIUM', urgencyLevel: 5, emergency: false };
  }
  return { bucket: 'LOW', urgencyLevel: 2, emergency: false };
}

export function shouldRefuseUserInput(message: string): boolean {
  return containsDiagnosisLanguage(message);
}

export function buildRefusalReply(locale: 'bn' | 'en'): string {
  return locale === 'bn'
    ? 'আমি রোগ নির্ণয় বা ওষুধ লিখতে পারি না। লক্ষণগুলো লিখে রাখুন এবং দ্রুত একজন প্রাণী চিকিৎসকের সাথে যোগাযোগ করুন।'
    : 'I cannot diagnose or prescribe. Please note the symptoms and contact a veterinarian promptly.';
}

export function buildHumanRedirect(locale: 'bn' | 'en'): string {
  return locale === 'bn'
    ? 'অনুগ্রহ করে Prani Doctor-এ একজন চিকিৎসকের পরামর্শ নিন।'
    : 'Please request a veterinarian consultation through Prani Doctor.';
}
