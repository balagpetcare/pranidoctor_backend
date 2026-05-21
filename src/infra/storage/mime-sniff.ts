const DANGEROUS_MIMES = new Set([
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/javascript',
  'text/javascript',
  'application/x-sh',
  'application/x-csh',
]);

const DANGEROUS_EXT = /\.(exe|bat|cmd|msi|dll|scr|pif|com|sh|ps1|js|jar)(\.|$)/i;

export function sniffMimeFromBuffer(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }

  if (buf.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }

  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    return 'video/mp4';
  }

  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return 'video/webm';
  }

  return null;
}

export function isDangerousMime(mime: string): boolean {
  const m = mime.trim().toLowerCase();
  if (DANGEROUS_MIMES.has(m)) return true;
  if (m.startsWith('audio/')) return true;
  return false;
}

export function isDangerousExtension(name: string): boolean {
  return DANGEROUS_EXT.test(name.toLowerCase());
}
