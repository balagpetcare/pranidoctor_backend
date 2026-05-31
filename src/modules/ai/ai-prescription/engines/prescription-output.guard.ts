/** PX-01 — detect autonomous prescription / treatment plan language in LLM output. */
const RX_COMPLETION_PATTERNS = [
  /\b(prescribe|administer|inject|give)\s+\d+/i,
  /\b(take|use)\s+\d+\s*(mg|ml)\b/i,
  /(প্রয়োগ করুন|ইঞ্জেকশন দিন|দিন\s*\d+)/i,
  /\b(daily for \d+ days|twice daily|every \d+ hours)\b/i,
];

export function containsAutonomousPrescriptionLanguage(text: string): boolean {
  return RX_COMPLETION_PATTERNS.some((pattern) => pattern.test(text));
}
