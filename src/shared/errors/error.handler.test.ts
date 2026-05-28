import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { ZodError, z } from 'zod';

vi.mock('../logger/logger.js', () => ({
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { runWithContext, createRequestContext } from '../context/request-context.js';

import { AppError } from './app.error.js';
import { ConflictError, NotFoundError, ValidationError } from './http.errors.js';
import { mapPrismaError } from './prisma-error.mapper.js';
import { Prisma } from '../../generated/prisma/index.js';
import { errorHandler } from './error.handler.js';

function createMockRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, json, status };
}

describe('errorHandler', () => {
  const req = { path: '/api/test', method: 'GET' } as Request;
  const next = vi.fn() as NextFunction;

  it('returns foundation envelope for AppError', () => {
    const { res, json, status } = createMockRes();
    const ctx = createRequestContext({ requestId: 'err_req_1' });

    runWithContext(ctx, () => {
      errorHandler(new NotFoundError('USER_NOT_FOUND', 'User not found'), req, res, next);
    });

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        requestId: 'err_req_1',
      },
    });
  });

  it('returns 422 for ZodError', () => {
    const { res, json, status } = createMockRes();
    const schema = z.object({ email: z.string().email() });

    try {
      schema.parse({ email: 'bad' });
    } catch (error) {
      errorHandler(error as ZodError, req, res, next);
    }

    expect(status).toHaveBeenCalledWith(422);
    expect(json.mock.calls[0]?.[0]).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
      },
    });
  });

  it('returns 500 for unknown errors', () => {
    const { res, json, status } = createMockRes();

    errorHandler(new Error('boom'), req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  });

  it('includes details from operational AppError', () => {
    const { res, json, status } = createMockRes();

    class CustomError extends AppError {
      constructor() {
        super('Custom', 'CUSTOM', 400, { field: 'x' });
      }
    }

    errorHandler(new CustomError(), req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json.mock.calls[0]?.[0]).toMatchObject({
      success: false,
      error: {
        code: 'CUSTOM',
        details: { field: 'x' },
      },
    });
  });

  it('maps Prisma unique constraint to 409', () => {
    const { res, json, status } = createMockRes();
    const prismaErr = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    });
    const mapped = mapPrismaError(prismaErr);
    expect(mapped).toBeInstanceOf(ConflictError);
    errorHandler(mapped as ConflictError, req, res, next);
    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0]?.[0]).toMatchObject({
      success: false,
      error: { code: 'UNIQUE_CONSTRAINT' },
    });
  });

  it('maps ValidationError thrown by middleware', () => {
    const { res, status } = createMockRes();
    const err = new ValidationError('VALIDATION_FAILED', 'Validation failed for body', {
      errors: [{ field: 'email', message: 'Invalid', code: 'invalid_string' }],
      target: 'body',
    });

    errorHandler(err, req, res, next);

    expect(status).toHaveBeenCalledWith(422);
  });
});
