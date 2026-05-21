/**
 * Removes `undefined` from property value types (for exactOptionalPropertyTypes).
 */
export type StripUndefined<T> = {
  [K in keyof T as undefined extends T[K] ? (T[K] extends undefined ? never : K) : K]: Exclude<
    T[K],
    undefined
  >;
};

/**
 * Removes keys whose values are `undefined`.
 * Required for `exactOptionalPropertyTypes` — optional props must be omitted, not set to undefined.
 */
export function omitUndefined<T extends Record<string, unknown>>(value: T): StripUndefined<T> {
  const result = {} as Record<string, unknown>;

  for (const key of Object.keys(value) as (keyof T)[]) {
    const entry = value[key];
    if (entry !== undefined) {
      result[key as string] = entry;
    }
  }

  return result as StripUndefined<T>;
}

/**
 * Recursively omits undefined values from plain objects (arrays and Dates are preserved).
 */
export function omitUndefinedDeep<T extends Record<string, unknown>>(value: T): StripUndefined<T> {
  const result = {} as Record<string, unknown>;

  for (const [key, val] of Object.entries(value)) {
    if (val === undefined) {
      continue;
    }

    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      !(val instanceof Date)
    ) {
      result[key] = omitUndefinedDeep(val as Record<string, unknown>);
    } else {
      result[key] = val;
    }
  }

  return result as StripUndefined<T>;
}

/**
 * Conditionally assigns a value when it is not undefined (exact optional property helper).
 */
export function setIfDefined<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
