import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@/lib': path.join(rootDir, 'src/legacy/web/lib'),
      '@/types': path.join(rootDir, 'src/legacy/web/types'),
      '@/generated/prisma/client': path.join(rootDir, 'src/generated/prisma/client.ts'),
      '@auth/compat': path.join(rootDir, 'src/modules/auth/compat'),
      '@modules': path.join(rootDir, 'src/modules'),
      '@shared': path.join(rootDir, 'src/shared'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'scripts/db/**/*.test.mjs'],
    exclude: ['**/_archived_foundation/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
