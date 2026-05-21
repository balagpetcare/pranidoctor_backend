import { BadRequestError } from '../errors/http.errors.js';

type ParamValue = string | string[] | undefined;

/**
 * Normalizes Express route/query params to a single string.
 */
export function requireParam(value: ParamValue, name = 'id'): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) {
    return value[0];
  }

  throw new BadRequestError('INVALID_PARAM', `Missing or invalid route parameter: ${name}`);
}
