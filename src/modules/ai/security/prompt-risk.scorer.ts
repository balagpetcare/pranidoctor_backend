import { detectJailbreak, detectPromptInjection } from './prompt-injection.detector.js';

export type PromptRiskAssessment = {
  score: number;
  block: boolean;
  flags: string[];
  reasons: string[];
};

const DEFAULT_BLOCK_THRESHOLD = 35;

export function assessPromptRisk(
  text: string,
  options?: { blockThreshold?: number },
): PromptRiskAssessment {
  const threshold = options?.blockThreshold ?? DEFAULT_BLOCK_THRESHOLD;
  const injection = detectPromptInjection(text);
  const jailbreak = detectJailbreak(text);

  const reasons: string[] = [];
  if (injection.detected) reasons.push('prompt_injection_heuristic');
  if (jailbreak) reasons.push('jailbreak_pattern');

  let score = injection.score;
  if (jailbreak) score = Math.min(100, score + 30);

  const flags = [...injection.flags];
  if (jailbreak) flags.push('jailbreak');

  return {
    score,
    block: score >= threshold,
    flags,
    reasons,
  };
}

export function sanitizeAiRequestInput(text: string, maxLength = 8000): string {
  return text
    .replace(/\0/g, '')
    .replace(/\u202e/g, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeAiResponseOutput(text: string, maxLength = 16_000): string {
  return text
    .replace(/\0/g, '')
    .trim()
    .slice(0, maxLength);
}
