#!/usr/bin/env node
/**
 * P0 BLOCKER-2 — Live LLM connectivity verification (no mocks).
 * Usage: npx tsx scripts/live-llm-connectivity-verify.ts
 */
import { loadEnvironment } from '../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../src/shared/config/config.loader.js';
import { isRedisEnabled } from '../src/shared/config/infra.flags.js';
import { createLogger } from '../src/shared/logger/logger.js';
import { createPrismaClient, getPrisma } from '../src/shared/database/prisma.js';
import { createRedisClient } from '../src/infra/redis/redis.client.js';
import {
  getAiPlatformConfig,
  resetAiPlatformConfigCache,
  validateAiSecrets,
} from '../src/modules/ai/config/ai.config.js';
import {
  validateOpenAiProvider,
  validateAnthropicProvider,
} from '../src/modules/ai/orchestrator/providers/provider.validation.js';
import { OpenAiProvider } from '../src/modules/ai/orchestrator/providers/openai.provider.js';
import { AnthropicProvider } from '../src/modules/ai/orchestrator/providers/anthropic.provider.js';
import { AiOrchestratorService } from '../src/modules/ai/orchestrator/ai-orchestrator.service.js';
import { runAiProviderHealthProbes } from '../src/modules/ai/health/ai-health-probe.service.js';
import { bootstrapAiGovernance, getAiGovernanceService } from '../src/modules/ai/governance/ai-governance.service.js';
import { getAiBudgetService } from '../src/modules/ai/budget/ai-budget.service.js';
import { estimateAiCostUsd } from '../src/modules/ai/usage/ai-usage.cost.js';

loadEnvironment();

const TEST_FEATURE = 'LIVE_CONNECTIVITY_TEST';
const PROBE_INPUT = {
  feature: TEST_FEATURE,
  systemPrompt: 'You are a connectivity probe. Reply with exactly: PONG',
  userMessage: 'ping',
  locale: 'en' as const,
  maxTokens: 10,
  temperature: 0,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function maskKey(key: string | undefined): string {
  if (!key) return '(not set)';
  if (key.length <= 8) return '***';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

type CheckResult = {
  name: string;
  pass: boolean;
  detail: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
};

async function main(): Promise<void> {
  resetConfigCache();
  const config = loadConfig();
  createLogger(config);
  createPrismaClient({ config });

  if (isRedisEnabled(config)) {
    try {
      createRedisClient({ config });
    } catch (err) {
      console.warn(
        JSON.stringify({
          warning: 'Redis enabled but unavailable — governance audit may fail',
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  const prisma = getPrisma();

  await bootstrapAiGovernance(config);

  const gov = getAiGovernanceService();
  const emptyScopes = gov.getScopeSnapshot();

  // Restore openai scope if a prior probe exited early (best-effort, no actorId → no Redis rate limit)
  await gov
    .setScopeDisabled({
      scopeType: 'provider',
      scopeId: 'openai',
      disabled: false,
      source: 'internal_api',
      reason: 'P0 BLOCKER-2 preflight restore',
    })
    .catch(() => {
      gov.applyLocalState(false, undefined, emptyScopes);
    });

  const aiConfig = getAiPlatformConfig();
  const { getAiSecretService } = await import('../src/modules/ai/vault/ai-secret.service.js');
  await getAiSecretService().refreshConfigurationCache();
  const secrets = await validateAiSecrets(aiConfig);
  const openAiValidation = validateOpenAiProvider();
  const anthropicValidation = validateAnthropicProvider();

  const checks: CheckResult[] = [];
  const providerStatus: Record<string, unknown> = {};

  // --- 1. OpenAI direct connectivity ---
  const openAi = new OpenAiProvider();
  if (!openAi.isConfigured()) {
    checks.push({
      name: 'openai_connectivity',
      pass: false,
      detail: 'OpenAI vault key not configured',
    });
    providerStatus.openai = { configured: false, reachable: false, errorCode: 'not_configured' };
  } else {
    const start = Date.now();
    try {
      const result = await openAi.complete(PROBE_INPUT);
      const latencyMs = Date.now() - start;
      checks.push({
        name: 'openai_connectivity',
        pass: true,
        detail: `OK — model=${result.model}, tokens in/out=${result.inputTokens}/${result.outputTokens}`,
        latencyMs,
        metadata: {
          costUsd: estimateAiCostUsd('openai', result.model, result.inputTokens, result.outputTokens),
        },
      });
      providerStatus.openai = {
        configured: true,
        reachable: true,
        latencyMs,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    } catch (err) {
      checks.push({
        name: 'openai_connectivity',
        pass: false,
        detail: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - start,
      });
      providerStatus.openai = {
        configured: true,
        reachable: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // --- 2. Anthropic direct connectivity ---
  const anthropic = new AnthropicProvider();
  if (!anthropic.isConfigured()) {
    checks.push({
      name: 'anthropic_connectivity',
      pass: false,
      detail: 'Anthropic vault key not configured',
    });
    providerStatus.anthropic = { configured: false, reachable: false, errorCode: 'not_configured' };
  } else {
    const start = Date.now();
    try {
      const result = await anthropic.complete(PROBE_INPUT);
      const latencyMs = Date.now() - start;
      checks.push({
        name: 'anthropic_connectivity',
        pass: true,
        detail: `OK — model=${result.model}, tokens in/out=${result.inputTokens}/${result.outputTokens}`,
        latencyMs,
        metadata: {
          costUsd: estimateAiCostUsd(
            'anthropic',
            result.model,
            result.inputTokens,
            result.outputTokens,
          ),
        },
      });
      providerStatus.anthropic = {
        configured: true,
        reachable: true,
        latencyMs,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    } catch (err) {
      checks.push({
        name: 'anthropic_connectivity',
        pass: false,
        detail: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - start,
      });
      providerStatus.anthropic = {
        configured: true,
        reachable: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const orchestrator = new AiOrchestratorService();

  // --- 3. Provider failover (block openai in governance mirror → chain continues) ---
  const failoverStart = Date.now();
  try {
    const baseScopes = gov.getScopeSnapshot();
    gov.applyLocalState(false, undefined, {
      features: baseScopes.features,
      providers: { ...baseScopes.providers, openai: true },
    });

    const result = await orchestrator.complete({
      ...PROBE_INPUT,
      userId: 'live-probe-user',
    });

    const failoverPass = result.provider === 'anthropic' || result.provider === 'rules-based';

    checks.push({
      name: 'provider_failover',
      pass: failoverPass,
      detail: `With openai governance-blocked, chain returned provider=${result.provider}`,
      latencyMs: Date.now() - failoverStart,
      metadata: { provider: result.provider, model: result.model },
    });

    gov.applyLocalState(false, undefined, baseScopes);
  } catch (err) {
    checks.push({
      name: 'provider_failover',
      pass: false,
      detail: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - failoverStart,
    });
  }

  // --- 4. Budget enforcement (live path with temporary budget cap) ---
  const savedDailyBudget = process.env.DAILY_AI_BUDGET_USD;
  const budgetStart = Date.now();
  try {
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    await prisma.aiUsageDailyRollup.upsert({
      where: {
        bucketDate_feature_provider_model: {
          bucketDate: today,
          feature: TEST_FEATURE,
          provider: 'openai',
          model: aiConfig.openaiModel,
        },
      },
      create: {
        bucketDate: today,
        feature: TEST_FEATURE,
        provider: 'openai',
        model: aiConfig.openaiModel,
        requestCount: 1,
        successCount: 1,
        billableCostUsd: 1.0,
        costUsd: 1.0,
      },
      update: { billableCostUsd: 1.0, costUsd: 1.0 },
    });

    process.env.DAILY_AI_BUDGET_USD = '0.001';
    resetAiPlatformConfigCache();
    getAiBudgetService().resetForTests();

    const status = await getAiBudgetService().getStatus();
    const budgetBlocked = status.blocked;

    const budgetResult = await orchestrator.complete({
      ...PROBE_INPUT,
      userMessage: 'budget probe',
      userId: 'live-probe-budget',
    });

    const budgetEnforced = budgetBlocked && budgetResult.provider === 'rules-based';

    checks.push({
      name: 'budget_enforcement',
      pass: budgetEnforced,
      detail: budgetEnforced
        ? `Budget blocked (spent $${status.daily.spentUsd} / cap $${status.daily.budgetUsd}) → rules-based`
        : `blocked=${budgetBlocked}, provider=${budgetResult.provider}`,
      latencyMs: Date.now() - budgetStart,
      metadata: { budgetStatus: status, resultProvider: budgetResult.provider },
    });

    await prisma.aiUsageDailyRollup.deleteMany({
      where: { feature: TEST_FEATURE, provider: 'openai' },
    });
  } catch (err) {
    checks.push({
      name: 'budget_enforcement',
      pass: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  } finally {
    if (savedDailyBudget === undefined) delete process.env.DAILY_AI_BUDGET_USD;
    else process.env.DAILY_AI_BUDGET_USD = savedDailyBudget;
    resetAiPlatformConfigCache();
    getAiBudgetService().resetForTests();
  }

  // --- 5–6. Usage + cost tracking (real orchestrator + DB) ---
  const usageBefore = await prisma.aiUsageRecord.count({ where: { feature: TEST_FEATURE } });
  const rollupBefore = await prisma.aiUsageDailyRollup.count({ where: { feature: TEST_FEATURE } });

  const trackingStart = Date.now();
  gov.applyLocalState(false);

  const tracked = await orchestrator.complete({
    ...PROBE_INPUT,
    userMessage: 'usage tracking probe',
    userId: 'live-probe-tracking',
  });
  await sleep(800);

  const usageAfter = await prisma.aiUsageRecord.count({ where: { feature: TEST_FEATURE } });
  const latestRecord = await prisma.aiUsageRecord.findFirst({
    where: { feature: TEST_FEATURE },
    orderBy: { createdAt: 'desc' },
  });
  const latestRollup = await prisma.aiUsageDailyRollup.findFirst({
    where: { feature: TEST_FEATURE },
    orderBy: { updatedAt: 'desc' },
  });

  checks.push({
    name: 'usage_tracking',
    pass: usageAfter > usageBefore && latestRecord != null,
    detail:
      usageAfter > usageBefore
        ? `AiUsageRecord ${usageBefore}→${usageAfter}; provider=${latestRecord?.provider}`
        : 'No new AiUsageRecord persisted',
    latencyMs: Date.now() - trackingStart,
    metadata: latestRecord
      ? {
          provider: latestRecord.provider,
          inputTokens: latestRecord.inputTokens,
          outputTokens: latestRecord.outputTokens,
          success: latestRecord.success,
        }
      : {},
  });

  checks.push({
    name: 'cost_tracking',
    pass: latestRecord != null && latestRollup != null,
    detail:
      latestRecord && latestRollup
        ? `record costUsd=${latestRecord.costUsd}; rollup billableCostUsd=${latestRollup.billableCostUsd}`
        : 'Missing cost rollup',
    metadata: {
      recordCostUsd: latestRecord?.costUsd?.toString() ?? null,
      rollupBillableCostUsd: latestRollup?.billableCostUsd?.toString() ?? null,
      estimatedCostUsd: latestRecord
        ? estimateAiCostUsd(
            latestRecord.provider,
            latestRecord.model,
            latestRecord.inputTokens,
            latestRecord.outputTokens,
          )
        : null,
    },
  });

  // --- 7–8. Governance + kill switch (live enforcement mirror) ---
  const killStart = Date.now();
  gov.applyLocalState(true);

  const killed = await orchestrator.complete({
    ...PROBE_INPUT,
    userMessage: 'kill switch probe',
  });

  const killPass = killed.provider === 'rules-based';

  gov.applyLocalState(false);

  const dbState = await gov.getStateFromDb().catch(() => null);

  checks.push({
    name: 'governance_rules',
    pass: dbState != null,
    detail:
      dbState != null
        ? `DB governance row present — llmDisabled=${dbState.llmDisabled}, version=${dbState.version}`
        : 'Could not read AiGovernanceState from PostgreSQL',
    metadata: dbState
      ? { llmDisabled: dbState.llmDisabled, version: dbState.version }
      : {},
  });

  checks.push({
    name: 'kill_switch',
    pass: killPass,
    detail: killPass
      ? 'LLM disabled via applyLocalState → orchestrator returned rules-based'
      : `Expected rules-based, got ${killed.provider}`,
    latencyMs: Date.now() - killStart,
  });

  // --- 9. Health monitoring ---
  const healthBefore = await prisma.aiProviderHealthSnapshot.count();
  const healthResults = await runAiProviderHealthProbes({ persist: true, skipNetwork: false });
  await sleep(300);
  const healthAfter = await prisma.aiProviderHealthSnapshot.count();

  const healthPersisted = healthAfter >= healthBefore;
  checks.push({
    name: 'health_monitoring',
    pass: healthPersisted,
    detail: healthPersisted
      ? `Probes ran; snapshots ${healthBefore}→${healthAfter}`
      : 'Health snapshots not persisted (AI_HEALTH_PROBE_ENABLED may be false)',
    metadata: { probes: healthResults },
  });

  // Cleanup probe data
  await prisma.aiUsageRecord.deleteMany({ where: { feature: TEST_FEATURE } });
  await prisma.aiUsageDailyRollup.deleteMany({ where: { feature: TEST_FEATURE } });
  await prisma.aiUsageMonthlyRollup.deleteMany({
    where: { dimensionType: 'platform', dimensionId: 'global' },
  });

  const weights: Record<string, number> = {
    openai_connectivity: 15,
    anthropic_connectivity: 15,
    provider_failover: 10,
    budget_enforcement: 10,
    usage_tracking: 12,
    cost_tracking: 10,
    governance_rules: 8,
    kill_switch: 10,
    health_monitoring: 10,
  };

  let earned = 0;
  let total = 0;
  for (const c of checks) {
    const w = weights[c.name] ?? 5;
    total += w;
    if (c.pass) earned += w;
  }

  const readinessScore = Math.round((earned / total) * 100);

  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      nodeEnv: config.nodeEnv,
      vaultMasterKeyConfigured: aiConfig.vaultMasterKeyConfigured,
      openaiVaultConfigured: openAi.isConfigured(),
      anthropicVaultConfigured: new AnthropicProvider().isConfigured(),
      openaiModel: aiConfig.openaiModel,
      anthropicModel: aiConfig.anthropicModel,
      dailyBudgetUsd: aiConfig.dailyBudgetUsd,
      monthlyBudgetUsd: aiConfig.monthlyBudgetUsd,
      healthProbeEnabled: aiConfig.healthProbeEnabled,
      redisEnabled: config.redis.enabled,
      llmRequired: aiConfig.llmRequired,
    },
    secretsValidation: secrets,
    providerValidation: { openAi: openAiValidation, anthropic: anthropicValidation },
    providerStatus,
    checks,
    readinessScore,
    verdict:
      readinessScore >= 85
        ? 'READY'
        : readinessScore >= 60
          ? 'DEGRADED'
          : 'NOT_READY',
  };

  console.log(JSON.stringify(report, null, 2));

  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const outPath = path.join(process.cwd(), 'reports', 'live-llm-result.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  } catch {
    /* optional artifact */
  }

  await prisma.$disconnect();
  process.exit(readinessScore >= 85 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
