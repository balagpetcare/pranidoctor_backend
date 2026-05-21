import "server-only";

import {
  ServiceInstanceStatus,
  UserRole,
} from "@/generated/prisma/client";

const WORKER = "AI_TECHNICIAN_WORKER";
const ADMIN = "ADMIN_ACTOR";

export function roleLabelForLog(userRole: UserRole | "SYSTEM"): string {
  if (userRole === "SYSTEM") return "SYSTEM";
  return userRole;
}

export type StatusTransitionActor = "worker" | "admin";

export function assertStatusTransitionAllowed(params: {
  from: ServiceInstanceStatus;
  to: ServiceInstanceStatus;
  actor: StatusTransitionActor;
}): { ok: true } | { ok: false; code: string; message: string } {
  const { from, to, actor } = params;
  if (from === to) {
    return { ok: false, code: "NO_OP", message: "অবস্থা অপরিবর্তিত" };
  }

  if (actor === "worker") {
    if (
      (from === ServiceInstanceStatus.DRAFT ||
        from === ServiceInstanceStatus.NEEDS_CORRECTION) &&
      to === ServiceInstanceStatus.SUBMITTED
    ) {
      return { ok: true };
    }
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "কর্মী এই অবস্থা পরিবর্তন করতে পারবে না",
    };
  }

  // admin
  const adminPairs: [ServiceInstanceStatus, ServiceInstanceStatus][] = [
    [ServiceInstanceStatus.SUBMITTED, ServiceInstanceStatus.UNDER_REVIEW],
    [ServiceInstanceStatus.UNDER_REVIEW, ServiceInstanceStatus.APPROVED],
    [ServiceInstanceStatus.UNDER_REVIEW, ServiceInstanceStatus.REJECTED],
    [ServiceInstanceStatus.UNDER_REVIEW, ServiceInstanceStatus.NEEDS_CORRECTION],
    [ServiceInstanceStatus.APPROVED, ServiceInstanceStatus.ARCHIVED],
    [ServiceInstanceStatus.SUBMITTED, ServiceInstanceStatus.REJECTED],
    [ServiceInstanceStatus.SUBMITTED, ServiceInstanceStatus.ARCHIVED],
    [ServiceInstanceStatus.UNDER_REVIEW, ServiceInstanceStatus.ARCHIVED],
    [ServiceInstanceStatus.NEEDS_CORRECTION, ServiceInstanceStatus.ARCHIVED],
    [ServiceInstanceStatus.DRAFT, ServiceInstanceStatus.ARCHIVED],
  ];
  if (adminPairs.some(([a, b]) => a === from && b === to)) {
    return { ok: true };
  }

  return {
    ok: false,
    code: "INVALID_TRANSITION",
    message: "অবৈধ অবস্থা পরিবর্তন",
  };
}

export { WORKER, ADMIN };
