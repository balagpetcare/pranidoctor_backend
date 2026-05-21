/**
 * Import Bangladesh location master from sheet CSVs (single source of truth).
 * npm run seed:location
 */
import { loadEnvironment } from "../src/shared/config/load-env.js";
import { disconnectPrisma, prisma } from "../src/lib/prisma.js";
import { importLocationSheet } from "./location/lib/import-location-sheet.js";

loadEnvironment();

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const report = await importLocationSheet(prisma, { dryRun: DRY_RUN });
  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(() => disconnectPrisma())
  .catch(async (e) => {
    console.error(e);
    await disconnectPrisma();
    process.exit(1);
  });
