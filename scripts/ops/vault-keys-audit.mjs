import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient, getPrisma } from '../../src/shared/database/prisma.js';

loadEnvironment();
resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });

const keys = await getPrisma().aiApiKey.findMany({
  select: {
    id: true,
    providerKey: true,
    name: true,
    status: true,
    secretHint: true,
    disabledAt: true,
  },
  where: { deletedAt: null },
  orderBy: { providerKey: 'asc' },
});

console.log(JSON.stringify({ count: keys.length, keys }, null, 2));
await getPrisma().$disconnect();
