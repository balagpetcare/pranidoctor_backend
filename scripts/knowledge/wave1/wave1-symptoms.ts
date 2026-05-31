import { getPrisma } from '../../../src/shared/database/prisma.js';

type SymptomDef = {
  code: string;
  labelBn: string;
  labelEn: string;
  species: string[];
  redFlag?: boolean;
  diseaseSlugs: string[];
};

const WAVE1_SYMPTOMS: SymptomDef[] = [
  {
    code: 'fever',
    labelBn: 'জ্বর',
    labelEn: 'Fever',
    species: ['COW', 'BUFFALO', 'GOAT', 'CHICKEN'],
    diseaseSlugs: [
      'hemorrhagic-septicemia',
      'pneumonia-bovine',
      'theileriosis',
      'babesiosis',
      'foot-and-mouth-disease',
      'ppr',
      'newcastle-disease',
    ],
  },
  {
    code: 'diarrhea',
    labelBn: 'ডায়রিয়া',
    labelEn: 'Diarrhea',
    species: ['GOAT', 'COW', 'CHICKEN'],
    diseaseSlugs: ['coccidiosis-goat', 'coccidiosis-poultry', 'salmonellosis-poultry'],
  },
  {
    code: 'mastitis-signs',
    labelBn: 'দুধ গলে / আদর ফোলা',
    labelEn: 'Mastitis signs',
    species: ['COW', 'BUFFALO'],
    diseaseSlugs: ['mastitis', 'udder-oedema', 'mastitis-goat'],
  },
  {
    code: 'lameness',
    labelBn: 'খুর ব্যথা / লঙ্গুর',
    labelEn: 'Lameness',
    species: ['COW', 'BUFFALO', 'GOAT'],
    diseaseSlugs: ['foot-rot', 'laminitis', 'foot-rot-goat', 'foot-and-mouth-disease'],
  },
  {
    code: 'inappetence',
    labelBn: 'খাবার খায় না',
    labelEn: 'Inappetence',
    species: ['COW', 'BUFFALO'],
    diseaseSlugs: ['ketosis', 'mastitis', 'pneumonia-bovine', 'theileriosis'],
  },
  {
    code: 'bleeding',
    labelBn: 'রক্ত পড়ছে',
    labelEn: 'Bleeding',
    species: ['COW', 'BUFFALO', 'GOAT', 'CHICKEN'],
    redFlag: true,
    diseaseSlugs: ['severe-bleeding', 'traumatic-injury', 'anthrax'],
  },
  {
    code: 'abortion',
    labelBn: 'ঝরা / গর্ভপাত',
    labelEn: 'Abortion',
    species: ['COW', 'BUFFALO', 'GOAT'],
    diseaseSlugs: ['brucellosis', 'retained-placenta', 'metritis'],
  },
  {
    code: 'respiratory-distress',
    labelBn: 'শ্বাসকষ্ট',
    labelEn: 'Respiratory distress',
    species: ['CHICKEN', 'COW'],
    redFlag: true,
    diseaseSlugs: [
      'newcastle-disease',
      'infectious-bronchitis',
      'pneumonia-bovine',
      'hemorrhagic-septicemia',
      'avian-influenza',
    ],
  },
  {
    code: 'bloat-signs',
    labelBn: 'পেট ফোলা',
    labelEn: 'Bloat',
    species: ['COW', 'BUFFALO'],
    redFlag: true,
    diseaseSlugs: ['acute-bloat', 'enterotoxemia', 'enterotoxemia-goat'],
  },
  {
    code: 'sudden-death',
    labelBn: 'হঠাৎ মৃত্যু',
    labelEn: 'Sudden death',
    species: ['COW', 'CHICKEN', 'GOAT'],
    redFlag: true,
    diseaseSlugs: ['anthrax', 'blackleg', 'newcastle-disease', 'avian-influenza', 'enterotoxemia-goat', 'unknown-acute-collapse', 'severe-bleeding', 'acute-hs-crisis'],
  },
  {
    code: 'collapse',
    labelBn: 'পড়ে গেছে / দুর্বল',
    labelEn: 'Collapse / downer',
    species: ['COW', 'BUFFALO'],
    redFlag: true,
    diseaseSlugs: ['downer-cow-milk-fever', 'milk-fever', 'traumatic-injury', 'acute-hs-crisis', 'unknown-acute-collapse', 'severe-bleeding'],
  },
  {
    code: 'vaccination',
    labelBn: 'টিকা / vaccination',
    labelEn: 'Vaccination timing',
    species: ['COW', 'BUFFALO', 'GOAT', 'CHICKEN'],
    diseaseSlugs: [
      'cattle-fmd-schedule',
      'cattle-hs-bq-schedule',
      'poultry-nd-schedule',
      'goat-ppr-schedule',
      'farm-annual-vaccination-calendar',
    ],
  },
  {
    code: 'chills',
    labelBn: 'কাঁপুনি',
    labelEn: 'Chills / shivering',
    species: ['COW', 'BUFFALO'],
    diseaseSlugs: ['hemorrhagic-septicemia', 'theileriosis', 'milk-fever'],
  },
  {
    code: 'nasal-discharge',
    labelBn: 'নাক থেকে স্রাব',
    labelEn: 'Nasal discharge',
    species: ['COW', 'CHICKEN'],
    diseaseSlugs: ['hemorrhagic-septicemia', 'pneumonia-bovine', 'newcastle-disease', 'infectious-bronchitis'],
  },
];

async function upsertSymptomGraph(defs: SymptomDef[]): Promise<{ nodes: number; links: number }> {
  let nodes = 0;
  let links = 0;

  for (const def of defs) {
    const node = await getPrisma().aiSymptomNode.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        species: def.species as never,
        bodySystem: 'GENERAL',
        labelBn: def.labelBn,
        labelEn: def.labelEn,
        redFlag: def.redFlag ?? false,
        weight: def.redFlag ? 0.9 : 0.6,
      },
      update: {
        labelBn: def.labelBn,
        labelEn: def.labelEn,
        redFlag: def.redFlag ?? false,
        species: def.species as never,
      },
    });
    nodes += 1;

    for (const slug of def.diseaseSlugs) {
      const entry = await getPrisma().aiKnowledgeEntry.findUnique({ where: { slug } });
      if (!entry) continue;

      await getPrisma().aiSymptomDiseaseLink.upsert({
        where: {
          symptomNodeId_knowledgeEntryId: {
            symptomNodeId: node.id,
            knowledgeEntryId: entry.id,
          },
        },
        create: {
          symptomNodeId: node.id,
          knowledgeEntryId: entry.id,
          edgeWeight: def.redFlag ? 0.85 : 0.65,
        },
        update: {
          edgeWeight: def.redFlag ? 0.85 : 0.65,
        },
      });
      links += 1;
    }
  }

  return { nodes, links };
}

export async function seedWave1Symptoms(): Promise<{ nodes: number; links: number }> {
  return upsertSymptomGraph(WAVE1_SYMPTOMS);
}

/** Phase 6E.2 enriched symptom graph (≥72 link target when corpus published). */
export async function seedWave1SymptomsEnriched(): Promise<{ nodes: number; links: number }> {
  return upsertSymptomGraph(WAVE1_SYMPTOMS);
}
