import { jsonError } from "@/lib/api-response";

/** Maps catalog validation errors thrown by the farm service to 422 responses. */
export function typeErrorResponse(message: string): Response | null {
  switch (message) {
    case "INVALID_FARM_TYPE":
      return jsonError("INVALID_FARM_TYPE", "Farm type is not available", 422);
    case "SUB_TYPE_REQUIRED":
      return jsonError("SUB_TYPE_REQUIRED", "Choose a sub type for this farm type", 422);
    case "INVALID_SUB_TYPE":
      return jsonError("INVALID_SUB_TYPE", "Sub type does not match the farm type", 422);
    default:
      return null;
  }
}
