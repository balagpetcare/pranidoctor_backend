import { Prisma } from '../../generated/prisma/index.js';

/** Serializes JSON-compatible values for Prisma JSON columns. */
export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Maps optional JSON values for create/update (null → JsonNull). */
export function toOptionalInputJson(
  value: unknown | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return toInputJson(value);
}

/** Maps non-undefined JSON values for nullable Prisma JSON columns. */
export function toNullableInputJson(
  value: unknown | null,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null) {
    return Prisma.JsonNull;
  }
  return toInputJson(value);
}
