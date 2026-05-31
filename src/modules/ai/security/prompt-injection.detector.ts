/** Heuristic prompt-injection and jailbreak pattern detection. */

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(your|the)\s+(system|safety|guidelines)/i,
  /you\s+are\s+now\s+(in\s+)?(dan|devmode|unrestricted)/i,
  /jailbreak/i,
  /bypass\s+(safety|content|filter)/i,
  /reveal\s+(your|the)\s+(system|hidden)\s+prompt/i,
  /<\s*script[\s>]/i,
  /\{\{\s*system\s*\}\}/i,
  /sudo\s+mode/i,
  /act\s+as\s+if\s+you\s+have\s+no\s+restrictions/i,
];

const ROLE_OVERRIDE_PATTERNS: RegExp[] = [
  /^system\s*:/im,
  /^assistant\s*:/im,
  /\[INST\]/i,
  /<<SYS>>/i,
];

export type PromptInjectionResult = {
  detected: boolean;
  flags: string[];
  score: number;
};

export function detectPromptInjection(text: string): PromptInjectionResult {
  const flags: string[] = [];
  let score = 0;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      flags.push(`pattern:${pattern.source.slice(0, 40)}`);
      score += 35;
    }
  }

  for (const pattern of ROLE_OVERRIDE_PATTERNS) {
    if (pattern.test(text)) {
      flags.push(`role_override:${pattern.source.slice(0, 24)}`);
      score += 25;
    }
  }

  if (text.length > 12_000) {
    flags.push('excessive_length');
    score += 15;
  }

  const nullBytes = text.includes('\0');
  if (nullBytes) {
    flags.push('null_byte');
    score += 40;
  }

  score = Math.min(100, score);
  return {
    detected: score >= 35,
    flags,
    score,
  };
}

export function detectJailbreak(text: string): boolean {
  return /jailbreak|dan\s+mode|do\s+anything\s+now|ignore\s+safety/i.test(text);
}
