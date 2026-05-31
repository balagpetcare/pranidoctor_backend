import { getPrisma } from '../../../src/shared/database/prisma.js';
import type { LivestockSpecies, AiKnowledgeEntry } from '../../../src/generated/prisma/index.js';

type MedicineStructuredJson = {
  genericName?: string;
  drugClass?: string;
  prescriptionRequired?: boolean;
  brandNamesBd?: string[];
  contraindications?: unknown[];
  antimicrobialClass?: string;
  withdrawalDays?: number;
  withdrawalMilkDays?: number;
  withdrawalMeatDays?: number;
  bannedSubstance?: boolean;
};

function parseStructured(metadataJson: unknown): MedicineStructuredJson {
  if (!metadataJson || typeof metadataJson !== 'object') return {};
  return metadataJson as MedicineStructuredJson;
}

function slugToCode(slug: string): string {
  return slug
    .toUpperCase()
    .replace(/-/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, 64);
}

async function importExistingMedicines(): Promise<void> {
  const prisma = getPrisma();
  console.log('Starting import of existing medicines from AiKnowledgeEntry...\n');

  const existingMedicines = await prisma.aiKnowledgeEntry.findMany({
    where: {
      contentType: 'MEDICINE',
      status: 'PUBLISHED',
    },
    orderBy: { titleEn: 'asc' },
  });

  console.log(`Found ${existingMedicines.length} published MEDICINE entries\n`);

  let defaultVersion = await prisma.vkKnowledgeVersion.findFirst({
    where: {
      entity: { entityType: 'MEDICINE' },
      status: 'PUBLISHED',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!defaultVersion) {
    const entity = await prisma.vkKnowledgeEntity.create({
      data: {
        entitySlug: 'medicine-root',
        entityType: 'MEDICINE',
        externalId: 'medicine-import-root',
      },
    });

    defaultVersion = await prisma.vkKnowledgeVersion.create({
      data: {
        entityId: entity.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        titleBn: 'মেডিসিন রুট',
        titleEn: 'Medicine Root',
        bodyBn: 'মেডিসিন ইম্পোর্ট রুট এন্ট্রি',
        bodyEn: 'Medicine import root entry',
        publishedAt: new Date(),
      },
    });

    console.log(`Created default VkKnowledgeVersion: ${defaultVersion.id}\n`);
  }

  let imported = 0;
  let skipped = 0;
  let updated = 0;

  for (const entry of existingMedicines) {
    const structured = parseStructured(entry.metadataJson);
    const genericCode = slugToCode(entry.slug);

    const genericName = structured.genericName || entry.titleEn;

    const existing = await prisma.medicineGeneric.findFirst({
      where: {
        OR: [
          { genericCode },
          { knowledgeEntryId: entry.id },
        ],
      },
    });

    if (existing) {
      if (!existing.knowledgeEntryId) {
        await prisma.medicineGeneric.update({
          where: { id: existing.id },
          data: { knowledgeEntryId: entry.id },
        });
        updated++;
        console.log(`  Linked: ${genericCode} -> ${entry.id}`);
      } else {
        skipped++;
        console.log(`  Skipped (exists): ${genericCode}`);
      }
      continue;
    }

    try {
      await prisma.medicineGeneric.create({
        data: {
          versionId: defaultVersion.id,
          genericCode,
          genericNameEn: genericName,
          genericNameBn: entry.titleBn,
          drugClass: structured.drugClass ?? null,
          antimicrobialClass: structured.antimicrobialClass ?? null,
          species: entry.species as LivestockSpecies[],
          indicationsJson: null,
          contraindicationsJson: structured.contraindications
            ? JSON.parse(JSON.stringify(structured.contraindications))
            : null,
          prescriptionRequired: structured.prescriptionRequired ?? true,
          bannedSubstance: structured.bannedSubstance ?? false,
          controlledSubstance: false,
          defaultWithdrawalMeatDays: structured.withdrawalMeatDays ?? structured.withdrawalDays ?? null,
          defaultWithdrawalMilkDays: structured.withdrawalMilkDays ?? null,
          knowledgeEntryId: entry.id,
          sourceAttributionsJson: { source: 'ai_knowledge_entry', entryId: entry.id },
          isActive: true,
        },
      });

      imported++;
      console.log(`  Imported: ${genericCode} (${genericName})`);
    } catch (err) {
      console.error(`  Error importing ${genericCode}:`, err);
      skipped++;
    }
  }

  console.log(`\nImport complete: ${imported} imported, ${updated} linked, ${skipped} skipped`);

  const total = await prisma.medicineGeneric.count();
  console.log(`Total MedicineGeneric entries: ${total}`);
}

importExistingMedicines()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
