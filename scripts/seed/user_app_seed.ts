/**
 * USER_APP_TEST_SEED_V1 — realistic idempotent test data for Prani Doctor User App.
 *
 * Run:
 *   npm run seed:user
 *   npm run seed:user -- --small
 *   npm run seed:user -- --medium
 *   npm run seed:user -- --large
 *
 * Does NOT create location hierarchy rows (no Division/District/Village seeds).
 * Refuses production unless ALLOW_USER_APP_SEED_IN_PRODUCTION=true.
 */
import "dotenv/config";

import bcrypt from "bcryptjs";

import {
  AiAssistantStatus,
  AiMessageRole,
  AnimalCategory,
  AnimalType,
  BillingStatus,
  FinanceType,
  Gender,
  IncomeSource,
  MobileThemePreference,
  MobileUploadPurpose,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  PrescriptionStatus,
  Prisma,
  ProviderStatus,
  ReviewStatus,
  ServiceRequestStatus,
  ServiceRequestType,
  UploadedFileStatus,
  UserRole,
  UserStatus,
} from "../../src/generated/prisma/client.js";
import { disconnectPrisma, prisma } from "../../src/lib/prisma.js";

import {
  USER_APP_SEED_EMAIL_DOMAIN,
  USER_APP_SEED_ID_PREFIX,
  USER_APP_SEED_TAG,
  USER_APP_SEED_VERSION,
  animalName,
  createRng,
  customerEmail,
  customerPhone,
  dateOfBirthFromAgeYears,
  daysAgo,
  displayName,
  doctorEmail,
  doctorPhone,
  adminEmail,
  hashSeed,
  logProgress,
  logSkip,
  logStep,
  parseSeedScale,
  pick,
  pickMedicines,
  pickWeighted,
  placeholderAnimalPhotoUrl,
  placeholderAvatarUrl,
  placeholderFarmCoverUrl,
  scaleCounts,
  stableId,
  type SeedCounts,
  type SeedScale,
} from "./user-app-seed-helpers.js";

const BCRYPT_COST = 12;
const RNG_SEED = hashSeed(USER_APP_SEED_TAG, USER_APP_SEED_VERSION);

const PASSWORD =
  process.env.USER_APP_SEED_PASSWORD ?? "UserAppSeed!Test123";
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, BCRYPT_COST);

const SETTING_META = `${USER_APP_SEED_TAG}.meta`;
const SETTING_FARMS = `${USER_APP_SEED_TAG}.farms`;
const SETTING_DASHBOARD_PREFIX = `${USER_APP_SEED_TAG}.dashboard_cache.`;
const SETTING_DOCTOR_SCHEDULE_PREFIX = `${USER_APP_SEED_TAG}.doctor_schedule.`;
const SETTING_DOCTOR_STATS_PREFIX = `${USER_APP_SEED_TAG}.doctor_stats.`;
const SETTING_WALLET_PREFIX = `${USER_APP_SEED_TAG}.wallet.`;

const ANIMAL_TYPE_MIX: { type: AnimalType; species: string; category: AnimalCategory }[] = [
  { type: AnimalType.CATTLE, species: "গরু", category: AnimalCategory.LIVESTOCK },
  { type: AnimalType.GOAT, species: "ছাগল", category: AnimalCategory.LIVESTOCK },
  { type: AnimalType.POULTRY, species: "মুরগি", category: AnimalCategory.LIVESTOCK },
  { type: AnimalType.CAT, species: "বিড়াল", category: AnimalCategory.PET },
  { type: AnimalType.DOG, species: "কুকুর", category: AnimalCategory.PET },
];

const USER_STATUSES: UserStatus[] = [
  UserStatus.ACTIVE,
  UserStatus.ACTIVE,
  UserStatus.ACTIVE,
  UserStatus.PENDING_VERIFICATION,
  UserStatus.SUSPENDED,
  UserStatus.INVITED,
];

const PROVIDER_STATUSES: ProviderStatus[] = [
  ProviderStatus.ACTIVE,
  ProviderStatus.ACTIVE,
  ProviderStatus.PENDING_VERIFICATION,
  ProviderStatus.SUSPENDED,
  ProviderStatus.REJECTED,
];

const APPOINTMENT_STATUSES: ServiceRequestStatus[] = [
  ServiceRequestStatus.PENDING,
  ServiceRequestStatus.ACCEPTED,
  ServiceRequestStatus.ASSIGNED,
  ServiceRequestStatus.IN_PROGRESS,
  ServiceRequestStatus.COMPLETED,
  ServiceRequestStatus.CANCELLED,
];

type SeedContext = {
  scale: SeedScale;
  counts: SeedCounts;
  rng: () => number;
  customerUserIds: string[];
  customerProfileIds: string[];
  doctorProfileIds: string[];
  doctorUserIds: string[];
  animalIds: string[];
  serviceCategoryId: string;
  emergencyCategoryId: string;
};

function pushUnique(target: string[], id: string): void {
  if (!target.includes(id)) target.push(id);
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function assertSafeToRun(): void {
  if (isProduction() && process.env.ALLOW_USER_APP_SEED_IN_PRODUCTION !== "true") {
    console.error(
      "[seed:user] Aborted: NODE_ENV=production. Set ALLOW_USER_APP_SEED_IN_PRODUCTION=true only on a disposable DB.",
    );
    process.exit(1);
  }
}

function weightKg(animalType: AnimalType, rng: () => number): Prisma.Decimal {
  const base: Record<AnimalType, number> = {
    [AnimalType.CATTLE]: 180 + rng() * 120,
    [AnimalType.GOAT]: 15 + rng() * 25,
    [AnimalType.POULTRY]: 1.5 + rng() * 2,
    [AnimalType.DOG]: 8 + rng() * 22,
    [AnimalType.CAT]: 2 + rng() * 5,
    [AnimalType.OTHER]: 20 + rng() * 40,
  };
  return new Prisma.Decimal(base[animalType].toFixed(3));
}

async function assertPrerequisites(): Promise<{ doctorVisitId: string; emergencyId: string }> {
  const doctorVisit = await prisma.serviceCategory.findUnique({
    where: { slug: "doctor-visit" },
    select: { id: true },
  });
  const emergency = await prisma.serviceCategory.findUnique({
    where: { slug: "emergency" },
    select: { id: true },
  });
  if (!doctorVisit || !emergency) {
    console.error(
      "[seed:user] Missing service categories. Run `npm run db:seed` (or `db:seed:demo`) first.",
    );
    process.exit(1);
  }
  return { doctorVisitId: doctorVisit.id, emergencyId: emergency.id };
}

async function seedUsers(ctx: SeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    let created = 0;
    let skipped = 0;

    for (let i = 1; i <= ctx.counts.customers; i++) {
      const id = stableId("user-customer", i, 3);
      const email = customerEmail(i);
      if (await tx.user.findUnique({ where: { id }, select: { id: true } })) {
        skipped++;
        pushUnique(ctx.customerUserIds, id);
        const cp = await tx.customerProfile.findUnique({
          where: { userId: id },
          select: { id: true },
        });
        if (cp) pushUnique(ctx.customerProfileIds, cp.id);
        continue;
      }

      const rng = createRng(hashSeed("customer", String(i)));
      const status = pick(rng, USER_STATUSES);
      const completeProfile = rng() > 0.35;

      const user = await tx.user.create({
        data: {
          id,
          email,
          phone: customerPhone(i),
          passwordHash: PASSWORD_HASH,
          role: UserRole.CUSTOMER,
          status,
        },
      });
      pushUnique(ctx.customerUserIds, user.id);

      const profileId = stableId("cprofile", i, 3);
      const gender = pick(rng, [Gender.MALE, Gender.FEMALE, Gender.OTHER, Gender.UNKNOWN]);
      const locale = rng() > 0.25 ? "bn-BD" : "en-US";
      const profile = await tx.customerProfile.create({
        data: {
          id: profileId,
          userId: user.id,
          displayName: displayName(rng, i),
          locale,
          profilePhotoUrl: rng() > 0.2 ? placeholderAvatarUrl(`c-${i}`) : null,
          profilePhotoThumbUrl: rng() > 0.3 ? placeholderAvatarUrl(`c-${i}-thumb`) : null,
          coverPhotoUrl: rng() > 0.45 ? placeholderFarmCoverUrl(`cover-${i}`) : null,
          profileCompletedAt: completeProfile ? daysAgo(rng, 90) : null,
          addressJson: {
            userAppSeed: true,
            areaLabel: `Test farm area ${i} (no geo FK)`,
            gender,
            dateOfBirth: dateOfBirthFromAgeYears(rng, 22 + Math.floor(rng() * 40)).toISOString(),
            bio:
              rng() > 0.4
                ? `Test customer bio #${i} — livestock farmer (seed only).`
                : null,
            preferences: {
              notifications: rng() > 0.15,
              marketing: rng() > 0.7,
              language: locale,
              theme: pick(rng, ["system", "light", "dark"]),
            },
          },
        },
      });
      pushUnique(ctx.customerProfileIds, profile.id);

      if (rng() > 0.3) {
        await tx.mobileUserSettings.create({
          data: {
            userId: user.id,
            theme: pick(rng, [
              MobileThemePreference.SYSTEM,
              MobileThemePreference.LIGHT,
              MobileThemePreference.DARK,
            ]),
            locale,
            privacyAcceptedVersion: completeProfile ? "2026-05-01" : null,
            privacyAcceptedAt: completeProfile ? daysAgo(rng, 120) : null,
            termsAcceptedVersion: completeProfile ? "2026-05-01" : null,
            termsAcceptedAt: completeProfile ? daysAgo(rng, 120) : null,
          },
        });
      }

      if (rng() > 0.25) {
        await tx.notificationSettings.create({
          data: {
            userId: user.id,
            pushEnabled: rng() > 0.2,
            marketingEnabled: rng() > 0.6,
            treatmentReminderEnabled: true,
            vaccineReminderEnabled: true,
            orderServiceEnabled: true,
          },
        });
      }

      created++;
      logProgress("users/customers", i, ctx.counts.customers);
    }

    for (let i = 1; i <= ctx.counts.doctors; i++) {
      const id = stableId("user-doctor", i, 3);
      const email = doctorEmail(i);
      if (await tx.user.findUnique({ where: { id }, select: { id: true } })) {
        skipped++;
        const dp = await tx.doctorProfile.findUnique({
          where: { userId: id },
          select: { id: true },
        });
        if (dp) pushUnique(ctx.doctorProfileIds, dp.id);
        pushUnique(ctx.doctorUserIds, id);
        continue;
      }

      const rng = createRng(hashSeed("doctor", String(i)));
      const providerStatus = pick(rng, PROVIDER_STATUSES);
      const verified = providerStatus === ProviderStatus.ACTIVE;

      const user = await tx.user.create({
        data: {
          id,
          email,
          phone: doctorPhone(i),
          passwordHash: PASSWORD_HASH,
          role: UserRole.DOCTOR,
          status: pick(rng, USER_STATUSES),
        },
      });
      pushUnique(ctx.doctorUserIds, user.id);

      const profile = await tx.doctorProfile.create({
        data: {
          id: stableId("dprofile", i, 3),
          userId: user.id,
          licenseNumber: `UA-LIC-${String(i).padStart(5, "0")}`,
          displayName: `Dr. ${displayName(rng, i)}`,
          specialization: pick(rng, ["খামার", "পশুচিকিৎসা", "জরুরি", "পোল্ট্রি"]),
          degree: pick(rng, ["BVM", "DVM", "MVSc"]),
          experienceYears: 2 + Math.floor(rng() * 20),
          bio: `Doctor test profile #${i} (user app seed).`,
          profilePhotoUrl: placeholderAvatarUrl(`d-${i}`),
          visitFeeBdt: new Prisma.Decimal((1200 + rng() * 1500).toFixed(2)),
          acceptsEmergency: rng() > 0.4,
          acceptsOnlineConsultation: rng() > 0.5,
          providerStatus,
          verifiedAt: verified ? daysAgo(rng, 200) : null,
        },
      });
      pushUnique(ctx.doctorProfileIds, profile.id);
      created++;
      logProgress("users/doctors", i, ctx.counts.doctors);
    }

    for (let i = 1; i <= ctx.counts.admins; i++) {
      const id = stableId("user-admin", i, 3);
      if (await tx.user.findUnique({ where: { id }, select: { id: true } })) {
        skipped++;
        continue;
      }
      const rng = createRng(hashSeed("admin", String(i)));
      await tx.user.create({
        data: {
          id,
          email: adminEmail(i),
          phone: `016${String(3000000 + i).padStart(7, "0")}`,
          passwordHash: PASSWORD_HASH,
          role: UserRole.ADMIN,
          status: pick(rng, [UserStatus.ACTIVE, UserStatus.ACTIVE, UserStatus.INVITED]),
        },
      });
      await tx.adminProfile.create({
        data: {
          id: stableId("aprofile", i, 3),
          userId: id,
          displayName: `Admin ${displayName(rng, i)}`,
        },
      });
      created++;
    }

    logStep(
      "users",
      `customers=${ctx.customerUserIds.length} doctors=${ctx.doctorProfileIds.length} created=${created} skipped=${skipped}`,
    );
  });
}

async function seedAnimals(ctx: SeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    let created = 0;
    let skipped = 0;
    const customerCount = ctx.customerProfileIds.length;
    if (customerCount === 0) return;

    for (let i = 1; i <= ctx.counts.animals; i++) {
      const id = stableId("animal", i, 4);
      if (await tx.animalProfile.findUnique({ where: { id }, select: { id: true } })) {
        skipped++;
        pushUnique(ctx.animalIds, id);
        continue;
      }

      const rng = createRng(hashSeed("animal", String(i)));
      const mix = pick(rng, ANIMAL_TYPE_MIX);
      const customerId = ctx.customerProfileIds[(i - 1) % customerCount]!;
      const ageYears = 1 + Math.floor(rng() * 12);

      await tx.animalProfile.create({
        data: {
          id,
          customerId,
          name: animalName(rng, mix.type),
          species: mix.species,
          breed: rng() > 0.3 ? pick(rng, ["Local", "Cross", "Sahiwal", "Friesian"]) : null,
          category: mix.category,
          animalType: mix.type,
          gender: pick(rng, [Gender.MALE, Gender.FEMALE, Gender.UNKNOWN]),
          dateOfBirth: dateOfBirthFromAgeYears(rng, ageYears),
          weightKg: weightKg(mix.type, rng),
          photoUrl: rng() > 0.25 ? placeholderAnimalPhotoUrl(id) : null,
          notes: rng() > 0.5 ? `Seed notes for animal ${i}` : null,
          active: rng() > 0.12,
        },
      });
      pushUnique(ctx.animalIds, id);
      created++;
      logProgress("animals", i, ctx.counts.animals);
    }

    logStep("animals", `total=${ctx.animalIds.length} created=${created} skipped=${skipped}`);
  });
}

async function seedFarms(ctx: SeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const farms: {
      id: string;
      name: string;
      description: string;
      coverImageUrl: string;
      ownerCustomerProfileIds: string[];
      animalCount: number;
      activeAnimalCount: number;
    }[] = [];

    const animalByCustomer = new Map<string, { total: number; active: number }>();
    for (const animalId of ctx.animalIds) {
      const row = await tx.animalProfile.findUnique({
        where: { id: animalId },
        select: { customerId: true, active: true },
      });
      if (!row) continue;
      const cur = animalByCustomer.get(row.customerId) ?? { total: 0, active: 0 };
      cur.total++;
      if (row.active) cur.active++;
      animalByCustomer.set(row.customerId, cur);
    }

    for (let i = 1; i <= ctx.counts.farms; i++) {
      const rng = createRng(hashSeed("farm", String(i)));
      const farmId = stableId("farm", i, 4);
      const primaryOwner =
        ctx.customerProfileIds[i % Math.max(1, ctx.customerProfileIds.length)]!;
      const secondaryOwner =
        ctx.customerProfileIds[(i + 7) % Math.max(1, ctx.customerProfileIds.length)]!;
      const owners =
        rng() > 0.75 && primaryOwner !== secondaryOwner
          ? [primaryOwner, secondaryOwner]
          : [primaryOwner];
      const counts = animalByCustomer.get(primaryOwner) ?? { total: 0, active: 0 };

      farms.push({
        id: farmId,
        name: `খামার ${i}`,
        description: `Synthetic farm #${i} for user-app testing (no location FK).`,
        coverImageUrl: placeholderFarmCoverUrl(farmId),
        ownerCustomerProfileIds: owners,
        animalCount: counts.total,
        activeAnimalCount: counts.active,
      });

      if (i <= ctx.customerProfileIds.length) {
        const cpId = ctx.customerProfileIds[i - 1]!;
        const existing = await tx.customerProfile.findUnique({
          where: { id: cpId },
          select: { addressJson: true },
        });
        const prev =
          existing?.addressJson && typeof existing.addressJson === "object"
            ? (existing.addressJson as Record<string, unknown>)
            : {};
        await tx.customerProfile.update({
          where: { id: cpId },
          data: {
            addressJson: {
              ...prev,
              userAppSeed: true,
              farmId,
              farmName: `খামার ${i}`,
              farmDescription: farms[farms.length - 1]!.description,
              farmCoverUrl: farms[farms.length - 1]!.coverImageUrl,
            },
          },
        });
      }
    }

    await tx.setting.upsert({
      where: { key: SETTING_FARMS },
      create: {
        key: SETTING_FARMS,
        valueJson: { version: USER_APP_SEED_VERSION, farms },
      },
      update: {
        valueJson: { version: USER_APP_SEED_VERSION, farms },
      },
    });

    logStep("farms", `catalog=${farms.length} (Setting ${SETTING_FARMS})`);
  });
}

async function seedAppointments(ctx: SeedContext): Promise<{
  serviceRequestIds: string[];
}> {
  const serviceRequestIds: string[] = [];
  await prisma.$transaction(async (tx) => {
    let created = 0;
    let skipped = 0;
    const animalCount = ctx.animalIds.length;
    const doctorCount = ctx.doctorProfileIds.length;
    if (animalCount === 0 || ctx.customerProfileIds.length === 0) return;

    for (let i = 1; i <= ctx.counts.appointments; i++) {
      const id = stableId("appt", i, 4);
      if (await tx.serviceRequest.findUnique({ where: { id }, select: { id: true } })) {
        skipped++;
        pushUnique(serviceRequestIds, id);
        continue;
      }

      const rng = createRng(hashSeed("appt", String(i)));
      const status = APPOINTMENT_STATUSES[i % APPOINTMENT_STATUSES.length]!;
      const animalId = ctx.animalIds[(i - 1) % animalCount]!;
      const animal = await tx.animalProfile.findUnique({
        where: { id: animalId },
        select: { customerId: true },
      });
      if (!animal) continue;

      const isEmergency = status === ServiceRequestStatus.PENDING && rng() > 0.85;
      const assignedDoctorId =
        doctorCount > 0 &&
        [
          ServiceRequestStatus.ACCEPTED,
          ServiceRequestStatus.ASSIGNED,
          ServiceRequestStatus.IN_PROGRESS,
          ServiceRequestStatus.COMPLETED,
        ].includes(status)
          ? ctx.doctorProfileIds[i % doctorCount]!
          : null;

      const createdAt = daysAgo(rng, 120);
      const completedAt =
        status === ServiceRequestStatus.COMPLETED ? daysAgo(rng, 30) : null;
      const cancelledAt =
        status === ServiceRequestStatus.CANCELLED ? daysAgo(rng, 20) : null;

      await tx.serviceRequest.create({
        data: {
          id,
          customerId: animal.customerId,
          animalId,
          serviceCategoryId: isEmergency
            ? ctx.emergencyCategoryId
            : ctx.serviceCategoryId,
          status,
          serviceType: isEmergency
            ? ServiceRequestType.EMERGENCY_DOCTOR
            : ServiceRequestType.DOCTOR_HOME_VISIT,
          isEmergency,
          problemOrSymptom: pick(rng, [
            "জ্বর ও খাওয়া কমেছে",
            "হাঁটাহাটি করতে পারছে না",
            "দুধ কমে গেছে",
            "কাশি ও নাক থেকে স্রাব",
          ]),
          preferredTime: pick(rng, ["সকাল", "দুপুর", "বিকেল", "যেকোনো"]),
          locationText: `Test visit location note #${i} (text only)`,
          assignedDoctorId,
          assignedAt: assignedDoctorId ? createdAt : null,
          startedAt:
            status === ServiceRequestStatus.IN_PROGRESS ||
            status === ServiceRequestStatus.COMPLETED
              ? daysAgo(rng, 25)
              : null,
          completedAt,
          cancelledAt,
          cancelReason:
            status === ServiceRequestStatus.CANCELLED ? "Customer rescheduled" : null,
          createdAt,
          submittedAt: createdAt,
        },
      });
      pushUnique(serviceRequestIds, id);
      created++;
      logProgress("appointments", i, ctx.counts.appointments);
    }

    logStep(
      "appointments",
      `total=${serviceRequestIds.length} created=${created} skipped=${skipped}`,
    );
  });
  return { serviceRequestIds };
}

async function seedDoctorSide(ctx: SeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const weekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    let reviewsCreated = 0;

    for (let i = 0; i < ctx.doctorProfileIds.length; i++) {
      const doctorId = ctx.doctorProfileIds[i]!;
      const rng = createRng(hashSeed("doctor-side", doctorId));

      const schedule = weekdays.map((day, d) => ({
        day,
        slots: [
          {
            start: "09:00",
            end: "12:00",
            available: rng() > 0.15,
          },
          {
            start: "15:00",
            end: "18:00",
            available: rng() > 0.2,
          },
        ],
        sortOrder: d,
      }));

      await tx.setting.upsert({
        where: { key: `${SETTING_DOCTOR_SCHEDULE_PREFIX}${doctorId}` },
        create: {
          key: `${SETTING_DOCTOR_SCHEDULE_PREFIX}${doctorId}`,
          valueJson: {
            doctorId,
            schedules: schedule,
            availabilityStatus: rng() > 0.2 ? "AVAILABLE" : "BUSY",
            acceptsEmergency: rng() > 0.4,
          },
        },
        update: {
          valueJson: {
            doctorId,
            schedules: schedule,
            availabilityStatus: rng() > 0.2 ? "AVAILABLE" : "BUSY",
            acceptsEmergency: rng() > 0.4,
          },
        },
      });

      const ratingCount = 3 + Math.floor(rng() * 12);
      let ratingSum = 0;
      for (let r = 0; r < ratingCount; r++) {
        const reviewId = stableId(`review-d${i}`, r + 1, 3);
        if (await tx.review.findUnique({ where: { id: reviewId }, select: { id: true } })) {
          continue;
        }
        const customerId =
          ctx.customerProfileIds[r % Math.max(1, ctx.customerProfileIds.length)]!;
        const stars = 3 + Math.floor(rng() * 3);
        ratingSum += stars;
        await tx.review.create({
          data: {
            id: reviewId,
            customerId,
            doctorId,
            rating: stars,
            comment: rng() > 0.4 ? `Test review ${r + 1} for doctor ${i + 1}` : null,
            status: pick(rng, [
              ReviewStatus.APPROVED,
              ReviewStatus.APPROVED,
              ReviewStatus.PENDING,
            ]),
            createdAt: daysAgo(rng, 180),
          },
        });
        reviewsCreated++;
      }

      await tx.setting.upsert({
        where: { key: `${SETTING_DOCTOR_STATS_PREFIX}${doctorId}` },
        create: {
          key: `${SETTING_DOCTOR_STATS_PREFIX}${doctorId}`,
          valueJson: {
            averageRating: ratingCount > 0 ? ratingSum / ratingCount : null,
            reviewCount: ratingCount,
            consultationsCount: Math.floor(rng() * 80),
          },
        },
        update: {
          valueJson: {
            averageRating: ratingCount > 0 ? ratingSum / ratingCount : null,
            reviewCount: ratingCount,
            consultationsCount: Math.floor(rng() * 80),
          },
        },
      });
    }

    logStep("doctor-side", `doctors=${ctx.doctorProfileIds.length} reviews+≈${reviewsCreated}`);
  });
}

async function seedPrescriptions(
  ctx: SeedContext,
  serviceRequestIds: string[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    let created = 0;
    let skipped = 0;
    const eligible = serviceRequestIds.filter((_, idx) => idx % 2 === 0);
    const pool = eligible.length > 0 ? eligible : serviceRequestIds;

    for (let i = 1; i <= ctx.counts.prescriptions; i++) {
      const id = stableId("rx", i, 4);
      if (await tx.prescription.findUnique({ where: { id }, select: { id: true } })) {
        skipped++;
        continue;
      }

      const rng = createRng(hashSeed("rx", String(i)));
      const srId = pool[(i - 1) % Math.max(1, pool.length)]!;
      const sr = await tx.serviceRequest.findUnique({
        where: { id: srId },
        select: { animalId: true, assignedDoctorId: true },
      });
      if (!sr) continue;

      await tx.prescription.create({
        data: {
          id,
          serviceRequestId: srId,
          animalId: sr.animalId,
          doctorId: sr.assignedDoctorId,
          status: pick(rng, [PrescriptionStatus.ACTIVE, PrescriptionStatus.VOIDED]),
          instructions: pick(rng, [
            "খাবারের সাথে ওষুধ দিন; পানি ঠিক রাখুন।",
            "৭ দিন পর ফলো-আপ করুন।",
            "আলাদা রাখুন; সংক্রমণ রোধে সাবধানতা।",
          ]),
          validUntil: daysAgo(rng, -30),
          items: {
            create: pickMedicines(rng, 1 + Math.floor(rng() * 4)).map((name, idx) => ({
              id: stableId(`rxitem-${i}`, idx + 1, 3),
              medicineName: name,
              dosage: pick(rng, ["5ml", "10ml", "1 tablet", "2 tablet"]),
              duration: pick(rng, ["3 days", "5 days", "7 days"]),
              instruction: "After feed",
            })),
          },
        },
      });
      created++;
      logProgress("prescriptions", i, ctx.counts.prescriptions);
    }

    logStep("prescriptions", `created=${created} skipped=${skipped}`);
  });
}

async function seedNotifications(ctx: SeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const allUserIds = [...ctx.customerUserIds, ...ctx.doctorUserIds];
    if (allUserIds.length === 0) return;

    const batch: Prisma.NotificationCreateManyInput[] = [];
    let skipped = 0;

    for (let i = 1; i <= ctx.counts.notifications; i++) {
      const id = stableId("notif", i, 5);
      const exists = await tx.notification.findUnique({ where: { id }, select: { id: true } });
      if (exists) {
        skipped++;
        continue;
      }

      const rng = createRng(hashSeed("notif", String(i)));
      const read = rng() > 0.4;
      batch.push({
        id,
        userId: allUserIds[i % allUserIds.length]!,
        title: pick(rng, ["অ্যাপয়েন্টমেন্ট আপডেট", "পেমেন্ট", "নতুন বার্তা", "সিস্টেম"]),
        body: `Test notification #${i} for user app seed.`,
        type: pickWeighted(rng, [
          { value: NotificationType.REQUEST_UPDATE, weight: 3 },
          { value: NotificationType.PAYMENT, weight: 2 },
          { value: NotificationType.CHAT, weight: 2 },
          { value: NotificationType.SYSTEM, weight: 2 },
          { value: NotificationType.MARKETING, weight: 1 },
        ]),
        readAt: read ? daysAgo(rng, 14) : null,
        metadataJson: {
          channel: rng() > 0.5 ? "push" : "inapp",
          userAppSeed: true,
        },
        createdAt: daysAgo(rng, 60),
      });

      if (batch.length >= 200) {
        await tx.notification.createMany({ data: batch, skipDuplicates: true });
        batch.length = 0;
        logProgress("notifications", i, ctx.counts.notifications);
      }
    }

    if (batch.length > 0) {
      await tx.notification.createMany({ data: batch, skipDuplicates: true });
    }

    logStep(
      "notifications",
      `target=${ctx.counts.notifications} skipped=${skipped}`,
    );
  });
}

async function seedChat(ctx: SeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const userPool = ctx.customerUserIds;
    if (userPool.length === 0) return;

    let messagesCreated = 0;
    let sessionsSkipped = 0;
    let msgSeq = 0;

    for (let i = 1; i <= ctx.counts.conversations; i++) {
      if (messagesCreated >= ctx.counts.messages) break;

      const sessionId = stableId("chat", i, 4);
      const sessionExists = await tx.aiAssistantSession.findUnique({
        where: { id: sessionId },
        select: { id: true },
      });
      if (sessionExists) {
        sessionsSkipped++;
        continue;
      }

      const rng = createRng(hashSeed("chat", String(i)));
      const userId = userPool[i % userPool.length]!;

      await tx.aiAssistantSession.create({
        data: {
          id: sessionId,
          userId,
          locale: rng() > 0.3 ? "bn" : "en",
          status: pick(rng, [
            AiAssistantStatus.ACTIVE,
            AiAssistantStatus.CLOSED,
            AiAssistantStatus.ESCALATED,
          ]),
          createdAt: daysAgo(rng, 90),
        },
      });

      const remaining = ctx.counts.messages - messagesCreated;
      const remainingSessions = ctx.counts.conversations - i + 1;
      const targetMsgs = Math.max(
        1,
        Math.min(remaining, Math.ceil(remaining / remainingSessions)),
      );

      const msgBatch: Prisma.AiAssistantMessageCreateManyInput[] = [];
      for (let m = 0; m < targetMsgs && messagesCreated < ctx.counts.messages; m++) {
        msgSeq++;
        const msgId = stableId("chatmsg", msgSeq, 5);
        msgBatch.push({
          id: msgId,
          sessionId,
          role: m % 2 === 0 ? AiMessageRole.USER : AiMessageRole.ASSISTANT,
          content:
            m % 2 === 0
              ? pick(rng, ["আমার গরু জ্বর করছে", "দুধ কমে গেছে", "টিকা কখন নেব?"])
              : pick(rng, [
                  "লক্ষণ লক্ষ করুন; জরুরি হলে ডাক্তার ডাকুন।",
                  "পর্যাপ্ত পানি ও ছায়া নিশ্চিত করুন।",
                  "নিকটস্থ ভেটের সাথে যোগাযোগ করুন।",
                ]),
          locale: "bn",
          createdAt: daysAgo(rng, 60),
        });
        messagesCreated++;
      }

      if (msgBatch.length > 0) {
        await tx.aiAssistantMessage.createMany({ data: msgBatch, skipDuplicates: true });
      }
      logProgress("chat/sessions", i, ctx.counts.conversations);
    }

    logStep(
      "chat",
      `sessions=${ctx.counts.conversations} messages≈${messagesCreated} skipped_sessions=${sessionsSkipped}`,
    );
  });
}

async function seedWallet(ctx: SeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const n = Math.min(ctx.counts.walletCustomers, ctx.customerProfileIds.length);
    for (let i = 0; i < n; i++) {
      const customerProfileId = ctx.customerProfileIds[i]!;
      const userId = ctx.customerUserIds[i]!;
      const rng = createRng(hashSeed("wallet", userId));
      const balance = Math.round(500 + rng() * 9500);

      await tx.setting.upsert({
        where: { key: `${SETTING_WALLET_PREFIX}${userId}` },
        create: {
          key: `${SETTING_WALLET_PREFIX}${userId}`,
          valueJson: {
            balanceBdt: balance,
            currency: "BDT",
            userAppSeed: true,
            updatedAt: new Date().toISOString(),
          },
        },
        update: {
          valueJson: {
            balanceBdt: balance,
            currency: "BDT",
            userAppSeed: true,
            updatedAt: new Date().toISOString(),
          },
        },
      });

      for (let t = 0; t < 3; t++) {
        const finId = stableId(`wallet-fin-${i}`, t + 1, 3);
        if (await tx.financeRecord.findUnique({ where: { id: finId }, select: { id: true } })) {
          continue;
        }
        const isIncome = t % 2 === 0;
        await tx.financeRecord.create({
          data: {
            id: finId,
            customerId: customerProfileId,
            type: isIncome ? FinanceType.INCOME : FinanceType.EXPENSE,
            amountBdt: new Prisma.Decimal((200 + rng() * 1800).toFixed(2)),
            recordedDate: daysAgo(rng, 90),
            source: isIncome ? IncomeSource.MILK_SALES : null,
            notes: `Wallet seed txn ${t + 1}`,
            farmRef: stableId("farm", (i % ctx.counts.farms) + 1, 4),
          },
        });
      }
    }

    logStep("wallet", `customers=${n} (Setting + FinanceRecord)`);
  });
}

async function seedMedia(ctx: SeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    let created = 0;
    let skipped = 0;
    const owners = [...ctx.customerUserIds, ...ctx.doctorUserIds].slice(
      0,
      Math.min(ctx.counts.mediaFiles, ctx.customerUserIds.length + ctx.doctorUserIds.length),
    );

    for (let i = 1; i <= ctx.counts.mediaFiles; i++) {
      const id = stableId("file", i, 4);
      if (await tx.uploadedFile.findUnique({ where: { id }, select: { id: true } })) {
        skipped++;
        continue;
      }

      const rng = createRng(hashSeed("file", String(i)));
      const ownerUserId = owners[i % Math.max(1, owners.length)] ?? ctx.customerUserIds[0]!;
      const purpose =
        i % 3 === 0
          ? MobileUploadPurpose.CUSTOMER_COVER_IMAGE
          : MobileUploadPurpose.CUSTOMER_PROFILE_PHOTO;

      await tx.uploadedFile.create({
        data: {
          id,
          ownerUserId,
          bucket: "user-app-seed",
          storageKey: `user-app-seed/${USER_APP_SEED_VERSION}/refs/${id}.jpg`,
          originalName: `${id}.jpg`,
          mimeType: "image/jpeg",
          sizeBytes: 1024 + Math.floor(rng() * 8000),
          fileCategory: purpose,
          publicUrl: `/api/mobile/uploads/${id}`,
          status: UploadedFileStatus.ACTIVE,
        },
      });
      created++;
    }

    logStep("media", `files=${created} skipped=${skipped} (references only)`);
  });
}

async function seedDashboardCache(ctx: SeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < ctx.customerUserIds.length; i++) {
      const userId = ctx.customerUserIds[i]!;
      const customerProfileId = ctx.customerProfileIds[i];
      if (!customerProfileId) continue;

      const animalStats = await tx.animalProfile.aggregate({
        where: { customerId: customerProfileId },
        _count: { _all: true },
      });
      const activeAnimalStats = await tx.animalProfile.count({
        where: { customerId: customerProfileId, active: true },
      });
      const pendingAppts = await tx.serviceRequest.count({
        where: {
          customerId: customerProfileId,
          status: {
            in: [
              ServiceRequestStatus.PENDING,
              ServiceRequestStatus.ACCEPTED,
              ServiceRequestStatus.ASSIGNED,
            ],
          },
        },
      });
      const unread = await tx.notification.count({
        where: { userId, readAt: null },
      });

      await tx.setting.upsert({
        where: { key: `${SETTING_DASHBOARD_PREFIX}${userId}` },
        create: {
          key: `${SETTING_DASHBOARD_PREFIX}${userId}`,
          valueJson: {
            userAppSeed: true,
            cachedAt: new Date().toISOString(),
            summary: {
              animalCount: animalStats._count._all,
              activeAnimalCount: activeAnimalStats,
              pendingAppointments: pendingAppts,
              unreadNotifications: unread,
            },
          },
        },
        update: {
          valueJson: {
            userAppSeed: true,
            cachedAt: new Date().toISOString(),
            summary: {
              animalCount: animalStats._count._all,
              activeAnimalCount: activeAnimalStats,
              pendingAppointments: pendingAppts,
              unreadNotifications: unread,
            },
          },
        },
      });
    }

    logStep("dashboard", `cache rows=${ctx.customerUserIds.length}`);
  });
}

async function writeMeta(ctx: SeedContext, startedAt: number): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SETTING_META },
    create: {
      key: SETTING_META,
      valueJson: {
        version: USER_APP_SEED_VERSION,
        scale: ctx.scale,
        counts: ctx.counts,
        appliedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        passwordHint: "USER_APP_SEED_PASSWORD",
      },
    },
    update: {
      valueJson: {
        version: USER_APP_SEED_VERSION,
        scale: ctx.scale,
        counts: ctx.counts,
        appliedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        passwordHint: "USER_APP_SEED_PASSWORD",
      },
    },
  });
}

async function reloadExistingIds(ctx: SeedContext): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${USER_APP_SEED_EMAIL_DOMAIN}` } },
    select: {
      id: true,
      role: true,
      customerProfile: { select: { id: true } },
      doctorProfile: { select: { id: true } },
    },
  });

  for (const u of users) {
    if (u.role === UserRole.CUSTOMER) {
      pushUnique(ctx.customerUserIds, u.id);
      if (u.customerProfile) pushUnique(ctx.customerProfileIds, u.customerProfile.id);
    }
    if (u.role === UserRole.DOCTOR) {
      pushUnique(ctx.doctorUserIds, u.id);
      if (u.doctorProfile) pushUnique(ctx.doctorProfileIds, u.doctorProfile.id);
    }
  }

  const animals = await prisma.animalProfile.findMany({
    where: { id: { startsWith: `${USER_APP_SEED_ID_PREFIX}-animal-` } },
    select: { id: true },
    orderBy: { id: "asc" },
    take: ctx.counts.animals,
  });
  for (const a of animals) {
    pushUnique(ctx.animalIds, a.id);
  }

  if (ctx.customerUserIds.length > 0) {
    logSkip("reload", "existing seed users detected — continuing idempotently");
  }
}

async function main(): Promise<void> {
  assertSafeToRun();
  const startedAt = Date.now();
  const scale = parseSeedScale(process.argv.slice(2));
  const counts = scaleCounts(scale);
  const rng = createRng(RNG_SEED);

  console.info("[seed:user] USER_APP_TEST_SEED_V1 — scale:", scale);
  console.info("[seed:user] counts:", counts);
  console.info("[seed:user] test password:", PASSWORD, "(override USER_APP_SEED_PASSWORD)");

  const { doctorVisitId, emergencyId } = await assertPrerequisites();

  const ctx: SeedContext = {
    scale,
    counts,
    rng,
    customerUserIds: [],
    customerProfileIds: [],
    doctorProfileIds: [],
    doctorUserIds: [],
    animalIds: [],
    serviceCategoryId: doctorVisitId,
    emergencyCategoryId: emergencyId,
  };

  await reloadExistingIds(ctx);

  logStep("start", "seeding users + profiles");
  await seedUsers(ctx);

  logStep("start", "seeding animals");
  await seedAnimals(ctx);

  logStep("start", "seeding farms (catalog + profile metadata)");
  await seedFarms(ctx);

  logStep("start", "seeding appointments (ServiceRequest)");
  const { serviceRequestIds } = await seedAppointments(ctx);

  logStep("start", "seeding doctor schedules, availability, ratings");
  await seedDoctorSide(ctx);

  logStep("start", "seeding prescriptions");
  await seedPrescriptions(ctx, serviceRequestIds);

  logStep("start", "seeding notifications");
  await seedNotifications(ctx);

  logStep("start", "seeding chat (AiAssistant)");
  await seedChat(ctx);

  logStep("start", "seeding wallet");
  await seedWallet(ctx);

  logStep("start", "seeding media references");
  await seedMedia(ctx);

  logStep("start", "seeding dashboard summary cache");
  await seedDashboardCache(ctx);

  await writeMeta(ctx, startedAt);

  console.info(
    `[seed:user] Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s — customers=${ctx.customerUserIds.length} animals=${ctx.animalIds.length}`,
  );
}

main()
  .catch((err) => {
    console.error("[seed:user] Fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
