import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';

import { ProviderStatus } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { authAdmin, requireRole } from '../../shared/security/middleware/auth.middleware.js';

import { idSchema } from './discovery.validator.js';

const listQuery = z
  .object({
    status: z.nativeEnum(ProviderStatus).optional(),
    page: z.coerce.number().int().min(1).max(500).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

const statusBody = z.object({ status: z.nativeEnum(ProviderStatus) }).strict();
const idParams = z.object({ id: idSchema }).strict();

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) {
    throw new ValidationError('VALIDATION_FAILED', 'Invalid request', {
      issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return r.data;
}

/**
 * Admin control over animal health workers (doctors and AI technicians already have
 * their own admin services). Hold / suspend / reactivate; a non-ACTIVE worker is also
 * forced offline so they disappear from public lists immediately (lists additionally
 * filter on ACTIVE; public caches expire within ~60s).
 */
export function configureDiscoveryAdminRoutes(router: Router): void {
  const guard = [authAdmin, requireRole('ADMIN', 'SUPER_ADMIN')] as const;

  router.get('/admin/health-workers', ...guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = parse(listQuery, req.query);
      const prisma = getPrisma();
      const where = q.status ? { providerStatus: q.status } : {};
      const [items, total] = await Promise.all([
        prisma.healthWorkerProfile.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          select: {
            id: true,
            displayName: true,
            providerStatus: true,
            verifiedAt: true,
            ratingAvg: true,
            ratingCount: true,
            serviceFeeBdt: true,
            createdAt: true,
          },
        }),
        prisma.healthWorkerProfile.count({ where }),
      ]);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, data: items, meta: { page: q.page, limit: q.limit, total } });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    '/admin/health-workers/:id/status',
    ...guard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = parse(idParams, req.params);
        const { status } = parse(statusBody, req.body);
        const prisma = getPrisma();
        const existing = await prisma.healthWorkerProfile.findUnique({ where: { id }, select: { id: true } });
        if (!existing) throw new NotFoundError('HEALTH_WORKER_NOT_FOUND', 'Health worker not found');

        await prisma.$transaction([
          prisma.healthWorkerProfile.update({
            where: { id },
            data: {
              providerStatus: status,
              ...(status === ProviderStatus.ACTIVE ? { verifiedAt: new Date() } : {}),
            },
          }),
          ...(status === ProviderStatus.ACTIVE
            ? []
            : [
                prisma.providerPresence.updateMany({
                  where: { kind: 'HEALTH_WORKER', providerId: id },
                  data: { isOnline: false },
                }),
              ]),
        ]);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ success: true, data: { id, status } });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    '/admin/service-offerings/:id/hidden',
    ...guard,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = parse(idParams, req.params);
        const { hidden } = parse(z.object({ hidden: z.boolean() }).strict(), req.body);
        const result = await getPrisma().providerServiceOffering.updateMany({
          where: { id },
          data: { adminHidden: hidden },
        });
        if (result.count === 0) throw new NotFoundError('OFFERING_NOT_FOUND', 'Service not found');
        res.setHeader('Cache-Control', 'no-store');
        res.json({ success: true, data: { id, hidden } });
      } catch (error) {
        next(error);
      }
    },
  );
}
