import type { Request, Response, NextFunction } from 'express';

import { BadRequestError, NotFoundError } from '../../shared/errors/http.errors.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.js';
import { getUserId } from '../../shared/context/request-context.js';

import { toMediaResponseDto } from './media.dto.js';
import type { MediaServiceInterface } from './media.service.js';
import type {
  UploadMediaInput,
  SignedUrlQuery,
  PresignUploadInput,
} from './media.validator.js';
import type { MediaContextType, MediaPurposeType } from './media.types.js';

export class MediaController {
  constructor(private readonly mediaService: MediaServiceInterface) {}

  upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        throw new BadRequestError('UPLOAD_NO_FILE', 'No file provided');
      }

      const body = req.body as UploadMediaInput;

      const uploadInput: Parameters<MediaServiceInterface['upload']>[0] = {
        buffer: file.buffer,
        originalName: file.originalname,
        declaredMime: file.mimetype,
        context: body.context as MediaContextType,
        purpose: body.purpose as MediaPurposeType,
      };

      const userId = getUserId();
      if (userId) uploadInput.uploadedBy = userId;

      const media = await this.mediaService.upload(uploadInput);

      const signed = await this.mediaService.getSignedUrl(media.id, { variant: 'original' });
      const urls: { downloadUrl?: string; thumbnailUrl?: string } = { downloadUrl: signed.url };

      if (media.thumbnailKey) {
        const thumbnailSigned = await this.mediaService.getSignedUrl(media.id, { variant: 'thumbnail' });
        urls.thumbnailUrl = thumbnailSigned.url;
      }

      sendCreated(res, toMediaResponseDto(media, urls));
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params['id']);
      const media = await this.mediaService.getById(id);

      if (!media) {
        throw new NotFoundError('MEDIA_NOT_FOUND', 'Media not found');
      }

      sendSuccess(res, toMediaResponseDto(media));
    } catch (error) {
      next(error);
    }
  };

  getSignedUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params['id']);
      const query = req.query as unknown as SignedUrlQuery;

      const result = await this.mediaService.getSignedUrl(id, query, getUserId());

      sendSuccess(res, {
        url: result.url,
        expiresAt: result.expiresAt.toISOString(),
        mediaId: id,
        variant: result.variant,
      });
    } catch (error) {
      next(error);
    }
  };

  presign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as PresignUploadInput;
      const result = await this.mediaService.presignUpload(body, getUserId());

      sendSuccess(res, {
        uploadUrl: result.uploadUrl,
        objectKey: result.objectKey,
        fileId: result.fileId,
        expiresAt: result.expiresAt.toISOString(),
        bucket: result.bucket,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params['id']);
      await this.mediaService.delete(id, getUserId());

      sendSuccess(res, { message: 'Media deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId();
      if (!userId) {
        throw new BadRequestError('AUTH_REQUIRED', 'Authentication required');
      }

      const limit = req.query['limit'] ? Number(req.query['limit']) : 50;
      const media = await this.mediaService.listByUploader(userId, limit);

      sendSuccess(res, media.map((m) => toMediaResponseDto(m)));
    } catch (error) {
      next(error);
    }
  };
}
