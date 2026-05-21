import type { Request, Response, NextFunction } from 'express';

import { omitUndefined } from '../../shared/types/object.utils.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { normalizePagination } from '../../shared/utils/pagination.js';

import { toNotificationResponseDto } from './notifications.dto.js';
import type { NotificationsServiceInterface } from './notifications.service.js';
import type {
  CreateNotificationInput,
  SendSmsInput,
  SendPushInput,
  NotificationFilterInput,
  MarkReadInput,
} from './notifications.validator.js';

export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsServiceInterface) {}

  send = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreateNotificationInput;
      const notification = await this.notificationsService.send(omitUndefined(data));

      res.status(201).json({
        success: true,
        data: toNotificationResponseDto(notification),
      });
    } catch (error) {
      next(error);
    }
  };

  sendSms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as SendSmsInput;
      await this.notificationsService.sendSms(omitUndefined(data));

      res.status(200).json({
        success: true,
        data: { message: 'SMS sent successfully' },
      });
    } catch (error) {
      next(error);
    }
  };

  sendPush = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as SendPushInput;
      await this.notificationsService.sendPush(omitUndefined(data));

      res.status(200).json({
        success: true,
        data: { message: 'Push notification sent successfully' },
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = req.query as unknown as NotificationFilterInput;
      const { page, pageSize, ...listFilter } = filter;
      const pagination = normalizePagination({ page, pageSize });
      const result = await this.notificationsService.list(omitUndefined(listFilter), pagination.page, pagination.pageSize);

      res.status(200).json({
        success: true,
        data: result.data.map(toNotificationResponseDto),
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  getMyNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as Request & { userId?: string }).userId;

      if (!userId) {
        throw new NotFoundError('USER_NOT_FOUND', 'User not found');
      }

      const filter = req.query as unknown as NotificationFilterInput;
      const { page, pageSize, ...listFilter } = filter;
      const pagination = normalizePagination({ page, pageSize });

      const result = await this.notificationsService.list(
        omitUndefined({ ...listFilter, userId }),
        pagination.page,
        pagination.pageSize
      );

      res.status(200).json({
        success: true,
        data: result.data.map(toNotificationResponseDto),
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as Request & { userId?: string }).userId;

      if (!userId) {
        throw new NotFoundError('USER_NOT_FOUND', 'User not found');
      }

      const count = await this.notificationsService.getUnreadCount(userId);

      res.status(200).json({
        success: true,
        data: { unreadCount: count },
      });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { notificationIds } = req.body as MarkReadInput;
      await this.notificationsService.markAsRead(notificationIds);

      res.status(200).json({
        success: true,
        data: { message: 'Notifications marked as read' },
      });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as Request & { userId?: string }).userId;

      if (!userId) {
        throw new NotFoundError('USER_NOT_FOUND', 'User not found');
      }

      await this.notificationsService.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        data: { message: 'All notifications marked as read' },
      });
    } catch (error) {
      next(error);
    }
  };
}
