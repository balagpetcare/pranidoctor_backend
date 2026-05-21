/**
 * Location-only seed: reset, import from sheet, verify.
 * npm run seed:full-location | seed:reset-location | seed:location
 */
import { loadEnvironment } from "../src/shared/config/load-env.js";
import { disconnectPrisma, prisma } from "../src/lib/prisma.js";
import { importLocationSheet } from "../scripts/location/lib/import-location-sheet.js";
import { resetLocationData } from "../scripts/location/lib/reset-location-data.js";
import { verifyLocationHierarchy } from "../scripts/location/lib/verify-location-hierarchy.js";

loadEnvironment();

export { resetLocationData, importLocationSheet, verifyLocationHierarchy };

export async function runResetLocationOnly(): Promise<void> {
  await resetLocationData(prisma);
}

export async function runImportLocationOnly(): Promise<void> {
  await importLocationSheet(prisma);
}

export async function runFullLocationSeed(): Promise<void> {
  console.log("[seed:full-location] Resetting location master…");
  await resetLocationData(prisma);

  console.log("[seed:full-location] Importing from sheet…");
  const importReport = await importLocationSheet(prisma);

  console.log("[seed:full-location] Verifying hierarchy…");
  const verifyReport = await verifyLocationHierarchy(prisma);

  if (!verifyReport.passed) {
    throw new Error(
      `Location verify failed: ${verifyReport.errors.join("; ")}. Re-run npm run seed:full-location.`,
    );
  }

  console.log("[seed:full-location] Complete.", {
    import: importReport.summary,
    dbCounts: verifyReport.dbCounts,
  });
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "full";

  if (mode === "reset") {
    await runResetLocationOnly();
  } else if (mode === "import") {
    await runImportLocationOnly();
  } else if (mode === "full") {
    await runFullLocationSeed();
  } else {
    throw new Error(`Unknown mode: ${mode}. Use reset | import | full`);
  }
}

const isDirectRun = process.argv[1]?.includes("seed-location");
if (isDirectRun) {
  main()
    .then(() => disconnectPrisma())
    .catch(async (e) => {
      console.error(e);
      await disconnectPrisma();
      process.exit(1);
    });
}
