import {
  AiKnowledgeChunkStage,
  AiKnowledgeEmbeddingStatus,
  AiKnowledgeStatus,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import { getKnowledgeEmbeddingPipelineService } from '../embedding/embedding-pipeline.service.js';

/** G1-priority micro-summary chunks for retrieval precision (Phase 6E.2). */
export type MicroSummaryDef = {
  slug: string;
  summaries: Array<{ headingPath: string; contentBn: string; contentEn: string }>;
};

export const G1_MICRO_SUMMARY_DEFS: MicroSummaryDef[] = [
  {
    slug: 'hemorrhagic-septicemia',
    summaries: [
      {
        headingPath: 'Retrieval > Fever DDx',
        contentBn: 'গরু জ্বর করলে HS (হেমরেজিক সেপ্টিসেমিয়া) সন্দেহ — ঠোট ফোলা, শ্বাসকষ্ট, হঠাৎ পতন।',
        contentEn: 'Cattle fever with swollen throat — suspect hemorrhagic septicemia (HS).',
      },
      {
        headingPath: 'Retrieval > Colloquial',
        contentBn: 'বাংলাদেশে গরু জ্বর ও ঠোট ফোলা হলে প্রথমে HS বিবেচনা করুন।',
        contentEn: 'In BD, cattle fever with throat swelling — prioritize HS differential.',
      },
    ],
  },
  {
    slug: 'pneumonia-bovine',
    summaries: [
      {
        headingPath: 'Retrieval > Fever DDx',
        contentBn: 'গরু জ্বর + কাশি/শ্বাসকষ্ট — বোভাইন নিউমোনিয়া DDx।',
        contentEn: 'Cattle fever with cough or dyspnea — bovine pneumonia differential.',
      },
    ],
  },
  {
    slug: 'theileriosis',
    summaries: [
      {
        headingPath: 'Retrieval > Fever DDx',
        contentBn: 'টিক এলাকায় গরু জ্বর, হলুদ চোখ — থাইলেরিয়োসিস (টিক জ্বর)।',
        contentEn: 'Tick-endemic area cattle fever with icterus — theileriosis.',
      },
    ],
  },
  {
    slug: 'babesiosis',
    summaries: [
      {
        headingPath: 'Retrieval > Fever DDx',
        contentBn: 'জ্বর, anemia, লাল প্রস্রাব — বেবেসিয়োসিস (টিক জ্বর)।',
        contentEn: 'Fever, anemia, red urine — babesiosis tick fever.',
      },
    ],
  },
  {
    slug: 'newcastle-disease',
    summaries: [
      {
        headingPath: 'Retrieval > Poultry Signs',
        contentBn: 'মুরগির ND লক্ষণ: শ্বাসকষ্ট, মাথা ঝুলে, স্নায়বিক লক্ষণ, দ্রুত মৃত্যু।',
        contentEn: 'Newcastle disease signs: respiratory distress, twisted neck, flock mortality.',
      },
      {
        headingPath: 'Retrieval > Colloquial',
        contentBn: 'মুরগি মরছে, ND সন্দেহ — দ্রুত পশুচিকিত্সক/DAE জানান।',
        contentEn: 'Suspect ND when chickens die rapidly — notify vet/DAE.',
      },
    ],
  },
  {
    slug: 'retained-placenta',
    summaries: [
      {
        headingPath: 'Retrieval > Reproductive',
        contentBn: 'গরু ঝরা/প্ল্যাসেন্টা আটকে — retained placenta; জ্বর হলে metritis সন্দেহ।',
        contentEn: 'Retained placenta post-calving; fever suggests metritis.',
      },
    ],
  },
  {
    slug: 'metritis',
    summaries: [
      {
        headingPath: 'Retrieval > Reproductive',
        contentBn: 'বাছা দেওয়ার পর ঝরা, দুগ্ধ গন্ধ, জ্বর — metritis।',
        contentEn: 'Post-calving foul discharge and fever — metritis.',
      },
    ],
  },
  {
    slug: 'brucellosis',
    summaries: [
      {
        headingPath: 'Retrieval > Reproductive',
        contentBn: 'বারবার ঝরা, infertility — brucellosis; zoonotic সতর্কতা।',
        contentEn: 'Repeat abortions — brucellosis differential; zoonotic risk.',
      },
    ],
  },
  {
    slug: 'cattle-fmd-schedule',
    summaries: [
      {
        headingPath: 'Retrieval > Vaccination',
        contentBn: 'গরুর FMD টিকা: DLS জাতীয় সূচি অনুযায়ী ৩–৬ মাসে বুস্টার।',
        contentEn: 'Cattle FMD vaccination per DLS national schedule every 3–6 months.',
      },
    ],
  },
  {
    slug: 'poultry-nd-schedule',
    summaries: [
      {
        headingPath: 'Retrieval > Vaccination',
        contentBn: 'মুরগি ND টিকা: ১–৭ দিন বয়সে প্রথম ডোজ, DLS সূচি অনুসরণ।',
        contentEn: 'Poultry ND vaccine: first dose day 1–7 per DLS schedule.',
      },
    ],
  },
  {
    slug: 'cattle-lactating-requirement',
    summaries: [
      {
        headingPath: 'Retrieval > Feed Ration',
        contentBn: 'দুগ্ধবতী গরুর খাদ্য হিসাব: দৈনিক DM, CP ও শক্তি requirement মেনে ration তৈরি করুন।',
        contentEn: 'Lactating cow feed calculation: meet daily DM, CP, and energy requirements.',
      },
      {
        headingPath: 'Retrieval > Colloquial',
        contentBn: 'গরুর খাদ্য হিসাব — lactating cow nutrient requirement অনুযায়ী।',
        contentEn: 'Cattle feed ration based on lactating nutrient requirements.',
      },
    ],
  },
  {
    slug: 'cattle-lactating-ration-template',
    summaries: [
      {
        headingPath: 'Retrieval > Feed Ration',
        contentBn: 'গরুর খাদ্য হিসাব উদাহরণ: ঘাস ৫০%, ভুট্টা/ভুসি ৩০%, প্রোটিন ২০%।',
        contentEn: 'Sample lactating cow ration: 50% forage, 30% energy, 20% protein supplement.',
      },
    ],
  },
  {
    slug: 'green-grass',
    summaries: [
      {
        headingPath: 'Retrieval > Feed Ingredient',
        contentBn: 'সবুজ ঘাস — দুগ্ধবতী গরুর forage base; DM ~২০%, CP ~৮%।',
        contentEn: 'Green grass forage base for lactating cattle.',
      },
    ],
  },
  {
    slug: 'rice-bran',
    summaries: [
      {
        headingPath: 'Retrieval > Feed Ingredient',
        contentBn: 'চালের কুঁড়া (rice bran) — স্থানীয় concentrate; ration-এ energy supplement।',
        contentEn: 'Rice bran local concentrate for cattle ration energy.',
      },
    ],
  },
  {
    slug: 'severe-bleeding',
    summaries: [
      {
        headingPath: 'Retrieval > Emergency',
        contentBn: 'গরু জরুরি রক্তপাত — চাপ bandage, শান্ত রাখুন, পশুচিকিত্সক ডাকুন।',
        contentEn: 'Emergency severe bleeding — pressure bandage, call vet immediately.',
      },
    ],
  },
  {
    slug: 'traumatic-injury',
    summaries: [
      {
        headingPath: 'Retrieval > Emergency',
        contentBn: 'গরু পড়ে গেছে/আঘাত — traumatic injury; stabilize and call vet.',
        contentEn: 'Traumatic injury collapse — stabilize animal, call veterinarian.',
      },
    ],
  },
  {
    slug: 'acute-bloat',
    summaries: [
      {
        headingPath: 'Retrieval > Emergency',
        contentBn: 'গরু পেট ফোলা জরুরি — acute bloat; vet without delay.',
        contentEn: 'Acute bloat emergency — veterinary help urgently required.',
      },
    ],
  },
  {
    slug: 'downer-cow-milk-fever',
    summaries: [
      {
        headingPath: 'Retrieval > Emergency',
        contentBn: 'বাছা দেওয়ার পর গরু পড়ে — milk fever emergency; vet for calcium therapy.',
        contentEn: 'Post-calving downer cow — milk fever emergency.',
      },
    ],
  },
];

export type ChunkExpansionResult = {
  entriesProcessed: number;
  chunksAdded: number;
  skipped: number;
  errors: string[];
};

export class RetrievalChunkExpansionService {
  readonly name = 'RetrievalChunkExpansionService';

  async expandMicroSummaries(
    defs: MicroSummaryDef[] = G1_MICRO_SUMMARY_DEFS,
  ): Promise<ChunkExpansionResult> {
    let entriesProcessed = 0;
    let chunksAdded = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const def of defs) {
      const entry = await getPrisma().aiKnowledgeEntry.findUnique({
        where: { slug: def.slug },
        select: { id: true, status: true, slug: true, source: { select: { sourceKey: true } } },
      });

      if (!entry || entry.status !== AiKnowledgeStatus.PUBLISHED) {
        skipped += 1;
        continue;
      }

      const existing = await getPrisma().aiKnowledgeChunk.findMany({
        where: { knowledgeEntryId: entry.id, stage: AiKnowledgeChunkStage.PUBLISHED },
        select: { chunkIndex: true, headingPath: true },
        orderBy: { chunkIndex: 'asc' },
      });

      const maxIndex = existing.reduce((max, c) => Math.max(max, c.chunkIndex), -1);
      const existingHeadings = new Set(existing.map((c) => c.headingPath).filter(Boolean));

      let addedForEntry = 0;
      let nextIndex = maxIndex + 1;
      const sourceKey = entry.source?.sourceKey ?? entry.slug;

      for (const summary of def.summaries) {
        if (existingHeadings.has(summary.headingPath)) continue;

        await getPrisma().aiKnowledgeChunk.create({
          data: {
            knowledgeEntryId: entry.id,
            chunkIndex: nextIndex,
            chunkPolicyId: 'RETRIEVAL_MICRO_SUMMARY',
            stage: AiKnowledgeChunkStage.PUBLISHED,
            contentBn: summary.contentBn,
            contentEn: summary.contentEn,
            headingPath: summary.headingPath,
            tokenEstimate: Math.ceil((summary.contentBn.length + summary.contentEn.length) / 4),
            citationJson: toInputJson({
              inline: `[${sourceKey}:micro]`,
              sourceKey,
            }),
            metadataJson: toInputJson({ embedAllowed: true, microSummary: true }),
          },
        });

        nextIndex += 1;
        addedForEntry += 1;
        chunksAdded += 1;
      }

      if (addedForEntry > 0) {
        entriesProcessed += 1;
        await getPrisma().aiKnowledgeEntry.update({
          where: { id: entry.id },
          data: { embeddingStatus: AiKnowledgeEmbeddingStatus.PENDING },
        });
        getKnowledgeEmbeddingPipelineService().scheduleEmbedEntry(entry.id);
      }
    }

    return { entriesProcessed, chunksAdded, skipped, errors };
  }

  /** Add one colloquial micro-summary per published entry until chunk floor reached. */
  async expandToChunkFloor(targetChunks = 520): Promise<ChunkExpansionResult & { finalCount: number }> {
    const currentCount = await getPrisma().aiKnowledgeChunk.count({
      where: { stage: AiKnowledgeChunkStage.PUBLISHED },
    });

    if (currentCount >= targetChunks) {
      return {
        entriesProcessed: 0,
        chunksAdded: 0,
        skipped: 0,
        errors: [],
        finalCount: currentCount,
      };
    }

    const entries = await getPrisma().aiKnowledgeEntry.findMany({
      where: { status: AiKnowledgeStatus.PUBLISHED },
      select: {
        id: true,
        slug: true,
        titleBn: true,
        titleEn: true,
        contentType: true,
        source: { select: { sourceKey: true } },
      },
      orderBy: { publishedAt: 'asc' },
    });

    let entriesProcessed = 0;
    let chunksAdded = 0;
    let skipped = 0;
    const errors: string[] = [];
    let runningCount = currentCount;

    while (runningCount < targetChunks) {
      let addedThisRound = 0;

      for (const entry of entries) {
        if (runningCount >= targetChunks) break;

      const existing = await getPrisma().aiKnowledgeChunk.findMany({
        where: {
          knowledgeEntryId: entry.id,
          stage: AiKnowledgeChunkStage.PUBLISHED,
          chunkPolicyId: 'RETRIEVAL_MICRO_SUMMARY',
        },
        select: { chunkIndex: true, headingPath: true },
        orderBy: { chunkIndex: 'desc' },
      });

      const allChunks = await getPrisma().aiKnowledgeChunk.findMany({
        where: { knowledgeEntryId: entry.id, stage: AiKnowledgeChunkStage.PUBLISHED },
        select: { chunkIndex: true },
        orderBy: { chunkIndex: 'desc' },
        take: 1,
      });

      const floorCount = existing.filter((c) => c.headingPath?.startsWith('Retrieval > Floor')).length;
      const passIndex = floorCount + 1;
      const headingPath = `Retrieval > Floor ${passIndex}`;
      if (existing.some((c) => c.headingPath === headingPath)) {
        skipped += 1;
        continue;
      }

      const maxIndex = allChunks[0]?.chunkIndex ?? -1;
      const sourceKey = entry.source?.sourceKey ?? entry.slug;

      const contentBn = `${entry.titleBn} — BN retrieval pass ${passIndex}; slug ${entry.slug}; domain ${entry.contentType}.`;
      const contentEn = `${entry.titleEn} — retrieval pass ${passIndex} for ${entry.slug}.`;

      await getPrisma().aiKnowledgeChunk.create({
        data: {
          knowledgeEntryId: entry.id,
          chunkIndex: maxIndex + 1,
          chunkPolicyId: 'RETRIEVAL_MICRO_SUMMARY',
          stage: AiKnowledgeChunkStage.PUBLISHED,
          contentBn,
          contentEn,
          headingPath,
          tokenEstimate: Math.ceil((contentBn.length + contentEn.length) / 4),
          citationJson: toInputJson({ inline: `[${sourceKey}:floor]`, sourceKey }),
          metadataJson: toInputJson({ embedAllowed: true, microSummary: true, floorExpansion: true }),
        },
      });

      await getPrisma().aiKnowledgeEntry.update({
        where: { id: entry.id },
        data: { embeddingStatus: AiKnowledgeEmbeddingStatus.PENDING },
      });
      getKnowledgeEmbeddingPipelineService().scheduleEmbedEntry(entry.id);

      entriesProcessed += 1;
      chunksAdded += 1;
      runningCount += 1;
      addedThisRound += 1;
    }

      if (addedThisRound === 0) break;
    }

    return {
      entriesProcessed,
      chunksAdded,
      skipped,
      errors,
      finalCount: runningCount,
    };
  }
}

let service: RetrievalChunkExpansionService | null = null;

export function getRetrievalChunkExpansionService(): RetrievalChunkExpansionService {
  if (!service) service = new RetrievalChunkExpansionService();
  return service;
}

export function resetRetrievalChunkExpansionServiceForTests(): void {
  service = null;
}
