/**
 * Clear normalized BD location master (Village → Division).
 * npm run location:reset
 */
import { loadEnvironment } from "../src/shared/config/load-env.js";
import { disconnectPrisma, prisma } from "../src/lib/prisma.js";
import { resetLocationData } from "./location/lib/reset-location-data.js";

loadEnvironment();

async function main(): Promise<void> {
  const pre = {
    villages: await prisma.village.count(),
    unions: await prisma.union.count(),
    upazilas: await prisma.upazila.count(),
    districts: await prisma.district.count(),
    divisions: await prisma.division.count(),
  };

  console.log("[location:reset] Pre-clear counts:", pre);
  const counts = await resetLocationData(prisma);
  console.log("[location:reset] Cleared:", counts);

  const post = {
    villages: await prisma.village.count(),
    unions: await prisma.union.count(),
    upazilas: await prisma.upazila.count(),
    districts: await prisma.district.count(),
    divisions: await prisma.division.count(),
  };
  console.log("[location:reset] Post-clear counts:", post);
}

main()
  .then(() => disconnectPrisma())
  .catch(async (e) => {
    console.error(e);
    await disconnectPrisma();
    process.exit(1);
  });
