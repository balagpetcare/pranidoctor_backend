import type { Request, Response, NextFunction } from 'express';
import { requireParam } from '../../shared/http/params.js';
import { omitUndefined } from '../../shared/types/object.utils.js';


import { NotFoundError } from '../../shared/errors/index.js';
import { normalizePagination } from '../../shared/utils/pagination.js';

import { toAnimalResponseDto, toMedicalRecordResponseDto } from './animals.dto.js';
import type { AnimalsServiceInterface } from './animals.service.js';
import type {
  CreateAnimalInput,
  UpdateAnimalInput,
  CreateMedicalRecordInput,
  AnimalFilterInput,
} from './animals.validator.js';

export class AnimalsController {
  constructor(private readonly animalsService: AnimalsServiceInterface) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreateAnimalInput;
      const animal = await this.animalsService.create(omitUndefined(data));

      res.status(201).json({
        success: true,
        data: toAnimalResponseDto(animal),
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const animal = await this.animalsService.findById(requireParam(id));

      if (!animal) {
        throw new NotFoundError('ANIMAL_NOT_FOUND', 'Animal not found');
      }

      res.status(200).json({
        success: true,
        data: toAnimalResponseDto(animal),
      });
    } catch (error) {
      next(error);
    }
  };

  getByOwner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ownerId } = req.params;
      const animals = await this.animalsService.findByOwner(requireParam(ownerId));

      res.status(200).json({
        success: true,
        data: animals.map(toAnimalResponseDto),
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = req.body as UpdateAnimalInput;

      const animal = await this.animalsService.update(requireParam(id), omitUndefined(data));

      res.status(200).json({
        success: true,
        data: toAnimalResponseDto(animal),
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.animalsService.delete(requireParam(id));

      res.status(200).json({
        success: true,
        data: { message: 'Animal deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = req.query as unknown as AnimalFilterInput;
      const { page, pageSize, ...listFilter } = filter;
      const pagination = normalizePagination({ page, pageSize });
      const result = await this.animalsService.list(omitUndefined(listFilter), pagination.page, pagination.pageSize);

      res.status(200).json({
        success: true,
        data: result.data.map(toAnimalResponseDto),
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  getMedicalRecords = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const records = await this.animalsService.getMedicalRecords(requireParam(id));

      res.status(200).json({
        success: true,
        data: records.map(toMedicalRecordResponseDto),
      });
    } catch (error) {
      next(error);
    }
  };

  addMedicalRecord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreateMedicalRecordInput;
      const record = await this.animalsService.addMedicalRecord(omitUndefined(data));

      res.status(201).json({
        success: true,
        data: toMedicalRecordResponseDto(record),
      });
    } catch (error) {
      next(error);
    }
  };
}
