import type {
  DependencyStatus,
  GranularHealthResponse,
  HealthCheckResult,
  HealthResponse,
  LivenessResponse,
  ReadinessResponse,
} from './health.types.js';

export function wantsLiteResponse(query: Record<string, unknown>): boolean {
  const value = query.lite ?? query.format;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'lite';
  }
  return false;
}

export function compactCheck(
  check: HealthCheckResult,
): Pick<HealthCheckResult, 'name' | 'status' | 'latency'> {
  return {
    name: check.name,
    status: check.status,
    latency: check.latency,
  };
}

export function toLiteHealthResponse(
  health: HealthResponse,
): Pick<HealthResponse, 'status' | 'timestamp' | 'version' | 'uptime'> {
  return {
    status: health.status,
    timestamp: health.timestamp,
    version: health.version,
    uptime: health.uptime,
  };
}

export function toLiteReadinessResponse(
  readiness: ReadinessResponse,
): Pick<ReadinessResponse, 'ready' | 'timestamp'> & {
  checks: ReturnType<typeof compactCheck>[];
} {
  return {
    ready: readiness.ready,
    timestamp: readiness.timestamp,
    checks: readiness.checks.map(compactCheck),
  };
}

export function toLiteLivenessResponse(
  liveness: LivenessResponse,
): Pick<LivenessResponse, 'alive' | 'service' | 'timestamp'> {
  return {
    alive: liveness.alive,
    service: liveness.service,
    timestamp: liveness.timestamp,
  };
}

export function toLiteGranularResponse(
  body: GranularHealthResponse,
): { check: ReturnType<typeof compactCheck>; timestamp: string } {
  return {
    check: compactCheck(body.check),
    timestamp: body.timestamp,
  };
}

export function toLiteDependencyResponse(
  dependencies: DependencyStatus[],
): Array<Pick<DependencyStatus, 'name' | 'type' | 'status' | 'required'>> {
  return dependencies.map(({ name, type, status, required }) => ({
    name,
    type,
    status,
    required,
  }));
}
