import { AiExtensionStatus } from '../../src/generated/prisma/index.js';
import { prisma } from '../../src/lib/prisma.js';
import { PLATFORM_SCOPE_KEY } from '../../src/modules/ai/prompts/management/prompt-management.types.js';
import { AI_ADAPTER_TYPES } from '../../src/modules/ai/marketplace/marketplace.types.js';

/**
 * Seeds marketplace extension manifests for OpenRouter, self-hosted LLM, and veterinary plugins.
 * Run after ai_management_foundation seed.
 */
export async function seedAiMarketplaceExtensions(): Promise<void> {
  const scopeKey = PLATFORM_SCOPE_KEY;

  const extensions = [
    {
      extensionKey: 'openrouter_gateway',
      name: 'OpenRouter Gateway',
      version: '1.0.0',
      publisher: 'Prani Doctor',
      description: 'Unified multi-model gateway via OpenRouter',
      adapterType: AI_ADAPTER_TYPES.OPENROUTER_GATEWAY,
      providerKey: 'openrouter',
      manifestJson: {
        extensionKey: 'openrouter_gateway',
        name: 'OpenRouter Gateway',
        version: '1.0.0',
        adapterType: AI_ADAPTER_TYPES.OPENROUTER_GATEWAY,
        providerKey: 'openrouter',
        capabilities: ['chat', 'vision'],
        config: {
          secretProviderKey: 'openrouter',
          baseUrl: 'https://openrouter.ai/api/v1',
        },
        models: [
          {
            modelKey: 'openai_gpt_4o_mini',
            displayName: 'GPT-4o Mini (via OpenRouter)',
            externalModelId: 'openai/gpt-4o-mini',
            source: 'EXTERNAL',
            modelCategory: 'general_chat',
          },
          {
            modelKey: 'anthropic_claude_3_5_haiku',
            displayName: 'Claude 3.5 Haiku (via OpenRouter)',
            externalModelId: 'anthropic/claude-3.5-haiku',
            source: 'EXTERNAL',
            modelCategory: 'general_chat',
          },
        ],
      },
    },
    {
      extensionKey: 'self_hosted_llm',
      name: 'Self-hosted LLM',
      version: '1.0.0',
      publisher: 'Prani Doctor',
      description: 'Ollama / vLLM / LM Studio OpenAI-compatible endpoint',
      adapterType: AI_ADAPTER_TYPES.SELF_HOSTED_OPENAI,
      providerKey: 'self_hosted',
      manifestJson: {
        extensionKey: 'self_hosted_llm',
        name: 'Self-hosted LLM',
        version: '1.0.0',
        adapterType: AI_ADAPTER_TYPES.SELF_HOSTED_OPENAI,
        providerKey: 'self_hosted',
        capabilities: ['chat', 'embeddings'],
        config: {
          baseUrl: process.env.SELF_HOSTED_LLM_BASE_URL ?? 'http://localhost:11434/v1',
          chatModel: process.env.SELF_HOSTED_LLM_MODEL ?? 'llama3.2',
          secretProviderKey: 'self_hosted',
        },
        models: [
          {
            modelKey: 'llama3.2',
            displayName: 'Llama 3.2 (local)',
            externalModelId: 'llama3.2',
            source: 'SELF_HOSTED',
            modelCategory: 'general_chat',
          },
        ],
      },
    },
    {
      extensionKey: 'prani_vet_models',
      name: 'Prani Veterinary Models',
      version: '1.0.0',
      publisher: 'Prani Doctor',
      description: 'Custom veterinary fine-tuned model slots',
      adapterType: AI_ADAPTER_TYPES.VETERINARY_CUSTOM,
      providerKey: 'self_hosted',
      manifestJson: {
        extensionKey: 'prani_vet_models',
        name: 'Prani Veterinary Models',
        version: '1.0.0',
        adapterType: AI_ADAPTER_TYPES.VETERINARY_CUSTOM,
        providerKey: 'self_hosted',
        capabilities: ['chat'],
        config: {
          baseUrl: process.env.VET_LLM_BASE_URL ?? process.env.SELF_HOSTED_LLM_BASE_URL ?? 'http://localhost:11434/v1',
          secretProviderKey: 'self_hosted',
        },
        models: [
          {
            modelKey: 'prani_symptom_v1',
            displayName: 'Prani Symptom Analyzer v1',
            externalModelId: 'prani/symptom-analyzer-v1',
            source: 'VETERINARY',
            modelCategory: 'symptom_analysis',
          },
          {
            modelKey: 'prani_disease_v1',
            displayName: 'Prani Disease Classifier v1',
            externalModelId: 'prani/disease-classifier-v1',
            source: 'VETERINARY',
            modelCategory: 'disease_classification',
          },
        ],
      },
    },
  ] as const;

  for (const ext of extensions) {
    await prisma.aiMarketplaceExtension.upsert({
      where: {
        scopeKey_extensionKey_version: {
          scopeKey,
          extensionKey: ext.extensionKey,
          version: ext.version,
        },
      },
      create: {
        scopeKey,
        extensionKey: ext.extensionKey,
        name: ext.name,
        version: ext.version,
        publisher: ext.publisher,
        description: ext.description,
        adapterType: ext.adapterType,
        providerKey: ext.providerKey,
        manifestJson: ext.manifestJson,
        status: AiExtensionStatus.ACTIVE,
        enabled: true,
        installedAt: new Date(),
      },
      update: {
        name: ext.name,
        description: ext.description,
        manifestJson: ext.manifestJson,
        status: AiExtensionStatus.ACTIVE,
        enabled: true,
        installedAt: new Date(),
      },
    });
  }

  // Ensure self_hosted provider row exists
  const selfHosted = await prisma.aiProvider.findFirst({
    where: { scopeKey, providerKey: 'self_hosted', deletedAt: null },
  });
  if (!selfHosted) {
    await prisma.aiProvider.create({
      data: {
        scopeKey,
        providerKey: 'self_hosted',
        displayName: 'Self-hosted LLM',
        priority: 60,
        adapterType: AI_ADAPTER_TYPES.SELF_HOSTED_OPENAI,
        baseUrl: process.env.SELF_HOSTED_LLM_BASE_URL ?? 'http://localhost:11434/v1',
        capabilitiesJson: ['chat', 'embeddings'],
        costTier: 'economy',
        enabled: false,
      },
    });
  }
}
