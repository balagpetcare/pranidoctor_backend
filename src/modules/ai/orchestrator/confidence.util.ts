import { containsDiagnosisLanguage } from '../../ai-veterinary-core/safety/ai-safety.guardrails.js';

/** Heuristic confidence for LLM outputs — keeps escalation path reachable. */
export function estimateLlmConfidence(content: string, inputTokens: number): number {
  let score = 0.62;
  if (content.length < 80) score -= 0.12;
  if (content.length > 400) score += 0.05;
  if (/\b(I am not sure|consult a vet|cannot confirm|নিশ্চিত নয়|চিকিৎসক)/iu.test(content)) {
    score -= 0.08;
  }
  if (containsDiagnosisLanguage(content)) score -= 0.25;
  if (inputTokens > 1200) score -= 0.05;
  return Math.max(0.35, Math.min(0.78, score));
}
