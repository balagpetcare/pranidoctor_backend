/**
 * Bangladesh mobile normalization (canonical; legacy re-exports).
 */
export function normalizeBdMobilePhone(raw: string): string | null {
  let s = raw.trim();
  if (s.startsWith('+')) {
    s = s.slice(1);
  }
  const digits = s.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return null;

  if (digits.length === 11 && digits.startsWith('01')) {
    return `88${digits}`;
  }
  if (digits.length === 13 && digits.startsWith('8801')) {
    return digits;
  }
  if (digits.length === 10 && digits.startsWith('1')) {
    return `880${digits}`;
  }
  return null;
}

export function maskBdMobilePhone(raw: string): string {
  const n = normalizeBdMobilePhone(raw) ?? raw.replace(/\D/g, '');
  if (n.length < 4) return '****';
  return `******${n.slice(-4)}`;
}
