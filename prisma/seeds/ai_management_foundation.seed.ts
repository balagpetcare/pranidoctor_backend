import {
  AiApiKeyStatus,
  AiFailoverActionType,
  AiFailoverTriggerType,
  AiPromptStatus,
  AiSettingsCategory,
  Prisma,
} from '../../src/generated/prisma/index.js';
import { prisma } from '../../src/lib/prisma.js';
import { getEncryptionService } from '../../src/modules/ai/vault/encryption.service.js';

/** Platform-wide scope — tenant/branch overrides use buildScopeKey(). */
export const PLATFORM_SCOPE_KEY = 'platform';

export function buildScopeKey(tenantId?: string | null, branchId?: string | null): string {
  if (tenantId && branchId) return `tenant:${tenantId}:branch:${branchId}`;
  if (tenantId) return `tenant:${tenantId}`;
  return PLATFORM_SCOPE_KEY;
}

/** Placeholder ciphertext — replaced when AI_VAULT_MASTER_KEY + import env or admin add. */
export const SEED_ENCRYPTED_SECRET_PLACEHOLDER =
  'ENC:PLACEHOLDER:v1:not-a-real-api-key';

const PROVIDER_SEED = [
  {
    providerKey: 'openai',
    displayName: 'OpenAI',
    priority: 10,
    adapterType: 'openai_native',
    baseUrl: 'https://api.openai.com/v1',
    capabilitiesJson: ['chat', 'vision', 'embedding', 'streaming'],
    costTier: 'economy',
  },
  {
    providerKey: 'anthropic',
    displayName: 'Anthropic',
    priority: 20,
    adapterType: 'anthropic_native',
    baseUrl: 'https://api.anthropic.com/v1',
    capabilitiesJson: ['chat', 'document'],
    costTier: 'standard',
  },
  {
    providerKey: 'gemini',
    displayName: 'Google Gemini',
    priority: 30,
    adapterType: 'gemini_native',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    capabilitiesJson: ['chat', 'vision', 'video'],
    costTier: 'standard',
    enabled: false,
  },
  {
    providerKey: 'deepseek',
    displayName: 'DeepSeek',
    priority: 40,
    adapterType: 'openai_compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    capabilitiesJson: ['chat'],
    costTier: 'economy',
    enabled: false,
  },
  {
    providerKey: 'openrouter',
    displayName: 'OpenRouter',
    priority: 50,
    adapterType: 'openrouter_gateway',
    baseUrl: 'https://openrouter.ai/api/v1',
    capabilitiesJson: ['chat', 'vision'],
    costTier: 'standard',
    enabled: false,
  },
  {
    providerKey: 'rules-based',
    displayName: 'Rules-based fallback',
    priority: 999,
    adapterType: 'internal_rules',
    baseUrl: null,
    capabilitiesJson: ['chat'],
    costTier: 'economy',
  },
] as const;

const MODEL_SEED: Array<{
  providerKey: string;
  modelKey: string;
  displayName: string;
  modelType: string;
  isDefault?: boolean;
  inputCostPerToken: string;
  outputCostPerToken: string;
  contextWindow?: number;
}> = [
  {
    providerKey: 'openai',
    modelKey: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    modelType: 'chat',
    isDefault: true,
    inputCostPerToken: '0.00000015',
    outputCostPerToken: '0.0000006',
    contextWindow: 128000,
  },
  {
    providerKey: 'openai',
    modelKey: 'gpt-4o',
    displayName: 'GPT-4o',
    modelType: 'chat',
    inputCostPerToken: '0.0000025',
    outputCostPerToken: '0.00001',
    contextWindow: 128000,
  },
  {
    providerKey: 'anthropic',
    modelKey: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    modelType: 'chat',
    isDefault: true,
    inputCostPerToken: '0.00000025',
    outputCostPerToken: '0.00000125',
    contextWindow: 200000,
  },
  {
    providerKey: 'gemini',
    modelKey: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    modelType: 'chat',
    isDefault: true,
    inputCostPerToken: '0.000000075',
    outputCostPerToken: '0.0000003',
    contextWindow: 1000000,
  },
  {
    providerKey: 'deepseek',
    modelKey: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    modelType: 'chat',
    isDefault: true,
    inputCostPerToken: '0.00000014',
    outputCostPerToken: '0.00000028',
    contextWindow: 64000,
  },
  {
    providerKey: 'rules-based',
    modelKey: 'rules-based-v1',
    displayName: 'Rules Engine v1',
    modelType: 'rules',
    isDefault: true,
    inputCostPerToken: '0',
    outputCostPerToken: '0',
  },
];

const ROUTE_SEED = [
  {
    routeKey: 'general_chat',
    name: 'General Chat',
    taskType: 'GENERAL_CHAT',
    priority: 10,
    maxCostUsd: '0.002',
    chain: ['openai', 'anthropic', 'deepseek', 'rules-based'],
  },
  {
    routeKey: 'disease_analysis',
    name: 'Disease Analysis',
    taskType: 'DISEASE_ANALYSIS',
    priority: 10,
    maxCostUsd: '0.015',
    chain: ['anthropic', 'openai', 'rules-based'],
  },
  {
    routeKey: 'feed_formulation',
    name: 'Feed Formulation',
    taskType: 'FEED_FORMULATION',
    priority: 10,
    maxCostUsd: '0.005',
    chain: ['deepseek', 'openai', 'rules-based'],
  },
  {
    routeKey: 'prescription_analysis',
    name: 'Prescription Analysis',
    taskType: 'PRESCRIPTION_ANALYSIS',
    priority: 10,
    maxCostUsd: '0.025',
    chain: ['anthropic', 'openai', 'rules-based'],
  },
  {
    routeKey: 'image_analysis',
    name: 'Image Analysis',
    taskType: 'IMAGE_ANALYSIS',
    priority: 10,
    maxCostUsd: '0.02',
    asyncRequired: false,
    chain: ['gemini', 'openai', 'rules-based'],
  },
  {
    routeKey: 'video_analysis',
    name: 'Video Analysis',
    taskType: 'VIDEO_ANALYSIS',
    priority: 10,
    maxCostUsd: '0.05',
    asyncRequired: true,
    chain: ['gemini', 'openai', 'rules-based'],
  },
  {
    routeKey: 'document_analysis',
    name: 'Document Analysis',
    taskType: 'DOCUMENT_ANALYSIS',
    priority: 10,
    maxCostUsd: '0.03',
    asyncRequired: true,
    chain: ['anthropic', 'openai', 'rules-based'],
  },
  {
    routeKey: 'emergency_consultation',
    name: 'Emergency Consultation',
    taskType: 'EMERGENCY_CONSULTATION',
    priority: 5,
    maxCostUsd: '0.03',
    chain: ['anthropic', 'openai', 'rules-based'],
  },
] as const;

const PROMPT_SEED = [
  {
    promptKey: 'general_chat',
    taskType: 'GENERAL_CHAT',
    name: 'Farmer General Chat',
    systemBn:
      'আপনি প্রাণীডাক্তর AI সহকারী। কৃষকদের পশুপালন সংক্রান্ত প্রশ্নের সহজ, নিরাপদ উত্তর দিন। নিশ্চিত রোগ নির্ণয় বা ওষুধের ডোজ দেবেন না।',
    systemEn:
      'You are the Prani Doctor AI assistant. Give clear, safe guidance on livestock care. Do not provide definitive diagnoses or drug dosages.',
  },
  {
    promptKey: 'disease_analysis',
    taskType: 'DISEASE_ANALYSIS',
    name: 'Disease Analysis Assist',
    systemBn:
      'আপনি পশু স্বাস্থ্য বিশ্লেষণ সহকারী। সম্ভাব্য differential তালিকা দিন, জরুরি লক্ষণ হলে escalation সুপারিশ করুন।',
    systemEn:
      'You assist with livestock health analysis. Provide differential possibilities and recommend escalation for emergency signs.',
  },
  {
    promptKey: 'emergency_triage',
    taskType: 'EMERGENCY_CONSULTATION',
    name: 'Emergency Triage',
    systemBn:
      'জরুরি triage সহকারী। প্রথমে নিরাপত্তা মূল্যায়ন করুন, দ্রুত actionable পদক্ষেপ দিন, মানব চিকিৎসক escalation উৎসাহিত করুন।',
    systemEn:
      'Emergency triage assistant. Assess safety first, give rapid actionable steps, encourage human veterinarian escalation.',
  },
  {
    promptKey: 'farm_assistant',
    taskType: 'GENERAL_CHAT',
    name: 'Farm Briefing Assistant',
    systemBn: 'খামার ডেটা বিশ্লেষণ করে সংক্ষিপ্ত briefing দিন।',
    systemEn: 'Analyze farm data and provide a concise briefing.',
  },
] as const;

const SETTINGS_SEED = [
  {
    settingsKey: 'routing.default',
    category: AiSettingsCategory.ROUTING,
    settingsJson: {
      preferredProvider: 'openai',
      honorDbRoutes: true,
      fallbackToRules: true,
    },
  },
  {
    settingsKey: 'budget.global',
    category: AiSettingsCategory.BUDGET,
    settingsJson: {
      dailyBudgetUsd: null,
      monthlyBudgetUsd: null,
      emergencyBypassBudget: true,
    },
  },
  {
    settingsKey: 'security.encryption',
    category: AiSettingsCategory.ENCRYPTION,
    settingsJson: {
      apiKeyStorage: 'encrypted_at_rest',
      defaultEncryptionKeyId: 'env:v1',
      algorithm: 'aes-256-gcm',
    },
  },
  {
    settingsKey: 'governance.features',
    category: AiSettingsCategory.GOVERNANCE,
    settingsJson: {
      llmEnabled: true,
      requireAiConsent: true,
    },
  },
] as const;

export async function seedAiManagementFoundation(): Promise<void> {
  const scopeKey = PLATFORM_SCOPE_KEY;

  const providerIdByKey = new Map<string, string>();
  const modelIdByComposite = new Map<string, string>();

  for (const p of PROVIDER_SEED) {
    const existing = await prisma.aiProvider.findFirst({
      where: { scopeKey, providerKey: p.providerKey, deletedAt: null },
    });

    const provider = existing
      ? await prisma.aiProvider.update({
          where: { id: existing.id },
          data: {
            displayName: p.displayName,
            priority: p.priority,
            adapterType: p.adapterType,
            baseUrl: p.baseUrl,
            capabilitiesJson: p.capabilitiesJson,
            costTier: p.costTier,
            enabled: 'enabled' in p ? p.enabled : true,
          },
        })
      : await prisma.aiProvider.create({
          data: {
            scopeKey,
            providerKey: p.providerKey,
            displayName: p.displayName,
            priority: p.priority,
            adapterType: p.adapterType,
            baseUrl: p.baseUrl,
            capabilitiesJson: p.capabilitiesJson,
            costTier: p.costTier,
            enabled: 'enabled' in p ? p.enabled : true,
          },
        });

    providerIdByKey.set(p.providerKey, provider.id);

    if (p.providerKey !== 'rules-based') {
      const keyRow = await prisma.aiApiKey.findFirst({
        where: { scopeKey, providerId: provider.id, name: 'default', deletedAt: null },
      });

      const importEnv = process.env.AI_VAULT_IMPORT_ENV_KEYS === 'true';
      const envPlaintext =
        importEnv && p.providerKey === 'openai'
          ? process.env.OPENAI_API_KEY?.trim()
          : importEnv && p.providerKey === 'anthropic'
            ? process.env.ANTHROPIC_API_KEY?.trim()
            : undefined;

      if (keyRow && !envPlaintext) continue;

      if (!keyRow && !getEncryptionService().isMasterKeyConfigured()) {
        continue;
      }

      if (!keyRow && !envPlaintext) continue;

      const encryption = getEncryptionService();
      const plaintext = envPlaintext ?? '';
      const enc = envPlaintext
        ? encryption.encrypt(plaintext)
        : {
            ciphertext: SEED_ENCRYPTED_SECRET_PLACEHOLDER,
            encryptionKeyId: 'seed:v1',
            encryptionAlgorithm: 'aes-256-gcm',
          };

      if (keyRow) {
        if (envPlaintext) {
          await prisma.aiApiKey.update({
            where: { id: keyRow.id },
            data: {
              encryptedSecret: enc.ciphertext,
              encryptionKeyId: enc.encryptionKeyId,
              encryptionAlgorithm: enc.encryptionAlgorithm,
              secretHint: envPlaintext ? encryption.buildSecretHint(plaintext) : keyRow.secretHint,
              status: 'ACTIVE',
            },
          });
        }
      } else {
        await prisma.aiApiKey.create({
          data: {
            scopeKey,
            providerId: provider.id,
            name: 'default',
            status: 'ACTIVE',
            encryptedSecret: enc.ciphertext,
            encryptionKeyId: enc.encryptionKeyId,
            encryptionAlgorithm: enc.encryptionAlgorithm,
            secretHint: envPlaintext ? encryption.buildSecretHint(plaintext) : '****seed',
            metadataJson: {
              source: envPlaintext ? 'env_import' : 'seed',
              note: envPlaintext
                ? 'Imported from env — remove OPENAI/ANTHROPIC from .env after verify'
                : 'Add real key via admin secrets API',
            },
          },
        });
      }
    }
  }

  for (const m of MODEL_SEED) {
    const providerId = providerIdByKey.get(m.providerKey);
    if (!providerId) continue;

    const existing = await prisma.aiModel.findFirst({
      where: { scopeKey, providerId, modelKey: m.modelKey, deletedAt: null },
    });

    const model = existing
      ? await prisma.aiModel.update({
          where: { id: existing.id },
          data: {
            displayName: m.displayName,
            modelType: m.modelType,
            isDefault: m.isDefault ?? false,
            inputCostPerToken: new Prisma.Decimal(m.inputCostPerToken),
            outputCostPerToken: new Prisma.Decimal(m.outputCostPerToken),
            contextWindow: m.contextWindow,
          },
        })
      : await prisma.aiModel.create({
          data: {
            scopeKey,
            providerId,
            modelKey: m.modelKey,
            displayName: m.displayName,
            modelType: m.modelType,
            isDefault: m.isDefault ?? false,
            inputCostPerToken: new Prisma.Decimal(m.inputCostPerToken),
            outputCostPerToken: new Prisma.Decimal(m.outputCostPerToken),
            contextWindow: m.contextWindow,
            capabilitiesJson: [m.modelType],
          },
        });

    modelIdByComposite.set(`${m.providerKey}:${m.modelKey}`, model.id);
  }

  for (const r of ROUTE_SEED) {
    const chainEntries = r.chain.map((providerKey, index) => {
      const providerId = providerIdByKey.get(providerKey)!;
      const defaultModel = MODEL_SEED.find((m) => m.providerKey === providerKey && m.isDefault);
      const modelId = defaultModel
        ? modelIdByComposite.get(`${providerKey}:${defaultModel.modelKey}`)
        : undefined;
      return { order: index, providerKey, providerId, modelId: modelId ?? null };
    });

    const primary = chainEntries[0];
    const existing = await prisma.aiRoute.findFirst({
      where: { scopeKey, routeKey: r.routeKey, deletedAt: null },
    });

    const data = {
      name: r.name,
      taskType: r.taskType,
      priority: r.priority,
      maxCostUsd: new Prisma.Decimal(r.maxCostUsd),
      asyncRequired: 'asyncRequired' in r ? r.asyncRequired : false,
      primaryProviderId: primary?.providerId ?? null,
      primaryModelId: primary?.modelId ?? null,
      providerChainJson: chainEntries,
    };

    if (existing) {
      await prisma.aiRoute.update({ where: { id: existing.id }, data });
    } else {
      await prisma.aiRoute.create({
        data: { scopeKey, routeKey: r.routeKey, ...data },
      });
    }
  }

  for (const p of PROMPT_SEED) {
    const existing = await prisma.aiPrompt.findFirst({
      where: { scopeKey, promptKey: p.promptKey, version: 1, deletedAt: null },
    });

    if (existing) {
      await prisma.aiPrompt.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          taskType: p.taskType,
          systemBn: p.systemBn,
          systemEn: p.systemEn,
          status: AiPromptStatus.ACTIVE,
        },
      });
    } else {
      await prisma.aiPrompt.create({
        data: {
          scopeKey,
          promptKey: p.promptKey,
          version: 1,
          taskType: p.taskType,
          name: p.name,
          systemBn: p.systemBn,
          systemEn: p.systemEn,
          status: AiPromptStatus.ACTIVE,
          trafficPercent: 100,
        },
      });
    }
  }

  const generalChatRoute = await prisma.aiRoute.findFirst({
    where: { scopeKey, routeKey: 'general_chat', deletedAt: null },
  });

  if (generalChatRoute) {
    const openaiId = providerIdByKey.get('openai');
    const anthropicId = providerIdByKey.get('anthropic');

    const failoverRules = [
      {
        name: 'OpenAI 5xx → Anthropic',
        triggerType: AiFailoverTriggerType.HTTP_5XX,
        fromProviderId: openaiId,
        toProviderId: anthropicId,
        action: AiFailoverActionType.NEXT_PROVIDER,
        priority: 10,
      },
      {
        name: 'Rate limit → next provider',
        triggerType: AiFailoverTriggerType.HTTP_429,
        fromProviderId: openaiId,
        toProviderId: anthropicId,
        action: AiFailoverActionType.NEXT_PROVIDER,
        priority: 20,
      },
      {
        name: 'Budget exceeded → rules only',
        triggerType: AiFailoverTriggerType.BUDGET_EXCEEDED,
        action: AiFailoverActionType.RULES_ONLY,
        priority: 5,
      },
    ] as const;

    for (const rule of failoverRules) {
      const exists = await prisma.aiFailoverRule.findFirst({
        where: {
          scopeKey,
          routeId: generalChatRoute.id,
          name: rule.name,
          deletedAt: null,
        },
      });

      if (!exists) {
        await prisma.aiFailoverRule.create({
          data: {
            scopeKey,
            routeId: generalChatRoute.id,
            name: rule.name,
            triggerType: rule.triggerType,
            fromProviderId: 'fromProviderId' in rule ? rule.fromProviderId : null,
            toProviderId: 'toProviderId' in rule ? rule.toProviderId : null,
            action: rule.action,
            priority: rule.priority,
          },
        });
      }
    }
  }

  for (const s of SETTINGS_SEED) {
    const existing = await prisma.aiSettings.findFirst({
      where: { scopeKey, settingsKey: s.settingsKey, deletedAt: null },
    });

    if (existing) {
      await prisma.aiSettings.update({
        where: { id: existing.id },
        data: { category: s.category, settingsJson: s.settingsJson },
      });
    } else {
      await prisma.aiSettings.create({
        data: {
          scopeKey,
          settingsKey: s.settingsKey,
          category: s.category,
          settingsJson: s.settingsJson,
        },
      });
    }
  }
}

async function main(): Promise<void> {
  const { loadEnvironment } = await import('../../src/shared/config/load-env.js');
  loadEnvironment();
  await seedAiManagementFoundation();
  console.info('[seed] AIMS foundation complete.');
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').includes('ai_management_foundation.seed');

if (isDirectRun) {
  main()
    .then(async () => {
      const { disconnectPrisma } = await import('../../src/lib/prisma.js');
      await disconnectPrisma();
    })
    .catch(async (err: unknown) => {
      console.error(err);
      const { disconnectPrisma } = await import('../../src/lib/prisma.js');
      await disconnectPrisma();
      process.exit(1);
    });
}
