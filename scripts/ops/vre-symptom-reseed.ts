import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient } from '../../src/shared/database/prisma.js';
import { seedWave1SymptomsEnriched } from '../knowledge/wave1/wave1-symptoms.js';

loadEnvironment();
resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });

const result = await seedWave1SymptomsEnriched();
console.log(JSON.stringify(result));
