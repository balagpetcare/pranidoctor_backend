import type { PartnerRole } from './partner-roles.js';

export const PARTNER_DOCUMENT_TYPES = [
  'NID_FRONT',
  'NID_BACK',
  'SELFIE',
  'BVC_CERTIFICATE',
  'DEGREE_CERTIFICATE',
  'TRAINING_CERTIFICATE',
  'AI_CERTIFICATE',
  'EXPERIENCE_PROOF',
  'SIGNATURE',
  'STAMP_SEAL',
  'ORGANIZATION_ID',
  'OTHER',
  'PET_EXPERIENCE_CERTIFICATE',
  'PET_PRACTICE_PROOF',
  'PET_CLINIC_PHOTO',
] as const;
export type PartnerDocumentTypeKey = (typeof PARTNER_DOCUMENT_TYPES)[number];

export type DocumentReviewState = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export type DocumentRequirement = {
  type: PartnerDocumentTypeKey;
  labelBn: string;
  hintBn: string;
  required: boolean;
  /** Only the primary role's own credentials are required; inherited services need nothing extra. */
};

const NID_FRONT: DocumentRequirement = {
  type: 'NID_FRONT',
  labelBn: 'জাতীয় পরিচয়পত্র (সামনের পাশ)',
  hintBn: 'স্পষ্ট ছবি; নাম ও নম্বর পড়া যেতে হবে',
  required: true,
};
const NID_BACK: DocumentRequirement = {
  type: 'NID_BACK',
  labelBn: 'জাতীয় পরিচয়পত্র (পিছনের পাশ)',
  hintBn: 'স্পষ্ট ছবি',
  required: true,
};
const SELFIE: DocumentRequirement = {
  type: 'SELFIE',
  labelBn: 'নিজের ছবি (সেলফি)',
  hintBn: 'মুখ স্পষ্ট দেখা যায় এমন ছবি',
  required: true,
};
const EXPERIENCE: DocumentRequirement = {
  type: 'EXPERIENCE_PROOF',
  labelBn: 'অভিজ্ঞতার প্রমাণ',
  hintBn: 'চাকরির পত্র, প্রত্যয়নপত্র ইত্যাদি',
  required: false,
};
const OTHER: DocumentRequirement = {
  type: 'OTHER',
  labelBn: 'অন্যান্য কাগজ',
  hintBn: 'প্রশাসক চাইলে বাড়তি কাগজ এখানে দিন',
  required: false,
};

/** What each applicant role must / may upload. Extend here to ask for more. */
export const DOCUMENT_REQUIREMENTS: Record<PartnerRole, DocumentRequirement[]> = {
  DOCTOR: [
    NID_FRONT,
    NID_BACK,
    SELFIE,
    {
      type: 'BVC_CERTIFICATE',
      labelBn: 'বিভিসি রেজিস্ট্রেশন সনদ',
      hintBn: 'বাংলাদেশ ভেটেরিনারি কাউন্সিলের সনদ',
      required: true,
    },
    {
      type: 'DEGREE_CERTIFICATE',
      labelBn: 'ডিগ্রি সনদ (DVM/MS ইত্যাদি)',
      hintBn: 'সর্বোচ্চ ডিগ্রির সনদ',
      required: true,
    },
    EXPERIENCE,
    { type: 'SIGNATURE', labelBn: 'স্বাক্ষর', hintBn: 'সাদা কাগজে স্বাক্ষরের ছবি', required: false },
    { type: 'STAMP_SEAL', labelBn: 'সিল/স্ট্যাম্প', hintBn: 'প্রেসক্রিপশনে ব্যবহৃত সিল', required: false },
    OTHER,
  ],
  AI_TECHNICIAN: [
    NID_FRONT,
    NID_BACK,
    SELFIE,
    {
      type: 'AI_CERTIFICATE',
      labelBn: 'কৃত্রিম প্রজনন (এআই) প্রশিক্ষণ সনদ',
      hintBn: 'প্রশিক্ষণ প্রতিষ্ঠান থেকে পাওয়া সনদ',
      required: true,
    },
    EXPERIENCE,
    {
      type: 'ORGANIZATION_ID',
      labelBn: 'প্রতিষ্ঠানের পরিচয়পত্র',
      hintBn: 'সরকারি/বেসরকারি প্রতিষ্ঠানে কাজ করলে',
      required: false,
    },
    OTHER,
  ],
  HEALTH_WORKER: [
    NID_FRONT,
    NID_BACK,
    SELFIE,
    {
      type: 'TRAINING_CERTIFICATE',
      labelBn: 'প্রশিক্ষণ বা সনদ',
      hintBn: 'প্রাণী স্বাস্থ্য বিষয়ক প্রশিক্ষণের সনদ',
      required: true,
    },
    EXPERIENCE,
    OTHER,
  ],
};

export type DocLite = { type: PartnerDocumentTypeKey; reviewStatus: DocumentReviewState };

export type ChecklistState = 'MISSING' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export type ChecklistItem = DocumentRequirement & { state: ChecklistState; count: number };

/** Best state among the uploads of one type: approved > pending > rejected > missing. */
export function stateOf(docs: DocLite[]): ChecklistState {
  if (docs.length === 0) return 'MISSING';
  if (docs.some((d) => d.reviewStatus === 'APPROVED')) return 'APPROVED';
  if (docs.some((d) => d.reviewStatus === 'PENDING_REVIEW')) return 'PENDING_REVIEW';
  return 'REJECTED';
}

export function buildChecklist(
  role: PartnerRole,
  docs: DocLite[],
  extras: DocumentRequirement[] = [],
): ChecklistItem[] {
  return [...DOCUMENT_REQUIREMENTS[role], ...extras].map((req) => {
    const mine = docs.filter((d) => d.type === req.type);
    return { ...req, state: stateOf(mine), count: mine.length };
  });
}

/** Required items that still need an upload (missing or rejected). */
export function outstandingRequired(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((i) => i.required && (i.state === 'MISSING' || i.state === 'REJECTED'));
}

export function isTypeAllowedFor(
  role: PartnerRole,
  type: PartnerDocumentTypeKey,
  extras: DocumentRequirement[] = [],
): boolean {
  return [...DOCUMENT_REQUIREMENTS[role], ...extras].some((r) => r.type === type);
}
