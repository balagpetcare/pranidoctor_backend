/** Best-effort SQL label extraction for Prisma query events. */
export function parsePrismaQueryLabels(query: string): { model: string; operation: string } {
  const trimmed = query.trimStart();
  const upper = trimmed.toUpperCase();

  let operation = 'unknown';
  if (upper.startsWith('SELECT')) operation = 'select';
  else if (upper.startsWith('INSERT')) operation = 'insert';
  else if (upper.startsWith('UPDATE')) operation = 'update';
  else if (upper.startsWith('DELETE')) operation = 'delete';

  const tableMatch =
    trimmed.match(/\bFROM\s+"?(\w+)"?/i) ??
    trimmed.match(/\bINTO\s+"?(\w+)"?/i) ??
    trimmed.match(/\bUPDATE\s+"?(\w+)"?/i);

  const model = tableMatch?.[1]?.toLowerCase() ?? 'raw';
  return { model, operation };
}
