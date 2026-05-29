import {
  RequestPriority,
  ServiceRequestStatus,
  ServiceRequestType,
} from '../../../generated/prisma/index.js';

/** Doctor-facing consultation service types (excludes AI technician bookings). */
export const DOCTOR_CONSULT_SERVICE_TYPES: ServiceRequestType[] = [
  ServiceRequestType.DOCTOR_HOME_VISIT,
  ServiceRequestType.EMERGENCY_DOCTOR,
  ServiceRequestType.ONLINE_CONSULTATION_LATER,
];

export function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export type EmergencyRequestFilter = {
  OR: Array<
    | { isEmergency: true }
    | { priority: typeof RequestPriority.EMERGENCY }
    | { serviceType: typeof ServiceRequestType.EMERGENCY_DOCTOR }
  >;
};

export function emergencyRequestFilter(): EmergencyRequestFilter {
  return {
    OR: [
      { isEmergency: true },
      { priority: RequestPriority.EMERGENCY },
      { serviceType: ServiceRequestType.EMERGENCY_DOCTOR },
    ],
  };
}

export function doctorConsultBaseFilter() {
  return {
    serviceType: { in: DOCTOR_CONSULT_SERVICE_TYPES },
    status: {
      notIn: [ServiceRequestStatus.COMPLETED, ServiceRequestStatus.CANCELLED],
    },
  };
}

export type StaleServiceRequestRow = {
  id: string;
  priority: RequestPriority;
  serviceType: ServiceRequestType;
  assignedAt: Date | null;
  submittedAt: Date;
  startedAt: Date | null;
};

export function minutesWaiting(from: Date | null | undefined): number {
  if (!from) return 0;
  return Math.max(0, Math.round((Date.now() - from.getTime()) / 60_000));
}

export function formatSampleIds(rows: { id: string }[], limit = 5): string {
  return rows
    .slice(0, limit)
    .map((r) => r.id)
    .join(', ');
}
