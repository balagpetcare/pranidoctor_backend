import type { Router } from 'express';

import { createValidationMiddleware } from '../auth/validation.middleware.js';

import type { NotificationsController } from './notifications.controller.js';
import {
  createNotificationSchema,
  sendSmsSchema,
  sendPushSchema,
  notificationFilterSchema,
  markReadSchema,
} from './notifications.validator.js';

export function configureNotificationsRoutes(router: Router, controller: NotificationsController): void {
  router.post(
    '/send',
    createValidationMiddleware(createNotificationSchema),
    controller.send
  );

  router.post(
    '/sms',
    createValidationMiddleware(sendSmsSchema),
    controller.sendSms
  );

  router.post(
    '/push',
    createValidationMiddleware(sendPushSchema),
    controller.sendPush
  );

  router.get(
    '/',
    createValidationMiddleware(notificationFilterSchema),
    controller.list
  );

  router.get('/me', controller.getMyNotifications);

  router.get('/me/unread-count', controller.getUnreadCount);

  router.post(
    '/read',
    createValidationMiddleware(markReadSchema),
    controller.markAsRead
  );

  router.post('/read-all', controller.markAllAsRead);
}
