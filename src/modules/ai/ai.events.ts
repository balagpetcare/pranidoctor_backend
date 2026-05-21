import { eventBus, EventTypes } from '../../shared/events/index.js';

import type { EmergencyLevel, MessageRole } from './ai.types.js';

export interface ConversationStartedPayload {
  conversationId: string;
  userId: string;
  sessionId: string;
  timestamp: Date;
}

export interface ConversationEndedPayload {
  conversationId: string;
  userId: string;
  timestamp: Date;
}

export interface MessageSentPayload {
  conversationId: string;
  messageId: string;
  role: MessageRole;
  timestamp: Date;
}

export interface EmergencyDetectedPayload {
  conversationId: string;
  userId: string;
  level: EmergencyLevel;
  indicators: string[];
  timestamp: Date;
}

export const aiEvents = {
  emitConversationStarted: async (payload: ConversationStartedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.AI_CONVERSATION_STARTED, payload, 'ai');
  },

  emitConversationEnded: async (payload: ConversationEndedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.AI_CONVERSATION_ENDED, payload, 'ai');
  },

  emitMessageSent: async (payload: MessageSentPayload): Promise<void> => {
    await eventBus.publish(EventTypes.AI_MESSAGE_SENT, payload, 'ai');
  },

  emitEmergencyDetected: async (payload: EmergencyDetectedPayload): Promise<void> => {
    await eventBus.publish(EventTypes.AI_EMERGENCY_DETECTED, payload, 'ai');
  },
};
