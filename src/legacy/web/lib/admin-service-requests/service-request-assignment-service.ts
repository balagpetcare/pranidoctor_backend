import {
  assignDoctorToServiceRequest as assignDoctorCore,
  assignTechnicianToServiceRequest as assignTechnicianCore,
} from "../../../../modules/assignment/assignment.service.js";

import { adminGetServiceRequest } from "./service-request-admin-service";
import type { AdminServiceRequestDto } from "./service-request-admin-service";
import { ServiceRequestStatus } from "@/generated/prisma/client";

export type AssignServiceRequestDoctorResult =
  | { ok: "UPDATED"; request: AdminServiceRequestDto }
  | { ok: "NOT_FOUND" }
  | { ok: "INVALID_DOCTOR" }
  | { ok: "TERMINAL_STATUS"; status: ServiceRequestStatus }
  | { ok: "INVALID_TRANSITION"; status: ServiceRequestStatus };

export async function assignDoctorToServiceRequest(
  serviceRequestId: string,
  doctorProfileId: string,
): Promise<AssignServiceRequestDoctorResult> {
  const result = await assignDoctorCore(serviceRequestId, doctorProfileId);
  if (result.ok !== "UPDATED") {
    return result;
  }
  const dto = await adminGetServiceRequest(serviceRequestId);
  return dto ? { ok: "UPDATED", request: dto } : { ok: "NOT_FOUND" };
}

export type AssignServiceRequestTechnicianResult =
  | { ok: "UPDATED"; request: AdminServiceRequestDto }
  | { ok: "NOT_FOUND" }
  | { ok: "INVALID_TECHNICIAN" }
  | { ok: "TERMINAL_STATUS"; status: ServiceRequestStatus }
  | { ok: "INVALID_TRANSITION"; status: ServiceRequestStatus };

export async function assignTechnicianToServiceRequest(
  serviceRequestId: string,
  technicianProfileId: string,
): Promise<AssignServiceRequestTechnicianResult> {
  const result = await assignTechnicianCore(serviceRequestId, technicianProfileId);
  if (result.ok !== "UPDATED") {
    return result;
  }
  const dto = await adminGetServiceRequest(serviceRequestId);
  return dto ? { ok: "UPDATED", request: dto } : { ok: "NOT_FOUND" };
}
