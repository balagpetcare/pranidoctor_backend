import { AiTechnicianStatus, UserRole } from "@/generated/prisma/client";

export type MobileProfileDashboardType =
  | "GENERAL"
  | "AI_TECHNICIAN"
  | "DOCTOR";

export type MapDashboardTypeInput = {
  role: UserRole;
  doctorProfileId: string | null;
  aiTechnicianStatus: AiTechnicianStatus | null;
};

/**
 * Pure routing key for the mobile Profile tab.
 * Precedence: DOCTOR (with profile) → AI technician **approved** → GENERAL.
 *
 * Non-approved AI technician application states stay on the general customer
 * profile; use `hasAiTechnicianApplication` + `aiTechnicianApplicationStatus`
 * in the dashboard-context payload for in-profile banners.
 */
export function mapDashboardType(input: MapDashboardTypeInput): MobileProfileDashboardType {
  const { role, doctorProfileId, aiTechnicianStatus } = input;

  if (role === UserRole.DOCTOR && doctorProfileId) {
    return "DOCTOR";
  }

  if (
    aiTechnicianStatus === AiTechnicianStatus.APPROVED ||
    aiTechnicianStatus === AiTechnicianStatus.PUBLISHED
  ) {
    return "AI_TECHNICIAN";
  }

  return "GENERAL";
}
