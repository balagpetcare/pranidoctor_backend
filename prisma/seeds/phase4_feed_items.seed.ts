/**
 * Phase 4 FeedItem + FeedNutrition seed (Bangladesh).
 * Run: npm run db:seed:phase4-feed
 */
import { runPhase4FeedItemsSeed } from '../../src/shared/feed-ecosystem/phase4-seed-runners.js';
import { loadEnvironment } from '../../src/shared/config/load-env.js';

loadEnvironment();

import { disconnectPrisma } from '../../src/lib/prisma.js';

async function main() {
  const { created, updated } = await runPhase4FeedItemsSeed();
  console.log(`Phase 4 feed items seed complete: created=${created}, updated=${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
