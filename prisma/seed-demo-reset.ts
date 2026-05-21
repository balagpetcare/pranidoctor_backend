/**
 * Deletes **only** Prani Doctor demo rows created by `prisma/seed-demo.ts`
 * (fixed ids + `@pranidoctor.test` emails). Does not drop unrelated data.
 *
 * **Blocked** when `NODE_ENV=production` unless `ALLOW_DEMO_RESET_IN_PRODUCTION=true`.
 */
import "dotenv/config";

import {
  DEMO_ANIMAL_IDS,
  DEMO_BILLING_IDS,
  DEMO_NOTIFICATION_IDS,
  DEMO_PAYMENT_IDS,
  DEMO_SERVICE_REQUEST_IDS,
  DEMO_USER_EMAILS,
} from "./demo-seed-shared";
import { disconnectPrisma, prisma } from "../src/lib/prisma";

function assertResetAllowed(): void {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_RESET_IN_PRODUCTION !== "true"
  ) {
    console.error(
      "[seed-demo-reset] Aborted: production. Use a disposable dev DB or set ALLOW_DEMO_RESET_IN_PRODUCTION=true (dangerous).",
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  assertResetAllowed();

  const srIds = [...DEMO_SERVICE_REQUEST_IDS];
  const billIds = [...DEMO_BILLING_IDS];
  const payIds = [...DEMO_PAYMENT_IDS];
  const notifIds = [...DEMO_NOTIFICATION_IDS];
  const animalIds = [...DEMO_ANIMAL_IDS];
  const emails = [...DEMO_USER_EMAILS];

  console.info("[seed-demo-reset] Removing demo rows (payment → billing → notifications → requests → animals → users)…");

  const delPay = await prisma.paymentRecord.deleteMany({
    where: {
      OR: [{ id: { in: payIds } }, { serviceRequestId: { in: srIds } }],
    },
  });
  const delBill = await prisma.billingRecord.deleteMany({
    where: {
      OR: [{ id: { in: billIds } }, { serviceRequestId: { in: srIds } }],
    },
  });
  const delNotif = await prisma.notification.deleteMany({
    where: { id: { in: notifIds } },
  });
  const delSr = await prisma.serviceRequest.deleteMany({
    where: { id: { in: srIds } },
  });
  const delAnimals = await prisma.animalProfile.deleteMany({
    where: { id: { in: animalIds } },
  });
  const delUsers = await prisma.user.deleteMany({
    where: { email: { in: emails } },
  });

  console.info(
    `[seed-demo-reset] Deleted paymentRecords=${delPay.count} billingRecords=${delBill.count} notifications=${delNotif.count} serviceRequests=${delSr.count} animals=${delAnimals.count} users=${delUsers.count}`,
  );
  console.info("[seed-demo-reset] Settings keys mobile.app.config / mobile.feature.flags were not removed (optional manual cleanup).");
  console.info("[seed-demo-reset] Re-apply demo data: npm run db:seed:demo");
}

main()
  .then(async () => {
    await disconnectPrisma();
  })
  .catch(async (e: unknown) => {
    console.error(e);
    await disconnectPrisma();
    process.exit(1);
  });
