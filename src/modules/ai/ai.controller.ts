import type { Request, Response, NextFunction } from 'express';
import { requireParam } from '../../shared/http/params.js';
import { omitUndefined, omitUndefinedDeep } from '../../shared/types/object.utils.js';


import { NotFoundError } from '../../shared/errors/index.js';
import { normalizePagination } from '../../shared/utils/pagination.js';

import { toConversationResponseDto, toMessageResponseDto, toChatResponseDto, type StartConversationDto } from './ai.dto.js';
import type { ChatRequest } from './ai.types.js';
import type { AiServiceInterface } from './ai.service.js';
import type {
  StartConversationInput,
  ChatRequestInput,
  ConversationFilterInput,
} from './ai.validator.js';

export class AiController {
  constructor(private readonly aiService: AiServiceInterface) {}

  startConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as StartConversationInput;
      const conversation = await this.aiService.startConversation(
        omitUndefinedDeep(data) as StartConversationDto
      );

      res.status(201).json({
        success: true,
        data: toConversationResponseDto(conversation),
      });
    } catch (error) {
      next(error);
    }
  };

  chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as ChatRequestInput;
      const userId = (req as Request & { userId?: string }).userId;

      if (!userId) {
        throw new NotFoundError('USER_NOT_FOUND', 'User not found');
      }

      const response = await this.aiService.chat(
        userId,
        omitUndefinedDeep(data) as ChatRequest
      );

      res.status(200).json(toChatResponseDto(response));
    } catch (error) {
      next(error);
    }
  };

  endConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const conversation = await this.aiService.endConversation({
        conversationId: requireParam(id),
      });

      res.status(200).json({
        success: true,
        data: toConversationResponseDto(conversation),
      });
    } catch (error) {
      next(error);
    }
  };

  getConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const conversation = await this.aiService.getConversation(requireParam(id));

      if (!conversation) {
        throw new NotFoundError('CONVERSATION_NOT_FOUND', 'Conversation not found');
      }

      res.status(200).json({
        success: true,
        data: toConversationResponseDto(conversation),
      });
    } catch (error) {
      next(error);
    }
  };

  getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const messages = await this.aiService.getMessages(requireParam(id));

      res.status(200).json({
        success: true,
        data: messages.map(toMessageResponseDto),
      });
    } catch (error) {
      next(error);
    }
  };

  listConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = req.query as unknown as ConversationFilterInput;
      const { page, pageSize, ...listFilter } = filter;
      const pagination = normalizePagination({ page, pageSize });

      const result = await this.aiService.listConversations(
        omitUndefined(listFilter),
        pagination.page,
        pagination.pageSize
      );

      res.status(200).json({
        success: true,
        data: result.data.map(toConversationResponseDto),
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };
}
