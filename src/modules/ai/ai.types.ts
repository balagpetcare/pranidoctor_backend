export interface AiConversation {
  id: string;
  userId: string;
  sessionId: string;
  status: ConversationStatus;
  context?: ConversationContext;
  emergencyLevel?: EmergencyLevel;
  startedAt: Date;
  endedAt?: Date;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationStatus = 'ACTIVE' | 'ENDED' | 'ESCALATED' | 'ABANDONED';

export interface ConversationContext {
  animalType?: string;
  symptoms?: string[];
  urgencyIndicators?: string[];
  previousDiagnosis?: string[];
}

export type EmergencyLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AiMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata?: MessageMetadata;
  createdAt: Date;
}

export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface MessageMetadata {
  tokens?: number;
  model?: string;
  latency?: number;
  intent?: string;
  confidence?: number;
}

export interface AiUsageRecord {
  id: string;
  conversationId: string;
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost?: number;
  latency: number;
  createdAt: Date;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  context?: ConversationContext;
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
  content: string;
  emergencyLevel?: EmergencyLevel;
  suggestedActions?: string[];
}

export interface ConversationFilter {
  userId?: string;
  status?: ConversationStatus;
  emergencyLevel?: EmergencyLevel;
  dateFrom?: Date;
  dateTo?: Date;
}
