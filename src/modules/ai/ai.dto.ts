import type {
  AiConversation,
  AiMessage,
  ConversationStatus,
  ConversationContext,
  EmergencyLevel,
  MessageRole,
  ChatResponse,
} from './ai.types.js';
import { omitUndefined } from '../../shared/types/object.utils.js';

export interface StartConversationDto {
  userId: string;
  context?: ConversationContext;
}

export interface SendMessageDto {
  conversationId: string;
  content: string;
}

export interface EndConversationDto {
  conversationId: string;
  reason?: string;
}

export interface ConversationResponseDto {
  id: string;
  userId: string;
  sessionId: string;
  status: ConversationStatus;
  context?: ConversationContext;
  emergencyLevel?: EmergencyLevel;
  startedAt: string;
  endedAt?: string;
}

export interface MessageResponseDto {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ChatResponseDto {
  success: boolean;
  data: {
    conversationId: string;
    messageId: string;
    content: string;
    emergencyLevel?: EmergencyLevel;
    suggestedActions?: string[];
  };
}

export function toConversationResponseDto(conversation: AiConversation): ConversationResponseDto {
  return omitUndefined({
    id: conversation.id,
    userId: conversation.userId,
    sessionId: conversation.sessionId,
    status: conversation.status,
    context: conversation.context,
    emergencyLevel: conversation.emergencyLevel,
    startedAt: conversation.startedAt.toISOString(),
    endedAt: conversation.endedAt?.toISOString(),
  });
}

export function toMessageResponseDto(message: AiMessage): MessageResponseDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toChatResponseDto(response: ChatResponse): ChatResponseDto {
  return {
    success: true,
    data: omitUndefined({
      conversationId: response.conversationId,
      messageId: response.messageId,
      content: response.content,
      emergencyLevel: response.emergencyLevel,
      suggestedActions: response.suggestedActions,
    }),
  };
}
