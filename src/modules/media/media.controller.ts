import type { Request, Response, NextFunction } from 'express';
import { ServiceUnavailableError } from '../../shared/errors/index.js';
const MSG = 'Media API pending port from legacy web storage';
export class MediaController {
  upload = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new ServiceUnavailableError('MEDIA_MIGRATION_PENDING', MSG));
  };
  presign = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new ServiceUnavailableError('MEDIA_MIGRATION_PENDING', MSG));
  };
  listMine = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new ServiceUnavailableError('MEDIA_MIGRATION_PENDING', MSG));
  };
  getById = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new ServiceUnavailableError('MEDIA_MIGRATION_PENDING', MSG));
  };
  getSignedUrl = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new ServiceUnavailableError('MEDIA_MIGRATION_PENDING', MSG));
  };
  delete = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    next(new ServiceUnavailableError('MEDIA_MIGRATION_PENDING', MSG));
  };
}
