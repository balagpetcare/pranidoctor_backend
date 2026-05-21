import type { Request, Response, NextFunction } from 'express';
import { requireParam } from '../../shared/http/params.js';
import { omitUndefined, omitUndefinedDeep } from '../../shared/types/object.utils.js';


import { NotFoundError } from '../../shared/errors/index.js';
import { normalizePagination } from '../../shared/utils/pagination.js';

import { toUserResponseDto, toUserProfileResponseDto, type UpdateUserProfileDto } from './users.dto.js';
import type { UsersServiceInterface } from './users.service.js';
import type { UpdateUserInput, UpdateUserProfileInput, UserFilterInput } from './users.validator.js';

export class UsersController {
  constructor(private readonly usersService: UsersServiceInterface) {}

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as Request & { userId?: string }).userId;

      if (!userId) {
        throw new NotFoundError('USER_NOT_FOUND', 'User not found');
      }

      const user = await this.usersService.findById(userId);

      if (!user) {
        throw new NotFoundError('USER_NOT_FOUND', 'User not found');
      }

      res.status(200).json({
        success: true,
        data: toUserResponseDto(user),
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = await this.usersService.findById(requireParam(id));

      if (!user) {
        throw new NotFoundError('USER_NOT_FOUND', 'User not found');
      }

      res.status(200).json({
        success: true,
        data: toUserResponseDto(user),
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = req.body as UpdateUserInput;

      const user = await this.usersService.update(requireParam(id), omitUndefined(data));

      res.status(200).json({
        success: true,
        data: toUserResponseDto(user),
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = req.query as unknown as UserFilterInput;
      const { page, pageSize, ...listFilter } = filter;
      const pagination = normalizePagination({ page, pageSize });
      const result = await this.usersService.list(omitUndefined(listFilter), pagination.page, pagination.pageSize);

      res.status(200).json({
        success: true,
        data: result.data.map(toUserResponseDto),
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as Request & { userId?: string }).userId;

      if (!userId) {
        throw new NotFoundError('USER_NOT_FOUND', 'User not found');
      }

      const profile = await this.usersService.getProfile(userId);

      if (!profile) {
        throw new NotFoundError('PROFILE_NOT_FOUND', 'Profile not found');
      }

      res.status(200).json({
        success: true,
        data: toUserProfileResponseDto(profile),
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as Request & { userId?: string }).userId;

      if (!userId) {
        throw new NotFoundError('USER_NOT_FOUND', 'User not found');
      }

      const data = req.body as UpdateUserProfileInput;
      const profile = await this.usersService.updateProfile(
        userId,
        omitUndefinedDeep(data) as UpdateUserProfileDto
      );

      res.status(200).json({
        success: true,
        data: toUserProfileResponseDto(profile),
      });
    } catch (error) {
      next(error);
    }
  };
}
