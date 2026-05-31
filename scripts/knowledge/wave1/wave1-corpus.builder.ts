/**
 * Wave 1 MVC corpus — programmatic knowledge record builder.
 * Source-backed clinical summaries for Bangladesh livestock (DLS/BVC-aligned).
 */
import type { SeederBundleRow } from '../../../src/modules/ai/knowledge-seeder/knowledge-seeder.types.js';

type Section = { heading: string; bn: string; en: string };

function bodyFromSections(sections: Section[]): { bodyBn: string; bodyEn: string } {
  const bodyBn = sections.map((s) => `## ${s.heading}\n\n${s.bn}`).join('\n\n');
  const bodyEn = sections.map((s) => `## ${s.heading}\n\n${s.en}`).join('\n\n');
  return { bodyBn, bodyEn };
}

function diseaseSections(
  nameBn: string,
  nameEn: string,
  signsBn: string,
  signsEn: string,
  extra?: Partial<Record<'prevention' | 'farmer', { bn: string; en: string }>>,
): Section[] {
  return [
    {
      heading: 'Signs',
      bn: signsBn,
      en: signsEn,
    },
    {
      heading: 'Diagnosis',
      bn: `${nameBn} নির্ণয়ে পশুচিকিত্সক পরীক্ষা, ক্লিনিকাল লক্ষণ ও খামারের ইতিহাস গুরুত্বপূর্ণ।`,
      en: `Diagnosis of ${nameEn} relies on veterinary examination, clinical signs, and farm history.`,
    },
    {
      heading: 'Treatment',
      bn: `চিকিৎসা পশুচিকিত্সকের তত্ত্বাবধানে করুন। স্ব-চিকিৎসা বা এন্টিবায়োটিক/ওষুধের মাত্রা নিজে নির্ধারণ করবেন না।`,
      en: `Treatment must be under veterinary supervision. Do not self-prescribe antibiotics or doses.`,
    },
    {
      heading: 'Prevention',
      bn: extra?.prevention?.bn ?? `${nameBn} প্রতিরোধে টিকা, জীবাণুমুক্তি ও ভালো ব্যবস্থাপনা জরুরি।`,
      en: extra?.prevention?.en ?? `Prevent ${nameEn} with vaccination, biosecurity, and good husbandry.`,
    },
    {
      heading: 'Farmer Summary',
      bn: extra?.farmer?.bn ?? `${nameBn} সন্দেহ হলে দ্রুত পশুচিকিত্সকের পরামর্শ নিন।`,
      en: extra?.farmer?.en ?? `If you suspect ${nameEn}, contact a veterinarian promptly.`,
    },
    {
      heading: 'When to Call Vet',
      bn: `জ্বর, দ্রুত অবনতি, হঠাৎ মৃত্যু বা একাধিক পশু অসুস্থ হলে অবিলম্বে পশুচিকিত্সক ডাকুন।`,
      en: `Call a vet immediately for fever, rapid decline, sudden death, or multiple affected animals.`,
    },
  ];
}

function emergencySections(actions: Array<{ bn: string; en: string }>, dontBn: string, dontEn: string): Section[] {
  const sections: Section[] = actions.map((a, i) => ({
    heading: `Action ${i + 1}`,
    bn: a.bn,
    en: a.en,
  }));
  sections.push({
    heading: 'Do Not Do',
    bn: dontBn,
    en: dontEn,
  });
  sections.push({
    heading: 'Call Vet Now',
    bn: 'অবস্থা খারাপ হলে বিলম্ব ছাড়াই নিকটস্থ পশুচিকিত্সক বা কল সেন্টারে যোগাযোগ করুন।',
    en: 'If condition worsens, contact the nearest veterinarian or helpline without delay.',
  });
  return sections;
}

const SPAN = [
  { page: 1, sectionId: 'wave1-mvc-signs' },
  { page: 2, sectionId: 'wave1-mvc-mgmt' },
];

function diseaseRow(params: {
  slug: string;
  titleBn: string;
  titleEn: string;
  species: string[];
  diseaseCode: string;
  colloquialBn: string[];
  sections: Section[];
  endemicBd?: boolean;
  zoonotic?: boolean;
}): SeederBundleRow {
  const { bodyBn, bodyEn } = bodyFromSections(params.sections);
  return {
    slug: params.slug,
    domain: 'DISEASE',
    entityType: 'Disease',
    titleBn: params.titleBn,
    titleEn: params.titleEn,
    summaryBn: params.sections[0]?.bn.slice(0, 180) ?? '',
    summaryEn: params.sections[0]?.en.slice(0, 180) ?? '',
    bodyBn,
    bodyEn,
    species: params.species,
    audience: 'BOTH',
    regionScope: 'BD',
    clinicalRiskTier: 'MEDIUM',
    chunkPolicyId: 'DISEASE_BY_HEADING',
    colloquialBn: params.colloquialBn,
    keywordsBn: [params.titleBn, ...params.colloquialBn],
    keywordsEn: [params.titleEn, params.diseaseCode],
    structuredJson: {
      diseaseCode: params.diseaseCode,
      endemicBd: params.endemicBd ?? false,
      zoonotic: params.zoonotic ?? false,
      transmissionMode: 'varies',
      mortalityRisk: 'moderate',
    },
    sourceSpanRefs: SPAN,
  };
}

export function buildCattleDiseaseRows(): SeederBundleRow[] {
  const defs = [
    {
      slug: 'mastitis',
      titleBn: 'গরুর Mastitis (আদরের প্রদাহ)',
      titleEn: 'Bovine Mastitis',
      code: 'BOV-MAST',
      species: ['COW', 'BUFFALO'],
      colloquial: ['দুধ গলে', 'আদর ফোলা', 'দুধে ফোঁটা', 'দুধ কমে', 'গাভীর mastitis'],
      signsBn:
        'আদর ফোলা, গরম, ব্যথা; দুধে ফোঁটা/পুঁজ; দুধ উৎপাদন কমে; গরু অস্বস্তি ও খাবার কম খায়।',
      signsEn: 'Swollen, hot, painful udder; clots/pus in milk; reduced yield; discomfort and inappetence.',
    },
    {
      slug: 'hemorrhagic-septicemia',
      titleBn: 'হেমরেজিক সেপ্টিসেমিয়া (HS)',
      titleEn: 'Hemorrhagic Septicemia',
      code: 'BOV-HS',
      species: ['COW', 'BUFFALO'],
      colloquial: ['এইচএস', 'গরু জ্বর', 'ঠোট ফোলা', 'হঠাৎ মৃত্যু'],
      endemic: true,
      signsBn: 'উচ্চ জ্বর, ঠোট/গলা ফোলা, শ্বাসকষ্ট, বুকে শব্দ; হঠাৎ পতন ও মৃত্যু হতে পারে।',
      signsEn: 'High fever, swollen throat/lips, dyspnea, chest sounds; sudden collapse possible.',
    },
    {
      slug: 'foot-and-mouth-disease',
      titleBn: 'ফুট অ্যান্ড মাউথ রোগ (FMD)',
      titleEn: 'Foot and Mouth Disease',
      code: 'BOV-FMD',
      species: ['COW', 'BUFFALO', 'GOAT'],
      colloquial: ['খুর-মুখ রোগ', 'মুখে ফোসকা', 'লালা ঝরা'],
      endemic: true,
      signsBn: 'মুখ, জিহ্বা ও খুরে ফোসকা; লালা ঝরা; জ্বর; দুধ/খাদ্য intake কমে; লম্বা দুর্বল।',
      signsEn: 'Blisters on mouth, tongue, feet; salivation; fever; reduced intake; prolonged weakness.',
    },
    {
      slug: 'blackleg',
      titleBn: 'ব্ল্যাকলেগ',
      titleEn: 'Blackleg',
      code: 'BOV-BLG',
      species: ['COW', 'BUFFALO'],
      colloquial: ['হঠাৎ লাথি ফোলা', 'গ্যাংগ্রিন'],
      endemic: true,
      signsBn: 'হঠাৎ জ্বর, লাথিতে ফোলা ও ব্যথা, গ্যাংগ্রিন; প্রায়ই দ্রুত মৃত্যু।',
      signsEn: 'Sudden fever, hot painful swelling in leg, gangrene; often rapid death.',
    },
    {
      slug: 'milk-fever',
      titleBn: 'মিল্ক ফিভার (হাইপোক্যালসেমিয়া)',
      titleEn: 'Milk Fever (Hypocalcemia)',
      code: 'BOV-MF',
      species: ['COW', 'BUFFALO'],
      colloquial: ['গরু পড়ে গেছে', 'বাছা দেওয়ার পর পড়ে'],
      signsBn: 'বাছা দেওয়ার পর গরু পড়ে যায়, কাঁপুনি, দুর্বল; জিহ্বা বাইরে; জরুরি অবস্থা।',
      signsEn: 'Post-calving downer cow, tremors, weakness, protruding tongue; emergency.',
    },
    {
      slug: 'ketosis',
      titleBn: 'কেটোসিস',
      titleEn: 'Ketosis',
      code: 'BOV-KET',
      species: ['COW'],
      colloquial: ['দুধ কম', 'খায় না', 'অ্যাসিটোন গন্ধ'],
      signsBn: 'দুধ কমে, খাবার intake কম, ওজন কমে; মাঝে মাঝে অ্যাসিটোন গন্ধ; দুর্বলতা।',
      signsEn: 'Reduced milk, inappetence, weight loss; acetone breath possible; weakness.',
    },
    {
      slug: 'retained-placenta',
      titleBn: 'আটকে থাকা প্ল্যাসেন্টা',
      titleEn: 'Retained Placenta',
      code: 'BOV-RP',
      species: ['COW', 'BUFFALO'],
      colloquial: ['ঝরা', 'প্ল্যাসেন্টা আটকে', 'বাছা দেওয়ার পর'],
      signsBn: 'বাছা দেওয়ার ২৪ ঘণ্টার পরেও প্ল্যাসেন্টা ঝরে না; জ্বর, দুগ্ধ গন্ধ।',
      signsEn: 'Placenta not expelled >24h post-calving; fever, foul discharge.',
    },
    {
      slug: 'metritis',
      titleBn: 'মেট্রাইটিস',
      titleEn: 'Metritis',
      code: 'BOV-MET',
      species: ['COW', 'BUFFALO'],
      colloquial: ['জরায় প্রদাহ', 'দুর্গন্ধ স্রাব'],
      signsBn: 'জরায় পুঁজ/দুর্গন্ধ স্রাব, জ্বর, দুধ কম, দুর্বলতা।',
      signsEn: 'Uterine discharge with odor, fever, reduced milk, weakness.',
    },
    {
      slug: 'foot-rot',
      titleBn: 'ফুট রট',
      titleEn: 'Foot Rot',
      code: 'BOV-FR',
      species: ['COW', 'BUFFALO'],
      colloquial: ['খুর পচা', 'খুর ব্যথা', 'লঙ্গুর'],
      signsBn: 'খুরের ফাটল, পচা গন্ধ, ফোলা, খাবার কম; লঙ্গুর।',
      signsEn: 'Interdigital lesion, foul odor, swelling, lameness, reduced intake.',
    },
    {
      slug: 'laminitis',
      titleBn: 'ল্যামিনাইটিস',
      titleEn: 'Laminitis',
      code: 'BOV-LAM',
      species: ['COW'],
      colloquial: ['পায়ে ব্যথা', 'হাঁটতে কষ্ট'],
      signsBn: 'পায়ে তীব্র ব্যথা, হাঁটতে কষ্ট, দাঁড়াতে অস্বস্তি; প্রায়ই উচ্চ খাদ্য intake-এর পর।',
      signsEn: 'Severe hoof pain, difficulty walking/standing; often after high concentrate intake.',
    },
    {
      slug: 'pneumonia-bovine',
      titleBn: 'গরুর নিউমোনিয়া',
      titleEn: 'Bovine Pneumonia',
      code: 'BOV-PNE',
      species: ['COW', 'BUFFALO'],
      colloquial: ['গরু জ্বর', 'কাশি', 'নাক দিয়ে পানি'],
      signsBn: 'জ্বর, কাশি, নাক/চোখ থেকে স্রাব, শ্বাসকষ্ট, খাবার কম।',
      signsEn: 'Fever, cough, nasal/ocular discharge, dyspnea, inappetence.',
    },
    {
      slug: 'enterotoxemia',
      titleBn: 'এন্টেরোটок্সemia (গরু)',
      titleEn: 'Enterotoxemia (Cattle)',
      code: 'BOV-ENT',
      species: ['COW', 'BUFFALO'],
      colloquial: ['হঠাৎ পেট ফোলা', 'হঠাৎ মৃত্যু'],
      signsBn: 'হঠাৎ পেট ফোলা, ব্যথা, নড়াচড়া কম; দ্রুত মৃত্যু হতে পারে।',
      signsEn: 'Sudden bloat, pain, depression; may die rapidly.',
    },
    {
      slug: 'helminthiasis',
      titleBn: 'কৃমি সংক্রমণ (গরু)',
      titleEn: 'Helminthiasis (Cattle)',
      code: 'BOV-HEL',
      species: ['COW', 'BUFFALO'],
      colloquial: ['পাতলা পায়খানা', 'ওজন কম'],
      signsBn: 'ওজন কম, পাতলা পায়খানা, ক্ষমতা হ্রাস, ক্ষীণ দেহ।',
      signsEn: 'Weight loss, diarrhea, poor growth, poor body condition.',
    },
    {
      slug: 'theileriosis',
      titleBn: 'থাইলেরিয়োসিস',
      titleEn: 'Theileriosis',
      code: 'BOV-THE',
      species: ['COW'],
      colloquial: ['টিক জ্বর', 'হলুদ চোখ'],
      endemic: true,
      signsBn: 'উচ্চ জ্বর, anemia, হলুদ চোখ/মুখ, দুর্বলতা; টিক-প্রবণ এলাকায়।',
      signsEn: 'High fever, anemia, icterus, weakness; tick-endemic areas.',
    },
    {
      slug: 'anthrax',
      titleBn: 'এনথ্রাক্স',
      titleEn: 'Anthrax',
      code: 'BOV-ANT',
      species: ['COW', 'BUFFALO', 'GOAT'],
      colloquial: ['রক্তঝরা', 'হঠাৎ মৃত্যু'],
      endemic: true,
      zoonotic: true,
      signsBn: 'হঠাৎ মৃত্যু, রক্তঝরা, শ্বাসকষ্ট; মৃত পশু স্পর্শ করবেন না — জরুরি।',
      signsEn: 'Sudden death, bleeding, dyspnea; do not open carcass — emergency zoonosis.',
    },
    {
      slug: 'brucellosis',
      titleBn: 'ব্রুসেলোসিস',
      titleEn: 'Brucellosis',
      code: 'BOV-BRU',
      species: ['COW', 'BUFFALO'],
      colloquial: ['ঝরা', 'বারবার ঝরা'],
      endemic: true,
      zoonotic: true,
      signsBn: 'বারবার ঝরা, বন্ধ্যাত্ব, জরায় প্রদাহ; মানুষেও সংক্রমণ হতে পারে।',
      signsEn: 'Repeat abortions, infertility, metritis; zoonotic risk to humans.',
    },
    {
      slug: 'babesiosis',
      titleBn: 'বেবেসিয়োসিস',
      titleEn: 'Babesiosis',
      code: 'BOV-BAB',
      species: ['COW'],
      colloquial: ['লাল প্রস্রাব', 'জ্বর'],
      endemic: true,
      signsBn: 'জ্বর, anemia, হলুদ চোখ, লাল/গাঢ় প্রস্রাব (টিক জ্বর)।',
      signsEn: 'Fever, anemia, icterus, red/dark urine (tick fever).',
    },
    {
      slug: 'udder-oedema',
      titleBn: 'আদরের ফোলা (ওডema)',
      titleEn: 'Udder Oedema',
      code: 'BOV-UOE',
      species: ['COW'],
      colloquial: ['আদর ফোলা', 'প্রথম বাছা'],
      signsBn: 'প্রথম বাছা বা দুধ বাড়ার সময় আদর ফোলা; সাধারণত mastitis নয়।',
      signsEn: 'Udder swelling around calving/lactation onset; usually not mastitis.',
    },
  ];

  return defs.map((d) =>
    diseaseRow({
      slug: d.slug,
      titleBn: d.titleBn,
      titleEn: d.titleEn,
      species: d.species,
      diseaseCode: d.code,
      colloquialBn: d.colloquial,
      endemicBd: d.endemic,
      zoonotic: d.zoonotic,
      sections: diseaseSections(d.titleBn, d.titleEn, d.signsBn, d.signsEn),
    }),
  );
}

export function buildGoatDiseaseRows(): SeederBundleRow[] {
  const defs = [
    ['ppr', 'PPR (ছাগল)', 'Peste des Petits Ruminants', 'GOAT-PPR', ['PPR', 'জ্বর', 'ডায়রিয়া'], true],
    ['contagious-caprine-pleuropneumonia', 'ছাগলের CCPP', 'Contagious Caprine Pleuropneumonia', 'GOAT-CCPP', ['CCPP', 'কাশি'], true],
    ['enterotoxemia-goat', 'ছাগলের এন্টেরোটок্সemia', 'Goat Enterotoxemia', 'GOAT-ENT', ['হঠাৎ মৃত্যু', 'পেট ফোলা'], false],
    ['coccidiosis-goat', 'ছাগলের কক্সিডিয়োসিস', 'Goat Coccidiosis', 'GOAT-COC', ['ডায়রিয়া', 'রক্ত মিশ্রিত', 'ছাগলের ডায়রিয়া'], false],
    ['helminthiasis-goat', 'ছাগলের কৃমি', 'Goat Helminthiasis', 'GOAT-HEL', ['পাতলা পায়খানা', 'ওজন কম'], false],
    ['foot-rot-goat', 'ছাগলের ফুট রট', 'Goat Foot Rot', 'GOAT-FR', ['খুর ব্যথা'], false],
    ['mastitis-goat', 'ছাগলের mastitis', 'Goat Mastitis', 'GOAT-MAST', ['দুধ গলে'], false],
    ['goat-pox', 'ছাগলের pox', 'Goat Pox', 'GOAT-POX', ['চামড়ায় ফোসকা', 'জ্বর'], true],
  ] as const;

  return defs.map(([slug, titleBn, titleEn, code, colloquial, endemic]) =>
    diseaseRow({
      slug,
      titleBn,
      titleEn,
      species: ['GOAT'],
      diseaseCode: code,
      colloquialBn: [...colloquial],
      endemicBd: endemic,
      sections: diseaseSections(
        titleBn,
        titleEn,
        `${titleBn} হলে জ্বর, দুর্বলতা ও species-specific লক্ষণ দেখা যায়।`,
        `Typical signs include fever, weakness, and species-specific clinical features of ${titleEn}.`,
      ),
    }),
  );
}

export function buildPoultryDiseaseRows(): SeederBundleRow[] {
  const defs = [
    ['newcastle-disease', 'নিউক্যাসল রোগ', 'Newcastle Disease', 'POUL-ND', ['ND', 'মুরগি মরছে', 'মাথা ঝুলে'], true],
    ['infectious-bursal-disease', 'গাম্বোরো (IBD)', 'Infectious Bursal Disease', 'POUL-IBD', ['Gumboro', 'মুরগি দুর্বল'], true],
    ['infectious-bronchitis', 'ইনফেকশাস ব্রঙ্কাইটিস', 'Infectious Bronchitis', 'POUL-IB', ['কাশি', 'শ্বাস'], false],
    ['fowl-pox', 'ফাউল pox', 'Fowl Pox', 'POUL-FPX', ['চামড়ায় ফোসকা'], false],
    ['salmonellosis-poultry', 'মুরগির সালমোনেলosis', 'Poultry Salmonellosis', 'POUL-SAL', ['ডায়রিয়া', 'মৃত্যু'], false],
    ['coccidiosis-poultry', 'মুরগির কক্সিডিয়োসিস', 'Poultry Coccidiosis', 'POUL-COC', ['রক্ত মিশ্রিত পায়খানা'], false],
    ['avian-influenza', 'এভিয়ান ইনফ্লুয়েঞ্জা', 'Avian Influenza', 'POUL-AI', ['হঠাৎ মৃত্যু', 'মুরগির রোগ'], true],
    ['mycoplasmosis-poultry', 'মাইকোপ্লাজমosis', 'Mycoplasmosis', 'POUL-MYC', ['কাশি', 'শ্বাস'], false],
    ['marek-disease', 'মারেক রোগ', 'Marek Disease', 'POUL-MAR', ['পক্ষাঘাত'], false],
    ['duck-plague', 'হাঁসের plague', 'Duck Plague', 'DUCK-DPV', ['হাঁস মরছে'], true],
  ] as const;

  return defs.map(([slug, titleBn, titleEn, code, colloquial, endemic]) =>
    diseaseRow({
      slug,
      titleBn,
      titleEn,
      species: slug === 'duck-plague' ? ['DUCK'] : ['CHICKEN'],
      diseaseCode: code,
      colloquialBn: [...colloquial],
      endemicBd: endemic,
      sections: diseaseSections(
        titleBn,
        titleEn,
        `${titleBn}: দুর্বলতা, শ্বাস/পাচন লক্ষণ, মৃত্যুহার বাড়তে পারে।`,
        `${titleEn}: weakness, respiratory/GI signs, flock mortality may increase.`,
      ),
    }),
  );
}

export function buildEmergencyRows(): SeederBundleRow[] {
  const defs: Array<{
    slug: string;
    titleBn: string;
    titleEn: string;
    hours: number;
    species: string[];
    colloquial: string[];
    actions: Array<{ bn: string; en: string }>;
    dont: { bn: string; en: string };
  }> = [
    {
      slug: 'acute-bloat',
      titleBn: 'তীব্র পেট ফোলা (Acute Bloat)',
      titleEn: 'Acute Bloat',
      hours: 2,
      species: ['COW', 'BUFFALO'],
      colloquial: ['গরু ফুলে গেল', 'পেট ফোলা', 'হঠাৎ ফুলে'],
      actions: [
        { bn: 'পশুকে শান্ত রাখুন, চলাচল সীমিত করুন।', en: 'Keep the animal calm and limit movement.' },
        { bn: 'তেল/সাবান পানি দেওয়ার আগে পশুচিকিত্সকের পরামর্শ নিন।', en: 'Consult a vet before giving oil/soap drench.' },
      ],
      dont: { bn: 'নিজে থেকে ছুরি/ক্যানুলা ব্যবহার করবেন না।', en: 'Do not perform rumen puncture without veterinary guidance.' },
    },
    {
      slug: 'severe-bleeding',
      titleBn: 'তীব্র রক্তপাত',
      titleEn: 'Severe Bleeding',
      hours: 2,
      species: ['COW', 'BUFFALO', 'GOAT', 'CHICKEN'],
      colloquial: ['রক্ত পড়ছে', 'গরু জরুরি রক্ত'],
      actions: [
        { bn: 'পরিষ্কার কাপড়/ব্যান্ডেজ দিয়ে চাপ দিন।', en: 'Apply clean pressure bandage to bleeding site.' },
        { bn: 'পশুকে শান্ত স্থানে রাখুন।', en: 'Move animal to quiet area.' },
      ],
      dont: { bn: 'অপ্রয়োজনীয় ওষুধ/মাত্রা দেবেন না।', en: 'Do not administer unprescribed drugs or doses.' },
    },
    {
      slug: 'downer-cow-milk-fever',
      titleBn: 'ডাউনার কো/মিল্ক ফিভার',
      titleEn: 'Downer Cow / Milk Fever',
      hours: 4,
      species: ['COW', 'BUFFALO'],
      colloquial: ['গরু পড়ে গেছে'],
      actions: [
        { bn: 'পশুকে স্থিতাবস্থায় রাখুন, সূর্য/বৃষ্টি থেকে রক্ষা করুন।', en: 'Keep animal positioned safely; shelter from weather.' },
        { bn: 'পশুচিকিত্সককে ডাকুন — ক্যালসিয়াম চিকিৎসা প্রয়োজন হতে পারে।', en: 'Call vet — calcium therapy may be required.' },
      ],
      dont: { bn: 'জোর করে দাঁড় করানোর চেষ্টা করবেন না।', en: 'Do not force the animal to stand.' },
    },
    {
      slug: 'acute-hs-crisis',
      titleBn: 'HS তীব্র আক্রমণ',
      titleEn: 'Acute HS Crisis',
      hours: 2,
      species: ['COW', 'BUFFALO'],
      colloquial: ['ঠোট ফোলা', 'HS'],
      actions: [
        { bn: 'আক্রান্ত পশু আলাদা করুন।', en: 'Isolate affected animal.' },
        { bn: 'অবিলম্বে পশুচিকিত্সক ডাকুন।', en: 'Call veterinarian immediately.' },
      ],
      dont: { bn: 'অন্য পশুর সাথে মিশাবেন না।', en: 'Do not mix with healthy herd.' },
    },
    {
      slug: 'nd-acute-flock',
      titleBn: 'ND তীব্র ঝুঁকি (মুরগি)',
      titleEn: 'Acute Newcastle Disease Flock Crisis',
      hours: 4,
      species: ['CHICKEN'],
      colloquial: ['মুরগি মরছে', 'Newcastle'],
      actions: [
        { bn: 'আক্রান্ত পাখি আলাদা/মেরে ফেলুন নীতি অনুযায়ী।', en: 'Isolate/cull per veterinary/public health guidance.' },
        { bn: 'জীবাণুমুক্তি শুরু করুন।', en: 'Begin biosecurity disinfection.' },
      ],
      dont: { bn: 'অসুস্থ পাখির মাংস/ডিম খাবেন না।', en: 'Do not consume products from sick birds.' },
    },
    {
      slug: 'anthrax-suspicion',
      titleBn: 'এনথ্রাক্স সন্দেহ',
      titleEn: 'Anthrax Suspicion',
      hours: 2,
      species: ['COW', 'BUFFALO', 'GOAT'],
      colloquial: ['হঠাৎ মৃত্যু', 'রক্তঝরা'],
      actions: [
        { bn: 'মৃত পশু স্পর্শ/খোলবেন না; কর্তৃপক্ষকে জানান।', en: 'Do not open/touch carcass; notify authorities.' },
        { bn: 'ক্ষেত্রে অন্য পশু আলাদা করুন।', en: 'Separate other animals in the area.' },
      ],
      dont: { bn: 'মৃত পশু খাওয়াবেন/বিক্রি করবেন না।', en: 'Do not butcher or sell affected carcass.' },
    },
    {
      slug: 'rabies-exposure',
      titleBn: 'রেবিস এক্সপোজার',
      titleEn: 'Rabies Exposure',
      hours: 4,
      species: ['COW', 'BUFFALO', 'GOAT', 'CHICKEN'],
      colloquial: ['কুকুর কামড়'],
      actions: [
        { bn: 'আক্রান্ত/সন্দেহভাজন পশু আলাদা করুন।', en: 'Isolate suspect animal.' },
        { bn: 'মানুষ কামড় খেলে হাসপাতাল/চিকিৎসকে জানান।', en: 'Human bite — seek medical care immediately.' },
      ],
      dont: { bn: 'সন্দেহভাজন পশুর লালা/টিস্যু স্পর্শ করবেন না।', en: 'Avoid contact with saliva/tissues of suspect animal.' },
    },
    {
      slug: 'organophosphate-poisoning',
      titleBn: 'অর্গানofosফেট বিষক্রিয়া',
      titleEn: 'Organophosphate Poisoning',
      hours: 2,
      species: ['COW', 'GOAT', 'CHICKEN'],
      colloquial: ['বিষ', 'কীটনাশক'],
      actions: [
        { bn: 'উৎস (কীটনাশক) সরিয়ে ফেলুন।', en: 'Remove poison source (pesticide).' },
        { bn: 'পশুচিকিত্সককে জানান — জরুরি চিকিৎসা প্রয়োজন।', en: 'Contact vet for emergency treatment.' },
      ],
      dont: { bn: 'নিজে থেকে অ্যান্টিডোট/মাত্রা দেবেন না।', en: 'Do not give antidote/dose without vet.' },
    },
    {
      slug: 'heat-stroke-livestock',
      titleBn: 'হিট স্ট্রোক',
      titleEn: 'Heat Stroke',
      hours: 4,
      species: ['COW', 'BUFFALO', 'GOAT'],
      colloquial: ['গরমে অসুস্থ'],
      actions: [
        { bn: 'ছায়া/বাতাসে নিন, ঠান্ডা পানি স্প্রে/স্নান।', en: 'Move to shade/ventilation; cool with water.' },
        { bn: 'পani access নিশ্চিত করুন।', en: 'Ensure water access.' },
      ],
      dont: { bn: 'ভ heavy exercise করাবেন না।', en: 'Do not force exercise.' },
    },
    {
      slug: 'dystocia',
      titleBn: 'ডিস্টোসিয়া (কঠিন প্রসব)',
      titleEn: 'Dystocia',
      hours: 2,
      species: ['COW', 'GOAT', 'BUFFALO'],
      colloquial: ['বাছা হচ্ছে না', 'গরু ঝরা'],
      actions: [
        { bn: 'পশুকে শান্ত রাখুন, পরিষ্কার স্থানে রাখুন।', en: 'Keep animal calm in clean area.' },
        { bn: 'পশুচিকিত্সক/AI technician ডাকুন।', en: 'Call veterinarian or trained attendant.' },
      ],
      dont: { bn: 'জোর করে টানবেন না।', en: 'Do not forcefully pull the calf/kid.' },
    },
    {
      slug: 'snake-envenomation',
      titleBn: 'সাপের বিষ',
      titleEn: 'Snake Envenomation',
      hours: 2,
      species: ['COW', 'GOAT', 'BUFFALO'],
      colloquial: ['সাপ কামড়'],
      actions: [
        { bn: 'পশুকে স্থির রাখুন, কামড়ের স্থান চিহ্নিত করুন।', en: 'Keep still; mark bite site.' },
        { bn: 'পশুচিকিত্সক ডাকুন।', en: 'Call veterinarian.' },
      ],
      dont: { bn: 'কাট/চুষবেন না।', en: 'Do not cut or suck wound.' },
    },
    {
      slug: 'traumatic-injury',
      titleBn: 'তীব্র আঘাত',
      titleEn: 'Traumatic Injury',
      hours: 2,
      species: ['COW', 'BUFFALO', 'GOAT', 'CHICKEN'],
      colloquial: ['গরু মরে যাচ্ছে', 'জরুরি'],
      actions: [
        { bn: 'রক্তপাত বন্ধ করুন, পশুকে স্থানান্তর করুন।', en: 'Control bleeding; stabilize for transport.' },
        { bn: 'পশুচিকিত্সক/কlinicে নিন।', en: 'Transport to veterinary care.' },
      ],
      dont: { bn: 'ভ heavy sedation/ওষুধ দেবেন না।', en: 'Do not give unprescribed sedatives/drugs.' },
    },
    {
      slug: 'hypothermia-flood-livestock',
      titleBn: 'বন্যা/ঠান্ডায় হাইপোথার্মিয়া',
      titleEn: 'Flood/Hypothermia',
      hours: 6,
      species: ['COW', 'GOAT', 'BUFFALO', 'CHICKEN'],
      colloquial: ['বন্যা', 'ঠান্ডা'],
      actions: [
        { bn: 'শুকনো/উষ্ণ স্থানে নিন, ভেজা কোট শুকান।', en: 'Dry shelter; warm dry bedding.' },
        { bn: 'উষ্ণ পানি/খাদ্য দিন।', en: 'Provide warm water and feed.' },
      ],
      dont: { bn: 'তীব্র উত্তাপ/আগুনে খুব কাছে রাখবেন না।', en: 'Avoid extreme direct heat.' },
    },
    {
      slug: 'acute-severe-diarrhea-dehydration',
      titleBn: 'তীব্র ডায়রিয়া ও পানিশূন্যতা',
      titleEn: 'Acute Severe Diarrhea / Dehydration',
      hours: 4,
      species: ['COW', 'GOAT', 'BUFFALO', 'CHICKEN'],
      colloquial: ['ডায়রিয়া', 'পাতলা পায়খানা'],
      actions: [
        { bn: 'ORS/প electrolyte পani access দিন (species অনুযায়ী)।', en: 'Provide oral electrolytes/water access per species.' },
        { bn: 'আক্রান্ত পশু আলাদা করুন।', en: 'Isolate affected animals.' },
      ],
      dont: { bn: 'মানুষের ওষুধ/অ্যান্টিবায়োটিক দেবেন না।', en: 'Do not give human antibiotics unprescribed.' },
    },
    {
      slug: 'unknown-acute-collapse',
      titleBn: 'অজানা তীব্র পতন',
      titleEn: 'Unknown Acute Collapse',
      hours: 2,
      species: ['COW', 'BUFFALO', 'GOAT', 'CHICKEN'],
      colloquial: ['গরু মরে যাচ্ছে', 'হঠাৎ পড়ে'],
      actions: [
        { bn: 'পশুকে নিরাপদ স্থানে রাখুন।', en: 'Place animal in safe position.' },
        { bn: 'অবিলম্বে পশুচিকিত্সক ডাকুন।', en: 'Call veterinarian immediately.' },
      ],
      dont: { bn: 'কারণ না জেনে ওষুধ দেবেন না।', en: 'Do not medicate without diagnosis.' },
    },
  ];

  return defs.map((d) => {
    const { bodyBn, bodyEn } = bodyFromSections(emergencySections(d.actions, d.dont.bn, d.dont.en));
    return {
      slug: d.slug,
      domain: 'EMERGENCY',
      entityType: 'EmergencyCondition',
      titleBn: d.titleBn,
      titleEn: d.titleEn,
      bodyBn,
      bodyEn,
      species: d.species,
      audience: 'FARMER',
      regionScope: 'BD',
      clinicalRiskTier: 'CRITICAL',
      chunkPolicyId: 'EMERGENCY_BY_ACTION',
      colloquialBn: d.colloquial,
      structuredJson: {
        vetRequiredWithinHours: d.hours,
        onsetSpeed: 'acute',
        homeStabilizationAllowed: true,
      },
      sourceSpanRefs: SPAN,
    } satisfies SeederBundleRow;
  });
}

export function buildVaccineRows(): SeederBundleRow[] {
  const vaccines = [
    ['fmd-vaccine', 'FMD ভ্যাকসিন', 'FMD Vaccine', 'FMD', ['COW', 'BUFFALO']],
    ['hs-vaccine', 'HS ভ্যাকসিন', 'HS Vaccine', 'HS', ['COW', 'BUFFALO']],
    ['bq-vaccine', 'BQ ভ্যাকসিন', 'BQ Vaccine', 'BQ', ['COW']],
    ['ppr-vaccine', 'PPR ভ্যাকসিন', 'PPR Vaccine', 'PPR', ['GOAT']],
    ['nd-vaccine', 'Newcastle ভ্যাকসিন', 'Newcastle Vaccine', 'ND', ['CHICKEN']],
    ['ibd-vaccine', 'Gumboro ভ্যাকসিন', 'IBD Vaccine', 'IBD', ['CHICKEN']],
  ] as const;

  const vaccineRows: SeederBundleRow[] = vaccines.map(([slug, titleBn, titleEn, antigen, species]) => ({
    slug,
    domain: 'VACCINE',
    entityType: 'Vaccine',
    titleBn,
    titleEn,
    bodyBn: `## Storage\n\n${titleBn} ২–৮°C এ সংরক্ষণ করুন।\n\n## Handling\n\nহিমায়িত/তাপ থেকে রক্ষা করুন।`,
    bodyEn: `## Storage\n\nStore ${titleEn} at 2–8°C.\n\n## Handling\n\nProtect from freezing and heat.`,
    species: [...species],
    regionScope: 'BD',
    clinicalRiskTier: 'HIGH',
    chunkPolicyId: 'VACCINE_BY_SCHEDULE_ROW',
    structuredJson: { antigen, route: 'IM/SC', doseMl: 2, storageTempC: 4 },
    sourceSpanRefs: SPAN,
  }));

  const schedules = [
    ['cattle-fmd-schedule', 'গরুর FMD টিকা সূচি', 'Cattle FMD Schedule', 'FMD', 'COW', '৩–৬ মাস', 180],
    ['cattle-hs-bq-schedule', 'গরুর HS/BQ সূচি', 'Cattle HS/BQ Schedule', 'HS/BQ', 'COW', '৪–৬ মাস', 365],
    ['buffalo-fmd-schedule', 'মহিষ FMD সূচি', 'Buffalo FMD Schedule', 'FMD', 'BUFFALO', '৬ মাস', 180],
    ['goat-ppr-schedule', 'ছাগল PPR সূচি', 'Goat PPR Schedule', 'PPR', 'GOAT', '৩–৪ মাস', 365],
    ['poultry-nd-schedule', 'মুরগি ND সূচি', 'Poultry ND Schedule', 'ND', 'CHICKEN', '১–৭ দিন', 60],
    ['poultry-ibd-schedule', 'মুরগি IBD সূচি', 'Poultry IBD Schedule', 'IBD', 'CHICKEN', '১৪–২১ দিন', 0],
    ['farm-annual-vaccination-calendar', 'বার্ষিক টিকা ক্যালেন্ডার', 'Annual Vaccination Calendar', 'MULTI', 'COW', 'বছরে ২ বার', 180],
  ] as const;

  const scheduleRows: SeederBundleRow[] = schedules.map(
    ([slug, titleBn, titleEn, antigen, species, ageWindow, booster]) => ({
      slug,
      domain: 'VACCINE',
      entityType: 'VaccinationSchedule',
      titleBn,
      titleEn,
      bodyBn: `## Schedule\n\nবয়স: ${ageWindow}। বুস্টার: ${booster > 0 ? `${booster} দিন` : 'প্রয়োজন অনুযায়ী'}। DLS জাতীয় সূচি অনুসরণ করুন।`,
      bodyEn: `## Schedule\n\nAge window: ${ageWindow}. Booster interval: ${booster > 0 ? `${booster} days` : 'as required'}. Follow DLS national calendar.`,
      species: [species],
      audience: 'FARMER',
      regionScope: 'BD',
      clinicalRiskTier: 'HIGH',
      chunkPolicyId: 'VACCINE_BY_SCHEDULE_ROW',
      colloquialBn: ['টিকা', 'vaccination', 'vaccine schedule', 'গরুর টিকা কখন'],
      keywordsBn: ['টিকা', 'vaccination schedule'],
      structuredJson: {
        antigen,
        ageWindow,
        boosterIntervalDays: booster,
        route: 'IM/SC',
      },
      sourceSpanRefs: SPAN,
    }),
  );

  return [...vaccineRows, ...scheduleRows];
}

export function buildFeedRows(): SeederBundleRow[] {
  const ingredients = [
    ['green-grass', 'সবুজ ঘাস', 'Green Grass', 'GRN-GRS', 20, 8, 55],
    ['rice-straw', 'ধানের খড়', 'Rice Straw', 'RICE-STR', 85, 4, 45],
    ['maize-grain', 'ভুট্টা দানা', 'Maize Grain', 'MAIZE', 88, 9, 85],
    ['maize-germ-meal', 'ভুট্টা ভুষি', 'Maize Germ Meal', 'MAIZE-GM', 90, 18, 80],
    ['wheat-bran', 'গমের ভুসি', 'Wheat Bran', 'WHT-BRN', 88, 15, 70],
    ['rice-bran', 'চালের কুঁড়া', 'Rice Bran', 'RICE-BRN', 90, 12, 65],
    ['soybean-meal', 'সয়াবিন মিল', 'Soybean Meal', 'SOY-ML', 90, 44, 75],
    ['mustard-oil-cake', 'সরিষার খৈল', 'Mustard Oil Cake', 'MOC', 92, 38, 70],
    ['commercial-poultry-feed', 'বাণিজ্যিক মুরগির খাদ্য', 'Commercial Poultry Feed', 'CPF', 90, 20, 75],
  ] as const;

  const ingredientRows = ingredients.map(([slug, titleBn, titleEn, code, dm, cp, tdn]) => ({
    slug,
    domain: 'FEED' as const,
    entityType: 'FeedIngredient',
    titleBn,
    titleEn,
    bodyBn: `## Composition\n\nশুষ্ক পদার্থ ${dm}%, কা crude protein ${cp}%, TDN ${tdn}% (BAU সারণী অনুযায়ী)।`,
    bodyEn: `## Composition\n\nDM ${dm}%, CP ${cp}%, TDN ${tdn}% (BAU composition table reference).`,
    regionScope: 'BD',
    clinicalRiskTier: 'LOW' as const,
    structuredJson: { ingredientCode: code, dmPercent: dm, cpPercent: cp, tdnPercent: tdn },
    sourceSpanRefs: SPAN,
  }));

  const nutrients = [
    ['cattle-lactating-requirement', 'দুগ্ধবতী গরুর পুষ্টি', 'Lactating Cow Requirements', 'COW', 14, 16],
    ['poultry-broiler-requirement', 'ব্রয়লার মুরগির পুষ্টি', 'Broiler Nutrient Requirements', 'CHICKEN', 22, 20],
    ['goat-growing-requirement', 'ব-growing ছাগলের পুষ্টি', 'Growing Goat Requirements', 'GOAT', 12, 14],
  ] as const;

  const nutrientRows = nutrientRowsFrom(nutrients);

  const toxic = [
    ['aflatoxin-alert', 'আফলাটок্সিন সতর্কতা', 'Aflatoxin Alert', 'AFL', 'HIGH'],
    ['urea-toxicity-alert', 'ইউরিয়া বিষক্রিয়া', 'Urea Toxicity', 'UREA', 'HIGH'],
    ['moldy-feed-alert', 'ছাঁচযুক্ত খাদ্য', 'Moldy Feed Alert', 'MOLD', 'HIGH'],
  ] as const;

  const toxicRows = toxic.map(([slug, titleBn, titleEn, code, tier]) => ({
    slug,
    domain: 'FEED' as const,
    entityType: 'ToxicFeedAlert',
    titleBn,
    titleEn,
    bodyBn: `## Signs\n\n${titleBn}: দুর্বলতা, খাবার বর্জন, জ্বর/liver লক্ষণ হতে পারে।\n\n## Immediate Action\n\nসন্দেহ হলে খাদ্য বন্ধ করুন, পশুচিকিত্সক ডাকুন।`,
    bodyEn: `## Signs\n\n${titleEn}: weakness, feed refusal, systemic signs possible.\n\n## Immediate Action\n\nStop suspect feed; call veterinarian.`,
    regionScope: 'BD',
    clinicalRiskTier: tier as 'HIGH',
    structuredJson: { ingredientCode: code },
    sourceSpanRefs: SPAN,
  }));

  const ration = {
    slug: 'cattle-lactating-ration-template',
    domain: 'FEED' as const,
    entityType: 'RationTemplate',
    titleBn: 'দুগ্ধবতী গরুর খাদ্য হিসাব',
    titleEn: 'Lactating Cow Ration Template',
    bodyBn:
      '## Ration\n\nঘাস ৫০%, ভুট্টা/ভুসি ৩০%, প্রোটিন সাপ্লিমেন্ট ২০% (খামার অনুযায়ী)।\n\n## Calculation\n\nগরুর খাদ্য হিসাব daily DM ও CP requirement মেনে করুন।',
    bodyEn:
      '## Ration\n\nForage 50%, energy concentrate 30%, protein supplement 20% (farm-adjusted).\n\n## Calculation\n\nCompute cattle feed ration from daily DM and CP requirements.',
    species: ['COW'],
    regionScope: 'BD',
    clinicalRiskTier: 'LOW' as const,
    colloquialBn: ['খাদ্য হিসাব', 'গরুর খাদ্য', 'ration'],
    keywordsBn: ['খাদ্য হিসাব', 'ration', 'দুগ্ধবতী'],
    structuredJson: { ingredientCode: 'RAT-LAC' },
    sourceSpanRefs: SPAN,
  };

  const enrichedNutrients = nutrientRows.map((row) => {
    if (row.slug !== 'cattle-lactating-requirement') return row;
    return {
      ...row,
      colloquialBn: ['খাদ্য হিসাব', 'গরুর খাদ্য', 'lactating requirement'],
      keywordsBn: ['খাদ্য', 'হিসাব', 'দুগ্ধবতী গরু'],
    };
  });

  const enrichedIngredients = ingredientRows.map((row) => {
    if (row.slug === 'rice-bran') {
      return {
        ...row,
        colloquialBn: ['ভুসি', 'চালের কুঁড়া'],
        keywordsBn: ['rice bran', 'ভুসি'],
      };
    }
    if (row.slug === 'green-grass') {
      return { ...row, colloquialBn: ['সবুজ ঘাস'], keywordsBn: ['green grass', 'ঘাস'] };
    }
    return row;
  });

  return [...enrichedIngredients, ...enrichedNutrients, ...toxicRows, ration];
}

function nutrientRowsFrom(
  items: ReadonlyArray<readonly [string, string, string, string, number, number]>,
): SeederBundleRow[] {
  return items.map(([slug, titleBn, titleEn, species, cpMin, energy]) => ({
    slug,
    domain: 'FEED',
    entityType: 'NutrientRequirement',
    titleBn,
    titleEn,
    bodyBn: `## Requirements\n\nন্যূনতম CP ${cpMin}%, শক্তি ${energy} Mcal/kg DM (species-stage matrix)।`,
    bodyEn: `## Requirements\n\nMinimum CP ${cpMin}%, energy ${energy} Mcal/kg DM.`,
    species: [species],
    regionScope: 'BD',
    clinicalRiskTier: 'LOW',
    structuredJson: { ingredientCode: slug.toUpperCase(), cpPercent: cpMin, energyMcal: energy },
    sourceSpanRefs: SPAN,
  }));
}

export function buildBiosecurityRows(): SeederBundleRow[] {
  const measures: Array<{
    slug: string;
    titleBn: string;
    titleEn: string;
    code: string;
    entityType: 'BiosecurityMeasure' | 'SOP';
  }> = [
    {
      slug: 'poultry-farm-entry-biosecurity',
      titleBn: 'মুরগি খামার প্রবেশ নিয়ন্ত্রণ',
      titleEn: 'Poultry Farm Entry Biosecurity',
      code: 'BIO-POU-01',
      entityType: 'BiosecurityMeasure',
    },
    {
      slug: 'cattle-quarantine-new-stock',
      titleBn: 'নতুন গরু কোয়ারেন্টাইন',
      titleEn: 'Cattle Quarantine for New Stock',
      code: 'BIO-COW-01',
      entityType: 'BiosecurityMeasure',
    },
    {
      slug: 'footbath-disinfection-protocol',
      titleBn: 'ফুটবাথ জীবাণুমুক্তি',
      titleEn: 'Footbath Disinfection',
      code: 'BIO-FTB-01',
      entityType: 'BiosecurityMeasure',
    },
    {
      slug: 'nd-flock-response-sop',
      titleBn: 'ND ঝুঁকি SOP',
      titleEn: 'ND Flock Response SOP',
      code: 'SOP-ND-01',
      entityType: 'SOP',
    },
  ];

  return measures.map(({ slug, titleBn, titleEn, code, entityType }) => {
    const steps = [
      { bn: 'আক্রান্ত/সন্দেহভাজন পশু আলাদা করুন।', en: 'Isolate suspect animals.' },
      { bn: 'জীবাণুমুক্তি ও সরঞ্জাম পরিষ্কার করুন।', en: 'Disinfect equipment and entry points.' },
      { bn: 'পশুচিকিত্সক/উপজেলা DLS-কে জানান।', en: 'Notify veterinarian or local DLS office.' },
      { bn: 'নতুন পশু প্রবেশে কোয়ারেন্টাইন মেনে চলুন।', en: 'Maintain quarantine for new introductions.' },
    ];
    const { bodyBn, bodyEn } = bodyFromSections(
      steps.map((s, i) => ({ heading: `Step ${i + 1}`, bn: s.bn, en: s.en })),
    );
    return {
      slug,
      domain: 'CLINICAL_PROTOCOL',
      entityType,
      titleBn,
      titleEn,
      bodyBn,
      bodyEn,
      audience: 'BOTH',
      regionScope: 'BD',
      clinicalRiskTier: entityType === 'SOP' ? ('HIGH' as const) : ('MEDIUM' as const),
      chunkPolicyId: 'PROTOCOL_BY_STEP',
      structuredJson: { procedureCode: code, ppeRequired: true, steps: steps.length },
      sourceSpanRefs: SPAN,
    } satisfies SeederBundleRow;
  });
}

export function buildWave1CorpusRows(): SeederBundleRow[] {
  return [
    ...buildCattleDiseaseRows(),
    ...buildGoatDiseaseRows(),
    ...buildPoultryDiseaseRows(),
    ...buildEmergencyRows(),
    ...buildVaccineRows(),
    ...buildFeedRows(),
    ...buildBiosecurityRows(),
  ];
}
