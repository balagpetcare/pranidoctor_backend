import type { Response } from 'express';

import { getRequestId } from '../context/request-context.js';
import type { PaginationMeta, PaginatedResult } from '../types/api.types.js';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  requestId?: string;
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const requestId = getRequestId();

  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(requestId && { requestId }),
  };

  res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

export function sendPaginated<T>(
  res: Response,
  result: PaginatedResult<T>,
  statusCode = 200
): void {
  const requestId = getRequestId();

  const response: SuccessResponse<T[]> = {
    success: true,
    data: result.data,
    meta: result.meta,
    ...(requestId && { requestId }),
  };

  res.status(statusCode).json(response);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}

export function sendMessage(res: Response, message: string, statusCode = 200): void {
  sendSuccess(res, { message }, statusCode);
}

export function apiResponse<T>(data: T, meta?: PaginationMeta): SuccessResponse<T> {
  const requestId = getRequestId();

  return {
    success: true,
    data,
    ...(meta && { meta }),
    ...(requestId && { requestId }),
  };
}
