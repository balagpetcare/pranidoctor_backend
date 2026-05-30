/**
 * Legal-safe messaging validation for admin CMS and generated copy.
 * See pranidoctor_user/docs/launch/legal-safe-messaging-plan.md
 */

export type MessagingComplianceViolation = {
  field: string;
  pattern: string;
  excerpt: string;
};

export type MessagingComplianceResult = {
  ok: boolean;
  violations: MessagingComplianceViolation[];
};

/** ETA / SLA-style promises (user-facing). */
const ETA_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: 'typical_response', re: /\btypical\s+response\b/i },
  { id: 'within_minutes', re: /\bwithin\s+\d+\s*(min|minute|hour)s?\b/i },
  { id: 'under_minutes', re: /\bunder\s+\d+\s*(min|minute)s?\b/i },
  { id: 'minute_range', re: /\b\d+\s*[-–]\s*\d+\s*(min|minute)s?\b/i },
  { id: 'in_minutes', re: /\bin\s+\d+\s*(min|minute)s?\b/i },
  { id: 'will_arrive_in', re: /\bwill\s+arrive\s+in\b/i },
  { id: 'will_respond_within', re: /\bwill\s+respond\s+within\b/i },
  { id: 'eta_label', re: /\bestimated\s+response\s+time\b/i },
];

/** Positive service/outcome guarantees (negated forms are allowed). */
const DISPATCH_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: 'team_dispatched', re: /\b(team|vet|doctor)\s+dispatched\b/i },
  { id: 'we_are_sending', re: /\bwe\s+are\s+sending\b/i },
  { id: 'guaranteed_recovery', re: /\bguaranteed\s+(recovery|treatment|outcome|cure)\b/i },
  { id: 'instant_vet', re: /\binstant\s+vet(erinarian)?\b/i },
  { id: 'fastest_way', re: /\bfastest\s+way\b/i },
  { id: 'on_demand_clinic', re: /\bon[- ]demand\s+emergency\s+clinic\b/i },
];

const NEGATED_GUARANTEE =
  /(?:not|no|never|doesn't|does\s+not|cannot|can't|not\s+a)\s+(?:[\w'-]+\s+){0,4}guarantee/i;
const NOT_GUARANTEED = /\bnot\s+guaranteed?\b/i;
const POSITIVE_GUARANTEE =
  /\b(guarantees?|guaranteed|assured|promise[ds]?)\b(?!\s+(recovery|treatment|outcome))/i;

function excerpt(text: string, index: number, len = 48): string {
  const start = Math.max(0, index - 12);
  return text.slice(start, start + len).trim();
}

function findPatternViolations(
  text: string,
  field: string,
  patterns: ReadonlyArray<{ id: string; re: RegExp }>,
): MessagingComplianceViolation[] {
  const violations: MessagingComplianceViolation[] = [];
  for (const { id, re } of patterns) {
    const match = re.exec(text);
    if (match) {
      violations.push({
        field,
        pattern: id,
        excerpt: excerpt(text, match.index),
      });
    }
  }
  return violations;
}

function findGuaranteeViolations(text: string, field: string): MessagingComplianceViolation[] {
  if (!POSITIVE_GUARANTEE.test(text)) return [];
  if (NEGATED_GUARANTEE.test(text) || NOT_GUARANTEED.test(text)) return [];
  const match = POSITIVE_GUARANTEE.exec(text);
  if (!match) return [];
  return [
    {
      field,
      pattern: 'positive_guarantee',
      excerpt: excerpt(text, match.index),
    },
  ];
}

/**
 * Validate a single user-facing string (EN or BN).
 */
export function validateLegalSafeMessaging(
  text: string,
  field = 'text',
): MessagingComplianceResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: true, violations: [] };
  }

  const violations = [
    ...findPatternViolations(trimmed, field, ETA_PATTERNS),
    ...findPatternViolations(trimmed, field, DISPATCH_PATTERNS),
    ...findGuaranteeViolations(trimmed, field),
  ];

  return { ok: violations.length === 0, violations };
}

export function validateLegalSafeMessagingFields(
  fields: ReadonlyArray<{ field: string; text: string }>,
): MessagingComplianceResult {
  const violations: MessagingComplianceViolation[] = [];
  for (const { field, text } of fields) {
    const result = validateLegalSafeMessaging(text, field);
    violations.push(...result.violations);
  }
  return { ok: violations.length === 0, violations };
}

export type LocaleTextPair = { en: string; bn: string };

export function collectLocaleTextFields(
  prefix: string,
  pair: LocaleTextPair,
): Array<{ field: string; text: string }> {
  return [
    { field: `${prefix}.en`, text: pair.en },
    { field: `${prefix}.bn`, text: pair.bn },
  ];
}

/**
 * Throws ValidationError-compatible payload for admin CMS saves.
 */
export function assertLegalSafeMessagingConfig(
  fields: ReadonlyArray<{ field: string; text: string }>,
): void {
  const result = validateLegalSafeMessagingFields(fields);
  if (result.ok) return;

  const message = result.violations
    .map((v) => `${v.field}: prohibited wording (${v.pattern})`)
    .join('; ');

  const err = new Error(message);
  err.name = 'MessagingComplianceError';
  (err as Error & { violations: MessagingComplianceViolation[] }).violations =
    result.violations;
  throw err;
}

export function isMessagingComplianceError(
  error: unknown,
): error is Error & { violations: MessagingComplianceViolation[] } {
  return error instanceof Error && error.name === 'MessagingComplianceError';
}
