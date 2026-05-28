import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';

import type { AppConfig } from '../../shared/config/config.schema.js';
import { BadRequestError } from '../../shared/errors/http.errors.js';

const memoryStorage = multer.memoryStorage();

export function createUploadMiddleware(config: AppConfig) {
  const maxBytes = Math.max(
    config.storage.maxImageBytes,
    config.storage.maxDocumentBytes,
    config.storage.maxVideoBytes
  );

  const upload = multer({
    storage: memoryStorage,
    limits: {
      fileSize: maxBytes,
      files: 1,
    },
    fileFilter: (_req, file, cb) => {
      const allowed = new Set([
        ...config.storage.allowedImageMimes,
        ...config.storage.allowedDocumentMimes,
        ...config.storage.allowedVideoMimes,
      ]);
      if (!allowed.has(file.mimetype)) {
        cb(
          new BadRequestError('UPLOAD_INVALID_TYPE', 'File type is not allowed', {
            mimetype: file.mimetype,
            allowed: [...allowed],
          }),
        );
        return;
      }
      cb(null, true);
    },
  });

  return {
    single: (fieldName = 'file') =>
      (req: Request, res: Response, next: NextFunction) => {
        upload.single(fieldName)(req, res, (err: unknown) => {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              next(
                new BadRequestError('UPLOAD_FILE_TOO_LARGE', 'File exceeds maximum allowed size', {
                  maxBytes,
                })
              );
              return;
            }
            next(new BadRequestError('UPLOAD_FAILED', err.message));
            return;
          }
          if (err) {
            next(err);
            return;
          }
          next();
        });
      },
  };
}

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
      }
    }
  }
}
