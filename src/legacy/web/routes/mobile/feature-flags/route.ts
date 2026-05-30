import { jsonError, jsonOk } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

/** Read-only feature flags for mobile clients (Setting `mobile.feature.flags`). */
export async function GET() {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: 'mobile.feature.flags' },
      select: { valueJson: true },
    });
    const flags =
      row?.valueJson !== null &&
      typeof row?.valueJson === 'object' &&
      !Array.isArray(row?.valueJson)
        ? (row.valueJson as Record<string, unknown>)
        : {};
    return jsonOk({ flags });
  } catch {
    return jsonError('INTERNAL', 'Could not read feature flags', 500);
  }
}
