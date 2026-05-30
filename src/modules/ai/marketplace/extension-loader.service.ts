import { AiExtensionStatus } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { getAiProviderRegistry } from '../providers/provider-registry.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';
import { getAiAdapterRegistry } from './adapter-registry.js';
import { getExternalModelRegistrationService } from './external-model.service.js';
import {
  extensionManifestSchema,
  type ExtensionManifest,
  type ExtensionRegistrationContext,
  type RegisteredExtensionView,
} from './marketplace.types.js';

export class ExtensionLoaderService {
  readonly name = 'ExtensionLoaderService';

  async installExtension(
    manifest: ExtensionManifest,
    context: ExtensionRegistrationContext = {},
  ): Promise<RegisteredExtensionView> {
    const parsed = extensionManifestSchema.parse(manifest);
    const scopeKey = context.scopeKey ?? PLATFORM_SCOPE_KEY;
    const prisma = getPrisma();

    const row = await prisma.aiMarketplaceExtension.upsert({
      where: {
        scopeKey_extensionKey_version: {
          scopeKey,
          extensionKey: parsed.extensionKey,
          version: parsed.version,
        },
      },
      create: {
        scopeKey,
        tenantId: context.tenantId ?? null,
        branchId: context.branchId ?? null,
        extensionKey: parsed.extensionKey,
        name: parsed.name,
        version: parsed.version,
        publisher: parsed.publisher ?? null,
        description: parsed.description ?? null,
        adapterType: parsed.adapterType,
        providerKey: parsed.providerKey ?? null,
        manifestJson: parsed,
        status: AiExtensionStatus.ACTIVE,
        enabled: true,
        installedAt: new Date(),
        createdByUserId: context.actorUserId ?? null,
        updatedByUserId: context.actorUserId ?? null,
      },
      update: {
        name: parsed.name,
        description: parsed.description ?? null,
        adapterType: parsed.adapterType,
        providerKey: parsed.providerKey ?? null,
        manifestJson: parsed,
        status: AiExtensionStatus.ACTIVE,
        enabled: true,
        installedAt: new Date(),
        updatedByUserId: context.actorUserId ?? null,
      },
    });

    if (parsed.models?.length && parsed.providerKey) {
      const provider = await prisma.aiProvider.findFirst({
        where: { scopeKey, providerKey: parsed.providerKey, deletedAt: null },
      });
      if (provider) {
        await getExternalModelRegistrationService().registerFromManifestModels(
          provider.id,
          row.id,
          parsed.models,
        );
      }
    }

    await this.activateExtension(row.id);
    return this.toView(row, parsed.models?.length ?? 0);
  }

  async activateExtension(extensionId: string): Promise<void> {
    const prisma = getPrisma();
    const extension = await prisma.aiMarketplaceExtension.findFirst({
      where: { id: extensionId, deletedAt: null, enabled: true },
    });
    if (!extension) return;

    const manifest = extensionManifestSchema.parse(extension.manifestJson);
    const providerKey = extension.providerKey ?? manifest.providerKey;
    if (!providerKey) return;

    const providerRow = await prisma.aiProvider.findFirst({
      where: {
        scopeKey: extension.scopeKey,
        providerKey,
        deletedAt: null,
      },
    });

    const registry = getAiAdapterRegistry();
    const provider = registry.tryBuild(extension.adapterType, {
      providerKey,
      displayName: extension.name,
      manifest,
      dbConfig: providerRow
        ? { baseUrl: providerRow.baseUrl, configJson: providerRow.configJson }
        : undefined,
    });

    if (provider) {
      getAiProviderRegistry().register(provider);
    }
  }

  async loadActiveExtensions(scopeKey = PLATFORM_SCOPE_KEY): Promise<number> {
    const prisma = getPrisma();
    const extensions = await prisma.aiMarketplaceExtension.findMany({
      where: {
        scopeKey,
        deletedAt: null,
        enabled: true,
        status: AiExtensionStatus.ACTIVE,
      },
    });

    for (const extension of extensions) {
      await this.activateExtension(extension.id);
    }
    return extensions.length;
  }

  async listExtensions(scopeKey = PLATFORM_SCOPE_KEY): Promise<RegisteredExtensionView[]> {
    const prisma = getPrisma();
    const rows = await prisma.aiMarketplaceExtension.findMany({
      where: { scopeKey, deletedAt: null },
      include: { _count: { select: { models: true } } },
      orderBy: [{ extensionKey: 'asc' }, { version: 'desc' }],
    });
    return rows.map((row) => this.toView(row, row._count.models));
  }

  private toView(
    row: {
      id: string;
      extensionKey: string;
      name: string;
      version: string;
      publisher: string | null;
      adapterType: string;
      providerKey: string | null;
      status: AiExtensionStatus;
      enabled: boolean;
      installedAt: Date | null;
    },
    modelCount: number,
  ): RegisteredExtensionView {
    return {
      id: row.id,
      extensionKey: row.extensionKey,
      name: row.name,
      version: row.version,
      publisher: row.publisher,
      adapterType: row.adapterType,
      providerKey: row.providerKey,
      status: row.status,
      enabled: row.enabled,
      modelCount,
      installedAt: row.installedAt?.toISOString() ?? null,
    };
  }
}

let service: ExtensionLoaderService | null = null;

export function getExtensionLoaderService(): ExtensionLoaderService {
  if (!service) service = new ExtensionLoaderService();
  return service;
}

export function resetExtensionLoaderServiceForTests(): void {
  service = null;
}
