#!/usr/bin/env node
/**
 * Idempotent import of LLM API keys from environment into AIMS vault.
 * Requires AI_VAULT_MASTER_KEY and seeded ai_providers rows.
 *
 * Usage: node scripts/ops/import-env-keys-to-vault.mjs
 */
import { config } from 'dotenv';

config();

const { getAiFoundationAdminService } = await import(
  '../../src/modules/ai/admin/ai-foundation-admin.service.js'
);

const actor = { id: 'ops-script', role: 'SUPER_ADMIN' };

try {
  const result = await getAiFoundationAdminService().syncEnvKeysToVault(actor);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.errors.length > 0 ? 1 : 0);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
