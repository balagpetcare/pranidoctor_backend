export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  checks: HealthCheckResult[];
}

export interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  checks: HealthCheckResult[];
}

export interface LivenessResponse {
  alive: boolean;
  service: string;
  timestamp: string;
}

export interface DependencyStatus {
  name: string;
  type: 'database' | 'cache' | 'queue' | 'external' | 'ai';
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency: number;
  required: boolean;
  message?: string;
}

export interface ModuleHealthEntry {
  name: string;
  mountPath: string;
  initialized: boolean;
}

export interface ModulesHealthResponse {
  timestamp: string;
  compatWeb: {
    mounted: boolean;
    legacyRouteFiles: number;
    apiPrefix: string;
  };
  expressModules: ModuleHealthEntry[];
  totalModuleCount: number;
}

export interface GranularHealthResponse {
  check: HealthCheckResult;
  timestamp: string;
}

export interface SystemInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  pid: number;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
}
