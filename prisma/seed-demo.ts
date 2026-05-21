/**
 * Prani Doctor — full **development** dummy data (idempotent upserts).
 * Run: `npm run db:seed:demo` (after migrations + `npm run db:generate`).
 *
 * Refuses to run in production unless `ALLOW_DEMO_SEED_IN_PRODUCTION=true`.
 */
import "dotenv/config";

import bcrypt from "bcryptjs";

import {
  AnimalCategory,
  AnimalType,
  AreaType,
  BillingStatus,
  Gender,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProviderStatus,
  PregnancyStatus,
  ServiceRequestStatus,
  ServiceRequestType,
  UserRole,
  UserStatus,
} from "../src/generated/prisma/client";
import { disconnectPrisma, prisma } from "../src/lib/prisma";

import {
  DEMO_ANIMAL_IDS,
  DEMO_BILLING_IDS,
  DEMO_CUSTOMER_EMAIL,
  DEMO_CUSTOMER_PHONE,
  DEMO_NOTIFICATION_IDS,
  DEMO_PAYMENT_IDS,
  DEMO_SERVICE_REQUEST_IDS,
} from "./demo-seed-shared";

const BCRYPT_COST = 12;

const DEMO_STAFF_PASSWORD =
  process.env.DEMO_SEED_STAFF_PASSWORD ?? "DemoSeed!ChangeMe123";
const DEMO_CUSTOMER_PASSWORD =
  process.env.DEMO_SEED_CUSTOMER_PASSWORD ?? "DemoCustomer!NotUsedOtp123";

const HASH_STAFF = bcrypt.hashSync(DEMO_STAFF_PASSWORD, BCRYPT_COST);
const HASH_CUSTOMER = bcrypt.hashSync(DEMO_CUSTOMER_PASSWORD, BCRYPT_COST);

const DEMO_ID = {
  /** Stable ids when first created — upserts also match by email / userId. */
  customerUser: "demo-seed-user-customer",
  customerProfile: "demo-seed-cprofile-customer",
  animal1: DEMO_ANIMAL_IDS[0],
  animal2: DEMO_ANIMAL_IDS[1],
  animal3: DEMO_ANIMAL_IDS[2],
  animal4: DEMO_ANIMAL_IDS[3],
  animal5: DEMO_ANIMAL_IDS[4],
  animal6: DEMO_ANIMAL_IDS[5],
  billingPaid: DEMO_BILLING_IDS[0],
  billingUnpaid: DEMO_BILLING_IDS[1],
  paymentPaid: DEMO_PAYMENT_IDS[0],
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function demoWeightKg(animalType: AnimalType | null): Prisma.Decimal {
  switch (animalType) {
    case AnimalType.CAT:
      return new Prisma.Decimal("3.2");
    case AnimalType.DOG:
      return new Prisma.Decimal("12");
    case AnimalType.POULTRY:
      return new Prisma.Decimal("2.5");
    case AnimalType.GOAT:
      return new Prisma.Decimal("28");
    case AnimalType.CATTLE:
      return new Prisma.Decimal("220");
    default:
      return new Prisma.Decimal("50");
  }
}

function assertDevOrForced(): void {
  if (isProduction() && process.env.ALLOW_DEMO_SEED_IN_PRODUCTION !== "true") {
    console.error(
      "[seed-demo] Aborted: NODE_ENV=production. Set ALLOW_DEMO_SEED_IN_PRODUCTION=true only on a dedicated disposable DB.",
    );
    process.exit(1);
  }
}

async function seedMobileSettings(): Promise<void> {
  const rows: { key: string; valueJson: Prisma.InputJsonValue }[] = [
    {
      key: "mobile.app.config",
      valueJson: {
        supportPhone: "+8809612345678",
        supportWhatsapp: "+8809612345678",
        demoBanner: true,
        featureFarmVisit: false,
        featureOnlineConsultation: true,
      },
    },
    {
      key: "mobile.feature.flags",
      valueJson: {
        farmVisitBooking: false,
        pharmacyOrders: false,
        paymentsBkash: false,
      },
    },
  ];
  for (const r of rows) {
    await prisma.setting.upsert({
      where: { key: r.key },
      create: { key: r.key, valueJson: r.valueJson },
      update: { valueJson: r.valueJson },
    });
  }
  console.info("[seed-demo] Settings upserted:", rows.map((r) => r.key).join(", "));
}

async function seedServiceCategoryLabels(): Promise<void> {
  const upserts: { slug: string; name: string; description: string }[] = [
    {
      slug: "doctor-visit",
      name: "হোম ভিজিট / Doctor visit",
      description: "হোম ভিজিট — গবাদি ও খামার পরিদর্শন",
    },
    {
      slug: "emergency",
      name: "জরুরি ডাক্তার / Emergency",
      description: "জরুরি চিকিৎসা ও দ্রুত রেসপন্স",
    },
    {
      slug: "ai-service",
      name: "AI টেকনিশিয়ান / AI service",
      description: "কৃত্রিম প্রজনন ও টেকনিশিয়ান সেবা",
    },
    {
      slug: "vaccination",
      name: "টিকা ও ভ্যাকসিনেশন",
      description: "টিকাদান ও প্রতিরোধমূলক সেবা",
    },
    {
      slug: "online-consultation",
      name: "অনলাইন কনসালটেশন",
      description: "দূর থেকে পরামর্শ (প্লেসহোল্ডার)",
    },
    {
      slug: "farm-visit",
      name: "ফার্ম ভিজিট (প্লেসহোল্ডার)",
      description: "খামার ভিজিট বুকিং — শীঘ্রই",
    },
  ];
  for (const c of upserts) {
    await prisma.serviceCategory.upsert({
      where: { slug: c.slug },
      create: { name: c.name, slug: c.slug, description: c.description },
      update: { name: c.name, description: c.description },
    });
  }
  console.info("[seed-demo] Service categories labeled:", upserts.length);
}

/**
 * Extra Area rows for mobile search / filters (unified Area tree).
 * Parents use existing `dhaka-division` where possible.
 */
async function seedExtendedAreas(): Promise<Map<string, string>> {
  const slugToId = new Map<string, string>();

  const dhakaDiv = await prisma.area.findUnique({
    where: { slug: "dhaka-division" },
    select: { id: true },
  });
  if (!dhakaDiv) {
    console.warn("[seed-demo] dhaka-division missing — run main `npm run db:seed` first.");
    return slugToId;
  }

  type AreaSeed = {
    slug: string;
    name: string;
    nameBn: string;
    type: AreaType;
    parentSlug: string | null;
    code?: string;
    sortOrder: number;
  };

  const seeds: AreaSeed[] = [
    {
      slug: "demo-narayanganj-district",
      name: "Narayanganj District",
      nameBn: "নারায়ণগঞ্জ জেলা",
      type: AreaType.DISTRICT,
      parentSlug: "dhaka-division",
      code: "3067",
      sortOrder: 40,
    },
    {
      slug: "demo-chattogram-district",
      name: "Chattogram District",
      nameBn: "চট্টগ্রাম জেলা",
      type: AreaType.DISTRICT,
      parentSlug: null,
      code: "2015",
      sortOrder: 10,
    },
    {
      slug: "demo-cumilla-district",
      name: "Cumilla District",
      nameBn: "কুমিল্লা জেলা",
      type: AreaType.DISTRICT,
      parentSlug: null,
      code: "3109",
      sortOrder: 20,
    },
    {
      slug: "demo-rajshahi-district",
      name: "Rajshahi District",
      nameBn: "রাজশাহী জেলা",
      type: AreaType.DISTRICT,
      parentSlug: null,
      code: "5081",
      sortOrder: 30,
    },
    {
      slug: "demo-bogura-district",
      name: "Bogura District",
      nameBn: "বগুড়া জেলা",
      type: AreaType.DISTRICT,
      parentSlug: null,
      code: "5010",
      sortOrder: 35,
    },
    {
      slug: "demo-rangpur-district",
      name: "Rangpur District",
      nameBn: "রংপুর জেলা",
      type: AreaType.DISTRICT,
      parentSlug: null,
      code: "5585",
      sortOrder: 36,
    },
    {
      slug: "demo-sylhet-district",
      name: "Sylhet District",
      nameBn: "সিলেট জেলা",
      type: AreaType.DISTRICT,
      parentSlug: null,
      code: "6091",
      sortOrder: 37,
    },
    {
      slug: "demo-khulna-district",
      name: "Khulna District",
      nameBn: "খুলনা জেলা",
      type: AreaType.DISTRICT,
      parentSlug: null,
      code: "4047",
      sortOrder: 38,
    },
    {
      slug: "demo-barishal-district",
      name: "Barishal District",
      nameBn: "বরিশাল জেলা",
      type: AreaType.DISTRICT,
      parentSlug: null,
      code: "4010",
      sortOrder: 39,
    },
  ];

  for (const s of seeds) {
    const parentId =
      s.parentSlug === null
        ? null
        : (
            await prisma.area.findUnique({
              where: { slug: s.parentSlug },
              select: { id: true },
            })
          )?.id ?? dhakaDiv.id;

    const row = await prisma.area.upsert({
      where: { slug: s.slug },
      create: {
        name: s.name,
        nameBn: s.nameBn,
        slug: s.slug,
        code: s.code ?? null,
        type: s.type,
        parentId,
        sortOrder: s.sortOrder,
        isActive: true,
        metadataJson: { demoSeed: true, region: "BD" },
      },
      update: {
        name: s.name,
        nameBn: s.nameBn,
        code: s.code ?? null,
        type: s.type,
        parentId,
        sortOrder: s.sortOrder,
        isActive: true,
        metadataJson: { demoSeed: true, region: "BD" },
      },
    });
    slugToId.set(s.slug, row.id);
  }

  console.info("[seed-demo] Extended demo areas upserted:", seeds.length);
  return slugToId;
}

async function main(): Promise<void> {
  assertDevOrForced();

  console.info("[seed-demo] Prani Doctor / Animal Doctors — development dummy seed");
  console.info("[seed-demo] Staff password (doctors/AI):", DEMO_STAFF_PASSWORD, "(override DEMO_SEED_STAFF_PASSWORD)");

  await seedMobileSettings();
  await seedServiceCategoryLabels();
  const extraAreaIds = await seedExtendedAreas();

  const ashulia = await prisma.area.findUnique({
    where: { slug: "ashulia-union-area" },
    select: { id: true },
  });
  const narayan = extraAreaIds.get("demo-narayanganj-district") ?? ashulia?.id;
  const chattogram = extraAreaIds.get("demo-chattogram-district");
  const cumilla = extraAreaIds.get("demo-cumilla-district");
  const rajshahi = extraAreaIds.get("demo-rajshahi-district");
  const bogura = extraAreaIds.get("demo-bogura-district");

  const village = await prisma.village.findUnique({
    where: { slug: "sample-service-village-001" },
    select: { id: true },
  });

  const catDoctorVisit = await prisma.serviceCategory.findUnique({
    where: { slug: "doctor-visit" },
  });
  const catEmergency = await prisma.serviceCategory.findUnique({
    where: { slug: "emergency" },
  });
  const catAi = await prisma.serviceCategory.findUnique({ where: { slug: "ai-service" } });
  const catOnline = await prisma.serviceCategory.findUnique({
    where: { slug: "online-consultation" },
  });

  if (!catDoctorVisit || !catEmergency || !catAi || !catOnline || !village) {
    console.error(
      "[seed-demo] Missing prerequisite rows (service categories or village). Run `npm run db:seed` first.",
    );
    process.exit(1);
  }

  /* --- Demo customer (phone-first so OTP `/auth/otp/verify` sees same user as seed data) --- */
  const phoneRow = await prisma.user.findUnique({
    where: { phone: DEMO_CUSTOMER_PHONE },
    select: { id: true },
  });
  const emailRow = await prisma.user.findUnique({
    where: { email: DEMO_CUSTOMER_EMAIL },
    select: { id: true },
  });
  if (phoneRow && emailRow && phoneRow.id !== emailRow.id) {
    await prisma.user.update({
      where: { id: emailRow.id },
      data: {
        email: `orphan-${emailRow.id.slice(-12)}@pranidoctor.seed.local`,
      },
    });
    console.warn(
      "[seed-demo] Resolved duplicate demo User rows (phone OTP vs email demo). Renamed stale email row.",
    );
  }

  const customerUser = await prisma.user.upsert({
    where: { phone: DEMO_CUSTOMER_PHONE },
    create: {
      id: DEMO_ID.customerUser,
      email: DEMO_CUSTOMER_EMAIL,
      phone: DEMO_CUSTOMER_PHONE,
      passwordHash: HASH_CUSTOMER,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
    update: {
      email: DEMO_CUSTOMER_EMAIL,
      passwordHash: HASH_CUSTOMER,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });

  const customerProfile = await prisma.customerProfile.upsert({
    where: { userId: customerUser.id },
    create: {
      id: DEMO_ID.customerProfile,
      userId: customerUser.id,
      displayName: "Demo Customer",
      locale: "bn-BD",
      addressJson: {
        areaLabel: "ঢাকা, আশুলিয়া (ডেমো)",
        demoSeed: true,
      },
    },
    update: {
      displayName: "Demo Customer",
      addressJson: {
        areaLabel: "ঢাকা, আশুলিয়া (ডেমো)",
        demoSeed: true,
      },
    },
  });

  /* --- Animals (species + animalType — BN labels for mobile UX) --- */
  const animals: {
    id: string;
    name: string;
    species: string;
    animalType: AnimalType | null;
    breed: string | null;
    category: AnimalCategory;
  }[] = [
    {
      id: DEMO_ID.animal1,
      name: "লালী",
      species: "গরু",
      animalType: AnimalType.CATTLE,
      breed: "সাহিওয়াল",
      category: AnimalCategory.LIVESTOCK,
    },
    {
      id: DEMO_ID.animal2,
      name: "ছোটন",
      species: "ছাগল",
      animalType: AnimalType.GOAT,
      breed: "ব্ল্যাক বেঙ্গল",
      category: AnimalCategory.LIVESTOCK,
    },
    {
      id: DEMO_ID.animal3,
      name: "মোহনা",
      species: "ভেড়া",
      animalType: AnimalType.GOAT,
      breed: "ক্রসব্রিড",
      category: AnimalCategory.LIVESTOCK,
    },
    {
      id: DEMO_ID.animal4,
      name: "পোল্ট্রি ব্যাচ ১",
      species: "মুরগি",
      animalType: AnimalType.POULTRY,
      breed: "ব্রয়লার",
      category: AnimalCategory.LIVESTOCK,
    },
    {
      id: DEMO_ID.animal5,
      name: "হাঁসের দল",
      species: "হাঁস",
      animalType: AnimalType.POULTRY,
      breed: "পেকিন",
      category: AnimalCategory.LIVESTOCK,
    },
    {
      id: DEMO_ID.animal6,
      name: "মায়া",
      species: "মহিষ",
      animalType: AnimalType.CATTLE,
      breed: "মুরাহা",
      category: AnimalCategory.LIVESTOCK,
    },
  ];

  for (const a of animals) {
    await prisma.animalProfile.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        customerId: customerProfile.id,
        name: a.name,
        species: a.species,
        breed: a.breed,
        category: a.category,
        animalType: a.animalType,
        weightKg: demoWeightKg(a.animalType),
        gender: Gender.UNKNOWN,
        notes: "ডেমো প্রাণী — উন্নত স্বাস্থ্য",
        pregnancyStatus: PregnancyStatus.NOT_APPLICABLE,
        active: true,
      },
      update: {
        name: a.name,
        species: a.species,
        breed: a.breed,
        category: a.category,
        animalType: a.animalType,
        notes: "ডেমো প্রাণী — উন্নত স্বাস্থ্য",
        active: true,
      },
    });
  }

  /* --- 5 Doctors --- */
  const doctorSpecs: {
    email: string;
    phone: string;
    license: string;
    displayName: string;
    emergency: boolean;
    online: boolean;
    homeVisit: boolean;
    areaId: string | undefined;
    degree: string;
    years: number;
  }[] = [
    {
      email: "demo-doctor-1@pranidoctor.test",
      phone: "01800000001",
      license: "PD-DEMO-LIC-0001",
      displayName: "ডেমো ডাক্তার — আশুলিয়া",
      emergency: true,
      online: true,
      homeVisit: true,
      areaId: ashulia?.id,
      degree: "ডিভিএম",
      years: 8,
    },
    {
      email: "demo-doctor-2@pranidoctor.test",
      phone: "01800000002",
      license: "PD-DEMO-LIC-0002",
      displayName: "ডেমো ডাক্তার — নারায়ণগঞ্জ",
      emergency: false,
      online: true,
      homeVisit: true,
      areaId: narayan,
      degree: "এম ভেট সাইন্স",
      years: 5,
    },
    {
      email: "demo-doctor-3@pranidoctor.test",
      phone: "01800000003",
      license: "PD-DEMO-LIC-0003",
      displayName: "ডেমো ডাক্তার — চট্টগ্রাম",
      emergency: true,
      online: false,
      homeVisit: false,
      areaId: chattogram,
      degree: "ডিভিএম",
      years: 12,
    },
    {
      email: "demo-doctor-4@pranidoctor.test",
      phone: "01800000004",
      license: "PD-DEMO-LIC-0004",
      displayName: "ডেমো ডাক্তার — কুমিল্লা",
      emergency: false,
      online: false,
      homeVisit: true,
      areaId: cumilla,
      degree: "বিভিএস",
      years: 6,
    },
    {
      email: "demo-doctor-5@pranidoctor.test",
      phone: "01800000005",
      license: "PD-DEMO-LIC-0005",
      displayName: "ডেমো ডাক্তার — রাজশাহী",
      emergency: true,
      online: true,
      homeVisit: true,
      areaId: rajshahi ?? bogura,
      degree: "ডিভিএম, এমএস",
      years: 15,
    },
  ];

  const doctorProfileIds: string[] = [];

  for (let i = 0; i < doctorSpecs.length; i++) {
    const spec = doctorSpecs[i];

    const user = await prisma.user.upsert({
      where: { email: spec.email },
      create: {
        email: spec.email,
        phone: spec.phone,
        passwordHash: HASH_STAFF,
        role: UserRole.DOCTOR,
        status: UserStatus.ACTIVE,
      },
      update: {
        phone: spec.phone,
        passwordHash: HASH_STAFF,
        role: UserRole.DOCTOR,
        status: UserStatus.ACTIVE,
      },
    });

    const profile = await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName: spec.displayName,
        licenseNumber: spec.license,
        degree: spec.degree,
        specialization: spec.homeVisit ? "খামার ও হোম ভিজিট" : "জেনারেল",
        experienceYears: spec.years,
        bio: `ডেমো প্রোফাইল (${spec.displayName}) — শুধু ডেভেলপমেন্ট`,
        visitFeeBdt: new Prisma.Decimal(spec.emergency ? "2200.00" : "1500.00"),
        acceptsEmergency: spec.emergency,
        acceptsOnlineConsultation: spec.online,
        providerStatus: ProviderStatus.ACTIVE,
        verifiedAt: new Date(),
      },
      update: {
        displayName: spec.displayName,
        licenseNumber: spec.license,
        degree: spec.degree,
        experienceYears: spec.years,
        visitFeeBdt: new Prisma.Decimal(spec.emergency ? "2200.00" : "1500.00"),
        acceptsEmergency: spec.emergency,
        acceptsOnlineConsultation: spec.online,
        providerStatus: ProviderStatus.ACTIVE,
        verifiedAt: new Date(),
      },
    });
    doctorProfileIds.push(profile.id);

    if (spec.areaId) {
      await prisma.doctorProfileArea.upsert({
        where: {
          doctorId_areaId: { doctorId: profile.id, areaId: spec.areaId },
        },
        create: {
          doctorId: profile.id,
          areaId: spec.areaId,
          priority: 1,
        },
        update: { priority: 1 },
      });
    }

    await prisma.doctorProfileServiceCategory.upsert({
      where: {
        doctorId_serviceCategoryId: {
          doctorId: profile.id,
          serviceCategoryId: catDoctorVisit.id,
        },
      },
      create: {
        doctorId: profile.id,
        serviceCategoryId: catDoctorVisit.id,
      },
      update: {},
    });

    if (spec.emergency) {
      await prisma.doctorProfileServiceCategory.upsert({
        where: {
          doctorId_serviceCategoryId: {
            doctorId: profile.id,
            serviceCategoryId: catEmergency.id,
          },
        },
        create: {
          doctorId: profile.id,
          serviceCategoryId: catEmergency.id,
        },
        update: {},
      });
    }

    if (spec.online && catOnline) {
      await prisma.doctorProfileServiceCategory.upsert({
        where: {
          doctorId_serviceCategoryId: {
            doctorId: profile.id,
            serviceCategoryId: catOnline.id,
          },
        },
        create: {
          doctorId: profile.id,
          serviceCategoryId: catOnline.id,
        },
        update: {},
      });
    }

    await prisma.doctorServiceArea.upsert({
      where: {
        doctorId_villageId: {
          doctorId: profile.id,
          villageId: village.id,
        },
      },
      create: {
        doctorId: profile.id,
        villageId: village.id,
        priority: i + 1,
      },
      update: { priority: i + 1 },
    });
  }

  /* --- 3 AI technicians --- */
  const aiSpecs: {
    email: string;
    phone: string;
    displayName: string;
    emergency: boolean;
    areaId: string | undefined;
  }[] = [
    {
      email: "demo-ai-1@pranidoctor.test",
      phone: "01900000001",
      displayName: "ডেমো এআই টেক — আশুলিয়া",
      emergency: true,
      areaId: ashulia?.id,
    },
    {
      email: "demo-ai-2@pranidoctor.test",
      phone: "01900000002",
      displayName: "ডেমো এআই টেক — গাজীপুর",
      emergency: false,
      areaId: narayan,
    },
    {
      email: "demo-ai-3@pranidoctor.test",
      phone: "01900000003",
      displayName: "ডেমো এআই টেক — চট্টগ্রাম",
      emergency: true,
      areaId: chattogram,
    },
  ];

  const aiProfileIds: string[] = [];

  for (let i = 0; i < aiSpecs.length; i++) {
    const spec = aiSpecs[i];

    const user = await prisma.user.upsert({
      where: { email: spec.email },
      create: {
        email: spec.email,
        phone: spec.phone,
        passwordHash: HASH_STAFF,
        role: UserRole.AI_TECHNICIAN,
        status: UserStatus.ACTIVE,
      },
      update: {
        phone: spec.phone,
        passwordHash: HASH_STAFF,
        role: UserRole.AI_TECHNICIAN,
        status: UserStatus.ACTIVE,
      },
    });

    const profile = await prisma.aiTechnicianProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName: spec.displayName,
        certification: `PD-DEMO-AI-CERT-${i + 1}`,
        bio: "ডেমো এআই টেকনিশিয়ান — ডেভেলপমেন্ট ওনলি",
        serviceFeeBdt: new Prisma.Decimal(1100 + i * 100),
        acceptsEmergency: spec.emergency,
        metadataJson: {
          demoSeed: true,
          livestockFocus: ["cattle", "goat"],
          experienceYears: 4 + i,
        },
        providerStatus: ProviderStatus.ACTIVE,
        verifiedAt: new Date(),
      },
      update: {
        displayName: spec.displayName,
        serviceFeeBdt: new Prisma.Decimal(1100 + i * 100),
        acceptsEmergency: spec.emergency,
        metadataJson: {
          demoSeed: true,
          livestockFocus: ["cattle", "goat"],
          experienceYears: 4 + i,
        },
        providerStatus: ProviderStatus.ACTIVE,
        verifiedAt: new Date(),
      },
    });
    aiProfileIds.push(profile.id);

    if (spec.areaId) {
      await prisma.aiTechnicianProfileArea.upsert({
        where: {
          aiTechnicianId_areaId: {
            aiTechnicianId: profile.id,
            areaId: spec.areaId,
          },
        },
        create: {
          aiTechnicianId: profile.id,
          areaId: spec.areaId,
          priority: 1,
        },
        update: { priority: 1 },
      });
    }

    await prisma.aiTechnicianServiceArea.upsert({
      where: {
        aiTechnicianId_villageId: {
          aiTechnicianId: profile.id,
          villageId: village.id,
        },
      },
      create: {
        aiTechnicianId: profile.id,
        villageId: village.id,
        priority: 1,
      },
      update: { priority: 1 },
    });

    await prisma.aiTechnicianProfileServiceCategory.upsert({
      where: {
        aiTechnicianId_serviceCategoryId: {
          aiTechnicianId: profile.id,
          serviceCategoryId: catAi.id,
        },
      },
      create: {
        aiTechnicianId: profile.id,
        serviceCategoryId: catAi.id,
      },
      update: {},
    });
  }

  /* --- Demo support (role SUPPORT — internal tooling / placeholder admin workflows) --- */
  await prisma.user.upsert({
    where: { email: "demo-support@pranidoctor.test" },
    create: {
      email: "demo-support@pranidoctor.test",
      phone: "01800900909",
      passwordHash: HASH_STAFF,
      role: UserRole.SUPPORT,
      status: UserStatus.ACTIVE,
    },
    update: {
      passwordHash: HASH_STAFF,
      role: UserRole.SUPPORT,
      status: UserStatus.ACTIVE,
    },
  });
  console.info("[seed-demo] Demo support user upserted: demo-support@pranidoctor.test");

  /* --- Service requests (fixed ids) --- */
  const doc1 = doctorProfileIds[0];
  const doc2 = doctorProfileIds[1];
  const ai1 = aiProfileIds[0];

  const srDefs: {
    id: string;
    status: ServiceRequestStatus;
    serviceType: ServiceRequestType;
    categoryId: string;
    assignedDoctorId: string | null;
    assignedTechnicianId: string | null;
    isEmergency: boolean;
    problem: string;
    completedAt: Date | null;
    cancelledAt: Date | null;
    assignedAt: Date | null;
    startedAt: Date | null;
  }[] = [
    {
      id: DEMO_SERVICE_REQUEST_IDS[0],
      status: ServiceRequestStatus.PENDING,
      serviceType: ServiceRequestType.DOCTOR_HOME_VISIT,
      categoryId: catDoctorVisit.id,
      assignedDoctorId: null,
      assignedTechnicianId: null,
      isEmergency: false,
      problem: "ডেমো: নতুন অনুরোধ — অ্যাসাইনমেন্ট অপেক্ষমান",
      completedAt: null,
      cancelledAt: null,
      assignedAt: null,
      startedAt: null,
    },
    {
      id: DEMO_SERVICE_REQUEST_IDS[1],
      status: ServiceRequestStatus.ASSIGNED,
      serviceType: ServiceRequestType.DOCTOR_HOME_VISIT,
      categoryId: catDoctorVisit.id,
      assignedDoctorId: doc1,
      assignedTechnicianId: null,
      isEmergency: false,
      problem: "ডেমো: ডাক্তার অ্যাসাইন করা হয়েছে",
      completedAt: null,
      cancelledAt: null,
      assignedAt: new Date(),
      startedAt: null,
    },
    {
      id: DEMO_SERVICE_REQUEST_IDS[2],
      status: ServiceRequestStatus.ACCEPTED,
      serviceType: ServiceRequestType.EMERGENCY_DOCTOR,
      categoryId: catEmergency.id,
      assignedDoctorId: doc1,
      assignedTechnicianId: null,
      isEmergency: true,
      problem: "ডেমো: জরুরি — গ্রহণ করা হয়েছে",
      completedAt: null,
      cancelledAt: null,
      assignedAt: new Date(),
      startedAt: null,
    },
    {
      id: DEMO_SERVICE_REQUEST_IDS[3],
      status: ServiceRequestStatus.IN_PROGRESS,
      serviceType: ServiceRequestType.DOCTOR_HOME_VISIT,
      categoryId: catDoctorVisit.id,
      assignedDoctorId: doc2,
      assignedTechnicianId: null,
      isEmergency: false,
      problem: "ডেমো: চিকিৎসা চলছে",
      completedAt: null,
      cancelledAt: null,
      assignedAt: new Date(),
      startedAt: new Date(),
    },
    {
      id: DEMO_SERVICE_REQUEST_IDS[4],
      status: ServiceRequestStatus.COMPLETED,
      serviceType: ServiceRequestType.DOCTOR_HOME_VISIT,
      categoryId: catDoctorVisit.id,
      assignedDoctorId: doc1,
      assignedTechnicianId: null,
      isEmergency: false,
      problem: "ডেমো: সম্পন্ন ভিজিট",
      completedAt: new Date(),
      cancelledAt: null,
      assignedAt: new Date(),
      startedAt: new Date(Date.now() - 86400000),
    },
    {
      id: DEMO_SERVICE_REQUEST_IDS[5],
      status: ServiceRequestStatus.CANCELLED,
      serviceType: ServiceRequestType.DOCTOR_HOME_VISIT,
      categoryId: catDoctorVisit.id,
      assignedDoctorId: null,
      assignedTechnicianId: null,
      isEmergency: false,
      problem: "ডেমো: বাতিল অনুরোধ",
      completedAt: null,
      cancelledAt: new Date(),
      assignedAt: null,
      startedAt: null,
    },
    {
      id: DEMO_SERVICE_REQUEST_IDS[6],
      status: ServiceRequestStatus.IN_PROGRESS,
      serviceType: ServiceRequestType.AI_SERVICE,
      categoryId: catAi.id,
      assignedDoctorId: null,
      assignedTechnicianId: ai1,
      isEmergency: false,
      problem: "ডেমো: এআই টেকনিশিয়ান সেবা",
      completedAt: null,
      cancelledAt: null,
      assignedAt: new Date(),
      startedAt: new Date(),
    },
    {
      id: DEMO_SERVICE_REQUEST_IDS[7],
      status: ServiceRequestStatus.PENDING,
      serviceType: ServiceRequestType.ONLINE_CONSULTATION_LATER,
      categoryId: catOnline.id,
      assignedDoctorId: null,
      assignedTechnicianId: null,
      isEmergency: false,
      problem: "ডেমো: অনলাইন কনসালটেশন — অপেক্ষমান",
      completedAt: null,
      cancelledAt: null,
      assignedAt: null,
      startedAt: null,
    },
  ];

  for (const sr of srDefs) {
    await prisma.serviceRequest.upsert({
      where: { id: sr.id },
      create: {
        id: sr.id,
        customerId: customerProfile.id,
        animalId: DEMO_ID.animal1,
        serviceCategoryId: sr.categoryId,
        serviceType: sr.serviceType,
        areaId: ashulia?.id ?? null,
        villageId: village.id,
        status: sr.status,
        assignedDoctorId: sr.assignedDoctorId,
        assignedTechnicianId: sr.assignedTechnicianId,
        isEmergency: sr.isEmergency,
        problemOrSymptom: sr.problem,
        description: "ডেমো সার্ভিস রিকোয়েস্ট — metadata.demoSeed",
        locationText: "আশুলিয়া ইউনিয়ন (ডেমো)",
        assignedAt: sr.assignedAt,
        startedAt: sr.startedAt,
        completedAt: sr.completedAt,
        cancelledAt: sr.cancelledAt,
        cancelReason: sr.cancelledAt ? "ডেমো বাতিল" : null,
      },
      update: {
        status: sr.status,
        assignedDoctorId: sr.assignedDoctorId,
        assignedTechnicianId: sr.assignedTechnicianId,
        isEmergency: sr.isEmergency,
        problemOrSymptom: sr.problem,
        assignedAt: sr.assignedAt,
        startedAt: sr.startedAt,
        completedAt: sr.completedAt,
        cancelledAt: sr.cancelledAt,
      },
    });
  }

  /* --- Billing --- */
  const completedSrId = DEMO_SERVICE_REQUEST_IDS[4];
  const pendingSrId = DEMO_SERVICE_REQUEST_IDS[0];

  await prisma.billingRecord.upsert({
    where: { id: DEMO_ID.billingPaid },
    create: {
      id: DEMO_ID.billingPaid,
      serviceRequestId: completedSrId,
      customerId: customerProfile.id,
      doctorId: doc1,
      status: BillingStatus.PAID,
      currency: "BDT",
      subtotal: new Prisma.Decimal("2500.00"),
      total: new Prisma.Decimal("2500.00"),
      serviceFee: new Prisma.Decimal("2000.00"),
      travelCost: new Prisma.Decimal("500.00"),
      tax: new Prisma.Decimal("0"),
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.BKASH,
      issuedAt: new Date(),
      paidAt: new Date(),
      notes: "ডেমো বিল — পরিশোধিত",
    },
    update: {
      status: BillingStatus.PAID,
      paymentStatus: PaymentStatus.PAID,
      total: new Prisma.Decimal("2500.00"),
      paidAt: new Date(),
    },
  });

  await prisma.paymentRecord.upsert({
    where: { id: DEMO_ID.paymentPaid },
    create: {
      id: DEMO_ID.paymentPaid,
      billingRecordId: DEMO_ID.billingPaid,
      serviceRequestId: completedSrId,
      status: PaymentStatus.CAPTURED,
      method: PaymentMethod.BKASH,
      amount: new Prisma.Decimal("2500.00"),
      paidAt: new Date(),
      metadataJson: { demoSeed: true },
    },
    update: {
      status: PaymentStatus.CAPTURED,
      amount: new Prisma.Decimal("2500.00"),
      paidAt: new Date(),
    },
  });

  await prisma.billingRecord.upsert({
    where: { id: DEMO_ID.billingUnpaid },
    create: {
      id: DEMO_ID.billingUnpaid,
      serviceRequestId: pendingSrId,
      customerId: customerProfile.id,
      status: BillingStatus.DRAFT,
      currency: "BDT",
      subtotal: new Prisma.Decimal("1500.00"),
      total: new Prisma.Decimal("1500.00"),
      serviceFee: new Prisma.Decimal("1500.00"),
      paymentStatus: PaymentStatus.UNPAID,
      notes: "ডেমো বিল — অপরিশোধিত",
    },
    update: {
      total: new Prisma.Decimal("1500.00"),
      paymentStatus: PaymentStatus.UNPAID,
    },
  });

  /* --- Notifications --- */
  const notifs: {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
  }[] = [
    {
      id: DEMO_NOTIFICATION_IDS[0],
      type: NotificationType.SYSTEM,
      title: "লগইন নোটিশ",
      body: "ডেমো: আপনার অ্যাকাউন্টে প্রবেশ ট্র্যাক করা হয়েছে (প্লেসহোল্ডার)।",
    },
    {
      id: DEMO_NOTIFICATION_IDS[1],
      type: NotificationType.REQUEST_UPDATE,
      title: "অনুরোধ জমা হয়েছে",
      body: "ডেমো: সেবার অনুরোধ গ্রহণ করা হয়েছে।",
    },
    {
      id: DEMO_NOTIFICATION_IDS[2],
      type: NotificationType.REQUEST_UPDATE,
      title: "ডাক্তার নিয়োগ",
      body: "ডেমো: একজন ডাক্তার আপনার অনুরোধে যুক্ত হয়েছে।",
    },
    {
      id: DEMO_NOTIFICATION_IDS[3],
      type: NotificationType.REQUEST_UPDATE,
      title: "টেকনিশিয়ান গ্রহণ",
      body: "ডেমো: এআই টেকনিশিয়ান সেবা শুরু হয়েছে।",
    },
    {
      id: DEMO_NOTIFICATION_IDS[4],
      type: NotificationType.REQUEST_UPDATE,
      title: "সেবা সম্পন্ন",
      body: "ডেমো: ভিজিট সম্পূর্ণ হয়েছে।",
    },
    {
      id: DEMO_NOTIFICATION_IDS[5],
      type: NotificationType.PAYMENT,
      title: "পেমেন্ট আপডেট",
      body: "ডেমো: বিল পরিশোধিত (প্লেসহোল্ডার)।",
    },
    {
      id: DEMO_NOTIFICATION_IDS[6],
      type: NotificationType.SYSTEM,
      title: "সিস্টেম নোটিশ",
      body: "ডেমো: পরীক্ষামূলক বিজ্ঞপ্তি।",
    },
  ];

  for (const n of notifs) {
    await prisma.notification.upsert({
      where: { id: n.id },
      create: {
        id: n.id,
        userId: customerUser.id,
        type: n.type,
        title: n.title,
        body: n.body,
        metadataJson: { demoSeed: true },
      },
      update: {
        title: n.title,
        body: n.body,
        userId: customerUser.id,
        metadataJson: { demoSeed: true },
      },
    });
  }

  console.info("");
  console.info("=== Prani Doctor demo seed summary ===");
  console.info("Customer OTP login phone (app UI): 01701022274 | stored:", DEMO_CUSTOMER_PHONE, "| email:", DEMO_CUSTOMER_EMAIL);
  console.info("Staff login (panel/API password auth): demo-doctor-* … demo-ai-* … demo-support@pranidoctor.test");
  console.info("Staff password:", DEMO_STAFF_PASSWORD);
  console.info("Upserts: 1 customer, 6 animals, 5 doctors, 3 AI techs, 1 support user");
  console.info("Service requests: 8 (incl. online consult placeholder), bills: 2, payments: 1, notifications: 7");
  console.info("Mobile API checks: GET /api/mobile/me, GET /api/mobile/providers/doctors, GET /api/mobile/notifications");
  console.info("======================================");
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
