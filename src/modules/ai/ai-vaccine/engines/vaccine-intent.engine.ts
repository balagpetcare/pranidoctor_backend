export type VaccineIntent =
  | 'VACCINE_LOOKUP'
  | 'SCHEDULE'
  | 'BOOSTER'
  | 'MISSED'
  | 'INTERACTION'
  | 'DIAGNOSIS'
  | 'MEDICINE'
  | 'EMERGENCY'
  | 'GENERAL';

export type IntentRouteResult = {
  intent: VaccineIntent;
  redirectAssistant?: 'ai-doctor' | 'prescription' | 'emergency';
  blockInVaccine?: boolean;
  redirectMessageBn?: string;
  redirectMessageEn?: string;
};

const DIAGNOSIS_PATTERNS =
  /(diagnos|disease|symptom|মাথা|জ্বর|ডায়রিয়া|হাঁচা|রোগ|নিশ্চিত|what illness|what disease|কী রোগ)/i;
const MEDICINE_PATTERNS =
  /\b(antibiotic|medicine|dose|mg\/kg|ml\/kg|ওষুধ|অ্যান্টিবায়োটিক|মাত্রা)\b/i;
const EMERGENCY_PATTERNS =
  /\b(collapse|bleeding|unconscious|মৃত|রক্ত|ঝিমিয়ে|জরুরি|emergency)\b/i;
const INTERACTION_PATTERNS =
  /(together|same day|একসাথে|interaction|সাথে দেওয়া|পর\s+antibiotic|পর\s+ওষুধ|টিকা.*antibiotic|antibiotic.*টিকা|vaccine.*medicine)/i;
const SCHEDULE_PATTERNS =
  /(schedule|when|কখন|সূচি|টিকা|vaccine|booster|বুস্টার|দেব)/i;
const MISSED_PATTERNS = /\b(missed|overdue|পেরিয়ে|মিস|বাকি)\b/i;

export function classifyVaccineIntent(message: string): IntentRouteResult {
  const text = message.trim();
  if (!text) return { intent: 'GENERAL' };

  if (EMERGENCY_PATTERNS.test(text)) {
    return {
      intent: 'EMERGENCY',
      redirectAssistant: 'emergency',
      blockInVaccine: true,
      redirectMessageBn: 'জরুরি অবস্থার জন্য জরুরি সহায়তা খুলুন বা তৎক্ষণাৎ ভেটের সাথে যোগাযোগ করুন।',
      redirectMessageEn: 'For emergencies, use Emergency Assistant or call your vet immediately.',
    };
  }

  if (DIAGNOSIS_PATTERNS.test(text) && !SCHEDULE_PATTERNS.test(text)) {
    return {
      intent: 'DIAGNOSIS',
      redirectAssistant: 'ai-doctor',
      blockInVaccine: true,
      redirectMessageBn:
        'রোগ নির্ণয় AI Doctor সহায়তায় করা হয়। টিকা সূচি সম্পর্কে প্রশ্ন করতে পারেন।',
      redirectMessageEn:
        'Disease questions belong in AI Doctor. Ask about vaccination schedules here.',
    };
  }

  if (INTERACTION_PATTERNS.test(text)) {
    return { intent: 'INTERACTION' };
  }

  if (MEDICINE_PATTERNS.test(text)) {
    return {
      intent: 'MEDICINE',
      redirectAssistant: 'prescription',
      blockInVaccine: false,
      redirectMessageBn: 'ওষুধ/মাত্রা সম্পর্কিত প্রশ্ন Prescription Assistant-এ দেখুন।',
      redirectMessageEn: 'Medicine and dose questions are handled in Prescription Assistant.',
    };
  }
  if (MISSED_PATTERNS.test(text)) {
    return { intent: 'MISSED' };
  }
  if (SCHEDULE_PATTERNS.test(text)) {
    return { intent: 'SCHEDULE' };
  }
  if (/\b(lookup|what is|কী|কি ভ্যাকসিন|vaccine name)\b/i.test(text)) {
    return { intent: 'VACCINE_LOOKUP' };
  }

  return { intent: 'GENERAL' };
}
