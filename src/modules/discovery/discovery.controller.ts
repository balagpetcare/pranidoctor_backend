import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

import { UnauthorizedError, ValidationError } from '../../shared/errors/index.js';

import type { DiscoveryService } from './discovery.service.js';
import {
  hubQuerySchema,
  presenceBodySchema,
  providerDetailQuerySchema,
  providerListQuerySchema,
  providerParamsSchema,
} from './discovery.validator.js';

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError('VALIDATION_FAILED', 'Invalid request', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

/** Public, anonymous-safe reads can be cached briefly by CDNs and the mobile HTTP cache. */
function setPublicCache(res: Response, maxAge: number): void {
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
}

export class DiscoveryController {
  constructor(private readonly service: DiscoveryService) {}

  hub = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = parse(hubQuerySchema, req.query);
      const data = await this.service.getHub(query.areaId);
      setPublicCache(res, 30);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = parse(providerListQuerySchema, req.query);
      const data = await this.service.listProviders(query);
      setPublicCache(res, 15);
      res.json({
        success: true,
        data: data.items,
        meta: { page: data.page, limit: data.limit, total: data.total, hasMore: data.hasMore },
      });
    } catch (error) {
      next(error);
    }
  };

  detail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const params = parse(providerParamsSchema, req.params);
      const query = parse(providerDetailQuerySchema, req.query);
      const data = await this.service.getProvider(params.kind, params.id, query.areaId);
      setPublicCache(res, 30);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  presence = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required');
      const body = parse(presenceBodySchema, req.body);
      const data = await this.service.setPresence(req.user.id, body.online);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
