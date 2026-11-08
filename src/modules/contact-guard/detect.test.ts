import { describe, expect, it } from 'vitest';

import { maskContacts, scanText } from './detect.js';

describe('contact-guard detector', () => {
  it.each([
    'কল করুন 01712345678',
    '০১৭১২৩৪৫৬৭৮',
    '+880 1712-345678',
    '0171 234 5678',
    'mail me a.b(at)gmail[dot]com',
    'whatsapp 01912345678',
    'wa.me/8801712345678',
    'imo: ০১৮১১ ২২ ৩৩ ৪৪',
    'zero one seven one two three four five six seven eight',
  ])('flags %s', (t) => expect(scanText(t).hit).toBe(true));

  it.each([
    'গরুর ওজন ৩০০ কেজি, ফি ১৫০০ টাকা',
    'Dose 5ml twice daily for 7 days',
    'ঢাকা, মিরপুর ১০, বাড়ি ১২',
  ])('allows %s', (t) => expect(scanText(t).hit).toBe(false));

  it('never returns the full number in samples', () => {
    const r = scanText('01712345678');
    expect(r.findings[0]?.sample).not.toContain('01712345678');
  });

  it('masks phones and emails', () => {
    expect(maskContacts('ph 01712345678 x@y.com')).not.toMatch(/\d{5}/);
  });
});
