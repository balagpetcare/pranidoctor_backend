import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient, disconnectPrisma, getPrisma } from '../../src/shared/database/prisma.js';

loadEnvironment();
resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });
const prisma = getPrisma();
try {
  const providers = await prisma.aiProvider.count({ where: { deletedAt: null } });
  const models = await prisma.aiModel.count({ where: { deletedAt: null } });
  const enabledProviders = await prisma.aiProvider.count({
    where: { deletedAt: null, enabled: true },
  });
  const enabledModels = await prisma.aiModel.count({
    where: { deletedAt: null, enabled: true },
  });
  console.log(
    JSON.stringify(
      { providers, models, enabledProviders, enabledModels, migrations: 'see prisma migrate status' },
      null,
      2,
    ),
  );
} finally {
  await disconnectPrisma();
}
