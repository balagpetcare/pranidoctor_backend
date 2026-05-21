import { AiTechnicianDocumentType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import {
  getTechnicianProfileForUser,
  serializeTechnicianProfile,
} from "@/lib/mobile-ai-technician/application-service";
import { getMobileTechnicianDashboard } from "@/lib/mobile-ai-technician/dashboard-service";

import { UserRole } from "@/generated/prisma/client";
import { getFarmContextService } from "../../../../modules/profile/farm-context.service.js";

import { mapDashboardType, type MobileProfileDashboardType } from "./map-dashboard-type";

export type FarmSummaryContext = {
  animalCount: number;
  activeAnimalCount: number;
  primaryVillageId: string | null;
  primaryVillageLabelBn: string | null;
};

export type MobileProfileDashboardContextData = {
  dashboardType: MobileProfileDashboardType;
  /** True when an `AiTechnicianProfile` row exists (any status). */
  hasAiTechnicianApplication: boolean;
  /** Prisma `AiTechnicianStatus` string, or null when no application row. */
  aiTechnicianApplicationStatus: string | null;
  /** Phase 2 — customer farm aggregate (additive). */
  farmSummary?: FarmSummaryContext;
  user: {
    id: string;
    name: string;
    phone: string;
    email: string;
    avatarUrl: string | null;
  };
  aiTechnician: {
    id: string;
    status: string;
    displayName: string | null;
    serviceAreas: string[];
    todayRequestCount: number;
    pendingRequestCount: number;
    completedServiceCount: number;
    rating: { average: number | null; count: number };
  } | null;
  doctor: null;
};

function formatDivisionAreaLabel(a: {
  district: string | null;
  upazila: string | null;
  unionOrArea: string | null;
}): string {
  const parts = [a.district, a.upazila, a.unionOrArea].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
  return parts.map((p) => p.trim()).join(" > ");
}

function pickAvatarUrl(args: {
  customerPhoto: string | null;
  serializedProfile: ReturnType<typeof serializeTechnicianProfile> | null;
}): string | null {
  if (args.customerPhoto) return args.customerPhoto;
  const docs = args.serializedProfile?.documents;
  if (!docs) return null;
  const photo = docs.find((d) => d.type === AiTechnicianDocumentType.PROFILE_PHOTO);
  return photo?.fileUrl?.trim() || null;
}

function displayNameForUser(user: {
  email: string;
  customerProfile: { displayName: string } | null;
  doctorProfile: { displayName: string | null } | null;
  aiTechnicianProfile: { displayName: string | null } | null;
}): string {
  if (user.customerProfile?.displayName?.trim()) {
    return user.customerProfile.displayName.trim();
  }
  if (user.doctorProfile?.displayName?.trim()) {
    return user.doctorProfile.displayName.trim();
  }
  if (user.aiTechnicianProfile?.displayName?.trim()) {
    return user.aiTechnicianProfile.displayName.trim();
  }
  const local = user.email.split("@")[0]?.trim();
  if (local && local.length > 0) return local;
  return "User";
}

export async function buildMobileProfileDashboardContext(
  userId: string,
): Promise<MobileProfileDashboardContextData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      customerProfile: true,
      doctorProfile: { select: { id: true, displayName: true, profilePhotoUrl: true } },
      aiTechnicianProfile: {
        select: { id: true, status: true, displayName: true },
      },
    },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const aiApplicationStatus = user.aiTechnicianProfile?.status ?? null;
  const hasAiTechnicianApplication = user.aiTechnicianProfile != null;

  const dashboardType = mapDashboardType({
    role: user.role,
    doctorProfileId: user.doctorProfile?.id ?? null,
    aiTechnicianStatus: aiApplicationStatus,
  });

  let serializedProfile: ReturnType<typeof serializeTechnicianProfile> | null = null;
  if (user.aiTechnicianProfile != null) {
    const full = await getTechnicianProfileForUser(userId);
    if (full) {
      serializedProfile = serializeTechnicianProfile(full);
    }
  }

  const customerPhoto = user.customerProfile?.profilePhotoUrl?.trim() || null;
  const doctorPhoto = user.doctorProfile?.profilePhotoUrl?.trim() || null;

  const avatarUrl =
    dashboardType === "DOCTOR"
      ? doctorPhoto || customerPhoto || pickAvatarUrl({ customerPhoto: null, serializedProfile })
      : pickAvatarUrl({ customerPhoto, serializedProfile });

  const name = displayNameForUser({
    email: user.email,
    customerProfile: user.customerProfile,
    doctorProfile: user.doctorProfile,
    aiTechnicianProfile: user.aiTechnicianProfile,
  });

  const userDto = {
    id: user.id,
    name,
    phone: user.phone?.trim() || "",
    email: user.email,
    avatarUrl,
  };

  let aiTechnician: MobileProfileDashboardContextData["aiTechnician"] = null;

  if (serializedProfile && dashboardType === "AI_TECHNICIAN") {
    const serviceAreas = serializedProfile.divisionCoverageAreas.map((a) =>
      formatDivisionAreaLabel(a),
    );

    const dash = await getMobileTechnicianDashboard(userId);
    const todayRequestCount = dash.todayRequestsCount;
    const pendingRequestCount = dash.pendingRequestsCount;
    const completedServiceCount = dash.completedServicesCount;
    const rating = {
      average: dash.ratingAverage,
      count: dash.ratingCount,
    };

    aiTechnician = {
      id: serializedProfile.id,
      status: serializedProfile.status,
      displayName: serializedProfile.displayName,
      serviceAreas,
      todayRequestCount,
      pendingRequestCount,
      completedServiceCount,
      rating,
    };
  }

  let farmSummary: FarmSummaryContext | undefined;
  if (user.role === UserRole.CUSTOMER && user.customerProfile) {
    farmSummary = await getFarmContextService().buildFarmSummary(user.customerProfile.id);
  }

  return {
    dashboardType,
    hasAiTechnicianApplication,
    aiTechnicianApplicationStatus: hasAiTechnicianApplication
      ? (aiApplicationStatus ?? serializedProfile?.status ?? null)
      : null,
    ...(farmSummary ? { farmSummary } : {}),
    user: userDto,
    aiTechnician,
    doctor: null,
  };
}
