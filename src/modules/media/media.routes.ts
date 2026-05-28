import type { Router } from 'express';

import type { AppConfig } from '../../shared/config/config.schema.js';
import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { validateBody, validateParams, validateQuery } from '../../shared/validation/validate.middleware.js';
import { optionalAuthMobile, rateLimitUpload, whenRateLimitAvailable } from '../../shared/security/index.js';

import type { MediaController } from './media.controller.js';
import { createUploadMiddleware } from './media.upload.middleware.js';
import {
  uploadMediaSchema,
  mediaIdParamSchema,
  signedUrlQuerySchema,
  presignUploadSchema,
} from './media.validator.js';

export function configureMediaRoutes(
  router: Router,
  controller: MediaController,
  config: AppConfig
): void {
  const uploadMiddleware = createUploadMiddleware(config);

  router.post(
    '/upload',
    whenRateLimitAvailable(rateLimitUpload),
    optionalAuthMobile,
    uploadMiddleware.single('file'),
    validateBody(uploadMediaSchema),
    asyncHandler(controller.upload)
  );

  router.post(
    '/presign',
    whenRateLimitAvailable(rateLimitUpload),
    optionalAuthMobile,
    validateBody(presignUploadSchema),
    asyncHandler(controller.presign)
  );

  router.get(
    '/mine',
    optionalAuthMobile,
    asyncHandler(controller.listMine)
  );

  router.get(
    '/:id',
    validateParams(mediaIdParamSchema),
    asyncHandler(controller.getById)
  );

  router.get(
    '/:id/url',
    validateParams(mediaIdParamSchema),
    validateQuery(signedUrlQuerySchema),
    optionalAuthMobile,
    asyncHandler(controller.getSignedUrl)
  );

  router.delete(
    '/:id',
    validateParams(mediaIdParamSchema),
    optionalAuthMobile,
    asyncHandler(controller.delete)
  );
}
