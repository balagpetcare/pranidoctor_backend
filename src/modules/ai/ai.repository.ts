import { throwFoundationNotImplemented } from '../../shared/errors/index.js';
import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';

import type { StartConversationDto } from './ai.dto.js';
import type { AiConversation, AiMessage, ConversationFilter, AiUsageRecord, EmergencyLevel } from './ai.types.js';

export interface AiRepositoryInterface extends ModuleService {
  createConversation(data: StartConversationDto, sessionId: string): Promise<AiConversation>;
  findConversationById(id: string): Promise<AiConversation | null>;
  findActiveConversation(userId: string): Promise<AiConversation | null>;
  updateConversation(id: string, data: Partial<AiConversation>): Promise<AiConversation>;
  endConversation(id: string): Promise<AiConversation>;
  listConversations(filter: ConversationFilter, _page: number, _pageSize: number): Promise<PaginatedResult<AiConversation>>;
  addMessage(conversationId: string, role: 'USER' | 'ASSISTANT' | 'SYSTEM', _content: string): Promise<AiMessage>;
  getMessages(conversationId: string): Promise<AiMessage[]>;
  recordUsage(usage: Omit<AiUsageRecord, 'id' | 'createdAt'>): Promise<AiUsageRecord>;
  updateEmergencyLevel(conversationId: string, _level: EmergencyLevel): Promise<void>;
}

export class AiRepository implements AiRepositoryInterface {
  readonly name = 'AiRepository';

  async createConversation(_data: StartConversationDto, _sessionId: string): Promise<AiConversation> {
    throwFoundationNotImplemented('AI conversations foundation API');
  }

  async findConversationById(_id: string): Promise<AiConversation | null> {
    throwFoundationNotImplemented('AI conversations foundation API');
  }

  async findActiveConversation(_userId: string): Promise<AiConversation | null> {
    throwFoundationNotImplemented('AI conversations foundation API');
  }

  async updateConversation(_id: string, _data: Partial<AiConversation>): Promise<AiConversation> {
    throwFoundationNotImplemented('AI conversations foundation API');
  }

  async endConversation(_id: string): Promise<AiConversation> {
    throwFoundationNotImplemented('AI conversations foundation API');
  }

  async listConversations(_filter: ConversationFilter, _page: number, _pageSize: number): Promise<PaginatedResult<AiConversation>> {
    throwFoundationNotImplemented('AI conversations foundation API');
  }

  async addMessage(_conversationId: string, _role: 'USER' | 'ASSISTANT' | 'SYSTEM', _content: string): Promise<AiMessage> {
    throwFoundationNotImplemented('AI conversations foundation API');
  }

  async getMessages(_conversationId: string): Promise<AiMessage[]> {
    throwFoundationNotImplemented('AI conversations foundation API');
  }

  async recordUsage(_usage: Omit<AiUsageRecord, 'id' | 'createdAt'>): Promise<AiUsageRecord> {
    throwFoundationNotImplemented('AI conversations foundation API');
  }

  async updateEmergencyLevel(_conversationId: string, _level: EmergencyLevel): Promise<void> {
    throwFoundationNotImplemented('AI conversations foundation API');
  }
}

