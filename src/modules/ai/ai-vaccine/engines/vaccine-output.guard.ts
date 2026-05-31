/** VX-01 — definitive diagnosis language in farmer-facing output. */
const DIAGNOSIS_PATTERNS = [
  /\b(your animal has|definitely|confirmed case of|diagnosis is)\b/i,
  /(নিশ্চিত রোগ|আপনার গরুর|রোগ হয়েছে|নিশ্চিতভাবে)/i,
  /\b(mastitis is|FMD is confirmed)\b/i,
];

/** VX-02 — autonomous administration instructions. */
const ADMINISTRATION_PATTERNS = [
  /\b(inject|administer|give)\s+\d+\s*ml\b/i,
  /\b(vaccinate today|give the vaccine now)\b/i,
  /(আজই টিকা দিন|ইনজেকশন দিন|এখনই টিকা)/i,
];

export function containsDiagnosisLanguage(text: string): boolean {
  return DIAGNOSIS_PATTERNS.some((pattern) => pattern.test(text));
}

export function containsAdministrationImperative(text: string): boolean {
  return ADMINISTRATION_PATTERNS.some((pattern) => pattern.test(text));
}

export function sanitizeVaccineOutput(text: string, locale: 'bn' | 'en'): string {
  if (containsDiagnosisLanguage(text) || containsAdministrationImperative(text)) {
    return locale === 'bn'
      ? 'টিকা সূচি ও সতর্কতা শুধুমাত্র যাচাইকৃত সূত্র থেকে দেখানো হয়। টিকা প্রয়োগের আগে পশুচিকিৎসকের পরামর্শ নিন।'
      : 'Vaccination guidance is shown from verified sources only. Consult your veterinarian before administration.';
  }
  return text;
}
