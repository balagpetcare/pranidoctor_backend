import { getPrisma } from '../../../../shared/database/prisma.js';

import { KnowledgeImportSourceNotFoundError } from '../knowledge-import.errors.js';
import type { SourceFamilyProfile } from '../knowledge-import.types.js';
import { SOURCE_FAMILY_PROFILES, resolveProfileForSourceClass } from './source-family.profiles.js';

export class KnowledgeImportRegistryService {
  readonly name = 'KnowledgeImportRegistryService';

  async resolveImportContext(sourceId: string, documentId?: string) {
    const source = await getPrisma().aiKnowledgeSource.findUnique({
      where: { id: sourceId },
      include: {
        license: true,
        documents: documentId
          ? { where: { id: documentId }, take: 1 }
          : { orderBy: { ingestedAt: 'desc' }, take: 1 },
      },
    });
    if (!source) throw new KnowledgeImportSourceNotFoundError(sourceId);

    const profile = resolveProfileForSourceClass(source.sourceClass);
    const document = documentId
      ? source.documents.find((d) => d.id === documentId) ?? source.documents[0] ?? null
      : source.documents[0] ?? null;

    return { source, profile, document };
  }

  listProfiles(): SourceFamilyProfile[] {
    return SOURCE_FAMILY_PROFILES;
  }

  getProfiles(): SourceFamilyProfile[] {
    return SOURCE_FAMILY_PROFILES;
  }

  assertLicenseAllowsImport(source: {
    license: { allowsAiExtraction: boolean; expiryDate: Date | null } | null;
  }): void {
    if (!source.license) return;
    if (source.license.expiryDate && source.license.expiryDate < new Date()) {
      throw new Error('LICENSE_EXPIRED');
    }
    if (!source.license.allowsAiExtraction) {
      throw new Error('AI_EXTRACTION_DENIED');
    }
  }
}

let service: KnowledgeImportRegistryService | null = null;

export function getKnowledgeImportRegistryService(): KnowledgeImportRegistryService {
  if (!service) service = new KnowledgeImportRegistryService();
  return service;
}

export function resetKnowledgeImportRegistryForTests(): void {
  service = null;
}
