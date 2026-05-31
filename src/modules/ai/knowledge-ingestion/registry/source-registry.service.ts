import { getPrisma } from '../../../../shared/database/prisma.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';

import { KnowledgeSourceNotFoundError } from '../knowledge-ingestion.errors.js';
import type {
  CreateKnowledgeSourceInput,
  CreateSourceDocumentInput,
  CreateSourceLicenseInput,
} from '../knowledge-ingestion.types.js';

export class KnowledgeSourceRegistryService {
  readonly name = 'KnowledgeSourceRegistryService';

  async createLicense(input: CreateSourceLicenseInput) {
    return getPrisma().aiKnowledgeSourceLicense.create({ data: input });
  }

  async listLicenses() {
    return getPrisma().aiKnowledgeSourceLicense.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async createSource(input: CreateKnowledgeSourceInput) {
    return getPrisma().aiKnowledgeSource.create({
      data: {
        ...input,
        allowedDomains: input.allowedDomains ?? [],
      },
    });
  }

  async updateSource(id: string, input: Partial<CreateKnowledgeSourceInput>) {
    await this.requireSource(id);
    return getPrisma().aiKnowledgeSource.update({
      where: { id },
      data: omitUndefined(input),
    });
  }

  async getSource(id: string) {
    const row = await getPrisma().aiKnowledgeSource.findUnique({
      where: { id },
      include: { license: true, documents: { orderBy: { ingestedAt: 'desc' }, take: 20 } },
    });
    if (!row) throw new KnowledgeSourceNotFoundError(id);
    return row;
  }

  async getSourceByKey(sourceKey: string) {
    return getPrisma().aiKnowledgeSource.findUnique({ where: { sourceKey } });
  }

  async listSources(filters?: { status?: string; sourceClass?: string }) {
    return getPrisma().aiKnowledgeSource.findMany({
      where: omitUndefined({
        status: filters?.status as never,
        sourceClass: filters?.sourceClass as never,
      }),
      include: { license: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async deleteSource(id: string) {
    await this.requireSource(id);
    return getPrisma().aiKnowledgeSource.update({
      where: { id },
      data: { status: 'RETIRED' },
    });
  }

  async registerDocument(input: CreateSourceDocumentInput) {
    await this.requireSource(input.sourceId);
    return getPrisma().aiKnowledgeSourceDocument.create({ data: input });
  }

  async listDocuments(sourceId: string) {
    return getPrisma().aiKnowledgeSourceDocument.findMany({
      where: { sourceId },
      orderBy: { ingestedAt: 'desc' },
    });
  }

  private async requireSource(id: string) {
    const row = await getPrisma().aiKnowledgeSource.findUnique({ where: { id } });
    if (!row) throw new KnowledgeSourceNotFoundError(id);
    return row;
  }
}

let registryService: KnowledgeSourceRegistryService | null = null;

export function getKnowledgeSourceRegistryService(): KnowledgeSourceRegistryService {
  if (!registryService) registryService = new KnowledgeSourceRegistryService();
  return registryService;
}

export function resetKnowledgeSourceRegistryForTests(): void {
  registryService = null;
}
