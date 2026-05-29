import { ServiceRequestStatus, ServiceRequestType } from '../../generated/prisma/index.js';

export function serviceRequestStatusLabel(status: ServiceRequestStatus): string {
  switch (status) {
    case ServiceRequestStatus.PENDING:
      return 'Pending';
    case ServiceRequestStatus.ACCEPTED:
      return 'Accepted';
    case ServiceRequestStatus.ASSIGNED:
      return 'Assigned';
    case ServiceRequestStatus.IN_PROGRESS:
      return 'In progress';
    case ServiceRequestStatus.COMPLETED:
      return 'Completed';
    case ServiceRequestStatus.CANCELLED:
      return 'Cancelled';
    case ServiceRequestStatus.REJECTED:
      return 'Rejected';
    default:
      return status;
  }
}

export function serviceRequestTypeLabel(type: ServiceRequestType): string {
  switch (type) {
    case ServiceRequestType.DOCTOR_HOME_VISIT:
      return 'Home visit';
    case ServiceRequestType.EMERGENCY_DOCTOR:
      return 'Emergency';
    case ServiceRequestType.AI_SERVICE:
      return 'AI service';
    case ServiceRequestType.ONLINE_CONSULTATION_LATER:
      return 'Online consultation';
    default:
      return type;
  }
}
