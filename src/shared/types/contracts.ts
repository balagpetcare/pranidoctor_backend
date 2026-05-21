/**
 * Shared type contracts for strict TypeScript across the backend.
 */

/** Strips undefined from optional properties (exactOptionalPropertyTypes). */
export type Defined<T> = {
  [K in keyof T as T[K] extends undefined ? never : K]: Exclude<T[K], undefined>;
};

/** Express param value before normalization. */
export type ExpressParam = string | string[] | undefined;

/** JSON-serializable value for Prisma JSON columns. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonRecord = { [key: string]: JsonValue };
