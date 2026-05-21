import { notifyServiceRequestSubmitted } from "@/lib/notifications/events";

import type { CreateServiceRequestBody } from "./schemas";
import {
  cancelServiceRequestForCustomer as cancelLead,
  createServiceRequestForCustomer as createLead,
  getServiceRequestForCustomer as getLead,
  listServiceRequestsForCustomer as listLeads,
} from "../../../../modules/lead/customer-lead.service.js";

export async function createServiceRequestForCustomer(
  customerProfileId: string,
  body: CreateServiceRequestBody,
) {
  const result = await createLead(customerProfileId, body);
  if (result.ok === "CREATED") {
    void notifyServiceRequestSubmitted(result.request.id).catch((err) =>
      console.error("[notifications] notifyServiceRequestSubmitted", err),
    );
  }
  return result;
}

export {
  listLeads as listServiceRequestsForCustomer,
  getLead as getServiceRequestForCustomer,
  cancelLead as cancelServiceRequestForCustomer,
};
