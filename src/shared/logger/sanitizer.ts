const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordhash',
  'secret',
  'token',
  'otp',
  'code',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'nidnumber',
  'nid_number',
  'creditcard',
  'credit_card',
  'cvv',
  'ssn',
  'pin',
]);

const REDACTED = '[REDACTED]';

export function sanitizeValue(key: string, value: unknown): unknown {
  const lowerKey = key.toLowerCase().replace(/[_-]/g, '');

  if (SENSITIVE_FIELDS.has(lowerKey)) {
    return REDACTED;
  }

  return value;
}

export function sanitizeObject(obj: unknown, depth = 0): unknown {
  if (depth > 10) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const sanitizedValue = sanitizeValue(key, value);

    if (sanitizedValue === REDACTED) {
      sanitized[key] = sanitizedValue;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function sanitizeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: process.env['NODE_ENV'] === 'production' ? undefined : error.stack,
  };
}
