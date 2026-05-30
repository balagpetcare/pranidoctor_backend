import { loadEnvironment } from '../src/shared/config/load-env.js';

loadEnvironment();

import bcrypt from 'bcryptjs';

import {
  AnimalType,
  ContentApprovalStatus,
  ProviderStatus,
  SemenProviderVerificationStatus,
  UserRole,
  UserStatus,
} from '../src/generated/prisma/index.js';
import { disconnectPrisma, prisma } from '../src/lib/prisma.js';
import { applyAreaEngineSeed } from "../scripts/area-seed-lib.js";
import {
  runFullLocationSeed,
  runImportLocationOnly,
} from "./seed-location.js";

const DEFAULT_DEV_DOCTOR_EMAIL = "doctor@pranidoctor.local";
const DEFAULT_DEV_DOCTOR_PASSWORD = "ChangeMe!Doctor123";
const DEFAULT_DEV_AI_EMAIL = "ai-tech@pranidoctor.local";
const DEFAULT_DEV_AI_PASSWORD = "ChangeMe!AiTech123";

/** Bcrypt cost factor — keep aligned with admin login (`bcrypt.compare` against this hash). */
const BCRYPT_COST = 12;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Idempotent semen provider + cattle breed masters for template authoring.
 * Safe to re-run; does not delete existing rows.
 */
async function seedSemenReferenceMasters(): Promise<void> {
  const providers: { slug: string; name: string; nameBn: string; sortOrder: number }[] = [
    { slug: "brac", name: "BRAC", nameBn: "ব্র্যাক", sortOrder: 10 },
    { slug: "aci", name: "ACI", nameBn: "এসিআই", sortOrder: 20 },
    { slug: "adl", name: "ADL", nameBn: "এডিএল", sortOrder: 30 },
    { slug: "dls-government", name: "DLS / Government", nameBn: "ডিএলএস / সরকারি", sortOrder: 40 },
    { slug: "private-provider", name: "Private Provider", nameBn: "ব্যক্তিগত প্রদানকারী", sortOrder: 50 },
    { slug: "others", name: "Others", nameBn: "অন্যান্য", sortOrder: 60 },
  ];
  for (const p of providers) {
    await prisma.semenProvider.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        name: p.name,
        nameBn: p.nameBn,
        isActive: true,
        verificationStatus: SemenProviderVerificationStatus.UNVERIFIED,
        sortOrder: p.sortOrder,
      },
      update: {
        name: p.name,
        nameBn: p.nameBn,
        isActive: true,
        sortOrder: p.sortOrder,
      },
    });
  }

  const breeds: { slug: string; nameEn: string; nameBn: string }[] = [
    { slug: "cattle-holstein-friesian", nameEn: "Holstein Friesian", nameBn: "হোলস্টাইন ফ্রিজিয়ান" },
    { slug: "cattle-sahiwal", nameEn: "Sahiwal", nameBn: "সাহিওয়াল" },
    { slug: "cattle-jersey", nameEn: "Jersey", nameBn: "জার্সি" },
    { slug: "cattle-brahman", nameEn: "Brahman", nameBn: "ব্রাহমান" },
    { slug: "cattle-local", nameEn: "Local", nameBn: "দেশি" },
    { slug: "cattle-cross-breed", nameEn: "Cross Breed", nameBn: "ক্রস জাত" },
  ];
  for (const b of breeds) {
    await prisma.livestockBreed.upsert({
      where: { slug: b.slug },
      create: {
        slug: b.slug,
        nameEn: b.nameEn,
        nameBn: b.nameBn,
        animalType: AnimalType.CATTLE,
        isActive: true,
      },
      update: {
        nameEn: b.nameEn,
        nameBn: b.nameBn,
        isActive: true,
      },
    });
  }
  console.log("[seed] Semen reference masters (providers + cattle breeds) upserted.");
}

/**
 * Creates or updates the panel admin **only** from environment variables.
 * No hardcoded passwords. Requires non-empty email + password.
 * Role is always `ADMIN`. `AdminProfile` is upserted.
 */
async function seedPanelAdminFromEnv(): Promise<{ id: string; email: string } | null> {
  const emailRaw =
    process.env.ADMIN_SEED_EMAIL?.trim() ||
    process.env.DEFAULT_ADMIN_EMAIL?.trim() ||
    process.env.PRANI_SEED_ADMIN_EMAIL?.trim() ||
    "";
  const email = emailRaw ? emailRaw.toLowerCase() : "";
  const passwordRaw =
    process.env.ADMIN_SEED_PASSWORD ??
    process.env.DEFAULT_ADMIN_PASSWORD ??
    process.env.PRANI_SEED_ADMIN_PASSWORD ??
    "";
  const password = String(passwordRaw).trim();

  const displayName =
    process.env.ADMIN_SEED_NAME?.trim() ||
    process.env.DEFAULT_ADMIN_NAME?.trim() ||
    process.env.PRANI_SEED_ADMIN_DISPLAY_NAME?.trim() ||
    "Prani Doctor Admin";

  const adminPhone =
    process.env.ADMIN_SEED_PHONE?.trim() ||
    process.env.PRANI_SEED_ADMIN_PHONE?.trim() ||
    null;

  if (!email || !password) {
    console.warn(
      "[seed] Skipping panel admin: set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD " +
        "(or DEFAULT_ADMIN_* / legacy PRANI_SEED_ADMIN_*). " +
        "No default password is applied.",
    );
    return null;
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (
    existing &&
    existing.role !== UserRole.ADMIN &&
    existing.role !== UserRole.SUPER_ADMIN
  ) {
    console.warn(
      `[seed] Skipping panel admin: ${email} already exists with role ${existing.role}.`,
    );
    return null;
  }

  const passwordHash = bcrypt.hashSync(password, BCRYPT_COST);

  const adminUser = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      phone: adminPhone,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    update: {
      passwordHash,
      ...(adminPhone !== null ? { phone: adminPhone } : {}),
      status: UserStatus.ACTIVE,
      role: UserRole.ADMIN,
    },
  });

  await prisma.adminProfile.upsert({
    where: { userId: adminUser.id },
    create: {
      userId: adminUser.id,
      displayName,
    },
    update: {
      displayName,
    },
  });

  if (!isProduction()) {
    console.info("[seed] Panel admin upserted:", email, "| role: ADMIN");
  }

  return { id: adminUser.id, email: adminUser.email };
}

async function seedKnowledgeHubCategories(): Promise<void> {
  const rows: {
    nameBn: string;
    nameEn?: string;
    slug: string;
    description?: string;
    sortOrder: number;
  }[] = [
    {
      nameBn: "গরুর রোগ",
      nameEn: "Cattle diseases",
      slug: "gorur-rog",
      sortOrder: 10,
    },
    {
      nameBn: "ছাগলের রোগ",
      nameEn: "Goat diseases",
      slug: "chagoler-rog",
      sortOrder: 20,
    },
    {
      nameBn: "AI / প্রজনন",
      nameEn: "AI / reproduction",
      slug: "ai-prajonan",
      sortOrder: 30,
    },
    {
      nameBn: "টিকা",
      nameEn: "Vaccination",
      slug: "tika",
      sortOrder: 40,
    },
    {
      nameBn: "কৃমিনাশক",
      nameEn: "Deworming",
      slug: "kriminashok",
      sortOrder: 50,
    },
    {
      nameBn: "খাদ্য ব্যবস্থাপনা",
      nameEn: "Feed management",
      slug: "khadyo-byabosthapona",
      sortOrder: 60,
    },
    {
      nameBn: "জরুরি চিকিৎসা",
      nameEn: "Emergency care",
      slug: "joruri-chikitsha",
      sortOrder: 70,
    },
  ];

  for (const c of rows) {
    await prisma.contentCategory.upsert({
      where: { slug: c.slug },
      create: {
        nameBn: c.nameBn,
        nameEn: c.nameEn ?? null,
        slug: c.slug,
        description: c.description ?? null,
        sortOrder: c.sortOrder,
        isActive: true,
      },
      update: {
        nameBn: c.nameBn,
        nameEn: c.nameEn ?? null,
        description: c.description ?? null,
        sortOrder: c.sortOrder,
        isActive: true,
      },
    });
  }

  if (!isProduction()) {
    console.info("[seed] Knowledge Hub categories upserted:", rows.length);
  }
}

async function seedLocationFromEnv(): Promise<void> {
  const mode = (process.env.PRANI_SEED_LOCATION ?? "").trim().toLowerCase();
  if (mode === "full") {
    await runFullLocationSeed();
    await applyAreaEngineSeed(prisma);
    return;
  }
  if (mode === "import" || mode === "true" || mode === "1") {
    await runImportLocationOnly();
    await applyAreaEngineSeed(prisma);
  }
}

async function main(): Promise<void> {
  const panelAdmin = await seedPanelAdminFromEnv();

  await seedLocationFromEnv();

  await seedKnowledgeHubCategories();

  const coreCategories: {
    name: string;
    slug: string;
    description: string;
  }[] = [
    {
      name: "Doctor Visit",
      slug: "doctor-visit",
      description: "On-site or scheduled visit by a veterinarian",
    },
    {
      name: "Emergency",
      slug: "emergency",
      description: "Urgent care or emergency visit",
    },
    {
      name: "AI Service",
      slug: "ai-service",
      description: "AI-assisted triage or technician-supported service",
    },
    {
      name: "Online Consultation",
      slug: "online-consultation",
      description: "Remote consultation with a veterinarian",
    },
  ];

  const extraCategories: typeof coreCategories = [
    {
      name: "General consultation",
      slug: "general-consultation",
      description: "Routine veterinary consultation",
    },
    {
      name: "Emergency visit (legacy)",
      slug: "emergency-visit",
      description: "Legacy slug — prefer category “Emergency”",
    },
    {
      name: "Vaccination",
      slug: "vaccination",
      description: "Preventive vaccination services",
    },
    {
      name: "Livestock health check",
      slug: "livestock-health-check",
      description: "Field visit for cattle, goats, and other livestock",
    },
  ];

  for (const c of [...coreCategories, ...extraCategories]) {
    await prisma.serviceCategory.upsert({
      where: { slug: c.slug },
      create: c,
      update: { name: c.name, description: c.description },
    });
  }

  await seedSemenReferenceMasters();

  const { seedFeedCatalogBangladesh } = await import("./seeds/feed_catalog.seed.js");
  const feedCatalogResult = await seedFeedCatalogBangladesh();
  console.log(
    `[seed] Feed catalog (Bangladesh): created=${feedCatalogResult.created}, updated=${feedCatalogResult.updated}`,
  );

  await prisma.setting.upsert({
    where: { key: "app.name" },
    create: {
      key: "app.name",
      valueJson: { value: "Prani Doctor" },
    },
    update: {
      valueJson: { value: "Prani Doctor" },
    },
  });

  await prisma.setting.upsert({
    where: { key: "PLATFORM_COMMISSION_RATE" },
    create: {
      key: "PLATFORM_COMMISSION_RATE",
      valueJson: { rate: 0.1 },
    },
    update: {
      valueJson: { rate: 0.1 },
    },
  });

  const seedDemo =
    process.env.PRANI_SEED_DEMO === "true" && !isProduction();

  if (seedDemo) {
    const doctorEmail =
      process.env.PRANI_SEED_DOCTOR_EMAIL?.trim() || DEFAULT_DEV_DOCTOR_EMAIL;
    const doctorPassword =
      process.env.PRANI_SEED_DOCTOR_PASSWORD ?? DEFAULT_DEV_DOCTOR_PASSWORD;
    const aiEmail =
      process.env.PRANI_SEED_AI_TECH_EMAIL?.trim() || DEFAULT_DEV_AI_EMAIL;
    const aiPassword =
      process.env.PRANI_SEED_AI_TECH_PASSWORD ?? DEFAULT_DEV_AI_PASSWORD;

    const doctorUser = await prisma.user.upsert({
      where: { email: doctorEmail },
      create: {
        email: doctorEmail,
        passwordHash: bcrypt.hashSync(doctorPassword, BCRYPT_COST),
        role: UserRole.DOCTOR,
        status: UserStatus.ACTIVE,
      },
      update: {
        passwordHash: bcrypt.hashSync(doctorPassword, BCRYPT_COST),
        role: UserRole.DOCTOR,
        status: UserStatus.ACTIVE,
      },
    });

    const doctorProfile = await prisma.doctorProfile.upsert({
      where: { userId: doctorUser.id },
      create: {
        userId: doctorUser.id,
        displayName: "Demo Doctor",
        licenseNumber: "PD-DEV-LICENSE-0001",
        specialization: "General veterinary",
        bio: "Sample doctor for local development only.",
        providerStatus: ProviderStatus.ACTIVE,
        verifiedAt: new Date(),
      },
      update: {
        displayName: "Demo Doctor",
        specialization: "General veterinary",
        bio: "Sample doctor for local development only.",
        providerStatus: ProviderStatus.ACTIVE,
        verifiedAt: new Date(),
      },
    });

    const demoVillageSlug = process.env.PRANI_SEED_DEMO_VILLAGE_SLUG?.trim();
    const demoVillage = demoVillageSlug
      ? await prisma.village.findFirst({ where: { slug: demoVillageSlug } })
      : await prisma.village.findFirst({ where: { isActive: true } });

    if (demoVillage) {
      await prisma.doctorServiceArea.upsert({
        where: {
          doctorId_villageId: {
            doctorId: doctorProfile.id,
            villageId: demoVillage.id,
          },
        },
        create: {
          doctorId: doctorProfile.id,
          villageId: demoVillage.id,
          priority: 1,
        },
        update: { priority: 1 },
      });
    } else {
      console.warn(
        "[seed] Demo doctor service area skipped: no village in DB. Run PRANI_SEED_LOCATION=import or seed:full-location first.",
      );
    }

    const doctorVisitCategory = await prisma.serviceCategory.findUnique({
      where: { slug: "doctor-visit" },
    });
    if (doctorVisitCategory) {
      await prisma.doctorProfileServiceCategory.upsert({
        where: {
          doctorId_serviceCategoryId: {
            doctorId: doctorProfile.id,
            serviceCategoryId: doctorVisitCategory.id,
          },
        },
        create: {
          doctorId: doctorProfile.id,
          serviceCategoryId: doctorVisitCategory.id,
        },
        update: {},
      });
    }

    const aiUser = await prisma.user.upsert({
      where: { email: aiEmail },
      create: {
        email: aiEmail,
        passwordHash: bcrypt.hashSync(aiPassword, BCRYPT_COST),
        role: UserRole.AI_TECHNICIAN,
        status: UserStatus.ACTIVE,
      },
      update: {
        passwordHash: bcrypt.hashSync(aiPassword, BCRYPT_COST),
        role: UserRole.AI_TECHNICIAN,
        status: UserStatus.ACTIVE,
      },
    });

    const aiProfile = await prisma.aiTechnicianProfile.upsert({
      where: { userId: aiUser.id },
      create: {
        userId: aiUser.id,
        displayName: "ডেমো এআই টেকনিশিয়ান",
        certification: "PD-DEV-AI-CERT-0001",
        bio: "Sample AI technician for local development only.",
        serviceFeeBdt: 1200,
        acceptsEmergency: true,
        metadataJson: {
          livestockFocus: ["cattle", "goat"],
          semenServices: true,
          notes: "Demo metadata for breed / semen MVP tags",
        },
        providerStatus: ProviderStatus.ACTIVE,
        verifiedAt: new Date(),
      },
      update: {
        displayName: "ডেমো এআই টেকনিশিয়ান",
        bio: "Sample AI technician for local development only.",
        serviceFeeBdt: 1200,
        acceptsEmergency: true,
        metadataJson: {
          livestockFocus: ["cattle", "goat"],
          semenServices: true,
          notes: "Demo metadata for breed / semen MVP tags",
        },
        providerStatus: ProviderStatus.ACTIVE,
        verifiedAt: new Date(),
      },
    });

    if (demoVillage) {
      await prisma.aiTechnicianServiceArea.upsert({
        where: {
          aiTechnicianId_villageId: {
            aiTechnicianId: aiProfile.id,
            villageId: demoVillage.id,
          },
        },
        create: {
          aiTechnicianId: aiProfile.id,
          villageId: demoVillage.id,
          priority: 1,
        },
        update: { priority: 1 },
      });
    }

    const aiServiceCategory = await prisma.serviceCategory.findUnique({
      where: { slug: "ai-service" },
    });
    if (aiServiceCategory) {
      await prisma.aiTechnicianProfileServiceCategory.upsert({
        where: {
          aiTechnicianId_serviceCategoryId: {
            aiTechnicianId: aiProfile.id,
            serviceCategoryId: aiServiceCategory.id,
          },
        },
        create: {
          aiTechnicianId: aiProfile.id,
          serviceCategoryId: aiServiceCategory.id,
        },
        update: {},
      });
    }

    if (panelAdmin) {
      const tutorialCategory = await prisma.contentCategory.findUnique({
        where: { slug: "khadyo-byabosthapona" },
      });
      if (tutorialCategory) {
        await prisma.contentPost.upsert({
          where: { slug: "welcome-prani-doctor-dev" },
          create: {
            title: "Welcome to Prani Doctor (development)",
            slug: "welcome-prani-doctor-dev",
            summary: null,
            body:
              "This is a draft article seeded for local development. Replace with real tutorials before production.",
            categoryId: tutorialCategory.id,
            authorId: panelAdmin.id,
            approvalStatus: ContentApprovalStatus.DRAFT,
            isPublished: false,
          },
          update: {
            title: "Welcome to Prani Doctor (development)",
            summary: null,
            body:
              "This is a draft article seeded for local development. Replace with real tutorials before production.",
            categoryId: tutorialCategory.id,
            authorId: panelAdmin.id,
            approvalStatus: ContentApprovalStatus.DRAFT,
            isPublished: false,
          },
        });
      } else {
        console.warn(
          "[seed] Demo ContentPost skipped (category khadyo-byabosthapona missing).",
        );
      }
    } else {
      console.warn(
        "[seed] Demo ContentPost welcome-prani-doctor-dev skipped (no panel admin seeded).",
      );
    }

    if (!isProduction()) {
      console.info(
        "Demo seed: doctor",
        doctorEmail,
        "| AI tech",
        aiEmail,
        panelAdmin
          ? "| draft ContentPost slug welcome-prani-doctor-dev"
          : "| no demo ContentPost (no admin)",
      );
    }
  } else if (process.env.PRANI_SEED_DEMO === "true" && isProduction()) {
    console.warn(
      "[seed] PRANI_SEED_DEMO=true ignored in production (no demo doctor/AI/content).",
    );
  }

  if (!isProduction()) {
    try {
      const { seedPhase8AiEcosystem } = await import('./seeds/phase8_ai_ecosystem.seed.js');
      await seedPhase8AiEcosystem();
      console.info('[seed] Phase 8 AI ecosystem knowledge + symptom taxonomy seeded.');
    } catch (err) {
      console.warn('[seed] Phase 8 AI seed skipped:', err);
    }

    try {
      const { seedAiManagementFoundation } = await import('./seeds/ai_management_foundation.seed.js');
      await seedAiManagementFoundation();
      console.info('[seed] AIMS foundation (providers, routes, prompts, settings) seeded.');
    } catch (err) {
      console.warn('[seed] AIMS foundation seed skipped:', err);
    }

    try {
      const { seedAiMarketplaceExtensions } = await import('./seeds/ai_marketplace.seed.js');
      await seedAiMarketplaceExtensions();
      console.info('[seed] AI marketplace extensions seeded.');
    } catch (err) {
      console.warn('[seed] AI marketplace seed skipped:', err);
    }
  }

  if (!isProduction()) {
    if (panelAdmin) {
      console.info(
        "Seed complete. Panel admin:",
        panelAdmin.email,
        "| role: ADMIN (set via seed).",
      );
    } else {
      console.info(
        "Seed complete. No panel admin (set ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD or npm run seed:admin).",
      );
    }
  } else {
    if (panelAdmin) {
      console.info("Seed complete (production). Panel admin:", panelAdmin.email);
    } else {
      console.info(
        "Seed complete (production). No panel admin seeded (env vars not set).",
      );
    }
  }
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
