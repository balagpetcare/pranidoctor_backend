import { omitUndefined, omitUndefinedDeep } from '../../shared/types/object.utils.js';
import type { ModuleService } from '../../shared/module/module.types.js';
import type { PaginatedResult } from '../../shared/types/api.types.js';

import type { StartConversationDto, EndConversationDto } from './ai.dto.js';
import { aiEvents } from './ai.events.js';
import type { AiRepositoryInterface } from './ai.repository.js';
import type { AiConversation, AiMessage, ChatRequest, ChatResponse, ConversationFilter } from './ai.types.js';

export interface AiServiceInterface extends ModuleService {
  startConversation(data: StartConversationDto): Promise<AiConversation>;
  chat(userId: string, request: ChatRequest): Promise<ChatResponse>;
  endConversation(data: EndConversationDto): Promise<AiConversation>;
  getConversation(id: string): Promise<AiConversation | null>;
  getMessages(conversationId: string): Promise<AiMessage[]>;
  listConversations(filter: ConversationFilter, page: number, pageSize: number): Promise<PaginatedResult<AiConversation>>;
}

export class AiService implements AiServiceInterface {
  readonly name = 'AiService';

  constructor(private readonly repository: AiRepositoryInterface) {}

  async startConversation(data: StartConversationDto): Promise<AiConversation> {
    const sessionId = crypto.randomUUID();
    const conversation = await this.repository.createConversation(data, sessionId);

    await aiEvents.emitConversationStarted({
      conversationId: conversation.id,
      userId: conversation.userId,
      sessionId: conversation.sessionId,
      timestamp: new Date(),
    });

    return conversation;
  }

  async chat(userId: string, request: ChatRequest): Promise<ChatResponse> {
    let conversation: AiConversation;

    if (request.conversationId) {
      const existing = await this.repository.findConversationById(request.conversationId);
      if (!existing) {
        throw new Error('Conversation not found');
      }
      conversation = existing;
    } else {
      conversation = await this.startConversation(
        omitUndefinedDeep({
          userId,
          context: request.context,
        })
      );
    }

    const userMessage = await this.repository.addMessage(
      conversation.id,
      'USER',
      request.message
    );

    await aiEvents.emitMessageSent({
      conversationId: conversation.id,
      messageId: userMessage.id,
      role: 'USER',
      timestamp: new Date(),
    });

    // TODO: Implement actual AI completion in Phase 2
    // For now, return a placeholder response
    const aiResponse = 'AI response placeholder - implement with actual AI provider';

    const assistantMessage = await this.repository.addMessage(
      conversation.id,
      'ASSISTANT',
      aiResponse
    );

    return omitUndefined({
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      content: aiResponse,
      emergencyLevel: conversation.emergencyLevel,
      suggestedActions: [] as string[],
    });
  }

  async endConversation(data: EndConversationDto): Promise<AiConversation> {
    const conversation = await this.repository.endConversation(data.conversationId);

    await aiEvents.emitConversationEnded({
      conversationId: conversation.id,
      userId: conversation.userId,
      timestamp: new Date(),
    });

    return conversation;
  }

  async getConversation(id: string): Promise<AiConversation | null> {
    return this.repository.findConversationById(id);
  }

  async getMessages(conversationId: string): Promise<AiMessage[]> {
    return this.repository.getMessages(conversationId);
  }

  async listConversations(filter: ConversationFilter, page: number, pageSize: number): Promise<PaginatedResult<AiConversation>> {
    return this.repository.listConversations(filter, page, pageSize);
  }
}
