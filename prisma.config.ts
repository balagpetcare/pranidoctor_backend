import 'dotenv/config';
import { defineConfig } from 'prisma/config';

import { applyResolvedEnv } from './scripts/resolve-env.mjs';

applyResolvedEnv();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
