import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { validateLegalSafeMessaging } from '../../shared/compliance/messaging-compliance.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

const NOTIFICATION_LITERALS = [
  'Service request submitted',
  'request was submitted successfully',
  'Doctor accepted your request',
  'accepted your service request',
  'Service completed',
  'marked completed',
  'New service request',
  'pending assignment',
  'Prani Doctor: Your request',
  'Prani Doctor: Your service request is completed',
];

describe('STATIC-COPY — emergency notification sources', () => {
  it('scans legacy notification event literals', () => {
    const text = readFileSync(
      join(root, 'legacy/web/lib/notifications/events.ts'),
      'utf8',
    );
    for (const literal of NOTIFICATION_LITERALS) {
      expect(text, `missing literal: ${literal}`).toContain(literal);
      expect(validateLegalSafeMessaging(literal).ok, literal).toBe(true);
    }
  });
});
