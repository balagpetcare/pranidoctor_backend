export interface ProviderChainEntry {
  order: number;
  providerKey: string;
  providerId: string;
  modelId: string | null;
}

export interface RouteHop {
  order: number;
  providerId: string;
  providerKey: string;
  modelId: string;
  modelKey: string;
  modelType: string;
  adapterType: string;
  providerEnabled: boolean;
  modelEnabled: boolean;
}

export interface ResolvedRoute {
  routeId: string;
  routeKey: string;
  taskType: string;
  scopeKey: string;
  name: string;
  maxRetries: number;
  timeoutMs: number;
  asyncRequired: boolean;
  maxCostUsd: number | null;
  fallbackToRules: boolean;
  hops: RouteHop[];
}

export interface AiRouteRequest {
  taskType: string;
  tenantId?: string | null;
  branchId?: string | null;
}

export interface ModelSelectionInput {
  scopeKey: string;
  providerId: string;
  providerKey: string;
  routePrimaryModelId?: string | null;
  chainModelId?: string | null;
  modelTypeHint?: string;
}

export interface SelectedModel {
  modelId: string;
  modelKey: string;
  modelType: string;
  providerId: string;
  enabled: boolean;
}
