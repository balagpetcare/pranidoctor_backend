/**
 * Cattle AI service catalog — idempotent, create-only import.
 *
 *   npm run db:seed:cattle-ai-services
 *   npm run db:seed:cattle-ai-services -- --dry-run
 *   npm run db:seed:cattle-ai-services -- --approval-status=DRAFT
 *   npm run db:seed:cattle-ai-services -- --file=prisma/seed-data/cattle-ai-service-catalog.json
 *   npm run db:seed:cattle-ai-services -- --json            (machine-readable report)
 *
 * Docs: docs/CATTLE_AI_SERVICE_CATALOG.md
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvironment } from '../../src/shared/config/load-env.js';

loadEnvironment();

import {
  AnimalType,
  Prisma,
  SemenProductKind,
  SemenProviderVerificationStatus,
  SemenTemplateApprovalStatus,
} from '../../src/generated/prisma/index.js';
import { disconnectPrisma, prisma } from '../../src/lib/prisma.js';
import { validateCatalog } from '../../src/legacy/web/lib/cattle-ai-catalog/catalog-schema.js';
import {
  CatalogImportError,
  formatImportReport,
  importCattleAiCatalog,
  type CatalogDb,
  type CatalogTx,
  type ImportApprovalStatus,
} from '../../src/legacy/web/lib/cattle-ai-catalog/import-catalog.js';

const DEFAULT_FILE = fileURLToPath(new URL('../seed-data/cattle-ai-service-catalog.json', import.meta.url));
/** Arbitrary but stable key for pg_advisory_xact_lock — serialises concurrent imports. */
const ADVISORY_LOCK_KEY = 7_274_010;
const APPROVAL_STATUSES: ImportApprovalStatus[] = ['DRAFT', 'PENDING_REVIEW', 'APPROVED'];

type CliArgs = {
  file: string;
  dryRun: boolean;
  json: boolean;
  approvalStatus: ImportApprovalStatus;
};

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { file: DEFAULT_FILE, dryRun: false, json: false, approvalStatus: 'APPROVED' };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--json') args.json = true;
    else if (a.startsWith('--file=')) args.file = path.resolve(a.slice('--file='.length));
    else if (a.startsWith('--approval-status=')) {
      const v = a.slice('--approval-status='.length) as ImportApprovalStatus;
      if (!APPROVAL_STATUSES.includes(v)) {
        throw new Error(`--approval-status must be one of ${APPROVAL_STATUSES.join(', ')}`);
      }
      args.approvalStatus = v;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

function tagsOf(json: Prisma.JsonValue | null): string[] {
  return Array.isArray(json) ? json.filter((t): t is string => typeof t === 'string') : [];
}

function createPrismaCatalogDb(): CatalogDb {
  return {
    transaction: (fn) =>
      prisma.$transaction(
        async (tx) => {
          const adapter: CatalogTx = {
            async acquireImportLock() {
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`;
            },
            findProviderBySlug: (slug) =>
              tx.semenProvider.findUnique({ where: { slug }, select: { id: true } }),
            createProvider: (d) =>
              tx.semenProvider.create({
                data: {
                  slug: d.slug,
                  name: d.name,
                  nameBn: d.nameBn,
                  sortOrder: d.sortOrder,
                  isActive: true,
                  verificationStatus: SemenProviderVerificationStatus.UNVERIFIED,
                },
                select: { id: true },
              }),
            findBreedBySlug: (slug) =>
              tx.livestockBreed.findUnique({ where: { slug }, select: { id: true, animalType: true } }),
            createBreed: (d) =>
              tx.livestockBreed.create({
                data: {
                  slug: d.slug,
                  nameEn: d.nameEn,
                  nameBn: d.nameBn,
                  animalType: AnimalType.CATTLE,
                  isActive: true,
                },
                select: { id: true },
              }),
            async listCattleTemplatesForProviders(providerIds) {
              const rows = await tx.semenServiceTemplate.findMany({
                where: { animalType: AnimalType.CATTLE, semenProviderId: { in: providerIds } },
                select: { id: true, internalName: true, semenProviderId: true, tagsJson: true },
              });
              return rows.map((r) => ({
                id: r.id,
                internalName: r.internalName,
                semenProviderId: r.semenProviderId,
                tags: tagsOf(r.tagsJson),
              }));
            },
            createTemplate: (d) =>
              tx.semenServiceTemplate.create({
                data: {
                  internalName: d.internalName,
                  animalType: AnimalType.CATTLE,
                  semenProviderId: d.semenProviderId,
                  semenProductKind: d.semenProductKind as SemenProductKind,
                  shortDescription: d.shortDescription,
                  defaultBasePrice: new Prisma.Decimal(d.defaultBasePrice),
                  tagsJson: d.tags,
                  isActive: d.isActive,
                  approvalStatus: d.approvalStatus as SemenTemplateApprovalStatus,
                  approvedAt: d.approvedAt,
                  breedMixes: {
                    create: d.breedMix.map((m) => ({
                      breedId: m.breedId,
                      percentage: new Prisma.Decimal(m.percentage),
                    })),
                  },
                },
                select: { id: true },
              }),
            async serviceCategoryExists(slug) {
              const found = await tx.serviceCategory.findUnique({ where: { slug }, select: { id: true } });
              return found !== null;
            },
          };
          return fn(adapter);
        },
        { timeout: 120_000, maxWait: 15_000 },
      ),
  };
}

export async function runCattleAiCatalogImport(argv: string[]) {
  const args = parseArgs(argv);
  const raw: unknown = JSON.parse(readFileSync(args.file, 'utf8'));

  const validation = validateCatalog(raw);
  if (!validation.ok) {
    throw new CatalogImportError(
      'CATALOG_INVALID',
      `Catalog validation failed (${validation.errors.length}):\n- ${validation.errors.join('\n- ')}`,
    );
  }

  const report = await importCattleAiCatalog(createPrismaCatalogDb(), validation.catalog, {
    dryRun: args.dryRun,
    approvalStatus: args.approvalStatus,
  });
  return { args, report };
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('cattle_ai_service_catalog.seed.ts') ||
    process.argv[1].endsWith('cattle_ai_service_catalog.seed.js'));

if (isDirectRun) {
  runCattleAiCatalogImport(process.argv.slice(2))
    .then(async ({ args, report }) => {
      console.log(args.json ? JSON.stringify(report, null, 2) : formatImportReport(report));
      await disconnectPrisma();
    })
    .catch(async (e: unknown) => {
      console.error(e instanceof Error ? `[cattle-ai-catalog] ${e.message}` : e);
      await disconnectPrisma();
      process.exit(1);
    });
}

