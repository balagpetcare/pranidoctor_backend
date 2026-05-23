import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { ServiceCheckResult } from './startup-validation.js';

const ROUTES_ROOT = join(import.meta.dirname, '../../legacy/web/routes');

export interface MobileProfileModuleValidation {
  ok: boolean;
  error?: string;
  details: {
    customerAddressService: boolean;
    mobileMeAdapter: boolean;
    profileModule: boolean;
    meRouteGet: boolean;
    meRoutePatch: boolean;
    settingsRouteGet: boolean;
  };
}

async function importOrThrow(specifier: string): Promise<unknown> {
  return import(pathToFileURL(specifier).href);
}

/**
 * Verifies mobile profile/settings modules load (catches ??/|| syntax errors and broken imports).
 * Must pass before the HTTP server accepts traffic.
 */
export async function validateMobileProfileModules(): Promise<MobileProfileModuleValidation> {
  const details = {
    customerAddressService: false,
    mobileMeAdapter: false,
    profileModule: false,
    meRouteGet: false,
    meRoutePatch: false,
    settingsRouteGet: false,
  };

  try {
    await importOrThrow(
      join(import.meta.dirname, '../../modules/profile/customer-address.service.ts'),
    );
    details.customerAddressService = true;

    const adapter = (await importOrThrow(
      join(import.meta.dirname, '../../modules/profile/compat/mobile-me.adapter.ts'),
    )) as { handleMobileMeGet?: unknown; handleMobileMePatch?: unknown };
    if (
      typeof adapter.handleMobileMeGet !== 'function' ||
      typeof adapter.handleMobileMePatch !== 'function'
    ) {
      throw new Error('mobile-me.adapter missing handleMobileMeGet or handleMobileMePatch');
    }
    details.mobileMeAdapter = true;

    await importOrThrow(join(import.meta.dirname, '../../modules/profile/index.ts'));
    details.profileModule = true;

    const meRoute = (await importOrThrow(
      join(ROUTES_ROOT, 'mobile/me/route.ts'),
    )) as { GET?: unknown; PATCH?: unknown };
    if (typeof meRoute.GET !== 'function') {
      throw new Error('/api/mobile/me route missing GET export');
    }
    if (typeof meRoute.PATCH !== 'function') {
      throw new Error('/api/mobile/me route missing PATCH export');
    }
    details.meRouteGet = true;
    details.meRoutePatch = true;

    const settingsRoute = (await importOrThrow(
      join(ROUTES_ROOT, 'mobile/settings/route.ts'),
    )) as { GET?: unknown };
    if (typeof settingsRoute.GET !== 'function') {
      throw new Error('/api/mobile/settings route missing GET export');
    }
    details.settingsRouteGet = true;

    return { ok: true, details };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message, details };
  }
}

export async function validateMobileProfileModulesCheck(): Promise<ServiceCheckResult> {
  const result = await validateMobileProfileModules();
  return {
    name: 'mobile-profile-modules',
    healthy: result.ok,
    optional: false,
    error: result.ok
      ? undefined
      : result.error ??
        'Mobile profile module import failed — check customer-address.service.ts and mobile-me.adapter',
  };
}

export function formatMobileProfileModuleFailure(result: MobileProfileModuleValidation): string {
  const lines = [
    'FATAL: Mobile profile/settings modules failed to load.',
    'The server cannot start until these imports succeed.',
    '',
  ];
  if (result.error) {
    lines.push(`  Error: ${result.error}`);
  }
  lines.push('  Module status:');
  for (const [key, ok] of Object.entries(result.details)) {
    lines.push(`    ${ok ? 'OK' : 'FAIL'} ${key}`);
  }
  lines.push('');
  lines.push(
    'Common cause: mixing ?? and || without parentheses in profile services (see ESLint no-mixed-operators).',
  );
  return lines.join('\n');
}
