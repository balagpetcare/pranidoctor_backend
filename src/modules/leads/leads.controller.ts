import type { Request, Response, NextFunction } from 'express';
import { requireParam } from '../../shared/http/params.js';
import { omitUndefined } from '../../shared/types/object.utils.js';


import { NotFoundError } from '../../shared/errors/index.js';
import { normalizePagination } from '../../shared/utils/pagination.js';

import { toLeadResponseDto, toLeadActivityResponseDto } from './leads.dto.js';
import type { LeadsServiceInterface } from './leads.service.js';
import type {
  CreateLeadInput,
  UpdateLeadInput,
  AssignLeadInput,
  ConvertLeadInput,
  LeadFilterInput,
} from './leads.validator.js';

export class LeadsController {
  constructor(private readonly leadsService: LeadsServiceInterface) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreateLeadInput;
      const lead = await this.leadsService.create(omitUndefined(data));

      res.status(201).json({
        success: true,
        data: toLeadResponseDto(lead),
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const lead = await this.leadsService.findById(requireParam(id));

      if (!lead) {
        throw new NotFoundError('LEAD_NOT_FOUND', 'Lead not found');
      }

      res.status(200).json({
        success: true,
        data: toLeadResponseDto(lead),
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = req.body as UpdateLeadInput;
      const userId = (req as Request & { userId?: string }).userId ?? 'SYSTEM';

      const lead = await this.leadsService.update(requireParam(id), omitUndefined(data), userId);

      res.status(200).json({
        success: true,
        data: toLeadResponseDto(lead),
      });
    } catch (error) {
      next(error);
    }
  };

  assign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = req.body as AssignLeadInput;
      const userId = (req as Request & { userId?: string }).userId ?? 'SYSTEM';

      const lead = await this.leadsService.assign(requireParam(id), omitUndefined(data), userId);

      res.status(200).json({
        success: true,
        data: toLeadResponseDto(lead),
      });
    } catch (error) {
      next(error);
    }
  };

  convert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = req.body as ConvertLeadInput;
      const userId = (req as Request & { userId?: string }).userId ?? 'SYSTEM';

      const lead = await this.leadsService.convert(requireParam(id), omitUndefined(data), userId);

      res.status(200).json({
        success: true,
        data: toLeadResponseDto(lead),
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = req.query as unknown as LeadFilterInput;
      const { page, pageSize, ...listFilter } = filter;
      const pagination = normalizePagination({ page, pageSize });
      const result = await this.leadsService.list(omitUndefined(listFilter), pagination.page, pagination.pageSize);

      res.status(200).json({
        success: true,
        data: result.data.map(toLeadResponseDto),
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  getActivities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const activities = await this.leadsService.getActivities(requireParam(id));

      res.status(200).json({
        success: true,
        data: activities.map(toLeadActivityResponseDto),
      });
    } catch (error) {
      next(error);
    }
  };
}
