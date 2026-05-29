import { loadEnvironment } from '../../src/shared/config/load-env.js';

loadEnvironment();

import { runPhase4VendorsSeed } from '../../src/shared/feed-ecosystem/phase4-seed-runners.js';
import { disconnectPrisma } from '../../src/lib/prisma.js';

async function main() {
  const { created, updated } = await runPhase4VendorsSeed();
  console.log(`Phase 4 vendors seed complete: created=${created}, updated=${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
