import type { Request, Response, NextFunction } from 'express';
import { requireParam } from '../../shared/http/params.js';
import { omitUndefined } from '../../shared/types/object.utils.js';


import { NotFoundError } from '../../shared/errors/index.js';
import { normalizePagination } from '../../shared/utils/pagination.js';

import { toDoctorResponseDto, toDoctorScheduleResponseDto } from './doctors.dto.js';
import type { DoctorsServiceInterface } from './doctors.service.js';
import type {
  CreateDoctorInput,
  UpdateDoctorInput,
  VerifyDoctorInput,
  DoctorScheduleInput,
  DoctorFilterInput,
} from './doctors.validator.js';

export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsServiceInterface) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreateDoctorInput;
      const doctor = await this.doctorsService.create(omitUndefined(data));

      res.status(201).json({
        success: true,
        data: toDoctorResponseDto(doctor),
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const doctor = await this.doctorsService.findById(requireParam(id));

      if (!doctor) {
        throw new NotFoundError('DOCTOR_NOT_FOUND', 'Doctor not found');
      }

      res.status(200).json({
        success: true,
        data: toDoctorResponseDto(doctor),
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = req.body as UpdateDoctorInput;

      const doctor = await this.doctorsService.update(requireParam(id), omitUndefined(data));

      res.status(200).json({
        success: true,
        data: toDoctorResponseDto(doctor),
      });
    } catch (error) {
      next(error);
    }
  };

  verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = req.body as VerifyDoctorInput;

      const doctor = await this.doctorsService.verify(requireParam(id), omitUndefined(data));

      res.status(200).json({
        success: true,
        data: toDoctorResponseDto(doctor),
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = req.query as unknown as DoctorFilterInput;
      const { page, pageSize, ...listFilter } = filter;
      const pagination = normalizePagination({ page, pageSize });
      const result = await this.doctorsService.list(omitUndefined(listFilter), pagination.page, pagination.pageSize);

      res.status(200).json({
        success: true,
        data: result.data.map(toDoctorResponseDto),
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  getSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const schedules = await this.doctorsService.getSchedule(requireParam(id));

      res.status(200).json({
        success: true,
        data: schedules.map(toDoctorScheduleResponseDto),
      });
    } catch (error) {
      next(error);
    }
  };

  setSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const schedules = req.body as DoctorScheduleInput[];

      const result = await this.doctorsService.setSchedule(requireParam(id), schedules);

      res.status(200).json({
        success: true,
        data: result.map(toDoctorScheduleResponseDto),
      });
    } catch (error) {
      next(error);
    }
  };
}
