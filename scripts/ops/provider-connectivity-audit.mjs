import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient } from '../../src/shared/database/prisma.js';
import { getAiSecretService } from '../../src/modules/ai/vault/ai-secret.service.js';
import { testProviderApiKey } from '../../src/modules/ai/vault/provider-key-test.js';
import { getEncryptionService } from '../../src/modules/ai/vault/encryption.service.js';

loadEnvironment();
resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });

const vault = getAiSecretService();
await vault.refreshConfigurationCache();
const keys = await vault.listKeys();

const matrix = [];
for (const key of keys) {
  let probe = { ok: false, errorCode: 'skipped', message: 'inactive' };
  if (key.status === 'ACTIVE' && !key.disabledAt) {
    try {
      const full = await vault.resolveProviderSecret(key.providerKey);
      probe = await testProviderApiKey(key.providerKey, full, undefined);
    } catch (err) {
      probe = {
        ok: false,
        errorCode: 'resolve_failed',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
  matrix.push({
    providerKey: key.providerKey,
    id: key.id,
    name: key.name,
    status: key.status,
    secretHint: key.secretHint,
    vaultMasterKey: getEncryptionService().isMasterKeyConfigured(),
    probeOk: probe.ok,
    probeError: probe.ok ? undefined : (probe.errorCode ?? probe.message),
    latencyMs: probe.latencyMs,
  });
}

console.log(JSON.stringify({ keyCount: matrix.length, matrix }, null, 2));
