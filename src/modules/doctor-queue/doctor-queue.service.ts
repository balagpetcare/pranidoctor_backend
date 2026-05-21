import { ServiceRequestStatus } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import {
  serviceRequestInclude,
  toServiceRequestDto,
} from '../lead/service-request.mapper.js';

export type DoctorQueueTab = 'new' | 'active' | 'completed';

function statusesForTab(tab: DoctorQueueTab): ServiceRequestStatus[] {
  switch (tab) {
    case 'new':
      return [ServiceRequestStatus.ASSIGNED, ServiceRequestStatus.ACCEPTED];
    case 'active':
      return [ServiceRequestStatus.IN_PROGRESS];
    case 'completed':
      return [ServiceRequestStatus.COMPLETED];
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}

export async function listServiceRequestsForDoctor(
  doctorProfileId: string,
  query: {
    tab: DoctorQueueTab;
    limit: number;
    offset: number;
  },
) {
  const prisma = getPrisma();
  const statuses = statusesForTab(query.tab);
  const where = {
    assignedDoctorId: doctorProfileId,
    status: { in: statuses },
  };

  const [rows, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.limit,
      skip: query.offset,
      include: serviceRequestInclude,
    }),
    prisma.serviceRequest.count({ where }),
  ]);

  return {
    requests: rows.map(toServiceRequestDto),
    total,
    limit: query.limit,
    offset: query.offset,
    tab: query.tab,
  };
}
