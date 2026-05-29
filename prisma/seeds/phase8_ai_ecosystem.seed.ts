import {
  AiKnowledgeContentType,
  AiKnowledgeStatus,
  LivestockSpecies,
} from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

const SYMPTOM_SEED = [
  { code: 'cattle_bloat', species: [LivestockSpecies.CATTLE, LivestockSpecies.BUFFALO], bodySystem: 'digestive', labelBn: 'পেট ফোলা/আধমরা', labelEn: 'Bloat/distended abdomen', redFlag: true, weight: 0.95 },
  { code: 'cattle_milk_drop', species: [LivestockSpecies.CATTLE, LivestockSpecies.BUFFALO], bodySystem: 'general', labelBn: 'দুধ কমে যাওয়া', labelEn: 'Milk production drop', redFlag: false, weight: 0.6 },
  { code: 'cattle_fever', species: [LivestockSpecies.CATTLE, LivestockSpecies.BUFFALO], bodySystem: 'general', labelBn: 'উচ্চ জ্বর', labelEn: 'High fever', redFlag: true, weight: 0.85 },
  { code: 'cattle_lameness', species: [LivestockSpecies.CATTLE, LivestockSpecies.BUFFALO], bodySystem: 'locomotion', labelBn: 'খোঁচাখুঁটি/অঙ্গবিকল', labelEn: 'Lameness', redFlag: false, weight: 0.65 },
  { code: 'goat_scours', species: [LivestockSpecies.GOAT], bodySystem: 'digestive', labelBn: 'ডায়রিয়া/পাতলা পায়খানা', labelEn: 'Scours/diarrhea', redFlag: false, weight: 0.7 },
  { code: 'goat_respiratory', species: [LivestockSpecies.GOAT], bodySystem: 'respiratory', labelBn: 'শ্বাসকষ্ট/কাশি', labelEn: 'Breathing difficulty/cough', redFlag: true, weight: 0.8 },
  { code: 'poultry_drop_eggs', species: [LivestockSpecies.POULTRY], bodySystem: 'production', labelBn: 'ডিম উৎপাদন কমে যাওয়া', labelEn: 'Drop in egg production', redFlag: false, weight: 0.55 },
  { code: 'poultry_unconscious', species: [LivestockSpecies.POULTRY, LivestockSpecies.DUCK], bodySystem: 'general', labelBn: 'অচেতন/পড়ে যাওয়া', labelEn: 'Unconscious/collapse', redFlag: true, weight: 0.95 },
];

const KNOWLEDGE_SEED = [
  {
    slug: 'cattle-bloat',
    contentType: AiKnowledgeContentType.DISEASE,
    titleBn: 'গরু/মহিষের আধমরা (Bloat)',
    titleEn: 'Bloat in cattle/buffalo',
    bodyBn: 'পেট ফোলা জরুরি অবস্থা হতে পারে। পশুকে শান্ত রাখুন, চিকিৎসক ডাকুন।',
    bodyEn: 'Abdominal distension may be an emergency. Keep the animal calm and call a veterinarian.',
    species: [LivestockSpecies.CATTLE, LivestockSpecies.BUFFALO],
  },
  {
    slug: 'goat-enterotoxemia',
    contentType: AiKnowledgeContentType.DISEASE,
    titleBn: 'ছাগলের Enterotoxemia',
    titleEn: 'Enterotoxemia in goats',
    bodyBn: 'হঠাৎ পাতলা পায়খানা ও দুর্বলতা দেখaলে দ্রুত চিকিৎসকের পরামর্শ নিন।',
    bodyEn: 'Sudden scours and weakness require urgent veterinary attention.',
    species: [LivestockSpecies.GOAT],
  },
  {
    slug: 'poultry-newcastle',
    contentType: AiKnowledgeContentType.DISEASE,
    titleBn: 'নিউক্যাসল রোগ (মুরগি)',
    titleEn: 'Newcastle disease (poultry)',
    bodyBn: 'শ্বাসকষ্ট, স্নায়বিক লক্ষণ — Изоляция ও টিকা পরিকল্পনা গুরুত্বপূর্ণ।',
    bodyEn: 'Respiratory and nervous signs — isolation and vaccination planning are important.',
    species: [LivestockSpecies.POULTRY],
  },
  {
    slug: 'emergency-heat-stress',
    contentType: AiKnowledgeContentType.EMERGENCY,
    titleBn: 'তাপপ্রপ্তি',
    titleEn: 'Heat stress',
    bodyBn: 'ছায়া, পর্যাপ্ত পানি, বায়ু চলাচল নিশ্চিত করুন। গুরুতর হলে চিকিৎসক ডাকুন।',
    bodyEn: 'Provide shade, water, and ventilation. Call a vet if severe.',
    species: [LivestockSpecies.CATTLE, LivestockSpecies.BUFFALO, LivestockSpecies.GOAT],
  },
];

export async function seedPhase8AiEcosystem(): Promise<void> {
  const prisma = getPrisma();

  for (const s of SYMPTOM_SEED) {
    await prisma.aiSymptomNode.upsert({
      where: { code: s.code },
      create: s,
      update: {
        labelBn: s.labelBn,
        labelEn: s.labelEn,
        redFlag: s.redFlag,
        weight: s.weight,
      },
    });
  }

  for (const k of KNOWLEDGE_SEED) {
    const searchText = `${k.titleBn} ${k.titleEn} ${k.bodyBn} ${k.bodyEn}`.toLowerCase();
    const entry = await prisma.aiKnowledgeEntry.upsert({
      where: { slug: k.slug },
      create: {
        ...k,
        searchText,
        status: AiKnowledgeStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      update: { searchText, status: AiKnowledgeStatus.PUBLISHED },
    });

    const symptomCode =
      k.slug === 'cattle-bloat'
        ? 'cattle_bloat'
        : k.slug === 'goat-enterotoxemia'
          ? 'goat_scours'
          : k.slug === 'poultry-newcastle'
            ? 'poultry_drop_eggs'
            : null;

    if (symptomCode) {
      const node = await prisma.aiSymptomNode.findUnique({ where: { code: symptomCode } });
      if (node) {
        await prisma.aiSymptomDiseaseLink.upsert({
          where: {
            symptomNodeId_knowledgeEntryId: {
              symptomNodeId: node.id,
              knowledgeEntryId: entry.id,
            },
          },
          create: {
            symptomNodeId: node.id,
            knowledgeEntryId: entry.id,
            edgeWeight: 0.8,
          },
          update: { edgeWeight: 0.8 },
        });
      }
    }
  }
}
