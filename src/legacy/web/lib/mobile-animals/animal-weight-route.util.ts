import { jsonError } from "@/lib/api-response";

export function mapAnimalWeightRouteError(e: unknown) {
  if (!(e instanceof Error)) {
    return jsonError("DATABASE_ERROR", "Could not process weight request", 500);
  }
  switch (e.message) {
    case "ANIMAL_NOT_FOUND":
      return jsonError("NOT_FOUND", "Animal not found", 404);
    case "TAPE_NOT_SUPPORTED":
      return jsonError("TAPE_NOT_SUPPORTED", "Tape weight not supported for this species", 422);
    case "TAPE_OUT_OF_RANGE":
      return jsonError("VALIDATION_ERROR", "Measurements out of valid range", 422);
    case "INVALID_TAPE_MEASUREMENT":
      return jsonError("VALIDATION_ERROR", "Invalid tape measurements", 422);
    case "INVALID_MEASURED_AT":
      return jsonError("VALIDATION_ERROR", "Invalid measuredAt", 422);
    case "DUPLICATE_CLIENT_MEASUREMENT": {
      const existing = (e as Error & { existing?: unknown }).existing;
      return jsonError("DUPLICATE_CLIENT_MEASUREMENT", "Measurement already recorded", 409, {
        existing,
      });
    }
    default:
      return jsonError("DATABASE_ERROR", "Could not process weight request", 500);
  }
}
