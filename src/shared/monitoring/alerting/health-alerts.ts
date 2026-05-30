import { isProduction } from '../../config/config.loader.js';

import {
  sendCriticalAlert,
  sendWarningAlert,
} from './alert-service.js';

export function alertReadinessFailure(reason: string): void {
  sendCriticalAlert(
    'ALT-DOWN-02',
    'API readiness check failed',
    reason,
    { dependency: 'ready', reason },
    'ready',
  );
}

export function alertDependencyUnhealthy(
  dependency: string,
  message?: string,
): void {
  const alertId = dependency === 'database' ? 'ALT-DB-01' : 'ALT-DOWN-03';
  sendCriticalAlert(
    alertId,
    `${dependency} unhealthy`,
    message ?? `${dependency} health check failed`,
    { dependency, message },
    dependency,
  );
}

export function alertRedisUnavailable(message?: string): void {
  if (!isProduction()) return;
  sendCriticalAlert(
    'ALT-SEC-02',
    'Redis unavailable',
    message ?? 'Rate limiting may fail closed with 503',
    { dependency: 'redis' },
    'redis',
  );
}

export function alertStorageUnhealthy(message?: string): void {
  sendCriticalAlert(
    'ALT-DOWN-03',
    'Object storage unhealthy',
    message ?? 'Storage health check failed',
    { dependency: 'storage' },
    'storage',
  );
}

export function alertQueueUnhealthy(message?: string): void {
  sendWarningAlert(
    'ALT-ERR-09',
    'Queue subsystem unhealthy',
    message ?? 'Background queue probe failed',
    { dependency: 'queue' },
    'queue',
  );
}

export function alertApiServerError(params: {
  method: string;
  path: string;
  code?: string;
  requestId?: string;
}): void {
  sendWarningAlert(
    'ALT-ERR-01',
    'API server error',
    `${params.method} ${params.path} — ${params.code ?? '500'}`,
    {
      method: params.method,
      path: params.path,
      code: params.code,
      requestId: params.requestId,
    },
    `${params.method}:${params.path}`,
  );
}

export function alertUncaughtProcessError(
  source: 'uncaughtException' | 'unhandledRejection',
  message: string,
): void {
  sendCriticalAlert(
    'ALT-ERR-02',
    'Uncaught process error',
    message,
    { source },
    source,
  );
}
