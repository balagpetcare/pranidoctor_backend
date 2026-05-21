import type { Request, Response, NextFunction } from 'express';
import { requireParam } from '../../shared/http/params.js';
import { omitUndefined } from '../../shared/types/object.utils.js';


import { NotFoundError } from '../../shared/errors/index.js';
import { normalizePagination } from '../../shared/utils/pagination.js';

import { toClinicResponseDto, toClinicServiceResponseDto, toClinicStaffResponseDto } from './clinics.dto.js';
import type { ClinicsServiceInterface } from './clinics.service.js';
import type {
  CreateClinicInput,
  UpdateClinicInput,
  CreateClinicServiceInput,
  AddStaffInput,
  ClinicFilterInput,
} from './clinics.validator.js';

export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsServiceInterface) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreateClinicInput;
      const clinic = await this.clinicsService.create(omitUndefined(data));

      res.status(201).json({
        success: true,
        data: toClinicResponseDto(clinic),
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const clinic = await this.clinicsService.findById(requireParam(id));

      if (!clinic) {
        throw new NotFoundError('CLINIC_NOT_FOUND', 'Clinic not found');
      }

      res.status(200).json({
        success: true,
        data: toClinicResponseDto(clinic),
      });
    } catch (error) {
      next(error);
    }
  };

  getBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { slug } = req.params;
      const clinic = await this.clinicsService.findBySlug(requireParam(slug));

      if (!clinic) {
        throw new NotFoundError('CLINIC_NOT_FOUND', 'Clinic not found');
      }

      res.status(200).json({
        success: true,
        data: toClinicResponseDto(clinic),
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = req.body as UpdateClinicInput;

      const clinic = await this.clinicsService.update(requireParam(id), omitUndefined(data));

      res.status(200).json({
        success: true,
        data: toClinicResponseDto(clinic),
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = req.query as unknown as ClinicFilterInput;
      const { page, pageSize, ...listFilter } = filter;
      const pagination = normalizePagination({ page, pageSize });
      const result = await this.clinicsService.list(omitUndefined(listFilter), pagination.page, pagination.pageSize);

      res.status(200).json({
        success: true,
        data: result.data.map(toClinicResponseDto),
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  getServices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const services = await this.clinicsService.getServices(requireParam(id));

      res.status(200).json({
        success: true,
        data: services.map(toClinicServiceResponseDto),
      });
    } catch (error) {
      next(error);
    }
  };

  addService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreateClinicServiceInput;
      const service = await this.clinicsService.addService(omitUndefined(data));

      res.status(201).json({
        success: true,
        data: toClinicServiceResponseDto(service),
      });
    } catch (error) {
      next(error);
    }
  };

  removeService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { serviceId } = req.params;
      await this.clinicsService.removeService(requireParam(serviceId));

      res.status(200).json({
        success: true,
        data: { message: 'Service removed successfully' },
      });
    } catch (error) {
      next(error);
    }
  };

  getStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const staff = await this.clinicsService.getStaff(requireParam(id));

      res.status(200).json({
        success: true,
        data: staff.map(toClinicStaffResponseDto),
      });
    } catch (error) {
      next(error);
    }
  };

  addStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as AddStaffInput;
      const staff = await this.clinicsService.addStaff(data);

      res.status(201).json({
        success: true,
        data: toClinicStaffResponseDto(staff),
      });
    } catch (error) {
      next(error);
    }
  };

  removeStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { staffId } = req.params;
      await this.clinicsService.removeStaff(requireParam(staffId));

      res.status(200).json({
        success: true,
        data: { message: 'Staff removed successfully' },
      });
    } catch (error) {
      next(error);
    }
  };
}
