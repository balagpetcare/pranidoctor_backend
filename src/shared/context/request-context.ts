import { AsyncLocalStorage } from 'node:async_hooks';
import { nanoid } from 'nanoid';

import { omitUndefined } from '../types/object.utils.js';

export interface RequestContextData {
  requestId: string;
  traceId: string;
  spanId: string;
  userId?: string;
  tenantId?: string;
  startTime: number;
  path?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContextData>();

export function createRequestContext(partial?: Partial<RequestContextData>): RequestContextData {
  return {
    requestId: partial?.requestId ?? nanoid(21),
    traceId: partial?.traceId ?? nanoid(16),
    spanId: partial?.spanId ?? nanoid(8),
    startTime: partial?.startTime ?? Date.now(),
    ...omitUndefined({
      userId: partial?.userId,
      tenantId: partial?.tenantId,
      path: partial?.path,
      method: partial?.method,
      ip: partial?.ip,
      userAgent: partial?.userAgent,
    }),
  };
}

export function runWithContext<T>(context: RequestContextData, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

export function getRequestContext(): RequestContextData | undefined {
  return asyncLocalStorage.getStore();
}

export function getRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.requestId;
}

export function getTraceId(): string | undefined {
  return asyncLocalStorage.getStore()?.traceId;
}

export function getUserId(): string | undefined {
  return asyncLocalStorage.getStore()?.userId;
}

export function getTenantId(): string | undefined {
  return asyncLocalStorage.getStore()?.tenantId;
}

export function setUserId(userId: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.userId = userId;
  }
}

export function setTenantId(tenantId: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.tenantId = tenantId;
  }
}

export function getElapsedTime(): number {
  const store = asyncLocalStorage.getStore();
  if (!store) return 0;
  return Date.now() - store.startTime;
}
