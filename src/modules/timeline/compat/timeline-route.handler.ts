import { compatJsonError, compatJsonOk } from '../../../compat/compat-api-response.js';

import {
  customerOwnsServiceRequest,
  doctorAssignedToServiceRequest,
  listTimelineForServiceRequest,
  serviceRequestExists,
} from '../timeline.service.js';

export async function handleMobileTimelineGet(
  customerProfileId: string,
  requestId: string,
): Promise<Response> {
  const allowed = await customerOwnsServiceRequest(customerProfileId, requestId);
  if (!allowed) {
    return compatJsonError('NOT_FOUND', 'Service request not found', 404);
  }

  try {
    const data = await listTimelineForServiceRequest(requestId);
    return compatJsonOk(data);
  } catch {
    return compatJsonError('DATABASE_ERROR', 'Could not load timeline', 500);
  }
}

export async function handleDoctorTimelineGet(
  doctorProfileId: string,
  requestId: string,
): Promise<Response> {
  const allowed = await doctorAssignedToServiceRequest(doctorProfileId, requestId);
  if (!allowed) {
    return compatJsonError('NOT_FOUND', 'Service request not found', 404);
  }

  try {
    const data = await listTimelineForServiceRequest(requestId);
    return compatJsonOk(data);
  } catch {
    return compatJsonError('DATABASE_ERROR', 'Could not load timeline', 500);
  }
}

export async function handleAdminTimelineGet(requestId: string): Promise<Response> {
  try {
    const exists = await serviceRequestExists(requestId);
    if (!exists) {
      return compatJsonError('NOT_FOUND', 'Service request not found', 404);
    }
    const data = await listTimelineForServiceRequest(requestId);
    return compatJsonOk(data);
  } catch {
    return compatJsonError('DATABASE_ERROR', 'Could not load timeline', 500);
  }
}
