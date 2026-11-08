/**
 * Contact Guard — pure detector for personal contact details in free text.
 * No I/O. Used by services, descriptions, prescriptions, AI chat, OCR output.
 */

export type ContactKind = 'PHONE' | 'EMAIL' | 'MESSENGER_LINK' | 'MESSENGER_HINT';

export type ContactFinding = {
  kind: ContactKind;
  /** Redacted sample, never the full value. */
  sample: string;
};

export type ContactScanResult = {
  hit: boolean;
  findings: ContactFinding[];
};

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Bengali digits -> ASCII, plus common obfuscations. */
export function normalizeText(input: string): string {
  let out = '';
  for (const ch of input.normalize('NFKC')) {
    const i = BN_DIGITS.indexOf(ch);
    out += i >= 0 ? String(i) : ch;
  }
  return out
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s*[\[(]\s*at\s*[\])]\s*/gi, '@')
    .replace(/\s*[\[(]\s*dot\s*[\])]\s*/gi, '.');
}

const WORD_DIGITS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  শূন্য: '0', এক: '1', দুই: '2', তিন: '3', চার: '4',
  পাঁচ: '5', ছয়: '6', সাত: '7', আট: '8', নয়: '9',
};

function wordsToDigits(text: string): string {
  const tokens = text.toLowerCase().split(/[\s,.\-_/]+/);
  let run = '';
  let best = '';
  for (const t of tokens) {
    const d = WORD_DIGITS[t];
    if (d) {
      run += d;
      if (run.length > best.length) best = run;
    } else {
      run = '';
    }
  }
  return best;
}

// BD mobile: optional +88/88/0088, then 01[3-9] + 8 digits.
const BD_MOBILE = /(?:^|\D)(?:\+?\s*88|0088)?[\s\-.()]*0?1[3-9](?:[\s\-.()]*\d){8}(?!\d)/;
// International-looking number: + and 9-14 digits with separators.
const INTL_PHONE = /\+\s*\d(?:[\s\-.()]*\d){8,13}/;
const EMAIL = /[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+(?:\s*\.\s*[a-z0-9-]+)+/i;
const MESSENGER_LINK =
  /(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me|imo\.im|m\.me|messenger\.com|facebook\.com\/messages|viber\.com)\/?\S*/i;
const MESSENGER_HINT =
  /(?:whats\s*app|হোয়াটসঅ্যাপ|হোয়াটস অ্যাপ|হোয়াটসএপ|\bimo\b|ইমো|telegram|টেলিগ্রাম|\bviber\b|ভাইবার|signal\s*app|messenger|মেসেঞ্জার)/i;

function allowList(): string[] {
  const raw = process.env['CONTACT_GUARD_ALLOW'] ?? '';
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function redact(value: string): string {
  const v = value.trim();
  if (v.length <= 4) return '***';
  return `${v.slice(0, 2)}***${v.slice(-2)}`;
}

function isAllowed(value: string): boolean {
  const v = value.toLowerCase().replace(/\s+/g, '');
  return allowList().some((a) => v.includes(a.replace(/\s+/g, '')));
}

/** Does the text carry a messenger hint next to digits ("whatsapp 0171...")? */
export function scanText(input: string | null | undefined): ContactScanResult {
  if (!input || typeof input !== 'string') return { hit: false, findings: [] };
  const text = normalizeText(input);
  const findings: ContactFinding[] = [];

  const bd = BD_MOBILE.exec(text);
  if (bd && !isAllowed(bd[0])) findings.push({ kind: 'PHONE', sample: redact(bd[0].replace(/\D/g, '')) });

  if (!bd) {
    const intl = INTL_PHONE.exec(text);
    if (intl && !isAllowed(intl[0])) findings.push({ kind: 'PHONE', sample: redact(intl[0].replace(/\D/g, '')) });
  }

  if (findings.length === 0) {
    const spelled = wordsToDigits(text);
    if (spelled.length >= 10 && /^0?1[3-9]/.test(spelled)) {
      findings.push({ kind: 'PHONE', sample: redact(spelled) });
    }
  }

  const mail = EMAIL.exec(text);
  if (mail && !isAllowed(mail[0])) findings.push({ kind: 'EMAIL', sample: redact(mail[0]) });

  const link = MESSENGER_LINK.exec(text);
  if (link && !isAllowed(link[0])) findings.push({ kind: 'MESSENGER_LINK', sample: redact(link[0]) });

  // A hint word alone is only a violation when digits/handle follow nearby.
  const hint = MESSENGER_HINT.exec(text);
  if (hint) {
    const tail = text.slice(hint.index, hint.index + 60);
    if (/\d{5,}/.test(tail.replace(/[\s\-.]/g, '')) || /@\w{3,}/.test(tail)) {
      findings.push({ kind: 'MESSENGER_HINT', sample: redact(hint[0]) });
    }
  }

  return { hit: findings.length > 0, findings };
}

/** Recursively scan every string in a JSON-like structure. */
export function scanDeep(value: unknown, depth = 0): ContactScanResult {
  if (depth > 6 || value == null) return { hit: false, findings: [] };
  if (typeof value === 'string') return scanText(value);
  const findings: ContactFinding[] = [];
  if (Array.isArray(value)) {
    for (const v of value) findings.push(...scanDeep(v, depth + 1).findings);
  } else if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      findings.push(...scanDeep(v, depth + 1).findings);
    }
  }
  return { hit: findings.length > 0, findings };
}

/** Mask contact details for display (user chat masking). */
export function maskContacts(input: string): string {
  const text = normalizeText(input);
  return text
    .replace(new RegExp(BD_MOBILE.source, 'g'), (m) => m.replace(/\d/g, '•'))
    .replace(new RegExp(INTL_PHONE.source, 'g'), (m) => m.replace(/\d/g, '•'))
    .replace(new RegExp(EMAIL.source, 'gi'), '[ইমেইল লুকানো]')
    .replace(new RegExp(MESSENGER_LINK.source, 'gi'), '[লিংক লুকানো]');
}

export const CONTACT_INFO_NOT_ALLOWED = 'CONTACT_INFO_NOT_ALLOWED';
