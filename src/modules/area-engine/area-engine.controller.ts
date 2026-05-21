import type { Request, Response } from 'express';
import { z } from 'zod';

import { NotFoundError, ValidationError } from '../../shared/errors/http.errors.js';
import { sendPaginated, sendSuccess } from '../../shared/utils/response.js';

import type { AreaLevel, AreaLocale } from './area-engine.types.js';
import { getAreaRepository } from './repository/area.repository.js';
import { getAreaSearchService } from './search/area-search.service.js';
import { getAreaSeedVersion } from './seed/area-seed.service.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  locale: z.enum(['bn', 'en']).optional(),
});

const searchQuerySchema = listQuerySchema.extend({
  q: z.string().min(1),
  level: z
    .enum(['ALL', 'DIVISION', 'DISTRICT', 'UPAZILA', 'UNION', 'VILLAGE'])
    .optional(),
  divisionId: z.string().optional(),
  districtId: z.string().optional(),
  upazilaId: z.string().optional(),
  unionId: z.string().optional(),
});

function parseListQuery(req: Request): { page?: number; pageSize?: number; locale?: AreaLocale } {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('VALIDATION_FAILED', 'Invalid query parameters', {
      errors: parsed.error.flatten(),
    });
  }
  const out: { page?: number; pageSize?: number; locale?: AreaLocale } = {};
  if (parsed.data.page !== undefined) out.page = parsed.data.page;
  if (parsed.data.pageSize !== undefined) out.pageSize = parsed.data.pageSize;
  if (parsed.data.locale !== undefined) out.locale = parsed.data.locale;
  return out;
}

function parseSearchQuery(req: Request) {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('VALIDATION_FAILED', 'Invalid search parameters', {
      errors: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

function paramId(req: Request, name: string): string {
  const raw = req.params[name];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) throw new ValidationError('VALIDATION_FAILED', `${name} required`);
  return id;
}

export class AreaEngineController {
  async getDivisions(req: Request, res: Response): Promise<void> {
    const query = parseListQuery(req);
    const result = await getAreaRepository().listDivisions(query);
    sendPaginated(res, result);
  }

  async getDistricts(req: Request, res: Response): Promise<void> {
    const divisionId = paramId(req, 'id');
    const query = parseListQuery(req);
    const repo = getAreaRepository();
    if (!(await repo.assertParentExists('DISTRICT', divisionId))) {
      throw new NotFoundError('DIVISION_NOT_FOUND', 'Division not found');
    }
    sendPaginated(res, await repo.listDistricts(divisionId, query));
  }

  async getUpazilas(req: Request, res: Response): Promise<void> {
    const districtId = paramId(req, 'id');
    const query = parseListQuery(req);
    const repo = getAreaRepository();
    if (!(await repo.assertParentExists('UPAZILA', districtId))) {
      throw new NotFoundError('DISTRICT_NOT_FOUND', 'District not found');
    }
    sendPaginated(res, await repo.listUpazilas(districtId, query));
  }

  async getUnions(req: Request, res: Response): Promise<void> {
    const upazilaId = paramId(req, 'id');
    const query = parseListQuery(req);
    const repo = getAreaRepository();
    if (!(await repo.assertParentExists('UNION', upazilaId))) {
      throw new NotFoundError('UPAZILA_NOT_FOUND', 'Upazila not found');
    }
    sendPaginated(res, await repo.listUnions(upazilaId, query));
  }

  async getVillages(req: Request, res: Response): Promise<void> {
    const unionId = paramId(req, 'id');
    const query = parseListQuery(req);
    const repo = getAreaRepository();
    if (!(await repo.assertParentExists('VILLAGE', unionId))) {
      throw new NotFoundError('UNION_NOT_FOUND', 'Union not found');
    }
    sendPaginated(res, await repo.listVillages(unionId, query));
  }

  async search(req: Request, res: Response): Promise<void> {
    const query = parseSearchQuery(req);
    const level = (query.level ?? 'ALL') as AreaLevel | 'ALL';
    const result = await getAreaSearchService().search({
      q: query.q,
      level,
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
      ...(query.locale !== undefined ? { locale: query.locale } : {}),
      ...(query.divisionId !== undefined ? { divisionId: query.divisionId } : {}),
      ...(query.districtId !== undefined ? { districtId: query.districtId } : {}),
      ...(query.upazilaId !== undefined ? { upazilaId: query.upazilaId } : {}),
      ...(query.unionId !== undefined ? { unionId: query.unionId } : {}),
    });
    sendPaginated(res, result);
  }

  async getSeedVersion(_req: Request, res: Response): Promise<void> {
    const version = await getAreaSeedVersion();
    sendSuccess(res, { seed: version });
  }
}
